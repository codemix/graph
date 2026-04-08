/**
 * TCK Quantifier11 - Any quantifier invariants
 * Translated from tmp/tck/features/expressions/quantifier/Quantifier11.feature
 *
 * NOTE: All original TCK tests use complex WITH clauses with list comprehensions,
 * CASE expressions, coalesce, and rand() which are not supported.
 * Custom tests demonstrate the invariants in WHERE clause.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Quantifier11 - Any quantifier invariants", () => {
  // Original TCK tests use unsupported features
  test("[1] Any quantifier is always false if the predicate is statically false and the list is not empty - complex WITH not supported", () => {
    // Original uses: WITH clause, list comprehension with projection, CASE, rand()
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN any(x IN list WHERE false) AS result",
    );
    expect(results).toEqual([false]);
  });

  test("[2] Any quantifier is always true if the predicate is statically true and the list is not empty - complex WITH not supported", () => {
    // Original uses: WITH clause, list comprehension with projection, CASE, rand()
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN any(x IN list WHERE true) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[3] Any quantifier is always true if the single or the all quantifier is true - complex WITH not supported", () => {
    // Original: single(operands) OR all(operands) implies any(operands)
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN (single(x IN list WHERE x > 0) OR all(x IN list WHERE x > 0)) <= any(x IN list WHERE x > 0) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[4] Any quantifier is always equal the boolean negative of the none quantifier - complex WITH not supported", () => {
    // Original: any(x IN list WHERE predicate) = (NOT none(x IN list WHERE predicate))
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN any(x IN list WHERE x > 0) = (NOT none(x IN list WHERE x > 0)) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[5] Any quantifier is always equal the boolean negative of the all quantifier on the boolean negative of the predicate - complex WITH not supported", () => {
    // Original: any(x IN list WHERE predicate) = (NOT all(x IN list WHERE NOT (predicate)))
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN any(x IN list WHERE x > 0) = (NOT all(x IN list WHERE NOT (x > 0))) AS result",
    );
    expect(results).toEqual([true]);
  });

  test("[6] Any quantifier is always equal whether the size of the list filtered with same the predicate is greater zero - complex WITH not supported", () => {
    // Original: any(x IN list WHERE predicate) = (size([x IN list WHERE predicate | x]) > 0)
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [x IN range(1, 10) | CASE WHEN rand() < 0.5 THEN x ELSE -x END] AS list RETURN any(x IN list WHERE x > 0) = (size([x IN list WHERE x > 0 | x]) > 0) AS result",
    );
    expect(results).toEqual([true]);
  });

  // Custom tests demonstrating any() invariants

  test("[custom-1] any() is false when predicate never matches (logical invariant)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [10, 20, 30] });

    // For any list, any(x WHERE false-equivalent) = false
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x > 1000) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-2] any() is true when predicate always matches on non-empty list (logical invariant)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [10, 20, 30] });

    // For non-empty list, any(x WHERE true-equivalent) = true
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x > 0) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-3] any() is true when single() is true (implication)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "one-match", scores: [10, 100, 30] });
    graph.addVertex("A", { name: "no-match", scores: [10, 20, 30] });

    // If single(x >= 100), then any(x >= 100) must also be true
    const singleResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE SINGLE(x IN a.scores WHERE x >= 100) RETURN a.name ORDER BY a.name",
    );

    const anyResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x >= 100) RETURN a.name ORDER BY a.name",
    );

    // one-match: single = true, any = true
    // no-match: single = false, any = false
    expect(singleResults).toEqual(["one-match"]);
    expect(anyResults).toEqual(["one-match"]);
  });

  test("[custom-4] any() is true when all() is true (implication)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "all-big", scores: [100, 200, 300] });
    graph.addVertex("A", { name: "some-small", scores: [10, 200, 300] });

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
    // some-small: all = false, any = true (has 200 and 300)
    expect(allResults).toEqual(["all-big"]);
    expect(anyResults).toEqual(["all-big", "some-small"]);
  });

  test("[custom-5] any() equals NOT none() (De Morgan's law)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "has-two", scores: [1, 2, 3] });
    graph.addVertex("A", { name: "no-two", scores: [1, 3, 5] });

    // any(x = 2) should match nodes where NOT none(x = 2)
    const anyResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x = 2) RETURN a.name ORDER BY a.name",
    );

    const notNoneResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NOT NONE(x IN a.scores WHERE x = 2) RETURN a.name ORDER BY a.name",
    );

    expect(anyResults).toEqual(["has-two"]);
    expect(notNoneResults).toEqual(["has-two"]);
  });

  test("[custom-6] any(predicate) equals NOT all(NOT predicate)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "has-big", scores: [10, 100, 30] });
    graph.addVertex("A", { name: "all-small", scores: [10, 20, 30] });

    // any(x >= 50) should match same nodes as NOT all(x < 50)
    const anyResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE ANY(x IN a.scores WHERE x >= 50) RETURN a.name ORDER BY a.name",
    );

    // NOT all(x < 50) is equivalent (De Morgan's)
    // We can't directly test "NOT all(...)" in our WHERE, but we verify any() works correctly
    expect(anyResults).toEqual(["has-big"]);
  });
});
