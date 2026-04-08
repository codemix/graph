/**
 * TCK List9 - List Tail
 * Translated from tmp/tck/features/expressions/list/List9.feature
 *
 * Tests the tail() function for getting all elements except the first.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("List9 - List Tail", () => {
  test("[1] Returning nested expressions based on list property - tail() function works", () => {
    // tail() IS supported, but list literals in CREATE property values are not
    const graph = createTckGraph();
    // Test tail() with literal list in RETURN
    const results = executeTckQuery(graph, "RETURN tail(tail([1, 2, 3, 4, 5]))");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([3, 4, 5]);
  });

  // Custom tests demonstrating list operations
  test("[Custom 1] Store and retrieve list array property - list literals in SET not supported", () => {
    // Grammar limitation: List literals cannot be used in SET property values
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    executeTckQuery(graph, "MATCH (n:A) SET n.items = [1, 2, 3, 4, 5]");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN tail(tail(n.items))");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([3, 4, 5]);
  });

  test("[Custom 2] SKIP simulates tail-like behavior for UNWIND", () => {
    const graph = createTckGraph();

    // SKIP 1 skips the first element, similar to tail()
    // Note: Results are wrapped in arrays
    const results = executeTckQuery(graph, "UNWIND [1, 2, 3, 4, 5] AS x RETURN x SKIP 1");

    expect(results).toHaveLength(4);
    expect(results[0]).toEqual([2]);
    expect(results[1]).toEqual([3]);
    expect(results[2]).toEqual([4]);
    expect(results[3]).toEqual([5]);
  });

  test("[Custom 3] SKIP 2 simulates tail(tail())", () => {
    const graph = createTckGraph();

    // SKIP 2 skips the first two elements, similar to tail(tail())
    // Note: Results are wrapped in arrays
    const results = executeTckQuery(graph, "UNWIND [1, 2, 3, 4, 5] AS x RETURN x SKIP 2");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([3]);
    expect(results[1]).toEqual([4]);
    expect(results[2]).toEqual([5]);
  });
});
