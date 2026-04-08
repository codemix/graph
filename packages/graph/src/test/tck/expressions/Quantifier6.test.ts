/**
 * TCK Quantifier6 - Single quantifier interop
 * Translated from tmp/tck/features/expressions/quantifier/Quantifier6.feature
 *
 * Tests demonstrating single() quantifier interoperability with other quantifiers.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Quantifier6 - Single quantifier interop", () => {
  // Original TCK tests - now enabled with RETURN-only queries
  test("[1] Single quantifier can nest itself and other quantifiers on nested lists", () => {
    const graph = createTckGraph();
    // RETURN single(x IN [['abc'], ['abc', 'def']] WHERE any(y IN x WHERE y = 'ghi')) AS result
    // Expected: false (no sublist contains 'ghi')
    const results = executeTckQuery(
      graph,
      "RETURN single(x IN [['abc'], ['abc', 'def']] WHERE any(y IN x WHERE y = 'ghi')) AS result",
    );
    expect(results).toEqual([false]);
  });

  test("[2] Single quantifier can nest itself and other quantifiers on the same list", () => {
    const graph = createTckGraph();
    // WITH [1, 2, 3, 4, 5, 6, 7, 8, 9] AS list RETURN single(x IN list WHERE any(y IN list WHERE x = 2 * y)) AS result
    // Expected: false (2=2*1, 4=2*2, 6=2*3, 8=2*4 - four matches, not one)
    const results = executeTckQuery(
      graph,
      "WITH [1, 2, 3, 4, 5, 6, 7, 8, 9] AS list RETURN single(x IN list WHERE any(y IN list WHERE x = 2 * y)) AS result",
    );
    expect(results).toEqual([false]);
  });

  test("[3] Single quantifier is equal whether the size of the list filtered with same the predicate is one", () => {
    const graph = createTckGraph();
    // RETURN single(x IN [1,2,3] WHERE x = 2) = (size([x IN [1,2,3] WHERE x = 2 | x]) = 1) AS result
    // Expected: true (single finds exactly one match, size is 1)
    const results = executeTckQuery(
      graph,
      "RETURN single(x IN [1,2,3] WHERE x = 2) = (size([x IN [1,2,3] WHERE x = 2 | x]) = 1) AS result",
    );
    expect(results).toEqual([true]);
  });

  // Custom tests demonstrating single() interoperability

  test("[custom-1] single() combined with any() in same query", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [10, 100, 30] });
    graph.addVertex("A", { name: "no-high", scores: [10, 20, 30] });
    graph.addVertex("A", { name: "two-high", scores: [100, 200, 30] });

    // Find nodes where any score > 0 (all) AND exactly one is >= 100
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x > 0) AND SINGLE(x IN a.scores WHERE x >= 100) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });

  test("[custom-2] single() combined with none() in same query", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [10, 100, 30] });
    graph.addVertex("A", { name: "has-negative", scores: [-5, 100, 30] });
    graph.addVertex("A", { name: "two-high", scores: [10, 100, 200] });

    // Find nodes where none are negative AND exactly one is >= 100
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x < 0) AND SINGLE(x IN a.scores WHERE x >= 100) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });

  test("[custom-3] single() combined with all() in same query", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [5, 50, 15] });
    graph.addVertex("A", { name: "has-big", scores: [5, 50, 150] });
    graph.addVertex("A", { name: "two-over-40", scores: [5, 50, 60] });

    // Find nodes where all are > 0 AND exactly one is >= 40
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 0) AND SINGLE(x IN a.scores WHERE x >= 40) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });

  test("[custom-4] single() distinguishes count correctly", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "zero", scores: [1, 3, 5] });
    graph.addVertex("A", { name: "one", scores: [2, 3, 5] });
    graph.addVertex("A", { name: "two", scores: [2, 4, 5] });
    graph.addVertex("A", { name: "three", scores: [2, 4, 6] });

    // Find nodes with exactly one even number
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x % 2 = 0) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["one"]);
  });

  test("[custom-5] single() with string items", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "one-foo", items: ["foo", "bar", "baz"] });
    graph.addVertex("A", { name: "two-foo", items: ["foo", "foo", "baz"] });
    graph.addVertex("A", { name: "no-foo", items: ["bar", "baz", "qux"] });

    // Find nodes with exactly one item that equals 'foo'
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.items WHERE x = 'foo') RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["one-foo"]);
  });
});
