import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { clearQueryParams } from "../Steps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import type { Query, ParenthesizedPathPattern, Pattern } from "../AST.js";
import type { GraphSchema } from "../GraphSchema.js";
import { makeType, executeQuery } from "./testHelpers.js";

const schema = {
  vertices: {
    Person: {
      properties: {
        name: { type: makeType<string>("") },
      },
    },
    Node: {
      properties: {
        name: { type: makeType<string>("") },
      },
    },
  },
  edges: {
    KNOWS: {
      properties: {
        weight: { type: makeType<number>(0) },
        active: { type: makeType<boolean>(true) },
      },
    },
    REL: {
      properties: {
        weight: { type: makeType<number>(0) },
      },
    },
    FOLLOWS: {
      properties: {},
    },
  },
} as const satisfies GraphSchema;

describe("Parenthesized Path Patterns", () => {
  describe("Grammar Parsing", () => {
    test("parses a simple parenthesized pattern without WHERE", () => {
      const query = `MATCH (a) (((b)-[r]->(c))) RETURN a, c`;
      const ast = parse(query) as Query;

      expect(ast.matches).toHaveLength(1);
      const pattern = ast.matches[0]!.pattern as Pattern;
      expect(pattern.elements).toHaveLength(2);
      expect(pattern.elements[0]!.type).toBe("NodePattern");
      expect(pattern.elements[1]!.type).toBe("ParenthesizedPathPattern");

      const parenthesized = pattern.elements[1] as ParenthesizedPathPattern;
      expect(parenthesized.where).toBeUndefined();
      expect(parenthesized.quantifier).toBeUndefined();
    });

    test("parses a parenthesized pattern with inline WHERE", () => {
      const query = `MATCH (a) (((b)-[r]->(c)) WHERE r.weight > 10) RETURN a, c`;
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      const parenthesized = pattern.elements[1] as ParenthesizedPathPattern;

      expect(parenthesized.where).toBeDefined();
      expect(parenthesized.where!.type).toBe("PropertyCondition");
    });

    test("parses a parenthesized pattern with + quantifier", () => {
      const query = `MATCH (a) (((b)-[r]->(c)))+ RETURN a, c`;
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      const parenthesized = pattern.elements[1] as ParenthesizedPathPattern;

      expect(parenthesized.quantifier).toBeDefined();
      expect(parenthesized.quantifier!.min).toBe(1);
      expect(parenthesized.quantifier!.max).toBeUndefined();
    });

    test("parses a parenthesized pattern with * quantifier", () => {
      const query = `MATCH (a) (((b)-[r]->(c)))* RETURN a, c`;
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      const parenthesized = pattern.elements[1] as ParenthesizedPathPattern;

      expect(parenthesized.quantifier).toBeDefined();
      expect(parenthesized.quantifier!.min).toBe(1);
      expect(parenthesized.quantifier!.max).toBeUndefined();
    });

    test("parses a parenthesized pattern with {n,m} quantifier", () => {
      const query = `MATCH (a) (((b)-[r]->(c))){2,5} RETURN a, c`;
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      const parenthesized = pattern.elements[1] as ParenthesizedPathPattern;

      expect(parenthesized.quantifier).toBeDefined();
      expect(parenthesized.quantifier!.min).toBe(2);
      expect(parenthesized.quantifier!.max).toBe(5);
    });

    test("parses a parenthesized pattern with WHERE and quantifier", () => {
      const query = `MATCH (a) (((b)-[r]->(c)) WHERE r.active = true){1,3} RETURN a, c`;
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      const parenthesized = pattern.elements[1] as ParenthesizedPathPattern;

      expect(parenthesized.where).toBeDefined();
      expect(parenthesized.quantifier).toBeDefined();
      expect(parenthesized.quantifier!.min).toBe(1);
      expect(parenthesized.quantifier!.max).toBe(3);
    });

    test("parses a parenthesized pattern with label filters", () => {
      const query = `MATCH (a:Person) (((b:Node)-[r:KNOWS]->(c:Node))) RETURN a, c`;
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      const parenthesized = pattern.elements[1] as ParenthesizedPathPattern;

      expect(parenthesized.pattern.elements).toHaveLength(3);
      const innerNode = parenthesized.pattern.elements[0];
      expect(innerNode!.type).toBe("NodePattern");
      // @ts-expect-error - accessing labels on NodePattern
      expect(innerNode!.labels).toContain("Node");
    });

    test("parses inner pattern variables", () => {
      const query = `MATCH (a) (((x)-[r:REL]->(y))) RETURN a, x, y`;
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      const parenthesized = pattern.elements[1] as ParenthesizedPathPattern;

      // Inner pattern should have node x, edge r, node y
      expect(parenthesized.pattern.elements).toHaveLength(3);
      // @ts-expect-error - accessing variable
      expect(parenthesized.pattern.elements[0]!.variable).toBe("x");
      // @ts-expect-error - accessing variable
      expect(parenthesized.pattern.elements[1]!.variable).toBe("r");
      // @ts-expect-error - accessing variable
      expect(parenthesized.pattern.elements[2]!.variable).toBe("y");
    });

    test("parses exact count quantifier {n}", () => {
      const query = `MATCH (a) (((b)-[r]->(c))){3} RETURN a, c`;
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      const parenthesized = pattern.elements[1] as ParenthesizedPathPattern;

      expect(parenthesized.quantifier).toBeDefined();
      expect(parenthesized.quantifier!.min).toBe(3);
      expect(parenthesized.quantifier!.max).toBe(3);
    });

    test("parses open-ended quantifier {n,}", () => {
      const query = `MATCH (a) (((b)-[r]->(c))){2,} RETURN a, c`;
      const ast = parse(query) as Query;

      const pattern = ast.matches[0]!.pattern as Pattern;
      const parenthesized = pattern.elements[1] as ParenthesizedPathPattern;

      expect(parenthesized.quantifier).toBeDefined();
      expect(parenthesized.quantifier!.min).toBe(2);
      expect(parenthesized.quantifier!.max).toBeUndefined();
    });
  });

  describe("Query Execution", () => {
    let graph: Graph<typeof schema>;

    beforeEach(() => {
      graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
    });

    afterEach(() => {
      clearQueryParams();
    });

    describe("Basic Parenthesized Patterns", () => {
      test("executes a simple parenthesized pattern", () => {
        // Create chain: A -> B -> C -> D
        const a = graph.addVertex("Person", { name: "A" });
        const b = graph.addVertex("Person", { name: "B" });
        const c = graph.addVertex("Person", { name: "C" });
        const d = graph.addVertex("Person", { name: "D" });

        graph.addEdge(a, "KNOWS", b, { weight: 5, active: true });
        graph.addEdge(b, "KNOWS", c, { weight: 10, active: true });
        graph.addEdge(c, "KNOWS", d, { weight: 15, active: true });

        // Start from A, find immediate KNOWS targets
        const results = executeQuery(
          graph,
          "MATCH (a:Person) (((b)-[r:KNOWS]->(c))) WHERE a.name = 'A' RETURN c.name",
        );

        // A knows B directly
        expect(results).toContain("B");
        expect(results).toHaveLength(1);
      });

      test("executes a parenthesized pattern with + quantifier (one or more)", () => {
        const a = graph.addVertex("Person", { name: "A" });
        const b = graph.addVertex("Person", { name: "B" });
        const c = graph.addVertex("Person", { name: "C" });
        const d = graph.addVertex("Person", { name: "D" });

        graph.addEdge(a, "KNOWS", b, { weight: 5, active: true });
        graph.addEdge(b, "KNOWS", c, { weight: 10, active: true });
        graph.addEdge(c, "KNOWS", d, { weight: 15, active: true });

        const results = executeQuery(
          graph,
          "MATCH (a:Person) (((b)-[r:KNOWS]->(c)))+ WHERE a.name = 'A' RETURN c.name",
        );

        // Should find B (1 hop), C (2 hops), D (3 hops)
        expect(results).toContain("B");
        expect(results).toContain("C");
        expect(results).toContain("D");
        expect(results).toHaveLength(3);
      });

      test("executes a parenthesized pattern with {n,m} range quantifier", () => {
        const a = graph.addVertex("Person", { name: "A" });
        const b = graph.addVertex("Person", { name: "B" });
        const c = graph.addVertex("Person", { name: "C" });
        const d = graph.addVertex("Person", { name: "D" });
        const e = graph.addVertex("Person", { name: "E" });

        graph.addEdge(a, "KNOWS", b, { weight: 5, active: true });
        graph.addEdge(b, "KNOWS", c, { weight: 10, active: true });
        graph.addEdge(c, "KNOWS", d, { weight: 15, active: true });
        graph.addEdge(d, "KNOWS", e, { weight: 20, active: true });

        const results = executeQuery(
          graph,
          "MATCH (a:Person) (((b)-[r:KNOWS]->(c))){2,3} WHERE a.name = 'A' RETURN c.name",
        );

        // Should find C (2 hops), D (3 hops)
        expect(results).toContain("C");
        expect(results).toContain("D");
        expect(results).toHaveLength(2);
      });

      test("executes a parenthesized pattern with exact count {n}", () => {
        const a = graph.addVertex("Person", { name: "A" });
        const b = graph.addVertex("Person", { name: "B" });
        const c = graph.addVertex("Person", { name: "C" });
        const d = graph.addVertex("Person", { name: "D" });

        graph.addEdge(a, "KNOWS", b, { weight: 5, active: true });
        graph.addEdge(b, "KNOWS", c, { weight: 10, active: true });
        graph.addEdge(c, "KNOWS", d, { weight: 15, active: true });

        const results = executeQuery(
          graph,
          "MATCH (a:Person) (((b)-[r:KNOWS]->(c))){2} WHERE a.name = 'A' RETURN c.name",
        );

        // Should find C only (exactly 2 hops)
        expect(results).toHaveLength(1);
        expect(results[0]).toBe("C");
      });
    });

    describe("Parenthesized Patterns with WHERE", () => {
      test("executes a parenthesized pattern with inline WHERE filtering", () => {
        const a = graph.addVertex("Person", { name: "A" });
        const b = graph.addVertex("Person", { name: "B" });
        const c = graph.addVertex("Person", { name: "C" });
        const d = graph.addVertex("Person", { name: "D" });

        // A->B weight 5 (fails), B->C weight 10 (passes), C->D weight 15 (passes)
        graph.addEdge(a, "KNOWS", b, { weight: 5, active: true });
        graph.addEdge(b, "KNOWS", c, { weight: 10, active: true });
        graph.addEdge(c, "KNOWS", d, { weight: 15, active: true });

        // Only follow edges with weight >= 10, starting from B
        const results = executeQuery(
          graph,
          "MATCH (a:Person) (((x)-[r:KNOWS]->(y)) WHERE r.weight >= 10)+ WHERE a.name = 'B' RETURN y.name",
        );

        // From B: B->C (10) and C->D (15) both qualify
        expect(results).toContain("C");
        expect(results).toContain("D");
      });

      test("executes a parenthesized pattern with inline WHERE that filters out all paths", () => {
        const a = graph.addVertex("Person", { name: "A" });
        const b = graph.addVertex("Person", { name: "B" });
        const c = graph.addVertex("Person", { name: "C" });

        // All edges have weight < 10
        graph.addEdge(a, "KNOWS", b, { weight: 5, active: true });
        graph.addEdge(b, "KNOWS", c, { weight: 7, active: true });

        // Only follow edges with weight >= 10, starting from A
        const results = executeQuery(
          graph,
          "MATCH (a:Person) (((x)-[r:KNOWS]->(y)) WHERE r.weight >= 10)+ WHERE a.name = 'A' RETURN y.name",
        );

        // No edges qualify
        expect(results).toHaveLength(0);
      });

      test("executes a parenthesized pattern with WHERE and quantifier", () => {
        const a = graph.addVertex("Person", { name: "A" });
        const b = graph.addVertex("Person", { name: "B" });
        const c = graph.addVertex("Person", { name: "C" });
        const d = graph.addVertex("Person", { name: "D" });
        const e = graph.addVertex("Person", { name: "E" });

        graph.addEdge(a, "KNOWS", b, { weight: 10, active: true });
        graph.addEdge(b, "KNOWS", c, { weight: 12, active: true });
        graph.addEdge(c, "KNOWS", d, { weight: 15, active: true });
        graph.addEdge(d, "KNOWS", e, { weight: 20, active: true });

        // Follow edges with weight >= 10, exactly 2 hops
        const results = executeQuery(
          graph,
          "MATCH (a:Person) (((x)-[r:KNOWS]->(y)) WHERE r.weight >= 10){2} WHERE a.name = 'A' RETURN y.name",
        );

        // From A: A->B->C (2 hops, both >= 10)
        expect(results).toHaveLength(1);
        expect(results[0]).toBe("C");
      });
    });

    describe("Edge Cases", () => {
      test("handles empty graph", () => {
        const results = executeQuery(
          graph,
          "MATCH (a:Person) (((b)-[r:KNOWS]->(c)))+ RETURN c",
        );

        expect(results).toHaveLength(0);
      });

      test("handles nodes without matching relationships", () => {
        graph.addVertex("Person", { name: "Alice" });
        graph.addVertex("Person", { name: "Bob" });
        // No edges

        const results = executeQuery(
          graph,
          "MATCH (a:Person) (((b)-[r:KNOWS]->(c)))+ RETURN c",
        );

        expect(results).toHaveLength(0);
      });

      test("handles disconnected components", () => {
        const a = graph.addVertex("Person", { name: "A" });
        const b = graph.addVertex("Person", { name: "B" });
        const c = graph.addVertex("Person", { name: "C" });
        const d = graph.addVertex("Person", { name: "D" });

        // Two separate chains: A -> B and C -> D
        graph.addEdge(a, "KNOWS", b, { weight: 5, active: true });
        graph.addEdge(c, "KNOWS", d, { weight: 10, active: true });

        const results = executeQuery(
          graph,
          "MATCH (a:Person) (((x)-[r:KNOWS]->(y)))+ WHERE a.name = 'A' RETURN y.name",
        );

        // Only B is reachable from A
        expect(results).toHaveLength(1);
        expect(results[0]).toBe("B");
      });
    });
  });
});
