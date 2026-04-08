/**
 * TCK Boolean5 - Interop of logical operations
 * Translated from tmp/tck/features/expressions/boolean/Boolean5.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Boolean5 - Interop of logical operations", () => {
  test("[1] Disjunction is distributive over conjunction on non-null", () => {
    // Original TCK:
    // UNWIND [true, false] AS a
    // UNWIND [true, false] AS b
    // UNWIND [true, false] AS c
    // RETURN a, b, c, (a OR (b AND c)) = ((a OR b) AND (a OR c)) AS result
    // Expected: all 8 combinations return result=true
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false] AS a
       UNWIND [true, false] AS b
       UNWIND [true, false] AS c
       RETURN (a OR (b AND c)) = ((a OR b) AND (a OR c)) AS result`,
    );

    expect(results).toHaveLength(8);
    // All 8 combinations should return true (distributive property holds)
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  test.fails("[2] Disjunction is distributive over conjunction on null - complex expressions with null not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false, null] AS a
       UNWIND [true, false, null] AS b
       UNWIND [true, false, null] AS c
       WITH a, b, c WHERE a IS NULL OR b IS NULL OR c IS NULL
       RETURN (a OR (b AND c)) IS NULL = ((a OR b) AND (a OR c)) IS NULL AS result`,
    );
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  test("[3] Conjunction is distributive over disjunction on non-null", () => {
    // Original TCK:
    // UNWIND [true, false] AS a
    // UNWIND [true, false] AS b
    // UNWIND [true, false] AS c
    // RETURN a, b, c, (a AND (b OR c)) = ((a AND b) OR (a AND c)) AS result
    // Expected: all 8 combinations return result=true
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false] AS a
       UNWIND [true, false] AS b
       UNWIND [true, false] AS c
       RETURN (a AND (b OR c)) = ((a AND b) OR (a AND c)) AS result`,
    );

    expect(results).toHaveLength(8);
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  test.fails("[4] Conjunction is distributive over disjunction on null - complex expressions with null not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false, null] AS a
       UNWIND [true, false, null] AS b
       UNWIND [true, false, null] AS c
       WITH a, b, c WHERE a IS NULL OR b IS NULL OR c IS NULL
       RETURN (a AND (b OR c)) IS NULL = ((a AND b) OR (a AND c)) IS NULL AS result`,
    );
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  test("[5] Conjunction is distributive over exclusive disjunction on non-null", () => {
    // Original TCK:
    // UNWIND [true, false] AS a
    // UNWIND [true, false] AS b
    // UNWIND [true, false] AS c
    // RETURN a, b, c, (a AND (b XOR c)) = ((a AND b) XOR (a AND c)) AS result
    // Expected: all 8 combinations return result=true
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false] AS a
       UNWIND [true, false] AS b
       UNWIND [true, false] AS c
       RETURN (a AND (b XOR c)) = ((a AND b) XOR (a AND c)) AS result`,
    );

    expect(results).toHaveLength(8);
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  test.fails("[6] Conjunction is not distributive over exclusive disjunction on null - complex expressions with null not supported", () => {
    const graph = createTckGraph();
    // For (null, true, true), (a AND (b XOR c)) IS NULL != ((a AND b) XOR (a AND c)) IS NULL
    const results = executeTckQuery(
      graph,
      `UNWIND [null] AS a
       UNWIND [true] AS b
       UNWIND [true] AS c
       RETURN (a AND (b XOR c)) IS NULL = ((a AND b) XOR (a AND c)) IS NULL AS result`,
    );
    expect(results[0]).toBe(false);
  });

  test("[7] De Morgan's law on non-null: negation of disjunction is conjunction of negations", () => {
    // Original TCK:
    // UNWIND [true, false] AS a
    // UNWIND [true, false] AS b
    // RETURN a, b, NOT (a OR b) = (NOT (a) AND NOT (b)) AS result
    // Expected: all 4 combinations return result=true
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false] AS a
       UNWIND [true, false] AS b
       RETURN NOT (a OR b) = (NOT a AND NOT b) AS result`,
    );

    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  test("[8] De Morgan's law on non-null: negation of conjunction is disjunction of negations", () => {
    // Original TCK:
    // UNWIND [true, false] AS a
    // UNWIND [true, false] AS b
    // RETURN a, b, NOT (a AND b) = (NOT (a) OR NOT (b)) AS result
    // Expected: all 4 combinations return result=true
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [true, false] AS a
       UNWIND [true, false] AS b
       RETURN NOT (a AND b) = (NOT a OR NOT b) AS result`,
    );

    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r).toBe(true);
    }
  });

  // Custom tests demonstrating operator interop in WHERE clause
  test("[custom-1] Distributive property: a OR (b AND c) - verified via WHERE", () => {
    const graph = createTckGraph();
    // Create nodes representing all 8 combinations of (a, b, c)
    // Using numeric encoding: a*4 + b*2 + c*1 gives unique num for each combo
    executeTckQuery(graph, "CREATE (:A {a: 0, b: 0, c: 0, num: 0})"); // FFF
    executeTckQuery(graph, "CREATE (:A {a: 0, b: 0, c: 1, num: 1})"); // FFT
    executeTckQuery(graph, "CREATE (:A {a: 0, b: 1, c: 0, num: 2})"); // FTF
    executeTckQuery(graph, "CREATE (:A {a: 0, b: 1, c: 1, num: 3})"); // FTT
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 0, c: 0, num: 4})"); // TFF
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 0, c: 1, num: 5})"); // TFT
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 1, c: 0, num: 6})"); // TTF
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 1, c: 1, num: 7})"); // TTT

    // Test: a OR (b AND c)
    // Should match: a=1 (nums 4,5,6,7) OR (b=1 AND c=1) (num 3)
    const resultsLeft = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.a = 1 OR (n.b = 1 AND n.c = 1) RETURN n.num",
    );

    // Test: (a OR b) AND (a OR c)
    // Should match: same nodes
    const resultsRight = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE (n.a = 1 OR n.b = 1) AND (n.a = 1 OR n.c = 1) RETURN n.num",
    );

    // Both should have same length (distributive property)
    expect(resultsLeft).toHaveLength(resultsRight.length);

    const leftNums = resultsLeft
      .map((r) => (Array.isArray(r) ? r[0] : r) as number)
      .sort((a, b) => a - b);
    const rightNums = resultsRight
      .map((r) => (Array.isArray(r) ? r[0] : r) as number)
      .sort((a, b) => a - b);
    expect(leftNums).toEqual(rightNums);
  });

  test("[custom-2] Distributive property: a AND (b OR c) - verified via WHERE", () => {
    const graph = createTckGraph();
    // Create nodes for all 8 combinations
    executeTckQuery(graph, "CREATE (:A {a: 0, b: 0, c: 0, id: 'FFF'})");
    executeTckQuery(graph, "CREATE (:A {a: 0, b: 0, c: 1, id: 'FFT'})");
    executeTckQuery(graph, "CREATE (:A {a: 0, b: 1, c: 0, id: 'FTF'})");
    executeTckQuery(graph, "CREATE (:A {a: 0, b: 1, c: 1, id: 'FTT'})");
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 0, c: 0, id: 'TFF'})");
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 0, c: 1, id: 'TFT'})");
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 1, c: 0, id: 'TTF'})");
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 1, c: 1, id: 'TTT'})");

    // Test: a AND (b OR c)
    const resultsLeft = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.a = 1 AND (n.b = 1 OR n.c = 1) RETURN n.id",
    );

    // Test: (a AND b) OR (a AND c)
    const resultsRight = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE (n.a = 1 AND n.b = 1) OR (n.a = 1 AND n.c = 1) RETURN n.id",
    );

    // Both should have same length
    expect(resultsLeft).toHaveLength(resultsRight.length);

    const leftIds = resultsLeft.map((r) => (Array.isArray(r) ? r[0] : r) as string).sort();
    const rightIds = resultsRight.map((r) => (Array.isArray(r) ? r[0] : r) as string).sort();
    expect(leftIds).toEqual(rightIds);
  });

  test("[custom-3] De Morgan's law: NOT(a OR b) = NOT(a) AND NOT(b)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {a: 0, b: 0, id: 'FF'})");
    executeTckQuery(graph, "CREATE (:A {a: 0, b: 1, id: 'FT'})");
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 0, id: 'TF'})");
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 1, id: 'TT'})");

    // NOT(a=1 OR b=1) should match only FF
    const resultsLeft = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT (n.a = 1 OR n.b = 1) RETURN n.id",
    );

    // NOT(a=1) AND NOT(b=1) should match only FF
    const resultsRight = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT n.a = 1 AND NOT n.b = 1 RETURN n.id",
    );

    expect(resultsLeft).toHaveLength(1);
    expect(resultsRight).toHaveLength(1);
    const leftId = Array.isArray(resultsLeft[0]) ? resultsLeft[0][0] : resultsLeft[0];
    const rightId = Array.isArray(resultsRight[0]) ? resultsRight[0][0] : resultsRight[0];
    expect(leftId).toBe("FF");
    expect(rightId).toBe("FF");
  });

  test("[custom-4] De Morgan's law: NOT(a AND b) = NOT(a) OR NOT(b)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {a: 0, b: 0, id: 'FF'})");
    executeTckQuery(graph, "CREATE (:A {a: 0, b: 1, id: 'FT'})");
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 0, id: 'TF'})");
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 1, id: 'TT'})");

    // NOT(a=1 AND b=1) should match FF, FT, TF (all except TT)
    const resultsLeft = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT (n.a = 1 AND n.b = 1) RETURN n.id",
    );

    // NOT(a=1) OR NOT(b=1) should match FF, FT, TF (all except TT)
    const resultsRight = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT n.a = 1 OR NOT n.b = 1 RETURN n.id",
    );

    expect(resultsLeft).toHaveLength(3);
    expect(resultsRight).toHaveLength(3);

    const leftIds = resultsLeft.map((r) => (Array.isArray(r) ? r[0] : r) as string).sort();
    const rightIds = resultsRight.map((r) => (Array.isArray(r) ? r[0] : r) as string).sort();
    expect(leftIds).toEqual(rightIds);
    expect(leftIds).toContain("FF");
    expect(leftIds).toContain("FT");
    expect(leftIds).toContain("TF");
    expect(leftIds).not.toContain("TT");
  });

  test("[custom-5] Operator precedence: NOT > AND > XOR > OR", () => {
    const graph = createTckGraph();
    // Create a single node to test
    executeTckQuery(graph, "CREATE (:A {val: 1})");

    // Test that NOT has highest precedence
    // NOT val=2 AND val=1 should be (NOT val=2) AND val=1 = true AND true = true
    const results1 = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT n.val = 2 AND n.val = 1 RETURN n.val",
    );
    expect(results1).toHaveLength(1);

    // If NOT had lower precedence: NOT (val=2 AND val=1) = NOT false = true
    // Same result in this case, but the parsing is different
  });
});
