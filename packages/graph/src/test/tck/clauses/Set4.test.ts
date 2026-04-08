/**
 * TCK Set4 - Set all properties with a map
 * Translated from tmp/tck/features/clauses/set/Set4.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("Set4 - Set all properties with a map", () => {
  test("[1] Set multiple properties with a property map - n = {map} syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:X)");
    executeTckQuery(
      graph,
      "MATCH (n:X) SET n = {name: 'A', name2: 'B', num: 5}",
    );
    const results = executeTckQuery(graph, "MATCH (n:X) RETURN n");
    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("A");
    expect(getProperty(node, "name2")).toBe("B");
    expect(getProperty(node, "num")).toBe(5);
  });

  test("[2] Non-existent values in a property map are removed with SET - n = {map} syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:X {name: 'A', name2: 'B'})");
    executeTckQuery(graph, "MATCH (n:X) SET n = {name: 'B', baz: 'C'}");
    const results = executeTckQuery(graph, "MATCH (n:X) RETURN n");
    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("B");
    expect(getProperty(node, "name2")).toBeUndefined();
    expect(getProperty(node, "baz")).toBe("C");
  });

  test.fails(
    "[3] Null values in a property map are removed with SET - n = {map} syntax not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:X {name: 'A', name2: 'B'})");
      executeTckQuery(
        graph,
        "MATCH (n:X) SET n = {name: 'B', name2: null, baz: 'C'}",
      );
      const results = executeTckQuery(graph, "MATCH (n:X) RETURN n");
      expect(results).toHaveLength(1);
      const [node] = results[0] as [Record<string, unknown>];
      expect(getProperty(node, "name")).toBe("B");
      expect(getProperty(node, "name2")).toBeUndefined();
      expect(getProperty(node, "baz")).toBe("C");
    },
  );

  test("[4] All properties are removed if node is set to empty property map - n = {} syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:X {name: 'A', num: 42})");
    executeTckQuery(graph, "MATCH (n:X) SET n = { }");
    const results = executeTckQuery(graph, "MATCH (n:X) RETURN n");
    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBeUndefined();
    expect(getProperty(node, "num")).toBeUndefined();
  });

  test.fails(
    "[5] Ignore null when setting properties using an overriding map - OPTIONAL MATCH and n = {map} not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "OPTIONAL MATCH (a:DoesNotExist) SET a = {num: 42} RETURN a",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBeNull();
    },
  );
});
