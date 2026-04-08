/**
 * TCK List4 - List Concatenation
 * Translated from tmp/tck/features/expressions/list/List4.feature
 *
 * Tests list concatenation with + operator.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("List4 - List Concatenation", () => {
  test("[1] Concatenating lists of same type", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN [1, 10, 100] + [4, 5] AS foo",
    );
    expect(results).toEqual([[1, 10, 100, 4, 5]]);
  });

  test("[2] Concatenating a list with a scalar of same type", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN [false, true] + false AS foo",
    );
    expect(results).toEqual([[false, true, false]]);
  });

  // Custom tests demonstrating list operations
  test("[Custom 1] Store list with mixed types", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {items: [1, 'two', true]})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.items");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, "two", true]);
  });

  test("[Custom 2] Store multiple list properties", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {nums: [1, 2], strs: ['a', 'b']})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.nums, n.strs");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([
      [1, 2],
      ["a", "b"],
    ]);
  });

  test("[Custom 3] Store boolean list", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {flags: [true, false, true]})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.flags");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([true, false, true]);
  });

  test("[Custom 4] Multiple scalar properties work", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {a: 1, b: 2, c: 3})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.a, n.b, n.c");

    expect(results).toHaveLength(1);
    const [a, b, c] = results[0] as [number, number, number];
    expect(a).toBe(1);
    expect(b).toBe(2);
    expect(c).toBe(3);
  });
});
