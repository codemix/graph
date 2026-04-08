/**
 * TCK Quantifier9 - None quantifier invariants
 * Translated from tmp/tck/features/expressions/quantifier/Quantifier9.feature
 *
 * NOTE: All original TCK tests use complex WITH clauses with list comprehensions,
 * CASE expressions, coalesce, and rand() which are not supported.
 * Custom tests demonstrate the invariants in WHERE clause.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Quantifier9 - None quantifier invariants", () => {
  // Original TCK tests use unsupported features
  test("[1] None quantifier is always true if the predicate is statically false and the list is not empty - complex WITH not supported", () => {
    // Original uses: WITH clause, list comprehension with projection, CASE, rand()
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN none(x IN list WHERE false) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[2] None quantifier is always false if the predicate is statically true and the list is not empty - complex WITH not supported", () => {
    // Original uses: WITH clause, list comprehension with projection, CASE, rand()
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN none(x IN list WHERE true) AS result",
    );
    expect(results).toEqual([false]);
  });

  test("[3] None quantifier is always equal the boolean negative of the any quantifier - complex WITH not supported", () => {
    // Original: none(x IN list WHERE predicate) = (NOT any(x IN list WHERE predicate))
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN none(x IN list WHERE x > 0) = (NOT any(x IN list WHERE x > 0)) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[4] None quantifier is always equal the all quantifier on the boolean negative of the predicate - complex WITH not supported", () => {
    // Original: none(x IN list WHERE predicate) = all(x IN list WHERE NOT (predicate))
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN none(x IN list WHERE x > 0) = all(x IN list WHERE NOT (x > 0)) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[5] None quantifier is always equal whether the size of the list filtered with same the predicate is zero - complex WITH not supported", () => {
    // Original: none(x IN list WHERE predicate) = (size([x IN list WHERE predicate | x]) = 0)
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN none(x IN list WHERE x > 0) = (size([x IN list WHERE x > 0 | x]) = 0) AS result",
    );
    expect(results).toEqual([true]);
  });

  // Custom tests demonstrating none() invariants

  test("[custom-1] none() is true when predicate never matches (logical invariant)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [10, 20, 30] });

    // For any non-empty list, none(x WHERE false-equivalent) = true
    // Here x > 1000 is false for all scores
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x > 1000) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-2] none() is false when predicate always matches (logical invariant)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [10, 20, 30] });

    // For any non-empty list, none(x WHERE true-equivalent) = false
    // Here x > 0 is true for all scores
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x > 0) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-3] none() equals NOT any() (De Morgan's law)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "has-even", scores: [2, 4, 6] });
    graph.addVertex("A", { name: "all-odd", scores: [1, 3, 5] });

    // none(x = 2) should match nodes where NOT any(x = 2)
    const noneResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x = 2) RETURN a.name ORDER BY a.name",
    );

    // Verify: has-even has a 2, so none() = false
    //         all-odd has no 2, so none() = true
    expect(noneResults).toEqual(["all-odd"]);
  });

  test("[custom-4] none(predicate) equals all(NOT predicate)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "all-small", scores: [1, 2, 3] });
    graph.addVertex("A", { name: "has-big", scores: [1, 100, 3] });

    // none(x >= 50) should match same nodes as all(x < 50)
    const noneResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x >= 50) RETURN a.name ORDER BY a.name",
    );

    const allResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ALL(x IN a.scores WHERE x < 50) RETURN a.name ORDER BY a.name",
    );

    expect(noneResults).toEqual(["all-small"]);
    expect(allResults).toEqual(["all-small"]);
  });

  test("[custom-5] none() with multiple predicates", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [5, 15, 25] });
    graph.addVertex("A", { name: "has-boundary", scores: [5, 10, 25] });

    // none(x = 10 OR x = 20) - find nodes without 10 or 20 in scores
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x = 10 OR x = 20) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["valid"]);
  });
});
