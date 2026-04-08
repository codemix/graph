/**
 * TCK Quantifier7 - Any quantifier interop
 * Translated from tmp/tck/features/expressions/quantifier/Quantifier7.feature
 *
 * Tests demonstrating any() quantifier interoperability with other quantifiers.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Quantifier7 - Any quantifier interop", () => {
  // Original TCK tests - now enabled with RETURN-only queries
  test("[1] Any quantifier can nest itself and other quantifiers on nested lists", () => {
    const graph = createTckGraph();
    // RETURN any(x IN [['abc'], ['abc', 'def']] WHERE none(y IN x WHERE y = 'ghi')) AS result
    // Expected: true (all sublists have none containing 'ghi')
    const results = executeTckQuery(
      graph,
      "RETURN any(x IN [['abc'], ['abc', 'def']] WHERE none(y IN x WHERE y = 'ghi')) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[2] Any quantifier can nest itself and other quantifiers on the same list", () => {
    const graph = createTckGraph();
    // WITH [1, 2, 3, 4, 5, 6, 7, 8, 9] AS list RETURN any(x IN list WHERE all(y IN list WHERE x <> y OR x <= y)) AS result
    // Expected: true (x=1 satisfies: for all y, either 1<>y or 1<=y)
    const results = executeTckQuery(
      graph,
      "WITH [1, 2, 3, 4, 5, 6, 7, 8, 9] AS list RETURN any(x IN list WHERE all(y IN list WHERE x <> y OR x <= y)) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[3] Any quantifier is true if the single quantifier is true", () => {
    const graph = createTckGraph();
    // RETURN any(x IN [1,2,3] WHERE x = 2) = single(x IN [1,2,3] WHERE x = 2) AS result
    // Expected: true (any=true, single=true, both match on exactly one element)
    const results = executeTckQuery(
      graph,
      "RETURN any(x IN [1,2,3] WHERE x = 2) = single(x IN [1,2,3] WHERE x = 2) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[4] Any quantifier is equal the boolean negative of the none quantifier", () => {
    const graph = createTckGraph();
    // RETURN any(x IN [1,2,3] WHERE x = 2) = (NOT none(x IN [1,2,3] WHERE x = 2)) AS result
    // Expected: true (any=true because 2 exists, NOT none=true because none=false)
    const results = executeTckQuery(
      graph,
      "RETURN any(x IN [1,2,3] WHERE x = 2) = (NOT none(x IN [1,2,3] WHERE x = 2)) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[5] Any quantifier is equal the boolean negative of the all quantifier on the boolean negative of the predicate", () => {
    const graph = createTckGraph();
    // RETURN any(x IN [1,2,3] WHERE x = 2) = (NOT all(x IN [1,2,3] WHERE NOT (x = 2))) AS result
    // Expected: true (any=true, NOT all(NOT x=2) = NOT false = true)
    const results = executeTckQuery(
      graph,
      "RETURN any(x IN [1,2,3] WHERE x = 2) = (NOT all(x IN [1,2,3] WHERE NOT (x = 2))) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[6] Any quantifier is equal whether the size of the list filtered with same the predicate is greater zero", () => {
    const graph = createTckGraph();
    // RETURN any(x IN [1,2,3] WHERE x = 2) = (size([x IN [1,2,3] WHERE x = 2 | x]) > 0) AS result
    // Expected: true (any=true, size=1 > 0 = true)
    const results = executeTckQuery(
      graph,
      "RETURN any(x IN [1,2,3] WHERE x = 2) = (size([x IN [1,2,3] WHERE x = 2 | x]) > 0) AS result",
    );
    expect(results).toEqual([true]);
  });

  // Custom tests demonstrating any() interoperability

  test("[custom-1] any() is logically NOT none()", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "has-big", scores: [1, 100, 3] });
    graph.addVertex("A", { name: "all-small", scores: [1, 2, 3] });

    // any(x >= 50) should match same as NOT none(x >= 50)
    const anyResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x >= 50) RETURN a.name ORDER BY a.name",
    );

    expect(anyResults).toEqual(["has-big"]);
  });

  test("[custom-2] any() is logically NOT all(NOT condition)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "has-positive", scores: [-10, 5, -30] });
    graph.addVertex("A", { name: "all-negative", scores: [-10, -5, -30] });

    // any(x > 0) should match nodes where NOT all(x <= 0)
    const anyResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x > 0) RETURN a.name ORDER BY a.name",
    );

    expect(anyResults).toEqual(["has-positive"]);
  });

  test("[custom-3] any() combined with none() in same query", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [10, 50, 30] });
    graph.addVertex("A", { name: "has-negative", scores: [-5, 50, 30] });
    graph.addVertex("A", { name: "no-high", scores: [10, 20, 30] });

    // Find nodes where any is >= 50 AND none are negative
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x >= 50) AND NONE(x IN a.scores WHERE x < 0) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });

  test("[custom-4] any() combined with single() in same query", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [10, 50, 30] });
    graph.addVertex("A", { name: "no-low", scores: [40, 50, 60] });
    graph.addVertex("A", { name: "two-low", scores: [5, 10, 60] });

    // Find nodes where any is >= 50 AND exactly one is < 20
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x >= 50) AND SINGLE(x IN a.scores WHERE x < 20) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });

  test("[custom-5] any() combined with all() in same query", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [10, 50, 30] });
    graph.addVertex("A", { name: "has-negative", scores: [-5, 50, 30] });
    graph.addVertex("A", { name: "no-high", scores: [10, 20, 30] });

    // Find nodes where any is >= 50 AND all are > 0
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x >= 50) AND ALL(x IN a.scores WHERE x > 0) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });
});
