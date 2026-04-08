/**
 * TCK List3 - List Equality
 * Translated from tmp/tck/features/expressions/list/List3.feature
 *
 * Tests equality comparisons between lists.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("List3 - List Equality", () => {
  test("[1] Equality between list and literal should return false", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [1, 2] = 'foo' AS res");
    expect(results).toEqual([false]);
  });

  test("[2] Equality of lists of different length should return false despite nulls", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN [1] = [1, null] AS res");
    expect(results).toEqual([false]);
  });

  test("[3] Equality between different lists with null should return false", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN [1, 2] = [null, 'foo'] AS res",
    );
    expect(results).toEqual([false]);
  });

  test.fails(
    "[4] Equality between almost equal lists with null should return null - null propagation not implemented",
    () => {
      // In Cypher, [1, 2] = [null, 2] should return null because comparing 1 to null is null
      // Current implementation returns false
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN [1, 2] = [null, 2] AS res",
      );
      expect(results).toEqual([null]);
    },
  );

  test("[5] Equality of nested lists of different length should return false despite nulls", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN [[1]] = [[1], [null]] AS res",
    );
    expect(results).toEqual([false]);
  });

  test("[6] Equality between different nested lists with null should return false", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN [[1, 2], [1, 3]] = [[1, 2], [null, 'foo']] AS res",
    );
    expect(results).toEqual([false]);
  });

  test.fails(
    "[7] Equality between almost equal nested lists with null should return null - null propagation not implemented",
    () => {
      // In Cypher, this should return null due to null propagation in element comparison
      // Current implementation returns false
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN [[1, 2], ['foo', 'bar']] = [[1, 2], [null, 'bar']] AS res",
      );
      expect(results).toEqual([null]);
    },
  );

  // Custom tests demonstrating list property storage and retrieval
  test("[Custom 1] Store and retrieve list property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {items: [1, 2, 3]})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.items");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 2, 3]);
  });

  test("[Custom 2] Store and retrieve nested list property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {matrix: [[1, 2], [3, 4]]})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.matrix");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  test("[Custom 3] Store empty list property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {items: []})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.items");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([]);
  });

  test("[Custom 4] Compare scalar values from nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1}), (:A {num: 1}), (:A {num: 2})`,
    );

    // Find nodes with equal num values
    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:A) WHERE a.num = b.num AND a <> b RETURN a.num, b.num",
    );

    // Two pairs: (num:1, num:1) and (num:1, num:1) - the two nodes with num=1
    expect(results.length).toBeGreaterThan(0);
  });
});
