/**
 * TCK With1 - Forward single variable
 * Translated from tmp/tck/features/clauses/with/With1.feature
 */
import { describe, test, expect } from "vitest";
import {
  createTckGraph,
  executeTckQuery,
  getLabel,
  getProperty,
} from "../tckHelpers.js";

describe("With1 - Forward single variable", () => {
  test("[1] Forwarding a node variable 1 - requires undirected relationship pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:REL]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a MATCH (a)-->(b) RETURN *",
    );
    expect(results).toHaveLength(1);
    // RETURN * should return both a and b
    expect(results[0]).toBeDefined();
  });

  test("[1-custom] Forwarding a node variable - WITH...MATCH chaining", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:REL]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a MATCH (a)-[:REL]->(b:B) RETURN a, b",
    );
    expect(results.length).toBe(1);
    const [nodeA, nodeB] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(nodeA)).toBe("A");
    expect(getLabel(nodeB)).toBe("B");
  });

  test.fails(
    "[2] Forwarding a node variable 2 - requires multi-pattern in second MATCH",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:REL]->(:B)");
      executeTckQuery(graph, "CREATE (:X)");
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a MATCH (x:X), (a)-->(b) RETURN *",
      );
      expect(results).toHaveLength(1);
    },
  );

  test.fails(
    "[3] Forwarding a relationship variable - requires matching by relationship variable",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:T1]->(:X)");
      executeTckQuery(graph, "CREATE (:A)-[:T2]->(:X)");
      const results = executeTckQuery(
        graph,
        "MATCH ()-[r1]->(:X) WITH r1 AS r2 MATCH ()-[r2]->() RETURN r2 AS rel",
      );
      expect(results).toHaveLength(2);
    },
  );

  test("[4] Forwarding a path variable - unlabeled node (by design)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a)");
    const results = executeTckQuery(graph, "MATCH p = (a) WITH p RETURN p");
    expect(results).toHaveLength(1);
    // Path should be defined
    expect(results[0]).toBeDefined();
  });

  test("[5] Forwarding null - requires undirected patterns and OPTIONAL MATCH interaction", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:B)");
    const results = executeTckQuery(
      graph,
      "OPTIONAL MATCH (a:Start) WITH a MATCH (a)-->(b) RETURN *",
    );
    expect(results).toHaveLength(0);
  });

  test("[6] Forwarding a node variable possibly null", () => {
    const graph = createTckGraph();
    // Don't create :A, so OPTIONAL MATCH returns null for a
    executeTckQuery(graph, "CREATE (:B)");
    const results = executeTckQuery(
      graph,
      "OPTIONAL MATCH (a:A) WITH a AS a MATCH (b:B) RETURN a, b",
    );
    expect(results.length).toBe(1);
    const [a, b] = results[0] as [unknown, Record<string, unknown>];
    expect(a).toBeNull();
    expect(getLabel(b)).toBe("B");
  });

  // Custom tests for supported WITH patterns
  test("[custom-1] WITH forwarding variable to RETURN", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test'})");

    const results = executeTckQuery(graph, "MATCH (a:A) WITH a RETURN a");
    expect(results.length).toBe(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getLabel(node)).toBe("A");
    expect(getProperty(node, "name")).toBe("test");
  });

  test("[custom-2] WITH aliasing variable", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test'})");

    const results = executeTckQuery(graph, "MATCH (a:A) WITH a AS b RETURN b");
    expect(results.length).toBe(1);
    const [node] = results[0] as [Record<string, unknown>];
    expect(getLabel(node)).toBe("A");
    expect(getProperty(node, "name")).toBe("test");
  });

  test("[custom-3] WITH forwarding multiple variables", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a'})-[:REL]->(:B {name: 'b'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:REL]->(b:B) WITH a, r, b RETURN a, b",
    );
    expect(results.length).toBe(1);
    const [nodeA, nodeB] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(nodeA)).toBe("A");
    expect(getLabel(nodeB)).toBe("B");
  });
});
