/**
 * TCK List1 - Dynamic Element Access
 * Translated from tmp/tck/features/expressions/list/List1.feature
 *
 * Tests list indexing with bracket operator: list[index]
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("List1 - Dynamic Element Access", () => {
  test("[1] Indexing into literal list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [1, 2, 3][0] AS value");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[2] Indexing into nested literal lists", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [[1]][0][0]");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[3] Use list lookup based on parameters", () => {
    // Original TCK:
    // WITH $expr AS expr, $idx AS idx
    // RETURN expr[idx] AS value
    // Parameters: expr = ['Apa'], idx = 0
    // Expected: 'Apa'
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH $expr AS expr, $idx AS idx RETURN expr[idx] AS value",
      { expr: ["Apa"], idx: 0 },
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Apa");
  });

  test("[4] Use list lookup based on parameters when there is lhs type information", () => {
    // Original TCK:
    // WITH ['Apa'] AS expr
    // RETURN expr[$idx] AS value
    // Parameters: idx = 0
    // Expected: 'Apa'
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH ['Apa'] AS expr RETURN expr[$idx] AS value", {
      idx: 0,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Apa");
  });

  test("[5] Use list lookup based on parameters when there is rhs type information", () => {
    // Original TCK:
    // WITH $expr AS expr, $idx AS idx
    // RETURN expr[toInteger(idx)] AS value
    // Parameters: expr = ['Apa'], idx = 0
    // Expected: 'Apa'
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH $expr AS expr, $idx AS idx RETURN expr[toInteger(idx)] AS value",
      { expr: ["Apa"], idx: 0 },
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Apa");
  });

  test.fails("[6] Fail when indexing a non-list - semantic validation not implemented", () => {
    // Original TCK (Scenario Outline with examples):
    // WITH <expr> AS list, 0 AS idx
    // RETURN list[idx]
    // Expected: TypeError for boolean, integer, float, string
    // Actual: Returns null instead of throwing TypeError
    const graph = createTckGraph();
    // Should throw TypeError when indexing a boolean
    expect(() => executeTckQuery(graph, "WITH true AS list, 0 AS idx RETURN list[idx]")).toThrow();
  });

  test.fails("[7] Fail when indexing a non-list given by parameter - semantic validation not implemented", () => {
    // Original TCK (Scenario Outline):
    // WITH $expr AS list, $idx AS idx
    // RETURN list[idx]
    // Expected: TypeError for boolean, integer, float, string
    // Actual: Returns null instead of throwing TypeError
    const graph = createTckGraph();
    // Should throw TypeError when indexing a boolean from parameter
    expect(() =>
      executeTckQuery(graph, "WITH $expr AS list, $idx AS idx RETURN list[idx]", {
        expr: true,
        idx: 0,
      }),
    ).toThrow();
  });

  test.fails("[8] Fail when indexing with a non-integer - semantic validation not implemented", () => {
    // Original TCK (Scenario Outline):
    // WITH [1, 2, 3, 4, 5] AS list, <idx> AS idx
    // RETURN list[idx]
    // Expected: TypeError for boolean, float, string, list, map
    // Actual: Returns null instead of throwing TypeError
    const graph = createTckGraph();
    // Should throw TypeError when indexing with a boolean
    expect(() =>
      executeTckQuery(graph, "WITH [1, 2, 3, 4, 5] AS list, true AS idx RETURN list[idx]"),
    ).toThrow();
  });

  test.fails("[9] Fail when indexing with a non-integer given by parameter - semantic validation not implemented", () => {
    // Original TCK (Scenario Outline):
    // WITH $expr AS list, $idx AS idx
    // RETURN list[idx]
    // Expected: TypeError for boolean, float, string, list, map
    // Actual: Returns null instead of throwing TypeError
    const graph = createTckGraph();
    // Should throw TypeError when indexing with a boolean from parameter
    expect(() =>
      executeTckQuery(graph, "WITH $expr AS list, $idx AS idx RETURN list[idx]", {
        expr: [1, 2, 3],
        idx: true,
      }),
    ).toThrow();
  });

  // Custom tests demonstrating list access via stored properties
  test("[Custom 1] List element access via stored list property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {items: [10, 20, 30]})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.items[1]");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(20);
  });

  test("[Custom 2] UNWIND list for element access", () => {
    const graph = createTckGraph();

    // Use UNWIND to access list elements
    // Note: RETURN x returns wrapped values [[x1], [x2], ...]
    const results = executeTckQuery(graph, "UNWIND [1, 2, 3] AS x RETURN x");

    expect(results).toHaveLength(3);
    // Each result is wrapped in an array
    expect(results[0]).toEqual([1]);
    expect(results[1]).toEqual([2]);
    expect(results[2]).toEqual([3]);
  });

  test("[Custom 3] Filter unwound list elements", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})`);

    // Filter using WHERE with unwound values
    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.num = 2 RETURN n.num");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });
});
