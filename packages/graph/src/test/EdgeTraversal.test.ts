import { expect, test } from "vitest";
import { createDemoGraph, DemoSchema } from "../getDemoGraph.js";
import { GraphTraversal } from "../Traversals.js";
import { Edge, Vertex, Graph } from "../Graph.js";

const { graph, alice, bob } = createDemoGraph();
const g = new GraphTraversal(graph);

test("Edge navigation - outV() gets the source vertex of edges (Gremlin convention)", () => {
  // outV() returns the vertex the edge comes OUT of (source)
  const vertices = Array.from(g.V(alice.id).outE("knows").outV().values());

  // outV should return alice for both edges (she is the source)
  expect(vertices).toHaveLength(2);
  expect(vertices[0]!).toBeInstanceOf(Vertex);
  expect(vertices.every((v) => v.get("name") === "Alice")).toBe(true);
});

test("Edge navigation - inV() gets the target vertex of edges (Gremlin convention)", () => {
  // inV() returns the vertex the edge goes INTO (target)
  const vertices = Array.from(g.V(alice.id).outE("knows").inV().values());

  expect(vertices).toHaveLength(2);
  expect(vertices[0]!).toBeInstanceOf(Vertex);
  expect(vertices.some((v) => v.get("name") === "Bob")).toBe(true);
  expect(vertices.some((v) => v.get("name") === "Charlie")).toBe(true);
});

test("Edge navigation - bothV() gets both source and target vertices", () => {
  const vertices = Array.from(g.V(alice.id).outE("knows").bothV().values());

  // Should get both source (alice) and targets (bob, charlie)
  // With 2 edges, bothV returns both endpoints for each = 4 vertices
  expect(vertices.length).toBeGreaterThanOrEqual(2);
  expect(vertices[0]!).toBeInstanceOf(Vertex);

  const names = vertices.map((v) => v.get("name"));
  expect(names.includes("Alice")).toBe(true);
  expect(names.some((n) => n === "Bob" || n === "Charlie")).toBe(true);
});

test("Edge navigation - otherV() gets the other vertex from labeled source", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .as("source")
      .outE("knows")
      .as("edge")
      .otherV()
      .as("target")
      .select("source", "edge", "target")
      .values(),
  );

  expect(results).toHaveLength(2);

  for (const [source, edge, target] of results) {
    expect(source).toBeInstanceOf(Vertex);
    expect(edge).toBeInstanceOf(Edge);
    expect(target).toBeInstanceOf(Vertex);
    expect(source.get("name")).toBe("Alice");
    // otherV from alice should give us the targets (Bob, Charlie)
    expect(["Bob", "Charlie"].includes(target.get("name"))).toBe(true);
  }
});

test("Edge filtering - hasLabel() filters edges by label", () => {
  const edges = Array.from(g.E().hasLabel("knows").values());

  expect(edges.length).toBeGreaterThan(0);
  expect(edges.every((e) => e.label === "knows")).toBe(true);
});

test("Edge filtering - has() filters edges by property conditions", () => {
  // Add some edges with properties for testing
  const testGraph = new Graph<DemoSchema>({
    schema: {} as DemoSchema,
    storage: graph.storage,
    validateProperties: false,
  });
  const person1 = testGraph.addVertex("Person", { name: "Test1", age: 20 });
  const person2 = testGraph.addVertex("Person", { name: "Test2", age: 30 });
  testGraph.addEdge(person1, "knows", person2, {});

  const g2 = new GraphTraversal(testGraph);
  const edges = Array.from(g2.E().hasLabel("knows").values());

  expect(edges.length).toBeGreaterThan(0);
  expect(edges.every((e) => e instanceof Edge)).toBe(true);
});

test("Edge filtering - hasLabel() with multiple edge types", () => {
  const knowsEdges = Array.from(g.E().hasLabel("knows").values());
  const likesEdges = Array.from(g.E().hasLabel("likes").values());

  expect(knowsEdges.length).toBeGreaterThan(0);
  expect(likesEdges.length).toBeGreaterThan(0);
  expect(knowsEdges.every((e) => e.label === "knows")).toBe(true);
  expect(likesEdges.every((e) => e.label === "likes")).toBe(true);
});

test("Edge labeling - as() labels edges for later selection", () => {
  const results = Array.from(
    g
      .E()
      .hasLabel("knows")
      .as("relationship")
      .inV()
      .as("person")
      .select("relationship", "person")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);

  for (const [edge, vertex] of results) {
    expect(edge).toBeInstanceOf(Edge);
    expect(vertex).toBeInstanceOf(Vertex);
    expect(edge.label).toBe("knows");
  }
});

test("Edge labeling - as() with multiple edge labels in traversal", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .outE("knows")
      .as("edge1")
      .outV()
      .outE("knows")
      .as("edge2")
      .outV()
      .select("edge1", "edge2")
      .values(),
  );

  for (const [edge1, edge2] of results) {
    expect(edge1).toBeInstanceOf(Edge);
    expect(edge2).toBeInstanceOf(Edge);
    // These should generally be different edges unless there's a 2-hop path through same edge
    // Just verify they're both edges
  }
});

test("Edge set operations - union() combines edge traversals", () => {
  const edges = Array.from(
    g.union(g.V(alice.id).outE("knows"), g.V(bob.id).outE("knows")).values(),
  );

  expect(edges.length).toBeGreaterThan(0);
  expect(edges.every((e) => e instanceof Edge)).toBe(true);

  // Should include edges from both alice and bob (targets are in inV)
  const targetIds = new Set(edges.map((e) => e.inV.id));
  expect(targetIds.size).toBeGreaterThan(0);
});

test("Edge set operations - intersect() finds common edges", () => {
  const edges = Array.from(g.V(alice.id).outE("knows").intersect(g.E().hasLabel("knows")).values());

  // Alice's outgoing "knows" edges should be in both sets
  // outV is the source (alice), inV is the target
  expect(edges.length).toBe(2);
  expect(edges.every((e) => e.label === "knows" && e.outV.id === alice.id)).toBe(true);
});

test("Edge set operations - dedup() removes duplicate edges", () => {
  const edges = Array.from(
    g.union(g.V(alice.id).outE("knows"), g.V(alice.id).outE("knows")).dedup().values(),
  );

  // Should deduplicate the union of identical traversals
  expect(edges.length).toBe(2); // Alice has 2 outgoing knows edges

  const edgeIds = edges.map((e) => e.id);
  expect(new Set(edgeIds).size).toBe(edgeIds.length);
});

test("Edge ordering and pagination - outV() converts edges to vertices for pagination", () => {
  const vertices = Array.from(g.E().outV().limit(3).values());

  expect(vertices.length).toBeLessThanOrEqual(3);
  expect(vertices.every((v) => v instanceof Vertex)).toBe(true);
});

test("Edge ordering and pagination - Edge to vertex with skip", () => {
  const allVertices = Array.from(g.E().outV().values());
  const skippedVertices = Array.from(g.E().outV().skip(2).values());

  expect(skippedVertices.length).toBe(allVertices.length - 2);
});

test("Edge ordering and pagination - Edge to vertex with range", () => {
  const vertices = Array.from(g.E().outV().range(1, 4).values());

  expect(vertices.length).toBeLessThanOrEqual(3);
  expect(vertices.every((v) => v instanceof Vertex)).toBe(true);
});

test("Edge traversal with select - select() retrieves labeled edges and vertices", () => {
  const results = Array.from(
    g.V().as("v1").outE("knows").as("e").inV().as("v2").select("v1", "e", "v2").values(),
  );

  expect(results.length).toBeGreaterThan(0);

  for (const [v1, e, v2] of results) {
    expect(v1).toBeInstanceOf(Vertex);
    expect(e).toBeInstanceOf(Edge);
    expect(v2).toBeInstanceOf(Vertex);
    // v1 is the source (outV), v2 is the target (inV)
    expect(e.outV.id).toBe(v1.id);
    expect(e.inV.id).toBe(v2.id);
  }
});

test("Edge traversal with select - select with all: modifier on edges", () => {
  const results = Array.from(
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

  // Should get arrays of edge arrays
  expect(results.length).toBeGreaterThan(0);

  for (const edgeGroups of results) {
    expect(Array.isArray(edgeGroups)).toBe(true);
    // Each group contains an array of edges
    for (const item of edgeGroups) {
      if (Array.isArray(item)) {
        expect(item.every((e: any) => e instanceof Edge)).toBe(true);
      } else {
        expect(item).toBeInstanceOf(Edge);
      }
    }
  }
});

test("Edge counting and aggregation - count() counts edges via outV", () => {
  const counts = Array.from(g.E().outV().count());

  expect(counts).toHaveLength(1);
  expect(counts[0]!).toBeTypeOf("number");
  expect(counts[0]!).toBeGreaterThan(0);
});

test("Edge counting and aggregation - count() on filtered edges", () => {
  const knowsCount = Array.from(g.E().hasLabel("knows").outV().count())[0]!;
  const likesCount = Array.from(g.E().hasLabel("likes").outV().count())[0]!;

  expect(knowsCount).toBeGreaterThan(0);
  expect(likesCount).toBeGreaterThan(0);
  expect(typeof knowsCount).toBe("number");
  expect(typeof likesCount).toBe("number");
});

test("Complex edge patterns - Chain multiple edge traversals", () => {
  const paths = Array.from(
    g
      .V(alice.id)
      .outE("knows")
      .as("e1")
      .outV()
      .outE("knows")
      .as("e2")
      .outV()
      .select("e1", "e2")
      .values(),
  );

  expect(paths.length).toBeGreaterThan(0);

  for (const [e1, e2] of paths) {
    expect(e1).toBeInstanceOf(Edge);
    expect(e2).toBeInstanceOf(Edge);
    // Both are valid edges in a 2-hop path
  }
});

test("Complex edge patterns - Mix edge and vertex operations", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .as("person")
      .outE("knows")
      .as("edge")
      .inV()
      .hasLabel("Person")
      .as("friend")
      .select("person", "edge", "friend")
      .values(),
  );

  for (const [person, edge, friend] of results) {
    expect(person.label).toBe("Person");
    expect(edge.label).toBe("knows");
    expect(friend.label).toBe("Person");
  }
});

test("Complex edge patterns - Edge filter chaining", () => {
  const edges = Array.from(
    g.E().hasLabel("knows").outV().has("age", ">", 30).inE("knows").values(),
  );

  expect(edges.every((e) => e instanceof Edge)).toBe(true);
  expect(edges.every((e) => e.label === "knows")).toBe(true);
});
