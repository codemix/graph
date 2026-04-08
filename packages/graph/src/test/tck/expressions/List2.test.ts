/**
 * TCK List2 - List Slicing
 * Translated from tmp/tck/features/expressions/list/List2.feature
 *
 * Tests list slicing with range operator: list[start..end]
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("List2 - List Slicing", () => {
  test("[1] List slice", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH [1, 2, 3, 4, 5] AS list RETURN list[1..3] AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([2, 3]);
  });

  test("[2] List slice with implicit end", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH [1, 2, 3] AS list RETURN list[1..] AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([2, 3]);
  });

  test("[3] List slice with implicit start", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH [1, 2, 3] AS list RETURN list[..2] AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 2]);
  });

  test("[4] List slice with singleton range", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH [1, 2, 3] AS list RETURN list[0..1] AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1]);
  });

  test("[5] List slice with empty range", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH [1, 2, 3] AS list RETURN list[0..0] AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([]);
  });

  test("[6] List slice with negative range", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH [1, 2, 3] AS list RETURN list[-3..-1] AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 2]);
  });

  test("[7] List slice with invalid range", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH [1, 2, 3] AS list RETURN list[3..1] AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([]);
  });

  test("[8] List slice with exceeding range", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH [1, 2, 3] AS list RETURN list[-5..5] AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 2, 3]);
  });

  test("[9] List slice with null range", () => {
    const graph = createTckGraph();

    // list[null..2] should return null
    let results = executeTckQuery(graph, "WITH [1, 2, 3] AS list RETURN list[null..2] AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);

    // list[1..null] should return null
    results = executeTckQuery(graph, "WITH [1, 2, 3] AS list RETURN list[1..null] AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);

    // list[null..null] should return null
    results = executeTckQuery(graph, "WITH [1, 2, 3] AS list RETURN list[null..null] AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test("[10] List slice with parameterised range", () => {
    // Original TCK:
    // WITH [1, 2, 3] AS list
    // RETURN list[$from..$to] AS r
    // Parameters: from = 1, to = 3
    // Expected: [2, 3]
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH [1, 2, 3] AS list RETURN list[$from..$to] AS r", {
      from: 1,
      to: 3,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([2, 3]);
  });

  test("[11] List slice with parameterised invalid range", () => {
    // Original TCK:
    // WITH [1, 2, 3] AS list
    // RETURN list[$from..$to] AS r
    // Parameters: from = 3, to = 1
    // Expected: []
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH [1, 2, 3] AS list RETURN list[$from..$to] AS r", {
      from: 3,
      to: 1,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([]);
  });

  // Custom tests demonstrating list operations via UNWIND
  test("[Custom 1] UNWIND can simulate partial list access", () => {
    const graph = createTckGraph();

    // UNWIND gives access to all elements - filtering can simulate slicing
    // Note: Results are wrapped in arrays
    const results = executeTckQuery(graph, "UNWIND [1, 2, 3, 4, 5] AS x RETURN x");

    expect(results).toHaveLength(5);
    expect(results[0]).toEqual([1]);
    expect(results[1]).toEqual([2]);
    expect(results[2]).toEqual([3]);
    expect(results[3]).toEqual([4]);
    expect(results[4]).toEqual([5]);
  });

  test("[Custom 2] Store list in node property - list literals in properties not supported", () => {
    // Grammar limitation: List literals cannot be used as property values in CREATE
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {items: [1, 2, 3]})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.items[1..3] AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([2, 3]);
  });
});
