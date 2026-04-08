import { test, expect } from "vitest";
import { parse } from "../grammar.js";
import type {
  Query,
  NodePattern,
  EdgePattern,
  Pattern,
  PropertyCondition,
  ExistsCondition,
  AndCondition,
  OrCondition,
} from "../AST.js";

test("Graph Query Language Parser - Simple vertex fetching - should parse MATCH (u:User) RETURN u", () => {
  const query = "MATCH (u:User) RETURN u";
  const ast = parse(query) as Query;

  expect(ast.type).toBe("Query");
  expect(ast.matches).toHaveLength(1);
  expect(ast.matches[0]!.type).toBe("MatchClause");
  expect((ast.matches[0]!.pattern as Pattern).elements).toHaveLength(1);

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.type).toBe("NodePattern");
  expect(node.variable).toBe("u");
  expect(node.labels).toEqual(["User"]);

  expect(ast.return!.distinct).toBe(false);
  expect(ast.return!.items).toHaveLength(1);
  expect(ast.return!.items[0]!.variable).toBe("u");
  expect(ast.return!.items[0]!.aggregate).toBeUndefined();
});

test("Graph Query Language Parser - Simple vertex fetching - should parse MATCH (v) RETURN v", () => {
  const query = "MATCH (v) RETURN v";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.variable).toBe("v");
  expect(node.labels).toEqual([]);
});

test("Graph Query Language Parser - Simple vertex fetching - should parse MATCH (:User) RETURN u", () => {
  const query = "MATCH (:User) RETURN u";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.variable).toBeUndefined();
  expect(node.labels).toEqual(["User"]);
});

test("Graph Query Language Parser - Simple vertex fetching - should parse multiple labels MATCH (u:User:Admin) RETURN u", () => {
  const query = "MATCH (u:User:Admin) RETURN u";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.labels).toEqual(["User", "Admin"]);
});

test("Graph Query Language Parser - Edge traversal - should parse outgoing edge MATCH (u:User)-[:follows]->(f) RETURN f", () => {
  const query = "MATCH (u:User)-[:follows]->(f) RETURN f";
  const ast = parse(query) as Query;

  expect((ast.matches[0]!.pattern as Pattern).elements).toHaveLength(3);

  const sourceNode = (ast.matches[0]!.pattern as Pattern)
    .elements[0] as NodePattern;
  expect(sourceNode.type).toBe("NodePattern");
  expect(sourceNode.variable).toBe("u");
  expect(sourceNode.labels).toEqual(["User"]);

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.type).toBe("EdgePattern");
  expect(edge.direction).toBe("out");
  expect(edge.labels).toEqual(["follows"]);

  const targetNode = (ast.matches[0]!.pattern as Pattern)
    .elements[2] as NodePattern;
  expect(targetNode.type).toBe("NodePattern");
  expect(targetNode.variable).toBe("f");
});

test("Graph Query Language Parser - Edge traversal - should parse incoming edge MATCH (u:User)<-[:follows]-(f) RETURN f", () => {
  const query = "MATCH (u:User)<-[:follows]-(f) RETURN f";
  const ast = parse(query) as Query;

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.direction).toBe("in");
});

test("Graph Query Language Parser - Edge traversal - should parse bidirectional edge MATCH (u:User)-[:knows]-(f) RETURN f", () => {
  const query = "MATCH (u:User)-[:knows]-(f) RETURN f";
  const ast = parse(query) as Query;

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.direction).toBe("both");
});

test("Graph Query Language Parser - Edge traversal - should parse multiple edge labels MATCH (u:User)-[:follows|likes]->(f) RETURN f", () => {
  const query = "MATCH (u:User)-[:follows|likes]->(f) RETURN f";
  const ast = parse(query) as Query;

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.labels).toEqual(["follows", "likes"]);
});

test("Graph Query Language Parser - Edge traversal - should parse edge with variable MATCH (u:User)-[rel:follows]->(f) RETURN f", () => {
  const query = "MATCH (u:User)-[rel:follows]->(f) RETURN f";
  const ast = parse(query) as Query;

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.variable).toBe("rel");
  expect(edge.labels).toEqual(["follows"]);
});

test("Graph Query Language Parser - Edge traversal - should parse edge with variable but empty labels MATCH (c:Concept)-[r:]-(us:UserStory) RETURN c", () => {
  const query = "MATCH (c:Concept)-[r:]-(us:UserStory) RETURN c";
  const ast = parse(query) as Query;

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.variable).toBe("r");
  expect(edge.labels).toEqual([]);
  expect(edge.direction).toBe("both");
});

test("Graph Query Language Parser - Edge traversal - should parse edge with variable and empty label with WHERE clause", () => {
  const query =
    "MATCH (b:Concept)-[r:]-(n) WHERE b.@id = 'Concept:caa03abd-21d8-4b26-93dd-55dfae2670d0' RETURN b, r, n";
  const ast = parse(query) as Query;

  expect((ast.matches[0]!.pattern as Pattern).elements).toHaveLength(3);

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.variable).toBe("r");
  expect(edge.labels).toEqual([]);
  expect(edge.direction).toBe("both");

  expect(ast.matches[0]!.where).toBeDefined();
  const condition = ast.matches[0]!.where!.condition as PropertyCondition;
  expect(condition.variable).toBe("b");
  expect(condition.property).toBe("@id");
  expect(condition.value).toBe("Concept:caa03abd-21d8-4b26-93dd-55dfae2670d0");
});

test("Graph Query Language Parser - Edge traversal - should parse edge with variable only (no colon) MATCH (p:Persona)-[e]->(c:Concept) RETURN p, e, c", () => {
  const query = "MATCH (p:Persona)-[e]->(c:Concept) RETURN p, e, c";
  const ast = parse(query) as Query;

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.variable).toBe("e");
  expect(edge.labels).toEqual([]);
  expect(edge.direction).toBe("out");
});

test("Graph Query Language Parser - Edge traversal - should parse edge with variable only in all directions", () => {
  // Outgoing
  const query1 = "MATCH (a)-[e]->(b) RETURN a, e, b";
  const ast1 = parse(query1) as Query;
  const edge1 = (ast1.matches[0]!.pattern as Pattern)
    .elements[1] as EdgePattern;
  expect(edge1.variable).toBe("e");
  expect(edge1.labels).toEqual([]);
  expect(edge1.direction).toBe("out");

  // Incoming
  const query2 = "MATCH (a)<-[e]-(b) RETURN a, e, b";
  const ast2 = parse(query2) as Query;
  const edge2 = (ast2.matches[0]!.pattern as Pattern)
    .elements[1] as EdgePattern;
  expect(edge2.variable).toBe("e");
  expect(edge2.labels).toEqual([]);
  expect(edge2.direction).toBe("in");

  // Bidirectional
  const query3 = "MATCH (a)-[e]-(b) RETURN a, e, b";
  const ast3 = parse(query3) as Query;
  const edge3 = (ast3.matches[0]!.pattern as Pattern)
    .elements[1] as EdgePattern;
  expect(edge3.variable).toBe("e");
  expect(edge3.labels).toEqual([]);
  expect(edge3.direction).toBe("both");
});

test("Graph Query Language Parser - Edge traversal - should parse edge without labels MATCH (u:User)-->(f) RETURN f", () => {
  const query = "MATCH (u:User)-->(f) RETURN f";
  const ast = parse(query) as Query;

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.labels).toEqual([]);
});

test("Graph Query Language Parser - Variable-length paths - should parse exact quantifier MATCH (u:User)-[:follows*2]->(f) RETURN f", () => {
  const query = "MATCH (u:User)-[:follows*2]->(f) RETURN f";
  const ast = parse(query) as Query;

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.quantifier).toBeDefined();
  expect(edge.quantifier!.type).toBe("Quantifier");
  expect(edge.quantifier!.min).toBe(2);
  expect(edge.quantifier!.max).toBe(2);
});

test("Graph Query Language Parser - Variable-length paths - should parse variable with quantifier (no label) MATCH (u:User)-[e*2]->(f) RETURN f", () => {
  const query = "MATCH (u:User)-[e*2]->(f) RETURN f";
  const ast = parse(query) as Query;

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.variable).toBe("e");
  expect(edge.labels).toEqual([]);
  expect(edge.quantifier).toBeDefined();
  expect(edge.quantifier!.min).toBe(2);
  expect(edge.quantifier!.max).toBe(2);
});

test("Graph Query Language Parser - Variable-length paths - should parse range quantifier MATCH (u:User)-[:follows*1..3]->(f) RETURN f", () => {
  const query = "MATCH (u:User)-[:follows*1..3]->(f) RETURN f";
  const ast = parse(query) as Query;

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.quantifier!.min).toBe(1);
  expect(edge.quantifier!.max).toBe(3);
});

test("Graph Query Language Parser - Variable-length paths - should parse open-ended range MATCH (u:User)-[:follows*2..]->(f) RETURN f", () => {
  const query = "MATCH (u:User)-[:follows*2..]->(f) RETURN f";
  const ast = parse(query) as Query;

  const edge = (ast.matches[0]!.pattern as Pattern).elements[1] as EdgePattern;
  expect(edge.quantifier!.min).toBe(2);
  expect(edge.quantifier!.max).toBeUndefined();
});

test("Graph Query Language Parser - Multi-hop traversal - should parse MATCH (u:User)-[:follows]->(f)-[:likes]->(p:Post) RETURN p", () => {
  const query = "MATCH (u:User)-[:follows]->(f)-[:likes]->(p:Post) RETURN p";
  const ast = parse(query) as Query;

  expect((ast.matches[0]!.pattern as Pattern).elements).toHaveLength(5);

  const firstNode = (ast.matches[0]!.pattern as Pattern)
    .elements[0] as NodePattern;
  expect(firstNode.variable).toBe("u");

  const firstEdge = (ast.matches[0]!.pattern as Pattern)
    .elements[1] as EdgePattern;
  expect(firstEdge.labels).toEqual(["follows"]);

  const secondNode = (ast.matches[0]!.pattern as Pattern)
    .elements[2] as NodePattern;
  expect(secondNode.variable).toBe("f");

  const secondEdge = (ast.matches[0]!.pattern as Pattern)
    .elements[3] as EdgePattern;
  expect(secondEdge.labels).toEqual(["likes"]);

  const thirdNode = (ast.matches[0]!.pattern as Pattern)
    .elements[4] as NodePattern;
  expect(thirdNode.variable).toBe("p");
  expect(thirdNode.labels).toEqual(["Post"]);
});

test("Graph Query Language Parser - WHERE clause - should parse simple condition WHERE u.age > 18", () => {
  const query = "MATCH (u:User) WHERE u.age > 18 RETURN u";
  const ast = parse(query) as Query;

  expect(ast.matches[0]!.where).toBeDefined();
  expect(ast.matches[0]!.where!.type).toBe("WhereClause");

  const condition = ast.matches[0]!.where!.condition as PropertyCondition;
  expect(condition.type).toBe("PropertyCondition");
  expect(condition.variable).toBe("u");
  expect(condition.property).toBe("age");
  expect(condition.operator).toBe(">");
  expect(condition.value).toBe(18);
});

test('Graph Query Language Parser - WHERE clause - should parse equality condition WHERE u.name = "Alice"', () => {
  const query = 'MATCH (u:User) WHERE u.name = "Alice" RETURN u';
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as PropertyCondition;
  expect(condition.operator).toBe("=");
  expect(condition.value).toBe("Alice");
});

test("Graph Query Language Parser - WHERE clause - should parse EXISTS condition WHERE u.email EXISTS", () => {
  const query = "MATCH (u:User) WHERE u.email EXISTS RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as ExistsCondition;
  expect(condition.type).toBe("ExistsCondition");
  expect(condition.variable).toBe("u");
  expect(condition.property).toBe("email");
});

test("Graph Query Language Parser - WHERE clause - should parse AND condition", () => {
  const query = "MATCH (u:User) WHERE u.age > 18 AND u.active = true RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as AndCondition;
  expect(condition.type).toBe("AndCondition");

  const left = condition.left as PropertyCondition;
  expect(left.property).toBe("age");
  expect(left.operator).toBe(">");

  const right = condition.right as PropertyCondition;
  expect(right.property).toBe("active");
  expect(right.value).toBe(true);
});

test("Graph Query Language Parser - WHERE clause - should parse OR condition", () => {
  const query = "MATCH (u:User) WHERE u.age < 25 OR u.verified = true RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as OrCondition;
  expect(condition.type).toBe("OrCondition");
});

test("Graph Query Language Parser - WHERE clause - should parse nested conditions with parentheses", () => {
  const query =
    "MATCH (u:User) WHERE (u.age > 18 AND u.age < 65) OR u.verified = true RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as OrCondition;
  expect(condition.type).toBe("OrCondition");

  const left = condition.left as AndCondition;
  expect(left.type).toBe("AndCondition");
});

test("Graph Query Language Parser - RETURN clause - should parse RETURN DISTINCT", () => {
  const query = "MATCH (u:User) RETURN DISTINCT u";
  const ast = parse(query) as Query;

  expect(ast.return!.distinct).toBe(true);
});

test("Graph Query Language Parser - RETURN clause - should parse COUNT aggregate", () => {
  const query = "MATCH (u:User) RETURN COUNT(u)";
  const ast = parse(query) as Query;

  expect(ast.return!.items[0]!.aggregate).toBe("COUNT");
  expect(ast.return!.items[0]!.variable).toBe("u");
});

test("Graph Query Language Parser - RETURN clause - should parse multiple return items", () => {
  const query = "MATCH (u:User)-[:follows]->(f) RETURN u, f";
  const ast = parse(query) as Query;

  expect(ast.return!.items).toHaveLength(2);
  expect(ast.return!.items[0]!.variable).toBe("u");
  expect(ast.return!.items[1]!.variable).toBe("f");
});

test("Graph Query Language Parser - ORDER BY clause - should parse ORDER BY with default ASC", () => {
  const query = "MATCH (u:User) RETURN u ORDER BY u.name";
  const ast = parse(query) as Query;

  expect(ast.orderBy).toBeDefined();
  expect(ast.orderBy!.orders).toHaveLength(1);
  expect(ast.orderBy!.orders[0]!.variable).toBe("u");
  expect(ast.orderBy!.orders[0]!.property).toBe("name");
  expect(ast.orderBy!.orders[0]!.direction).toBe("ASC");
});

test("Graph Query Language Parser - ORDER BY clause - should parse ORDER BY DESC", () => {
  const query = "MATCH (u:User) RETURN u ORDER BY u.age DESC";
  const ast = parse(query) as Query;

  expect(ast.orderBy!.orders[0]!.direction).toBe("DESC");
});

test("Graph Query Language Parser - ORDER BY clause - should parse multiple ORDER BY clauses", () => {
  const query =
    "MATCH (u:User) RETURN u ORDER BY u.lastName ASC, u.firstName ASC";
  const ast = parse(query) as Query;

  expect(ast.orderBy!.orders).toHaveLength(2);
  expect(ast.orderBy!.orders[0]!.property).toBe("lastName");
  expect(ast.orderBy!.orders[1]!.property).toBe("firstName");
});

test("Graph Query Language Parser - SKIP and LIMIT - should parse LIMIT", () => {
  const query = "MATCH (u:User) RETURN u LIMIT 10";
  const ast = parse(query) as Query;

  expect(ast.limit).toBe(10);
});

test("Graph Query Language Parser - SKIP and LIMIT - should parse SKIP", () => {
  const query = "MATCH (u:User) RETURN u SKIP 5";
  const ast = parse(query) as Query;

  expect(ast.skip).toBe(5);
});

test("Graph Query Language Parser - SKIP and LIMIT - should parse SKIP and LIMIT together", () => {
  const query = "MATCH (u:User) RETURN u SKIP 5 LIMIT 10";
  const ast = parse(query) as Query;

  expect(ast.skip).toBe(5);
  expect(ast.limit).toBe(10);
});

test("Graph Query Language Parser - Complex queries - should parse a full complex query", () => {
  const query = `
    MATCH (u:User)-[:follows]->(f)
    WHERE u.age > 18 AND f.active = true
    RETURN DISTINCT f
    ORDER BY f.name DESC
    LIMIT 10
  `;
  const ast = parse(query) as Query;

  // Verify match clause
  expect((ast.matches[0]!.pattern as Pattern).elements).toHaveLength(3);

  // Verify where clause
  const whereCondition = ast.matches[0]!.where!.condition as AndCondition;
  expect(whereCondition.type).toBe("AndCondition");

  // Verify return clause
  expect(ast.return!.distinct).toBe(true);
  expect(ast.return!.items[0]!.variable).toBe("f");

  // Verify order by
  expect(ast.orderBy!.orders[0]!.direction).toBe("DESC");

  // Verify limit
  expect(ast.limit).toBe(10);
});

test("Graph Query Language Parser - Literal values - should parse string literals with double quotes", () => {
  const query = 'MATCH (u:User) WHERE u.name = "Alice" RETURN u';
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as PropertyCondition;
  expect(condition.value).toBe("Alice");
});

test("Graph Query Language Parser - Literal values - should parse string literals with single quotes", () => {
  const query = "MATCH (u:User) WHERE u.name = 'Bob' RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as PropertyCondition;
  expect(condition.value).toBe("Bob");
});

test("Graph Query Language Parser - Literal values - should parse integer literals", () => {
  const query = "MATCH (u:User) WHERE u.age = 25 RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as PropertyCondition;
  expect(condition.value).toBe(25);
});

test("Graph Query Language Parser - Literal values - should parse float literals", () => {
  const query = "MATCH (u:User) WHERE u.score = 95.5 RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as PropertyCondition;
  expect(condition.value).toBe(95.5);
});

test("Graph Query Language Parser - Literal values - should parse boolean literals", () => {
  const query = "MATCH (u:User) WHERE u.active = true RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as PropertyCondition;
  expect(condition.value).toBe(true);
});

test("Graph Query Language Parser - Literal values - should parse null literal", () => {
  const query = "MATCH (u:User) WHERE u.deletedAt = null RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as PropertyCondition;
  expect(condition.value).toBe(null);
});

test("Graph Query Language Parser - Case insensitivity - should parse keywords case-insensitively", () => {
  const query = "match (u:User) where u.age > 18 return u";
  expect(() => parse(query)).not.toThrow();
});

test("Graph Query Language Parser - Case insensitivity - should parse mixed case keywords", () => {
  const query = "Match (u:User) Where u.age > 18 Return u";
  expect(() => parse(query)).not.toThrow();
});

test("Graph Query Language Parser - Comments and whitespace - should handle line comments", () => {
  const query = `
    // Find all users
    MATCH (u:User)
    // Return them
    RETURN u
  `;
  expect(() => parse(query)).not.toThrow();
});

test("Graph Query Language Parser - Comments and whitespace - should handle block comments", () => {
  const query = `
    /*
     * Complex query to find followers
     */
    MATCH (u:User)-[:follows]->(f)
    RETURN f
  `;
  expect(() => parse(query)).not.toThrow();
});

test("Graph Query Language Parser - Comments and whitespace - should handle extra whitespace", () => {
  const query = "  MATCH   ( u:User )   RETURN   u  ";
  expect(() => parse(query)).not.toThrow();
});

test("Graph Query Language Parser - Multiple MATCH clauses - should parse multiple MATCH clauses without WHERE", () => {
  const query = `
    MATCH (s:Screen)-[e]->(d)
    MATCH (s)-[r:related]->(n)
    RETURN s, e, d
  `;
  const ast = parse(query) as Query;

  expect(ast.type).toBe("Query");
  expect(ast.matches).toHaveLength(2);

  // First MATCH
  const firstMatch = ast.matches[0]!;
  expect(firstMatch.type).toBe("MatchClause");
  expect((firstMatch.pattern as Pattern).elements).toHaveLength(3);
  expect(firstMatch.where).toBeUndefined();

  const firstNode = (firstMatch.pattern as Pattern).elements[0] as NodePattern;
  expect(firstNode.variable).toBe("s");
  expect(firstNode.labels).toEqual(["Screen"]);

  // Second MATCH
  const secondMatch = ast.matches[1]!;
  expect(secondMatch.type).toBe("MatchClause");
  expect((secondMatch.pattern as Pattern).elements).toHaveLength(3);

  const secondEdge = (secondMatch.pattern as Pattern)
    .elements[1] as EdgePattern;
  expect(secondEdge.variable).toBe("r");
  expect(secondEdge.labels).toEqual(["related"]);
});

test("Graph Query Language Parser - Multiple MATCH clauses - should parse multiple MATCH clauses with WHERE on first MATCH", () => {
  const query = `
    MATCH (s:Screen)-[e]->(d) WHERE s.@id = "Screen:9825d156-f15b-4160-bd24-d1b0ae4afde9"
    MATCH (s)-[e]->(d)
    RETURN s, e, d
  `;
  const ast = parse(query) as Query;

  expect(ast.matches).toHaveLength(2);

  // First MATCH with WHERE
  const firstMatch = ast.matches[0]!;
  expect(firstMatch.where).toBeDefined();
  expect(firstMatch.where!.type).toBe("WhereClause");

  const condition = firstMatch.where!.condition as PropertyCondition;
  expect(condition.type).toBe("PropertyCondition");
  expect(condition.variable).toBe("s");
  expect(condition.property).toBe("@id");
  expect(condition.value).toBe("Screen:9825d156-f15b-4160-bd24-d1b0ae4afde9");

  // Second MATCH without WHERE
  const secondMatch = ast.matches[1]!;
  expect(secondMatch.where).toBeUndefined();
});

test("Graph Query Language Parser - Multiple MATCH clauses - should parse multiple MATCH clauses with WHERE on each MATCH", () => {
  const query = `
    MATCH (u:User) WHERE u.age > 18
    MATCH (u)-[:follows]->(f) WHERE f.active = true
    RETURN u, f
  `;
  const ast = parse(query) as Query;

  expect(ast.matches).toHaveLength(2);

  // First MATCH with WHERE
  const firstMatch = ast.matches[0]!;
  expect(firstMatch.where).toBeDefined();
  const firstCondition = firstMatch.where!.condition as PropertyCondition;
  expect(firstCondition.property).toBe("age");
  expect(firstCondition.operator).toBe(">");
  expect(firstCondition.value).toBe(18);

  // Second MATCH with WHERE
  const secondMatch = ast.matches[1]!;
  expect(secondMatch.where).toBeDefined();
  const secondCondition = secondMatch.where!.condition as PropertyCondition;
  expect(secondCondition.property).toBe("active");
  expect(secondCondition.value).toBe(true);
});

test("Graph Query Language Parser - Multiple MATCH clauses - should parse three or more MATCH clauses", () => {
  const query = `
    MATCH (a:Node)
    MATCH (a)-[:edge1]->(b)
    MATCH (b)-[:edge2]->(c)
    RETURN a, b, c
  `;
  const ast = parse(query) as Query;

  expect(ast.matches).toHaveLength(3);
  expect((ast.matches[0]!.pattern as Pattern).elements).toHaveLength(1);
  expect((ast.matches[1]!.pattern as Pattern).elements).toHaveLength(3);
  expect((ast.matches[2]!.pattern as Pattern).elements).toHaveLength(3);
});

test("Graph Query Language Parser - Multiple MATCH clauses - should parse multiple MATCH clauses with complex WHERE conditions", () => {
  const query = `
    MATCH (u:User) WHERE u.age > 18 AND u.verified = true
    MATCH (u)-[:follows]->(f) WHERE f.active = true OR f.premium = true
    RETURN u, f
  `;
  const ast = parse(query) as Query;

  expect(ast.matches).toHaveLength(2);

  // First MATCH with AND condition
  const firstCondition = ast.matches[0]!.where!.condition as AndCondition;
  expect(firstCondition.type).toBe("AndCondition");

  // Second MATCH with OR condition
  const secondCondition = ast.matches[1]!.where!.condition as OrCondition;
  expect(secondCondition.type).toBe("OrCondition");
});

test("Graph Query Language Parser - Multiple MATCH clauses - should parse multiple MATCH clauses with ORDER BY and LIMIT", () => {
  const query = `
    MATCH (u:User)
    MATCH (u)-[:follows]->(f)
    RETURN u, f
    ORDER BY u.name ASC
    LIMIT 10
  `;
  const ast = parse(query) as Query;

  expect(ast.matches).toHaveLength(2);
  expect(ast.orderBy).toBeDefined();
  expect(ast.orderBy!.orders[0]!.property).toBe("name");
  expect(ast.limit).toBe(10);
});

test("Graph Query Language Parser - Inline property filtering - should parse node with single inline property", () => {
  const query =
    "MATCH (c:Concept {name:'Group'})-[:HasAttribute]->(a:Property) RETURN a";
  const ast = parse(query) as Query;

  expect(ast.type).toBe("Query");
  expect(ast.matches).toHaveLength(1);

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.type).toBe("NodePattern");
  expect(node.variable).toBe("c");
  expect(node.labels).toEqual(["Concept"]);
  expect(node.properties).toEqual({ name: "Group" });
});

test("Graph Query Language Parser - Inline property filtering - should parse node with multiple inline properties", () => {
  const query = "MATCH (u:User {name:'Alice', age: 25, active: true}) RETURN u";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.properties).toEqual({
    name: "Alice",
    age: 25,
    active: true,
  });
});

test("Graph Query Language Parser - Inline property filtering - should parse node with inline properties and different value types", () => {
  const query =
    "MATCH (n:Node {str: 'text', num: 42, float: 3.14, bool: false, empty: null}) RETURN n";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.properties).toEqual({
    str: "text",
    num: 42,
    float: 3.14,
    bool: false,
    empty: null,
  });
});

test("Graph Query Language Parser - Inline property filtering - should parse node with only inline properties (no variable)", () => {
  const query = "MATCH (:User {name: 'Bob'}) RETURN u";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.variable).toBeUndefined();
  expect(node.labels).toEqual(["User"]);
  expect(node.properties).toEqual({ name: "Bob" });
});

test("Graph Query Language Parser - Inline property filtering - should parse node with multiple labels and inline properties", () => {
  const query = "MATCH (u:User:Admin {role: 'super'}) RETURN u";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.labels).toEqual(["User", "Admin"]);
  expect(node.properties).toEqual({ role: "super" });
});

test("Graph Query Language Parser - Inline property filtering - should parse node with inline properties but no label", () => {
  const query = "MATCH (n {status: 'active'}) RETURN n";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.variable).toBe("n");
  expect(node.labels).toEqual([]);
  expect(node.properties).toEqual({ status: "active" });
});

test("Graph Query Language Parser - Inline property filtering - should parse node with empty inline properties", () => {
  const query = "MATCH (n:Node {}) RETURN n";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.properties).toBeUndefined();
});

test("Graph Query Language Parser - Inline property filtering - should parse node with inline properties combined with WHERE clause", () => {
  const query = "MATCH (u:User {status: 'active'}) WHERE u.age > 18 RETURN u";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.properties).toEqual({ status: "active" });

  const condition = ast.matches[0]!.where!.condition as PropertyCondition;
  expect(condition.property).toBe("age");
  expect(condition.operator).toBe(">");
  expect(condition.value).toBe(18);
});

test("Graph Query Language Parser - Inline property filtering - should parse inline properties on multiple nodes in pattern", () => {
  const query =
    "MATCH (a:Person {name: 'Alice'})-[:KNOWS]->(b:Person {name: 'Bob'}) RETURN a, b";
  const ast = parse(query) as Query;

  const nodeA = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(nodeA.properties).toEqual({ name: "Alice" });

  const nodeB = (ast.matches[0]!.pattern as Pattern).elements[2] as NodePattern;
  expect(nodeB.properties).toEqual({ name: "Bob" });
});

test("Graph Query Language Parser - Inline property filtering - should parse @-prefixed property keys in inline properties", () => {
  const query = "MATCH (n:Node {@id: 'Node:123', @type: 'Test'}) RETURN n";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.properties).toEqual({
    "@id": "Node:123",
    "@type": "Test",
  });
});

test("Graph Query Language Parser - Inline property filtering - should parse inline properties with double-quoted strings", () => {
  const query = 'MATCH (u:User {name: "John Doe"}) RETURN u';
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.properties).toEqual({ name: "John Doe" });
});

test("Graph Query Language Parser - Inline property filtering - should parse inline properties with whitespace variations", () => {
  const query = "MATCH (u:User { name : 'Alice' , age : 30 }) RETURN u";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.properties).toEqual({ name: "Alice", age: 30 });
});

test("Graph Query Language Parser - Inline property filtering - should not include properties field when no inline properties specified", () => {
  const query = "MATCH (u:User) RETURN u";
  const ast = parse(query) as Query;

  const node = (ast.matches[0]!.pattern as Pattern).elements[0] as NodePattern;
  expect(node.properties).toBeUndefined();
});

test("Graph Query Language Parser - @-prefixed property identifiers - should parse @id property in WHERE clause", () => {
  const query =
    'MATCH (s:Screen) WHERE s.@id = "Screen:9825d156-f15b-4160-bd24-d1b0ae4afde9" RETURN s';
  const ast = parse(query) as Query;

  expect(ast.matches[0]!.where).toBeDefined();
  const condition = ast.matches[0]!.where!.condition as PropertyCondition;
  expect(condition.type).toBe("PropertyCondition");
  expect(condition.variable).toBe("s");
  expect(condition.property).toBe("@id");
  expect(condition.operator).toBe("=");
  expect(condition.value).toBe("Screen:9825d156-f15b-4160-bd24-d1b0ae4afde9");
});

test("Graph Query Language Parser - @-prefixed property identifiers - should parse @type property with different operators", () => {
  const query1 = 'MATCH (n:Node) WHERE n.@type = "TestType" RETURN n';
  const ast1 = parse(query1) as Query;
  const condition1 = ast1.matches[0]!.where!.condition as PropertyCondition;
  expect(condition1.property).toBe("@type");
  expect(condition1.operator).toBe("=");

  const query2 = 'MATCH (n:Node) WHERE n.@type != "TestType" RETURN n';
  const ast2 = parse(query2) as Query;
  const condition2 = ast2.matches[0]!.where!.condition as PropertyCondition;
  expect(condition2.property).toBe("@type");
  expect(condition2.operator).toBe("!=");
});

test("Graph Query Language Parser - @-prefixed property identifiers - should parse @id property in EXISTS condition", () => {
  const query = "MATCH (n:Node) WHERE n.@id EXISTS RETURN n";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as ExistsCondition;
  expect(condition.type).toBe("ExistsCondition");
  expect(condition.variable).toBe("n");
  expect(condition.property).toBe("@id");
});

test("Graph Query Language Parser - @-prefixed property identifiers - should parse @-prefixed property in ORDER BY clause", () => {
  const query = "MATCH (s:Screen) RETURN s ORDER BY s.@id ASC";
  const ast = parse(query) as Query;

  expect(ast.orderBy).toBeDefined();
  expect(ast.orderBy!.orders[0]!.variable).toBe("s");
  expect(ast.orderBy!.orders[0]!.property).toBe("@id");
  expect(ast.orderBy!.orders[0]!.direction).toBe("ASC");
});

test("Graph Query Language Parser - @-prefixed property identifiers - should parse @-prefixed property in ORDER BY DESC", () => {
  const query = "MATCH (s:Screen) RETURN s ORDER BY s.@type DESC";
  const ast = parse(query) as Query;

  expect(ast.orderBy!.orders[0]!.property).toBe("@type");
  expect(ast.orderBy!.orders[0]!.direction).toBe("DESC");
});

test("Graph Query Language Parser - @-prefixed property identifiers - should parse mix of @-prefixed and regular properties in WHERE AND", () => {
  const query =
    'MATCH (s:Screen) WHERE s.@id = "test-id" AND s.name = "TestScreen" RETURN s';
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as AndCondition;
  expect(condition.type).toBe("AndCondition");

  const left = condition.left as PropertyCondition;
  expect(left.property).toBe("@id");
  expect(left.value).toBe("test-id");

  const right = condition.right as PropertyCondition;
  expect(right.property).toBe("name");
  expect(right.value).toBe("TestScreen");
});

test("Graph Query Language Parser - @-prefixed property identifiers - should parse mix of @-prefixed and regular properties in ORDER BY", () => {
  const query = "MATCH (s:Screen) RETURN s ORDER BY s.@type ASC, s.name DESC";
  const ast = parse(query) as Query;

  expect(ast.orderBy!.orders).toHaveLength(2);
  expect(ast.orderBy!.orders[0]!.property).toBe("@type");
  expect(ast.orderBy!.orders[0]!.direction).toBe("ASC");
  expect(ast.orderBy!.orders[1]!.property).toBe("name");
  expect(ast.orderBy!.orders[1]!.direction).toBe("DESC");
});

test("Graph Query Language Parser - @-prefixed property identifiers - should parse complex query with multiple @-prefixed properties", () => {
  const query = `
    MATCH (s:Screen)
    WHERE s.@id = "Screen:123" AND s.@type = "Modal"
    RETURN s
    ORDER BY s.@type, s.@id
    LIMIT 10
  `;
  const ast = parse(query) as Query;

  // Verify WHERE clause with @-prefixed properties
  const whereCondition = ast.matches[0]!.where!.condition as AndCondition;
  expect(whereCondition.type).toBe("AndCondition");

  const left = whereCondition.left as PropertyCondition;
  expect(left.property).toBe("@id");

  const right = whereCondition.right as PropertyCondition;
  expect(right.property).toBe("@type");

  // Verify ORDER BY with @-prefixed properties
  expect(ast.orderBy!.orders).toHaveLength(2);
  expect(ast.orderBy!.orders[0]!.property).toBe("@type");
  expect(ast.orderBy!.orders[1]!.property).toBe("@id");

  // Verify LIMIT
  expect(ast.limit).toBe(10);
});

test("Graph Query Language Parser - @-prefixed property identifiers - should parse @-prefixed properties with underscores and numbers", () => {
  const query1 = 'MATCH (n:Node) WHERE n.@id_123 = "test" RETURN n';
  const ast1 = parse(query1) as Query;
  const condition1 = ast1.matches[0]!.where!.condition as PropertyCondition;
  expect(condition1.property).toBe("@id_123");

  const query2 = 'MATCH (n:Node) WHERE n.@_privateId = "test" RETURN n';
  const ast2 = parse(query2) as Query;
  const condition2 = ast2.matches[0]!.where!.condition as PropertyCondition;
  expect(condition2.property).toBe("@_privateId");
});

test("Graph Query Language Parser - @-prefixed property identifiers - should still parse regular properties without @ prefix", () => {
  const query =
    'MATCH (u:User) WHERE u.name = "Alice" AND u.age > 18 RETURN u ORDER BY u.createdAt DESC';
  const ast = parse(query) as Query;

  const whereCondition = ast.matches[0]!.where!.condition as AndCondition;
  const left = whereCondition.left as PropertyCondition;
  expect(left.property).toBe("name");
  expect(left.property).not.toContain("@");

  const right = whereCondition.right as PropertyCondition;
  expect(right.property).toBe("age");
  expect(right.property).not.toContain("@");

  expect(ast.orderBy!.orders[0]!.property).toBe("createdAt");
  expect(ast.orderBy!.orders[0]!.property).not.toContain("@");
});
