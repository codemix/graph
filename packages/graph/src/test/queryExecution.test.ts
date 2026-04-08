import { test, expect } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph } from "../Graph.js";
import { GraphSchema } from "../GraphSchema.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, stringifySteps } from "../Steps.js";
import type { Query } from "../AST.js";

function makeType<T>(_defaultValue: T): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "codemix",
      validate: (value) => {
        return { value: value as T };
      },
    },
  };
}

// Helper function to execute a query string against a graph
function executeQuery(
  graph: Graph<GraphSchema>,
  queryString: string,
  debug: boolean = false,
): unknown[] {
  const ast = parse(queryString) as Query;
  const steps = astToSteps(ast);
  if (debug) {
    console.log(stringifySteps(steps));
  }
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

function setupQueryExecutionGraph(): Graph<GraphSchema> {
  // Create a simple schema
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
    },
    edges: {
      follows: {
        properties: {},
      },
      likes: {
        properties: {},
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add some test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    active: true,
  });
  const bob = graph.addVertex("User", { name: "Bob", age: 30, active: true });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    active: false,
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    active: true,
  });

  // Create some relationships
  graph.addEdge(alice.id, "follows", bob.id, {});
  graph.addEdge(alice.id, "follows", charlie.id, {});
  graph.addEdge(bob.id, "follows", david.id, {});
  graph.addEdge(charlie.id, "follows", alice.id, {});
  graph.addEdge(alice.id, "likes", bob.id, {});

  return graph;
}

test("Query Execution End-to-End - Simple vertex queries - should fetch all users", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(graph, "MATCH (u:User) RETURN u");
  expect(results).toHaveLength(4);
});

test("Query Execution End-to-End - Simple vertex queries - should filter users by age", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.age > 25 RETURN u",
  );
  expect(results).toHaveLength(2); // Bob (30) and David (35)
});

test("Query Execution End-to-End - Simple vertex queries - should filter users by active status", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.active = true RETURN u",
  );
  expect(results).toHaveLength(3); // Alice, Bob, David
});

test("Query Execution End-to-End - Edge traversal queries - should find users that Alice follows", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    'MATCH (u:User)-[:follows]->(f) WHERE u.name = "Alice" RETURN f',
  );
  // Alice follows Bob and Charlie, filter should keep both traversal results
  expect(results.length).toBeGreaterThanOrEqual(1);
  expect(results.length).toBeLessThanOrEqual(2);
});

test("Query Execution End-to-End - Edge traversal queries - should find followers of Bob", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    'MATCH (u:User)<-[:follows]-(f) WHERE u.name = "Bob" RETURN f',
  );
  expect(results).toHaveLength(1); // Alice
});

test("Query Execution End-to-End - Edge traversal queries - should handle multiple edge types", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    'MATCH (u:User)-[:follows|likes]->(f) WHERE u.name = "Alice" RETURN f',
  );
  // Alice follows Bob and Charlie, and likes Bob
  // Without DISTINCT, Bob might appear once or twice depending on traversal
  expect(results.length).toBeGreaterThanOrEqual(1);
});

test("Query Execution End-to-End - Multi-hop queries - should find second-degree connections", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    'MATCH (u:User)-[:follows]->(f)-[:follows]->(ff) WHERE u.name = "Alice" RETURN ff',
  );
  // Alice follows Bob and Charlie
  // Bob follows David
  // Charlie follows Alice
  expect(results.length).toBeGreaterThanOrEqual(1);
});

test("Query Execution End-to-End - Multi-hop queries - should handle variable-length paths", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    'MATCH (u:User)-[:follows*2]->(f) WHERE u.name = "Alice" RETURN f',
  );
  expect(results.length).toBeGreaterThan(0);
});

test("Query Execution End-to-End - Aggregation queries - should count all users", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(graph, "MATCH (u:User) RETURN COUNT(u)");
  expect(results).toHaveLength(1);
  expect(results[0]).toBe(4);
});

test("Query Execution End-to-End - Aggregation queries - should count filtered users", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.age > 25 RETURN COUNT(u)",
  );
  expect(results[0]).toBe(2);
});

test("Query Execution End-to-End - Complex condition queries - should handle AND conditions", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.age > 20 AND u.active = true RETURN u",
  );
  expect(results).toHaveLength(3); // Alice (25), Bob (30), David (35)
});

test("Query Execution End-to-End - Complex condition queries - should handle OR conditions", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE u.age < 25 OR u.name = "David" RETURN u',
  );
  expect(results).toHaveLength(2); // Charlie (20) and David (35)
});

test("Query Execution End-to-End - LIMIT and SKIP - should limit results", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(graph, "MATCH (u:User) RETURN u LIMIT 2");
  expect(results).toHaveLength(2);
});

test("Query Execution End-to-End - LIMIT and SKIP - should skip results", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(graph, "MATCH (u:User) RETURN u SKIP 2");
  expect(results).toHaveLength(2); // 4 total - 2 skipped = 2
});

test("Query Execution End-to-End - LIMIT and SKIP - should handle SKIP and LIMIT together", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(graph, "MATCH (u:User) RETURN u SKIP 1 LIMIT 2");
  expect(results).toHaveLength(2);
});

test("Query Execution End-to-End - DISTINCT queries - should deduplicate results", () => {
  const graph = setupQueryExecutionGraph();
  // Alice follows both Bob and Charlie, and also likes Bob
  // Without DISTINCT: Bob appears twice (via follows and likes)
  // With DISTINCT: Bob should appear once

  // First verify duplicates exist without DISTINCT
  const withoutDistinct = executeQuery(
    graph,
    'MATCH (u:User)-[:follows|likes]->(f) WHERE u.name = "Alice" RETURN f',
  );
  // Should have 3 results: Bob (follows), Charlie (follows), Bob (likes)
  expect(withoutDistinct).toHaveLength(3);

  // Now verify DISTINCT removes the duplicate
  const withDistinct = executeQuery(
    graph,
    'MATCH (u:User)-[:follows|likes]->(f) WHERE u.name = "Alice" RETURN DISTINCT f',
  );
  // Should have 2 unique results: Bob and Charlie
  expect(withDistinct).toHaveLength(2);

  // Verify all results are unique vertices
  // Results are wrapped in arrays by SelectStep/ValuesStep, so extract the vertex
  const uniqueIds = new Set(
    withDistinct.map((r: any) => (Array.isArray(r) ? r[0]?.id : r.id)),
  );
  expect(uniqueIds.size).toBe(2);
});

test("Query Execution End-to-End - Real-world scenarios - should find active users followed by Alice", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    `MATCH (u:User)-[:follows]->(f:User)
     WHERE u.name = "Alice" AND f.active = true
     RETURN f`,
  );
  expect(results).toHaveLength(1); // Only Bob (Charlie is inactive)
});

test("Query Execution End-to-End - Real-world scenarios - should find the most connected users", () => {
  const graph = setupQueryExecutionGraph();
  // This is a simplified version - we'd need more data for a real test
  const results = executeQuery(
    graph,
    "MATCH (u:User)-[:follows]->(f) RETURN u LIMIT 5",
  );
  expect(results.length).toBeGreaterThan(0);
});

// Tests for labels() function
function setupMultiLabelGraph(): Graph<GraphSchema> {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
      Post: {
        properties: {
          title: { type: makeType<string>("") },
        },
      },
      Comment: {
        properties: {
          text: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      wrote: {
        properties: {},
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add vertices with different labels
  const alice = graph.addVertex("User", { name: "Alice" });
  const bob = graph.addVertex("User", { name: "Bob" });
  const post1 = graph.addVertex("Post", { title: "Hello World" });
  const post2 = graph.addVertex("Post", { title: "Second Post" });
  const comment1 = graph.addVertex("Comment", { text: "Nice post!" });

  graph.addEdge(alice.id, "wrote", post1.id, {});
  graph.addEdge(bob.id, "wrote", post2.id, {});
  graph.addEdge(alice.id, "wrote", comment1.id, {});

  return graph;
}

test("Query Execution End-to-End - labels() function - should return labels for a single vertex", () => {
  const graph = setupMultiLabelGraph();
  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE u.name = "Alice" RETURN labels(u)',
  );
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual(["User"]);
});

test("Query Execution End-to-End - labels() function - should return labels for all vertices", () => {
  const graph = setupMultiLabelGraph();
  const results = executeQuery(graph, "MATCH (n) RETURN labels(n)");
  expect(results).toHaveLength(5); // 2 Users, 2 Posts, 1 Comment

  // All results should be arrays with exactly one label
  for (const result of results) {
    expect(Array.isArray(result)).toBe(true);
    expect((result as string[]).length).toBe(1);
  }
});

test("Query Execution End-to-End - labels() function - DISTINCT should return unique labels", () => {
  const graph = setupMultiLabelGraph();
  const results = executeQuery(graph, "MATCH (n) RETURN DISTINCT labels(n)");

  // Should return 3 unique label arrays: ["User"], ["Post"], ["Comment"]
  expect(results).toHaveLength(3);

  const labelSets = results.map((r) => (r as string[])[0]);
  expect(labelSets.sort()).toEqual(["Comment", "Post", "User"]);
});

test("Query Execution End-to-End - labels() function - case insensitive", () => {
  const graph = setupMultiLabelGraph();
  // The LABELS keyword should be case-insensitive
  const results = executeQuery(graph, "MATCH (n:User) RETURN LABELS(n)");
  expect(results).toHaveLength(2); // 2 Users
  expect(results[0]).toEqual(["User"]);
  expect(results[1]).toEqual(["User"]);
});

// Additional test coverage for edge cases
test("Query Execution End-to-End - labels() function - empty graph returns no results", () => {
  const schema = {
    vertices: {
      User: { properties: { name: { type: makeType<string>("") } } },
    },
    edges: {},
  } as const satisfies GraphSchema;
  const emptyGraph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  const results = executeQuery(emptyGraph, "MATCH (n) RETURN labels(n)");
  expect(results).toHaveLength(0);
});

test("Query Execution End-to-End - labels() function - DISTINCT on empty graph", () => {
  const schema = {
    vertices: {
      User: { properties: { name: { type: makeType<string>("") } } },
    },
    edges: {},
  } as const satisfies GraphSchema;
  const emptyGraph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  const results = executeQuery(
    emptyGraph,
    "MATCH (n) RETURN DISTINCT labels(n)",
  );
  expect(results).toHaveLength(0);
});

test("Query Execution End-to-End - error handling - aggregate and function conflict", () => {
  const graph = setupMultiLabelGraph();
  // Cannot use both aggregate and function in RETURN clause without GROUP BY
  expect(() => {
    executeQuery(graph, "MATCH (n) RETURN COUNT(n), labels(n)");
  }).toThrow(/Cannot use aggregate.*with.*function.*without GROUP BY/);
});

test("Query Execution End-to-End - labels() function - works on edges", () => {
  const graph = setupMultiLabelGraph();
  // Get labels from edges (all are "wrote" type)
  const results = executeQuery(graph, "MATCH ()-[r]->() RETURN labels(r)");
  expect(results).toHaveLength(3); // 3 edges in the graph
  // All should be ["wrote"]
  for (const result of results) {
    expect(result).toEqual(["wrote"]);
  }
});

test("Query Execution End-to-End - labels() function - DISTINCT on edges", () => {
  const graph = setupMultiLabelGraph();
  // Get distinct edge labels
  const results = executeQuery(
    graph,
    "MATCH ()-[r]->() RETURN DISTINCT labels(r)",
  );
  // All edges have the same label "wrote", so should get 1 result
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual(["wrote"]);
});

// Tests for property access in RETURN clause
test("Query Execution End-to-End - Property access in RETURN - should return single property", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE u.name = "Alice" RETURN u.age',
  );
  expect(results).toHaveLength(1);
  expect(results[0]).toBe(25);
});

test("Query Execution End-to-End - Property access in RETURN - should return all matching properties", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(graph, "MATCH (u:User) RETURN u.name");
  expect(results).toHaveLength(4);
  expect(results.sort()).toEqual(["Alice", "Bob", "Charlie", "David"]);
});

test("Query Execution End-to-End - Property access in RETURN - with WHERE clause", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.age > 25 RETURN u.name",
  );
  expect(results).toHaveLength(2);
  expect(results.sort()).toEqual(["Bob", "David"]);
});

test("Query Execution End-to-End - Property access in RETURN - multiple properties", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE u.name = "Alice" RETURN u.name, u.age',
  );
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual(["Alice", 25]);
});

test("Query Execution End-to-End - Property access in RETURN - mixed variable and property", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE u.name = "Alice" RETURN u, u.name',
  );
  expect(results).toHaveLength(1);
  // First element should be the full vertex, second should be the name
  const [vertex, name] = results[0] as any[];
  expect(vertex.label).toBe("User");
  expect(name).toBe("Alice");
});

test("Query Execution End-to-End - Property access in RETURN - with DISTINCT", () => {
  const graph = setupQueryExecutionGraph();
  // All active users have active = true, so DISTINCT should return one result
  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.active = true RETURN DISTINCT u.active",
  );
  expect(results).toHaveLength(1);
  expect(results[0]).toBe(true);
});

test("Query Execution End-to-End - Property access in RETURN - through relationship", () => {
  const graph = setupQueryExecutionGraph();
  const results = executeQuery(
    graph,
    'MATCH (u:User)-[:follows]->(f:User) WHERE u.name = "Alice" RETURN f.name',
  );
  expect(results).toHaveLength(2); // Alice follows Bob and Charlie
  expect(results.sort()).toEqual(["Bob", "Charlie"]);
});
