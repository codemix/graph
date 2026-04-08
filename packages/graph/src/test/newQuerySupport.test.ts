import { test, expect, describe } from "vitest";
import { parse } from "../grammar.js";
import type {
  Query,
  ExistsCondition,
  NotCondition,
  CreateNodePattern,
  CreateChainPattern,
  CreateVariableRef,
} from "../AST.js";
import { executeQuery, createFlexibleGraph, createComprehensiveGraph } from "./testHelpers.js";

// ============================================================================
// Functional exists() Syntax Tests
// ============================================================================

describe("Functional exists() syntax", () => {
  describe("Grammar parsing", () => {
    test("parses exists(n.property) in WHERE clause", () => {
      const ast = parse("MATCH (n:User) WHERE exists(n.email) RETURN n") as Query;

      expect(ast.matches).toHaveLength(1);
      const condition = ast.matches[0]!.where!.condition as ExistsCondition;
      expect(condition.type).toBe("ExistsCondition");
      expect(condition.variable).toBe("n");
      expect(condition.property).toBe("email");
    });

    test("parses NOT exists(n.property) in WHERE clause", () => {
      const ast = parse("MATCH (n:User) WHERE NOT exists(n.email) RETURN n") as Query;

      expect(ast.matches).toHaveLength(1);
      const condition = ast.matches[0]!.where!.condition as NotCondition;
      expect(condition.type).toBe("NotCondition");

      const innerCondition = condition.condition as ExistsCondition;
      expect(innerCondition.type).toBe("ExistsCondition");
      expect(innerCondition.variable).toBe("n");
      expect(innerCondition.property).toBe("email");
    });

    test("parses exists() with @property syntax", () => {
      const ast = parse("MATCH (n:User) WHERE exists(n.@label) RETURN n") as Query;

      const condition = ast.matches[0]!.where!.condition as ExistsCondition;
      expect(condition.property).toBe("@label");
    });

    test("parses exists() combined with AND", () => {
      const ast = parse("MATCH (n:User) WHERE exists(n.email) AND n.age > 0 RETURN n") as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("AndCondition");
    });

    test("parses exists() combined with OR", () => {
      const ast = parse(
        "MATCH (n:User) WHERE exists(n.email) OR exists(n.status) RETURN n",
      ) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("OrCondition");
    });
  });

  describe("Query execution", () => {
    test("exists() returns nodes that have the property", () => {
      const graph = createFlexibleGraph();
      graph.addVertex("User", { name: "Alice", email: "alice@test.com" });
      graph.addVertex("User", { name: "Bob" }); // No email

      const results = executeQuery(graph, "MATCH (n:User) WHERE exists(n.email) RETURN n");

      expect(results).toHaveLength(1);
      const user = (results[0] as any[])[0];
      expect(user.get("name")).toBe("Alice");
    });

    test("NOT exists() returns nodes that do not have the property", () => {
      const graph = createFlexibleGraph();
      graph.addVertex("User", { name: "Alice", email: "alice@test.com" });
      graph.addVertex("User", { name: "Bob" }); // No email

      const results = executeQuery(graph, "MATCH (n:User) WHERE NOT exists(n.email) RETURN n");

      expect(results).toHaveLength(1);
      const user = (results[0] as any[])[0];
      expect(user.get("name")).toBe("Bob");
    });

    test("postfix EXISTS syntax still works", () => {
      const graph = createFlexibleGraph();
      graph.addVertex("User", { name: "Alice", email: "alice@test.com" });
      graph.addVertex("User", { name: "Bob" });

      const results = executeQuery(graph, "MATCH (n:User) WHERE n.email EXISTS RETURN n");

      expect(results).toHaveLength(1);
      expect((results[0] as any[])[0].get("name")).toBe("Alice");
    });

    test("NOT postfix EXISTS syntax still works", () => {
      const graph = createFlexibleGraph();
      graph.addVertex("User", { name: "Alice", email: "alice@test.com" });
      graph.addVertex("User", { name: "Bob" });

      const results = executeQuery(graph, "MATCH (n:User) WHERE NOT n.email EXISTS RETURN n");

      expect(results).toHaveLength(1);
      expect((results[0] as any[])[0].get("name")).toBe("Bob");
    });
  });
});

// ============================================================================
// CREATE with Anonymous End Nodes
// ============================================================================

describe("CREATE with anonymous end nodes", () => {
  describe("Grammar parsing", () => {
    test("parses CREATE relationship with anonymous end node", () => {
      const ast = parse(
        "MATCH (u:User) CREATE (u)-[:HAS]->(:Profile {verified: true}) RETURN u",
      ) as Query;

      expect(ast.create).toBeDefined();
      expect(ast.create!.patterns).toHaveLength(1);

      const pattern = ast.create!.patterns[0] as CreateChainPattern;
      expect(pattern.type).toBe("CreateChainPattern");
      // Elements: [CreateVariableRef(u), CreateEdgePattern(HAS), CreateNodePattern(Profile)]
      expect(pattern.elements).toHaveLength(3);

      const startNode = pattern.elements[0] as CreateVariableRef;
      expect(startNode.type).toBe("CreateVariableRef");
      expect(startNode.variable).toBe("u");

      const edge = pattern.elements[1] as any;
      expect(edge.type).toBe("CreateEdgePattern");
      expect(edge.label).toBe("HAS");

      // End node is an anonymous CreateNodePattern
      const endNode = pattern.elements[2] as CreateNodePattern;
      expect(endNode.type).toBe("CreateNodePattern");
      expect(endNode.variable).toBeUndefined();
      expect(endNode.labels).toEqual(["Profile"]);
      expect(endNode.properties).toEqual({ verified: true });
    });

    test("parses multiple CREATE relationships with anonymous end nodes", () => {
      const ast = parse(
        "MATCH (u:User) CREATE (u)-[:HasAttribute]->(:Property {name: 'email'}), (u)-[:HasAttribute]->(:Property {name: 'phone'}) RETURN u",
      ) as Query;

      expect(ast.create!.patterns).toHaveLength(2);

      for (const pattern of ast.create!.patterns) {
        const chainPattern = pattern as CreateChainPattern;
        expect(chainPattern.type).toBe("CreateChainPattern");
        // End node is at index 2
        const endNode = chainPattern.elements[2] as CreateNodePattern;
        expect(endNode.variable).toBeUndefined();
        expect(endNode.labels).toEqual(["Property"]);
      }
    });

    test("parses CREATE relationship with variable end node still works", () => {
      const ast = parse(
        "MATCH (u:User) CREATE (u)-[:KNOWS]->(friend:User {name: 'Bob'}) RETURN u, friend",
      ) as Query;

      const pattern = ast.create!.patterns[0] as CreateChainPattern;
      // End node is at index 2
      const endNode = pattern.elements[2] as CreateNodePattern;
      expect(endNode.variable).toBe("friend");
    });
  });

  describe("Query execution", () => {
    test("creates relationship to anonymous node", () => {
      const graph = createComprehensiveGraph();
      graph.addVertex("User", { name: "Alice" });

      executeQuery(
        graph,
        "MATCH (u:User {name: 'Alice'}) CREATE (u)-[:HAS]->(:Profile {verified: true}) RETURN u",
      );

      // Verify the Profile was created
      const profiles = [...graph.getVertices("Profile")];
      expect(profiles).toHaveLength(1);
      expect(profiles[0]!.get("verified")).toBe(true);

      // Verify the edge was created
      const edges = [...graph.getEdges("HAS")];
      expect(edges).toHaveLength(1);
    });

    test("creates multiple relationships to anonymous nodes", () => {
      const graph = createComprehensiveGraph();
      graph.addVertex("Concept", { name: "User" });

      executeQuery(
        graph,
        `MATCH (u:Concept {name: 'User'})
         CREATE (u)-[:HasAttribute]->(:Property {name: 'username', description: 'Unique username'}),
                (u)-[:HasAttribute]->(:Property {name: 'email', description: 'Email address'})
         RETURN u`,
      );

      // Verify Properties were created
      const attributes = [...graph.getVertices("Property")];
      expect(attributes).toHaveLength(2);

      const names = attributes.map((a) => a.get("name"));
      expect(names).toContain("username");
      expect(names).toContain("email");

      // Verify edges were created
      const edges = [...graph.getEdges("HasAttribute")];
      expect(edges).toHaveLength(2);
    });
  });
});

// ============================================================================
// Multiple CREATE Clauses
// ============================================================================

describe("Multiple CREATE clauses", () => {
  describe("Grammar parsing", () => {
    test("parses query with two CREATE clauses", () => {
      const ast = parse(
        "MATCH (t:Concept) CREATE (a:Property {name: 'title'}) CREATE (t)-[:Contains]->(a) RETURN t",
      ) as Query;

      // Multiple CREATE clauses are merged into one
      expect(ast.create).toBeDefined();
      expect(ast.create!.patterns).toHaveLength(2);
    });

    test("parses query with multiple standalone CREATE clauses", () => {
      const ast = parse(
        `MATCH (t:Concept {name: 'Task'})
         CREATE (a1:Property {name: 'title'}), (a2:Property {name: 'description'})
         CREATE (t)-[:Contains]->(a1), (t)-[:Contains]->(a2)
         RETURN t`,
      ) as Query;

      // All patterns from both CREATE clauses are merged
      expect(ast.create!.patterns).toHaveLength(4);
    });
  });

  describe("Query execution", () => {
    test("executes query with multiple CREATE clauses", () => {
      const graph = createComprehensiveGraph();
      graph.addVertex("Concept", { name: "Task" });

      executeQuery(
        graph,
        `MATCH (t:Concept {name: 'Task'})
         CREATE (a3:Property {name: 'title', description: 'Task title'})
         CREATE (t)-[:Contains]->(a3)
         RETURN t`,
      );

      // Verify Property was created
      const attributes = [...graph.getVertices("Property")];
      expect(attributes).toHaveLength(1);
      expect(attributes[0]!.get("name")).toBe("title");

      // Verify edge was created
      const edges = [...graph.getEdges("Contains")];
      expect(edges).toHaveLength(1);
    });

    test("executes complex query with multiple nodes and relationships", () => {
      const graph = createComprehensiveGraph();
      graph.addVertex("Concept", { name: "Task" });

      executeQuery(
        graph,
        `MATCH (t:Concept {name: 'Task'})
         CREATE (a3:Property {name: 'title', description: 'The title of the task.'}),
                (a4:Property {name: 'description', description: 'A detailed description of the task.'}),
                (a5:Property {name: 'dueDate', description: 'The date by which the task should be completed.'})
         CREATE (t)-[:Contains]->(a3), (t)-[:Contains]->(a4), (t)-[:Contains]->(a5)
         RETURN t`,
      );

      // Verify all Properties were created
      const attributes = [...graph.getVertices("Property")];
      expect(attributes).toHaveLength(3);

      const names = attributes.map((a) => a.get("name"));
      expect(names).toContain("title");
      expect(names).toContain("description");
      expect(names).toContain("dueDate");

      // Verify all edges were created
      const edges = [...graph.getEdges("Contains")];
      expect(edges).toHaveLength(3);
    });
  });
});

// ============================================================================
// Comma-Separated MATCH Patterns
// ============================================================================

describe("Comma-separated MATCH patterns", () => {
  describe("Grammar parsing", () => {
    test("parses MATCH with two comma-separated patterns", () => {
      const ast = parse("MATCH (a:User), (b:Post) RETURN a, b") as Query;

      expect(ast.matches).toHaveLength(1);
      const pattern = ast.matches[0]!.pattern;
      expect(pattern.type).toBe("MultiPattern");
      expect((pattern as any).patterns).toHaveLength(2);
    });

    test("parses MATCH with property constraints on both patterns", () => {
      const ast = parse(
        "MATCH (w:Screen {name: 'Welcome Screen'}), (s:Screen {name: 'Signup Screen'}) CREATE (w)-[:LinksTo]->(s) RETURN w",
      ) as Query;

      expect(ast.matches).toHaveLength(1);
      const pattern = ast.matches[0]!.pattern;
      expect(pattern.type).toBe("MultiPattern");
    });
  });

  describe("Query execution", () => {
    test("matches two separate patterns and creates relationship", () => {
      const graph = createComprehensiveGraph();
      const welcome = graph.addVertex("Screen", { name: "Welcome Screen" });
      const signup = graph.addVertex("Screen", { name: "Signup Screen" });

      executeQuery(
        graph,
        "MATCH (w:Screen {name: 'Welcome Screen'}), (s:Screen {name: 'Signup Screen'}) CREATE (w)-[:LinksTo]->(s) RETURN w",
      );

      // Verify edge was created
      const edges = [...graph.getEdges("LinksTo")];
      expect(edges).toHaveLength(1);

      // Verify the edge connects the right vertices: (w)-[:LinksTo]->(s)
      // outV = source = welcome, inV = target = signup
      const edge = edges[0]!;
      expect(edge.outV.id).toBe(welcome.id);
      expect(edge.inV.id).toBe(signup.id);
    });

    test("cross-product: multiple matches create multiple combinations", () => {
      const graph = createComprehensiveGraph();
      graph.addVertex("User", { name: "Alice" });
      graph.addVertex("User", { name: "Bob" });
      graph.addVertex("Post", { title: "Hello" });
      graph.addVertex("Post", { title: "World" });

      // This should match all combinations: Alice+Hello, Alice+World, Bob+Hello, Bob+World
      const results = executeQuery(graph, "MATCH (u:User), (p:Post) RETURN u, p");

      // Expect 2 users x 2 posts = 4 combinations
      expect(results).toHaveLength(4);
    });
  });
});

// ============================================================================
// Full Query Examples from User Requests
// ============================================================================

describe("Full query examples from user requests", () => {
  test("Query 1: MATCH (n) WHERE NOT exists(n.anyProperty) CREATE...", () => {
    // This query parses correctly, though it may not execute meaningfully
    // since 'anyProperty' doesn't exist on any vertex type
    const ast = parse(
      `MATCH (n) WHERE NOT exists(n.anyProperty)
       CREATE (u:Concept {name: 'User', description: 'A person who uses the AI Todo application.'})
       RETURN u`,
    ) as Query;

    expect(ast.matches).toHaveLength(1);
    const condition = ast.matches[0]!.where!.condition as NotCondition;
    expect(condition.type).toBe("NotCondition");

    expect(ast.create).toBeDefined();
    const createPattern = ast.create!.patterns[0] as CreateNodePattern;
    expect(createPattern.labels).toEqual(["Concept"]);
    expect(createPattern.properties?.name).toBe("User");
  });

  test("Query 2: MATCH + CREATE with multiple anonymous relationships", () => {
    const graph = createComprehensiveGraph();
    const user = graph.addVertex("Concept", { name: "User" });

    executeQuery(
      graph,
      `MATCH (u:Concept {name: 'User'})
       CREATE (u)-[:HasAttribute]->(:Property {name: 'username', description: 'The unique username of the user.'}),
              (u)-[:HasAttribute]->(:Property {name: 'email', description: 'The email address of the user.'})
       RETURN u`,
    );

    const attributes = [...graph.getVertices("Property")];
    expect(attributes).toHaveLength(2);

    const edges = [...graph.getEdges("HasAttribute")];
    expect(edges).toHaveLength(2);

    // Verify edge connections: (u)-[:HasAttribute]->(Property)
    // outV = source = user, inV = target = Property
    for (const edge of edges) {
      expect(edge.outV.id).toBe(user.id);
    }
  });

  test("Query 3: MATCH with Task Concept and multiple attributes", () => {
    const graph = createComprehensiveGraph();
    graph.addVertex("Concept", { name: "Task" });

    executeQuery(
      graph,
      `MATCH (t:Concept {name: 'Task'})
       CREATE (t)-[:HasAttribute]->(:Property {name: 'title', description: 'The title of the task.'}),
              (t)-[:HasAttribute]->(:Property {name: 'description', description: 'A detailed description of the task.'}),
              (t)-[:HasAttribute]->(:Property {name: 'dueDate', description: 'The date by which the task should be completed.'})
       RETURN t`,
    );

    const attributes = [...graph.getVertices("Property")];
    expect(attributes).toHaveLength(3);

    const edges = [...graph.getEdges("HasAttribute")];
    expect(edges).toHaveLength(3);
  });

  test("Query 4: MATCH with List Concept and attributes", () => {
    const graph = createComprehensiveGraph();
    graph.addVertex("Concept", { name: "List" });

    executeQuery(
      graph,
      `MATCH (l:Concept {name: 'List'})
       CREATE (l)-[:HasAttribute]->(:Property {name: 'name', description: 'The name of the list.'}),
              (l)-[:HasAttribute]->(:Property {name: 'color', description: 'The color associated with the list for easy identification.'})
       RETURN l`,
    );

    const attributes = [...graph.getVertices("Property")];
    expect(attributes).toHaveLength(2);
  });

  test("Query 5: Multiple CREATE clauses with variables referencing created nodes", () => {
    const graph = createComprehensiveGraph();
    graph.addVertex("Concept", { name: "Task" });

    executeQuery(
      graph,
      `MATCH (t:Concept {name: 'Task'})
       CREATE (a3:Property {name: 'title', description: 'The title of the task.'}),
              (a4:Property {name: 'description', description: 'A detailed description of the task.'}),
              (a5:Property {name: 'dueDate', description: 'The date by which the task should be completed.'})
       CREATE (t)-[:Contains]->(a3), (t)-[:Contains]->(a4), (t)-[:Contains]->(a5)
       RETURN t`,
    );

    const attributes = [...graph.getVertices("Property")];
    expect(attributes).toHaveLength(3);

    const edges = [...graph.getEdges("Contains")];
    expect(edges).toHaveLength(3);
  });

  test("Query 6: Comma-separated MATCH for Screen linking", () => {
    const graph = createComprehensiveGraph();
    graph.addVertex("Screen", { name: "Welcome Screen" });
    graph.addVertex("Screen", { name: "Signup Screen" });

    executeQuery(
      graph,
      "MATCH (w:Screen {name: 'Welcome Screen'}), (s:Screen {name: 'Signup Screen'}) CREATE (w)-[:LinksTo]->(s) RETURN w",
    );

    const edges = [...graph.getEdges("LinksTo")];
    expect(edges).toHaveLength(1);
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe("Edge cases", () => {
  test("exists() with nested NOT NOT", () => {
    const ast = parse("MATCH (n:User) WHERE NOT NOT exists(n.email) RETURN n") as Query;

    const condition = ast.matches[0]!.where!.condition as NotCondition;
    expect(condition.type).toBe("NotCondition");
    const innerNot = condition.condition as NotCondition;
    expect(innerNot.type).toBe("NotCondition");
    const existsCondition = innerNot.condition as ExistsCondition;
    expect(existsCondition.type).toBe("ExistsCondition");
  });

  test("CREATE with empty properties still works", () => {
    const graph = createFlexibleGraph();
    graph.addVertex("User", { name: "Alice" });

    executeQuery(graph, "MATCH (u:User) CREATE (u)-[:knows]->(:User {name: 'Bob'}) RETURN u");

    const users = [...graph.getVertices("User")];
    expect(users).toHaveLength(2);
  });

  test("exists() with property that contains special characters", () => {
    const graph = createComprehensiveGraph();
    graph.addVertex("Config", { setting_name: "value" });
    graph.addVertex("Config", { other: "value" });

    const results = executeQuery(graph, "MATCH (c:Config) WHERE exists(c.setting_name) RETURN c");

    expect(results).toHaveLength(1);
  });

  test("comma-separated MATCH with edge patterns throws helpful error", () => {
    const graph = createComprehensiveGraph();

    // Patterns with edges should throw an error
    expect(() => {
      executeQuery(graph, "MATCH (a:User)-[:FOLLOWS]->(b:User), (c:Post) RETURN a, c");
    }).toThrow(/Comma-separated MATCH patterns only support simple node patterns/);
  });
});
