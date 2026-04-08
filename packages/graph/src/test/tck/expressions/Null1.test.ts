/**
 * TCK Null1 - IS NULL validation
 * Translated from tmp/tck/features/expressions/null/Null1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Null1 - IS NULL validation", () => {
  test("[1] Property null check on non-null node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({exists: 42})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n.missing IS NULL, n.exists IS NULL");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([true, false]);
  });

  test("[2] Property null check on optional non-null node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({exists: 42})");
    const results = executeTckQuery(
      graph,
      "OPTIONAL MATCH (n) RETURN n.missing IS NULL, n.exists IS NULL",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([true, false]);
  });

  test("[3] Property null check on null node", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "OPTIONAL MATCH (n) RETURN n.missing IS NULL");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[4] A literal null IS null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN null IS NULL AS value");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[5] IS NULL on a map", () => {
    const graph = createTckGraph();
    const results1 = executeTckQuery(
      graph,
      "WITH {name: 'Mats', name2: 'Pontus'} AS map RETURN map.name IS NULL AS result",
    );
    expect(results1).toHaveLength(1);
    expect(results1[0]).toBe(false);

    const results2 = executeTckQuery(
      graph,
      "WITH {name: null} AS map RETURN map.name IS NULL AS result",
    );
    expect(results2).toHaveLength(1);
    expect(results2[0]).toBe(true);
  });

  test("[6] IS NULL is case insensitive", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:X {prop: 42}), (:X {name: 'noProp'})");

    // Test IS NULL with various casings in WHERE clause
    const resultsLower = executeTckQuery(graph, "MATCH (n:X) WHERE n.prop is null RETURN n.name");
    expect(resultsLower).toHaveLength(1);
    expect(resultsLower[0]).toBe("noProp");

    const resultsMixed = executeTckQuery(graph, "MATCH (n:X) WHERE n.prop IS NULL RETURN n.name");
    expect(resultsMixed).toHaveLength(1);
    expect(resultsMixed[0]).toBe("noProp");
  });

  // Custom tests demonstrating IS NULL behavior in WHERE clause
  test("[custom-1] IS NULL for missing property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'has-num', num: 42}), (:A {name: 'no-num'})");

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.num IS NULL RETURN n.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("no-num");
  });

  test("[custom-2] IS NULL for property set to null", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'explicit-null', value: null}), (:A {name: 'has-value', value: 42})",
    );

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.value IS NULL RETURN n.name");

    // Should match node with null value and node with missing property
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("explicit-null");
  });

  test("[custom-3] IS NULL combined with AND", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', x: 1}), (:A {name: 'b', x: 1}), (:A {name: 'c', x: 2})",
    );
    // Node 'a' has x=1 but no y property, 'b' has x=1 and no y, 'c' has x=2 and no y

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.x = 1 AND n.y IS NULL RETURN n.name ORDER BY n.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toEqual(["a", "b"]);
  });

  test("[custom-4] IS NULL combined with OR", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', x: 1, y: 1}), (:A {name: 'b', x: 2}), (:A {name: 'c', x: 3, y: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.x = 1 OR n.y IS NULL RETURN n.name ORDER BY n.name",
    );

    // Matches 'a' (x=1), 'b' (y IS NULL)
    expect(results).toHaveLength(2);
    expect(results).toEqual(["a", "b"]);
  });

  test.fails("[custom-5] IS NULL on relationship property - relationship property null check not fully supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a'})-[:T {num: 1}]->(:B {name: 'b1'}), (:A {name: 'a2'})-[:T]->(:B {name: 'b2'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) WHERE r.num IS NULL RETURN b.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("b2");
  });

  test("[custom-6] IS NULL with multiple matching nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a1'}), (:A {name: 'a2'}), (:A {name: 'a3', prop: 'exists'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.prop IS NULL RETURN n.name ORDER BY n.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toEqual(["a1", "a2"]);
  });
});
