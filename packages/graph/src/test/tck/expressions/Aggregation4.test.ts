/**
 * TCK Aggregation4 - Avg
 * Translated from tmp/tck/features/expressions/aggregation/Aggregation4.feature
 *
 * Note: The original TCK feature file is empty (no scenarios defined).
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Aggregation4 - Avg", () => {
  test.fails("[TCK] No scenarios in original TCK file", () => {
    // The original Aggregation4.feature file contains no scenarios.
    // It only has the feature header for "Aggregation4 - Avg".
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1");
    expect(results).toHaveLength(0); // This test is expected to fail - no real TCK scenario
  });

  // Custom tests demonstrating avg() functionality

  test("[Custom 1] avg() over integers with UNWIND", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "UNWIND [1, 2, 3, 4, 5] AS x RETURN avg(x)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3);
  });

  test("[Custom 2] avg() over node properties", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {num: 10}), (:A {num: 20}), (:A {num: 30})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN avg(n.num)");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(20); // (10+20+30)/3 = 60/3 = 20
  });

  test("[Custom 3] avg() over floats with UNWIND", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "UNWIND [1.0, 2.0, 3.0] AS x RETURN avg(x)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2.0);
  });

  test("[Custom 4] avg() with WHERE filter", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {num: 10}), (:A {num: 20}), (:A {num: 30}), (:A {num: 40})`);

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.num >= 20 RETURN avg(n.num)");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(30); // (20+30+40)/3 = 90/3 = 30
  });
});
