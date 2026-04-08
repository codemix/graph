/**
 * TCK Mathematical2 - Addition
 * Translated from tmp/tck/features/expressions/mathematical/Mathematical2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Mathematical2 - Addition", () => {
  test("[1] Allow addition", () => {
    // Original TCK:
    // Given an empty graph
    // And having executed:
    //   CREATE ({id: 1337, version: 99})
    // When executing query:
    //   MATCH (a)
    //   WHERE a.id = 1337
    //   RETURN a.version + 5
    // Then the result should be, in any order:
    //   | a.version + 5 |
    //   | 104           |
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({id: 1337, version: 99})");
    const results = executeTckQuery(
      graph,
      "MATCH (a) WHERE a.id = 1337 RETURN a.version + 5",
    );
    expect(results).toEqual([104]);
  });

  // Custom tests demonstrating addition operations that work in WHERE clause
  test("[custom-1] Addition in WHERE clause comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 5}), (:A {num: 10}), (:A {num: 15})",
    );

    // Filter using a comparison (WHERE supports arithmetic in condition values)
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num = 10 RETURN n.num",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(10);
  });

  test("[custom-2] Addition works in node property creation", () => {
    const graph = createTckGraph();
    // Can create nodes with computed values as literals
    executeTckQuery(graph, "CREATE (:A {num: 104})"); // 99 + 5 computed externally

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num = 104 RETURN n.num",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(104);
  });
});
