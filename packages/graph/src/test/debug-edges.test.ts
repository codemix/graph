import { test, expect } from "vitest";
import { createDemoGraph } from "../getDemoGraph.js";
import { GraphTraversal } from "../Traversals.js";
import { Edge } from "../Graph.js";

const { graph, alice, bob } = createDemoGraph();
const g = new GraphTraversal(graph);

test("Edge operations with union and intersect - union() combines edges from multiple traversals", () => {
  const unionEdges = Array.from(
    g.union(g.V(alice.id).outE("knows"), g.V(bob.id).outE("knows")).values(),
  );

  expect(unionEdges.length).toBeGreaterThan(0);
  expect(unionEdges.every((e) => e instanceof Edge)).toBe(true);
  expect(unionEdges.every((e) => e.label === "knows")).toBe(true);

  // Should contain edges from both Alice and Bob
  const aliceEdges = Array.from(g.V(alice.id).outE("knows").values());
  const bobEdges = Array.from(g.V(bob.id).outE("knows").values());
  expect(unionEdges.length).toBeGreaterThanOrEqual(Math.max(aliceEdges.length, bobEdges.length));
});

test("Edge operations with union and intersect - intersect() returns common edges between traversals", () => {
  const intersectEdges = Array.from(
    g.V(alice.id).outE("knows").intersect(g.E().hasLabel("knows")).values(),
  );

  expect(intersectEdges.length).toBeGreaterThan(0);
  expect(intersectEdges.every((e) => e instanceof Edge)).toBe(true);
  expect(intersectEdges.every((e) => e.label === "knows")).toBe(true);

  // All intersect edges should be from Alice
  const aliceEdges = Array.from(g.V(alice.id).outE("knows").values());
  expect(intersectEdges.length).toBeLessThanOrEqual(aliceEdges.length);
});

test("Edge operations with union and intersect - select() with all: modifier collects multiple edges with same label", () => {
  const allEdgeResults = Array.from(
    g
      .V(alice.id)
      .outE("knows")
      .as("edge")
      .outV()
      .outE("knows")
      .as("edge")
      .outV()
      .select("all:edge")
      .values(),
  );

  expect(allEdgeResults.length).toBeGreaterThan(0);

  // Results should be arrays containing edges or nested arrays
  for (const result of allEdgeResults) {
    expect(Array.isArray(result)).toBe(true);
    if (Array.isArray(result)) {
      expect(result.length).toBeGreaterThan(0);

      // Flatten if needed - items could be edges or arrays of edges
      const flattenOnce = (arr: any[]): any[] => {
        const flattened: any[] = [];
        for (const item of arr) {
          if (Array.isArray(item)) {
            flattened.push(...item);
          } else {
            flattened.push(item);
          }
        }
        return flattened;
      };

      const edges = flattenOnce(result);
      expect(edges.length).toBeGreaterThan(0);

      for (const edge of edges) {
        expect(edge).toBeInstanceOf(Edge);
        if (edge instanceof Edge) {
          expect(edge.label).toBe("knows");
        }
      }
    }
  }
});
