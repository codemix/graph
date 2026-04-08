/**
 * Tests for DISTINCT support in aggregate functions
 */
import { describe, test, expect, beforeEach } from "vitest";
import { parse } from "../grammar.js";
import { anyAstToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import type { Query, MultiStatement } from "../AST.js";
import type { GraphSchema } from "../GraphSchema.js";

const schema = {
  vertices: {
    Person: {
      properties: {
        name: { type: {} as any },
      },
    },
    Item: {
      properties: {
        category: { type: {} as any },
        price: { type: {} as any },
        score: { type: {} as any },
        value: { type: {} as any },
      },
    },
  },
  edges: {
    KNOWS: { properties: {} },
    FOLLOWS: { properties: {} },
  },
} as const satisfies GraphSchema;

function createGraph() {
  return new Graph({ schema, storage: new InMemoryGraphStorage() });
}

function executeQuery(
  graph: Graph<typeof schema>,
  queryString: string,
): unknown[] {
  const parsed = parse(queryString);
  // Handle MultiStatement (for CREATE, etc)
  if (parsed.type === "MultiStatement") {
    const results: unknown[] = [];
    for (const stmt of (parsed as MultiStatement).statements) {
      const ast = stmt as Query;
      const steps = anyAstToSteps(ast);
      const traverser = createTraverser(steps);
      results.push(...traverser.traverse(graph, []));
    }
    return results;
  }
  const ast = parsed as Query;
  const steps = anyAstToSteps(ast);
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

describe("DISTINCT in aggregate functions", () => {
  let graph: Graph<typeof schema>;

  beforeEach(() => {
    graph = createGraph();
  });

  describe("count(DISTINCT ...)", () => {
    test("count(DISTINCT x) on property values", () => {
      // Add persons with duplicate names
      graph.addVertex("Person", { name: "Alice" });
      graph.addVertex("Person", { name: "Bob" });
      graph.addVertex("Person", { name: "Alice" });

      // count(DISTINCT n.name) should only count unique names
      const results = executeQuery(
        graph,
        "MATCH (n:Person) RETURN count(DISTINCT n.name) AS cnt",
      );

      expect(results).toEqual([{ cnt: 2 }]); // Alice and Bob
    });

    test("count(DISTINCT x) with category property", () => {
      graph.addVertex("Item", { category: "A" });
      graph.addVertex("Item", { category: "B" });
      graph.addVertex("Item", { category: "A" });
      graph.addVertex("Item", { category: "C" });
      graph.addVertex("Item", { category: "B" });

      const results = executeQuery(
        graph,
        "MATCH (i:Item) RETURN count(DISTINCT i.category) AS categories",
      );

      expect(results).toEqual([{ categories: 3 }]); // A, B, C
    });

    test("count(DISTINCT x) excludes null values", () => {
      graph.addVertex("Person", { name: "Alice" });
      graph.addVertex("Person", { name: null });
      graph.addVertex("Person", { name: "Bob" });
      graph.addVertex("Person", {}); // missing name = undefined

      const results = executeQuery(
        graph,
        "MATCH (n:Person) RETURN count(DISTINCT n.name) AS cnt",
      );

      // Only Alice and Bob count (null and undefined are not counted)
      expect(results).toEqual([{ cnt: 2 }]);
    });

    test("count(DISTINCT n) on nodes", () => {
      graph.addVertex("Person", { name: "Alice" });
      graph.addVertex("Person", { name: "Bob" });
      graph.addVertex("Person", { name: "Charlie" });
      graph.addVertex("Person", { name: "Alice" }); // Different node, same name

      // count(DISTINCT n) should count all 4 unique nodes
      const results = executeQuery(
        graph,
        "MATCH (n:Person) RETURN count(DISTINCT n) AS nodeCount",
      );

      expect(results).toEqual([{ nodeCount: 4 }]);
    });
  });

  describe("collect(DISTINCT ...)", () => {
    test("collect(DISTINCT x) on property values", () => {
      graph.addVertex("Person", { name: "Alice" });
      graph.addVertex("Person", { name: "Bob" });
      graph.addVertex("Person", { name: "Alice" });
      graph.addVertex("Person", { name: "Charlie" });

      const results = executeQuery(
        graph,
        "MATCH (n:Person) RETURN collect(DISTINCT n.name) AS names",
      );

      expect(results).toHaveLength(1);
      const names = (results[0] as { names: string[] }).names;
      expect(names).toHaveLength(3);
      expect(names.sort()).toEqual(["Alice", "Bob", "Charlie"]);
    });

    test("collect(DISTINCT x) excludes null values", () => {
      graph.addVertex("Person", { name: "Alice" });
      graph.addVertex("Person", { name: null });
      graph.addVertex("Person", { name: "Bob" });
      graph.addVertex("Person", {}); // missing name

      const results = executeQuery(
        graph,
        "MATCH (n:Person) RETURN collect(DISTINCT n.name) AS names",
      );

      expect(results).toHaveLength(1);
      const names = (results[0] as { names: string[] }).names;
      expect(names).toHaveLength(2);
      expect(names.sort()).toEqual(["Alice", "Bob"]);
    });
  });

  describe("sum(DISTINCT ...)", () => {
    test("sum(DISTINCT x) on property values", () => {
      graph.addVertex("Item", { price: 10 });
      graph.addVertex("Item", { price: 20 });
      graph.addVertex("Item", { price: 10 }); // duplicate
      graph.addVertex("Item", { price: 30 });

      // sum(DISTINCT price) = 10 + 20 + 30 = 60 (not 70)
      const results = executeQuery(
        graph,
        "MATCH (i:Item) RETURN sum(DISTINCT i.price) AS total",
      );

      expect(results).toEqual([{ total: 60 }]);
    });
  });

  describe("avg(DISTINCT ...)", () => {
    test("avg(DISTINCT x) on property values", () => {
      graph.addVertex("Item", { score: 10 });
      graph.addVertex("Item", { score: 20 });
      graph.addVertex("Item", { score: 10 }); // duplicate
      graph.addVertex("Item", { score: 30 });

      // avg(DISTINCT score) = (10 + 20 + 30) / 3 = 20
      const results = executeQuery(
        graph,
        "MATCH (i:Item) RETURN avg(DISTINCT i.score) AS average",
      );

      expect(results).toEqual([{ average: 20 }]);
    });
  });

  describe("min/max(DISTINCT ...)", () => {
    test("min(DISTINCT x) is same as min(x)", () => {
      graph.addVertex("Item", { value: 10 });
      graph.addVertex("Item", { value: 5 });
      graph.addVertex("Item", { value: 10 }); // duplicate
      graph.addVertex("Item", { value: 20 });

      const results = executeQuery(
        graph,
        "MATCH (i:Item) RETURN min(DISTINCT i.value) AS minVal",
      );

      expect(results).toEqual([{ minVal: 5 }]);
    });

    test("max(DISTINCT x) is same as max(x)", () => {
      graph.addVertex("Item", { value: 10 });
      graph.addVertex("Item", { value: 5 });
      graph.addVertex("Item", { value: 10 }); // duplicate
      graph.addVertex("Item", { value: 20 });

      const results = executeQuery(
        graph,
        "MATCH (i:Item) RETURN max(DISTINCT i.value) AS maxVal",
      );

      expect(results).toEqual([{ maxVal: 20 }]);
    });
  });

  describe("parsing", () => {
    test("count(DISTINCT x) parses correctly", () => {
      const ast = parse("MATCH (n:Person) RETURN count(DISTINCT n.name)");
      expect(ast.type).toBe("Query");
      if (ast.type === "Query") {
        const returnClause = ast.return;
        expect(returnClause?.items[0]?.aggregate).toBe("COUNT");
        expect(returnClause?.items[0]?.distinct).toBe(true);
        expect(returnClause?.items[0]?.variable).toBe("n");
        expect(returnClause?.items[0]?.property).toBe("name");
      }
    });

    test("collect(DISTINCT x) parses correctly", () => {
      const ast = parse("MATCH (n:Person) RETURN collect(DISTINCT n)");
      expect(ast.type).toBe("Query");
      if (ast.type === "Query") {
        const returnClause = ast.return;
        expect(returnClause?.items[0]?.aggregate).toBe("COLLECT");
        expect(returnClause?.items[0]?.distinct).toBe(true);
        expect(returnClause?.items[0]?.variable).toBe("n");
      }
    });

    test("sum(DISTINCT x.y) parses correctly", () => {
      const ast = parse("MATCH (i:Item) RETURN sum(DISTINCT i.price)");
      expect(ast.type).toBe("Query");
      if (ast.type === "Query") {
        const returnClause = ast.return;
        expect(returnClause?.items[0]?.aggregate).toBe("SUM");
        expect(returnClause?.items[0]?.distinct).toBe(true);
      }
    });

    test("aggregate without DISTINCT has distinct: undefined", () => {
      const ast = parse("MATCH (n:Person) RETURN count(n)");
      expect(ast.type).toBe("Query");
      if (ast.type === "Query") {
        const returnClause = ast.return;
        expect(returnClause?.items[0]?.aggregate).toBe("COUNT");
        expect(returnClause?.items[0]?.distinct).toBeUndefined();
      }
    });
  });
});
