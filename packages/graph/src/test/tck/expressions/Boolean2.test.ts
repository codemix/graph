/**
 * TCK Boolean2 - OR logical operations
 * Translated from tmp/tck/features/expressions/boolean/Boolean2.feature
 *
 * NOTE: Some tests are skipped because:
 * - Multiple UNWIND clauses not supported
 * - UNWIND with null literal not supported
 * - Type error validation not implemented
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Boolean2 - OR logical operations", () => {
  test("[1] Disjunction of two truth values", () => {
    // Original TCK: RETURN true OR true AS tt, ...
    // Using UNWIND to make it a valid query
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN
        true OR true AS tt,
        true OR false AS tf,
        true OR null AS tn,
        false OR true AS ft,
        false OR false AS ff,
        false OR null AS fn,
        null OR true AS nt,
        null OR false AS nf,
        null OR null AS nn`,
    );

    expect(results).toHaveLength(1);
    const [tt, tf, tn, ft, ff, fn, nt, nf, nn] = results[0] as unknown[];
    expect(tt).toBe(true); // true OR true = true
    expect(tf).toBe(true); // true OR false = true
    expect(tn).toBe(true); // true OR null = true
    expect(ft).toBe(true); // false OR true = true
    expect(ff).toBe(false); // false OR false = false
    expect(fn).toBe(null); // false OR null = null
    expect(nt).toBe(true); // null OR true = true
    expect(nf).toBe(null); // null OR false = null
    expect(nn).toBe(null); // null OR null = null
  });

  test("[2] Disjunction of three truth values", () => {
    // Test selected combinations of three-way OR
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN
        true OR true OR true AS ttt,
        true OR true OR false AS ttf,
        false OR false OR false AS fff,
        false OR false OR true AS fft,
        null OR null OR null AS nnn,
        true OR null OR false AS tnf`,
    );

    expect(results).toHaveLength(1);
    const [ttt, ttf, fff, fft, nnn, tnf] = results[0] as unknown[];
    expect(ttt).toBe(true);
    expect(ttf).toBe(true);
    expect(fff).toBe(false);
    expect(fft).toBe(true);
    expect(nnn).toBe(null);
    expect(tnf).toBe(true);
  });

  test("[3] Disjunction of many truth values", () => {
    // Test chains of OR operations
    const graph = createTckGraph();

    // All false should be false
    const results1 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN false OR false OR false OR false OR false AS result`,
    );
    expect(results1[0]).toBe(false);

    // One true should make it true
    const results2 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN false OR false OR true OR false OR false AS result`,
    );
    expect(results2[0]).toBe(true);

    // True before null should be true
    const results3 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN false OR true OR null OR false AS result`,
    );
    expect(results3[0]).toBe(true);

    // Null with all false should be null
    const results4 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN false OR false OR null OR false AS result`,
    );
    expect(results4[0]).toBe(null);
  });

  test("[4] Disjunction is commutative on non-null", () => {
    // Original TCK:
    // UNWIND [true, false] AS a
    // UNWIND [true, false] AS b
    // RETURN a, b, (a OR b) = (b OR a) AS result
    // Expected: all 4 combinations return result=true
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false] AS a
       UNWIND [true, false] AS b
       RETURN (a OR b) = (b OR a) AS result`,
    );

    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  test.fails(
    "[5] Disjunction is commutative on null - UNWIND with null and complex expressions not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        `UNWIND [true, false, null] AS a
       UNWIND [true, false, null] AS b
       WITH a, b WHERE a IS NULL OR b IS NULL
       RETURN a, b, (a OR b) IS NULL = (b OR a) IS NULL AS result`,
      );
      for (const r of results) {
        const result = (r as unknown[])[2];
        expect(result).toBe(true);
      }
    },
  );

  test("[6] Disjunction is associative on non-null", () => {
    // Original TCK:
    // UNWIND [true, false] AS a
    // UNWIND [true, false] AS b
    // UNWIND [true, false] AS c
    // RETURN a, b, c, (a OR (b OR c)) = ((a OR b) OR c) AS result
    // Expected: all 8 combinations return result=true
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false] AS a
       UNWIND [true, false] AS b
       UNWIND [true, false] AS c
       RETURN (a OR (b OR c)) = ((a OR b) OR c) AS result`,
    );

    expect(results).toHaveLength(8);
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  test.fails(
    "[7] Disjunction is associative on null - UNWIND with null and complex expressions not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        `UNWIND [true, false, null] AS a
       UNWIND [true, false, null] AS b
       UNWIND [true, false, null] AS c
       WITH a, b, c WHERE a IS NULL OR b IS NULL OR c IS NULL
       RETURN a, b, c, (a OR (b OR c)) IS NULL = ((a OR b) OR c) IS NULL AS result`,
      );
      for (const r of results) {
        const result = (r as unknown[])[3];
        expect(result).toBe(true);
      }
    },
  );

  test.fails(
    "[8] Fail on disjunction of at least one non-booleans - error validation not implemented",
    () => {
      const graph = createTckGraph();
      expect(() => executeTckQuery(graph, "RETURN 123 OR true")).toThrow();
    },
  );

  // Custom tests demonstrating OR behavior in WHERE clause
  test("[custom-1] OR in WHERE clause with property comparisons", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {x: 1}), (:A {x: 2}), (:A {x: 3})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.x = 1 OR n.x = 2 RETURN n.x",
    );

    expect(results).toHaveLength(2);
    const values = results
      .map((r) => (Array.isArray(r) ? r[0] : r) as number)
      .sort((a, b) => a - b);
    expect(values).toEqual([1, 2]);
  });

  test("[custom-2] OR short-circuit behavior - true OR anything = true", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {flag: true, num: 1})");

    // When first condition is true, result should match
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.flag = true OR n.num = 999 RETURN n.flag",
    );

    expect(results).toHaveLength(1);
    // Single RETURN item may be returned directly or wrapped
    const value = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(value).toBe(true);
  });

  test("[custom-3] Multiple OR conditions", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 5}), (:A {num: 10}), (:A {num: 15})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num = 1 OR n.num = 5 OR n.num = 10 RETURN n.num",
    );

    expect(results).toHaveLength(3);
    const values = results
      .map((r) => (Array.isArray(r) ? r[0] : r) as number)
      .sort((a, b) => a - b);
    expect(values).toEqual([1, 5, 10]);
  });

  test("[custom-4] OR with AND precedence", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {a: 1, b: 2}), (:A {a: 1, b: 3}), (:A {a: 2, b: 2})",
    );

    // a = 1 AND b = 2 should match first node
    // a = 2 AND b = 2 should match third node
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.a = 1 AND n.b = 2 OR n.a = 2 AND n.b = 2 RETURN n.a, n.b",
    );

    expect(results).toHaveLength(2);
  });
});
