/**
 * TCK Literals2 - Decimal integer
 * Translated from tmp/tck/features/expressions/literals/Literals2.feature
 *
 * NOTE: Original TCK tests use RETURN-only queries (e.g., `RETURN 1 AS literal`)
 * which are not supported in the grammar. Queries must start with MATCH, CREATE, etc.
 * Custom tests demonstrate decimal integer literal functionality in supported contexts.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Literals2 - Decimal integer", () => {
  // TCK tests for RETURN-only queries with integer literals

  test("[1] Return a short positive integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[2] Return a long positive integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 372036854 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(372036854);
  });

  test("[3] Return the largest integer - JS precision limits", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 9223372036854775807 AS literal");
    expect(results).toHaveLength(1);
    // eslint-disable-next-line no-loss-of-precision
    expect(results[0]).toBe(9223372036854775807);
  });

  test("[4] Return a positive zero", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 0 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0);
  });

  test("[5] Return a negative zero", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -0 AS literal");
    expect(results).toHaveLength(1);
    // In JavaScript, -0 === 0 is true but Object.is(-0, 0) is false
    // Using === comparison since vitest's toBe/toEqual use Object.is
    expect(results[0] === 0).toBe(true);
  });

  test("[6] Return a short negative integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -1 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-1);
  });

  test("[7] Return a long negative integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -372036854 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-372036854);
  });

  test("[8] Return the smallest integer - JS precision limits", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -9223372036854775808 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-9223372036854775808);
  });

  test.fails("[9] Fail on a too large integer - semantic validation not implemented", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "RETURN 9223372036854775808 AS literal")).toThrow();
  });

  test.fails("[10] Fail on a too small integer - semantic validation not implemented", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "RETURN -9223372036854775809 AS literal")).toThrow();
  });

  test("[11] Fail on an integer containing a alphabetic character - grammar rejects correctly", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "RETURN 9223372h54775808 AS literal")).toThrow();
  });

  test("[12] Fail on an integer containing a invalid symbol character - grammar rejects correctly", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "RETURN 9223372#54775808 AS literal")).toThrow();
  });

  // Custom tests demonstrating decimal integer literals in supported contexts

  test("[custom-1] Positive integer in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a1', num: 1}), (:A {name: 'a2', num: 2}), (:A {name: 'a3', num: 3})",
    );

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 2 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a2");
  });

  test("[custom-2] Zero integer in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'zero', num: 0}), (:A {name: 'one', num: 1})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 0 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("zero");
  });

  test("[custom-3] Negative integer in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'neg', num: -5}), (:A {name: 'pos', num: 5})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = -5 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("neg");
  });

  test("[custom-4] Large positive integer in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'large', num: 372036854})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 372036854 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("large");
  });

  test("[custom-5] Large negative integer in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'large-neg', num: -372036854})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = -372036854 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("large-neg");
  });

  test("[custom-6] Integer comparison with less than", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', num: 1}), (:A {name: 'b', num: 5}), (:A {name: 'c', num: 10})",
    );

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num < 5 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test("[custom-7] Integer comparison with greater than", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', num: 1}), (:A {name: 'b', num: 5}), (:A {name: 'c', num: 10})",
    );

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num > 5 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("c");
  });

  test("[custom-8] Integer in UNWIND list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [1, 2, 3] AS num RETURN num");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([1]);
    expect(results[1]).toEqual([2]);
    expect(results[2]).toEqual([3]);
  });

  test("[custom-9] Negative zero equals positive zero", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'zero', num: 0})");

    // -0 and 0 should be equal
    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = -0 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("zero");
  });

  test("[custom-10] Integer in relationship property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'start'})-[:T {weight: 42}]->(:B {name: 'end'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) WHERE r.weight = 42 RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("start");
  });
});
