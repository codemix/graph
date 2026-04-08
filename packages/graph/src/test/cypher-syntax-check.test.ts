import { test, expect, describe } from "vitest";
import { parse } from "../grammar.js";
import { anyAstToSteps } from "../astToSteps.js";

describe("Cypher syntax support - extended Cypher patterns", () => {
  test("Query 1: MATCH + multiple CREATE + WITH MATCH CREATE pattern", () => {
    const query = `
      MATCH (c:Concept {name:"Organization"})
      CREATE (a1:Property {name:"Id", description:"Unique identifier", presence:"required"})
      CREATE (a2:Property {name:"Name", description:"Organization name", presence:"required"})
      CREATE (c)-[:Contains]->(a1)
      CREATE (c)-[:Contains]->(a2)
      WITH a1 MATCH (dt:DataType {name:"UUID"}) CREATE (a1)-[:IsA]->(dt)
      WITH a2 MATCH (dt:DataType {name:"String"}) CREATE (a2)-[:IsA]->(dt)
    `;
    expect(() => parse(query)).not.toThrow();
    const ast = parse(query);
    expect(ast.type).toBe("Query");
    // Check that segments exist for query with multiple WITH clauses
    if (ast.type === "Query") {
      expect((ast as any).segments).toBeDefined();
    }
  });

  test("Query 2: CREATE with nested object in property", () => {
    const query = `CREATE (dt:DataType {name: "Production Schedule", description: "Schedule for production", schema: {type: "string"}})`;
    const ast = parse(query);
    expect(ast).toBeDefined();

    // Verify the nested object was parsed correctly
    const steps = anyAstToSteps(ast);
    expect(steps).toBeDefined();
  });

  test("Query 3: Multiple MATCH with WITH then MATCH then CREATE", () => {
    const query = `
      MATCH (dt:DataType {name: "UUID"})
      MATCH (s:DataType {name: "String"})
      MATCH (dtm:DataType {name: "DateTime"})
      WITH dt, s, dtm
      MATCH (c:Concept {name: "User"})
      CREATE (a1:Property {name: "Id", description: "Unique identifier"})
      CREATE (a2:Property {name: "Display Name", description: "User's display name"})
      CREATE (c)-[:Contains]->(a1)
      CREATE (c)-[:Contains]->(a2)
      CREATE (a1)-[:IsA]->(dt)
      CREATE (a2)-[:IsA]->(s)
      RETURN c, a1, a2
    `;
    expect(() => parse(query)).not.toThrow();
  });

  test("Query 4: WHERE NOT pattern condition", () => {
    const query = `
      MATCH (c:Concept {name:"Organization"}), (dt:DataType {name:"String"}) 
      WHERE NOT (c)-[:Contains]->(:Property {name:"Name"}) 
      CREATE (a:Property {name:"Name", description:"The organization name", presence:"required", cardinality:"one"}) 
      CREATE (c)-[:Contains]->(a) 
      CREATE (a)-[:IsA]->(dt) 
      RETURN a
    `;
    expect(() => parse(query)).not.toThrow();
  });

  // Simple variants
  test("Simple: MATCH + CREATE", () => {
    expect(() => parse(`MATCH (c:Concept) CREATE (a:Property)`)).not.toThrow();
  });

  test("Simple: MATCH + multiple CREATE", () => {
    expect(() =>
      parse(`MATCH (c:Concept) CREATE (a1:Property) CREATE (a2:Property)`),
    ).not.toThrow();
  });

  test("Simple: WITH followed by MATCH", () => {
    expect(() => parse(`MATCH (c:Concept) WITH c MATCH (dt:DataType) RETURN c, dt`)).not.toThrow();
  });

  test("Simple: WITH followed by MATCH and CREATE", () => {
    expect(() =>
      parse(`MATCH (c:Concept) WITH c MATCH (dt:DataType) CREATE (c)-[:HasType]->(dt)`),
    ).not.toThrow();
  });

  test("Simple: Nested object property", () => {
    expect(() => parse(`CREATE (n:Node {data: {key: "value"}})`)).not.toThrow();
  });

  test("Simple: Multiple MATCH before WITH", () => {
    expect(() => parse(`MATCH (a:A) MATCH (b:B) WITH a, b RETURN a, b`)).not.toThrow();
  });

  test("Simple: CREATE after WITH + MATCH", () => {
    expect(() =>
      parse(
        `MATCH (c:Concept) CREATE (a:Property) WITH a MATCH (dt:DataType) CREATE (a)-[:IsA]->(dt)`,
      ),
    ).not.toThrow();
  });

  test("Simple: NOT pattern in WHERE", () => {
    expect(() =>
      parse(`MATCH (c:Concept) WHERE NOT (c)-[:Contains]->(:Property) RETURN c`),
    ).not.toThrow();
  });

  test("Simple: Deeply nested object property", () => {
    expect(() =>
      parse(`CREATE (n:Node {config: {server: {host: "localhost", port: 8080}, debug: true}})`),
    ).not.toThrow();
  });

  test("Deeply nested objects parse and convert to steps", () => {
    const query = `CREATE (c:Config {name: "server", settings: {database: {host: "localhost", port: 5432}, cache: {enabled: true, ttl: 3600}}}) RETURN c`;
    const ast = parse(query);
    expect(ast).toBeDefined();
    const steps = anyAstToSteps(ast);
    expect(steps.length).toBeGreaterThan(0);
  });
});
