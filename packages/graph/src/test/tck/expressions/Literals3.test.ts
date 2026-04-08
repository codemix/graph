/**
 * TCK Literals3 - Hexadecimal integer
 * Translated from tmp/tck/features/expressions/literals/Literals3.feature
 *
 * NOTE: Original TCK tests use RETURN-only queries (e.g., `RETURN 0x1 AS literal`)
 * which are not supported in the grammar. Queries must start with MATCH, CREATE, etc.
 * Custom tests demonstrate hexadecimal integer literal functionality in supported contexts.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Literals3 - Hexadecimal integer", () => {
  // TCK tests for RETURN-only queries with hex literals

  test("[1] Return a short positive hexadecimal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 0x1 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[2] Return a long positive hexadecimal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 0x162CD4F6 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(372036854);
  });

  test("[3] Return the largest hexadecimal integer - JS precision limits", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 0x7FFFFFFFFFFFFFFF AS literal");
    expect(results).toHaveLength(1);
    // eslint-disable-next-line no-loss-of-precision
    expect(results[0]).toBe(9223372036854775807);
  });

  test("[4] Return a positive hexadecimal zero", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 0x0 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0);
  });

  test("[5] Return a negative hexadecimal zero", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -0x0 AS literal");
    expect(results).toHaveLength(1);
    // In JavaScript, -0 === 0 is true but Object.is(-0, 0) is false
    // Using === comparison since vitest's toBe/toEqual use Object.is
    expect(results[0] === 0).toBe(true);
  });

  test("[6] Return a short negative hexadecimal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -0x1 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-1);
  });

  test("[7] Return a long negative hexadecimal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -0x162CD4F6 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-372036854);
  });

  test("[8] Return the smallest hexadecimal integer - JS precision limits", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -0x8000000000000000 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-9223372036854775808);
  });

  test("[9] Return a lower case hexadecimal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 0x1a2b3c4d5e6f7 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(460367961908983);
  });

  test("[10] Return a upper case hexadecimal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 0x1A2B3C4D5E6F7 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(460367961908983);
  });

  test("[11] Return a mixed case hexadecimal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 0x1A2b3c4D5E6f7 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(460367961908983);
  });

  test("[12] Fail on an incomplete hexadecimal integer - grammar rejects correctly", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "RETURN 0x AS literal")).toThrow();
  });

  test("[13] Fail on an hexadecimal literal containing a lower case invalid alphanumeric character - grammar rejects correctly", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "RETURN 0x1A2b3j4D5E6f7 AS literal")).toThrow();
  });

  test("[14] Fail on an hexadecimal literal containing a upper case invalid alphanumeric character - grammar rejects correctly", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "RETURN 0x1A2b3c4Z5E6f7 AS literal")).toThrow();
  });

  test.fails("[16] Fail on a too large hexadecimal integer - semantic validation not implemented", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "RETURN 0x8000000000000000 AS literal")).toThrow();
  });

  test.fails("[17] Fail on a too small hexadecimal integer - semantic validation not implemented", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "RETURN -0x8000000000000001 AS literal")).toThrow();
  });

  // Custom tests demonstrating hexadecimal integer literals in supported contexts

  test("[custom-1] Hexadecimal integer 0x1 in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'hex', num: 0x1})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 1 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("hex");
  });

  test("[custom-2] Hexadecimal integer 0xFF in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'hex', num: 0xFF})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 255 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("hex");
  });

  test("[custom-3] Hexadecimal integer in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a', num: 255}), (:A {name: 'b', num: 256})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 0xFF RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test("[custom-4] Hexadecimal zero equals decimal zero", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'zero', num: 0})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 0x0 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("zero");
  });

  test("[custom-5] Negative hexadecimal integer in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'neg-hex', num: -0x10})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = -16 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("neg-hex");
  });

  test("[custom-6] Lower case hexadecimal digits", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'lower', num: 0xabc})");

    // 0xabc = 10*256 + 11*16 + 12 = 2560 + 176 + 12 = 2748
    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 2748 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("lower");
  });

  test("[custom-7] Upper case hexadecimal digits", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'upper', num: 0xABC})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 2748 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("upper");
  });

  test("[custom-8] Mixed case hexadecimal digits", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'mixed', num: 0xAbC})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.num = 2748 RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("mixed");
  });

  test("[custom-9] Hexadecimal integer in UNWIND list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [0x1, 0xA, 0xFF] AS num RETURN num");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([1]);
    expect(results[1]).toEqual([10]);
    expect(results[2]).toEqual([255]);
  });

  test("[custom-10] Comparing hexadecimal and decimal", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'hex', num: 0x100}), (:A {name: 'dec', num: 256})");

    // Both should have the same value (256), so both should match
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num = 256 RETURN a.name ORDER BY a.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toContain("hex");
    expect(results).toContain("dec");
  });
});
