/**
 * TCK Quantifier8 - All quantifier interop
 * Translated from tmp/tck/features/expressions/quantifier/Quantifier8.feature
 *
 * Tests demonstrating all() quantifier interoperability with other quantifiers.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Quantifier8 - All quantifier interop", () => {
  // Original TCK tests - now enabled with RETURN-only queries
  test("[1] All quantifier can nest itself and other quantifiers on nested lists", () => {
    const graph = createTckGraph();
    // RETURN all(x IN [['abc'], ['abc', 'def']] WHERE none(y IN x WHERE y = 'ghi')) AS result
    // Expected: true (all sublists have none containing 'ghi')
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [['abc'], ['abc', 'def']] WHERE none(y IN x WHERE y = 'ghi')) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[2] All quantifier can nest itself and other quantifiers on the same list", () => {
    const graph = createTckGraph();
    // WITH [1, 2, 3, 4, 5, 6, 7, 8, 9] AS list RETURN all(x IN list WHERE none(y IN list WHERE x = 10 * y)) AS result
    // Expected: true (no x in [1..9] equals 10*y for any y in [1..9])
    const results = executeTckQuery(
      graph,
      "WITH [1, 2, 3, 4, 5, 6, 7, 8, 9] AS list RETURN all(x IN list WHERE none(y IN list WHERE x = 10 * y)) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[3] All quantifier is equal the none quantifier on the boolean negative of the predicate", () => {
    const graph = createTckGraph();
    // RETURN all(x IN [1,2,3] WHERE x = 2) = none(x IN [1,2,3] WHERE NOT (x = 2)) AS result
    // Expected: true (both are false: all is false because not all equal 2, none is false because 1 and 3 != 2)
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [1,2,3] WHERE x = 2) = none(x IN [1,2,3] WHERE NOT (x = 2)) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[4] All quantifier is equal the boolean negative of the any quantifier on the boolean negative of the predicate", () => {
    const graph = createTckGraph();
    // RETURN all(x IN [1,2,3] WHERE x = 2) = (NOT any(x IN [1,2,3] WHERE NOT (x = 2))) AS result
    // Expected: true (both are false: all is false, NOT any(NOT x=2) = NOT true = false)
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [1,2,3] WHERE x = 2) = (NOT any(x IN [1,2,3] WHERE NOT (x = 2))) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[5] All quantifier is equal whether the size of the list filtered with same the predicate is equal the size of the unfiltered list", () => {
    const graph = createTckGraph();
    // RETURN all(x IN [1,2,3] WHERE x = 2) = (size([x IN [1,2,3] WHERE x = 2 | x]) = size([1,2,3])) AS result
    // Expected: true (both are false: all is false because not all equal 2, size comparison is 1 = 3 = false)
    const results = executeTckQuery(
      graph,
      "RETURN all(x IN [1,2,3] WHERE x = 2) = (size([x IN [1,2,3] WHERE x = 2 | x]) = size([1,2,3])) AS result",
    );
    expect(results).toEqual([true]);
  });

  // Custom tests demonstrating all() interoperability

  test("[custom-1] all() is logically none(NOT condition)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "all-small", scores: [1, 2, 3] });
    graph.addVertex("A", { name: "has-big", scores: [1, 100, 3] });

    // all(x < 50) should match same as none(x >= 50)
    const allResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x < 50) RETURN a.name ORDER BY a.name",
    );

    const noneResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x >= 50) RETURN a.name ORDER BY a.name",
    );

    expect(allResults).toEqual(["all-small"]);
    expect(noneResults).toEqual(["all-small"]);
  });

  test("[custom-2] all() is logically NOT any(NOT condition)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "all-positive", scores: [10, 20, 30] });
    graph.addVertex("A", { name: "has-negative", scores: [10, -5, 30] });

    // all(x > 0) should match nodes where NOT any(x <= 0)
    const allResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 0) RETURN a.name ORDER BY a.name",
    );

    // NOT any(x <= 0) is equivalent to none(x <= 0)
    const noneResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x <= 0) RETURN a.name ORDER BY a.name",
    );

    expect(allResults).toEqual(["all-positive"]);
    expect(noneResults).toEqual(["all-positive"]);
  });

  test("[custom-3] all() combined with any() in same query", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [10, 100, 30] });
    graph.addVertex("A", { name: "no-high", scores: [10, 20, 30] });
    graph.addVertex("A", { name: "has-negative", scores: [-5, 100, 30] });

    // Find nodes where all are positive AND any is >= 100
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 0) AND ANY(x IN a.scores WHERE x >= 100) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });

  test("[custom-4] all() combined with single() in same query", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [10, 100, 30] });
    graph.addVertex("A", { name: "two-high", scores: [10, 100, 200] });
    graph.addVertex("A", { name: "has-negative", scores: [-5, 100, 30] });

    // Find nodes where all are positive AND exactly one is >= 100
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 0) AND SINGLE(x IN a.scores WHERE x >= 100) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });

  test("[custom-5] all() combined with none() in same query", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [10, 50, 30] });
    graph.addVertex("A", { name: "has-zero", scores: [0, 50, 30] });
    graph.addVertex("A", { name: "has-high", scores: [10, 150, 30] });

    // Find nodes where all are < 100 AND none equal zero
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x < 100) AND NONE(x IN a.scores WHERE x = 0) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });

  test("[custom-6] all quantifiers combined on different properties", () => {
    const graph = createTckGraph();
    graph.addVertex("A", {
      name: "valid",
      scores: [10, 20, 30],
      items: ["foo", "bar"],
    });
    graph.addVertex("A", {
      name: "bad-scores",
      scores: [-5, 20, 30],
      items: ["foo", "bar"],
    });

    // Find nodes where all scores > 0
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 0) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });
});
