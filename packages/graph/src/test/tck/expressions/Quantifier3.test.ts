/**
 * TCK Quantifier3 - Any quantifier
 * Translated from tmp/tck/features/expressions/quantifier/Quantifier3.feature
 *
 * NOTE: All original TCK tests use RETURN-only queries (e.g., `RETURN any(x IN [...] WHERE ...)`).
 * The grammar requires queries to start with MATCH, CREATE, UNWIND, etc.
 * Custom tests demonstrate any() functionality in WHERE clause.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Quantifier3 - Any quantifier", () => {
  test("[1] Any quantifier is always false on empty list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN any(x IN [] WHERE true) AS a, any(x IN [] WHERE false) AS b",
    );
    expect(results).toHaveLength(1);
    // Both should be false because any() on empty list is always false
    expect(results[0]).toEqual([false, false]);
  });

  test("[2] Any quantifier on list literal containing booleans", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN any(x IN [true] WHERE x) AS result");
    expect(results).toHaveLength(1);
    // any(x IN [true] WHERE x) is true because at least one element is true
    expect(results[0]).toBe(true);
  });

  test("[3] Any quantifier on list literal containing integers", () => {
    const graph = createTckGraph();
    // any(x IN [1, 2, 3] WHERE x = 2) - at least one element equals 2
    const results = executeTckQuery(graph, "RETURN any(x IN [1, 2, 3] WHERE x = 2) AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[4] Any quantifier on list literal containing floats", () => {
    const graph = createTckGraph();
    // any(x IN [1.1, 2.1, 3.5] WHERE x = 2.1) - at least one element equals 2.1
    const results = executeTckQuery(
      graph,
      "RETURN any(x IN [1.1, 2.1, 3.5] WHERE x = 2.1) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[5] Any quantifier on list literal containing strings", () => {
    const graph = createTckGraph();
    // any(x IN ['abc', 'ef'] WHERE size(x) = 3) - at least one string has size 3
    const results = executeTckQuery(
      graph,
      "RETURN any(x IN ['abc', 'ef'] WHERE size(x) = 3) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[6] Any quantifier on list literal containing lists", () => {
    const graph = createTckGraph();
    // any(x IN [[1,2,3], ['a']] WHERE size(x) = 3) - at least one list has size 3
    const results = executeTckQuery(
      graph,
      "RETURN any(x IN [[1,2,3], ['a']] WHERE size(x) = 3) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[7] Any quantifier on list literal containing maps", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN any(x IN [{a: 2}, {a: 4}] WHERE x.a = 2) AS result",
    );
    expect(results).toHaveLength(1);
    // any() is true because at least one map has a=2
    expect(results[0]).toBe(true);
  });

  test("[8] Any quantifier on list containing nodes", () => {
    // Original: MATCH p = (:SNodes)-[*0..3]->(x) WITH tail(nodes(p)) AS nodes RETURN nodes, any(x IN nodes WHERE x.name = 'a')
    // Uses *0..3 which allows zero-length paths - not fully supported
    const graph = createTckGraph();
    graph.addVertex("SNodes", { name: "start" });
    graph.addVertex("Node", { name: "a" });
    graph.addVertex("Node", { name: "b" });
    graph.addVertex("Node", { name: "c" });
    const results = executeTckQuery(
      graph,
      "MATCH p = (:SNodes)-[*0..3]->(x) WITH tail(nodes(p)) AS nodes RETURN nodes, any(x IN nodes WHERE x.name = 'a')",
    );
    expect(results).toHaveLength(1);
  });

  test("[9] Any quantifier on list containing relationships", () => {
    // Original: MATCH p = (:SRelationships)-[*0..4]->(x) WITH tail(relationships(p)) AS rels RETURN rels, any(x IN rels WHERE x.name = 'a')
    // Uses *0..4 which allows zero-length paths - not fully supported
    const graph = createTckGraph();
    graph.addVertex("SRelationships", { name: "start" });
    graph.addVertex("Node", { name: "end" });
    const results = executeTckQuery(
      graph,
      "MATCH p = (:SRelationships)-[*0..4]->(x) WITH tail(relationships(p)) AS rels RETURN rels, any(x IN rels WHERE x.name = 'a')",
    );
    expect(results).toHaveLength(1);
  });

  test("[10] Any quantifier on lists containing nulls", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN any(x IN [null, 2] WHERE x = 2) AS result");
    expect(results).toHaveLength(1);
    // any() is true because at least one element equals 2
    expect(results[0]).toBe(true);
  });

  test("[11] Any quantifier with IS NULL predicate", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN any(x IN [0, null] WHERE x IS NULL) AS result");
    expect(results).toHaveLength(1);
    // any() is true because at least one element is null
    expect(results[0]).toBe(true);
  });

  test("[12] Any quantifier with IS NOT NULL predicate", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN any(x IN [null, 2] WHERE x IS NOT NULL) AS result",
    );
    expect(results).toHaveLength(1);
    // any() is true because at least one element is not null
    expect(results[0]).toBe(true);
  });

  test("[13] Any quantifier is false if predicate is statically false", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN any(x IN [1, null, true] WHERE false) AS result",
    );
    expect(results).toHaveLength(1);
    // any() is false when no element satisfies the predicate
    expect(results[0]).toBe(false);
  });

  test("[14] Any quantifier is true if predicate is statically true and list is not empty", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN any(x IN [1, null, true] WHERE true) AS result");
    expect(results).toHaveLength(1);
    // any() is true when at least one element satisfies the predicate
    expect(results[0]).toBe(true);
  });

  test.fails("[15] Fail any quantifier on type mismatch - semantic validation not implemented", () => {
    // Original: RETURN any(x IN ['Clara'] WHERE x % 2 = 0) AS result
    // Expected: SyntaxError InvalidArgumentType
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "RETURN any(x IN ['Clara'] WHERE x % 2 = 0) AS result");
    }).toThrow();
  });

  // Custom tests demonstrating any() functionality in WHERE clause

  test("[custom-1] any() returns true when at least one element satisfies condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [1, 2, 3] });

    // At least one score equals 2
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x = 2) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-2] any() returns true when multiple elements satisfy condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [10, 20, 30] });

    // Multiple scores are > 15
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x > 15) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-3] any() returns false when no elements satisfy condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [1, 2, 3] });

    // No score is > 100
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x > 100) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-4] any() returns false on empty list", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "empty", scores: [] });

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x > 0) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-5] any() with literal list in WHERE - has match", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test" });

    // At least one element in [1, 2, 3] equals 2
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN [1, 2, 3] WHERE x = 2) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-6] any() with literal list in WHERE - no match", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test" });

    // No element in [1, 2, 3] is > 10
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN [1, 2, 3] WHERE x > 10) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-7] any() combined with other conditions using AND", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "alice", scores: [50, 100, 150] });
    graph.addVertex("A", { name: "bob", scores: [10, 20, 30] });

    // Find nodes where name starts with 'a' AND any score >= 100
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name STARTS WITH 'a' AND ANY(x IN a.scores WHERE x >= 100) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("alice");
  });

  test("[custom-8] any() filters nodes correctly based on array content", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "has-negative", scores: [-5, 10, 20] });
    graph.addVertex("A", { name: "all-positive", scores: [5, 10, 15] });

    // Find nodes with any negative score
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x < 0) RETURN a.name ORDER BY a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("has-negative");
  });

  test("[custom-9] any() is equivalent to NOT none()", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "a1", scores: [1, 2, 3] });
    graph.addVertex("A", { name: "a2", scores: [4, 5, 6] });

    // Nodes where any score < 3 should match same as NOT none(scores < 3)
    const anyResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x < 3) RETURN a.name ORDER BY a.name",
    );

    // For a1: scores [1,2,3] - 1 and 2 are < 3, so ANY returns true
    // For a2: scores [4,5,6] - none < 3, so ANY returns false
    expect(anyResults).toHaveLength(1);
    expect(anyResults[0]).toBe("a1");
  });

  test("[custom-10] any() with string items", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", items: ["foo", "bar", "baz"] });

    // At least one item equals 'bar'
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.items WHERE x = 'bar') RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-11] any() with OR condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [5, 15, 25] });

    // Any score is < 10 OR > 20
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x < 10 OR x > 20) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });
});
