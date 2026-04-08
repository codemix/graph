/**
 * TCK String11 - Combining Exact String Search
 * Translated from tmp/tck/features/expressions/string/String11.feature
 *
 * Tests combining STARTS WITH, ENDS WITH, and CONTAINS operators.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("String11 - Combining Exact String Search", () => {
  test("[1] Combining prefix and suffix search", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:TheLabel)
       WHERE a.name STARTS WITH 'a' AND a.name ENDS WITH 'f'
       RETURN a`,
    );

    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("abcdef");
  });

  test("[2] Combining prefix, suffix, and substring search", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:TheLabel {name: 'ABCDEF'}), (:TheLabel {name: 'AB'}),
             (:TheLabel {name: 'abcdef'}), (:TheLabel {name: 'ab'}),
             (:TheLabel {name: ''})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:TheLabel)
       WHERE a.name STARTS WITH 'A' AND a.name CONTAINS 'C' AND a.name ENDS WITH 'EF'
       RETURN a`,
    );

    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("ABCDEF");
  });
});
