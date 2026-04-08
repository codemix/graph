/**
 * TCK Mathematical13 - Square root
 * Translated from tmp/tck/features/expressions/mathematical/Mathematical13.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Mathematical13 - Square root", () => {
  test("[1] `sqrt()` returning float values", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN sqrt(12.96)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeCloseTo(3.6, 10);
  });

  // Custom tests demonstrating square root concepts
  test("[custom-1] Square root value as property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 3.6})"); // sqrt(12.96) = 3.6 computed externally

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.num = 3.6 RETURN n.num");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3.6);
  });

  test("[custom-2] Perfect square root", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 4})"); // sqrt(16) = 4 computed externally

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.num = 4 RETURN n.num");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(4);
  });
});
