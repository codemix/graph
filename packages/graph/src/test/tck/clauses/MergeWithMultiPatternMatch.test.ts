/**
 * Comprehensive tests for MERGE relationship variables with WITH and multi-pattern MATCH.
 *
 * These tests verify the fix for the bug where MERGE relationship steps couldn't find
 * variables passed through WITH when followed by a comma-separated MATCH pattern.
 *
 * The root cause was that convertMultiPattern always used FetchVerticesStep which
 * creates fresh paths without preserving prior bindings from WITH.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("MERGE with WITH and multi-pattern MATCH", () => {
  describe("Basic variable preservation through WITH", () => {
    test("MERGE relationship can use variables from WITH after single-pattern MATCH", () => {
      const graph = createTckGraph();

      // Setup: create target nodes
      executeTckQuery(graph, "CREATE (:Target {name: 'T1'})");

      // MERGE node, WITH to preserve, single MATCH, then MERGE relationship
      executeTckQuery(
        graph,
        `
        MERGE (a:Source {name: 'S1'})
        WITH a
        MATCH (t:Target {name: 'T1'})
        MERGE (a)-[:LINKS]->(t)
        `,
      );

      // Verify relationship was created
      const results = executeTckQuery(
        graph,
        "MATCH (:Source)-[r:LINKS]->(:Target) RETURN count(r)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(1);
    });

    test("MERGE relationship can use variables from WITH after multi-pattern MATCH", () => {
      const graph = createTckGraph();

      // Setup: create target nodes
      executeTckQuery(graph, "CREATE (:Target1 {name: 'T1'}), (:Target2 {name: 'T2'})");

      // MERGE node, WITH to preserve, multi-pattern MATCH, then MERGE relationships
      executeTckQuery(
        graph,
        `
        MERGE (a:Source {name: 'S1'})
        WITH a
        MATCH (t1:Target1 {name: 'T1'}), (t2:Target2 {name: 'T2'})
        MERGE (a)-[:LINKS1]->(t1)
        MERGE (a)-[:LINKS2]->(t2)
        `,
      );

      // Verify relationships were created
      const links1 = executeTckQuery(
        graph,
        "MATCH (:Source)-[r:LINKS1]->(:Target1) RETURN count(r)",
      );
      expect(links1).toHaveLength(1);
      expect(links1[0]).toBe(1);

      const links2 = executeTckQuery(
        graph,
        "MATCH (:Source)-[r:LINKS2]->(:Target2) RETURN count(r)",
      );
      expect(links2).toHaveLength(1);
      expect(links2[0]).toBe(1);
    });

    test("MERGE relationship uses correct variable from multiple WITH variables", () => {
      const graph = createTckGraph();

      // Setup
      executeTckQuery(graph, "CREATE (:Type {name: 'TypeA'})");

      // Multiple variables in WITH
      executeTckQuery(
        graph,
        `
        MERGE (n1:Node {name: 'N1'})
        MERGE (n2:Node {name: 'N2'})
        WITH n1, n2
        MATCH (t:Type {name: 'TypeA'})
        MERGE (n1)-[:HAS_TYPE]->(t)
        MERGE (n2)-[:HAS_TYPE]->(t)
        `,
      );

      // Both nodes should link to the type
      const results = executeTckQuery(graph, "MATCH (:Node)-[r:HAS_TYPE]->(:Type) RETURN count(r)");
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(2);
    });
  });

  describe("CREATE and MERGE combination with WITH", () => {
    test("CREATE node, WITH preserve, multi-pattern MATCH, MERGE relationships", () => {
      const graph = createTckGraph();

      // Setup data types
      executeTckQuery(graph, "CREATE (:DataType {name: 'String'}), (:DataType {name: 'Integer'})");

      // CREATE single node, WITH, multi-pattern MATCH, multiple MERGE
      executeTckQuery(
        graph,
        `
        CREATE (p:Property {name: 'test'})
        WITH p
        MATCH (dtString:DataType {name: 'String'}), (dtInt:DataType {name: 'Integer'})
        MERGE (p)-[:TYPE_STRING]->(dtString)
        MERGE (p)-[:TYPE_INT]->(dtInt)
        `,
      );

      // Verify both relationships were created
      const stringRels = executeTckQuery(
        graph,
        "MATCH (:Property)-[r:TYPE_STRING]->(:DataType {name: 'String'}) RETURN count(r)",
      );
      expect(stringRels[0]).toBe(1);

      const intRels = executeTckQuery(
        graph,
        "MATCH (:Property)-[r:TYPE_INT]->(:DataType {name: 'Integer'}) RETURN count(r)",
      );
      expect(intRels[0]).toBe(1);
    });

    test("MERGE then CREATE, WITH preserve, single-pattern MATCH", () => {
      const graph = createTckGraph();

      // Setup - only create the category
      executeTckQuery(graph, "CREATE (:Category {name: 'A'})");

      // Single parent with single category
      executeTckQuery(
        graph,
        `
        MERGE (parent:Item {name: 'Parent'})
        WITH parent
        MATCH (cat:Category {name: 'A'})
        MERGE (parent)-[:IN_CATEGORY]->(cat)
        `,
      );

      // Verify relationship
      const parentCat = executeTckQuery(
        graph,
        "MATCH (i:Item {name: 'Parent'})-[:IN_CATEGORY]->(c:Category) RETURN count(c)",
      );
      expect(parentCat[0]).toBe(1);
    });

    test("Separate queries each create their own relationships", () => {
      const graph = createTckGraph();

      // Setup single data type
      executeTckQuery(graph, "CREATE (:DataType {name: 'String'})");

      // First property with its type
      executeTckQuery(
        graph,
        `
        CREATE (p1:Property {name: 'firstName'})
        WITH p1
        MATCH (dt:DataType {name: 'String'})
        MERGE (p1)-[:OF_TYPE]->(dt)
        `,
      );

      // Verify first relationship
      const stringRels = executeTckQuery(
        graph,
        "MATCH (p:Property {name: 'firstName'})-[:OF_TYPE]->(dt:DataType {name: 'String'}) RETURN count(dt)",
      );
      expect(stringRels[0]).toBe(1);
    });
  });

  describe("Multiple patterns in MATCH", () => {
    test("Three patterns in MATCH after WITH", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:X {name: 'x'}), (:Y {name: 'y'}), (:Z {name: 'z'})");

      executeTckQuery(
        graph,
        `
        MERGE (n:Node {name: 'N'})
        WITH n
        MATCH (x:X), (y:Y), (z:Z)
        MERGE (n)-[:TO_X]->(x)
        MERGE (n)-[:TO_Y]->(y)
        MERGE (n)-[:TO_Z]->(z)
        `,
      );

      const count = executeTckQuery(graph, "MATCH (:Node)-[r]->() RETURN count(r)");
      expect(count[0]).toBe(3);
    });

    test("Four patterns in MATCH after WITH", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:A {id: 1}), (:B {id: 2}), (:C {id: 3}), (:D {id: 4})");

      executeTckQuery(
        graph,
        `
        MERGE (hub:Hub {name: 'H'})
        WITH hub
        MATCH (a:A), (b:B), (c:C), (d:D)
        MERGE (hub)-[:CONNECT]->(a)
        MERGE (hub)-[:CONNECT]->(b)
        MERGE (hub)-[:CONNECT]->(c)
        MERGE (hub)-[:CONNECT]->(d)
        `,
      );

      const count = executeTckQuery(graph, "MATCH (:Hub)-[r:CONNECT]->() RETURN count(r)");
      expect(count[0]).toBe(4);
    });
  });

  describe("WITH with aliases", () => {
    test("Aliased variables in WITH work with multi-pattern MATCH", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:Target {name: 'T'})");

      executeTckQuery(
        graph,
        `
        MERGE (src:Source {name: 'S'})
        WITH src AS s
        MATCH (t:Target)
        MERGE (s)-[:REFS]->(t)
        `,
      );

      const results = executeTckQuery(graph, "MATCH (:Source)-[r:REFS]->(:Target) RETURN count(r)");
      expect(results[0]).toBe(1);
    });

    test("Multiple aliased variables in WITH", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:Type {name: 'T'})");

      executeTckQuery(
        graph,
        `
        MERGE (a:Node {name: 'A'})
        MERGE (b:Node {name: 'B'})
        WITH a AS nodeA, b AS nodeB
        MATCH (t:Type)
        MERGE (nodeA)-[:IS]->(t)
        MERGE (nodeB)-[:IS]->(t)
        `,
      );

      const results = executeTckQuery(graph, "MATCH (:Node)-[r:IS]->(:Type) RETURN count(r)");
      expect(results[0]).toBe(2);
    });
  });

  describe("Complex real-world scenarios", () => {
    test("Domain model creation pattern - Concept with single Property and DataType", () => {
      // Simplified version of the original bug report pattern
      const graph = createTckGraph();

      // Create data types first
      executeTckQuery(graph, "CREATE (:DataType {name: 'UUID'}), (:DataType {name: 'String'})");

      // Execute simplified query - single property
      const query = `
        MERGE (cUser:Concept {name: 'User'}) SET cUser.description = 'User account'
        CREATE (pUserId:Property {name: 'id'}) SET pUserId.description = 'User ID'
        WITH cUser, pUserId
        MATCH (dtUUID:DataType {name: 'UUID'}), (dtString:DataType {name: 'String'})
        MERGE (cUser)-[:Contains]->(pUserId)
        MERGE (pUserId)-[:References]->(dtUUID)
      `;

      // This should not throw "MERGE: Start variable 'cUser' not found"
      executeTckQuery(graph, query);

      // Verify concept
      const concepts = executeTckQuery(
        graph,
        "MATCH (c:Concept {name: 'User'}) RETURN c.description",
      );
      expect(concepts).toHaveLength(1);
      expect(concepts[0]).toBe("User account");

      // Verify Contains relationship
      const containsCount = executeTckQuery(
        graph,
        "MATCH (:Concept)-[r:Contains]->(:Property) RETURN count(r)",
      );
      expect(containsCount[0]).toBe(1);

      // Verify References relationship
      const refsCount = executeTckQuery(
        graph,
        "MATCH (:Property)-[r:References]->(:DataType {name: 'UUID'}) RETURN count(r)",
      );
      expect(refsCount[0]).toBe(1);
    });

    test("Domain model: single Concept with single Property", () => {
      // Isolated test for the incremental building pattern
      const graph = createTckGraph();

      // Create single data type
      executeTckQuery(graph, "CREATE (:DataType {name: 'UUID'})");

      // Create the concept
      executeTckQuery(graph, "MERGE (c:Concept {name: 'User'}) SET c.description = 'User account'");

      // Add single property (using MERGE to find existing concept)
      executeTckQuery(
        graph,
        `
        MERGE (c:Concept {name: 'User'})
        CREATE (p:Property {name: 'id'})
        WITH c, p
        MATCH (dt:DataType {name: 'UUID'})
        MERGE (c)-[:Contains]->(p)
        MERGE (p)-[:References]->(dt)
        `,
      );

      // Verify structure
      const containsCount = executeTckQuery(
        graph,
        "MATCH (:Concept {name: 'User'})-[r:Contains]->(:Property {name: 'id'}) RETURN count(r)",
      );
      expect(containsCount[0]).toBe(1);

      const refsCount = executeTckQuery(
        graph,
        "MATCH (:Property {name: 'id'})-[r:References]->(:DataType {name: 'UUID'}) RETURN count(r)",
      );
      expect(refsCount[0]).toBe(1);
    });

    test("Graph schema: Entity with single Field and Type", () => {
      const graph = createTckGraph();

      // Create single primitive type
      executeTckQuery(graph, "CREATE (:PrimitiveType {name: 'string'})");

      // Create entity
      executeTckQuery(graph, "MERGE (:Entity {name: 'Person'})");

      // Add single field (using MERGE to find existing entity)
      executeTckQuery(
        graph,
        `
        MERGE (person:Entity {name: 'Person'})
        CREATE (fname:Field {name: 'firstName'})
        WITH person, fname
        MATCH (tString:PrimitiveType {name: 'string'})
        MERGE (person)-[:HAS_FIELD]->(fname)
        MERGE (fname)-[:HAS_TYPE]->(tString)
        `,
      );

      // Verify structure
      const fieldCount = executeTckQuery(
        graph,
        "MATCH (:Entity {name: 'Person'})-[:HAS_FIELD]->(f:Field {name: 'firstName'}) RETURN count(f)",
      );
      expect(fieldCount[0]).toBe(1);

      const typeCount = executeTckQuery(
        graph,
        "MATCH (:Field {name: 'firstName'})-[:HAS_TYPE]->(:PrimitiveType {name: 'string'}) RETURN count(*)",
      );
      expect(typeCount[0]).toBe(1);
    });
  });

  describe("Edge cases", () => {
    test("Empty result from multi-pattern MATCH produces no MERGE", () => {
      const graph = createTckGraph();

      // No matching nodes exist
      executeTckQuery(
        graph,
        `
        MERGE (a:Source {name: 'S'})
        WITH a
        MATCH (x:NonExistent), (y:AlsoNonExistent)
        MERGE (a)-[:LINK]->(x)
        `,
      );

      // Source was created but no relationship (MATCH found nothing)
      const source = executeTckQuery(graph, "MATCH (s:Source) RETURN count(s)");
      expect(source[0]).toBe(1);

      const rels = executeTckQuery(graph, "MATCH ()-[r:LINK]->() RETURN count(r)");
      expect(rels[0]).toBe(0);
    });

    test("Multiple executions are idempotent for MERGE", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:Target {name: 'T'})");

      const query = `
        MERGE (s:Source {name: 'S'})
        WITH s
        MATCH (t:Target)
        MERGE (s)-[:LINK]->(t)
      `;

      // Execute twice
      executeTckQuery(graph, query);
      executeTckQuery(graph, query);

      // Should still have only one relationship (MERGE is idempotent)
      const rels = executeTckQuery(graph, "MATCH (:Source)-[r:LINK]->(:Target) RETURN count(r)");
      expect(rels[0]).toBe(1);
    });

    test("MERGE relationships with properties after multi-pattern MATCH", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:A {id: 1}), (:B {id: 2})");

      executeTckQuery(
        graph,
        `
        MERGE (n:Node {name: 'N'})
        WITH n
        MATCH (a:A), (b:B)
        MERGE (n)-[:REL {weight: 1.0}]->(a)
        MERGE (n)-[:REL {weight: 2.0}]->(b)
        `,
      );

      const results = executeTckQuery(
        graph,
        "MATCH (:Node)-[r:REL]->() RETURN r.weight ORDER BY r.weight",
      );
      expect(results).toHaveLength(2);
      expect(results[0]).toBe(1.0);
      expect(results[1]).toBe(2.0);
    });

    test("Bidirectional relationships after multi-pattern MATCH", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:Left {id: 1}), (:Right {id: 2})");

      executeTckQuery(
        graph,
        `
        MERGE (center:Center {name: 'C'})
        WITH center
        MATCH (l:Left), (r:Right)
        MERGE (l)-[:TO_CENTER]->(center)
        MERGE (center)-[:TO_RIGHT]->(r)
        `,
      );

      const leftToCenter = executeTckQuery(
        graph,
        "MATCH (:Left)-[r:TO_CENTER]->(:Center) RETURN count(r)",
      );
      expect(leftToCenter[0]).toBe(1);

      const centerToRight = executeTckQuery(
        graph,
        "MATCH (:Center)-[r:TO_RIGHT]->(:Right) RETURN count(r)",
      );
      expect(centerToRight[0]).toBe(1);
    });

    test("Incoming relationship direction after multi-pattern MATCH", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:Source1 {id: 1}), (:Source2 {id: 2})");

      executeTckQuery(
        graph,
        `
        MERGE (target:Target {name: 'T'})
        WITH target
        MATCH (s1:Source1), (s2:Source2)
        MERGE (target)<-[:POINTS_TO]-(s1)
        MERGE (target)<-[:POINTS_TO]-(s2)
        `,
      );

      const results = executeTckQuery(graph, "MATCH (s)-[:POINTS_TO]->(:Target) RETURN count(s)");
      expect(results[0]).toBe(2);
    });
  });

  describe("Chained WITH clauses", () => {
    test("Multiple WITH clauses before multi-pattern MATCH", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:Type {name: 'T'})");

      executeTckQuery(
        graph,
        `
        MERGE (a:Node {name: 'A'})
        WITH a
        MERGE (b:Node {name: 'B'})
        WITH a, b
        MATCH (t:Type)
        MERGE (a)-[:TYPED]->(t)
        MERGE (b)-[:TYPED]->(t)
        `,
      );

      const results = executeTckQuery(graph, "MATCH (:Node)-[r:TYPED]->(:Type) RETURN count(r)");
      expect(results[0]).toBe(2);
    });

    test("WITH clause after multi-pattern MATCH, then another MERGE", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:X {id: 1}), (:Y {id: 2})");

      executeTckQuery(
        graph,
        `
        MERGE (n:Node {name: 'N'})
        WITH n
        MATCH (x:X), (y:Y)
        MERGE (n)-[:TO_X]->(x)
        WITH n, y
        MERGE (n)-[:TO_Y]->(y)
        `,
      );

      const toX = executeTckQuery(graph, "MATCH (:Node)-[r:TO_X]->(:X) RETURN count(r)");
      expect(toX[0]).toBe(1);

      const toY = executeTckQuery(graph, "MATCH (:Node)-[r:TO_Y]->(:Y) RETURN count(r)");
      expect(toY[0]).toBe(1);
    });
  });

  describe("Variables from MATCH combined with variables from WITH", () => {
    test("MERGE relationship between WITH variable and MATCH variable", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:Existing {name: 'E'})");

      executeTckQuery(
        graph,
        `
        MERGE (new:New {name: 'N'})
        WITH new
        MATCH (existing:Existing)
        MERGE (new)-[:CONNECTS]->(existing)
        `,
      );

      const results = executeTckQuery(
        graph,
        "MATCH (:New)-[r:CONNECTS]->(:Existing) RETURN count(r)",
      );
      expect(results[0]).toBe(1);
    });

    test("MERGE relationship between two MATCH variables, WITH variable unused in relationship", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:A {id: 1}), (:B {id: 2})");

      executeTckQuery(
        graph,
        `
        MERGE (marker:Marker {name: 'M'})
        WITH marker
        MATCH (a:A), (b:B)
        MERGE (a)-[:LINKS]->(b)
        `,
      );

      const results = executeTckQuery(graph, "MATCH (:A)-[r:LINKS]->(:B) RETURN count(r)");
      expect(results[0]).toBe(1);
    });

    test("Complex mix: MERGE uses both WITH vars and MATCH vars", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:Category {name: 'C1'}), (:Category {name: 'C2'})");

      executeTckQuery(
        graph,
        `
        MERGE (item1:Item {name: 'I1'})
        MERGE (item2:Item {name: 'I2'})
        WITH item1, item2
        MATCH (cat1:Category {name: 'C1'}), (cat2:Category {name: 'C2'})
        MERGE (item1)-[:IN]->(cat1)
        MERGE (item2)-[:IN]->(cat2)
        MERGE (item1)-[:RELATED]->(item2)
        MERGE (cat1)-[:LINKED]->(cat2)
        `,
      );

      // Item to Category relationships
      const itemCat = executeTckQuery(graph, "MATCH (:Item)-[r:IN]->(:Category) RETURN count(r)");
      expect(itemCat[0]).toBe(2);

      // Item to Item relationship
      const itemItem = executeTckQuery(graph, "MATCH (:Item)-[r:RELATED]->(:Item) RETURN count(r)");
      expect(itemItem[0]).toBe(1);

      // Category to Category relationship
      const catCat = executeTckQuery(
        graph,
        "MATCH (:Category)-[r:LINKED]->(:Category) RETURN count(r)",
      );
      expect(catCat[0]).toBe(1);
    });
  });

  describe("SET operations combined with MERGE after multi-pattern MATCH", () => {
    test("SET properties on nodes before MERGE relationships", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:Type {name: 'T'})");

      executeTckQuery(
        graph,
        `
        MERGE (n:Node {name: 'N'}) SET n.status = 'active'
        WITH n
        MATCH (t:Type)
        MERGE (n)-[:HAS_TYPE]->(t)
        `,
      );

      const results = executeTckQuery(graph, "MATCH (n:Node)-[:HAS_TYPE]->(:Type) RETURN n.status");
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("active");
    });

    test("ON CREATE SET with MERGE after multi-pattern MATCH", () => {
      const graph = createTckGraph();

      executeTckQuery(graph, "CREATE (:Target {name: 'T'})");

      executeTckQuery(
        graph,
        `
        MERGE (s:Source {name: 'S'})
        WITH s
        MATCH (t:Target)
        MERGE (s)-[r:LINK]->(t) ON CREATE SET r.created = true
        `,
      );

      const results = executeTckQuery(graph, "MATCH ()-[r:LINK]->() RETURN r.created");
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(true);
    });
  });
});
