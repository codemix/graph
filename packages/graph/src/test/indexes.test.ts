import { describe, it, expect, beforeEach } from "vitest";
import { makeType } from "./testHelpers.js";
import {
  Graph,
  InMemoryGraphStorage,
  HashIndex,
  BTreeIndex,
  FullTextIndex,
  analyzeCondition,
  selectBestIndexHint,
  GraphTraversal,
  type GraphSchema,
  type Condition,
} from "../index.js";

// Test schema with indexed properties
const testSchema = {
  vertices: {
    User: {
      properties: {
        email: {
          type: makeType<string>(""),
          index: { type: "hash" as const },
        },
        name: {
          type: makeType<string>(""),
          index: { type: "fulltext" as const },
        },
        age: {
          type: makeType<number>(0),
          index: { type: "btree" as const },
        },
        status: {
          type: makeType<"active" | "inactive" | "pending">("active"),
          index: { type: "hash" as const },
        },
      },
    },
    Document: {
      properties: {
        title: {
          type: makeType<string>(""),
          index: { type: "fulltext" as const },
        },
        content: {
          type: makeType<string>(""),
          index: {
            type: "fulltext" as const,
            options: { minLength: 3 },
          },
        },
        priority: {
          type: makeType<number>(0),
          index: { type: "btree" as const },
        },
      },
    },
  },
  edges: {
    authored: {
      properties: {
        role: {
          type: makeType<"primary" | "contributor">("primary"),
          index: { type: "hash" as const },
        },
      },
    },
  },
} satisfies GraphSchema;

describe("HashIndex", () => {
  let index: HashIndex;

  beforeEach(() => {
    index = new HashIndex("User", "email");
  });

  it("should add and lookup values", () => {
    index.add("User:1", "alice@example.com");
    index.add("User:2", "bob@example.com");
    index.add("User:3", "alice@example.com"); // Duplicate value

    expect(index.lookup("alice@example.com")).toEqual(
      new Set(["User:1", "User:3"]),
    );
    expect(index.lookup("bob@example.com")).toEqual(new Set(["User:2"]));
    expect(index.lookup("unknown@example.com")).toEqual(new Set());
  });

  it("should handle null and undefined values", () => {
    index.add("User:1", null);
    index.add("User:2", undefined);

    expect(index.lookup(null)).toEqual(new Set());
    expect(index.lookup(undefined)).toEqual(new Set());
  });

  it("should remove values", () => {
    index.add("User:1", "alice@example.com");
    index.add("User:2", "alice@example.com");

    index.remove("User:1", "alice@example.com");

    expect(index.lookup("alice@example.com")).toEqual(new Set(["User:2"]));
  });

  it("should update values", () => {
    index.add("User:1", "old@example.com");

    index.update("User:1", "old@example.com", "new@example.com");

    expect(index.lookup("old@example.com")).toEqual(new Set());
    expect(index.lookup("new@example.com")).toEqual(new Set(["User:1"]));
  });

  it("should lookup multiple values", () => {
    index.add("User:1", "alice@example.com");
    index.add("User:2", "bob@example.com");
    index.add("User:3", "charlie@example.com");

    const result = index.lookupMany([
      "alice@example.com",
      "bob@example.com",
      "unknown@example.com",
    ]);

    expect(result).toEqual(new Set(["User:1", "User:2"]));
  });

  it("should report statistics", () => {
    index.add("User:1", "alice@example.com");
    index.add("User:2", "bob@example.com");
    index.add("User:3", "alice@example.com");

    const stats = index.statistics();

    expect(stats.entries).toBe(3);
    expect(stats.uniqueValues).toBe(2);
  });

  it("should clear all entries", () => {
    index.add("User:1", "alice@example.com");
    index.add("User:2", "bob@example.com");

    index.clear();

    expect(index.lookup("alice@example.com")).toEqual(new Set());
    expect(index.statistics().entries).toBe(0);
  });
});

describe("BTreeIndex", () => {
  let index: BTreeIndex;

  beforeEach(() => {
    index = new BTreeIndex("User", "age");
  });

  it("should add and lookup values", () => {
    index.add("User:1", 25);
    index.add("User:2", 30);
    index.add("User:3", 25); // Duplicate value

    expect(index.lookup(25)).toEqual(new Set(["User:1", "User:3"]));
    expect(index.lookup(30)).toEqual(new Set(["User:2"]));
    expect(index.lookup(35)).toEqual(new Set());
  });

  it("should handle range queries - less than", () => {
    index.add("User:1", 20);
    index.add("User:2", 25);
    index.add("User:3", 30);
    index.add("User:4", 35);

    expect(index.lookupLessThan(30)).toEqual(new Set(["User:1", "User:2"]));
    expect(index.lookupLessThan(20)).toEqual(new Set());
  });

  it("should handle range queries - less than or equal", () => {
    index.add("User:1", 20);
    index.add("User:2", 25);
    index.add("User:3", 30);

    expect(index.lookupLessThanOrEqual(25)).toEqual(
      new Set(["User:1", "User:2"]),
    );
  });

  it("should handle range queries - greater than", () => {
    index.add("User:1", 20);
    index.add("User:2", 25);
    index.add("User:3", 30);

    expect(index.lookupGreaterThan(25)).toEqual(new Set(["User:3"]));
    expect(index.lookupGreaterThan(30)).toEqual(new Set());
  });

  it("should handle range queries - greater than or equal", () => {
    index.add("User:1", 20);
    index.add("User:2", 25);
    index.add("User:3", 30);

    expect(index.lookupGreaterThanOrEqual(25)).toEqual(
      new Set(["User:2", "User:3"]),
    );
  });

  it("should handle range queries - between", () => {
    index.add("User:1", 10);
    index.add("User:2", 20);
    index.add("User:3", 30);
    index.add("User:4", 40);

    // Inclusive on both ends
    expect(index.lookupRange(20, 30, true, true)).toEqual(
      new Set(["User:2", "User:3"]),
    );

    // Exclusive on both ends
    expect(index.lookupRange(20, 40, false, false)).toEqual(
      new Set(["User:3"]),
    );

    // Mixed
    expect(index.lookupRange(20, 40, true, false)).toEqual(
      new Set(["User:2", "User:3"]),
    );
  });

  it("should work with string values", () => {
    const stringIndex = new BTreeIndex("User", "name");
    stringIndex.add("User:1", "Alice");
    stringIndex.add("User:2", "Bob");
    stringIndex.add("User:3", "Charlie");

    expect(stringIndex.lookupGreaterThan("Bob")).toEqual(new Set(["User:3"]));
    expect(stringIndex.lookupLessThan("Bob")).toEqual(new Set(["User:1"]));
  });

  it("should update values correctly", () => {
    index.add("User:1", 25);
    index.add("User:2", 30);

    index.update("User:1", 25, 35);

    expect(index.lookup(25)).toEqual(new Set());
    expect(index.lookup(35)).toEqual(new Set(["User:1"]));
    expect(index.lookupGreaterThan(30)).toEqual(new Set(["User:1"]));
  });
});

describe("FullTextIndex", () => {
  let index: FullTextIndex;

  beforeEach(() => {
    index = new FullTextIndex("Document", "content");
  });

  it("should index and search text", () => {
    index.add("Document:1", "The quick brown fox jumps over the lazy dog");
    index.add("Document:2", "A fast brown fox runs through the forest");
    index.add("Document:3", "The lazy cat sleeps all day");

    // Search for "fox" should return both documents with fox
    const results = index.search("fox");

    expect(results.length).toBe(2);
    expect(results.map((r) => r.elementId)).toContain("Document:1");
    expect(results.map((r) => r.elementId)).toContain("Document:2");
  });

  it("should search with multiple terms (AND semantics)", () => {
    index.add("Document:1", "The quick brown fox jumps");
    index.add("Document:2", "A brown dog barks");
    index.add("Document:3", "The fox sleeps");

    // "brown fox" should only return Document:1
    const allTerms = index.searchAllTerms("brown fox");

    expect(allTerms).toEqual(new Set(["Document:1"]));
  });

  it("should search with any terms (OR semantics)", () => {
    index.add("Document:1", "The quick brown fox");
    index.add("Document:2", "A brown dog");
    index.add("Document:3", "The red cat");

    const anyTerms = index.searchAnyTerms("fox dog");

    expect(anyTerms).toEqual(new Set(["Document:1", "Document:2"]));
  });

  it("should search contains", () => {
    index.add("Document:1", "Hello World");
    index.add("Document:2", "Hello Universe");
    index.add("Document:3", "Goodbye World");

    const results = index.searchContains("Hello");

    expect(results).toEqual(new Set(["Document:1", "Document:2"]));
  });

  it("should search prefix", () => {
    index.add("Document:1", "Hello World");
    index.add("Document:2", "World Hello");
    index.add("Document:3", "Goodbye");

    const results = index.searchPrefix("Hello");

    expect(results).toEqual(new Set(["Document:1"]));
  });

  it("should return scored results", () => {
    index.add("Document:1", "graph database indexing");
    index.add("Document:2", "graph theory mathematics");
    index.add("Document:3", "database systems");

    const results = index.search("graph database");

    // Document:1 should score highest (has both terms)
    expect(results[0]!.elementId).toBe("Document:1");
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });

  it("should respect minScore threshold", () => {
    index.add("Document:1", "exact match query");
    index.add("Document:2", "something completely different");

    const results = index.search("exact match query", 0, 0.5);

    // Only high-scoring documents
    expect(results.length).toBe(1);
    expect(results[0]!.elementId).toBe("Document:1");
  });

  it("should update documents", () => {
    index.add("Document:1", "original content about cats");

    index.update(
      "Document:1",
      "original content about cats",
      "new content about dogs",
    );

    expect(index.searchContains("cats")).toEqual(new Set());
    expect(index.searchContains("dogs")).toEqual(new Set(["Document:1"]));
  });
});

describe("IndexManager", () => {
  let graph: Graph<typeof testSchema>;

  beforeEach(() => {
    graph = new Graph({
      schema: testSchema,
      storage: new InMemoryGraphStorage(),
    });
  });

  it("should detect index configuration from schema", () => {
    const manager = graph.indexManager;

    expect(manager.getIndexConfig("User", "email")).toEqual({ type: "hash" });
    expect(manager.getIndexConfig("User", "name")).toEqual({
      type: "fulltext",
    });
    expect(manager.getIndexConfig("User", "age")).toEqual({ type: "btree" });
    expect(manager.getIndexConfig("User", "unknown")).toBeUndefined();
  });

  it("should check index type", () => {
    const manager = graph.indexManager;

    expect(manager.hasIndexOfType("User", "email", "hash")).toBe(true);
    expect(manager.hasIndexOfType("User", "email", "btree")).toBe(false);
    expect(manager.hasIndexOfType("User", "name", "fulltext")).toBe(true);
  });

  it("should create and return correct index type", () => {
    const manager = graph.indexManager;

    const hashIndex = manager.getHashIndex("User", "email");
    const btreeIndex = manager.getBTreeIndex("User", "age");
    const fulltextIndex = manager.getFullTextIndex("User", "name");

    expect(hashIndex).toBeInstanceOf(HashIndex);
    expect(btreeIndex).toBeInstanceOf(BTreeIndex);
    expect(fulltextIndex).toBeInstanceOf(FullTextIndex);
  });

  it("should build index from existing elements", () => {
    // Add some users first
    graph.addVertex("User", {
      email: "alice@example.com",
      name: "Alice Smith",
      age: 25,
      status: "active",
    });
    graph.addVertex("User", {
      email: "bob@example.com",
      name: "Bob Jones",
      age: 30,
      status: "inactive",
    });

    const manager = graph.indexManager;

    // Build index
    const hashIndex = manager.buildIndex(
      "User",
      "email",
      graph.storage.getVertices(["User"]),
    ) as HashIndex;

    expect(hashIndex).toBeInstanceOf(HashIndex);
    expect(hashIndex.lookup("alice@example.com").size).toBe(1);
    expect(hashIndex.lookup("bob@example.com").size).toBe(1);
    expect(manager.isBuilt("User", "email")).toBe(true);
  });

  it("should maintain index on element add", () => {
    const manager = graph.indexManager;

    // Build initial index
    manager.buildIndex("User", "status", graph.storage.getVertices(["User"]));

    // Now add a user
    graph.addVertex("User", {
      email: "alice@example.com",
      name: "Alice",
      age: 25,
      status: "active",
    });

    // Index should be updated
    const hashIndex = manager.getHashIndex("User", "status")!;
    expect(hashIndex.lookup("active").size).toBe(1);
  });

  it("should maintain index on element remove", () => {
    // Add user
    const user = graph.addVertex("User", {
      email: "alice@example.com",
      name: "Alice",
      age: 25,
      status: "active",
    });

    // Build index
    const manager = graph.indexManager;
    manager.buildIndex("User", "status", graph.storage.getVertices(["User"]));

    const hashIndex = manager.getHashIndex("User", "status")!;
    expect(hashIndex.lookup("active").size).toBe(1);

    // Remove user
    graph.deleteVertex(user);

    expect(hashIndex.lookup("active").size).toBe(0);
  });

  it("should maintain index on property update", () => {
    // Add user
    const user = graph.addVertex("User", {
      email: "alice@example.com",
      name: "Alice",
      age: 25,
      status: "active",
    });

    // Build index
    const manager = graph.indexManager;
    manager.buildIndex("User", "status", graph.storage.getVertices(["User"]));

    const hashIndex = manager.getHashIndex("User", "status")!;
    expect(hashIndex.lookup("active").size).toBe(1);

    // Update status
    graph.updateProperty(user, "status", "inactive");

    expect(hashIndex.lookup("active").size).toBe(0);
    expect(hashIndex.lookup("inactive").size).toBe(1);
  });

  it("should list all index configurations", () => {
    const manager = graph.indexManager;
    const configs = manager.getAllIndexConfigs();

    // Should have configs for User (4) + Document (3) + authored (1)
    expect(configs.length).toBe(8);

    const userEmailConfig = configs.find(
      (c) => c.label === "User" && c.property === "email",
    );
    expect(userEmailConfig).toBeDefined();
    expect(userEmailConfig!.config.type).toBe("hash");
    expect(userEmailConfig!.elementType).toBe("vertex");

    const authoredRoleConfig = configs.find(
      (c) => c.label === "authored" && c.property === "role",
    );
    expect(authoredRoleConfig).toBeDefined();
    expect(authoredRoleConfig!.elementType).toBe("edge");
  });
});

describe("QueryPlanner", () => {
  it("should analyze equality conditions", () => {
    const condition: Condition = ["=", "email", "alice@example.com"];
    const hints = analyzeCondition(condition);

    expect(hints.length).toBe(2); // hash and btree both support equality
    expect(
      hints.some((h) => h.type === "hash" && h.operation === "equals"),
    ).toBe(true);
    expect(
      hints.some((h) => h.type === "btree" && h.operation === "equals"),
    ).toBe(true);
  });

  it("should analyze IN conditions", () => {
    const condition: Condition = ["in", "status", ["active", "pending"]];
    const hints = analyzeCondition(condition);

    expect(hints.length).toBe(1);
    expect(hints[0]!.type).toBe("hash");
    expect(hints[0]!.operation).toBe("in");
    expect(hints[0]!.value).toEqual(["active", "pending"]);
  });

  it("should analyze range conditions", () => {
    const ltCondition: Condition = ["<", "age", 30];
    const lteCondition: Condition = ["<=", "age", 30];
    const gtCondition: Condition = [">", "age", 30];
    const gteCondition: Condition = [">=", "age", 30];

    expect(analyzeCondition(ltCondition)[0]!.operation).toBe("lessThan");
    expect(analyzeCondition(lteCondition)[0]!.operation).toBe(
      "lessThanOrEqual",
    );
    expect(analyzeCondition(gtCondition)[0]!.operation).toBe("greaterThan");
    expect(analyzeCondition(gteCondition)[0]!.operation).toBe(
      "greaterThanOrEqual",
    );
  });

  it("should analyze fulltext conditions", () => {
    const startsWithCondition: Condition = ["startsWith", "name", "Ali"];
    const containsCondition: Condition = ["contains", "name", "Smith"];

    const startsWithHints = analyzeCondition(startsWithCondition);
    const containsHints = analyzeCondition(containsCondition);

    expect(startsWithHints[0]!.type).toBe("fulltext");
    expect(startsWithHints[0]!.operation).toBe("startsWith");

    expect(containsHints[0]!.type).toBe("fulltext");
    expect(containsHints[0]!.operation).toBe("contains");
  });

  it("should analyze compound AND conditions", () => {
    const condition: Condition = [
      "and",
      ["=", "status", "active"],
      [">", "age", 25],
    ];
    const hints = analyzeCondition(condition);

    // Should find hints for both sub-conditions
    expect(hints.some((h) => h.property === "status")).toBe(true);
    expect(hints.some((h) => h.property === "age")).toBe(true);
  });

  it("should skip special properties", () => {
    const condition: Condition = ["=", "@label", "User"];
    const hints = analyzeCondition(condition);

    expect(hints.length).toBe(0);
  });

  it("should select best index hint", () => {
    const hints = [
      {
        type: "hash" as const,
        property: "email",
        operation: "equals" as const,
        value: "test@example.com",
        condition: ["=", "email", "test@example.com"] as Condition,
      },
      {
        type: "btree" as const,
        property: "age",
        operation: "greaterThan" as const,
        value: 25,
        condition: [">", "age", 25] as Condition,
      },
    ];

    // Prefer hash equality over btree range
    const best = selectBestIndexHint(hints, (prop, type) => {
      if (prop === "email" && type === "hash") return true;
      if (prop === "age" && type === "btree") return true;
      return false;
    });

    expect(best!.property).toBe("email");
    expect(best!.operation).toBe("equals");
  });

  it("should return undefined when no usable index", () => {
    const hints = [
      {
        type: "hash" as const,
        property: "email",
        operation: "equals" as const,
        value: "test@example.com",
        condition: ["=", "email", "test@example.com"] as Condition,
      },
    ];

    const best = selectBestIndexHint(hints, () => false);

    expect(best).toBeUndefined();
  });
});

describe("Graph integration with indexes", () => {
  let graph: Graph<typeof testSchema>;

  beforeEach(() => {
    graph = new Graph({
      schema: testSchema,
      storage: new InMemoryGraphStorage(),
    });

    // Add test data
    graph.addVertex("User", {
      email: "alice@example.com",
      name: "Alice Smith",
      age: 25,
      status: "active",
    });
    graph.addVertex("User", {
      email: "bob@example.com",
      name: "Bob Jones",
      age: 30,
      status: "active",
    });
    graph.addVertex("User", {
      email: "charlie@example.com",
      name: "Charlie Brown",
      age: 35,
      status: "inactive",
    });
  });

  it("should use hash index for equality lookup", () => {
    const manager = graph.indexManager;

    // Build index
    const hashIndex = manager.buildIndex(
      "User",
      "email",
      graph.storage.getVertices(["User"]),
    ) as HashIndex;

    // Lookup by email
    const aliceIds = hashIndex.lookup("alice@example.com");

    expect(aliceIds.size).toBe(1);

    // Get the vertex
    const [aliceId] = [...aliceIds];
    const alice = graph.getVertexById<"User">(aliceId!);

    expect(alice!.get("name")).toBe("Alice Smith");
  });

  it("should use btree index for range query", () => {
    const manager = graph.indexManager;

    // Build index
    const btreeIndex = manager.buildIndex(
      "User",
      "age",
      graph.storage.getVertices(["User"]),
    ) as BTreeIndex;

    // Find users over 30
    const over30Ids = btreeIndex.lookupGreaterThan(30);

    expect(over30Ids.size).toBe(1);

    const [charlieId] = [...over30Ids];
    const charlie = graph.getVertexById<"User">(charlieId!);

    expect(charlie!.get("name")).toBe("Charlie Brown");
  });

  it("should use fulltext index for search", () => {
    const manager = graph.indexManager;

    // Build index
    const fulltextIndex = manager.buildIndex(
      "User",
      "name",
      graph.storage.getVertices(["User"]),
    ) as FullTextIndex;

    // Search for "Smith"
    const results = fulltextIndex.search("Smith");

    expect(results.length).toBe(1);
    expect(results[0]!.score).toBeGreaterThan(0);

    const alice = graph.getVertexById<"User">(results[0]!.elementId);
    expect(alice!.get("email")).toBe("alice@example.com");
  });

  it("should provide index statistics", () => {
    const manager = graph.indexManager;

    // Build all indexes
    manager.buildIndex("User", "email", graph.storage.getVertices(["User"]));
    manager.buildIndex("User", "status", graph.storage.getVertices(["User"]));

    const stats = manager.statistics();

    expect(stats["User.email"]).toBeDefined();
    expect(stats["User.email"]!.entries).toBe(3);
    expect(stats["User.email"]!.uniqueValues).toBe(3);

    expect(stats["User.status"]).toBeDefined();
    expect(stats["User.status"]!.entries).toBe(3);
    expect(stats["User.status"]!.uniqueValues).toBe(2); // "active" and "inactive"
  });
});

describe("Query execution with index integration", () => {
  let graph: Graph<typeof testSchema>;

  beforeEach(() => {
    graph = new Graph({
      schema: testSchema,
      storage: new InMemoryGraphStorage(),
    });

    // Add test data
    graph.addVertex("User", {
      email: "alice@example.com",
      name: "Alice Smith",
      age: 25,
      status: "active",
    });
    graph.addVertex("User", {
      email: "bob@example.com",
      name: "Bob Jones",
      age: 30,
      status: "active",
    });
    graph.addVertex("User", {
      email: "charlie@example.com",
      name: "Charlie Brown",
      age: 35,
      status: "inactive",
    });
    graph.addVertex("User", {
      email: "diana@example.com",
      name: "Diana Prince",
      age: 28,
      status: "pending",
    });
  });

  it("should use hash index for equality filter in traversal", () => {
    const g = new GraphTraversal(graph);

    // Query using equality filter on indexed property
    const results = Array.from(
      g.V().hasLabel("User").has("email", "alice@example.com").values(),
    );

    expect(results.length).toBe(1);
    expect(results[0]!.get("name")).toBe("Alice Smith");
  });

  it("should use btree index for range filter in traversal", () => {
    const g = new GraphTraversal(graph);

    // Query using range filter on indexed property
    const results = Array.from(
      g.V().hasLabel("User").has("age", ">", 28).values(),
    );

    expect(results.length).toBe(2);
    const names = results.map((r) => r.get("name")).sort();
    expect(names).toEqual(["Bob Jones", "Charlie Brown"]);
  });

  it("should use hash index for IN filter in traversal", () => {
    const g = new GraphTraversal(graph);

    // Query using IN filter on indexed property
    const results = Array.from(
      g.V().hasLabel("User").hasIn("status", ["active", "pending"]).values(),
    );

    expect(results.length).toBe(3);
    const names = results.map((r) => r.get("name")).sort();
    expect(names).toEqual(["Alice Smith", "Bob Jones", "Diana Prince"]);
  });

  it("should use fulltext index for startsWith filter", () => {
    const g = new GraphTraversal(graph);

    // Query using startsWith on indexed property
    const results = Array.from(
      g.V().hasLabel("User").startsWith("name", "Ali").values(),
    );

    expect(results.length).toBe(1);
    expect(results[0]!.get("email")).toBe("alice@example.com");
  });

  it("should use fulltext index for contains filter", () => {
    const g = new GraphTraversal(graph);

    // Query using contains on indexed property
    const results = Array.from(
      g.V().hasLabel("User").containing("name", "Jones").values(),
    );

    expect(results.length).toBe(1);
    expect(results[0]!.get("email")).toBe("bob@example.com");
  });

  it("should handle compound conditions with index + post-filter", () => {
    const g = new GraphTraversal(graph);

    // Query with compound condition: age > 25 AND status = 'active'
    // Index will handle age > 25, post-filter will handle status = 'active'
    const results = Array.from(
      g
        .V()
        .hasLabel("User")
        .has("age", ">", 25)
        .has("status", "active")
        .values(),
    );

    expect(results.length).toBe(1);
    expect(results[0]!.get("name")).toBe("Bob Jones");
  });

  it("should fall back to full scan when no index available", () => {
    // Create a schema without indexes
    const noIndexSchema = {
      vertices: {
        Person: {
          properties: {
            email: { type: makeType<string>("") },
            name: { type: makeType<string>("") },
          },
        },
      },
      edges: {},
    } satisfies GraphSchema;

    const noIndexGraph = new Graph({
      schema: noIndexSchema,
      storage: new InMemoryGraphStorage(),
    });

    noIndexGraph.addVertex("Person", {
      email: "test@example.com",
      name: "Test",
    });

    const g = new GraphTraversal(noIndexGraph);

    // This should work but fall back to full scan
    const results = Array.from(
      g.V().hasLabel("Person").has("email", "test@example.com").values(),
    );

    expect(results.length).toBe(1);
    expect(results[0]!.get("name")).toBe("Test");
  });
});
