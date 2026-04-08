import { expect, test } from "vitest";
import { createDemoGraph } from "../getDemoGraph.js";
import { GraphTraversal, TraversalPath } from "../Traversals.js";
import { Graph, Vertex, Edge } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import type { Query } from "../AST.js";
import { StandardSchemaV1 } from "@standard-schema/spec";
import type { GraphSchema } from "../GraphSchema.js";

const { graph, alice, bob, charlie, dave, erin, fiona, george } =
  createDemoGraph();
const g = new GraphTraversal(graph);

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().to() with target ID - finds direct path (1 hop)", () => {
  // Alice -> Bob is a direct connection
  const results = Array.from(
    g.V(alice.id).shortestPath().to(bob.id).through("knows").values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!).toBeInstanceOf(Vertex);
  expect(results[0]!.id).toBe(bob.id);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().to() with target ID - finds path through multiple hops", () => {
  // Alice -> Charlie -> Dave (2 hops via knows)
  const results = Array.from(
    g.V(alice.id).shortestPath().to(dave.id).through("knows").values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(dave.id);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().to() with target ID - finds longer paths", () => {
  // Alice -> ... -> Fiona
  const results = Array.from(
    g.V(alice.id).shortestPath().to(fiona.id).through("knows").values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(fiona.id);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().to() with target ID - returns no path when unreachable", () => {
  // Create a disconnected graph to test unreachable vertices
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  const a = testGraph.addVertex("Person", { name: "A", age: 1 });
  const b = testGraph.addVertex("Person", { name: "B", age: 2 });
  // No edge between them

  const g2 = new GraphTraversal(testGraph);
  const results = Array.from(
    g2
      .V(a.id)
      .shortestPath()
      .to(b.id)
      .through("knows")
      .direction("out")
      .values(),
  );

  expect(results.length).toBe(0);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().to() with target ID - handles same source and target", () => {
  const results = Array.from(
    g.V(alice.id).shortestPath().to(alice.id).through("knows").values(),
  );

  // Path of length 0 - same vertex
  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(alice.id);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().to() with condition - finds path to vertex matching property condition", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(["=", "name", "Dave"])
      .through("knows")
      .values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.get("name")).toBe("Dave");
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().to() with condition - finds path to vertex matching age condition", () => {
  const results = Array.from(
    g.V(alice.id).shortestPath().to(["=", "age", 50]).through("knows").values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.get("name")).toBe("Fiona");
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().to() with condition - finds path with complex condition", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(["and", [">", "age", 40], ["<", "age", 55]])
      .through("knows")
      .values(),
  );

  expect(results.length).toBe(1);
  // Should find Erin (45) or Fiona (50)
  const age = (results[0] as Vertex<any, "Person">).get("age");
  expect(age).toBeGreaterThan(40);
  expect(age).toBeLessThan(55);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().to() with traversal function - finds path using traversal condition", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(($) => $.has("name", "Erin"))
      .through("knows")
      .values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.get("name")).toBe("Erin");
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().direction() - finds path using outgoing edges", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(dave.id)
      .through("knows")
      .direction("out")
      .values(),
  );

  expect(results.length).toBe(1);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().direction() - finds path using incoming edges", () => {
  // Erin -> Alice (incoming edge)
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(erin.id)
      .through("knows")
      .direction("in")
      .values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(erin.id);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().direction() - finds path using both directions", () => {
  const results = Array.from(
    g
      .V(charlie.id)
      .shortestPath()
      .to(alice.id)
      .through("knows")
      .direction("both")
      .values(),
  );

  expect(results.length).toBe(1);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().maxDepth() - respects maxDepth limit", () => {
  // With maxDepth=1, can only reach direct neighbors
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(dave.id)
      .through("knows")
      .maxDepth(1)
      .values(),
  );

  // Dave is 2 hops away, so with maxDepth=1, no path should be found
  expect(results.length).toBe(0);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath().maxDepth() - finds path within maxDepth", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(dave.id)
      .through("knows")
      .maxDepth(3)
      .values(),
  );

  expect(results.length).toBe(1);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath() path tracking - tracks full path from source to target", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .as("source")
      .shortestPath()
      .to(dave.id)
      .through("knows")
      .as("target"),
  );

  expect(results.length).toBe(1);
  const path = results[0]!;
  expect(path).toBeInstanceOf(TraversalPath);

  // Check we can retrieve source and target from path
  const source = path.get("source");
  const target = path.get("target");

  expect(source).toBeDefined();
  expect(target).toBeDefined();
  expect(source?.value.id).toBe(alice.id);
  expect(target?.value.id).toBe(dave.id);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath() path tracking - path includes intermediate vertices and edges", () => {
  const results = Array.from(
    g.V(alice.id).shortestPath().to(dave.id).through("knows"),
  );

  expect(results.length).toBe(1);
  const path = results[0]!;

  // Count vertices in path
  let vertexCount = 0;
  let edgeCount = 0;
  for (const node of path) {
    if (node.value instanceof Vertex) {
      vertexCount++;
    } else {
      edgeCount++;
    }
  }

  // Path: Alice -> Edge -> Charlie -> Edge -> Dave
  // Or: Alice -> Edge -> Bob -> Edge -> Charlie -> Edge -> Dave
  // Minimum should be 3 vertices and 2 edges
  expect(vertexCount).toBeGreaterThanOrEqual(3);
  expect(edgeCount).toBeGreaterThanOrEqual(2);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath() from multiple sources - finds shortest path from each source vertex", () => {
  const results = Array.from(
    g.V(alice.id, bob.id).shortestPath().to(dave.id).through("knows").values(),
  );

  // Each source should find a path to Dave
  expect(results.length).toBe(2);
  expect(results.every((v) => v.id === dave.id)).toBe(true);
});

test("Shortest Path - Fluent API (Gremlin-style) - shortestPath() method chaining order - methods can be called in any order", () => {
  // Different ordering should give same results
  const results1 = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(dave.id)
      .through("knows")
      .direction("out")
      .maxDepth(10)
      .values(),
  );

  const results2 = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .maxDepth(10)
      .direction("out")
      .through("knows")
      .to(dave.id)
      .values(),
  );

  expect(results1.length).toBe(results2.length);
  expect(results1[0]!.id).toBe(results2[0]!.id);
});

function executeQuery(queryString: string) {
  const ast = parse(queryString) as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

test("Shortest Path - Query Language - shortestPath() function syntax - parses basic shortestPath query", () => {
  const queryString = `
    MATCH p = shortestPath((a:Person)-[:knows*]->(b:Person))
    WHERE a.name = 'Alice' AND b.name = 'Dave'
    RETURN p
  `;

  const ast = parse(queryString) as Query;
  expect(ast.matches[0]!.pattern.type).toBe("ShortestPathPattern");
});

test("Shortest Path - Query Language - shortestPath() function syntax - executes shortestPath query", () => {
  const queryString = `
    MATCH p = shortestPath((a:Person)-[:knows*]->(b:Person))
    WHERE a.name = 'Alice' AND b.name = 'Dave'
    RETURN p
  `;

  const results = executeQuery(queryString);
  expect(results.length).toBeGreaterThan(0);
});

test("Shortest Path - Query Language - shortestPath() function syntax - parses shortestPath with bidirectional edges", () => {
  const queryString = `
    MATCH shortestPath((a:Person)-[:knows*]-(b:Person))
    WHERE a.name = 'Alice' AND b.name = 'George'
    RETURN b
  `;

  const ast = parse(queryString) as Query;
  expect(ast.matches[0]!.pattern.type).toBe("ShortestPathPattern");
  expect((ast.matches[0]!.pattern as any).edge.direction).toBe("both");
});

test("Shortest Path - Query Language - shortestPath() function syntax - parses shortestPath with max depth", () => {
  const queryString = `
    MATCH shortestPath((a:Person)-[:knows*1..5]->(b:Person))
    WHERE a.name = 'Alice'
    RETURN b
  `;

  const ast = parse(queryString) as Query;
  const pattern = ast.matches[0]!.pattern as any;
  expect(pattern.type).toBe("ShortestPathPattern");
  expect(pattern.edge.quantifier.max).toBe(5);
});

test("Shortest Path - Algorithm Correctness - BFS finds optimal path in unweighted graph", () => {
  // Create a graph where there are multiple paths but one is shorter
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Create a diamond pattern: A -> B -> D, A -> C -> D
  const a = testGraph.addVertex("Person", { name: "A", age: 1 });
  const b = testGraph.addVertex("Person", { name: "B", age: 2 });
  const c = testGraph.addVertex("Person", { name: "C", age: 3 });
  const d = testGraph.addVertex("Person", { name: "D", age: 4 });

  testGraph.addEdge(a, "knows", b, {});
  testGraph.addEdge(b, "knows", d, {});
  testGraph.addEdge(a, "knows", c, {});
  testGraph.addEdge(c, "knows", d, {});

  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2.V(a.id).shortestPath().to(d.id).through("knows"),
  );

  expect(results.length).toBe(1);

  // Count path length
  let pathLength = 0;
  for (const node of results[0]!) {
    if (node.value instanceof Vertex) {
      pathLength++;
    }
  }

  // Path should be A -> B -> D or A -> C -> D (both length 3)
  expect(pathLength).toBe(3);
});

test("Shortest Path - Algorithm Correctness - handles cyclic graphs correctly", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Create a cycle: A -> B -> C -> A
  const a = testGraph.addVertex("Person", { name: "A", age: 1 });
  const b = testGraph.addVertex("Person", { name: "B", age: 2 });
  const c = testGraph.addVertex("Person", { name: "C", age: 3 });

  testGraph.addEdge(a, "knows", b, {});
  testGraph.addEdge(b, "knows", c, {});
  testGraph.addEdge(c, "knows", a, {});

  const g2 = new GraphTraversal(testGraph);

  // Find shortest path from A to C
  const results = Array.from(
    g2.V(a.id).shortestPath().to(c.id).through("knows").values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(c.id);
});

test("Shortest Path - Algorithm Correctness - handles disconnected components", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Two disconnected components
  const a = testGraph.addVertex("Person", { name: "A", age: 1 });
  const b = testGraph.addVertex("Person", { name: "B", age: 2 });
  const c = testGraph.addVertex("Person", { name: "C", age: 3 });
  const d = testGraph.addVertex("Person", { name: "D", age: 4 });

  testGraph.addEdge(a, "knows", b, {});
  testGraph.addEdge(c, "knows", d, {});

  const g2 = new GraphTraversal(testGraph);

  // Try to find path from A to D (unreachable)
  const results = Array.from(
    g2.V(a.id).shortestPath().to(d.id).through("knows").values(),
  );

  expect(results.length).toBe(0);
});

test("Shortest Path - Algorithm Correctness - finds shortest among multiple paths of different lengths", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Create graph: A -> B -> C -> D (long path) and A -> D (direct path)
  const a = testGraph.addVertex("Person", { name: "A", age: 1 });
  const b = testGraph.addVertex("Person", { name: "B", age: 2 });
  const c = testGraph.addVertex("Person", { name: "C", age: 3 });
  const d = testGraph.addVertex("Person", { name: "D", age: 4 });

  testGraph.addEdge(a, "knows", b, {});
  testGraph.addEdge(b, "knows", c, {});
  testGraph.addEdge(c, "knows", d, {});
  testGraph.addEdge(a, "knows", d, {}); // Direct path

  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2.V(a.id).shortestPath().to(d.id).through("knows"),
  );

  expect(results.length).toBe(1);

  // Count path length - should be the direct path (2 vertices)
  let vertexCount = 0;
  for (const node of results[0]!) {
    if (node.value instanceof Vertex) {
      vertexCount++;
    }
  }

  // Direct path: A -> D (2 vertices)
  expect(vertexCount).toBe(2);
});

test("Shortest Path - Performance - handles large graphs efficiently", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Create a chain of 100 vertices
  const vertices: Vertex<any, any>[] = [];
  for (let i = 0; i < 100; i++) {
    vertices.push(
      testGraph.addVertex("Person", { name: `Person${i}`, age: i }),
    );
  }

  // Connect them in a chain
  for (let i = 0; i < vertices.length - 1; i++) {
    testGraph.addEdge(vertices[i]!, "knows", vertices[i + 1]!, {});
  }

  const g2 = new GraphTraversal(testGraph);
  const start = Date.now();

  const results = Array.from(
    g2
      .V(vertices[0]!.id)
      .shortestPath()
      .to(vertices[99]!.id)
      .through("knows")
      .values(),
  );

  const duration = Date.now() - start;

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(vertices[99]!.id);
  expect(duration).toBeLessThan(1000); // Should complete quickly
});

test("Shortest Path - Performance - handles wide graphs efficiently", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Create a star graph with 100 vertices connected to center
  const center = testGraph.addVertex("Person", { name: "Center", age: 0 });
  const spokes: Vertex<any, any>[] = [];
  for (let i = 0; i < 100; i++) {
    const spoke = testGraph.addVertex("Person", {
      name: `Spoke${i}`,
      age: i + 1,
    });
    spokes.push(spoke);
    testGraph.addEdge(center, "knows", spoke, {});
  }

  // Connect last spoke to a target
  const target = testGraph.addVertex("Person", { name: "Target", age: 999 });
  testGraph.addEdge(spokes[99]!, "knows", target, {});

  const g2 = new GraphTraversal(testGraph);
  const start = Date.now();

  const results = Array.from(
    g2.V(center.id).shortestPath().to(target.id).through("knows").values(),
  );

  const duration = Date.now() - start;

  expect(results.length).toBe(1);
  expect(results[0]!.get("name")).toBe("Target");
  expect(duration).toBeLessThan(1000);
});

// Helper function to create a type validator
function makeType<T>(_defaultValue: T): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "codemix",
      validate: (value) => ({ value: value as T }),
    },
  };
}

// Schema with weighted edges for Dijkstra tests
const weightedSchema = {
  vertices: {
    Node: {
      properties: {
        name: { type: makeType("") },
        value: { type: makeType(0) },
      },
    },
  },
  edges: {
    connects: {
      properties: {
        weight: { type: makeType(0) },
        cost: { type: makeType(0) },
      },
    },
    link: {
      properties: {},
    },
  },
} as const satisfies GraphSchema;

type WeightedSchema = typeof weightedSchema;

test("Shortest Path - Weighted Graphs (Dijkstra) - finds shortest weighted path when direct path is heavier", () => {
  const testGraph = new Graph<WeightedSchema>({
    schema: weightedSchema,
    storage: new InMemoryGraphStorage(),
  });

  // A --10--> B --1--> C
  // A --15--> C (direct but heavier)
  const a = testGraph.addVertex("Node", { name: "A", value: 1 });
  const b = testGraph.addVertex("Node", { name: "B", value: 2 });
  const c = testGraph.addVertex("Node", { name: "C", value: 3 });

  testGraph.addEdge(a, "connects", b, { weight: 10, cost: 0 });
  testGraph.addEdge(b, "connects", c, { weight: 1, cost: 0 });
  testGraph.addEdge(a, "connects", c, { weight: 15, cost: 0 }); // Direct but heavier

  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2.V(a.id).shortestPath().to(c.id).through("connects").weightedBy("weight"),
  );

  expect(results.length).toBe(1);

  // Should take path A -> B -> C (total weight 11) instead of A -> C (weight 15)
  let vertexCount = 0;
  for (const node of results[0]!) {
    if (node.value instanceof Vertex) {
      vertexCount++;
    }
  }
  expect(vertexCount).toBe(3); // A, B, C
});

test("Shortest Path - Weighted Graphs (Dijkstra) - prefers direct path when it has lower weight", () => {
  const testGraph = new Graph<WeightedSchema>({
    schema: weightedSchema,
    storage: new InMemoryGraphStorage(),
  });

  // A --100--> B --100--> C
  // A --5--> C (direct and lighter)
  const a = testGraph.addVertex("Node", { name: "A", value: 1 });
  const b = testGraph.addVertex("Node", { name: "B", value: 2 });
  const c = testGraph.addVertex("Node", { name: "C", value: 3 });

  testGraph.addEdge(a, "connects", b, { weight: 100, cost: 0 });
  testGraph.addEdge(b, "connects", c, { weight: 100, cost: 0 });
  testGraph.addEdge(a, "connects", c, { weight: 5, cost: 0 }); // Direct and lighter

  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2.V(a.id).shortestPath().to(c.id).through("connects").weightedBy("weight"),
  );

  expect(results.length).toBe(1);

  // Should take direct path A -> C (weight 5)
  let vertexCount = 0;
  for (const node of results[0]!) {
    if (node.value instanceof Vertex) {
      vertexCount++;
    }
  }
  expect(vertexCount).toBe(2); // A, C (direct)
});

test("Shortest Path - Weighted Graphs (Dijkstra) - handles complex weighted graph", () => {
  const testGraph = new Graph<WeightedSchema>({
    schema: weightedSchema,
    storage: new InMemoryGraphStorage(),
  });

  // Create a graph with multiple paths:
  //     B
  //    /2\3
  //   A   D
  //    \1/2
  //     C
  const a = testGraph.addVertex("Node", { name: "A", value: 1 });
  const b = testGraph.addVertex("Node", { name: "B", value: 2 });
  const c = testGraph.addVertex("Node", { name: "C", value: 3 });
  const d = testGraph.addVertex("Node", { name: "D", value: 4 });

  testGraph.addEdge(a, "connects", b, { weight: 2, cost: 0 });
  testGraph.addEdge(b, "connects", d, { weight: 3, cost: 0 });
  testGraph.addEdge(a, "connects", c, { weight: 1, cost: 0 });
  testGraph.addEdge(c, "connects", d, { weight: 2, cost: 0 });

  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2.V(a.id).shortestPath().to(d.id).through("connects").weightedBy("weight"),
  );

  expect(results.length).toBe(1);

  // Should take path A -> C -> D (weight 1+2=3) over A -> B -> D (weight 2+3=5)
  const pathNames: string[] = [];
  for (const node of results[0]!) {
    if (node.value instanceof Vertex) {
      pathNames.push(node.value.get("name"));
    }
  }
  expect(pathNames).toEqual(["A", "C", "D"]);
});

test("Shortest Path - Weighted Graphs (Dijkstra) - uses different weight property", () => {
  const testGraph = new Graph<WeightedSchema>({
    schema: weightedSchema,
    storage: new InMemoryGraphStorage(),
  });

  const a = testGraph.addVertex("Node", { name: "A", value: 1 });
  const b = testGraph.addVertex("Node", { name: "B", value: 2 });
  const c = testGraph.addVertex("Node", { name: "C", value: 3 });

  // weight favors direct path, cost favors indirect path
  testGraph.addEdge(a, "connects", b, { weight: 100, cost: 1 });
  testGraph.addEdge(b, "connects", c, { weight: 100, cost: 1 });
  testGraph.addEdge(a, "connects", c, { weight: 5, cost: 50 });

  const g2 = new GraphTraversal(testGraph);

  // Using weight: should take direct A -> C
  const resultsWeight = Array.from(
    g2.V(a.id).shortestPath().to(c.id).through("connects").weightedBy("weight"),
  );

  let vertexCountWeight = 0;
  for (const node of resultsWeight[0]!) {
    if (node.value instanceof Vertex) vertexCountWeight++;
  }
  expect(vertexCountWeight).toBe(2); // Direct path

  // Using cost: should take A -> B -> C
  const resultsCost = Array.from(
    g2.V(a.id).shortestPath().to(c.id).through("connects").weightedBy("cost"),
  );

  let vertexCountCost = 0;
  for (const node of resultsCost[0]!) {
    if (node.value instanceof Vertex) vertexCountCost++;
  }
  expect(vertexCountCost).toBe(3); // Indirect path
});

test("Shortest Path - Weighted Graphs (Dijkstra) - handles zero-weight edges", () => {
  const testGraph = new Graph<WeightedSchema>({
    schema: weightedSchema,
    storage: new InMemoryGraphStorage(),
  });

  const a = testGraph.addVertex("Node", { name: "A", value: 1 });
  const b = testGraph.addVertex("Node", { name: "B", value: 2 });
  const c = testGraph.addVertex("Node", { name: "C", value: 3 });

  testGraph.addEdge(a, "connects", b, { weight: 0, cost: 0 });
  testGraph.addEdge(b, "connects", c, { weight: 0, cost: 0 });

  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2
      .V(a.id)
      .shortestPath()
      .to(c.id)
      .through("connects")
      .weightedBy("weight")
      .values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.get("name")).toBe("C");
});

test("Shortest Path - Weighted Graphs (Dijkstra) - falls back to BFS when weight property is missing", () => {
  const testGraph = new Graph<WeightedSchema>({
    schema: weightedSchema,
    storage: new InMemoryGraphStorage(),
  });

  const a = testGraph.addVertex("Node", { name: "A", value: 1 });
  const b = testGraph.addVertex("Node", { name: "B", value: 2 });

  testGraph.addEdge(a, "link", b, {}); // 'link' has no weight property

  const g2 = new GraphTraversal(testGraph);

  // Should still work using BFS (weight defaults to 1)
  const results = Array.from(
    g2
      .V(a.id)
      .shortestPath()
      .to(b.id)
      .through("link")
      .weightedBy("weight") // Property doesn't exist on 'link' edges
      .values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.get("name")).toBe("B");
});

test("Shortest Path - Edge Cases - handles single vertex (source = target)", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  const a = testGraph.addVertex("Person", { name: "A", age: 1 });
  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(g2.V(a.id).shortestPath().to(a.id).values());

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(a.id);
});

test("Shortest Path - Edge Cases - handles empty graph (no edges)", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  const a = testGraph.addVertex("Person", { name: "A", age: 1 });
  const b = testGraph.addVertex("Person", { name: "B", age: 2 });
  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(g2.V(a.id).shortestPath().to(b.id).values());

  expect(results.length).toBe(0);
});

test("Shortest Path - Edge Cases - handles self-loop edge", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  const a = testGraph.addVertex("Person", { name: "A", age: 1 });
  const b = testGraph.addVertex("Person", { name: "B", age: 2 });
  testGraph.addEdge(a, "knows", a, {}); // Self loop
  testGraph.addEdge(a, "knows", b, {});
  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2.V(a.id).shortestPath().to(b.id).through("knows").values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(b.id);
});

test("Shortest Path - Edge Cases - handles multiple edges between same vertices", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  const a = testGraph.addVertex("Person", { name: "A", age: 1 });
  const b = testGraph.addVertex("Person", { name: "B", age: 2 });
  testGraph.addEdge(a, "knows", b, {});
  testGraph.addEdge(a, "knows", b, {}); // Duplicate edge
  testGraph.addEdge(a, "likes", b, {}); // Different label
  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2.V(a.id).shortestPath().to(b.id).through("knows").values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(b.id);
});

test("Shortest Path - Edge Cases - handles maxDepth of 0", () => {
  const results = Array.from(
    g.V(alice.id).shortestPath().to(bob.id).maxDepth(0).values(),
  );

  // maxDepth 0 means only source can match
  expect(results.length).toBe(0);
});

test("Shortest Path - Edge Cases - handles condition that matches no vertices", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(["=", "name", "NonexistentPerson"])
      .through("knows")
      .values(),
  );

  expect(results.length).toBe(0);
});

test("Shortest Path - Edge Cases - handles non-existent source vertex", () => {
  const results = Array.from(
    g
      .V("non-existent-id" as any)
      .shortestPath()
      .to(bob.id)
      .through("knows")
      .values(),
  );

  expect(results.length).toBe(0);
});

test("Shortest Path - Edge Cases - handles non-existent target vertex ID", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to("non-existent-id" as any)
      .through("knows")
      .values(),
  );

  expect(results.length).toBe(0);
});

test("Shortest Path - Edge Cases - handles empty edge labels filter", () => {
  // When no edge labels specified, should consider all edges
  const results = Array.from(g.V(alice.id).shortestPath().to(bob.id).values());

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(bob.id);
});

test("Shortest Path - Edge Cases - handles multiple edge label filters", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(["=", "name", "Banana"])
      .through("knows", "likes")
      .values(),
  );

  // Alice -> Bob -> Banana (via knows and likes)
  expect(results.length).toBe(1);
  expect(results[0]!.get("name")).toBe("Banana");
});

test("Shortest Path - Boundary Conditions - maxDepth = 1 finds only direct neighbors", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(bob.id)
      .through("knows")
      .maxDepth(1)
      .values(),
  );

  // Bob is direct neighbor of Alice
  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(bob.id);
});

test("Shortest Path - Boundary Conditions - maxDepth exactly matches path length", () => {
  // Alice -> Charlie -> Dave (2 hops)
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(dave.id)
      .through("knows")
      .maxDepth(2)
      .values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(dave.id);
});

test("Shortest Path - Boundary Conditions - maxDepth one less than path length returns no results", () => {
  // Alice -> Charlie -> Dave is 2 hops minimum
  // With maxDepth=1, should not find
  // But Alice -> Bob -> Charlie -> Dave could be 3 hops
  // The actual shortest path might be different based on graph structure
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(fiona.id) // Fiona is far away
      .through("knows")
      .maxDepth(2) // Too short to reach
      .values(),
  );

  expect(results.length).toBe(0);
});

test("Shortest Path - Boundary Conditions - very large maxDepth does not cause issues", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(dave.id)
      .through("knows")
      .maxDepth(1000000)
      .values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(dave.id);
});

test("Shortest Path - Direction Combinations - direction out - cannot traverse incoming edges", () => {
  // George -> Charlie is an edge in the graph
  // From Charlie with direction="out", we cannot reach George
  const results = Array.from(
    g
      .V(charlie.id)
      .shortestPath()
      .to(george.id)
      .through("knows")
      .direction("out")
      .values(),
  );

  expect(results.length).toBe(0);
});

test("Shortest Path - Direction Combinations - direction in - can traverse incoming edges", () => {
  // George -> Charlie is an edge
  // From Charlie with direction="in", we can reach George
  const results = Array.from(
    g
      .V(charlie.id)
      .shortestPath()
      .to(george.id)
      .through("knows")
      .direction("in")
      .values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(george.id);
});

test("Shortest Path - Direction Combinations - direction both - can use any edge", () => {
  // Should find paths in either direction
  const results = Array.from(
    g
      .V(charlie.id)
      .shortestPath()
      .to(alice.id)
      .through("knows")
      .direction("both")
      .values(),
  );

  expect(results.length).toBe(1);
});

test("Shortest Path - Complex Conditions - finds vertex with OR condition", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(["or", ["=", "name", "Dave"], ["=", "name", "Erin"]])
      .through("knows")
      .values(),
  );

  // Should find Dave (closer) or Erin
  expect(results.length).toBe(1);
  const name = results[0]!.get("name");
  expect(["Dave", "Erin"]).toContain(name);
});

test("Shortest Path - Complex Conditions - finds vertex with NOT condition", () => {
  // Find first vertex that is not Alice, Bob, or Charlie
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to([
        "and",
        ["!=", "name", "Alice"],
        ["!=", "name", "Bob"],
        ["!=", "name", "Charlie"],
      ])
      .through("knows")
      .values(),
  );

  expect(results.length).toBe(1);
  const name = results[0]!.get("name");
  expect(["Alice", "Bob", "Charlie"]).not.toContain(name);
});

test("Shortest Path - Complex Conditions - finds vertex with numeric range condition", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(["and", [">=", "age", 35], ["<=", "age", 45]])
      .through("knows")
      .values(),
  );

  expect(results.length).toBe(1);
  const age = (results[0] as Vertex<any, "Person">).get("age");
  expect(age).toBeGreaterThanOrEqual(35);
  expect(age).toBeLessThanOrEqual(45);
});

test("Shortest Path - Path Content Validation - path alternates between vertices and edges", () => {
  const results = Array.from(
    g.V(alice.id).shortestPath().to(dave.id).through("knows"),
  );

  expect(results.length).toBe(1);
  const path = results[0]!;

  // Convert to array for easier inspection
  const elements: Array<Vertex<any, any> | Edge<any, any>> = [];
  for (const node of path) {
    elements.push(node.value);
  }

  // First element should be source vertex
  expect(elements[0]).toBeInstanceOf(Vertex);
  expect((elements[0] as Vertex<any, any>).id).toBe(alice.id);

  // Last element should be target vertex
  expect(elements[elements.length - 1]).toBeInstanceOf(Vertex);
  expect((elements[elements.length - 1] as Vertex<any, any>).id).toBe(dave.id);

  // Should alternate vertex-edge-vertex-edge-...
  for (let i = 0; i < elements.length; i++) {
    if (i % 2 === 0) {
      expect(elements[i]).toBeInstanceOf(Vertex);
    } else {
      expect(elements[i]).toBeInstanceOf(Edge);
    }
  }
});

test("Shortest Path - Path Content Validation - path edges have correct labels", () => {
  const results = Array.from(
    g.V(alice.id).shortestPath().to(dave.id).through("knows"),
  );

  expect(results.length).toBe(1);
  const path = results[0]!;

  for (const node of path) {
    if (node.value instanceof Edge) {
      expect(node.value.label).toBe("knows");
    }
  }
});

test("Shortest Path - Path Content Validation - path edges connect consecutive vertices", () => {
  const results = Array.from(
    g.V(alice.id).shortestPath().to(dave.id).through("knows"),
  );

  expect(results.length).toBe(1);
  const path = results[0]!;

  const elements: Array<Vertex<any, any> | Edge<any, any>> = [];
  for (const node of path) {
    elements.push(node.value);
  }

  // Verify edges connect consecutive vertices
  for (let i = 1; i < elements.length - 1; i += 2) {
    const prevVertex = elements[i - 1] as Vertex<any, any>;
    const edge = elements[i] as Edge<any, any>;
    const nextVertex = elements[i + 1] as Vertex<any, any>;

    // Edge should connect prevVertex to nextVertex (using inV/outV)
    expect(
      (edge.outV.id === prevVertex.id && edge.inV.id === nextVertex.id) ||
        (edge.inV.id === prevVertex.id && edge.outV.id === nextVertex.id),
    ).toBe(true);
  }
});

function _executeQuery(queryString: string) {
  const ast = parse(queryString) as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

test("Shortest Path - Query Language Extended - parses allShortestPaths function", () => {
  const queryString = `
    MATCH p = allShortestPaths((a:Person)-[:knows*]->(b:Person))
    WHERE a.name = 'Alice' AND b.name = 'Dave'
    RETURN p
  `;

  const ast = parse(queryString) as Query;
  expect(ast.matches[0]!.pattern.type).toBe("ShortestPathPattern");
  expect((ast.matches[0]!.pattern as any).all).toBe(true);
});

test("Shortest Path - Query Language Extended - handles multiple edge types in query", () => {
  const queryString = `
    MATCH shortestPath((a:Person)-[:knows|likes*]->(b))
    WHERE a.name = 'Alice'
    RETURN b
  `;

  const ast = parse(queryString) as Query;
  const pattern = ast.matches[0]!.pattern as any;
  expect(pattern.edge.labels).toContain("knows");
  expect(pattern.edge.labels).toContain("likes");
});

test("Shortest Path - Query Language Extended - handles incoming edge direction in query", () => {
  const queryString = `
    MATCH shortestPath((a:Person)<-[:knows*]-(b:Person))
    WHERE b.name = 'George'
    RETURN a
  `;

  const ast = parse(queryString) as Query;
  const pattern = ast.matches[0]!.pattern as any;
  expect(pattern.edge.direction).toBe("in");
});

test("Shortest Path - Multiple Sources - finds paths from all source vertices", () => {
  const results = Array.from(
    g
      .V(alice.id, bob.id, charlie.id)
      .shortestPath()
      .to(dave.id)
      .through("knows")
      .values(),
  );

  // Each source should find a path
  expect(results.length).toBe(3);
  expect(results.every((v) => v.id === dave.id)).toBe(true);
});

test("Shortest Path - Multiple Sources - finds paths with different lengths from different sources", () => {
  // Alice is farther from Fiona than Erin
  const resultsFromAlice = Array.from(
    g.V(alice.id).shortestPath().to(fiona.id).through("knows"),
  );

  const resultsFromErin = Array.from(
    g.V(erin.id).shortestPath().to(fiona.id).through("knows"),
  );

  // Count path lengths
  let alicePathLength = 0;
  let erinPathLength = 0;

  for (const node of resultsFromAlice[0]!) {
    if (node.value instanceof Vertex) alicePathLength++;
  }

  for (const node of resultsFromErin[0]!) {
    if (node.value instanceof Vertex) erinPathLength++;
  }

  // Erin should be closer to Fiona
  expect(erinPathLength).toBeLessThan(alicePathLength);
});

test("Shortest Path - Multiple Sources - handles mixed reachable and unreachable targets", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  const a = testGraph.addVertex("Person", { name: "A", age: 1 });
  const b = testGraph.addVertex("Person", { name: "B", age: 2 });
  const c = testGraph.addVertex("Person", { name: "C", age: 3 });
  const target = testGraph.addVertex("Person", { name: "Target", age: 99 });

  testGraph.addEdge(a, "knows", target, {});
  // b and c have no path to target

  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2
      .V(a.id, b.id, c.id)
      .shortestPath()
      .to(target.id)
      .through("knows")
      .values(),
  );

  // Only a can reach target
  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(target.id);
});

test("Shortest Path - Type Safety - through() accepts valid edge labels from schema", () => {
  // This test verifies type safety at compile time
  // Using "knows" and "likes" which are valid edge labels
  const results = Array.from(
    g.V(alice.id).shortestPath().to(bob.id).through("knows").values(),
  );

  expect(results.length).toBe(1);
});

test("Shortest Path - Type Safety - weightedBy() works with valid edge property", () => {
  const testGraph = new Graph<WeightedSchema>({
    schema: weightedSchema,
    storage: new InMemoryGraphStorage(),
  });

  const a = testGraph.addVertex("Node", { name: "A", value: 1 });
  const b = testGraph.addVertex("Node", { name: "B", value: 2 });
  testGraph.addEdge(a, "connects", b, { weight: 10, cost: 5 });

  const g2 = new GraphTraversal(testGraph);

  // Both "weight" and "cost" are valid properties on "connects" edges
  const resultsWeight = Array.from(
    g2
      .V(a.id)
      .shortestPath()
      .to(b.id)
      .through("connects")
      .weightedBy("weight")
      .values(),
  );

  const resultsCost = Array.from(
    g2
      .V(a.id)
      .shortestPath()
      .to(b.id)
      .through("connects")
      .weightedBy("cost")
      .values(),
  );

  expect(resultsWeight.length).toBe(1);
  expect(resultsCost.length).toBe(1);
});

test("Shortest Path - Type Safety - to() with traversal function has proper types", () => {
  // The $ parameter should have vertex traversal methods
  const results = Array.from(
    g
      .V(alice.id)
      .shortestPath()
      .to(($) => $.has("age", ">", 40))
      .through("knows")
      .values(),
  );

  expect(results.length).toBe(1);
  expect((results[0] as Vertex<any, "Person">).get("age")).toBeGreaterThan(40);
});

// Simple test schema for error handling tests
const testSchema = {
  vertices: {
    Node: {
      properties: {
        name: {
          type: {
            "~standard": {
              version: 1,
              vendor: "test",
              validate: (v: any) => ({ value: v as string }),
            },
          },
        },
      },
    },
  },
  edges: {
    connects: {
      properties: {
        weight: {
          type: {
            "~standard": {
              version: 1,
              vendor: "test",
              validate: (v: any) => ({ value: v }),
            },
          },
        },
      },
    },
  },
} as const satisfies GraphSchema;

test("Shortest Path - Error Handling - allShortestPaths() not implemented - throws error when using allShortestPaths() in query", () => {
  const queryString = `
    MATCH p = allShortestPaths((a:Person)-[:knows*]->(b:Person))
    WHERE a.name = 'Alice' AND b.name = 'Dave'
    RETURN p
  `;

  expect(() => {
    const ast = parse(queryString) as Query;
    astToSteps(ast);
  }).toThrow("allShortestPaths() is not yet implemented");
});

test("Shortest Path - Error Handling - allShortestPaths() not implemented - shortestPath() works without throwing", () => {
  const queryString = `
    MATCH p = shortestPath((a:Person)-[:knows*]->(b:Person))
    WHERE a.name = 'Alice' AND b.name = 'Dave'
    RETURN p
  `;

  expect(() => {
    const ast = parse(queryString) as Query;
    astToSteps(ast);
  }).not.toThrow();
});

test("Shortest Path - Error Handling - negative weight handling - skips edges with negative weights", () => {
  // Create a graph with negative weights
  const storage = new InMemoryGraphStorage();
  const graph2 = new Graph({
    schema: testSchema,
    storage,
  });

  const v1 = graph2.addVertex("Node", { name: "A" });
  const v2 = graph2.addVertex("Node", { name: "B" });
  const v3 = graph2.addVertex("Node", { name: "C" });

  // Direct path A->B with negative weight (should be skipped)
  graph2.addEdge(v1, "connects", v2, { weight: -5 });

  // Alternative path A->C->B with positive weights
  graph2.addEdge(v1, "connects", v3, { weight: 2 });
  graph2.addEdge(v3, "connects", v2, { weight: 3 });

  const g2 = new GraphTraversal(graph2);

  const results = Array.from(
    g2
      .V(v1.id)
      .shortestPath()
      .to(v2.id)
      .through("connects")
      .weightedBy("weight")
      .values(),
  );

  // Should find the path through C (total weight 5) instead of direct negative weight
  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(v2.id);
});

test("Shortest Path - Error Handling - negative weight handling - handles zero weight edges correctly", () => {
  // Create a graph with zero weights
  const storage = new InMemoryGraphStorage();
  const graph2 = new Graph({
    schema: testSchema,
    storage,
  });

  const v1 = graph2.addVertex("Node", { name: "A" });
  const v2 = graph2.addVertex("Node", { name: "B" });

  // Zero weight edge should work
  graph2.addEdge(v1, "connects", v2, { weight: 0 });

  const g2 = new GraphTraversal(graph2);

  const results = Array.from(
    g2
      .V(v1.id)
      .shortestPath()
      .to(v2.id)
      .through("connects")
      .weightedBy("weight")
      .values(),
  );

  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(v2.id);
});

test("Shortest Path - Error Handling - invalid weight handling - defaults to weight 1 for missing weight property", () => {
  const storage = new InMemoryGraphStorage();
  const graph2 = new Graph({
    schema: testSchema,
    storage,
  });

  const v1 = graph2.addVertex("Node", { name: "A" });
  const v2 = graph2.addVertex("Node", { name: "B" });

  // Edge without weight property
  graph2.addEdge(v1, "connects", v2, {});

  const g2 = new GraphTraversal(graph2);

  const results = Array.from(
    g2
      .V(v1.id)
      .shortestPath()
      .to(v2.id)
      .through("connects")
      .weightedBy("weight")
      .values(),
  );

  // Should find path with default weight of 1
  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(v2.id);
});

test("Shortest Path - Error Handling - invalid weight handling - skips edges with non-numeric weights", () => {
  const storage = new InMemoryGraphStorage();
  const graph2 = new Graph({
    schema: testSchema,
    storage,
  });

  const v1 = graph2.addVertex("Node", { name: "A" });
  const v2 = graph2.addVertex("Node", { name: "B" });
  const v3 = graph2.addVertex("Node", { name: "C" });

  // Direct path A->B with invalid weight (should be skipped)
  graph2.addEdge(v1, "connects", v2, { weight: "invalid" as any });

  // Alternative path A->C->B with valid weights
  graph2.addEdge(v1, "connects", v3, { weight: 2 });
  graph2.addEdge(v3, "connects", v2, { weight: 3 });

  const g2 = new GraphTraversal(graph2);

  const results = Array.from(
    g2
      .V(v1.id)
      .shortestPath()
      .to(v2.id)
      .through("connects")
      .weightedBy("weight")
      .values(),
  );

  // Should find the path through C instead of the edge with invalid weight
  expect(results.length).toBe(1);
  expect(results[0]!.id).toBe(v2.id);
});
