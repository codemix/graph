import { test, expect, describe } from "vitest";
import { Vertex } from "../Graph.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { CreateStep, MergeStep, StartStep } from "../Steps.js";
import type { Query, CreateNodePattern } from "../AST.js";
import { executeQuery, createFlexibleGraph } from "./testHelpers.js";

// ============================================================================
// Standalone CREATE Tests (no MATCH clause)
// ============================================================================

describe("Standalone CREATE (without MATCH)", () => {
  describe("Grammar parsing", () => {
    test("parses standalone CREATE with single node", () => {
      const ast = parse("CREATE (u:User {name: 'Alice'}) RETURN u") as Query;

      expect(ast.type).toBe("Query");
      expect(ast.matches).toHaveLength(0);
      expect(ast.create).toBeDefined();
      expect(ast.create!.patterns).toHaveLength(1);

      const pattern = ast.create!.patterns[0] as CreateNodePattern;
      expect(pattern.type).toBe("CreateNodePattern");
      expect(pattern.variable).toBe("u");
      expect(pattern.labels).toEqual(["User"]);
      expect(pattern.properties).toEqual({ name: "Alice" });
    });

    test("parses standalone CREATE with multiple nodes", () => {
      const ast = parse(
        "CREATE (u:User {name: 'Alice'}), (p:Post {title: 'Hello'}) RETURN u, p",
      ) as Query;

      expect(ast.matches).toHaveLength(0);
      expect(ast.create!.patterns).toHaveLength(2);
      expect((ast.create!.patterns[0] as CreateNodePattern).labels).toEqual(["User"]);
      expect((ast.create!.patterns[1] as CreateNodePattern).labels).toEqual(["Post"]);
    });

    test("parses standalone CREATE with multiple properties", () => {
      const ast = parse(
        "CREATE (u:User {name: 'Alice', age: 30, email: 'alice@example.com'}) RETURN u",
      ) as Query;

      const pattern = ast.create!.patterns[0] as CreateNodePattern;
      expect(pattern.properties).toEqual({
        name: "Alice",
        age: 30,
        email: "alice@example.com",
      });
    });

    test("parses standalone CREATE without properties", () => {
      const ast = parse("CREATE (u:User) RETURN u") as Query;

      expect(ast.matches).toHaveLength(0);
      const pattern = ast.create!.patterns[0] as CreateNodePattern;
      expect(pattern.labels).toEqual(["User"]);
      expect(pattern.properties).toBeUndefined();
    });
  });

  describe("AST to Steps conversion", () => {
    test("converts standalone CREATE to StartStep + CreateStep", () => {
      const ast = parse("CREATE (u:User {name: 'Alice'}) RETURN u") as Query;
      const steps = astToSteps(ast);

      // Should have StartStep for standalone mutations
      const startStep = steps.find((s) => s instanceof StartStep);
      expect(startStep).toBeDefined();

      const createStep = steps.find((s) => s instanceof CreateStep);
      expect(createStep).toBeDefined();
      expect((createStep as CreateStep).config.vertices).toHaveLength(1);
      expect((createStep as CreateStep).config.vertices[0]).toEqual({
        variable: "u",
        label: "User",
        properties: { name: "Alice" },
      });
    });

    test("converts standalone CREATE with multiple nodes to single CreateStep", () => {
      const ast = parse(
        "CREATE (u:User {name: 'Alice'}), (p:Post {title: 'Hello'}) RETURN u, p",
      ) as Query;
      const steps = astToSteps(ast);

      const createStep = steps.find((s) => s instanceof CreateStep);
      expect(createStep).toBeDefined();
      expect((createStep as CreateStep).config.vertices).toHaveLength(2);
    });
  });

  describe("Query execution", () => {
    test("creates a single vertex in empty graph", () => {
      const graph = createFlexibleGraph();

      // Verify graph is empty
      expect([...graph.getVertices("User")]).toHaveLength(0);

      const results = executeQuery(graph, "CREATE (u:User {name: 'Alice', age: 25}) RETURN u");

      expect(results).toHaveLength(1);
      const created = (results[0] as any[])[0] as any;
      expect(created).toBeInstanceOf(Vertex);
      expect(created.get("name")).toBe("Alice");
      expect(created.get("age")).toBe(25);
      expect(created.label).toBe("User");

      // Verify vertex was added to graph
      expect([...graph.getVertices("User")]).toHaveLength(1);
    });

    test("creates multiple vertices in empty graph", () => {
      const graph = createFlexibleGraph();

      const results = executeQuery(
        graph,
        "CREATE (u:User {name: 'Alice'}), (p:Post {title: 'Hello World'}) RETURN u, p",
      );

      expect(results).toHaveLength(1);
      const row = results[0] as any[];
      expect(row).toHaveLength(2);

      const user = row[0] as any;
      const post = row[1] as any;

      expect(user.get("name")).toBe("Alice");
      expect(user.label).toBe("User");
      expect(post.get("title")).toBe("Hello World");
      expect(post.label).toBe("Post");

      // Verify both vertices were added
      expect([...graph.getVertices("User")]).toHaveLength(1);
      expect([...graph.getVertices("Post")]).toHaveLength(1);
    });

    test("creates vertex without properties", () => {
      const graph = createFlexibleGraph();

      const results = executeQuery(graph, "CREATE (u:User) RETURN u");

      expect(results).toHaveLength(1);
      const created = (results[0] as any[])[0] as any;
      expect(created.label).toBe("User");
    });

    test("creates multiple vertices of same type", () => {
      const graph = createFlexibleGraph();

      executeQuery(graph, "CREATE (u:User {name: 'Alice'}) RETURN u");
      executeQuery(graph, "CREATE (u:User {name: 'Bob'}) RETURN u");
      executeQuery(graph, "CREATE (u:User {name: 'Charlie'}) RETURN u");

      const users = [...graph.getVertices("User")];
      expect(users).toHaveLength(3);

      const names = users.map((u) => u.get("name"));
      expect(names).toContain("Alice");
      expect(names).toContain("Bob");
      expect(names).toContain("Charlie");
    });

    test("vertex ID is accessible after creation", () => {
      const graph = createFlexibleGraph();

      const results = executeQuery(graph, "CREATE (u:User {name: 'Alice'}) RETURN u");

      const created = (results[0] as any[])[0] as any;
      expect(created.id).toBeDefined();
      expect(typeof created.id).toBe("string");

      // Verify we can retrieve the vertex by ID
      const retrieved = graph.getVertexById(created.id) as any;
      expect(retrieved).toBeDefined();
      expect(retrieved.get("name")).toBe("Alice");
    });
  });
});

// ============================================================================
// Standalone MERGE Tests (no MATCH clause)
// ============================================================================

describe("Standalone MERGE (without MATCH)", () => {
  describe("Grammar parsing", () => {
    test("parses standalone MERGE with single node", () => {
      const ast = parse("MERGE (u:User {name: 'Alice'}) RETURN u") as Query;

      expect(ast.type).toBe("Query");
      expect(ast.matches).toHaveLength(0);
      expect(ast.merge).toHaveLength(1);
    });

    test("parses standalone MERGE with ON CREATE SET", () => {
      const ast = parse(
        "MERGE (u:User {email: 'alice@test.com'}) ON CREATE SET u.createdAt = 123 RETURN u",
      ) as Query;

      expect(ast.matches).toHaveLength(0);
      expect(ast.merge).toHaveLength(1);
      expect(ast.merge?.[0]?.onCreate).toBeDefined();
    });

    test("parses standalone MERGE with ON MATCH SET", () => {
      const ast = parse(
        "MERGE (u:User {email: 'alice@test.com'}) ON MATCH SET u.lastSeen = 456 RETURN u",
      ) as Query;

      expect(ast.matches).toHaveLength(0);
      expect(ast.merge?.[0]?.onMatch).toBeDefined();
    });

    test("parses standalone MERGE with both ON CREATE and ON MATCH", () => {
      const ast = parse(
        "MERGE (u:User {email: 'alice@test.com'}) ON CREATE SET u.createdAt = 123 ON MATCH SET u.lastSeen = 456 RETURN u",
      ) as Query;

      expect(ast.matches).toHaveLength(0);
      expect(ast.merge?.[0]?.onCreate).toBeDefined();
      expect(ast.merge?.[0]?.onMatch).toBeDefined();
    });
  });

  describe("AST to Steps conversion", () => {
    test("converts standalone MERGE to StartStep + MergeStep", () => {
      const ast = parse("MERGE (u:User {name: 'Alice'}) RETURN u") as Query;
      const steps = astToSteps(ast);

      // Should have StartStep for standalone mutations
      const startStep = steps.find((s) => s instanceof StartStep);
      expect(startStep).toBeDefined();

      const mergeStep = steps.find((s) => s instanceof MergeStep);
      expect(mergeStep).toBeDefined();
    });
  });

  describe("Query execution", () => {
    test("creates vertex when not exists in empty graph", () => {
      const graph = createFlexibleGraph();

      expect([...graph.getVertices("User")]).toHaveLength(0);

      const results = executeQuery(graph, "MERGE (u:User {name: 'Alice'}) RETURN u");

      expect(results).toHaveLength(1);
      const created = (results[0] as any[])[0] as any;
      expect(created.get("name")).toBe("Alice");

      expect([...graph.getVertices("User")]).toHaveLength(1);
    });

    test("finds existing vertex instead of creating", () => {
      const graph = createFlexibleGraph();

      // Pre-create a user
      const existing = graph.addVertex("User", { name: "Alice", age: 25 });

      const results = executeQuery(graph, "MERGE (u:User {name: 'Alice'}) RETURN u");

      expect(results).toHaveLength(1);
      const found = (results[0] as any[])[0] as any;
      expect(found.id).toBe(existing.id);
      expect(found.get("age")).toBe(25); // Original property preserved

      // No new vertex created
      expect([...graph.getVertices("User")]).toHaveLength(1);
    });

    test("applies ON CREATE SET when creating new vertex", () => {
      const graph = createFlexibleGraph();

      const results = executeQuery(
        graph,
        "MERGE (u:User {name: 'Alice'}) ON CREATE SET u.status = 'new' RETURN u",
      );

      const created = (results[0] as any[])[0] as any;
      expect(created.get("status")).toBe("new");
    });

    test("applies ON MATCH SET when finding existing vertex", () => {
      const graph = createFlexibleGraph();
      graph.addVertex("User", { name: "Alice", status: "old" });

      const results = executeQuery(
        graph,
        "MERGE (u:User {name: 'Alice'}) ON MATCH SET u.status = 'updated' RETURN u",
      );

      const found = (results[0] as any[])[0] as any;
      expect(found.get("status")).toBe("updated");
    });

    test("ON CREATE SET not applied when matching existing", () => {
      const graph = createFlexibleGraph();
      graph.addVertex("User", { name: "Alice" });

      const results = executeQuery(
        graph,
        "MERGE (u:User {name: 'Alice'}) ON CREATE SET u.status = 'new' RETURN u",
      );

      const found = (results[0] as any[])[0] as any;
      // status should NOT be set since vertex already existed
      expect(found.get("status")).toBeUndefined();
    });

    test("ON MATCH SET not applied when creating new", () => {
      const graph = createFlexibleGraph();

      const results = executeQuery(
        graph,
        "MERGE (u:User {name: 'Alice'}) ON MATCH SET u.status = 'existing' RETURN u",
      );

      const created = (results[0] as any[])[0] as any;
      // status should NOT be set since vertex was created
      expect(created.get("status")).toBeUndefined();
    });

    test("multiple standalone MERGEs - idempotent behavior", () => {
      const graph = createFlexibleGraph();

      // First MERGE creates
      executeQuery(graph, "MERGE (u:User {name: 'Alice'}) RETURN u");
      expect([...graph.getVertices("User")]).toHaveLength(1);

      // Second MERGE finds existing
      executeQuery(graph, "MERGE (u:User {name: 'Alice'}) RETURN u");
      expect([...graph.getVertices("User")]).toHaveLength(1);

      // Third MERGE still finds existing
      executeQuery(graph, "MERGE (u:User {name: 'Alice'}) RETURN u");
      expect([...graph.getVertices("User")]).toHaveLength(1);
    });
  });
});

// ============================================================================
// Combined Standalone Mutations (CREATE + SET, MERGE + SET, etc.)
// ============================================================================

describe("Combined standalone mutations", () => {
  test("standalone CREATE followed by SET", () => {
    const graph = createFlexibleGraph();

    const results = executeQuery(
      graph,
      "CREATE (u:User {name: 'Alice'}) SET u.verified = true RETURN u",
    );

    const created = (results[0] as any[])[0] as any;
    expect(created.get("name")).toBe("Alice");
    expect(created.get("verified")).toBe(true);
  });

  test("standalone MERGE followed by SET", () => {
    const graph = createFlexibleGraph();

    const results = executeQuery(
      graph,
      "MERGE (u:User {name: 'Alice'}) SET u.verified = true RETURN u",
    );

    const created = (results[0] as any[])[0] as any;
    expect(created.get("name")).toBe("Alice");
    expect(created.get("verified")).toBe(true);
  });

  test("standalone CREATE with multiple SET assignments", () => {
    const graph = createFlexibleGraph();

    const results = executeQuery(
      graph,
      "CREATE (u:User {name: 'Alice'}) SET u.age = 30, u.verified = true RETURN u",
    );

    const created = (results[0] as any[])[0] as any;
    expect(created.get("name")).toBe("Alice");
    expect(created.get("age")).toBe(30);
    expect(created.get("verified")).toBe(true);
  });

  test("standalone MERGE + CREATE creates both", () => {
    const graph = createFlexibleGraph();

    const results = executeQuery(
      graph,
      "MERGE (u:User {name: 'Alice'}) CREATE (p:Post {title: 'Hello', author: 'Alice'}) RETURN u, p",
    );

    expect(results).toHaveLength(1);
    const row = results[0] as any[];
    const user = row[0] as any;
    const post = row[1] as any;

    expect(user.get("name")).toBe("Alice");
    expect(post.get("title")).toBe("Hello");

    expect([...graph.getVertices("User")]).toHaveLength(1);
    expect([...graph.getVertices("Post")]).toHaveLength(1);
  });

  test("standalone CREATE + MERGE (CREATE before MERGE) works", () => {
    const graph = createFlexibleGraph();

    // CREATE before MERGE should be valid Cypher
    const results = executeQuery(
      graph,
      "CREATE (p:Post {title: 'Hello'}) MERGE (u:User {name: 'Alice'}) RETURN p, u",
    );

    expect(results).toHaveLength(1);
    const row = results[0] as any[];
    const post = row[0] as any;
    const user = row[1] as any;

    expect(post.get("title")).toBe("Hello");
    expect(user.get("name")).toBe("Alice");

    expect([...graph.getVertices("Post")]).toHaveLength(1);
    expect([...graph.getVertices("User")]).toHaveLength(1);
  });

  test("intermixed CREATE and MERGE clauses parse correctly", () => {
    // Verify that CREATE before MERGE parses as valid grammar
    const ast = parse(
      "CREATE (a:Property {name: 'test'}) MERGE (c:Concept {name: 'Test'}) RETURN a, c",
    ) as Query;

    expect(ast.type).toBe("Query");
    expect(ast.create).toBeDefined();
    expect(ast.merge).toBeDefined();
    expect(ast.create!.patterns).toHaveLength(1);
    expect(ast.merge).toHaveLength(1);
  });

  test("mutations array preserves original clause order", () => {
    // Verify the mutations array captures the original order for correct execution
    const ast = parse(
      "CREATE (a:User) MERGE (b:Post) CREATE (c:User) MERGE (d:Post) RETURN a, b, c, d",
    ) as Query;

    expect(ast.mutations).toBeDefined();
    expect(ast.mutations).toHaveLength(4);
    // Verify order: CREATE, MERGE, CREATE, MERGE
    const types = ast.mutations!.map((m) => m.type);
    expect(types).toEqual(["CreateClause", "MergeClause", "CreateClause", "MergeClause"]);
  });

  test("multiple alternating CREATE and MERGE clauses", () => {
    const graph = createFlexibleGraph();

    // CREATE, MERGE, CREATE - all should work
    const results = executeQuery(
      graph,
      "CREATE (a:User {name: 'A'}) MERGE (b:Post {title: 'B'}) CREATE (c:User {name: 'C'}) RETURN a, b, c",
    );

    expect(results).toHaveLength(1);
    const row = results[0] as any[];
    expect(row[0].get("name")).toBe("A");
    expect(row[1].get("title")).toBe("B");
    expect(row[2].get("name")).toBe("C");

    // Verify all vertices were created (2 Users, 1 Post)
    expect([...graph.getVertices("User")]).toHaveLength(2);
    expect([...graph.getVertices("Post")]).toHaveLength(1);
  });
});

// ============================================================================
// Error Cases - Standalone DELETE/SET/REMOVE should fail gracefully
// ============================================================================

describe("Invalid standalone mutations", () => {
  test("standalone DELETE fails - unbound variable", () => {
    const graph = createFlexibleGraph();

    // DELETE without MATCH/CREATE/MERGE means 'u' is not bound
    // The query parses but execution should fail
    expect(() => executeQuery(graph, "DELETE u RETURN u")).toThrow();
  });

  test("standalone SET fails - unbound variable", () => {
    const graph = createFlexibleGraph();

    // SET without MATCH/CREATE/MERGE means 'u' is not bound
    expect(() => executeQuery(graph, "SET u.name = 'Alice' RETURN u")).toThrow();
  });

  test("standalone REMOVE fails - unbound variable", () => {
    const graph = createFlexibleGraph();

    // REMOVE without MATCH/CREATE/MERGE means 'u' is not bound
    expect(() => executeQuery(graph, "REMOVE u.name RETURN u")).toThrow();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge cases", () => {
  test("CREATE returns correct number of results with LIMIT", () => {
    const graph = createFlexibleGraph();

    // Even with LIMIT 1, CREATE should still create the vertex
    const results = executeQuery(graph, "CREATE (u:User {name: 'Alice'}) RETURN u LIMIT 1");

    expect(results).toHaveLength(1);
    expect([...graph.getVertices("User")]).toHaveLength(1);
  });

  test("MERGE with complex match properties", () => {
    const graph = createFlexibleGraph();

    const results = executeQuery(
      graph,
      "MERGE (u:User {name: 'Alice', email: 'alice@test.com'}) RETURN u",
    );

    expect(results).toHaveLength(1);
    const created = (results[0] as any[])[0] as any;
    expect(created.get("name")).toBe("Alice");
    expect(created.get("email")).toBe("alice@test.com");
  });

  test("multiple MERGE clauses in single query", () => {
    const graph = createFlexibleGraph();

    const results = executeQuery(
      graph,
      "MERGE (u:User {name: 'Alice'}) MERGE (p:Post {title: 'Hello'}) RETURN u, p",
    );

    expect(results).toHaveLength(1);
    expect([...graph.getVertices("User")]).toHaveLength(1);
    expect([...graph.getVertices("Post")]).toHaveLength(1);
  });

  test("CREATE without RETURN works (side effects only)", () => {
    const graph = createFlexibleGraph();

    // This tests that CREATE works even when we only care about side effects
    // Note: In our implementation RETURN is required by grammar, so we return the created node
    const results = executeQuery(graph, "CREATE (u:User {name: 'SideEffectUser'}) RETURN u");

    expect(results).toHaveLength(1);

    // Verify the side effect worked
    const users = [...graph.getVertices("User")] as any[];
    expect(users).toHaveLength(1);
    expect(users[0]?.get("name")).toBe("SideEffectUser");
  });

  test("MERGE finds by partial property match", () => {
    const graph = createFlexibleGraph();

    // Create user with multiple properties
    graph.addVertex("User", {
      name: "Alice",
      age: 30,
      email: "alice@test.com",
    });

    // MERGE on just name should find the existing user
    const results = executeQuery(graph, "MERGE (u:User {name: 'Alice'}) RETURN u");

    expect(results).toHaveLength(1);
    const found = (results[0] as any[])[0] as any;
    expect(found.get("age")).toBe(30);
    expect(found.get("email")).toBe("alice@test.com");

    // No duplicate created
    expect([...graph.getVertices("User")]).toHaveLength(1);
  });
});
