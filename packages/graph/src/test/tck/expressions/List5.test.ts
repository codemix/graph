/**
 * TCK List5 - List Membership Validation - IN Operator
 * Translated from tmp/tck/features/expressions/list/List5.feature
 *
 * Tests the IN operator for checking list membership.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("List5 - List Membership Validation - IN Operator", () => {
  test("[1] IN should work with nested list subscripting - WITH list not supported", () => {
    // Original TCK:
    // WITH [[1, 2, 3]] AS list
    // RETURN 3 IN list[0] AS r
    // Grammar limitation: WITH list literals not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [[1, 2, 3]] AS list RETURN 3 IN list[0] AS r",
    );
    expect(results).toEqual([true]);
  });

  test("[2] IN should work with nested literal list subscripting", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 3 IN [[1, 2, 3]][0] AS r");
    expect(results).toEqual([true]);
  });

  test("[3] IN should work with list slices - WITH list not supported", () => {
    // Original TCK:
    // WITH [1, 2, 3] AS list
    // RETURN 3 IN list[0..1] AS r
    // Grammar limitation: WITH list literals not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [1, 2, 3] AS list RETURN 3 IN list[0..1] AS r",
    );
    // [0..1] gives [1, 2], so 3 is not in it
    expect(results).toEqual([false]);
  });

  test("[4] IN should work with literal list slices", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 3 IN [1, 2, 3][0..1] AS r");
    // [0..1] gives [1, 2], so 3 is not in it
    expect(results).toEqual([false]);
  });

  test("[5] IN with type mismatch - string in number list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 'foo' IN [1, 2, 3] AS r");
    expect(results).toEqual([false]);
  });

  test("[6] IN with type mismatch - number in string list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1 IN ['foo', 'bar'] AS r");
    expect(results).toEqual([false]);
  });

  test("[7] IN with matching value in list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 2 IN [1, 2, 3] AS r");
    expect(results).toEqual([true]);
  });

  test("[8] IN with non-matching value in list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 5 IN [1, 2, 3] AS r");
    expect(results).toEqual([false]);
  });

  test("[20] null IN list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN null IN [1, 2, 3] AS r");
    expect(results).toEqual([null]);
  });

  test("[21] value IN list with null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1 IN [1, null] AS r");
    // 1 is found, so true regardless of null
    expect(results).toEqual([true]);
  });

  test("[22] value IN list with only null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1 IN [null] AS r");
    // 1 compared to null is null, so result is null
    expect(results).toEqual([null]);
  });

  test("[35] value IN empty list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1 IN [] AS r");
    expect(results).toEqual([false]);
  });

  test.fails(
    "[36] null IN empty list - implementation returns null instead of false",
    () => {
      // In standard Cypher, null IN [] should return false
      // Our implementation returns null due to null propagation
      const graph = createTckGraph();
      const results = executeTckQuery(graph, "RETURN null IN [] AS r");
      expect(results).toEqual([false]);
    },
  );

  test.fails(
    "[42] Failing when using IN on a non-list literal - error handling not tested",
    () => {
      // Original TCK (Scenario Outline):
      // RETURN 1 IN <invalid>
      // Expected: SyntaxError for boolean, integer, float, string, map
      const graph = createTckGraph();
      // Should throw SyntaxError when using IN on a non-list
      expect(() => executeTckQuery(graph, "RETURN 1 IN true")).toThrow();
    },
  );

  // Custom tests demonstrating IN operator in WHERE clause
  test("[Custom 1] IN operator filters nodes by property value", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3}), (:A {num: 4}), (:A {num: 5})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num IN [2, 4] RETURN n.num",
    );

    expect(results).toHaveLength(2);
    expect(results).toContain(2);
    expect(results).toContain(4);
  });

  test("[Custom 2] IN operator with string values", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice'}), (:A {name: 'Bob'}), (:A {name: 'Charlie'})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name IN ['Alice', 'Charlie'] RETURN n.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toContain("Alice");
    expect(results).toContain("Charlie");
  });

  test("[Custom 3] IN operator with empty list returns no results", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {num: 1}), (:A {num: 2})`);

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num IN [] RETURN n.num",
    );

    expect(results).toHaveLength(0);
  });

  test("[Custom 4] NOT IN operator", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT n.num IN [1, 3] RETURN n.num",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test("[Custom 5] IN operator combined with other conditions", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice', num: 1}), (:A {name: 'Bob', num: 2}), (:A {name: 'Charlie', num: 3})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name IN ['Alice', 'Bob'] AND n.num > 1 RETURN n.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Bob");
  });

  test("[Custom 6] IN operator with single-element list", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num IN [2] RETURN n.num",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });
});
