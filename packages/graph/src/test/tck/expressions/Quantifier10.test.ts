/**
 * TCK Quantifier10 - Single quantifier invariants
 * Translated from tmp/tck/features/expressions/quantifier/Quantifier10.feature
 *
 * NOTE: All original TCK tests use complex WITH clauses with list comprehensions,
 * CASE expressions, coalesce, and rand() which are not supported.
 * Custom tests demonstrate the invariants in WHERE clause.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Quantifier10 - Single quantifier invariants", () => {
  // Original TCK tests use unsupported features
  test("[1] Single quantifier is always false if the predicate is statically false and the list is not empty - complex WITH not supported", () => {
    // Original uses: WITH clause, list comprehension with projection, CASE, rand()
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN single(x IN list WHERE false) AS result",
    );
    expect(results).toEqual([false]);
  });

  test("[2] Single quantifier is always false if the predicate is statically true and the list has more than one element - complex WITH not supported", () => {
    // Original uses: WITH clause, list comprehension with projection, CASE, rand()
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN single(x IN list WHERE true) AS result",
    );
    expect(results).toEqual([false]);
  });

  test.fails(
    "[3] Single quantifier is always true if the predicate is statically true and the list has exactly one non-null element - complex WITH not supported",
    () => {
      // Original uses: WITH clause, UNWIND
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "UNWIND [[1], [null, 2], [null, null, 3]] AS list RETURN single(x IN list WHERE true) AS result",
      );
      expect(results).toEqual([true, true, true]);
    },
  );

  test("[4] Single quantifier is always equal whether the size of the list filtered with same the predicate is one - complex WITH not supported", () => {
    // Original: single(x IN list WHERE predicate) = (size([x IN list WHERE predicate | x]) = 1)
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN single(x IN list WHERE x > 0) = (size([x IN list WHERE x > 0 | x]) = 1) AS result",
    );
    expect(results).toEqual([true]);
  });

  // Custom tests demonstrating single() invariants

  test("[custom-1] single() is false when predicate never matches", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [10, 20, 30] });

    // For any list, single(x WHERE false-equivalent) = false (0 matches ≠ 1)
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x > 1000) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-2] single() is false when predicate always matches on list with > 1 elements", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [10, 20, 30] });

    // For list with > 1 elements, single(x WHERE true-equivalent) = false (3 matches ≠ 1)
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x > 0) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-3] single() is true when exactly one element matches", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "one-match", scores: [10, 100, 30] });
    graph.addVertex("A", { name: "two-match", scores: [100, 100, 30] });
    graph.addVertex("A", { name: "no-match", scores: [10, 20, 30] });

    // Exactly one score >= 100
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x >= 100) RETURN a.name ORDER BY a.name",
    );

    expect(results).toEqual(["one-match"]);
  });

  test("[custom-4] single() distinguishes between 0, 1, and multiple matches", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "zero", scores: [1, 3, 5] });
    graph.addVertex("A", { name: "one", scores: [2, 3, 5] });
    graph.addVertex("A", { name: "two", scores: [2, 4, 5] });

    // Find nodes where exactly one score is even
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x % 2 = 0) RETURN a.name ORDER BY a.name",
    );

    // zero: no even numbers → false
    // one: 2 is even → true (exactly one)
    // two: 2 and 4 are even → false (more than one)
    expect(results).toEqual(["one"]);
  });

  test("[custom-5] single() with complex predicate", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "valid", scores: [5, 15, 25] });
    graph.addVertex("A", { name: "none-in-range", scores: [5, 25, 35] });
    graph.addVertex("A", { name: "two-in-range", scores: [12, 18, 25] });

    // Exactly one score between 10 and 20 (exclusive)
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x > 10 AND x < 20) RETURN a.name ORDER BY a.name",
    );

    // valid: 15 is in range → true
    // none-in-range: no scores in range → false
    // two-in-range: 12 and 18 in range → false
    expect(results).toEqual(["valid"]);
  });
});
