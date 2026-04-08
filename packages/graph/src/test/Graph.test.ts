import { test, expect } from "vitest";
import {
  Graph,
  EmptyGraphSource,
  Vertex,
  Edge,
  defaultIdGenerator,
} from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import {
  EdgeNotFoundError,
  GraphConsistencyError,
  PropertyTypeError,
  VertexNotFoundError,
} from "../Exceptions.js";
import { standardTestSchema as testSchema } from "./testHelpers.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { GraphSchema } from "../GraphSchema.js";

test("Graph - constructor - should create a graph with schema and storage", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  expect(graph.schema).toBe(testSchema);
  expect(graph.storage).toBe(storage);
});

test("Graph - generateElementId() - should generate unique vertex IDs", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const id1 = graph.generateElementId("Person");
  const id2 = graph.generateElementId("Person");

  expect(id1).toMatch(/^Person:[0-9a-f-]+$/);
  expect(id2).toMatch(/^Person:[0-9a-f-]+$/);
  expect(id1).not.toBe(id2);
});

test("Graph - generateElementId() - should generate unique edge IDs", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const id1 = graph.generateElementId("knows");
  const id2 = graph.generateElementId("knows");

  expect(id1).toMatch(/^knows:[0-9a-f-]+$/);
  expect(id2).toMatch(/^knows:[0-9a-f-]+$/);
  expect(id1).not.toBe(id2);
});

test("Graph - generateElementId() - should use custom ID generator when provided", () => {
  let counter = 0;
  const customGenerator = () => `short-${++counter}`;
  const customStorage = new InMemoryGraphStorage();
  const customGraph = new Graph({
    schema: testSchema,
    storage: customStorage,
    generateId: customGenerator,
  });

  const id1 = customGraph.generateElementId("Person");
  const id2 = customGraph.generateElementId("Person");

  expect(id1).toBe("Person:short-1");
  expect(id2).toBe("Person:short-2");
});

test("Graph - generateElementId() - should use custom IDs for vertices", () => {
  let counter = 0;
  const customGenerator = () => `v${++counter}`;
  const customStorage = new InMemoryGraphStorage();
  const customGraph = new Graph({
    schema: testSchema,
    storage: customStorage,
    generateId: customGenerator,
  });

  const alice = customGraph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = customGraph.addVertex("Person", { name: "Bob", age: 25 });

  expect(alice.id).toBe("Person:v1");
  expect(bob.id).toBe("Person:v2");
});

test("Graph - generateElementId() - should use custom IDs for edges", () => {
  let counter = 0;
  const customGenerator = () => `e${++counter}`;
  const customStorage = new InMemoryGraphStorage();
  const customGraph = new Graph({
    schema: testSchema,
    storage: customStorage,
    generateId: customGenerator,
  });

  const alice = customGraph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = customGraph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = customGraph.addEdge(alice.id, "knows", bob.id, {
    since: 2020,
  });

  // First two IDs are for vertices, third is for the edge
  expect(alice.id).toBe("Person:e1");
  expect(bob.id).toBe("Person:e2");
  expect(edge.id).toBe("knows:e3");
});

test("Graph - defaultIdGenerator - should generate valid UUID strings", () => {
  const id = defaultIdGenerator();
  expect(id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
});

test("Graph - defaultIdGenerator - should generate unique IDs", () => {
  const id1 = defaultIdGenerator();
  const id2 = defaultIdGenerator();
  expect(id1).not.toBe(id2);
});

test("Graph - addVertex() - should add a vertex to the graph", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const vertex = graph.addVertex("Person", { name: "Alice", age: 30 });

  expect(vertex).toBeInstanceOf(Vertex);
  expect(vertex.label).toBe("Person");
  expect(vertex.get("name")).toBe("Alice");
  expect(vertex.get("age")).toBe(30);
});

test("Graph - addVertex() - should return same vertex instance for same stored vertex", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const v1 = graph.addVertex("Person", { name: "Bob", age: 25 });
  const v2 = graph.getVertexById(v1.id);

  expect(v2).toBe(v1);
});

test("Graph - addEdge() - should add an edge between vertices", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });

  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  expect(edge).toBeInstanceOf(Edge);
  expect(edge.label).toBe("knows");
  expect(edge.get("since")).toBe(2020);
});

test("Graph - addEdge() - should return same edge instance for same stored edge", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const e1 = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });
  const e2 = graph.getEdgeById(e1.id);

  expect(e2).toBe(e1);
});

test("Graph - getVertexById() - should return vertex by id", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const vertex = graph.addVertex("Person", { name: "Alice", age: 30 });
  const found = graph.getVertexById(vertex.id);

  expect(found).toBe(vertex);
});

test("Graph - getVertexById() - should return undefined for non-existent vertex", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const found = graph.getVertexById("Person:nonexistent");

  expect(found).toBeUndefined();
});

test("Graph - getVertices() - should return all vertices when no labels specified", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  graph.addVertex("Person", { name: "Alice", age: 30 });
  graph.addVertex("Person", { name: "Bob", age: 25 });
  graph.addVertex("Thing", { name: "Item" });

  const vertices = Array.from(graph.getVertices());
  expect(vertices).toHaveLength(3);
});

test("Graph - getVertices() - should filter vertices by label", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  graph.addVertex("Person", { name: "Alice", age: 30 });
  graph.addVertex("Person", { name: "Bob", age: 25 });
  graph.addVertex("Thing", { name: "Item" });

  const persons = Array.from(graph.getVertices("Person"));
  expect(persons).toHaveLength(2);
  expect(persons.every((v) => v.label === "Person")).toBe(true);
});

test("Graph - getVertices() - should filter vertices by multiple labels", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  graph.addVertex("Person", { name: "Alice", age: 30 });
  graph.addVertex("Person", { name: "Bob", age: 25 });
  graph.addVertex("Thing", { name: "Item" });

  const vertices = Array.from(graph.getVertices("Person", "Thing"));
  expect(vertices).toHaveLength(3);
});

test("Graph - getEdgeById() - should return edge by id", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  const found = graph.getEdgeById(edge.id);
  expect(found).toBe(edge);
});

test("Graph - getEdgeById() - should return undefined for non-existent edge", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const found = graph.getEdgeById("knows:nonexistent");
  expect(found).toBeUndefined();
});

test("Graph - getEdges() - should return all edges when no labels specified", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const item = graph.addVertex("Thing", { name: "Item" });

  graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });
  graph.addEdge(alice.id, "likes", item.id, {});

  const edges = Array.from(graph.getEdges());
  expect(edges).toHaveLength(2);
});

test("Graph - getEdges() - should filter edges by label", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const item = graph.addVertex("Thing", { name: "Item" });

  graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });
  graph.addEdge(alice.id, "likes", item.id, {});

  const knowsEdges = Array.from(graph.getEdges("knows"));
  expect(knowsEdges).toHaveLength(1);
  expect(knowsEdges[0]!.label).toBe("knows");
});

test("Graph - getEdges() - should filter edges by multiple labels", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const item = graph.addVertex("Thing", { name: "Item" });

  graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });
  graph.addEdge(alice.id, "likes", item.id, {});

  const edges = Array.from(graph.getEdges("knows", "likes"));
  expect(edges).toHaveLength(2);
});

test("Graph - getIncomingEdges() - should return incoming edges for a vertex", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  const incomingEdges = Array.from(graph.getIncomingEdges(bob.id));
  expect(incomingEdges).toHaveLength(1);
  expect(incomingEdges[0]!.label).toBe("knows");
});

test("Graph - getIncomingEdges() - should return empty iterable for vertex with no incoming edges", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const incomingEdges = Array.from(graph.getIncomingEdges(alice.id));

  expect(incomingEdges).toHaveLength(0);
});

test("Graph - getOutgoingEdges() - should return outgoing edges for a vertex", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  const outgoingEdges = Array.from(graph.getOutgoingEdges(alice.id));
  expect(outgoingEdges).toHaveLength(1);
  expect(outgoingEdges[0]!.label).toBe("knows");
});

test("Graph - getOutgoingEdges() - should return empty iterable for vertex with no outgoing edges", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const outgoingEdges = Array.from(graph.getOutgoingEdges(alice.id));

  expect(outgoingEdges).toHaveLength(0);
});

test("Graph - Edge.inV and Edge.outV - should return correct inV vertex", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  // addEdge(source, label, target) - alice -> bob
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  // inV is the target (where edge goes INTO) - bob
  expect(edge.inV.id).toBe(bob.id);
});

test("Graph - Edge.inV and Edge.outV - should return correct outV vertex", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  // addEdge(source, label, target) - alice -> bob
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  // outV is the source (where edge comes OUT of) - alice
  expect(edge.outV.id).toBe(alice.id);
});

test("Graph - Edge.inV and Edge.outV - should throw GraphConsistencyError if inV vertex is missing", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  // addEdge(source, label, target) - alice -> bob
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  // Manually delete the target vertex (inV = bob) from storage to create inconsistency
  storage.deleteVertex(bob.id);

  expect(() => edge.inV).toThrow(GraphConsistencyError);
  expect(() => edge.inV).toThrow(/Vertex with id .+ not found/);
});

test("Graph - Edge.inV and Edge.outV - should throw GraphConsistencyError if outV vertex is missing", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  // addEdge(source, label, target) - alice -> bob
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  // Manually delete the source vertex (outV = alice) from storage to create inconsistency
  storage.deleteVertex(alice.id);

  expect(() => edge.outV).toThrow(GraphConsistencyError);
  expect(() => edge.outV).toThrow(/Vertex with id .+ not found/);
});

test("Graph - Vertex methods - should check if vertex has property", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  expect(alice.hasProperty("name")).toBe(true);
  expect(alice.hasProperty("age")).toBe(true);
  expect(alice.hasProperty("nonexistent" as any)).toBe(false);
});

test("Graph - Vertex methods - should get property value", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  expect(alice.get("name")).toBe("Alice");
  expect(alice.get("age")).toBe(30);
});

test("Graph - Vertex methods - should convert vertex to JSON", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const json = alice.toJSON();

  expect(json).toHaveProperty("@type", "Vertex");
  expect(json).toHaveProperty("id", alice.id);
  expect(json).toHaveProperty("properties");
  expect(json.properties).toEqual({ name: "Alice", age: 30 });
});

test("Graph - Vertex update methods - should update vertex property using set", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  alice.set("name", "Alice Smith");
  expect(alice.get("name")).toBe("Alice Smith");

  alice.set("age", 31);
  expect(alice.get("age")).toBe(31);
});

test("Graph - Vertex update methods - should call toString on vertex", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const vertex = graph.addVertex("Person", { name: "Alice", age: 30 });
  const str = vertex.toString();
  expect(str).toBe(vertex.id);
});

test("Graph - Vertex update methods - should check if vertex has specific value using hasProperty", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const vertex = graph.addVertex("Person", { name: "Alice", age: 30 });

  expect(vertex.hasProperty("name", "Alice")).toBe(true);
  expect(vertex.hasProperty("name", "Bob")).toBe(false);
  expect(vertex.hasProperty("age", 30)).toBe(true);
  expect(vertex.hasProperty("age", 25)).toBe(false);
});

test("Graph - Edge methods - should check if edge has property", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  expect(edge.hasProperty("since")).toBe(true);
  expect(edge.hasProperty("nonexistent" as any)).toBe(false);
});

test("Graph - Edge methods - should get property value", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  expect(edge.get("since")).toBe(2020);
});

test("Graph - Edge methods - should convert edge to JSON", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  // addEdge(source, label, target) - alice -> bob
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  const json = edge.toJSON();

  expect(json).toHaveProperty("@type", "Edge");
  expect(json).toHaveProperty("id", edge.id);
  expect(json).toHaveProperty("properties");
  // inV is target (bob), outV is source (alice)
  expect(json).toHaveProperty("inV", bob.id);
  expect(json).toHaveProperty("outV", alice.id);
  expect(json.properties).toEqual({ since: 2020 });
});

test("Graph - Edge methods - should update edge property using set", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  edge.set("since", 2021);
  expect(edge.get("since")).toBe(2021);
});

test("Graph - Edge methods - should call toString on edge", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  const str = edge.toString();
  expect(str).toBe(edge.id);
});

test("Graph - Edge methods - should check if edge has specific value using hasProperty", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  expect(edge.hasProperty("since", 2020)).toBe(true);
  expect(edge.hasProperty("since", 2021)).toBe(false);
});

test("EmptyGraphSource - should have schema", () => {
  const emptySource = new EmptyGraphSource({ schema: testSchema });
  expect(emptySource.schema).toBe(testSchema);
});

test("EmptyGraphSource - should throw error when getting incoming edges", () => {
  const emptySource = new EmptyGraphSource({ schema: testSchema });
  expect(() => emptySource.getIncomingEdges("Person:1")).toThrow(
    "Cannot get incoming edges from an empty graph source",
  );
});

test("EmptyGraphSource - should throw error when getting outgoing edges", () => {
  const emptySource = new EmptyGraphSource({ schema: testSchema });
  expect(() => emptySource.getOutgoingEdges("Person:1")).toThrow(
    "Cannot get outgoing edges from an empty graph source",
  );
});

test("EmptyGraphSource - should throw error when getting vertex by id", () => {
  const emptySource = new EmptyGraphSource({ schema: testSchema });
  expect(() => emptySource.getVertexById("Person:1")).toThrow(
    "Cannot get vertex by id from an empty graph source",
  );
});

test("EmptyGraphSource - should throw error when getting vertices", () => {
  const emptySource = new EmptyGraphSource({ schema: testSchema });
  expect(() => emptySource.getVertices()).toThrow(
    "Cannot get vertices from an empty graph source",
  );
});

test("EmptyGraphSource - should throw error when getting edge by id", () => {
  const emptySource = new EmptyGraphSource({ schema: testSchema });
  expect(() => emptySource.getEdgeById("knows:1")).toThrow(
    "Cannot get edge by id from an empty graph source",
  );
});

test("EmptyGraphSource - should throw error when getting edges", () => {
  const emptySource = new EmptyGraphSource({ schema: testSchema });
  expect(() => emptySource.getEdges()).toThrow(
    "Cannot get edges from an empty graph source",
  );
});

// Domain-specific error tests

test("Graph - addEdge() - should throw VertexNotFoundError for non-existent inV", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });

  expect(() =>
    graph.addEdge("Person:nonexistent", "knows", bob.id, { since: 2020 }),
  ).toThrow(VertexNotFoundError);
});

test("Graph - addEdge() - should throw VertexNotFoundError for non-existent outV", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  expect(() =>
    graph.addEdge(alice.id, "knows", "Person:nonexistent", { since: 2020 }),
  ).toThrow(VertexNotFoundError);
});

test("Graph - addEdge() - VertexNotFoundError should have correct vertexId", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });

  try {
    graph.addEdge("Person:nonexistent", "knows", bob.id, { since: 2020 });
    expect.fail("Expected VertexNotFoundError to be thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(VertexNotFoundError);
    expect((e as VertexNotFoundError).vertexId).toBe("Person:nonexistent");
  }
});

test("Graph - getVertexById() - should throw VertexNotFoundError with throwIfNotFound: true", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });

  expect(() =>
    graph.getVertexById("Person:nonexistent", { throwIfNotFound: true }),
  ).toThrow(VertexNotFoundError);
});

test("Graph - getVertexById() - should return undefined with throwIfNotFound: false", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });

  const result = graph.getVertexById("Person:nonexistent", {
    throwIfNotFound: false,
  });
  expect(result).toBeUndefined();
});

test("Graph - getVertexById() - should return vertex with throwIfNotFound: true when it exists", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  const result = graph.getVertexById(alice.id, { throwIfNotFound: true });
  expect(result).toBe(alice);
});

test("Graph - getEdgeById() - should throw EdgeNotFoundError with throwIfNotFound: true", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });

  expect(() =>
    graph.getEdgeById("knows:nonexistent", { throwIfNotFound: true }),
  ).toThrow(EdgeNotFoundError);
});

test("Graph - getEdgeById() - should return undefined with throwIfNotFound: false", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });

  const result = graph.getEdgeById("knows:nonexistent", {
    throwIfNotFound: false,
  });
  expect(result).toBeUndefined();
});

test("Graph - getEdgeById() - should return edge with throwIfNotFound: true when it exists", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  const result = graph.getEdgeById(edge.id, { throwIfNotFound: true });
  expect(result).toBe(edge);
});

// Schema validation tests

test("Graph - updateProperty - allows unknown properties by default (validation on)", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({ schema: testSchema, storage });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  // Unknown properties are allowed even with validation on
  graph.updateProperty(alice.id, "newProp", "value");
  expect((alice as any).get("newProp")).toBe("value");
});

test("Graph - updateProperty - should allow any property when validateProperties is false", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: testSchema,
    storage,
    validateProperties: false,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  // With validation off, arbitrary properties are allowed
  graph.updateProperty(alice.id, "invalidProp", "value");
  expect((alice as any).get("invalidProp")).toBe("value");
});

test("Graph - updateProperty - allows unknown properties", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: testSchema,
    storage,
    validateProperties: true,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  // Unknown properties are allowed and stored
  graph.updateProperty(alice.id, "newProp", "value");
  expect((alice as any).get("newProp")).toBe("value");
});

test("Graph - updateProperty - should allow valid property updates with validation enabled", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: testSchema,
    storage,
    validateProperties: true,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  // Should not throw for valid properties
  graph.updateProperty(alice.id, "name", "Alice Smith");
  graph.updateProperty(alice.id, "age", 31);

  expect(alice.get("name")).toBe("Alice Smith");
  expect(alice.get("age")).toBe(31);
});

test("Graph - updateProperty - should allow edge property updates including unknown properties", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: testSchema,
    storage,
    validateProperties: true,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  // Valid property update should work
  graph.updateProperty(edge.id, "since", 2021);
  expect(edge.get("since")).toBe(2021);

  // Unknown properties are allowed
  graph.updateProperty(edge.id, "newProp", "value");
  expect((edge as any).get("newProp")).toBe("value");
});

test("Graph - updateProperty - edge allows unknown properties", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: testSchema,
    storage,
    validateProperties: true,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  // Unknown properties are allowed on edges
  graph.updateProperty(edge.id, "newEdgeProp", "value");
  expect((edge as any).get("newEdgeProp")).toBe("value");
});

test("Graph - Vertex.set - allows unknown properties with validation enabled", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: testSchema,
    storage,
    validateProperties: true,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  // Unknown properties are allowed via set()
  (alice as any).set("newProp", "value");
  expect((alice as any).get("newProp")).toBe("value");
});

test("Graph - Edge.set - allows unknown properties with validation enabled", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: testSchema,
    storage,
    validateProperties: true,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  // Unknown properties are allowed via set()
  (edge as any).set("newEdgeProp", "value");
  expect((edge as any).get("newEdgeProp")).toBe("value");
});

// Helper to create a strict type validator
function makeStrictType<T>(
  typeChecker: (value: unknown) => boolean,
  typeName: string,
): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "codemix-test",
      validate: (value) => {
        if (typeChecker(value)) {
          return { value: value as T };
        }
        return {
          issues: [
            { message: `Expected ${typeName}, received ${typeof value}` },
          ],
        };
      },
    },
  };
}

// Schema with strict type validation
const strictSchema = {
  vertices: {
    Person: {
      properties: {
        name: {
          type: makeStrictType<string>((v) => typeof v === "string", "string"),
        },
        age: {
          type: makeStrictType<number>((v) => typeof v === "number", "number"),
        },
      },
    },
  },
  edges: {
    knows: {
      properties: {
        since: {
          type: makeStrictType<number>((v) => typeof v === "number", "number"),
        },
      },
    },
  },
} as const satisfies GraphSchema;

test("Graph - updateProperty - should throw PropertyTypeError for invalid value type", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: strictSchema,
    storage,
    validateProperties: true,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  // Should throw PropertyTypeError when setting age to a string
  expect(() => graph.updateProperty(alice.id, "age", "thirty")).toThrow(
    PropertyTypeError,
  );
});

test("Graph - updateProperty - PropertyTypeError should have correct context", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: strictSchema,
    storage,
    validateProperties: true,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  try {
    graph.updateProperty(alice.id, "age", "not a number");
    expect.fail("Expected PropertyTypeError to be thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(PropertyTypeError);
    expect((e as PropertyTypeError).key).toBe("age");
    expect((e as PropertyTypeError).label).toBe("Person");
    expect((e as PropertyTypeError).value).toBe("not a number");
    expect((e as PropertyTypeError).issues).toContain(
      "Expected number, received string",
    );
  }
});

test("Graph - updateProperty - should allow valid value types", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: strictSchema,
    storage,
    validateProperties: true,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  // Should not throw when setting age to a valid number
  expect(() => graph.updateProperty(alice.id, "age", 31)).not.toThrow();
  expect(alice.get("age")).toBe(31);
});

test("Graph - updateProperty - should validate edge property types", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: strictSchema,
    storage,
    validateProperties: true,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  // Should throw PropertyTypeError when setting since to a string
  expect(() => graph.updateProperty(edge.id, "since", "last year")).toThrow(
    PropertyTypeError,
  );
});

test("Graph - Vertex.set - should throw PropertyTypeError for invalid value type", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: strictSchema,
    storage,
    validateProperties: true,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  expect(() => (alice as any).set("age", "thirty")).toThrow(PropertyTypeError);
});

test("Graph - Edge.set - should throw PropertyTypeError for invalid value type", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: strictSchema,
    storage,
    validateProperties: true,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const edge = graph.addEdge(alice.id, "knows", bob.id, { since: 2020 });

  expect(() => (edge as any).set("since", "2021")).toThrow(PropertyTypeError);
});

test("Graph - updateProperty - should skip value validation when validateProperties is false", () => {
  const storage = new InMemoryGraphStorage();
  const graph = new Graph({
    schema: strictSchema,
    storage,
    validateProperties: false,
  });
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });

  // Should not throw even with invalid type when validation is disabled
  expect(() => graph.updateProperty(alice.id, "age", "thirty")).not.toThrow();
});
