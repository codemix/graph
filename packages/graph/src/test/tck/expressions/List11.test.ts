/**
 * TCK List11 - Create a list from a range
 * Translated from tmp/tck/features/expressions/list/List11.feature
 *
 * Tests the range() function for creating lists from numeric ranges.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("List11 - Create a list from a range", () => {
  // TCK [1] - range() with default step
  test("[1a] range(-1236, -1234)", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN range(-1236, -1234) AS list",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([-1236, -1235, -1234]);
  });

  test("[1b] range(0, 10)", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN range(0, 10) AS list");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test("[1c] range(0, -1) - empty range", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN range(0, -1) AS list");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([]);
  });

  // TCK [2] - range() with explicit step
  test("[2a] range(10, -10, -3)", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN range(10, -10, -3) AS list");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([10, 7, 4, 1, -2, -5, -8]);
  });

  test("[2b] range(0, 10, 1)", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN range(0, 10, 1) AS list");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test("[2c] range(0, 1, -1) - empty due to wrong direction", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN range(0, 1, -1) AS list");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([]);
  });

  test("[2d] range(0, 10, 2) - step of 2", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN range(0, 10, 2) AS list");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([0, 2, 4, 6, 8, 10]);
  });

  test.fails(
    "[3] Create an empty list if range direction and step direction are inconsistent - complex query not supported",
    () => {
      // Original TCK:
      // WITH 0 AS start, [1, 2, 500, 1000, 1500] AS stopList, [-1000, -3, -2, -1, 1, 2, 3, 1000] AS stepList
      // UNWIND stopList AS stop
      // UNWIND stepList AS step
      // WITH start, stop, step, range(start, stop, step) AS list
      // WITH start, stop, step, list, sign(stop-start) <> sign(step) AS empty
      // RETURN ALL(ok IN collect((size(list) = 0) = empty) WHERE ok) AS okay
      //
      // Grammar limitations:
      // - Multiple UNWIND clauses not supported
      // - sign() function not implemented
      // - ALL() predicate function not supported
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        `WITH 0 AS start, [1, 2, 500, 1000, 1500] AS stopList, [-1000, -3, -2, -1, 1, 2, 3, 1000] AS stepList
       UNWIND stopList AS stop
       UNWIND stepList AS step
       WITH start, stop, step, range(start, stop, step) AS list
       WITH start, stop, step, list, sign(stop-start) <> sign(step) AS empty
       RETURN ALL(ok IN collect((size(list) = 0) = empty) WHERE ok) AS okay`,
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(true);
    },
  );

  test.fails(
    "[4] Fail on invalid arguments for range() - semantic validation not implemented",
    () => {
      // Original TCK (Scenario Outline with 4 examples):
      // RETURN range(2, 8, 0)
      // Expected: ArgumentError (step cannot be 0)
      // Actual: Returns empty list instead of throwing ArgumentError
      const graph = createTckGraph();
      // Should throw ArgumentError when step is 0
      expect(() => executeTckQuery(graph, "RETURN range(2, 8, 0)")).toThrow();
    },
  );

  test.fails(
    "[5] Fail on invalid argument types for range() - semantic validation not implemented",
    () => {
      // Original TCK (Scenario Outline with 21 examples):
      // RETURN range(<start>, <end>, <step>)
      // Expected: ArgumentError for boolean, float, string, list, map arguments
      // Actual: Returns null/incorrect results instead of throwing ArgumentError
      const graph = createTckGraph();
      // Should throw ArgumentError when using invalid argument types
      expect(() =>
        executeTckQuery(graph, "RETURN range(true, 10, 1)"),
      ).toThrow();
    },
  );

  // Custom tests demonstrating range() function via UNWIND
  test("[Custom 1] range() function via UNWIND - default step", () => {
    const graph = createTckGraph();

    // Test range(0, 4) - creates [0, 1, 2, 3, 4]
    const results = executeTckQuery(graph, "UNWIND range(0, 4) AS x RETURN x");

    expect(results).toHaveLength(5);
    expect(results.map((r) => (r as [number])[0])).toEqual([0, 1, 2, 3, 4]);
  });

  test("[Custom 2] range() function via UNWIND - with step", () => {
    const graph = createTckGraph();

    // Test range(0, 10, 2) - creates [0, 2, 4, 6, 8, 10]
    const results = executeTckQuery(
      graph,
      "UNWIND range(0, 10, 2) AS x RETURN x",
    );

    expect(results).toHaveLength(6);
    expect(results.map((r) => (r as [number])[0])).toEqual([0, 2, 4, 6, 8, 10]);
  });

  test("[Custom 3] range() function via UNWIND - negative step", () => {
    const graph = createTckGraph();

    // Test range(5, 1, -1) - creates [5, 4, 3, 2, 1]
    const results = executeTckQuery(
      graph,
      "UNWIND range(5, 1, -1) AS x RETURN x",
    );

    expect(results).toHaveLength(5);
    expect(results.map((r) => (r as [number])[0])).toEqual([5, 4, 3, 2, 1]);
  });

  test("[Custom 4] range() function via UNWIND - empty range", () => {
    const graph = createTckGraph();

    // Test range(0, -1) - creates [] (empty list)
    const results = executeTckQuery(graph, "UNWIND range(0, -1) AS x RETURN x");

    expect(results).toHaveLength(0);
  });

  test("[Custom 5] range() with negative numbers", () => {
    const graph = createTckGraph();

    // Test range(-3, -1) - creates [-3, -2, -1]
    const results = executeTckQuery(
      graph,
      "UNWIND range(-3, -1) AS x RETURN x",
    );

    expect(results).toHaveLength(3);
    expect(results.map((r) => (r as [number])[0])).toEqual([-3, -2, -1]);
  });

  test.fails(
    "[Custom 6] Store range-like list in property - list literals in properties not supported",
    () => {
      // Grammar limitation: List literals cannot be used as property values in CREATE
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A {nums: range(1, 5)})");
      const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.nums");
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual([1, 2, 3, 4, 5]);
    },
  );
});
