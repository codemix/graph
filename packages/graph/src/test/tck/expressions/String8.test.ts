/**
 * TCK String8 - Exact String Prefix Search
 * Translated from tmp/tck/features/expressions/string/String8.feature
 *
 * Tests the STARTS WITH operator for string prefix matching.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("String8 - Exact String Prefix Search", () => {
  test("[1] Finding exact matches with non-proper prefix", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name STARTS WITH 'ABCDEF' RETURN a",
    );

    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("ABCDEF");
  });

  test("[2] Finding beginning of string", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name STARTS WITH 'ABC' RETURN a",
    );

    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("ABCDEF");
  });

  test("[3] Finding the empty prefix", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name STARTS WITH '' RETURN a.name",
    );

    // All strings start with the empty string
    expect(results).toHaveLength(5);
    const names = results.map((r) => r as string);
    expect(names).toContain("ABCDEF");
    expect(names).toContain("AB");
    expect(names).toContain("abcdef");
    expect(names).toContain("ab");
    expect(names).toContain("");
  });

  test("[4] Finding strings starting with whitespace", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''}),
             (:TheLabel {name: ' Foo '})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name STARTS WITH ' ' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(" Foo ");
  });

  test.fails(
    "[5] Finding strings starting with newline - escape sequences in string literals not supported",
    () => {
      // Grammar limitation: escape sequences like \n in string literals not supported
      const graph = createTckGraph();
      executeTckQuery(graph, `CREATE (:TheLabel {name: '\nFoo\n'})`);

      const results = executeTckQuery(
        graph,
        `MATCH (a:TheLabel) WHERE a.name STARTS WITH '\n' RETURN a.name`,
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("\nFoo\n");
    },
  );

  test("[6] No string starts with null", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    // STARTS WITH null returns null (not true or false), so no rows match
    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name STARTS WITH null RETURN a",
    );

    expect(results).toHaveLength(0);
  });

  test.fails(
    "[7] No string does not start with null - NOT null propagation not implemented",
    () => {
      // NOT (STARTS WITH null) should return null (null propagation), so no rows match
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
        "MATCH (a:TheLabel) WHERE NOT a.name STARTS WITH null RETURN a",
      );

      expect(results).toHaveLength(0);
    },
  );

  test.fails(
    "[8] Handling non-string operands for STARTS WITH - complex WITH expressions not supported",
    () => {
      // Grammar limitations:
      // - Multiple UNWIND clauses not supported
      // - List/map literals in WITH expressions not supported
      // - STARTS WITH expression result capture in WITH not supported
      const graph = createTckGraph();

      const results = executeTckQuery(
        graph,
        `WITH [1, 3.14, true, [], {}, null] AS operands
       UNWIND operands AS op1
       UNWIND operands AS op2
       WITH op1 STARTS WITH op2 AS v
       RETURN v, count(*)`,
      );

      // All combinations of non-string operands should return null for STARTS WITH
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual([null, 36]);
    },
  );

  test("[9] NOT with STARTS WITH", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE NOT a.name STARTS WITH 'ab' RETURN a.name",
    );

    // 'ABCDEF', 'AB', '' do not start with 'ab' (case-sensitive)
    expect(results).toHaveLength(3);
    const names = results.map((r) => r as string);
    expect(names).toContain("ABCDEF");
    expect(names).toContain("AB");
    expect(names).toContain("");
    expect(names).not.toContain("abcdef");
    expect(names).not.toContain("ab");
  });
});
