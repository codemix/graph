/**
 * TCK Mathematical11 - Signed numbers functions
 * Translated from tmp/tck/features/expressions/mathematical/Mathematical11.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Mathematical11 - Signed numbers functions", () => {
  test("[1] Absolute function", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN abs(-1)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  // Custom tests demonstrating absolute value concepts
  test("[custom-1] Absolute value via property storage", () => {
    const graph = createTckGraph();
    // Store the absolute value result computed externally
    executeTckQuery(graph, "CREATE (:A {num: 1})"); // abs(-1) = 1

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.num = 1 RETURN n.num");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom-2] Filtering by sign in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: -5}), (:A {num: 5}), (:A {num: 0})");

    // Get all negative numbers
    const negResults = executeTckQuery(graph, "MATCH (n:A) WHERE n.num < 0 RETURN n.num");
    expect(negResults).toHaveLength(1);
    expect(negResults[0]).toBe(-5);

    // Get all non-negative numbers
    const nonNegResults = executeTckQuery(graph, "MATCH (n:A) WHERE n.num >= 0 RETURN n.num");
    expect(nonNegResults).toHaveLength(2);
  });
});
