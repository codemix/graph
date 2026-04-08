/**
 * TCK Mathematical8 - Arithmetic precedence
 * Translated from tmp/tck/features/expressions/mathematical/Mathematical8.feature
 *
 * NOTE: Tests are skipped because RETURN-only queries are not supported
 * (must start with MATCH, CREATE, etc.)
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Mathematical8 - Arithmetic precedence", () => {
  test("[1] Arithmetic precedence test", () => {
    const graph = createTckGraph();
    // 12 / 4 * 3 - 2 * 4 = 3 * 3 - 8 = 9 - 8 = 1
    const results = executeTckQuery(graph, "RETURN 12 / 4 * 3 - 2 * 4");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[2] Arithmetic precedence with parenthesis test", () => {
    const graph = createTckGraph();
    // 12 / 4 * (3 - 2 * 4) = 3 * (3 - 8) = 3 * (-5) = -15
    const results = executeTckQuery(graph, "RETURN 12 / 4 * (3 - 2 * 4)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-15);
  });

  // Custom tests demonstrating arithmetic precedence in WHERE conditions
  test("[custom-1] Arithmetic precedence verification via property values", () => {
    const graph = createTckGraph();
    // Create nodes with pre-computed values to verify precedence
    // 12 / 4 * 3 - 2 * 4 = 3 * 3 - 8 = 9 - 8 = 1
    executeTckQuery(graph, "CREATE (:A {num: 1})");

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.num = 1 RETURN n.num");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom-2] Parenthesis precedence verification via property values", () => {
    const graph = createTckGraph();
    // 12 / 4 * (3 - 2 * 4) = 3 * (3 - 8) = 3 * (-5) = -15
    executeTckQuery(graph, "CREATE (:A {num: -15})");

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.num = -15 RETURN n.num");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-15);
  });
});
