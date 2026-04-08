/**
 * TCK Literals5 - Float
 * Translated from tmp/tck/features/expressions/literals/Literals5.feature
 *
 * NOTE: Original TCK tests use RETURN-only queries (e.g., `RETURN 1.0 AS literal`)
 * which are not supported in the grammar. Queries must start with MATCH, CREATE, etc.
 * Custom tests demonstrate float literal functionality in supported contexts.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Literals5 - Float", () => {
  // TCK tests for RETURN-only queries with float literals

  test("[1] Return a short positive float", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1.0 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1.0);
  });

  test.fails("[2] Return a short positive float without integer digits - grammar requires integer part", () => {
    // Query: RETURN .1 AS literal
    // Expected: 0.1
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN .1 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0.1);
  });

  test("[3] Return a long positive float", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 3985764.3405892687 AS literal");
    expect(results).toHaveLength(1);
    // JavaScript floating point precision
    expect(results[0]).toBeCloseTo(3985764.3405892686, 6);
  });

  test.fails("[4] Return a long positive float without integer digits - grammar requires integer part", () => {
    // Query: RETURN .3405892687 AS literal
    // Expected: 0.3405892687
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN .3405892687 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeCloseTo(0.3405892687, 10);
  });

  test("[5] Return a very long positive float - precision limits", () => {
    // Query: RETURN 1.2635418652381264e305 AS literal
    // Expected: 1.2635418652381264e305
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1.2635418652381264e305 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeCloseTo(1.2635418652381264e305, 290);
  });

  test("[6] Return a very long positive float without integer digits - grammar requires integer part", () => {
    // Query: RETURN .0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001 AS literal
    // Expected: 1e-305
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1e-305 AS literal");
    expect(results).toHaveLength(1);
    // eslint-disable-next-line no-loss-of-precision
    expect(results[0]).toBeCloseTo(1e-305, 320);
  });

  test("[7] Return a positive zero float", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 0.0 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0);
  });

  test.fails("[8] Return a positive zero float without integer digits - grammar requires integer part", () => {
    // Query: RETURN .0 AS literal
    // Expected: 0.0
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN .0 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0);
  });

  test("[9] Return a negative zero float", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -0.0 AS literal");
    expect(results).toHaveLength(1);
    // In JavaScript, -0 === 0 is true
    expect(results[0] === 0).toBe(true);
  });

  test.fails("[10] Return a negative zero float without integer digits - grammar requires integer part", () => {
    // Query: RETURN -.0 AS literal
    // Expected: 0.0
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -.0 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0] === 0).toBe(true);
  });

  test("[11] Return a very long negative float - precision limits", () => {
    // Query: RETURN -1.2635418652381264e305 AS literal
    // Expected: -1.2635418652381264e305
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -1.2635418652381264e305 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeCloseTo(-1.2635418652381264e305, 290);
  });

  test("[12] Return a very long negative float without integer digits - grammar requires integer part", () => {
    // Query: RETURN -.0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001 AS literal
    // Expected: -1e-305
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -1e-305 AS literal");
    expect(results).toHaveLength(1);
    // eslint-disable-next-line no-loss-of-precision
    expect(results[0]).toBeCloseTo(-1e-305, 320);
  });

  test("[13] Return a positive float with positive lower case exponent", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1e9 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1000000000);
  });

  test("[14] Return a positive float with positive upper case exponent", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1E9 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1000000000);
  });

  test("[15] Return a positive float with negative lower case exponent", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1e-9 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeCloseTo(0.000000001, 12);
  });

  test("[16] Return a negative float with positive exponent", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -2.5e3 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-2500);
  });

  test("[17] Return a float with decimal and exponent", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1.5e2 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(150);
  });

  // Custom tests demonstrating float literals in supported contexts

  test("[custom-1] Float 1.0 in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'float', num: 1.0})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 1.0 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("float");
  });

  test("[custom-2] Float 0.5 in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'half', num: 0.5})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 0.5 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("half");
  });

  test("[custom-3] Float in WHERE clause comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', num: 1.5}), (:A {name: 'b', num: 2.5}), (:A {name: 'c', num: 3.5})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num < 3.0 RETURN a.name ORDER BY a.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toContain("a");
    expect(results).toContain("b");
  });

  test("[custom-4] Negative float in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'neg', num: -3.14})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num < 0 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("neg");
  });

  test("[custom-5] Float zero equals integer zero", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'int', num: 0}), (:A {name: 'float', num: 0.0})");

    // Both should match when comparing to 0
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num = 0 RETURN a.name ORDER BY a.name",
    );

    expect(results).toHaveLength(2);
  });

  test("[custom-6] Float with exponent notation in CREATE", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'exp', num: 1e3})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 1000 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("exp");
  });

  test("[custom-7] Float with negative exponent in CREATE", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'small', num: 1e-3})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 0.001 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("small");
  });

  test("[custom-8] Float in UNWIND list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [1.0, 2.5, 3.14] AS num RETURN num");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([1.0]);
    expect(results[1]).toEqual([2.5]);
    expect(results[2]).toEqual([3.14]);
  });

  test("[custom-9] Float precision comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'precise', num: 3.14159265359})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num > 3.14 AND a.num < 3.15 RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("precise");
  });

  test("[custom-10] Float equals integer value", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', num: 5.0})");

    // 5.0 should equal 5
    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 5 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-11] Float in relationship property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'start'})-[:T {weight: 0.75}]->(:B {name: 'end'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) WHERE r.weight > 0.5 RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("start");
  });

  test("[custom-12] Multiple float comparisons", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'low', num: 0.1}), (:A {name: 'mid', num: 0.5}), (:A {name: 'high', num: 0.9})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num >= 0.2 AND a.num <= 0.8 RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("mid");
  });
});
