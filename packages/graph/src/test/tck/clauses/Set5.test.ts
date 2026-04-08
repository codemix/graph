/**
 * TCK Set5 - Set multiple properties with a map
 * Translated from tmp/tck/features/clauses/set/Set5.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("Set5 - Set multiple properties with a map (+=)", () => {
  test.fails(
    "[1] Ignore null when setting properties using an appending map - OPTIONAL MATCH and += not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "OPTIONAL MATCH (a:DoesNotExist) SET a += {num: 42} RETURN a",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBeNull();
    },
  );

  test("[2] Overwrite values when using += - n += {map} syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:X {name: 'A', name2: 'B'})");
    executeTckQuery(graph, "MATCH (n:X) SET n += {name2: 'C'}");
    const results = executeTckQuery(graph, "MATCH (n:X) RETURN n");
    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("A");
    expect(getProperty(node, "name2")).toBe("C");
  });

  test("[3] Retain old values when using += - n += {map} syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:X {name: 'A'})");
    executeTckQuery(graph, "MATCH (n:X) SET n += {name2: 'B'}");
    const results = executeTckQuery(graph, "MATCH (n:X) RETURN n");
    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("A");
    expect(getProperty(node, "name2")).toBe("B");
  });

  test.fails(
    "[4] Explicit null values in a map remove old values - n += {map} syntax not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:X {name: 'A', name2: 'B'})");
      executeTckQuery(graph, "MATCH (n:X) SET n += {name: null}");
      const results = executeTckQuery(graph, "MATCH (n:X) RETURN n");
      expect(results).toHaveLength(1);
      const [node] = results[0] as [Record<string, unknown>];
      expect(getProperty(node, "name")).toBeUndefined();
      expect(getProperty(node, "name2")).toBe("B");
    },
  );

  test("[5] Set an empty map when using += has no effect - n += {} syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:X {name: 'A', num: 42})");
    executeTckQuery(graph, "MATCH (n:X) SET n += { }");
    const results = executeTckQuery(graph, "MATCH (n:X) RETURN n");
    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("A");
    expect(getProperty(node, "num")).toBe(42);
  });
});
