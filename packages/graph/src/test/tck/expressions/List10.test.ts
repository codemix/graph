/**
 * TCK List10 - Reverse List
 * Translated from tmp/tck/features/expressions/list/List10.feature
 *
 * Tests the reverse() function for reversing a list.
 * Note: The original TCK feature file is empty (no scenarios).
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("List10 - Reverse List", () => {
  test("[No scenarios] Original TCK feature file is empty", () => {
    // The List10.feature file only contains the feature header with no scenarios.
    // Note: The reverse() function IS implemented and works with both lists and strings.
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN reverse([1, 2, 3]) AS r");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([3, 2, 1]);
  });

  // Custom tests demonstrating reverse() function via UNWIND
  test("[Custom 1] reverse() function via UNWIND - reverses list", () => {
    const graph = createTckGraph();

    // Test reverse([1, 2, 3]) - creates [3, 2, 1]
    const results = executeTckQuery(
      graph,
      "UNWIND reverse([1, 2, 3]) AS x RETURN x",
    );

    expect(results).toHaveLength(3);
    expect(results.map((r) => (r as [number])[0])).toEqual([3, 2, 1]);
  });

  test("[Custom 2] reverse() combined with range()", () => {
    const graph = createTckGraph();

    // Test reverse(range(1, 5)) - creates [5, 4, 3, 2, 1]
    const results = executeTckQuery(
      graph,
      "UNWIND reverse(range(1, 5)) AS x RETURN x",
    );

    expect(results).toHaveLength(5);
    expect(results.map((r) => (r as [number])[0])).toEqual([5, 4, 3, 2, 1]);
  });

  test("[Custom 3] reverse() empty list returns empty", () => {
    const graph = createTckGraph();

    // Test reverse([]) - creates []
    const results = executeTckQuery(graph, "UNWIND reverse([]) AS x RETURN x");

    expect(results).toHaveLength(0);
  });

  test("[Custom 4] ORDER BY DESC simulates reverse for simple cases", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3}), (:A {num: 4}), (:A {num: 5})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.num ORDER BY n.num DESC",
    );

    expect(results).toHaveLength(5);
    expect(results).toEqual([5, 4, 3, 2, 1]);
  });
});
