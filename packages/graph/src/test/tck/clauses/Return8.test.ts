/**
 * TCK Return8 - Return clause interoperation with other clauses
 * Translated from tmp/tck/features/clauses/return/Return8.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Return8 - Return clause interoperation with other clauses", () => {
  test("[1] Return aggregation after With filtering - unlabeled nodes not supported", () => {
    // Given: CREATE ({num: 43}), ({num: 42})
    // Query: MATCH (n) WITH n WHERE n.num = 42 RETURN count(*)
    // Expected: 1
    // Unlabeled nodes not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 43})");
    executeTckQuery(graph, "CREATE ({num: 42})");
    const results = executeTckQuery(graph, "MATCH (n) WITH n WHERE n.num = 42 RETURN count(*)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom] Return aggregation after With filtering with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 43})");
    executeTckQuery(graph, "CREATE (:A {num: 42})");

    // count(*) not supported, use count(n) instead
    const results = executeTckQuery(graph, "MATCH (n:A) WITH n WHERE n.num = 42 RETURN count(n)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });
});
