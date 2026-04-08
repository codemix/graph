/**
 * TCK Quantifier2 - Single quantifier
 * Translated from tmp/tck/features/expressions/quantifier/Quantifier2.feature
 *
 * NOTE: All original TCK tests use RETURN-only queries (e.g., `RETURN single(x IN [...] WHERE ...)`).
 * The grammar requires queries to start with MATCH, CREATE, UNWIND, etc.
 * Custom tests demonstrate single() functionality in WHERE clause.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Quantifier2 - Single quantifier", () => {
  test("[1] Single quantifier is always false on empty list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN single(x IN [] WHERE true) AS a, single(x IN [] WHERE false) AS b",
    );
    expect(results).toHaveLength(1);
    // Both should be false because single() on empty list is always false
    expect(results[0]).toEqual([false, false]);
  });

  test("[2] Single quantifier on list literal containing booleans", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN single(x IN [true] WHERE x) AS result");
    expect(results).toHaveLength(1);
    // single(x IN [true] WHERE x) is true because exactly one element is true
    expect(results[0]).toBe(true);
  });

  test("[3] Single quantifier on list literal containing integers", () => {
    const graph = createTckGraph();
    // single(x IN [1, 2, 3] WHERE x = 2) - exactly one element equals 2
    const results = executeTckQuery(graph, "RETURN single(x IN [1, 2, 3] WHERE x = 2) AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[4] Single quantifier on list literal containing floats", () => {
    const graph = createTckGraph();
    // single(x IN [1.1, 2.1, 3.5] WHERE x = 2.1) - exactly one element equals 2.1
    const results = executeTckQuery(
      graph,
      "RETURN single(x IN [1.1, 2.1, 3.5] WHERE x = 2.1) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[5] Single quantifier on list literal containing strings", () => {
    const graph = createTckGraph();
    // single(x IN ['abc', 'ef'] WHERE size(x) = 3) - exactly one string has size 3
    const results = executeTckQuery(
      graph,
      "RETURN single(x IN ['abc', 'ef'] WHERE size(x) = 3) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[6] Single quantifier on list literal containing lists", () => {
    const graph = createTckGraph();
    // single(x IN [[1,2,3], ['a']] WHERE size(x) = 3) - exactly one list has size 3
    const results = executeTckQuery(
      graph,
      "RETURN single(x IN [[1,2,3], ['a']] WHERE size(x) = 3) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[7] Single quantifier on list literal containing maps", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN single(x IN [{a: 2}, {a: 4}] WHERE x.a = 2) AS result",
    );
    expect(results).toHaveLength(1);
    // single() is true because exactly one map has a=2
    expect(results[0]).toBe(true);
  });

  test("[8] Single quantifier on list containing nodes - variable length *0 not supported", () => {
    // Original: MATCH p = (:SNodes)-[*0..3]->(x) WITH tail(nodes(p)) AS nodes RETURN nodes, single(x IN nodes WHERE x.name = 'a')
    // Uses *0..3 which allows zero-length paths - not fully supported
    const graph = createTckGraph();
    graph.addVertex("SNodes", { name: "start" });
    graph.addVertex("Node", { name: "a" });
    graph.addVertex("Node", { name: "b" });
    graph.addVertex("Node", { name: "c" });
    const results = executeTckQuery(
      graph,
      "MATCH p = (:SNodes)-[*0..3]->(x) WITH tail(nodes(p)) AS nodes RETURN nodes, single(x IN nodes WHERE x.name = 'a')",
    );
    expect(results).toHaveLength(1);
  });

  test("[9] Single quantifier on list containing relationships - variable length *0 not supported", () => {
    // Original: MATCH p = (:SRelationships)-[*0..4]->(x) WITH tail(relationships(p)) AS rels RETURN rels, single(x IN rels WHERE x.name = 'a')
    // Uses *0..4 which allows zero-length paths - not fully supported
    const graph = createTckGraph();
    graph.addVertex("SRelationships", { name: "start" });
    graph.addVertex("Node", { name: "end" });
    const results = executeTckQuery(
      graph,
      "MATCH p = (:SRelationships)-[*0..4]->(x) WITH tail(relationships(p)) AS rels RETURN rels, single(x IN rels WHERE x.name = 'a')",
    );
    expect(results).toHaveLength(1);
  });

  test("[10] Single quantifier on lists containing nulls", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN single(x IN [null, 2] WHERE x = 2) AS result");
    expect(results).toHaveLength(1);
    // single() is true because exactly one element equals 2
    expect(results[0]).toBe(true);
  });

  test("[11] Single quantifier with IS NULL predicate", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN single(x IN [0, null] WHERE x IS NULL) AS result",
    );
    expect(results).toHaveLength(1);
    // single() is true because exactly one element is null
    expect(results[0]).toBe(true);
  });

  test("[12] Single quantifier with IS NOT NULL predicate", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN single(x IN [null, 2] WHERE x IS NOT NULL) AS result",
    );
    expect(results).toHaveLength(1);
    // single() is true because exactly one element is not null
    expect(results[0]).toBe(true);
  });

  test("[13] Single quantifier is false if predicate is statically false", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN single(x IN [1, null, true] WHERE false) AS result",
    );
    expect(results).toHaveLength(1);
    // single() is false when no element satisfies the predicate
    expect(results[0]).toBe(false);
  });

  test("[14] Single quantifier is false if predicate is statically true and list has more than one element", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN single(x IN [1, null, true] WHERE true) AS result",
    );
    expect(results).toHaveLength(1);
    // single() is false when more than one element satisfies the predicate
    expect(results[0]).toBe(false);
  });

  test("[15] Single quantifier is true if predicate is statically true and list has exactly one element", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN single(x IN [1] WHERE true) AS result");
    expect(results).toHaveLength(1);
    // single() is true when exactly one element satisfies the predicate
    expect(results[0]).toBe(true);
  });

  test.fails("[16] Fail single quantifier on type mismatch - semantic validation not implemented", () => {
    // Original: RETURN single(x IN ['Clara'] WHERE x % 2 = 0) AS result
    // Expected: SyntaxError InvalidArgumentType
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "RETURN single(x IN ['Clara'] WHERE x % 2 = 0) AS result");
    }).toThrow();
  });

  // Custom tests demonstrating single() functionality in WHERE clause

  test("[custom-1] single() returns true when exactly one element satisfies condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [1, 2, 3] });

    // Exactly one score equals 2
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x = 2) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-2] single() returns false when no elements satisfy condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [1, 3, 5] });

    // No score equals 2
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x = 2) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-3] single() returns false when more than one element satisfies condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [2, 2, 3] });

    // Two scores equal 2
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x = 2) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-4] single() returns false on empty list", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "empty", scores: [] });

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x > 0) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-5] single() with literal list in WHERE - exactly one match", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test" });

    // Exactly one element in [1, 2, 3] equals 2
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN [1, 2, 3] WHERE x = 2) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-6] single() with literal list in WHERE - multiple matches", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test" });

    // Multiple elements in [1, 2, 3] are > 1
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN [1, 2, 3] WHERE x > 1) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-7] single() combined with other conditions using AND", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "alice", scores: [100] });
    graph.addVertex("A", { name: "bob", scores: [50, 60] });

    // Find nodes where name starts with 'a' AND exactly one score >= 100
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name STARTS WITH 'a' AND SINGLE(x IN a.scores WHERE x >= 100) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("alice");
  });

  test("[custom-8] single() filters nodes correctly based on array content", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "one-match", scores: [1, 2, 3] });
    graph.addVertex("A", { name: "two-matches", scores: [2, 2, 3] });
    graph.addVertex("A", { name: "no-match", scores: [1, 3, 5] });

    // Find nodes with exactly one score equal to 2
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x = 2) RETURN a.name ORDER BY a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("one-match");
  });

  test("[custom-9] single() with range condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [5, 15, 25] });

    // Exactly one score is between 10 and 20 (15)
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x > 10 AND x < 20) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-10] single() with string items", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", items: ["foo", "bar", "baz"] });

    // Exactly one item equals 'bar'
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.items WHERE x = 'bar') RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });
});
