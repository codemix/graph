/**
 * TCK List7 - List Head
 * Translated from tmp/tck/features/expressions/list/List7.feature
 *
 * Tests the head() function for getting the first element of a list.
 * Note: The original TCK feature file is empty (no scenarios).
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("List7 - List Head", () => {
  test("[No scenarios] Original TCK feature file is empty", () => {
    // The List7.feature file only contains the feature header with no scenarios.
    // The head() function would extract the first element of a list.
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN head([1, 2, 3]) AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  // Custom tests demonstrating list first-element access
  test("[Custom 1] Access first element via UNWIND with LIMIT 1", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [10, 20, 30] AS x RETURN x LIMIT 1");

    expect(results).toHaveLength(1);
    // Results are wrapped in arrays
    expect(results[0]).toEqual([10]);
  });

  test("[Custom 2] Store list and access elements - list literals in properties not supported", () => {
    // Grammar limitation: List literals cannot be used as property values in CREATE
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {items: [10, 20, 30]})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN head(n.items) AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(10);
  });
});
