import { test, expect } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph } from "../Graph.js";
import { GraphSchema } from "../GraphSchema.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { GraphTraversal } from "../Traversals.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, stringifySteps } from "../Steps.js";
import type { Query, Pattern } from "../AST.js";

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

test("New Grammar Features - Edge Properties Parsing - should parse edge pattern with single property", () => {
  const query = "MATCH (u:User)-[:follows {weight: 10}]->(f) RETURN f";
  const ast = parse(query) as Query;

  expect((ast.matches[0]!.pattern as Pattern).elements[1]!.type).toBe(
    "EdgePattern",
  );
  const edgePattern = (ast.matches[0]!.pattern as Pattern).elements[1] as any;
  expect(edgePattern.properties).toEqual({ weight: 10 });
});

test("New Grammar Features - Edge Properties Parsing - should parse edge pattern with multiple properties", () => {
  const query =
    "MATCH (u:User)-[:follows {weight: 10, active: true}]->(f) RETURN f";
  const ast = parse(query) as Query;

  const edgePattern = (ast.matches[0]!.pattern as Pattern).elements[1] as any;
  expect(edgePattern.properties).toEqual({ weight: 10, active: true });
});

test("New Grammar Features - Edge Properties Parsing - should parse edge pattern with string property", () => {
  const query = 'MATCH (u:User)-[:follows {type: "close"}]->(f) RETURN f';
  const ast = parse(query) as Query;

  const edgePattern = (ast.matches[0]!.pattern as Pattern).elements[1] as any;
  expect(edgePattern.properties).toEqual({ type: "close" });
});

test("New Grammar Features - IN Operator Parsing - should parse IN with string list", () => {
  const query =
    'MATCH (u:User) WHERE u.status IN ["active", "pending"] RETURN u';
  const ast = parse(query) as Query;

  expect(ast.matches[0]!.where).toBeDefined();
  const condition = ast.matches[0]!.where!.condition as any;
  expect(condition.type).toBe("InCondition");
  expect(condition.variable).toBe("u");
  expect(condition.property).toBe("status");
  expect(condition.values).toEqual(["active", "pending"]);
});

test("New Grammar Features - IN Operator Parsing - should parse IN with number list", () => {
  const query = "MATCH (u:User) WHERE u.age IN [18, 21, 30] RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as any;
  expect(condition.type).toBe("InCondition");
  expect(condition.values).toEqual([18, 21, 30]);
});

test("New Grammar Features - IN Operator Parsing - should parse IN with empty list", () => {
  const query = "MATCH (u:User) WHERE u.tags IN [] RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as any;
  expect(condition.type).toBe("InCondition");
  expect(condition.values).toEqual([]);
});

test("New Grammar Features - IS NULL Parsing - should parse IS NULL condition", () => {
  const query = "MATCH (u:User) WHERE u.email IS NULL RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as any;
  expect(condition.type).toBe("IsNullCondition");
  expect(condition.variable).toBe("u");
  expect(condition.property).toBe("email");
  expect(condition.negated).toBe(false);
});

test("New Grammar Features - IS NULL Parsing - should parse IS NOT NULL condition", () => {
  const query = "MATCH (u:User) WHERE u.email IS NOT NULL RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as any;
  expect(condition.type).toBe("IsNullCondition");
  expect(condition.variable).toBe("u");
  expect(condition.property).toBe("email");
  expect(condition.negated).toBe(true);
});

test("New Grammar Features - NOT Operator Parsing - should parse NOT with simple condition", () => {
  const query = "MATCH (u:User) WHERE NOT u.active = true RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as any;
  expect(condition.type).toBe("NotCondition");
  expect(condition.condition.type).toBe("PropertyCondition");
});

test("New Grammar Features - NOT Operator Parsing - should parse NOT with parenthesized condition", () => {
  const query = "MATCH (u:User) WHERE NOT (u.age > 18) RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as any;
  expect(condition.type).toBe("NotCondition");
  expect(condition.condition.type).toBe("PropertyCondition");
});

test("New Grammar Features - NOT Operator Parsing - should parse NOT with EXISTS", () => {
  const query = "MATCH (u:User) WHERE NOT u.email EXISTS RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as any;
  expect(condition.type).toBe("NotCondition");
  expect(condition.condition.type).toBe("ExistsCondition");
});

test("New Grammar Features - NOT Operator Parsing - should parse NOT with IN", () => {
  const query =
    'MATCH (u:User) WHERE NOT u.status IN ["banned", "suspended"] RETURN u';
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as any;
  expect(condition.type).toBe("NotCondition");
  expect(condition.condition.type).toBe("InCondition");
});

test("New Grammar Features - Combined Conditions - should parse complex condition with AND and IN", () => {
  const query =
    'MATCH (u:User) WHERE u.age > 18 AND u.status IN ["active", "verified"] RETURN u';
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as any;
  expect(condition.type).toBe("AndCondition");
  expect(condition.left.type).toBe("PropertyCondition");
  expect(condition.right.type).toBe("InCondition");
});

test("New Grammar Features - Combined Conditions - should parse complex condition with OR and IS NULL", () => {
  const query =
    "MATCH (u:User) WHERE u.email IS NULL OR u.verified = false RETURN u";
  const ast = parse(query) as Query;

  const condition = ast.matches[0]!.where!.condition as any;
  expect(condition.type).toBe("OrCondition");
  expect(condition.left.type).toBe("IsNullCondition");
  expect(condition.right.type).toBe("PropertyCondition");
});

test("Query Execution with New Features - IN Operator Execution - should filter users with status in list", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE u.status IN ["active", "pending"] RETURN u',
  );
  expect(results).toHaveLength(3); // Alice (active), Bob (pending), David (active)
});

test("Query Execution with New Features - IN Operator Execution - should filter users with role in list", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE u.role IN ["admin", "moderator"] RETURN u',
  );
  expect(results).toHaveLength(2); // Alice (admin), David (moderator)
});

test("Query Execution with New Features - IN Operator Execution - should return empty for users not in list", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE u.status IN ["deleted", "suspended"] RETURN u',
  );
  expect(results).toHaveLength(0);
});

test("Query Execution with New Features - IS NULL Execution - should filter users with null email", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.email IS NULL RETURN u",
  );
  expect(results).toHaveLength(2); // Bob and David have null email
});

test("Query Execution with New Features - IS NULL Execution - should filter users with non-null email", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.email IS NOT NULL RETURN u",
  );
  expect(results).toHaveLength(2); // Alice and Charlie have email
});

test("Query Execution with New Features - NOT Operator Execution - should negate simple condition", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE NOT u.status = "active" RETURN u',
  );
  expect(results).toHaveLength(2); // Bob (pending) and Charlie (banned)
});

test("Query Execution with New Features - NOT Operator Execution - should negate IN condition", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE NOT u.status IN ["active", "pending"] RETURN u',
  );
  expect(results).toHaveLength(1); // Only Charlie (banned)
});

test("Query Execution with New Features - NOT Operator Execution - should negate IS NULL", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE NOT u.email IS NULL RETURN u",
  );
  expect(results).toHaveLength(2); // Alice and Charlie
});

test("Query Execution with New Features - Edge Properties Execution - should filter edges by property value", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    'MATCH (u:User)-[:follows {weight: 10}]->(f) WHERE u.name = "Alice" RETURN f',
  );
  expect(results).toHaveLength(1); // Only Bob (weight 10)
});

test("Query Execution with New Features - Edge Properties Execution - should filter edges by multiple properties", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    'MATCH (u:User)-[:follows {weight: 10, since: "2020"}]->(f) RETURN f',
  );
  expect(results).toHaveLength(1); // Only Bob
});

test("Query Execution with New Features - Edge Properties Execution - should return empty when edge properties dont match", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    "MATCH (u:User)-[:follows {weight: 100}]->(f) RETURN f",
  );
  expect(results).toHaveLength(0);
});

test("Query Execution with New Features - Combined Features - should combine IN with AND", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE u.status IN ["active", "pending"] AND u.age > 25 RETURN u',
  );
  expect(results).toHaveLength(2); // Bob (30, pending), David (35, active)
});

test("Query Execution with New Features - Combined Features - should combine IS NULL with OR", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE u.email IS NULL OR u.status = "banned" RETURN u',
  );
  expect(results).toHaveLength(3); // Bob (null), David (null), Charlie (banned)
});

test("Query Execution with New Features - Combined Features - should combine NOT with AND", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
          role: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
          since: { type: makeType<string>("") },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add test data
  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
    role: "admin",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
    role: "user",
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
    role: "user",
  });
  const david = graph.addVertex("User", {
    name: "David",
    age: 35,
    status: "active",
    email: null,
    role: "moderator",
  });

  // Add edges with properties
  graph.addEdge(alice.id, "follows", bob.id, { weight: 10, since: "2020" });
  graph.addEdge(alice.id, "follows", charlie.id, {
    weight: 5,
    since: "2021",
  });
  graph.addEdge(bob.id, "follows", david.id, { weight: 8, since: "2019" });
  graph.addEdge(charlie.id, "follows", alice.id, {
    weight: 3,
    since: "2022",
  });

  const results = executeQuery(
    graph,
    'MATCH (u:User) WHERE NOT u.status = "banned" AND u.age > 20 RETURN u',
  );
  expect(results).toHaveLength(3); // Alice, Bob, David
});

test("Fluent API New Features - hasIn method - should filter vertices with property value in list", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  const g = new GraphTraversal(graph);

  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
  });

  graph.addEdge(alice.id, "follows", bob.id, { weight: 10 });
  graph.addEdge(alice.id, "follows", charlie.id, { weight: 5 });

  const results = Array.from(
    g.V().hasLabel("User").hasIn("status", ["active", "pending"]),
  );
  expect(results).toHaveLength(2);
});

test("Fluent API New Features - hasIn method - should return empty for values not in list", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  const g = new GraphTraversal(graph);

  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
  });

  graph.addEdge(alice.id, "follows", bob.id, { weight: 10 });
  graph.addEdge(alice.id, "follows", charlie.id, { weight: 5 });

  const results = Array.from(
    g.V().hasLabel("User").hasIn("status", ["deleted"]),
  );
  expect(results).toHaveLength(0);
});

test("Fluent API New Features - isNull method - should filter vertices with null property", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  const g = new GraphTraversal(graph);

  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
  });

  graph.addEdge(alice.id, "follows", bob.id, { weight: 10 });
  graph.addEdge(alice.id, "follows", charlie.id, { weight: 5 });

  const results = Array.from(g.V().hasLabel("User").isNull("email"));
  expect(results).toHaveLength(1); // Only Bob
});

test("Fluent API New Features - isNotNull method - should filter vertices with non-null property", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  const g = new GraphTraversal(graph);

  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
  });

  graph.addEdge(alice.id, "follows", bob.id, { weight: 10 });
  graph.addEdge(alice.id, "follows", charlie.id, { weight: 5 });

  const results = Array.from(g.V().hasLabel("User").isNotNull("email"));
  expect(results).toHaveLength(2); // Alice and Charlie
});

test("Fluent API New Features - not method - should negate a has condition", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  const g = new GraphTraversal(graph);

  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
  });

  graph.addEdge(alice.id, "follows", bob.id, { weight: 10 });
  graph.addEdge(alice.id, "follows", charlie.id, { weight: 5 });

  const results = Array.from(
    g.V().hasLabel("User").has("status", "active").not(),
  );
  expect(results).toHaveLength(2); // Bob and Charlie
});

test("Fluent API New Features - not method - should negate an isNull condition", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  const g = new GraphTraversal(graph);

  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
  });

  graph.addEdge(alice.id, "follows", bob.id, { weight: 10 });
  graph.addEdge(alice.id, "follows", charlie.id, { weight: 5 });

  const results = Array.from(g.V().hasLabel("User").isNull("email").not());
  expect(results).toHaveLength(2); // Alice and Charlie
});

test("Fluent API New Features - not method - should throw error when last step is not a filter", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  const g = new GraphTraversal(graph);

  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
  });

  graph.addEdge(alice.id, "follows", bob.id, { weight: 10 });
  graph.addEdge(alice.id, "follows", charlie.id, { weight: 5 });

  expect(() => {
    g.V().hasLabel("User").not();
  }).toThrow("Cannot negate: last step is not a filter step");
});

test("Fluent API New Features - EdgeTraversal new methods - should filter edges with hasIn", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  const g = new GraphTraversal(graph);

  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
  });

  graph.addEdge(alice.id, "follows", bob.id, { weight: 10 });
  graph.addEdge(alice.id, "follows", charlie.id, { weight: 5 });

  const results = Array.from(
    g.V().hasLabel("User").outE("follows").hasIn("weight", [10, 8]),
  );
  expect(results).toHaveLength(1); // Only the edge with weight 10
});

test("Fluent API New Features - EdgeTraversal new methods - should negate edge filter with not", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          status: { type: makeType<string>("") },
          email: { type: makeType<string | null>(null) },
        },
      },
    },
    edges: {
      follows: {
        properties: {
          weight: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  const g = new GraphTraversal(graph);

  const alice = graph.addVertex("User", {
    name: "Alice",
    age: 25,
    status: "active",
    email: "alice@example.com",
  });
  const bob = graph.addVertex("User", {
    name: "Bob",
    age: 30,
    status: "pending",
    email: null,
  });
  const charlie = graph.addVertex("User", {
    name: "Charlie",
    age: 20,
    status: "banned",
    email: "charlie@example.com",
  });

  graph.addEdge(alice.id, "follows", bob.id, { weight: 10 });
  graph.addEdge(alice.id, "follows", charlie.id, { weight: 5 });

  const results = Array.from(
    g.V().hasLabel("User").outE("follows").has("weight", 10).not(),
  );
  expect(results).toHaveLength(1); // Only the edge with weight 5
});
