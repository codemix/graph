/**
 * TCK Comparison1 - Equality
 * Translated from tmp/tck/features/expressions/comparison/Comparison1.feature
 *
 * Tests for equality (=) and inequality (<>) operators.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Comparison1 - Equality", () => {
  test.fails(
    "[1] Number-typed integer comparison - collect/toInteger/list indexing not supported",
    () => {
      // Original TCK:
      // WITH collect([0, 0.0]) AS numbers
      // UNWIND numbers AS arr
      // WITH arr[0] AS expected
      // MATCH (n) WHERE toInteger(n.id) = expected
      // RETURN n
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A {id: 0}), (:A {id: 1})");
      const results = executeTckQuery(
        graph,
        `WITH collect([0, 0.0]) AS numbers
       UNWIND numbers AS arr
       WITH arr[0] AS expected
       MATCH (n:A) WHERE toInteger(n.id) = expected
       RETURN n`,
      );
      expect(results).toHaveLength(1);
    },
  );

  test.fails(
    "[2] Number-typed float comparison - collect/list indexing not supported",
    () => {
      // Original TCK:
      // WITH collect([0.5, 0]) AS numbers
      // UNWIND numbers AS arr
      // WITH arr[0] AS expected
      // MATCH (n) WHERE toInteger(n.id) = expected
      // RETURN n
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A {id: 0}), (:A {id: 1})");
      const results = executeTckQuery(
        graph,
        `WITH collect([0.5, 0]) AS numbers
       UNWIND numbers AS arr
       WITH arr[0] AS expected
       MATCH (n:A) WHERE toInteger(n.id) = expected
       RETURN n`,
      );
      expect(results).toHaveLength(1);
    },
  );

  test.fails(
    "[3] Any-typed string comparison - collect/list indexing not supported",
    () => {
      // Original TCK:
      // WITH collect(['0', 0]) AS things
      // UNWIND things AS arr
      // WITH arr[0] AS expected
      // MATCH (n) WHERE toInteger(n.id) = expected
      // RETURN n
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A {id: 0}), (:A {id: 1})");
      const results = executeTckQuery(
        graph,
        `WITH collect(['0', 0]) AS things
       UNWIND things AS arr
       WITH arr[0] AS expected
       MATCH (n:A) WHERE toInteger(n.id) = expected
       RETURN n`,
      );
      expect(results).toHaveLength(1);
    },
  );

  test("[4] Comparing nodes to nodes - unlabeled nodes and count(*) not supported", () => {
    // Original TCK:
    // CREATE ()
    // MATCH (a) WITH a MATCH (b) WHERE a = b RETURN count(b)
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    const results = executeTckQuery(
      graph,
      "MATCH (a) WITH a MATCH (b) WHERE a = b RETURN count(b)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[5] Comparing relationships to relationships - unlabeled nodes not supported", () => {
    // Original TCK:
    // CREATE ()-[:T]->()
    // MATCH ()-[a]->() WITH a MATCH ()-[b]->() WHERE a = b RETURN count(b)
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:T]->()");
    const results = executeTckQuery(
      graph,
      "MATCH ()-[a]->() WITH a MATCH ()-[b]->() WHERE a = b RETURN count(b)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[6] Comparing lists to lists", () => {
    // Original TCK tests list comparisons
    const graph = createTckGraph();

    // [1, 2] = [1] should be false (different lengths)
    const r1 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN [1, 2] = [1] AS result`,
    );
    expect(r1[0]).toBe(false);

    // [1] <> [2] should be true
    const r2 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN [1] <> [2] AS result`,
    );
    expect(r2[0]).toBe(true);

    // [1] = [1] should be true
    const r3 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN [1] = [1] AS result`,
    );
    expect(r3[0]).toBe(true);

    // [1] <> [1] should be false
    const r4 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN [1] <> [1] AS result`,
    );
    expect(r4[0]).toBe(false);
  });

  test("[7] Comparing maps to maps", () => {
    // Original TCK tests map comparisons
    const graph = createTckGraph();

    // {} = {} should be true
    const r1 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN {} = {} AS result`,
    );
    expect(r1[0]).toBe(true);

    // {k: 1} = {k: 1} should be true
    const r2 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN {k: 1} = {k: 1} AS result`,
    );
    expect(r2[0]).toBe(true);

    // {k: 1} <> {k: 2} should be true
    const r3 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN {k: 1} <> {k: 2} AS result`,
    );
    expect(r3[0]).toBe(true);

    // {a: 1, b: 2} = {a: 1, b: 2} should be true
    const r4 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN {a: 1, b: 2} = {a: 1, b: 2} AS result`,
    );
    expect(r4[0]).toBe(true);
  });

  test("[8] Equality and inequality of NaN", () => {
    // Original TCK tests NaN comparisons
    const graph = createTckGraph();

    // NaN = 1 should be false
    const r1 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN 0.0/0.0 = 1 AS result`,
    );
    expect(r1[0]).toBe(false);

    // NaN <> 1 should be true
    const r2 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN 0.0/0.0 <> 1 AS result`,
    );
    expect(r2[0]).toBe(true);

    // NaN = NaN should be false (per IEEE 754)
    const r3 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN 0.0/0.0 = 0.0/0.0 AS result`,
    );
    expect(r3[0]).toBe(false);

    // NaN <> NaN should be true (per IEEE 754)
    const r4 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN 0.0/0.0 <> 0.0/0.0 AS result`,
    );
    expect(r4[0]).toBe(true);
  });

  test("[9] Equality between strings and numbers", () => {
    // Original TCK Scenario Outline
    const graph = createTckGraph();

    // 1.0 = 1.0 should be true
    const r1 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN 1.0 = 1.0 AS result`,
    );
    expect(r1[0]).toBe(true);

    // 1 = 1.0 should be true (numeric equality)
    const r2 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN 1 = 1.0 AS result`,
    );
    expect(r2[0]).toBe(true);

    // '1.0' = 1.0 should be false (string vs number)
    const r3 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN '1.0' = 1.0 AS result`,
    );
    expect(r3[0]).toBe(false);

    // '1' = 1 should be false (string vs number)
    const r4 = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN '1' = 1 AS result`,
    );
    expect(r4[0]).toBe(false);
  });

  test("[10] Handling inlined equality of large integer - JS number precision limits", () => {
    // Original TCK:
    // CREATE (:TheLabel {id: 4611686018427387905})
    // MATCH (p:TheLabel {id: 4611686018427387905}) RETURN p.id
    // JavaScript limitation: 64-bit integers lose precision beyond 2^53
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:TheLabel {id: 4611686018427387905})");
    const results = executeTckQuery(
      graph,
      "MATCH (p:TheLabel {id: 4611686018427387905}) RETURN p.id",
    );
    expect(results).toHaveLength(1);
    // eslint-disable-next-line no-loss-of-precision
    expect(results[0]).toBe(4611686018427387905);
  });

  test("[11] Handling explicit equality of large integer - JS number precision limits", () => {
    // Original TCK:
    // CREATE (:TheLabel {id: 4611686018427387905})
    // MATCH (p:TheLabel) WHERE p.id = 4611686018427387905 RETURN p.id
    // JavaScript limitation: 64-bit integers lose precision beyond 2^53
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:TheLabel {id: 4611686018427387905})");
    const results = executeTckQuery(
      graph,
      "MATCH (p:TheLabel) WHERE p.id = 4611686018427387905 RETURN p.id",
    );
    expect(results).toHaveLength(1);
    // eslint-disable-next-line no-loss-of-precision
    expect(results[0]).toBe(4611686018427387905);
  });

  test.fails(
    "[12] Handling inlined equality of large integer, non-equal values - JS precision limits",
    () => {
      // Original TCK:
      // CREATE (:TheLabel {id: 4611686018427387905})
      // MATCH (p:TheLabel {id : 4611686018427387900}) RETURN p.id
      // Expected: empty result (different IDs should not match)
      // JavaScript limitation: These large integers may compare equal due to precision loss
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:TheLabel {id: 4611686018427387905})");
      const results = executeTckQuery(
        graph,
        "MATCH (p:TheLabel {id: 4611686018427387900}) RETURN p.id",
      );
      expect(results).toHaveLength(0);
    },
  );

  test.fails(
    "[13] Handling explicit equality of large integer, non-equal values - JS precision limits",
    () => {
      // Original TCK:
      // CREATE (:TheLabel {id: 4611686018427387905})
      // MATCH (p:TheLabel) WHERE p.id = 4611686018427387900 RETURN p.id
      // Expected: empty result (different IDs should not match)
      // JavaScript limitation: Large integers lose precision
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:TheLabel {id: 4611686018427387905})");
      const results = executeTckQuery(
        graph,
        "MATCH (p:TheLabel) WHERE p.id = 4611686018427387900 RETURN p.id",
      );
      expect(results).toHaveLength(0);
    },
  );

  test.fails(
    "[14] Direction of traversed relationship is not significant for path equality - named paths not supported",
    () => {
      // Original TCK:
      // CREATE (n:A)-[:LOOP]->(n)
      // MATCH p1 = (:A)-->() MATCH p2 = (:A)<--() RETURN p1 = p2
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (n:A)-[:LOOP]->(n)");
      const results = executeTckQuery(
        graph,
        "MATCH p1 = (:A)-->() MATCH p2 = (:A)<--() RETURN p1 = p2",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(true);
    },
  );

  test("[15] It is unknown - i.e. null - if a null is equal to a null", () => {
    // Original TCK: RETURN null = null AS value
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN null = null AS value`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test("[16] It is unknown - i.e. null - if a null is not equal to a null", () => {
    // Original TCK: RETURN null <> null AS value
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN null <> null AS value`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test.fails(
    "[17] Failing when comparing to an undefined variable - semantic validation not implemented",
    () => {
      // Original TCK:
      // MATCH (s) WHERE s.name = undefinedVariable AND s.age = 10 RETURN s
      // Expected: SyntaxError: UndefinedVariable
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A {name: 'test', age: 10})");
      expect(() => {
        executeTckQuery(
          graph,
          "MATCH (s:A) WHERE s.name = undefinedVariable AND s.age = 10 RETURN s",
        );
      }).toThrow();
    },
  );

  // Custom tests demonstrating equality operators in WHERE clause
  test("[custom-1] Equality comparison with integers", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num = 2 RETURN n.num",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test("[custom-2] Inequality comparison with integers", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num <> 2 RETURN n.num",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual(1);
    expect(results).toContainEqual(3);
  });

  test("[custom-3] Equality comparison with strings", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'alice'}), (:A {name: 'bob'}), (:A {name: 'charlie'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name = 'bob' RETURN n.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("bob");
  });

  test("[custom-4] Integer and float equality (1 = 1.0)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");

    // 1 = 1.0 should be true
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num = 1.0 RETURN n.num",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom-5] Node identity equality", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a'})-[:T]->(:B {name: 'b'})");

    // Match same node pattern twice - nodes should be equal to themselves
    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:A) WHERE a = b RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test("[custom-6] Node identity inequality", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a'}), (:A {name: 'b'})");

    // Two different nodes should not be equal
    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:A) WHERE a <> b RETURN a.name, b.name",
    );

    // Should get [a,b] and [b,a] pairs
    expect(results).toHaveLength(2);
  });

  test("[custom-7] Equality with safe integer values", () => {
    const graph = createTckGraph();
    // Use a value within JS safe integer range
    executeTckQuery(graph, "CREATE (:TheLabel {id: 9007199254740991})");

    const results = executeTckQuery(
      graph,
      "MATCH (p:TheLabel) WHERE p.id = 9007199254740991 RETURN p.id",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(9007199254740991);
  });

  test("[custom-8] Inequality with different types returns false (not null)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1, str: 'one'})");

    // In WHERE clause, comparing different types
    // The engine filters based on the comparison result
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num = n.str RETURN n",
    );

    // 1 = 'one' should be false, so no results
    expect(results).toHaveLength(0);
  });
});
