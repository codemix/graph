import type { Query, UnionQuery, MultiStatement } from "./AST.js";
import { astToSteps, anyAstToSteps } from "./astToSteps.js";
import { parse } from "./grammar.js";
import { Step, ContainerStep } from "./Steps.js";
import { ReadonlyGraphError } from "./Exceptions.js";

export * from "./Exceptions.js";
export * from "./Graph.js";
export * from "./AsyncGraph.js";
export * from "./GraphSchema.js";
export * from "./GraphStorage.js";
export * from "./Traversals.js";
export * from "./Steps.js";
export * from "./indexes/index.js";
export type {
  Query,
  UnionQuery,
  MultiStatement,
  MatchClause,
  WhereClause,
  ReturnClause,
  ReturnItem,
  OrderByClause,
  OrderItem,
  Pattern,
  PatternElement,
  NodePattern,
  EdgePattern,
  Quantifier,
  PropertyCondition,
  ExistsCondition,
  AndCondition,
  OrCondition,
  Condition as ASTCondition,
  Literal,
  ShortestPathPattern,
  CreateClause,
  CreateNodePattern,
  ParameterRef,
  ArithmeticExpression,
  ArithmeticOperator,
  UnaryExpression,
  Expression,
  FunctionCall,
  UnwindClause,
  UnwindExpression as ASTUnwindExpression,
  SimpleCaseExpression,
  SearchedCaseExpression,
  CaseAlternative,
  SearchedCaseAlternative,
  ListLiteralExpr,
  ListIndexExpression,
  SliceExpression,
  ListComprehension,
  PatternComprehension,
  QuantifierExpression,
  ReduceExpression,
  DynamicPropertyAccess,
  MapProjection,
  MapProjectionSelector,
  MapPropertySelector,
  MapLiteralEntry,
  MapAllPropertiesSelector,
  MapVariableSelector,
  ExistsSubquery,
  LabelExpression,
  LabelName,
  LabelOr,
  LabelAnd,
  LabelNot,
  LabelWildcard,
  ParenthesizedPathPattern,
  SetClause,
  SetAssignment,
  SetAllProperties,
  SetAddProperties,
  SetValue,
  PropertyValue,
  PropertyMap,
  IsLabeledCondition,
  CallClause,
  YieldItem,
} from "./AST.js";
export { astToSteps, unionAstToSteps, anyAstToSteps, multiStatementToSteps } from "./astToSteps.js";
export { parse } from "./grammar.js";
export * from "./generateSchemaGuide.js";
export {
  FunctionRegistry,
  functionRegistry,
  evaluateFunction,
  isBuiltinFunction,
  isAggregateFunction,
  functionArgExpectsPath,
} from "./FunctionRegistry.js";
export type {
  FunctionDefinition,
  FunctionCallContext,
  FunctionArgSpec,
} from "./FunctionRegistry.js";
export { ProcedureRegistry, procedureRegistry, isBuiltinProcedure } from "./ProcedureRegistry.js";
export type {
  ProcedureDefinition,
  ProcedureParamSpec,
  ProcedureYieldSpec,
  ProcedureCallContext,
} from "./ProcedureRegistry.js";

/**
 * Mutation step names that modify the graph.
 */
const MUTATION_STEP_NAMES = new Set(["Create", "Set", "Delete", "Remove", "Merge", "Foreach"]);

/**
 * Validates that a step array contains no mutation steps.
 * Recursively checks ContainerStep subclasses for nested mutations.
 * @throws ReadonlyGraphError if a mutation step is found.
 */
function validateNoMutations(steps: readonly Step<any>[]): void {
  for (const step of steps) {
    if (MUTATION_STEP_NAMES.has(step.name)) {
      throw new ReadonlyGraphError(step.name);
    }
    if (step instanceof ContainerStep) {
      validateNoMutations(step.steps);
    }
  }
}

export interface ParseQueryToStepsOptions {
  /**
   * When true, validates that the query contains no mutation steps.
   * @throws ReadonlyGraphError if mutation steps are found.
   */
  readonly?: boolean;
}

/**
 * Parse a query string and convert it to steps in one call.
 * Supports regular queries, UNION queries, and multi-statement queries (semicolon-separated).
 *
 * @param queryString The query string to parse.
 * @param options Optional configuration.
 * @param options.readonly When true, throws ReadonlyGraphError if the query contains mutation steps.
 */
export function parseQueryToSteps(
  queryString: string,
  options?: ParseQueryToStepsOptions,
): {
  steps: readonly Step<any>[];
  postprocess: (row: readonly unknown[]) => Record<string, unknown>;
} {
  const ast = parse(queryString) as Query | UnionQuery | MultiStatement;
  const steps = anyAstToSteps(ast);

  if (options?.readonly) {
    validateNoMutations(steps);
  }

  return { steps, postprocess: createPostprocessor(ast) };
}

/**
 * Creates a function which takes the array of values returned by the graph traversal
 * and returns an object with the values mapped to the variable names in the RETURN clause.
 *
 * When multiple properties from the same variable are returned (e.g., `RETURN c.name, c.description`),
 * they are grouped under that variable as an object with property names as keys:
 * `{c: {name: "...", description: "..."}}`
 *
 * When an alias is specified (e.g., `RETURN c.name AS cName`), the alias is used as the key.
 *
 * For multi-statement queries, the postprocessor passes through the result object as-is
 * since each statement has its own schema and includes a `_statementIndex` property.
 *
 * @param ast The AST of the query (Query, UnionQuery, or MultiStatement).
 */
function createPostprocessor(
  ast: Query | UnionQuery | MultiStatement,
): (row: readonly unknown[]) => Record<string, unknown> {
  // For multi-statement queries, pass through results as-is
  // (each statement has different schema, results include _statementIndex)
  if (ast.type === "MultiStatement") {
    return (row) => {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        return row as unknown as Record<string, unknown>;
      }
      return { _value: row };
    };
  }

  // For union queries, use the first query's RETURN clause for variable names
  // (all queries in a UNION must return the same columns)
  const query = ast.type === "UnionQuery" ? ast.queries[0]! : ast;

  // For mutation-only queries without RETURN, return empty object
  if (!query.return) {
    return () => ({});
  }

  const items = query.return.items;

  // Build a map of output key -> list of {index, property}
  // This groups properties that should be merged under the same key
  const keyMapping = new Map<string, Array<{ index: number; property: string | undefined }>>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    // Use alias if present, otherwise use variable name, or generate a key for expressions
    let key: string;
    if (item.alias) {
      key = item.alias;
    } else if (item.variable) {
      key = item.variable;
    } else if (item.expression) {
      // For expression-based items without alias, generate a key
      key = `expr_${i}`;
    } else {
      key = `item_${i}`;
    }
    if (!keyMapping.has(key)) {
      keyMapping.set(key, []);
    }
    keyMapping.get(key)!.push({ index: i, property: item.property });
  }

  return (row) => {
    // Normalize row to array for aggregate-only queries that yield raw values
    // (e.g., COUNT yields a number, not an array)
    const normalizedRow = Array.isArray(row) ? row : [row];
    const result: Record<string, unknown> = {};

    for (const [key, mappings] of keyMapping) {
      if (mappings.length === 1) {
        // Single mapping for this key - return value directly
        const mapping = mappings[0]!;
        if (mapping.property !== undefined) {
          // Property access: wrap in object with property name
          result[key] = { [mapping.property]: normalizedRow[mapping.index] };
        } else {
          // No property: return value directly
          result[key] = normalizedRow[mapping.index];
        }
      } else {
        // Multiple mappings for same key - group properties into object
        const grouped: Record<string, unknown> = {};
        for (const mapping of mappings) {
          if (mapping.property !== undefined) {
            grouped[mapping.property] = normalizedRow[mapping.index];
          } else {
            // No property specified but grouped with others - use full value
            // This handles mixed cases like `RETURN c, c.name`
            grouped["_value"] = normalizedRow[mapping.index];
          }
        }
        result[key] = grouped;
      }
    }

    return result;
  };
}
