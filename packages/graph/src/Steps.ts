import { compare } from "./Comparator.js";
import { MaxIterationsExceededError, MemoryLimitExceededError } from "./Exceptions.js";
import { evaluateFunction, functionRegistry, isAggregateFunction } from "./FunctionRegistry.js";
import { Edge, GraphSource, Vertex, $StoredElement } from "./Graph.js";
import { GraphSchema } from "./GraphSchema.js";
import { ElementId } from "./GraphStorage.js";
import { procedureRegistry } from "./ProcedureRegistry.js";
import { QueryContext, QueryParams, QueryContextOptions } from "./QueryContext.js";
import { isTemporalValue, DurationValue, addDuration, subtractDuration } from "./TemporalTypes.js";
import { TraversalPath } from "./Traversals.js";
import {
  analyzeCondition,
  selectBestIndexHint,
  extractRemainingCondition,
  IndexHint,
} from "./indexes/QueryPlanner.js";

// Re-export QueryContext types for convenience
export { QueryContext, QueryContextOptions } from "./QueryContext.js";
export type { QueryParams } from "./QueryContext.js";

/**
 * Global query context for backward compatibility.
 * @internal
 * @deprecated Use QueryContext passed to Traverser.traverse() instead.
 */
let currentQueryParams: QueryParams = {};

/**
 * Global graph source for backward compatibility.
 * @internal
 * @deprecated Use QueryContext passed to Traverser.traverse() instead.
 */
let currentGraphSource: GraphSource<any> | undefined = undefined;

/**
 * Set the parameters for the current query execution.
 * @deprecated Use QueryContext passed to Traverser.traverse() instead.
 * This function uses global mutable state which is not thread-safe.
 */
export function setQueryParams(params: QueryParams): void {
  currentQueryParams = params;
}

/**
 * Get the parameters for the current query execution.
 * @deprecated Use QueryContext.params instead.
 * This function uses global mutable state which is not thread-safe.
 */
export function getQueryParams(): QueryParams {
  return currentQueryParams;
}

/**
 * Clear the current query parameters.
 * @deprecated Use QueryContext instead - context is automatically scoped to the query.
 */
export function clearQueryParams(): void {
  currentQueryParams = {};
}

/**
 * Set the current graph source for pattern comprehension evaluation.
 * @internal
 * @deprecated Use QueryContext.graph instead.
 */
export function setCurrentGraphSource(source: GraphSource<any>): void {
  currentGraphSource = source;
}

/**
 * Get the current graph source for pattern comprehension evaluation.
 * @internal
 * @deprecated Use QueryContext.graph instead.
 */
export function getCurrentGraphSource(): GraphSource<any> | undefined {
  return currentGraphSource;
}

/**
 * Clear the current graph source.
 * @deprecated Use QueryContext instead - context is automatically scoped to the query.
 * @internal
 */
export function clearCurrentGraphSource(): void {
  currentGraphSource = undefined;
}

export class Traverser {
  public previous: Traverser | undefined;
  public next: Traverser | undefined;
  #step: Step<any>;

  public constructor(step: Step<any>) {
    this.#step = step;
  }

  /**
   * Traverse from the current step.
   * @param source The graph source.
   * @param input The input paths to traverse.
   * @param context Optional query context. If not provided, uses legacy global state.
   */
  public *traverse<const TSchema extends GraphSchema>(
    source: GraphSource<TSchema>,
    input: Iterable<unknown>,
    context?: QueryContext<TSchema>,
  ): IterableIterator<unknown> {
    // Create context if not provided (backward compatibility)
    const effectiveContext = context ?? new QueryContext(source, getQueryParams());

    // Set the current graph source for nested pattern comprehension evaluation
    // This maintains backward compatibility with code that uses getCurrentGraphSource()
    const previousSource = getCurrentGraphSource();
    const previousParams = getQueryParams();
    setCurrentGraphSource(source);
    setQueryParams(effectiveContext.params);
    try {
      if (this.next === undefined) {
        yield* this.#step.traverse(source, input, effectiveContext);
      } else {
        yield* this.next.traverse(
          source,
          this.#step.traverse(source, input, effectiveContext),
          effectiveContext,
        );
      }
    } finally {
      // Restore previous state (in case of nested traversals)
      if (previousSource) {
        setCurrentGraphSource(previousSource);
      } else {
        clearCurrentGraphSource();
      }
      setQueryParams(previousParams);
    }
  }

  /**
   * Does the traverser emit values from the input paths?
   * @param source The graph source.
   * @param input The input paths to match.
   * @param context Optional query context.
   */
  public matches<const TSchema extends GraphSchema>(
    source: GraphSource<TSchema>,
    input: Iterable<unknown>,
    context?: QueryContext<TSchema>,
  ): boolean {
    const it = this.traverse(source, input, context).next();
    return !it.done;
  }
}

/**
 * Create a traverser from a list of steps.
 */
export function createTraverser(steps: readonly Step<any>[]) {
  if (steps.length === 0) {
    throw new Error("At least one step is required.");
  }
  const head = new Traverser(steps[0]!);
  let current = head;
  for (let i = 1; i < steps.length; i++) {
    const next = new Traverser(steps[i]!);
    current.next = next;
    next.previous = current;
    current = next;
  }
  return head;
}

type StepStringToken =
  | { kind: "start" }
  | { kind: "name"; value: string }
  | { kind: "config"; value: object }
  | { kind: "keyword"; value: string }
  | { kind: "condition"; value: Condition }
  | { kind: "steps"; value: StepStringToken[] }
  | { kind: "label"; value: string }
  | { kind: "aliases"; value: readonly string[] }
  | { kind: "value"; value: unknown }
  | { kind: "stat"; key: string; value: number }
  | { kind: "end" };

function stringTokensToString(tokens: readonly StepStringToken[]): string {
  return stringTokensToLines(tokens).join("\n");
}

function stringIdentity<T extends string>(value: T): T {
  return value;
}

const defaultTokenColorizers = {
  start: (value: string) => `\x1b[2m${value}\x1b[0m`,
  name: (value: string) => `\x1b[1m${value}\x1b[0m`,
  config: stringIdentity,
  condition: stringIdentity,
  steps: stringIdentity,
  label: (value: string) => `\x1b[33m${value}\x1b[0m`,
  aliases: (value: string) => `\x1b[36m${value}\x1b[0m`,
  value: (value: unknown) => `\x1b[32m${value}\x1b[0m`,
  stat: (value: string) => `\x1b[2m\x1b[3m${value}\x1b[0m`,
  end: stringIdentity,
  punctuation: (value: string) => `\x1b[2m${value}\x1b[0m`,
  keyword: (value: string) => `\x1b[1m${value}\x1b[0m`,
} as const;

export type StepTokenColorizers = typeof defaultTokenColorizers;

function stringTokensToLines(
  tokens: readonly StepStringToken[],
  colorizers: StepTokenColorizers = defaultTokenColorizers,
): readonly string[] {
  let pc = 0;
  const lines: string[] = [];
  let segments: string[] = [];
  for (const token of tokens) {
    switch (token.kind) {
      case "start": {
        pc++;
        segments.push(colorizers.start(`${pc}. `));
        break;
      }
      case "name": {
        segments.push(colorizers.name(token.value));
        break;
      }
      case "keyword": {
        segments.push(colorizers.keyword(token.value), " ");
        break;
      }
      case "config": {
        segments.push(
          colorizers.punctuation("("),
          stringifyStepConfig(token.value, colorizers),
          colorizers.punctuation(")"),
          " ",
        );
        break;
      }
      case "condition": {
        segments.push(
          colorizers.punctuation("["),
          stringifyCondition(token.value, colorizers),
          colorizers.punctuation("]"),
          " ",
        );
        break;
      }
      case "steps": {
        segments.push(colorizers.punctuation("{"));
        lines.push(segments.join(""));
        for (const line of stringTokensToLines(token.value, colorizers)) {
          lines.push(`     ${line}`);
        }
        segments = ["   ", colorizers.punctuation("}"), " "];
        break;
      }
      case "label": {
        segments.push(colorizers.label(token.value), " ");
        break;
      }
      case "aliases": {
        segments.push(
          colorizers.keyword("as"),
          " ",
          token.value.map((alias) => colorizers.aliases(alias)).join(colorizers.punctuation(", ")),
          " ",
        );
        break;
      }
      case "value": {
        segments.push(colorizers.value(JSON.stringify(token.value)));
        break;
      }
      case "stat": {
        segments.push(
          colorizers.stat(`${token.key}`),
          colorizers.punctuation(":"),
          colorizers.stat(String(token.value)),
          " ",
        );
        break;
      }
      case "end": {
        lines.push(segments.join(""));
        segments = [];
        break;
      }
    }
  }
  if (segments.length > 0) {
    lines.push(segments.join(""));
  }
  return lines;
}

export function stringifySteps(steps: readonly Step<any>[]): string {
  const tokens: StepStringToken[] = [];
  for (const stop of steps) {
    tokens.push(...stop.toStringTokens());
  }
  return stringTokensToString(tokens);
}

function stringifyStepConfig(
  config: StepConfig,
  colorizers: StepTokenColorizers = defaultTokenColorizers,
): string {
  const elements: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) {
      continue;
    }
    if (typeof value === "function") {
      elements.push(`${colorizers.label(key)}: ${colorizers.value(value.toString())}`);
    } else {
      elements.push(`${colorizers.label(key)}: ${colorizers.value(JSON.stringify(value))}`);
    }
  }
  return elements.join(colorizers.punctuation(", "));
}
export interface StepConfig {
  /**
   * The labels to associate with the step.
   */
  stepLabels?: readonly string[];
}

/**
 * A step in a graph traversal.
 */
export abstract class Step<const TConfig extends StepConfig> {
  /**
   * The name of the step.
   */
  public abstract readonly name: string;

  #config: TConfig;

  /**
   * The number of elements this step has traversed.
   */
  public traversed: number = 0;

  /**
   * The number of elements this step has emitted.
   */
  public emitted: number = 0;

  public constructor(config: TConfig) {
    this.#config = config;
  }

  /**
   * The configuration for the step.
   */
  public get config(): TConfig {
    return this.#config;
  }

  /**
   * Execute the step.
   * @param source The graph source.
   * @param input The input paths to traverse.
   * @param context Optional query context containing parameters and options.
   *                If not provided, uses legacy global state for backward compatibility.
   */
  public abstract traverse(
    source: GraphSource<any>,
    input: Iterable<unknown>,
    context?: QueryContext,
  ): IterableIterator<unknown>;

  /**
   * Clone the step.
   */
  public abstract clone(partial?: Partial<TConfig>): Step<TConfig>;

  /**
   * Clone this step, adding a new label.
   * @param label The label to add.
   */
  public withLabel(label: string) {
    const { stepLabels } = this.config;
    return this.clone({
      stepLabels: stepLabels ? [...stepLabels, label] : [label],
    } as unknown as Partial<TConfig>);
  }

  /**
   * Convert the step to an array of string tokens.
   */
  public toStringTokens(): readonly StepStringToken[] {
    const { stepLabels, ...config } = this.config;

    const tokens: StepStringToken[] = [
      { kind: "start" },
      { kind: "name", value: this.name },
      { kind: "config", value: config },
    ];
    if (stepLabels !== undefined && stepLabels.length > 0) {
      tokens.push({ kind: "aliases", value: stepLabels });
    }
    if (this.traversed > 0) {
      tokens.push({ kind: "stat", key: "traversed", value: this.traversed });
    }
    if (this.emitted > 0) {
      tokens.push({ kind: "stat", key: "emitted", value: this.emitted });
    }
    tokens.push({ kind: "end" });
    return tokens;
  }

  public toString() {
    return stringTokensToString(this.toStringTokens());
  }

  public toJSON(): [string, TConfig, unknown?] {
    return [this.name, this.config];
  }

  /**
   * Resolve a single property value - handles literal values, parameter references,
   * property access (variable.property), and variable references.
   */
  protected resolvePropertyValue(
    value: unknown,
    context?: QueryContext,
    path?: TraversalPath<any, any, any>,
  ): unknown {
    if (value === null || typeof value !== "object" || !("type" in value)) {
      return value;
    }

    const typedValue = value as { type: string; [key: string]: any };

    if (typedValue.type === "ParameterRef") {
      const params = context?.params ?? getQueryParams();
      return params[typedValue.name as string];
    }

    if (typedValue.type === "PropertyAccess" && path) {
      const sourcePath = path.get(typedValue.variable as string);
      if (!sourcePath) {
        return null; // Variable not found
      }
      const sourceElement = sourcePath.value;
      if (sourceElement instanceof Vertex || sourceElement instanceof Edge) {
        return sourceElement.get(typedValue.property as never);
      }
      // Handle map/object values
      if (
        sourceElement !== null &&
        typeof sourceElement === "object" &&
        typedValue.property in sourceElement
      ) {
        return (sourceElement as Record<string, unknown>)[typedValue.property as string];
      }
      return null;
    }

    if (typedValue.type === "VariableRef" && path) {
      const sourcePath = path.get(typedValue.variable as string);
      if (!sourcePath) {
        return null; // Variable not found
      }
      return sourcePath.value;
    }

    // Handle ListLiteral - recursively resolve values
    if (typedValue.type === "ListLiteral") {
      const values = typedValue.values as unknown[];
      return values.map((v) => this.resolvePropertyValue(v, context, path));
    }

    return value;
  }

  /**
   * Resolve all property values in a properties map, replacing parameter references
   * with their actual values from the current query parameters.
   */
  protected resolveProperties(
    properties: Record<string, unknown>,
    context?: QueryContext,
    path?: TraversalPath<any, any, any>,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      resolved[key] = this.resolvePropertyValue(value, context, path);
    }
    return resolved;
  }
}

export abstract class ContainerStep<
  const TSteps extends readonly Step<any>[],
  const TConfig extends StepConfig,
> extends Step<TConfig> {
  #steps: TSteps;

  public constructor(config: TConfig, steps: TSteps) {
    super(config);
    this.#steps = steps;
  }

  public get steps(): TSteps {
    return this.#steps;
  }

  public override toStringTokens(): readonly StepStringToken[] {
    const { stepLabels, ...config } = this.config;

    const tokens: StepStringToken[] = [
      { kind: "start" },
      { kind: "name", value: this.name },
      { kind: "config", value: config },
      {
        kind: "steps",
        value: this.steps.flatMap((step) => step.toStringTokens()),
      },
    ];
    if (stepLabels !== undefined && stepLabels.length > 0) {
      tokens.push({ kind: "aliases", value: stepLabels });
    }
    if (this.traversed > 0) {
      tokens.push({ kind: "stat", key: "traversed", value: this.traversed });
    }
    if (this.emitted > 0) {
      tokens.push({ kind: "stat", key: "emitted", value: this.emitted });
    }
    tokens.push({ kind: "end" });
    return tokens;
  }

  public override toJSON(): [string, TConfig, TSteps] {
    return [this.name, this.config, this.steps];
  }
}

/**
 * Configuration for StartStep.
 * StartStep provides an initial empty path for queries without MATCH clauses.
 */
export interface StartStepConfig extends StepConfig {}

/**
 * A step that provides an initial empty traversal path.
 * Used when a query has no MATCH clause but needs to execute mutations
 * like CREATE or MERGE that require at least one input path.
 */
export class StartStep extends Step<StartStepConfig> {
  public get name() {
    return "Start";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    // Check if there's already valid TraversalPath input - if so, pass it through
    let hasValidInput = false;
    for (const path of input) {
      // Only yield actual TraversalPath instances, not undefined or other values
      if (path instanceof TraversalPath) {
        hasValidInput = true;
        this.traversed++;
        this.emitted++;
        yield path;
      }
    }

    // If no valid input was provided, yield a single empty path to start the traversal
    if (!hasValidInput) {
      this.traversed++;
      this.emitted++;
      yield new TraversalPath(undefined, undefined, []);
    }
  }

  public override clone(partial?: Partial<StartStepConfig>) {
    return new StartStep({
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

/**
 * Configuration for DrainStep.
 * DrainStep consumes all paths but yields nothing.
 */
export interface DrainStepConfig extends StepConfig {}

/**
 * A step that consumes all input paths but yields nothing.
 * Used for mutation-only queries without RETURN clause.
 * This ensures mutations execute (by consuming the pipeline) but no results are returned.
 */
export class DrainStep extends Step<DrainStepConfig> {
  public get name() {
    return "Drain";
  }

  public traverse(
    _source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    // Consume all input paths (so mutations execute) but yield nothing
    for (const _path of input) {
      this.traversed++;
      // Do not yield - just consume
    }
    // Return empty iterator
    return [][Symbol.iterator]();
  }

  public override clone(partial?: Partial<DrainStepConfig>) {
    return new DrainStep({
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

export interface FetchEdgesStepConfig extends StepConfig {
  /**
   * The labels of the edges to fetch.
   * If not provided, all edges will be fetched.
   */
  edgeLabels?: readonly string[];

  /**
   * The ids of the edges to fetch.
   * If not provided, all edges will be fetched.
   */
  ids?: readonly ElementId[];
}

export class FetchEdgesStep extends Step<FetchEdgesStepConfig> {
  public get name() {
    return "FetchEdges";
  }

  public *traverse(
    source: GraphSource<any>,
    _input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { edgeLabels, stepLabels, ids } = this.config;

    if (ids !== undefined && ids.length > 0) {
      for (const id of ids) {
        const edge = source.getEdgeById(id);
        if (edge !== undefined) {
          this.traversed++;
          this.emitted++;
          yield new TraversalPath(undefined, edge, stepLabels ?? []);
        }
      }
    } else if (edgeLabels !== undefined && edgeLabels.length > 0) {
      for (const edge of source.getEdges(...edgeLabels)) {
        this.traversed++;
        this.emitted++;
        yield new TraversalPath(undefined, edge, stepLabels ?? []);
      }
    } else {
      for (const edge of source.getEdges()) {
        this.traversed++;
        this.emitted++;
        yield new TraversalPath(undefined, edge, stepLabels ?? []);
      }
    }
  }

  public override clone(partial?: Partial<FetchEdgesStepConfig>) {
    const { config } = this;
    return new FetchEdgesStep({
      edgeLabels: partial?.edgeLabels ?? (config.edgeLabels ? [...config.edgeLabels] : undefined),
      ids: partial?.ids ?? (config.ids ? [...config.ids] : undefined),
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

export interface FetchVerticesStepConfig extends StepConfig {
  /**
   * The labels of the vertices to fetch.
   * If not provided, all vertices will be fetched.
   */
  vertexLabels?: readonly string[];

  /**
   * The ids of the vertices to fetch.
   * If not provided, all vertices will be fetched.
   */
  ids?: readonly ElementId[];
}

export class FetchVerticesStep extends Step<FetchVerticesStepConfig> {
  public get name() {
    return "FetchVertices";
  }

  public *traverse(
    source: GraphSource<any>,
    _input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { vertexLabels, ids, stepLabels } = this.config;
    if (ids !== undefined && ids.length > 0) {
      for (const id of ids) {
        const vertex = source.getVertexById(id);
        if (vertex !== undefined) {
          this.traversed++;
          this.emitted++;
          yield new TraversalPath(undefined, vertex, stepLabels ?? []);
        }
      }
    } else if (vertexLabels !== undefined && vertexLabels.length > 0) {
      for (const vertex of source.getVertices(...vertexLabels)) {
        this.traversed++;
        this.emitted++;
        yield new TraversalPath(undefined, vertex, stepLabels ?? []);
      }
    } else {
      for (const vertex of source.getVertices()) {
        this.traversed++;
        this.emitted++;
        yield new TraversalPath(undefined, vertex, stepLabels ?? []);
      }
    }
  }

  public override clone(partial?: Partial<FetchVerticesStepConfig>) {
    const { config } = this;
    return new FetchVerticesStep({
      vertexLabels:
        partial?.vertexLabels ?? (config.vertexLabels ? [...config.vertexLabels] : undefined),
      ids: partial?.ids ?? (config.ids ? [...config.ids] : undefined),
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

/**
 * Configuration for CartesianFetchStep.
 */
export interface CartesianFetchStepConfig extends StepConfig {
  /**
   * The labels of the vertices to fetch.
   * If not provided, all vertices will be fetched.
   */
  vertexLabels?: readonly string[];

  /**
   * Optional condition to filter vertices.
   * Uses the same condition system as FilterElementsStep for consistency.
   */
  condition?: Condition;
}

/**
 * A step that performs a Cartesian product between existing paths and fetched vertices.
 * Used for comma-separated MATCH patterns like: MATCH (a), (b)
 * For each input path, fetches all matching vertices and combines them.
 */
export class CartesianFetchStep extends Step<CartesianFetchStepConfig> {
  public get name() {
    return "CartesianFetch";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { vertexLabels, condition, stepLabels } = this.config;

    // Fetch matching vertices once for performance
    const allVertices = [
      ...(vertexLabels && vertexLabels.length > 0
        ? source.getVertices(...vertexLabels)
        : source.getVertices()),
    ];

    // Filter vertices by condition if provided
    const matchingVertices = condition
      ? allVertices.filter((vertex) => {
          // Create a temporary path to evaluate the condition
          const tempPath = new TraversalPath(undefined, vertex, stepLabels ?? []);
          return evaluateCondition(tempPath, condition, context);
        })
      : allVertices;

    // Collect all input paths (we need to iterate multiple times)
    const inputPaths = [...input];
    if (inputPaths.length === 0) {
      // If no input paths, treat like FetchVerticesStep
      for (const vertex of matchingVertices) {
        this.traversed++;
        this.emitted++;
        yield new TraversalPath(undefined, vertex, stepLabels ?? []);
      }
      return;
    }

    // For each input path, combine with each matching vertex (cross-product)
    for (const inputPath of inputPaths) {
      for (const vertex of matchingVertices) {
        this.traversed++;
        this.emitted++;
        // Chain the new vertex onto the input path
        yield inputPath.with(vertex, stepLabels ?? []);
      }
    }
  }

  public override clone(partial?: Partial<CartesianFetchStepConfig>) {
    const { config } = this;
    return new CartesianFetchStep({
      vertexLabels:
        partial?.vertexLabels ?? (config.vertexLabels ? [...config.vertexLabels] : undefined),
      condition: partial?.condition ?? config.condition,
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

export type UnaryOperator = "exists" | "isNull" | "isNotNull";
export type UnaryCondition = readonly [UnaryOperator, string];
export type BinaryOperator =
  | "="
  | "<"
  | "<="
  | ">"
  | ">="
  | "!="
  | "=~"
  | "startsWith"
  | "endsWith"
  | "contains";
// Arithmetic operators for expression evaluation
export type ArithmeticOperator = "+" | "-" | "*" | "/" | "%" | "^";

// Case alternative for simple CASE expressions (value matching)
export interface SimpleCaseAlternativeValue {
  when: ConditionValue;
  then: ConditionValue;
}

// Case alternative for searched CASE expressions (condition matching)
export interface SearchedCaseAlternativeValue {
  when: Condition;
  then: ConditionValue;
}

// Condition value can be a literal, or a reference to resolve at evaluation time
export type ConditionValueRef =
  | { type: "variableRef"; variable: string }
  | { type: "pathRef"; variable: string } // Returns the full TraversalPath, not just its value
  | { type: "propertyRef"; variable: string; property: string }
  | { type: "parameterRef"; name: string }
  | { type: "null" } // Explicit null literal
  | {
      type: "arithmeticExpression";
      operator: ArithmeticOperator;
      left: ConditionValue;
      right: ConditionValue;
    }
  | { type: "unaryExpression"; operator: "+" | "-"; operand: ConditionValue }
  | {
      type: "booleanExpression";
      operator: "AND" | "OR" | "XOR";
      left: ConditionValue;
      right: ConditionValue;
    }
  | {
      type: "booleanExpression";
      operator: "NOT";
      operand: ConditionValue;
    }
  | {
      type: "comparisonExpression";
      operator: "=" | "<>" | "!=" | "<" | "<=" | ">" | ">=" | "IN" | "NOT IN";
      left: ConditionValue;
      right: ConditionValue;
    }
  | {
      type: "comparisonExpression";
      operator: "IS NULL" | "IS NOT NULL";
      left: ConditionValue;
    }
  | {
      type: "functionCall";
      name: string;
      args: readonly ConditionValue[];
      distinct: boolean;
    }
  | {
      type: "simpleCaseExpression";
      test: ConditionValue;
      alternatives: readonly SimpleCaseAlternativeValue[];
      else?: ConditionValue;
    }
  | {
      type: "searchedCaseExpression";
      alternatives: readonly SearchedCaseAlternativeValue[];
      else?: ConditionValue;
    }
  | {
      type: "listLiteral";
      values: readonly ConditionValue[];
    }
  | {
      type: "mapLiteral";
      entries: readonly { key: string; value: ConditionValue }[];
    }
  | {
      type: "listIndexExpression";
      list: ConditionValue;
      index: ConditionValue;
    }
  | {
      type: "sliceExpression";
      list: ConditionValue;
      start?: ConditionValue;
      end?: ConditionValue;
    }
  | {
      type: "listComprehension";
      variable: string;
      list: ConditionValue;
      filterCondition?: Condition;
      projection?: ConditionValue;
    }
  | {
      type: "quantifierExpression";
      quantifier: "ALL" | "ANY" | "NONE" | "SINGLE";
      variable: string;
      list: ConditionValue;
      condition: Condition;
    }
  | {
      type: "reduceExpression";
      accumulator: string;
      init: ConditionValue;
      variable: string;
      list: ConditionValue;
      expression: ConditionValue;
    }
  | {
      type: "dynamicPropertyAccess";
      object: ConditionValue;
      property: ConditionValue;
    }
  | {
      type: "patternComprehension";
      pathVariable?: string;
      patternSteps: Step<any>[];
      filterCondition?: Condition;
      projection: ConditionValue;
    }
  | {
      type: "mapProjection";
      variable: string;
      selectors: readonly MapProjectionSelectorValue[];
    }
  | {
      type: "existsSubquery";
      patternSteps: Step<any>[];
      filterCondition?: Condition;
    }
  | {
      type: "memberAccess";
      object: ConditionValue;
      property: string;
    };

/**
 * Map projection selector types for use in ConditionValueRef.
 */
export type MapProjectionSelectorValue =
  | { type: "property"; property: string }
  | { type: "literalEntry"; key: string; value: ConditionValue }
  | { type: "allProperties" }
  | { type: "variable"; variable: string };
export type ConditionValue = string | number | boolean | null | undefined | ConditionValueRef;
export type BinaryCondition = readonly [BinaryOperator, string, ConditionValue];
export type LogicalOperator = "and" | "or" | "xor";
export type LogicalCondition = readonly [LogicalOperator, ...Condition[]];
export type NotCondition = readonly ["not", Condition];
export type InCondition = readonly ["in", string, readonly any[]];
// Expression condition: ["expr", operator, leftExpr, rightExpr]
export type ExpressionCondition = readonly ["expr", BinaryOperator, ConditionValue, ConditionValue];
// Label wildcard condition: matches any element with a non-empty label
export type LabelWildcardCondition = readonly ["labelWildcard"];
// IS LABELED condition: checks if a variable has a specific label
// The labelCondition is evaluated against the variable's value (not the current path value)
export type IsLabeledCondition = readonly [
  "isLabeled",
  string,
  Condition, // The label condition to check
];
export type Condition =
  | UnaryCondition
  | BinaryCondition
  | LogicalCondition
  | NotCondition
  | InCondition
  | ExpressionCondition
  | LabelWildcardCondition
  | IsLabeledCondition;

function evaluateCondition(
  path: TraversalPath<any, any, any>,
  condition: Condition,
  context?: QueryContext,
): boolean {
  switch (condition[0]) {
    case "and": {
      for (let i = 1; i < condition.length; i++) {
        if (!evaluateCondition(path, condition[i] as Condition, context)) {
          return false;
        }
      }
      return true;
    }
    case "or": {
      for (let i = 1; i < condition.length; i++) {
        if (evaluateCondition(path, condition[i] as Condition, context)) {
          return true;
        }
      }
      return false;
    }
    case "xor": {
      // XOR: exactly one of the conditions must be true
      let trueCount = 0;
      for (let i = 1; i < condition.length; i++) {
        if (evaluateCondition(path, condition[i] as Condition, context)) {
          trueCount++;
        }
      }
      return trueCount === 1;
    }
    case "not": {
      return !evaluateCondition(path, condition[1] as Condition, context);
    }
    case "exists": {
      const key = condition[1]!;
      const element = path.value;
      if (!(element instanceof Vertex || element instanceof Edge)) {
        return false;
      }
      return key === "@id"
        ? element.id !== undefined
        : key === "@label"
          ? element.label !== undefined
          : element.get(key) !== undefined;
    }
    case "isNull": {
      const key = condition[1]!;
      const element = path.value;
      if (!(element instanceof Vertex || element instanceof Edge)) {
        return true;
      }
      const value =
        key === "@id" ? element.id : key === "@label" ? element.label : element.get(key);
      return value === undefined || value === null;
    }
    case "isNotNull": {
      const key = condition[1]!;
      const element = path.value;
      if (!(element instanceof Vertex || element instanceof Edge)) {
        return false;
      }
      const value =
        key === "@id" ? element.id : key === "@label" ? element.label : element.get(key);
      return value !== undefined && value !== null;
    }
    case "in": {
      const key = condition[1]!;
      const values = condition[2] as readonly any[];
      const element = path.value;
      if (!(element instanceof Vertex || element instanceof Edge)) {
        return false;
      }
      const actual =
        key === "@id" ? element.id : key === "@label" ? element.label : element.get(key);
      return values.includes(actual);
    }
    case "expr": {
      // Expression condition: both sides are arbitrary expressions
      const exprCondition = condition as ExpressionCondition;
      const operator = exprCondition[1];
      const leftVal = resolveConditionValue(path, exprCondition[2], context);
      const rightVal = resolveConditionValue(path, exprCondition[3], context);
      return compareValues(leftVal, operator, rightVal);
    }
    case "labelWildcard": {
      // Wildcard label: matches any element that has a label (not null/undefined)
      const element = path.value;
      if (!(element instanceof Vertex || element instanceof Edge)) {
        return false;
      }
      return element.label != null && element.label !== "";
    }
    case "isLabeled": {
      // IS LABELED condition: check if a variable's value has a specific label
      const isLabeledCondition = condition as IsLabeledCondition;
      const variableName = isLabeledCondition[1];
      const labelCondition = isLabeledCondition[2];

      // Try to get the variable's value from the path
      const variablePath = path.get(variableName);

      // If the variable path is found, evaluate against its value
      // If not found, check if this is an "early" condition where the variable
      // IS the current element (the path's labels include the variable name)
      let elementToCheck: unknown;
      if (variablePath) {
        elementToCheck = variablePath.value;
      } else if (path.labels.includes(variableName)) {
        // The variable name matches the current path's label - evaluate against current element
        elementToCheck = path.value;
      } else {
        // Variable not found anywhere - return false
        return false;
      }

      // Create a temporary path with the element as the current value
      // so we can evaluate the label condition against it
      const tempPath = new TraversalPath(undefined, elementToCheck, [] as const);

      // Evaluate the label condition against the element
      return evaluateCondition(tempPath, labelCondition, context);
    }
    default:
      return evaluateBinaryCondition(path, condition as BinaryCondition, context);
  }
}

/**
 * Evaluate an arithmetic operation.
 */
function evaluateArithmeticOp(operator: ArithmeticOperator, left: number, right: number): number {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return left / right;
    case "%":
      return left % right;
    case "^":
      return Math.pow(left, right);
  }
}

/**
 * Stringify a condition value reference for display purposes.
 */
function stringifyConditionValueRef(value: ConditionValue): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value !== "object") return JSON.stringify(value);

  switch (value.type) {
    case "variableRef":
      return value.variable;
    case "pathRef":
      return value.variable;
    case "propertyRef":
      return `${value.variable}.${value.property}`;
    case "parameterRef":
      return `$${value.name}`;
    case "arithmeticExpression":
      return `(${stringifyConditionValueRef(value.left)} ${value.operator} ${stringifyConditionValueRef(value.right)})`;
    case "unaryExpression":
      return `${value.operator}${stringifyConditionValueRef(value.operand)}`;
    case "booleanExpression":
      if (value.operator === "NOT") {
        return `NOT ${stringifyConditionValueRef((value as { operand: ConditionValue }).operand)}`;
      }
      return `(${stringifyConditionValueRef(value.left)} ${value.operator} ${stringifyConditionValueRef(value.right)})`;
    case "comparisonExpression":
      if (value.operator === "IS NULL" || value.operator === "IS NOT NULL") {
        return `${stringifyConditionValueRef(value.left)} ${value.operator}`;
      }
      return `(${stringifyConditionValueRef(value.left)} ${value.operator} ${stringifyConditionValueRef((value as { right: ConditionValue }).right)})`;
    case "functionCall":
      return `${value.name}(${value.args.map(stringifyConditionValueRef).join(", ")})`;
    case "listLiteral":
      return `[${value.values.map(stringifyConditionValueRef).join(", ")}]`;
    case "mapLiteral":
      return `{${value.entries.map((e) => `${e.key}: ${stringifyConditionValueRef(e.value)}`).join(", ")}}`;
    case "null":
      return "null";
    default:
      return JSON.stringify(value);
  }
}

/**
 * Resolve a condition value - either return the literal value or resolve a reference from the path.
 */
function resolveConditionValue(
  path: TraversalPath<any, any, any>,
  value: ConditionValue,
  context?: QueryContext,
): any {
  if (value === null || typeof value !== "object") {
    return value;
  }

  // Check if it's a reference object
  if ("type" in value) {
    if (value.type === "null") {
      // Explicit null literal
      return null;
    } else if (value.type === "variableRef") {
      // Resolve variable reference from path
      const variablePath = path.get(value.variable);
      if (!variablePath) {
        return undefined;
      }
      const element = variablePath.value;
      // Handle FOREACH and list comprehension element wrappers
      if (
        element &&
        typeof element === "object" &&
        (element.label === "ForeachElement" || element.label === "ComprehensionElement")
      ) {
        return element.value;
      }
      return element;
    } else if (value.type === "pathRef") {
      // Resolve path reference from path - returns the full TraversalPath
      // This is used for path functions like nodes(p), relationships(p), length(p)
      const variablePath = path.get(value.variable);
      return variablePath; // Return the TraversalPath itself, not its value
    } else if (value.type === "propertyRef") {
      // Resolve property reference from path
      const variablePath = path.get(value.variable);
      if (!variablePath) {
        return undefined;
      }
      let element = variablePath.value;
      // Handle FOREACH and list comprehension element wrappers
      if (
        element &&
        typeof element === "object" &&
        (element.label === "ForeachElement" || element.label === "ComprehensionElement")
      ) {
        element = element.value;
      }
      // Property access on null returns null
      if (element === null) {
        return null;
      }
      if (element instanceof Vertex || element instanceof Edge) {
        return element.get(value.property as never);
      }
      // Handle plain objects (maps) - access property directly
      if (element && typeof element === "object") {
        return (element as Record<string, unknown>)[value.property];
      }
      return undefined;
    } else if (value.type === "parameterRef") {
      // Resolve parameter reference from query context (falls back to global for backward compat)
      const params = context?.params ?? getQueryParams();
      return params[value.name];
    } else if (value.type === "arithmeticExpression") {
      // Evaluate arithmetic expression recursively
      const leftVal = resolveConditionValue(path, value.left, context);
      const rightVal = resolveConditionValue(path, value.right, context);

      // Handle list concatenation with +
      if (value.operator === "+" && Array.isArray(leftVal) && Array.isArray(rightVal)) {
        return [...leftVal, ...rightVal];
      }

      // Handle list + scalar (append scalar to list)
      if (value.operator === "+" && Array.isArray(leftVal)) {
        return [...leftVal, rightVal];
      }

      // Handle scalar + list (prepend scalar to list)
      if (value.operator === "+" && Array.isArray(rightVal)) {
        return [leftVal, ...rightVal];
      }

      // Handle string concatenation with +
      if (value.operator === "+" && (typeof leftVal === "string" || typeof rightVal === "string")) {
        return String(leftVal ?? "") + String(rightVal ?? "");
      }

      // Handle temporal + duration arithmetic
      if (value.operator === "+" && isTemporalValue(leftVal) && rightVal instanceof DurationValue) {
        return addDuration(leftVal, rightVal);
      }
      if (value.operator === "+" && leftVal instanceof DurationValue && isTemporalValue(rightVal)) {
        // duration + temporal is the same as temporal + duration
        return addDuration(rightVal, leftVal);
      }

      // Handle temporal - duration arithmetic
      if (value.operator === "-" && isTemporalValue(leftVal) && rightVal instanceof DurationValue) {
        return subtractDuration(leftVal, rightVal);
      }

      // Handle duration + duration arithmetic
      if (
        value.operator === "+" &&
        leftVal instanceof DurationValue &&
        rightVal instanceof DurationValue
      ) {
        return leftVal.plus(rightVal);
      }

      // Handle duration - duration arithmetic
      if (
        value.operator === "-" &&
        leftVal instanceof DurationValue &&
        rightVal instanceof DurationValue
      ) {
        return leftVal.minus(rightVal);
      }

      // Handle duration * number (scalar multiplication)
      if (
        value.operator === "*" &&
        leftVal instanceof DurationValue &&
        typeof rightVal === "number"
      ) {
        return leftVal.multiply(rightVal);
      }
      if (
        value.operator === "*" &&
        typeof leftVal === "number" &&
        rightVal instanceof DurationValue
      ) {
        return rightVal.multiply(leftVal);
      }

      // Handle duration / number (scalar division)
      if (
        value.operator === "/" &&
        leftVal instanceof DurationValue &&
        typeof rightVal === "number"
      ) {
        return leftVal.divide(rightVal);
      }

      // For arithmetic operations, coerce to numbers
      const leftNum = Number(leftVal);
      const rightNum = Number(rightVal);

      if (isNaN(leftNum) || isNaN(rightNum)) {
        return NaN;
      }

      return evaluateArithmeticOp(value.operator, leftNum, rightNum);
    } else if (value.type === "unaryExpression") {
      // Evaluate unary expression
      const operandVal = resolveConditionValue(path, value.operand, context);

      // Handle duration negation
      if (operandVal instanceof DurationValue) {
        return value.operator === "-" ? operandVal.negate() : operandVal;
      }

      const num = Number(operandVal);
      if (isNaN(num)) {
        return NaN;
      }
      return value.operator === "-" ? -num : num;
    } else if (value.type === "booleanExpression") {
      // Evaluate boolean expression (AND, OR, XOR, NOT)
      if (value.operator === "NOT") {
        const operandVal = resolveConditionValue(
          path,
          (value as { operand: ConditionValue }).operand,
          context,
        );
        // Handle null propagation: NOT null = null
        if (operandVal === null) return null;
        return !operandVal;
      }
      const leftVal = resolveConditionValue(path, value.left, context);
      const rightVal = resolveConditionValue(path, value.right, context);

      // Handle 3-valued logic for AND, OR, XOR
      switch (value.operator) {
        case "AND":
          // false AND anything = false
          if (leftVal === false || rightVal === false) return false;
          // null AND true = null, null AND null = null
          if (leftVal === null || rightVal === null) return null;
          return Boolean(leftVal) && Boolean(rightVal);
        case "OR":
          // true OR anything = true
          if (leftVal === true || rightVal === true) return true;
          // null OR false = null, null OR null = null
          if (leftVal === null || rightVal === null) return null;
          return Boolean(leftVal) || Boolean(rightVal);
        case "XOR":
          // null XOR anything = null
          if (leftVal === null || rightVal === null) return null;
          return Boolean(leftVal) !== Boolean(rightVal);
        default:
          return null;
      }
    } else if (value.type === "comparisonExpression") {
      // Evaluate comparison expression (=, <>, <, <=, >, >=, IS NULL, IS NOT NULL, IN, NOT IN)
      const leftVal = resolveConditionValue(path, value.left, context);

      if (value.operator === "IS NULL") {
        return leftVal === null || leftVal === undefined;
      }
      if (value.operator === "IS NOT NULL") {
        return leftVal !== null && leftVal !== undefined;
      }

      const rightVal = resolveConditionValue(
        path,
        (value as { right: ConditionValue }).right,
        context,
      );

      // Handle null propagation
      if (leftVal === null || rightVal === null) {
        // null = null returns null, not true (per Cypher semantics)
        return null;
      }

      switch (value.operator) {
        case "=":
          return compareValues(leftVal, "=", rightVal);
        case "<>":
        case "!=":
          return compareValues(leftVal, "!=", rightVal);
        case "<":
          return compareValues(leftVal, "<", rightVal);
        case "<=":
          return compareValues(leftVal, "<=", rightVal);
        case ">":
          return compareValues(leftVal, ">", rightVal);
        case ">=":
          return compareValues(leftVal, ">=", rightVal);
        case "IN":
          if (!Array.isArray(rightVal)) return null;
          // IN with null elements follows 3-valued logic
          let hasNull = false;
          for (const item of rightVal) {
            if (item === null) {
              hasNull = true;
            } else if (compareValues(leftVal, "=", item)) {
              return true;
            }
          }
          return hasNull ? null : false;
        case "NOT IN":
          if (!Array.isArray(rightVal)) return null;
          // NOT IN with null elements follows 3-valued logic
          let hasNullNotIn = false;
          for (const item of rightVal) {
            if (item === null) {
              hasNullNotIn = true;
            } else if (compareValues(leftVal, "=", item)) {
              return false;
            }
          }
          return hasNullNotIn ? null : true;
        default:
          return null;
      }
    } else if (value.type === "functionCall") {
      // Evaluate function call
      // Note: Aggregate functions in scalar context return null
      // (they need to be handled at the step level for proper aggregation)
      if (isAggregateFunction(value.name)) {
        // In scalar expression context, aggregate functions don't make sense
        // Return null - proper aggregation happens at the step level
        return null;
      }
      // Resolve arguments
      const resolvedArgs = value.args.map((arg) => resolveConditionValue(path, arg, context));
      // Call the function
      return evaluateFunction(value.name, resolvedArgs, path, value.distinct);
    } else if (value.type === "simpleCaseExpression") {
      // Simple CASE: compare test value against alternatives
      const testVal = resolveConditionValue(path, value.test, context);
      for (const alt of value.alternatives) {
        const whenVal = resolveConditionValue(path, alt.when, context);
        if (testVal === whenVal) {
          return resolveConditionValue(path, alt.then, context);
        }
      }
      // No match found - return else value or null
      if (value.else !== undefined) {
        return resolveConditionValue(path, value.else, context);
      }
      return null;
    } else if (value.type === "searchedCaseExpression") {
      // Searched CASE: evaluate conditions until one is true
      for (const alt of value.alternatives) {
        if (evaluateCondition(path, alt.when, context)) {
          return resolveConditionValue(path, alt.then, context);
        }
      }
      // No condition matched - return else value or null
      if (value.else !== undefined) {
        return resolveConditionValue(path, value.else, context);
      }
      return null;
    } else if (value.type === "listLiteral") {
      // Evaluate list literal - resolve each element
      return value.values.map((v) => resolveConditionValue(path, v, context));
    } else if (value.type === "mapLiteral") {
      // Evaluate map literal - resolve each entry value
      const result: Record<string, unknown> = {};
      for (const entry of value.entries) {
        result[entry.key] = resolveConditionValue(path, entry.value, context);
      }
      return result;
    } else if (value.type === "listIndexExpression") {
      // Evaluate list/map indexing: list[index] or map[key]
      const listVal = resolveConditionValue(path, value.list, context);
      const indexVal = resolveConditionValue(path, value.index, context);

      // Handle null/undefined list or index
      if (listVal == null || indexVal == null) {
        return null;
      }

      // Handle map access: map[stringKey]
      if (typeof listVal === "object" && !Array.isArray(listVal) && typeof indexVal === "string") {
        const map = listVal as Record<string, unknown>;
        return map[indexVal] ?? null;
      }

      // Ensure we have an array or string for list access
      if (!Array.isArray(listVal) && typeof listVal !== "string") {
        return null;
      }

      // Get the index as integer
      const idx = Math.trunc(Number(indexVal));
      if (isNaN(idx)) {
        return null;
      }

      // Handle negative indices (count from end)
      const len = listVal.length;
      const normalizedIdx = idx < 0 ? len + idx : idx;

      // Out of bounds returns null
      if (normalizedIdx < 0 || normalizedIdx >= len) {
        return null;
      }

      return listVal[normalizedIdx];
    } else if (value.type === "sliceExpression") {
      // Evaluate list slicing: list[start..end]
      const listVal = resolveConditionValue(path, value.list, context);

      // Handle null/undefined list
      if (listVal == null) {
        return null;
      }

      // Ensure we have an array or string
      if (!Array.isArray(listVal) && typeof listVal !== "string") {
        return null;
      }

      const len = listVal.length;

      // Resolve start and end indices
      let startIdx = 0;
      let endIdx = len;

      if (value.start !== undefined) {
        const startVal = resolveConditionValue(path, value.start, context);
        // In Cypher, if start is null, the entire slice returns null
        if (startVal === null) {
          return null;
        }
        if (startVal != null) {
          startIdx = Math.trunc(Number(startVal));
          if (isNaN(startIdx)) {
            return null;
          }
          // Handle negative start index
          if (startIdx < 0) {
            startIdx = Math.max(0, len + startIdx);
          }
        }
      }

      if (value.end !== undefined) {
        const endVal = resolveConditionValue(path, value.end, context);
        // In Cypher, if end is null, the entire slice returns null
        if (endVal === null) {
          return null;
        }
        if (endVal != null) {
          endIdx = Math.trunc(Number(endVal));
          if (isNaN(endIdx)) {
            return null;
          }
          // Handle negative end index
          if (endIdx < 0) {
            endIdx = Math.max(0, len + endIdx);
          }
        }
      }

      // Clamp indices to valid range
      startIdx = Math.max(0, Math.min(len, startIdx));
      endIdx = Math.max(0, Math.min(len, endIdx));

      // Return empty if start >= end
      if (startIdx >= endIdx) {
        return Array.isArray(listVal) ? [] : "";
      }

      return listVal.slice(startIdx, endIdx);
    } else if (value.type === "listComprehension") {
      // Evaluate list comprehension: [x IN list WHERE cond | expr]
      const listVal = resolveConditionValue(path, value.list, context);

      // Handle null/undefined list
      if (listVal == null) {
        return [];
      }

      // Ensure we have an array
      if (!Array.isArray(listVal)) {
        return [];
      }

      const results: any[] = [];

      // Iterate over each element in the list
      for (const element of listVal) {
        // Create a temporary path binding for the comprehension variable
        // We use a special wrapper to bind the variable value
        const comprehensionBinding = {
          label: "ComprehensionElement",
          value: element,
        };

        // Create a new path with the comprehension variable bound
        const boundPath = new TraversalPath(path, comprehensionBinding as any, [value.variable]);

        // Apply filter condition if present
        if (value.filterCondition) {
          if (!evaluateCondition(boundPath, value.filterCondition, context)) {
            continue; // Skip this element
          }
        }

        // Apply projection if present, otherwise use the element itself
        let resultValue: any;
        if (value.projection) {
          resultValue = resolveConditionValue(boundPath, value.projection, context);
        } else {
          resultValue = element;
        }

        results.push(resultValue);
      }

      return results;
    } else if (value.type === "quantifierExpression") {
      // Evaluate quantifier expression: ALL/ANY/NONE/SINGLE(x IN list WHERE cond)
      const listVal = resolveConditionValue(path, value.list, context);

      // Handle null/undefined list
      if (listVal == null) {
        // For empty/null list:
        // ALL returns true (vacuously true)
        // ANY returns false (no elements to satisfy)
        // NONE returns true (no elements violate)
        // SINGLE returns false (no elements to count)
        switch (value.quantifier) {
          case "ALL":
            return true;
          case "ANY":
            return false;
          case "NONE":
            return true;
          case "SINGLE":
            return false;
        }
      }

      // Ensure we have an array
      if (!Array.isArray(listVal)) {
        // Treat non-array as single-element array
        const singleList = [listVal];
        return evaluateQuantifier(path, value, singleList, context);
      }

      // Empty list handling
      if (listVal.length === 0) {
        switch (value.quantifier) {
          case "ALL":
            return true; // Vacuously true
          case "ANY":
            return false;
          case "NONE":
            return true;
          case "SINGLE":
            return false;
        }
      }

      return evaluateQuantifier(path, value, listVal, context);
    } else if (value.type === "reduceExpression") {
      // Evaluate reduce expression: REDUCE(acc = init, x IN list | expr)
      const listVal = resolveConditionValue(path, value.list, context);

      // Initialize accumulator
      let accumulator = resolveConditionValue(path, value.init, context);

      // Handle null/undefined list - return the initial accumulator value
      if (listVal == null) {
        return accumulator;
      }

      // Ensure we have an array
      if (!Array.isArray(listVal)) {
        // Treat non-array as single-element array
        const singleList = [listVal];
        return evaluateReduce(path, value, accumulator, singleList, context);
      }

      // Empty list - return initial accumulator value
      if (listVal.length === 0) {
        return accumulator;
      }

      return evaluateReduce(path, value, accumulator, listVal, context);
    } else if (value.type === "dynamicPropertyAccess") {
      // Evaluate dynamic property access: obj['propName'] or obj[expr]
      const objectVal = resolveConditionValue(path, value.object, context);
      const propVal = resolveConditionValue(path, value.property, context);

      // Handle null/undefined object or property
      if (objectVal == null || propVal == null) {
        return null;
      }

      // Get the property name as string
      const propName = String(propVal);

      // Handle Vertex/Edge objects - use their get() method to access properties
      if (objectVal instanceof Vertex || objectVal instanceof Edge) {
        return objectVal.get(propName as never);
      }

      // Handle plain objects (like maps)
      if (typeof objectVal === "object" && objectVal !== null) {
        if (propName in objectVal) {
          return (objectVal as Record<string, unknown>)[propName];
        }
        return null;
      }

      return null;
    } else if (value.type === "memberAccess") {
      // Evaluate member access: expr.property
      // Used for temporal values (date().year) and other objects with properties
      const objectVal = resolveConditionValue(path, value.object, context);

      // Handle null/undefined object
      if (objectVal == null) {
        return null;
      }

      const propName = value.property;

      // Handle temporal values - use their get() method
      if (isTemporalValue(objectVal)) {
        return objectVal.get(propName);
      }

      // Handle Vertex/Edge objects - use their get() method
      if (objectVal instanceof Vertex || objectVal instanceof Edge) {
        return objectVal.get(propName as never);
      }

      // Handle plain objects (like maps)
      if (typeof objectVal === "object" && objectVal !== null) {
        if (propName in objectVal) {
          return (objectVal as Record<string, unknown>)[propName];
        }
        return null;
      }

      return null;
    } else if (value.type === "patternComprehension") {
      // Evaluate pattern comprehension: [pattern WHERE cond | expr]
      // This executes a mini-traversal for each match and collects projected values
      const graphSource = context?.graph ?? getCurrentGraphSource();
      if (!graphSource) {
        // No graph source available - return empty list
        return [];
      }

      const results: any[] = [];

      // Create a traverser from the pattern steps
      if (value.patternSteps.length === 0) {
        return [];
      }

      const traverser = createTraverser(value.patternSteps);

      // Execute the pattern traversal starting from the current path
      // The pattern steps will generate all matching paths
      for (const matchedPathUntyped of traverser.traverse(graphSource, [path], context)) {
        // Cast to correct type - traverser yields TraversalPath<any, any, any>
        const matchedPath = matchedPathUntyped as TraversalPath<any, any, any>;
        // Build a combined path that includes both outer scope and pattern bindings
        // The matchedPath already has the pattern variables bound

        // Apply filter condition if present
        if (value.filterCondition) {
          if (!evaluateCondition(matchedPath, value.filterCondition, context)) {
            continue; // Skip this match
          }
        }

        // If we have a path variable, we need to bind it
        // For now, the path variable handling is done during step conversion
        let evalPath: TraversalPath<any, any, any> = matchedPath;
        if (value.pathVariable) {
          // Bind the matched path to the path variable
          const pathBinding = {
            label: "PatternPath",
            value: matchedPath,
          };
          evalPath = new TraversalPath(matchedPath, pathBinding as any, [value.pathVariable]);
        }

        // Evaluate the projection expression
        const resultValue = resolveConditionValue(evalPath, value.projection, context);
        results.push(resultValue);
      }

      return results;
    } else if (value.type === "mapProjection") {
      // Evaluate map projection: variable{.prop, key: expr, .*}
      // This projects a node/edge into a map with selected properties

      // Get the base object from the variable
      const variablePath = path.get(value.variable);
      if (!variablePath) {
        return null;
      }

      let element = variablePath.value;
      // Handle FOREACH and list comprehension element wrappers
      if (
        element &&
        typeof element === "object" &&
        (element.label === "ForeachElement" || element.label === "ComprehensionElement")
      ) {
        element = element.value;
      }

      if (element == null) {
        return null;
      }

      // Build the result map
      const result: Record<string, unknown> = {};

      // Get all properties for .* selector (if needed)
      let allProperties: Record<string, unknown> | null = null;
      if (element instanceof Vertex || element instanceof Edge) {
        // For Vertex/Edge, use their internal stored element to get all properties
        const storedElement = element[$StoredElement];
        allProperties = {};
        if (
          storedElement &&
          storedElement.properties &&
          typeof storedElement.properties === "object"
        ) {
          Object.assign(allProperties, storedElement.properties);
        }
      } else if (typeof element === "object" && element !== null) {
        // For plain objects, use the object itself
        allProperties = { ...(element as Record<string, unknown>) };
      }

      // Process each selector
      for (const selector of value.selectors) {
        if (selector.type === "allProperties") {
          // .* - include all properties
          if (allProperties) {
            Object.assign(result, allProperties);
          }
        } else if (selector.type === "property") {
          // .property - include the named property
          let propValue: unknown = null;
          if (element instanceof Vertex || element instanceof Edge) {
            propValue = element.get(selector.property as never);
          } else if (typeof element === "object" && element !== null) {
            propValue = (element as Record<string, unknown>)[selector.property];
          }
          result[selector.property] = propValue;
        } else if (selector.type === "literalEntry") {
          // key: expr - include an expression with a given key
          const exprValue = resolveConditionValue(path, selector.value, context);
          result[selector.key] = exprValue;
        } else if (selector.type === "variable") {
          // variable - include another variable's value
          const varPath = path.get(selector.variable);
          if (varPath) {
            let varValue = varPath.value;
            // Handle FOREACH and list comprehension element wrappers
            if (
              varValue &&
              typeof varValue === "object" &&
              (varValue.label === "ForeachElement" || varValue.label === "ComprehensionElement")
            ) {
              varValue = varValue.value;
            }
            result[selector.variable] = varValue;
          } else {
            result[selector.variable] = null;
          }
        }
      }

      return result;
    } else if (value.type === "existsSubquery") {
      // Evaluate EXISTS subquery: { pattern [WHERE cond] }
      // Returns true if the pattern matches at least one result
      const graphSource = context?.graph ?? getCurrentGraphSource();
      if (!graphSource) {
        // No graph source available - return false
        return false;
      }

      // Create a traverser from the pattern steps
      if (value.patternSteps.length === 0) {
        return false;
      }

      const traverser = createTraverser(value.patternSteps);

      // Execute the pattern traversal starting from the current path
      // Return true as soon as we find one match
      for (const matchedPathUntyped of traverser.traverse(graphSource, [path], context)) {
        // Cast to correct type - traverser yields TraversalPath<any, any, any>
        const matchedPath = matchedPathUntyped as TraversalPath<any, any, any>;

        // Apply filter condition if present
        if (value.filterCondition) {
          if (!evaluateCondition(matchedPath, value.filterCondition, context)) {
            continue; // Skip this match, keep looking
          }
        }

        // Found at least one match, return true immediately
        return true;
      }

      // No matches found
      return false;
    }
  }

  // Not a reference, return as-is
  return value;
}

/**
 * Evaluate a quantifier expression over a list.
 */
function evaluateQuantifier(
  path: TraversalPath<any, any, any>,
  quantifier: {
    quantifier: "ALL" | "ANY" | "NONE" | "SINGLE";
    variable: string;
    condition: Condition;
  },
  list: any[],
  context?: QueryContext,
): boolean {
  let satisfyCount = 0;

  for (const element of list) {
    // Create a temporary path binding for the quantifier variable
    const quantifierBinding = {
      label: "ComprehensionElement",
      value: element,
    };

    // Create a new path with the quantifier variable bound
    const boundPath = new TraversalPath(path, quantifierBinding as any, [quantifier.variable]);

    // Evaluate the condition for this element
    const satisfies = evaluateCondition(boundPath, quantifier.condition, context);

    if (satisfies) {
      satisfyCount++;
    }

    // Early exit optimizations
    switch (quantifier.quantifier) {
      case "ALL":
        // If any element doesn't satisfy, return false immediately
        if (!satisfies) {
          return false;
        }
        break;
      case "ANY":
        // If any element satisfies, return true immediately
        if (satisfies) {
          return true;
        }
        break;
      case "NONE":
        // If any element satisfies, return false immediately
        if (satisfies) {
          return false;
        }
        break;
      case "SINGLE":
        // If more than one element satisfies, return false immediately
        if (satisfyCount > 1) {
          return false;
        }
        break;
    }
  }

  // Final result based on quantifier type
  switch (quantifier.quantifier) {
    case "ALL":
      return true; // All elements satisfied (or we would have returned false)
    case "ANY":
      return false; // No element satisfied (or we would have returned true)
    case "NONE":
      return true; // No element satisfied (or we would have returned false)
    case "SINGLE":
      return satisfyCount === 1;
  }
}

/**
 * Evaluate a reduce expression over a list.
 * Folds the list into a single value using an accumulator.
 */
function evaluateReduce(
  path: TraversalPath<any, any, any>,
  reduce: {
    accumulator: string;
    variable: string;
    expression: ConditionValue;
  },
  initialValue: any,
  list: any[],
  context?: QueryContext,
): any {
  let accumulator = initialValue;

  for (const element of list) {
    // Create bindings for both the accumulator and the iteration variable
    // First, create a binding for the accumulator
    const accumulatorBinding = {
      label: "ComprehensionElement",
      value: accumulator,
    };
    const pathWithAcc = new TraversalPath(path, accumulatorBinding as any, [reduce.accumulator]);

    // Then, create a binding for the iteration variable
    const iterationBinding = {
      label: "ComprehensionElement",
      value: element,
    };
    const boundPath = new TraversalPath(pathWithAcc, iterationBinding as any, [reduce.variable]);

    // Evaluate the expression to get the new accumulator value
    accumulator = resolveConditionValue(boundPath, reduce.expression, context);
  }

  return accumulator;
}

/**
 * Compare two values using the given operator.
 * Returns true if the comparison holds.
 */
function compareValues(left: any, operator: BinaryOperator, right: any): boolean {
  switch (operator) {
    case "=": {
      if (left == null) {
        return right == null;
      }
      if (right == null) {
        return false;
      }
      if (typeof left === "object" && typeof right === "string") {
        return String(left) === right;
      }
      if (typeof left !== typeof right) {
        return false;
      }
      if (typeof right === "object") {
        return compare(left, right) === 0;
      }
      return left === right;
    }
    case "!=": {
      if (left == null) {
        return right !== null;
      }
      if (right == null) {
        return true;
      }
      if (typeof left === "object" && typeof right === "string") {
        return String(left) !== right;
      }
      if (typeof left !== typeof right) {
        return true;
      }
      if (typeof right === "object") {
        return compare(left, right) !== 0;
      }
      return left !== right;
    }
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    default:
      // Handle string predicates, regex etc - not supported in expression conditions
      return false;
  }
}

function evaluateBinaryCondition(
  path: TraversalPath<any, any, any>,
  condition: BinaryCondition,
  context?: QueryContext,
): boolean {
  const [operator, key, conditionValue] = condition;
  const element = path.value;
  if (!(element instanceof Vertex || element instanceof Edge)) {
    return false;
  }

  // Resolve the condition value (handles variable/property references)
  const value = resolveConditionValue(path, conditionValue, context);

  const actual = key === "@id" ? element.id : key === "@label" ? element.label : element.get(key);
  switch (operator) {
    case "=": {
      if (value == null) {
        return actual == null;
      }
      if (actual == null) {
        return false;
      }
      if (typeof actual === "object" && typeof value === "string") {
        return String(actual) === value;
      }
      if (typeof actual !== typeof value) {
        return false;
      }
      if (typeof value === "object") {
        return compare(actual, value) === 0;
      }
      return actual === value;
    }
    case "!=": {
      if (value == null) {
        return actual !== null;
      }
      if (actual == null) {
        return true;
      }
      if (typeof actual === "object" && typeof value === "string") {
        return String(actual) !== value;
      }
      if (typeof actual !== typeof value) {
        return true;
      }
      if (typeof value === "object") {
        return compare(actual, value) !== 0;
      }
      return actual !== value;
    }
    case "<":
      return actual < value;
    case "<=":
      return actual <= value;
    case ">":
      return actual > value;
    case ">=":
      return actual >= value;
    case "=~": {
      // Regex matching - value is the pattern string
      if (typeof actual !== "string" || typeof value !== "string") {
        return false;
      }
      try {
        const regex = new RegExp(value);
        return regex.test(actual);
      } catch {
        // Invalid regex pattern
        return false;
      }
    }
    case "startsWith": {
      if (typeof actual !== "string" || typeof value !== "string") {
        return false;
      }
      return actual.startsWith(value);
    }
    case "endsWith": {
      if (typeof actual !== "string" || typeof value !== "string") {
        return false;
      }
      return actual.endsWith(value);
    }
    case "contains": {
      if (typeof actual !== "string" || typeof value !== "string") {
        return false;
      }
      return actual.includes(value);
    }
  }
}

function stringifyCondition(
  condition: Condition,
  colorizers: StepTokenColorizers = defaultTokenColorizers,
): string {
  switch (condition[0]) {
    case "and":
    case "or":
    case "xor":
      return `${colorizers.punctuation("(")}${(
        (condition as LogicalCondition).slice(1) as Condition[]
      )
        .map((c) => stringifyCondition(c, colorizers))
        .join(` ${colorizers.keyword(condition[0])} `)}${colorizers.punctuation(")")}`;
    case "not":
      return `${colorizers.keyword("not")} ${stringifyCondition(condition[1] as Condition, colorizers)}`;
    case "exists":
      return `${colorizers.label(condition[1])} ${colorizers.keyword("exists")}`;
    case "isNull":
      return `${colorizers.label(condition[1])} ${colorizers.keyword("is null")}`;
    case "isNotNull":
      return `${colorizers.label(condition[1])} ${colorizers.keyword("is not null")}`;
    case "in":
      return `${colorizers.label(condition[1])} ${colorizers.keyword("in")} ${colorizers.value(JSON.stringify(condition[2]))}`;
    case "labelWildcard":
      return `${colorizers.keyword(":")}${colorizers.label("%")}`;
    case "isLabeled":
      return `${colorizers.label(condition[1])} ${colorizers.keyword("is")} ${stringifyCondition(condition[2] as Condition, colorizers)}`;
    default:
      return `${colorizers.label(condition[1]!)} ${colorizers.keyword(condition[0])} ${colorizers.value(JSON.stringify(condition[2]))}`;
  }
}

export interface FilterElementsStepConfig<
  _TPath extends TraversalPath<any, any, any>,
> extends StepConfig {
  /**
   * The condition to filter elements by.
   */
  condition: Condition;
}

export class FilterElementsStep<const TPath extends TraversalPath<any, any, any>> extends Step<
  FilterElementsStepConfig<TPath>
> {
  public get name() {
    return "FilterElements";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { condition, stepLabels } = this.config;
    const indexManager = source.indexManager;

    // Convert input to array upfront since we may need to iterate twice
    // (once for index lookup to determine element type, once for filtering)
    const inputArray = Array.from(input);

    // Try to use index-based filtering if available
    if (indexManager && inputArray.length > 0) {
      const hints = analyzeCondition(condition);
      if (hints.length > 0) {
        // Try to find a usable index
        const indexResult = this.#tryIndexLookup(source, inputArray, hints, context);
        if (indexResult !== null) {
          yield* indexResult;
          return;
        }
      }
    }

    // Fall back to full condition evaluation
    for (const path of inputArray) {
      this.traversed++;
      if (evaluateCondition(path, condition, context)) {
        if (stepLabels !== undefined && stepLabels.length > 0) {
          this.emitted++;
          yield new TraversalPath(path.parent, path.value, stepLabels);
        } else {
          this.emitted++;
          yield path;
        }
      }
    }
  }

  /**
   * Try to use an index for filtering.
   * Returns an array of filtered paths if an index was used, null otherwise.
   * @param inputArray Must be a non-empty array (caller ensures this)
   */
  #tryIndexLookup(
    source: GraphSource<any>,
    inputArray: TraversalPath<any, any, any>[],
    hints: IndexHint[],
    context?: QueryContext,
  ): TraversalPath<any, any, any>[] | null {
    const { condition, stepLabels } = this.config;
    const indexManager = source.indexManager;

    if (!indexManager) {
      return null;
    }

    // Get the label from the first element
    const firstElement = inputArray[0]!.value;
    if (!(firstElement instanceof Vertex || firstElement instanceof Edge)) {
      return null;
    }

    const elementLabel = firstElement.label;

    // Check if we have an index for any of the hints
    const bestHint = selectBestIndexHint(hints, (property, type) => {
      return indexManager.hasIndexOfType(elementLabel, property, type);
    });

    if (!bestHint) {
      return null;
    }

    // Build the index if not already built - use ALL elements of this label from source
    if (!indexManager.isBuilt(elementLabel, bestHint.property)) {
      // Get all elements of this label from the source to build a complete index
      const storedElements: Array<{
        "@type": "Vertex" | "Edge";
        id: ElementId;
        properties: object;
      }> = [];

      if (firstElement instanceof Vertex) {
        for (const v of source.getVertices(elementLabel)) {
          storedElements.push(v[$StoredElement]);
        }
      } else {
        for (const e of source.getEdges(elementLabel)) {
          storedElements.push(e[$StoredElement]);
        }
      }

      indexManager.buildIndex(elementLabel, bestHint.property, storedElements);
    }

    // Perform the index lookup
    const candidateIds = this.#performIndexLookup(indexManager, elementLabel, bestHint);

    if (!candidateIds) {
      return null;
    }

    // Get remaining condition after index lookup
    const remainingCondition = extractRemainingCondition(condition, bestHint);

    // Filter input using index candidates
    const results: TraversalPath<any, any, any>[] = [];
    for (const path of inputArray) {
      this.traversed++;
      const element = path.value;

      if (!(element instanceof Vertex || element instanceof Edge)) {
        continue;
      }

      // Check if element is in candidate set
      if (!candidateIds.has(element.id)) {
        continue;
      }

      // Apply remaining condition if any
      if (remainingCondition && !evaluateCondition(path, remainingCondition, context)) {
        continue;
      }

      if (stepLabels !== undefined && stepLabels.length > 0) {
        this.emitted++;
        results.push(new TraversalPath(path.parent, path.value, stepLabels));
      } else {
        this.emitted++;
        results.push(path);
      }
    }

    return results;
  }

  /**
   * Perform the actual index lookup based on the hint.
   */
  #performIndexLookup(
    indexManager: NonNullable<GraphSource<any>["indexManager"]>,
    label: string,
    hint: IndexHint,
  ): Set<ElementId> | undefined {
    switch (hint.type) {
      case "hash": {
        const hashIndex = indexManager.getHashIndex(label, hint.property);
        if (!hashIndex) return undefined;

        if (hint.operation === "equals") {
          return new Set(hashIndex.lookup(hint.value));
        } else if (hint.operation === "in") {
          return hashIndex.lookupMany(hint.value as readonly unknown[]);
        }
        return undefined;
      }

      case "btree": {
        const btreeIndex = indexManager.getBTreeIndex(label, hint.property);
        if (!btreeIndex) return undefined;

        const value = hint.value as number | string;

        switch (hint.operation) {
          case "equals":
            return btreeIndex.lookup(value);
          case "lessThan":
            return btreeIndex.lookupLessThan(value);
          case "lessThanOrEqual":
            return btreeIndex.lookupLessThanOrEqual(value);
          case "greaterThan":
            return btreeIndex.lookupGreaterThan(value);
          case "greaterThanOrEqual":
            return btreeIndex.lookupGreaterThanOrEqual(value);
          default:
            return undefined;
        }
      }

      case "fulltext": {
        const fulltextIndex = indexManager.getFullTextIndex(label, hint.property);
        if (!fulltextIndex) return undefined;

        const value = hint.value as string;
        let results: Set<ElementId>;

        switch (hint.operation) {
          case "startsWith":
            results = fulltextIndex.searchTermPrefix(value);
            break;
          case "contains":
            results = fulltextIndex.searchContains(value);
            break;
          case "search": {
            const searchResults = fulltextIndex.search(value);
            results = new Set(searchResults.map((r) => r.elementId));
            break;
          }
          default:
            return undefined;
        }

        return results;
      }

      default:
        return undefined;
    }
  }

  public override clone(partial?: Partial<FilterElementsStepConfig<TPath>>) {
    const { config } = this;
    return new FilterElementsStep({
      condition: partial?.condition ?? config.condition,
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }

  public override toStringTokens(): readonly StepStringToken[] {
    const { stepLabels, condition } = this.config;

    const tokens: StepStringToken[] = [
      { kind: "start" },
      { kind: "name", value: this.name },
      { kind: "condition", value: condition },
    ];
    if (stepLabels !== undefined && stepLabels.length > 0) {
      tokens.push({ kind: "aliases", value: stepLabels });
    }
    if (this.traversed > 0) {
      tokens.push({ kind: "stat", key: "traversed", value: this.traversed });
    }
    if (this.emitted > 0) {
      tokens.push({ kind: "stat", key: "emitted", value: this.emitted });
    }
    tokens.push({ kind: "end" });
    return tokens;
  }
}

export interface RangeStepConfig extends StepConfig {
  /**
   * The start index of the range.
   */
  start: number;

  /**
   * The end index of the range.
   */
  end: number;
}

export class RangeStep extends Step<RangeStepConfig> {
  public get name() {
    return "Range";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { start, end } = this.config;
    let index = 0;
    for (const path of input) {
      this.traversed++;
      if (index >= start) {
        if (index < end) {
          this.emitted++;
          yield path;
          if (index === end - 1) {
            break;
          }
        } else {
          break;
        }
      }
      index++;
    }
  }

  public override clone(partial?: Partial<RangeStepConfig>) {
    const { config } = this;
    return new RangeStep({
      start: partial?.start ?? config.start,
      end: partial?.end ?? config.end,
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

export interface CountStepConfig extends StepConfig {}

export class CountStep extends Step<CountStepConfig> {
  public get name() {
    return "Count";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<number> {
    let count = 0;
    for (const _path of input) {
      count++;
    }
    this.emitted++;
    yield count;
  }

  public override clone(partial?: Partial<CountStepConfig>) {
    const { config } = this;
    return new CountStep({
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

export interface AggregateStepConfig extends StepConfig {
  /**
   * The property to aggregate on (optional - if undefined, uses the value directly).
   */
  property?: string;

  /**
   * The variable to filter paths by (if undefined, uses current path value).
   */
  variable?: string;
}

export class SumStep extends Step<AggregateStepConfig> {
  public get name() {
    return "Sum";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<number> {
    const { property } = this.config;
    let sum = 0;
    for (const path of input) {
      this.traversed++;
      if (path instanceof TraversalPath) {
        // If property is specified, get the property value; otherwise use the path value directly
        const value = property ? path.property(property as never) : path.value;
        if (typeof value === "number") {
          sum += value;
        }
      }
    }
    this.emitted++;
    yield sum;
  }

  public override clone(partial?: Partial<AggregateStepConfig>) {
    const { config } = this;
    return new SumStep({
      property: partial?.property ?? config.property,
      variable: partial?.variable ?? config.variable,
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

export class AvgStep extends Step<AggregateStepConfig> {
  public get name() {
    return "Avg";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<number | null> {
    const { property } = this.config;
    let sum = 0;
    let count = 0;
    for (const path of input) {
      this.traversed++;
      if (path instanceof TraversalPath) {
        // If property is specified, get the property value; otherwise use the path value directly
        const value = property ? path.property(property as never) : path.value;
        if (typeof value === "number") {
          sum += value;
          count++;
        }
      }
    }
    this.emitted++;
    yield count > 0 ? sum / count : null;
  }

  public override clone(partial?: Partial<AggregateStepConfig>) {
    const { config } = this;
    return new AvgStep({
      property: partial?.property ?? config.property,
      variable: partial?.variable ?? config.variable,
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

export class MinStep extends Step<AggregateStepConfig> {
  public get name() {
    return "Min";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<any> {
    const { property } = this.config;
    let min: any = null;
    for (const path of input) {
      this.traversed++;
      if (path instanceof TraversalPath) {
        // If property is specified, get the property value; otherwise use the path value directly
        const value = property ? path.property(property as never) : path.value;
        if (value !== null && value !== undefined) {
          if (min === null) {
            min = value;
          } else if (typeof value === typeof min) {
            // Use < operator for codepoint order (strings) and numeric comparison
            if (value < min) {
              min = value;
            }
          }
        }
      }
    }
    this.emitted++;
    yield min;
  }

  public override clone(partial?: Partial<AggregateStepConfig>) {
    const { config } = this;
    return new MinStep({
      property: partial?.property ?? config.property,
      variable: partial?.variable ?? config.variable,
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

export class MaxStep extends Step<AggregateStepConfig> {
  public get name() {
    return "Max";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<any> {
    const { property } = this.config;
    let max: any = null;
    for (const path of input) {
      this.traversed++;
      if (path instanceof TraversalPath) {
        // If property is specified, get the property value; otherwise use the path value directly
        const value = property ? path.property(property as never) : path.value;
        if (value !== null && value !== undefined) {
          if (max === null) {
            max = value;
          } else if (typeof value === typeof max) {
            // Use > operator for codepoint order (strings) and numeric comparison
            if (value > max) {
              max = value;
            }
          }
        }
      }
    }
    this.emitted++;
    yield max;
  }

  public override clone(partial?: Partial<AggregateStepConfig>) {
    const { config } = this;
    return new MaxStep({
      property: partial?.property ?? config.property,
      variable: partial?.variable ?? config.variable,
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

export interface CollectStepConfig extends StepConfig {
  /**
   * The variable to collect (if undefined, collects current path value).
   */
  variable?: string;
}

export class CollectStep extends Step<CollectStepConfig> {
  public get name() {
    return "Collect";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<unknown[]> {
    const maxCollectionSize = _context?.options.maxCollectionSize ?? DEFAULT_MAX_COLLECTION_SIZE;
    const collected: unknown[] = [];
    for (const path of input) {
      this.traversed++;
      if (collected.length >= maxCollectionSize) {
        throw new MemoryLimitExceededError(maxCollectionSize, collected.length);
      }
      if (path instanceof TraversalPath) {
        collected.push(path.value);
      } else {
        collected.push(path);
      }
    }
    this.emitted++;
    yield collected;
  }

  public override clone(partial?: Partial<CollectStepConfig>) {
    const { config } = this;
    return new CollectStep({
      variable: partial?.variable ?? config.variable,
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

export interface MapElementsStepConfig<TInput> extends StepConfig {
  /**
   * The function to map elements by.
   */
  mapper: (value: TInput) => any;
}

export class MapElementsStep<TInput> extends Step<MapElementsStepConfig<TInput>> {
  public get name() {
    return "MapElements";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<TInput>,
    _context?: QueryContext,
  ): IterableIterator<unknown> {
    const { mapper } = this.config;
    for (const value of input) {
      this.traversed++;
      this.emitted++;
      yield mapper(value as TInput);
    }
  }

  public override clone(partial?: Partial<MapElementsStepConfig<TInput>>) {
    const { config } = this;
    return new MapElementsStep({
      mapper: partial?.mapper ?? config.mapper,
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }

  public override toJSON(): [string, MapElementsStepConfig<TInput>, unknown?] {
    throw new Error("Cannot convert MapElementsStep to JSON.");
  }
}

export interface GroupByStepConfig extends StepConfig {
  /**
   * The items to group by (variable, property, function like labels/type).
   */
  groupByItems: Array<{
    variable: string;
    property?: string;
    function?: "labels" | "type";
  }>;

  /**
   * The return items (including aggregates and non-aggregates).
   */
  returnItems: Array<{
    variable: string;
    property?: string;
    aggregate?:
      | "COUNT"
      | "SUM"
      | "AVG"
      | "MIN"
      | "MAX"
      | "COLLECT"
      | "STDEV"
      | "STDEVP"
      | "PERCENTILEDISC"
      | "PERCENTILECONT";
    /** Whether DISTINCT is used with aggregate (e.g., count(DISTINCT x)) */
    distinct?: boolean;
    /** Percentile value for PERCENTILEDISC and PERCENTILECONT (0.0 to 1.0) */
    percentile?: number;
    function?: "labels" | "type";
    alias?: string;
  }>;
}

const DEFAULT_MAX_GROUPS = 100000;

export class GroupByStep extends Step<GroupByStepConfig> {
  public get name(): string {
    return "GroupBy";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<unknown>,
    context?: QueryContext,
  ): IterableIterator<Record<string, unknown>> {
    const { groupByItems, returnItems } = this.config;
    const maxGroups = context?.options.maxCollectionSize ?? DEFAULT_MAX_GROUPS;

    // Collect all input paths into groups
    const groups = new Map<string, unknown[]>();

    for (const item of input) {
      this.traversed++;
      const key = this.#computeGroupKey(item, groupByItems);

      if (!groups.has(key)) {
        // Check max groups limit before creating new group
        if (groups.size >= maxGroups) {
          throw new MemoryLimitExceededError(maxGroups, groups.size + 1);
        }
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    // For each group, compute the result
    for (const [_key, paths] of groups) {
      // Defensive check - skip empty groups (shouldn't happen but be safe)
      if (paths.length === 0) {
        continue;
      }

      this.emitted++;
      const result: Record<string, unknown> = {};

      for (const returnItem of returnItems) {
        // Generate alias from function call syntax if no explicit alias
        let alias = returnItem.alias;
        if (!alias) {
          if (returnItem.aggregate) {
            const argPart = returnItem.property
              ? `${returnItem.variable}.${returnItem.property}`
              : returnItem.variable;
            // For percentile functions, include the percentile value
            if (
              (returnItem.aggregate === "PERCENTILEDISC" ||
                returnItem.aggregate === "PERCENTILECONT") &&
              returnItem.percentile !== undefined
            ) {
              const funcName =
                returnItem.aggregate === "PERCENTILEDISC" ? "percentileDisc" : "percentileCont";
              alias = `${funcName}(${argPart}, ${returnItem.percentile})`;
            } else {
              // Use lowercase function names for stDev/stDevP
              const funcName =
                returnItem.aggregate === "STDEV"
                  ? "stDev"
                  : returnItem.aggregate === "STDEVP"
                    ? "stDevP"
                    : returnItem.aggregate.toLowerCase();
              alias = `${funcName}(${argPart})`;
            }
          } else if (returnItem.function) {
            alias = `${returnItem.function}(${returnItem.variable})`;
          } else if (returnItem.property) {
            alias = `${returnItem.variable}.${returnItem.property}`;
          } else {
            alias = returnItem.variable;
          }
        }

        if (returnItem.aggregate) {
          // Compute aggregate
          result[alias] = this.#computeAggregate(
            paths,
            returnItem.aggregate,
            returnItem.variable,
            returnItem.property,
            context,
            returnItem.distinct,
            returnItem.percentile,
          );
        } else if (returnItem.function === "labels") {
          // Get labels from first path in group (all should have same labels since grouped by it)
          // labels() returns an array of labels
          result[alias] = this.#extractLabels(paths[0], returnItem.variable);
        } else if (returnItem.function === "type") {
          // Get type from first path in group (all should have same type since grouped by it)
          // type() returns a single string
          const labels = this.#extractLabels(paths[0], returnItem.variable);
          result[alias] = labels ? labels[0] : undefined;
        } else if (returnItem.property) {
          // Get property value from first path in group
          result[alias] = this.#extractProperty(paths[0], returnItem.variable, returnItem.property);
        } else {
          // Return the value from first path
          result[alias] = this.#extractValue(paths[0], returnItem.variable);
        }
      }

      yield result;
    }
  }

  #computeGroupKey(item: unknown, groupByItems: GroupByStepConfig["groupByItems"]): string {
    const keyParts: string[] = [];

    for (const groupBy of groupByItems) {
      if (groupBy.function === "labels" || groupBy.function === "type") {
        // Both labels() and type() use the element's label/type
        const labels = this.#extractLabels(item, groupBy.variable);
        keyParts.push(this.#safeStringify(labels ?? []));
      } else if (groupBy.property) {
        const value = this.#extractProperty(item, groupBy.variable, groupBy.property);
        keyParts.push(this.#safeStringify(this.#normalizeValue(value)));
      } else {
        // Group by vertex/edge id
        const value = this.#extractValue(item, groupBy.variable);
        if (value instanceof Vertex || value instanceof Edge) {
          keyParts.push(value.id);
        } else {
          keyParts.push(this.#safeStringify(this.#normalizeValue(value)));
        }
      }
    }

    return keyParts.join("|");
  }

  /**
   * Normalize value for consistent JSON.stringify behavior.
   * Converts undefined to null for consistent serialization.
   */
  #normalizeValue(value: unknown): unknown {
    if (value === undefined) {
      return null;
    }
    return value;
  }

  /**
   * Safely stringify a value, handling circular references and other edge cases.
   */
  #safeStringify(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      // Fallback for circular references or other stringify errors
      return String(value);
    }
  }

  #extractLabels(item: unknown, variable: string): string[] | undefined {
    const value = this.#extractValue(item, variable);
    if (value instanceof Vertex) {
      return [value.label];
    }
    if (value instanceof Edge) {
      return [value.label];
    }
    return undefined;
  }

  #extractProperty(item: unknown, variable: string, property: string): unknown {
    const value = this.#extractValue(item, variable);
    if (value instanceof Vertex || value instanceof Edge) {
      return value.get(property);
    }
    if (value && typeof value === "object" && property in value) {
      return (value as Record<string, unknown>)[property];
    }
    return undefined;
  }

  #extractValue(item: unknown, variable: string): unknown {
    // Handle TraversalPaths
    if (item instanceof TraversalPath) {
      // Use the get method to find labeled value
      const labeled = item.get(variable);
      if (labeled) {
        return labeled.value;
      }
      // Fallback to current value
      return item.value;
    }

    // Handle arrays (from SelectStep)
    if (Array.isArray(item)) {
      for (const elem of item) {
        if (elem instanceof TraversalPath) {
          const extracted = this.#extractValue(elem, variable);
          if (extracted !== undefined) {
            return extracted;
          }
        }
      }
    }

    return item;
  }

  #computeAggregate(
    paths: unknown[],
    aggregate:
      | "COUNT"
      | "SUM"
      | "AVG"
      | "MIN"
      | "MAX"
      | "COLLECT"
      | "STDEV"
      | "STDEVP"
      | "PERCENTILEDISC"
      | "PERCENTILECONT",
    variable: string,
    property?: string,
    context?: QueryContext,
    distinct?: boolean,
    percentile?: number,
  ): unknown {
    // Helper to create a string key for deduplication
    const valueKey = (value: unknown): string => {
      if (value === null || value === undefined) return "null";
      if (value instanceof Vertex) return `v:${value.id}`;
      if (value instanceof Edge) return `e:${value.id}`;
      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      }
      return String(value);
    };

    switch (aggregate) {
      case "COUNT": {
        if (distinct) {
          const seen = new Set<string>();
          for (const path of paths) {
            const value = property
              ? this.#extractProperty(path, variable, property)
              : this.#extractValue(path, variable);
            // null values are not counted in count(DISTINCT x)
            if (value !== null && value !== undefined) {
              seen.add(valueKey(value));
            }
          }
          return seen.size;
        }
        return paths.length;
      }

      case "SUM": {
        let sum = 0;
        const seen = distinct ? new Set<string>() : null;
        for (const path of paths) {
          const value = property
            ? this.#extractProperty(path, variable, property)
            : this.#extractValue(path, variable);
          if (typeof value === "number") {
            if (seen) {
              const key = valueKey(value);
              if (seen.has(key)) continue;
              seen.add(key);
            }
            sum += value;
          }
        }
        return sum;
      }

      case "AVG": {
        let sum = 0;
        let count = 0;
        const seen = distinct ? new Set<string>() : null;
        for (const path of paths) {
          const value = property
            ? this.#extractProperty(path, variable, property)
            : this.#extractValue(path, variable);
          if (typeof value === "number") {
            if (seen) {
              const key = valueKey(value);
              if (seen.has(key)) continue;
              seen.add(key);
            }
            sum += value;
            count++;
          }
        }
        return count > 0 ? sum / count : null;
      }

      case "MIN": {
        // MIN and MAX on distinct values is the same as on all values
        let min: number | null = null;
        for (const path of paths) {
          const value = property
            ? this.#extractProperty(path, variable, property)
            : this.#extractValue(path, variable);
          if (typeof value === "number") {
            if (min === null || value < min) {
              min = value;
            }
          }
        }
        return min;
      }

      case "MAX": {
        // MIN and MAX on distinct values is the same as on all values
        let max: number | null = null;
        for (const path of paths) {
          const value = property
            ? this.#extractProperty(path, variable, property)
            : this.#extractValue(path, variable);
          if (typeof value === "number") {
            if (max === null || value > max) {
              max = value;
            }
          }
        }
        return max;
      }

      case "COLLECT": {
        const maxSize = context?.options.maxCollectionSize ?? DEFAULT_MAX_COLLECTION_SIZE;
        const collected: unknown[] = [];
        const seen = distinct ? new Set<string>() : null;
        for (const path of paths) {
          if (collected.length >= maxSize) {
            throw new MemoryLimitExceededError(maxSize, collected.length);
          }
          const value = property
            ? this.#extractProperty(path, variable, property)
            : this.#extractValue(path, variable);
          if (seen) {
            // For DISTINCT, also skip null values per Cypher spec
            if (value === null || value === undefined) continue;
            const key = valueKey(value);
            if (seen.has(key)) continue;
            seen.add(key);
          }
          collected.push(value);
        }
        return collected;
      }

      case "STDEV": {
        // Sample standard deviation (n-1 denominator)
        const values: number[] = [];
        for (const path of paths) {
          const value = property
            ? this.#extractProperty(path, variable, property)
            : this.#extractValue(path, variable);
          if (typeof value === "number") {
            values.push(value);
          }
        }
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map((v) => (v - mean) ** 2);
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
        return Math.sqrt(variance);
      }

      case "STDEVP": {
        // Population standard deviation (n denominator)
        const values: number[] = [];
        for (const path of paths) {
          const value = property
            ? this.#extractProperty(path, variable, property)
            : this.#extractValue(path, variable);
          if (typeof value === "number") {
            values.push(value);
          }
        }
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map((v) => (v - mean) ** 2);
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
        return Math.sqrt(variance);
      }

      case "PERCENTILEDISC": {
        // Discrete percentile - returns an actual value from the dataset
        if (percentile === undefined || percentile < 0 || percentile > 1) {
          throw new Error(
            `percentileDisc requires a percentile between 0.0 and 1.0, got ${percentile}`,
          );
        }
        const values: number[] = [];
        for (const path of paths) {
          const value = property
            ? this.#extractProperty(path, variable, property)
            : this.#extractValue(path, variable);
          if (typeof value === "number") {
            values.push(value);
          }
        }
        if (values.length === 0) return null;
        values.sort((a, b) => a - b);
        const index = Math.ceil(percentile * values.length) - 1;
        return values[Math.max(0, index)];
      }

      case "PERCENTILECONT": {
        // Continuous percentile - interpolates between values
        if (percentile === undefined || percentile < 0 || percentile > 1) {
          throw new Error(
            `percentileCont requires a percentile between 0.0 and 1.0, got ${percentile}`,
          );
        }
        const values: number[] = [];
        for (const path of paths) {
          const value = property
            ? this.#extractProperty(path, variable, property)
            : this.#extractValue(path, variable);
          if (typeof value === "number") {
            values.push(value);
          }
        }
        if (values.length === 0) return null;
        values.sort((a, b) => a - b);
        if (values.length === 1) return values[0];
        const position = percentile * (values.length - 1);
        const lower = Math.floor(position);
        const upper = Math.ceil(position);
        const lowerVal = values[lower]!;
        const upperVal = values[upper]!;
        if (lower === upper) return lowerVal;
        const fraction = position - lower;
        return lowerVal + fraction * (upperVal - lowerVal);
      }
    }
  }

  public override clone(partial?: Partial<GroupByStepConfig>) {
    const { config } = this;
    return new GroupByStep({
      groupByItems: partial?.groupByItems ?? [...config.groupByItems],
      returnItems: partial?.returnItems ?? [...config.returnItems],
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

// Direction for traversal from vertices (via edges) and from edges (to vertices)
// - "in"/"out"/"both": for traversal direction (from vertex) or traversal continuation (from edge)
// - "inVertex"/"outVertex": for fluent API on edges - directly returns the named vertex property
// - "other": returns the vertex we didn't come from (used in pattern matching)
type Direction = "in" | "out" | "both" | "other" | "inVertex" | "outVertex";

export interface VertexStepConfig extends StepConfig {
  /**
   * The direction of the edges.
   */
  direction: Direction;

  /**
   * The labels of the edges.
   */
  edgeLabels: readonly string[];
}

export class VertexStep extends Step<VertexStepConfig> {
  public get name() {
    return "Vertex";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { direction, edgeLabels, stepLabels } = this.config;
    for (const path of input) {
      this.traversed++;
      const value = path.value as any;
      if (value === undefined) continue;
      if (value instanceof Vertex) {
        if (direction === "in" || direction === "both") {
          // Incoming edges: this vertex is the target (inV)
          // Navigate to the source vertex (outV)
          for (const edge of source.getIncomingEdges(value.id)) {
            this.traversed++;
            if (edgeLabels.length === 0 || edgeLabels.includes(edge.label)) {
              this.emitted++;
              yield path.with(edge).with(edge.outV, stepLabels);
            }
          }
        }
        if (direction === "out" || direction === "both") {
          // Outgoing edges: this vertex is the source (outV)
          // Navigate to the target vertex (inV)
          for (const edge of source.getOutgoingEdges(value.id)) {
            this.traversed++;
            if (edgeLabels.length === 0 || edgeLabels.includes(edge.label)) {
              // For direction='both', skip self-loops since they were already
              // yielded in the incoming edges pass above
              const storedEdge = edge[$StoredElement];
              if (direction === "both" && storedEdge.inV === storedEdge.outV) {
                continue;
              }
              this.emitted++;
              yield path.with(edge).with(edge.inV, stepLabels);
            }
          }
        }
      } else if (value instanceof Edge) {
        // When processing an edge, we have two different semantics:
        // 1. Traversal continuation (direction="in"/"out"/"both"):
        //    - "out" means continue forward along edge (to target = inV)
        //    - "in" means go backward along edge (to source = outV)
        // 2. Direct vertex access (direction="inVertex"/"outVertex"):
        //    - "inVertex" returns edge.inV (target)
        //    - "outVertex" returns edge.outV (source)
        if (direction === "inVertex") {
          // Fluent API: return the target vertex (inV)
          this.emitted++;
          yield path.with(value.inV, stepLabels);
        } else if (direction === "outVertex") {
          // Fluent API: return the source vertex (outV)
          this.emitted++;
          yield path.with(value.outV, stepLabels);
        } else if (direction === "in") {
          // Traversal: going backward along edge, return source
          this.emitted++;
          yield path.with(value.outV, stepLabels);
        } else if (direction === "out") {
          // Traversal: going forward along edge, return target
          this.emitted++;
          yield path.with(value.inV, stepLabels);
        } else if (direction === "both") {
          this.emitted++;
          yield path.with(value.inV, stepLabels);
          this.emitted++;
          yield path.with(value.outV, stepLabels);
        } else if (direction === "other") {
          if (path.parent instanceof TraversalPath) {
            const parent = path.parent.value;
            if (parent instanceof Vertex) {
              if (value.inV === parent) {
                this.emitted++;
                yield path.with(value.outV, stepLabels);
              } else if (value.outV === parent) {
                this.emitted++;
                yield path.with(value.inV, stepLabels);
              }
            } else if (parent instanceof Edge) {
              // Edge case - currently not handled
            }
          }
        }
      }
    }
  }

  public override clone(partial?: Partial<VertexStepConfig>) {
    const { config } = this;
    return new VertexStep({
      direction: partial?.direction ?? config.direction,
      edgeLabels: partial?.edgeLabels ?? [...config.edgeLabels],
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

export interface EdgeStepConfig extends StepConfig {
  /**
   * The direction of the edges.
   */
  direction: Direction;

  /**
   * The labels of the edges.
   */
  edgeLabels: readonly string[];
}

export class EdgeStep extends Step<EdgeStepConfig> {
  public get name() {
    return "Edge";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { direction, edgeLabels, stepLabels } = this.config;
    for (const path of input) {
      this.traversed++;
      const value = path.value;
      if (value === undefined) continue;
      if (value instanceof Vertex) {
        if (direction === "in" || direction === "both") {
          for (const edge of source.getIncomingEdges(value.id)) {
            this.traversed++;
            if (edgeLabels.length === 0 || edgeLabels.includes(edge.label)) {
              this.emitted++;
              yield path.with(edge, stepLabels);
            }
          }
        }
        if (direction === "out" || direction === "both") {
          for (const edge of source.getOutgoingEdges(value.id)) {
            this.traversed++;
            if (edgeLabels.length === 0 || edgeLabels.includes(edge.label)) {
              // For direction='both', skip self-loops since they were already
              // yielded in the incoming edges pass above
              const storedEdge = edge[$StoredElement];
              if (direction === "both" && storedEdge.inV === storedEdge.outV) {
                continue;
              }
              this.emitted++;
              yield path.with(edge, stepLabels);
            }
          }
        }
      } else if (value instanceof Edge) {
        this.emitted++;
        yield path;
      }
    }
  }

  public override clone(partial?: Partial<EdgeStepConfig>) {
    const { config } = this;
    return new EdgeStep({
      direction: partial?.direction ?? config.direction,
      edgeLabels: partial?.edgeLabels ?? [...config.edgeLabels],
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

export interface RepeatStepConfig extends StepConfig {
  /**
   * The number of times to repeat the traversal.
   */
  times?: number;

  /**
   * An array of steps that when matched will stop the traversal.
   */
  untilSteps?: readonly Step<any>[];

  /**
   * Whether to emit the traversal path for each iteration.
   */
  emit?: boolean;

  /**
   * The iteration at which to start emitting results.
   * Used for min bounds in quantifiers like {2,5} where min=2.
   * Defaults to 1 (start emitting from first iteration).
   */
  emitStart?: number;

  /**
   * Whether to emit the input as well (for zero-min quantifiers).
   * Used for quantifiers like {0,3} which should include the starting node.
   */
  emitInput?: boolean;
}

/**
 * Default maximum number of repeat iterations.
 * Can be overridden via QueryContext.options.maxIterations.
 */
const DEFAULT_MAX_REPEATS = 1000;

/**
 * Default maximum collection size for collect/delete operations.
 * Can be overridden via QueryContext.options.maxCollectionSize.
 */
const DEFAULT_MAX_COLLECTION_SIZE = 100000;

export class RepeatStep<TSteps extends readonly Step<any>[]> extends ContainerStep<
  TSteps,
  RepeatStepConfig
> {
  #repeatTraverser: Traverser | undefined;
  #untilTraverser: Traverser | undefined;

  public get name() {
    return "Repeat";
  }

  /**
   * The traverser to repeat.
   */
  protected get repeatTraverser() {
    if (this.#repeatTraverser === undefined) {
      return (this.#repeatTraverser = createTraverser(this.steps));
    }
    return this.#repeatTraverser;
  }

  /**
   * The traverser that will stop the repeat when matched.
   */
  protected get untilTraverser() {
    if (this.#untilTraverser === undefined) {
      const { untilSteps } = this.config;
      if (untilSteps !== undefined && untilSteps.length > 0) {
        return (this.#untilTraverser = createTraverser(untilSteps));
      }
      return undefined;
    }
    return this.#untilTraverser;
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { times, stepLabels, emit, emitStart, emitInput } = this.config;
    const seen = new Set<ElementId>();

    const { repeatTraverser, untilTraverser } = this;

    // Collect input into an array so we can iterate multiple times if needed
    // (for emitInput and then for the traversal queue)
    const inputArray = [...input] as TraversalPath<any, any, any>[];

    // For zero-min quantifiers ({0,n}), emit the input paths first
    // Note: We DON'T mark them as seen yet - we still need to traverse from them
    if (emitInput) {
      for (const path of inputArray) {
        if (path instanceof TraversalPath) {
          this.emitted++;
          if (stepLabels !== undefined && stepLabels.length > 0) {
            yield new TraversalPath(path.parent, path.value, stepLabels);
          } else {
            yield path;
          }
        }
      }
    }

    // Special case: times=0 means no traversal
    // - If emitInput was already set (Cypher quantifiers with min=0), input was already emitted above
    // - Otherwise (Gremlin API times(0)), emit the input here
    if (times === 0) {
      if (!emitInput) {
        for (const path of inputArray) {
          if (path instanceof TraversalPath) {
            this.emitted++;
            if (stepLabels !== undefined && stepLabels.length > 0) {
              yield new TraversalPath(path.parent, path.value, stepLabels);
            } else {
              yield path;
            }
          }
        }
      }
      return;
    }

    let queue: Iterable<TraversalPath<any, any, any>> = inputArray;
    let counter = 0;
    // emitStart defaults to 1 (start emitting from first iteration)
    const effectiveEmitStart = emitStart ?? 1;
    // Get maxIterations from context options, falling back to default
    const maxIterations = _context?.options.maxIterations ?? DEFAULT_MAX_REPEATS;

    while (counter < maxIterations) {
      counter++;
      const isFinalIteration = times !== undefined && counter >= times;
      const nextQueue: TraversalPath<any, any, any>[] = [];

      for (const path of repeatTraverser.traverse(source, queue)) {
        this.traversed++;
        if (!(path instanceof TraversalPath)) continue;

        if (untilTraverser !== undefined) {
          if (untilTraverser.matches(source, [path])) {
            // Only emit if we're at or past emitStart
            if (counter >= effectiveEmitStart) {
              this.emitted++;
              if (stepLabels !== undefined && stepLabels.length > 0) {
                yield new TraversalPath(path.parent, path.value, stepLabels);
              } else {
                yield path;
              }
            }
            continue;
          }
        } else if (isFinalIteration) {
          // On final iteration, always emit if we're at or past emitStart
          if (counter >= effectiveEmitStart) {
            this.emitted++;
            if (stepLabels !== undefined && stepLabels.length > 0) {
              yield new TraversalPath(path.parent, path.value, stepLabels);
            } else {
              yield path;
            }
          }
        } else if (times === undefined || emit) {
          // Intermediate iteration - emit if emit=true and counter >= emitStart
          if (counter >= effectiveEmitStart) {
            this.emitted++;
            if (stepLabels !== undefined && stepLabels.length > 0) {
              yield new TraversalPath(path.parent, path.value, stepLabels);
            } else {
              yield path;
            }
          }
        }

        // Don't add to queue on final iteration
        if (isFinalIteration) continue;

        const vertex = path.value;
        if (!(vertex instanceof Vertex)) {
          continue;
        }
        if (seen.has(vertex.id)) {
          continue;
        }
        seen.add(vertex.id);
        nextQueue.push(path);
      }

      if (isFinalIteration) {
        return;
      }

      if (nextQueue.length === 0) {
        return;
      }
      queue = nextQueue;
    }
    throw new MaxIterationsExceededError(maxIterations, "RepeatStep");
  }

  public override clone(partial?: Partial<RepeatStepConfig>) {
    const { config, steps } = this;
    return new RepeatStep(
      {
        times: partial?.times ?? config.times,
        untilSteps:
          partial?.untilSteps ??
          (config.untilSteps !== undefined ? [...config.untilSteps] : undefined),
        stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
        emit: partial?.emit ?? config.emit,
        emitStart: partial?.emitStart ?? config.emitStart,
        emitInput: partial?.emitInput ?? config.emitInput,
      },
      steps.map((step) => step.clone()),
    );
  }

  public override toStringTokens(): readonly StepStringToken[] {
    const { times, untilSteps, stepLabels, ...config } = this.config;

    const tokens: StepStringToken[] = [
      { kind: "start" },
      { kind: "name", value: this.name },
      { kind: "config", value: config },
      {
        kind: "steps",
        value: this.steps.flatMap((step) => step.toStringTokens()),
      },
    ];
    if (stepLabels !== undefined && stepLabels.length > 0) {
      tokens.push({ kind: "aliases", value: stepLabels });
    }
    if (times !== undefined) {
      tokens.push({ kind: "keyword", value: "times" });
      tokens.push({ kind: "value", value: times });
    }
    if (untilSteps !== undefined) {
      tokens.push({ kind: "keyword", value: "until" });
      tokens.push({
        kind: "steps",
        value: untilSteps.flatMap((step) => step.toStringTokens()),
      });
    }
    if (this.traversed > 0) {
      tokens.push({ kind: "stat", key: "traversed", value: this.traversed });
    }
    if (this.emitted > 0) {
      tokens.push({ kind: "stat", key: "emitted", value: this.emitted });
    }
    tokens.push({ kind: "end" });
    return tokens;
  }
}

export interface DedupStepConfig extends StepConfig {}

export class DedupStep extends Step<DedupStepConfig> {
  public get name() {
    return "Dedup";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<unknown> {
    const seen = new Set<unknown>();
    for (const item of input) {
      this.traversed++;
      // Handle both TraversalPath and raw values
      const value = item instanceof TraversalPath ? item.value : item;
      const key = this.#getDeduplicationKey(value);
      if (!seen.has(key)) {
        seen.add(key);
        this.emitted++;
        yield item;
      }
    }
  }

  /**
   * Generate a deduplication key for a value.
   * - Primitives: use the value directly
   * - Vertices/Edges: use their id property
   * - Arrays of primitives: efficient string concatenation
   * - Complex arrays/objects: JSON serialization
   */
  #getDeduplicationKey(value: unknown): unknown {
    // Primitives can be used directly as Set keys
    if (value === null || typeof value !== "object") {
      return value;
    }

    // Vertices and Edges have an 'id' property we can use
    if (value instanceof Vertex || value instanceof Edge) {
      return value.id;
    }

    // For arrays, check if all elements are primitives for efficient key generation
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "\0[]";
      }
      // Check if all elements are primitives (string, number, boolean, null, undefined)
      const allPrimitives = value.every((el) => el === null || typeof el !== "object");
      if (allPrimitives) {
        // Use type-prefixed join for primitives to avoid collisions
        // e.g., [1, "1"] vs ["1", 1] should have different keys
        return "\0[" + value.map((el) => typeof el + ":" + String(el)).join("\0") + "]";
      }
    }

    // Fall back to JSON for complex objects/arrays
    return JSON.stringify(value);
  }

  public override clone(partial?: Partial<DedupStepConfig>) {
    return new DedupStep({
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

export type OrderDirection = "asc" | "desc";
export type NullsOrdering = "first" | "last";

export interface OrderStepConfig extends StepConfig {
  /**
   * The directions to sort the results by.
   */
  directions: readonly {
    key?: string;
    direction: OrderDirection;
    nulls?: NullsOrdering;
  }[];
}

export class OrderStep extends Step<OrderStepConfig> {
  public get name() {
    return "Order";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<unknown> {
    const { directions } = this.config;
    const sorted = [...input].sort((a, b) => {
      for (const { key, direction, nulls } of directions) {
        const aValue = resolveOrderValue(a, key);
        const bValue = resolveOrderValue(b, key);

        // Handle null values according to nulls ordering
        const aIsNull = aValue === null || aValue === undefined;
        const bIsNull = bValue === null || bValue === undefined;

        if (aIsNull && bIsNull) {
          continue; // Both null, check next sort key
        }

        if (aIsNull || bIsNull) {
          // Determine default nulls ordering based on direction if not specified
          // Default: NULLS LAST for ASC, NULLS FIRST for DESC (matches PostgreSQL behavior)
          const effectiveNulls = nulls ?? (direction === "asc" ? "last" : "first");

          if (aIsNull) {
            return effectiveNulls === "first" ? -1 : 1;
          } else {
            return effectiveNulls === "first" ? 1 : -1;
          }
        }

        const result = compare(aValue, bValue);
        if (result !== 0) {
          return direction === "asc" ? result : -result;
        }
      }
      return 0;
    });
    yield* sorted;
  }

  public override clone(partial?: Partial<OrderStepConfig>) {
    return new OrderStep({
      directions: partial?.directions ?? [...this.config.directions],
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

function resolveOrderValue(item: unknown, key: string | undefined): unknown {
  if (key === undefined) {
    return item instanceof TraversalPath ? item.value : item;
  }

  if (item instanceof TraversalPath) {
    // First try to get the value as a bound variable (for aliases like UNWIND x)
    // then fall back to property access (for expressions like ORDER BY n.name)
    return item.get(key)?.value ?? item.property(key as never);
  }

  if (typeof item === "object" && item !== null) {
    return (item as Record<string, unknown>)[key];
  }

  return undefined;
}

export interface UnionStepConfig extends StepConfig {}

export class UnionStep<const TSteps extends readonly Step<any>[]> extends ContainerStep<
  TSteps,
  UnionStepConfig
> {
  #unionTraverser: Traverser | undefined;

  public get name() {
    return "Union";
  }

  protected get unionTraverser() {
    if (this.#unionTraverser === undefined) {
      return (this.#unionTraverser = createTraverser(this.steps));
    }
    return this.#unionTraverser;
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<unknown> {
    for (const path of input) {
      this.traversed++;
      this.emitted++;
      yield path;
    }
    for (const path of this.unionTraverser.traverse(source, input)) {
      this.traversed++;
      this.emitted++;
      yield path;
    }
  }

  public override clone(partial?: Partial<UnionStepConfig>) {
    const { config, steps } = this;
    return new UnionStep(
      {
        stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
      },
      steps.map((step) => step.clone()),
    );
  }
}

/**
 * Configuration for QueryUnionStep - used for UNION/UNION ALL queries.
 */
export interface QueryUnionStepConfig extends StepConfig {
  /**
   * If true, keeps all results (UNION ALL).
   * If false, removes duplicates (UNION).
   */
  all: boolean;
}

/**
 * Step that combines results from multiple query branches.
 * Used to implement Cypher UNION and UNION ALL semantics.
 *
 * - UNION ALL: combines all results from all branches (keeps duplicates)
 * - UNION: combines results and removes duplicates
 *
 * Each branch is an array of steps representing one complete query.
 */
export class QueryUnionStep extends Step<QueryUnionStepConfig> {
  #branches: readonly Step<any>[][];
  #traversers: Traverser[] | undefined;

  public constructor(config: QueryUnionStepConfig, branches: readonly Step<any>[][]) {
    super(config);
    this.#branches = branches;
  }

  public get name() {
    return this.config.all ? "QueryUnionAll" : "QueryUnion";
  }

  public get branches(): readonly Step<any>[][] {
    return this.#branches;
  }

  protected get traversers(): Traverser[] {
    if (this.#traversers === undefined) {
      this.#traversers = this.#branches.map((steps) => createTraverser(steps));
    }
    return this.#traversers;
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<unknown> {
    // Collect input into array for reuse across branches
    const inputArray = Array.from(input);

    if (this.config.all) {
      // UNION ALL: yield all results from all branches
      for (const traverser of this.traversers) {
        for (const path of traverser.traverse(source, inputArray)) {
          this.traversed++;
          this.emitted++;
          yield path;
        }
      }
    } else {
      // UNION: yield unique results (deduplicated)
      // For row-based results, we stringify to compare
      const seen = new Set<string>();

      for (const traverser of this.traversers) {
        for (const path of traverser.traverse(source, inputArray)) {
          this.traversed++;

          // Create a key for deduplication
          const key = this.getDeduplicationKey(path);
          if (!seen.has(key)) {
            seen.add(key);
            this.emitted++;
            yield path;
          }
        }
      }
    }
  }

  /**
   * Generate a key for deduplication.
   * For UNION, we primarily care about the result values, not the full path structure.
   * After RETURN, values are typically arrays of returned column values.
   */
  protected getDeduplicationKey(value: unknown): string {
    return JSON.stringify(this.serializeValue(value));
  }

  /**
   * Serialize a value for comparison/deduplication.
   */
  protected serializeValue(value: unknown): unknown {
    if (value instanceof Vertex) {
      return { type: "vertex", id: value.id };
    }
    if (value instanceof Edge) {
      return { type: "edge", id: value.id };
    }
    if (value instanceof TraversalPath) {
      // For TraversalPath, serialize the current value
      // The path itself carries the full binding context, but for deduplication
      // we care about the actual result value
      return {
        type: "path",
        value: this.serializeValue(value.value),
      };
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.serializeValue(v));
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.serializeValue(v)]));
    }
    return value;
  }

  public override toStringTokens(): StepStringToken[] {
    const tokens: StepStringToken[] = [
      { kind: "start" },
      { kind: "name", value: this.name },
      { kind: "config", value: { all: this.config.all } },
    ];

    // Add tokens for each branch
    for (let i = 0; i < this.#branches.length; i++) {
      const branch = this.#branches[i]!;
      const branchTokens: StepStringToken[] = [];
      for (const step of branch) {
        branchTokens.push(...step.toStringTokens());
      }
      tokens.push({ kind: "steps", value: branchTokens });
    }

    tokens.push(
      { kind: "stat", key: "traversed", value: this.traversed },
      { kind: "stat", key: "emitted", value: this.emitted },
      { kind: "end" },
    );
    return tokens;
  }

  public override clone(partial?: Partial<QueryUnionStepConfig>) {
    const { config } = this;
    return new QueryUnionStep(
      {
        all: partial?.all ?? config.all,
        stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
      },
      this.#branches.map((branch) => branch.map((step) => step.clone())),
    );
  }
}

/**
 * Configuration for MultiQueryStep.
 * No special configuration needed beyond base StepConfig.
 */
export interface MultiQueryStepConfig extends StepConfig {}

/**
 * Step that executes multiple independent query pipelines sequentially.
 * Used to implement semicolon-separated multi-statement queries.
 *
 * Each statement is executed independently and results are yielded sequentially.
 * Results include a _statementIndex property to identify which statement produced them.
 *
 * @example
 * ```cypher
 * MATCH (n) RETURN count(n) AS total;
 * MATCH (n:Person) RETURN n.name AS name
 * ```
 */
export class MultiQueryStep extends Step<MultiQueryStepConfig> {
  #statements: readonly Step<any>[][];
  #traversers: Traverser[] | undefined;

  public constructor(config: MultiQueryStepConfig, statements: readonly Step<any>[][]) {
    super(config);
    this.#statements = statements;
  }

  public get name() {
    return "MultiQuery";
  }

  public get statements(): readonly Step<any>[][] {
    return this.#statements;
  }

  protected get traversers(): Traverser[] {
    if (this.#traversers === undefined) {
      this.#traversers = this.#statements.map((steps) => createTraverser(steps));
    }
    return this.#traversers;
  }

  public *traverse(
    source: GraphSource<any>,
    _input: Iterable<unknown>,
    context?: QueryContext,
  ): IterableIterator<unknown> {
    // Execute each statement sequentially
    // Each statement starts fresh with empty input (no statement chaining)
    const emptyInput: unknown[] = [];

    for (let i = 0; i < this.traversers.length; i++) {
      const traverser = this.traversers[i]!;
      for (const result of traverser.traverse(source, emptyInput, context)) {
        this.traversed++;
        this.emitted++;
        // Wrap result with statement index for identification
        if (result && typeof result === "object" && !Array.isArray(result)) {
          yield { ...result, _statementIndex: i };
        } else {
          yield { _value: result, _statementIndex: i };
        }
      }
    }
  }

  public override toStringTokens(): StepStringToken[] {
    const tokens: StepStringToken[] = [{ kind: "start" }, { kind: "name", value: this.name }];

    // Add tokens for each statement
    for (let i = 0; i < this.#statements.length; i++) {
      const statement = this.#statements[i]!;
      const statementTokens: StepStringToken[] = [];
      for (const step of statement) {
        statementTokens.push(...step.toStringTokens());
      }
      tokens.push({ kind: "steps", value: statementTokens });
    }

    tokens.push(
      { kind: "stat", key: "traversed", value: this.traversed },
      { kind: "stat", key: "emitted", value: this.emitted },
      { kind: "end" },
    );
    return tokens;
  }

  public override clone(partial?: Partial<MultiQueryStepConfig>) {
    return new MultiQueryStep(
      {
        stepLabels:
          partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
      },
      this.#statements.map((statement) => statement.map((step) => step.clone())),
    );
  }
}

export interface IntersectStepConfig extends StepConfig {}

export class IntersectStep<const TSteps extends readonly Step<any>[]> extends ContainerStep<
  TSteps,
  IntersectStepConfig
> {
  #intersectTraverser: Traverser | undefined;

  public get name() {
    return "Intersect";
  }

  protected get intersectTraverser() {
    if (this.#intersectTraverser === undefined) {
      return (this.#intersectTraverser = createTraverser(this.steps));
    }
    return this.#intersectTraverser;
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<unknown> {
    const seenV = new Set<ElementId>();
    const seenE = new Set<ElementId>();

    for (const path of input) {
      this.traversed++;
      if (!(path instanceof TraversalPath)) continue;
      const { value } = path;
      if (value instanceof Vertex) {
        seenV.add(value.id);
      } else if (value instanceof Edge) {
        seenE.add(value.id);
      }
    }

    for (const path of this.intersectTraverser.traverse(source, input)) {
      this.traversed++;
      if (!(path instanceof TraversalPath)) continue;
      const { value } = path;
      if (value instanceof Vertex) {
        if (seenV.has(value.id)) {
          this.emitted++;
          yield path;
        }
      } else if (value instanceof Edge) {
        if (seenE.has(value.id)) {
          this.emitted++;
          yield path;
        }
      }
    }
  }

  public override clone(partial?: Partial<IntersectStepConfig>) {
    const { config, steps } = this;
    return new IntersectStep(
      {
        stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
      },
      steps.map((step) => step.clone()),
    );
  }
}

export interface OptionalMatchStepConfig extends StepConfig {
  /**
   * Variable names bound by the optional pattern (for null bindings when no match).
   */
  variables: readonly string[];
}

/**
 * A step that implements OPTIONAL MATCH semantics.
 * If the nested steps produce results, those are yielded.
 * If no results are found, the input path is yielded with null values bound
 * to the pattern variables.
 */
export class OptionalMatchStep<const TSteps extends readonly Step<any>[]> extends ContainerStep<
  TSteps,
  OptionalMatchStepConfig
> {
  #matchTraverser: Traverser | undefined;

  public get name() {
    return "OptionalMatch";
  }

  protected get matchTraverser() {
    if (this.#matchTraverser === undefined) {
      return (this.#matchTraverser = createTraverser(this.steps));
    }
    return this.#matchTraverser;
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { variables } = this.config;

    for (const inputPath of input) {
      this.traversed++;

      // Run the nested match steps against this single input path
      const matchResults = [...this.matchTraverser.traverse(source, [inputPath])] as TraversalPath<
        any,
        any,
        any
      >[];

      if (matchResults.length > 0) {
        // Match found - yield all match results
        for (const result of matchResults) {
          this.emitted++;
          yield result;
        }
      } else {
        // No match - yield input path extended with null bindings
        let resultPath: TraversalPath<any, any, any> = inputPath;
        for (const variable of variables) {
          resultPath = resultPath.with(null, [variable]);
        }
        this.emitted++;
        yield resultPath;
      }
    }
  }

  public override clone(partial?: Partial<OptionalMatchStepConfig>) {
    const { config, steps } = this;
    return new OptionalMatchStep(
      {
        stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
        variables: partial?.variables ?? [...config.variables],
      },
      steps.map((step) => step.clone()),
    );
  }
}

export interface SelectStepConfig extends StepConfig {
  /**
   * The path labels to select.
   */
  pathLabels: readonly string[];
}

export class SelectStep extends Step<SelectStepConfig> {
  public get name() {
    return "Select";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<
    readonly (undefined | TraversalPath<any, any, any> | readonly TraversalPath<any, any, any>[])[]
  > {
    const { pathLabels } = this.config;
    for (const path of input) {
      this.traversed++;
      if (!(path instanceof TraversalPath)) continue;
      const collected: (
        | undefined
        | TraversalPath<any, any, any>
        | readonly TraversalPath<any, any, any>[]
      )[] = [];
      for (const pathLabel of pathLabels) {
        if (pathLabel.startsWith("all:")) {
          const label = pathLabel.slice(4);
          collected.push(path.getAll(label));
        } else if (pathLabel.startsWith("first")) {
          const all = path.getAll(pathLabel.slice(6));
          collected.push(all.length > 0 ? all[0] : undefined);
        } else if (pathLabel.startsWith("last")) {
          // the head of the path is the last element
          collected.push(path.get(pathLabel.slice(6)));
        } else {
          collected.push(path.get(pathLabel));
        }
      }
      if (collected.length > 0) {
        this.emitted++;
        this.traversed += collected.length;
        yield collected;
      }
    }
  }

  public override clone(partial?: Partial<SelectStepConfig>) {
    const { config } = this;
    return new SelectStep({
      pathLabels: partial?.pathLabels ?? [...config.pathLabels],
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }
}

export interface UnfoldStepConfig extends StepConfig {}

export class UnfoldStep extends Step<UnfoldStepConfig> {
  public get name() {
    return "Unfold";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<unknown> {
    for (const value of input) {
      this.traversed++;
      if (Array.isArray(value)) {
        for (const element of value) {
          this.emitted++;
          yield element;
        }
      } else {
        this.emitted++;
        yield value;
      }
    }
  }

  public override clone(partial?: Partial<UnfoldStepConfig>) {
    return new UnfoldStep({
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

export interface ValuesStepConfig extends StepConfig {}

export class ValuesStep extends Step<ValuesStepConfig> {
  public get name() {
    return "Values";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<unknown> {
    for (const path of input) {
      this.traversed++;
      const flattened = recursivelyFlattenValues(path);
      this.emitted++;
      yield flattened;
    }
  }

  public override clone(partial?: Partial<ValuesStepConfig>) {
    return new ValuesStep({
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

function recursivelyFlattenValues(value: unknown): unknown {
  if (value instanceof TraversalPath) {
    return value.value;
  }
  if (Array.isArray(value)) {
    return value.map(recursivelyFlattenValues);
  }
  return value;
}

/**
 * Configuration for PropertyValuesStep
 */
export interface PropertyValuesStepConfig extends StepConfig {
  /**
   * The items to extract, each with a variable name and optional property.
   * If property is undefined, the whole value is returned.
   */
  items: readonly { variable: string; property?: string }[];
}

/**
 * Step that extracts specific properties from selected elements.
 * Works with the output of SelectStep, extracting values and optionally specific properties.
 *
 * Input: Arrays from SelectStep where each element corresponds to a variable
 * Output: For single item, the property value. For multiple items, an array of property values.
 *
 * Example:
 * - RETURN d.schema → extracts the 'schema' property from variable 'd'
 * - RETURN u, u.name → extracts full 'u' value and 'name' property from 'u'
 */
export class PropertyValuesStep extends Step<PropertyValuesStepConfig> {
  public get name() {
    return "PropertyValues";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<unknown> {
    const { items } = this.config;
    for (const row of input) {
      this.traversed++;
      if (!Array.isArray(row)) continue;

      const result: unknown[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        const pathOrValue = row[i];

        // Extract the underlying value
        const value = this.#extractValue(pathOrValue);

        // If property is specified, extract just that property
        if (item.property !== undefined) {
          const propValue = this.#extractProperty(value, item.property);
          result.push(propValue);
        } else {
          result.push(value);
        }
      }

      this.emitted++;
      // Return single value directly, or array for multiple items
      yield result.length === 1 ? result[0] : result;
    }
  }

  #extractValue(pathOrValue: unknown): unknown {
    if (pathOrValue instanceof TraversalPath) {
      return pathOrValue.value;
    }
    if (Array.isArray(pathOrValue)) {
      // Handle arrays from SelectStep (nested TraversalPaths)
      return pathOrValue.map((v) => this.#extractValue(v));
    }
    return pathOrValue;
  }

  #extractProperty(value: unknown, property: string): unknown {
    // Property access on null returns null (per Cypher semantics)
    if (value === null) {
      return null;
    }
    // Handle Vertex and Edge objects
    if (value instanceof Vertex || value instanceof Edge) {
      // Special properties
      if (property === "@id") return value.id;
      if (property === "@label") return value.label;
      // Regular properties - use .get() method
      return value.get(property);
    }
    // Handle plain objects
    if (typeof value === "object") {
      return (value as Record<string, unknown>)[property];
    }
    return undefined;
  }

  public override clone(partial?: Partial<PropertyValuesStepConfig>) {
    return new PropertyValuesStep({
      items: partial?.items ?? [...this.config.items],
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

export interface ExpressionReturnItem {
  expression: ConditionValue;
  alias?: string;
}

export interface ExpressionReturnStepConfig extends StepConfig {
  items: readonly ExpressionReturnItem[];
}

/**
 * Step that evaluates arbitrary expressions for RETURN clauses.
 * Supports function calls like id(), elementId(), keys(), properties(),
 * arithmetic expressions, property access, and more.
 *
 * Input: TraversalPath
 * Output: For single items that are not plain variable refs, yields the value directly.
 *         For plain variable refs or multiple items, yields an array.
 *         This maintains backward compatibility with the old SelectStep + ValuesStep behavior.
 */
export class ExpressionReturnStep extends Step<ExpressionReturnStepConfig> {
  public get name() {
    return "ExpressionReturn";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    context?: QueryContext,
  ): IterableIterator<unknown> {
    const { items } = this.config;

    // Check if this is a single item and what type it is
    const singleItem = items.length === 1 ? items[0] : null;
    const isPlainVariableRef =
      singleItem &&
      typeof singleItem.expression === "object" &&
      singleItem.expression !== null &&
      "type" in singleItem.expression &&
      singleItem.expression.type === "variableRef";

    for (const path of input) {
      this.traversed++;

      const results: unknown[] = [];
      for (const item of items) {
        const value = resolveConditionValue(path, item.expression, context);
        results.push(value);
      }

      this.emitted++;

      // For backward compatibility with SelectStep + ValuesStep behavior:
      // - Plain variable refs (RETURN a) yield array: [value]
      // - Property access/functions (RETURN a.name, RETURN id(a)) yield value directly
      // - Multiple items always yield array
      if (items.length === 1 && !isPlainVariableRef) {
        yield results[0];
      } else {
        yield results;
      }
    }
  }

  public override clone(partial?: Partial<ExpressionReturnStepConfig>): ExpressionReturnStep {
    return new ExpressionReturnStep({
      items: partial?.items ?? [...this.config.items],
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

export interface LabelsStepConfig extends StepConfig {
  /**
   * When true, return the label as a single string instead of an array.
   * Used for type() function on relationships (returns single string).
   * Default is false (returns array for labels() function on nodes).
   */
  returnAsString?: boolean;
}

/**
 * Step that extracts labels from elements.
 * For each element (Vertex or Edge), returns an array containing its label.
 * This implements the Cypher labels() function (and type() when returnAsString is true).
 *
 * Input can be:
 * - TraversalPath directly
 * - Array from SelectStep (e.g., [TraversalPath] or [[TraversalPath]])
 * - Vertex or Edge directly
 */
export class LabelsStep extends Step<LabelsStepConfig> {
  public get name() {
    return "Labels";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<unknown>,
    _context?: QueryContext,
  ): IterableIterator<string[] | string | null> {
    for (const item of input) {
      this.traversed++;
      const result = this.#extractLabel(item);
      // 'skip' means we couldn't process this item (shouldn't happen in normal use)
      if (result !== "skip") {
        this.emitted++;
        yield result;
      }
    }
  }

  #extractLabel(item: unknown): string | string[] | null | "skip" {
    // Handle arrays from SelectStep (first element is the path)
    if (Array.isArray(item)) {
      const first = item[0];
      // null values from OPTIONAL MATCH should yield null
      if (first === null) {
        return null;
      }
      if (first !== undefined) {
        return this.#extractLabel(first);
      }
      return "skip";
    }

    // Handle null values (from OPTIONAL MATCH with no matches)
    if (item === null) {
      return null;
    }

    // Handle TraversalPaths
    if (item instanceof TraversalPath) {
      return this.#extractLabel(item.value);
    }

    // Handle direct elements
    if (item instanceof Vertex || item instanceof Edge) {
      // type() returns a single string, labels() returns an array
      return this.config.returnAsString ? item.label : [item.label];
    }

    return "skip";
  }

  public override clone(partial?: Partial<LabelsStepConfig>) {
    return new LabelsStep({
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
      returnAsString: partial?.returnAsString ?? this.config.returnAsString,
    });
  }
}

export interface BindPathStepConfig extends StepConfig {
  /**
   * The variable name to bind the path to.
   */
  pathVariable: string;
}

/**
 * BindPathStep binds the current TraversalPath to a variable name.
 * This is used for named path patterns: MATCH p = (a)-[r]->(b)
 *
 * The path is stored as a value in the TraversalPath with the given variable label,
 * allowing functions like nodes(p), relationships(p), and length(p) to access it.
 */
export class BindPathStep extends Step<BindPathStepConfig> {
  public get name() {
    return "BindPath";
  }

  public *traverse(
    _source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { pathVariable } = this.config;

    for (const path of input) {
      this.traversed++;
      // Bind the entire path to the path variable
      // The path itself becomes the value, with the pathVariable as the label
      const boundPath = path.with(path, [pathVariable]);
      this.emitted++;
      yield boundPath;
    }
  }

  public override clone(partial?: Partial<BindPathStepConfig>) {
    return new BindPathStep({
      pathVariable: partial?.pathVariable ?? this.config.pathVariable,
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

export interface ShortestPathStepConfig extends StepConfig {
  /**
   * The target vertex ID to find the shortest path to.
   * If not specified, targetCondition must be provided.
   */
  targetId?: ElementId;

  /**
   * A condition to match target vertices.
   * If not specified, targetId must be provided.
   */
  targetCondition?: Condition;

  /**
   * The direction of edge traversal.
   * Default: "out"
   */
  direction?: Direction;

  /**
   * The labels of the edges to traverse.
   * If not provided, all edges will be traversed.
   */
  edgeLabels?: readonly string[];

  /**
   * The maximum depth to search.
   * Default: 100
   */
  maxDepth?: number;

  /**
   * The property name to use for edge weights.
   * If provided, uses Dijkstra's algorithm instead of BFS.
   *
   * Weight handling:
   * - Missing or non-numeric weights default to 1
   * - Negative weights are not supported (edges with negative weights are skipped)
   * - Zero weights are allowed
   */
  weightProperty?: string;
}

/**
 * A path result from the shortest path algorithm.
 * Contains the full path of vertices and edges.
 */
export interface ShortestPathResult {
  /**
   * The vertices in the path, from source to target.
   */
  vertices: Vertex<any, any>[];

  /**
   * The edges in the path, in order from source to target.
   */
  edges: Edge<any, any>[];

  /**
   * The total length of the path (number of edges).
   */
  length: number;

  /**
   * The total weight of the path (if weighted).
   */
  weight?: number;
}

/**
 * Binary min-heap for efficient priority queue operations.
 * Used in Dijkstra's algorithm to achieve O((V + E) log V) complexity.
 */
class MinHeap<T> {
  private heap: T[] = [];
  private compareFn: (a: T, b: T) => number;

  constructor(compareFn: (a: T, b: T) => number) {
    this.compareFn = compareFn;
  }

  get size(): number {
    return this.heap.length;
  }

  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return min;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compareFn(this.heap[index]!, this.heap[parentIndex]!) >= 0) {
        break;
      }
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex]!, this.heap[index]!];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      let minIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (
        leftChild < this.heap.length &&
        this.compareFn(this.heap[leftChild]!, this.heap[minIndex]!) < 0
      ) {
        minIndex = leftChild;
      }

      if (
        rightChild < this.heap.length &&
        this.compareFn(this.heap[rightChild]!, this.heap[minIndex]!) < 0
      ) {
        minIndex = rightChild;
      }

      if (minIndex === index) break;

      [this.heap[index], this.heap[minIndex]] = [this.heap[minIndex]!, this.heap[index]!];
      index = minIndex;
    }
  }
}

/**
 * ShortestPathStep finds the shortest path between vertices using:
 * - BFS (Breadth-First Search) for unweighted graphs - O(V + E)
 * - Dijkstra's algorithm for weighted graphs - O((V + E) log V)
 *
 * This step is compatible with Cypher's shortestPath() function.
 *
 * NOTE: Currently only returns a single shortest path. The allShortestPaths()
 * function is parsed but not yet implemented. TODO: Implement support for
 * finding all shortest paths when requested.
 */
export class ShortestPathStep extends Step<ShortestPathStepConfig> {
  public get name() {
    return "ShortestPath";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const {
      targetId,
      targetCondition,
      direction = "out",
      edgeLabels = [],
      maxDepth = 100,
      weightProperty,
      stepLabels,
    } = this.config;

    if (targetId === undefined && targetCondition === undefined) {
      // No target specified - yield nothing
      // This allows the step to be created first and configured later via the fluent API
      return;
    }

    for (const path of input) {
      this.traversed++;
      const startVertex = path.value;
      if (!(startVertex instanceof Vertex)) {
        continue;
      }

      // Use appropriate algorithm based on whether weights are used
      const result = weightProperty
        ? this.dijkstra(
            source,
            startVertex,
            targetId,
            targetCondition,
            direction,
            edgeLabels,
            maxDepth,
            weightProperty,
          )
        : this.bfs(source, startVertex, targetId, targetCondition, direction, edgeLabels, maxDepth);

      if (result) {
        // Build a TraversalPath from the result
        let currentPath: TraversalPath<any, any, any> = path;

        // Add edges and vertices alternately to the path
        for (let i = 0; i < result.edges.length; i++) {
          currentPath = currentPath.with(result.edges[i]!, []);
          // Add vertex with step labels only if it's the target
          const isTarget = i === result.edges.length - 1;
          currentPath = currentPath.with(
            result.vertices[i + 1]!,
            isTarget && stepLabels ? stepLabels : [],
          );
        }

        this.emitted++;
        yield currentPath;
      }
    }
  }

  /**
   * BFS algorithm for unweighted shortest path.
   * Time complexity: O(V + E)
   */
  private bfs(
    source: GraphSource<any>,
    startVertex: Vertex<any, any>,
    targetId: ElementId | undefined,
    targetCondition: Condition | undefined,
    direction: Direction,
    edgeLabels: readonly string[],
    maxDepth: number,
  ): ShortestPathResult | null {
    // Early termination: check if start is target
    if (this.isTarget(startVertex, targetId, targetCondition)) {
      return { vertices: [startVertex], edges: [], length: 0 };
    }

    // BFS data structures with parent pointers for efficient path reconstruction
    const visited = new Set<ElementId>([startVertex.id]);
    const previous = new Map<ElementId, { vertex: Vertex<any, any>; edge: Edge<any, any> } | null>([
      [startVertex.id, null],
    ]);
    const queue: Vertex<any, any>[] = [startVertex];

    let depth = 0;

    while (queue.length > 0 && depth < maxDepth) {
      const levelSize = queue.length;
      depth++;

      for (let i = 0; i < levelSize; i++) {
        const current = queue.shift()!;

        // Get adjacent vertices based on direction
        const neighbors = this.getNeighbors(source, current, direction, edgeLabels);

        for (const { vertex: neighbor, edge } of neighbors) {
          if (visited.has(neighbor.id)) {
            continue;
          }

          visited.add(neighbor.id);
          previous.set(neighbor.id, { vertex: current, edge });

          // Check if this is the target
          if (this.isTarget(neighbor, targetId, targetCondition)) {
            return this.reconstructPath(neighbor, previous, depth);
          }

          queue.push(neighbor);
        }
      }
    }

    return null; // No path found
  }

  /**
   * Dijkstra's algorithm for weighted shortest path.
   * Time complexity: O((V + E) log V) with a binary heap.
   */
  private dijkstra(
    source: GraphSource<any>,
    startVertex: Vertex<any, any>,
    targetId: ElementId | undefined,
    targetCondition: Condition | undefined,
    direction: Direction,
    edgeLabels: readonly string[],
    maxDepth: number,
    weightProperty: string,
  ): ShortestPathResult | null {
    // Early termination: check if start is target
    if (this.isTarget(startVertex, targetId, targetCondition)) {
      return { vertices: [startVertex], edges: [], length: 0, weight: 0 };
    }

    // Dijkstra data structures
    const distances = new Map<ElementId, number>([[startVertex.id, 0]]);
    const previous = new Map<ElementId, { vertex: Vertex<any, any>; edge: Edge<any, any> } | null>([
      [startVertex.id, null],
    ]);

    // Priority queue using binary min-heap for O(log V) operations
    const pq = new MinHeap<{ vertex: Vertex<any, any>; distance: number }>(
      (a, b) => a.distance - b.distance,
    );
    pq.push({ vertex: startVertex, distance: 0 });

    let iterations = 0;
    // Safety limit: prevent DoS with hard cap independent of maxDepth
    const maxIterations = Math.min(maxDepth * 1000, 100000);

    while (pq.size > 0 && iterations < maxIterations) {
      iterations++;

      // Get vertex with minimum distance (O(log V) operation)
      const current = pq.pop();
      if (!current) break;

      const { vertex: currentVertex, distance: currentDistance } = current;

      // Skip if we've already processed this with a shorter distance
      const storedDistance = distances.get(currentVertex.id);
      if (storedDistance !== undefined && storedDistance < currentDistance) {
        continue;
      }

      // Check if we've reached the target
      if (this.isTarget(currentVertex, targetId, targetCondition)) {
        // Reconstruct path
        return this.reconstructPath(currentVertex, previous, currentDistance);
      }

      // Get neighbors
      const neighbors = this.getNeighbors(source, currentVertex, direction, edgeLabels);

      for (const { vertex: neighbor, edge } of neighbors) {
        // Get edge weight (default to 1 if not found)
        // Note: Missing or non-numeric weights default to 1 for unweighted behavior
        const weight = edge.get(weightProperty) ?? 1;
        if (typeof weight !== "number") {
          continue; // Skip edges with invalid (non-numeric) weights
        }
        // Dijkstra's algorithm is incorrect with negative weights
        // Skip negative weight edges (would require Bellman-Ford algorithm)
        if (weight < 0) {
          continue;
        }

        const newDistance = currentDistance + weight;
        const existingDistance = distances.get(neighbor.id);

        if (existingDistance === undefined || newDistance < existingDistance) {
          distances.set(neighbor.id, newDistance);
          previous.set(neighbor.id, { vertex: currentVertex, edge });
          pq.push({ vertex: neighbor, distance: newDistance });
        }
      }
    }

    return null; // No path found
  }

  /**
   * Reconstruct the path from the previous map.
   */
  private reconstructPath(
    target: Vertex<any, any>,
    previous: Map<ElementId, { vertex: Vertex<any, any>; edge: Edge<any, any> } | null>,
    totalWeight?: number,
  ): ShortestPathResult {
    const vertices: Vertex<any, any>[] = [];
    const edges: Edge<any, any>[] = [];

    let current: Vertex<any, any> | null = target;

    while (current !== null) {
      vertices.unshift(current);
      const prev = previous.get(current.id);
      if (prev === null || prev === undefined) {
        break;
      }
      edges.unshift(prev.edge);
      current = prev.vertex;
    }

    const result: ShortestPathResult = {
      vertices,
      edges,
      length: edges.length,
    };

    if (totalWeight !== undefined) {
      result.weight = totalWeight;
    }

    return result;
  }

  /**
   * Get neighboring vertices based on direction.
   */
  private getNeighbors(
    source: GraphSource<any>,
    vertex: Vertex<any, any>,
    direction: Direction,
    edgeLabels: readonly string[],
  ): Array<{ vertex: Vertex<any, any>; edge: Edge<any, any> }> {
    const results: Array<{ vertex: Vertex<any, any>; edge: Edge<any, any> }> = [];

    if (direction === "out" || direction === "both") {
      // Outgoing edges: vertex is the source (outV), return target (inV)
      for (const edge of source.getOutgoingEdges(vertex.id)) {
        if (edgeLabels.length === 0 || edgeLabels.includes(edge.label)) {
          results.push({ vertex: edge.inV, edge });
        }
      }
    }

    if (direction === "in" || direction === "both") {
      // Incoming edges: vertex is the target (inV), return source (outV)
      for (const edge of source.getIncomingEdges(vertex.id)) {
        if (edgeLabels.length === 0 || edgeLabels.includes(edge.label)) {
          results.push({ vertex: edge.outV, edge });
        }
      }
    }

    return results;
  }

  /**
   * Check if a vertex matches the target criteria.
   */
  private isTarget(
    vertex: Vertex<any, any>,
    targetId: ElementId | undefined,
    targetCondition: Condition | undefined,
  ): boolean {
    if (targetId !== undefined) {
      return vertex.id === targetId;
    }

    if (targetCondition !== undefined) {
      // Create a temporary path to evaluate the condition
      const tempPath = new TraversalPath(undefined, vertex, []);
      return evaluateConditionFn(tempPath, targetCondition);
    }

    return false;
  }

  public override clone(partial?: Partial<ShortestPathStepConfig>) {
    const { config } = this;
    return new ShortestPathStep({
      targetId: partial?.targetId ?? config.targetId,
      targetCondition: partial?.targetCondition ?? config.targetCondition,
      direction: partial?.direction ?? config.direction,
      edgeLabels: partial?.edgeLabels ?? config.edgeLabels,
      maxDepth: partial?.maxDepth ?? config.maxDepth,
      weightProperty: partial?.weightProperty ?? config.weightProperty,
      stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
    });
  }

  public override toStringTokens(): readonly StepStringToken[] {
    const { targetId, targetCondition, stepLabels, ...config } = this.config;

    const tokens: StepStringToken[] = [
      { kind: "start" },
      { kind: "name", value: this.name },
      { kind: "config", value: { targetId, ...config } },
    ];

    if (targetCondition !== undefined) {
      tokens.push({ kind: "condition", value: targetCondition });
    }

    if (stepLabels !== undefined && stepLabels.length > 0) {
      tokens.push({ kind: "aliases", value: stepLabels });
    }
    if (this.traversed > 0) {
      tokens.push({ kind: "stat", key: "traversed", value: this.traversed });
    }
    if (this.emitted > 0) {
      tokens.push({ kind: "stat", key: "emitted", value: this.emitted });
    }
    tokens.push({ kind: "end" });
    return tokens;
  }
}

// Export the evaluateCondition function for use by ShortestPathStep
function evaluateConditionFn(
  path: TraversalPath<any, any, any>,
  condition: Condition,
  context?: QueryContext,
): boolean {
  return evaluateCondition(path, condition, context);
}

/**
 * List expression for FOREACH - literal list, property access, variable reference, or function call.
 */
export type ForeachListExpression =
  | { type: "literal"; values: readonly (string | number | boolean | null)[] }
  | { type: "property"; variable: string; property: string }
  | { type: "variable"; variable: string }
  | {
      type: "functionCall";
      name: string;
      args: ConditionValue[];
      distinct: boolean;
    };

export interface ForeachStepConfig extends StepConfig {
  /**
   * The variable name to bind each element to.
   */
  variable: string;

  /**
   * The list expression to iterate over.
   * If not provided, the step expects the input path's value to be an array.
   */
  listExpression?: ForeachListExpression;
}

/**
 * ForeachStep iterates over list values and executes inner steps for each element.
 * This implements Cypher FOREACH clause semantics:
 * - FOREACH (x IN [1, 2, 3] | SET p.prop = x)
 * - FOREACH (x IN p.items | SET x.processed = true)
 *
 * The list expression can be:
 * - A literal list: [1, 2, 3], ['a', 'b', 'c']
 * - A property access: p.items (gets the 'items' property from variable 'p')
 *
 * For each element in the list, the inner steps (typically SET operations) are executed,
 * with the element bound to the iteration variable.
 */
export class ForeachStep<const TSteps extends readonly Step<any>[]> extends ContainerStep<
  TSteps,
  ForeachStepConfig
> {
  #foreachTraverser: Traverser | undefined;

  public get name() {
    return "Foreach";
  }

  protected get foreachTraverser() {
    if (this.#foreachTraverser === undefined) {
      if (this.steps.length === 0) {
        return undefined;
      }
      return (this.#foreachTraverser = createTraverser(this.steps));
    }
    return this.#foreachTraverser;
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { variable, listExpression } = this.config;

    for (const path of input) {
      this.traversed++;

      // Get the list to iterate over
      let listValue: readonly any[];

      if (listExpression) {
        if (listExpression.type === "literal") {
          // Literal list - use the values directly
          listValue = listExpression.values;
        } else if (listExpression.type === "property") {
          // Property access - get the property from the variable bound in the path
          const variablePath = path.get(listExpression.variable);
          if (!variablePath) {
            // Variable not found - skip this path but still yield it
            this.emitted++;
            yield path;
            continue;
          }
          const element = variablePath.value;
          if (element instanceof Vertex || element instanceof Edge) {
            const propValue = element.get(listExpression.property as never);
            if (!Array.isArray(propValue)) {
              // Property is not an array - skip this path but still yield it
              this.emitted++;
              yield path;
              continue;
            }
            listValue = propValue;
          } else {
            // Not a graph element - skip this path but still yield it
            this.emitted++;
            yield path;
            continue;
          }
        } else if (listExpression.type === "variable") {
          // Variable reference - get the value directly from the path
          const variablePath = path.get(listExpression.variable);
          if (!variablePath) {
            // Variable not found - skip this path but still yield it
            this.emitted++;
            yield path;
            continue;
          }
          const value = variablePath.value;
          if (!Array.isArray(value)) {
            // Not an array - skip this path but still yield it
            this.emitted++;
            yield path;
            continue;
          }
          listValue = value;
        } else if (listExpression.type === "functionCall") {
          // Function call - evaluate and use result as list
          const resolvedArgs = listExpression.args.map((arg) =>
            resolveConditionValue(path, arg, context),
          );
          const result = evaluateFunction(
            listExpression.name,
            resolvedArgs,
            path,
            listExpression.distinct,
          );
          if (!Array.isArray(result)) {
            // Function did not return an array - skip this path but still yield it
            this.emitted++;
            yield path;
            continue;
          }
          listValue = result;
        } else {
          // Unknown type - skip
          this.emitted++;
          yield path;
          continue;
        }
      } else {
        // Fallback: expect the input path's value to be an array
        const pathValue = path.value;
        if (!Array.isArray(pathValue)) {
          // If not an array, just pass through
          this.emitted++;
          yield path;
          continue;
        }
        listValue = pathValue;
      }

      // If the list is empty, just yield the original path
      if (listValue.length === 0) {
        this.emitted++;
        yield path;
        continue;
      }

      // If there are no inner steps, just yield the original path after "iterating"
      if (!this.foreachTraverser) {
        this.emitted++;
        yield path;
        continue;
      }

      // Iterate over each element in the list
      // For FOREACH semantics, we execute inner steps for side effects (mutations)
      // and then yield the original path once
      for (const element of listValue) {
        // Determine what to bind to the iteration variable
        // If element is a Vertex or Edge, use it directly (supports DELETE operations)
        // Otherwise, wrap it so SET can access primitive values
        let elementToBind: any;

        if (element instanceof Vertex || element instanceof Edge) {
          // Use the actual graph element directly
          elementToBind = element;
        } else {
          // Wrap non-graph elements for SET access
          elementToBind = {
            id: `foreach_${variable}_${Math.random().toString(36).substr(2, 9)}`,
            label: "ForeachElement",
            value: element,
            get: (key: string) => (key === "value" ? element : undefined),
            set: () => {
              /* no-op for foreach element wrapper */
            },
          };
        }

        const elementPath = new TraversalPath(path, elementToBind, [variable]);

        // Check if inner steps start with a MATCH operation (FetchVertices/FetchEdges)
        // If so, we need to handle scope injection specially
        const firstStep = this.steps[0];
        const hasMatchOperation =
          firstStep instanceof FetchVerticesStep || firstStep instanceof FetchEdgesStep;

        if (hasMatchOperation) {
          // Split steps into fetch, filter, and mutation steps
          // This allows scope injection between fetch and filter phases
          const { fetchSteps, filterSteps, mutationSteps } = this.splitSteps();

          // Create traversers for each phase
          const fetchTraverser = fetchSteps.length > 0 ? createTraverser(fetchSteps) : undefined;
          const filterTraverser = filterSteps.length > 0 ? createTraverser(filterSteps) : undefined;
          const mutationTraverser =
            mutationSteps.length > 0 ? createTraverser(mutationSteps) : undefined;

          if (fetchTraverser) {
            // Phase 1: Execute fetch steps to get vertices/edges from graph
            for (const fetchedPath of fetchTraverser.traverse(source, [elementPath]) as Iterable<
              TraversalPath<any, any, any>
            >) {
              // Phase 2: Inject the iteration variable scope into the fetched path
              // This allows filter conditions to access the FOREACH iteration variable
              const scopedPath = injectScopeIntoPath(fetchedPath, elementPath);

              // Phase 3: Execute filter steps (WHERE conditions) on scoped paths
              let filteredPaths: TraversalPath<any, any, any>[] = [scopedPath];
              if (filterTraverser) {
                filteredPaths = [];
                for (const filteredPath of filterTraverser.traverse(source, [
                  scopedPath,
                ]) as Iterable<TraversalPath<any, any, any>>) {
                  filteredPaths.push(filteredPath);
                }
              }

              // Phase 4: Execute mutation steps (SET) on filtered paths
              if (mutationTraverser) {
                for (const path of filteredPaths) {
                  for (const _mutationResult of mutationTraverser.traverse(source, [path])) {
                    // Consume for side effects
                  }
                }
              }
            }
          }
        } else {
          // No MATCH operation - execute inner steps directly (original behavior)
          for (const _result of this.foreachTraverser.traverse(source, [elementPath])) {
            // Just consume - the inner steps handle mutations
          }
        }
      }

      // After all iterations complete, yield the original path
      this.emitted++;
      yield path;
    }
  }

  /**
   * Split inner steps into fetch steps, filter steps, and mutation steps.
   * This allows proper scope injection between fetch and filter operations.
   *
   * - fetchSteps: Steps that create/traverse paths (FetchVertices, ShortestPath, etc.)
   * - filterSteps: FilterElements steps that come AFTER all fetch steps
   * - mutationSteps: Set steps (modify graph)
   *
   * Scope injection happens after fetch steps, so filter steps can access
   * FOREACH iteration variables.
   */
  private splitSteps(): {
    fetchSteps: Step<any>[];
    filterSteps: Step<any>[];
    mutationSteps: Step<any>[];
  } {
    const fetchSteps: Step<any>[] = [];
    const filterSteps: Step<any>[] = [];
    const mutationSteps: Step<any>[] = [];

    // Find the last non-mutation step that's not a FilterElementsStep
    // All FilterElementsStep after that point go to filterSteps
    let lastFetchIndex = -1;
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const step = this.steps[i];
      if (step instanceof SetStep || step instanceof DeleteStep) {
        continue; // Skip mutation steps
      }
      if (!(step instanceof FilterElementsStep)) {
        lastFetchIndex = i;
        break;
      }
    }

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i]!;

      if (step instanceof SetStep || step instanceof DeleteStep) {
        mutationSteps.push(step);
      } else if (step instanceof FilterElementsStep && i > lastFetchIndex) {
        // FilterElementsStep after all fetch steps goes to filterSteps
        filterSteps.push(step);
      } else {
        // All other steps (including FilterElementsStep before fetch steps) go to fetchSteps
        fetchSteps.push(step);
      }
    }

    return { fetchSteps, filterSteps, mutationSteps };
  }

  public override clone(partial?: Partial<ForeachStepConfig>) {
    const { config, steps } = this;
    return new ForeachStep(
      {
        variable: partial?.variable ?? config.variable,
        listExpression: partial?.listExpression ?? config.listExpression,
        stepLabels: partial?.stepLabels ?? (config.stepLabels ? [...config.stepLabels] : undefined),
      },
      steps.map((step) => step.clone()),
    );
  }
}

/**
 * Inject a scope path's bindings into a result path.
 * This is used to preserve FOREACH iteration variable bindings when
 * inner MATCH operations create new paths that lose the original bindings.
 *
 * The function rebuilds the result path chain with the scope path as the base,
 * so that path.get() can find bindings from both the result and the scope.
 */
function injectScopeIntoPath(
  resultPath: TraversalPath<any, any, any>,
  scopePath: TraversalPath<any, any, any>,
): TraversalPath<any, any, any> {
  // Collect the path chain from resultPath (from root to leaf)
  const chain: Array<{ value: any; labels: readonly string[] }> = [];
  let current: TraversalPath<any, any, any> | undefined = resultPath;
  while (current) {
    chain.unshift({ value: current.value, labels: current.labels });
    current = current.parent as TraversalPath<any, any, any> | undefined;
  }

  // Rebuild the chain with scopePath as the base
  let rebuiltPath: TraversalPath<any, any, any> = scopePath;
  for (const { value, labels } of chain) {
    rebuiltPath = new TraversalPath(rebuiltPath, value, labels as readonly string[]);
  }

  return rebuiltPath;
}

export type SetAssignmentValue =
  | {
      type: "literal";
      value: string | number | boolean | null | Record<string, unknown>;
    }
  | { type: "list"; values: unknown[] }
  | { type: "property"; variable: string; property: string }
  | { type: "variable"; variable: string }
  | { type: "parameter"; name: string };

export interface SetStepAssignment {
  variable: string;
  property: string;
  value: SetAssignmentValue;
}

/**
 * Replace all properties on an element with a property map.
 * Syntax: SET n = {props}
 */
export interface SetAllPropertiesAssignment {
  type: "setAllProperties";
  variable: string;
  /** Property map literal or parameter name */
  properties: Record<string, unknown> | { type: "parameter"; name: string };
}

/**
 * Add/merge properties into an element's existing properties.
 * Syntax: SET n += {props}
 */
export interface SetAddPropertiesAssignment {
  type: "setAddProperties";
  variable: string;
  /** Property map literal or parameter name */
  properties: Record<string, unknown> | { type: "parameter"; name: string };
}

export type SetOperation =
  | SetStepAssignment
  | SetAllPropertiesAssignment
  | SetAddPropertiesAssignment;

export interface SetStepConfig extends StepConfig {
  /**
   * The assignments to perform.
   */
  assignments: readonly SetOperation[];
}

/**
 * SetStep modifies properties on vertices/edges in the graph.
 * Supports three types of assignments:
 * 1. Individual property: n.prop = value
 * 2. Replace all properties: n = {props}
 * 3. Add/merge properties: n += {props}
 */
export class SetStep extends Step<SetStepConfig> {
  public get name() {
    return "Set";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { assignments } = this.config;

    for (const path of input) {
      this.traversed++;

      // Apply each assignment
      for (const assignment of assignments) {
        // Check if this is a map-based assignment (setAllProperties or setAddProperties)
        if ("type" in assignment) {
          const { variable, properties } = assignment;

          // Find the element bound to this variable in the path
          const elementPath = path.get(variable);
          if (!elementPath) {
            throw new Error(
              `SET: Variable '${variable}' not found in path. Available variables: ${Array.from(path.labels).join(", ") || "none"}`,
            );
          }

          let element = elementPath.value;
          // Handle FOREACH element wrappers
          if (element && typeof element === "object" && element.label === "ForeachElement") {
            element = element.value;
          }
          if (!(element instanceof Vertex || element instanceof Edge)) {
            throw new Error(
              `SET: Variable '${variable}' is not a vertex or edge (got ${typeof element})`,
            );
          }

          // Resolve the property map
          let resolvedProps: Record<string, unknown>;
          if (
            typeof properties === "object" &&
            properties !== null &&
            "type" in properties &&
            properties.type === "parameter"
          ) {
            // Parameter reference
            const params = context?.params ?? getQueryParams();
            const paramName = (properties as { type: "parameter"; name: string }).name;
            resolvedProps = params[paramName] as Record<string, unknown>;
            if (
              resolvedProps === undefined ||
              resolvedProps === null ||
              typeof resolvedProps !== "object"
            ) {
              throw new Error(`SET: Parameter '${paramName}' must be an object/map`);
            }
          } else {
            // Direct property map
            resolvedProps = properties as Record<string, unknown>;
          }

          if (assignment.type === "setAllProperties") {
            // Replace all properties: first clear existing, then set new
            const storedElement = element[$StoredElement];
            if (storedElement && storedElement.properties) {
              for (const key of Object.keys(storedElement.properties)) {
                element.set(key as never, undefined);
              }
            }
            for (const [key, value] of Object.entries(resolvedProps)) {
              element.set(key as never, value);
            }
          } else if (assignment.type === "setAddProperties") {
            // Add/merge properties: just set the new ones (preserves existing)
            for (const [key, value] of Object.entries(resolvedProps)) {
              element.set(key as never, value);
            }
          }
        } else {
          // Individual property assignment: n.prop = value
          const { variable, property, value } = assignment;

          // Find the element bound to this variable in the path
          const elementPath = path.get(variable);
          if (!elementPath) {
            throw new Error(
              `SET: Variable '${variable}' not found in path. Available variables: ${Array.from(path.labels).join(", ") || "none"}`,
            );
          }

          let element = elementPath.value;
          // Handle FOREACH element wrappers
          if (element && typeof element === "object" && element.label === "ForeachElement") {
            element = element.value;
          }
          if (!(element instanceof Vertex || element instanceof Edge)) {
            throw new Error(
              `SET: Variable '${variable}' is not a vertex or edge (got ${typeof element})`,
            );
          }

          // Resolve the value
          let resolvedValue: any;
          if (value.type === "literal") {
            resolvedValue = value.value;
          } else if (value.type === "property") {
            const sourcePath = path.get(value.variable);
            if (!sourcePath) {
              throw new Error(
                `SET: Source variable '${value.variable}' not found for property access`,
              );
            }
            let sourceElement = sourcePath.value;
            // Handle FOREACH element wrappers - extract the actual value for property access
            if (
              sourceElement &&
              typeof sourceElement === "object" &&
              sourceElement.label === "ForeachElement"
            ) {
              sourceElement = sourceElement.value;
            }
            if (!(sourceElement instanceof Vertex || sourceElement instanceof Edge)) {
              throw new Error(`SET: Source variable '${value.variable}' is not a vertex or edge`);
            }
            resolvedValue = sourceElement.get(value.property as never);
          } else if (value.type === "variable") {
            const sourcePath = path.get(value.variable);
            if (!sourcePath) {
              throw new Error(`SET: Source variable '${value.variable}' not found`);
            }
            resolvedValue = sourcePath.value;
            // Handle FOREACH element wrappers - extract the actual value
            if (
              resolvedValue &&
              typeof resolvedValue === "object" &&
              resolvedValue.label === "ForeachElement"
            ) {
              resolvedValue = resolvedValue.value;
            }
          } else if (value.type === "parameter") {
            const params = context?.params ?? getQueryParams();
            resolvedValue = params[value.name];
          } else if (value.type === "list") {
            resolvedValue = value.values;
          }

          // Set the property on the element
          element.set(property as never, resolvedValue);
        }
      }

      this.emitted++;
      yield path;
    }
  }

  public override clone(partial?: Partial<SetStepConfig>) {
    return new SetStep({
      assignments: partial?.assignments ?? [...this.config.assignments],
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

export interface CreateVertexConfig {
  variable?: string;
  label: string;
  properties: Record<string, any>;
}

export interface CreateEdgeConfig {
  variable?: string;
  label: string;
  direction: "in" | "out";
  properties: Record<string, any>;
  startVariable: string;
  endVariable?: string; // If referencing existing vertex
  endVertexConfig?: CreateVertexConfig; // If creating new vertex
}

export interface CreateStepConfig extends StepConfig {
  /**
   * The vertices to create.
   */
  vertices: readonly CreateVertexConfig[];
  /**
   * The edges to create.
   */
  edges?: readonly CreateEdgeConfig[];
}

/**
 * CreateStep creates new vertices and edges in the graph.
 * Each vertex configuration specifies the label, properties, and optional variable binding.
 * Each edge configuration specifies the label, direction, properties, and endpoint variables.
 * Note: This step requires a Graph instance (not just GraphSource) since it performs mutations.
 */
export class CreateStep extends Step<CreateStepConfig> {
  public get name() {
    return "Create";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { vertices, edges, stepLabels } = this.config;

    // Cast source to any to access addVertex/addEdge - CREATE requires a full Graph instance
    const graph = source as any;
    if (typeof graph.addVertex !== "function") {
      throw new Error("CREATE requires a Graph instance with addVertex method");
    }

    for (const path of input) {
      this.traversed++;

      let currentPath = path;

      // Create each vertex
      for (const vConfig of vertices) {
        const resolvedProperties = this.resolveProperties(
          vConfig.properties || {},
          context,
          currentPath,
        );
        const vertex = graph.addVertex(vConfig.label, resolvedProperties);

        // Add vertex to path with its variable as the label
        if (vConfig.variable) {
          currentPath = currentPath.with(vertex, [vConfig.variable]);
        } else {
          currentPath = currentPath.with(vertex, stepLabels ?? []);
        }
      }

      // Create each edge
      if (edges) {
        for (const eConfig of edges) {
          // Get the start vertex from the path
          const startPath = currentPath.get(eConfig.startVariable);
          if (!startPath) {
            throw new Error(`CREATE: Start variable '${eConfig.startVariable}' not found in path`);
          }
          const startVertex = startPath.value;
          if (!(startVertex instanceof Vertex)) {
            throw new Error(`CREATE: Start variable '${eConfig.startVariable}' is not a vertex`);
          }

          // Get or create the end vertex
          let endVertex: Vertex<any, any>;
          if (eConfig.endVariable) {
            // Reference to existing vertex in path
            const endPath = currentPath.get(eConfig.endVariable);
            if (!endPath) {
              throw new Error(`CREATE: End variable '${eConfig.endVariable}' not found in path`);
            }
            endVertex = endPath.value as Vertex<any, any>;
            if (!(endVertex instanceof Vertex)) {
              throw new Error(`CREATE: End variable '${eConfig.endVariable}' is not a vertex`);
            }
          } else if (eConfig.endVertexConfig) {
            // Create new vertex
            const resolvedEndProperties = this.resolveProperties(
              eConfig.endVertexConfig.properties || {},
              context,
              currentPath,
            );
            endVertex = graph.addVertex(eConfig.endVertexConfig.label, resolvedEndProperties);
            if (eConfig.endVertexConfig.variable) {
              currentPath = currentPath.with(endVertex, [eConfig.endVertexConfig.variable]);
            }
          } else {
            throw new Error(
              "CREATE: Edge configuration must have either endVariable or endVertexConfig",
            );
          }

          // Determine in/out vertices based on direction
          const [inV, outV] =
            eConfig.direction === "out" ? [startVertex, endVertex] : [endVertex, startVertex];

          // Create the edge
          const resolvedEdgeProps = this.resolveProperties(
            eConfig.properties || {},
            context,
            currentPath,
          );
          const edge = graph.addEdge(inV, eConfig.label, outV, resolvedEdgeProps);

          // Add edge to path with its variable as the label
          if (eConfig.variable) {
            currentPath = currentPath.with(edge, [eConfig.variable]);
          }
        }
      }

      this.emitted++;
      yield currentPath;
    }
  }

  public override clone(partial?: Partial<CreateStepConfig>) {
    return new CreateStep({
      vertices: partial?.vertices ?? [...this.config.vertices],
      edges: partial?.edges ?? (this.config.edges ? [...this.config.edges] : undefined),
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

// ============================================================================
// DELETE Step
// ============================================================================

export interface DeleteStepConfig extends StepConfig {
  /**
   * The variables to delete.
   */
  variables: string[];
  /**
   * Whether to detach (delete connected edges) before deleting vertices.
   */
  detach: boolean;
}

/**
 * DeleteStep removes vertices and edges from the graph.
 * With detach: true, connected edges are automatically removed before deleting vertices.
 * Note: This step requires a Graph instance (not just GraphSource) since it performs mutations.
 *
 * Performance: This step collects ALL matching paths into memory before performing deletions
 * to avoid mutation during iteration. For very large result sets, this could cause memory
 * pressure. Consider using LIMIT to batch large deletions.
 */
export class DeleteStep extends Step<DeleteStepConfig> {
  public get name() {
    return "Delete";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const graph = source as any;
    if (typeof graph.deleteVertex !== "function") {
      throw new Error("DELETE requires a Graph instance with deleteVertex method");
    }

    const { variables, detach } = this.config;
    const maxCollectionSize = _context?.options.maxCollectionSize ?? DEFAULT_MAX_COLLECTION_SIZE;

    // Collect all elements to delete first (avoid mutation during iteration)
    const toDelete: Array<{
      path: TraversalPath<any, any, any>;
      elements: Array<{ variable: string; element: any }>;
    }> = [];

    for (const path of input) {
      this.traversed++;
      if (toDelete.length >= maxCollectionSize) {
        throw new MemoryLimitExceededError(maxCollectionSize, toDelete.length);
      }
      const elements: Array<{ variable: string; element: any }> = [];

      for (const variable of variables) {
        const elementPath = path.get(variable);
        if (!elementPath) {
          throw new Error(
            `DELETE: Variable '${variable}' not found in path. Available: ${Array.from(path.labels).join(", ") || "none"}`,
          );
        }
        elements.push({ variable, element: elementPath.value });
      }
      toDelete.push({ path, elements });
    }

    // Track deleted element IDs to avoid double deletion
    const deletedIds = new Set<ElementId>();

    // Perform deletions
    for (const { path, elements } of toDelete) {
      // Delete edges first
      for (const { element } of elements) {
        if (element instanceof Edge && !deletedIds.has(element.id)) {
          graph.deleteEdge(element);
          deletedIds.add(element.id);
        }
      }

      // Then delete vertices
      for (const { variable, element } of elements) {
        if (element instanceof Vertex && !deletedIds.has(element.id)) {
          if (detach) {
            // Delete all connected edges first
            const inEdges = [...graph.getIncomingEdges(element.id)];
            const outEdges = [...graph.getOutgoingEdges(element.id)];
            for (const edge of [...inEdges, ...outEdges]) {
              if (!deletedIds.has(edge.id)) {
                graph.deleteEdge(edge);
                deletedIds.add(edge.id);
              }
            }
          } else {
            // Check if vertex has edges
            const inEdges = [...graph.getIncomingEdges(element.id)];
            const outEdges = [...graph.getOutgoingEdges(element.id)];
            if (inEdges.length > 0 || outEdges.length > 0) {
              throw new Error(
                `DELETE: Cannot delete vertex '${variable}' (${element.id}): has ${inEdges.length + outEdges.length} connected edges. Use DETACH DELETE to remove edges automatically.`,
              );
            }
          }
          graph.deleteVertex(element);
          deletedIds.add(element.id);
        }
      }

      this.emitted++;
      yield path;
    }
  }

  public override clone(partial?: Partial<DeleteStepConfig>) {
    return new DeleteStep({
      variables: partial?.variables ?? [...this.config.variables],
      detach: partial?.detach ?? this.config.detach,
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

// ============================================================================
// REMOVE Step
// ============================================================================

export interface RemovePropertyItem {
  type: "property";
  variable: string;
  property: string;
}

export interface RemoveLabelItem {
  type: "label";
  variable: string;
  label: string;
}

export type RemoveStepItem = RemovePropertyItem | RemoveLabelItem;

export interface RemoveStepConfig extends StepConfig {
  /**
   * The items (properties or labels) to remove.
   */
  items: RemoveStepItem[];
}

/**
 * RemoveStep removes properties or labels from vertices/edges.
 * Note: Label removal is not currently supported as labels are immutable.
 */
export class RemoveStep extends Step<RemoveStepConfig> {
  public get name() {
    return "Remove";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { items } = this.config;

    for (const path of input) {
      this.traversed++;

      for (const item of items) {
        if (item.type === "property") {
          const elementPath = path.get(item.variable);
          if (!elementPath) {
            throw new Error(`REMOVE: Variable '${item.variable}' not found in path`);
          }
          const element = elementPath.value;
          if (element instanceof Vertex || element instanceof Edge) {
            // Set property to undefined to remove it
            element.set(item.property as never, undefined as never);
          } else {
            throw new Error(`REMOVE: Variable '${item.variable}' is not a vertex or edge`);
          }
        } else if (item.type === "label") {
          // Label removal validated in astToSteps, but keep runtime check as fallback
          throw new Error(
            `REMOVE: Label removal is not supported. Labels are immutable. ` +
              `Cannot remove label '${item.label}' from '${item.variable}'.`,
          );
        }
      }

      this.emitted++;
      yield path;
    }
  }

  public override clone(partial?: Partial<RemoveStepConfig>) {
    return new RemoveStep({
      items: partial?.items ?? [...this.config.items],
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

// ============================================================================
// MERGE Step
// ============================================================================

export interface MergeNodeConfig {
  type: "node";
  variable?: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface MergeEdgeConfig {
  type: "edge";
  variable?: string;
  label: string;
  direction: "in" | "out";
  properties: Record<string, any>;
  startVariable: string;
  endVariable: string;
}

export type MergePatternConfig = MergeNodeConfig | MergeEdgeConfig;

export interface MergeStepConfig extends StepConfig {
  /**
   * The pattern to merge (match or create).
   */
  pattern: MergePatternConfig;
  /**
   * Assignments to apply when creating.
   */
  onCreate?: readonly SetStepAssignment[];
  /**
   * Assignments to apply when matching.
   */
  onMatch?: readonly SetStepAssignment[];
}

/**
 * MergeStep implements upsert semantics - match if exists, otherwise create.
 * Supports both nodes and relationships.
 * Note: This step requires a Graph instance (not just GraphSource) since it performs mutations.
 *
 * Performance: Vertex matching uses linear scan - O(n) where n = vertices with matching label.
 * Edge matching uses getOutgoingEdges which is O(degree). For large graphs with frequent MERGE
 * operations, consider adding property indices (future optimization).
 */
export class MergeStep extends Step<MergeStepConfig> {
  public get name() {
    return "Merge";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const graph = source as any;
    if (typeof graph.addVertex !== "function") {
      throw new Error("MERGE requires a Graph instance");
    }

    const { pattern, onCreate, onMatch } = this.config;

    for (const path of input) {
      this.traversed++;

      let currentPath = path;
      let created = false;

      if (pattern.type === "node") {
        // Try to find existing vertex matching labels + properties
        let found: Vertex<any, any> | undefined;

        const label = pattern.labels[0] || "Node";
        const resolvedProperties = this.resolveProperties(pattern.properties, context, path);

        // First, try to find via unique index (much faster for large datasets)
        const indexManager = source.indexManager;
        if (indexManager) {
          const vertices =
            pattern.labels.length > 0
              ? graph.storage.getVertices(pattern.labels)
              : graph.storage.getVertices([]);
          const existingId = indexManager.findByUniqueProperties(
            label,
            resolvedProperties,
            vertices,
          );
          if (existingId) {
            const existingVertex = graph.getVertexById(existingId);
            if (
              existingVertex &&
              this.matchesProperties(existingVertex, pattern.properties, context)
            ) {
              found = existingVertex;
            }
          }
        }

        // If not found via unique index, fall back to linear scan
        if (!found) {
          const vertices =
            pattern.labels.length > 0 ? graph.getVertices(...pattern.labels) : graph.getVertices();

          for (const vertex of vertices) {
            if (this.matchesProperties(vertex, pattern.properties, context)) {
              found = vertex;
              break;
            }
          }
        }

        if (!found) {
          // Create new vertex with resolved property values
          found = graph.addVertex(label, resolvedProperties);
          created = true;
        }

        if (pattern.variable) {
          currentPath = currentPath.with(found, [pattern.variable]);
        }
      } else if (pattern.type === "edge") {
        // Find start and end vertices
        const startPath = currentPath.get(pattern.startVariable);
        const endPath = currentPath.get(pattern.endVariable);

        if (!startPath) {
          throw new Error(`MERGE: Start variable '${pattern.startVariable}' not found`);
        }
        if (!endPath) {
          throw new Error(`MERGE: End variable '${pattern.endVariable}' not found`);
        }

        const startVertex = startPath.value as Vertex<any, any>;
        const endVertex = endPath.value as Vertex<any, any>;

        // Try to find existing edge
        // Determine source (outV) and target (inV) based on pattern direction
        // direction="out" means start -[edge]-> end, so start is source, end is target
        // direction="in" means start <-[edge]- end, so end is source, start is target
        let found: Edge<any, any> | undefined;
        const [sourceVertex, targetVertex] =
          pattern.direction === "out" ? [startVertex, endVertex] : [endVertex, startVertex];

        const resolvedEdgeProperties = this.resolveProperties(
          pattern.properties,
          context,
          currentPath,
        );

        // First, try to find via unique index (faster for large datasets)
        const indexManager = source.indexManager;
        if (indexManager && Object.keys(resolvedEdgeProperties).length > 0) {
          const edges = graph.storage.getEdges([pattern.label]);
          const existingId = indexManager.findByUniqueProperties(
            pattern.label,
            resolvedEdgeProperties,
            edges,
          );
          if (existingId) {
            const existingEdge = graph.getEdgeById(existingId);
            if (
              existingEdge &&
              existingEdge.outV.id === sourceVertex.id &&
              existingEdge.inV.id === targetVertex.id &&
              this.matchesProperties(existingEdge, pattern.properties, context)
            ) {
              found = existingEdge;
            }
          }
        }

        // If not found via unique index, fall back to linear scan
        if (!found) {
          // Get outgoing edges from the source vertex
          const outEdges = graph.getOutgoingEdges(sourceVertex.id);
          for (const edge of outEdges) {
            if (
              edge.label === pattern.label &&
              edge.inV.id === targetVertex.id &&
              this.matchesProperties(edge, pattern.properties, context)
            ) {
              found = edge;
              break;
            }
          }
        }

        if (!found) {
          // Create new edge: addEdge(source, label, target, properties)
          found = graph.addEdge(sourceVertex, pattern.label, targetVertex, resolvedEdgeProperties);
          created = true;
        }

        if (pattern.variable) {
          currentPath = currentPath.with(found, [pattern.variable]);
        }
      }

      // Apply ON CREATE or ON MATCH assignments
      const assignments = created ? onCreate : onMatch;
      if (assignments) {
        for (const assignment of assignments) {
          const elementPath = currentPath.get(assignment.variable);
          if (!elementPath) {
            throw new Error(`MERGE: Variable '${assignment.variable}' not found for assignment`);
          }
          const element = elementPath.value;
          if (element instanceof Vertex || element instanceof Edge) {
            const resolvedValue = this.resolveValue(currentPath, assignment.value, context);
            element.set(assignment.property as never, resolvedValue);
          }
        }
      }

      this.emitted++;
      yield currentPath;
    }
  }

  protected matchesProperties(
    element: Vertex<any, any> | Edge<any, any>,
    properties: Record<string, any>,
    context?: QueryContext,
  ): boolean {
    for (const [key, value] of Object.entries(properties)) {
      // Resolve parameter references before comparing
      const resolvedValue = this.resolvePropertyValue(value, context);
      if (element.get(key as never) !== resolvedValue) {
        return false;
      }
    }
    return true;
  }

  protected resolveValue(
    path: TraversalPath<any, any, any>,
    value: SetAssignmentValue,
    context?: QueryContext,
  ): any {
    if (value.type === "literal") {
      return value.value;
    } else if (value.type === "property") {
      const sourcePath = path.get(value.variable);
      if (!sourcePath) {
        throw new Error(`MERGE: Source variable '${value.variable}' not found`);
      }
      const sourceElement = sourcePath.value;
      if (sourceElement instanceof Vertex || sourceElement instanceof Edge) {
        return sourceElement.get(value.property as never);
      }
      throw new Error(`MERGE: Source variable '${value.variable}' is not a vertex or edge`);
    } else if (value.type === "variable") {
      const sourcePath = path.get(value.variable);
      if (!sourcePath) {
        throw new Error(`MERGE: Source variable '${value.variable}' not found`);
      }
      return sourcePath.value;
    } else if (value.type === "parameter") {
      const params = context?.params ?? getQueryParams();
      return params[value.name];
    } else if (value.type === "list") {
      return value.values;
    }
    return undefined;
  }

  public override clone(partial?: Partial<MergeStepConfig>) {
    return new MergeStep({
      pattern: partial?.pattern ?? { ...this.config.pattern },
      onCreate: partial?.onCreate ?? (this.config.onCreate ? [...this.config.onCreate] : undefined),
      onMatch: partial?.onMatch ?? (this.config.onMatch ? [...this.config.onMatch] : undefined),
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }
}

// WITH Step types
export type WithItemConfig =
  | {
      type: "variable";
      sourceVariable: string;
      alias: string;
    }
  | {
      type: "property";
      sourceVariable: string;
      property: string;
      alias: string;
    }
  | {
      type: "aggregate";
      function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX" | "COLLECT";
      sourceVariable: string;
      property?: string;
      alias: string;
    }
  | {
      type: "functionCall";
      functionName: string;
      args: ConditionValue[];
      distinct: boolean;
      alias: string;
    }
  | {
      type: "expression";
      value: ConditionValue;
      alias: string;
    };

export interface WithStepConfig extends StepConfig {
  /**
   * Whether to deduplicate results.
   */
  distinct: boolean;

  /**
   * The items to project.
   */
  items: readonly WithItemConfig[];

  /**
   * Optional ORDER BY within the WITH clause.
   */
  orderBy?: readonly {
    key: string;
    direction: OrderDirection;
    nulls?: NullsOrdering;
  }[];

  /**
   * Optional SKIP offset.
   */
  skip?: number;

  /**
   * Optional LIMIT count.
   */
  limit?: number;

  /**
   * Optional WHERE condition to filter results.
   */
  whereCondition?: Condition;
}

/**
 * WITH clause step - projects variables and optionally applies filtering/ordering.
 * Creates a new path scope with the projected variables as the new bindings.
 */
export class WithStep extends Step<WithStepConfig> {
  public get name() {
    return "With";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { distinct, items, orderBy, skip, limit, whereCondition } = this.config;

    // Collect all input paths for potential aggregation
    const paths = [...input];
    this.traversed += paths.length;

    // Check if we have any aggregate items
    const hasAggregate = items.some((item) => item.type === "aggregate");

    // Get non-aggregate items for grouping
    const nonAggregateItems = items.filter((item) => item.type !== "aggregate");

    let results: TraversalPath<any, any, any>[];

    if (hasAggregate) {
      if (nonAggregateItems.length > 0) {
        // Grouped aggregation mode: group by non-aggregate items, compute aggregates per group
        // This implements Cypher semantics: WITH n.name AS name, collect(n) AS nodes
        // groups results by name and collects nodes within each group
        const groups = new Map<string, TraversalPath<any, any, any>[]>();

        for (const path of paths) {
          // Compute group key from non-aggregate items
          const keyParts: string[] = [];
          for (const item of nonAggregateItems) {
            let value: any;
            switch (item.type) {
              case "variable": {
                const pathNode = path.get(item.sourceVariable);
                value = pathNode?.value ?? null;
                break;
              }
              case "property": {
                const pathNode = path.get(item.sourceVariable);
                value = pathNode?.property(item.property as never) ?? null;
                break;
              }
              case "functionCall": {
                const resolvedArgs = item.args.map((arg) =>
                  resolveConditionValue(path, arg, context),
                );
                value = evaluateFunction(item.functionName, resolvedArgs, path, item.distinct);
                break;
              }
            }
            if (value && typeof value === "object" && "id" in value) {
              keyParts.push(String(value.id));
            } else {
              keyParts.push(JSON.stringify(value));
            }
          }
          const groupKey = keyParts.join("|");

          if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
          }
          groups.get(groupKey)!.push(path);
        }

        // Compute aggregates for each group
        results = [];
        for (const [_groupKey, groupPaths] of groups) {
          const aggregateResult = this.computeAggregates(groupPaths, items, context);
          let newPath: TraversalPath<any, any, any> = new TraversalPath(
            undefined,
            aggregateResult.firstValue,
            [],
          );
          for (const [alias, value] of aggregateResult.bindings) {
            newPath = newPath.with(value, [alias]);
          }
          results.push(newPath);
        }
      } else {
        // Pure aggregation mode: aggregate across all paths, produce single result
        const aggregateResult = this.computeAggregates(paths, items, context);
        // Create a single new path with aggregate results
        let newPath: TraversalPath<any, any, any> = new TraversalPath(
          undefined,
          aggregateResult.firstValue,
          [],
        );
        for (const [alias, value] of aggregateResult.bindings) {
          newPath = newPath.with(value, [alias]);
        }
        results = [newPath];
      }
    } else {
      // Projection mode: transform each path
      results = [];
      for (const path of paths) {
        const projected = this.projectPath(path, items, context);
        if (projected) {
          results.push(projected);
        }
      }
    }

    // Apply WHERE filtering if present
    if (whereCondition) {
      results = results.filter((path) => evaluateCondition(path, whereCondition, context));
    }

    // Apply DISTINCT if requested
    if (distinct) {
      const seen = new Set<string>();
      results = results.filter((path) => {
        const key = this.getPathKey(path, items);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Apply ORDER BY if present
    if (orderBy && orderBy.length > 0) {
      results.sort((a, b) => {
        for (const { key, direction, nulls } of orderBy) {
          // First try to get the value as a bound variable (for aliases like `WITH a.num AS val`)
          // then fall back to property access (for expressions like `ORDER BY a.num`)
          const aNode = a.get(key);
          const bNode = b.get(key);
          const aValue = aNode !== undefined ? aNode.value : a.property(key as never);
          const bValue = bNode !== undefined ? bNode.value : b.property(key as never);

          const aIsNull = aValue === null || aValue === undefined;
          const bIsNull = bValue === null || bValue === undefined;

          if (aIsNull && bIsNull) continue;

          if (aIsNull || bIsNull) {
            const effectiveNulls = nulls ?? (direction === "asc" ? "last" : "first");
            if (aIsNull) return effectiveNulls === "first" ? -1 : 1;
            return effectiveNulls === "first" ? 1 : -1;
          }

          const result = compare(aValue, bValue);
          if (result !== 0) {
            return direction === "asc" ? result : -result;
          }
        }
        return 0;
      });
    }

    // Apply SKIP
    const startIndex = skip ?? 0;
    const endIndex = limit !== undefined ? startIndex + limit : results.length;

    // Yield results
    for (let i = startIndex; i < endIndex && i < results.length; i++) {
      this.emitted++;
      yield results[i]!;
    }
  }

  protected projectPath(
    path: TraversalPath<any, any, any>,
    items: readonly WithItemConfig[],
    context?: QueryContext,
  ): TraversalPath<any, any, any> | undefined {
    // Start a new path with the first item's value
    let newPath: TraversalPath<any, any, any> | undefined;

    for (const item of items) {
      let value: any;

      switch (item.type) {
        case "variable": {
          const pathNode = path.get(item.sourceVariable);
          if (!pathNode) return undefined; // Variable not found
          value = pathNode.value;
          break;
        }
        case "property": {
          const pathNode = path.get(item.sourceVariable);
          if (!pathNode) return undefined;
          value = pathNode.property(item.property as never);
          break;
        }
        case "aggregate":
          // Aggregates are handled separately in computeAggregates
          continue;
        case "functionCall": {
          // Evaluate function call
          const resolvedArgs = item.args.map((arg) => resolveConditionValue(path, arg, context));
          value = evaluateFunction(item.functionName, resolvedArgs, path, item.distinct);
          break;
        }
        case "expression": {
          // Evaluate arbitrary expression (e.g., list literals)
          value = resolveConditionValue(path, item.value, context);
          break;
        }
      }

      if (!newPath) {
        newPath = new TraversalPath(undefined, value, [item.alias]);
      } else {
        newPath = newPath.with(value, [item.alias]);
      }
    }

    return newPath;
  }

  protected computeAggregates(
    paths: readonly TraversalPath<any, any, any>[],
    items: readonly WithItemConfig[],
    context?: QueryContext,
  ): { firstValue: any; bindings: [string, any][] } {
    const bindings: [string, any][] = [];
    let firstValue: any = null;
    let isFirst = true;

    for (const item of items) {
      let value: any;

      switch (item.type) {
        case "variable": {
          // For non-aggregate items in an aggregate context, use the first path's value
          const pathNode = paths[0]?.get(item.sourceVariable);
          value = pathNode?.value ?? null;
          break;
        }
        case "property": {
          const pathNode = paths[0]?.get(item.sourceVariable);
          value = pathNode?.property(item.property as never) ?? null;
          break;
        }
        case "aggregate": {
          value = this.computeSingleAggregate(paths, item);
          break;
        }
        case "functionCall": {
          // Evaluate function call using first path
          const firstPath = paths[0];
          if (firstPath) {
            const resolvedArgs = item.args.map((arg) =>
              resolveConditionValue(firstPath, arg, context),
            );
            value = evaluateFunction(item.functionName, resolvedArgs, firstPath, item.distinct);
          } else {
            value = null;
          }
          break;
        }
        case "expression": {
          // Evaluate arbitrary expression using first path
          const firstPath = paths[0];
          value = firstPath ? resolveConditionValue(firstPath, item.value, context) : null;
          break;
        }
      }

      if (isFirst) {
        firstValue = value;
        isFirst = false;
      }
      bindings.push([item.alias, value]);
    }

    return { firstValue, bindings };
  }

  protected computeSingleAggregate(
    paths: readonly TraversalPath<any, any, any>[],
    item: Extract<WithItemConfig, { type: "aggregate" }>,
  ): any {
    switch (item.function) {
      case "COUNT":
        return paths.length;

      case "COLLECT": {
        const collected: any[] = [];
        for (const path of paths) {
          const pathNode = path.get(item.sourceVariable);
          if (pathNode) {
            collected.push(pathNode.value);
          }
        }
        return collected;
      }

      case "SUM": {
        if (!item.property) throw new Error("SUM requires a property");
        let sum = 0;
        for (const path of paths) {
          const pathNode = path.get(item.sourceVariable);
          if (pathNode) {
            const val = pathNode.property(item.property as never);
            if (typeof val === "number") sum += val;
          }
        }
        return sum;
      }

      case "AVG": {
        if (!item.property) throw new Error("AVG requires a property");
        let sum = 0;
        let count = 0;
        for (const path of paths) {
          const pathNode = path.get(item.sourceVariable);
          if (pathNode) {
            const val = pathNode.property(item.property as never);
            if (typeof val === "number") {
              sum += val;
              count++;
            }
          }
        }
        return count > 0 ? sum / count : null;
      }

      case "MIN": {
        if (!item.property) throw new Error("MIN requires a property");
        let min: number | null = null;
        for (const path of paths) {
          const pathNode = path.get(item.sourceVariable);
          if (pathNode) {
            const val = pathNode.property(item.property as never);
            if (typeof val === "number") {
              if (min === null || val < min) min = val;
            }
          }
        }
        return min;
      }

      case "MAX": {
        if (!item.property) throw new Error("MAX requires a property");
        let max: number | null = null;
        for (const path of paths) {
          const pathNode = path.get(item.sourceVariable);
          if (pathNode) {
            const val = pathNode.property(item.property as never);
            if (typeof val === "number") {
              if (max === null || val > max) max = val;
            }
          }
        }
        return max;
      }

      default:
        throw new Error(`Unknown aggregate function: ${item.function}`);
    }
  }

  protected getPathKey(
    path: TraversalPath<any, any, any>,
    items: readonly WithItemConfig[],
  ): string {
    const parts: string[] = [];
    for (const item of items) {
      const pathNode = path.get(item.alias);
      if (pathNode) {
        const val = pathNode.value;
        if (val && typeof val === "object" && "id" in val) {
          parts.push(String(val.id));
        } else {
          parts.push(JSON.stringify(val));
        }
      } else {
        parts.push("undefined");
      }
    }
    return parts.join("|");
  }

  public override clone(partial?: Partial<WithStepConfig>) {
    return new WithStep({
      distinct: partial?.distinct ?? this.config.distinct,
      items: partial?.items ?? [...this.config.items],
      orderBy: partial?.orderBy ?? (this.config.orderBy ? [...this.config.orderBy] : undefined),
      skip: partial?.skip ?? this.config.skip,
      limit: partial?.limit ?? this.config.limit,
      whereCondition: partial?.whereCondition ?? this.config.whereCondition,
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }

  public override toStringTokens(): StepStringToken[] {
    const tokens: StepStringToken[] = [{ kind: "start" }, { kind: "name", value: this.name }];

    if (this.config.distinct) {
      tokens.push({ kind: "keyword", value: "DISTINCT" });
    }

    const itemsStr = this.config.items
      .map((item) => {
        if (item.type === "aggregate") {
          return `${item.function}(${item.sourceVariable}${item.property ? "." + item.property : ""}) AS ${item.alias}`;
        } else if (item.type === "property") {
          return `${item.sourceVariable}.${item.property} AS ${item.alias}`;
        } else if (item.type === "functionCall") {
          return `${item.functionName}(...) AS ${item.alias}`;
        } else if (item.type === "expression") {
          return `(expr) AS ${item.alias}`;
        } else {
          return item.sourceVariable === item.alias
            ? item.alias
            : `${item.sourceVariable} AS ${item.alias}`;
        }
      })
      .join(", ");
    tokens.push({ kind: "value", value: itemsStr });

    tokens.push({ kind: "end" });
    return tokens;
  }
}

/**
 * Expression type for UNWIND - can be a literal list, null, property access, variable reference, parameter, function call, or general expression.
 */
export type UnwindExpression =
  | { type: "literal"; values: readonly unknown[] }
  | { type: "null" }
  | { type: "property"; variable: string; property: string }
  | { type: "variable"; variable: string }
  | { type: "parameter"; name: string }
  | {
      type: "function";
      name: string;
      args: readonly ConditionValue[];
      distinct: boolean;
    }
  | { type: "expression"; value: ConditionValue };

export interface UnwindStepConfig extends StepConfig {
  /**
   * The expression to unwind (a list).
   */
  expression: UnwindExpression;

  /**
   * The variable name to bind each unwound element to.
   */
  alias: string;
}

/**
 * UNWIND clause step - expands a list into individual rows.
 * For each element in the list, a new path is created with the element bound to the alias.
 *
 * Unlike FOREACH (which is for side-effects), UNWIND is a projection that multiplies rows:
 * - Input: 1 path with a list of 3 elements
 * - Output: 3 paths, each with one element bound to the alias
 *
 * Syntax: UNWIND [1, 2, 3] AS x
 *         UNWIND p.items AS item
 *         UNWIND $list AS elem
 */
export class UnwindStep extends Step<UnwindStepConfig> {
  public get name() {
    return "Unwind";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { expression, alias } = this.config;

    for (const path of input) {
      this.traversed++;

      // Get the list to unwind
      const listValue = this.resolveListExpression(path, expression, context);

      // If the expression is null/undefined or not an array, yield nothing (standard Cypher behavior)
      if (!Array.isArray(listValue)) {
        continue;
      }

      // If the list is empty, yield nothing
      if (listValue.length === 0) {
        continue;
      }

      // For each element, create a new path with the element bound to the alias
      for (const element of listValue) {
        // Create a new path that extends the input path with the unwound element
        const newPath = path.with(element, [alias]);
        this.emitted++;
        yield newPath;
      }
    }
  }

  protected resolveListExpression(
    path: TraversalPath<any, any, any>,
    expression: UnwindExpression,
    context?: QueryContext,
  ): unknown {
    switch (expression.type) {
      case "literal":
        return expression.values;

      case "null":
        // UNWIND null → yields nothing (handled by caller checking for non-array)
        return null;

      case "property": {
        const variablePath = path.get(expression.variable);
        if (!variablePath) return undefined;
        const element = variablePath.value;
        if (element instanceof Vertex || element instanceof Edge) {
          return element.get(expression.property as never);
        }
        // If it's a plain object (e.g., from WITH clause projection)
        if (typeof element === "object" && element !== null) {
          return (element as Record<string, unknown>)[expression.property];
        }
        return undefined;
      }

      case "variable": {
        const variablePath = path.get(expression.variable);
        if (!variablePath) return undefined;
        return variablePath.value;
      }

      case "parameter": {
        const params = context?.params ?? getQueryParams();
        return params[expression.name];
      }

      case "function": {
        // Evaluate function call (e.g., range(), reverse())
        const resolvedArgs = expression.args.map((arg) =>
          resolveConditionValue(path, arg, context),
        );
        return evaluateFunction(expression.name, resolvedArgs, path, expression.distinct);
      }

      case "expression":
        // Evaluate arbitrary expression (e.g., list concatenation like (first + second))
        return resolveConditionValue(path, expression.value, context);

      default:
        return undefined;
    }
  }

  public clone(partial?: Partial<UnwindStepConfig>): UnwindStep {
    return new UnwindStep({
      expression: partial?.expression ?? this.config.expression,
      alias: partial?.alias ?? this.config.alias,
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }

  public override toStringTokens(): StepStringToken[] {
    const tokens: StepStringToken[] = [{ kind: "start" }, { kind: "name", value: this.name }];

    let exprStr: string;
    switch (this.config.expression.type) {
      case "literal":
        exprStr = JSON.stringify(this.config.expression.values);
        break;
      case "null":
        exprStr = "null";
        break;
      case "property":
        exprStr = `${this.config.expression.variable}.${this.config.expression.property}`;
        break;
      case "variable":
        exprStr = this.config.expression.variable;
        break;
      case "parameter":
        exprStr = `$${this.config.expression.name}`;
        break;
      case "function":
        exprStr = `${this.config.expression.name}(...)`;
        break;
      case "expression":
        exprStr = "(expression)";
        break;
    }

    tokens.push({ kind: "value", value: `${exprStr} AS ${this.config.alias}` });
    tokens.push({ kind: "end" });
    return tokens;
  }
}

// ============================================================================
// CALL Step - invokes a procedure
// ============================================================================

/**
 * Yield item configuration for procedure calls.
 */
export interface YieldItemConfig {
  /** The column name to yield from the procedure result */
  name: string;
  /** Optional alias for the yielded column */
  alias?: string;
}

/**
 * Configuration for CallStep.
 */
export interface CallStepConfig extends StepConfig {
  /** The procedure name (may include namespace like db.labels) */
  procedureName: string;
  /** Arguments to pass to the procedure (as condition values to resolve) */
  arguments: readonly ConditionValue[];
  /** Optional YIELD items for specifying which columns to return */
  yieldItems?: readonly YieldItemConfig[];
}

/**
 * CALL clause step - invokes a procedure and yields results.
 *
 * Procedures are standalone operations that can return multiple rows.
 * Unlike functions, procedures are invoked with CALL and can perform
 * side effects.
 *
 * Syntax: CALL procedure.name(args) YIELD column [AS alias], ...
 */
export class CallStep extends Step<CallStepConfig> {
  public get name() {
    return "Call";
  }

  public *traverse(
    source: GraphSource<any>,
    input: Iterable<TraversalPath<any, any, any>>,
    _context?: QueryContext,
  ): IterableIterator<TraversalPath<any, any, any>> {
    const { procedureName, arguments: args, yieldItems } = this.config;

    for (const path of input) {
      this.traversed++;

      // Resolve arguments
      const resolvedArgs = args.map((arg) => resolveConditionValue(path, arg));

      // Create procedure context - pass source as graph (it implements GraphSource)
      const context = {
        graph: source,
        path,
        functionRegistry,
      };

      // Invoke the procedure
      const results = procedureRegistry.invoke(procedureName, resolvedArgs, context);

      for (const record of results) {
        // If no YIELD specified, bind all columns from the result
        if (!yieldItems || yieldItems.length === 0) {
          // For standalone CALL without YIELD, just pass through the path
          this.emitted++;
          yield path;
          // Only yield one row per input for standalone calls
          break;
        }

        // Create a new path with yielded columns bound
        let newPath = path;
        for (const item of yieldItems) {
          const value = record[item.name];
          const bindName = item.alias ?? item.name;
          newPath = newPath.with(value, [bindName]);
        }
        this.emitted++;
        yield newPath;
      }
    }
  }

  public clone(partial?: Partial<CallStepConfig>): CallStep {
    return new CallStep({
      procedureName: partial?.procedureName ?? this.config.procedureName,
      arguments: partial?.arguments ?? [...this.config.arguments],
      yieldItems:
        partial?.yieldItems ?? (this.config.yieldItems ? [...this.config.yieldItems] : undefined),
      stepLabels:
        partial?.stepLabels ?? (this.config.stepLabels ? [...this.config.stepLabels] : undefined),
    });
  }

  public override toStringTokens(): StepStringToken[] {
    const tokens: StepStringToken[] = [{ kind: "start" }, { kind: "name", value: this.name }];

    // Build procedure call string
    let callStr = `${this.config.procedureName}(`;
    callStr += this.config.arguments.map((arg) => stringifyConditionValueRef(arg)).join(", ");
    callStr += ")";

    if (this.config.yieldItems && this.config.yieldItems.length > 0) {
      callStr += " YIELD ";
      callStr += this.config.yieldItems
        .map((item) => (item.alias ? `${item.name} AS ${item.alias}` : item.name))
        .join(", ");
    }

    tokens.push({ kind: "value", value: callStr });
    tokens.push({ kind: "end" });
    return tokens;
  }
}

const KnownSteps = {
  FetchEdges: FetchEdgesStep,
  FetchVertices: FetchVerticesStep,
  Edge: EdgeStep,
  Vertex: VertexStep,
  Values: ValuesStep,
  Labels: LabelsStep,
  Intersect: IntersectStep,
  OptionalMatch: OptionalMatchStep,
  Select: SelectStep,
  Unfold: UnfoldStep,
  Repeat: RepeatStep,
  Dedup: DedupStep,
  With: WithStep,
  Unwind: UnwindStep,
  Call: CallStep,
  MapElements: MapElementsStep,
  Range: RangeStep,
  Order: OrderStep,
  FilterElements: FilterElementsStep,
  Union: UnionStep,
  Count: CountStep,
  Sum: SumStep,
  Avg: AvgStep,
  Min: MinStep,
  Max: MaxStep,
  Collect: CollectStep,
  ShortestPath: ShortestPathStep,
  Foreach: ForeachStep,
  Set: SetStep,
  Create: CreateStep,
  Delete: DeleteStep,
  Remove: RemoveStep,
  Merge: MergeStep,
} as const;

export type KnownSteps =
  | FetchEdgesStep
  | FetchVerticesStep
  | EdgeStep
  | VertexStep
  | ValuesStep
  | LabelsStep
  | IntersectStep<any>
  | OptionalMatchStep<any>
  | QueryUnionStep
  | SelectStep
  | UnfoldStep
  | RepeatStep<any>
  | DedupStep
  | MapElementsStep<any>
  | RangeStep
  | OrderStep
  | SumStep
  | AvgStep
  | MinStep
  | MaxStep
  | CollectStep
  | ShortestPathStep
  | ForeachStep<any>
  | SetStep
  | CreateStep
  | DeleteStep
  | RemoveStep
  | MergeStep
  | WithStep
  | UnwindStep
  | CallStep;

export type StepJSON = [string, StepConfig, any[]?];

export function createStepsFromJSON(input: readonly StepJSON[]): readonly Step<any>[] {
  return input.map(([name, config, steps]) => {
    const StepClass = KnownSteps[name as keyof typeof KnownSteps] as unknown as new (
      config: StepConfig,
      steps?: readonly Step<any>[],
    ) => Step<any>;
    if (StepClass === undefined) {
      throw new Error(`Unknown step: ${name}`);
    }
    if (Array.isArray(steps)) {
      return new StepClass(config, createStepsFromJSON(steps));
    }
    return new StepClass(config);
  });
}
