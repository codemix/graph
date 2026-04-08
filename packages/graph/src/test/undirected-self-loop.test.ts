import { describe, it, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "./tck/tckHelpers.js";

describe("Undirected self-loop patterns", () => {
  it("should match self-loop once, not twice, in undirected pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:LOOP]->(a)");

    // Query with undirected pattern - different variables
    const results = executeTckQuery(graph, "MATCH (a)-[r]-(b) RETURN a, r, b");

    console.log("Results count:", results.length);
    results.forEach((r, i) => {
      console.log(`Result ${i}:`, r);
    });

    // Self-loop should match only once - both endpoints are the same node
    // This is the key fix: with direction='both', we traverse both incoming
    // and outgoing edges, but for a self-loop they're the same edge
    expect(results).toHaveLength(1);
  });

  it("should match regular edge twice in undirected pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:REL]->(:B)");

    // Query with undirected pattern
    const results = executeTckQuery(graph, "MATCH (x)-[r]-(y) RETURN x, r, y");

    console.log("Results count:", results.length);

    // Regular edge should match twice - once in each direction
    expect(results).toHaveLength(2);
  });

  it("should match self-loop once when variable is reused: (n)-[r]-(n)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:LOOP]->(a)");

    // Query with same variable on both ends
    const results = executeTckQuery(graph, "MATCH (n)-[r]-(n) RETURN n, r");

    console.log("Results count:", results.length);
    results.forEach((r, i) => {
      console.log(`Result ${i}:`, r);
    });

    // Should only match once - both endpoints are the same variable bound to same node
    expect(results).toHaveLength(1);
  });

  it("should return correct nodes in undirected match", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (a:A {num: 1})-[:REL {name: 'r'}]->(b:B {num: 2})",
    );

    // This is Match3 test [5]
    const results = executeTckQuery(
      graph,
      "MATCH (a)-[r {name: 'r'}]-(b) RETURN a, b",
    );

    // Both directions - should have 2 results
    expect(results).toHaveLength(2);
  });
});
