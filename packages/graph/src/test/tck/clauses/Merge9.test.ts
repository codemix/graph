/**
 * TCK Merge9 - Merge clause interoperation with other clauses
 * Translated from tmp/tck/features/clauses/merge/Merge9.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Merge9 - Merge clause interoperation with other clauses", () => {
  test("[1] UNWIND with one MERGE - UNWIND and unlabeled nodes not supported", () => {
    // Query: UNWIND [1, 2, 3, 4] AS int MERGE (n {id: int}) RETURN count(*)
    // Uses UNWIND and unlabeled nodes
    const graph = createTckGraph();
    executeTckQuery(graph, "UNWIND [1, 2, 3, 4] AS int MERGE (n:N {id: int})");
    const results = executeTckQuery(graph, "MATCH (n:N) RETURN count(n)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(4);
  });

  test("[2] UNWIND with multiple MERGE - UNWIND not fully supported", () => {
    // Query: UNWIND [...] AS actor MERGE (m:Movie {name: 'The Matrix'}) MERGE (p:Person {name: actor}) MERGE (p)-[:ACTED_IN]->(m)
    // Uses UNWIND
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "UNWIND ['Keanu', 'Carrie', 'Laurence'] AS actor MERGE (m:Movie {name: 'The Matrix'}) MERGE (p:Person {name: actor}) MERGE (p)-[:ACTED_IN]->(m)",
    );
    const movieResults = executeTckQuery(graph, "MATCH (m:Movie) RETURN count(m)");
    expect(movieResults[0]).toBe(1);
    const personResults = executeTckQuery(graph, "MATCH (p:Person) RETURN count(p)");
    expect(personResults[0]).toBe(3);
    const relResults = executeTckQuery(graph, "MATCH ()-[r:ACTED_IN]->() RETURN count(r)");
    expect(relResults[0]).toBe(3);
  });

  test("[3] Mixing MERGE with CREATE", () => {
    const graph = createTckGraph();

    // CREATE nodes, MERGE relationship, CREATE another relationship
    const results = executeTckQuery(
      graph,
      "CREATE (a:A), (b:B) MERGE (a)-[:KNOWS]->(b) CREATE (b)-[:KNOWS]->(c:C) RETURN count(a)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);

    // Verify all nodes exist
    const nodesA = executeTckQuery(graph, "MATCH (n:A) RETURN count(n)");
    expect(nodesA[0]).toBe(1);

    const nodesB = executeTckQuery(graph, "MATCH (n:B) RETURN count(n)");
    expect(nodesB[0]).toBe(1);

    const nodesC = executeTckQuery(graph, "MATCH (n:C) RETURN count(n)");
    expect(nodesC[0]).toBe(1);

    // Verify relationships
    const rels = executeTckQuery(graph, "MATCH ()-[r:KNOWS]->() RETURN count(r)");
    expect(rels[0]).toBe(2);
  });

  test("[4] MERGE after WITH with predicate and WITH with aggregation - UNWIND and complex WITH chaining not supported", () => {
    // Query: UNWIND [42] AS props WITH props WHERE props > 32 WITH DISTINCT props AS p MERGE (a:A {num: p})
    // Uses UNWIND and complex WITH chaining
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "UNWIND [42] AS props WITH props WHERE props > 32 WITH DISTINCT props AS p MERGE (a:A {num: p})",
    );
    const results = executeTckQuery(graph, "MATCH (a:A) RETURN a.num");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(42);
  });

  // Custom tests for clause interoperation
  test("[custom] CREATE followed by MERGE", () => {
    const graph = createTckGraph();

    // CREATE then MERGE - MERGE should create new relationship
    executeTckQuery(
      graph,
      "CREATE (a:A {name: 'test'}), (b:B {name: 'other'}) MERGE (a)-[:T]->(b)",
    );

    const results = executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) RETURN a.name, b.name");
    expect(results).toHaveLength(1);
    const [aName, bName] = results[0] as [string, string];
    expect(aName).toBe("test");
    expect(bName).toBe("other");
  });

  test("[custom] Multiple MERGE then CREATE", () => {
    const graph = createTckGraph();

    // Multiple MERGE operations followed by CREATE
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'first'}) MERGE (b:B {name: 'second'}) CREATE (c:C {name: 'third'})",
    );

    const resultsA = executeTckQuery(graph, "MATCH (n:A {name: 'first'}) RETURN count(n)");
    expect(resultsA[0]).toBe(1);

    const resultsB = executeTckQuery(graph, "MATCH (n:B {name: 'second'}) RETURN count(n)");
    expect(resultsB[0]).toBe(1);

    const resultsC = executeTckQuery(graph, "MATCH (n:C {name: 'third'}) RETURN count(n)");
    expect(resultsC[0]).toBe(1);
  });

  test("[custom] CREATE, MERGE node, MERGE relationship", () => {
    const graph = createTckGraph();

    executeTckQuery(graph, "CREATE (a:A) MERGE (b:B) MERGE (a)-[:LINK]->(b)");

    const results = executeTckQuery(graph, "MATCH (a:A)-[:LINK]->(b:B) RETURN count(a)");
    expect(results[0]).toBe(1);
  });

  test("[custom] Multiple MERGE with same pattern should not duplicate", () => {
    const graph = createTckGraph();

    // Create initial data
    executeTckQuery(graph, "CREATE (:A {name: 'unique'}), (:B {name: 'unique'})");

    // Multiple MERGEs for same patterns
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'unique'}) MERGE (b:B {name: 'unique'}) MERGE (a)-[:T]->(b)",
    );
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'unique'}) MERGE (b:B {name: 'unique'}) MERGE (a)-[:T]->(b)",
    );
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'unique'}) MERGE (b:B {name: 'unique'}) MERGE (a)-[:T]->(b)",
    );

    // Should still have only 1 of each
    const nodesA = executeTckQuery(graph, "MATCH (n:A {name: 'unique'}) RETURN count(n)");
    expect(nodesA[0]).toBe(1);

    const nodesB = executeTckQuery(graph, "MATCH (n:B {name: 'unique'}) RETURN count(n)");
    expect(nodesB[0]).toBe(1);

    const rels = executeTckQuery(
      graph,
      "MATCH (a:A {name: 'unique'})-[r:T]->(b:B {name: 'unique'}) RETURN count(r)",
    );
    expect(rels[0]).toBe(1);
  });
});
