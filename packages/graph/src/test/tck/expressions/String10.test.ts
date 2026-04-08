/**
 * TCK String10 - Exact Substring Search
 * Translated from tmp/tck/features/expressions/string/String10.feature
 *
 * Tests the CONTAINS operator for substring matching.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("String10 - Exact Substring Search", () => {
  test("[1] Finding exact matches with non-proper substring", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name CONTAINS 'ABCDEF' RETURN a",
    );

    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("ABCDEF");
  });

  test("[2] Finding substring of string", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name CONTAINS 'CD' RETURN a",
    );

    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("ABCDEF");
  });

  test("[3] Finding the empty substring", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name CONTAINS '' RETURN a.name",
    );

    // All strings contain the empty string
    expect(results).toHaveLength(5);
    const names = results.map((r) => r as string);
    expect(names).toContain("ABCDEF");
    expect(names).toContain("AB");
    expect(names).toContain("abcdef");
    expect(names).toContain("ab");
    expect(names).toContain("");
  });

  test("[4] Finding strings containing whitespace", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''}),
             (:TheLabel {name: 'Foo Foo'})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name CONTAINS ' ' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Foo Foo");
  });

  test.fails("[5] Finding strings containing newline - escape sequences in CREATE not supported", () => {
    // Original TCK:
    // CREATE (:TheLabel {name: 'Foo\nFoo'})
    // WHERE a.name CONTAINS '\n'
    //
    // Grammar limitation: escape sequences like \n in string literals not supported
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:TheLabel {name: 'Foo\nFoo'})`);

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name CONTAINS '\n' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Foo\nFoo");
  });

  test("[6] No string contains null", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    // CONTAINS null returns null (not true or false), so no rows match
    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE a.name CONTAINS null RETURN a",
    );

    expect(results).toHaveLength(0);
  });

  test.fails("[7] No string does not contain null - NOT null propagation not implemented", () => {
    // NOT (CONTAINS null) should return null (null propagation), so no rows match
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
      "MATCH (a:TheLabel) WHERE NOT a.name CONTAINS null RETURN a",
    );

    // NOT null = null, so no rows should match
    expect(results).toHaveLength(0);
  });

  test.fails("[8] Handling non-string operands for CONTAINS - complex WITH expressions not supported", () => {
    // Original TCK:
    // WITH [1, 3.14, true, [], {}, null] AS operands
    // UNWIND operands AS op1
    // UNWIND operands AS op2
    // WITH op1 CONTAINS op2 AS v
    // RETURN v, count(*)
    //
    // Grammar limitations:
    // - Multiple UNWIND clauses not supported
    // - List/map literals in WITH expressions not supported
    // - CONTAINS expression result capture in WITH not supported
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      `WITH [1, 3.14, true, [], {}, null] AS operands
       UNWIND operands AS op1
       UNWIND operands AS op2
       WITH op1 CONTAINS op2 AS v
       RETURN v, count(*)`,
    );

    // All combinations of non-string operands should return null
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([null, 36]);
  });

  test("[9] NOT with CONTAINS", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:TheLabel) WHERE NOT a.name CONTAINS 'b' RETURN a.name",
    );

    // 'ABCDEF', 'AB', '' do not contain 'b' (case-sensitive)
    expect(results).toHaveLength(3);
    const names = results.map((r) => r as string);
    expect(names).toContain("ABCDEF");
    expect(names).toContain("AB");
    expect(names).toContain("");
    expect(names).not.toContain("abcdef");
    expect(names).not.toContain("ab");
  });
});
