import { test, expect } from "vitest";
import {
  InMemoryGraphStorage,
  parseElementId,
  getLabelFromElementId,
  type StoredVertex,
  type StoredEdge,
  type ElementId,
} from "../GraphStorage.js";
import {
  EdgeNotFoundError,
  ElementNotFoundError,
  VertexNotFoundError,
} from "../Exceptions.js";

test("GraphStorage - parseElementId() - should parse valid element ids", () => {
  expect(parseElementId("Person:123")).toEqual(["Person", "123"]);
  expect(parseElementId("Edge:abc-def")).toEqual(["Edge", "abc-def"]);
  expect(parseElementId("Test:uuid-with-dashes")).toEqual([
    "Test",
    "uuid-with-dashes",
  ]);
});

test("GraphStorage - parseElementId() - should throw error for invalid element ids", () => {
  expect(() => parseElementId("invalid" as ElementId)).toThrow(
    "Invalid element id: invalid",
  );
  expect(() => parseElementId("" as ElementId)).toThrow("Invalid element id: ");
});

test("GraphStorage - parseElementId() - should handle ids with multiple colons", () => {
  // split with limit 2 means it splits into exactly 2 parts
  expect(parseElementId("Label:uuid:extra" as ElementId)).toEqual([
    "Label",
    "uuid",
  ]);
});

test("GraphStorage - getLabelFromElementId() - should extract label from valid element ids", () => {
  expect(getLabelFromElementId("Person:123")).toBe("Person");
  expect(getLabelFromElementId("Edge:abc")).toBe("Edge");
  expect(getLabelFromElementId("TestLabel:uuid")).toBe("TestLabel");
});

test("GraphStorage - getLabelFromElementId() - should throw error for invalid element ids", () => {
  expect(() => getLabelFromElementId("invalid" as ElementId)).toThrow(
    "Invalid element id: invalid",
  );
});

test("GraphStorage - getLabelFromElementId() - should handle empty string", () => {
  expect(() => getLabelFromElementId("" as ElementId)).toThrow(
    "Invalid element id: ",
  );
});

test("GraphStorage - InMemoryGraphStorage - constructor - should create empty storage", () => {
  const storage = new InMemoryGraphStorage();
  expect(Array.from(storage.getVertices([]))).toHaveLength(0);
  expect(Array.from(storage.getEdges([]))).toHaveLength(0);
});

test("GraphStorage - InMemoryGraphStorage - constructor - should initialize with vertices and edges", () => {
  const vertices: StoredVertex[] = [
    {
      "@type": "Vertex",
      id: "Person:1",
      properties: { name: "Alice" },
    },
    {
      "@type": "Vertex",
      id: "Person:2",
      properties: { name: "Bob" },
    },
  ];

  const edges: StoredEdge[] = [
    {
      "@type": "Edge",
      id: "knows:1",
      properties: {},
      inV: "Person:1",
      outV: "Person:2",
    },
  ];

  const newStorage = new InMemoryGraphStorage({ vertices, edges });

  expect(Array.from(newStorage.getVertices([]))).toHaveLength(2);
  expect(Array.from(newStorage.getEdges([]))).toHaveLength(1);
});

test("GraphStorage - InMemoryGraphStorage - addVertex() - should add a vertex", () => {
  const storage = new InMemoryGraphStorage();
  const vertex: StoredVertex = {
    "@type": "Vertex",
    id: "Person:1",
    properties: { name: "Alice" },
  };

  storage.addVertex(vertex);

  expect(storage.getVertexById("Person:1")).toEqual(vertex);
});

test("GraphStorage - InMemoryGraphStorage - addVertex() - should throw error when adding duplicate vertex", () => {
  const storage = new InMemoryGraphStorage();
  const vertex: StoredVertex = {
    "@type": "Vertex",
    id: "Person:1",
    properties: { name: "Alice" },
  };

  storage.addVertex(vertex);

  expect(() => storage.addVertex(vertex)).toThrow(
    "Vertex with id Person:1 already exists",
  );
});

test("GraphStorage - InMemoryGraphStorage - getVertexById() - should return vertex by id", () => {
  const storage = new InMemoryGraphStorage();
  const vertex: StoredVertex = {
    "@type": "Vertex",
    id: "Person:1",
    properties: { name: "Alice" },
  };

  storage.addVertex(vertex);

  expect(storage.getVertexById("Person:1")).toEqual(vertex);
});

test("GraphStorage - InMemoryGraphStorage - getVertexById() - should return undefined for non-existent vertex", () => {
  const storage = new InMemoryGraphStorage();
  expect(storage.getVertexById("Person:999")).toBeUndefined();
});

test("GraphStorage - InMemoryGraphStorage - getVertices() - should return all vertices when no labels specified", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: { name: "Alice" },
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: { name: "Bob" },
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Thing:1",
    properties: { name: "Item" },
  });

  const vertices = Array.from(storage.getVertices([]));
  expect(vertices).toHaveLength(3);
});

test("GraphStorage - InMemoryGraphStorage - getVertices() - should filter vertices by label", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: { name: "Alice" },
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: { name: "Bob" },
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Thing:1",
    properties: { name: "Item" },
  });

  const personVertices = Array.from(storage.getVertices(["Person"]));
  expect(personVertices).toHaveLength(2);
  expect(personVertices.every((v) => v.id.startsWith("Person:"))).toBe(true);
});

test("GraphStorage - InMemoryGraphStorage - getVertices() - should filter vertices by multiple labels", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: { name: "Alice" },
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: { name: "Bob" },
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Thing:1",
    properties: { name: "Item" },
  });

  const vertices = Array.from(storage.getVertices(["Person", "Thing"]));
  expect(vertices).toHaveLength(3);
});

test("GraphStorage - InMemoryGraphStorage - deleteVertex() - should delete a vertex", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: { name: "Alice" },
  });

  storage.deleteVertex("Person:1");

  expect(storage.getVertexById("Person:1")).toBeUndefined();
});

test("GraphStorage - InMemoryGraphStorage - deleteVertex() - should throw VertexNotFoundError when deleting non-existent vertex", () => {
  const storage = new InMemoryGraphStorage();
  expect(() => storage.deleteVertex("Person:999")).toThrow(VertexNotFoundError);
});

test("GraphStorage - InMemoryGraphStorage - deleteVertex() - should delete incoming edges when deleting vertex", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  storage.deleteVertex("Person:2");

  expect(storage.getEdgeById("knows:1")).toBeUndefined();
  expect(Array.from(storage.getIncomingEdges("Person:2"))).toHaveLength(0);
});

test("GraphStorage - InMemoryGraphStorage - deleteVertex() - should delete outgoing edges when deleting vertex", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  storage.deleteVertex("Person:1");

  expect(storage.getEdgeById("knows:1")).toBeUndefined();
  expect(Array.from(storage.getOutgoingEdges("Person:1"))).toHaveLength(0);
});

test("GraphStorage - InMemoryGraphStorage - deleteVertex() - should handle deleting vertex with multiple edges", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:3",
    properties: {},
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:2",
    properties: {},
    inV: "Person:3",
    outV: "Person:2",
  });

  storage.deleteVertex("Person:2");

  expect(storage.getEdgeById("knows:1")).toBeUndefined();
  expect(storage.getEdgeById("knows:2")).toBeUndefined();
});

test("GraphStorage - InMemoryGraphStorage - addEdge() - should add an edge", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });

  const edge: StoredEdge = {
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  };

  storage.addEdge(edge);

  expect(storage.getEdgeById("knows:1")).toEqual(edge);
});

test("GraphStorage - InMemoryGraphStorage - addEdge() - should throw error when adding duplicate edge", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });

  const edge: StoredEdge = {
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  };

  storage.addEdge(edge);

  expect(() => storage.addEdge(edge)).toThrow(
    "Edge with id knows:1 already exists",
  );
});

test("GraphStorage - InMemoryGraphStorage - addEdge() - should update incoming edges index", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });

  // Edge: Person:2 -> Person:1 (outV=source, inV=target)
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  // Person:1 is the target, so it should have incoming edges
  const incomingEdges = Array.from(storage.getIncomingEdges("Person:1"));
  expect(incomingEdges).toHaveLength(1);
  expect(incomingEdges[0]!.id).toBe("knows:1");
});

test("GraphStorage - InMemoryGraphStorage - addEdge() - should update outgoing edges index", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });

  // Edge: Person:2 -> Person:1 (outV=source, inV=target)
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  // Person:2 is the source, so it should have outgoing edges
  const outgoingEdges = Array.from(storage.getOutgoingEdges("Person:2"));
  expect(outgoingEdges).toHaveLength(1);
  expect(outgoingEdges[0]!.id).toBe("knows:1");
});

test("GraphStorage - InMemoryGraphStorage - addEdge() - should handle multiple edges to same vertex", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });

  // Both edges: Person:2 -> Person:1 (outV=source, inV=target)
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:2",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  // Person:1 is target (incoming), Person:2 is source (outgoing)
  expect(Array.from(storage.getIncomingEdges("Person:1"))).toHaveLength(2);
  expect(Array.from(storage.getOutgoingEdges("Person:2"))).toHaveLength(2);
});

test("GraphStorage - InMemoryGraphStorage - getEdgeById() - should return edge by id", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });

  const edge: StoredEdge = {
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  };

  storage.addEdge(edge);

  expect(storage.getEdgeById("knows:1")).toEqual(edge);
});

test("GraphStorage - InMemoryGraphStorage - getEdgeById() - should return undefined for non-existent edge", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });

  expect(storage.getEdgeById("knows:999")).toBeUndefined();
});

test("GraphStorage - InMemoryGraphStorage - getEdges() - should return all edges when no labels specified", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });
  storage.addEdge({
    "@type": "Edge",
    id: "likes:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  const edges = Array.from(storage.getEdges([]));
  expect(edges).toHaveLength(2);
});

test("GraphStorage - InMemoryGraphStorage - getEdges() - should filter edges by label", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });
  storage.addEdge({
    "@type": "Edge",
    id: "likes:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  const knowsEdges = Array.from(storage.getEdges(["knows"]));
  expect(knowsEdges).toHaveLength(1);
  expect(knowsEdges[0]!.id).toBe("knows:1");
});

test("GraphStorage - InMemoryGraphStorage - getEdges() - should filter edges by multiple labels", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });
  storage.addEdge({
    "@type": "Edge",
    id: "likes:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  const edges = Array.from(storage.getEdges(["knows", "likes"]));
  expect(edges).toHaveLength(2);
});

test("GraphStorage - InMemoryGraphStorage - deleteEdge() - should delete an edge", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  storage.deleteEdge("knows:1");

  expect(storage.getEdgeById("knows:1")).toBeUndefined();
});

test("GraphStorage - InMemoryGraphStorage - deleteEdge() - should throw EdgeNotFoundError when deleting non-existent edge", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  expect(() => storage.deleteEdge("knows:999")).toThrow(EdgeNotFoundError);
});

test("GraphStorage - InMemoryGraphStorage - deleteEdge() - should remove edge from incoming edges index", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  storage.deleteEdge("knows:1");

  const incomingEdges = Array.from(storage.getIncomingEdges("Person:2"));
  expect(incomingEdges).toHaveLength(0);
});

test("GraphStorage - InMemoryGraphStorage - deleteEdge() - should remove edge from outgoing edges index", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  storage.deleteEdge("knows:1");

  const outgoingEdges = Array.from(storage.getOutgoingEdges("Person:1"));
  expect(outgoingEdges).toHaveLength(0);
});

test("GraphStorage - InMemoryGraphStorage - deleteEdge() - should handle deleting one of multiple edges", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });
  // Both edges: Person:2 -> Person:1 (outV=source, inV=target)
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:2",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  storage.deleteEdge("knows:1");

  expect(storage.getEdgeById("knows:1")).toBeUndefined();
  expect(storage.getEdgeById("knows:2")).toBeDefined();
  // Person:1 is target (incoming), Person:2 is source (outgoing)
  expect(Array.from(storage.getIncomingEdges("Person:1"))).toHaveLength(1);
  expect(Array.from(storage.getOutgoingEdges("Person:2"))).toHaveLength(1);
});

test("GraphStorage - InMemoryGraphStorage - getIncomingEdges() - should return empty array for vertex with no incoming edges", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });

  const edges = Array.from(storage.getIncomingEdges("Person:1"));
  expect(edges).toHaveLength(0);
});

test("GraphStorage - InMemoryGraphStorage - getIncomingEdges() - should return incoming edges for vertex", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });

  // Edge: Person:2 -> Person:1 (outV=source, inV=target)
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  // Person:1 is the target, so it should have incoming edges
  const edges = Array.from(storage.getIncomingEdges("Person:1"));
  expect(edges).toHaveLength(1);
  expect(edges[0]!.id).toBe("knows:1");
});

test("GraphStorage - InMemoryGraphStorage - getOutgoingEdges() - should return empty array for vertex with no outgoing edges", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });

  // Person:1 has no outgoing edges (no edge where Person:1 is the source/outV)
  const edges = Array.from(storage.getOutgoingEdges("Person:1"));
  expect(edges).toHaveLength(0);
});

test("GraphStorage - InMemoryGraphStorage - getOutgoingEdges() - should return outgoing edges for vertex", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: {},
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: {},
  });

  // Edge: Person:2 -> Person:1 (outV=source, inV=target)
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: {},
    inV: "Person:1",
    outV: "Person:2",
  });

  // Person:2 is the source, so it should have outgoing edges
  const edges = Array.from(storage.getOutgoingEdges("Person:2"));
  expect(edges).toHaveLength(1);
  expect(edges[0]!.id).toBe("knows:1");
});

test("GraphStorage - InMemoryGraphStorage - updateProperty() - should update vertex property", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: { name: "Alice" },
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: { name: "Bob" },
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: { since: 2020 },
    inV: "Person:1",
    outV: "Person:2",
  });

  storage.updateProperty("Person:1", "name", "Alicia");

  const vertex = storage.getVertexById("Person:1");
  expect((vertex!.properties as any).name).toBe("Alicia");
});

test("GraphStorage - InMemoryGraphStorage - updateProperty() - should update edge property", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: { name: "Alice" },
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: { name: "Bob" },
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: { since: 2020 },
    inV: "Person:1",
    outV: "Person:2",
  });

  storage.updateProperty("knows:1", "since", 2021);

  const edge = storage.getEdgeById("knows:1");
  expect((edge!.properties as any).since).toBe(2021);
});

test("GraphStorage - InMemoryGraphStorage - updateProperty() - should add new property to vertex", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: { name: "Alice" },
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: { name: "Bob" },
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: { since: 2020 },
    inV: "Person:1",
    outV: "Person:2",
  });

  storage.updateProperty("Person:1", "age", 30);

  const vertex = storage.getVertexById("Person:1");
  expect((vertex!.properties as any).age).toBe(30);
});

test("GraphStorage - InMemoryGraphStorage - updateProperty() - should throw ElementNotFoundError for non-existent element", () => {
  const storage = new InMemoryGraphStorage();
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:1",
    properties: { name: "Alice" },
  });
  storage.addVertex({
    "@type": "Vertex",
    id: "Person:2",
    properties: { name: "Bob" },
  });
  storage.addEdge({
    "@type": "Edge",
    id: "knows:1",
    properties: { since: 2020 },
    inV: "Person:1",
    outV: "Person:2",
  });

  expect(() => storage.updateProperty("Person:999", "name", "Test")).toThrow(
    ElementNotFoundError,
  );
});
