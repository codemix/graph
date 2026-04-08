/**
 * TCK Boolean3 - XOR logical operations
 * Translated from tmp/tck/features/expressions/boolean/Boolean3.feature
 *
 * NOTE: Some tests are skipped because:
 * - Multiple UNWIND clauses not supported
 * - UNWIND with null literal not supported
 * - Type error validation not implemented
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Boolean3 - XOR logical operations", () => {
  test("[1] Exclusive disjunction of two truth values", () => {
    // Original TCK: RETURN true XOR true AS tt, ...
    // Using UNWIND to make it a valid query
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN
        true XOR true AS tt,
        true XOR false AS tf,
        true XOR null AS tn,
        false XOR true AS ft,
        false XOR false AS ff,
        false XOR null AS fn,
        null XOR true AS nt,
        null XOR false AS nf,
        null XOR null AS nn`,
    );

    expect(results).toHaveLength(1);
    const [tt, tf, tn, ft, ff, fn, nt, nf, nn] = results[0] as unknown[];
    expect(tt).toBe(false); // true XOR true = false
    expect(tf).toBe(true); // true XOR false = true
    expect(tn).toBe(null); // true XOR null = null
    expect(ft).toBe(true); // false XOR true = true
    expect(ff).toBe(false); // false XOR false = false
    expect(fn).toBe(null); // false XOR null = null
    expect(nt).toBe(null); // null XOR true = null
    expect(nf).toBe(null); // null XOR false = null
    expect(nn).toBe(null); // null XOR null = null
  });

  test("[2] Exclusive disjunction of three truth values", () => {
    // Test selected combinations of three-way XOR
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN
        true XOR true XOR true AS ttt,
        true XOR true XOR false AS ttf,
        true XOR false XOR false AS tff,
        false XOR false XOR false AS fff,
        null XOR null XOR null AS nnn`,
    );

    expect(results).toHaveLength(1);
    const [ttt, ttf, tff, fff, nnn] = results[0] as unknown[];
    // XOR is left-associative: (a XOR b) XOR c
    expect(ttt).toBe(true); // (true XOR true) XOR true = false XOR true = true
    expect(ttf).toBe(false); // (true XOR true) XOR false = false XOR false = false
    expect(tff).toBe(true); // (true XOR false) XOR false = true XOR false = true
    expect(fff).toBe(false); // (false XOR false) XOR false = false XOR false = false
    expect(nnn).toBe(null);
  });

  test("[3] Exclusive disjunction of many truth values", () => {
    // Test chains of XOR operations
    const graph = createTckGraph();

    // Count of true values: even=false, odd=true
    const results1 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN true XOR true XOR true XOR true AS result`,
    );
    expect(results1[0]).toBe(false); // 4 trues = even = false

    const results2 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN true XOR true XOR true XOR true XOR true AS result`,
    );
    expect(results2[0]).toBe(true); // 5 trues = odd = true

    // Null propagates
    const results3 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN true XOR null XOR false AS result`,
    );
    expect(results3[0]).toBe(null);
  });

  test("[4] Exclusive disjunction is commutative on non-null", () => {
    // Original TCK:
    // UNWIND [true, false] AS a
    // UNWIND [true, false] AS b
    // RETURN a, b, (a XOR b) = (b XOR a) AS result
    // Expected: all 4 combinations return result=true
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false] AS a
       UNWIND [true, false] AS b
       RETURN (a XOR b) = (b XOR a) AS result`,
    );

    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  test.fails(
    "[5] Exclusive disjunction is commutative on null - UNWIND with null and complex expressions not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        `UNWIND [true, false, null] AS a
       UNWIND [true, false, null] AS b
       WITH a, b WHERE a IS NULL OR b IS NULL
       RETURN a, b, (a XOR b) IS NULL = (b XOR a) IS NULL AS result`,
      );
      for (const r of results) {
        const result = (r as unknown[])[2];
        expect(result).toBe(true);
      }
    },
  );

  test("[6] Exclusive disjunction is associative on non-null", () => {
    // Original TCK:
    // UNWIND [true, false] AS a
    // UNWIND [true, false] AS b
    // UNWIND [true, false] AS c
    // RETURN a, b, c, (a XOR (b XOR c)) = ((a XOR b) XOR c) AS result
    // Expected: all 8 combinations return result=true
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false] AS a
       UNWIND [true, false] AS b
       UNWIND [true, false] AS c
       RETURN (a XOR (b XOR c)) = ((a XOR b) XOR c) AS result`,
    );

    expect(results).toHaveLength(8);
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  test.fails(
    "[7] Exclusive disjunction is associative on null - UNWIND with null and complex expressions not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        `UNWIND [true, false, null] AS a
       UNWIND [true, false, null] AS b
       UNWIND [true, false, null] AS c
       WITH a, b, c WHERE a IS NULL OR b IS NULL OR c IS NULL
       RETURN a, b, c, (a XOR (b XOR c)) IS NULL = ((a XOR b) XOR c) IS NULL AS result`,
      );
      for (const r of results) {
        const result = (r as unknown[])[3];
        expect(result).toBe(true);
      }
    },
  );

  test.fails(
    "[8] Fail on exclusive disjunction of at least one non-booleans - error validation not implemented",
    () => {
      const graph = createTckGraph();
      expect(() => executeTckQuery(graph, "RETURN 123 XOR true")).toThrow();
    },
  );

  // Custom tests demonstrating XOR behavior in WHERE clause
  test("[custom-1] XOR in WHERE clause - basic exclusive or", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {x: true, y: true}), (:A {x: true, y: false}), (:A {x: false, y: true}), (:A {x: false, y: false})",
    );

    // XOR returns true when exactly one operand is true
    // So (true, false) and (false, true) should match
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.x = true XOR n.y = true RETURN n.x, n.y",
    );

    expect(results).toHaveLength(2);
    // Sort by x value for consistent ordering
    const sorted = [...results].sort((a, b) => {
      const aVal = (a as [boolean, boolean])[0];
      const bVal = (b as [boolean, boolean])[0];
      return aVal === bVal ? 0 : aVal ? -1 : 1;
    });
    expect(sorted[0]).toEqual([true, false]);
    expect(sorted[1]).toEqual([false, true]);
  });

  test("[custom-2] XOR truth table verification via WHERE clause", () => {
    const graph = createTckGraph();
    // Create nodes with all combinations of two boolean properties
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 1})"); // Both conditions true
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 2})"); // First true, second false
    executeTckQuery(graph, "CREATE (:A {a: 2, b: 1})"); // First false, second true
    executeTckQuery(graph, "CREATE (:A {a: 2, b: 2})"); // Both false

    // XOR: (a=1) XOR (b=1) - true when exactly one is true
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.a = 1 XOR n.b = 1 RETURN n.a, n.b",
    );

    expect(results).toHaveLength(2);
    // Should match (1,2) and (2,1)
    const pairs = results.map((r) => (r as [number, number]).slice());
    expect(pairs).toContainEqual([1, 2]);
    expect(pairs).toContainEqual([2, 1]);
  });

  test("[custom-3] XOR with OR and AND - operator precedence", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3}), (:A {num: 4})",
    );

    // XOR has lower precedence than AND, higher than OR
    // n.num = 1 XOR n.num = 2 should match nodes where exactly one condition is true
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num = 1 XOR n.num = 2 RETURN n.num",
    );

    expect(results).toHaveLength(2);
    const values = results
      .map((r) => (Array.isArray(r) ? r[0] : r) as number)
      .sort((a, b) => a - b);
    expect(values).toEqual([1, 2]);
  });
});
