/**
 * TCK Remove1 - Remove a Property
 * Translated from tmp/tck/features/clauses/remove/Remove1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("Remove1 - Remove a Property", () => {
  test("[1] Remove a single node property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:L {num: 42})");

    const results = executeTckQuery(
      graph,
      `MATCH (n:L)
       REMOVE n.num
       RETURN n.num`,
    );

    // After removal, property should be undefined
    expect(results).toHaveLength(1);
    expect(results[0]).toBeUndefined();
  });

  test("[2] Remove multiple node properties", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:L {num: 42, name: 'a', name2: 'B'})");

    // Remove two properties, leaving name2
    executeTckQuery(
      graph,
      `MATCH (n:L)
       REMOVE n.num, n.name`,
    );

    // Verify only name2 remains
    const results = executeTckQuery(graph, "MATCH (n:L) RETURN n");
    expect(results).toHaveLength(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "num")).toBeUndefined();
    expect(getProperty(node, "name")).toBeUndefined();
    expect(getProperty(node, "name2")).toBe("B");
  });

  test("[3] Remove a single relationship property - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a), (b), (a)-[:X {num: 42}]->(b)");
    const results = executeTckQuery(
      graph,
      `MATCH ()-[r:X]->()
       REMOVE r.num
       RETURN r.num`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBeUndefined();
  });

  test("[4] Remove multiple relationship properties - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (a), (b), (a)-[:X {num: 42, a: 'a', b: 'B'}]->(b)",
    );
    executeTckQuery(
      graph,
      `MATCH ()-[r:X]->()
       REMOVE r.num, r.a`,
    );
    const results = executeTckQuery(graph, "MATCH ()-[r:X]->() RETURN r");
    expect(results).toHaveLength(1);
    const [rel] = results[0] as [Record<string, unknown>];
    expect(getProperty(rel, "num")).toBeUndefined();
    expect(getProperty(rel, "a")).toBeUndefined();
    expect(getProperty(rel, "b")).toBe("B");
  });

  test.fails(
    "[5] Ignore null when removing property from a node - OPTIONAL MATCH not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "OPTIONAL MATCH (a:DoesNotExist) REMOVE a.num RETURN a",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBeNull();
    },
  );

  test.fails(
    "[6] Ignore null when removing property from a relationship - OPTIONAL MATCH not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "OPTIONAL MATCH (n)-[r]->() REMOVE r.num RETURN n",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBeNull();
    },
  );

  test("[7] Remove a missing node property - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (), (), ()");
    executeTckQuery(graph, "MATCH (n) REMOVE n.num");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n.num");
    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result).toBeUndefined();
    }
  });

  // Custom tests for supported scenarios
  test("[custom-1] Remove relationship property with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:X {num: 42}]->(:B)");

    const results = executeTckQuery(
      graph,
      `MATCH (:A)-[r:X]->(:B)
       REMOVE r.num
       RETURN r.num`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBeUndefined();
  });

  test("[custom-2] Remove multiple relationship properties with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A)-[:X {num: 42, name: 'edge', prop: 'keep'}]->(:B)",
    );

    executeTckQuery(
      graph,
      `MATCH (:A)-[r:X]->(:B)
       REMOVE r.num, r.name`,
    );

    const results = executeTckQuery(graph, "MATCH (:A)-[r:X]->(:B) RETURN r");
    expect(results).toHaveLength(1);
    const [rel] = results[0] as [Record<string, unknown>];
    expect(getProperty(rel, "num")).toBeUndefined();
    expect(getProperty(rel, "name")).toBeUndefined();
    expect(getProperty(rel, "prop")).toBe("keep");
  });

  test("[custom-3] Remove property that does not exist on node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test'})");

    // Remove non-existent property should be a no-op
    executeTckQuery(
      graph,
      `MATCH (n:A)
       REMOVE n.nonExistent`,
    );

    // Original property should still exist
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-4] Remove property from multiple nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    executeTckQuery(
      graph,
      `MATCH (n:A)
       REMOVE n.num`,
    );

    // All nodes should have num removed
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num");
    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result).toBeUndefined();
    }
  });

  test("[custom-5] Remove property and return different property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', num: 42})");

    const results = executeTckQuery(
      graph,
      `MATCH (n:A)
       REMOVE n.num
       RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });
});
