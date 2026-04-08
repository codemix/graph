import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import type { Query, PatternComprehension } from "../AST.js";
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

// Schema for testing pattern comprehension
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
  },
} as const satisfies GraphSchema;

describe("Pattern Comprehension", () => {
  describe("Grammar Parsing", () => {
    it("should parse basic pattern comprehension [(n)-[:REL]->(m) | m.prop]", () => {
      const query = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) | b.name]) > 0 RETURN a.name`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse pattern comprehension with filter", () => {
      const query = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b:Person) WHERE b.age > 30 | b.name]) > 0 RETURN a.name`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse pattern comprehension with path variable", () => {
      const query = `MATCH (a:Person) WHERE size([p = (a)-[:KNOWS]->(b) | b.name]) > 0 RETURN a.name`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse pattern comprehension with simple node pattern", () => {
      const query = `MATCH (a:Person) WHERE size([(b:Movie) | b.title]) > 0 RETURN a.name`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });
  });

  describe("AST Structure", () => {
    it("should produce PatternComprehension AST node", () => {
      const query = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) | b.name]) > 0 RETURN a.name`;
      const ast = parse(query) as Query;

      // Find the PatternComprehension in the condition
      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");

      if (condition.type === "ExpressionCondition") {
        // The left side should be a function call (size)
        const funcCall = condition.left as any;
        expect(funcCall.type).toBe("FunctionCall");
        expect(funcCall.name).toBe("size");

        // The argument should be a PatternComprehension
        const patternComp = funcCall.args[0] as PatternComprehension;
        expect(patternComp.type).toBe("PatternComprehension");
        expect(patternComp.pattern).toBeDefined();
        expect(patternComp.projection).toBeDefined();
      }
    });

    it("should have optional path variable", () => {
      const query1 = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) | b.name]) > 0 RETURN a.name`;
      const ast1 = parse(query1) as Query;

      const condition1 = ast1.matches[0]!.where!.condition;
      if (condition1.type === "ExpressionCondition") {
        const funcCall = condition1.left as any;
        const patternComp = funcCall.args[0] as PatternComprehension;
        expect(patternComp.pathVariable).toBeUndefined();
      }

      const query2 = `MATCH (a:Person) WHERE size([p = (a)-[:KNOWS]->(b) | b.name]) > 0 RETURN a.name`;
      const ast2 = parse(query2) as Query;

      const condition2 = ast2.matches[0]!.where!.condition;
      if (condition2.type === "ExpressionCondition") {
        const funcCall = condition2.left as any;
        const patternComp = funcCall.args[0] as PatternComprehension;
        expect(patternComp.pathVariable).toBe("p");
      }
    });

    it("should have optional filter condition", () => {
      const query1 = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) | b.name]) > 0 RETURN a.name`;
      const ast1 = parse(query1) as Query;

      const condition1 = ast1.matches[0]!.where!.condition;
      if (condition1.type === "ExpressionCondition") {
        const funcCall = condition1.left as any;
        const patternComp = funcCall.args[0] as PatternComprehension;
        expect(patternComp.filterCondition).toBeUndefined();
      }

      const query2 = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) WHERE b.age > 30 | b.name]) > 0 RETURN a.name`;
      const ast2 = parse(query2) as Query;

      const condition2 = ast2.matches[0]!.where!.condition;
      if (condition2.type === "ExpressionCondition") {
        const funcCall = condition2.left as any;
        const patternComp = funcCall.args[0] as PatternComprehension;
        expect(patternComp.filterCondition).toBeDefined();
      }
    });
  });

  describe("Step Conversion", () => {
    it("should convert pattern comprehension to step format", () => {
      const query = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) | b.name]) > 0 RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      expect(steps.length).toBeGreaterThan(0);
    });

    it("should convert pattern comprehension with filter to step format", () => {
      const query = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) WHERE b.age > 30 | b.name]) > 0 RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      expect(steps.length).toBeGreaterThan(0);
    });
  });

  describe("Query Execution - Basic Pattern Comprehension", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });

      // Create a social network
      const alice = graph.addVertex("Person", { name: "Alice", age: 35 });
      const bob = graph.addVertex("Person", { name: "Bob", age: 28 });
      const charlie = graph.addVertex("Person", { name: "Charlie", age: 45 });
      const diana = graph.addVertex("Person", { name: "Diana", age: 32 });

      // Alice knows Bob and Charlie
      graph.addEdge(alice, "KNOWS", bob, { since: 2020 });
      graph.addEdge(alice, "KNOWS", charlie, { since: 2015 });

      // Bob knows Diana
      graph.addEdge(bob, "KNOWS", diana, { since: 2019 });

      // Diana knows nobody (isolated in outgoing direction)
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should return neighbors via pattern comprehension", () => {
      // Find persons who have at least one friend
      const query = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) | b.name]) > 0 RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice knows 2, Bob knows 1, Diana knows 0, Charlie knows 0
      expect(results).toHaveLength(2);
      expect(results).toContain("Alice");
      expect(results).toContain("Bob");
    });

    it("should return empty list for nodes with no matches", () => {
      // Find persons who know nobody
      const query = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) | b.name]) = 0 RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Charlie and Diana know nobody
      expect(results).toHaveLength(2);
      expect(results).toContain("Charlie");
      expect(results).toContain("Diana");
    });

    it("should project specific properties", () => {
      // Get all ages of Alice's friends
      const query = `MATCH (a:Person) WHERE a.name = 'Alice' AND size([(a)-[:KNOWS]->(b) | b.age]) = 2 RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice knows Bob (28) and Charlie (45)
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });
  });

  describe("Query Execution - Pattern Comprehension with Filter", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });

      const alice = graph.addVertex("Person", { name: "Alice", age: 35 });
      const bob = graph.addVertex("Person", { name: "Bob", age: 28 });
      const charlie = graph.addVertex("Person", { name: "Charlie", age: 45 });
      const diana = graph.addVertex("Person", { name: "Diana", age: 32 });

      graph.addEdge(alice, "KNOWS", bob, { since: 2020 });
      graph.addEdge(alice, "KNOWS", charlie, { since: 2015 });
      graph.addEdge(alice, "KNOWS", diana, { since: 2018 });
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should filter pattern matches with WHERE", () => {
      // Find persons who know someone over 40
      const query = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) WHERE b.age > 40 | b.name]) > 0 RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Only Alice knows Charlie (45)
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should count filtered matches correctly", () => {
      // Find persons who know exactly 2 people under 40
      const query = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) WHERE b.age < 40 | b.name]) = 2 RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice knows Bob (28) and Diana (32) under 40
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should support parameters in filter", () => {
      setQueryParams({ minAge: 30 });

      const query = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) WHERE b.age > $minAge | b.name]) = 2 RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice knows Charlie (45) and Diana (32) over 30
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });
  });

  describe("Query Execution - Pattern Comprehension with Simple Node Pattern", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });

      graph.addVertex("Person", { name: "Alice", age: 35 });
      graph.addVertex("Person", { name: "Bob", age: 28 });
      graph.addVertex("Movie", { title: "Matrix", year: 1999 });
      graph.addVertex("Movie", { title: "Inception", year: 2010 });
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should match all nodes of a label via pattern comprehension", () => {
      // Count movies using pattern comprehension
      const query = `MATCH (a:Person) WHERE size([(m:Movie) | m.title]) = 2 RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // All persons see 2 movies (pattern comprehension is independent of outer match)
      expect(results).toHaveLength(2);
    });

    it("should filter nodes in pattern comprehension", () => {
      // Count movies from 2000s
      const query = `MATCH (a:Person) WHERE size([(m:Movie) WHERE m.year >= 2000 | m.title]) = 1 RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // All persons see 1 movie from 2000s (Inception)
      expect(results).toHaveLength(2);
    });
  });

  describe("Query Execution - Edge Cases", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });

      const alice = graph.addVertex("Person", { name: "Alice", age: 35 });
      graph.addVertex("Person", { name: "Bob", age: 28 });

      // Self-reference
      graph.addEdge(alice, "KNOWS", alice, { since: 2020 });
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should handle self-referencing edges", () => {
      // Alice knows herself
      const query = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) | b.name]) = 1 AND a.name = 'Alice' RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should return empty list when pattern has no matches", () => {
      const query = `MATCH (a:Person) WHERE size([(a)-[:ACTED_IN]->(m) | m.title]) = 0 RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // No one acted in any movie
      expect(results).toHaveLength(2);
    });

    it("should work with empty graph for pattern", () => {
      const storage = new InMemoryGraphStorage();
      const emptyGraph = new Graph({ schema: testSchema, storage });
      emptyGraph.addVertex("Person", { name: "Solo" });

      const query = `MATCH (a:Person) WHERE size([(a)-[:KNOWS]->(b) | b.name]) = 0 RETURN a.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(emptyGraph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Solo");
    });
  });

  describe("Query Execution - Movie Database Example", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });

      // Create actors
      const keanu = graph.addVertex("Person", {
        name: "Keanu Reeves",
        age: 59,
      });
      const leo = graph.addVertex("Person", {
        name: "Leonardo DiCaprio",
        age: 49,
      });
      const ellen = graph.addVertex("Person", { name: "Ellen Page", age: 36 });

      // Create movies
      const matrix = graph.addVertex("Movie", {
        title: "The Matrix",
        year: 1999,
      });
      const inception = graph.addVertex("Movie", {
        title: "Inception",
        year: 2010,
      });

      // Create relationships
      graph.addEdge(keanu, "ACTED_IN", matrix, { role: "Neo" });
      graph.addEdge(leo, "ACTED_IN", inception, { role: "Cobb" });
      graph.addEdge(ellen, "ACTED_IN", inception, { role: "Ariadne" });
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should find actors with multiple movie appearances", () => {
      // Find actors who acted in at least 1 movie
      const query = `MATCH (p:Person) WHERE size([(p)-[:ACTED_IN]->(m:Movie) | m.title]) > 0 RETURN p.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(3);
      expect(results).toContain("Keanu Reeves");
      expect(results).toContain("Leonardo DiCaprio");
      expect(results).toContain("Ellen Page");
    });

    it("should project movie years", () => {
      // Find actors who acted in movies before 2005
      const query = `MATCH (p:Person) WHERE size([(p)-[:ACTED_IN]->(m:Movie) WHERE m.year < 2005 | m.year]) > 0 RETURN p.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Only Keanu acted in a movie before 2005 (The Matrix, 1999)
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Keanu Reeves");
    });
  });
});
