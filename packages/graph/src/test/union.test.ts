import { describe, test, expect, afterEach } from "vitest";
import {
  parse,
  anyAstToSteps,
  createTraverser,
  setQueryParams,
  clearQueryParams,
  type Query,
  type UnionQuery,
} from "../index.js";
import { createDemoGraph } from "../getDemoGraph.js";

// Use the demo graph which has Person, Thing vertices and knows, likes edges
const { graph } = createDemoGraph();

describe("UNION clause support", () => {
  describe("Grammar parsing", () => {
    test("parses UNION between two queries", () => {
      const result = parse("MATCH (a:Person) RETURN a.name UNION MATCH (b:Thing) RETURN b.name");

      expect(result).toMatchObject({
        type: "UnionQuery",
        all: false,
        queries: [
          {
            type: "Query",
            matches: [{ pattern: { elements: [{ labels: ["Person"] }] } }],
            return: { items: [{ variable: "a", property: "name" }] },
          },
          {
            type: "Query",
            matches: [{ pattern: { elements: [{ labels: ["Thing"] }] } }],
            return: { items: [{ variable: "b", property: "name" }] },
          },
        ],
      });
    });

    test("parses UNION ALL between two queries", () => {
      const result = parse(
        "MATCH (a:Person) RETURN a.name UNION ALL MATCH (b:Thing) RETURN b.name",
      );

      expect(result).toMatchObject({
        type: "UnionQuery",
        all: true,
        queries: [{ type: "Query" }, { type: "Query" }],
      });
    });

    test("parses UNION with three queries", () => {
      const result = parse(
        "MATCH (a:Person) RETURN a.name UNION MATCH (b:Person) RETURN b.name UNION MATCH (c:Thing) RETURN c.name",
      );

      expect(result).toMatchObject({
        type: "UnionQuery",
        all: false,
        queries: [{ type: "Query" }, { type: "Query" }, { type: "Query" }],
      });
    });

    test("parses single query without UNION as regular Query", () => {
      const result = parse("MATCH (n:Person) RETURN n.name");

      expect(result).toMatchObject({
        type: "Query",
        matches: [{ pattern: { elements: [{ labels: ["Person"] }] } }],
        return: { items: [{ variable: "n", property: "name" }] },
      });
    });

    test("parses UNION with WHERE clauses", () => {
      const result = parse(
        "MATCH (a:Person) WHERE a.age > 30 RETURN a.name UNION MATCH (b:Person) WHERE b.name = 'Alice' RETURN b.name",
      );

      expect(result).toMatchObject({
        type: "UnionQuery",
        queries: [
          {
            type: "Query",
            matches: [{ where: { type: "WhereClause" } }],
          },
          {
            type: "Query",
            matches: [{ where: { type: "WhereClause" } }],
          },
        ],
      });
    });

    test("parses UNION with ORDER BY and LIMIT", () => {
      const result = parse(
        "MATCH (a:Person) RETURN a.name ORDER BY a.name LIMIT 5 UNION MATCH (b:Person) RETURN b.name",
      );

      expect(result).toMatchObject({
        type: "UnionQuery",
        queries: [
          {
            type: "Query",
            orderBy: { orders: [{ property: "name" }] },
            limit: 5,
          },
          { type: "Query" },
        ],
      });
    });
  });

  describe("Step conversion", () => {
    test("converts UNION query to QueryUnionStep", () => {
      const ast = parse("MATCH (a:Person) RETURN a UNION MATCH (b:Thing) RETURN b") as UnionQuery;

      const steps = anyAstToSteps(ast);

      expect(steps).toHaveLength(1);
      expect(steps[0]!.name).toBe("QueryUnion");
    });

    test("converts UNION ALL query to QueryUnionAllStep", () => {
      const ast = parse(
        "MATCH (a:Person) RETURN a UNION ALL MATCH (b:Thing) RETURN b",
      ) as UnionQuery;

      const steps = anyAstToSteps(ast);

      expect(steps).toHaveLength(1);
      expect(steps[0]!.name).toBe("QueryUnionAll");
    });

    test("regular Query uses astToSteps directly", () => {
      const ast = parse("MATCH (n:Person) RETURN n") as Query;

      const steps = anyAstToSteps(ast);

      // Should be the normal steps, not wrapped in QueryUnionStep
      expect(steps.length).toBeGreaterThan(1);
      expect(steps[0]!.name).toBe("FetchVertices");
    });
  });

  describe("Query execution", () => {
    // Demo graph has: Alice (30), Bob (25), Charlie (35), Dave (40), Erin (45), Fiona (50), George (55)
    // Things: Apple, Banana, Cherry, Dates, Eggplant, Fig, Grape

    afterEach(() => {
      clearQueryParams();
    });

    test("UNION ALL returns all results including duplicates", () => {
      // Query the same set twice with overlapping conditions
      const ast = parse(
        "MATCH (p:Person) WHERE p.age > 30 RETURN p.name UNION ALL MATCH (p:Person) WHERE p.age < 50 RETURN p.name",
      ) as UnionQuery;

      const steps = anyAstToSteps(ast);
      const traverser = createTraverser(steps as any);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // First query (age > 30): Charlie (35), Dave (40), Erin (45), Fiona (50), George (55) = 5
      // Second query (age < 50): Alice (30), Bob (25), Charlie (35), Dave (40), Erin (45) = 5
      // UNION ALL: 10 results total (with duplicates Charlie, Dave, Erin)
      expect(results).toHaveLength(10);

      // For single RETURN item, result is the value directly (not an array)
      const names = results as string[];
      // Charlie, Dave, Erin should appear twice
      expect(names.filter((n) => n === "Charlie")).toHaveLength(2);
      expect(names.filter((n) => n === "Dave")).toHaveLength(2);
      expect(names.filter((n) => n === "Erin")).toHaveLength(2);
    });

    test("UNION removes duplicate results", () => {
      const ast = parse(
        "MATCH (p:Person) WHERE p.age > 30 RETURN p.name UNION MATCH (p:Person) WHERE p.age < 50 RETURN p.name",
      ) as UnionQuery;

      const steps = anyAstToSteps(ast);
      const traverser = createTraverser(steps as any);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // UNION removes duplicates, so we should get unique names only
      const names = results as string[];
      const uniqueNames = [...new Set(names)];

      expect(names).toHaveLength(uniqueNames.length);
      // All 7 people should appear exactly once
      expect(names).toHaveLength(7);
    });

    test("UNION with different label queries", () => {
      const ast = parse(
        "MATCH (p:Person) RETURN p.name UNION MATCH (t:Thing) RETURN t.name",
      ) as UnionQuery;

      const steps = anyAstToSteps(ast);
      const traverser = createTraverser(steps as any);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      const names = results as string[];
      // 7 persons + 7 things = 14 unique names
      expect(names).toContain("Alice");
      expect(names).toContain("Bob");
      expect(names).toContain("Apple");
      expect(names).toContain("Banana");
      expect(names).toHaveLength(14);
    });

    test("UNION with three queries", () => {
      const ast = parse(
        "MATCH (p:Person) WHERE p.age < 30 RETURN p.name " +
          "UNION MATCH (p:Person) WHERE p.age > 50 RETURN p.name " +
          "UNION MATCH (t:Thing) WHERE t.name = 'Apple' RETURN t.name",
      ) as UnionQuery;

      const steps = anyAstToSteps(ast);
      const traverser = createTraverser(steps as any);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      const names = results as string[];
      // Young (< 30): Bob (25)
      // Old (> 50): George (55)
      // Thing named Apple
      expect(names).toContain("Bob");
      expect(names).toContain("George");
      expect(names).toContain("Apple");
      expect(names).toHaveLength(3);
    });

    test("UNION with empty result from one query", () => {
      const ast = parse(
        "MATCH (p:Person) WHERE p.age > 100 RETURN p.name UNION MATCH (t:Thing) WHERE t.name = 'Apple' RETURN t.name",
      ) as UnionQuery;

      const steps = anyAstToSteps(ast);
      const traverser = createTraverser(steps as any);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // First query returns nothing, second returns Apple
      const names = results as string[];
      expect(names).toHaveLength(1);
      expect(names).toContain("Apple");
    });

    test("UNION with parameters", () => {
      setQueryParams({ minAge: 40 });

      const ast = parse(
        "MATCH (p:Person) WHERE p.age >= $minAge RETURN p.name UNION MATCH (t:Thing) WHERE t.name = 'Apple' RETURN t.name",
      ) as UnionQuery;

      const steps = anyAstToSteps(ast);
      const traverser = createTraverser(steps as any);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      const names = results as string[];
      expect(names).toContain("Dave"); // age 40
      expect(names).toContain("Erin"); // age 45
      expect(names).toContain("Fiona"); // age 50
      expect(names).toContain("George"); // age 55
      expect(names).not.toContain("Alice"); // age 30
      expect(names).not.toContain("Bob"); // age 25
      expect(names).toContain("Apple");
    });

    test("UNION returning multiple columns", () => {
      const ast = parse(
        "MATCH (p:Person) WHERE p.age > 45 RETURN p.name, p.age " +
          "UNION ALL " +
          "MATCH (p:Person) WHERE p.age < 35 RETURN p.name, p.age",
      ) as UnionQuery;

      const steps = anyAstToSteps(ast);
      const traverser = createTraverser(steps as any);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Each result should have 2 columns
      for (const result of results) {
        expect(Array.isArray(result)).toBe(true);
        expect((result as any[]).length).toBe(2);
      }

      // > 45: Fiona (50), George (55) = 2
      // < 35: Alice (30), Bob (25) = 2
      // UNION ALL keeps all 4
      expect(results).toHaveLength(4);
    });

    test("UNION deduplicates based on values not identity", () => {
      // Query the same data twice - UNION should deduplicate
      const ast = parse(
        "MATCH (p:Person) WHERE p.age = 30 RETURN p.name UNION MATCH (p:Person) WHERE p.name = 'Alice' RETURN p.name",
      ) as UnionQuery;

      const steps = anyAstToSteps(ast);
      const traverser = createTraverser(steps as any);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Both queries return Alice - should be deduplicated to 1
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });
  });

  describe("Edge cases", () => {
    test("UNION with both queries returning empty", () => {
      const ast = parse(
        "MATCH (p:Person) WHERE p.age > 100 RETURN p.name " +
          "UNION " +
          "MATCH (p:Person) WHERE p.age < 0 RETURN p.name",
      ) as UnionQuery;

      const steps = anyAstToSteps(ast);
      const traverser = createTraverser(steps as any);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(0);
    });

    test("UNION preserves order within branches", () => {
      const ast = parse(
        "MATCH (p:Person) WHERE p.age <= 30 RETURN p.name ORDER BY p.age ASC " +
          "UNION ALL " +
          "MATCH (p:Person) WHERE p.age >= 50 RETURN p.name ORDER BY p.age DESC",
      ) as UnionQuery;

      const steps = anyAstToSteps(ast);
      const traverser = createTraverser(steps as any);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      const names = results as string[];
      // First branch (age <= 30, ASC): Bob (25), Alice (30)
      // Second branch (age >= 50, DESC): George (55), Fiona (50)
      expect(names[0]).toBe("Bob");
      expect(names[1]).toBe("Alice");
      expect(names[2]).toBe("George");
      expect(names[3]).toBe("Fiona");
    });
  });
});
