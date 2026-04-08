import { test, expect, describe } from "vitest";
import { Vertex } from "../Graph.js";
import { parse } from "../grammar.js";
import type { Query, CreateNodePattern, CreateChainPattern, CreateVariableRef } from "../AST.js";
import { executeQuery, createComprehensiveGraph } from "./testHelpers.js";

/**
 * Tests for CREATE query syntax requested by user.
 *
 * These tests verify support for:
 * 1. Standalone CREATE without RETURN clause
 * 2. Anonymous nodes (no variable) in CREATE patterns
 * 3. MATCH + CREATE relationship patterns without RETURN
 */

describe("Standalone CREATE without RETURN", () => {
  describe("Grammar parsing", () => {
    test("parses CREATE with anonymous labeled node", () => {
      const query = `CREATE (:Property {name: 'Title', description: 'The name of the task.'})`;
      const ast = parse(query) as Query;

      expect(ast.type).toBe("Query");
      expect(ast.matches).toHaveLength(0);
      expect(ast.return).toBeUndefined();
      expect(ast.create).toBeDefined();
      expect(ast.create!.patterns).toHaveLength(1);

      const pattern = ast.create!.patterns[0] as CreateNodePattern;
      expect(pattern.type).toBe("CreateNodePattern");
      expect(pattern.variable).toBeUndefined();
      expect(pattern.labels).toEqual(["Property"]);
      expect(pattern.properties).toEqual({
        name: "Title",
        description: "The name of the task.",
      });
    });

    test("parses all user-provided CREATE queries", () => {
      const queries = [
        `CREATE (:Property {name: 'Title', description: 'The name of the task.'})`,
        `CREATE (:Property {name: 'Description', description: 'Details about what needs to be done.'})`,
        `CREATE (:Property {name: 'Status', description: 'Current state (e.g., To Do, In Progress, Done).'})`,
        `CREATE (:Property {name: 'Priority', description: 'Importance level of the task.'})`,
        `CREATE (:Property {name: 'Username', description: 'Unique identifier for the user.'})`,
        `CREATE (:Property {name: 'Email', description: "User's email address."})`,
        `CREATE (:Property {name: 'Password', description: 'Encrypted password for authentication.'})`,
        `CREATE (:Property {name: 'Name', description: 'Title of the project.'})`,
        `CREATE (:Property {name: 'Start Date', description: 'When the project begins.'})`,
        `CREATE (:Property {name: 'End Date', description: 'Expected completion date.'})`,
        `CREATE (:Property {name: 'Content', description: 'The text of the comment.'})`,
        `CREATE (:Property {name: 'Created Date', description: 'When the comment was made.'})`,
        `CREATE (:Property {name: 'Author', description: 'The user who made the comment.'})`,
      ];

      for (const query of queries) {
        const ast = parse(query) as Query;
        expect(ast.type).toBe("Query");
        expect(ast.create).toBeDefined();
        expect(ast.return).toBeUndefined();
      }
    });
  });

  describe("Query execution", () => {
    test("creates anonymous node in empty graph", () => {
      const graph = createComprehensiveGraph();

      // Verify graph is empty
      expect([...graph.getVertices("Property")]).toHaveLength(0);

      // Execute CREATE without RETURN
      const results = executeQuery(
        graph,
        `CREATE (:Property {name: 'Title', description: 'The name of the task.'})`,
      );

      // No results returned since no RETURN clause
      expect(results).toHaveLength(0);

      // Verify vertex was created
      const vertices = [...graph.getVertices("Property")];
      expect(vertices).toHaveLength(1);
      expect(vertices[0]!.get("name")).toBe("Title");
      expect(vertices[0]!.get("description")).toBe("The name of the task.");
    });

    test("creates multiple anonymous nodes", () => {
      const graph = createComprehensiveGraph();

      executeQuery(graph, `CREATE (:Property {name: 'Title'})`);
      executeQuery(graph, `CREATE (:Property {name: 'Description'})`);
      executeQuery(graph, `CREATE (:Property {name: 'Status'})`);

      const vertices = [...graph.getVertices("Property")];
      expect(vertices).toHaveLength(3);

      const names = vertices.map((v) => v.get("name"));
      expect(names).toContain("Title");
      expect(names).toContain("Description");
      expect(names).toContain("Status");
    });
  });
});

describe("MATCH + CREATE relationship without RETURN", () => {
  describe("Grammar parsing", () => {
    test("parses MATCH + CREATE relationship with anonymous end node", () => {
      const query = `MATCH (task:Concept {name: 'Task'}) CREATE (task)-[:HasAttribute]->(:Property {name: 'id', description: 'Unique identifier for the task.'})`;
      const ast = parse(query) as Query;

      expect(ast.type).toBe("Query");
      expect(ast.matches).toHaveLength(1);
      expect(ast.return).toBeUndefined();
      expect(ast.create).toBeDefined();
      expect(ast.create!.patterns).toHaveLength(1);

      const pattern = ast.create!.patterns[0] as CreateChainPattern;
      expect(pattern.type).toBe("CreateChainPattern");
      // Elements: [CreateVariableRef(task), CreateEdgePattern(HasAttribute), CreateNodePattern(Property)]
      expect(pattern.elements).toHaveLength(3);

      const startNode = pattern.elements[0] as CreateVariableRef;
      expect(startNode.type).toBe("CreateVariableRef");
      expect(startNode.variable).toBe("task");

      const edge = pattern.elements[1] as any;
      expect(edge.type).toBe("CreateEdgePattern");
      expect(edge.label).toBe("HasAttribute");
      expect(edge.direction).toBe("out");

      // End node is anonymous with label and properties
      const endNode = pattern.elements[2] as CreateNodePattern;
      expect(endNode.type).toBe("CreateNodePattern");
      expect(endNode.variable).toBeUndefined();
      expect(endNode.labels).toEqual(["Property"]);
      expect(endNode.properties).toEqual({
        name: "id",
        description: "Unique identifier for the task.",
      });
    });

    test("parses all user-provided MATCH + CREATE queries", () => {
      const queries = [
        `MATCH (task:Concept {name: 'Task'}) CREATE (task)-[:HasAttribute]->(:Property {name: 'id', description: 'Unique identifier for the task.'})`,
        `MATCH (task:Concept {name: 'Task'}) CREATE (task)-[:HasAttribute]->(:Property {name: 'title', description: 'Short description of the task.'})`,
        `MATCH (task:Concept {name: 'Task'}) CREATE (task)-[:HasAttribute]->(:Property {name: 'description', description: 'Detailed information about the task.'})`,
        `MATCH (task:Concept {name: 'Task'}) CREATE (task)-[:HasAttribute]->(:Property {name: 'status', description: 'Current status of the task.'})`,
        `MATCH (task:Concept {name: 'Task'}) CREATE (task)-[:HasAttribute]->(:Property {name: 'due_date', description: 'Deadline for the task.'})`,
      ];

      for (const query of queries) {
        const ast = parse(query) as Query;
        expect(ast.type).toBe("Query");
        expect(ast.matches).toHaveLength(1);
        expect(ast.create).toBeDefined();
        expect(ast.return).toBeUndefined();
      }
    });
  });

  describe("Query execution", () => {
    test("creates relationship from matched node to new anonymous node", () => {
      const graph = createComprehensiveGraph();

      // First create the Concept node
      graph.addVertex("Concept", { name: "Task" });

      // Execute MATCH + CREATE without RETURN
      const results = executeQuery(
        graph,
        `MATCH (task:Concept {name: 'Task'}) CREATE (task)-[:HasAttribute]->(:Property {name: 'id', description: 'Unique identifier for the task.'})`,
      );

      // No results returned since no RETURN clause
      expect(results).toHaveLength(0);

      // Verify Property was created
      const properties = [...graph.getVertices("Property")];
      expect(properties).toHaveLength(1);
      expect(properties[0]!.get("name")).toBe("id");

      // Verify relationship was created
      const concepts = [...graph.getVertices("Concept")];
      expect(concepts).toHaveLength(1);
      const outgoingEdges = [...graph.getOutgoingEdges(concepts[0]!.id)];
      expect(outgoingEdges).toHaveLength(1);
      expect(outgoingEdges[0]!.label).toBe("HasAttribute");
    });

    test("creates multiple properties on same concept", () => {
      const graph = createComprehensiveGraph();

      // Create the Concept node
      graph.addVertex("Concept", { name: "Task" });

      // Execute multiple MATCH + CREATE queries
      executeQuery(
        graph,
        `MATCH (task:Concept {name: 'Task'}) CREATE (task)-[:HasAttribute]->(:Property {name: 'id'})`,
      );
      executeQuery(
        graph,
        `MATCH (task:Concept {name: 'Task'}) CREATE (task)-[:HasAttribute]->(:Property {name: 'title'})`,
      );
      executeQuery(
        graph,
        `MATCH (task:Concept {name: 'Task'}) CREATE (task)-[:HasAttribute]->(:Property {name: 'status'})`,
      );

      // Verify all Properties were created
      const properties = [...graph.getVertices("Property")];
      expect(properties).toHaveLength(3);

      const names = properties.map((p) => p.get("name"));
      expect(names).toContain("id");
      expect(names).toContain("title");
      expect(names).toContain("status");

      // Verify all relationships were created
      const concepts = [...graph.getVertices("Concept")];
      const outgoingEdges = [...graph.getOutgoingEdges(concepts[0]!.id)];
      expect(outgoingEdges).toHaveLength(3);
    });
  });
});

describe("Combined CREATE scenarios", () => {
  test("CREATE with RETURN returns created node", () => {
    const graph = createComprehensiveGraph();

    // CREATE with RETURN should still work
    const results = executeQuery(graph, `CREATE (a:Property {name: 'Test'}) RETURN a`);

    expect(results).toHaveLength(1);
    const created = (results[0] as any[])[0];
    expect(created).toBeInstanceOf(Vertex);
    expect(created.get("name")).toBe("Test");
  });

  test("MATCH + CREATE with RETURN returns matched and created nodes", () => {
    const graph = createComprehensiveGraph();
    const concept = graph.addVertex("Concept", { name: "Task" });

    const results = executeQuery(
      graph,
      `MATCH (task:Concept {name: 'Task'}) CREATE (task)-[r:HasAttribute]->(:Property {name: 'id'}) RETURN task`,
    );

    expect(results).toHaveLength(1);
    const matchedTask = (results[0] as any[])[0];
    expect(matchedTask.id).toBe(concept.id);
  });
});

describe("DELETE without RETURN", () => {
  test("deletes matched node", () => {
    const graph = createComprehensiveGraph();
    graph.addVertex("User", { name: "Alice" });
    graph.addVertex("User", { name: "Bob" });

    expect([...graph.getVertices("User")]).toHaveLength(2);

    // Execute DELETE without RETURN
    const results = executeQuery(graph, `MATCH (u:User) WHERE u.name = 'Alice' DELETE u`);

    // No results returned
    expect(results).toHaveLength(0);

    // Verify Alice was deleted
    const users = [...graph.getVertices("User")];
    expect(users).toHaveLength(1);
    expect(users[0]!.get("name")).toBe("Bob");
  });

  test("DETACH DELETE removes node with relationships", () => {
    const graph = createComprehensiveGraph();
    const alice = graph.addVertex("User", { name: "Alice" });
    const bob = graph.addVertex("User", { name: "Bob" });
    graph.addEdge(alice.id, "follows", bob.id, {});

    expect([...graph.getVertices("User")]).toHaveLength(2);
    expect([...graph.getEdges("follows")]).toHaveLength(1);

    // Execute DETACH DELETE without RETURN
    const results = executeQuery(graph, `MATCH (u:User) WHERE u.name = 'Alice' DETACH DELETE u`);

    // No results returned
    expect(results).toHaveLength(0);

    // Verify Alice and her relationships were deleted
    const users = [...graph.getVertices("User")];
    expect(users).toHaveLength(1);
    expect(users[0]!.get("name")).toBe("Bob");
    expect([...graph.getEdges("follows")]).toHaveLength(0);
  });
});

describe("SET without RETURN", () => {
  test("updates property on matched node", () => {
    const graph = createComprehensiveGraph();
    graph.addVertex("User", { name: "Alice", age: 25 });

    // Execute SET without RETURN
    const results = executeQuery(graph, `MATCH (u:User) WHERE u.name = 'Alice' SET u.age = 30`);

    // No results returned
    expect(results).toHaveLength(0);

    // Verify property was updated
    const users = [...graph.getVertices("User")];
    expect(users[0]!.get("age")).toBe(30);
  });
});

describe("REMOVE without RETURN", () => {
  test("removes property from matched node", () => {
    const graph = createComprehensiveGraph();
    graph.addVertex("User", { name: "Alice", age: 25 });

    // Execute REMOVE without RETURN
    const results = executeQuery(graph, `MATCH (u:User) WHERE u.name = 'Alice' REMOVE u.age`);

    // No results returned
    expect(results).toHaveLength(0);

    // Verify property was removed
    const users = [...graph.getVertices("User")];
    expect(users[0]!.get("age")).toBeUndefined();
  });
});

describe("MERGE without RETURN", () => {
  test("creates node if not exists", () => {
    const graph = createComprehensiveGraph();

    expect([...graph.getVertices("User")]).toHaveLength(0);

    // Execute MERGE without RETURN
    const results = executeQuery(graph, `MERGE (u:User {name: 'Alice'})`);

    // No results returned
    expect(results).toHaveLength(0);

    // Verify node was created
    const users = [...graph.getVertices("User")];
    expect(users).toHaveLength(1);
    expect(users[0]!.get("name")).toBe("Alice");
  });

  test("matches existing node if exists", () => {
    const graph = createComprehensiveGraph();
    graph.addVertex("User", { name: "Alice" });

    expect([...graph.getVertices("User")]).toHaveLength(1);

    // Execute MERGE without RETURN - should not create duplicate
    const results = executeQuery(graph, `MERGE (u:User {name: 'Alice'})`);

    // No results returned
    expect(results).toHaveLength(0);

    // Verify no duplicate was created
    const users = [...graph.getVertices("User")];
    expect(users).toHaveLength(1);
  });
});

describe("Error cases", () => {
  test("ORDER BY without RETURN throws error", () => {
    const graph = createComprehensiveGraph();
    graph.addVertex("User", { name: "Alice" });

    // ORDER BY requires variable.property format, so use a valid MATCH pattern
    expect(() => executeQuery(graph, `MATCH (u:User) ORDER BY u.name`)).toThrow(
      "ORDER BY, SKIP, and LIMIT require a RETURN clause",
    );
  });

  test("SKIP without RETURN throws error", () => {
    const graph = createComprehensiveGraph();
    graph.addVertex("User", { name: "Alice" });

    expect(() => executeQuery(graph, `MATCH (u:User) SKIP 5`)).toThrow(
      "ORDER BY, SKIP, and LIMIT require a RETURN clause",
    );
  });

  test("LIMIT without RETURN throws error", () => {
    const graph = createComprehensiveGraph();
    graph.addVertex("User", { name: "Alice" });

    expect(() => executeQuery(graph, `MATCH (u:User) LIMIT 5`)).toThrow(
      "ORDER BY, SKIP, and LIMIT require a RETURN clause",
    );
  });

  test("CREATE with ORDER BY without RETURN throws error", () => {
    const graph = createComprehensiveGraph();

    expect(() => executeQuery(graph, `CREATE (u:User {name: 'Alice'}) ORDER BY u.name`)).toThrow(
      "ORDER BY, SKIP, and LIMIT require a RETURN clause",
    );
  });
});
