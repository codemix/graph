/**
 * TCK Union1 - Union
 * Translated from tmp/tck/features/clauses/union/Union1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel } from "../tckHelpers.js";

describe("Union1 - Union", () => {
  test("[1] Two elements, both unique, distinct", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1 AS x UNION RETURN 2 AS x");
    // UNION removes duplicates but both 1 and 2 are unique
    expect(results).toHaveLength(2);
    expect(results).toContainEqual(1);
    expect(results).toContainEqual(2);
  });

  test("[2] Three elements, two unique, distinct", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 2 AS x UNION RETURN 1 AS x UNION RETURN 2 AS x");
    // UNION removes duplicates - 2 appears twice but should appear once
    expect(results).toHaveLength(2);
    expect(results).toContainEqual(1);
    expect(results).toContainEqual(2);
  });

  test("[3] Two single-column inputs, one with duplicates, distinct", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [2, 1, 2, 3] AS x RETURN x
       UNION
       UNWIND [3, 4] AS x RETURN x`,
    );
    // Input has [2, 1, 2, 3] and [3, 4], UNION removes duplicates to give [1, 2, 3, 4]
    expect(results).toHaveLength(4);
    // Results from UNWIND are wrapped in arrays
    const values = results.flat();
    expect(values).toContainEqual(1);
    expect(values).toContainEqual(2);
    expect(values).toContainEqual(3);
    expect(values).toContainEqual(4);
  });

  test("[4] Should be able to create text output from union queries", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B)");

    const results = executeTckQuery(
      graph,
      `MATCH (a:A)
       RETURN a AS a
       UNION
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

  test.fails("[5] Failing when UNION has different columns - semantic validation not implemented", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "RETURN 1 AS a UNION RETURN 2 AS b")).toThrow();
  });

  // Custom tests for supported UNION scenarios
  test("[custom-1] UNION removes duplicate results", () => {
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
       UNION
       MATCH (b:B)
       RETURN b.name AS name`,
    );

    // UNION removes duplicates - 'x' appears in both but should appear once
    expect(results).toHaveLength(3);
    expect(results).toContainEqual("x");
    expect(results).toContainEqual("y");
    expect(results).toContainEqual("z");
  });

  test("[custom-2] UNION with three queries", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1}), (:B {num: 2}), (:C {num: 3})");

    const results = executeTckQuery(
      graph,
      `MATCH (a:A)
       RETURN a.num AS num
       UNION
       MATCH (b:B)
       RETURN b.num AS num
       UNION
       MATCH (c:C)
       RETURN c.num AS num`,
    );

    expect(results).toHaveLength(3);
    expect(results).toContainEqual(1);
    expect(results).toContainEqual(2);
    expect(results).toContainEqual(3);
  });

  test("[custom-3] UNION with WHERE clauses", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3}), (:A {num: 4})");

    const results = executeTckQuery(
      graph,
      `MATCH (a:A)
       WHERE a.num < 2
       RETURN a.num AS num
       UNION
       MATCH (a:A)
       WHERE a.num > 3
       RETURN a.num AS num`,
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual(1);
    expect(results).toContainEqual(4);
  });
});
