/**
 * TCK Union2 - Union All
 * Translated from tmp/tck/features/clauses/union/Union2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel } from "../tckHelpers.js";

describe("Union2 - Union All", () => {
  test("[1] Two elements, both unique, not distinct", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1 AS x UNION ALL RETURN 2 AS x");
    // UNION ALL keeps all rows
    expect(results).toHaveLength(2);
    expect(results).toContainEqual(1);
    expect(results).toContainEqual(2);
  });

  test("[2] Three elements, two unique, not distinct", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN 2 AS x UNION ALL RETURN 1 AS x UNION ALL RETURN 2 AS x",
    );
    // UNION ALL keeps duplicates - 2 appears twice
    expect(results).toHaveLength(3);
    expect(results.filter((r) => r === 2)).toHaveLength(2);
    expect(results.filter((r) => r === 1)).toHaveLength(1);
  });

  test("[3] Two single-column inputs, one with duplicates, not distinct", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [2, 1, 2, 3] AS x RETURN x
       UNION ALL
       UNWIND [3, 4] AS x RETURN x`,
    );
    // UNION ALL keeps all: [2, 1, 2, 3, 3, 4]
    expect(results).toHaveLength(6);
    // Results are arrays for single-column RETURN
    const values = results.flat();
    expect(values.filter((v) => v === 2)).toHaveLength(2);
    expect(values.filter((v) => v === 3)).toHaveLength(2);
    expect(values.filter((v) => v === 1)).toHaveLength(1);
    expect(values.filter((v) => v === 4)).toHaveLength(1);
  });

  test("[4] Should be able to create text output from union all queries", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B)");

    const results = executeTckQuery(
      graph,
      `MATCH (a:A)
       RETURN a AS a
       UNION ALL
       MATCH (b:B)
       RETURN b AS a`,
    );

    // Should have two nodes with different labels
    expect(results).toHaveLength(2);
    // Single RETURN item is wrapped in array, so results[i] = [node]
    const labels = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getLabel(node);
    });
    expect(labels).toContain("A");
    expect(labels).toContain("B");
  });

  test.fails("[5] Failing when UNION ALL has different columns - semantic validation not implemented", () => {
    // Original TCK:
    // Query: RETURN 1 AS a UNION ALL RETURN 2 AS b
    // Should raise SyntaxError: DifferentColumnsInUnion
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "RETURN 1 AS a UNION ALL RETURN 2 AS b")).toThrow();
  });

  // Custom tests for supported UNION ALL scenarios
  test("[custom-1] UNION ALL keeps duplicate results", () => {
    const graph = createTckGraph();
    // Create nodes with same property values
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'x'}), (:A {name: 'y'}), (:B {name: 'x'}), (:B {name: 'z'})",
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A)
       RETURN a.name AS name
       UNION ALL
       MATCH (b:B)
       RETURN b.name AS name`,
    );

    // UNION ALL keeps duplicates - 'x' appears in both, should appear twice
    expect(results).toHaveLength(4);
    expect(results.filter((r) => r === "x")).toHaveLength(2);
    expect(results).toContainEqual("y");
    expect(results).toContainEqual("z");
  });

  test("[custom-2] UNION ALL with three queries", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1}), (:B {num: 1}), (:C {num: 1})");

    const results = executeTckQuery(
      graph,
      `MATCH (a:A)
       RETURN a.num AS num
       UNION ALL
       MATCH (b:B)
       RETURN b.num AS num
       UNION ALL
       MATCH (c:C)
       RETURN c.num AS num`,
    );

    // All three return 1, UNION ALL keeps all
    expect(results).toHaveLength(3);
    expect(results.filter((r) => r === 1)).toHaveLength(3);
  });

  test("[custom-3] UNION ALL with overlapping WHERE clauses", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3}), (:A {num: 4})");

    const results = executeTckQuery(
      graph,
      `MATCH (a:A)
       WHERE a.num <= 2
       RETURN a.num AS num
       UNION ALL
       MATCH (a:A)
       WHERE a.num >= 2
       RETURN a.num AS num`,
    );

    // First query: 1, 2
    // Second query: 2, 3, 4
    // UNION ALL keeps all including duplicate 2
    expect(results).toHaveLength(5);
    expect(results.filter((r) => r === 2)).toHaveLength(2);
  });
});
