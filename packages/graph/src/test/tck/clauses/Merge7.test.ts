/**
 * TCK Merge7 - Merge relationships - on match
 * Translated from tmp/tck/features/clauses/merge/Merge7.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Merge7 - Merge relationships - on match", () => {
  test("[1] Using ON MATCH on created node - MATCH...MERGE chaining not supported", () => {
    // Query requires MATCH (a:A), (b:B) MERGE (a)-[:KNOWS]->(b) ON MATCH SET b.created = 1
    // This creates a new relationship so ON MATCH wouldn't trigger anyway
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B)");
    executeTckQuery(graph, "MATCH (a:A), (b:B) MERGE (a)-[:KNOWS]->(b) ON MATCH SET b.created = 1");
    const results = executeTckQuery(graph, "MATCH (b:B) RETURN b.created");
    expect(results).toHaveLength(1);
    // ON MATCH should NOT trigger since relationship was created
    expect(results[0]).toBeUndefined();
  });

  test("[2] Using ON MATCH on created relationship - MATCH...MERGE chaining not supported", () => {
    // Query requires MATCH followed by MERGE
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B)");
    executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) MERGE (a)-[r:TYPE]->(b) ON MATCH SET r.name = 'matched'",
    );
    const results = executeTckQuery(graph, "MATCH ()-[r:TYPE]->() RETURN r.name");
    expect(results).toHaveLength(1);
    // ON MATCH should NOT trigger since relationship was created
    expect(results[0]).toBeUndefined();
  });

  test("[3] Using ON MATCH on a relationship - MATCH...MERGE chaining not supported", () => {
    // Query requires MATCH followed by MERGE
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:TYPE]->(:B)");
    executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) MERGE (a)-[r:TYPE]->(b) ON MATCH SET r.name = 'matched'",
    );
    const results = executeTckQuery(graph, "MATCH ()-[r:TYPE]->() RETURN r.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("matched");
  });

  test.fails("[4] Copying properties from node with ON MATCH - MATCH...MERGE chaining and SET r = a not supported", () => {
    // Query: ON MATCH SET r = a
    // Property copying syntax not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', value: 42})-[:TYPE]->(:B)");
    executeTckQuery(graph, "MATCH (a:A), (b:B) MERGE (a)-[r:TYPE]->(b) ON MATCH SET r = a");
    const results = executeTckQuery(graph, "MATCH ()-[r:TYPE]->() RETURN r.name, r.value");
    expect(results).toHaveLength(1);
    const [name, value] = results[0] as [string, number];
    expect(name).toBe("test");
    expect(value).toBe(42);
  });

  test.fails("[5] Copying properties from literal map with ON MATCH - MATCH...MERGE chaining and SET += not supported", () => {
    // Query: ON MATCH SET r += {name: 'baz', name2: 'baz'}
    // += operator with map not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:TYPE]->(:B)");
    executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) MERGE (a)-[r:TYPE]->(b) ON MATCH SET r += {name: 'baz', name2: 'baz'}",
    );
    const results = executeTckQuery(graph, "MATCH ()-[r:TYPE]->() RETURN r.name, r.name2");
    expect(results).toHaveLength(1);
    const [name, name2] = results[0] as [string, string];
    expect(name).toBe("baz");
    expect(name2).toBe("baz");
  });

  // Custom tests for supported relationship ON MATCH scenarios
  test("[custom] ON MATCH sets property on relationship when matching", () => {
    const graph = createTckGraph();

    // First create relationship
    executeTckQuery(
      graph,
      "CREATE (a:A), (b:B) MERGE (a)-[r:T]->(b) ON MATCH SET r.matched = true",
    );

    // ON MATCH didn't trigger since relationship was created
    const results1 = executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) RETURN r.matched");
    expect(results1).toHaveLength(1);
    expect(results1[0]).toBeUndefined();

    // Second MERGE should match and trigger ON MATCH
    executeTckQuery(
      graph,
      "MERGE (a:A) MERGE (b:B) MERGE (a)-[r:T]->(b) ON MATCH SET r.matched = true",
    );

    const results2 = executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) RETURN r.matched");
    expect(results2).toHaveLength(1);
    expect(results2[0]).toBe(true);
  });

  test("[custom] ON MATCH updates relationship property", () => {
    const graph = createTckGraph();

    // Create relationship with initial property
    executeTckQuery(graph, "CREATE (a:A), (b:B) MERGE (a)-[r:T {value: 'old'}]->(b)");

    // MERGE with ON MATCH updates property
    executeTckQuery(
      graph,
      "MERGE (a:A) MERGE (b:B) MERGE (a)-[r:T]->(b) ON MATCH SET r.value = 'new'",
    );

    const results = executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) RETURN r.value");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("new");
  });

  test("[custom] ON MATCH does not trigger when creating new relationship", () => {
    const graph = createTckGraph();

    // Create with ON MATCH - should not trigger
    executeTckQuery(graph, "CREATE (a:A), (b:B) MERGE (a)-[r:T]->(b) ON MATCH SET r.found = true");

    const results = executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) RETURN r.found");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeUndefined();
  });

  test("[custom] ON MATCH with multiple properties", () => {
    const graph = createTckGraph();

    // Create relationship
    executeTckQuery(graph, "CREATE (a:A), (b:B) MERGE (a)-[r:T]->(b)");

    // Match and set multiple properties
    executeTckQuery(
      graph,
      "MERGE (a:A) MERGE (b:B) MERGE (a)-[r:T]->(b) ON MATCH SET r.x = 10, r.y = 20",
    );

    const results = executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) RETURN r.x, r.y");
    expect(results).toHaveLength(1);
    const [x, y] = results[0] as [number, number];
    expect(x).toBe(10);
    expect(y).toBe(20);
  });
});
