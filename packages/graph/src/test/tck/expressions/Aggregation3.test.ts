/**
 * TCK Aggregation3 - Sum
 * Translated from tmp/tck/features/expressions/aggregation/Aggregation3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Aggregation3 - Sum", () => {
  test.fails(
    "[1] Sum only non-null values - implicit grouping not supported",
    () => {
      // Original TCK:
      // Given:
      //   CREATE ({name: 'a', num: 33})
      //   CREATE ({name: 'a'})
      //   CREATE ({name: 'a', num: 42})
      // Query: MATCH (n) RETURN n.name, sum(n.num)
      // Expected:
      //   | n.name | sum(n.num) |
      //   | 'a'    | 75         |
      //
      // Limitations:
      // - Unlabeled nodes not supported
      // - Implicit grouping by n.name not supported
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ({name: 'a', num: 33})");
      executeTckQuery(graph, "CREATE ({name: 'a'})");
      executeTckQuery(graph, "CREATE ({name: 'a', num: 42})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) RETURN n.name, sum(n.num)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ "n.name": "a", "sum(n.num)": 75 });
    },
  );

  test("[2] No overflow during summation", () => {
    const graph = createTckGraph();

    // Original TCK:
    // UNWIND range(1000000, 2000000) AS i
    // WITH i
    // LIMIT 3000
    // RETURN sum(i)
    // Expected: 3004498500
    const results = executeTckQuery(
      graph,
      `UNWIND range(1000000, 2000000) AS i
       WITH i
       LIMIT 3000
       RETURN sum(i)`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3004498500);
  });

  // Custom tests demonstrating sum() functionality that is supported

  test("[Custom 1] sum() over integers with UNWIND", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 2, 3, 4, 5] AS x RETURN sum(x)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(15);
  });

  test("[Custom 2] sum() over node properties", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 10}), (:A {num: 20}), (:A {num: 30})`,
    );

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN sum(n.num)");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(60);
  });

  test("[Custom 3] sum() over floats with UNWIND", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1.5, 2.5, 3.0] AS x RETURN sum(x)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(7.0);
  });

  test("[Custom 4] sum() with negative numbers", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [10, -5, 3, -2] AS x RETURN sum(x)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(6);
  });

  test("[Custom 5] sum() returns 0 for empty result set", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      "MATCH (n:NonExistent) RETURN sum(n.num)",
    );

    expect(results).toHaveLength(1);
    // Sum of empty set should be 0 or null depending on implementation
    expect(results[0]).toBe(0);
  });

  test("[Custom 6] sum() with WHERE filter", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 10}), (:A {num: 20}), (:A {num: 30}), (:A {num: 40})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num > 15 RETURN sum(n.num)",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(90); // 20 + 30 + 40
  });
});
