/**
 * TCK Mathematical14 - Logarithm
 * Translated from tmp/tck/features/expressions/mathematical/Mathematical14.feature
 *
 * NOTE: This feature file has no scenarios in the original TCK.
 * The file only contains the feature declaration without test cases.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Mathematical14 - Logarithm", () => {
  test.fails(
    "[placeholder] No scenarios in original TCK feature file - log(), log10(), e() not implemented",
    () => {
      // The Mathematical14.feature file only contains the feature header:
      // Feature: Mathematical14 - Logarithm
      // No actual Scenario blocks are defined.
      //
      // This would typically include tests for:
      // - log(e()) returning 1
      // - log10(100) returning 2
      throw new Error("log(), log10(), e() functions not implemented");
    },
  );

  // Custom tests demonstrating logarithm concepts
  test("[custom-1] Natural log value as property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})"); // log(e) = 1 computed externally

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num = 1 RETURN n.num",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom-2] Log10 value as property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 2})"); // log10(100) = 2 computed externally

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num = 2 RETURN n.num",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });
});
