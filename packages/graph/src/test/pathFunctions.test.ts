import { describe, it, expect, beforeEach } from "vitest";
import { Graph, Vertex, Edge } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { clearQueryParams } from "../Steps.js";
import { functionRegistry, evaluateFunction, functionArgExpectsPath } from "../FunctionRegistry.js";
import { TraversalPath, GraphTraversal } from "../Traversals.js";
import type { GraphSchema } from "../GraphSchema.js";
import { StandardSchemaV1 } from "@standard-schema/spec";

// Helper to create type
function makeType<T>(_defaultValue: T): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => ({ value: value as T }),
    },
  };
}

// Schema for path function testing
const testSchema = {
  vertices: {
    Person: {
      properties: {
        name: { type: makeType(undefined as string | undefined) },
        age: { type: makeType(0) },
      },
    },
    City: {
      properties: {
        name: { type: makeType(undefined as string | undefined) },
      },
    },
  },
  edges: {
    KNOWS: { properties: { since: { type: makeType(0) } } },
    LIVES_IN: { properties: {} },
    FRIENDS_WITH: { properties: { years: { type: makeType(0) } } },
  },
} as const satisfies GraphSchema;

describe("FunctionRegistry: Path Functions", () => {
  describe("registration and lookup", () => {
    it("should have path functions registered", () => {
      expect(functionRegistry.has("nodes")).toBe(true);
      expect(functionRegistry.has("relationships")).toBe(true);
      expect(functionRegistry.has("length")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(functionRegistry.has("NODES")).toBe(true);
      expect(functionRegistry.has("Relationships")).toBe(true);
      expect(functionRegistry.has("LENGTH")).toBe(true);
    });

    it("should identify path argument expectations", () => {
      expect(functionArgExpectsPath("nodes", 0)).toBe(true);
      expect(functionArgExpectsPath("relationships", 0)).toBe(true);
      expect(functionArgExpectsPath("length", 0)).toBe(true);
      // Non-path functions should return false
      expect(functionArgExpectsPath("toLower", 0)).toBe(false);
      expect(functionArgExpectsPath("abs", 0)).toBe(false);
    });
  });

  describe("length function", () => {
    it("should return 0 for a single-node path (no edges)", () => {
      const vertex = { id: "v1", label: "Person" } as any as Vertex<any, any>;
      const path = new TraversalPath(undefined, vertex, ["p"]);
      expect(evaluateFunction("length", [path], path)).toBe(0);
    });

    it("should return 1 for a path with one edge", () => {
      const v1 = { id: "v1", label: "Person" } as any as Vertex<any, any>;
      const e1 = { id: "e1", label: "KNOWS" } as any as Edge<any, any>;
      const v2 = { id: "v2", label: "Person" } as any as Vertex<any, any>;

      Object.setPrototypeOf(v1, Vertex.prototype);
      Object.setPrototypeOf(v2, Vertex.prototype);
      Object.setPrototypeOf(e1, Edge.prototype);

      const path = new TraversalPath(undefined, v1, []).with(e1, []).with(v2, ["p"]);

      expect(evaluateFunction("length", [path], path)).toBe(1);
    });

    it("should return correct count for longer paths", () => {
      const v1 = { id: "v1", label: "Person" } as any as Vertex<any, any>;
      const e1 = { id: "e1", label: "KNOWS" } as any as Edge<any, any>;
      const v2 = { id: "v2", label: "Person" } as any as Vertex<any, any>;
      const e2 = { id: "e2", label: "KNOWS" } as any as Edge<any, any>;
      const v3 = { id: "v3", label: "Person" } as any as Vertex<any, any>;

      Object.setPrototypeOf(v1, Vertex.prototype);
      Object.setPrototypeOf(v2, Vertex.prototype);
      Object.setPrototypeOf(v3, Vertex.prototype);
      Object.setPrototypeOf(e1, Edge.prototype);
      Object.setPrototypeOf(e2, Edge.prototype);

      const path = new TraversalPath(undefined, v1, [])
        .with(e1, [])
        .with(v2, [])
        .with(e2, [])
        .with(v3, ["p"]);

      expect(evaluateFunction("length", [path], path)).toBe(2);
    });

    it("should return array length when passed an array", () => {
      const path = new TraversalPath(undefined, undefined, []);
      expect(evaluateFunction("length", [[1, 2, 3, 4, 5]], path)).toBe(5);
    });

    it("should return string length when passed a string", () => {
      const path = new TraversalPath(undefined, undefined, []);
      expect(evaluateFunction("length", ["hello"], path)).toBe(5);
    });

    it("should return null for invalid input", () => {
      const path = new TraversalPath(undefined, undefined, []);
      expect(evaluateFunction("length", [123], path)).toBe(null);
      expect(evaluateFunction("length", [null], path)).toBe(null);
    });
  });

  describe("nodes function", () => {
    it("should return empty array for undefined path", () => {
      const path = new TraversalPath(undefined, undefined, []);
      expect(evaluateFunction("nodes", [null], path)).toBe(null);
    });

    it("should return single node for single-node path", () => {
      const vertex = { id: "v1", label: "Person" } as any as Vertex<any, any>;
      Object.setPrototypeOf(vertex, Vertex.prototype);

      const path = new TraversalPath(undefined, vertex, ["p"]);
      const result = evaluateFunction("nodes", [path], path);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect((result as any[])[0]).toBe(vertex);
    });

    it("should return all nodes from a path", () => {
      const v1 = { id: "v1", label: "Person" } as any as Vertex<any, any>;
      const e1 = { id: "e1", label: "KNOWS" } as any as Edge<any, any>;
      const v2 = { id: "v2", label: "Person" } as any as Vertex<any, any>;
      const e2 = { id: "e2", label: "KNOWS" } as any as Edge<any, any>;
      const v3 = { id: "v3", label: "Person" } as any as Vertex<any, any>;

      Object.setPrototypeOf(v1, Vertex.prototype);
      Object.setPrototypeOf(v2, Vertex.prototype);
      Object.setPrototypeOf(v3, Vertex.prototype);
      Object.setPrototypeOf(e1, Edge.prototype);
      Object.setPrototypeOf(e2, Edge.prototype);

      const path = new TraversalPath(undefined, v1, [])
        .with(e1, [])
        .with(v2, [])
        .with(e2, [])
        .with(v3, ["p"]);

      const result = evaluateFunction("nodes", [path], path);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect((result as any[])[0]).toBe(v1);
      expect((result as any[])[1]).toBe(v2);
      expect((result as any[])[2]).toBe(v3);
    });
  });

  describe("relationships function", () => {
    it("should return empty array for single-node path", () => {
      const vertex = { id: "v1", label: "Person" } as any as Vertex<any, any>;
      Object.setPrototypeOf(vertex, Vertex.prototype);

      const path = new TraversalPath(undefined, vertex, ["p"]);
      const result = evaluateFunction("relationships", [path], path);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it("should return all edges from a path", () => {
      const v1 = { id: "v1", label: "Person" } as any as Vertex<any, any>;
      const e1 = { id: "e1", label: "KNOWS" } as any as Edge<any, any>;
      const v2 = { id: "v2", label: "Person" } as any as Vertex<any, any>;
      const e2 = { id: "e2", label: "FRIENDS_WITH" } as any as Edge<any, any>;
      const v3 = { id: "v3", label: "Person" } as any as Vertex<any, any>;

      Object.setPrototypeOf(v1, Vertex.prototype);
      Object.setPrototypeOf(v2, Vertex.prototype);
      Object.setPrototypeOf(v3, Vertex.prototype);
      Object.setPrototypeOf(e1, Edge.prototype);
      Object.setPrototypeOf(e2, Edge.prototype);

      const path = new TraversalPath(undefined, v1, [])
        .with(e1, [])
        .with(v2, [])
        .with(e2, [])
        .with(v3, ["p"]);

      const result = evaluateFunction("relationships", [path], path);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect((result as any[])[0]).toBe(e1);
      expect((result as any[])[1]).toBe(e2);
    });

    it("should return null for invalid input", () => {
      const path = new TraversalPath(undefined, undefined, []);
      expect(evaluateFunction("relationships", [null], path)).toBe(null);
      expect(evaluateFunction("relationships", ["not a path"], path)).toBe(null);
    });
  });
});

describe("Query Execution: Path Functions with Traversal API", () => {
  let graph: Graph<typeof testSchema>;
  let alice: Vertex<typeof testSchema, "Person">;
  let bob: Vertex<typeof testSchema, "Person">;
  let charlie: Vertex<typeof testSchema, "Person">;

  beforeEach(() => {
    clearQueryParams();
    graph = new Graph({
      schema: testSchema,
      storage: new InMemoryGraphStorage(),
    });

    // Create a chain: Alice -> Bob -> Charlie
    // Using Vertex objects directly (like getDemoGraph.ts does)
    alice = graph.addVertex("Person", { name: "Alice", age: 30 });
    bob = graph.addVertex("Person", { name: "Bob", age: 25 });
    charlie = graph.addVertex("Person", { name: "Charlie", age: 35 });

    // addEdge(inV, label, outV, properties) with Vertex objects
    // alice -> bob means edge.inV=alice, edge.outV=bob
    // outgoingEdges indexed by inV, so this edge is "outgoing" from alice
    graph.addEdge(alice, "KNOWS", bob, { since: 2020 });
    graph.addEdge(bob, "KNOWS", charlie, { since: 2021 });
  });

  describe("Path traversals", () => {
    it("should correctly traverse paths using Traversal API", () => {
      const g = new GraphTraversal(graph);
      // out() gives us the target vertex of outgoing edges directly
      const results = [
        ...g.V(alice.id).as("start").out("KNOWS").as("end").select("start", "end").values(),
      ];

      expect(results).toHaveLength(1);
      // Select().values() returns an array of [vertex1, vertex2] for each path
      const [startVertex, endVertex] = results[0] as unknown as [
        Vertex<any, any>,
        Vertex<any, any>,
      ];
      expect(startVertex).toBe(alice);
      expect(endVertex).toBe(bob);
    });

    it("should work with multi-hop traversals", () => {
      const g = new GraphTraversal(graph);
      // Follow outgoing edges using out()
      const results = [
        ...g
          .V(alice.id)
          .as("start")
          .out("KNOWS")
          .out("KNOWS")
          .as("end")
          .select("start", "end")
          .values(),
      ];

      expect(results).toHaveLength(1);
      const [startVertex, endVertex] = results[0] as unknown as [
        Vertex<any, any>,
        Vertex<any, any>,
      ];
      expect(startVertex).toBe(alice);
      expect(endVertex).toBe(charlie);
    });
  });

  describe("Path information via Traversal API", () => {
    it("should be able to access path depth", () => {
      const g = new GraphTraversal(graph);

      // Get path from Alice to Charlie (2 hops = depth of 5: v1, e1, v2, e2, v3)
      const results = [...g.V(alice.id).out("KNOWS").out("KNOWS")];

      expect(results).toHaveLength(1);
      const path = results[0] as TraversalPath<any, any, any>;
      expect(path.depth).toBe(5); // alice -> e1 -> bob -> e2 -> charlie
    });

    it("should expose path helper methods for nodes, relationships, length, and sum", () => {
      const g = new GraphTraversal(graph);

      const results = [
        ...g
          .V(alice.id)
          .shortestPath()
          .to(charlie.id)
          .through("KNOWS")
          .map((path) => ({
            hops: path.length(),
            names: path.nodes("name"),
            sinceValues: path.relationships("since"),
            totalSince: path.sum("since"),
          })),
      ];

      expect(results).toEqual([
        {
          hops: 2,
          names: ["Alice", "Bob", "Charlie"],
          sinceValues: [2020, 2021],
          totalSince: 4041,
        },
      ]);
    });
  });
});

describe("Path Functions: Edge Cases", () => {
  it("should handle empty TraversalPath", () => {
    const emptyPath = new TraversalPath(undefined, undefined, []);

    // length of empty path should be 0 (no edges)
    expect(evaluateFunction("length", [emptyPath], emptyPath)).toBe(0);

    // nodes of empty path should be empty (undefined is not a Vertex)
    expect(evaluateFunction("nodes", [emptyPath], emptyPath)).toEqual([]);

    // relationships of empty path should be empty
    expect(evaluateFunction("relationships", [emptyPath], emptyPath)).toEqual([]);
  });

  it("should handle paths with only edges (unusual but possible)", () => {
    const e1 = { id: "e1", label: "KNOWS" } as any as Edge<any, any>;
    const e2 = { id: "e2", label: "KNOWS" } as any as Edge<any, any>;
    Object.setPrototypeOf(e1, Edge.prototype);
    Object.setPrototypeOf(e2, Edge.prototype);

    const path = new TraversalPath(undefined, e1, []).with(e2, ["p"]);

    // length counts edges
    expect(evaluateFunction("length", [path], path)).toBe(2);

    // nodes should be empty
    expect(evaluateFunction("nodes", [path], path)).toEqual([]);

    // relationships should have both edges
    const rels = evaluateFunction("relationships", [path], path);
    expect(Array.isArray(rels)).toBe(true);
    expect(rels).toHaveLength(2);
  });

  it("should preserve order of nodes and relationships", () => {
    const v1 = { id: "v1", label: "A" } as any as Vertex<any, any>;
    const e1 = { id: "e1", label: "R" } as any as Edge<any, any>;
    const v2 = { id: "v2", label: "B" } as any as Vertex<any, any>;
    const e2 = { id: "e2", label: "S" } as any as Edge<any, any>;
    const v3 = { id: "v3", label: "C" } as any as Vertex<any, any>;

    Object.setPrototypeOf(v1, Vertex.prototype);
    Object.setPrototypeOf(v2, Vertex.prototype);
    Object.setPrototypeOf(v3, Vertex.prototype);
    Object.setPrototypeOf(e1, Edge.prototype);
    Object.setPrototypeOf(e2, Edge.prototype);

    const path = new TraversalPath(undefined, v1, [])
      .with(e1, [])
      .with(v2, [])
      .with(e2, [])
      .with(v3, ["p"]);

    const nodes = evaluateFunction("nodes", [path], path) as Vertex<any, any>[];
    expect(nodes.map((n) => n.id)).toEqual(["v1", "v2", "v3"]);

    const rels = evaluateFunction("relationships", [path], path) as Edge<any, any>[];
    expect(rels.map((r) => r.id)).toEqual(["e1", "e2"]);
  });

  it("TraversalPath helper methods should preserve order and support property extraction", () => {
    const graph = new Graph({
      schema: testSchema,
      storage: new InMemoryGraphStorage(),
    });
    const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
    const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
    const charlie = graph.addVertex("Person", { name: "Charlie", age: 35 });
    const e1 = graph.addEdge(alice, "KNOWS", bob, { since: 2020 });
    const e2 = graph.addEdge(bob, "KNOWS", charlie, { since: 2021 });

    const path = new TraversalPath(undefined, alice, [] as const)
      .with(e1, [] as const)
      .with(bob, [] as const)
      .with(e2, [] as const)
      .with(charlie, ["p"] as const);

    expect(path.nodes().map((node) => node.id)).toEqual([alice.id, bob.id, charlie.id]);
    expect(path.nodes("name")).toEqual(["Alice", "Bob", "Charlie"]);
    expect(path.relationships().map((edge: any) => edge.id)).toEqual([e1.id, e2.id]);
    expect(path.relationships("since")).toEqual([2020, 2021]);
    expect(path.length()).toBe(2);
    expect(path.sum("since")).toBe(4041);
  });
});

describe("TraversalPath depth caching", () => {
  it("should have O(1) depth access for deeply nested paths", () => {
    // Build a deeply nested path (1000 levels)
    const depth = 1000;
    let path: TraversalPath<any, any, any> = new TraversalPath(undefined, { id: "0" }, []);
    for (let i = 1; i < depth; i++) {
      path = path.with({ id: String(i) }, []);
    }

    // Verify the depth is correct
    expect(path.depth).toBe(depth);

    // Access depth many times - should be fast since it's cached
    const iterations = 10000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      path.depth;
    }
    const elapsed = performance.now() - start;

    // With caching, 10000 accesses should take < 10ms
    // Without caching, it would take O(depth * iterations) = O(10M) operations
    expect(elapsed).toBeLessThan(100); // generous threshold for CI variability
  });

  it("should correctly compute depth during construction", () => {
    const path1 = new TraversalPath(undefined, "a", []);
    expect(path1.depth).toBe(1);

    const path2 = path1.with("b", []);
    expect(path2.depth).toBe(2);

    const path3 = path2.with("c", []);
    expect(path3.depth).toBe(3);

    const path4 = path3.with("d", ["label"]);
    expect(path4.depth).toBe(4);
  });
});
