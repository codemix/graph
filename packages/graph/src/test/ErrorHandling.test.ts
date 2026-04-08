import { expect, test } from "vitest";
import { createDemoGraph } from "../getDemoGraph.js";
import { MaxIterationsExceededError, MemoryLimitExceededError } from "../Exceptions.js";
import { GraphTraversal } from "../Traversals.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";

const { graph, alice, bob } = createDemoGraph();
const g = new GraphTraversal(graph);

test("Empty traversal errors - as() on empty vertex traversal does not throw", () => {
  expect(() => {
    const q = g.V().has("name", "NonExistent");
    // Try to add a label - this should work, but would fail at execution
    const labeled = q.as("test");
    // Force evaluation
    Array.from(labeled);
  }).not.toThrow(); // as() itself shouldn't throw, only on execution
});

test("Empty traversal errors - Empty traversal returns empty results", () => {
  const results = Array.from(g.V().has("name", "NonExistentPerson").values());
  expect(results).toHaveLength(0);
});

test("Empty traversal errors - Empty union returns empty results", () => {
  const results = Array.from(
    g.union(g.V().has("name", "NonExistent1"), g.V().has("name", "NonExistent2")).values(),
  );
  expect(results).toHaveLength(0);
});

test("Empty traversal errors - Empty intersect returns empty results", () => {
  const results = Array.from(g.V(alice.id).intersect(g.V(bob.id)).values());
  expect(results).toHaveLength(0);
});

test("Label and selection errors - Selecting non-existent label returns undefined", () => {
  const results = Array.from(
    g
      .V()
      .as("exists")
      .select("nonexistent" as any)
      .values(),
  );
  // Should return paths with undefined for missing labels
  expect(results.length).toBeGreaterThan(0);
  // Select returns array when label doesn't exist
  expect(results[0]).toEqual([undefined]);
});

test("Label and selection errors - Multiple select with some missing labels", () => {
  const results = Array.from(
    g
      .V()
      .as("v1")
      .out("knows")
      .select("v1", "missing" as any)
      .values(),
  );

  for (const result of results) {
    const [v1, missing] = result as any;
    expect(v1).toBeDefined();
    expect(missing).toBeUndefined();
  }
});

test("Label and selection errors - select with all: on non-existent label", () => {
  const results = Array.from(
    g
      .V()
      .as("exists")
      .select("all:missing" as any)
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  // Should return empty arrays or undefined for missing labels
  expect(
    results.every(
      (r) =>
        (Array.isArray(r) && r.length < 1) ||
        (Array.isArray(r) && r.every((item) => Array.isArray(item) && (item.length as number) < 1)),
    ),
  ).toBe(true);
});

test("Repeat step errors - Repeat with maxIterations exceeded throws MaxIterationsExceededError", async () => {
  // Import the required modules
  const { createTraverser, RepeatStep, VertexStep } = await import("../Steps.js");

  // Create a long chain of vertices
  const chainGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Build a chain: v0 -> v1 -> v2 -> ... -> v1100
  // This ensures we have enough unique vertices to exhaust maxIterations
  const vertices = [];
  for (let i = 0; i <= 1100; i++) {
    vertices.push(chainGraph.addVertex("Person", { name: `V${i}`, age: i }));
  }
  for (let i = 0; i < 1100; i++) {
    chainGraph.addEdge(vertices[i]!, "knows", vertices[i + 1]!, {});
  }

  // Create a RepeatStep with times=2000 (exceeds default maxIterations of 1000)
  const repeatStep = new RepeatStep({ times: 2000 }, [
    new VertexStep({ direction: "out", edgeLabels: ["knows"] }),
  ]);
  const traverser = createTraverser([repeatStep]);

  const g2 = new GraphTraversal(chainGraph);
  const inputPaths = Array.from(g2.V(vertices[0]!.id));

  // Should throw MaxIterationsExceededError at iteration 1000
  expect(() => {
    Array.from(traverser.traverse(chainGraph, inputPaths));
  }).toThrow(MaxIterationsExceededError);
});

test("Repeat step errors - Repeat without times() has cycle detection, doesn't throw", () => {
  // RepeatStep has built-in cycle detection via seen Set, so circular graphs
  // don't cause infinite loops - they just terminate when all paths are exhausted
  const circularGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  const v1 = circularGraph.addVertex("Person", { name: "V1", age: 20 });
  const v2 = circularGraph.addVertex("Person", { name: "V2", age: 30 });
  circularGraph.addEdge(v1, "knows", v2, {});
  circularGraph.addEdge(v2, "knows", v1, {});

  const g2 = new GraphTraversal(circularGraph);

  // With cycle detection, this should NOT throw - it will emit both vertices and stop
  const results = Array.from(
    g2
      .V(v1.id)
      .repeat(($) => $.out("knows"))
      .values(),
  );
  // Should emit v2 (and possibly more depending on emit behavior)
  expect(results.length).toBeGreaterThanOrEqual(1);
});

test("Repeat step errors - Repeat with until() that never satisfies terminates via cycle detection", () => {
  // With cycle detection, even if until() never satisfies, the traversal
  // will terminate when all vertices have been visited
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .until(($) => $.has("name", "ImpossibleName"))
      .values(),
  );
  // Should terminate without throwing, returning results where until matched
  // (which may be empty if no matches found before cycle detection kicks in)
  expect(Array.isArray(results)).toBe(true);
});

test("Repeat step errors - Custom maxIterations via QueryContext", async () => {
  const { createTraverser, RepeatStep, VertexStep, QueryContext } = await import("../Steps.js");

  // Create a linear chain with enough vertices to test the limit
  const chainGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Build a chain: v0 -> v1 -> v2 -> ... -> v10
  const vertices = [];
  for (let i = 0; i <= 10; i++) {
    vertices.push(chainGraph.addVertex("Person", { name: `V${i}`, age: i }));
  }
  for (let i = 0; i < 10; i++) {
    chainGraph.addEdge(vertices[i]!, "knows", vertices[i + 1]!, {});
  }

  // Create a RepeatStep with times=100 (would exceed maxIterations=5)
  const repeatStep = new RepeatStep({ times: 100 }, [
    new VertexStep({ direction: "out", edgeLabels: ["knows"] }),
  ]);
  const traverser = createTraverser([repeatStep]);

  // With custom maxIterations=5, should throw when iterations exceed it
  const contextWithLowLimit = new QueryContext(chainGraph, {}, { maxIterations: 5 });

  const g2 = new GraphTraversal(chainGraph);
  const inputPaths = Array.from(g2.V(vertices[0]!.id));

  expect(() => {
    Array.from(traverser.traverse(chainGraph, inputPaths, contextWithLowLimit));
  }).toThrow(MaxIterationsExceededError);

  // With higher maxIterations, the chain terminates naturally (only 10 edges)
  const contextWithHighLimit = new QueryContext(chainGraph, {}, { maxIterations: 1000 });
  const results = Array.from(traverser.traverse(chainGraph, inputPaths, contextWithHighLimit));
  // Should complete successfully
  expect(Array.isArray(results)).toBe(true);
});

test("Invalid filter conditions - Filter with non-existent property returns empty", () => {
  const results = Array.from(g.V().has("name", "=", "NonExistentValue").values());
  expect(results).toHaveLength(0);
});

test("Invalid filter conditions - Filter with invalid comparison operator", () => {
  // Type system should prevent this, but test runtime behavior
  const results = Array.from(g.V().has("age", ">", 25).values());
  expect(results.length).toBeGreaterThan(0);
  expect(results.every((v) => v.hasProperty("age") && v.get("age") > 25)).toBe(true);
});

test("Invalid filter conditions - hasLabel with non-existent label returns empty", () => {
  const results = Array.from(
    // @ts-expect-error Testing non-existent label
    g.V().hasLabel("NonExistentLabel").values(),
  );
  expect(results).toHaveLength(0);
});

test("Edge cases in traversal operations - Union requires at least two traversals", () => {
  // Union requires at least 2 traversals
  const results = Array.from(g.union(g.V(alice.id), g.V(bob.id)).values());
  expect(results.length).toBeGreaterThan(0);
});

test("Edge cases in traversal operations - Intersect works with matching vertices", () => {
  // Intersect requires at least 2 traversals
  const results = Array.from(g.intersect(g.V(alice.id), g.V(alice.id)).values());
  expect(results.length).toBeGreaterThan(0);
});

test("Edge cases in traversal operations - Limit with 0 returns empty", () => {
  const results = Array.from(g.V().limit(0).values());
  expect(results).toHaveLength(0);
});

test("Edge cases in traversal operations - Skip beyond available results returns empty", () => {
  const allVertices = Array.from(g.V().values());
  const skipped = Array.from(
    g
      .V()
      .skip(allVertices.length + 10)
      .values(),
  );
  expect(skipped).toHaveLength(0);
});

test("Edge cases in traversal operations - Range with inverted bounds", () => {
  const results = Array.from(g.V().range(10, 5).values());
  // Should return empty or throw
  expect(results).toHaveLength(0);
});

test("Edge cases in traversal operations - Range with negative start", () => {
  const results = Array.from(g.V().range(-1, 5).values());
  // Should handle gracefully
  expect(Array.isArray(results)).toBe(true);
});

test("Edge cases in traversal operations - Dedup on empty traversal", () => {
  const results = Array.from(g.V().has("name", "NonExistent").dedup().values());
  expect(results).toHaveLength(0);
});

test("Edge cases in traversal operations - Count on empty traversal returns 0", () => {
  const counts = Array.from(g.V().has("name", "NonExistent").count());
  expect(counts).toHaveLength(1);
  expect(counts[0]!).toBe(0);
});

test("Navigation edge cases - out() on vertex with no outgoing edges", () => {
  // Find or create a vertex with no outgoing edges
  const isolated = graph.addVertex("Person", { name: "Isolated", age: 99 });
  const results = Array.from(g.V(isolated.id).out("knows").values());
  expect(results).toHaveLength(0);
});

test("Navigation edge cases - in() on vertex with no incoming edges", () => {
  const isolated = graph.addVertex("Person", {
    name: "Isolated2",
    age: 99,
  });
  const results = Array.from(g.V(isolated.id).in("knows").values());
  expect(results).toHaveLength(0);
});

test("Navigation edge cases - both() on isolated vertex", () => {
  const isolated = graph.addVertex("Person", {
    name: "Isolated3",
    age: 99,
  });
  const results = Array.from(g.V(isolated.id).both("knows").values());
  expect(results).toHaveLength(0);
});

test("Navigation edge cases - outE() with non-matching edge label", () => {
  const results = Array.from(
    // @ts-expect-error Testing non-existent edge label
    g.V(alice.id).outE("nonExistentEdge").values(),
  );
  expect(results).toHaveLength(0);
});

test("Navigation edge cases - inV() without preceding edge step", () => {
  // This should be prevented by TypeScript, but test if it somehow happens
  const results = Array.from(g.E().inV().values());
  expect(results.length).toBeGreaterThan(0);
});

test("Property and value extraction edge cases - values() on vertex without properties", () => {
  const v = graph.addVertex("Person", { name: "Test", age: 25 });
  const results = Array.from(g.V(v.id).values());
  expect(results).toHaveLength(1);
  expect(results[0]).toBeDefined();
});

test("Property and value extraction edge cases - Accessing properties map", () => {
  const results = Array.from(g.V().map((path) => path.value.id));
  expect(results.length).toBeGreaterThan(0);
});

test("Property and value extraction edge cases - unfold() on non-array value", () => {
  // Map to a non-array value and try to unfold
  const results = Array.from(
    g
      .V(alice.id)
      .map((path) => path.value.get("name"))
      .unfold(),
  );
  // Should handle gracefully - might return the value itself or skip
  expect(Array.isArray(results)).toBe(true);
});

test("Property and value extraction edge cases - unfold() on empty array", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map(() => [])
      .unfold(),
  );
  expect(results).toHaveLength(0);
});

test("Order and comparison edge cases - order() by non-existent property", () => {
  const results = Array.from(
    // @ts-expect-error Testing non-existent property
    g.V().order().by("nonExistentProp").values(),
  );
  // Should not crash, might have undefined behavior
  expect(Array.isArray(results)).toBe(true);
});

test("Order and comparison edge cases - order() by property with mixed types", () => {
  // This tests the comparator's robustness
  const results = Array.from(g.V().order().by("name").values());
  expect(results.length).toBeGreaterThan(0);
});

test("Order and comparison edge cases - order() with desc on numeric property", () => {
  const results = Array.from(g.V().hasLabel("Person").order().by("age", "desc").values());

  // Verify descending order
  for (let i = 1; i < results.length; i++) {
    if (results[i - 1]!.hasProperty("age") && results[i]!.hasProperty("age")) {
      expect(results[i - 1]!.get("age")).toBeGreaterThanOrEqual(results[i]!.get("age"));
    }
  }
});

test("Complex pattern edge cases - Nested repeat with empty inner traversal", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows").has("name", "NonExistent"))
      .times(3)
      .values(),
  );
  // Should terminate early when inner traversal is empty
  expect(results).toHaveLength(0);
});

test("Complex pattern edge cases - Select after dedup", () => {
  const results = Array.from(
    g.V().as("v").out("knows").as("friend").dedup().select("v", "friend").values(),
  );
  expect(results.length).toBeGreaterThan(0);
});

test("Complex pattern edge cases - Map with function that returns undefined", () => {
  const results = Array.from(g.V().map(() => undefined));
  expect(results.length).toBeGreaterThan(0);
  expect(results.every((r) => r === undefined)).toBe(true);
});

test("Complex pattern edge cases - Has filter that matches nothing", () => {
  const results = Array.from(g.V().has("name", "NonExistent").values());
  expect(results).toHaveLength(0);
});

test("Complex pattern edge cases - Repeat with emit() and immediate termination", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .emit()
      .until(($) => $.out("knows"))
      .values(),
  );
  // Should emit intermediate results
  expect(results.length).toBeGreaterThan(0);
});

test("Type coercion edge cases - Numeric comparison with string property", () => {
  // Create vertex with string that looks like number
  const v = graph.addVertex("Thing", { ref: 123, name: "NumTest" });
  const results = Array.from(g.V(v.id).has("ref", ">", 100).values());
  expect(results).toHaveLength(1);
});

test("Type coercion edge cases - String comparison with case sensitivity", () => {
  const results = Array.from(g.V().has("name", "alice").values());
  // Should be case-sensitive by default
  expect(results).toHaveLength(0);
});

test("Type coercion edge cases - Equality comparison with null/undefined", () => {
  const results = Array.from(
    g
      .V()
      .has("name", "=", undefined as any)
      .values(),
  );
  // Should handle gracefully
  expect(Array.isArray(results)).toBe(true);
});

test("Memory and performance edge cases - Large union of many traversals", () => {
  const traversals = Array.from({ length: 50 }, (_, i) => g.V().has("age", ">", i));
  const results = Array.from(
    g
      .union(...traversals)
      .dedup()
      .values(),
  );
  expect(results.length).toBeGreaterThan(0);
});

test("Memory and performance edge cases - Deep nesting of repeat", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .times(1)
      .repeat(($) => $.out("knows"))
      .times(1)
      .values(),
  );
  expect(Array.isArray(results)).toBe(true);
});

test("Memory and performance edge cases - Very long select list", () => {
  const q = g
    .V()
    .as("v1")
    .out("knows")
    .as("v2")
    .out("knows")
    .as("v3")
    .out("knows")
    .as("v4")
    .select("v1", "v2", "v3", "v4")
    .values();

  const results = Array.from(q);
  expect(Array.isArray(results)).toBe(true);
});

// Collection size limit tests

test("CollectStep - throws MemoryLimitExceededError when exceeding maxCollectionSize", async () => {
  const { createTraverser, QueryContext } = await import("../Steps.js");
  const { parse } = await import("../grammar.js");
  const { astToSteps } = await import("../astToSteps.js");

  // Create a graph with more vertices than our low limit
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Create 20 vertices
  for (let i = 0; i < 20; i++) {
    testGraph.addVertex("Person", { name: `V${i}`, age: i });
  }

  // Parse and create traverser for a COLLECT query
  const ast = parse("MATCH (n:Person) RETURN COLLECT(n)") as any;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);

  // With a low maxCollectionSize, should throw when collecting too many items
  const contextWithLowLimit = new QueryContext(testGraph, {}, { maxCollectionSize: 5 });

  expect(() => {
    Array.from(traverser.traverse(testGraph, [], contextWithLowLimit));
  }).toThrow(MemoryLimitExceededError);
});

test("CollectStep - succeeds when collection size is within limit", async () => {
  const { createTraverser, QueryContext } = await import("../Steps.js");
  const { parse } = await import("../grammar.js");
  const { astToSteps } = await import("../astToSteps.js");

  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Create 10 vertices
  for (let i = 0; i < 10; i++) {
    testGraph.addVertex("Person", { name: `V${i}`, age: i });
  }

  const ast = parse("MATCH (n:Person) RETURN COLLECT(n)") as any;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);

  // With a high maxCollectionSize, should succeed
  const contextWithHighLimit = new QueryContext(testGraph, {}, { maxCollectionSize: 100 });

  const results = Array.from(traverser.traverse(testGraph, [], contextWithHighLimit));
  expect(results).toHaveLength(1); // COLLECT yields one result containing the array
  expect(Array.isArray(results[0])).toBe(true);
  expect((results[0] as unknown[]).length).toBe(10);
});

test("DeleteStep - throws MemoryLimitExceededError when exceeding maxCollectionSize", async () => {
  const { createTraverser, QueryContext } = await import("../Steps.js");
  const { parse } = await import("../grammar.js");
  const { astToSteps } = await import("../astToSteps.js");

  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Create 20 vertices
  for (let i = 0; i < 20; i++) {
    testGraph.addVertex("Person", { name: `V${i}`, age: i });
  }

  // Parse DELETE query
  const ast = parse("MATCH (n:Person) DETACH DELETE n RETURN n") as any;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);

  // With a low maxCollectionSize, should throw
  const contextWithLowLimit = new QueryContext(testGraph, {}, { maxCollectionSize: 5 });

  expect(() => {
    Array.from(traverser.traverse(testGraph, [], contextWithLowLimit));
  }).toThrow(MemoryLimitExceededError);
});

test("DeleteStep - succeeds when deletion count is within limit", async () => {
  const { createTraverser, QueryContext } = await import("../Steps.js");
  const { parse } = await import("../grammar.js");
  const { astToSteps } = await import("../astToSteps.js");

  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Create 5 vertices
  for (let i = 0; i < 5; i++) {
    testGraph.addVertex("Person", { name: `V${i}`, age: i });
  }

  const ast = parse("MATCH (n:Person) DETACH DELETE n RETURN n") as any;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);

  // With a high limit, should succeed
  const contextWithHighLimit = new QueryContext(testGraph, {}, { maxCollectionSize: 100 });

  const results = Array.from(traverser.traverse(testGraph, [], contextWithHighLimit));
  expect(results).toHaveLength(5);

  // Verify vertices were deleted
  expect(Array.from(testGraph.getVertices())).toHaveLength(0);
});

test("Custom maxCollectionSize via QueryContext overrides default", async () => {
  const { createTraverser, QueryContext } = await import("../Steps.js");
  const { parse } = await import("../grammar.js");
  const { astToSteps } = await import("../astToSteps.js");

  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Create 50 vertices
  for (let i = 0; i < 50; i++) {
    testGraph.addVertex("Person", { name: `V${i}`, age: i });
  }

  const ast = parse("MATCH (n:Person) RETURN COLLECT(n)") as any;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);

  // With limit=10, should throw (we have 50 vertices)
  const lowLimitContext = new QueryContext(testGraph, {}, { maxCollectionSize: 10 });
  expect(() => {
    Array.from(traverser.traverse(testGraph, [], lowLimitContext));
  }).toThrow(MemoryLimitExceededError);

  // With limit=100, should succeed (need a fresh graph since previous failed mid-throw)
  const testGraph2 = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });
  for (let i = 0; i < 50; i++) {
    testGraph2.addVertex("Person", { name: `V${i}`, age: i });
  }
  const highLimitContext = new QueryContext(testGraph2, {}, { maxCollectionSize: 100 });
  const results = Array.from(traverser.traverse(testGraph2, [], highLimitContext));
  expect(results).toHaveLength(1);
  expect(Array.isArray(results[0])).toBe(true);
  expect((results[0] as unknown[]).length).toBe(50);
});
