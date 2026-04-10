import type {
  Query,
  QuerySegment,
  UnionQuery,
  MultiStatement,
  Pattern,
  NodePattern,
  EdgePattern,
  Condition,
  PropertyCondition,
  ExistsCondition,
  AndCondition,
  OrCondition,
  XorCondition,
  NotCondition,
  InCondition,
  IsNullCondition,
  RegexCondition,
  StringPredicateCondition,
  ExpressionCondition as ASTExpressionCondition,
  Quantifier,
  WhereClause,
  ShortestPathPattern,
  SetClause,
  SetValue,
  SetAllProperties,
  SetAddProperties,
  ForeachClause,
  SetOperation as ASTSetOperation,
  DeleteOperation as ASTDeleteOperation,
  ListExpression,
  MatchClause,
  CreateClause,
  CreateChainPattern,
  CreateNodePattern,
  CreateVariableRef,
  CreateEdgePattern,
  DeleteClause,
  RemoveClause,
  MergeClause,
  MergeRelationshipPattern,
  MultiPattern,
  WithClause,
  WithItem,
  UnwindClause,
  UnwindExpression as ASTUnwindExpression,
  CallClause,
  YieldItem,
  LabelExpression,
  ParenthesizedPathPattern,
  FunctionCall,
  OrderItem,
  ReturnClause,
} from "./AST.js";
import {
  Step,
  FetchVerticesStep,
  VertexStep,
  EdgeStep,
  FilterElementsStep,
  RangeStep,
  OrderStep,
  CountStep,
  MultiQueryStep,
  SumStep,
  AvgStep,
  MinStep,
  MaxStep,
  CollectStep,
  DedupStep,
  RepeatStep,
  ValuesStep,
  PropertyValuesStep,
  LabelsStep,
  ShortestPathStep,
  SetStep,
  ForeachStep,
  CreateStep,
  DeleteStep,
  RemoveStep,
  MergeStep,
  StartStep,
  DrainStep,
  CartesianFetchStep,
  WithStep,
  UnwindStep,
  CallStep,
  QueryUnionStep,
  GroupByStep,
  type Condition as StepCondition,
  type ConditionValue,
  type YieldItemConfig,
  type BinaryOperator,
  type OrderDirection,
  type SetAssignmentValue,
  type SetOperation as StepSetOperation,
  type ForeachListExpression,
  type CreateEdgeConfig,
  type CreateVertexConfig,
  type RemoveStepItem,
  type MergePatternConfig,
  type WithItemConfig,
  type UnwindExpression as StepUnwindExpression,
  SelectStep,
  OptionalMatchStep,
  ExpressionReturnStep,
  BindPathStep,
  type ExpressionReturnItem,
} from "./Steps.js";
import { functionArgExpectsPath } from "./FunctionRegistry.js";

/**
 * Convert a parsed query AST into an array of Step instances
 * that can be executed against the graph database.
 *
 * Clause Ordering: When segments are present, clauses are processed in segment order
 * to support flexible query patterns like: MATCH...CREATE...WITH...MATCH...CREATE...
 *
 * For backward compatibility with flat queries (no segments), the traditional order is:
 *   1. MATCH - pattern matching
 *   2. FOREACH - iteration with nested mutations
 *   3. MERGE - upsert operations (before CREATE to allow MERGE to establish nodes)
 *   4. CREATE - create new vertices/edges
 *   5. SET - update properties
 *   6. REMOVE - remove properties
 *   7. DELETE - remove vertices/edges
 *   8. ORDER BY - sort results
 *   9. SKIP/LIMIT - pagination
 *   10. RETURN - project results
 *
 * This ensures predictable mutation ordering (e.g., MERGE before CREATE, SET before DELETE).
 */
export function astToSteps(query: Query): readonly Step<any>[] {
  const steps: Step<any>[] = [];

  // Validation: ORDER BY, SKIP, and LIMIT require a RETURN clause
  if (!query.return && (query.orderBy || query.skip !== undefined || query.limit !== undefined)) {
    throw new Error("ORDER BY, SKIP, and LIMIT require a RETURN clause");
  }

  // If we have segments, process them in order for proper execution sequencing
  if (query.segments && query.segments.length > 0) {
    processQuerySegments(query.segments, steps);
  } else if (query.return) {
    // RETURN-only query (no segments): add StartStep to provide initial path
    steps.push(new StartStep({}));
  } else {
    // Backward compatibility: use flat structure
    processLegacyQuery(query, steps);
  }

  // Handle ORDER BY
  if (query.orderBy) {
    // Build alias map from RETURN items for alias resolution
    const aliasMap = buildReturnAliasMap(query.return);
    const directions = query.orderBy.orders.map(
      (order) => resolveOrderItem(order, aliasMap, false), // false = use source property/variable for RETURN ORDER BY
    );
    steps.push(new OrderStep({ directions }));
  }

  // Handle SKIP and LIMIT with RangeStep
  if (query.skip !== undefined || query.limit !== undefined) {
    const start = query.skip ?? 0;
    const end = query.limit !== undefined ? start + query.limit : Number.MAX_SAFE_INTEGER;
    steps.push(new RangeStep({ start, end }));
  }

  // Handle RETURN clause
  const returnSteps = convertReturnClause(query);
  steps.push(...returnSteps);

  return steps;
}

/**
 * Process query segments in order for flexible clause ordering.
 * Each segment can contain MATCH, mutations, and a WITH clause that transitions to the next segment.
 */
function processQuerySegments(segments: QuerySegment[], steps: Step<any>[]): void {
  let isFirstSegment = true;
  let hasSeenNonOptionalMatch = false;
  let hasSeenWithClause = false;

  for (const segment of segments) {
    // Check if this segment has any content (MATCH, mutations, or list operations)
    const hasMatches = segment.matches && segment.matches.length > 0;
    const hasMutations = segment.mutations && segment.mutations.length > 0;
    const hasUnwind = segment.unwind && segment.unwind.length > 0;
    const hasCall = segment.call && segment.call.length > 0;
    const hasForeach = segment.foreach && segment.foreach.length > 0;
    const hasSet = segment.set;
    const hasRemove = segment.remove;
    const hasDelete = segment.delete;
    const hasWithClause = segment.with && segment.with.length > 0;

    const hasContent =
      hasMatches ||
      hasMutations ||
      hasUnwind ||
      hasCall ||
      hasForeach ||
      hasSet ||
      hasRemove ||
      hasDelete ||
      hasWithClause;

    // Check if the first MATCH in this segment is OPTIONAL
    const firstMatchIsOptional = hasMatches && segment.matches![0]!.optional === true;

    // For the first segment with no MATCH but mutations/list ops/WITH, add StartStep
    // Also add StartStep if the first MATCH is OPTIONAL (needs input path for null bindings)
    if (isFirstSegment && ((!hasMatches && hasContent) || firstMatchIsOptional)) {
      steps.push(new StartStep({}));
    }
    isFirstSegment = false;

    // Process MATCH clauses for this segment
    if (hasMatches) {
      for (const matchClause of segment.matches!) {
        let patternSteps: Step<any>[];

        if (matchClause.pattern.type === "ShortestPathPattern") {
          patternSteps = convertShortestPathPattern(
            matchClause.pattern as ShortestPathPattern,
            matchClause.where,
          );
        } else if (matchClause.pattern.type === "MultiPattern") {
          patternSteps = convertMultiPattern(
            matchClause.pattern as MultiPattern,
            matchClause.where,
            hasSeenWithClause, // Preserve bindings from prior WITH clause
          );
        } else {
          // After a WITH clause or non-optional MATCH, MATCH can reference variables
          const isAnchoredContext = matchClause.optional && hasSeenNonOptionalMatch;
          patternSteps = convertPattern(
            matchClause.pattern as Pattern,
            matchClause.where,
            isAnchoredContext,
            hasSeenWithClause, // Preserve bindings from prior WITH clause
          );
        }

        if (matchClause.optional) {
          // skipAnchor: Only skip anchor if there was a previous non-optional MATCH
          const skipAnchor = hasSeenNonOptionalMatch;
          const variables = extractPatternVariables(matchClause.pattern, skipAnchor);
          steps.push(new OptionalMatchStep({ variables }, patternSteps as Step<any>[]));
        } else {
          steps.push(...patternSteps);
          hasSeenNonOptionalMatch = true;
        }
      }
    }

    // Process UNWIND clauses
    if (hasUnwind) {
      for (const unwindClause of segment.unwind!) {
        const unwindStep = convertUnwindClause(unwindClause);
        steps.push(unwindStep);
      }
    }

    // Process CALL clauses
    if (hasCall) {
      for (const callClause of segment.call!) {
        const callStep = convertCallClause(callClause);
        steps.push(callStep);
      }
    }

    // Process FOREACH clauses
    if (hasForeach) {
      for (const foreachClause of segment.foreach!) {
        const foreachStep = convertForeachClause(foreachClause);
        steps.push(foreachStep);
      }
    }

    // Process mutations (MERGE and CREATE) in their original order
    if (hasMutations) {
      for (const mutation of segment.mutations!) {
        if (mutation.type === "MergeClause") {
          const mergeStep = convertMergeClause(mutation);
          steps.push(mergeStep);
        } else if (mutation.type === "CreateClause") {
          const createStep = convertCreateClause(mutation);
          steps.push(createStep);
        }
      }
    }

    // Process SET clause
    if (hasSet) {
      const setStep = convertSetClause(segment.set!);
      steps.push(setStep);
    }

    // Process REMOVE clause
    if (hasRemove) {
      const removeStep = convertRemoveClause(segment.remove!);
      steps.push(removeStep);
    }

    // Process DELETE clause
    if (hasDelete) {
      const deleteStep = convertDeleteClause(segment.delete!);
      steps.push(deleteStep);
    }

    // Process WITH clause (transitions to next segment)
    if (hasWithClause) {
      for (const withClause of segment.with!) {
        const withStep = convertWithClause(withClause);
        steps.push(withStep);
      }
      hasSeenWithClause = true;
    }
  }
}

/**
 * Process a query using the legacy flat structure (backward compatibility).
 */
function processLegacyQuery(query: Query, steps: Step<any>[]): void {
  // 1. Convert MATCH clauses patterns to steps
  // Process regular MATCH clauses first, then OPTIONAL MATCH clauses
  // If the first MATCH is OPTIONAL, we need a StartStep to provide an initial path
  // so that OptionalMatchStep has an input to extend with null bindings
  const firstMatchIsOptional = query.matches.length > 0 && query.matches[0]!.optional;
  if (firstMatchIsOptional) {
    steps.push(new StartStep({}));
  }

  let hasSeenPreviousMatch = false;
  for (const matchClause of query.matches) {
    // Convert the pattern to steps
    let patternSteps: Step<any>[];

    if (matchClause.pattern.type === "ShortestPathPattern") {
      patternSteps = convertShortestPathPattern(
        matchClause.pattern as ShortestPathPattern,
        matchClause.where,
      );
    } else if (matchClause.pattern.type === "MultiPattern") {
      // Handle comma-separated patterns like MATCH (a), (b)
      patternSteps = convertMultiPattern(matchClause.pattern as MultiPattern, matchClause.where);
    } else {
      // For OPTIONAL MATCH after a previous MATCH, the first node may reference
      // a previously bound variable. We enable anchor detection (anchoredToInput: true)
      // when there are previous steps in the query that may have bound variables.
      // The anchor heuristic will only trigger if the first node has no labels.
      const isAnchoredContext = matchClause.optional && hasSeenPreviousMatch;
      patternSteps = convertPattern(
        matchClause.pattern as Pattern,
        matchClause.where,
        isAnchoredContext,
      );
    }

    if (matchClause.optional) {
      // Wrap in OptionalMatchStep for OPTIONAL MATCH
      // skipAnchor: Only skip anchor if there was a previous MATCH that bound variables
      const skipAnchor = hasSeenPreviousMatch;
      const variables = extractPatternVariables(matchClause.pattern, skipAnchor);
      steps.push(new OptionalMatchStep({ variables }, patternSteps as Step<any>[]));
    } else {
      steps.push(...patternSteps);
    }
    hasSeenPreviousMatch = true;
  }

  // 1b. If no MATCH clauses but there are mutations or list operations, add a StartStep
  // to provide an initial empty path for CREATE/MERGE/UNWIND to work with
  const hasMutations =
    (query.merge && query.merge.length > 0) ||
    query.create ||
    query.set ||
    query.remove ||
    query.delete ||
    (query.foreach && query.foreach.length > 0);

  const hasListOperations =
    (query.unwind && query.unwind.length > 0) ||
    (query.with && query.with.length > 0) ||
    (query.call && query.call.length > 0);

  if (query.matches.length === 0 && (hasMutations || hasListOperations)) {
    steps.push(new StartStep({}));
  }

  // 1c. Handle WITH clauses (intermediate projections)
  if (query.with && query.with.length > 0) {
    for (const withClause of query.with) {
      const withStep = convertWithClause(withClause);
      steps.push(withStep);
    }
  }

  // 1d. Handle UNWIND clauses (list expansion)
  if (query.unwind && query.unwind.length > 0) {
    for (const unwindClause of query.unwind) {
      const unwindStep = convertUnwindClause(unwindClause);
      steps.push(unwindStep);
    }
  }

  // 1e. Handle CALL clauses (procedure invocation)
  if (query.call && query.call.length > 0) {
    for (const callClause of query.call) {
      const callStep = convertCallClause(callClause);
      steps.push(callStep);
    }
  }

  // 2. Handle FOREACH clauses
  if (query.foreach && query.foreach.length > 0) {
    for (const foreachClause of query.foreach) {
      const foreachStep = convertForeachClause(foreachClause);
      steps.push(foreachStep);
    }
  }

  // 3. Handle mutations (MERGE and CREATE) in their original order
  // Use the mutations array if available (preserves original order),
  // otherwise fall back to separate merge/create fields for backwards compatibility
  if (query.mutations && query.mutations.length > 0) {
    for (const mutation of query.mutations) {
      if (mutation.type === "MergeClause") {
        const mergeStep = convertMergeClause(mutation);
        steps.push(mergeStep);
      } else if (mutation.type === "CreateClause") {
        const createStep = convertCreateClause(mutation);
        steps.push(createStep);
      }
    }
  } else {
    // Backwards compatibility: process merge then create
    if (query.merge && query.merge.length > 0) {
      for (const mergeClause of query.merge) {
        const mergeStep = convertMergeClause(mergeClause);
        steps.push(mergeStep);
      }
    }
    if (query.create) {
      const createStep = convertCreateClause(query.create);
      steps.push(createStep);
    }
  }

  // 5. Handle SET clause (mutations)
  if (query.set) {
    const setStep = convertSetClause(query.set);
    steps.push(setStep);
  }

  // 6. Handle REMOVE clause
  if (query.remove) {
    const removeStep = convertRemoveClause(query.remove);
    steps.push(removeStep);
  }

  // 7. Handle DELETE clause
  if (query.delete) {
    const deleteStep = convertDeleteClause(query.delete);
    steps.push(deleteStep);
  }
}

/**
 * Convert a UNION query AST into a single QueryUnionStep that combines
 * multiple query branches.
 *
 * @param unionQuery The UnionQuery AST node containing multiple queries.
 * @returns A single-element array containing the QueryUnionStep.
 */
export function unionAstToSteps(unionQuery: UnionQuery): readonly Step<any>[] {
  // Convert each query in the union to its own step pipeline
  const branches = unionQuery.queries.map((query) => astToSteps(query));

  // Create a QueryUnionStep that combines all branches
  return [new QueryUnionStep({ all: unionQuery.all }, branches as Step<any>[][])];
}

/**
 * Convert any parsed AST (Query, UnionQuery, or MultiStatement) to steps.
 * This is the main entry point for handling all query types.
 */
export function anyAstToSteps(ast: Query | UnionQuery | MultiStatement): readonly Step<any>[] {
  if (ast.type === "MultiStatement") {
    return multiStatementToSteps(ast);
  }
  if (ast.type === "UnionQuery") {
    return unionAstToSteps(ast);
  }
  return astToSteps(ast);
}

/**
 * Convert a multi-statement query AST into a single MultiQueryStep that executes
 * each statement sequentially.
 *
 * @param multiStatement The MultiStatement AST node containing multiple statements.
 * @returns A single-element array containing the MultiQueryStep.
 */
export function multiStatementToSteps(multiStatement: MultiStatement): readonly Step<any>[] {
  // Convert each statement to its own step pipeline
  const statements = multiStatement.statements.map((stmt) => {
    if (stmt.type === "UnionQuery") {
      return unionAstToSteps(stmt);
    }
    return astToSteps(stmt);
  });

  // Create a MultiQueryStep that executes all statements
  return [new MultiQueryStep({}, statements as Step<any>[][])];
}

/**
 * Convert a SET clause into a SetStep.
 * Supports three types of assignments:
 * 1. Individual property: n.prop = value
 * 2. Replace all properties: n = {props}
 * 3. Add/merge properties: n += {props}
 */
function convertSetClause(setClause: SetClause): SetStep {
  const assignments: StepSetOperation[] = setClause.assignments.map((assignment) => {
    // Check for SetAllProperties or SetAddProperties (map-based assignments)
    if ("type" in assignment) {
      if (assignment.type === "SetAllProperties") {
        const setAll = assignment as SetAllProperties;
        return {
          type: "setAllProperties" as const,
          variable: setAll.variable,
          properties: convertSetMapValue(setAll.properties),
        };
      } else if (assignment.type === "SetAddProperties") {
        const setAdd = assignment as SetAddProperties;
        return {
          type: "setAddProperties" as const,
          variable: setAdd.variable,
          properties: convertSetMapValue(setAdd.properties),
        };
      }
    }
    // Individual property assignment: n.prop = value
    return {
      variable: assignment.variable,
      property: assignment.property,
      value: convertSetValue(assignment.value),
    };
  });

  return new SetStep({ assignments });
}

/**
 * Convert a SET map value (property map or parameter reference).
 */
function convertSetMapValue(
  value: Record<string, unknown> | { type: "ParameterRef"; name: string },
): Record<string, unknown> | { type: "parameter"; name: string } {
  // Check if it's a parameter reference
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "ParameterRef"
  ) {
    return { type: "parameter", name: (value as { name: string }).name };
  }
  // It's a property map - convert any nested maps
  return convertPropertyMap(value as Record<string, unknown>);
}

/**
 * Convert a property map, handling nested maps and parameter references.
 * Transforms NestedMap AST nodes into plain objects.
 */
function convertPropertyMap(props: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!props) return {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    result[key] = convertNestedPropertyValue(value);
  }
  return result;
}

/**
 * Convert a single property value, handling NestedMap, ListLiteral, and ParameterRef.
 */
function convertNestedPropertyValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  const obj = value as Record<string, unknown>;

  // Handle NestedMap - convert to plain object recursively
  if (obj.type === "NestedMap") {
    return convertPropertyMap(obj.value as Record<string, unknown>);
  }

  // Handle ListLiteral - convert to plain array recursively
  if (obj.type === "ListLiteral") {
    return (obj.values as unknown[]).map(convertNestedPropertyValue);
  }

  // Handle ParameterRef - preserve as-is for runtime resolution
  // The Steps expect the original ParameterRef format
  if (obj.type === "ParameterRef") {
    return obj;
  }

  // For other objects (shouldn't happen in valid AST), return as-is
  return value;
}

/**
 * Convert a CREATE clause into a CreateStep.
 * Handles both simple node patterns and chain patterns (with relationships).
 *
 * Chain patterns like: (t)-[:Contains]->(:Attr {props})-[:IsA]->(s)
 * Are processed to extract all nodes that need to be created and all edges,
 * respecting the order so that variables created earlier can be referenced later.
 */
function convertCreateClause(createClause: CreateClause): CreateStep {
  const vertices: CreateVertexConfig[] = [];
  const edges: CreateEdgeConfig[] = [];

  // Track variables assigned to nodes (including generated ones for anonymous nodes)
  // Maps from the node object reference to the assigned variable name
  const nodeVariables = new Map<CreateNodePattern | CreateVariableRef, string>();

  // Counter for generating unique anonymous variable names
  let anonCounter = 0;

  for (const pattern of createClause.patterns) {
    if (pattern.type === "CreateNodePattern") {
      // Simple standalone node creation
      const nodePattern = pattern as CreateNodePattern;
      vertices.push({
        variable: nodePattern.variable,
        label: nodePattern.labels[0] || "Node",
        properties: convertPropertyMap(nodePattern.properties),
      });
    } else if (pattern.type === "CreateChainPattern") {
      // Chain pattern: process nodes and edges in sequence
      const chain = pattern as CreateChainPattern;
      const elements = chain.elements;

      // First pass: assign variables to all nodes and collect nodes to create
      // We need to create nodes before edges so that edge endpoints can reference them
      for (let i = 0; i < elements.length; i += 2) {
        const nodeElement = elements[i] as CreateNodePattern | CreateVariableRef;

        if (nodeElement.type === "CreateVariableRef") {
          // Reference to existing node - use its variable
          nodeVariables.set(nodeElement, nodeElement.variable);
        } else {
          // CreateNodePattern - new node to create (with or without labels)
          const nodePattern = nodeElement as CreateNodePattern;
          // New node to create - assign variable (use existing or generate)
          const variable = nodePattern.variable || `__anon_${anonCounter++}`;
          nodeVariables.set(nodeElement, variable);
          vertices.push({
            variable,
            // Use first label if provided, otherwise use empty string for unlabeled nodes
            label: nodePattern.labels[0] || "",
            properties: convertPropertyMap(nodePattern.properties),
          });
        }
      }

      // Second pass: collect all edges using assigned variables
      for (let i = 1; i < elements.length; i += 2) {
        const edgeElement = elements[i] as CreateEdgePattern;
        const prevNode = elements[i - 1] as CreateNodePattern | CreateVariableRef;
        const nextNode = elements[i + 1] as CreateNodePattern | CreateVariableRef;

        const startVariable = nodeVariables.get(prevNode);
        const endVariable = nodeVariables.get(nextNode);

        if (!startVariable || !endVariable) {
          throw new Error("CREATE: Internal error - node variable not assigned");
        }

        const edgeConfig: CreateEdgeConfig = {
          variable: edgeElement.variable,
          label: edgeElement.label,
          direction: edgeElement.direction,
          properties: convertPropertyMap(edgeElement.properties),
          startVariable,
          endVariable,
        };

        edges.push(edgeConfig);
      }
    }
  }

  return new CreateStep({
    vertices,
    edges: edges.length > 0 ? edges : undefined,
  });
}

/**
 * Convert a DELETE clause into a DeleteStep.
 */
function convertDeleteClause(deleteClause: DeleteClause): DeleteStep {
  return new DeleteStep({
    variables: deleteClause.variables,
    detach: deleteClause.detach,
  });
}

/**
 * Convert a REMOVE clause into a RemoveStep.
 */
function convertRemoveClause(removeClause: RemoveClause): RemoveStep {
  const items: RemoveStepItem[] = removeClause.items.map((item) => {
    if (item.type === "RemoveProperty") {
      return {
        type: "property" as const,
        variable: item.variable,
        property: item.property,
      };
    } else {
      // Label removal is not supported - validate early
      throw new Error(
        `REMOVE: Label removal is not supported. Labels are immutable. ` +
          `Cannot remove label '${item.label}' from '${item.variable}'.`,
      );
    }
  });

  return new RemoveStep({ items });
}

/**
 * Convert a MERGE clause into a MergeStep.
 */
function convertMergeClause(mergeClause: MergeClause): MergeStep {
  let pattern: MergePatternConfig;

  if (mergeClause.pattern.type === "NodePattern") {
    const nodePattern = mergeClause.pattern as NodePattern;
    pattern = {
      type: "node",
      variable: nodePattern.variable,
      labels: nodePattern.labels,
      properties: convertPropertyMap(nodePattern.properties),
    };
  } else if (mergeClause.pattern.type === "MergeRelationshipPattern") {
    const relPattern = mergeClause.pattern as MergeRelationshipPattern;
    pattern = {
      type: "edge",
      variable: relPattern.edge.variable,
      label: relPattern.edge.label,
      direction: relPattern.edge.direction,
      properties: convertPropertyMap(relPattern.edge.properties),
      startVariable: relPattern.startVariable,
      endVariable: relPattern.endVariable,
    };
  } else {
    throw new Error(`Unknown MERGE pattern type: ${(mergeClause.pattern as any).type}`);
  }

  return new MergeStep({
    pattern,
    onCreate: mergeClause.onCreate
      ? mergeClause.onCreate.assignments.map((a) => ({
          variable: a.variable,
          property: a.property,
          value: convertSetValue(a.value),
        }))
      : undefined,
    onMatch: mergeClause.onMatch
      ? mergeClause.onMatch.assignments.map((a) => ({
          variable: a.variable,
          property: a.property,
          value: convertSetValue(a.value),
        }))
      : undefined,
  });
}

/**
 * Convert a WITH clause into a WithStep.
 */
function convertWithClause(withClause: WithClause): WithStep {
  const items: WithItemConfig[] = withClause.items.map((item) => convertWithItem(item));

  // Convert ORDER BY if present
  // Build alias map from WITH items for alias resolution
  const aliasMap = buildWithAliasMap(withClause.items);
  const orderBy = withClause.orderBy
    ? withClause.orderBy.orders.map(
        (order) => resolveOrderItem(order, aliasMap, true), // true = use alias directly for WITH ORDER BY
      )
    : undefined;

  // Convert WHERE condition if present
  const whereCondition = withClause.where
    ? convertCondition(withClause.where.condition)
    : undefined;

  return new WithStep({
    distinct: withClause.distinct,
    items,
    orderBy,
    skip: withClause.skip,
    limit: withClause.limit,
    whereCondition,
  });
}

/**
 * Convert a WITH item AST node to a WithItemConfig.
 */
function convertWithItem(item: WithItem): WithItemConfig {
  const expr = item.expression;

  // Handle null literal: WITH null AS x
  if (expr === null) {
    return {
      type: "expression",
      value: { type: "null" },
      alias: item.alias,
    };
  }

  if (expr.type === "VariableRef") {
    return {
      type: "variable",
      sourceVariable: expr.variable,
      alias: item.alias,
    };
  }

  if (expr.type === "PropertyAccess") {
    return {
      type: "property",
      sourceVariable: expr.variable,
      property: expr.property,
      alias: item.alias,
    };
  }

  if (expr.type === "WithAggregate") {
    return {
      type: "aggregate",
      function: expr.function,
      sourceVariable: expr.variable,
      property: expr.property,
      alias: item.alias,
    };
  }

  if (expr.type === "FunctionCall") {
    // Function calls like type(r), size(list), etc.
    return {
      type: "functionCall",
      functionName: expr.name,
      args: expr.args.map((arg) => convertConditionValue(arg)),
      distinct: expr.distinct,
      alias: item.alias,
    };
  }

  if (expr.type === "ListLiteral") {
    // List literals like [1, 2, 3]
    return {
      type: "expression",
      value: convertConditionValue(expr),
      alias: item.alias,
    };
  }

  if (expr.type === "ArithmeticExpression") {
    // Arithmetic expressions like a.num + a.num2
    return {
      type: "expression",
      value: convertConditionValue(expr),
      alias: item.alias,
    };
  }

  // Parameter references like $param
  return {
    type: "expression",
    value: convertConditionValue(expr),
    alias: item.alias,
  };
}

/**
 * Convert an UNWIND clause into an UnwindStep.
 */
function convertUnwindClause(unwindClause: UnwindClause): UnwindStep {
  const expression = convertUnwindExpression(unwindClause.expression);
  return new UnwindStep({
    expression,
    alias: unwindClause.alias,
  });
}

/**
 * Convert an UNWIND expression AST node to a StepUnwindExpression.
 */
function convertUnwindExpression(expr: ASTUnwindExpression): StepUnwindExpression {
  if (expr.type === "ListLiteral") {
    // ListLiteral from UNWIND grammar - values may be complex AST nodes
    // Check if all values are simple primitives or if we need runtime evaluation
    const isPrimitive = (v: unknown): boolean => {
      return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null;
    };

    const allPrimitives = expr.values.every(isPrimitive);

    if (allPrimitives) {
      // Simple case: all values are primitives
      return {
        type: "literal",
        values: expr.values,
      };
    }

    // Complex case: values contain AST nodes that need runtime evaluation
    // Convert the entire ListLiteral to an expression for runtime evaluation
    return {
      type: "expression",
      value: convertConditionValue(expr),
    };
  }

  if (expr.type === "NullLiteral") {
    return { type: "null" };
  }

  if (expr.type === "PropertyAccess") {
    return {
      type: "property",
      variable: expr.variable,
      property: expr.property,
    };
  }

  if (expr.type === "VariableRef") {
    return {
      type: "variable",
      variable: expr.variable,
    };
  }

  if (expr.type === "ParameterRef") {
    return {
      type: "parameter",
      name: expr.name,
    };
  }

  if (expr.type === "FunctionCall") {
    // Convert function call arguments to ConditionValue
    const args = expr.args.map((arg) => convertConditionValue(arg));
    return {
      type: "function",
      name: expr.name,
      args,
      distinct: expr.distinct ?? false,
    };
  }

  if (expr.type === "ArithmeticExpression") {
    // Convert arithmetic expression to ConditionValue for evaluation
    return {
      type: "expression",
      value: convertConditionValue(expr),
    };
  }

  throw new Error(`Unknown UNWIND expression type: ${(expr as any).type}`);
}

/**
 * Convert a CALL clause into a CallStep.
 */
function convertCallClause(callClause: CallClause): CallStep {
  // Convert arguments (expressions) to condition values
  const args = callClause.arguments.map((arg) => convertConditionValue(arg));

  // Convert yield items
  const yieldItems: YieldItemConfig[] | undefined = callClause.yield?.map((item: YieldItem) => ({
    name: item.name,
    alias: item.alias,
  }));

  return new CallStep({
    procedureName: callClause.procedure,
    arguments: args,
    yieldItems,
  });
}

/**
 * Convert a SetValue AST node to a SetAssignmentValue.
 */
function convertSetValue(value: SetValue): SetAssignmentValue {
  // Handle literal values (primitives)
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return { type: "literal", value };
  }

  // Handle PropertyAccess
  if (value.type === "PropertyAccess") {
    return {
      type: "property",
      variable: value.variable,
      property: value.property,
    };
  }

  // Handle VariableRef
  if (value.type === "VariableRef") {
    return { type: "variable", variable: value.variable };
  }

  // Handle ParameterRef
  if (value.type === "ParameterRef") {
    return { type: "parameter", name: value.name };
  }

  // Handle ListLiteral
  if (value.type === "ListLiteral") {
    return { type: "list", values: value.values as unknown[] };
  }

  // Handle NestedMap (JSON object value)
  if (value.type === "NestedMap") {
    return {
      type: "literal",
      value: convertPropertyMap(value.value as Record<string, unknown>),
    };
  }

  // This should never happen given the SetValue type definition
  // If it does, it's a parser bug or type mismatch
  throw new Error(`Unexpected SetValue type: ${JSON.stringify(value)}`);
}

/**
 * Convert a FOREACH clause into a ForeachStep.
 */
function convertForeachClause(foreachClause: ForeachClause): ForeachStep<Step<any>[]> {
  const { variable, listExpression, operations } = foreachClause;

  // Convert the list expression
  const stepListExpression = convertListExpression(listExpression);

  // Convert the operations to inner steps
  const innerSteps: Step<any>[] = [];
  for (const operation of operations) {
    if (operation.type === "SetOperation") {
      const setOp = operation as ASTSetOperation;
      const setStep = convertSetOperationToStep(setOp);
      innerSteps.push(setStep);
    } else if (operation.type === "DeleteOperation") {
      // Convert DELETE/DETACH DELETE operations inside FOREACH
      const deleteOp = operation as ASTDeleteOperation;
      const deleteStep = new DeleteStep({
        variables: deleteOp.variables,
        detach: deleteOp.detach,
      });
      innerSteps.push(deleteStep);
    } else if (operation.type === "MatchClause") {
      // Convert MATCH operations inside FOREACH
      const matchClause = operation as MatchClause;
      const matchPattern = matchClause.pattern;

      if (matchPattern.type === "ShortestPathPattern") {
        // Convert shortestPath pattern to steps
        const shortestPathSteps = convertShortestPathPattern(
          matchPattern as ShortestPathPattern,
          matchClause.where,
        );
        innerSteps.push(...shortestPathSteps);
      } else {
        // Regular pattern - convert to steps
        const matchSteps = convertPattern(matchPattern as Pattern, matchClause.where);
        innerSteps.push(...matchSteps);
      }
    }
  }

  return new ForeachStep(
    {
      variable,
      listExpression: stepListExpression,
    },
    innerSteps,
  );
}

/**
 * Convert a ListExpression AST node to a ForeachListExpression.
 */
function convertListExpression(expr: ListExpression): ForeachListExpression {
  if (expr.type === "ListLiteral") {
    // ListLiteral from FOREACH grammar only contains literals
    return {
      type: "literal",
      values: expr.values as readonly (string | number | boolean | null)[],
    };
  } else if (expr.type === "PropertyAccess") {
    return {
      type: "property",
      variable: expr.variable,
      property: expr.property,
    };
  } else if (expr.type === "VariableRef") {
    return {
      type: "variable",
      variable: expr.variable,
    };
  } else if (expr.type === "FunctionCall") {
    // Function calls like tail(nodes) used as list expression
    return {
      type: "functionCall",
      name: expr.name,
      args: expr.args.map((arg) => convertConditionValue(arg)),
      distinct: expr.distinct,
    };
  }

  throw new Error(`Unknown list expression type: ${(expr as any).type}`);
}

/**
 * Convert a SetOperation (from FOREACH) into a SetStep.
 * Note: FOREACH SET operations currently only support individual property assignments,
 * not bulk property operations (n = {props} or n += {props}).
 */
function convertSetOperationToStep(setOp: ASTSetOperation): SetStep {
  const assignments = setOp.assignments.map((assignment) => ({
    variable: assignment.variable,
    property: assignment.property,
    value: convertSetValue(assignment.value),
  }));

  return new SetStep({ assignments });
}

/**
 * Convert a ShortestPathPattern into a sequence of steps.
 * Uses ShortestPathStep with BFS/Dijkstra algorithm.
 *
 * TODO: The pattern.all field (for allShortestPaths) currently throws an error.
 * Only a single shortest path is supported. Implement support for finding
 * all shortest paths when pattern.all is true.
 *
 * @throws {Error} When pattern.all is true (allShortestPaths not implemented)
 */
function convertShortestPathPattern(
  pattern: ShortestPathPattern,
  whereClause?: WhereClause,
): Step<any>[] {
  // Check if allShortestPaths is requested - not yet implemented
  if (pattern.all === true) {
    throw new Error(
      "allShortestPaths() is not yet implemented. Use shortestPath() to find a single shortest path.",
    );
  }

  const steps: Step<any>[] = [];
  const { source, target, edge, variable } = pattern;

  // Build the source vertex fetch step
  const sourceStepLabels = source.variable ? [source.variable] : undefined;
  steps.push(
    new FetchVerticesStep({
      vertexLabels: source.labels.length > 0 ? source.labels : undefined,
      stepLabels: sourceStepLabels,
    }),
  );

  // Apply WHERE conditions that reference the source variable
  let targetCondition: StepCondition | undefined;

  if (whereClause && source.variable) {
    const { early, late } = splitASTConditionByVariables(whereClause.condition, [source.variable]);

    // Apply early conditions to filter source vertices
    if (early) {
      steps.push(new FilterElementsStep({ condition: convertCondition(early) }));
    }

    // Extract target conditions from late conditions
    if (late && target.variable) {
      const targetVarConditions = extractConditionsForVariable(late, target.variable);
      if (targetVarConditions) {
        // Use direct property access for shortestPath target conditions
        // since the target vertex hasn't been bound to a variable yet
        targetCondition = convertCondition(targetVarConditions, true);
      }
    }
  }

  // Build target condition from target node labels and properties
  const targetConditions: StepCondition[] = [];

  // Add label conditions for target
  if (target.labels.length > 0) {
    if (target.labels.length === 1) {
      targetConditions.push(["=", "@label", target.labels[0]!] as StepCondition);
    } else {
      targetConditions.push([
        "or",
        ...target.labels.map((label) => ["=", "@label", label] as StepCondition),
      ] as StepCondition);
    }
  }

  // Add property conditions from WHERE clause for target variable
  if (targetCondition) {
    targetConditions.push(targetCondition);
  }

  // Combine target conditions
  let finalTargetCondition: StepCondition | undefined;
  if (targetConditions.length === 1) {
    finalTargetCondition = targetConditions[0];
  } else if (targetConditions.length > 1) {
    finalTargetCondition = ["and", ...targetConditions] as StepCondition;
  }

  // Determine edge direction and labels
  const direction = edge.direction;
  const edgeLabels = edge.labels;

  // Create the ShortestPathStep
  const shortestPathConfig: {
    targetCondition?: StepCondition;
    direction: "in" | "out" | "both";
    edgeLabels: readonly string[];
    maxDepth?: number;
    stepLabels?: readonly string[];
  } = {
    targetCondition: finalTargetCondition,
    direction,
    edgeLabels,
  };

  // Handle quantifier for max depth
  if (edge.quantifier) {
    shortestPathConfig.maxDepth = edge.quantifier.max ?? 100;
  }

  // Add step labels for the target vertex
  // Include both the path variable (if any) and the target variable (if any)
  const pathStepLabels: string[] = [];
  if (variable) {
    pathStepLabels.push(variable);
  }
  if (target.variable) {
    pathStepLabels.push(target.variable);
  }
  if (pathStepLabels.length > 0) {
    shortestPathConfig.stepLabels = pathStepLabels;
  }

  steps.push(new ShortestPathStep(shortestPathConfig));

  return steps;
}

/**
 * Extract conditions that specifically reference a given variable.
 */
function extractConditionsForVariable(
  condition: Condition,
  variable: string,
): Condition | undefined {
  if (
    condition.type === "AndCondition" ||
    condition.type === "OrCondition" ||
    condition.type === "XorCondition"
  ) {
    const leftExtracted = extractConditionsForVariable(
      (condition as AndCondition | OrCondition | XorCondition).left,
      variable,
    );
    const rightExtracted = extractConditionsForVariable(
      (condition as AndCondition | OrCondition | XorCondition).right,
      variable,
    );

    const parts = [leftExtracted, rightExtracted].filter((c): c is Condition => c !== undefined);

    if (parts.length === 0) return undefined;
    if (parts.length === 1) return parts[0];
    if (condition.type === "AndCondition") {
      return {
        type: "AndCondition",
        left: parts[0]!,
        right: parts[1]!,
      } as AndCondition;
    } else if (condition.type === "OrCondition") {
      return {
        type: "OrCondition",
        left: parts[0]!,
        right: parts[1]!,
      } as OrCondition;
    } else {
      return {
        type: "XorCondition",
        left: parts[0]!,
        right: parts[1]!,
      } as XorCondition;
    }
  }

  // For simple conditions, check if they reference the target variable
  if (
    condition.type === "PropertyCondition" ||
    condition.type === "ExistsCondition" ||
    condition.type === "InCondition" ||
    condition.type === "IsNullCondition" ||
    condition.type === "RegexCondition" ||
    condition.type === "StringPredicateCondition"
  ) {
    const condVar = (
      condition as
        | PropertyCondition
        | ExistsCondition
        | InCondition
        | IsNullCondition
        | RegexCondition
        | StringPredicateCondition
    ).variable;
    if (condVar === variable) {
      return condition;
    }
  }

  if (condition.type === "NotCondition") {
    const inner = extractConditionsForVariable((condition as NotCondition).condition, variable);
    return inner ? ({ type: "NotCondition", condition: inner } as NotCondition) : undefined;
  }

  return undefined;
}

/**
 * Convert a pattern into a sequence of steps.
 * Handles node patterns, edge patterns, and variable-length paths.
 *
 * @param pattern The pattern to convert
 * @param whereClause Optional WHERE clause for filtering
 * @param anchoredToInput If true, the first node is a reference to an existing binding
 *                        (from a previous MATCH clause) and we should traverse from
 *                        the input path rather than fetching all vertices.
 * @param preservePriorBindings If true, use CartesianFetchStep instead of FetchVerticesStep
 *                              to preserve variable bindings from a prior WITH clause.
 */
function convertPattern(
  pattern: Pattern,
  whereClause?: WhereClause,
  anchoredToInput: boolean = false,
  preservePriorBindings: boolean = false,
): Step<any>[] {
  const steps: Step<any>[] = [];
  const elements = pattern.elements;

  if (elements.length === 0) {
    throw new Error("Pattern must have at least one element");
  }

  // First element should be a NodePattern
  const firstElement = elements[0];
  if (firstElement?.type !== "NodePattern") {
    throw new Error("Pattern must start with a NodePattern");
  }

  const firstNode = firstElement as NodePattern;
  const stepLabels = firstNode.variable ? [firstNode.variable] : undefined;

  // Determine if this is an anchored pattern (variable reference to existing binding)
  // An anchored pattern has a variable but no labels and has more elements (edges)
  // In this case, we traverse from the input path rather than fetching all vertices.
  //
  // The heuristic only applies when anchoredToInput is explicitly true (passed from caller).
  // This handles cases like EXISTS { (n)-[:KNOWS]->(m) } where `n` is a bound variable.
  //
  // For fresh MATCH clauses, anchoredToInput is false, and we always create FetchVertices
  // even if the pattern looks like it could be anchored (e.g., MATCH (a)-[:knows]->(b)).
  // The label/property filter can come from the WHERE clause (e.g., WHERE a IS :Person).
  const isAnchorPattern =
    anchoredToInput &&
    firstNode.variable &&
    firstNode.labels.length === 0 &&
    !firstNode.labelExpression &&
    elements.length > 1 &&
    !firstNode.properties;

  if (!isAnchorPattern) {
    // Create initial fetch step for pattern match
    // Use CartesianFetchStep if we need to preserve bindings from a prior WITH clause
    if (preservePriorBindings) {
      steps.push(
        new CartesianFetchStep({
          vertexLabels: firstNode.labels.length > 0 ? firstNode.labels : undefined,
          stepLabels,
        }),
      );
    } else {
      steps.push(
        new FetchVerticesStep({
          vertexLabels: firstNode.labels.length > 0 ? firstNode.labels : undefined,
          stepLabels,
        }),
      );
    }

    // If there's a label expression on the first node, add a filter
    if (firstNode.labelExpression) {
      steps.push(
        new FilterElementsStep({
          condition: convertLabelExpression(firstNode.labelExpression),
        }),
      );
    }
  }
  // For anchor patterns, we skip FetchVertices and rely on the input path's value

  // Split WHERE clause into early and late conditions
  // Early conditions only reference the first node variable
  // Late conditions reference other variables or should be applied after traversal
  let earlyCondition: StepCondition | undefined;
  let lateCondition: StepCondition | undefined;

  if (whereClause && firstNode.variable) {
    const { early, late } = splitASTConditionByVariables(whereClause.condition, [
      firstNode.variable,
    ]);
    earlyCondition = early ? convertCondition(early) : undefined;
    lateCondition = late ? convertCondition(late) : undefined;
  } else if (whereClause) {
    // No first node variable, apply everything late
    lateCondition = convertCondition(whereClause.condition);
  }

  // Add early WHERE clause filter right after fetching starting vertices for better performance
  if (earlyCondition) {
    steps.push(new FilterElementsStep({ condition: earlyCondition }));
  }

  // Process remaining elements in pairs (edge, node) or ParenthesizedPathPattern
  for (let i = 1; i < elements.length; i++) {
    const element = elements[i]!;

    if (element.type === "EdgePattern") {
      const edgePattern = element as EdgePattern;
      const nextElement = elements[i + 1];

      // Handle the destination node if present
      const nodePattern =
        nextElement?.type === "NodePattern" ? (nextElement as NodePattern) : undefined;

      // Handle the edge traversal, passing the destination node info
      const edgeSteps = convertEdgePattern(edgePattern, nodePattern);
      steps.push(...edgeSteps);

      // Add filter for node labels if specified and not a quantified edge
      if (nodePattern && !edgePattern.quantifier) {
        const labelCondition = createNodeLabelCondition(nodePattern);
        if (labelCondition) {
          steps.push(
            new FilterElementsStep({
              condition: labelCondition,
            }),
          );
        }
      }

      if (nodePattern) {
        i++; // Skip the node since we've processed it
      }
    } else if (element.type === "ParenthesizedPathPattern") {
      // Handle parenthesized path pattern with optional inline WHERE
      const parenthesizedSteps = convertParenthesizedPathPattern(
        element as ParenthesizedPathPattern,
      );
      steps.push(...parenthesizedSteps);
    }
  }

  // If this pattern has a path variable (p = pattern), bind the path to that variable
  // This must happen BEFORE late WHERE conditions so that path functions like length(p) work
  if (pattern.pathVariable) {
    steps.push(new BindPathStep({ pathVariable: pattern.pathVariable }));
  }

  // Add late WHERE clause conditions that reference other variables
  if (lateCondition) {
    steps.push(new FilterElementsStep({ condition: lateCondition }));
  }

  return steps;
}

/**
 * Convert a MultiPattern (comma-separated patterns like MATCH (a), (b)) into steps.
 * Creates a Cartesian product of all matching combinations.
 *
 * Note: Currently only supports simple node patterns. Patterns with edges
 * (e.g., MATCH (a)-[:KNOWS]-(b), (c)) are not supported in comma-separated form.
 */
function convertMultiPattern(
  multiPattern: MultiPattern,
  whereClause?: WhereClause,
  preservePriorBindings: boolean = false,
): Step<any>[] {
  const steps: Step<any>[] = [];
  const { patterns } = multiPattern;

  if (patterns.length === 0) {
    throw new Error("MultiPattern must have at least one pattern");
  }

  // Validate that all patterns are simple node patterns (no edges)
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]!;
    if (pattern.elements.length > 1) {
      throw new Error(
        `Comma-separated MATCH patterns only support simple node patterns. ` +
          `Pattern ${i + 1} contains edges which is not supported. ` +
          `Use separate MATCH clauses for patterns with relationships.`,
      );
    }
    if (pattern.elements[0]?.type !== "NodePattern") {
      throw new Error(
        `Comma-separated MATCH patterns must start with a NodePattern. ` +
          `Pattern ${i + 1} starts with ${pattern.elements[0]?.type ?? "nothing"}.`,
      );
    }
  }

  // Process first pattern normally
  const firstPattern = patterns[0]!;
  const firstNode = firstPattern.elements[0] as NodePattern;
  const firstStepLabels = firstNode.variable ? [firstNode.variable] : undefined;

  // Use CartesianFetchStep if we need to preserve bindings from a prior WITH clause
  if (preservePriorBindings) {
    steps.push(
      new CartesianFetchStep({
        vertexLabels: firstNode.labels.length > 0 ? firstNode.labels : undefined,
        stepLabels: firstStepLabels,
      }),
    );
  } else {
    steps.push(
      new FetchVerticesStep({
        vertexLabels: firstNode.labels.length > 0 ? firstNode.labels : undefined,
        stepLabels: firstStepLabels,
      }),
    );
  }

  // If there's a label expression on the first node, add a filter
  if (firstNode.labelExpression) {
    steps.push(
      new FilterElementsStep({
        condition: convertLabelExpression(firstNode.labelExpression),
      }),
    );
  }

  // Apply property filters for first node if it has inline properties
  if (firstNode.properties && Object.keys(firstNode.properties).length > 0) {
    const propertyConditions = Object.entries(firstNode.properties).map(
      ([key, value]) => ["=", key, value] as StepCondition,
    );
    const condition: StepCondition =
      propertyConditions.length === 1
        ? propertyConditions[0]!
        : (["and", ...propertyConditions] as StepCondition);
    steps.push(new FilterElementsStep({ condition }));
  }

  // Process additional patterns using CartesianFetchStep for cross-product
  for (let i = 1; i < patterns.length; i++) {
    const pattern = patterns[i]!;
    const node = pattern.elements[0] as NodePattern;
    const stepLabels = node.variable ? [node.variable] : undefined;

    // Convert inline properties to a condition for consistency with FilterElementsStep
    let condition: StepCondition | undefined;
    if (node.properties && Object.keys(node.properties).length > 0) {
      const propertyConditions = Object.entries(node.properties).map(
        ([key, value]) => ["=", key, value] as StepCondition,
      );
      condition =
        propertyConditions.length === 1
          ? propertyConditions[0]!
          : (["and", ...propertyConditions] as StepCondition);
    }

    steps.push(
      new CartesianFetchStep({
        vertexLabels: node.labels.length > 0 ? node.labels : undefined,
        condition,
        stepLabels,
      }),
    );
  }

  // Apply WHERE clause conditions at the end
  if (whereClause) {
    const condition = convertCondition(whereClause.condition);
    steps.push(new FilterElementsStep({ condition }));
  }

  return steps;
}

/**
 * Convert an edge pattern to steps, handling quantifiers for variable-length paths.
 */
function convertEdgePattern(edgePattern: EdgePattern, destNode?: NodePattern): Step<any>[] {
  // No quantifier - single edge traversal + destination vertex
  if (!edgePattern.quantifier) {
    const baseStep = new EdgeStep({
      direction: edgePattern.direction,
      edgeLabels: edgePattern.labels,
      stepLabels: edgePattern.variable ? [edgePattern.variable] : undefined,
    });

    const steps: Step<any>[] = [baseStep];

    // Add filter for edge properties if specified
    if (edgePattern.properties && Object.keys(edgePattern.properties).length > 0) {
      const propertyConditions = Object.entries(edgePattern.properties).map(
        ([key, value]) => ["=", key, value] as StepCondition,
      );
      const condition: StepCondition =
        propertyConditions.length === 1
          ? propertyConditions[0]!
          : (["and", ...propertyConditions] as StepCondition);
      steps.push(new FilterElementsStep({ condition }));
    }

    // Add VertexStep with "other" direction to traverse to the destination vertex
    if (destNode) {
      steps.push(
        new VertexStep({
          direction: "other",
          edgeLabels: [],
          stepLabels: destNode.variable ? [destNode.variable] : undefined,
        }),
      );
    }

    return steps;
  }

  // With quantifier - wrap in RepeatStep with destination node label
  const baseStep = new EdgeStep({
    direction: edgePattern.direction,
    edgeLabels: edgePattern.labels,
    stepLabels: edgePattern.variable ? [edgePattern.variable] : undefined,
  });

  const repeatStep = convertQuantifiedEdge(
    baseStep,
    edgePattern.quantifier,
    destNode?.variable,
    edgePattern.properties,
  );

  return [repeatStep];
}

/**
 * Convert a quantified edge pattern to a RepeatStep.
 * For variable-length paths, we need to repeat both the edge traversal and vertex traversal.
 */
function convertQuantifiedEdge(
  baseStep: EdgeStep,
  quantifier: Quantifier,
  destNodeVariable?: string,
  edgeProperties?: { [key: string]: any },
): RepeatStep<Step<any>[]> {
  const { min, max } = quantifier;

  // Build the steps for each iteration
  const iterationSteps: Step<any>[] = [baseStep];

  // Add filter for edge properties if specified
  if (edgeProperties && Object.keys(edgeProperties).length > 0) {
    const propertyConditions = Object.entries(edgeProperties).map(
      ([key, value]) => ["=", key, value] as StepCondition,
    );
    const condition: StepCondition =
      propertyConditions.length === 1
        ? propertyConditions[0]!
        : (["and", ...propertyConditions] as StepCondition);
    iterationSteps.push(new FilterElementsStep({ condition }));
  }

  // For variable-length paths, we need to traverse edge -> vertex repeatedly
  // The vertex step should use the same direction as the edge step to continue in that direction
  const vertexStep = new VertexStep({
    direction: baseStep.config.direction,
    edgeLabels: [],
  });
  iterationSteps.push(vertexStep);

  const stepLabels = destNodeVariable ? [destNodeVariable] : undefined;

  // Handle zero-min case: {0,n} or {0} includes the starting node
  const emitInput = min === 0;
  // emitStart is 1-indexed (iteration 1 = 1 hop), so set it to min (but at least 1)
  const effectiveMin = min ?? 1;
  const emitStart = effectiveMin > 0 ? effectiveMin : 1;

  // Exact count: *2 or {2} means exactly 2 hops
  if (max !== undefined && effectiveMin === max) {
    // For exact count with zero min, we need emit to also get the input
    if (emitInput) {
      return new RepeatStep({ times: max, stepLabels, emitInput }, iterationSteps);
    }
    return new RepeatStep({ times: max, stepLabels }, iterationSteps);
  }

  // Range: *1..3 or {1,3} means 1 to 3 hops (with emitStart respecting min)
  if (max !== undefined) {
    return new RepeatStep(
      { times: max, emit: true, emitStart, emitInput, stepLabels },
      iterationSteps,
    );
  }

  // Open-ended: *2.. or {2,} means 2 or more hops
  // Use a large number for open-ended paths
  return new RepeatStep(
    { times: 100, emit: true, emitStart, emitInput, stepLabels },
    iterationSteps,
  );
}

/**
 * Convert a parenthesized path pattern to steps.
 * Handles optional inline WHERE condition and quantifiers.
 *
 * Parenthesized path patterns allow grouping patterns with inline conditions:
 * - ((a)-[r]->(b) WHERE r.weight > 10) - pattern with inline condition
 * - ((a)-[r]->(b))+ - quantified pattern (one or more)
 * - ((a)-[r]->(b) WHERE r.weight > 10){2,5} - with condition and quantifier
 */
function convertParenthesizedPathPattern(parenthesized: ParenthesizedPathPattern): Step<any>[] {
  // Convert the inner pattern to steps WITHOUT the WHERE clause
  // The WHERE will be added after the pattern traversal
  const patternSteps = convertPattern(
    parenthesized.pattern,
    undefined, // Don't pass WHERE here, we'll add it manually
    true,
  );

  // Build the complete inner steps array
  const innerSteps: Step<any>[] = [...patternSteps];

  // Add inline WHERE condition as a filter at the end of the inner pattern
  // This ensures the condition is checked after each traversal iteration
  if (parenthesized.where) {
    innerSteps.push(
      new FilterElementsStep({
        condition: convertCondition(parenthesized.where),
      }),
    );
  }

  // If there's a quantifier, wrap in RepeatStep
  if (parenthesized.quantifier) {
    const { min, max } = parenthesized.quantifier;

    // Extract the last variable from the pattern for step labels
    const lastElement = parenthesized.pattern.elements[parenthesized.pattern.elements.length - 1];
    const stepLabels =
      lastElement?.type === "NodePattern" && lastElement.variable
        ? [lastElement.variable]
        : undefined;

    // Handle zero-min case
    const emitInput = min === 0;
    const effectiveMin = min ?? 1;
    const emitStart = effectiveMin > 0 ? effectiveMin : 1;

    // Exact count
    if (max !== undefined && effectiveMin === max) {
      if (emitInput) {
        return [new RepeatStep({ times: max, stepLabels, emitInput }, innerSteps)];
      }
      return [new RepeatStep({ times: max, stepLabels }, innerSteps)];
    }

    // Range
    if (max !== undefined) {
      return [
        new RepeatStep({ times: max, emit: true, emitStart, emitInput, stepLabels }, innerSteps),
      ];
    }

    // Open-ended
    return [
      new RepeatStep({ times: 100, emit: true, emitStart, emitInput, stepLabels }, innerSteps),
    ];
  }

  // No quantifier - just return the inner steps
  return innerSteps;
}

/**
 * Split an AST condition into early and late parts based on which variables are referenced.
 * Early conditions only reference variables in the allowedVariables list.
 * Late conditions reference other variables.
 */
function splitASTConditionByVariables(
  condition: Condition,
  allowedVariables: string[],
): { early?: Condition; late?: Condition } {
  // Handle logical operators (and, or, xor)
  if (
    condition.type === "AndCondition" ||
    condition.type === "OrCondition" ||
    condition.type === "XorCondition"
  ) {
    const leftSplit = splitASTConditionByVariables(
      (condition as AndCondition | OrCondition | XorCondition).left,
      allowedVariables,
    );
    const rightSplit = splitASTConditionByVariables(
      (condition as AndCondition | OrCondition | XorCondition).right,
      allowedVariables,
    );

    const earlyParts = [leftSplit.early, rightSplit.early].filter(
      (c): c is Condition => c !== undefined,
    );
    const lateParts = [leftSplit.late, rightSplit.late].filter(
      (c): c is Condition => c !== undefined,
    );

    const buildCondition = (parts: Condition[], type: string): Condition => {
      if (type === "AndCondition") {
        return {
          type: "AndCondition",
          left: parts[0]!,
          right: parts[1]!,
        } as AndCondition;
      } else if (type === "OrCondition") {
        return {
          type: "OrCondition",
          left: parts[0]!,
          right: parts[1]!,
        } as OrCondition;
      } else {
        return {
          type: "XorCondition",
          left: parts[0]!,
          right: parts[1]!,
        } as XorCondition;
      }
    };

    const early =
      earlyParts.length === 0
        ? undefined
        : earlyParts.length === 1
          ? earlyParts[0]
          : buildCondition(earlyParts, condition.type);

    const late =
      lateParts.length === 0
        ? undefined
        : lateParts.length === 1
          ? lateParts[0]
          : buildCondition(lateParts, condition.type);

    return { early, late };
  }

  // For PropertyCondition, ExistsCondition, InCondition, IsNullCondition, RegexCondition, StringPredicateCondition, check the variable field
  if (
    condition.type === "PropertyCondition" ||
    condition.type === "ExistsCondition" ||
    condition.type === "InCondition" ||
    condition.type === "IsNullCondition" ||
    condition.type === "RegexCondition" ||
    condition.type === "StringPredicateCondition"
  ) {
    const variable = (
      condition as
        | PropertyCondition
        | ExistsCondition
        | InCondition
        | IsNullCondition
        | RegexCondition
        | StringPredicateCondition
    ).variable;
    if (allowedVariables.includes(variable)) {
      return { early: condition };
    } else {
      return { late: condition };
    }
  }

  // For IsLabeledCondition, check the variable field
  if (condition.type === "IsLabeledCondition") {
    const isLabeledCondition = condition as import("./AST.js").IsLabeledCondition;
    if (allowedVariables.includes(isLabeledCondition.variable)) {
      return { early: condition };
    } else {
      return { late: condition };
    }
  }

  // For NotCondition, recursively split the inner condition
  if (condition.type === "NotCondition") {
    const notCondition = condition as NotCondition;
    const split = splitASTConditionByVariables(notCondition.condition, allowedVariables);
    return {
      early: split.early
        ? ({ type: "NotCondition", condition: split.early } as NotCondition)
        : undefined,
      late: split.late
        ? ({ type: "NotCondition", condition: split.late } as NotCondition)
        : undefined,
    };
  }

  // Unknown condition type, apply late to be safe
  return { late: condition };
}

/**
 * Create a condition that checks if an element has one of the specified labels.
 */
function createLabelCondition(labels: string[]): StepCondition {
  if (labels.length === 0) {
    throw new Error("Cannot create label condition with empty labels array");
  }

  if (labels.length === 1) {
    return ["=", "@label", labels[0]!] as StepCondition;
  }

  // Multiple labels - create OR condition
  const conditions = labels.map((label) => ["=", "@label", label] as StepCondition);

  return conditions.reduce((acc, condition) => {
    return ["or", acc, condition] as StepCondition;
  });
}

/**
 * Convert a LabelExpression AST node to a StepCondition.
 * Supports: LabelName, LabelOr, LabelAnd, LabelNot, LabelWildcard
 */
function convertLabelExpression(expr: LabelExpression): StepCondition {
  switch (expr.type) {
    case "LabelName":
      return ["=", "@label", expr.name] as StepCondition;

    case "LabelOr":
      return [
        "or",
        convertLabelExpression(expr.left),
        convertLabelExpression(expr.right),
      ] as StepCondition;

    case "LabelAnd":
      return [
        "and",
        convertLabelExpression(expr.left),
        convertLabelExpression(expr.right),
      ] as StepCondition;

    case "LabelNot":
      return ["not", convertLabelExpression(expr.expression)] as StepCondition;

    case "LabelWildcard":
      // Wildcard matches any label - represented as "has a label" check
      return ["labelWildcard"] as StepCondition;

    default: {
      // Exhaustive check
      const _exhaustive: never = expr;
      throw new Error(`Unknown label expression type: ${(_exhaustive as any).type}`);
    }
  }
}

/**
 * Create a label condition from either simple labels or a label expression.
 * Returns null if no label filtering is needed.
 */
function createNodeLabelCondition(
  node: NodePattern | { labels: string[]; labelExpression?: LabelExpression },
): StepCondition | null {
  if (node.labelExpression) {
    return convertLabelExpression(node.labelExpression);
  }
  if (node.labels.length > 0) {
    return createLabelCondition(node.labels);
  }
  return null;
}

/**
 * Convert an AST condition value to Step condition value format.
 * Handles literal values, property references, variable references, and arithmetic expressions.
 */
function convertConditionValue(
  value: import("./AST.js").ConditionValue,
): import("./Steps.js").ConditionValue {
  // Literal values (string, number, boolean, null) are passed through as-is
  if (value === null || typeof value !== "object") {
    return value;
  }

  // Object values are references or expressions
  if (value.type === "PropertyAccess") {
    return {
      type: "propertyRef",
      variable: value.variable,
      property: value.property,
    };
  }

  if (value.type === "VariableRef") {
    return {
      type: "variableRef",
      variable: value.variable,
    };
  }

  if (value.type === "ParameterRef") {
    return {
      type: "parameterRef",
      name: value.name,
    };
  }

  if (value.type === "ArithmeticExpression") {
    return {
      type: "arithmeticExpression",
      operator: value.operator,
      left: convertConditionValue(value.left),
      right: convertConditionValue(value.right),
    };
  }

  if (value.type === "BooleanExpression") {
    // Handle boolean operators: AND, OR, XOR, NOT
    if (value.operator === "NOT") {
      return {
        type: "booleanExpression",
        operator: "NOT",
        operand: convertConditionValue(
          (value as { operand: import("./AST.js").ConditionValue }).operand,
        ),
      };
    }
    // For binary operators (AND, OR, XOR), left and right are always present
    return {
      type: "booleanExpression",
      operator: value.operator,
      left: convertConditionValue(value.left!),
      right: convertConditionValue(value.right!),
    };
  }

  if (value.type === "ComparisonExpression") {
    // Handle comparison operators: =, <>, <, <=, >, >=, IS NULL, IS NOT NULL, IN, NOT IN
    if (value.operator === "IS NULL" || value.operator === "IS NOT NULL") {
      return {
        type: "comparisonExpression",
        operator: value.operator,
        left: convertConditionValue(value.left),
      };
    }
    // For binary comparison operators, right is always present
    return {
      type: "comparisonExpression",
      operator: value.operator,
      left: convertConditionValue(value.left),
      right: convertConditionValue(value.right!),
    };
  }

  if (value.type === "UnaryExpression") {
    return {
      type: "unaryExpression",
      operator: value.operator,
      operand: convertConditionValue(value.operand),
    };
  }

  if (value.type === "FunctionCall") {
    return {
      type: "functionCall",
      name: value.name,
      args: value.args.map((arg, index) => {
        // Check if this argument position expects a path
        // If so, and the argument is a VariableRef, convert it to pathRef
        if (
          functionArgExpectsPath(value.name, index) &&
          arg !== null &&
          typeof arg === "object" &&
          "type" in arg &&
          arg.type === "VariableRef"
        ) {
          return { type: "pathRef" as const, variable: arg.variable };
        }
        return convertConditionValue(arg);
      }),
      distinct: value.distinct,
    };
  }

  if (value.type === "SimpleCaseExpression") {
    return {
      type: "simpleCaseExpression",
      test: convertConditionValue(value.test),
      alternatives: value.alternatives.map((alt) => ({
        when: convertConditionValue(alt.when),
        // eslint-disable-next-line no-thenable
        then: convertConditionValue(alt.then),
      })),
      ...(value.else !== undefined && {
        else: convertConditionValue(value.else),
      }),
    };
  }

  if (value.type === "SearchedCaseExpression") {
    return {
      type: "searchedCaseExpression",
      alternatives: value.alternatives.map((alt) => ({
        when: convertCondition(alt.when),
        // eslint-disable-next-line no-thenable
        then: convertConditionValue(alt.then),
      })),
      ...(value.else !== undefined && {
        else: convertConditionValue(value.else),
      }),
    };
  }

  if (value.type === "ListLiteral") {
    return {
      type: "listLiteral",
      values: value.values.map((v) =>
        convertConditionValue(v as import("./AST.js").ConditionValue),
      ),
    };
  }

  if (value.type === "MapLiteral") {
    return {
      type: "mapLiteral",
      entries: value.entries.map((entry) => ({
        key: entry.key,
        value: convertConditionValue(entry.value as import("./AST.js").ConditionValue),
      })),
    };
  }

  if (value.type === "ListIndexExpression") {
    return {
      type: "listIndexExpression",
      list: convertConditionValue(value.list),
      index: convertConditionValue(value.index),
    };
  }

  if (value.type === "SliceExpression") {
    return {
      type: "sliceExpression",
      list: convertConditionValue(value.list),
      ...(value.start !== undefined && {
        start: convertConditionValue(value.start),
      }),
      ...(value.end !== undefined && { end: convertConditionValue(value.end) }),
    };
  }

  if (value.type === "DynamicPropertyAccess") {
    return {
      type: "dynamicPropertyAccess",
      object: convertConditionValue(value.object),
      property: convertConditionValue(value.property),
    };
  }

  if (value.type === "MemberAccess") {
    return {
      type: "memberAccess",
      object: convertConditionValue(value.object),
      property: value.property,
    };
  }

  if (value.type === "ListComprehension") {
    return {
      type: "listComprehension",
      variable: value.variable,
      list: convertConditionValue(value.list),
      ...(value.filterCondition && {
        filterCondition: convertCondition(value.filterCondition),
      }),
      ...(value.projection && {
        projection: convertConditionValue(value.projection),
      }),
    };
  }

  if (value.type === "QuantifierExpression") {
    return {
      type: "quantifierExpression",
      quantifier: value.quantifier,
      variable: value.variable,
      list: convertConditionValue(value.list),
      condition: convertCondition(value.condition),
    };
  }

  if (value.type === "ReduceExpression") {
    return {
      type: "reduceExpression",
      accumulator: value.accumulator,
      init: convertConditionValue(value.init),
      variable: value.variable,
      list: convertConditionValue(value.list),
      expression: convertConditionValue(value.expression),
    };
  }

  if (value.type === "PatternComprehension") {
    // Convert the pattern to steps
    // The pattern comprehension needs a WHERE clause wrapper if filterCondition is present
    const _whereClause = value.filterCondition
      ? { type: "WhereClause" as const, condition: value.filterCondition }
      : undefined;

    // Convert pattern to steps - pattern comprehensions may reference outer scope variables
    // via patterns like (n)-[:KNOWS]->(m) where n is bound from outer context.
    // Pass anchoredToInput: true to enable anchor detection for such patterns.
    const patternSteps = convertPattern(value.pattern, undefined, true);

    return {
      type: "patternComprehension",
      ...(value.pathVariable && { pathVariable: value.pathVariable }),
      patternSteps,
      ...(value.filterCondition && {
        filterCondition: convertCondition(value.filterCondition),
      }),
      projection: convertConditionValue(value.projection),
    };
  }

  if (value.type === "MapProjection") {
    // Convert map projection: variable{.prop, key: expr, .*}
    const selectors = value.selectors.map((selector) => {
      if (selector.type === "MapAllPropertiesSelector") {
        return { type: "allProperties" as const };
      } else if (selector.type === "MapPropertySelector") {
        return { type: "property" as const, property: selector.property };
      } else if (selector.type === "MapLiteralEntry") {
        return {
          type: "literalEntry" as const,
          key: selector.key,
          value: convertConditionValue(selector.value),
        };
      } else if (selector.type === "MapVariableSelector") {
        return { type: "variable" as const, variable: selector.variable };
      }
      throw new Error(`Unknown map projection selector type: ${(selector as any).type}`);
    });

    return {
      type: "mapProjection",
      variable: value.variable,
      selectors,
    };
  }

  if (value.type === "ExistsSubquery") {
    // Convert EXISTS subquery: EXISTS { pattern [WHERE cond] }
    // EXISTS subqueries may reference outer scope variables via patterns like
    // (n)-[:KNOWS]->(m) where n is bound from outer context.
    // Pass anchoredToInput: true to enable anchor detection for such patterns.
    const patternSteps = convertPattern(value.pattern, undefined, true);

    return {
      type: "existsSubquery",
      patternSteps,
      ...(value.filterCondition && {
        filterCondition: convertCondition(value.filterCondition),
      }),
    };
  }

  // Shouldn't reach here, but fall back to returning the value
  return value as any;
}

/**
 * Convert AST condition to Step condition format.
 * @param condition - The AST condition to convert
 * @param useDirectPropertyAccess - If true, use direct property access (e.g., for shortestPath target conditions)
 *                                  instead of propertyRef (which requires variable bindings)
 */
function convertCondition(
  condition: Condition,
  useDirectPropertyAccess: boolean = false,
): StepCondition {
  switch (condition.type) {
    case "PropertyCondition": {
      const propCondition = condition as PropertyCondition;
      // Convert the condition value - handle variable and property references
      const conditionValue = convertConditionValue(propCondition.value);

      // When useDirectPropertyAccess is true (e.g., shortestPath target conditions),
      // use simple property access that evaluates against the current vertex
      if (useDirectPropertyAccess) {
        return [propCondition.operator, propCondition.property, conditionValue] as StepCondition;
      }

      // Use ExpressionCondition with propertyRef to properly resolve the variable
      // This ensures the condition looks up the variable from the path bindings
      // rather than assuming the current element
      return [
        "expr",
        propCondition.operator as BinaryOperator,
        {
          type: "propertyRef",
          variable: propCondition.variable,
          property: propCondition.property,
        },
        conditionValue,
      ] as StepCondition;
    }

    case "ExistsCondition": {
      const existsCondition = condition as ExistsCondition;
      return ["exists", existsCondition.property] as StepCondition;
    }

    case "AndCondition": {
      const andCondition = condition as AndCondition;
      return [
        "and",
        convertCondition(andCondition.left, useDirectPropertyAccess),
        convertCondition(andCondition.right, useDirectPropertyAccess),
      ] as StepCondition;
    }

    case "OrCondition": {
      const orCondition = condition as OrCondition;
      return [
        "or",
        convertCondition(orCondition.left, useDirectPropertyAccess),
        convertCondition(orCondition.right, useDirectPropertyAccess),
      ] as StepCondition;
    }

    case "XorCondition": {
      const xorCondition = condition as XorCondition;
      return [
        "xor",
        convertCondition(xorCondition.left, useDirectPropertyAccess),
        convertCondition(xorCondition.right, useDirectPropertyAccess),
      ] as StepCondition;
    }

    case "NotCondition": {
      const notCondition = condition as NotCondition;
      return [
        "not",
        convertCondition(notCondition.condition, useDirectPropertyAccess),
      ] as StepCondition;
    }

    case "InCondition": {
      const inCondition = condition as InCondition;
      return ["in", inCondition.property, inCondition.values] as StepCondition;
    }

    case "IsNullCondition": {
      const isNullCondition = condition as IsNullCondition;
      return [
        isNullCondition.negated ? "isNotNull" : "isNull",
        isNullCondition.property,
      ] as StepCondition;
    }

    case "RegexCondition": {
      const regexCondition = condition as RegexCondition;
      return ["=~", regexCondition.property, regexCondition.pattern] as StepCondition;
    }

    case "StringPredicateCondition": {
      const stringCondition = condition as StringPredicateCondition;
      // Map Cypher predicates to our operators
      const operatorMap: Record<string, BinaryOperator> = {
        "STARTS WITH": "startsWith",
        "ENDS WITH": "endsWith",
        CONTAINS: "contains",
      };
      return [
        operatorMap[stringCondition.predicate]!,
        stringCondition.property,
        stringCondition.value,
      ] as StepCondition;
    }

    case "ExpressionCondition": {
      const exprCondition = condition as ASTExpressionCondition;
      return [
        "expr",
        exprCondition.operator as BinaryOperator,
        convertConditionValue(exprCondition.left),
        convertConditionValue(exprCondition.right),
      ] as StepCondition;
    }

    case "IsLabeledCondition": {
      // IS LABELED condition: check if a variable has a specific label
      const isLabeledCondition = condition as import("./AST.js").IsLabeledCondition;
      return [
        "isLabeled",
        isLabeledCondition.variable,
        convertLabelExpression(isLabeledCondition.labelExpression),
      ] as StepCondition;
    }

    default:
      throw new Error(`Unknown condition type: ${(condition as any).type}`);
  }
}

/**
 * Extract all bound variables from a query's MATCH, WITH, and UNWIND clauses.
 */
function extractBoundVariables(query: Query): string[] {
  const variables: string[] = [];

  // Extract variables from MATCH clauses
  for (const match of query.matches) {
    const pattern = match.pattern;

    if (pattern.type === "ShortestPathPattern") {
      const sp = pattern as ShortestPathPattern;
      if (sp.variable) variables.push(sp.variable);
      if (sp.source.variable) variables.push(sp.source.variable);
      if (sp.target.variable) variables.push(sp.target.variable);
      if (sp.edge.variable) variables.push(sp.edge.variable);
    } else if (pattern.type === "MultiPattern") {
      // Handle comma-separated patterns
      const mp = pattern as MultiPattern;
      for (const p of mp.patterns) {
        for (const element of p.elements) {
          if (element.type === "NodePattern") {
            const node = element as NodePattern;
            if (node.variable) variables.push(node.variable);
          } else if (element.type === "EdgePattern") {
            const edge = element as EdgePattern;
            if (edge.variable) variables.push(edge.variable);
          }
        }
      }
    } else {
      const p = pattern as Pattern;
      for (const element of p.elements) {
        if (element.type === "NodePattern") {
          const node = element as NodePattern;
          if (node.variable) variables.push(node.variable);
        } else if (element.type === "EdgePattern") {
          const edge = element as EdgePattern;
          if (edge.variable) variables.push(edge.variable);
        }
      }
    }
  }

  // Extract aliases from WITH clauses
  if (query.with) {
    for (const withClause of query.with) {
      for (const item of withClause.items) {
        if (item.alias) {
          variables.push(item.alias);
        }
      }
    }
  }

  // Extract aliases from UNWIND clauses
  if (query.unwind) {
    for (const unwindClause of query.unwind) {
      if (unwindClause.alias) {
        variables.push(unwindClause.alias);
      }
    }
  }

  return variables;
}

/**
 * Helper to check if an expression is a function call to labels() or type()
 */
function isLegacyFunctionExpression(
  item: import("./AST.js").ReturnItem,
): { function: "labels" | "type"; variable: string } | null {
  if (item.function && item.variable) {
    return { function: item.function, variable: item.variable };
  }
  const expr = item.expression;
  if (expr && typeof expr === "object" && "type" in expr) {
    if (expr.type === "FunctionCall") {
      const funcCall = expr as FunctionCall;
      const name = funcCall.name.toLowerCase();
      if ((name === "labels" || name === "type") && funcCall.args.length === 1) {
        const arg = funcCall.args[0];
        if (arg && typeof arg === "object" && "type" in arg) {
          if (arg.type === "VariableRef") {
            return {
              function: name as "labels" | "type",
              variable: (arg as import("./AST.js").VariableRef).variable,
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Helper to check if an expression is a plain variable reference
 */
function isPlainVariableExpression(item: import("./AST.js").ReturnItem): string | null {
  if (item.variable && !item.property && !item.function && !item.aggregate) {
    return item.variable;
  }
  const expr = item.expression;
  if (expr && typeof expr === "object" && "type" in expr) {
    if (expr.type === "VariableRef") {
      return (expr as import("./AST.js").VariableRef).variable;
    }
  }
  return null;
}

/**
 * Helper to check if an expression is a property access
 */
function isPropertyAccessExpression(
  item: import("./AST.js").ReturnItem,
): { variable: string; property: string } | null {
  if (item.variable && item.property) {
    return { variable: item.variable, property: item.property };
  }
  const expr = item.expression;
  if (expr && typeof expr === "object" && "type" in expr) {
    if (expr.type === "PropertyAccess") {
      const prop = expr as import("./AST.js").PropertyAccess;
      return { variable: prop.variable, property: prop.property };
    }
  }
  return null;
}

/**
 * Convert RETURN clause to appropriate steps.
 * For mutation-only queries without RETURN, adds DrainStep to consume results.
 */
function convertReturnClause(query: Query): Step<any>[] {
  const steps: Step<any>[] = [];
  const returnClause = query.return;
  const groupByClause = query.groupBy;

  // If no RETURN clause (mutation-only query), add DrainStep
  // This ensures mutations execute (pipeline is consumed) but no results are returned
  if (!returnClause) {
    steps.push(new DrainStep({}));
    return steps;
  }

  // Check if we have any aggregate (using legacy format)
  const aggregateItems = returnClause.items.filter((item) => item.aggregate !== undefined);
  const aggregateItem = aggregateItems[0];

  // Check if we have any function calls (like labels(), type())
  // Using both legacy format and new expression format
  const functionItems = returnClause.items.filter(
    (item) => isLegacyFunctionExpression(item) !== null,
  );
  const functionItem = functionItems[0];
  const functionInfo = functionItem ? isLegacyFunctionExpression(functionItem) : null;

  // Check if we have any plain items (non-aggregate, non-function)
  // These could be plain variables, property access, or other expressions
  const plainItems = returnClause.items.filter(
    (item) => item.aggregate === undefined && isLegacyFunctionExpression(item) === null,
  );

  // If GROUP BY is present, use GroupByStep to handle mixed aggregates and functions
  if (groupByClause) {
    // Validate: non-aggregate RETURN items must appear in GROUP BY
    const nonAggregateItems = returnClause.items.filter((item) => item.aggregate === undefined);

    for (const returnItem of nonAggregateItems) {
      const matchesGroupBy = groupByClause.items.some((groupByItem) => {
        // Match by function (e.g., labels(n))
        if (returnItem.function && groupByItem.function) {
          return (
            returnItem.function === groupByItem.function &&
            returnItem.variable === groupByItem.variable
          );
        }
        // Match by property (e.g., n.name)
        if (returnItem.property && groupByItem.property) {
          return (
            returnItem.variable === groupByItem.variable &&
            returnItem.property === groupByItem.property
          );
        }
        // Match by variable (e.g., n)
        if (
          !returnItem.function &&
          !returnItem.property &&
          !groupByItem.function &&
          !groupByItem.property
        ) {
          return returnItem.variable === groupByItem.variable;
        }
        return false;
      });

      if (!matchesGroupBy) {
        const itemDesc = returnItem.function
          ? `${returnItem.function}(${returnItem.variable})`
          : returnItem.property
            ? `${returnItem.variable}.${returnItem.property}`
            : returnItem.variable;
        throw new Error(`Non-aggregate return item '${itemDesc}' must appear in GROUP BY clause`);
      }
    }

    steps.push(
      new GroupByStep({
        groupByItems: groupByClause.items.map((item) => ({
          variable: item.variable,
          property: item.property,
          function: item.function,
        })),
        returnItems: returnClause.items
          .filter((item) => item.variable !== undefined)
          .map((item) => ({
            variable: item.variable!,
            property: item.property,
            aggregate: item.aggregate,
            distinct: item.distinct,
            percentile: item.percentile,
            function: item.function,
            alias: item.alias,
          })),
      }),
    );

    // Add DedupStep if DISTINCT
    if (returnClause.distinct) {
      steps.push(new DedupStep({}));
    }

    return steps;
  }

  // Validate: cannot mix aggregates with non-aggregates (functions or plain items) without GROUP BY
  if (aggregateItem && (functionInfo || plainItems.length > 0)) {
    let mixedWith: string;
    if (functionInfo) {
      mixedWith = `function (${functionInfo.function})`;
    } else {
      const firstPlain = plainItems[0]!;
      const propInfo = isPropertyAccessExpression(firstPlain);
      const varInfo = isPlainVariableExpression(firstPlain);
      mixedWith = propInfo
        ? `non-aggregate expression (${propInfo.variable}.${propInfo.property})`
        : `non-aggregate expression (${varInfo ?? "expression"})`;
    }
    throw new Error(
      `Cannot use aggregate (${aggregateItem.aggregate}) with ${mixedWith} in RETURN clause without GROUP BY`,
    );
  }

  // Handle multiple aggregates without GROUP BY using GroupByStep with empty groupByItems
  if (aggregateItems.length > 1) {
    steps.push(
      new GroupByStep({
        groupByItems: [], // Empty means aggregate all rows into one group
        returnItems: returnClause.items
          .filter((item) => item.variable !== undefined)
          .map((item) => ({
            variable: item.variable!,
            property: item.property,
            aggregate: item.aggregate,
            distinct: item.distinct,
            percentile: item.percentile,
            function: item.function,
            alias: item.alias,
          })),
      }),
    );

    // Add DedupStep if DISTINCT
    if (returnClause.distinct) {
      steps.push(new DedupStep({}));
    }

    return steps;
  }

  // Handle single aggregate - use dedicated step for backward compatibility
  // But if DISTINCT is used, we need to use GroupByStep which supports DISTINCT
  if (aggregateItem && aggregateItem.aggregate) {
    if (aggregateItem.distinct) {
      // Use GroupByStep for DISTINCT aggregates
      steps.push(
        new GroupByStep({
          groupByItems: [], // Empty means aggregate all rows into one group
          returnItems: [
            {
              variable: aggregateItem.variable!,
              property: aggregateItem.property,
              aggregate: aggregateItem.aggregate,
              distinct: true,
              alias: aggregateItem.alias,
            },
          ],
        }),
      );

      // Add DedupStep if RETURN DISTINCT
      if (returnClause.distinct) {
        steps.push(new DedupStep({}));
      }

      return steps;
    }

    switch (aggregateItem.aggregate) {
      case "COUNT":
        steps.push(new CountStep({}));
        break;
      case "SUM":
        steps.push(new SumStep({ property: aggregateItem.property }));
        break;
      case "AVG":
        steps.push(new AvgStep({ property: aggregateItem.property }));
        break;
      case "MIN":
        steps.push(new MinStep({ property: aggregateItem.property }));
        break;
      case "MAX":
        steps.push(new MaxStep({ property: aggregateItem.property }));
        break;
      case "COLLECT":
        steps.push(new CollectStep({}));
        break;
      case "STDEV":
      case "STDEVP":
      case "PERCENTILEDISC":
      case "PERCENTILECONT":
        // Statistical aggregates use GroupByStep
        steps.push(
          new GroupByStep({
            groupByItems: [], // Empty means aggregate all rows into one group
            returnItems: [
              {
                variable: aggregateItem.variable!,
                property: aggregateItem.property,
                aggregate: aggregateItem.aggregate,
                percentile: aggregateItem.percentile,
                alias: aggregateItem.alias,
              },
            ],
          }),
        );
        break;
    }

    return steps;
  }

  // Use legacy labels/type path only for single-item returns
  // Multi-item returns with type() should use ExpressionReturnStep
  if (
    functionInfo &&
    (functionInfo.function === "labels" || functionInfo.function === "type") &&
    returnClause.items.length === 1
  ) {
    // Handle labels() and type() functions (single item only)
    // labels() returns an array of labels (for nodes, which can have multiple labels)
    // type() returns a single string (for relationships, which have one type)
    // Select the variable's path, then extract labels
    steps.push(
      new SelectStep({
        pathLabels: [functionInfo.variable],
      }),
    );
    // type() returns a string, labels() returns an array
    steps.push(new LabelsStep({ returnAsString: functionInfo.function === "type" }));

    // Add DedupStep if DISTINCT
    if (returnClause.distinct) {
      steps.push(new DedupStep({}));
    }
  } else {
    // Check if any items use the new expression-based format or legacy function format
    const hasExpressionItems = returnClause.items.some((item) => item.expression !== undefined);
    // Also check for legacy function items (labels/type) - these should also use ExpressionReturnStep
    const hasLegacyFunctionItems = returnClause.items.some(
      (item) => isLegacyFunctionExpression(item) !== null,
    );

    if (hasExpressionItems || hasLegacyFunctionItems) {
      // Use ExpressionReturnStep for expression-based and function return items
      const expressionItems: ExpressionReturnItem[] = returnClause.items.map((item) => {
        if (item.expression !== undefined) {
          return {
            expression: convertConditionValue(item.expression as import("./AST.js").ConditionValue),
            alias: item.alias,
          };
        }
        // Handle legacy function format (labels/type)
        const funcInfo = isLegacyFunctionExpression(item);
        if (funcInfo) {
          return {
            expression: {
              type: "functionCall" as const,
              name: funcInfo.function,
              args: [{ type: "variableRef" as const, variable: funcInfo.variable }],
              distinct: false,
            },
            alias: item.alias ?? `${funcInfo.function}(${funcInfo.variable})`,
          };
        }
        // Fallback for property access
        if (item.property) {
          return {
            expression: {
              type: "propertyRef" as const,
              variable: item.variable!,
              property: item.property,
            },
            alias: item.alias,
          };
        }
        return {
          expression: {
            type: "variableRef" as const,
            variable: item.variable!,
          },
          alias: item.alias,
        };
      });

      steps.push(new ExpressionReturnStep({ items: expressionItems }));

      // Add DedupStep if DISTINCT
      if (returnClause.distinct) {
        steps.push(new DedupStep({}));
      }
    } else {
      // Determine which variables to return (legacy path)
      let pathLabels: string[];

      if (returnClause.returnAll) {
        // RETURN * - collect all bound variables from MATCH clauses
        pathLabels = extractBoundVariables(query);
      } else {
        // Explicit return items
        pathLabels = returnClause.items.map((item) => item.variable!);
      }

      // Check if any items have property access (e.g., RETURN d.schema)
      const hasPropertyAccess = returnClause.items.some(
        (item) => item.property !== undefined && !item.aggregate && !item.function,
      );

      // Regular return - add SelectStep to select path labels
      steps.push(
        new SelectStep({
          pathLabels,
        }),
      );

      if (hasPropertyAccess) {
        // Use PropertyValuesStep to extract specific properties
        const items = returnClause.items.map((item) => ({
          variable: item.variable!,
          property: item.property,
        }));
        steps.push(new PropertyValuesStep({ items }));
      } else {
        // Use ValuesStep to extract full values
        steps.push(new ValuesStep({}));
      }

      // Add DedupStep if DISTINCT
      if (returnClause.distinct) {
        steps.push(new DedupStep({}));
      }
    }
  }

  return steps;
}

/**
 * Extract variable names bound by a pattern for OPTIONAL MATCH null bindings.
 * When skipAnchor is true, skips the first node if it's an anchor pattern
 * (variable reference with no labels and has edges following).
 */
function extractPatternVariables(
  pattern: Pattern | MultiPattern | ShortestPathPattern,
  skipAnchor: boolean = false,
): string[] {
  const variables: string[] = [];

  if (pattern.type === "ShortestPathPattern") {
    const sp = pattern as ShortestPathPattern;
    if (sp.variable) variables.push(sp.variable);
    if (sp.source.variable) variables.push(sp.source.variable);
    if (sp.target.variable) variables.push(sp.target.variable);
    if (sp.edge.variable) variables.push(sp.edge.variable);
  } else if (pattern.type === "MultiPattern") {
    const mp = pattern as MultiPattern;
    for (const subPattern of mp.patterns) {
      variables.push(...extractPatternVariables(subPattern, skipAnchor));
    }
  } else {
    // Regular Pattern
    const p = pattern as Pattern;
    let isFirst = true;
    for (const element of p.elements) {
      if (element.type === "NodePattern") {
        const node = element as NodePattern;
        // Skip the anchor variable if requested and it looks like an anchor
        // (first node with variable but no labels/expression, with more elements following)
        const isAnchor =
          isFirst &&
          skipAnchor &&
          node.variable &&
          node.labels.length === 0 &&
          !node.labelExpression &&
          !node.properties &&
          p.elements.length > 1;
        if (node.variable && !isAnchor) {
          variables.push(node.variable);
        }
        isFirst = false;
      } else if (element.type === "EdgePattern") {
        const edge = element as EdgePattern;
        if (edge.variable) variables.push(edge.variable);
        isFirst = false;
      } else if (element.type === "ParenthesizedPathPattern") {
        // Recursively extract variables from the inner pattern
        const parenthesized = element as ParenthesizedPathPattern;
        variables.push(...extractPatternVariables(parenthesized.pattern, false));
        isFirst = false;
      }
    }
  }

  return variables;
}

/**
 * Alias information from RETURN clause items.
 * Maps alias names to their underlying property access paths.
 */
interface AliasInfo {
  variable: string;
  property?: string;
}

/**
 * Build a map of aliases from RETURN clause items.
 * Maps alias name → underlying variable/property info.
 */
function buildReturnAliasMap(returnClause: ReturnClause | undefined): Map<string, AliasInfo> {
  const aliasMap = new Map<string, AliasInfo>();
  if (!returnClause) return aliasMap;

  for (const item of returnClause.items) {
    if (item.alias) {
      // Alias explicitly specified
      aliasMap.set(item.alias, {
        variable: item.variable ?? "",
        property: item.property,
      });
    } else if (item.variable && !item.property) {
      // Plain variable reference like RETURN n (alias is implicitly 'n')
      aliasMap.set(item.variable, {
        variable: item.variable,
      });
    } else if (item.variable && item.property) {
      // Property access like RETURN n.name (no explicit alias)
      // In Cypher, you can reference this by the property name alone
      aliasMap.set(item.property, {
        variable: item.variable,
        property: item.property,
      });
    }
  }

  return aliasMap;
}

/**
 * Build a map of aliases from WITH clause items.
 * Maps alias name → underlying variable/property info.
 */
function buildWithAliasMap(items: WithItem[]): Map<string, AliasInfo> {
  const aliasMap = new Map<string, AliasInfo>();

  for (const item of items) {
    const expr = item.expression;
    // Handle null literal: WITH null AS x
    if (expr === null) {
      aliasMap.set(item.alias, {
        variable: item.alias,
      });
    } else if (expr.type === "VariableRef") {
      // Variable reference like `WITH n` or `WITH n AS alias`
      aliasMap.set(item.alias, {
        variable: expr.variable,
      });
    } else if (expr.type === "PropertyAccess") {
      // Property access like `WITH n.name AS name`
      aliasMap.set(item.alias, {
        variable: expr.variable,
        property: expr.property,
      });
    } else {
      // Complex expression (WithAggregate, FunctionCall) - just track the alias itself
      aliasMap.set(item.alias, {
        variable: item.alias,
      });
    }
  }

  return aliasMap;
}

/**
 * Resolve an ORDER BY item to a direction config for OrderStep.
 * Handles both property access (n.name) and alias references (value).
 *
 * @param useAliasDirectly - If true (WITH ORDER BY), use the alias as the key since
 *   the path has the alias bound after projection. If false (RETURN ORDER BY), use
 *   the source property/variable since ordering happens before projection.
 */
function resolveOrderItem(
  order: OrderItem,
  aliasMap: Map<string, AliasInfo>,
  useAliasDirectly: boolean = false,
): {
  key?: string;
  expression?: ConditionValue;
  direction: OrderDirection;
  nulls?: "first" | "last";
} {
  const base =
    order.expression !== undefined
      ? {
          expression: useAliasDirectly
            ? convertConditionValue(order.expression)
            : resolveReturnOrderExpression(order.expression, aliasMap),
        }
      : {
          key: resolveOrderKey(order, aliasMap, useAliasDirectly),
        };

  return {
    ...base,
    direction: order.direction.toLowerCase() as OrderDirection,
    ...(order.nulls && {
      nulls: order.nulls.toLowerCase() as "first" | "last",
    }),
  };
}

function resolveOrderKey(
  order: OrderItem,
  aliasMap: Map<string, AliasInfo>,
  useAliasDirectly: boolean,
): string | undefined {
  if (order.alias) {
    if (useAliasDirectly) {
      // WITH ORDER BY: use alias directly since path has it bound after projection
      return order.alias;
    }

    // RETURN ORDER BY: look up source property/variable
    const aliasInfo = aliasMap.get(order.alias);
    if (aliasInfo?.property) {
      return aliasInfo.property;
    }
    if (aliasInfo) {
      return aliasInfo.variable;
    }
    return order.alias;
  }

  // ORDER BY variable.property - use property as key
  return order.property;
}

function resolveReturnOrderExpression(
  expression: Exclude<OrderItem["expression"], undefined>,
  aliasMap: Map<string, AliasInfo>,
): ConditionValue {
  return rewriteOrderAliases(convertConditionValue(expression), aliasMap);
}

function rewriteOrderAliases(
  value: ConditionValue,
  aliasMap: Map<string, AliasInfo>,
): ConditionValue {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  switch (value.type) {
    case "variableRef": {
      const aliasInfo = aliasMap.get(value.variable);
      if (!aliasInfo) {
        return value;
      }
      if (aliasInfo.property) {
        return {
          type: "propertyRef",
          variable: aliasInfo.variable,
          property: aliasInfo.property,
        };
      }
      return {
        type: "variableRef",
        variable: aliasInfo.variable,
      };
    }
    case "pathRef": {
      const aliasInfo = aliasMap.get(value.variable);
      if (!aliasInfo || aliasInfo.property) {
        return value;
      }
      return {
        type: "pathRef",
        variable: aliasInfo.variable,
      };
    }
    case "propertyRef":
      return value;
    case "parameterRef":
    case "null":
      return value;
    case "arithmeticExpression":
      return {
        ...value,
        left: rewriteOrderAliases(value.left, aliasMap),
        right: rewriteOrderAliases(value.right, aliasMap),
      };
    case "unaryExpression":
      return {
        ...value,
        operand: rewriteOrderAliases(value.operand, aliasMap),
      };
    case "booleanExpression":
      if (value.operator === "NOT") {
        return {
          ...value,
          operand: rewriteOrderAliases(value.operand, aliasMap),
        };
      }
      return {
        ...value,
        left: rewriteOrderAliases(value.left, aliasMap),
        right: rewriteOrderAliases(value.right, aliasMap),
      };
    case "comparisonExpression":
      if (value.operator === "IS NULL" || value.operator === "IS NOT NULL") {
        return {
          type: "comparisonExpression",
          operator: value.operator,
          left: rewriteOrderAliases(value.left, aliasMap),
        };
      }
      if (!("right" in value)) {
        return value;
      }
      return {
        type: "comparisonExpression",
        operator: value.operator,
        left: rewriteOrderAliases(value.left, aliasMap),
        right: rewriteOrderAliases(value.right, aliasMap),
      };
    case "functionCall":
      return {
        ...value,
        args: value.args.map((arg) => rewriteOrderAliases(arg, aliasMap)),
      };
    case "simpleCaseExpression":
      return {
        ...value,
        test: rewriteOrderAliases(value.test, aliasMap),
        alternatives: value.alternatives.map((alternative) => ({
          when: rewriteOrderAliases(alternative.when, aliasMap),
          then: rewriteOrderAliases(alternative.then, aliasMap),
        })),
        ...(value.else !== undefined && {
          else: rewriteOrderAliases(value.else, aliasMap),
        }),
      };
    case "searchedCaseExpression":
      return {
        ...value,
        alternatives: value.alternatives.map((alternative) => ({
          when: alternative.when,
          then: rewriteOrderAliases(alternative.then, aliasMap),
        })),
        ...(value.else !== undefined && {
          else: rewriteOrderAliases(value.else, aliasMap),
        }),
      };
    case "listLiteral":
      return {
        ...value,
        values: value.values.map((entry) => rewriteOrderAliases(entry, aliasMap)),
      };
    case "mapLiteral":
      return {
        ...value,
        entries: value.entries.map((entry) => ({
          key: entry.key,
          value: rewriteOrderAliases(entry.value, aliasMap),
        })),
      };
    case "listIndexExpression":
      return {
        ...value,
        list: rewriteOrderAliases(value.list, aliasMap),
        index: rewriteOrderAliases(value.index, aliasMap),
      };
    case "sliceExpression":
      return {
        ...value,
        list: rewriteOrderAliases(value.list, aliasMap),
        ...(value.start !== undefined && {
          start: rewriteOrderAliases(value.start, aliasMap),
        }),
        ...(value.end !== undefined && {
          end: rewriteOrderAliases(value.end, aliasMap),
        }),
      };
    case "listComprehension":
      return {
        ...value,
        list: rewriteOrderAliases(value.list, aliasMap),
        ...(value.projection !== undefined && {
          projection: rewriteOrderAliases(value.projection, aliasMap),
        }),
      };
    case "quantifierExpression":
      return {
        ...value,
        list: rewriteOrderAliases(value.list, aliasMap),
      };
    case "reduceExpression":
      return {
        ...value,
        init: rewriteOrderAliases(value.init, aliasMap),
        list: rewriteOrderAliases(value.list, aliasMap),
        expression: rewriteOrderAliases(value.expression, aliasMap),
      };
    case "dynamicPropertyAccess":
      return {
        ...value,
        object: rewriteOrderAliases(value.object, aliasMap),
        property: rewriteOrderAliases(value.property, aliasMap),
      };
    case "patternComprehension":
      return {
        ...value,
        projection: rewriteOrderAliases(value.projection, aliasMap),
      };
    case "mapProjection":
      return {
        ...value,
        selectors: value.selectors.map((selector) => {
          if (selector.type !== "literalEntry") {
            return selector;
          }
          return {
            ...selector,
            value: rewriteOrderAliases(selector.value, aliasMap),
          };
        }),
      };
    case "existsSubquery":
      return value;
    case "memberAccess":
      return {
        ...value,
        object: rewriteOrderAliases(value.object, aliasMap),
      };
  }
}
