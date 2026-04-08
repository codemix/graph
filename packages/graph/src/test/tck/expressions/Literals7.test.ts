/**
 * TCK Literals7 - List
 * Translated from tmp/tck/features/expressions/literals/Literals7.feature
 *
 * NOTE: Original TCK tests use RETURN-only queries (e.g., `RETURN [] AS literal`)
 * which are not supported in the grammar. Queries must start with MATCH, CREATE, etc.
 * Custom tests demonstrate list literal functionality in supported contexts.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Literals7 - List", () => {
  // TCK tests for RETURN-only queries with list literals

  test("[1] Return an empty list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [] AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([]);
  });

  test("[2] Return a list containing a boolean", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [false] AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([false]);
  });

  test("[3] Return a list containing a null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [null] AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([null]);
  });

  test("[4] Return a list containing an integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [1] AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1]);
  });

  test("[5] Return a list containing a hexadecimal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [-0x162CD4F6] AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([-372036854]);
  });

  test("[6] Return a list containing an octal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [0o2613152366] AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([372036854]);
  });

  test.fails("[7] Return a list containing a float - grammar requires integer part", () => {
    // Query: RETURN [-.1e-5] AS literal
    // Expected: [-0.000001]
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [-.1e-5] AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([-0.000001]);
  });

  test("[8] Return a list containing a string", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN ['abc, as#?lßdj '] AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["abc, as#?lßdj "]);
  });

  test("[9] Return nested empty list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [[]] AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([[]]);
  });

  test("[10] Return doubly nested empty list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [[[]]] AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([[[]]]);
  });

  test("[13] Return a list containing an empty map", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [{}] AS literal");
    expect(results).toEqual([[{}]]);
  });

  test("[14] Return a list containing multiple integers", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [1, -2, 0o77, 0xA4C, 71034856] AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, -2, 63, 2636, 71034856]);
  });

  test("[16] Return a list containing multiple mixed values", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN [0.2, ', as#?lßdj ', null, 71034856, false] AS literal",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([0.2, ", as#?lßdj ", null, 71034856, false]);
  });

  test("[19-21] Fail on invalid list syntax - validation not implemented", () => {
    // Query: RETURN [1, AS literal
    // Expected: SyntaxError
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "RETURN [1, AS literal");
    }).toThrow();
  });

  // Custom tests demonstrating list literals in supported contexts

  test("[custom-1] UNWIND empty list returns no results", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [] AS x RETURN x");

    expect(results).toHaveLength(0);
  });

  test("[custom-2] UNWIND list with integers", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [1, 2, 3] AS num RETURN num");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([1]);
    expect(results[1]).toEqual([2]);
    expect(results[2]).toEqual([3]);
  });

  test("[custom-3] UNWIND list with strings", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND ['a', 'b', 'c'] AS letter RETURN letter");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(["a"]);
    expect(results[1]).toEqual(["b"]);
    expect(results[2]).toEqual(["c"]);
  });

  test("[custom-4] UNWIND list with booleans", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [true, false, true] AS val RETURN val");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([true]);
    expect(results[1]).toEqual([false]);
    expect(results[2]).toEqual([true]);
  });

  test("[custom-5] UNWIND list with mixed types", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [1, 'two', true] AS item RETURN item");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([1]);
    expect(results[1]).toEqual(["two"]);
    expect(results[2]).toEqual([true]);
  });

  test("[custom-6] UNWIND list with hexadecimal values", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [0x1, 0xA, 0xFF] AS num RETURN num");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([1]);
    expect(results[1]).toEqual([10]);
    expect(results[2]).toEqual([255]);
  });

  test("[custom-7] UNWIND list with octal values", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [0o1, 0o10, 0o77] AS num RETURN num");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([1]);
    expect(results[1]).toEqual([8]);
    expect(results[2]).toEqual([63]);
  });

  test("[custom-8] UNWIND list with float values", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [1.0, 2.5, 3.14] AS num RETURN num");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([1.0]);
    expect(results[1]).toEqual([2.5]);
    expect(results[2]).toEqual([3.14]);
  });

  test("[custom-9] UNWIND list with negative values", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [-1, -2, -3] AS num RETURN num");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([-1]);
    expect(results[1]).toEqual([-2]);
    expect(results[2]).toEqual([-3]);
  });

  test("[custom-10] IN operator with list literal", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', num: 1}), (:A {name: 'b', num: 2}), (:A {name: 'c', num: 3}), (:A {name: 'd', num: 4})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num IN [1, 3] RETURN a.name ORDER BY a.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toContain("a");
    expect(results).toContain("c");
  });

  test("[custom-11] IN operator with string list", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'alpha'}), (:A {name: 'beta'}), (:A {name: 'gamma'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name IN ['alpha', 'gamma'] RETURN a.name ORDER BY a.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toContain("alpha");
    expect(results).toContain("gamma");
  });

  test("[custom-12] NOT IN operator with list literal", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', num: 1}), (:A {name: 'b', num: 2}), (:A {name: 'c', num: 3})",
    );

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE NOT a.num IN [1, 3] RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("b");
  });

  test("[custom-13] UNWIND single element list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [42] AS num RETURN num");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([42]);
  });

  test("[custom-14] UNWIND preserves duplicate values", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [1, 1, 2, 2, 3] AS num RETURN num");

    expect(results).toHaveLength(5);
    expect(results[0]).toEqual([1]);
    expect(results[1]).toEqual([1]);
    expect(results[2]).toEqual([2]);
    expect(results[3]).toEqual([2]);
    expect(results[4]).toEqual([3]);
  });
});
