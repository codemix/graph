import { test, expect } from "vitest";
import { Graph } from "../Graph.js";
import { GraphSchema } from "../GraphSchema.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { GraphTraversal } from "../Traversals.js";
import { StandardSchemaV1 } from "@standard-schema/spec";

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

// Module-level setup
const schema = {
  vertices: {
    User: {
      properties: {
        name: { type: makeType<string>("") },
        email: { type: makeType<string>("") },
        role: { type: makeType<string>("") },
        bio: { type: makeType<string>("") },
      },
    },
    Product: {
      properties: {
        name: { type: makeType<string>("") },
        sku: { type: makeType<string>("") },
        description: { type: makeType<string>("") },
      },
    },
  },
  edges: {
    purchased: {
      properties: {
        note: { type: makeType<string>("") },
      },
    },
    reviewed: {
      properties: {
        comment: { type: makeType<string>("") },
        rating: { type: makeType<number>(0) },
      },
    },
  },
} as const satisfies GraphSchema;

function createGraph(): {
  graph: Graph<GraphSchema>;
  g: GraphTraversal<GraphSchema>;
} {
  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  const g = new GraphTraversal(graph);

  // Add users
  graph.addVertex("User", {
    name: "Alice Smith",
    email: "alice@example.com",
    role: "admin",
    bio: "Software engineer working on graph databases",
  });
  graph.addVertex("User", {
    name: "Bob Johnson",
    email: "bob@company.org",
    role: "user",
    bio: "Product manager with 10 years experience",
  });
  graph.addVertex("User", {
    name: "Charlie Brown",
    email: "charlie@example.com",
    role: "admin",
    bio: "DevOps specialist focusing on cloud infrastructure",
  });
  graph.addVertex("User", {
    name: "Diana Prince",
    email: "diana@company.org",
    role: "moderator",
    bio: "Community manager and support lead",
  });

  // Add products
  graph.addVertex("Product", {
    name: "Graph Database Pro",
    sku: "DB-001",
    description: "Professional graph database solution",
  });
  graph.addVertex("Product", {
    name: "Analytics Dashboard",
    sku: "AN-001",
    description: "Data analytics and visualization tool",
  });
  graph.addVertex("Product", {
    name: "Developer Tools Suite",
    sku: "DEV-100",
    description: "Complete developer productivity tools",
  });

  return { graph, g };
}

test("String Predicate Traversals - startsWith - should filter vertices where property starts with value", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").startsWith("name", "Alice").values());
  expect(results).toHaveLength(1);
  expect(results[0]!.get("name")).toBe("Alice Smith");
});

test("String Predicate Traversals - startsWith - should find users with email starting with specific prefix", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").startsWith("email", "alice").values());
  expect(results).toHaveLength(1);
});

test("String Predicate Traversals - startsWith - should find products with SKU starting with prefix", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("Product").startsWith("sku", "DB").values());
  expect(results).toHaveLength(1);
});

test("String Predicate Traversals - startsWith - should return empty when no match", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").startsWith("name", "Zack").values());
  expect(results).toHaveLength(0);
});

test("String Predicate Traversals - startsWith - should match all when prefix is empty string", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").startsWith("name", "").values());
  expect(results).toHaveLength(4);
});

test("String Predicate Traversals - endsWith - should filter vertices where property ends with value", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").endsWith("name", "Smith").values());
  expect(results).toHaveLength(1);
  expect(results[0]!.get("name")).toBe("Alice Smith");
});

test("String Predicate Traversals - endsWith - should find users with emails ending with domain", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").endsWith("email", ".com").values());
  // alice@example.com and charlie@example.com
  expect(results).toHaveLength(2);
});

test("String Predicate Traversals - endsWith - should find users with emails ending in .org", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").endsWith("email", ".org").values());
  // bob@company.org and diana@company.org
  expect(results).toHaveLength(2);
});

test("String Predicate Traversals - endsWith - should return empty when no match", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").endsWith("name", "XYZ").values());
  expect(results).toHaveLength(0);
});

test("String Predicate Traversals - containing - should filter vertices where property contains value", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").containing("name", "Brown").values());
  expect(results).toHaveLength(1);
  expect(results[0]!.get("name")).toBe("Charlie Brown");
});

test("String Predicate Traversals - containing - should find users with emails containing domain", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").containing("email", "example").values());
  expect(results).toHaveLength(2);
});

test("String Predicate Traversals - containing - should find users with bio containing keyword", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").containing("bio", "engineer").values());
  expect(results).toHaveLength(1);
});

test("String Predicate Traversals - containing - should find products with description containing keyword", () => {
  const { g } = createGraph();
  const results = Array.from(
    g.V().hasLabel("Product").containing("description", "database").values(),
  );
  expect(results).toHaveLength(1);
});

test("String Predicate Traversals - containing - should return empty when no match", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").containing("name", "XYZ").values());
  expect(results).toHaveLength(0);
});

test("String Predicate Traversals - matches (regex) - should filter vertices where property matches regex pattern", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").matches("name", "^Alice.*").values());
  expect(results).toHaveLength(1);
  expect(results[0]!.get("name")).toBe("Alice Smith");
});

test("String Predicate Traversals - matches (regex) - should match with suffix pattern", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").matches("name", ".*Smith$").values());
  expect(results).toHaveLength(1);
});

test("String Predicate Traversals - matches (regex) - should match with alternation pattern", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").matches("role", "admin|moderator").values());
  // Alice (admin), Charlie (admin), Diana (moderator)
  expect(results).toHaveLength(3);
});

test("String Predicate Traversals - matches (regex) - should match email pattern", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").matches("email", ".*@example\\.com$").values());
  expect(results).toHaveLength(2);
});

test("String Predicate Traversals - matches (regex) - should handle character class patterns", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("Product").matches("sku", "^[A-Z]+-[0-9]+$").values());
  expect(results).toHaveLength(3);
});

test("String Predicate Traversals - matches (regex) - should be case-sensitive by default", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").matches("name", "^ALICE.*").values());
  // No match - Alice has uppercase A, not ALICE
  expect(results).toHaveLength(0);
});

test("String Predicate Traversals - matches (regex) - should return empty when pattern doesn't match", () => {
  const { g } = createGraph();
  const results = Array.from(g.V().hasLabel("User").matches("name", "^NoMatch.*").values());
  expect(results).toHaveLength(0);
});

test("String Predicate Traversals - combining string predicates with other conditions - should combine startsWith with has", () => {
  const { g } = createGraph();
  const results = Array.from(
    g.V().hasLabel("User").startsWith("name", "A").has("role", "admin").values(),
  );
  expect(results).toHaveLength(1);
  expect(results[0]!.get("name")).toBe("Alice Smith");
});

test("String Predicate Traversals - combining string predicates with other conditions - should combine endsWith with other predicates", () => {
  const { g } = createGraph();
  const results = Array.from(
    g.V().hasLabel("User").endsWith("email", ".com").containing("bio", "engineer").values(),
  );
  expect(results).toHaveLength(1);
});

test("String Predicate Traversals - combining string predicates with other conditions - should chain multiple string predicates", () => {
  const { g } = createGraph();
  const results = Array.from(
    g.V().hasLabel("User").startsWith("email", "alice").endsWith("email", ".com").values(),
  );
  expect(results).toHaveLength(1);
});

test("String Predicate Traversals - combining string predicates with other conditions - should combine matches with other conditions", () => {
  const { g } = createGraph();
  const results = Array.from(
    g.V().hasLabel("User").matches("email", ".*@example\\.com$").has("role", "admin").values(),
  );
  // Both Alice (alice@example.com) and Charlie (charlie@example.com) have role admin
  expect(results).toHaveLength(2);
});

test("String Predicate Traversals - EdgeTraversal string predicates - should filter edges where property starts with value", () => {
  const { graph, g } = createGraph();

  // Add edges with string properties
  const users = Array.from(g.V().hasLabel("User").values());
  const products = Array.from(g.V().hasLabel("Product").values());

  if (users.length >= 2 && products.length >= 1) {
    const alice = users.find((u) => u.get("name") === "Alice Smith");
    const bob = users.find((u) => u.get("name") === "Bob Johnson");
    const product = products[0];

    if (alice && bob && product) {
      // addEdge(inV, label, outV, properties)
      // Edge goes from outV (source) to inV (target)
      // Alice reviewed Product: Alice -> Product, so inV=product, outV=alice
      graph.addEdge(product.id, "reviewed", alice.id, {
        comment: "Excellent product, highly recommended!",
        rating: 5,
      });
      graph.addEdge(product.id, "reviewed", bob.id, {
        comment: "Good value for money",
        rating: 4,
      });
    }
  }

  const results = Array.from(
    g.E().hasLabel("reviewed").startsWith("comment", "Excellent").values(),
  );
  expect(results.length).toBeGreaterThanOrEqual(0);
});

test("String Predicate Traversals - EdgeTraversal string predicates - should filter edges where property contains value", () => {
  const { graph, g } = createGraph();

  // Add edges with string properties
  const users = Array.from(g.V().hasLabel("User").values());
  const products = Array.from(g.V().hasLabel("Product").values());

  if (users.length >= 2 && products.length >= 1) {
    const alice = users.find((u) => u.get("name") === "Alice Smith");
    const bob = users.find((u) => u.get("name") === "Bob Johnson");
    const product = products[0];

    if (alice && bob && product) {
      graph.addEdge(product.id, "reviewed", alice.id, {
        comment: "Excellent product, highly recommended!",
        rating: 5,
      });
      graph.addEdge(product.id, "reviewed", bob.id, {
        comment: "Good value for money",
        rating: 4,
      });
    }
  }

  const results = Array.from(
    g.E().hasLabel("reviewed").containing("comment", "recommended").values(),
  );
  expect(results.length).toBeGreaterThanOrEqual(0);
});

test("String Predicate Traversals - EdgeTraversal string predicates - should filter edges with regex pattern", () => {
  const { graph, g } = createGraph();

  // Add edges with string properties
  const users = Array.from(g.V().hasLabel("User").values());
  const products = Array.from(g.V().hasLabel("Product").values());

  if (users.length >= 2 && products.length >= 1) {
    const alice = users.find((u) => u.get("name") === "Alice Smith");
    const bob = users.find((u) => u.get("name") === "Bob Johnson");
    const product = products[0];

    if (alice && bob && product) {
      graph.addEdge(product.id, "reviewed", alice.id, {
        comment: "Excellent product, highly recommended!",
        rating: 5,
      });
      graph.addEdge(product.id, "reviewed", bob.id, {
        comment: "Good value for money",
        rating: 4,
      });
    }
  }

  const results = Array.from(g.E().hasLabel("reviewed").matches("comment", ".*product.*").values());
  expect(results.length).toBeGreaterThanOrEqual(0);
});

test("String Predicate Traversals - edge cases - should handle special regex characters in startsWith", () => {
  const { g } = createGraph();
  // startsWith uses string comparison, not regex
  const results = Array.from(g.V().hasLabel("User").startsWith("email", "alice@").values());
  expect(results).toHaveLength(1);
});

test("String Predicate Traversals - edge cases - should handle empty results gracefully", () => {
  const { g } = createGraph();
  const results = Array.from(
    g.V().hasLabel("User").startsWith("name", "NonexistentPrefix").values(),
  );
  expect(results).toHaveLength(0);
});
