// AST Node Types for Graph Query Language

/**
 * A query segment represents a portion of a query bounded by WITH clauses.
 * This allows flexible clause ordering like: MATCH...CREATE...WITH...MATCH...CREATE...
 */
export interface QuerySegment {
  matches?: MatchClause[];
  unwind?: UnwindClause[];
  call?: CallClause[];
  foreach?: ForeachClause[];
  mutations?: (MergeClause | CreateClause)[];
  set?: SetClause;
  remove?: RemoveClause;
  delete?: DeleteClause;
  with?: WithClause[];
}

// Root Query Node
export interface Query {
  type: "Query";
  matches: MatchClause[];
  with?: WithClause[];
  unwind?: UnwindClause[];
  call?: CallClause[];
  foreach?: ForeachClause[];
  merge?: MergeClause[];
  create?: CreateClause;
  /** Mutations in their original order (for correct execution sequencing) */
  mutations?: (MergeClause | CreateClause)[];
  set?: SetClause;
  remove?: RemoveClause;
  delete?: DeleteClause;
  return?: ReturnClause; // Optional for mutation-only queries
  groupBy?: GroupByClause;
  orderBy?: OrderByClause;
  skip?: number;
  limit?: number;
  /** Query segments for proper execution ordering with flexible clause order */
  segments?: QuerySegment[];
}

/**
 * Union Query - combines results from multiple queries using UNION or UNION ALL.
 * UNION removes duplicates, UNION ALL keeps all results including duplicates.
 *
 * @example
 * ```cypher
 * MATCH (n:A) RETURN n.name
 * UNION
 * MATCH (n:B) RETURN n.name
 * ```
 */
export interface UnionQuery {
  type: "UnionQuery";
  /** The queries to combine (at least 2) */
  queries: Query[];
  /** Whether this is UNION ALL (true) or UNION (false, removes duplicates) */
  all: boolean;
}

/**
 * Multi-Statement - multiple semicolon-separated statements executed sequentially.
 * Each statement is executed independently and results are concatenated.
 *
 * @example
 * ```cypher
 * MATCH (n) RETURN count(n) AS total;
 * MATCH (n:Person) RETURN n.name AS name
 * ```
 */
export interface MultiStatement {
  type: "MultiStatement";
  /** The individual statements (Query or UnionQuery) */
  statements: (Query | UnionQuery)[];
}

// WITH Clause - intermediate projection for query composition
export interface WithClause {
  type: "WithClause";
  distinct: boolean;
  items: WithItem[];
  orderBy?: OrderByClause;
  skip?: number;
  limit?: number;
  where?: WhereClause;
}

export interface WithItem {
  type: "WithItem";
  expression: WithExpression;
  alias: string;
}

// WithExpression can be a variable reference, property access, aggregate, function call, list literal,
// arithmetic expression, parameter, or other general expressions
export type WithExpression =
  | VariableRef
  | PropertyAccess
  | WithAggregate
  | FunctionCall
  | ListLiteralExpr
  | ArithmeticExpression
  | ParameterRef;

export interface WithAggregate {
  type: "WithAggregate";
  function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX" | "COLLECT";
  variable: string;
  property?: string;
}

// UNWIND Clause - expands a list into individual rows
export interface UnwindClause {
  type: "UnwindClause";
  expression: UnwindExpression;
  alias: string;
}

/**
 * CALL clause - invokes a procedure and optionally yields columns.
 * Syntax: CALL procedure.name(args) [YIELD column [AS alias], ...]
 *
 * Examples:
 * - CALL db.labels() YIELD label
 * - CALL db.propertyKeys() YIELD propertyKey AS key
 * - CALL myproc(arg1, arg2) YIELD result
 * - CALL myproc() (standalone call without YIELD)
 */
export interface CallClause {
  type: "CallClause";
  /** The procedure name (may include namespace like db.labels) */
  procedure: string;
  /** Arguments to pass to the procedure */
  arguments: Expression[];
  /** Optional YIELD clause for specifying which columns to return */
  yield?: YieldItem[];
}

/**
 * A single item in a YIELD clause.
 * Syntax: column [AS alias]
 */
export interface YieldItem {
  /** The column name to yield from the procedure result */
  name: string;
  /** Optional alias for the yielded column */
  alias?: string;
}

// NullLiteral expression (for UNWIND null, etc.)
export interface NullLiteralExpr {
  type: "NullLiteral";
  value: null;
}

// UnwindExpression can be a list literal, null, property access, variable reference, parameter, function call, or arithmetic expression
export type UnwindExpression =
  | ListLiteralExpr
  | NullLiteralExpr
  | PropertyAccess
  | VariableRef
  | ParameterRef
  | FunctionCall
  | ArithmeticExpression;

// CREATE Clause
export interface CreateClause {
  type: "CreateClause";
  patterns: Array<CreateNodePattern | CreateChainPattern>;
}

export interface CreateNodePattern {
  type: "CreateNodePattern";
  variable?: string;
  labels: string[];
  properties?: PropertyMap;
}

/**
 * A variable reference in a CREATE pattern, referring to an existing node
 * (either from MATCH or created earlier in the same CREATE clause).
 */
export interface CreateVariableRef {
  type: "CreateVariableRef";
  variable: string;
}

/**
 * A chain of nodes and edges in a CREATE pattern.
 * Supports patterns like: (t)-[:Contains]->(:Attr {props})-[:IsA]->(s)
 * Elements alternate between nodes (CreateNodePattern | CreateVariableRef) and edges (CreateEdgePattern).
 */
export interface CreateChainPattern {
  type: "CreateChainPattern";
  elements: CreateChainElement[];
}

export type CreateChainElement =
  | CreateNodePattern
  | CreateVariableRef
  | CreateEdgePattern;

export interface CreateEdgePattern {
  type: "CreateEdgePattern";
  variable?: string;
  label: string;
  direction: "in" | "out";
  properties: PropertyMap;
}

// DELETE Clause
export interface DeleteClause {
  type: "DeleteClause";
  detach: boolean;
  variables: string[];
}

// REMOVE Clause
export interface RemoveClause {
  type: "RemoveClause";
  items: RemoveItem[];
}

export type RemoveItem = RemovePropertyItem | RemoveLabelItem;

export interface RemovePropertyItem {
  type: "RemoveProperty";
  variable: string;
  property: string;
}

export interface RemoveLabelItem {
  type: "RemoveLabel";
  variable: string;
  label: string;
}

// MERGE Clause
export interface MergeClause {
  type: "MergeClause";
  pattern: NodePattern | MergeRelationshipPattern;
  onCreate?: { assignments: SetAssignment[] };
  onMatch?: { assignments: SetAssignment[] };
}

export interface MergeRelationshipPattern {
  type: "MergeRelationshipPattern";
  startVariable: string;
  edge: MergeEdgePattern;
  endVariable: string;
}

export interface MergeEdgePattern {
  type: "MergeEdgePattern";
  variable?: string;
  label: string;
  direction: "in" | "out";
  properties: PropertyMap;
}

// SET Clause (standalone mutation)
// Supports individual property assignments (n.prop = value),
// full property replacement (n = {props}), and property merging (n += {props})
export interface SetClause {
  type: "SetClause";
  assignments: (SetAssignment | SetAllProperties | SetAddProperties)[];
}

// Clauses
export interface MatchClause {
  type: "MatchClause";
  pattern: Pattern | ShortestPathPattern | MultiPattern;
  where?: WhereClause;
  optional?: boolean;
}

export interface WhereClause {
  type: "WhereClause";
  condition: Condition;
}

export interface ReturnClause {
  type: "ReturnClause";
  distinct: boolean;
  items: ReturnItem[];
  returnAll?: boolean;
}

export interface ReturnItem {
  type: "ReturnItem";
  variable?: string;
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
  /** General expression (when not using legacy variable/property/aggregate format) */
  expression?: Expression;
}

export interface OrderByClause {
  type: "OrderByClause";
  orders: OrderItem[];
}

export interface GroupByClause {
  type: "GroupByClause";
  items: GroupByItem[];
}

export interface GroupByItem {
  type: "GroupByItem";
  variable: string;
  property?: string;
  function?: "labels" | "type";
}

export interface OrderItem {
  variable?: string;
  property?: string;
  alias?: string;
  expression?: ArithmeticExpression | FunctionCall | Literal | ParameterRef;
  direction: "ASC" | "DESC";
  nulls?: "FIRST" | "LAST";
}

// FOREACH Clause
export interface ForeachClause {
  type: "ForeachClause";
  variable: string;
  listExpression: ListExpression;
  operations: ForeachOperation[];
}

export type ListExpression =
  | PropertyAccess
  | ListLiteralExpr
  | FunctionCall
  | VariableRef;

export interface PropertyAccess {
  type: "PropertyAccess";
  variable: string;
  property: string;
}

export interface ListLiteralExpr {
  type: "ListLiteral";
  /** List values - can be literals or expressions when used in WHERE conditions */
  values: (Literal | Expression)[];
}

export interface MapLiteralExpr {
  type: "MapLiteral";
  /** Map entries - key-value pairs */
  entries: MapLiteralEntry[];
}

export interface MapLiteralEntry {
  type: "MapLiteralEntry";
  key: string;
  value: Expression;
}

export type ForeachOperation = SetOperation | MatchClause | DeleteOperation;

/**
 * Delete operation inside FOREACH clause.
 * Supports both DELETE and DETACH DELETE.
 */
export interface DeleteOperation {
  type: "DeleteOperation";
  detach: boolean;
  variables: string[];
}

export interface SetOperation {
  type: "SetOperation";
  assignments: SetAssignment[];
}

export interface SetAssignment {
  variable: string;
  property: string;
  value: SetValue;
}

/**
 * Set all properties on a node or relationship, replacing all existing properties.
 * Syntax: SET n = {name: 'Alice', age: 30}
 * This replaces ALL properties on the element with the given map.
 */
export interface SetAllProperties {
  type: "SetAllProperties";
  variable: string;
  properties: PropertyMap | ParameterRef;
}

/**
 * Add/merge properties into a node or relationship's existing properties.
 * Syntax: SET n += {name: 'Alice', age: 30}
 * This adds/updates the specified properties while preserving others.
 */
export interface SetAddProperties {
  type: "SetAddProperties";
  variable: string;
  properties: PropertyMap | ParameterRef;
}

export type SetValue =
  | Literal
  | PropertyAccess
  | VariableRef
  | ParameterRef
  | ListLiteralExpr
  | NestedMap;

export interface VariableRef {
  type: "VariableRef";
  variable: string;
}

/**
 * A reference to a query parameter using $paramName syntax.
 * Parameters are resolved at query execution time from the params object.
 */
export interface ParameterRef {
  type: "ParameterRef";
  name: string;
}

// Pattern Nodes
export interface Pattern {
  type: "Pattern";
  elements: PatternElement[];
  /** Optional path variable name when pattern is bound (e.g., p = (a)-[r]->(b)) */
  pathVariable?: string;
}

/**
 * Parenthesized path pattern with optional inline WHERE condition.
 * Syntax: ((a)-[r]->(b) WHERE r.weight > 10)
 *
 * This allows grouping patterns with conditions that are evaluated during
 * pattern matching, as opposed to the main WHERE clause which is evaluated
 * after all patterns are matched.
 *
 * Can be used in quantified patterns:
 * - MATCH (a) (()-[:KNOWS]->())+ (b) - path of one or more KNOWS hops
 * - MATCH (a) ((n)-[:R]->(m) WHERE n.x = m.x)+ (b) - with inline condition
 *
 * @example
 * ```cypher
 * MATCH (a)-[r]->((b) WHERE b.active = true)-[s]->(c)
 * MATCH (a) ((n)-[:KNOWS]->(m) WHERE m.age > 21)+ (b)
 * ```
 */
export interface ParenthesizedPathPattern {
  type: "ParenthesizedPathPattern";
  /** The inner pattern to match */
  pattern: Pattern;
  /** Optional WHERE condition to filter during pattern matching */
  where?: Condition;
  /** Optional quantifier for the parenthesized pattern (+, *, {n}, {n,m}) */
  quantifier?: Quantifier;
}

/**
 * Represents multiple comma-separated patterns in a MATCH clause.
 * Used for cross-product matching where multiple independent patterns
 * need to be matched simultaneously.
 *
 * @example
 * ```cypher
 * MATCH (a:User), (b:Post) RETURN a, b
 * ```
 *
 * This creates a Cartesian product of all Users and Posts.
 *
 * Note: Currently only supports simple node patterns. Patterns with edges
 * (e.g., `MATCH (a)-[:KNOWS]-(b), (c)`) are not supported in comma-separated form.
 * Use separate MATCH clauses for patterns with relationships.
 */
export interface MultiPattern {
  type: "MultiPattern";
  /** The individual patterns to match (cross-product) */
  patterns: Pattern[];
}

export type PatternElement =
  | NodePattern
  | EdgePattern
  | ParenthesizedPathPattern;

export interface NodePattern {
  type: "NodePattern";
  variable?: string;
  labels: string[];
  /** Advanced label expression (when labels array is empty, use this) */
  labelExpression?: LabelExpression;
  properties?: PropertyMap;
}

/**
 * A nested map (object) as a property value.
 * Allows object-valued properties like {schema: {type: "string"}}.
 */
export interface NestedMap {
  type: "NestedMap";
  value: { [key: string]: PropertyValue };
}

/**
 * Property value in a property map - can be a literal, a parameter reference, or a nested map.
 * Parameter references (e.g., $name) are resolved at query execution time.
 * Nested maps allow object-valued properties like {schema: {type: "string"}}.
 */
export type PropertyValue =
  | Literal
  | ParameterRef
  | NestedMap
  | ListLiteralExpr;

/**
 * Property map for node and relationship patterns.
 * Values can be literal values or parameter references.
 * Example: {name: 'Alice', age: $ageParam}
 */
export interface PropertyMap {
  [key: string]: PropertyValue;
}

export interface EdgePattern {
  type: "EdgePattern";
  variable?: string | null;
  labels: string[];
  /** Advanced label expression (when labels array is empty, use this) */
  labelExpression?: LabelExpression;
  direction: "out" | "in" | "both";
  quantifier?: Quantifier;
  properties?: PropertyMap;
}

export interface Quantifier {
  type: "Quantifier";
  min?: number;
  max?: number;
}

// Advanced label expressions for complex label matching
// Supports: :A|B (OR), :A&B (AND), :!A (NOT), :% (wildcard), parenthesized
export type LabelExpression =
  | LabelName
  | LabelOr
  | LabelAnd
  | LabelNot
  | LabelWildcard;

/** Single label identifier */
export interface LabelName {
  type: "LabelName";
  name: string;
}

/** OR of two label expressions: :A|B */
export interface LabelOr {
  type: "LabelOr";
  left: LabelExpression;
  right: LabelExpression;
}

/** AND of two label expressions: :A&B */
export interface LabelAnd {
  type: "LabelAnd";
  left: LabelExpression;
  right: LabelExpression;
}

/** NOT of a label expression: :!A */
export interface LabelNot {
  type: "LabelNot";
  expression: LabelExpression;
}

/** Wildcard matching any label: :% */
export interface LabelWildcard {
  type: "LabelWildcard";
}

// Condition value types - can be literal, property access, variable reference, parameter reference, arithmetic expression, boolean expression, comparison expression, function call, CASE expression, list literal, map literal, list index, slice, list comprehension, pattern comprehension, quantifier expression, reduce expression, dynamic property access, map projection, or exists subquery
export type ConditionValue =
  | Literal
  | PropertyAccess
  | VariableRef
  | ParameterRef
  | ArithmeticExpression
  | UnaryExpression
  | BooleanExpression
  | ComparisonExpression
  | FunctionCall
  | SimpleCaseExpression
  | SearchedCaseExpression
  | ListLiteralExpr
  | MapLiteralExpr
  | ListIndexExpression
  | SliceExpression
  | ListComprehension
  | PatternComprehension
  | QuantifierExpression
  | ReduceExpression
  | DynamicPropertyAccess
  | MemberAccess
  | MapProjection
  | ExistsSubquery;

// Conditions
export interface PropertyCondition {
  type: "PropertyCondition";
  variable: string;
  property: string;
  operator: "=" | "!=" | "<" | "<=" | ">" | ">=";
  value: ConditionValue;
}

export interface ExistsCondition {
  type: "ExistsCondition";
  variable: string;
  property: string;
}

export interface AndCondition {
  type: "AndCondition";
  left: Condition;
  right: Condition;
}

export interface OrCondition {
  type: "OrCondition";
  left: Condition;
  right: Condition;
}

export interface XorCondition {
  type: "XorCondition";
  left: Condition;
  right: Condition;
}

export interface NotCondition {
  type: "NotCondition";
  condition: Condition;
}

export interface InCondition {
  type: "InCondition";
  variable: string;
  property: string;
  values: Literal[];
}

export interface IsNullCondition {
  type: "IsNullCondition";
  variable: string;
  property: string;
  negated: boolean;
}

export interface RegexCondition {
  type: "RegexCondition";
  variable: string;
  property: string;
  pattern: string;
}

export interface StringPredicateCondition {
  type: "StringPredicateCondition";
  variable: string;
  property: string;
  predicate: "STARTS WITH" | "ENDS WITH" | "CONTAINS";
  value: string;
}

/**
 * General expression comparison condition.
 * Supports comparing any two expressions (e.g., n.age + 5 > m.age * 2).
 */
export interface ExpressionCondition {
  type: "ExpressionCondition";
  left: ConditionValue;
  operator: "=" | "!=" | "<" | "<=" | ">" | ">=";
  right: ConditionValue;
}

/**
 * IS LABELED condition - checks if a node/relationship has a specific label/type.
 * Syntax: variable IS :Label or variable IS :A|B (with label expression)
 *
 * Examples:
 * - n IS :Person - true if n has the Person label
 * - n IS :Person|Admin - true if n has Person OR Admin label
 * - n IS :!Person - true if n does NOT have Person label
 *
 * The negated form uses NOT: NOT n IS :Person or n IS NOT :Person
 */
export interface IsLabeledCondition {
  type: "IsLabeledCondition";
  /** The variable to check */
  variable: string;
  /** The label expression to match against */
  labelExpression: LabelExpression;
}

export type Condition =
  | PropertyCondition
  | ExistsCondition
  | AndCondition
  | OrCondition
  | XorCondition
  | NotCondition
  | InCondition
  | IsNullCondition
  | RegexCondition
  | StringPredicateCondition
  | ExpressionCondition
  | IsLabeledCondition;

// Shortest Path Pattern
export interface ShortestPathPattern {
  type: "ShortestPathPattern";
  /**
   * Variable to bind the path result to.
   */
  variable?: string;
  /**
   * The source node pattern.
   */
  source: NodePattern;
  /**
   * The target node pattern.
   */
  target: NodePattern;
  /**
   * The edge pattern connecting source to target.
   */
  edge: EdgePattern;
  /**
   * Whether to find all shortest paths (allShortestPaths) or just one (shortestPath).
   */
  all?: boolean;
}

// Arithmetic Expressions
export type ArithmeticOperator = "+" | "-" | "*" | "/" | "%" | "^";

export interface ArithmeticExpression {
  type: "ArithmeticExpression";
  operator: ArithmeticOperator;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  type: "UnaryExpression";
  operator: "+" | "-";
  operand: Expression;
}

// Boolean Expressions (for RETURN clause boolean operations)
export type BooleanOperator = "AND" | "OR" | "XOR" | "NOT";

export interface BooleanExpression {
  type: "BooleanExpression";
  operator: BooleanOperator;
  left?: Expression;
  right?: Expression;
  operand?: Expression; // For NOT operator
}

// Comparison Expressions (for RETURN clause comparisons)
export type ComparisonOperatorType =
  | "="
  | "<>"
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "IS NULL"
  | "IS NOT NULL"
  | "IN"
  | "NOT IN";

export interface ComparisonExpression {
  type: "ComparisonExpression";
  operator: ComparisonOperatorType;
  left: Expression;
  right?: Expression; // Optional for IS NULL / IS NOT NULL
}

/**
 * A function call expression.
 * Supports both scalar functions (toLower, abs, etc.) and aggregate functions (count, sum, etc.).
 * The DISTINCT modifier is only valid for aggregate functions.
 */
export interface FunctionCall {
  type: "FunctionCall";
  /** The function name (case-insensitive) */
  name: string;
  /** Function arguments */
  args: Expression[];
  /** Whether DISTINCT was specified (for aggregate functions) */
  distinct: boolean;
}

/**
 * Simple CASE expression: CASE test WHEN value THEN result ... [ELSE default] END
 * Compares a test expression against a series of values.
 */
export interface SimpleCaseExpression {
  type: "SimpleCaseExpression";
  /** The expression to test */
  test: Expression;
  /** When-then alternatives */
  alternatives: CaseAlternative[];
  /** Optional else result */
  else?: Expression;
}

/**
 * Searched CASE expression: CASE WHEN condition THEN result ... [ELSE default] END
 * Evaluates a series of boolean conditions.
 */
export interface SearchedCaseExpression {
  type: "SearchedCaseExpression";
  /** When-then alternatives with boolean conditions */
  alternatives: SearchedCaseAlternative[];
  /** Optional else result */
  else?: Expression;
}

/**
 * A single WHEN-THEN alternative in a simple CASE expression.
 */
export interface CaseAlternative {
  /** The value to compare against */
  when: Expression;
  /** The result if matched */
  then: Expression;
}

/**
 * A single WHEN-THEN alternative in a searched CASE expression.
 */
export interface SearchedCaseAlternative {
  /** The boolean condition to evaluate */
  when: Condition;
  /** The result if condition is true */
  then: Expression;
}

/**
 * List index expression for accessing a single element.
 * Syntax: list[index]
 * Negative indices count from the end (-1 is last element).
 */
export interface ListIndexExpression {
  type: "ListIndexExpression";
  /** The list expression to index into */
  list: Expression;
  /** The index expression */
  index: Expression;
}

/**
 * List slice expression for extracting a sublist.
 * Syntax: list[start..end]
 * Both bounds are optional:
 * - list[..end] - from start to end (exclusive)
 * - list[start..] - from start to end of list
 * - list[start..end] - from start to end (exclusive)
 * Negative indices count from the end.
 */
export interface SliceExpression {
  type: "SliceExpression";
  /** The list expression to slice */
  list: Expression;
  /** Optional start index (defaults to 0) */
  start?: Expression;
  /** Optional end index (defaults to list length) */
  end?: Expression;
}

/**
 * Dynamic property access expression.
 * Syntax: node['propName'] or node[expr]
 * Accesses a property whose name is determined at runtime.
 */
export interface DynamicPropertyAccess {
  type: "DynamicPropertyAccess";
  /** The expression to access the property from (usually a variable) */
  object: Expression;
  /** The expression that evaluates to the property name */
  property: Expression;
}

/**
 * Member access expression.
 * Syntax: expr.property
 * Accesses a named property on the result of an expression.
 * Used for temporal values (date().year) and other objects with properties.
 */
export interface MemberAccess {
  type: "MemberAccess";
  /** The expression to access the property from */
  object: Expression;
  /** The property name to access */
  property: string;
}

/**
 * List comprehension expression.
 * Syntax: [x IN list WHERE condition | projection]
 * - variable: The iteration variable (x)
 * - list: The list to iterate over
 * - filterCondition: Optional WHERE condition to filter elements
 * - projection: Optional expression to transform elements (| expr), defaults to variable
 *
 * Examples:
 * - [x IN list] - returns all elements as-is
 * - [x IN list WHERE x > 0] - filter only
 * - [x IN list | x * 2] - projection only
 * - [x IN list WHERE x > 0 | x * 2] - filter and projection
 */
export interface ListComprehension {
  type: "ListComprehension";
  /** The iteration variable name */
  variable: string;
  /** The list expression to iterate over */
  list: Expression;
  /** Optional filter condition (WHERE clause) */
  filterCondition?: Condition;
  /** Optional projection expression (| expr), defaults to the variable */
  projection?: Expression;
}

/**
 * Quantifier expression for list predicate testing.
 * Syntax: QUANTIFIER(x IN list WHERE condition)
 *
 * Quantifier types:
 * - ALL: All elements in the list satisfy the condition
 * - ANY: At least one element satisfies the condition
 * - NONE: No elements satisfy the condition
 * - SINGLE: Exactly one element satisfies the condition
 *
 * Examples:
 * - ALL(x IN list WHERE x > 0) - true if all elements > 0
 * - ANY(x IN list WHERE x > 0) - true if any element > 0
 * - NONE(x IN list WHERE x > 0) - true if no elements > 0
 * - SINGLE(x IN list WHERE x > 0) - true if exactly one element > 0
 */
export interface QuantifierExpression {
  type: "QuantifierExpression";
  /** The quantifier type */
  quantifier: "ALL" | "ANY" | "NONE" | "SINGLE";
  /** The iteration variable name */
  variable: string;
  /** The list expression to iterate over */
  list: Expression;
  /** The condition to test for each element */
  condition: Condition;
}

/**
 * Reduce expression for folding a list into a single value.
 * Syntax: REDUCE(accumulator = init, x IN list | expression)
 *
 * The reduce expression iterates over a list, maintaining an accumulator
 * that is updated by the expression on each iteration.
 *
 * Examples:
 * - REDUCE(total = 0, x IN [1,2,3] | total + x) - sums to 6
 * - REDUCE(s = '', x IN ['a','b','c'] | s + x) - concatenates to 'abc'
 * - REDUCE(product = 1, n IN list | product * n) - computes product
 */
export interface ReduceExpression {
  type: "ReduceExpression";
  /** The accumulator variable name */
  accumulator: string;
  /** The initial value for the accumulator */
  init: Expression;
  /** The iteration variable name */
  variable: string;
  /** The list expression to iterate over */
  list: Expression;
  /** The expression to evaluate on each iteration (updates the accumulator) */
  expression: Expression;
}

/**
 * Pattern comprehension expression.
 * Syntax: [variable = pattern WHERE condition | expression]
 *
 * Pattern comprehensions match a pattern and optionally filter/project the results.
 * Similar to list comprehensions but iterate over graph patterns instead of lists.
 *
 * Examples:
 * - [(a)-[:KNOWS]->(b) | b.name] - returns names of all neighbors
 * - [p = (a)-[:KNOWS]->(b) WHERE b.age > 30 | b.name] - with filter and path binding
 * - [(a)-[:KNOWS]->(b:Person) | b] - with label filtering
 */
export interface PatternComprehension {
  type: "PatternComprehension";
  /** Optional path variable name to bind the matched pattern */
  pathVariable?: string;
  /** The pattern to match */
  pattern: Pattern;
  /** Optional WHERE condition to filter matches */
  filterCondition?: Condition;
  /** The expression to evaluate for each match (required in pattern comprehensions) */
  projection: Expression;
}

/**
 * EXISTS subquery expression.
 * Syntax: EXISTS { pattern } or EXISTS { pattern WHERE condition }
 *
 * Returns true if the pattern matches at least one result in the current context.
 * The pattern is evaluated against the graph using bound variables from outer scope.
 *
 * Examples:
 * - EXISTS { (n)-[:KNOWS]->(m) } - true if n has any KNOWS relationship
 * - EXISTS { (n)-[:KNOWS]->(m:Person) } - true if n knows any Person
 * - EXISTS { (n)-[:KNOWS]->(m) WHERE m.age > 30 } - with filter condition
 */
export interface ExistsSubquery {
  type: "ExistsSubquery";
  /** The pattern to test for existence */
  pattern: Pattern;
  /** Optional WHERE condition to filter matches */
  filterCondition?: Condition;
}

/**
 * Map projection expression.
 * Syntax: variable{selector, selector, ...}
 *
 * Projects a node or relationship into a map (object) with selected properties.
 *
 * Selector types:
 * - PropertySelector: .property - includes the property with its name as key
 * - LiteralEntry: key: expr - includes expr with the given key
 * - AllPropertiesSelector: .* - includes all properties
 * - VariableSelector: variable - includes the entire variable value with its name as key
 *
 * Examples:
 * - n{.name, .age} - returns {name: n.name, age: n.age}
 * - n{.name, status: 'active'} - returns {name: n.name, status: 'active'}
 * - n{.*} - returns all properties of n
 * - n{.name, friend} - returns {name: n.name, friend: <value of friend variable>}
 */
export interface MapProjection {
  type: "MapProjection";
  /** The variable to project from */
  variable: string;
  /** The selectors defining what to include in the map */
  selectors: MapProjectionSelector[];
}

/**
 * A selector in a map projection.
 */
export type MapProjectionSelector =
  | MapPropertySelector
  | MapLiteralEntry
  | MapAllPropertiesSelector
  | MapVariableSelector;

/**
 * Property selector: .property - includes the named property
 */
export interface MapPropertySelector {
  type: "MapPropertySelector";
  /** The property name to include */
  property: string;
}

/**
 * Literal entry: key: expr - includes an expression with a given key
 */
export interface MapLiteralEntry {
  type: "MapLiteralEntry";
  /** The key name in the resulting map */
  key: string;
  /** The expression to evaluate for the value */
  value: Expression;
}

/**
 * All properties selector: .* - includes all properties
 */
export interface MapAllPropertiesSelector {
  type: "MapAllPropertiesSelector";
}

/**
 * Variable selector: variable - includes another variable's value
 */
export interface MapVariableSelector {
  type: "MapVariableSelector";
  /** The variable to include */
  variable: string;
}

/**
 * An expression that evaluates to a value.
 * Can be a literal, variable reference, property access, parameter reference,
 * arithmetic expression, boolean expression, comparison expression, function call, CASE expression, list literal, list index, slice, list comprehension, pattern comprehension, quantifier expression, reduce expression, dynamic property access, map projection, or exists subquery.
 */
export type Expression =
  | Literal
  | VariableRef
  | PropertyAccess
  | ParameterRef
  | ArithmeticExpression
  | UnaryExpression
  | BooleanExpression
  | ComparisonExpression
  | FunctionCall
  | SimpleCaseExpression
  | SearchedCaseExpression
  | ListLiteralExpr
  | MapLiteralExpr
  | ListIndexExpression
  | SliceExpression
  | ListComprehension
  | PatternComprehension
  | QuantifierExpression
  | ReduceExpression
  | DynamicPropertyAccess
  | MemberAccess
  | MapProjection
  | ExistsSubquery;

// Literals
export type Literal = string | number | boolean | null;
