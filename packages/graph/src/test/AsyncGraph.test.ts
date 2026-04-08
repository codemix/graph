import { test, expect, describe } from "vitest";
import { AsyncGraph, handleAsyncCommand } from "../AsyncGraph.js";
import { createManufacturingGraph } from "./createManufacturingGraph.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import type { GraphSchema } from "../GraphSchema.js";

test("AsyncGraph", async () => {
  const graph = createManufacturingGraph();

  const asyncGraph = new AsyncGraph({
    schema: graph.schema,
    transport: async function* (command) {
      for await (const result of handleAsyncCommand(graph, command)) {
        yield result;
      }
    },
  });

  const results = [];
  for await (const result of asyncGraph.query((g) => g.V().limit(2).out())) {
    results.push(result);
  }
  expect(results.length).toBeGreaterThan(0);
});

describe("AsyncGraph cloning with various property types", () => {
  function createTestSchema() {
    return {
      vertices: {
        TestVertex: {
          properties: {
            name: {
              type: {
                "~standard": {
                  version: 1,
                  vendor: "test",
                  validate: (v: unknown) => ({ value: v as string }),
                },
              },
            },
            createdAt: {
              type: {
                "~standard": {
                  version: 1,
                  vendor: "test",
                  validate: (v: unknown) => ({ value: v as Date }),
                },
              },
            },
            metadata: {
              type: {
                "~standard": {
                  version: 1,
                  vendor: "test",
                  validate: (v: unknown) => ({
                    value: v as Record<string, unknown>,
                  }),
                },
              },
            },
            tags: {
              type: {
                "~standard": {
                  version: 1,
                  vendor: "test",
                  validate: (v: unknown) => ({ value: v as string[] }),
                },
              },
            },
            maybeValue: {
              type: {
                "~standard": {
                  version: 1,
                  vendor: "test",
                  validate: (v: unknown) => ({
                    value: v as string | undefined,
                  }),
                },
              },
            },
          },
        },
      },
      edges: {
        TestEdge: {
          properties: {
            weight: {
              type: {
                "~standard": {
                  version: 1,
                  vendor: "test",
                  validate: (v: unknown) => ({ value: v as number }),
                },
              },
            },
          },
        },
      },
    } as const satisfies GraphSchema;
  }

  test("serializes Date objects to ISO strings in vertex properties", async () => {
    // Due to the need for JSON.stringify to handle TraversalPath and Vertex
    // classes with private fields and toJSON() methods, Date objects in
    // properties are serialized to ISO strings. This is a known limitation.
    const schema = createTestSchema();
    const now = new Date("2024-01-15T10:30:00.000Z");
    const storage = new InMemoryGraphStorage({
      vertices: [
        {
          "@type": "Vertex",
          id: "TestVertex:1",
          properties: {
            name: "Test",
            createdAt: now,
          },
        },
      ],
      edges: [],
    });
    const graph = new Graph({ schema, storage });

    const asyncGraph = new AsyncGraph({
      schema,
      transport: async function* (command) {
        for await (const result of handleAsyncCommand(graph, command)) {
          yield result;
        }
      },
    });

    const results = [];
    for await (const result of asyncGraph.query((g) => g.V())) {
      results.push(result);
    }

    expect(results.length).toBe(1);
    // The result is a TraversalPath with a Vertex value
    const path = results[0]!;
    const vertex = path.value;
    // Date objects become ISO strings after JSON serialization through transport
    // Access properties via the Vertex.get() method
    const createdAt = vertex.get("createdAt");
    expect(typeof createdAt).toBe("string");
    expect(createdAt).toBe(now.toISOString());
  });

  test("preserves nested objects and arrays in vertex properties", async () => {
    const schema = createTestSchema();
    const storage = new InMemoryGraphStorage({
      vertices: [
        {
          "@type": "Vertex",
          id: "TestVertex:1",
          properties: {
            name: "Test",
            metadata: { nested: { deep: "value" }, count: 42 },
            tags: ["tag1", "tag2", "tag3"],
          },
        },
      ],
      edges: [],
    });
    const graph = new Graph({ schema, storage });

    const asyncGraph = new AsyncGraph({
      schema,
      transport: async function* (command) {
        for await (const result of handleAsyncCommand(graph, command)) {
          yield result;
        }
      },
    });

    const results = [];
    for await (const result of asyncGraph.query((g) => g.V())) {
      results.push(result);
    }

    expect(results.length).toBe(1);
    const path = results[0]!;
    const vertex = path.value;
    expect(vertex.get("metadata")).toEqual({
      nested: { deep: "value" },
      count: 42,
    });
    expect(vertex.get("tags")).toEqual(["tag1", "tag2", "tag3"]);
    // Verify it's a deep copy - vertex returned has different storage than original
    // (accessing via typed cast since storage.vertices is protected)
    const originalProperties = (
      storage as unknown as {
        vertices: Map<string, { properties: Record<string, unknown> }>;
      }
    ).vertices.get("TestVertex:1")?.properties;
    expect(vertex.get("metadata")).not.toBe(originalProperties?.metadata);
    expect(vertex.get("tags")).not.toBe(originalProperties?.tags);
  });

  test("cloned results are independent from source graph", async () => {
    const schema = createTestSchema();
    const storage = new InMemoryGraphStorage({
      vertices: [
        {
          "@type": "Vertex",
          id: "TestVertex:1",
          properties: {
            name: "Original",
            metadata: { key: "original" },
          },
        },
      ],
      edges: [],
    });
    const graph = new Graph({ schema, storage });

    const asyncGraph = new AsyncGraph({
      schema,
      transport: async function* (command) {
        for await (const result of handleAsyncCommand(graph, command)) {
          yield result;
        }
      },
    });

    // Get result from async graph
    const results = [];
    for await (const result of asyncGraph.query((g) => g.V())) {
      results.push(result);
    }
    const path = results[0]!;
    const clonedVertex = path.value;

    // Modify the original storage data directly (cast to access protected member)
    const storageVertices = (
      storage as unknown as {
        vertices: Map<string, { properties: Record<string, unknown> }>;
      }
    ).vertices;
    const originalVertex = storageVertices.get("TestVertex:1");
    if (originalVertex) {
      originalVertex.properties.name = "Modified";
      (originalVertex.properties.metadata as Record<string, string>).key =
        "modified";
    }

    // Verify the cloned result was not affected (it has its own copy via AsyncGraphStorage)
    expect(clonedVertex.get("name")).toBe("Original");
    expect(clonedVertex.get("metadata")).toEqual({ key: "original" });
  });

  test("handles special numeric values", async () => {
    const schema = createTestSchema();
    const storage = new InMemoryGraphStorage({
      vertices: [
        {
          "@type": "Vertex",
          id: "TestVertex:1",
          properties: {
            name: "Test",
            metadata: {
              normalNum: 42,
              negativeNum: -100,
              floatNum: 3.14159,
              zero: 0,
            },
          },
        },
      ],
      edges: [],
    });
    const graph = new Graph({ schema, storage });

    const asyncGraph = new AsyncGraph({
      schema,
      transport: async function* (command) {
        for await (const result of handleAsyncCommand(graph, command)) {
          yield result;
        }
      },
    });

    const results = [];
    for await (const result of asyncGraph.query((g) => g.V())) {
      results.push(result);
    }

    const path = results[0]!;
    const vertex = path.value;
    const metadata = vertex.get("metadata") as Record<string, number>;
    expect(metadata.normalNum).toBe(42);
    expect(metadata.negativeNum).toBe(-100);
    expect(metadata.floatNum).toBeCloseTo(3.14159);
    expect(metadata.zero).toBe(0);
  });

  test("handles boolean values correctly", async () => {
    const schema = createTestSchema();
    const storage = new InMemoryGraphStorage({
      vertices: [
        {
          "@type": "Vertex",
          id: "TestVertex:1",
          properties: {
            name: "Test",
            metadata: {
              isActive: true,
              isDeleted: false,
            },
          },
        },
      ],
      edges: [],
    });
    const graph = new Graph({ schema, storage });

    const asyncGraph = new AsyncGraph({
      schema,
      transport: async function* (command) {
        for await (const result of handleAsyncCommand(graph, command)) {
          yield result;
        }
      },
    });

    const results = [];
    for await (const result of asyncGraph.query((g) => g.V())) {
      results.push(result);
    }

    const path = results[0]!;
    const vertex = path.value;
    const metadata = vertex.get("metadata") as Record<string, boolean>;
    expect(metadata.isActive).toBe(true);
    expect(metadata.isDeleted).toBe(false);
  });

  test("handles null values correctly", async () => {
    const schema = createTestSchema();
    const storage = new InMemoryGraphStorage({
      vertices: [
        {
          "@type": "Vertex",
          id: "TestVertex:1",
          properties: {
            name: "Test",
            metadata: {
              existingKey: "value",
              nullKey: null,
            },
          },
        },
      ],
      edges: [],
    });
    const graph = new Graph({ schema, storage });

    const asyncGraph = new AsyncGraph({
      schema,
      transport: async function* (command) {
        for await (const result of handleAsyncCommand(graph, command)) {
          yield result;
        }
      },
    });

    const results = [];
    for await (const result of asyncGraph.query((g) => g.V())) {
      results.push(result);
    }

    const path = results[0]!;
    const vertex = path.value;
    const metadata = vertex.get("metadata") as Record<string, unknown>;
    expect(metadata.existingKey).toBe("value");
    expect(metadata.nullKey).toBeNull();
  });
});

describe("AsyncGraphStorage.push property updates", () => {
  function createTestSchema() {
    return {
      vertices: {
        TestVertex: {
          properties: {
            name: {
              type: {
                "~standard": {
                  version: 1,
                  vendor: "test",
                  validate: (v: unknown) => ({ value: v as string }),
                },
              },
            },
            count: {
              type: {
                "~standard": {
                  version: 1,
                  vendor: "test",
                  validate: (v: unknown) => ({ value: v as number }),
                },
              },
            },
          },
        },
      },
      edges: {
        TestEdge: {
          properties: {
            weight: {
              type: {
                "~standard": {
                  version: 1,
                  vendor: "test",
                  validate: (v: unknown) => ({ value: v as number }),
                },
              },
            },
          },
        },
      },
    } as const satisfies GraphSchema;
  }

  test("push updates vertex properties individually rather than Object.assign", async () => {
    // This test verifies that push() calls updateProperty for each property
    // instead of using Object.assign, ensuring index consistency
    const schema = createTestSchema();
    const storage = new InMemoryGraphStorage({
      vertices: [
        {
          "@type": "Vertex",
          id: "TestVertex:1",
          properties: {
            name: "Initial",
            count: 1,
          },
        },
      ],
      edges: [],
    });
    const graph = new Graph({ schema, storage });

    let queryCount = 0;
    const asyncGraph = new AsyncGraph({
      schema,
      transport: async function* (command) {
        queryCount++;
        // On second query, the source graph has been updated
        if (queryCount === 2) {
          // Update the source graph's vertex directly
          graph.updateProperty("TestVertex:1", "name", "Updated");
          graph.updateProperty("TestVertex:1", "count", 42);
        }
        for await (const result of handleAsyncCommand(graph, command)) {
          yield result;
        }
      },
    });

    // First query - get initial values
    const results1 = [];
    for await (const result of asyncGraph.query((g) => g.V())) {
      results1.push(result);
    }
    expect(results1[0]!.value.get("name")).toBe("Initial");
    expect(results1[0]!.value.get("count")).toBe(1);

    // Second query - should receive updated values via push()
    const results2 = [];
    for await (const result of asyncGraph.query((g) => g.V())) {
      results2.push(result);
    }
    expect(results2[0]!.value.get("name")).toBe("Updated");
    expect(results2[0]!.value.get("count")).toBe(42);
  });

  test("push updates edge properties individually", async () => {
    const schema = createTestSchema();
    const storage = new InMemoryGraphStorage({
      vertices: [
        { "@type": "Vertex", id: "TestVertex:1", properties: { name: "A" } },
        { "@type": "Vertex", id: "TestVertex:2", properties: { name: "B" } },
      ],
      edges: [
        {
          "@type": "Edge",
          id: "TestEdge:1",
          inV: "TestVertex:1",
          outV: "TestVertex:2",
          properties: { weight: 1 },
        },
      ],
    });
    const graph = new Graph({ schema, storage });

    let queryCount = 0;
    const asyncGraph = new AsyncGraph({
      schema,
      transport: async function* (command) {
        queryCount++;
        if (queryCount === 2) {
          graph.updateProperty("TestEdge:1", "weight", 100);
        }
        for await (const result of handleAsyncCommand(graph, command)) {
          yield result;
        }
      },
    });

    // First query
    const results1 = [];
    for await (const result of asyncGraph.query((g) => g.E())) {
      results1.push(result);
    }
    expect(results1[0]!.value.get("weight")).toBe(1);

    // Second query - should receive updated value via push()
    const results2 = [];
    for await (const result of asyncGraph.query((g) => g.E())) {
      results2.push(result);
    }
    expect(results2[0]!.value.get("weight")).toBe(100);
  });

  test("push with new properties adds them to existing element", async () => {
    const schema = createTestSchema();
    const storage = new InMemoryGraphStorage({
      vertices: [
        {
          "@type": "Vertex",
          id: "TestVertex:1",
          properties: { name: "Initial" },
        },
      ],
      edges: [],
    });
    const graph = new Graph({ schema, storage });

    let queryCount = 0;
    const asyncGraph = new AsyncGraph({
      schema,
      transport: async function* (command) {
        queryCount++;
        if (queryCount === 2) {
          // Add a new property that wasn't there before
          graph.updateProperty("TestVertex:1", "count", 99);
        }
        for await (const result of handleAsyncCommand(graph, command)) {
          yield result;
        }
      },
    });

    // First query
    const results1 = [];
    for await (const result of asyncGraph.query((g) => g.V())) {
      results1.push(result);
    }
    expect(results1[0]!.value.get("name")).toBe("Initial");
    expect(results1[0]!.value.get("count")).toBeUndefined();

    // Second query - should have the new property
    const results2 = [];
    for await (const result of asyncGraph.query((g) => g.V())) {
      results2.push(result);
    }
    expect(results2[0]!.value.get("name")).toBe("Initial");
    expect(results2[0]!.value.get("count")).toBe(99);
  });
});
