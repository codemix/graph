/**
 * TCK ReturnOrderBy5 - Order by in combination with column renaming
 * Translated from tmp/tck/features/clauses/return-orderby/ReturnOrderBy5.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("ReturnOrderBy5 - Order by in combination with column renaming", () => {
  test.fails("[1] Renaming columns before ORDER BY should return results in ascending order - unlabeled nodes, arithmetic in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 1}), ({num: 3}), ({num: -5})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n.num AS n ORDER BY n + 2");
    expect(results).toEqual([-5, 1, 3]);
  });

  // Custom tests for ORDER BY with column renaming
  test("[custom-1] ORDER BY with renamed column", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num AS value ORDER BY value");
    expect(results).toEqual([1, 2, 3]);
  });

  test("[custom-2] ORDER BY DESC with renamed column", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num AS value ORDER BY value DESC");
    expect(results).toEqual([3, 2, 1]);
  });

  test("[custom-3] ORDER BY with renamed column in different order than RETURN", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 'c'})");
    executeTckQuery(graph, "CREATE (:A {x: 2, y: 'a'})");
    executeTckQuery(graph, "CREATE (:A {x: 3, y: 'b'})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.x AS a, n.y AS b ORDER BY b");
    // Ordered by y (a, b, c) so results should be: (2, 'a'), (3, 'b'), (1, 'c')
    expect(results).toEqual([
      [2, "a"],
      [3, "b"],
      [1, "c"],
    ]);
  });

  // Custom tests that use the original property expression (which is supported)
  test("[custom-4] ORDER BY with original property (not alias)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num AS value ORDER BY n.num");
    expect(results).toEqual([1, 2, 3]);
  });

  test("[custom-5] ORDER BY DESC with original property (not alias)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num AS value ORDER BY n.num DESC");
    expect(results).toEqual([3, 2, 1]);
  });
});
