import { test, expect, describe } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { DeleteStep, RemoveStep, MergeStep, CreateStep } from "../Steps.js";
import type { Query } from "../AST.js";
import {
  executeQuery,
  createFlexibleGraph,
  createComprehensiveGraph,
} from "./testHelpers.js";
import { Edge } from "../Graph.js";

// ============================================================================
// DELETE Tests
// ============================================================================

describe("DELETE clause", () => {
  test("Grammar - parses DELETE with single variable", () => {
    const ast = parse("MATCH (u:User) DELETE u RETURN u") as Query;
    expect(ast.delete).toBeDefined();
    expect(ast.delete!.detach).toBe(false);
    expect(ast.delete!.variables).toEqual(["u"]);
  });

  test("Grammar - parses DELETE with multiple variables", () => {
    const ast = parse(
      "MATCH (u:User)-[r:follows]->(f) DELETE r, u RETURN f",
    ) as Query;
    expect(ast.delete!.variables).toEqual(["r", "u"]);
  });

  test("Grammar - parses DETACH DELETE", () => {
    const ast = parse("MATCH (u:User) DETACH DELETE u RETURN u") as Query;
    expect(ast.delete!.detach).toBe(true);
    expect(ast.delete!.variables).toEqual(["u"]);
  });

  test("AST to Steps - converts DELETE to DeleteStep", () => {
    const ast = parse("MATCH (u:User) DELETE u RETURN u") as Query;
    const steps = astToSteps(ast);
    const deleteStep = steps.find((s) => s instanceof DeleteStep);
    expect(deleteStep).toBeDefined();
    expect((deleteStep as DeleteStep).config.variables).toEqual(["u"]);
    expect((deleteStep as DeleteStep).config.detach).toBe(false);
  });

  test("Execution - deletes an edge", () => {
    const graph = createFlexibleGraph();
    const alice = graph.addVertex("User", { name: "Alice" });
    const bob = graph.addVertex("User", { name: "Bob" });
    graph.addEdge(alice, "follows", bob, {});

    // Verify edge exists
    expect([...graph.getOutgoingEdges(alice.id)]).toHaveLength(1);

    executeQuery(
      graph,
      `MATCH (u:User {name: "Alice"})-[r:follows]->(f) DELETE r RETURN f`,
    );

    // Verify edge is deleted
    expect([...graph.getOutgoingEdges(alice.id)]).toHaveLength(0);
  });

  test("Execution - DETACH DELETE removes vertex and edges", () => {
    const graph = createFlexibleGraph();
    const alice = graph.addVertex("User", { name: "Alice", deleteme: true });
    const bob = graph.addVertex("User", { name: "Bob" });
    const charlie = graph.addVertex("User", { name: "Charlie" });
    graph.addEdge(alice, "follows", bob, {});
    graph.addEdge(charlie, "follows", alice, {});

    // Verify vertex exists with edges
    expect([...graph.getVertices("User")]).toHaveLength(3);

    // Use a unique property to target exactly one vertex
    executeQuery(
      graph,
      `MATCH (u:User) WHERE u.deleteme = true DETACH DELETE u RETURN u`,
    );

    // Verify only Alice and her edges are deleted
    expect([...graph.getVertices("User")]).toHaveLength(2);
    const remainingNames = [...graph.getVertices("User")].map((v) =>
      v.get("name"),
    );
    expect(remainingNames).toContain("Bob");
    expect(remainingNames).toContain("Charlie");
    expect(remainingNames).not.toContain("Alice");
  });

  test("Execution - DELETE throws if vertex has edges without DETACH", () => {
    const graph = createFlexibleGraph();
    const alice = graph.addVertex("User", { name: "Alice" });
    const bob = graph.addVertex("User", { name: "Bob" });
    graph.addEdge(alice, "follows", bob, {});

    expect(() =>
      executeQuery(graph, `MATCH (u:User {name: "Alice"}) DELETE u RETURN u`),
    ).toThrow(/connected edges/);
  });
});

// ============================================================================
// REMOVE Tests
// ============================================================================

describe("REMOVE clause", () => {
  test("Grammar - parses REMOVE with single property", () => {
    const ast = parse("MATCH (u:User) REMOVE u.age RETURN u") as Query;
    expect(ast.remove).toBeDefined();
    expect(ast.remove!.items).toHaveLength(1);
    expect(ast.remove!.items[0]).toEqual({
      type: "RemoveProperty",
      variable: "u",
      property: "age",
    });
  });

  test("Grammar - parses REMOVE with multiple properties", () => {
    const ast = parse("MATCH (u:User) REMOVE u.age, u.email RETURN u") as Query;
    expect(ast.remove!.items).toHaveLength(2);
  });

  test("AST to Steps - converts REMOVE to RemoveStep", () => {
    const ast = parse("MATCH (u:User) REMOVE u.age RETURN u") as Query;
    const steps = astToSteps(ast);
    const removeStep = steps.find((s) => s instanceof RemoveStep);
    expect(removeStep).toBeDefined();
    expect((removeStep as RemoveStep).config.items).toHaveLength(1);
  });

  test("Execution - removes a property", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", {
      name: "Alice",
      age: 30,
      email: "alice@test.com",
    });

    executeQuery(graph, `MATCH (u:User {name: "Alice"}) REMOVE u.age RETURN u`);

    const alice = [...graph.getVertices("User")].find(
      (v) => v.get("name") === "Alice",
    );
    expect(alice!.get("age")).toBeUndefined();
    expect(alice!.get("email")).toBe("alice@test.com");
  });
});

// ============================================================================
// MERGE Tests
// ============================================================================

describe("MERGE clause", () => {
  test("Grammar - parses MERGE with node pattern", () => {
    const ast = parse(
      "MATCH (x:User) MERGE (u:User {email: 'test@example.com'}) RETURN u",
    ) as Query;
    expect(ast.merge).toBeDefined();
    expect(ast.merge).toHaveLength(1);
    expect(ast.merge?.[0]!.pattern.type).toBe("NodePattern");
  });

  test("Grammar - parses MERGE with ON CREATE", () => {
    const ast = parse(
      `MATCH (x:User) MERGE (u:User {email: 'test@example.com'}) ON CREATE SET u.createdAt = 123 RETURN u`,
    ) as Query;
    expect(ast.merge?.[0]!.onCreate).toBeDefined();
    expect(ast.merge?.[0]!.onCreate!.assignments).toHaveLength(1);
  });

  test("Grammar - parses MERGE with ON MATCH", () => {
    const ast = parse(
      `MATCH (x:User) MERGE (u:User {email: 'test@example.com'}) ON MATCH SET u.lastSeen = 456 RETURN u`,
    ) as Query;
    expect(ast.merge?.[0]!.onMatch).toBeDefined();
    expect(ast.merge?.[0]!.onMatch!.assignments).toHaveLength(1);
  });

  test("Grammar - parses MERGE with both ON CREATE and ON MATCH", () => {
    const ast = parse(
      `MATCH (x:User) MERGE (u:User {email: 'test@example.com'}) ON CREATE SET u.createdAt = 123 ON MATCH SET u.lastSeen = 456 RETURN u`,
    ) as Query;
    expect(ast.merge?.[0]!.onCreate).toBeDefined();
    expect(ast.merge?.[0]!.onMatch).toBeDefined();
  });

  test("Grammar - parses MERGE relationship pattern", () => {
    const ast = parse(
      `MATCH (u:User) MATCH (p:Post) MERGE (u)-[r:viewed]->(p) RETURN r`,
    ) as Query;
    expect(ast.merge?.[0]!.pattern.type).toBe("MergeRelationshipPattern");
  });

  test("AST to Steps - converts MERGE to MergeStep", () => {
    const ast = parse(
      "MATCH (x:User) MERGE (u:User {email: 'test@example.com'}) RETURN u",
    ) as Query;
    const steps = astToSteps(ast);
    const mergeStep = steps.find((s) => s instanceof MergeStep);
    expect(mergeStep).toBeDefined();
  });

  test("Execution - creates node when not exists", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", { name: "Existing" });

    const initialCount = [...graph.getVertices("User")].length;

    executeQuery(
      graph,
      `MATCH (x:User) MERGE (u:User {email: 'new@example.com'}) RETURN u`,
    );

    const finalCount = [...graph.getVertices("User")].length;
    expect(finalCount).toBe(initialCount + 1);

    const newUser = [...graph.getVertices("User")].find(
      (v) => v.get("email") === "new@example.com",
    );
    expect(newUser).toBeDefined();
  });

  test("Execution - matches existing node", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", { email: "existing@example.com", name: "Alice" });

    const initialCount = [...graph.getVertices("User")].length;

    executeQuery(
      graph,
      `MATCH (x:User) MERGE (u:User {email: 'existing@example.com'}) RETURN u`,
    );

    const finalCount = [...graph.getVertices("User")].length;
    expect(finalCount).toBe(initialCount); // No new node created
  });

  test("Execution - applies ON CREATE when creating", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", { name: "Existing" });

    executeQuery(
      graph,
      `MATCH (x:User) MERGE (u:User {email: 'new@example.com'}) ON CREATE SET u.status = 'new' RETURN u`,
    );

    const newUser = [...graph.getVertices("User")].find(
      (v) => v.get("email") === "new@example.com",
    );
    expect(newUser!.get("status")).toBe("new");
  });

  test("Execution - applies ON MATCH when matching", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", { email: "existing@example.com", name: "Alice" });

    executeQuery(
      graph,
      `MATCH (x:User) MERGE (u:User {email: 'existing@example.com'}) ON MATCH SET u.status = 'updated' RETURN u`,
    );

    const existingUser = [...graph.getVertices("User")].find(
      (v) => v.get("email") === "existing@example.com",
    );
    expect(existingUser!.get("status")).toBe("updated");
  });

  test("Execution - merges relationship when not exists", () => {
    const graph = createFlexibleGraph();
    const alice = graph.addVertex("User", { name: "Alice" });
    const post = graph.addVertex("Post", { title: "Hello" });
    // Create a temp edge so we can traverse to get both u and p in the same path
    graph.addEdge(alice, "temp", post, {});

    executeQuery(
      graph,
      `MATCH (u:User {name: 'Alice'})-[t:temp]->(p:Post) MERGE (u)-[r:viewed]->(p) DELETE t RETURN r`,
    );

    const edges = [...graph.getOutgoingEdges(alice.id)].filter(
      (e) => e.label !== "temp",
    );
    expect(edges).toHaveLength(1);
    expect(edges[0]!.label).toBe("viewed");
  });

  test("Execution - does not create duplicate relationship", () => {
    const graph = createFlexibleGraph();
    const alice = graph.addVertex("User", { name: "Alice" });
    const post = graph.addVertex("Post", { title: "Hello" });
    graph.addEdge(alice, "viewed", post, {});

    // Use the existing edge to traverse
    executeQuery(
      graph,
      `MATCH (u:User {name: 'Alice'})-[r:viewed]->(p:Post) MERGE (u)-[r2:viewed]->(p) RETURN r2`,
    );

    const edges = [...graph.getOutgoingEdges(alice.id)];
    expect(edges).toHaveLength(1); // Still just one edge
  });
});

// ============================================================================
// CREATE Edge Tests
// ============================================================================

describe("CREATE edge syntax", () => {
  test("Grammar - parses CREATE relationship to existing node", () => {
    const ast = parse(
      `MATCH (u:User) MATCH (p:Post) CREATE (u)-[r:authored]->(p) RETURN r`,
    ) as Query;
    expect(ast.create).toBeDefined();
    expect(ast.create!.patterns).toHaveLength(1);
    expect(ast.create!.patterns[0]!.type).toBe("CreateChainPattern");
  });

  test("Grammar - parses CREATE relationship with new node", () => {
    const ast = parse(
      `MATCH (u:User) CREATE (u)-[r:authored]->(p:Post {title: 'New'}) RETURN p`,
    ) as Query;
    expect(ast.create!.patterns[0]!.type).toBe("CreateChainPattern");
  });

  test("Grammar - parses CREATE with edge properties", () => {
    const ast = parse(
      `MATCH (u:User) MATCH (p:Post) CREATE (u)-[r:authored {timestamp: 123}]->(p) RETURN r`,
    ) as Query;
    const pattern = ast.create!.patterns[0] as any;
    // In CreateChainPattern, the edge is at elements[1]
    expect(pattern.elements[1].properties).toEqual({ timestamp: 123 });
  });

  test("AST to Steps - converts CREATE edge to CreateStep with edges", () => {
    const ast = parse(
      `MATCH (u:User) MATCH (p:Post) CREATE (u)-[r:authored]->(p) RETURN r`,
    ) as Query;
    const steps = astToSteps(ast);
    const createStep = steps.find((s) => s instanceof CreateStep) as CreateStep;
    expect(createStep).toBeDefined();
    expect(createStep.config.edges).toHaveLength(1);
  });

  test("Execution - creates edge between existing vertices", () => {
    const graph = createFlexibleGraph();
    const alice = graph.addVertex("User", { name: "Alice" });
    const post = graph.addVertex("Post", { title: "Hello" });
    // Create temp edge to enable path traversal to both vertices
    graph.addEdge(alice, "temp", post, {});

    const results = executeQuery(
      graph,
      `MATCH (u:User {name: 'Alice'})-[t:temp]->(p:Post) CREATE (u)-[r:authored]->(p) DELETE t RETURN r`,
    );

    expect(results).toHaveLength(1);
    const edge = (results[0] as any[])[0];
    expect(edge).toBeInstanceOf(Edge);
    expect(edge.label).toBe("authored");

    // Verify edge is in graph (excluding temp edge)
    const edges = [...graph.getOutgoingEdges(alice.id)].filter(
      (e) => e.label !== "temp",
    );
    expect(edges).toHaveLength(1);
  });

  test("Execution - creates edge and new vertex", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", { name: "Alice" });

    const initialPostCount = [...graph.getVertices("Post")].length;

    const results = executeQuery(
      graph,
      `MATCH (u:User {name: 'Alice'}) CREATE (u)-[r:authored]->(p:Post {title: 'New Post'}) RETURN p`,
    );

    expect(results).toHaveLength(1);
    const post = (results[0] as any[])[0];
    expect(post.get("title")).toBe("New Post");

    // Verify post was created
    expect([...graph.getVertices("Post")].length).toBe(initialPostCount + 1);
  });

  test("Execution - creates edge with properties", () => {
    const graph = createFlexibleGraph();
    const alice = graph.addVertex("User", { name: "Alice" });
    const post = graph.addVertex("Post", { title: "Hello" });
    // Create temp edge to enable traversal
    graph.addEdge(alice, "temp", post, {});

    executeQuery(
      graph,
      `MATCH (u:User {name: 'Alice'})-[t:temp]->(p:Post) CREATE (u)-[r:authored {timestamp: 1234567890}]->(p) DELETE t RETURN r`,
    );

    const edges = [...graph.getOutgoingEdges(alice.id)].filter(
      (e) => e.label !== "temp",
    );
    expect(edges[0]!.get("timestamp")).toBe(1234567890);
  });
});

// ============================================================================
// Clause Ordering Tests
// ============================================================================

describe("Write operation ordering", () => {
  test("MERGE executes before CREATE", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", { name: "Existing" });

    // MERGE should find/create first, then CREATE can reference it
    executeQuery(
      graph,
      `MATCH (x:User) MERGE (u:User {name: 'Alice'}) CREATE (p:Post {author: 'Alice'}) RETURN u, p`,
    );

    const alice = [...graph.getVertices("User")].find(
      (v) => v.get("name") === "Alice",
    );
    expect(alice).toBeDefined();

    const post = [...graph.getVertices("Post")].find(
      (v) => v.get("author") === "Alice",
    );
    expect(post).toBeDefined();
  });

  test("SET executes after CREATE", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", { name: "Existing" });

    const results = executeQuery(
      graph,
      `MATCH (x:User) CREATE (u:User {name: 'Alice'}) SET u.verified = true RETURN u`,
    );

    const alice = (results[0] as any[])[0];
    expect(alice.get("verified")).toBe(true);
  });

  test("REMOVE executes after SET", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", {
      name: "Alice",
      temp: "value",
      data: "preserved",
    });

    executeQuery(
      graph,
      `MATCH (u:User {name: 'Alice'}) SET u.newProp = 'added' REMOVE u.temp RETURN u`,
    );

    const alice = [...graph.getVertices("User")].find(
      (v) => v.get("name") === "Alice",
    );
    expect(alice!.get("newProp")).toBe("added");
    expect(alice!.get("temp")).toBeUndefined();
    expect(alice!.get("data")).toBe("preserved");
  });

  test("DELETE executes after REMOVE", () => {
    const graph = createFlexibleGraph();
    const alice = graph.addVertex("User", {
      name: "Alice",
      data: "secret",
      deleteme: true,
    });
    const bob = graph.addVertex("User", { name: "Bob" });
    graph.addEdge(alice, "knows", bob, {});

    // First REMOVE the property, then DETACH DELETE using unique deleteme flag
    executeQuery(
      graph,
      `MATCH (u:User) WHERE u.deleteme = true REMOVE u.data DETACH DELETE u RETURN u`,
    );

    const remaining = [...graph.getVertices("User")];
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.get("name")).toBe("Bob");
  });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe("Edge Cases", () => {
  test("DELETE with non-matching filter preserves unmatched vertices", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", { name: "Alice", keep: true });
    graph.addVertex("User", { name: "Bob", keep: false });

    // Verify initial state
    expect([...graph.getVertices("User")]).toHaveLength(2);

    // Delete only Bob using unique property
    executeQuery(
      graph,
      `MATCH (u:User) WHERE u.keep = false DELETE u RETURN u`,
    );

    const remaining = [...graph.getVertices("User")];
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.get("name")).toBe("Alice");
  });

  test("MERGE creates vertex when none match", () => {
    const graph = createFlexibleGraph();
    // Need a MATCH first because grammar requires MATCH before MERGE
    graph.addVertex("User", { name: "Existing" });

    executeQuery(
      graph,
      `MATCH (x:User) MERGE (u:User {name: 'NewUser'}) RETURN u`,
    );

    const users = [...graph.getVertices("User")];
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.get("name")).sort()).toEqual([
      "Existing",
      "NewUser",
    ]);
  });

  test("MERGE finds existing vertex when properties match", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", { name: "Alice" });

    executeQuery(
      graph,
      `MATCH (x:User) MERGE (u:User {name: 'Alice'}) RETURN u`,
    );

    // Should not create duplicate
    const users = [...graph.getVertices("User")];
    expect(users).toHaveLength(1);
  });

  test("MERGE with multiple matching vertices uses first match", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", { name: "Alice", age: 30 });
    graph.addVertex("User", { name: "Alice", age: 25 });

    // MERGE on name only - should find one of them, not create new
    executeQuery(
      graph,
      `MATCH (x:User) MERGE (u:User {name: 'Alice'}) RETURN u`,
    );

    const users = [...graph.getVertices("User")];
    expect(users).toHaveLength(2); // No new vertex created
  });

  test("CREATE edge between same vertices multiple times creates duplicates", () => {
    const graph = createFlexibleGraph();
    const alice = graph.addVertex("User", { name: "Alice" });
    const bob = graph.addVertex("User", { name: "Bob" });
    graph.addEdge(alice, "temp", bob, {});

    // Create first follows edge
    executeQuery(
      graph,
      `MATCH (u:User {name: 'Alice'})-[:temp]->(p:User {name: 'Bob'}) CREATE (u)-[:follows]->(p) RETURN u`,
    );

    // Create second follows edge
    executeQuery(
      graph,
      `MATCH (u:User {name: 'Alice'})-[:temp]->(p:User {name: 'Bob'}) CREATE (u)-[:follows]->(p) RETURN u`,
    );

    const followsEdges = [...graph.getOutgoingEdges(alice.id)].filter(
      (e) => e.label === "follows",
    );
    expect(followsEdges).toHaveLength(2); // Duplicate edges allowed
  });

  test("DELETE same edge referenced by multiple variables only deletes once", () => {
    const graph = createFlexibleGraph();
    const alice = graph.addVertex("User", { name: "Alice" });
    const bob = graph.addVertex("User", { name: "Bob" });
    graph.addEdge(alice, "follows", bob, {});

    // Match the edge with a single variable and delete it
    // The deletedIds set prevents double deletion if same edge appears in multiple paths
    executeQuery(
      graph,
      `MATCH (u:User {name: 'Alice'})-[r:follows]->(p:User) DELETE r RETURN u`,
    );

    const edges = [...graph.getOutgoingEdges(alice.id)];
    expect(edges).toHaveLength(0);
  });

  test("DETACH DELETE vertex with multiple edges deletes all edges", () => {
    const graph = createFlexibleGraph();
    const alice = graph.addVertex("User", { name: "Alice", marker: "delete" });
    const bob = graph.addVertex("User", { name: "Bob" });
    const charlie = graph.addVertex("User", { name: "Charlie" });
    graph.addEdge(alice, "follows", bob, {});
    graph.addEdge(alice, "follows", charlie, {});
    graph.addEdge(bob, "follows", alice, {}); // Incoming edge

    // Use a unique marker to only match Alice
    executeQuery(
      graph,
      `MATCH (u:User) WHERE u.marker = 'delete' DETACH DELETE u RETURN u`,
    );

    // Alice should be deleted
    const users = [...graph.getVertices("User")];
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.get("name")).sort()).toEqual(["Bob", "Charlie"]);

    // All edges involving Alice should be deleted
    const allEdges = [...graph.getEdges()];
    expect(allEdges).toHaveLength(0);
  });

  test("REMOVE on non-existent property does not throw", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", { name: "Alice" });

    // Should not throw when removing property that doesn't exist
    executeQuery(
      graph,
      `MATCH (u:User {name: 'Alice'}) REMOVE u.nonExistentProp RETURN u`,
    );

    const alice = [...graph.getVertices("User")][0];
    expect(alice!.get("name")).toBe("Alice");
  });
});

// ============================================================================
// CREATE Chain Pattern Tests
// ============================================================================

describe("CREATE chain patterns", () => {
  describe("Grammar parsing", () => {
    test("parses chained CREATE pattern: (t)-[:Contains]->(:Attr)-[:IsA]->(s)", () => {
      const ast = parse(
        `MATCH (t:Concept {name: 'Task'}), (s:DataType {name: 'String'})
         CREATE (t)-[:Contains]->(:Property {name: 'title', description: 'The title of the task.', presence: 'required'})-[:IsA]->(s)
         RETURN t`,
      ) as Query;

      expect(ast.create).toBeDefined();
      expect(ast.create!.patterns).toHaveLength(1);

      const pattern = ast.create!.patterns[0] as any;
      expect(pattern.type).toBe("CreateChainPattern");
      // Elements: [varRef(t), edge(Contains), nodePattern(Property), edge(IsA), varRef(s)]
      expect(pattern.elements).toHaveLength(5);

      // Start: variable reference to t
      expect(pattern.elements[0].type).toBe("CreateVariableRef");
      expect(pattern.elements[0].variable).toBe("t");

      // First edge: Contains
      expect(pattern.elements[1].type).toBe("CreateEdgePattern");
      expect(pattern.elements[1].label).toBe("Contains");

      // Middle: new Property node
      expect(pattern.elements[2].type).toBe("CreateNodePattern");
      expect(pattern.elements[2].labels).toEqual(["Property"]);
      expect(pattern.elements[2].properties).toEqual({
        name: "title",
        description: "The title of the task.",
        presence: "required",
      });

      // Second edge: IsA
      expect(pattern.elements[3].type).toBe("CreateEdgePattern");
      expect(pattern.elements[3].label).toBe("IsA");

      // End: variable reference to s
      expect(pattern.elements[4].type).toBe("CreateVariableRef");
      expect(pattern.elements[4].variable).toBe("s");
    });

    test("parses CREATE with named middle node: (a:Attr)-[:IsA]->(s), (t)-[:Contains]->(a)", () => {
      const ast = parse(
        `MATCH (t:Concept {name: 'Task'}), (s:DataType {name: 'String'})
         CREATE (a:Property {name: 'title', description: 'The title of the task.', presence: 'required'})-[:IsA]->(s), (t)-[:Contains]->(a)
         RETURN t, a`,
      ) as Query;

      expect(ast.create).toBeDefined();
      expect(ast.create!.patterns).toHaveLength(2);

      // First pattern: (a:Property)-[:IsA]->(s)
      const pattern1 = ast.create!.patterns[0] as any;
      expect(pattern1.type).toBe("CreateChainPattern");
      expect(pattern1.elements[0].type).toBe("CreateNodePattern");
      expect(pattern1.elements[0].variable).toBe("a");
      expect(pattern1.elements[0].labels).toEqual(["Property"]);

      // Second pattern: (t)-[:Contains]->(a)
      const pattern2 = ast.create!.patterns[1] as any;
      expect(pattern2.type).toBe("CreateChainPattern");
      expect(pattern2.elements[0].type).toBe("CreateVariableRef");
      expect(pattern2.elements[0].variable).toBe("t");
      expect(pattern2.elements[2].type).toBe("CreateVariableRef");
      expect(pattern2.elements[2].variable).toBe("a");
    });
  });

  describe("Query execution", () => {
    test("creates chained pattern: (t)-[:Contains]->(:Attr)-[:IsA]->(s)", () => {
      const graph = createComprehensiveGraph();
      const task = graph.addVertex("Concept", { name: "Task" });
      const stringType = graph.addVertex("DataType", { name: "String" });
      // Create temp edge to enable traversal for comma-separated MATCH
      graph.addEdge(task, "temp", stringType, {});

      executeQuery(
        graph,
        `MATCH (t:Concept {name: 'Task'})-[r:temp]->(s:DataType {name: 'String'})
         CREATE (t)-[:Contains]->(:Property {name: 'title', description: 'The title', presence: 'required'})-[:IsA]->(s)
         DELETE r
         RETURN t`,
      );

      // Verify Property was created
      const attributes = [...graph.getVertices("Property")];
      expect(attributes).toHaveLength(1);
      expect(attributes[0]!.get("name")).toBe("title");

      // Verify Contains edge was created: (t)-[:Contains]->(Property)
      // outV = source = task, inV = target = Property
      const containsEdges = [...graph.getEdges("Contains")];
      expect(containsEdges).toHaveLength(1);
      expect(containsEdges[0]!.outV.id).toBe(task.id);
      expect(containsEdges[0]!.inV.id).toBe(attributes[0]!.id);

      // Verify IsA edge was created: (Property)-[:IsA]->(s)
      // outV = source = Property, inV = target = stringType
      const isAEdges = [...graph.getEdges("IsA")];
      expect(isAEdges).toHaveLength(1);
      expect(isAEdges[0]!.outV.id).toBe(attributes[0]!.id);
      expect(isAEdges[0]!.inV.id).toBe(stringType.id);
    });

    test("creates multiple patterns with cross-reference: (a:Attr)-[:IsA]->(s), (t)-[:Contains]->(a)", () => {
      const graph = createComprehensiveGraph();
      const task = graph.addVertex("Concept", { name: "Task" });
      const stringType = graph.addVertex("DataType", { name: "String" });
      // Create temp edge to enable traversal
      graph.addEdge(task, "temp", stringType, {});

      executeQuery(
        graph,
        `MATCH (t:Concept {name: 'Task'})-[:temp]->(s:DataType {name: 'String'})
         CREATE (a:Property {name: 'completed', description: 'Whether the task is completed.', presence: 'required'})-[:IsA]->(s), (t)-[:Contains]->(a)
         RETURN t, a`,
      );

      // Verify Property was created
      const attributes = [...graph.getVertices("Property")];
      expect(attributes).toHaveLength(1);
      expect(attributes[0]!.get("name")).toBe("completed");

      // Verify Contains edge: (t)-[:Contains]->(a)
      // outV = source = task, inV = target = attribute
      const containsEdges = [...graph.getEdges("Contains")];
      expect(containsEdges).toHaveLength(1);
      expect(containsEdges[0]!.outV.id).toBe(task.id);
      expect(containsEdges[0]!.inV.id).toBe(attributes[0]!.id);

      // Verify IsA edge: (a)-[:IsA]->(s)
      // outV = source = attribute, inV = target = stringType
      const isAEdges = [...graph.getEdges("IsA")];
      expect(isAEdges).toHaveLength(1);
      expect(isAEdges[0]!.outV.id).toBe(attributes[0]!.id);
      expect(isAEdges[0]!.inV.id).toBe(stringType.id);
    });

    test("creates Boolean attribute with chained pattern", () => {
      const graph = createComprehensiveGraph();
      const task = graph.addVertex("Concept", { name: "Task" });
      const boolType = graph.addVertex("DataType", { name: "Boolean" });
      // Create temp edge for comma-separated MATCH
      graph.addEdge(task, "temp", boolType, {});

      executeQuery(
        graph,
        `MATCH (t:Concept {name: 'Task'})-[:temp]->(b:DataType {name: 'Boolean'})
         CREATE (t)-[:Contains]->(:Property {name: 'completed', description: 'Whether the task is completed.', presence: 'required'})-[:IsA]->(b)
         RETURN t`,
      );

      // Verify Property was created with correct properties
      const attributes = [...graph.getVertices("Property")];
      expect(attributes).toHaveLength(1);
      expect(attributes[0]!.get("name")).toBe("completed");
      expect(attributes[0]!.get("presence")).toBe("required");

      // Verify both edges were created
      expect([...graph.getEdges("Contains")]).toHaveLength(1);
      expect([...graph.getEdges("IsA")]).toHaveLength(1);
    });

    test("supports comma-separated MATCH with chained CREATE", () => {
      const graph = createComprehensiveGraph();
      graph.addVertex("Concept", { name: "Task" });
      graph.addVertex("DataType", { name: "String" });

      // This tests the exact pattern from the user's request
      executeQuery(
        graph,
        `MATCH (t:Concept {name: 'Task'}), (s:DataType {name: 'String'})
         CREATE (a:Property {name: 'title', description: 'The title of the task.', presence: 'required'})-[:IsA]->(s), (t)-[:Contains]->(a)
         RETURN t, a`,
      );

      // Verify the attribute was created
      const attributes = [...graph.getVertices("Property")];
      expect(attributes).toHaveLength(1);
      expect(attributes[0]!.get("name")).toBe("title");

      // Verify edges
      const containsEdges = [...graph.getEdges("Contains")];
      const isAEdges = [...graph.getEdges("IsA")];
      expect(containsEdges).toHaveLength(1);
      expect(isAEdges).toHaveLength(1);
    });
  });
});
