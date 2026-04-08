import { test, expect } from "vitest";
import { parse } from "../grammar.js";
import type { Query, EdgePattern, Pattern } from "../AST.js";

/**
 * Cypher Grammar Comparison Tests
 *
 * This file documents the differences between the Codemix grammar and the
 * official openCypher specification (version 9 / M23).
 *
 * Reference: https://opencypher.org/resources/
 * Neo4j Cypher Manual: https://neo4j.com/docs/cypher-manual/current/
 *
 * Tests are organized by feature category.
 *
 * Legend:
 * - SUPPORTED: Feature works in Codemix grammar
 * - NOT SUPPORTED: Feature from Cypher that doesn't parse in Codemix
 * - PARTIAL: Feature works with some limitations
 * - DIFFERENT: Codemix has different behavior from standard Cypher
 * - CODEMIX EXTENSION: Features unique to Codemix (not in standard Cypher)
 */

/**
 * ============================================================================
 * CLAUSE SUPPORT
 * ============================================================================
 */
test("Clause Support - SUPPORTED Clauses - MATCH - basic pattern matching", () => {
  expect(() => parse("MATCH (n) RETURN n")).not.toThrow();
});

test("Clause Support - SUPPORTED Clauses - WHERE - filtering conditions", () => {
  expect(() => parse("MATCH (n) WHERE n.prop = 'value' RETURN n")).not.toThrow();
});

test("Clause Support - SUPPORTED Clauses - RETURN - projecting results", () => {
  expect(() => parse("MATCH (n) RETURN n")).not.toThrow();
});

test("Clause Support - SUPPORTED Clauses - RETURN DISTINCT - unique results", () => {
  expect(() => parse("MATCH (n) RETURN DISTINCT n")).not.toThrow();
});

test("Clause Support - SUPPORTED Clauses - ORDER BY - sorting results", () => {
  expect(() => parse("MATCH (n) RETURN n ORDER BY n.name")).not.toThrow();
});

test("Clause Support - SUPPORTED Clauses - SKIP - pagination offset", () => {
  expect(() => parse("MATCH (n) RETURN n SKIP 10")).not.toThrow();
});

test("Clause Support - SUPPORTED Clauses - OFFSET - synonym for SKIP", () => {
  expect(() => parse("MATCH (n) RETURN n OFFSET 10")).not.toThrow();
});

test("Clause Support - SUPPORTED Clauses - LIMIT - result limit", () => {
  expect(() => parse("MATCH (n) RETURN n LIMIT 10")).not.toThrow();
});

test("Clause Support - SUPPORTED Clauses - SET - property updates", () => {
  // SET is now supported for property updates
  expect(() => parse("MATCH (n:Person) SET n.age = 30 RETURN n")).not.toThrow();
});

test("Clause Support - SUPPORTED Clauses - OPTIONAL MATCH - left outer join pattern", () => {
  // Cypher: OPTIONAL MATCH returns null for non-matching patterns
  const result = parse("MATCH (n) OPTIONAL MATCH (n)-[:REL]->(m) RETURN n, m") as Query;
  expect(result.matches).toHaveLength(2);
  expect(result.matches[0]!.optional).toBeFalsy();
  expect(result.matches[1]!.optional).toBe(true);
});

test("Clause Support - SUPPORTED Clauses - WITH - query chaining/projection", () => {
  // Cypher: WITH allows intermediate projections and filtering
  const result = parse("MATCH (n) WITH n.name AS name RETURN name") as Query;
  expect(result.with).toBeDefined();
  expect(result.with!.length).toBe(1);
  expect(result.with![0]!.items[0]!.alias).toBe("name");
});

test("Clause Support - SUPPORTED Clauses - UNWIND - list expansion", () => {
  // Cypher: UNWIND expands lists into rows
  const result = parse("UNWIND [1, 2, 3] AS x RETURN x") as Query;
  expect(result.unwind).toHaveLength(1);
  expect(result.unwind![0]!.alias).toBe("x");
  expect(result.unwind![0]!.expression).toEqual({
    type: "ListLiteral",
    values: [1, 2, 3],
  });
});

test("Clause Support - SUPPORTED Clauses - CREATE - standalone node creation", () => {
  // CREATE without MATCH is now supported
  const ast = parse("CREATE (n:Person {name: 'Alice'}) RETURN n") as any;
  expect(ast.type).toBe("Query");
  expect(ast.matches).toHaveLength(0);
  expect(ast.create).toBeDefined();
  expect(ast.create.patterns[0].labels).toContain("Person");
});

test("Clause Support - SUPPORTED Clauses - MERGE - standalone upsert", () => {
  // MERGE without MATCH is now supported
  const ast = parse("MERGE (n:Person {name: 'Alice'}) RETURN n") as any;
  expect(ast.type).toBe("Query");
  expect(ast.matches).toHaveLength(0);
  expect(ast.merge).toHaveLength(1);
});

test("Clause Support - SUPPORTED Clauses - DELETE - removal of nodes/relationships", () => {
  // DELETE is now supported without RETURN clause
  const ast = parse("MATCH (n:Person) WHERE n.name = 'Alice' DELETE n") as any;
  expect(ast.type).toBe("Query");
  expect(ast.delete).toBeDefined();
  expect(ast.delete.variables).toContain("n");
});

test("Clause Support - SUPPORTED Clauses - DETACH DELETE - delete with relationships", () => {
  // DETACH DELETE is now supported without RETURN clause
  const ast = parse("MATCH (n:Person) DETACH DELETE n") as any;
  expect(ast.type).toBe("Query");
  expect(ast.delete).toBeDefined();
  expect(ast.delete.detach).toBe(true);
});

test("Clause Support - SUPPORTED Clauses - REMOVE - property removal", () => {
  // Now supported - REMOVE clause removes properties from nodes/edges
  const ast = parse("MATCH (n:Person) REMOVE n.age RETURN n") as Query;
  expect(ast.type).toBe("Query");
  expect(ast.remove).toBeDefined();
  expect(ast.remove!.items).toHaveLength(1);
  expect(ast.remove!.items[0]!.type).toBe("RemoveProperty");
});

test("Clause Support - SUPPORTED Clauses - UNION - combining results", () => {
  // Cypher: UNION combines results of multiple queries
  const ast = parse("MATCH (a:A) RETURN a.name UNION MATCH (b:B) RETURN b.name") as any;
  expect(ast.type).toBe("UnionQuery");
  expect(ast.all).toBe(false);
  expect(ast.queries).toHaveLength(2);
});

test("Clause Support - SUPPORTED Clauses - UNION ALL - combining results with duplicates", () => {
  // Cypher: UNION ALL combines results keeping duplicates
  const ast = parse("MATCH (a:A) RETURN a.name UNION ALL MATCH (b:B) RETURN b.name") as any;
  expect(ast.type).toBe("UnionQuery");
  expect(ast.all).toBe(true);
  expect(ast.queries).toHaveLength(2);
});

test("Clause Support - SUPPORTED Clauses - CALL - procedure invocation", () => {
  const ast = parse("CALL db.labels() YIELD label RETURN label") as Query;
  expect(ast.call).toHaveLength(1);
  const callClause = ast.call![0]!;
  expect(callClause.procedure).toBe("db.labels");
  expect(callClause.yield).toHaveLength(1);
  expect(callClause.yield![0]!.name).toBe("label");
});

test("Clause Support - SUPPORTED Clauses - FOREACH - with function calls like nodes(p)", () => {
  // FOREACH with function call as list expression is now supported
  // via named path patterns (p = ...) and path functions
  expect(() =>
    parse("MATCH p = (a)-[*]->(b) FOREACH (n IN nodes(p) | SET n.marked = true)"),
  ).not.toThrow();
});

test("Clause Support - PARTIAL SUPPORT - FOREACH - with property access list", () => {
  // FOREACH with property access is supported
  expect(() =>
    parse("MATCH (p:Person) FOREACH (x IN p.items | SET x.checked = true) RETURN p"),
  ).not.toThrow();
});

test("Clause Support - PARTIAL SUPPORT - FOREACH - with literal list", () => {
  // FOREACH with literal list is supported
  expect(() =>
    parse("MATCH (p:Person) FOREACH (x IN [1, 2, 3] | SET p.value = 1) RETURN p"),
  ).not.toThrow();
});

/**
 * ============================================================================
 * EXPRESSION SUPPORT
 * ============================================================================
 */
test("Expression Support - SUPPORTED Expressions - Property access with dot notation", () => {
  expect(() => parse("MATCH (n) WHERE n.name = 'test' RETURN n")).not.toThrow();
});

test("Expression Support - SUPPORTED Expressions - Dynamic property access with bracket notation", () => {
  expect(() => parse("MATCH (n) WHERE n['name'] = 'test' RETURN n")).not.toThrow();
  // Verify it creates DynamicPropertyAccess AST node
  const ast = parse("MATCH (n) WHERE n['name'] = 'Alice' RETURN n") as Query;
  const condition = ast.matches[0]!.where!.condition as any;
  expect(condition.left.type).toBe("DynamicPropertyAccess");
  expect(condition.left.property).toBe("name");
});

test("Expression Support - SUPPORTED Expressions - String literals (single and double quotes)", () => {
  expect(() => parse('MATCH (n) WHERE n.a = "test" RETURN n')).not.toThrow();
  expect(() => parse("MATCH (n) WHERE n.a = 'test' RETURN n")).not.toThrow();
});

test("Expression Support - SUPPORTED Expressions - Integer literals", () => {
  expect(() => parse("MATCH (n) WHERE n.age = 25 RETURN n")).not.toThrow();
});

test("Expression Support - SUPPORTED Expressions - Float literals", () => {
  expect(() => parse("MATCH (n) WHERE n.score = 3.14 RETURN n")).not.toThrow();
});

test("Expression Support - SUPPORTED Expressions - Boolean literals", () => {
  expect(() => parse("MATCH (n) WHERE n.active = true RETURN n")).not.toThrow();
  expect(() => parse("MATCH (n) WHERE n.active = false RETURN n")).not.toThrow();
});

test("Expression Support - SUPPORTED Expressions - NULL literal", () => {
  expect(() => parse("MATCH (n) WHERE n.deleted = null RETURN n")).not.toThrow();
});

test("Expression Support - SUPPORTED Expressions - List literals in IN clause", () => {
  expect(() => parse("MATCH (n) WHERE n.status IN ['active', 'pending'] RETURN n")).not.toThrow();
});

test("Expression Support - SUPPORTED Expressions - Negative integers (-5)", () => {
  expect(() => parse("MATCH (n) WHERE n.temp = -5 RETURN n")).not.toThrow();
  const ast = parse("MATCH (n) WHERE n.temp = -5 RETURN n") as any;
  // Negative numbers are now parsed as UnaryExpression
  expect(ast.matches[0].where.condition.value.type).toBe("UnaryExpression");
  expect(ast.matches[0].where.condition.value.operator).toBe("-");
  expect(ast.matches[0].where.condition.value.operand).toBe(5);
});

test("Expression Support - SUPPORTED Expressions - Negative floats (-3.14)", () => {
  expect(() => parse("MATCH (n) WHERE n.temp = -3.14 RETURN n")).not.toThrow();
  const ast = parse("MATCH (n) WHERE n.temp = -3.14 RETURN n") as any;
  // Negative numbers are now parsed as UnaryExpression
  expect(ast.matches[0].where.condition.value.type).toBe("UnaryExpression");
  expect(ast.matches[0].where.condition.value.operator).toBe("-");
  expect(ast.matches[0].where.condition.value.operand).toBe(3.14);
});

test("Expression Support - SUPPORTED Expressions - Arithmetic expressions (+, -, *, /, %, ^)", () => {
  // Cypher: n.age + 5 > 25 - NOW SUPPORTED!
  expect(() => parse("MATCH (n) WHERE n.age + 5 > 25 RETURN n")).not.toThrow();
  const ast = parse("MATCH (n) WHERE n.age + 5 > 25 RETURN n") as any;
  // The condition should be an ExpressionCondition with arithmetic on the left
  expect(ast.matches[0].where.condition.type).toBe("ExpressionCondition");
  expect(ast.matches[0].where.condition.left.type).toBe("ArithmeticExpression");
  expect(ast.matches[0].where.condition.left.operator).toBe("+");
});

test("Expression Support - SUPPORTED Expressions - String concatenation (+) in WHERE", () => {
  // String concatenation with + operator works in WHERE clauses
  const ast = parse("MATCH (n) WHERE n.firstName + ' ' + n.lastName = 'John Doe' RETURN n") as any;
  expect(ast).toBeDefined();
  // The concatenation is represented as nested ArithmeticExpressions
  expect(ast.matches[0].where.condition.left.type).toBe("ArithmeticExpression");
  expect(ast.matches[0].where.condition.left.operator).toBe("+");
});

test("Expression Support - SUPPORTED - String concatenation (+) in RETURN", () => {
  // String concatenation in RETURN clause is now supported via ArithmeticExpression
  expect(() => parse("MATCH (n) RETURN n.firstName + ' ' + n.lastName")).not.toThrow();
});

test("Expression Support - SUPPORTED - Property comparison with comma-separated MATCH", () => {
  // Cypher: MATCH (n), (m) WHERE n.age > m.age RETURN n
  // Comma-separated MATCH patterns are now supported
  const result = parse("MATCH (n), (m) WHERE n.age > m.age RETURN n");
  expect(result).toBeDefined();
  expect((result as any).matches[0].pattern.type).toBe("MultiPattern");
});

test("Expression Support - SUPPORTED - List indexing ([index])", () => {
  // List indexing works in both WHERE and RETURN clauses
  expect(() => parse("MATCH (n) WHERE n.tags[0] = 'first' RETURN n")).not.toThrow();
  expect(() => parse("MATCH (n) RETURN n.tags[0]")).not.toThrow();
});

test("Expression Support - SUPPORTED - List slicing ([start..end])", () => {
  // List slicing works in both WHERE and RETURN clauses
  expect(() => parse("MATCH (n) WHERE n.tags[0..3] = 'fir' RETURN n")).not.toThrow();
  expect(() => parse("MATCH (n) RETURN n.tags[0..3]")).not.toThrow();
});

test("Expression Support - SUPPORTED Expressions - Map literals as expressions", () => {
  // Map literals are now supported as expressions in RETURN
  expect(() => parse("MATCH (n) RETURN {name: n.name, age: n.age}")).not.toThrow();
  // Empty map
  expect(() => parse("UNWIND [1] AS x RETURN {} AS emptyMap")).not.toThrow();
  // Nested values
  expect(() => parse("MATCH (n) RETURN {key: 'value', nested: [1, 2, 3]}")).not.toThrow();
});

test("Expression Support - SUPPORTED Expressions - CASE expressions in WHERE", () => {
  // Simple CASE expression in WHERE clause
  expect(() =>
    parse("MATCH (n) WHERE CASE n.type WHEN 'A' THEN 1 ELSE 0 END = 1 RETURN n"),
  ).not.toThrow();

  // Searched CASE expression in WHERE clause
  expect(() =>
    parse("MATCH (n) WHERE CASE WHEN n.age > 18 THEN 'adult' ELSE 'minor' END = 'adult' RETURN n"),
  ).not.toThrow();

  // Note: CASE in RETURN clause not yet supported (requires ReturnItem grammar extension)
});

test("Expression Support - SUPPORTED Expressions - Parameters ($param)", () => {
  expect(() => parse("MATCH (n) WHERE n.id = $userId RETURN n")).not.toThrow();
});

test("Expression Support - SUPPORTED Expressions - Hexadecimal integers (0xFF)", () => {
  const result = parse("MATCH (n) WHERE n.flags = 0xFF RETURN n") as Query;
  expect(result).toBeDefined();
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(255); // 0xFF = 255
});

test("Expression Support - SUPPORTED Expressions - Octal integers (0o755)", () => {
  const result = parse("MATCH (n) WHERE n.mode = 0o755 RETURN n") as Query;
  expect(result).toBeDefined();
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(493); // 0o755 = 493
});

test("Expression Support - SUPPORTED Expressions - Scientific notation (1e10)", () => {
  const result = parse("MATCH (n) WHERE n.value = 1e10 RETURN n") as Query;
  expect(result).toBeDefined();
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(1e10);
});

/**
 * ============================================================================
 * COMPARISON OPERATORS
 * ============================================================================
 */
test("Comparison Operators - SUPPORTED Operators - Equality (=)", () => {
  expect(() => parse("MATCH (n) WHERE n.x = 1 RETURN n")).not.toThrow();
});

test("Comparison Operators - SUPPORTED Operators - Inequality (!=)", () => {
  expect(() => parse("MATCH (n) WHERE n.x != 1 RETURN n")).not.toThrow();
});

test("Comparison Operators - SUPPORTED Operators - Less than (<)", () => {
  expect(() => parse("MATCH (n) WHERE n.x < 1 RETURN n")).not.toThrow();
});

test("Comparison Operators - SUPPORTED Operators - Greater than (>)", () => {
  expect(() => parse("MATCH (n) WHERE n.x > 1 RETURN n")).not.toThrow();
});

test("Comparison Operators - SUPPORTED Operators - Less than or equal (<=)", () => {
  expect(() => parse("MATCH (n) WHERE n.x <= 1 RETURN n")).not.toThrow();
});

test("Comparison Operators - SUPPORTED Operators - Greater than or equal (>=)", () => {
  expect(() => parse("MATCH (n) WHERE n.x >= 1 RETURN n")).not.toThrow();
});

test("Comparison Operators - SUPPORTED (via extension) - Regex match (=~)", () => {
  expect(() => parse("MATCH (n) WHERE n.name =~ 'Tim.*' RETURN n")).not.toThrow();
  const ast = parse("MATCH (n) WHERE n.name =~ 'Tim.*' RETURN n") as any;
  expect(ast.matches[0].where.condition.type).toBe("RegexCondition");
  expect(ast.matches[0].where.condition.pattern).toBe("Tim.*");
});

test("Comparison Operators - SUPPORTED (Codemix extension) - Cypher inequality (<>) - now supported", () => {
  // Both <> and != are supported, <> is normalized to !=
  expect(() => parse("MATCH (n) WHERE n.x <> 1 RETURN n")).not.toThrow();
});

/**
 * ============================================================================
 * LOGICAL OPERATORS
 * ============================================================================
 */
test("Logical Operators - SUPPORTED Operators - AND", () => {
  expect(() => parse("MATCH (n) WHERE n.a = 1 AND n.b = 2 RETURN n")).not.toThrow();
});

test("Logical Operators - SUPPORTED Operators - OR", () => {
  expect(() => parse("MATCH (n) WHERE n.a = 1 OR n.b = 2 RETURN n")).not.toThrow();
});

test("Logical Operators - SUPPORTED Operators - NOT", () => {
  expect(() => parse("MATCH (n) WHERE NOT n.active = true RETURN n")).not.toThrow();
});

test("Logical Operators - SUPPORTED Operators - XOR", () => {
  expect(() => parse("MATCH (n) WHERE n.a = 1 XOR n.b = 2 RETURN n")).not.toThrow();
  const ast = parse("MATCH (n) WHERE n.a = 1 XOR n.b = 2 RETURN n") as Query;
  expect(ast.matches[0]!.where?.condition.type).toBe("XorCondition");
});

/**
 * ============================================================================
 * STRING PREDICATES
 * ============================================================================
 */
test("String Predicates - SUPPORTED String Predicates - STARTS WITH", () => {
  expect(() => parse("MATCH (n) WHERE n.name STARTS WITH 'A' RETURN n")).not.toThrow();
  const ast = parse("MATCH (n) WHERE n.name STARTS WITH 'A' RETURN n") as Query;
  expect(ast.matches[0]!.where?.condition.type).toBe("StringPredicateCondition");
  expect((ast.matches[0]!.where!.condition as any).predicate).toBe("STARTS WITH");
});

test("String Predicates - SUPPORTED String Predicates - ENDS WITH", () => {
  expect(() => parse("MATCH (n) WHERE n.name ENDS WITH 'son' RETURN n")).not.toThrow();
  const ast = parse("MATCH (n) WHERE n.name ENDS WITH 'son' RETURN n") as Query;
  expect(ast.matches[0]!.where?.condition.type).toBe("StringPredicateCondition");
  expect((ast.matches[0]!.where!.condition as any).predicate).toBe("ENDS WITH");
});

test("String Predicates - SUPPORTED String Predicates - CONTAINS", () => {
  expect(() => parse("MATCH (n) WHERE n.name CONTAINS 'test' RETURN n")).not.toThrow();
  const ast = parse("MATCH (n) WHERE n.name CONTAINS 'test' RETURN n") as Query;
  expect(ast.matches[0]!.where?.condition.type).toBe("StringPredicateCondition");
  expect((ast.matches[0]!.where!.condition as any).predicate).toBe("CONTAINS");
});

/**
 * ============================================================================
 * NULL HANDLING
 * ============================================================================
 */
test("NULL Handling - SUPPORTED - IS NULL", () => {
  expect(() => parse("MATCH (n) WHERE n.deleted IS NULL RETURN n")).not.toThrow();
});

test("NULL Handling - SUPPORTED - IS NOT NULL", () => {
  expect(() => parse("MATCH (n) WHERE n.name IS NOT NULL RETURN n")).not.toThrow();
});

/**
 * ============================================================================
 * LABEL PREDICATES
 * ============================================================================
 */
test("Label Predicates - SUPPORTED - IS :Label (IS LABELED)", () => {
  // Check if a node has a specific label
  expect(() => parse("MATCH (n) WHERE n IS :Person RETURN n")).not.toThrow();
});

test("Label Predicates - SUPPORTED - IS NOT :Label", () => {
  // Check if a node does NOT have a specific label
  expect(() => parse("MATCH (n) WHERE n IS NOT :Person RETURN n")).not.toThrow();
});

test("Label Predicates - SUPPORTED - IS :LabelExpression", () => {
  // IS LABELED works with label expressions (OR, AND, NOT)
  expect(() => parse("MATCH (n) WHERE n IS :Person|Admin RETURN n")).not.toThrow();
  expect(() => parse("MATCH (n) WHERE n IS :Person&Admin RETURN n")).not.toThrow();
  expect(() => parse("MATCH (n) WHERE n IS :!Person RETURN n")).not.toThrow();
});

/**
 * ============================================================================
 * PATTERN MATCHING
 * ============================================================================
 */
test("Pattern Matching - SUPPORTED Patterns - Node with variable", () => {
  expect(() => parse("MATCH (n) RETURN n")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Node with label", () => {
  expect(() => parse("MATCH (n:Person) RETURN n")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Node with multiple labels", () => {
  expect(() => parse("MATCH (n:Person:Actor) RETURN n")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Advanced label expression OR :A|B", () => {
  const ast = parse("MATCH (n:Person|Admin) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern as Pattern;
  const node = pattern.elements[0] as any;
  expect(node.labelExpression).toBeDefined();
  expect(node.labelExpression.type).toBe("LabelOr");
});

test("Pattern Matching - SUPPORTED Patterns - Advanced label expression AND :A&B", () => {
  const ast = parse("MATCH (n:Person&Admin) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern as Pattern;
  const node = pattern.elements[0] as any;
  expect(node.labelExpression).toBeDefined();
  expect(node.labelExpression.type).toBe("LabelAnd");
});

test("Pattern Matching - SUPPORTED Patterns - Advanced label expression NOT :!A", () => {
  const ast = parse("MATCH (n:!Person) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern as Pattern;
  const node = pattern.elements[0] as any;
  expect(node.labelExpression).toBeDefined();
  expect(node.labelExpression.type).toBe("LabelNot");
});

test("Pattern Matching - SUPPORTED Patterns - Advanced label expression wildcard :%", () => {
  const ast = parse("MATCH (n:%) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern as Pattern;
  const node = pattern.elements[0] as any;
  expect(node.labelExpression).toBeDefined();
  expect(node.labelExpression.type).toBe("LabelWildcard");
});

test("Pattern Matching - SUPPORTED Patterns - Advanced label expression parenthesized :(A|B)", () => {
  const ast = parse("MATCH (n:(Person|Admin)) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern as Pattern;
  const node = pattern.elements[0] as any;
  expect(node.labelExpression).toBeDefined();
  expect(node.labelExpression.type).toBe("LabelOr");
});

test("Pattern Matching - SUPPORTED Patterns - Node with inline properties", () => {
  expect(() => parse("MATCH (n:Person {name: 'Alice'}) RETURN n")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Outgoing relationship", () => {
  expect(() => parse("MATCH (a)-[:KNOWS]->(b) RETURN a, b")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Incoming relationship", () => {
  expect(() => parse("MATCH (a)<-[:KNOWS]-(b) RETURN a, b")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Undirected relationship", () => {
  expect(() => parse("MATCH (a)-[:KNOWS]-(b) RETURN a, b")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Relationship with variable", () => {
  expect(() => parse("MATCH (a)-[r:KNOWS]->(b) RETURN r")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Relationship with multiple types (|)", () => {
  expect(() => parse("MATCH (a)-[:KNOWS|LIKES]->(b) RETURN a, b")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Variable-length path (*n)", () => {
  expect(() => parse("MATCH (a)-[:KNOWS*2]->(b) RETURN a, b")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Variable-length path (*n..m)", () => {
  expect(() => parse("MATCH (a)-[:KNOWS*1..3]->(b) RETURN a, b")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Variable-length path (*n..)", () => {
  expect(() => parse("MATCH (a)-[:KNOWS*2..]->(b) RETURN a, b")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Variable-length path (*) - any length", () => {
  expect(() => parse("MATCH (a)-[:KNOWS*]->(b) RETURN a, b")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - shortestPath function", () => {
  expect(() => parse("MATCH p = shortestPath((a)-[:KNOWS*]->(b)) RETURN p")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - allShortestPaths function", () => {
  expect(() => parse("MATCH p = allShortestPaths((a)-[:KNOWS*]->(b)) RETURN p")).not.toThrow();
});

test("Pattern Matching - SUPPORTED - Multiple patterns in single MATCH (comma-separated)", () => {
  // Cypher: MATCH (a), (b) WHERE a.id = b.id RETURN a
  // Comma-separated MATCH patterns are now supported
  const result = parse("MATCH (a:Person), (b:Company) RETURN a, b");
  expect(result).toBeDefined();
  expect((result as any).matches[0].pattern.type).toBe("MultiPattern");
  expect((result as any).matches[0].pattern.patterns).toHaveLength(2);
});

test("Pattern Matching - SUPPORTED Patterns - Relationship properties inline", () => {
  // Relationship properties are supported
  const result = parse("MATCH (a)-[r:KNOWS {since: 2020}]->(b) RETURN r");
  expect(result).toBeDefined();
});

test("Pattern Matching - SUPPORTED Patterns - Graph pattern quantifier +", () => {
  // Plus quantifier (+) for one or more hops
  expect(() => parse("MATCH (a)-[+]->(b) RETURN a, b")).not.toThrow();
  expect(() => parse("MATCH (a)-[:KNOWS+]->(b) RETURN a, b")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Graph pattern quantifier {n}", () => {
  // Curly brace quantifier for exact count
  expect(() => parse("MATCH (a)-[{2}]->(b) RETURN a, b")).not.toThrow();
  expect(() => parse("MATCH (a)-[:KNOWS{3}]->(b) RETURN a, b")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Graph pattern quantifier {n,m}", () => {
  // Curly brace quantifier for range
  expect(() => parse("MATCH (a)-[{1,3}]->(b) RETURN a, b")).not.toThrow();
  expect(() => parse("MATCH (a)-[:KNOWS{2,5}]->(b) RETURN a, b")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Graph pattern quantifier {n,}", () => {
  // Curly brace quantifier for n or more
  expect(() => parse("MATCH (a)-[{2,}]->(b) RETURN a, b")).not.toThrow();
  expect(() => parse("MATCH (a)-[:KNOWS{3,}]->(b) RETURN a, b")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Parenthesized path pattern", () => {
  // Parenthesized path patterns with inline WHERE
  // Note: Must use correct syntax with proper pattern structure
  expect(() => parse("MATCH (a)(((a)-[r:KNOWS]->(b)) WHERE r.weight > 5)+ RETURN a")).not.toThrow();
});

test("Pattern Matching - SUPPORTED Patterns - Named path patterns (p = ...)", () => {
  // Named path patterns are now supported for regular patterns
  const ast = parse("MATCH p = (a)-[:KNOWS]->(b) RETURN p") as Query;
  const pattern = ast.matches![0]!.pattern as Pattern;
  expect(pattern.pathVariable).toBe("p");
  expect(pattern.elements).toHaveLength(3);
});

test("Pattern Matching - SUPPORTED Patterns - Variable-length with open start (*..n)", () => {
  // Cypher: *..3 means 1 to 3 (min defaults to 1)
  const ast = parse("MATCH (a)-[:KNOWS*..3]->(b) RETURN a, b") as Query;
  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.quantifier).toBeDefined();
  expect(edge.quantifier!.min).toBe(1);
  expect(edge.quantifier!.max).toBe(3);
});

test("Pattern Matching - SUPPORTED Patterns - Variable-length without type (*0..)", () => {
  // Starting from 0 hops (includes the start node as a match)
  expect(() => parse("MATCH (a)-[*0..]->(b) RETURN a, b")).not.toThrow();
});

/**
 * ============================================================================
 * FUNCTION SUPPORT
 * ============================================================================
 */
test("Function Support - SUPPORTED Functions - COUNT aggregate", () => {
  expect(() => parse("MATCH (n) RETURN COUNT(n)")).not.toThrow();
});

test("Function Support - SUPPORTED Functions - SUM aggregate", () => {
  expect(() => parse("MATCH (n) RETURN SUM(n.value)")).not.toThrow();
  const ast = parse("MATCH (n) RETURN SUM(n.value)") as Query;
  expect(ast.return!.items[0]!.aggregate).toBe("SUM");
  expect(ast.return!.items[0]!.property).toBe("value");
});

test("Function Support - SUPPORTED Functions - AVG aggregate", () => {
  expect(() => parse("MATCH (n) RETURN AVG(n.value)")).not.toThrow();
  const ast = parse("MATCH (n) RETURN AVG(n.value)") as Query;
  expect(ast.return!.items[0]!.aggregate).toBe("AVG");
});

test("Function Support - SUPPORTED Functions - MIN aggregate", () => {
  expect(() => parse("MATCH (n) RETURN MIN(n.value)")).not.toThrow();
  const ast = parse("MATCH (n) RETURN MIN(n.value)") as Query;
  expect(ast.return!.items[0]!.aggregate).toBe("MIN");
});

test("Function Support - SUPPORTED Functions - MAX aggregate", () => {
  expect(() => parse("MATCH (n) RETURN MAX(n.value)")).not.toThrow();
  const ast = parse("MATCH (n) RETURN MAX(n.value)") as Query;
  expect(ast.return!.items[0]!.aggregate).toBe("MAX");
});

test("Function Support - SUPPORTED Functions - COLLECT aggregate", () => {
  expect(() => parse("MATCH (n) RETURN COLLECT(n)")).not.toThrow();
  const ast = parse("MATCH (n) RETURN COLLECT(n)") as Query;
  expect(ast.return!.items[0]!.aggregate).toBe("COLLECT");
});

test("Function Support - SUPPORTED Functions - COUNT with DISTINCT", () => {
  // COUNT(DISTINCT) is now supported via the legacy aggregate format with distinct flag
  const ast = parse("MATCH (n) RETURN COUNT(DISTINCT n)") as any;
  expect(ast.return.items[0].aggregate).toBe("COUNT");
  expect(ast.return.items[0].distinct).toBe(true);
  expect(ast.return.items[0].variable).toBe("n");
});

test("Function Support - SUPPORTED Functions - String functions in WHERE and RETURN (toUpper, toLower, trim, etc.)", () => {
  // String functions work in WHERE conditions via the FunctionRegistry
  const result = parse("MATCH (n) WHERE toLower(n.name) = 'alice' RETURN n") as Query;
  expect(result.matches[0]!.where!.condition.type).toBe("ExpressionCondition");
  // Functions in RETURN clause now supported via ArithmeticExpression
  expect(() => parse("MATCH (n) RETURN toUpper(n.name)")).not.toThrow();
});

test("Function Support - SUPPORTED Functions - Numeric functions in WHERE and RETURN (abs, ceil, floor, round, etc.)", () => {
  // Numeric functions work in WHERE conditions
  const result = parse("MATCH (n) WHERE abs(n.value) < 10 RETURN n") as Query;
  expect(result.matches[0]!.where!.condition.type).toBe("ExpressionCondition");
  // Functions in RETURN clause now supported
  expect(() => parse("MATCH (n) RETURN abs(n.value)")).not.toThrow();
});

test("Function Support - SUPPORTED Functions - List functions in WHERE and RETURN (head, tail, last, size, etc.)", () => {
  // Size function works in WHERE conditions
  const result = parse("MATCH (n) WHERE size(n.name) > 5 RETURN n") as Query;
  expect(result.matches[0]!.where!.condition.type).toBe("ExpressionCondition");
  // Functions in RETURN clause now supported
  expect(() => parse("MATCH (n) RETURN size(n.tags)")).not.toThrow();
});

test("Function Support - SUPPORTED Functions - Path functions (nodes, relationships, length)", () => {
  // Path functions are now supported with named path patterns
  expect(() => parse("MATCH p = (a)-[*]->(b) RETURN nodes(p)")).not.toThrow();
  expect(() => parse("MATCH p = (a)-[:KNOWS]->(b) RETURN relationships(p)")).not.toThrow();
  expect(() => parse("MATCH p = (a)-[*1..5]->(b) RETURN length(p)")).not.toThrow();

  // Functions are registered and available for evaluation
  // See pathFunctions.test.ts for full test coverage
});

test("Function Support - Type functions in WHERE and RETURN (type, labels)", () => {
  // Type functions work in WHERE conditions for filtering
  const result = parse("MATCH (n)-[r]->(m) WHERE type(r) = 'KNOWS' RETURN n") as Query;
  expect(result.matches[0]!.where!.condition.type).toBe("ExpressionCondition");
  // type() function now works in RETURN clause
  const result2 = parse("MATCH (n)-[r]->(m) RETURN type(r)") as Query;
  expect(result2.return!.items[0]!.function).toBe("type");
});

test("Function Support - SUPPORTED Functions - Coalesce function in WHERE and RETURN", () => {
  // Coalesce works in WHERE conditions
  const result = parse("MATCH (n) WHERE coalesce(n.nickname, n.name) = 'Alice' RETURN n") as Query;
  expect(result.matches[0]!.where!.condition.type).toBe("ExpressionCondition");
  // Functions in RETURN clause now supported
  expect(() => parse("MATCH (n) RETURN coalesce(n.nickname, n.name)")).not.toThrow();
});

test("Function Support - SUPPORTED Functions - Exists function (subquery)", () => {
  // exists((pattern)) is now supported - parses as ExistsSubquery
  const ast = parse("MATCH (n) WHERE exists((n)-[:KNOWS]->()) RETURN n") as any;
  expect(ast.matches[0].where.condition.type).toBe("ExpressionCondition");
  expect(ast.matches[0].where.condition.left.type).toBe("ExistsSubquery");
});

test("Function Support - SUPPORTED Functions - Properties function in RETURN", () => {
  // properties() now parses in RETURN clause
  expect(() => parse("MATCH (n) RETURN properties(n)")).not.toThrow();
});

test("Function Support - SUPPORTED Functions - Keys function in RETURN", () => {
  // keys() now parses in RETURN clause
  expect(() => parse("MATCH (n) RETURN keys(n)")).not.toThrow();
});

test("Function Support - NOT SUPPORTED Functions - DateTime functions", () => {
  // Parses successfully but function returns null (not implemented)
  const ast = parse("RETURN datetime()");
  expect(ast.type).toBe("Query");
});

/**
 * ============================================================================
 * RETURN CLAUSE FEATURES
 * ============================================================================
 */
test("RETURN Clause Features - SUPPORTED - Return single variable", () => {
  expect(() => parse("MATCH (n) RETURN n")).not.toThrow();
});

test("RETURN Clause Features - SUPPORTED - Return multiple variables", () => {
  expect(() => parse("MATCH (a)-[r]->(b) RETURN a, r, b")).not.toThrow();
});

test("RETURN Clause Features - SUPPORTED - COUNT aggregate", () => {
  expect(() => parse("MATCH (n) RETURN COUNT(n)")).not.toThrow();
});

test("RETURN Clause Features - SUPPORTED - Return all (*)", () => {
  expect(() => parse("MATCH (n) RETURN *")).not.toThrow();
  const ast = parse("MATCH (n) RETURN *") as Query;
  expect(ast.return!.returnAll).toBe(true);
});

test("RETURN Clause Features - SUPPORTED - Return all with DISTINCT (*)", () => {
  expect(() => parse("MATCH (n) RETURN DISTINCT *")).not.toThrow();
  const ast = parse("MATCH (n) RETURN DISTINCT *") as Query;
  expect(ast.return!.returnAll).toBe(true);
  expect(ast.return!.distinct).toBe(true);
});

test("RETURN Clause Features - Aliasing with AS", () => {
  const ast = parse("MATCH (n) RETURN n.name AS name") as Query;
  expect(ast.return).toBeDefined();
  expect(ast.return!.items[0]!.variable).toBe("n");
  expect(ast.return!.items[0]!.property).toBe("name");
  expect(ast.return!.items[0]!.alias).toBe("name");
});

test("RETURN Clause Features - Property access in RETURN", () => {
  const ast = parse("MATCH (n:Person) RETURN n.name") as Query;
  expect(ast.return).toBeDefined();
  expect(ast.return!.items).toHaveLength(1);
  expect(ast.return!.items[0]!.variable).toBe("n");
  expect(ast.return!.items[0]!.property).toBe("name");
});

test("RETURN Clause Features - SUPPORTED - Expressions in RETURN", () => {
  // Now supported via ArithmeticExpression in ReturnItem
  expect(() => parse("MATCH (n) RETURN n.age + 1")).not.toThrow();
});

test("RETURN Clause Features - SUPPORTED - count(*) aggregation", () => {
  // count(*) counts all rows
  expect(() => parse("MATCH (n:Person) RETURN n.city, COUNT(*)")).not.toThrow();
});

/**
 * ============================================================================
 * ORDER BY FEATURES
 * ============================================================================
 */
test("ORDER BY Features - SUPPORTED - Order by property ASC", () => {
  expect(() => parse("MATCH (n) RETURN n ORDER BY n.name ASC")).not.toThrow();
});

test("ORDER BY Features - SUPPORTED - Order by property DESC", () => {
  expect(() => parse("MATCH (n) RETURN n ORDER BY n.name DESC")).not.toThrow();
});

test("ORDER BY Features - SUPPORTED - Multiple order items", () => {
  expect(() => parse("MATCH (n) RETURN n ORDER BY n.name ASC, n.age DESC")).not.toThrow();
});

test("ORDER BY Features - SUPPORTED - ASCENDING/DESCENDING keywords (full form)", () => {
  expect(() => parse("MATCH (n) RETURN n ORDER BY n.name ASCENDING")).not.toThrow();
  expect(() => parse("MATCH (n) RETURN n ORDER BY n.name DESCENDING")).not.toThrow();
});

test("ORDER BY Features - SUPPORTED - NULLS FIRST / NULLS LAST", () => {
  expect(() => parse("MATCH (n) RETURN n ORDER BY n.name NULLS FIRST")).not.toThrow();
  expect(() => parse("MATCH (n) RETURN n ORDER BY n.name NULLS LAST")).not.toThrow();
  expect(() => parse("MATCH (n) RETURN n ORDER BY n.name ASC NULLS FIRST")).not.toThrow();
  expect(() => parse("MATCH (n) RETURN n ORDER BY n.name DESC NULLS LAST")).not.toThrow();
});

test("ORDER BY Features - BEHAVIORAL DIFFERENCES from Neo4j Cypher - Default null ordering differs from Neo4j", () => {
  // IMPORTANT: Codemix uses PostgreSQL-style null ordering, NOT Neo4j's ordering
  //
  // Codemix default behavior:
  //   - ASC: NULLS LAST (nulls sort after non-null values)
  //   - DESC: NULLS FIRST (nulls sort before non-null values)
  //
  // Neo4j Cypher default behavior:
  //   - Both ASC and DESC: NULLS sort to the end (after all values)
  //
  // This means: In Codemix, DESC with nulls will put nulls first by default,
  // while in Neo4j they would be last. You can explicitly specify NULLS FIRST
  // or NULLS LAST to get consistent behavior across both systems.
  //
  // Example:
  //   Values: [1, null, 2, null, 3]
  //   Codemix ASC: [1, 2, 3, null, null]  (NULLS LAST is default)
  //   Codemix DESC: [null, null, 3, 2, 1] (NULLS FIRST is default)
  //   Neo4j ASC: [1, 2, 3, null, null]    (nulls always last)
  //   Neo4j DESC: [3, 2, 1, null, null]   (nulls always last)

  // Test that the defaults are applied correctly
  const astAsc = parse("MATCH (n) RETURN n ORDER BY n.age ASC") as Query;
  expect(astAsc.orderBy!.orders[0]!.direction).toBe("ASC");
  expect(astAsc.orderBy!.orders[0]!.nulls).toBeUndefined(); // Will default to NULLS LAST

  const astDesc = parse("MATCH (n) RETURN n ORDER BY n.age DESC") as Query;
  expect(astDesc.orderBy!.orders[0]!.direction).toBe("DESC");
  expect(astDesc.orderBy!.orders[0]!.nulls).toBeUndefined(); // Will default to NULLS FIRST
});

test("ORDER BY Features - Order by arithmetic expression", () => {
  // ORDER BY now supports arithmetic expressions
  const ast = parse("MATCH (n:A) RETURN n ORDER BY n.age + 1") as Query;
  expect(ast).toBeDefined();
  expect(ast.orderBy).toBeDefined();
  expect(ast.orderBy!.orders[0]!.expression).toBeDefined();
});

test("ORDER BY Features - Order by function result", () => {
  // ORDER BY now supports function calls
  const ast = parse("MATCH (n:A) RETURN n ORDER BY toUpper(n.name)") as Query;
  expect(ast).toBeDefined();
  expect(ast.orderBy).toBeDefined();
});

test("ORDER BY Features - Order by literal value", () => {
  // ORDER BY now supports literal values
  const ast = parse("MATCH (n:A) RETURN n ORDER BY 1") as Query;
  expect(ast).toBeDefined();
  expect(ast.orderBy).toBeDefined();
});

test("ORDER BY Features - NOT SUPPORTED - Order by non-returned value", () => {
  // In Cypher you can order by properties not in RETURN
  // This might work if n is returned, let's test
  const ast = parse("MATCH (n:Person) RETURN n ORDER BY n.age");
  expect(ast).toBeDefined();
});

/**
 * ============================================================================
 * IDENTIFIER SYNTAX
 * ============================================================================
 */
test("Identifier Syntax - SUPPORTED - Simple identifiers (alphanumeric + underscore)", () => {
  expect(() => parse("MATCH (my_node:MyLabel) RETURN my_node")).not.toThrow();
});

test("Identifier Syntax - SUPPORTED - Identifiers starting with underscore", () => {
  expect(() => parse("MATCH (_n:_Label) RETURN _n")).not.toThrow();
});

test("Identifier Syntax - SUPPORTED - Backtick-escaped identifiers", () => {
  // Cypher: `my identifier` or `weird-name`
  expect(() => parse("MATCH (`my node`:Person) RETURN `my node`")).not.toThrow();
});

test("Identifier Syntax - SUPPORTED - Identifiers with special characters", () => {
  expect(() => parse("MATCH (n:`Person-Type`) RETURN n")).not.toThrow();
});

test("Identifier Syntax - NOT SUPPORTED - Unicode identifiers", () => {
  // Cypher supports Unicode in identifiers
  expect(() => parse("MATCH (noeud:Personne) RETURN noeud")).not.toThrow(); // This should work actually
});

/**
 * ============================================================================
 * LIST COMPREHENSIONS AND QUANTIFIERS
 * ============================================================================
 */
test("List Comprehensions and Quantifiers - PARTIAL - List comprehension [x IN list | expr]", () => {
  // List comprehension is supported in WHERE clause expressions (not RETURN clause yet)
  const ast = parse("MATCH (n:Person) WHERE size([x IN n.scores | x * 2]) > 0 RETURN n") as Query;
  expect(ast).toBeDefined();
  expect(ast.matches[0]!.where).toBeDefined();
});

test("List Comprehensions and Quantifiers - PARTIAL - List comprehension with WHERE filter", () => {
  // List comprehension with WHERE filter is supported in WHERE clause expressions
  const ast = parse(
    "MATCH (n:Person) WHERE size([x IN n.values WHERE x > 0]) > 0 RETURN n",
  ) as Query;
  expect(ast).toBeDefined();
  expect(ast.matches[0]!.where).toBeDefined();
});

test("List Comprehensions and Quantifiers - PARTIAL - Pattern comprehension in WHERE", () => {
  // Pattern comprehension is supported in WHERE clause, not in RETURN clause
  const ast = parse(
    "MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) | b.name]) > 0 RETURN a",
  ) as Query;
  expect(ast).toBeDefined();
  expect(ast.matches[0]!.where).toBeDefined();
});

test("List Comprehensions and Quantifiers - SUPPORTED - Pattern comprehension in RETURN", () => {
  // Pattern comprehension now parses in RETURN clause
  expect(() => parse("MATCH (a) RETURN [(a)-[:KNOWS]->(b) | b.name]")).not.toThrow();
});

test("List Comprehensions and Quantifiers - SUPPORTED - ALL quantifier", () => {
  const ast = parse("MATCH (n) WHERE ALL(x IN n.values WHERE x > 0) RETURN n") as Query;
  expect(ast).toBeDefined();
  expect(ast.matches[0]!.where).toBeDefined();
});

test("List Comprehensions and Quantifiers - SUPPORTED - ANY quantifier", () => {
  const ast = parse("MATCH (n) WHERE ANY(x IN n.values WHERE x > 0) RETURN n") as Query;
  expect(ast).toBeDefined();
  expect(ast.matches[0]!.where).toBeDefined();
});

test("List Comprehensions and Quantifiers - SUPPORTED - NONE quantifier", () => {
  const ast = parse("MATCH (n) WHERE NONE(x IN n.values WHERE x < 0) RETURN n") as Query;
  expect(ast).toBeDefined();
  expect(ast.matches[0]!.where).toBeDefined();
});

test("List Comprehensions and Quantifiers - SUPPORTED - SINGLE quantifier", () => {
  const ast = parse("MATCH (n) WHERE SINGLE(x IN n.values WHERE x = 0) RETURN n") as Query;
  expect(ast).toBeDefined();
  expect(ast.matches[0]!.where).toBeDefined();
});

/**
 * ============================================================================
 * DIFFERENCES IN BEHAVIOR
 * ============================================================================
 */
test("Behavioral Differences - DIFFERENT: EXISTS as postfix vs function", () => {
  // Codemix: u.email EXISTS (postfix syntax)
  expect(() => parse("MATCH (u) WHERE u.email EXISTS RETURN u")).not.toThrow();

  // Cypher: EXISTS { MATCH (u)-[:HAS_EMAIL]->() }
  expect(() => parse("MATCH (u) WHERE EXISTS { MATCH (u)-[:HAS_EMAIL]->() } RETURN u")).toThrow();
});

test("Behavioral Differences - SUPPORTED: Variable-length without label or variable", () => {
  // Now supported - [*] works without label or variable
  expect(() => parse("MATCH (a)-[*]->(b) RETURN a, b")).not.toThrow();

  // These also work:
  expect(() => parse("MATCH (a)-[:KNOWS*]->(b) RETURN a, b")).not.toThrow();
  expect(() => parse("MATCH (a)-[r*]->(b) RETURN a, b")).not.toThrow();

  // Various quantifier forms work
  expect(() => parse("MATCH (a)-[*1..3]->(b) RETURN a, b")).not.toThrow();
  expect(() => parse("MATCH (a)-[*2..]->(b) RETURN a, b")).not.toThrow();
  expect(() => parse("MATCH (a)-[*3]->(b) RETURN a, b")).not.toThrow();
});

test("Behavioral Differences - DIFFERENT: @-prefixed properties (Codemix extension)", () => {
  // Codemix supports @id, @type for special properties
  expect(() => parse("MATCH (n) WHERE n.@id = 'test' RETURN n")).not.toThrow();

  // This is NOT standard Cypher syntax
});

test("Behavioral Differences - SUPPORTED: Both != and <> for inequality", () => {
  // Codemix supports both != (JavaScript-style) and <> (Cypher standard)
  expect(() => parse("MATCH (n) WHERE n.x != 1 RETURN n")).not.toThrow();

  // Cypher standard <> is also supported, normalized to !=
  expect(() => parse("MATCH (n) WHERE n.x <> 1 RETURN n")).not.toThrow();

  // Both produce the same AST
  const ast1 = parse("MATCH (n) WHERE n.x != 1 RETURN n") as Query;
  const ast2 = parse("MATCH (n) WHERE n.x <> 1 RETURN n") as Query;
  expect((ast1.matches[0]!.where!.condition as any).operator).toBe("!=");
  expect((ast2.matches[0]!.where!.condition as any).operator).toBe("!=");
});

/**
 * ============================================================================
 * VARIABLE-LENGTH PATH EDGE CASES
 * ============================================================================
 */
test("Variable-Length Path Edge Cases - SUPPORTED - [*] without type - any relationship, any length", () => {
  expect(() => parse("MATCH (a)-[*]->(b) RETURN a, b")).not.toThrow();
  const ast = parse("MATCH (a)-[*]->(b) RETURN a, b") as Query;
  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.quantifier).toBeDefined();
  expect(edge.quantifier!.min).toBe(1);
  expect(edge.quantifier!.max).toBeUndefined();
});

test("Variable-Length Path Edge Cases - SUPPORTED - [*2] without type - exact 2 hops", () => {
  expect(() => parse("MATCH (a)-[*2]->(b) RETURN a, b")).not.toThrow();
  const ast = parse("MATCH (a)-[*2]->(b) RETURN a, b") as Query;
  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.quantifier!.min).toBe(2);
  expect(edge.quantifier!.max).toBe(2);
});

test("Variable-Length Path Edge Cases - SUPPORTED - [*1..5] without type - range", () => {
  expect(() => parse("MATCH (a)-[*1..5]->(b) RETURN a, b")).not.toThrow();
});

test("Variable-Length Path Edge Cases - SUPPORTED - [r*1..3] - variable with quantifier, no type", () => {
  expect(() => parse("MATCH (a)-[r*1..3]->(b) RETURN a, b")).not.toThrow();
  const ast = parse("MATCH (a)-[r*1..3]->(b) RETURN a, b") as Query;
  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.variable).toBe("r");
  expect(edge.quantifier!.min).toBe(1);
  expect(edge.quantifier!.max).toBe(3);
});

test("Variable-Length Path Edge Cases - SUPPORTED - [*0..3] - zero minimum hops", () => {
  expect(() => parse("MATCH (a)-[*0..3]->(b) RETURN a, b")).not.toThrow();
  const ast = parse("MATCH (a)-[*0..3]->(b) RETURN a, b") as Query;
  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.quantifier!.min).toBe(0);
});

test("Variable-Length Path Edge Cases - SUPPORTED - [*..3] - open start range (Cypher: 1 to 3)", () => {
  // In Cypher, *..3 means 1..3 (defaults min to 1)
  const ast = parse("MATCH (a)-[*..3]->(b) RETURN a, b") as Query;
  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.quantifier!.min).toBe(1);
  expect(edge.quantifier!.max).toBe(3);
});

/**
 * ============================================================================
 * SUBQUERY AND EXISTENTIAL PATTERNS
 * ============================================================================
 */
test("Subquery and Existential Patterns - SUPPORTED - EXISTS { pattern } syntax", () => {
  // Basic EXISTS with pattern is supported
  const ast = parse("MATCH (n) WHERE EXISTS { (n)-[:KNOWS]->() } RETURN n") as Query;
  expect(ast.matches[0]!.where).toBeDefined();
});

test("Subquery and Existential Patterns - NOT SUPPORTED - EXISTS { MATCH ... } full subquery", () => {
  // Full subquery with MATCH inside EXISTS is not supported
  expect(() => parse("MATCH (n) WHERE EXISTS { MATCH (n)-[:KNOWS]->() } RETURN n")).toThrow();
});

test("Subquery and Existential Patterns - NOT SUPPORTED - COUNT { } subquery pattern", () => {
  expect(() => parse("MATCH (n) WHERE COUNT { (n)-[:KNOWS]->() } > 5 RETURN n")).toThrow();
});

test("Subquery and Existential Patterns - NOT SUPPORTED - CALL { } subquery", () => {
  expect(() => parse("MATCH (n) CALL { WITH n RETURN n.name AS name } RETURN name")).toThrow();
});

test("Subquery and Existential Patterns - SUPPORTED - EXISTS as function with pattern", () => {
  // Cypher pattern: exists((n)-[:KNOWS]->())
  // Now supported - parses as ExistsSubquery wrapped in ExpressionCondition
  const ast = parse("MATCH (n) WHERE exists((n)-[:KNOWS]->()) RETURN n") as any;
  expect(ast.matches[0].where.condition.type).toBe("ExpressionCondition");
  expect(ast.matches[0].where.condition.left.type).toBe("ExistsSubquery");
});

/**
 * ============================================================================
 * TEMPORAL AND SPATIAL TYPES
 * ============================================================================
 */
test("Temporal and Spatial Types - NOT SUPPORTED - datetime() function", () => {
  // Parses successfully but function returns null (not implemented)
  const ast = parse("RETURN datetime()") as Query;
  expect(ast.type).toBe("Query");
  expect(ast.return).toBeDefined();
});

test("Temporal and Spatial Types - NOT SUPPORTED - date() function", () => {
  // Parses successfully but function returns null (not implemented)
  const ast = parse("RETURN date('2024-01-15')") as Query;
  expect(ast.type).toBe("Query");
  expect(ast.return).toBeDefined();
});

test("Temporal and Spatial Types - NOT SUPPORTED - time() function", () => {
  // Parses successfully but function returns null (not implemented)
  const ast = parse("RETURN time('12:30:00')") as Query;
  expect(ast.type).toBe("Query");
  expect(ast.return).toBeDefined();
});

test("Temporal and Spatial Types - NOT SUPPORTED - duration() function", () => {
  // Parses successfully but function returns null (not implemented)
  const ast = parse("RETURN duration('P1Y2M3D')") as Query;
  expect(ast.type).toBe("Query");
  expect(ast.return).toBeDefined();
});

test("Temporal and Spatial Types - NOT SUPPORTED - point() spatial function", () => {
  // Parses successfully but point() and point.distance() functions not implemented
  const ast = parse(
    "MATCH (n) WHERE point.distance(n.location, point({x: 0, y: 0})) < 100 RETURN n",
  ) as Query;
  expect(ast.type).toBe("Query");
  expect(ast.return).toBeDefined();
});

/**
 * ============================================================================
 * MAP AND LIST OPERATIONS
 * ============================================================================
 */
test("Map and List Operations - SUPPORTED - Map projection in WHERE and RETURN", () => {
  // Map projection works in WHERE clause expressions
  // Cypher: n {.name, .age} returns a map with just those properties
  expect(() => parse("MATCH (n:Person) WHERE n{.name}['name'] = 'Alice' RETURN n")).not.toThrow();
  // Map projection in RETURN clause now supported
  expect(() => parse("MATCH (n:Person) RETURN n {.name, .age}")).not.toThrow();
});

test("Map and List Operations - SUPPORTED - Map literal in RETURN", () => {
  expect(() => parse("MATCH (n) RETURN {name: n.name, count: 1}")).not.toThrow();
});

test("Map and List Operations - SUPPORTED - List range [start..end]", () => {
  expect(() => parse("MATCH (n) RETURN n.items[0..5]")).not.toThrow();
});

test("Map and List Operations - SUPPORTED - List concatenation (+)", () => {
  expect(() => parse("MATCH (n) RETURN n.tags + ['new']")).not.toThrow();
});

test("Map and List Operations - NOT SUPPORTED - List membership check (IN for non-literal list)", () => {
  // We support IN with literal lists, but not with variable lists
  expect(() => parse("MATCH (n), (m) WHERE n.id IN m.ids RETURN n")).toThrow();
});

test("Map and List Operations - SUPPORTED - reduce() expression", () => {
  // REDUCE works in WHERE clauses
  const ast = parse(
    "MATCH (n:Person) WHERE REDUCE(total = 0, x IN [1,2,3] | total + x) = 6 RETURN n",
  );
  expect(ast.type).toBe("Query");

  // REDUCE in RETURN clause is now supported
  expect(() =>
    parse("MATCH (n) RETURN reduce(total = 0, x IN n.values | total + x)"),
  ).not.toThrow();
});

/**
 * ============================================================================
 * GRAPH PROJECTION AND CATALOG
 * ============================================================================
 */
test("Graph Projection and Catalog - NOT SUPPORTED - USE clause for database selection", () => {
  expect(() => parse("USE mydb MATCH (n) RETURN n")).toThrow();
});

test("Graph Projection and Catalog - NOT SUPPORTED - SHOW DATABASES", () => {
  expect(() => parse("SHOW DATABASES")).toThrow();
});

test("Graph Projection and Catalog - NOT SUPPORTED - CREATE DATABASE", () => {
  expect(() => parse("CREATE DATABASE mydb")).toThrow();
});

test("Graph Projection and Catalog - NOT SUPPORTED - CREATE INDEX", () => {
  expect(() => parse("CREATE INDEX FOR (n:Person) ON (n.name)")).toThrow();
});

test("Graph Projection and Catalog - NOT SUPPORTED - CREATE CONSTRAINT", () => {
  expect(() => parse("CREATE CONSTRAINT FOR (n:Person) REQUIRE n.id IS UNIQUE")).toThrow();
});

/**
 * ============================================================================
 * LOAD AND IMPORT
 * ============================================================================
 */
test("Load and Import - NOT SUPPORTED - LOAD CSV", () => {
  expect(() => parse("LOAD CSV FROM 'file.csv' AS row RETURN row")).toThrow();
});

test("Load and Import - NOT SUPPORTED - LOAD CSV WITH HEADERS", () => {
  expect(() => parse("LOAD CSV WITH HEADERS FROM 'file.csv' AS row RETURN row.name")).toThrow();
});

/**
 * ============================================================================
 * TRANSACTION CONTROL
 * ============================================================================
 */
test("Transaction Control - NOT SUPPORTED - USING PERIODIC COMMIT", () => {
  expect(() =>
    parse("USING PERIODIC COMMIT 500 LOAD CSV FROM 'file.csv' AS row CREATE (n)"),
  ).toThrow();
});

/**
 * ============================================================================
 * ADVANCED STRING OPERATIONS
 * ============================================================================
 */
test("Advanced String Operations - SUPPORTED - toString() function in WHERE and RETURN", () => {
  // toString() works in WHERE clause expressions
  expect(() => parse("MATCH (n) WHERE toString(n.age) = '30' RETURN n")).not.toThrow();
  // toString() in RETURN clause now supported
  expect(() => parse("MATCH (n) RETURN toString(n.age)")).not.toThrow();
});

test("Advanced String Operations - SUPPORTED - substring() function in WHERE and RETURN", () => {
  // substring() works in WHERE clause expressions
  expect(() => parse("MATCH (n) WHERE substring(n.name, 0, 3) = 'Ali' RETURN n")).not.toThrow();
  // substring() in RETURN clause now supported
  expect(() => parse("MATCH (n) RETURN substring(n.name, 0, 3)")).not.toThrow();
});

test("Advanced String Operations - SUPPORTED - replace() function in WHERE and RETURN", () => {
  // replace() works in WHERE clause expressions
  expect(() =>
    parse("MATCH (n) WHERE replace(n.name, 'old', 'new') = 'new' RETURN n"),
  ).not.toThrow();
  // replace() in RETURN clause now supported
  expect(() => parse("MATCH (n) RETURN replace(n.name, 'old', 'new')")).not.toThrow();
});

test("Advanced String Operations - SUPPORTED - split() function in WHERE and RETURN", () => {
  // split() works in WHERE clause expressions (returns list)
  expect(() => parse("MATCH (n) WHERE size(split(n.tags, ',')) > 2 RETURN n")).not.toThrow();
  // split() in RETURN clause now supported
  expect(() => parse("MATCH (n) RETURN split(n.tags, ',')")).not.toThrow();
});

test("Advanced String Operations - SUPPORTED - reverse() for strings in WHERE and RETURN", () => {
  // reverse() works in WHERE clause expressions
  expect(() => parse("MATCH (n) WHERE reverse(n.name) = 'ecilA' RETURN n")).not.toThrow();
  // reverse() in RETURN clause now supported
  expect(() => parse("MATCH (n) RETURN reverse(n.name)")).not.toThrow();
});

/**
 * ============================================================================
 * HINTS AND QUERY PLANNING
 * ============================================================================
 */
test("Hints and Query Planning - NOT SUPPORTED - USING INDEX hint", () => {
  expect(() =>
    parse("MATCH (n:Person) USING INDEX n:Person(name) WHERE n.name = 'Alice' RETURN n"),
  ).toThrow();
});

test("Hints and Query Planning - NOT SUPPORTED - USING SCAN hint", () => {
  expect(() =>
    parse("MATCH (n:Person) USING SCAN n:Person WHERE n.name = 'Alice' RETURN n"),
  ).toThrow();
});

test("Hints and Query Planning - NOT SUPPORTED - USING JOIN hint", () => {
  expect(() => parse("MATCH (a)--(b)--(c) USING JOIN ON b RETURN a, b, c")).toThrow();
});

test("Hints and Query Planning - NOT SUPPORTED - EXPLAIN", () => {
  expect(() => parse("EXPLAIN MATCH (n) RETURN n")).toThrow();
});

test("Hints and Query Planning - NOT SUPPORTED - PROFILE", () => {
  expect(() => parse("PROFILE MATCH (n) RETURN n")).toThrow();
});

/**
 * ============================================================================
 * RELATIONSHIP PROPERTY PATTERNS
 * ============================================================================
 */
test("Relationship Property Patterns - SUPPORTED - Edge pattern with inline properties", () => {
  const result = parse("MATCH (a)-[r:KNOWS {since: 2020}]->(b) RETURN r") as Query;
  const edge = (result.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.properties).toEqual({ since: 2020 });
});

test("Relationship Property Patterns - SUPPORTED - Edge pattern with multiple inline properties", () => {
  const result = parse(
    "MATCH (a)-[r:WORKS_AT {role: 'Engineer', since: 2019}]->(b) RETURN r",
  ) as Query;
  const edge = (result.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.properties).toEqual({ role: "Engineer", since: 2019 });
});

/**
 * ============================================================================
 * CODEMIX-SPECIFIC EXTENSIONS
 * ============================================================================
 */
test("Codemix Extensions (NOT in standard Cypher) - @-prefixed properties for meta fields", () => {
  // This is a Codemix extension for accessing @id, @type, etc.
  expect(() => parse("MATCH (n) WHERE n.@id = 'abc' RETURN n")).not.toThrow();

  expect(() => parse("MATCH (n) WHERE n.@type = 'Person' RETURN n")).not.toThrow();
});

test("Codemix Extensions (NOT in standard Cypher) - Postfix EXISTS (property EXISTS)", () => {
  // Standard Cypher uses: exists(n.prop) or n.prop IS NOT NULL
  // Codemix uses: n.prop EXISTS
  expect(() => parse("MATCH (n) WHERE n.email EXISTS RETURN n")).not.toThrow();
});

test("Codemix Extensions (NOT in standard Cypher) - @-prefixed properties in inline node properties", () => {
  expect(() => parse("MATCH (n:Node {@id: 'test-123'}) RETURN n")).not.toThrow();
});

/**
 * ============================================================================
 * ERROR HANDLING AND EDGE CASES
 * ============================================================================
 */
test("Error Handling - Grammar accepts minimal query - MATCH without RETURN", () => {
  // The grammar accepts MATCH without RETURN (execution may handle it differently)
  // This documents actual behavior, not ideal behavior
  expect(() => parse("MATCH (n:Person)")).not.toThrow();
});

test("Error Handling - Grammar rejects empty query", () => {
  // Empty string is rejected by grammar - queries must have at least one clause
  // This documents actual behavior after multi-statement support was added
  expect(() => parse("")).toThrow();
});

test("Error Handling - Grammar accepts various patterns", () => {
  // The grammar is permissive in some cases
  // Incomplete patterns may be handled gracefully
  expect(() => parse("MATCH (n)- RETURN n")).not.toThrow(); // Undirected edge with space
  expect(() => parse("MATCH (n)-[ RETURN n")).toThrow(); // Truly incomplete - bracket not closed
  expect(() => parse("MATCH (n)-[]> RETURN n")).toThrow(); // Invalid arrow syntax
});

test("Error Handling - Invalid syntax - unclosed brackets", () => {
  expect(() => parse("MATCH (n WHERE n.x = 1 RETURN n")).toThrow();
  expect(() => parse("MATCH (n) WHERE n.items[0 = 1 RETURN n")).toThrow();
});

test("Error Handling - Invalid syntax - reserved word as unquoted identifier", () => {
  // Reserved words should not be usable as identifiers without backticks
  expect(() => parse("MATCH (match:Person) RETURN match")).toThrow();
  expect(() => parse("MATCH (where:Person) RETURN where")).toThrow();
  // But backtick-quoted reserved words work
  expect(() => parse("MATCH (`match`:Person) RETURN `match`")).not.toThrow();
});

test("Error Handling - Invalid syntax - malformed string literal", () => {
  // Unclosed string
  expect(() => parse("MATCH (n) WHERE n.name = 'Alice RETURN n")).toThrow();
});

test("Error Handling - Invalid syntax - malformed number", () => {
  // Invalid hex
  expect(() => parse("MATCH (n) WHERE n.x = 0xGG RETURN n")).toThrow();
  // Invalid octal
  expect(() => parse("MATCH (n) WHERE n.x = 0o99 RETURN n")).toThrow();
});

test("Error Handling - Unary operators allow consecutive +", () => {
  // `+ + 1` is parsed as `+(+1)` - two unary plus operators
  // This is valid syntax (even if unusual)
  expect(() => parse("MATCH (n) WHERE n.x + + 1 = 2 RETURN n")).not.toThrow();
  // But double AND is still invalid
  expect(() => parse("MATCH (n) WHERE n.x AND AND n.y RETURN n")).toThrow();
});

test("RETURN-only query - SUPPORTED - RETURN without MATCH", () => {
  // Standalone RETURN without any data source is now supported
  const ast = parse("RETURN 1") as Query;
  expect(ast.type).toBe("Query");
  expect(ast.matches).toEqual([]);
  expect(ast.segments).toEqual([]);
  expect(ast.return).toBeDefined();
});

test("Error Handling - Invalid syntax - WHERE without condition", () => {
  expect(() => parse("MATCH (n) WHERE RETURN n")).toThrow();
});

test("Edge Cases - Empty list literal", () => {
  // Empty list should parse correctly
  expect(() => parse("MATCH (n) WHERE n.items = [] RETURN n")).not.toThrow();
});

test("Edge Cases - Deeply nested expressions", () => {
  // Deeply nested arithmetic should work
  expect(() => parse("MATCH (n) WHERE ((((n.a + 1) * 2) - 3) / 4) > 0 RETURN n")).not.toThrow();
});

test("Edge Cases - Long variable-length path range", () => {
  // Very large range values should parse
  expect(() => parse("MATCH (a)-[*1..100]->(b) RETURN a, b")).not.toThrow();
});

test("Edge Cases - Multiple chained string predicates", () => {
  // Multiple conditions should work
  expect(() =>
    parse("MATCH (n) WHERE n.name STARTS WITH 'A' AND n.name ENDS WITH 'z' RETURN n"),
  ).not.toThrow();
});

test("Edge Cases - Unicode in string literals", () => {
  expect(() => parse("MATCH (n) WHERE n.name = 'André' RETURN n")).not.toThrow();
  expect(() => parse("MATCH (n) WHERE n.name = '日本語' RETURN n")).not.toThrow();
});

test("Edge Cases - Escaped quotes in strings", () => {
  // Single quotes with escaped single quote
  expect(() => parse("MATCH (n) WHERE n.name = 'O\\'Brien' RETURN n")).not.toThrow();
  // Double quotes with escaped double quote
  expect(() => parse('MATCH (n) WHERE n.name = "He said \\"hello\\"" RETURN n')).not.toThrow();
});

test("Edge Cases - Very long property names", () => {
  const longProp = "a".repeat(100);
  expect(() => parse(`MATCH (n) WHERE n.${longProp} = 1 RETURN n`)).not.toThrow();
});

test("Edge Cases - Whitespace handling", () => {
  // Various whitespace should be handled
  expect(() => parse("MATCH  (n)   WHERE   n.x=1   RETURN   n")).not.toThrow();
  expect(() => parse("MATCH\t(n)\nWHERE\rn.x=1\nRETURN\tn")).not.toThrow();
});

test("Edge Cases - Case insensitivity of keywords", () => {
  expect(() => parse("match (n) return n")).not.toThrow();
  expect(() => parse("MATCH (n) RETURN n")).not.toThrow();
  expect(() => parse("Match (n) Return n")).not.toThrow();
  expect(() => parse("MaTcH (n) ReTuRn n")).not.toThrow();
});

test("Edge Cases - Boolean literals", () => {
  expect(() => parse("MATCH (n) WHERE n.active = true RETURN n")).not.toThrow();
  expect(() => parse("MATCH (n) WHERE n.active = false RETURN n")).not.toThrow();
  expect(() => parse("MATCH (n) WHERE n.active = TRUE RETURN n")).not.toThrow();
  expect(() => parse("MATCH (n) WHERE n.active = FALSE RETURN n")).not.toThrow();
});

test("Edge Cases - Null literal", () => {
  expect(() => parse("MATCH (n) WHERE n.value = null RETURN n")).not.toThrow();
  expect(() => parse("MATCH (n) WHERE n.value = NULL RETURN n")).not.toThrow();
});

/**
 * ============================================================================
 * SUMMARY OF openCypher COMPATIBILITY (Updated January 2026)
 * ============================================================================
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ SUPPORTED CLAUSES                                                       │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ ✓ MATCH - basic pattern matching                                        │
 * │ ✓ OPTIONAL MATCH - left outer join semantics (returns null on no match) │
 * │ ✓ WHERE - filtering conditions                                          │
 * │ ✓ RETURN - projecting results (variables, properties, aggregates)       │
 * │ ✓ RETURN DISTINCT - unique results                                      │
 * │ ✓ ORDER BY - sorting with ASC/DESC and NULLS FIRST/LAST                 │
 * │ ✓ SKIP / OFFSET - pagination offset                                     │
 * │ ✓ LIMIT - result limit                                                  │
 * │ ✓ WITH - intermediate projections and aggregations                      │
 * │ ✓ UNWIND - list expansion to multiple rows                              │
 * │ ✓ UNION / UNION ALL - combining results from multiple queries           │
 * │ ✓ CREATE - node/relationship creation                                   │
 * │ ✓ MERGE - upsert patterns with ON CREATE/ON MATCH SET                   │
 * │ ✓ SET - property updates (including n = {}, n += {})                    │
 * │ ✓ DELETE / DETACH DELETE - removal operations                           │
 * │ ✓ REMOVE - property/label removal                                       │
 * │ ✓ CALL - procedure invocation with YIELD                                │
 * │ ~ FOREACH - works with property/literal lists (not nodes(p))            │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ MISSING CLAUSES                                                         │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ • LOAD CSV - data import                                                │
 * │ • USE - database selection                                              │
 * │ • EXPLAIN / PROFILE - query planning                                    │
 * │ • CREATE INDEX / CONSTRAINT - schema management                         │
 * │ • CALL { } subqueries                                                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ SUPPORTED EXPRESSIONS (in WHERE clause)                                 │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ ✓ Arithmetic expressions (+, -, *, /, %, ^) with precedence             │
 * │ ✓ Unary expressions (+expr, -expr)                                      │
 * │ ✓ String concatenation with + operator                                  │
 * │ ✓ Property comparisons (n.age > m.age)                                  │
 * │ ✓ CASE expressions (simple and searched)                                │
 * │ ✓ Parameters ($param)                                                   │
 * │ ✓ Numeric literals: hex (0xFF), octal (0o755), scientific (1e10)        │
 * │ ✓ List indexing [n] with negative indices                               │
 * │ ✓ List slicing [start..end] with optional bounds                        │
 * │ ✓ Dynamic property access (n['propName'])                               │
 * │ ✓ Map projection (n{.prop, key: expr, .*})                              │
 * │ ✓ IS NULL / IS NOT NULL                                                 │
 * │ ✓ IS :Label / IS NOT :Label (IS LABELED predicate)                      │
 * │ ✓ IN with literal lists                                                 │
 * │ ✓ Regex matching (=~)                                                   │
 * │ ✓ String predicates (STARTS WITH, ENDS WITH, CONTAINS)                  │
 * │ ✓ Logical operators (AND, OR, NOT, XOR)                                 │
 * │ ✓ Comparison operators (=, !=/<>, <, >, <=, >=)                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ SUPPORTED FUNCTIONS (in WHERE clause)                                   │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ String: toLower, toUpper, trim, ltrim, rtrim, substring, left, right,  │
 * │         replace, reverse, split, toString, size                         │
 * │ Math:   abs, ceil, floor, round, sign, sqrt, exp, log, log10,          │
 * │         sin, cos, tan, asin, acos, atan, atan2, rand, pi, e,           │
 * │         toInteger, toFloat                                              │
 * │ List:   head, tail, last, range, keys, coalesce, reverse, size         │
 * │ Type:   type, labels, id, elementId, properties                         │
 * │ Path:   length, nodes, relationships (PARTIAL - need TraversalPath)     │
 * │ Aggregates (in RETURN): COUNT, SUM, AVG, MIN, MAX, COLLECT              │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ MISSING FUNCTIONS                                                       │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ • COUNT(DISTINCT n) in RETURN                                           │
 * │ • datetime, date, time, duration (temporal)                             │
 * │ • point, point.distance (spatial)                                       │
 * │ • exists() as function (use EXISTS { pattern } instead)                 │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ SUPPORTED PATTERN FEATURES                                              │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ ✓ Node patterns (n), (n:Label), (:Label)                                │
 * │ ✓ Multiple labels (n:Label1:Label2)                                     │
 * │ ✓ Label expressions (:A|B, :A&B, :!A, :%, parenthesized)                │
 * │ ✓ Inline properties ({key: value}) with parameter values                │
 * │ ✓ Edge patterns -->, <--, --                                            │
 * │ ✓ Edge labels [:TYPE], multiple [:TYPE1|TYPE2]                          │
 * │ ✓ Edge variables [r:TYPE]                                               │
 * │ ✓ Variable-length paths [*], [*2], [*1..3], [*2..], [*..3], [*0..]      │
 * │ ✓ Graph pattern quantifiers: +, {n}, {n,m}, {n,}, {,m}                  │
 * │ ✓ Parenthesized path patterns with inline WHERE                         │
 * │ ✓ Edge properties [r:TYPE {prop: value}]                                │
 * │ ✓ Multiple patterns in MATCH (MATCH (a), (b))                           │
 * │ ✓ shortestPath / allShortestPaths                                       │
 * │ ✓ Backtick-escaped identifiers (`my identifier`)                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ MISSING PATTERN FEATURES                                                │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ • Named paths (p = pattern) - only works with shortestPath              │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ LIST COMPREHENSIONS & QUANTIFIERS (in WHERE clause)                     │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ ✓ List comprehension [x IN list WHERE cond | expr]                      │
 * │ ✓ Pattern comprehension [(a)-[:REL]->(b) | b.prop]                      │
 * │ ✓ Quantifiers: ALL, ANY, NONE, SINGLE                                   │
 * │ ✓ REDUCE(acc = init, x IN list | expr)                                  │
 * │ ✓ EXISTS { pattern [WHERE cond] }                                       │
 * │ • EXISTS { MATCH ... } full subquery (not supported)                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ RETURN CLAUSE LIMITATIONS                                               │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ ✓ RETURN variable, n.property                                           │
 * │ ✓ RETURN *, RETURN DISTINCT                                             │
 * │ ✓ Aggregate functions                                                   │
 * │ • Aliasing with AS (RETURN n.name AS name) - not supported              │
 * │ • Expressions (RETURN n.age + 1) - not supported                        │
 * │ • Functions in RETURN - not supported (use WHERE instead)               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ CODEMIX EXTENSIONS (not in standard Cypher)                             │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ ✓ @-prefixed properties (@id, @type) for meta fields                    │
 * │ ✓ Postfix EXISTS (n.prop EXISTS) instead of exists(n.prop)              │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
