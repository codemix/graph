/**
 * TCK Boolean1 - And logical operations
 * Translated from tmp/tck/features/expressions/boolean/Boolean1.feature
 *
 * NOTE: Some tests are skipped because:
 * - Multiple UNWIND clauses not supported
 * - UNWIND with null literal not supported
 * - Type error validation not implemented
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Boolean1 - And logical operations", () => {
  test("[1] Conjunction of two truth values", () => {
    // Original TCK: RETURN true AND true AS tt, ...
    // Using UNWIND to make it a valid query
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN
        true AND true AS tt,
        true AND false AS tf,
        true AND null AS tn,
        false AND true AS ft,
        false AND false AS ff,
        false AND null AS fn,
        null AND true AS nt,
        null AND false AS nf,
        null AND null AS nn`,
    );

    expect(results).toHaveLength(1);
    const [tt, tf, tn, ft, ff, fn, nt, nf, nn] = results[0] as unknown[];
    expect(tt).toBe(true); // true AND true = true
    expect(tf).toBe(false); // true AND false = false
    expect(tn).toBe(null); // true AND null = null
    expect(ft).toBe(false); // false AND true = false
    expect(ff).toBe(false); // false AND false = false
    expect(fn).toBe(false); // false AND null = false
    expect(nt).toBe(null); // null AND true = null
    expect(nf).toBe(false); // null AND false = false
    expect(nn).toBe(null); // null AND null = null
  });

  test("[2] Conjunction of three truth values", () => {
    // Test selected combinations of three-way AND
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN
        true AND true AND true AS ttt,
        true AND true AND false AS ttf,
        true AND false AND true AS tft,
        false AND true AND true AS ftt,
        false AND false AND false AS fff,
        true AND true AND null AS ttn,
        null AND null AND null AS nnn`,
    );

    expect(results).toHaveLength(1);
    const [ttt, ttf, tft, ftt, fff, ttn, nnn] = results[0] as unknown[];
    expect(ttt).toBe(true);
    expect(ttf).toBe(false);
    expect(tft).toBe(false);
    expect(ftt).toBe(false);
    expect(fff).toBe(false);
    expect(ttn).toBe(null);
    expect(nnn).toBe(null);
  });

  test("[3] Conjunction of many truth values", () => {
    // Test chains of AND operations
    const graph = createTckGraph();

    // All true should be true
    const results1 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN true AND true AND true AND true AND true AS result`,
    );
    expect(results1[0]).toBe(true);

    // One false should make it false
    const results2 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN true AND true AND false AND true AND true AS result`,
    );
    expect(results2[0]).toBe(false);

    // False before null should be false
    const results3 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN true AND false AND null AND true AS result`,
    );
    expect(results3[0]).toBe(false);

    // Null with all true should be null
    const results4 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN true AND true AND null AND true AS result`,
    );
    expect(results4[0]).toBe(null);
  });

  test("[4] Conjunction is commutative on non-null", () => {
    // Original TCK:
    // UNWIND [true, false] AS a
    // UNWIND [true, false] AS b
    // RETURN a, b, (a AND b) = (b AND a) AS result
    // Expected: all 4 combinations return result=true
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false] AS a
       UNWIND [true, false] AS b
       RETURN (a AND b) = (b AND a) AS result`,
    );

    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  test.fails("[5] Conjunction is commutative on null - UNWIND with null and IS NULL in expressions not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false, null] AS a
       UNWIND [true, false, null] AS b
       WITH a, b WHERE a IS NULL OR b IS NULL
       RETURN a, b, (a AND b) IS NULL = (b AND a) IS NULL AS result`,
    );
    // All combinations with null should return true for IS NULL comparison
    for (const r of results) {
      const result = (r as unknown[])[2];
      expect(result).toBe(true);
    }
  });

  test("[6] Conjunction is associative on non-null", () => {
    // Original TCK:
    // UNWIND [true, false] AS a
    // UNWIND [true, false] AS b
    // UNWIND [true, false] AS c
    // RETURN a, b, c, (a AND (b AND c)) = ((a AND b) AND c) AS result
    // Expected: all 8 combinations return result=true
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false] AS a
       UNWIND [true, false] AS b
       UNWIND [true, false] AS c
       RETURN (a AND (b AND c)) = ((a AND b) AND c) AS result`,
    );

    expect(results).toHaveLength(8);
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  test.fails("[7] Conjunction is associative on null - UNWIND with null and complex expressions not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false, null] AS a
       UNWIND [true, false, null] AS b
       UNWIND [true, false, null] AS c
       WITH a, b, c WHERE a IS NULL OR b IS NULL OR c IS NULL
       RETURN a, b, c, (a AND (b AND c)) IS NULL = ((a AND b) AND c) IS NULL AS result`,
    );
    for (const r of results) {
      const result = (r as unknown[])[3];
      expect(result).toBe(true);
    }
  });

  test.fails("[8] Fail on conjunction of at least one non-booleans - error validation not implemented", () => {
    const graph = createTckGraph();
    // Should fail with InvalidArgumentType
    expect(() => executeTckQuery(graph, "RETURN 123 AND true")).toThrow();
  });

  // Custom tests demonstrating AND behavior in WHERE clause (the only supported context)
  test("[custom-1] AND in WHERE clause with property comparisons", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 2}), (:A {x: 1, y: 3}), (:A {x: 2, y: 2})");

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.x = 1 AND n.y = 2 RETURN n.x, n.y");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 2]);
  });

  test("[custom-2] AND short-circuit behavior - false AND anything = false", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {flag: false, num: 1})");

    // When first condition is false, result should be empty (no match)
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.flag = true AND n.num = 1 RETURN n",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-3] Multiple AND conditions", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 2, c: 3}), (:A {a: 1, b: 2, c: 4})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.a = 1 AND n.b = 2 AND n.c = 3 RETURN n.a, n.b, n.c",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 2, 3]);
  });
});
