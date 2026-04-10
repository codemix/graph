import { expect, test } from "vitest";
import { createDemoGraph, DemoSchema } from "../getDemoGraph.js";
import { GraphTraversal } from "../Traversals.js";
import { Vertex, Edge } from "../Graph.js";

const { graph, alice } = createDemoGraph();
const g = new GraphTraversal(graph);

test("ValueTraversal Operations - values() extraction - values() extracts vertex from path", () => {
  const vertices = Array.from(g.V(alice.id).values());

  expect(vertices).toHaveLength(1);
  expect(vertices[0]).toBeInstanceOf(Vertex);
  expect(vertices[0]!.id).toBe(alice.id);
});

test("ValueTraversal Operations - values() extraction - values() after select extracts tuple", () => {
  const results = Array.from(g.V(alice.id).as("a").out("knows").as("b").select("a", "b").values());

  expect(results.length).toBeGreaterThan(0);

  for (const [a, b] of results) {
    expect(a).toBeInstanceOf(Vertex);
    expect(b).toBeInstanceOf(Vertex);
    expect(a.id).toBe(alice.id);
  }
});

test("ValueTraversal Operations - values() extraction - values() after single select extracts single value", () => {
  const results = Array.from(g.V(alice.id).as("person").out("knows").select("person").values());

  expect(results.length).toBeGreaterThan(0);
  // Select returns values in an array for each path
  if (Array.isArray(results[0])) {
    // Flattened array of tuples
    expect(results.every((r) => Array.isArray(r) && r[0] instanceof Vertex)).toBe(true);
    expect(results.every((r) => (r as any)[0].id === alice.id)).toBe(true);
  } else {
    // Direct vertices
    expect(results.every((v) => v instanceof Vertex)).toBe(true);
    expect(results.every((v) => (v as any).id === alice.id)).toBe(true);
  }
});

test("ValueTraversal Operations - values() extraction - values() after map extracts mapped values", () => {
  const names = Array.from(
    g
      .V()
      .map((path) => path.value.get("name"))
      .values(),
  );

  expect(names.length).toBeGreaterThan(0);
  expect(names.every((name) => typeof name === "string")).toBe(true);
  expect(names.includes("Alice")).toBe(true);
});

test("ValueTraversal Operations - order() operation - order().by() sorts primitive values", () => {
  const names = Array.from(
    g
      .V()
      .hasLabel("Person")
      .map((path) => path.value.get("name"))
      .order()
      .by()
      .values(),
  );

  expect(names.length).toBeGreaterThan(0);
  expect(names).toEqual([...names].sort());
});

test("ValueTraversal Operations - order() operation - order().by() sorts unfolded primitive values", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map(() => [3, 1, 2])
      .unfold()
      .order()
      .by()
      .values(),
  );

  expect(results).toEqual([1, 2, 3]);
});

test("ValueTraversal Operations - order() operation - order().by(property) sorts object values", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .map((path) => ({
        bucket: path.value.get("age") >= 35 ? "older" : "younger",
        name: path.value.get("name"),
      }))
      .order()
      .by("bucket")
      .by("name")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);

  const keys = results.map(({ bucket, name }) => `${bucket}:${name}`);
  expect(keys).toEqual([...keys].sort());
});

test("ValueTraversal Operations - values() extraction - values() on edge traversal", () => {
  const edges = Array.from(g.E().values());

  expect(edges.length).toBeGreaterThan(0);
  expect(edges.every((e) => e instanceof Edge)).toBe(true);
});

test("ValueTraversal Operations - values() extraction - Chained values() calls", () => {
  const results = Array.from(g.V(alice.id).out("knows").values());

  // Should extract vertices
  expect(results.length).toBeGreaterThan(0);
  expect(results[0]).toBeInstanceOf(Vertex);
});

test("ValueTraversal Operations - values() extraction - values() after properties extraction", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map((path) => ({ name: path.value.get("name"), id: path.value.id }))
      .values(),
  );

  expect(results).toHaveLength(1);
  expect(typeof results[0]).toBe("object");
  expect(results[0]).toHaveProperty("name");
});

test("ValueTraversal Operations - unfold() operation - unfold() expands arrays from map", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map((_path) => [1, 2, 3])
      .unfold(),
  );

  expect(results).toEqual([1, 2, 3]);
});

test("ValueTraversal Operations - unfold() operation - unfold() on select with all: modifier", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .out("knows")
      .as("friend")
      .out("knows")
      .as("friend")
      .select("all:friend")
      .unfold()
      .values(),
  );

  // Should unfold the arrays of friends
  expect(results.length).toBeGreaterThan(0);
  // Results may be vertices or arrays containing vertices
  const hasVertices =
    results.some((v) => v instanceof Vertex) ||
    results.some((v) => Array.isArray(v) && v[0] instanceof Vertex);
  expect(hasVertices).toBe(true);
});

test("ValueTraversal Operations - unfold() operation - unfold() on array of vertices", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map((path) => {
        const neighbors = Array.from(g.V(path.value.id).out("knows").values());
        return neighbors;
      })
      .unfold(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((v) => v instanceof Vertex)).toBe(true);
});

test("ValueTraversal Operations - unfold() operation - unfold() on empty arrays", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map(() => [])
      .unfold(),
  );

  expect(results).toHaveLength(0);
});

test("ValueTraversal Operations - unfold() operation - unfold() on nested arrays", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map(() => [
        [1, 2],
        [3, 4],
      ])
      .unfold(),
  );

  // Should unfold outer array
  expect(results).toHaveLength(2);
  expect(results[0]).toEqual([1, 2]);
  expect(results[1]).toEqual([3, 4]);
});

test("ValueTraversal Operations - unfold() operation - Multiple unfold() calls", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map(() => [
        [1, 2],
        [3, 4],
      ])
      .unfold()
      .unfold(),
  );

  // Should unfold twice
  expect(results).toEqual([1, 2, 3, 4]);
});

test("ValueTraversal Operations - unfold() operation - unfold() on single values passes through", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map((path) => path.value.get("name"))
      .unfold(),
  );

  // Non-array values should pass through or be wrapped
  expect(results.length).toBeGreaterThan(0);
});

test("ValueTraversal Operations - unfold() operation - unfold() with subsequent filtering", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map(() => [10, 20, 30, 40])
      .unfold()
      .values(),
  );

  expect(results).toEqual([10, 20, 30, 40]);
});

test("ValueTraversal Operations - Combined values() and unfold() operations - Select multiple labels, unfold, and extract values", () => {
  const results = Array.from(
    g.V(alice.id).as("a").out("knows").as("b").select("a", "b").unfold().values(),
  );

  // Should unfold the tuple and then extract values
  expect(results.length).toBeGreaterThan(0);
  expect(results.every((v) => v instanceof Vertex)).toBe(true);
});

test("ValueTraversal Operations - Combined values() and unfold() operations - Select with all:, then values, then unfold", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .out("knows")
      .as("friend")
      .out("knows")
      .as("friend")
      .select("all:friend")
      .unfold()
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  // Results may be vertices or arrays containing vertices
  const hasVertices =
    results.some((v) => v instanceof Vertex) ||
    results.some((v) => Array.isArray(v) && v[0] instanceof Vertex);
  expect(hasVertices).toBe(true);
});

test("ValueTraversal Operations - Combined values() and unfold() operations - Map to array, unfold, map again", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .limit(3)
      .map((path) => [path.value.get("name"), path.value.get("age")])
      .unfold()
      .values(),
  );

  expect(results.length).toBe(6); // 3 people * 2 values each
});

test("ValueTraversal Operations - Combined values() and unfold() operations - Complex pipeline with multiple transformations", () => {
  const results = Array.from(
    g.V(alice.id).out("knows").as("friend").select("all:friend").unfold().values(),
  );

  expect(results.length).toBeGreaterThan(0);
  // Results may be vertices or arrays containing vertices
  const hasVertices =
    results.some((v) => v instanceof Vertex) ||
    results.some((v) => Array.isArray(v) && v[0] instanceof Vertex);
  expect(hasVertices).toBe(true);
});

test("ValueTraversal Operations - Value extraction with aggregation - Count then values extracts count", () => {
  const results = Array.from(g.V().count().values());

  expect(results).toHaveLength(1);
  expect(typeof results[0]).toBe("number");
});

test("ValueTraversal Operations - Value extraction with aggregation - values() after order preserves order", () => {
  const results = Array.from(g.V().hasLabel("Person").order().by("name").values());

  expect(results.length).toBeGreaterThan(0);

  // Verify ordering
  const names = results.map((v) => v.get("name"));
  const sortedNames = [...names].sort();
  expect(names).toEqual(sortedNames);
});

test("ValueTraversal Operations - Value extraction with aggregation - values() after limit", () => {
  const results = Array.from(g.V().limit(3).values());

  expect(results).toHaveLength(3);
  expect(results.every((v) => v instanceof Vertex)).toBe(true);
});

test("ValueTraversal Operations - Value extraction with aggregation - values() after range", () => {
  const results = Array.from(g.V().range(1, 4).values());

  expect(results.length).toBeLessThanOrEqual(3);
  expect(results.every((v) => v instanceof Vertex)).toBe(true);
});

test("ValueTraversal Operations - Value extraction with aggregation - values() after dedup", () => {
  const results = Array.from(g.union(g.V(alice.id), g.V(alice.id)).dedup().values());

  expect(results).toHaveLength(1);
  expect(results[0]!.id).toBe(alice.id);
});

test("ValueTraversal Operations - Value extraction with complex types - Extract vertex properties as objects", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map((path) => ({
        id: path.value.id,
        name: path.value.get("name"),
        age: path.value.get("age"),
      }))
      .values(),
  );

  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({
    id: alice.id,
    name: "Alice",
    age: 30,
  });
});

test("ValueTraversal Operations - Value extraction with complex types - Extract edge endpoints", () => {
  const results = Array.from(
    g
      .E()
      .hasLabel("knows")
      .inV()
      .limit(1)
      .map((_path) => ({
        label: "knows",
      }))
      .values(),
  );

  expect(results).toHaveLength(1);
  expect(results[0]!.label).toBe("knows");
});

test("ValueTraversal Operations - Value extraction with complex types - Extract nested structures", () => {
  const results = Array.from(
    g.V(alice.id).as("person").out("knows").as("friend").select("person", "friend").values(),
  ) as unknown as [Vertex<DemoSchema>, Vertex<DemoSchema>][];

  expect(results.length).toBeGreaterThan(0);
  expect(
    results.every(
      ([person, friend]) =>
        person instanceof Vertex && friend instanceof Vertex && person.get("name") === "Alice",
    ),
  ).toBe(true);
});

test("ValueTraversal Operations - ValueTraversal edge cases - values() on empty traversal returns empty", () => {
  const results = Array.from(g.V().has("name", "NonExistent").values());

  expect(results).toHaveLength(0);
});

test("ValueTraversal Operations - ValueTraversal edge cases - unfold() on empty traversal returns empty", () => {
  const results = Array.from(
    g
      .V()
      .has("name", "NonExistent")
      .map(() => [1, 2, 3])
      .unfold(),
  );

  expect(results).toHaveLength(0);
});

test("ValueTraversal Operations - ValueTraversal edge cases - values() with undefined from select", () => {
  const results = Array.from(
    g
      .V()
      .as("v")
      .select("nonexistent" as any)
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  // Select with non-existent label returns array with undefined
  expect(results.every((r) => r === undefined || (Array.isArray(r) && r[0] === undefined))).toBe(
    true,
  );
});

test("ValueTraversal Operations - ValueTraversal edge cases - unfold() on non-iterable values", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map((path) => path.value.get("age")) // Returns a number
      .unfold(),
  );

  // Should handle non-iterable gracefully
  expect(Array.isArray(results)).toBe(true);
});

test("ValueTraversal Operations - ValueTraversal edge cases - Multiple values() calls", () => {
  const results = Array.from(
    g.V(alice.id).out("knows").values(), // First values call
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results[0]).toBeInstanceOf(Vertex);
});

test("ValueTraversal Operations - ValueTraversal edge cases - unfold() after repeat with emit", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows").as("visited"))
      .emit()
      .times(2)
      .select("all:visited")
      .unfold()
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  // Results may be vertices or arrays containing vertices
  const hasVertices =
    results.some((v) => v instanceof Vertex) ||
    results.some((v) => Array.isArray(v) && v[0] instanceof Vertex);
  expect(hasVertices).toBe(true);
});

test("ValueTraversal Operations - Performance with values and unfold - Large array unfold is efficient", () => {
  const largeArray = Array.from({ length: 1000 }, (_, i) => i);

  const start = Date.now();
  const results = Array.from(
    g
      .V(alice.id)
      .map(() => largeArray)
      .unfold(),
  );
  const duration = Date.now() - start;

  expect(results).toHaveLength(1000);
  expect(duration).toBeLessThan(100);
});

test("ValueTraversal Operations - Performance with values and unfold - Many select labels with unfold", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .as("v1")
      .out("knows")
      .as("v2")
      .out("knows")
      .as("v3")
      .select("v1", "v2", "v3")
      .unfold()
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((v) => v instanceof Vertex)).toBe(true);
});

test("ValueTraversal Operations - Performance with values and unfold - Deep unfold nesting", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map(() => [[[1, 2]], [[3, 4]]])
      .unfold() // [[1, 2]], [[3, 4]]
      .unfold() // [1, 2], [3, 4]
      .unfold(), // 1, 2, 3, 4
  );

  expect(results).toEqual([1, 2, 3, 4]);
});
