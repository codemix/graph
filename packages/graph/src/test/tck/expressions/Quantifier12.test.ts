/**
 * TCK Quantifier12 - All quantifier invariants
 * Translated from tmp/tck/features/expressions/quantifier/Quantifier12.feature
 *
 * NOTE: All original TCK tests use complex WITH clauses with list comprehensions,
 * CASE expressions, coalesce, and rand() which are not supported.
 * Custom tests demonstrate the invariants in WHERE clause.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Quantifier12 - All quantifier invariants", () => {
  // Original TCK tests use unsupported features
  test("[1] All quantifier is always false if the predicate is statically false and the list is not empty - complex WITH not supported", () => {
    // Original uses: WITH clause, list comprehension with projection, CASE, rand()
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN all(x IN list WHERE false) AS result",
    );
    expect(results).toEqual([false]);
  });

  test("[2] All quantifier is always true if the predicate is statically true and the list is not empty - complex WITH not supported", () => {
    // Original uses: WITH clause, list comprehension with projection, CASE, rand()
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN all(x IN list WHERE true) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[3] All quantifier is always equal the none quantifier on the boolean negative of the predicate - complex WITH not supported", () => {
    // Original: all(x IN list WHERE predicate) = none(x IN list WHERE NOT (predicate))
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN all(x IN list WHERE x > 0) = none(x IN list WHERE NOT (x > 0)) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[4] All quantifier is always equal the boolean negative of the any quantifier on the boolean negative of the predicate - complex WITH not supported", () => {
    // Original: all(x IN list WHERE predicate) = (NOT any(x IN list WHERE NOT (predicate)))
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN all(x IN list WHERE x > 0) = (NOT any(x IN list WHERE NOT (x > 0))) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[5] All quantifier is always equal whether the size of the list filtered with same the predicate is equal the size of the unfiltered list - complex WITH not supported", () => {
    // Original: all(x IN list WHERE predicate) = (size([x IN list WHERE predicate | x]) = size(list))
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN all(x IN list WHERE x > 0) = (size([x IN list WHERE x > 0 | x]) = size(list)) AS result",
    );
    expect(results).toEqual([true]);
  });

  // Custom tests demonstrating all() invariants

  test("[custom-1] all() is false when predicate never matches on non-empty list (logical invariant)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [10, 20, 30] });

    // For non-empty list, all(x WHERE false-equivalent) = false
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 1000) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-2] all() is true when predicate always matches on non-empty list (logical invariant)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [10, 20, 30] });

    // For list where all elements match, all() = true
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 0) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-3] all(predicate) equals none(NOT predicate)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "all-positive", scores: [10, 20, 30] });
    graph.addVertex("A", { name: "has-negative", scores: [-5, 20, 30] });

    // all(x > 0) should match same nodes as none(x <= 0)
    const allResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 0) RETURN a.name ORDER BY a.name",
    );

    const noneResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x <= 0) RETURN a.name ORDER BY a.name",
    );

    expect(allResults).toEqual(["all-positive"]);
    expect(noneResults).toEqual(["all-positive"]);
  });

  test("[custom-4] all() implies any() on non-empty list", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "all-big", scores: [100, 200, 300] });
    graph.addVertex("A", { name: "some-big", scores: [10, 200, 300] });
    graph.addVertex("A", { name: "none-big", scores: [10, 20, 30] });

    // If all(x >= 100), then any(x >= 100) must also be true
    const allResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x >= 100) RETURN a.name ORDER BY a.name",
    );

    const anyResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x >= 100) RETURN a.name ORDER BY a.name",
    );

    // all-big: all = true, any = true
    // some-big: all = false, any = true
    // none-big: all = false, any = false
    expect(allResults).toEqual(["all-big"]);
    expect(anyResults).toEqual(["all-big", "some-big"]);
  });

  test("[custom-5] all() with complex predicate", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "in-range", scores: [15, 18, 12] });
    graph.addVertex("A", { name: "out-of-range", scores: [5, 18, 12] });

    // All scores between 10 and 20
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x >= 10 AND x <= 20) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["in-range"]);
  });

  test("[custom-6] all() is vacuously true on empty list", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "empty", scores: [] });
    graph.addVertex("A", { name: "non-empty", scores: [100] });

    // all() on empty list returns true (vacuous truth)
    // all(x > 1000) on [100] returns false
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x > 1000) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["empty"]);
  });
});
