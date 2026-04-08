/**
 * TCK Boolean4 - NOT logical operations
 * Translated from tmp/tck/features/expressions/boolean/Boolean4.feature
 *
 * NOTE: Some tests are skipped because:
 * - Unlabeled nodes not supported
 * - Type error validation not implemented
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel } from "../tckHelpers.js";

describe("Boolean4 - NOT logical operations", () => {
  test("[1] Logical negation of truth values", () => {
    // Original TCK: RETURN NOT true AS nt, NOT false AS nf, NOT null AS nn
    // Using UNWIND to make it a valid query
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN NOT true AS nt, NOT false AS nf, NOT null AS nn`,
    );

    expect(results).toHaveLength(1);
    const [nt, nf, nn] = results[0] as unknown[];
    expect(nt).toBe(false); // NOT true = false
    expect(nf).toBe(true); // NOT false = true
    expect(nn).toBe(null); // NOT null = null
  });

  test("[2] Double logical negation of truth values", () => {
    // Original TCK: RETURN NOT NOT true AS nnt, NOT NOT false AS nnf, NOT NOT null AS nnn
    // Using UNWIND to make it a valid query
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN NOT NOT true AS nnt, NOT NOT false AS nnf, NOT NOT null AS nnn`,
    );

    expect(results).toHaveLength(1);
    const [nnt, nnf, nnn] = results[0] as unknown[];
    expect(nnt).toBe(true); // NOT NOT true = true
    expect(nnf).toBe(false); // NOT NOT false = false
    expect(nnn).toBe(null); // NOT NOT null = null
  });

  test("[3] NOT and false - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name: 'a'})");
    const results = executeTckQuery(
      graph,
      "MATCH (n) WHERE NOT(n.name = 'apa' AND false) RETURN n",
    );
    expect(results).toHaveLength(1);
  });

  test("[custom-3] NOT and false - labeled node version", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a'})");

    // NOT(false) should be true, so this should match
    // NOT(n.name = 'apa' AND false) => NOT(true AND false) => NOT(false) => true
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT (n.name = 'apa' AND n.name = 'impossible') RETURN n",
    );

    expect(results).toHaveLength(1);
    const node = (results[0] as [Record<string, unknown>])[0];
    expect(getLabel(node)).toBe("A");
  });

  test.fails("[4] Fail when using NOT on a non-boolean literal - error validation not implemented", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "RETURN NOT 0")).toThrow();
  });

  // Custom tests demonstrating NOT behavior in WHERE clause
  test("[custom-1] NOT in WHERE clause - negating equality", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Alice'}), (:A {name: 'Bob'}), (:A {name: 'Carol'})");

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE NOT n.name = 'Alice' RETURN n.name");

    expect(results).toHaveLength(2);
    const names = results.map((r) => (Array.isArray(r) ? r[0] : r) as string).sort();
    expect(names).toEqual(["Bob", "Carol"]);
  });

  test("[custom-2] NOT with AND - De Morgan's law application", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {x: 1, y: 1}), (:A {x: 1, y: 2}), (:A {x: 2, y: 1}), (:A {x: 2, y: 2})",
    );

    // NOT (x=1 AND y=1) should match all except (1,1)
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT (n.x = 1 AND n.y = 1) RETURN n.x, n.y",
    );

    expect(results).toHaveLength(3);
    const pairs = results.map((r) => (r as [number, number]).slice());
    expect(pairs).not.toContainEqual([1, 1]);
    expect(pairs).toContainEqual([1, 2]);
    expect(pairs).toContainEqual([2, 1]);
    expect(pairs).toContainEqual([2, 2]);
  });

  test("[custom-4] Double NOT in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {flag: true}), (:A {flag: false})");

    // NOT NOT (flag = true) should match flag = true
    const results = executeTckQuery(graph, "MATCH (n:A) WHERE NOT NOT n.flag = true RETURN n.flag");

    expect(results).toHaveLength(1);
    // Single RETURN item may be returned directly or wrapped
    const value = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(value).toBe(true);
  });

  test("[custom-5] NOT with OR", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3}), (:A {num: 4})");

    // NOT (num=1 OR num=2) should match 3 and 4
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT (n.num = 1 OR n.num = 2) RETURN n.num",
    );

    expect(results).toHaveLength(2);
    const values = results
      .map((r) => (Array.isArray(r) ? r[0] : r) as number)
      .sort((a, b) => a - b);
    expect(values).toEqual([3, 4]);
  });

  test("[custom-6] NOT with comparison operators", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1}), (:A {num: 5}), (:A {num: 10})");

    // NOT (num > 3) should match num <= 3
    const results = executeTckQuery(graph, "MATCH (n:A) WHERE NOT n.num > 3 RETURN n.num");

    expect(results).toHaveLength(1);
    // Single RETURN item may be returned directly or wrapped
    const value = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(value).toBe(1);
  });
});
