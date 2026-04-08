import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import type { Query, ExistsSubquery } from "../AST.js";
import type { GraphSchema } from "../GraphSchema.js";
import { StandardSchemaV1 } from "@standard-schema/spec";

// Helper to create type
function makeType<T>(_defaultValue: T): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => ({ value: value as T }),
    },
  };
}

// Schema for testing EXISTS subquery
const testSchema = {
  vertices: {
    Person: {
      properties: {
        name: { type: makeType(undefined as string | undefined) },
        age: { type: makeType(undefined as number | undefined) },
      },
    },
    Movie: {
      properties: {
        title: { type: makeType(undefined as string | undefined) },
        year: { type: makeType(undefined as number | undefined) },
      },
    },
    City: {
      properties: {
        name: { type: makeType(undefined as string | undefined) },
      },
    },
  },
  edges: {
    KNOWS: {
      properties: {
        since: { type: makeType(undefined as number | undefined) },
      },
    },
    ACTED_IN: {
      properties: {
        role: { type: makeType(undefined as string | undefined) },
      },
    },
    LIVES_IN: {
      properties: {},
    },
  },
} as const satisfies GraphSchema;

describe("EXISTS Subquery", () => {
  describe("Grammar Parsing", () => {
    it("should parse basic EXISTS { pattern }", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m) } RETURN n.name`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
    });

    it("should parse exists((pattern)) with parentheses syntax", () => {
      const query = `MATCH (n:Person) WHERE exists((n)-[:KNOWS]->(m)) RETURN n.name`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
    });

    it("should parse NOT exists((pattern)) with parentheses syntax", () => {
      const query = `MATCH (n:Person) WHERE NOT exists((n)-[:KNOWS]->(m)) RETURN n.name`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("NotCondition");
    });

    it("should parse exists((pattern)) with empty node at end", () => {
      const query = `MATCH (c:Concept) WHERE NOT exists((c)-[:IsA]->()) RETURN c.name`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("NotCondition");
    });

    it("should parse EXISTS { pattern } with label filter", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m:Person) } RETURN n.name`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse EXISTS { pattern WHERE condition }", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m) WHERE m.age > 30 } RETURN n.name`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse NOT EXISTS { pattern }", () => {
      const query = `MATCH (n:Person) WHERE NOT EXISTS { (n)-[:KNOWS]->(m) } RETURN n.name`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("NotCondition");
    });

    it("should parse EXISTS with AND/OR conditions", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m) } AND n.age > 25 RETURN n.name`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("AndCondition");
    });
  });

  describe("AST Structure", () => {
    it("should produce ExistsSubquery AST node wrapped in ExpressionCondition", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m) } RETURN n.name`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");

      if (condition.type === "ExpressionCondition") {
        const existsSubquery = condition.left as ExistsSubquery;
        expect(existsSubquery.type).toBe("ExistsSubquery");
        expect(existsSubquery.pattern).toBeDefined();
        expect(existsSubquery.pattern.type).toBe("Pattern");
      }
    });

    it("should include filterCondition when WHERE is present", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m) WHERE m.age > 30 } RETURN n.name`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      if (condition.type === "ExpressionCondition") {
        const existsSubquery = condition.left as ExistsSubquery;
        expect(existsSubquery.filterCondition).toBeDefined();
      }
    });
  });

  describe("Step Conversion", () => {
    it("should convert EXISTS subquery to steps", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m) } RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      // Should have steps array
      expect(steps.length).toBeGreaterThan(0);
    });
  });

  describe("Query Execution", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      graph = new Graph({
        storage: new InMemoryGraphStorage(),
        schema: testSchema,
      });

      // Create test data: People who know other people
      const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
      const bob = graph.addVertex("Person", { name: "Bob", age: 35 });
      const charlie = graph.addVertex("Person", { name: "Charlie", age: 25 });
      const diana = graph.addVertex("Person", { name: "Diana", age: 40 });

      // Alice knows Bob and Charlie
      graph.addEdge(alice, "KNOWS", bob, { since: 2020 });
      graph.addEdge(alice, "KNOWS", charlie, { since: 2021 });

      // Bob knows Diana
      graph.addEdge(bob, "KNOWS", diana, { since: 2019 });

      // Diana doesn't know anyone
      // Charlie doesn't know anyone
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should return nodes that have at least one outgoing KNOWS relationship", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m) } RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice and Bob have outgoing KNOWS relationships
      expect(results).toHaveLength(2);
      expect(results).toContain("Alice");
      expect(results).toContain("Bob");
    });

    it("should work with exists((pattern)) parentheses syntax", () => {
      const query = `MATCH (n:Person) WHERE exists((n)-[:KNOWS]->(m)) RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice and Bob have outgoing KNOWS relationships
      expect(results).toHaveLength(2);
      expect(results).toContain("Alice");
      expect(results).toContain("Bob");
    });

    it("should work with NOT exists((pattern)) parentheses syntax", () => {
      const query = `MATCH (n:Person) WHERE NOT exists((n)-[:KNOWS]->(m)) RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Charlie and Diana don't have outgoing KNOWS relationships
      expect(results).toHaveLength(2);
      expect(results).toContain("Charlie");
      expect(results).toContain("Diana");
    });

    it("should work with exists((pattern)) with empty node", () => {
      const query = `MATCH (n:Person) WHERE exists((n)-[:KNOWS]->()) RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice and Bob have outgoing KNOWS relationships
      expect(results).toHaveLength(2);
      expect(results).toContain("Alice");
      expect(results).toContain("Bob");
    });

    it("should return nodes that have incoming KNOWS relationship", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)<-[:KNOWS]-(m) } RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Bob, Charlie, and Diana have incoming KNOWS relationships
      expect(results).toHaveLength(3);
      expect(results).toContain("Bob");
      expect(results).toContain("Charlie");
      expect(results).toContain("Diana");
    });

    it("should filter using NOT EXISTS", () => {
      const query = `MATCH (n:Person) WHERE NOT EXISTS { (n)-[:KNOWS]->(m) } RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Charlie and Diana don't have outgoing KNOWS relationships
      expect(results).toHaveLength(2);
      expect(results).toContain("Charlie");
      expect(results).toContain("Diana");
    });

    it("should filter with WHERE condition inside EXISTS", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m) WHERE m.age > 30 } RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice knows Bob (35) and Charlie (25) - Bob > 30, so Alice matches
      // Bob knows Diana (40) - Diana > 30, so Bob matches
      expect(results).toHaveLength(2);
      expect(results).toContain("Alice");
      expect(results).toContain("Bob");
    });

    it("should combine EXISTS with other conditions", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m) } AND n.age > 30 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice (30) and Bob (35) have outgoing KNOWS, but only Bob is > 30
      expect(results).toHaveLength(1);
      expect(results).toContain("Bob");
    });

    it("should support parameters in EXISTS filter condition", () => {
      setQueryParams({ minAge: 30 });

      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m) WHERE m.age >= $minAge } RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice knows Bob (35) and Charlie (25) - Bob >= 30, so Alice matches
      // Bob knows Diana (40) - Diana >= 30, so Bob matches
      expect(results).toHaveLength(2);
      expect(results).toContain("Alice");
      expect(results).toContain("Bob");
    });

    it("should handle EXISTS with label filtering in pattern", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m:Person) } RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice and Bob have KNOWS relationships to Person nodes
      expect(results).toHaveLength(2);
      expect(results).toContain("Alice");
      expect(results).toContain("Bob");
    });

    it("should return false when no matches exist", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:ACTED_IN]->(m:Movie) } RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      // No one has ACTED_IN relationships
      expect(results).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      graph = new Graph({
        storage: new InMemoryGraphStorage(),
        schema: testSchema,
      });
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should handle empty graph", () => {
      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m) } RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(0);
    });

    it("should handle nodes with no relationships", () => {
      graph.addVertex("Person", { name: "Lonely" });

      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]->(m) } RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(0);
    });

    it("should work with bidirectional edge pattern", () => {
      const alice = graph.addVertex("Person", { name: "Alice" });
      const bob = graph.addVertex("Person", { name: "Bob" });
      graph.addEdge(alice, "KNOWS", bob, {});

      const query = `MATCH (n:Person) WHERE EXISTS { (n)-[:KNOWS]-(m) } RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Both Alice and Bob are connected via KNOWS (bidirectional)
      expect(results).toHaveLength(2);
      expect(results).toContain("Alice");
      expect(results).toContain("Bob");
    });
  });
});
