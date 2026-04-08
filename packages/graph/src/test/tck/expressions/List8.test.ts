/**
 * TCK List8 - List Last
 * Translated from tmp/tck/features/expressions/list/List8.feature
 *
 * Tests the last() function for getting the last element of a list.
 * Note: The original TCK feature file is empty (no scenarios).
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("List8 - List Last", () => {
  test("[No scenarios] Original TCK feature file is empty", () => {
    // The List8.feature file only contains the feature header with no scenarios.
    // The last() function would extract the last element of a list.
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN last([1, 2, 3]) AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3);
  });

  // Custom tests demonstrating list last-element access
  test("[Custom 1] Store list and access last element via JavaScript - list literals in properties not supported", () => {
    // Grammar limitation: List literals cannot be used as property values in CREATE
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {items: [10, 20, 30]})");
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN last(n.items) AS r",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(30);
  });

  test("[Custom 2] Empty list has no last element - list literals in properties not supported", () => {
    // Grammar limitation: List literals cannot be used as property values in CREATE
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN last([]) AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test("[Custom 3] Access nodes and use ORDER BY DESC with LIMIT", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})`,
    );

    // Get the "last" node when ordered by num
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.num ORDER BY n.num DESC LIMIT 1",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3);
  });
});
