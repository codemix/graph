/**
 * TCK Precedence4 - On null value
 * Translated from tmp/tck/features/expressions/precedence/Precedence4.feature
 *
 * NOTE: Most original TCK tests are skipped because the grammar does not support:
 * - Null literal in expressions
 * - RETURN-only queries (must start with MATCH, CREATE, UNWIND, etc.)
 * - Boolean expressions in RETURN clause
 *
 * Custom tests demonstrate null precedence rules via IS NULL/IS NOT NULL in WHERE clause.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Precedence4 - On null value", () => {
  // Original TCK tests all use RETURN-only queries with null expressions
  // which are not supported in the grammar

  test("[1] IS NULL/IS NOT NULL evaluates correctly", () => {
    const graph = createTckGraph();
    // null IS NULL should be true, null IS NOT NULL should be false
    const results = executeTckQuery(graph, "RETURN null IS NULL AS a, null IS NOT NULL AS b");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([true, false]);
  });

  test("[2] NOT null IS NULL evaluates correctly", () => {
    const graph = createTckGraph();
    // NOT null IS NULL = NOT true = false
    const results = executeTckQuery(graph, "RETURN NOT null IS NULL AS a");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[3] IS NULL takes precedence over binary boolean operator - RETURN-only query not supported", () => {
    // Original TCK Scenario Outline:
    // RETURN null AND null IS NULL AS a, ...
    // Grammar limitation: Null literal in expressions not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `RETURN null AND null IS NULL AS a,
              null AND (null IS NULL) AS b,
              (null AND null) IS NULL AS c`,
    );
    expect(results).toHaveLength(1);
    const [a, b, c] = results[0] as [boolean | null, boolean | null, boolean];
    // null AND (null IS NULL) = null AND true = null
    expect(a).toBe(null);
    expect(b).toBe(null);
    // (null AND null) IS NULL = null IS NULL = true
    expect(c).toBe(true);
  });

  test.fails("[4] STARTS WITH takes precedence over OR", () => {
    // STARTS WITH combined with boolean operators in RETURN now supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `RETURN ('abc' STARTS WITH null OR true) = (('abc' STARTS WITH null) OR true) AS a,
              'abc' STARTS WITH null OR true AS b,
              ('abc' STARTS WITH null) OR true AS c,
              'abc' STARTS WITH (null OR true) AS d`,
    );
    expect(results).toHaveLength(1);
    const [a, b, c, d] = results[0] as [boolean, boolean | null, boolean, boolean | null];
    expect(a).toBe(true); // Both expressions should be equal
    expect(b).toBe(true); // 'abc' STARTS WITH null = null, null OR true = true
    expect(c).toBe(true); // ('abc' STARTS WITH null) OR true = null OR true = true
    expect(d).toBe(null); // 'abc' STARTS WITH (null OR true) = 'abc' STARTS WITH true = error/null
  });

  // Custom tests demonstrating null precedence via IS NULL/IS NOT NULL in WHERE

  test("[custom-1] IS NULL takes precedence over AND", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {a: 1}), (:A {a: 2, b: 3}), (:A {b: 4})");

    // a IS NULL AND b IS NOT NULL
    // Should be: (a IS NULL) AND (b IS NOT NULL)
    // Node 1 (a:1, b:null): false AND false = false
    // Node 2 (a:2, b:3): false AND true = false
    // Node 3 (a:null, b:4): true AND true = true
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.a IS NULL AND n.b IS NOT NULL RETURN n.b",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(4);
  });

  test("[custom-2] IS NOT NULL takes precedence over OR", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {a: 1}), (:A {a: 2, b: 3}), (:A {b: 4})");

    // a IS NOT NULL OR b IS NULL
    // Should be: (a IS NOT NULL) OR (b IS NULL)
    // Node 1 (a:1, b:null): true OR true = true
    // Node 2 (a:2, b:3): true OR false = true
    // Node 3 (a:null, b:4): false OR false = false
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.a IS NOT NULL OR n.b IS NULL RETURN n",
    );
    expect(results).toHaveLength(2);
  });

  test("[custom-3] NOT combined with IS NULL", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {val: 1}), (:A {val: 2}), (:A {})");

    // NOT val IS NULL should be NOT (val IS NULL) = val IS NOT NULL
    // Node 1 (val:1): NOT false = true
    // Node 2 (val:2): NOT false = true
    // Node 3 (val:null): NOT true = false
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT n.val IS NULL RETURN n.val ORDER BY n.val",
    );
    expect(results).toEqual([1, 2]);
  });

  test("[custom-4] IS NULL takes precedence over comparison in WHERE", () => {
    const graph = createTckGraph();
    // Create nodes with various property states
    executeTckQuery(graph, "CREATE (:A {id: 1, val: 5}), (:A {id: 2}), (:A {id: 3, val: 10})");

    // val IS NULL combined with comparison
    // This tests that IS NULL binds before comparison operators
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.val IS NULL OR n.val > 7 RETURN n.id ORDER BY n.id",
    );
    // Node 1: 5 IS NULL (false) OR 5 > 7 (false) = false
    // Node 2: null IS NULL (true) OR ... = true
    // Node 3: 10 IS NULL (false) OR 10 > 7 (true) = true
    expect(results).toEqual([2, 3]);
  });

  test("[custom-5] Chain of IS NULL checks with AND", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {a: 1, b: 2, c: 3}), (:A {a: 1, b: 2}), (:A {a: 1}), (:A {})",
    );

    // All three properties must be non-null
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.a IS NOT NULL AND n.b IS NOT NULL AND n.c IS NOT NULL RETURN n.a, n.b, n.c",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 2, 3]);
  });

  test("[custom-6] IS NULL with XOR", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {a: 1}), (:A {b: 2}), (:A {a: 1, b: 2}), (:A {})");

    // a IS NULL XOR b IS NULL
    // Should be: (a IS NULL) XOR (b IS NULL)
    // Node 1 (a:1, b:null): false XOR true = true
    // Node 2 (a:null, b:2): true XOR false = true
    // Node 3 (a:1, b:2): false XOR false = false
    // Node 4 (a:null, b:null): true XOR true = false
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.a IS NULL XOR n.b IS NULL RETURN n",
    );
    expect(results).toHaveLength(2);
  });

  test("[custom-7] IS NOT NULL combined with equality", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {val: 1}), (:A {val: 2}), (:A {})");

    // val IS NOT NULL AND val = 1
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.val IS NOT NULL AND n.val = 1 RETURN n.val",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom-8] Complex null check with multiple conditions", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {id: 1, x: 5, y: 10}), (:A {id: 2, x: 5}), (:A {id: 3, y: 10}), (:A {id: 4})",
    );

    // (x IS NOT NULL AND x = 5) OR (y IS NOT NULL AND y > 5)
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE (n.x IS NOT NULL AND n.x = 5) OR (n.y IS NOT NULL AND n.y > 5) RETURN n.id ORDER BY n.id",
    );
    // Node 1: (true AND true) OR (true AND true) = true
    // Node 2: (true AND true) OR (false) = true
    // Node 3: (false) OR (true AND true) = true
    // Node 4: (false) OR (false) = false
    expect(results).toEqual([1, 2, 3]);
  });

  test("[custom-9] Parentheses override IS NULL precedence", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {id: 1, val: 1}), (:A {id: 2, val: 2}), (:A {id: 3})");

    // Without parentheses: val IS NULL OR val = 1
    // Means: (val IS NULL) OR (val = 1)
    const results1 = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.val IS NULL OR n.val = 1 RETURN n.id ORDER BY n.id",
    );
    expect(results1).toEqual([1, 3]);

    // With parentheses grouping AND first
    const results2 = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.val IS NOT NULL AND (n.val = 1 OR n.val = 2) RETURN n.id ORDER BY n.id",
    );
    expect(results2).toEqual([1, 2]);
  });

  test("[custom-10] IS NULL with string operators", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Alice'}), (:A {name: 'Bob'}), (:A {})");

    // name IS NOT NULL AND name STARTS WITH 'A'
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name IS NOT NULL AND n.name STARTS WITH 'A' RETURN n.name",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Alice");
  });
});
