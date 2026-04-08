/**
 * TCK Quantifier5 - None quantifier interop
 * Translated from tmp/tck/features/expressions/quantifier/Quantifier5.feature
 *
 * Tests demonstrating none() quantifier interoperability with other quantifiers.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Quantifier5 - None quantifier interop", () => {
  // Original TCK tests - now enabled with RETURN-only queries
  test("[1] None quantifier can nest itself and other quantifiers on nested lists", () => {
    const graph = createTckGraph();
    // RETURN none(x IN [['abc'], ['abc', 'def']] WHERE any(y IN x WHERE y = 'ghi')) AS result
    // Expected: true (no sublist contains 'ghi')
    const results = executeTckQuery(
      graph,
      "RETURN none(x IN [['abc'], ['abc', 'def']] WHERE any(y IN x WHERE y = 'ghi')) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[2] None quantifier can nest itself and other quantifiers on the same list", () => {
    const graph = createTckGraph();
    // WITH [1, 2, 3, 4, 5, 6, 7, 8, 9] AS list RETURN none(x IN list WHERE any(y IN list WHERE x = 10 * y)) AS result
    // Expected: true (no x in [1..9] equals 10*y for any y in [1..9])
    const results = executeTckQuery(
      graph,
      "WITH [1, 2, 3, 4, 5, 6, 7, 8, 9] AS list RETURN none(x IN list WHERE any(y IN list WHERE x = 10 * y)) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[3] None quantifier is equal the boolean negative of the any quantifier", () => {
    const graph = createTckGraph();
    // RETURN none(x IN [1,2,3] WHERE x = 2) = (NOT any(x IN [1,2,3] WHERE x = 2)) AS result
    // Expected: true (both are false: none is false because 2 is in list, NOT any is also false)
    const results = executeTckQuery(
      graph,
      "RETURN none(x IN [1,2,3] WHERE x = 2) = (NOT any(x IN [1,2,3] WHERE x = 2)) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[4] None quantifier is equal the all quantifier on the boolean negative of the predicate", () => {
    const graph = createTckGraph();
    // RETURN none(x IN [1,2,3] WHERE x = 2) = all(x IN [1,2,3] WHERE NOT (x = 2)) AS result
    // Expected: true (both are false: none is false because 2 equals 2, all is false because 2 = 2)
    const results = executeTckQuery(
      graph,
      "RETURN none(x IN [1,2,3] WHERE x = 2) = all(x IN [1,2,3] WHERE NOT (x = 2)) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[5] None quantifier is equal whether the size of the list filtered with same the predicate is zero", () => {
    const graph = createTckGraph();
    // RETURN none(x IN [1,2,3] WHERE x = 2) = (size([x IN [1,2,3] WHERE x = 2 | x]) = 0) AS result
    // Expected: true (both are false: none is false because 2 is found, size is 1 not 0)
    const results = executeTckQuery(
      graph,
      "RETURN none(x IN [1,2,3] WHERE x = 2) = (size([x IN [1,2,3] WHERE x = 2 | x]) = 0) AS result",
    );
    expect(results).toEqual([true]);
  });

  // Custom tests demonstrating none() interoperability

  test("[custom-1] none() is logically NOT any()", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "all-small", scores: [1, 2, 3] });
    graph.addVertex("A", { name: "has-big", scores: [1, 100, 3] });

    // none(x >= 50) should match same as NOT any(x >= 50)
    const noneResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x >= 50) RETURN a.name ORDER BY a.name",
    );

    expect(noneResults).toEqual(["all-small"]);
  });

  test("[custom-2] none() is logically all(NOT condition)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "all-positive", scores: [10, 20, 30] });
    graph.addVertex("A", { name: "has-negative", scores: [10, -5, 30] });

    // none(x <= 0) should match nodes where all(x > 0)
    const noneResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x <= 0) RETURN a.name ORDER BY a.name",
    );

    const allResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 0) RETURN a.name ORDER BY a.name",
    );

    expect(noneResults).toEqual(["all-positive"]);
    expect(allResults).toEqual(["all-positive"]);
  });

  test("[custom-3] none() combined with any() in same query", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [10, 50, 30] });
    graph.addVertex("A", { name: "has-negative", scores: [-5, 50, 30] });
    graph.addVertex("A", { name: "no-high", scores: [10, 20, 30] });

    // Find nodes where none are negative AND any are >= 50
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x < 0) AND ANY(x IN a.scores WHERE x >= 50) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });

  test("[custom-4] none() combined with single() in same query", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [10, 50, 30] });
    graph.addVertex("A", { name: "two-high", scores: [10, 50, 60] });
    graph.addVertex("A", { name: "has-negative", scores: [-5, 50, 30] });

    // Find nodes where none are negative AND exactly one is >= 50
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x < 0) AND SINGLE(x IN a.scores WHERE x >= 50) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });

  test("[custom-5] none() combined with all() in same query", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [15, 18, 12] });
    graph.addVertex("A", { name: "has-zero", scores: [0, 15, 18] });
    graph.addVertex("A", { name: "out-of-range", scores: [15, 25, 12] });

    // Find nodes where none equal 0 AND all are in range [10, 20]
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x = 0) AND ALL(x IN a.scores WHERE x >= 10 AND x <= 20) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });
});
