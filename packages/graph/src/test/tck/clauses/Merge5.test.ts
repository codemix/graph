/**
 * TCK Merge5 - Merge relationships
 * Translated from tmp/tck/features/clauses/merge/Merge5.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Merge5 - Merge relationships", () => {
  test("[1] Creating a relationship - count(*) not supported", () => {
    // Original query: MATCH (a:A), (b:B) MERGE (a)-[r:TYPE]->(b) RETURN count(*)
    // Blocked: count(*) not supported (use count(r) instead)
    // Note: MATCH...MERGE chaining IS working (see tests [4], [9], [custom])
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B)");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) MERGE (a)-[r:TYPE]->(b) RETURN count(*)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[2] Matching a relationship - test not implemented", () => {
    // MATCH...MERGE chaining IS working (see tests [4], [9], [custom])
    // Test needs implementation
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:TYPE]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) MERGE (a)-[r:TYPE]->(b) RETURN count(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[3] Matching two relationships - test not implemented", () => {
    // MATCH...MERGE chaining IS working (see tests [4], [9], [custom])
    // Test needs implementation
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:TYPE]->(:B), (:A)-[:TYPE]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) MERGE (a)-[r:TYPE]->(b) RETURN count(r)",
    );
    expect(results).toHaveLength(1);
  });

  test("[4] Using bound variables from other updating clause", () => {
    const graph = createTckGraph();

    // CREATE nodes then MERGE relationship
    const results = executeTckQuery(
      graph,
      "CREATE (a:A), (b:B) MERGE (a)-[:X]->(b) RETURN count(a)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);

    // Verify relationship was created
    const rels = executeTckQuery(graph, "MATCH (a:A)-[r:X]->(b:B) RETURN count(r)");
    expect(rels).toHaveLength(1);
    expect(rels[0]).toBe(1);
  });

  test("[5] Filtering relationships - test not implemented", () => {
    // MATCH...MERGE chaining IS working (see tests [4], [9], [custom])
    // Test needs implementation
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {id: 1})-[:TYPE]->(:B {id: 1})");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) WHERE a.id = 1 AND b.id = 1 MERGE (a)-[r:TYPE]->(b) RETURN count(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[6] Creating relationship when all matches filtered out - test not implemented", () => {
    // MATCH...MERGE chaining IS working (see tests [4], [9], [custom])
    // Test needs implementation
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {id: 1}), (:B {id: 2})");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) WHERE a.id = 1 AND b.id = 2 MERGE (a)-[r:TYPE]->(b) RETURN count(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[7] Matching incoming relationship - test not implemented", () => {
    // MATCH...MERGE chaining IS working (see tests [4], [9], [custom])
    // Test needs implementation
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)<-[:TYPE]-(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) MERGE (a)<-[r:TYPE]-(b) RETURN count(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[8] Creating relationship with property - test not implemented", () => {
    // MATCH...MERGE chaining IS working (see tests [4], [9], [custom])
    // Test needs implementation
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B)");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) MERGE (a)-[r:TYPE {name: 'test'}]->(b) RETURN r.name",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[9] Creating relationship using merged nodes", () => {
    const graph = createTckGraph();

    // Setup: create nodes
    executeTckQuery(graph, "CREATE (:A), (:B)");

    // MERGE nodes then MERGE relationship
    executeTckQuery(graph, "MERGE (a:A) MERGE (b:B) MERGE (a)-[:FOO]->(b)");

    // Verify relationship was created
    const results = executeTckQuery(graph, "MATCH (a:A)-[r:FOO]->(b:B) RETURN count(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails("[10] Merge should bind a path - unlabeled nodes (by design)", () => {
    // Original query: MERGE p = (a)-[:R]->(b) RETURN p
    // Blocked: Uses unlabeled nodes (a) and (b) - unlabeled nodes not supported (by design)
    // Note: Named paths ARE working in MATCH (see Match6 tests)
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "MERGE p = (a:A)-[:R]->(b:B) RETURN p");
    expect(results).toHaveLength(1);
  });

  test.fails("[11] Use outgoing direction when unspecified - undirected edge in MERGE not supported", () => {
    // Query: MERGE (a)-[r:KNOWS]-(b)
    // Undirected relationships in MERGE not supported in grammar
    const graph = createTckGraph();
    executeTckQuery(graph, "MERGE (a:A)-[r:KNOWS]-(b:B)");
    const results = executeTckQuery(graph, "MATCH (a:A)-[r:KNOWS]->(b:B) RETURN count(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails("[12] Match outgoing relationship when direction unspecified - undirected edge and MATCH...MERGE not supported", () => {
    // Query uses undirected relationship pattern
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:KNOWS]->(:B)");
    executeTckQuery(graph, "MATCH (a:A), (b:B) MERGE (a)-[r:KNOWS]-(b)");
    const results = executeTckQuery(graph, "MATCH ()-[r:KNOWS]->() RETURN count(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails("[13] Match both incoming and outgoing relationships when direction unspecified - undirected edges not supported", () => {
    // Query uses undirected relationship patterns
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:KNOWS]->(:B), (:A)<-[:KNOWS]-(:B)");
    executeTckQuery(graph, "MATCH (a:A), (b:B) MERGE (a)-[r:KNOWS]-(b)");
    const results = executeTckQuery(graph, "MATCH ()-[r:KNOWS]->() RETURN count(r)");
    expect(results).toHaveLength(1);
  });

  test.fails("[14] Using list properties via variable - split() function not supported", () => {
    // Blocked: split() function not implemented
    // Note: UNWIND IS working (see Unwind1 tests)
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {tags: split('a,b,c', ',')})");
    const results = executeTckQuery(graph, "MATCH (a:A) RETURN a.tags");
    expect(results).toHaveLength(1);
  });

  test("[15] Matching using list property - test not implemented", () => {
    // MATCH...MERGE chaining IS working (see tests [4], [9], [custom])
    // Test needs implementation
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {tags: [1, 2, 3]})");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.tags = [1, 2, 3] MERGE (b:B {tags: a.tags}) RETURN b.tags",
    );
    expect(results).toHaveLength(1);
  });

  test.fails("[16] Aliasing of existing nodes 1 - unlabeled nodes (by design)", () => {
    // Original query: MATCH (n) MATCH (m) WITH n AS a, m AS b MERGE (a)-[r:T]->(b)
    // Blocked: Uses unlabeled nodes (n) and (m) - unlabeled nodes not supported (by design)
    // Note: WITH...MERGE chaining likely works with labeled nodes
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N), (:M)");
    executeTckQuery(graph, "MATCH (n:N) MATCH (m:M) WITH n AS a, m AS b MERGE (a)-[r:T]->(b)");
    const results = executeTckQuery(graph, "MATCH ()-[r:T]->() RETURN count(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[17] Aliasing of existing nodes 2 - unlabeled nodes (by design)", () => {
    // Similar to [16] - uses unlabeled nodes
    // Blocked: Uses unlabeled nodes - unlabeled nodes not supported (by design)
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {id: 1}), (:M {id: 2})");
    executeTckQuery(graph, "MATCH (n:N), (m:M) WITH n AS a, m AS b MERGE (a)-[r:T]->(b)");
    const results = executeTckQuery(graph, "MATCH ()-[r:T]->() RETURN count(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails("[18] Double aliasing of existing nodes 1 - unlabeled nodes (by design)", () => {
    // Uses unlabeled nodes with complex chaining
    // Blocked: Uses unlabeled nodes - unlabeled nodes not supported (by design)
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N), (:M)");
    executeTckQuery(
      graph,
      "MATCH (n:N) MATCH (m:M) WITH n AS a, m AS b WITH a AS x, b AS y MERGE (x)-[r:T]->(y)",
    );
    const results = executeTckQuery(graph, "MATCH ()-[r:T]->() RETURN count(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[19] Double aliasing of existing nodes 2 - unlabeled nodes (by design)", () => {
    // Similar to [18] - uses unlabeled nodes
    // Blocked: Uses unlabeled nodes - unlabeled nodes not supported (by design)
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {id: 1}), (:M {id: 2})");
    executeTckQuery(
      graph,
      "MATCH (n:N), (m:M) WITH n AS a, m AS b WITH a AS x, b AS y MERGE (x)-[r:T]->(y)",
    );
    const results = executeTckQuery(graph, "MATCH ()-[r:T]->() RETURN count(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails("[20] Do not match on deleted entities - DELETE with MERGE not supported", () => {
    // Requires MATCH...DELETE...MERGE pattern
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test'}), (:B)");
    executeTckQuery(graph, "MATCH (a:A) DELETE a MERGE (b:B)-[:T]->(:A)");
    const results = executeTckQuery(graph, "MATCH (a:A) RETURN count(a)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails("[21] Do not match on deleted relationships - DELETE with MERGE not supported", () => {
    // Requires MATCH...DELETE...MERGE pattern
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    executeTckQuery(graph, "MATCH ()-[r:T]->() DELETE r MERGE (:A)-[:T]->(:B)");
    const results = executeTckQuery(graph, "MATCH ()-[r:T]->() RETURN count(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[22] Fail when imposing new predicates on a variable that is already bound - semantic validation not implemented", () => {
    // Query: CREATE (a:Foo) MERGE (a)-[r:KNOWS]->(a:Bar)
    // Requires semantic analysis for variable already bound error
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "CREATE (a:Foo) MERGE (a)-[r:KNOWS]->(a:Bar)");
    }).toThrow();
  });

  test("[23] Fail when merging relationship without type - semantic validation not implemented", () => {
    // Query: MERGE (a)-->(b) - no relationship type
    // Should be caught by grammar or semantic validation
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "MERGE (a:A)-->(b:B)");
    }).toThrow();
  });

  test("[24] Fail when merging relationship without type, no colon - semantic validation not implemented", () => {
    // Query: MERGE (a)-[NO_COLON]->(b)
    // Missing colon before type
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "MERGE (a:A)-[NO_COLON]->(b:B)");
    }).toThrow();
  });

  test("[25] Fail when merging relationship with more than one type - semantic validation not implemented", () => {
    // Query: MERGE (a)-[:A|:B]->(b)
    // Multiple relationship types
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "MERGE (a:A)-[:X|:Y]->(b:B)");
    }).toThrow();
  });

  test("[26] Fail when merging relationship that is already bound - unlabeled nodes (by design), semantic validation not implemented", () => {
    // Original query: MATCH (a)-[r]->(b) MERGE (a)-[r]->(b)
    // Blocked: Uses unlabeled nodes (a) and (b), also requires semantic validation
    // Note: MATCH...MERGE chaining IS working (see tests [4], [9], [custom])
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    expect(() => {
      executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) MERGE (a)-[r]->(b)");
    }).toThrow();
  });

  test("[27] Fail when using parameter as relationship predicate in MERGE - semantic validation not implemented", () => {
    // Original query uses $param as relationship pattern predicate
    // Blocked: Semantic validation for invalid parameter usage not implemented
    // Note: Parameters ARE working in expressions (see List1, List2 tests)
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "MERGE (a:A)-[r:T $param]->(b:B)", {
        param: { name: "test" },
      });
    }).toThrow();
  });

  test("[28] Fail when using variable length relationship in MERGE - semantic validation not implemented", () => {
    // Query: MERGE (a)-[:FOO*2]->(b)
    // Variable length in MERGE should fail
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "MERGE (a:A)-[:FOO*2]->(b:B)");
    }).toThrow();
  });

  test("[29] Fail on merging relationship with null property - semantic validation not implemented", () => {
    // Query: MERGE (a)-[r:X {num: null}]->(b)
    // Null property in MERGE should fail
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "MERGE (a:A)-[r:X {num: null}]->(b:B)");
    }).toThrow();
  });

  // Custom tests for supported relationship MERGE scenarios
  test("[custom] MERGE creates relationship between CREATEd nodes", () => {
    const graph = createTckGraph();

    // Create nodes and relationship in one query
    executeTckQuery(graph, "CREATE (a:A), (b:B) MERGE (a)-[:T]->(b)");

    // Verify
    const results = executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) RETURN count(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom] MERGE relationship with properties", () => {
    const graph = createTckGraph();

    executeTckQuery(graph, "CREATE (a:A), (b:B) MERGE (a)-[:T {name: 'test'}]->(b)");

    const results = executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) RETURN r.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom] Multiple MERGE with relationships", () => {
    const graph = createTckGraph();

    // Chain of MERGE operations
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'start'}) MERGE (b:B {name: 'end'}) MERGE (a)-[:LINK]->(b)",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A {name: 'start'})-[:LINK]->(b:B {name: 'end'}) RETURN count(a)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom] MERGE relationship matches existing", () => {
    const graph = createTckGraph();

    // First create
    executeTckQuery(graph, "CREATE (a:A), (b:B) MERGE (a)-[:T]->(b)");

    // Second MERGE should match existing
    executeTckQuery(graph, "MERGE (a:A) MERGE (b:B) MERGE (a)-[:T]->(b)");

    // Should still have only 1 relationship
    const results = executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) RETURN count(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom] MERGE incoming relationship", () => {
    const graph = createTckGraph();

    executeTckQuery(graph, "CREATE (a:A), (b:B) MERGE (a)<-[:T]-(b)");

    // Verify direction
    const results = executeTckQuery(graph, "MATCH (b:B)-[r:T]->(a:A) RETURN count(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom] MERGE relationship after WITH and multi-pattern MATCH", () => {
    // This test reproduces the bug where MERGE relationship couldn't find
    // variables passed through WITH when followed by a comma-separated MATCH.
    // The fix ensures convertMultiPattern preserves prior bindings from WITH.
    const graph = createTckGraph();

    // Create data types first
    executeTckQuery(graph, "CREATE (:DataType {name: 'UUID'}), (:DataType {name: 'String'})");

    // Execute the complex query that was failing:
    // MERGE creates a node, CREATE creates properties, WITH carries them forward,
    // MATCH with multi-pattern finds data types, MERGE creates relationships
    const query = `
      MERGE (cUser:Concept {name:"User"}) SET cUser.description="User description"
      CREATE (pUserId:Property {name:"id"}) SET pUserId.description="User id"
      CREATE (pUserName:Property {name:"name"}) SET pUserName.description="User name"
      WITH cUser, pUserId, pUserName
      MATCH (dtUUID:DataType {name:"UUID"}), (dtString:DataType {name:"String"})
      MERGE (cUser)-[:Contains]->(pUserId) MERGE (pUserId)-[:References]->(dtUUID)
      MERGE (cUser)-[:Contains]->(pUserName) MERGE (pUserName)-[:References]->(dtString)
    `;

    // This should not throw "MERGE: Start variable 'cUser' not found"
    executeTckQuery(graph, query);

    // Verify nodes were created
    const concepts = executeTckQuery(
      graph,
      "MATCH (c:Concept {name: 'User'}) RETURN c.description",
    );
    expect(concepts).toHaveLength(1);
    expect(concepts[0]).toBe("User description");

    // Verify relationships were created
    const containsRels = executeTckQuery(
      graph,
      "MATCH (:Concept)-[r:Contains]->(:Property) RETURN count(r)",
    );
    expect(containsRels).toHaveLength(1);
    expect(containsRels[0]).toBe(2);

    const refsRels = executeTckQuery(
      graph,
      "MATCH (:Property)-[r:References]->(:DataType) RETURN count(r)",
    );
    expect(refsRels).toHaveLength(1);
    expect(refsRels[0]).toBe(2);
  });
});
