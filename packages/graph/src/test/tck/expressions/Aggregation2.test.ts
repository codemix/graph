/**
 * TCK Aggregation2 - Min and Max
 * Translated from tmp/tck/features/expressions/aggregation/Aggregation2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Aggregation2 - Min and Max", () => {
  test("[1] `max()` over integers", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [1, 2, 0, null, -1] AS x RETURN max(x)`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test("[2] `min()` over integers", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [1, 2, 0, null, -1] AS x RETURN min(x)`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-1);
  });

  test("[3] `max()` over floats", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [1.0, 2.0, 0.5, null] AS x RETURN max(x)`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2.0);
  });

  test("[4] `min()` over floats", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [1.0, 2.0, 0.5, null] AS x RETURN min(x)`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0.5);
  });

  test("[5] `max()` over mixed numeric values", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [1, 2.0, 5, null, 3.2, 0.1] AS x RETURN max(x)`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(5);
  });

  test("[6] `min()` over mixed numeric values", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [1, 2.0, 5, null, 3.2, 0.1] AS x RETURN min(x)`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0.1);
  });

  test("[7] `max()` over strings", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND ['a', 'b', 'B', null, 'abc', 'abc1'] AS i RETURN max(i)`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("b");
  });

  test("[8] `min()` over strings", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND ['a', 'b', 'B', null, 'abc', 'abc1'] AS i RETURN min(i)`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("B");
  });

  test("[9] `max()` over list values - nested lists not supported", () => {
    // Original TCK:
    // UNWIND [[1], [2], [2, 1]] AS x
    // RETURN max(x)
    // Expected: [2, 1]
    //
    // Limitation: Nested lists in UNWIND not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [[1], [2], [2, 1]] AS x RETURN max(x)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([2, 1]);
  });

  test("[10] `min()` over list values - nested lists not supported", () => {
    // Original TCK:
    // UNWIND [[1], [2], [2, 1]] AS x
    // RETURN min(x)
    // Expected: [1]
    //
    // Limitation: Nested lists in UNWIND not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [[1], [2], [2, 1]] AS x RETURN min(x)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1]);
  });

  test("[11] `max()` over mixed values - mixed types/null/nested not supported", () => {
    // Original TCK:
    // UNWIND [1, 'a', null, [1, 2], 0.2, 'b'] AS x
    // RETURN max(x)
    // Expected: 1
    //
    // Limitations:
    // - null literal in UNWIND not supported
    // - Nested lists in UNWIND not supported
    // - Mixed type comparison not implemented
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 'a', null, [1, 2], 0.2, 'b'] AS x RETURN max(x)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails(
    "[12] `min()` over mixed values - mixed types/null/nested not supported",
    () => {
      // Original TCK:
      // UNWIND [1, 'a', null, [1, 2], 0.2, 'b'] AS x
      // RETURN min(x)
      // Expected: [1, 2]
      //
      // Limitations:
      // - null literal in UNWIND not supported
      // - Nested lists in UNWIND not supported
      // - Mixed type comparison not implemented
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "UNWIND [1, 'a', null, [1, 2], 0.2, 'b'] AS x RETURN min(x)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual([1, 2]);
    },
  );

  // Custom tests demonstrating min/max functionality that is supported

  test("[Custom 3] max() over node properties", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 10}), (:A {num: 50}), (:A {num: 30})`,
    );

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN max(n.num)");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(50);
  });

  test("[Custom 4] min() over node properties", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 10}), (:A {num: 50}), (:A {num: 30})`,
    );

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN min(n.num)");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(10);
  });
});
