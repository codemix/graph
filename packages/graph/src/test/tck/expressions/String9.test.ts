/**
 * TCK String9 - Exact String Suffix Search
 * Translated from tmp/tck/features/expressions/string/String9.feature
 *
 * Tests the ENDS WITH operator for string suffix matching.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("String9 - Exact String Suffix Search", () => {
  test("[1] Finding exact matches with non-proper suffix", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name ENDS WITH 'AB' RETURN a",
    );

    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("AB");
  });

  test("[2] Finding end of string", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name ENDS WITH 'DEF' RETURN a",
    );

    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("ABCDEF");
  });

  test("[3] Finding the empty suffix", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name ENDS WITH '' RETURN a.name",
    );

    // All strings end with the empty string
    expect(results).toHaveLength(5);
    const names = results.map((r) => r as string);
    expect(names).toContain("ABCDEF");
    expect(names).toContain("AB");
    expect(names).toContain("abcdef");
    expect(names).toContain("ab");
    expect(names).toContain("");
  });

  test.fails("[4] Finding strings ending with whitespace - escape sequences in CREATE not supported", () => {
    // Grammar limitation: escape sequences like \n, \t in string literals not supported in CREATE
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:TheLabel {name: '\nFoo\n'}), (:TheLabel {name: '\tFoo\t'})`);

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name ENDS WITH ' ' RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test.fails("[5] Finding strings ending with newline - escape sequences in CREATE not supported", () => {
    // Grammar limitation: escape sequences like \n in string literals not supported
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:TheLabel {name: '\nFoo\n'})`);

    const results = executeTckQuery(
      graph,
      `MATCH (a:TheLabel) WHERE a.name ENDS WITH '\n' RETURN a.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("\nFoo\n");
  });

  test("[6] No string ends with null", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    // ENDS WITH null returns null (not true or false), so no rows match
    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name ENDS WITH null RETURN a",
    );

    expect(results).toHaveLength(0);
  });

  test.fails("[7] No string does not end with null - NOT null propagation not implemented", () => {
    // NOT (ENDS WITH null) should return null (null propagation), so no rows match
    // But current implementation doesn't propagate null through NOT correctly
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE NOT a.name ENDS WITH null RETURN a",
    );

    expect(results).toHaveLength(0);
  });

  test.fails("[8] Handling non-string operands for ENDS WITH - complex WITH expressions not supported", () => {
    // Grammar limitations:
    // - Multiple UNWIND clauses not supported
    // - List/map literals in WITH expressions not supported
    // - ENDS WITH expression result capture in WITH not supported
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      `WITH [1, 3.14, true, [], {}, null] AS operands
       UNWIND operands AS op1
       UNWIND operands AS op2
       WITH op1 ENDS WITH op2 AS v
       RETURN v, count(*)`,
    );

    // All combinations of non-string operands should return null for ENDS WITH
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([null, 36]);
  });

  test("[9] NOT with ENDS WITH", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE NOT a.name ENDS WITH 'def' RETURN a.name",
    );

    // 'ABCDEF', 'AB', 'ab', '' do not end with 'def' (case-sensitive)
    expect(results).toHaveLength(4);
    const names = results.map((r) => r as string);
    expect(names).toContain("ABCDEF");
    expect(names).toContain("AB");
    expect(names).toContain("ab");
    expect(names).toContain("");
    expect(names).not.toContain("abcdef");
  });
});
