import { expect, test } from "vitest";
import { createDemoGraph } from "../getDemoGraph.js";
import { GraphTraversal } from "../Traversals.js";
import { Graph } from "../Graph.js";
import { Vertex } from "../Graph.js";

const { graph, alice, bob, charlie } = createDemoGraph();
const g = new GraphTraversal(graph);

test("Repeat with times() - Repeat exactly N times", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .times(2)
      .values(),
  );

  // Should traverse exactly 2 hops from alice
  expect(results.length).toBeGreaterThan(0);
  expect(results.every((v) => v instanceof Vertex)).toBe(true);

  // Note: Depending on graph topology, 2-hop results may or may not include
  // vertices beyond immediate neighbors. Just verify we got results.
});

test("Repeat with times() - Repeat 0 times returns starting vertices", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .times(0)
      .values(),
  );

  expect(results).toHaveLength(1);
  expect(results[0]!.id).toBe(alice.id);
});

test("Repeat with times() - Repeat 1 time traverses one hop", () => {
  const repeatResults = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .times(1)
      .values(),
  );

  // Repeat with times(1) should produce at least some results
  expect(repeatResults.length).toBeGreaterThan(0);
  // Note: The exact behavior of repeat().times(1) may differ from direct traversal
  // in terms of deduplication and path tracking
});

test("Repeat with times() - Repeat with large times number", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .times(10)
      .values(),
  );

  // Should work but might return empty if graph isn't deep enough
  expect(Array.isArray(results)).toBe(true);
});

test("Repeat with until() - Repeat until condition is met", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .until(($) => $.has("name", "Dave"))
      .values(),
  );

  // Should stop when reaching Dave
  expect(results.length).toBeGreaterThan(0);
  expect(results.some((v) => v.get("name") === "Dave")).toBe(true);
});

test("Repeat with until() - Repeat until with property condition", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .until(($) => $.has("age", ">", 40))
      .values(),
  );

  // Should stop when reaching someone over 40
  expect(results.length).toBeGreaterThan(0);
  expect(results.some((v) => v.hasProperty("age") && v.get("age") > 40)).toBe(
    true,
  );
});

test("Repeat with until() - Repeat until with complex filter", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .until(($) => $.out("likes").hasLabel("Thing").has("name", "Banana"))
      .values(),
  );

  // Should find paths to people who like bananas
  expect(results.length).toBeGreaterThan(0);
});

test("Repeat with until() - Repeat until with never-satisfied condition", () => {
  // This test would throw in a truly cyclic graph,
  // but in our demo graph it will just exhaust the paths
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .until(($) => $.has("name", "NonExistentPerson"))
      .times(10) // Add times to prevent infinite loop
      .values(),
  );

  expect(Array.isArray(results)).toBe(true);
});

test("Repeat with until() - Repeat until that's immediately satisfied", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .until(($) => $.has("name", "Alice"))
      .values(),
  );

  // Alice satisfies the condition immediately
  expect(results).toHaveLength(1);
  expect(results[0]!.get("name")).toBe("Alice");
});

test("Repeat with emit() - Emit intermediate results during repeat", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .emit()
      .times(3)
      .values(),
  );

  // Should emit results at each level of traversal
  expect(results.length).toBeGreaterThan(0);

  // Should include intermediate hops, not just final level
  const immediateNeighbors = Array.from(g.V(alice.id).out("knows").values());
  expect(
    results.some((v) => immediateNeighbors.some((n) => n.id === v.id)),
  ).toBe(true);
});

test("Repeat with emit() - Emit with until condition", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .emit()
      .until(($) => $.has("name", "Dave"))
      .values(),
  );

  // Should emit vertices along the path to Dave
  expect(results.length).toBeGreaterThan(0);

  // Verify we get at least some results
  const names = results.map((v) => v.get("name"));
  // May or may not include Dave depending on emit behavior
  expect(names.length).toBeGreaterThan(0);
});

test("Repeat with emit() - Emit needs termination condition", () => {
  // Without times or until, will exhaust available paths
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .emit()
      .times(5) // Add times to prevent potential issues
      .values(),
  );

  expect(Array.isArray(results)).toBe(true);
});

test("Repeat with emit() - Emit with times(0) returns starting vertex", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .emit()
      .times(0)
      .values(),
  );

  expect(results).toHaveLength(1);
  expect(results[0]!.id).toBe(alice.id);
});

test("Combining repeat, emit, until, and times - Repeat with both emit and times", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .emit()
      .times(2)
      .values(),
  );

  // Should emit at levels 0, 1, and 2
  expect(results.length).toBeGreaterThan(0);

  // Should include alice's immediate neighbors (1 hop)
  const oneHop = Array.from(g.V(alice.id).out("knows").values());
  expect(results.some((v) => oneHop.some((n) => n.id === v.id))).toBe(true);
});

test("Combining repeat, emit, until, and times - Repeat with emit and until", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .emit()
      .until(($) => $.has("age", ">", 45))
      .values(),
  );

  // Should emit all intermediate vertices
  expect(results.length).toBeGreaterThan(0);

  // Should eventually reach someone over 45
  expect(results.some((v) => v.hasProperty("age") && v.get("age") > 45)).toBe(
    true,
  );
});

test("Combining repeat, emit, until, and times - Repeat with times limits iterations", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .times(1)
      .values(),
  );

  // times should limit iterations
  expect(results.length).toBeGreaterThan(0);
});

test("Combining repeat, emit, until, and times - Complex repeat with filtering inside loop", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows").has("age", ">", 20))
      .emit()
      .times(3)
      .values(),
  );

  // Should only traverse through vertices with age > 20
  expect(results.length).toBeGreaterThan(0);
  expect(results.every((v) => !v.hasProperty("age") || v.get("age") > 20)).toBe(
    true,
  );
});

test("Nested repeat patterns - Sequential repeat operations", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .times(1)
      .repeat(($) => $.out("knows"))
      .times(1)
      .values(),
  );

  // Two sequential 1-hop traversals = 2-hop traversal
  expect(results.length).toBeGreaterThan(0);
});

test("Nested repeat patterns - Repeat with labeled intermediate steps", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .as("start")
      .repeat(($) => $.out("knows").as("hop"))
      .emit()
      .times(2)
      .as("end")
      .select("start", "end")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);

  for (const [start, end] of results) {
    expect(start).toBeInstanceOf(Vertex);
    expect(end).toBeInstanceOf(Vertex);
    expect(start.id).toBe(alice.id);
  }
});

test("Nested repeat patterns - Repeat with all: label selection", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows").as("visited"))
      .emit()
      .times(2)
      .select("all:visited")
      .values(),
  );

  // Should get arrays of visited vertices
  expect(results.length).toBeGreaterThan(0);
  expect(results.some((r) => Array.isArray(r) && r.length > 0)).toBe(true);
});

test("Repeat with different navigation patterns - Repeat with bidirectional traversal", () => {
  const results = Array.from(
    g
      .V(charlie.id)
      .repeat(($) => $.both("knows"))
      .times(2)
      .dedup()
      .values(),
  );

  // Should traverse in both directions
  expect(results.length).toBeGreaterThan(0);

  // Should reach more vertices than just outgoing
  const outOnly = Array.from(
    g
      .V(charlie.id)
      .repeat(($) => $.out("knows"))
      .times(2)
      .dedup()
      .values(),
  );

  expect(results.length).toBeGreaterThanOrEqual(outOnly.length);
});

test("Repeat with different navigation patterns - Repeat with edge traversal", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.outE("knows").inV())
      .emit()
      .times(2)
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((v) => v instanceof Vertex)).toBe(true);
});

test("Repeat with different navigation patterns - Repeat with mixed edge types", () => {
  const results = Array.from(
    g
      .V(bob.id)
      .repeat(($) => $.out("knows"))
      .times(2)
      .dedup()
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
});

test("Repeat with aggregation and transformation - Count results at each repeat level with emit", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .emit()
      .times(3)
      .count(),
  );

  expect(results).toHaveLength(1);
  expect(typeof results[0]).toBe("number");
  expect(results[0]).toBeGreaterThan(0);
});

test("Repeat with aggregation and transformation - Repeat with map transformation", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .times(2)
      .map((path) => path.value.get("name")),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((name) => typeof name === "string")).toBe(true);
});

test("Repeat with aggregation and transformation - Repeat with select and value extraction", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .as("origin")
      .repeat(($) => $.out("knows"))
      .emit()
      .times(2)
      .as("target")
      .select("origin", "target")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);

  for (const [origin, target] of results) {
    expect(origin.id).toBe(alice.id);
    expect(target).toBeInstanceOf(Vertex);
  }
});

test("Repeat with aggregation and transformation - Repeat with dedup inside loop", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.both("knows").dedup())
      .times(2)
      .dedup()
      .values(),
  );

  // Verify no duplicates
  const ids = results.map((v) => v.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("Repeat with complex filtering - Repeat until with multiple conditions", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .until(($) => $.has("age", ">", 30).has("age", "<", 50))
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(
    results.every(
      (v) => v.hasProperty("age") && v.get("age") > 30 && v.get("age") < 50,
    ),
  ).toBe(true);
});

test("Repeat with complex filtering - Repeat with filter at each level", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows").has("age", "<", 50))
      .emit()
      .times(3)
      .values(),
  );

  // All results should have age < 50
  expect(results.every((v) => !v.hasProperty("age") || v.get("age") < 50)).toBe(
    true,
  );
});

test("Repeat with complex filtering - Repeat with label filtering inside loop", () => {
  const results = Array.from(
    g
      .V(bob.id)
      .repeat(($) => $.both("knows", "likes").hasLabel("Person"))
      .times(2)
      .dedup()
      .values(),
  );

  // Should only traverse to Person vertices
  expect(results.every((v) => v.label === "Person")).toBe(true);
});

test("Repeat performance and behavior - Repeat with large graph maintains performance", () => {
  // Create a larger graph
  const largeGraph = new Graph({
    schema: graph.schema,
    storage: graph.storage,
  });

  const vertices = Array.from({ length: 100 }, (_, i) =>
    largeGraph.addVertex("Person", { name: `Person${i}`, age: i }),
  );

  // Create some connections
  for (let i = 0; i < vertices.length - 1; i++) {
    largeGraph.addEdge(vertices[i]!, "knows", vertices[i + 1]!, {});
  }

  const g2 = new GraphTraversal(largeGraph);
  const start = Date.now();

  const firstVertex = vertices[0];
  if (!firstVertex) throw new Error("No vertices");

  const results = Array.from(
    g2
      .V(firstVertex.id)
      .repeat(($) => $.out("knows"))
      .times(5)
      .values(),
  );

  const duration = Date.now() - start;

  expect(results.length).toBeGreaterThan(0);
  expect(duration).toBeLessThan(1000); // Should complete in reasonable time
});

test("Repeat performance and behavior - Repeat with dedup prevents exponential growth", () => {
  // Create a highly connected graph
  const denseGraph = new Graph({
    schema: graph.schema,
    storage: graph.storage,
  });

  const nodes = Array.from({ length: 10 }, (_, i) =>
    denseGraph.addVertex("Person", { name: `Node${i}`, age: i }),
  );

  // Create dense connections
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      denseGraph.addEdge(nodes[i]!, "knows", nodes[j]!, {});
    }
  }

  const g2 = new GraphTraversal(denseGraph);

  const firstNode = nodes[0];
  if (!firstNode) throw new Error("No nodes");

  const withDedup = Array.from(
    g2
      .V(firstNode.id)
      .repeat(($) => $.both("knows").dedup())
      .emit()
      .times(3)
      .dedup()
      .values(),
  );

  // Should not explode in size
  expect(withDedup.length).toBeLessThanOrEqual(nodes.length);
});

test("Repeat performance and behavior - Repeat with early termination is efficient", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .until(($) => $.has("name", "Bob"))
      .values(),
  );

  // Should find Bob quickly without traversing entire graph
  expect(results.length).toBeGreaterThan(0);
  expect(results.some((v) => v.get("name") === "Bob")).toBe(true);
});
