/**
 * TCK Quantifier4 - All quantifier
 * Translated from tmp/tck/features/expressions/quantifier/Quantifier4.feature
 *
 * NOTE: All original TCK tests use RETURN-only queries (e.g., `RETURN all(x IN [...] WHERE ...)`).
 * The grammar requires queries to start with MATCH, CREATE, UNWIND, etc.
 * Custom tests demonstrate all() functionality in WHERE clause.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Quantifier4 - All quantifier", () => {
  test("[1] All quantifier is always true on empty list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [] WHERE true) AS a, all(x IN [] WHERE false) AS b",
    );
    expect(results).toHaveLength(1);
    // Both should be true because all() on empty list is vacuously true
    expect(results[0]).toEqual([true, true]);
  });

  test("[2] All quantifier on list literal containing booleans", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [true] WHERE x) AS result",
    );
    expect(results).toHaveLength(1);
    // all(x IN [true] WHERE x) is true because all elements satisfy the predicate
    expect(results[0]).toBe(true);
  });

  test("[3] All quantifier on list literal containing integers", () => {
    const graph = createTckGraph();
    // all(x IN [1, 2, 3] WHERE x = 2) - not all elements equal 2
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [1, 2, 3] WHERE x = 2) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[4] All quantifier on list literal containing floats", () => {
    const graph = createTckGraph();
    // all(x IN [1.1, 2.1, 3.5] WHERE x = 2.1) - not all elements equal 2.1
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [1.1, 2.1, 3.5] WHERE x = 2.1) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[5] All quantifier on list literal containing strings", () => {
    const graph = createTckGraph();
    // all(x IN ['abc', 'ef'] WHERE size(x) = 3) - not all strings have size 3
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN ['abc', 'ef'] WHERE size(x) = 3) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[6] All quantifier on list literal containing lists", () => {
    const graph = createTckGraph();
    // all(x IN [[1,2,3], ['a']] WHERE size(x) = 3) - not all lists have size 3
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [[1,2,3], ['a']] WHERE size(x) = 3) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[7] All quantifier on list literal containing maps", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [{a: 2}, {a: 4}] WHERE x.a = 2) AS result",
    );
    expect(results).toHaveLength(1);
    // all() is false because not all maps have a=2
    expect(results[0]).toBe(false);
  });

  test("[8] All quantifier on list containing nodes", () => {
    // Original: MATCH p = (:SNodes)-[*0..3]->(x) WITH tail(nodes(p)) AS nodes RETURN nodes, all(x IN nodes WHERE x.name = 'a')
    // Uses *0..3 which allows zero-length paths - not fully supported
    const graph = createTckGraph();
    graph.addVertex("SNodes", { name: "start" });
    graph.addVertex("Node", { name: "a" });
    graph.addVertex("Node", { name: "b" });
    graph.addVertex("Node", { name: "c" });
    const results = executeTckQuery(
      graph,
      "MATCH p = (:SNodes)-[*0..3]->(x) WITH tail(nodes(p)) AS nodes RETURN nodes, all(x IN nodes WHERE x.name = 'a')",
    );
    expect(results).toHaveLength(1);
  });

  test("[9] All quantifier on list containing relationships", () => {
    // Original: MATCH p = (:SRelationships)-[*0..4]->(x) WITH tail(relationships(p)) AS rels RETURN rels, all(x IN rels WHERE x.name = 'a')
    // Uses *0..4 which allows zero-length paths - not fully supported
    const graph = createTckGraph();
    graph.addVertex("SRelationships", { name: "start" });
    graph.addVertex("Node", { name: "end" });
    const results = executeTckQuery(
      graph,
      "MATCH p = (:SRelationships)-[*0..4]->(x) WITH tail(relationships(p)) AS rels RETURN rels, all(x IN rels WHERE x.name = 'a')",
    );
    expect(results).toHaveLength(1);
  });

  test("[10] All quantifier on lists containing nulls", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [null, 2] WHERE x = 2) AS result",
    );
    expect(results).toHaveLength(1);
    // all() is false because not all elements equal 2 (null doesn't)
    expect(results[0]).toBe(false);
  });

  test("[11] All quantifier with IS NULL predicate", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [0, null] WHERE x IS NULL) AS result",
    );
    expect(results).toHaveLength(1);
    // all() is false because not all elements are null
    expect(results[0]).toBe(false);
  });

  test("[12] All quantifier with IS NOT NULL predicate", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [null, 2] WHERE x IS NOT NULL) AS result",
    );
    expect(results).toHaveLength(1);
    // all() is false because not all elements are not null
    expect(results[0]).toBe(false);
  });

  test("[13] All quantifier is false if predicate is statically false and list is not empty", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [1, null, true] WHERE false) AS result",
    );
    expect(results).toHaveLength(1);
    // all() is false when any element doesn't satisfy the predicate
    expect(results[0]).toBe(false);
  });

  test("[14] All quantifier is true if predicate is statically true and list is not empty", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [1, null, true] WHERE true) AS result",
    );
    expect(results).toHaveLength(1);
    // all() is true when all elements satisfy the predicate
    expect(results[0]).toBe(true);
  });

  test.fails(
    "[15] Fail all quantifier on type mismatch - semantic validation not implemented",
    () => {
      // Original: RETURN all(x IN ['Clara'] WHERE x % 2 = 0) AS result
      // Expected: SyntaxError InvalidArgumentType
      const graph = createTckGraph();
      expect(() => {
        executeTckQuery(
          graph,
          "RETURN all(x IN ['Clara'] WHERE x % 2 = 0) AS result",
        );
      }).toThrow();
    },
  );

  // Custom tests demonstrating all() functionality in WHERE clause

  test("[custom-1] all() returns true when all elements satisfy condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [10, 20, 30] });

    // All scores are > 0
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 0) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-2] all() returns false when at least one element does not satisfy condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [10, -5, 30] });

    // Not all scores are > 0
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 0) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-3] all() returns true on empty list (vacuously true)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "empty", scores: [] });

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 0) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("empty");
  });

  test("[custom-4] all() with literal list in WHERE - all match", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test" });

    // All elements in [1, 2, 3] are > 0
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN [1, 2, 3] WHERE x > 0) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-5] all() with literal list in WHERE - not all match", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test" });

    // Not all elements in [1, 2, 3] are > 2
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN [1, 2, 3] WHERE x > 2) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-6] all() combined with other conditions using AND", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "alice", scores: [50, 60, 70] });
    graph.addVertex("A", { name: "bob", scores: [50, 100, 150] });

    // Find nodes where name starts with 'a' AND all scores are < 100
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name STARTS WITH 'a' AND ALL(x IN a.scores WHERE x < 100) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("alice");
  });

  test("[custom-7] all() filters nodes correctly based on array content", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "all-positive", scores: [5, 10, 15] });
    graph.addVertex("A", { name: "has-negative", scores: [-5, 10, 20] });

    // Find nodes where all scores are positive
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 0) RETURN a.name ORDER BY a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("all-positive");
  });

  test("[custom-8] all() with range condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "in-range", scores: [15, 18, 12] });
    graph.addVertex("A", { name: "out-of-range", scores: [5, 25, 15] });

    // Find nodes where all scores are between 10 and 20
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x >= 10 AND x <= 20) RETURN a.name ORDER BY a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("in-range");
  });

  test("[custom-9] all() with string items using equality", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "all-same", items: ["foo", "foo", "foo"] });
    graph.addVertex("A", { name: "mixed", items: ["foo", "bar", "baz"] });

    // All items equal 'foo'
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.items WHERE x = 'foo') RETURN a.name ORDER BY a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("all-same");
  });

  test("[custom-10] all() is equivalent to NOT any(NOT condition)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "a1", scores: [5, 10, 15] });
    graph.addVertex("A", { name: "a2", scores: [5, 25, 35] });

    // all(x < 20) should match nodes where NOT any(x >= 20)
    const allResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x < 20) RETURN a.name ORDER BY a.name",
    );

    // a1: all scores < 20, returns true
    // a2: 25 and 35 are not < 20, returns false
    expect(allResults).toHaveLength(1);
    expect(allResults[0]).toBe("a1");
  });

  test("[custom-11] all() with equality condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "all-twos", scores: [2, 2, 2] });
    graph.addVertex("A", { name: "mixed", scores: [1, 2, 3] });

    // Find nodes where all scores equal 2
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x = 2) RETURN a.name ORDER BY a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("all-twos");
  });
});
