import { test, expect } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph } from "../Graph.js";
import { GraphSchema } from "../GraphSchema.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import type { Query, EdgePattern } from "../AST.js";

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

test("New Features: Aggregates, XOR, Variable-length [*] - Aggregate Functions - SUM - should calculate sum of salaries", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  const results = executeQuery(graph, "MATCH (p:Person) RETURN SUM(p.salary)");
  expect(results).toHaveLength(1);
  // 50000 + 60000 + 70000 + 55000 + 65000 = 300000
  expect(results[0]).toBe(300000);
});

test("New Features: Aggregates, XOR, Variable-length [*] - Aggregate Functions - SUM - should calculate sum with WHERE filter", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  const results = executeQuery(
    graph,
    "MATCH (p:Person) WHERE p.active = true RETURN SUM(p.salary)",
  );
  expect(results).toHaveLength(1);
  // Alice (50000) + Charlie (70000) + Eve (65000) = 185000
  expect(results[0]).toBe(185000);
});

test("New Features: Aggregates, XOR, Variable-length [*] - Aggregate Functions - AVG - should calculate average age", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  const results = executeQuery(graph, "MATCH (p:Person) RETURN AVG(p.age)");
  expect(results).toHaveLength(1);
  // (30 + 25 + 35 + 28 + 32) / 5 = 150 / 5 = 30
  expect(results[0]).toBe(30);
});

test("New Features: Aggregates, XOR, Variable-length [*] - Aggregate Functions - AVG - should calculate average salary of active people", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  const results = executeQuery(
    graph,
    "MATCH (p:Person) WHERE p.active = true RETURN AVG(p.salary)",
  );
  expect(results).toHaveLength(1);
  // (50000 + 70000 + 65000) / 3 = 185000 / 3 ≈ 61666.67
  expect(results[0]).toBeCloseTo(61666.67, 0);
});

test("New Features: Aggregates, XOR, Variable-length [*] - Aggregate Functions - MIN - should find minimum age", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  const results = executeQuery(graph, "MATCH (p:Person) RETURN MIN(p.age)");
  expect(results).toHaveLength(1);
  expect(results[0]).toBe(25); // Bob is youngest
});

test("New Features: Aggregates, XOR, Variable-length [*] - Aggregate Functions - MIN - should find minimum salary", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  const results = executeQuery(graph, "MATCH (p:Person) RETURN MIN(p.salary)");
  expect(results).toHaveLength(1);
  expect(results[0]).toBe(50000); // Alice has lowest salary
});

test("New Features: Aggregates, XOR, Variable-length [*] - Aggregate Functions - MIN - should find minimum price", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  const results = executeQuery(graph, "MATCH (p:Product) RETURN MIN(p.price)");
  expect(results).toHaveLength(1);
  expect(results[0]).toBe(599); // Phone is cheaper
});

test("New Features: Aggregates, XOR, Variable-length [*] - Aggregate Functions - MAX - should find maximum age", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  const results = executeQuery(graph, "MATCH (p:Person) RETURN MAX(p.age)");
  expect(results).toHaveLength(1);
  expect(results[0]).toBe(35); // Charlie is oldest
});

test("New Features: Aggregates, XOR, Variable-length [*] - Aggregate Functions - MAX - should find maximum salary", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  const results = executeQuery(graph, "MATCH (p:Person) RETURN MAX(p.salary)");
  expect(results).toHaveLength(1);
  expect(results[0]).toBe(70000); // Charlie has highest salary
});

test("New Features: Aggregates, XOR, Variable-length [*] - Aggregate Functions - COLLECT - should collect all people", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  const results = executeQuery(graph, "MATCH (p:Person) RETURN COLLECT(p)");
  expect(results).toHaveLength(1);
  expect(Array.isArray(results[0])).toBe(true);
  expect((results[0] as unknown[]).length).toBe(5);
});

test("New Features: Aggregates, XOR, Variable-length [*] - Aggregate Functions - COLLECT - should collect active people only", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  const results = executeQuery(graph, "MATCH (p:Person) WHERE p.active = true RETURN COLLECT(p)");
  expect(results).toHaveLength(1);
  expect(Array.isArray(results[0])).toBe(true);
  expect((results[0] as unknown[]).length).toBe(3);
});

test("New Features: Aggregates, XOR, Variable-length [*] - XOR Logical Operator - should return results where exactly one condition is true", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  // XOR: active=true XOR age > 30
  // Alice: active=true, age=30 -> true XOR false = true
  // Bob: active=false, age=25 -> false XOR false = false
  // Charlie: active=true, age=35 -> true XOR true = false
  // Diana: active=false, age=28 -> false XOR false = false
  // Eve: active=true, age=32 -> true XOR true = false
  const results = executeQuery(
    graph,
    "MATCH (p:Person) WHERE p.active = true XOR p.age > 30 RETURN p",
  );
  expect(results).toHaveLength(1);
});

test("New Features: Aggregates, XOR, Variable-length [*] - XOR Logical Operator - should work with XOR between different property comparisons", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  // XOR: age < 28 XOR salary > 60000
  // Alice: 30 < 28=false, 50000 > 60000=false -> false
  // Bob: 25 < 28=true, 60000 > 60000=false -> true
  // Charlie: 35 < 28=false, 70000 > 60000=true -> true
  // Diana: 28 < 28=false, 55000 > 60000=false -> false
  // Eve: 32 < 28=false, 65000 > 60000=true -> true
  const results = executeQuery(
    graph,
    "MATCH (p:Person) WHERE p.age < 28 XOR p.salary > 60000 RETURN p",
  );
  expect(results).toHaveLength(3); // Bob, Charlie, Eve
});

test("New Features: Aggregates, XOR, Variable-length [*] - XOR Logical Operator - should work with XOR combined with AND", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  // (active=true AND age > 30) XOR salary > 65000
  // Alice: (true AND false) XOR false = false XOR false = false
  // Bob: (false AND false) XOR false = false XOR false = false
  // Charlie: (true AND true) XOR true = true XOR true = false
  // Diana: (false AND false) XOR false = false XOR false = false
  // Eve: (true AND true) XOR false = true XOR false = true
  const results = executeQuery(
    graph,
    "MATCH (p:Person) WHERE (p.active = true AND p.age > 30) XOR p.salary > 65000 RETURN p",
  );
  expect(results).toHaveLength(1); // Eve
});

test("New Features: Aggregates, XOR, Variable-length [*] - Variable-length [*] without label/variable - should parse [*] without variable or label", () => {
  const ast = parse("MATCH (a)-[*]->(b) RETURN a, b") as Query;
  expect(ast.matches[0]!.pattern.type).toBe("Pattern");
  const pattern = ast.matches[0]!.pattern;
  if (pattern.type === "Pattern") {
    const edge = pattern.elements[1] as EdgePattern;
    expect(edge.type).toBe("EdgePattern");
    expect(edge.variable).toBeUndefined();
    expect(edge.labels).toEqual([]);
    expect(edge.quantifier).toBeDefined();
  }
});

test("New Features: Aggregates, XOR, Variable-length [*] - Variable-length [*] without label/variable - should parse [*1..3] range quantifier", () => {
  const ast = parse("MATCH (a)-[*1..3]->(b) RETURN a, b") as Query;
  const pattern = ast.matches[0]!.pattern;
  if (pattern.type === "Pattern") {
    const edge = pattern.elements[1] as EdgePattern;
    expect(edge.quantifier).toEqual({ type: "Quantifier", min: 1, max: 3 });
  }
});

test("New Features: Aggregates, XOR, Variable-length [*] - Variable-length [*] without label/variable - should parse [*2] exact count", () => {
  const ast = parse("MATCH (a)-[*2]->(b) RETURN a, b") as Query;
  const pattern = ast.matches[0]!.pattern;
  if (pattern.type === "Pattern") {
    const edge = pattern.elements[1] as EdgePattern;
    expect(edge.quantifier).toEqual({ type: "Quantifier", min: 2, max: 2 });
  }
});

test("New Features: Aggregates, XOR, Variable-length [*] - Variable-length [*] without label/variable - should parse [*2..] open-ended range", () => {
  const ast = parse("MATCH (a)-[*2..]->(b) RETURN a, b") as Query;
  const pattern = ast.matches[0]!.pattern;
  if (pattern.type === "Pattern") {
    const edge = pattern.elements[1] as EdgePattern;
    expect(edge.quantifier).toEqual({
      type: "Quantifier",
      min: 2,
      max: undefined,
    });
  }
});

test("New Features: Aggregates, XOR, Variable-length [*] - Variable-length [*] without label/variable - should execute query with [*2] to find 2-hop connections", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  // Starting from Alice, following "knows" edges 2 hops:
  // Alice -> Bob -> Charlie
  const results = executeQuery(
    graph,
    "MATCH (p:Person {name: 'Alice'})-[*2]->(friend) RETURN friend",
  );
  expect(results.length).toBeGreaterThanOrEqual(1);
});

test("New Features: Aggregates, XOR, Variable-length [*] - Variable-length [*] without label/variable - should work with variable-length in bidirectional pattern", () => {
  const ast = parse("MATCH (a)-[*1..2]-(b) RETURN a, b") as Query;
  const pattern = ast.matches[0]!.pattern;
  if (pattern.type === "Pattern") {
    const edge = pattern.elements[1] as EdgePattern;
    expect(edge.direction).toBe("both");
    expect(edge.quantifier).toEqual({ type: "Quantifier", min: 1, max: 2 });
  }
});

test("New Features: Aggregates, XOR, Variable-length [*] - Variable-length [*] without label/variable - should parse [*0..3] zero-hop minimum", () => {
  const ast = parse("MATCH (a)-[*0..3]->(b) RETURN a, b") as Query;
  const pattern = ast.matches[0]!.pattern;
  if (pattern.type === "Pattern") {
    const edge = pattern.elements[1] as EdgePattern;
    expect(edge.quantifier).toEqual({ type: "Quantifier", min: 0, max: 3 });
  }
});

test("New Features: Aggregates, XOR, Variable-length [*] - Variable-length [*] without label/variable - should execute [*0..] to include zero-hop paths (node matches itself)", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  // [*0..] means 0 or more hops, so (a) can match (b) even with zero edges
  // In this case, Alice should match herself (0 hops) plus any reachable nodes
  const results = executeQuery(
    graph,
    "MATCH (p:Person {name: 'Alice'})-[*0..]->(friend) RETURN friend",
  );

  // Should include at least Alice herself (0 hops) plus any nodes reachable via knows edges
  // Alice knows Bob, and Bob knows Charlie, so we expect at least Alice
  expect(results.length).toBeGreaterThanOrEqual(1);

  // One of the results should be Alice herself (0-hop path)
  const friendNames = results.map((r: any) => r[0].get("name"));
  expect(friendNames).toContain("Alice");
});

test("New Features: Aggregates, XOR, Variable-length [*] - Variable-length [*] without label/variable - should execute [*0..1] to include both zero and one-hop paths", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  // [*0..1] means 0 or 1 hops
  // Should match Alice herself (0 hops) and Bob (1 hop via knows)
  const results = executeQuery(
    graph,
    "MATCH (p:Person {name: 'Alice'})-[*0..1]->(friend) RETURN friend",
  );

  const friendNames = results.map((r: any) => r[0].get("name"));

  // Should include Alice (0 hops)
  expect(friendNames).toContain("Alice");

  // Should include Bob (1 hop)
  expect(friendNames).toContain("Bob");

  // Should NOT include Charlie (2 hops, beyond the max of 1)
  // Note: This depends on graph structure, but based on setup Charlie is 2 hops away
});

test("New Features: Aggregates, XOR, Variable-length [*] - Combined Features - should use XOR with aggregates (filter then aggregate)", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          salary: { type: makeType<number>(0) },
          active: { type: makeType<boolean>(false) },
        },
      },
      Product: {
        properties: {
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
      purchased: {
        properties: {
          quantity: { type: makeType<number>(0) },
        },
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add people with salaries
  const alice = graph.addVertex("Person", {
    name: "Alice",
    age: 30,
    salary: 50000,
    active: true,
  });
  const bob = graph.addVertex("Person", {
    name: "Bob",
    age: 25,
    salary: 60000,
    active: false,
  });
  const charlie = graph.addVertex("Person", {
    name: "Charlie",
    age: 35,
    salary: 70000,
    active: true,
  });
  const diana = graph.addVertex("Person", {
    name: "Diana",
    age: 28,
    salary: 55000,
    active: false,
  });
  const eve = graph.addVertex("Person", {
    name: "Eve",
    age: 32,
    salary: 65000,
    active: true,
  });

  // Add products
  const laptop = graph.addVertex("Product", {
    name: "Laptop",
    price: 999,
  });
  const phone = graph.addVertex("Product", {
    name: "Phone",
    price: 599,
  });

  // Create a chain of "knows" relationships: Alice -> Bob -> Charlie -> Diana -> Eve
  graph.addEdge(bob.id, "knows", alice.id, {});
  graph.addEdge(charlie.id, "knows", bob.id, {});
  graph.addEdge(diana.id, "knows", charlie.id, {});
  graph.addEdge(eve.id, "knows", diana.id, {});

  // Also: Charlie knows Alice directly (for interesting path queries)
  graph.addEdge(alice.id, "knows", charlie.id, {});

  // Purchases
  graph.addEdge(laptop.id, "purchased", alice.id, { quantity: 1 });
  graph.addEdge(phone.id, "purchased", bob.id, { quantity: 2 });

  // Use XOR to filter, then sum
  const results = executeQuery(
    graph,
    "MATCH (p:Person) WHERE p.active = true XOR p.age > 30 RETURN SUM(p.salary)",
  );
  expect(results).toHaveLength(1);
  // Only Alice matches (active=true but age=30 not > 30)
  expect(results[0]).toBe(50000);
});
