import { expect, test, describe, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import type { Query, Pattern, NodePattern, EdgePattern } from "../AST.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";

// Helper to create schema type
function makeType<T>(_defaultValue: T): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "codemix",
      validate: (value) => ({ value: value as T }),
    },
  };
}

// Helper to extract nodes from a Pattern
function getNodes(pattern: Pattern): NodePattern[] {
  return pattern.elements.filter((e): e is NodePattern => e.type === "NodePattern");
}

// Helper to extract edges from a Pattern
function getEdges(pattern: Pattern): EdgePattern[] {
  return pattern.elements.filter((e): e is EdgePattern => e.type === "EdgePattern");
}

describe("Backtick-quoted identifier grammar parsing", () => {
  describe("Variable identifiers", () => {
    test("parses backtick-quoted variable name", () => {
      const query = "MATCH (`my node`:Person) RETURN `my node`";
      const ast = parse(query) as Query;

      expect(ast.type).toBe("Query");
      expect(ast.matches).toHaveLength(1);
      const pattern = ast.matches[0]!.pattern as Pattern;
      const nodes = getNodes(pattern);
      expect(nodes[0]!.variable).toBe("my node");
    });

    test("parses reserved word as variable when backtick-quoted", () => {
      const query = "MATCH (`MATCH`:Person) RETURN `MATCH`";
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      expect(getNodes(pattern)[0]!.variable).toBe("MATCH");
    });

    test("parses variable with special characters", () => {
      const query = "MATCH (`user-name`:Person) RETURN `user-name`";
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      expect(getNodes(pattern)[0]!.variable).toBe("user-name");
    });

    test("parses variable with spaces", () => {
      const query = "MATCH (`my variable`:Person) RETURN `my variable`";
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      expect(getNodes(pattern)[0]!.variable).toBe("my variable");
    });

    test("parses escaped backtick in variable name", () => {
      const query = "MATCH (`my``var`:Person) RETURN `my``var`";
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      // Double backtick should become single backtick
      expect(getNodes(pattern)[0]!.variable).toBe("my`var");
    });
  });

  describe("Label identifiers", () => {
    test("parses backtick-quoted label", () => {
      const query = "MATCH (n:`User Type`) RETURN n";
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      expect(getNodes(pattern)[0]!.labels).toContain("User Type");
    });

    test("parses reserved word as label when backtick-quoted", () => {
      const query = "MATCH (n:`MATCH`) RETURN n";
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      expect(getNodes(pattern)[0]!.labels).toContain("MATCH");
    });

    test("parses label with special characters", () => {
      const query = "MATCH (n:`User-Type`) RETURN n";
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      expect(getNodes(pattern)[0]!.labels).toContain("User-Type");
    });

    test("parses multiple labels with mixed quoting", () => {
      const query = "MATCH (n:Person:`Admin User`) RETURN n";
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      const labels = getNodes(pattern)[0]!.labels;
      expect(labels).toContain("Person");
      expect(labels).toContain("Admin User");
    });
  });

  describe("Relationship type identifiers", () => {
    test("parses backtick-quoted relationship type", () => {
      const query = "MATCH (a)-[:`KNOWS WELL`]->(b) RETURN a, b";
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      const edges = getEdges(pattern);
      expect(edges[0]!.labels).toContain("KNOWS WELL");
    });

    test("parses reserved word as relationship type", () => {
      const query = "MATCH (a)-[:`WHERE`]->(b) RETURN a, b";
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      const edges = getEdges(pattern);
      expect(edges[0]!.labels).toContain("WHERE");
    });
  });

  describe("Property identifiers", () => {
    test("parses backtick-quoted property name in WHERE", () => {
      const query = "MATCH (n:Person) WHERE n.`first name` = 'Alice' RETURN n";
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition as {
        property: string;
      };
      expect(condition.property).toBe("first name");
    });

    test("parses backtick-quoted property name in RETURN", () => {
      const query = "MATCH (n:Person) RETURN n.`first name`";
      const ast = parse(query) as Query;

      const returnItem = ast.return!.items[0]!;
      // Check the item properties directly rather than type discriminator
      expect((returnItem as any).variable).toBe("n");
      expect((returnItem as any).property).toBe("first name");
    });

    test("parses reserved word as property name", () => {
      const query = "MATCH (n:Person) WHERE n.`MATCH` = 'value' RETURN n";
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition as {
        property: string;
      };
      expect(condition.property).toBe("MATCH");
    });

    test("parses property with special characters", () => {
      const query = "MATCH (n:Person) WHERE n.`prop-name` = 'value' RETURN n";
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition as {
        property: string;
      };
      expect(condition.property).toBe("prop-name");
    });
  });

  describe("Parameter identifiers", () => {
    test("parses backtick-quoted parameter name", () => {
      const query = "MATCH (n:Person) WHERE n.name = $`param name` RETURN n";
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition as {
        value: { type: string; name: string };
      };
      expect(condition.value.type).toBe("ParameterRef");
      expect(condition.value.name).toBe("param name");
    });

    test("parses reserved word as parameter name with backticks", () => {
      const query = "MATCH (n:Person) WHERE n.name = $`MATCH` RETURN n";
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition as {
        value: { type: string; name: string };
      };
      expect(condition.value.name).toBe("MATCH");
    });
  });

  describe("Function identifiers", () => {
    test("parses backtick-quoted function name", () => {
      const query = "MATCH (n:Person) WHERE `toLower`(n.name) = 'alice' RETURN n";
      const ast = parse(query) as Query;

      // Should parse without error - function invocation with backtick name
      expect(ast.type).toBe("Query");
    });
  });

  describe("Complex scenarios", () => {
    test("parses query with multiple backtick-quoted identifiers", () => {
      const query =
        "MATCH (`my node`:`User Type`)-[:`KNOWS WELL`]->(`other node`) WHERE `my node`.`first name` = 'Alice' RETURN `my node`";
      const ast = parse(query) as Query;

      expect(ast.type).toBe("Query");
      const pattern = ast.matches[0]!.pattern as Pattern;
      const nodes = getNodes(pattern);
      const edges = getEdges(pattern);
      expect(nodes[0]!.variable).toBe("my node");
      expect(nodes[0]!.labels).toContain("User Type");
      expect(edges[0]!.labels).toContain("KNOWS WELL");
      expect(nodes[1]!.variable).toBe("other node");
    });

    test("parses backtick identifier with unicode", () => {
      const query = "MATCH (`用户`:Person) RETURN `用户`";
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      expect(getNodes(pattern)[0]!.variable).toBe("用户");
    });

    test("parses backtick identifier with numbers starting the name", () => {
      const query = "MATCH (`123abc`:Person) RETURN `123abc`";
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      expect(getNodes(pattern)[0]!.variable).toBe("123abc");
    });
  });
});

describe("Backtick identifier query execution", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          "first name": { type: makeType<string>("") },
          "last name": { type: makeType<string>("") },
          "prop-with-dash": { type: makeType<string>("") },
        },
      },
    },
    edges: {
      "knows well": { properties: {} },
    },
  };

  let graph: Graph<typeof schema>;

  beforeEach(() => {
    const storage = new InMemoryGraphStorage();
    graph = new Graph({ schema, storage });

    // Create nodes with various property names
    const alice = graph.addVertex("Person", {
      name: "Alice",
      "first name": "Alice",
      "last name": "Smith",
      "prop-with-dash": "value1",
    });

    const bob = graph.addVertex("Person", {
      name: "Bob",
      "first name": "Bob",
      "last name": "Jones",
      "prop-with-dash": "value2",
    });

    // Add an edge with space in type (source, type, target, props)
    graph.addEdge(alice, "knows well", bob, {});
  });

  afterEach(() => {
    clearQueryParams();
  });

  test("queries with backtick-quoted property name", () => {
    const query = "MATCH (n:Person) WHERE n.`first name` = 'Alice' RETURN n.`first name`";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = Array.from(traverser.traverse(graph, [undefined]));
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Alice");
  });

  test("queries with backtick-quoted relationship type", () => {
    const query =
      "MATCH (a:Person)-[:`knows well`]->(b:Person) RETURN a.`first name`, b.`first name`";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = Array.from(traverser.traverse(graph, [undefined]));
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["Alice", "Bob"]);
  });

  test("queries with backtick property containing dash", () => {
    const query = "MATCH (n:Person) WHERE n.`prop-with-dash` = 'value1' RETURN n.`first name`";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = Array.from(traverser.traverse(graph, [undefined]));
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Alice");
  });

  test("queries with parameter with backtick name", () => {
    setQueryParams({ "first name": "Alice" });

    const query = "MATCH (n:Person) WHERE n.`first name` = $`first name` RETURN n.`last name`";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = Array.from(traverser.traverse(graph, [undefined]));
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Smith");
  });
});

describe("Backtick identifier SET/CREATE operations", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          "full name": { type: makeType<string>("") },
        },
      },
      "User Account": {
        properties: {
          name: { type: makeType<string>("") },
          "first name": { type: makeType<string>("") },
        },
      },
    },
    edges: {},
  };

  let graph: Graph<typeof schema>;

  beforeEach(() => {
    const storage = new InMemoryGraphStorage();
    graph = new Graph({ schema, storage });
    graph.addVertex("Person", { name: "Alice", "full name": "" });
  });

  afterEach(() => {
    clearQueryParams();
  });

  test("SET with backtick-quoted property name", () => {
    const query = "MATCH (n:Person) SET n.`full name` = 'Alice Smith' RETURN n.`full name`";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = Array.from(traverser.traverse(graph, [undefined]));
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Alice Smith");
  });

  test("CREATE with backtick-quoted label", () => {
    const query = "CREATE (n:`User Account` {name: 'Bob'}) RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = Array.from(traverser.traverse(graph, [undefined]));
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Bob");
  });

  test("CREATE with backtick-quoted property name", () => {
    const query = "CREATE (n:`User Account` {`first name`: 'Charlie'}) RETURN n.`first name`";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = Array.from(traverser.traverse(graph, [undefined]));
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Charlie");
  });
});
