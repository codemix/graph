/**
 * TCK Null2 - IS NOT NULL validation
 * Translated from tmp/tck/features/expressions/null/Null2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Null2 - IS NOT NULL validation", () => {
  test("[1] Property not null check on non-null node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({exists: 42})");
    const results = executeTckQuery(
      graph,
      "MATCH (n) RETURN n.missing IS NOT NULL, n.exists IS NOT NULL",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([false, true]);
  });

  test("[2] Property not null check on optional non-null node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({exists: 42})");
    const results = executeTckQuery(
      graph,
      "OPTIONAL MATCH (n) RETURN n.missing IS NOT NULL, n.exists IS NOT NULL",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([false, true]);
  });

  test("[3] Property not null check on null node", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "OPTIONAL MATCH (n) RETURN n.missing IS NOT NULL");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[4] A literal null is not IS NOT null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN null IS NOT NULL AS value");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[5] IS NOT NULL on a map", () => {
    const graph = createTckGraph();
    const results1 = executeTckQuery(
      graph,
      "WITH {name: 'Mats', name2: 'Pontus'} AS map RETURN map.name IS NOT NULL AS result",
    );
    expect(results1).toHaveLength(1);
    expect(results1[0]).toBe(true);

    const results2 = executeTckQuery(
      graph,
      "WITH {name: null} AS map RETURN map.name IS NOT NULL AS result",
    );
    expect(results2).toHaveLength(1);
    expect(results2[0]).toBe(false);
  });

  test("[6] IS NOT NULL is case insensitive", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:X {prop: 42, name: 'hasProp'}), (:X {name: 'noProp'})");

    // Test IS NOT NULL with various casings in WHERE clause
    const resultsLower = executeTckQuery(
      graph,
      "MATCH (n:X) WHERE n.prop is not null RETURN n.name",
    );
    expect(resultsLower).toHaveLength(1);
    expect(resultsLower[0]).toBe("hasProp");

    const resultsMixed = executeTckQuery(
      graph,
      "MATCH (n:X) WHERE n.prop IS NOT NULL RETURN n.name",
    );
    expect(resultsMixed).toHaveLength(1);
    expect(resultsMixed[0]).toBe("hasProp");
  });

  // Custom tests demonstrating IS NOT NULL behavior in WHERE clause
  test("[custom-1] IS NOT NULL for existing property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'has-num', num: 42}), (:A {name: 'no-num'})");

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.num IS NOT NULL RETURN n.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("has-num");
  });

  test("[custom-2] IS NOT NULL excludes null values", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'explicit-null', value: null}), (:A {name: 'has-value', value: 42})",
    );

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.value IS NOT NULL RETURN n.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("has-value");
  });

  test("[custom-3] IS NOT NULL combined with AND", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', x: 1, y: 10}), (:A {name: 'b', x: 1}), (:A {name: 'c', x: 2, y: 20})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.x = 1 AND n.y IS NOT NULL RETURN n.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test("[custom-4] IS NOT NULL combined with OR", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', x: 1}), (:A {name: 'b', y: 2}), (:A {name: 'c'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.x IS NOT NULL OR n.y IS NOT NULL RETURN n.name ORDER BY n.name",
    );

    // Matches 'a' (has x), 'b' (has y)
    expect(results).toHaveLength(2);
    expect(results).toEqual(["a", "b"]);
  });

  test.fails("[custom-5] IS NOT NULL on relationship property - relationship property null check not fully supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a'})-[:T {num: 1}]->(:B {name: 'b1'}), (:A {name: 'a2'})-[:T]->(:B {name: 'b2'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) WHERE r.num IS NOT NULL RETURN b.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("b1");
  });

  test("[custom-6] IS NOT NULL with multiple matching nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a1', prop: 'val1'}), (:A {name: 'a2', prop: 'val2'}), (:A {name: 'a3'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.prop IS NOT NULL RETURN n.name ORDER BY n.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toEqual(["a1", "a2"]);
  });

  test("[custom-7] NOT combined with IS NULL (equivalent to IS NOT NULL)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'has-val', val: 1}), (:A {name: 'no-val'})");

    // NOT (x IS NULL) should be equivalent to x IS NOT NULL
    const resultsNot = executeTckQuery(graph, "MATCH (n:A) WHERE NOT n.val IS NULL RETURN n.name");
    const resultsIsNotNull = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.val IS NOT NULL RETURN n.name",
    );

    expect(resultsNot).toHaveLength(1);
    expect(resultsIsNotNull).toHaveLength(1);
    expect(resultsNot[0]).toBe("has-val");
    expect(resultsIsNotNull[0]).toBe("has-val");
  });
});
