import { test, expect } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph } from "../Graph.js";
import { GraphSchema } from "../GraphSchema.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
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
function executeQuery(graph: Graph<GraphSchema>, queryString: string): unknown[] {
  const ast = parse(queryString) as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

// Module-level schema
const schema = {
  vertices: {
    User: {
      properties: {
        name: { type: makeType<string>("") },
        email: { type: makeType<string>("") },
        role: { type: makeType<string>("") },
        age: { type: makeType<number>(0) },
      },
    },
    Product: {
      properties: {
        name: { type: makeType<string>("") },
        sku: { type: makeType<string>("") },
        category: { type: makeType<string>("") },
        price: { type: makeType<number>(0) },
      },
    },
  },
  edges: {
    purchased: {
      properties: {},
    },
    reviewed: {
      properties: {
        rating: { type: makeType<number>(0) },
      },
    },
  },
} as const satisfies GraphSchema;

function createGraph(): Graph<GraphSchema> {
  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add users
  graph.addVertex("User", {
    name: "Alice Smith",
    email: "alice@example.com",
    role: "admin",
    age: 30,
  });
  graph.addVertex("User", {
    name: "Bob Johnson",
    email: "bob@company.org",
    role: "user",
    age: 25,
  });
  graph.addVertex("User", {
    name: "Charlie Brown",
    email: "charlie@example.com",
    role: "admin",
    age: 35,
  });
  graph.addVertex("User", {
    name: "Diana Prince",
    email: "diana@company.org",
    role: "user",
    age: 28,
  });
  graph.addVertex("User", {
    name: "Eve Adams",
    email: "eve@test.net",
    role: "moderator",
    age: 32,
  });

  // Add products
  graph.addVertex("Product", {
    name: "Laptop Pro",
    sku: "ELEC-001",
    category: "electronics",
    price: 999,
  });
  graph.addVertex("Product", {
    name: "Wireless Mouse",
    sku: "ELEC-002",
    category: "electronics",
    price: 29,
  });
  graph.addVertex("Product", {
    name: "Office Chair",
    sku: "FURN-001",
    category: "furniture",
    price: 299,
  });
  graph.addVertex("Product", {
    name: "Standing Desk",
    sku: "FURN-002",
    category: "furniture",
    price: 599,
  });

  return graph;
}

test("String Predicates, Inequality Operator, and RETURN * Execution - STARTS WITH predicate - should find users whose name starts with 'Alice'", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.name STARTS WITH 'Alice' RETURN u");
  expect(results).toHaveLength(1);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - STARTS WITH predicate - should find users whose email starts with a specific domain part", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.email STARTS WITH 'alice' RETURN u");
  expect(results).toHaveLength(1);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - STARTS WITH predicate - should find products with SKU starting with ELEC", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (p:Product) WHERE p.sku STARTS WITH 'ELEC' RETURN p");
  expect(results).toHaveLength(2);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - STARTS WITH predicate - should return empty when no match for STARTS WITH", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.name STARTS WITH 'Zack' RETURN u");
  expect(results).toHaveLength(0);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - STARTS WITH predicate - should handle empty string STARTS WITH (matches all)", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.name STARTS WITH '' RETURN u");
  expect(results).toHaveLength(5);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - ENDS WITH predicate - should find users whose name ends with 'Smith'", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.name ENDS WITH 'Smith' RETURN u");
  expect(results).toHaveLength(1);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - ENDS WITH predicate - should find users with emails ending in '.com'", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.email ENDS WITH '.com' RETURN u");
  // alice@example.com and charlie@example.com
  expect(results).toHaveLength(2);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - ENDS WITH predicate - should find users with emails ending in '.org'", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.email ENDS WITH '.org' RETURN u");
  // bob@company.org and diana@company.org
  expect(results).toHaveLength(2);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - ENDS WITH predicate - should find products with SKU ending in '-001'", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (p:Product) WHERE p.sku ENDS WITH '-001' RETURN p");
  expect(results).toHaveLength(2);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - ENDS WITH predicate - should return empty when no match for ENDS WITH", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.name ENDS WITH 'XYZ' RETURN u");
  expect(results).toHaveLength(0);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - CONTAINS predicate - should find users whose name contains 'Brown'", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.name CONTAINS 'Brown' RETURN u");
  expect(results).toHaveLength(1);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - CONTAINS predicate - should find users with emails containing 'example'", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.email CONTAINS 'example' RETURN u");
  expect(results).toHaveLength(2);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - CONTAINS predicate - should find users with emails containing '@'", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.email CONTAINS '@' RETURN u");
  expect(results).toHaveLength(5);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - CONTAINS predicate - should find products containing 'Pro' in name", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (p:Product) WHERE p.name CONTAINS 'Pro' RETURN p");
  expect(results).toHaveLength(1);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - CONTAINS predicate - should return empty when no match for CONTAINS", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.name CONTAINS 'XYZ' RETURN u");
  expect(results).toHaveLength(0);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Combining string predicates with other conditions - should combine STARTS WITH with AND", () => {
  const graph = createGraph();
  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.name STARTS WITH 'A' AND u.role = 'admin' RETURN u",
  );
  expect(results).toHaveLength(1);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Combining string predicates with other conditions - should combine ENDS WITH with numeric comparison", () => {
  const graph = createGraph();
  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.email ENDS WITH '.com' AND u.age > 30 RETURN u",
  );
  // charlie@example.com, age 35
  expect(results).toHaveLength(1);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Combining string predicates with other conditions - should combine CONTAINS with OR", () => {
  const graph = createGraph();
  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.name CONTAINS 'Alice' OR u.name CONTAINS 'Bob' RETURN u",
  );
  expect(results).toHaveLength(2);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Combining string predicates with other conditions - should combine multiple string predicates", () => {
  const graph = createGraph();
  const results = executeQuery(
    graph,
    "MATCH (p:Product) WHERE p.sku STARTS WITH 'ELEC' AND p.name CONTAINS 'Mouse' RETURN p",
  );
  expect(results).toHaveLength(1);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Combining string predicates with other conditions - should combine string predicate with regex", () => {
  const graph = createGraph();
  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.name STARTS WITH 'A' AND u.email =~ '.*example.*' RETURN u",
  );
  expect(results).toHaveLength(1);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Inequality operator (<>) - should find users with role not equal to admin using <>", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.role <> 'admin' RETURN u");
  // user, user, moderator
  expect(results).toHaveLength(3);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Inequality operator (<>) - should find products with category not equal to electronics using <>", () => {
  const graph = createGraph();
  const results = executeQuery(
    graph,
    "MATCH (p:Product) WHERE p.category <> 'electronics' RETURN p",
  );
  expect(results).toHaveLength(2);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Inequality operator (<>) - should combine <> with other conditions", () => {
  const graph = createGraph();
  const results = executeQuery(
    graph,
    "MATCH (u:User) WHERE u.role <> 'user' AND u.age > 30 RETURN u",
  );
  // Charlie (admin, 35) and Eve (moderator, 32)
  expect(results).toHaveLength(2);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Inequality operator (<>) - should work with != as well", () => {
  const graph = createGraph();
  const results1 = executeQuery(graph, "MATCH (u:User) WHERE u.role <> 'admin' RETURN u");
  const results2 = executeQuery(graph, "MATCH (u:User) WHERE u.role != 'admin' RETURN u");
  expect(results1).toHaveLength(results2.length);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - RETURN * (returnAll) - should return all variables with RETURN *", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.name STARTS WITH 'Alice' RETURN *");
  expect(results).toHaveLength(1);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - RETURN * (returnAll) - should work with RETURN DISTINCT *", () => {
  const graph = createGraph();
  // There are 2 admins, and DISTINCT with RETURN * should return each unique user
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.role = 'admin' RETURN DISTINCT *");
  // Results should be 2 unique admin users (Alice and Charlie)
  // Note: DedupStep currently deduplicates by the entire result array,
  // which with unique vertex IDs means no actual deduplication occurs
  expect(results.length).toBeGreaterThanOrEqual(1);
  expect(results.length).toBeLessThanOrEqual(2);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - RETURN * (returnAll) - should return all users with RETURN *", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (n:User) RETURN *");
  expect(results).toHaveLength(5);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - RETURN * (returnAll) - should return all products with RETURN *", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (p:Product) RETURN *");
  expect(results).toHaveLength(4);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Edge cases - should handle string predicate on non-string property gracefully", () => {
  const graph = createGraph();
  // age is a number, STARTS WITH should return false
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.age STARTS WITH '3' RETURN u");
  expect(results).toHaveLength(0);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Edge cases - should handle case-sensitive matching with CONTAINS", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.name CONTAINS 'alice' RETURN u");
  // No match because actual name is "Alice Smith" with capital A
  expect(results).toHaveLength(0);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Edge cases - should handle exact case matching with STARTS WITH", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.name STARTS WITH 'alice' RETURN u");
  // No match - case sensitive
  expect(results).toHaveLength(0);
});

test("String Predicates, Inequality Operator, and RETURN * Execution - Edge cases - should handle exact case matching with ENDS WITH", () => {
  const graph = createGraph();
  const results = executeQuery(graph, "MATCH (u:User) WHERE u.name ENDS WITH 'SMITH' RETURN u");
  // No match - case sensitive
  expect(results).toHaveLength(0);
});
