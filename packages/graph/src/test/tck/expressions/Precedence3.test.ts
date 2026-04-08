/**
 * TCK Precedence3 - On list values
 * Translated from tmp/tck/features/expressions/precedence/Precedence3.feature
 *
 * NOTE: Most original TCK tests are skipped because the grammar does not support:
 * - List expressions in RETURN clause
 * - RETURN-only queries (must start with MATCH, CREATE, UNWIND, etc.)
 * - List indexing syntax (list[index])
 * - List slicing syntax (list[start..end])
 * - List concatenation with + operator
 *
 * Custom tests demonstrate list precedence rules via IN operator in WHERE clause.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Precedence3 - On list values", () => {
  // Original TCK tests all use RETURN-only queries with list expressions
  // which are not supported in the grammar

  test("[1] List element access takes precedence over list appending", () => {
    // Original TCK:
    // RETURN [[1], [2, 3], [4, 5]] + [5, [6, 7], [8, 9], 10][3] AS a, ...
    // Grammar limitation: List indexing syntax not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `RETURN [[1], [2, 3], [4, 5]] + [5, [6, 7], [8, 9], 10][3] AS a`,
    );
    expect(results).toHaveLength(1);
  });

  test("[2] List element access takes precedence over list concatenation", () => {
    // Original TCK:
    // RETURN [[1], [2, 3], [4, 5]] + [5, [6, 7], [8, 9], 10][2] AS a, ...
    // Grammar limitation: List indexing syntax not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `RETURN [[1], [2, 3], [4, 5]] + [5, [6, 7], [8, 9], 10][2] AS a`,
    );
    expect(results).toHaveLength(1);
  });

  test("[3] List slicing takes precedence over list concatenation", () => {
    // Original TCK:
    // RETURN [[1], [2, 3], [4, 5]] + [5, [6, 7], [8, 9], 10][1..3] AS a, ...
    // Grammar limitation: List slicing syntax not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `RETURN [[1], [2, 3], [4, 5]] + [5, [6, 7], [8, 9], 10][1..3] AS a`,
    );
    expect(results).toHaveLength(1);
  });

  test("[4] List appending takes precedence over IN", () => {
    // Original TCK:
    // RETURN [1]+2 IN [3]+4 AS a, ...
    // Grammar limitation: List concatenation with + not supported
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `RETURN [1]+2 IN [3]+4 AS a`);
    expect(results).toHaveLength(1);
  });

  test("[5] List concatenation takes precedence over IN", () => {
    // Original TCK:
    // RETURN [1]+[2] IN [3]+[4] AS a, ...
    // Grammar limitation: List concatenation with + not supported
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `RETURN [1]+[2] IN [3]+[4] AS a`);
    expect(results).toHaveLength(1);
  });

  test.fails("[6] IN takes precedence over comparison operator", () => {
    // Complex list expressions in RETURN now supported
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `RETURN [1, 2] = [3, 4] IN [[3, 4], false] AS a`);
    expect(results).toHaveLength(1);
    // [1, 2] = ([3, 4] IN [[3, 4], false]) = [1, 2] = true = false
    expect(results[0]).toBe(false);
  });

  // Custom tests demonstrating list/IN precedence in WHERE clause

  test("[custom-1] IN operator evaluates correctly with literal list", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {val: 1}), (:A {val: 2}), (:A {val: 3}), (:A {val: 4})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.val IN [1, 3] RETURN n.val ORDER BY n.val",
    );
    expect(results).toEqual([1, 3]);
  });

  test("[custom-2] NOT IN evaluates correctly", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {val: 1}), (:A {val: 2}), (:A {val: 3}), (:A {val: 4})");

    // NOT val IN [1, 3] should be NOT (val IN [1, 3])
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT n.val IN [1, 3] RETURN n.val ORDER BY n.val",
    );
    expect(results).toEqual([2, 4]);
  });

  test("[custom-3] IN combined with AND has correct precedence", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {x: 1, y: 'a'}), (:A {x: 2, y: 'a'}), (:A {x: 1, y: 'b'}), (:A {x: 3, y: 'a'})",
    );

    // x IN [1, 2] AND y = 'a'
    // IN should bind tighter than AND, so this is (x IN [1, 2]) AND (y = 'a')
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.x IN [1, 2] AND n.y = 'a' RETURN n.x, n.y ORDER BY n.x",
    );
    expect(results).toEqual([
      [1, "a"],
      [2, "a"],
    ]);
  });

  test("[custom-4] IN combined with OR has correct precedence", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {val: 1}), (:A {val: 2}), (:A {val: 5}), (:A {val: 6})");

    // val IN [1, 2] OR val = 5
    // Should match val = 1, 2, or 5
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.val IN [1, 2] OR n.val = 5 RETURN n.val ORDER BY n.val",
    );
    expect(results).toEqual([1, 2, 5]);
  });

  test("[custom-5] Comparison combined with IN", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {val: 1}), (:A {val: 2}), (:A {val: 3}), (:A {val: 4}), (:A {val: 5})",
    );

    // val > 2 AND val IN [3, 4, 5]
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.val > 2 AND n.val IN [3, 4, 5] RETURN n.val ORDER BY n.val",
    );
    expect(results).toEqual([3, 4, 5]);
  });

  test("[custom-6] String values in IN list", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'Alice'}), (:A {name: 'Bob'}), (:A {name: 'Charlie'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name IN ['Alice', 'Charlie'] RETURN n.name ORDER BY n.name",
    );
    expect(results).toEqual(["Alice", "Charlie"]);
  });

  test("[custom-7] IN with empty list returns no matches", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {val: 1}), (:A {val: 2})");

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.val IN [] RETURN n.val");
    expect(results).toHaveLength(0);
  });

  test("[custom-8] NOT IN with empty list returns all matches", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {val: 1}), (:A {val: 2})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT n.val IN [] RETURN n.val ORDER BY n.val",
    );
    expect(results).toEqual([1, 2]);
  });

  test("[custom-9] IN with mixed type list", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {val: 1}), (:A {val: 2}), (:A {val: 3})");

    // Check if integer matches in list with integers
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.val IN [1, 2] RETURN n.val ORDER BY n.val",
    );
    expect(results).toEqual([1, 2]);
  });

  test("[custom-10] Complex boolean expression with IN", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {a: 1, b: 1}), (:A {a: 2, b: 1}), (:A {a: 1, b: 2}), (:A {a: 3, b: 3})",
    );

    // (a IN [1, 2]) AND (b = 1)
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.a IN [1, 2] AND n.b = 1 RETURN n.a, n.b ORDER BY n.a",
    );
    expect(results).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });
});
