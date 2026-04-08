import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import type {
  Query,
  ListIndexExpression,
  SliceExpression,
  ListLiteralExpr,
} from "../AST.js";
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

// Simple schema for testing
const testSchema = {
  vertices: {
    Person: {
      properties: {
        name: { type: makeType(undefined as string | undefined) },
        items: { type: makeType(undefined as unknown[] | undefined | null) },
        value: { type: makeType(undefined as number | undefined) },
        idx: { type: makeType(undefined as number | undefined) },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

describe("List Operations - Indexing and Slicing", () => {
  describe("Grammar Parsing - List Indexing", () => {
    it("should parse simple list index access as ExpressionCondition", () => {
      const query = `MATCH (n:Person) WHERE n.items[0] = 'first' RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
      const condition = ast.matches[0]!.where!.condition;
      // Property access with index is now an ExpressionCondition
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        expect((condition.left as ListIndexExpression).type).toBe(
          "ListIndexExpression",
        );
        const indexExpr = condition.left as ListIndexExpression;
        expect((indexExpr.list as any).type).toBe("PropertyAccess");
        expect(indexExpr.index).toBe(0);
      }
    });

    it("should parse list literal with index access", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3][0] = 1 RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        expect((condition.left as ListIndexExpression).type).toBe(
          "ListIndexExpression",
        );
        const indexExpr = condition.left as ListIndexExpression;
        expect((indexExpr.list as any).type).toBe("ListLiteral");
        expect(indexExpr.index).toBe(0);
      }
    });

    it("should parse negative index", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3][-1] = 3 RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        const indexExpr = condition.left as ListIndexExpression;
        expect(indexExpr.type).toBe("ListIndexExpression");
        // The -1 is parsed as UnaryExpression
        expect((indexExpr.index as any).type).toBe("UnaryExpression");
      }
    });

    it("should parse variable index", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3][n.idx] = 1 RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        const indexExpr = condition.left as ListIndexExpression;
        expect(indexExpr.type).toBe("ListIndexExpression");
        expect((indexExpr.index as any).type).toBe("PropertyAccess");
      }
    });
  });

  describe("Grammar Parsing - List Slicing", () => {
    it("should parse full slice [start..end]", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3, 4][1..3] = [2, 3] RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        const sliceExpr = condition.left as SliceExpression;
        expect(sliceExpr.type).toBe("SliceExpression");
        expect(sliceExpr.start).toBe(1);
        expect(sliceExpr.end).toBe(3);
      }
    });

    it("should parse slice from start [..end]", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3, 4][..2] = [1, 2] RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        const sliceExpr = condition.left as SliceExpression;
        expect(sliceExpr.type).toBe("SliceExpression");
        expect(sliceExpr.start).toBeUndefined();
        expect(sliceExpr.end).toBe(2);
      }
    });

    it("should parse slice to end [start..]", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3, 4][2..] = [3, 4] RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        const sliceExpr = condition.left as SliceExpression;
        expect(sliceExpr.type).toBe("SliceExpression");
        expect(sliceExpr.start).toBe(2);
        expect(sliceExpr.end).toBeUndefined();
      }
    });

    it("should parse full range slice [..]", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3][..] = [1, 2, 3] RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        const sliceExpr = condition.left as SliceExpression;
        expect(sliceExpr.type).toBe("SliceExpression");
        expect(sliceExpr.start).toBeUndefined();
        expect(sliceExpr.end).toBeUndefined();
      }
    });

    it("should parse negative indices in slices", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3, 4][-2..] = [3, 4] RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        const sliceExpr = condition.left as SliceExpression;
        expect(sliceExpr.type).toBe("SliceExpression");
        expect((sliceExpr.start as any).type).toBe("UnaryExpression");
      }
    });
  });

  describe("Grammar Parsing - Chained Operations", () => {
    it("should parse chained index operations", () => {
      const query = `MATCH (n:Person) WHERE [[1,2],[3,4]][0][1] = 2 RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        // Outer is ListIndexExpression
        expect((condition.left as ListIndexExpression).type).toBe(
          "ListIndexExpression",
        );
        const outer = condition.left as ListIndexExpression;
        expect(outer.index).toBe(1);
        // Inner is also ListIndexExpression
        expect((outer.list as any).type).toBe("ListIndexExpression");
      }
    });

    it("should parse slice then index", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3, 4][1..3][0] = 2 RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        // Outer is ListIndexExpression
        expect((condition.left as ListIndexExpression).type).toBe(
          "ListIndexExpression",
        );
        const outer = condition.left as ListIndexExpression;
        // Inner is SliceExpression
        expect((outer.list as any).type).toBe("SliceExpression");
      }
    });
  });

  describe("Grammar Parsing - List Literals in Expressions", () => {
    it("should parse list literal in condition", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3] = n.items RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        expect((condition.left as ListLiteralExpr).type).toBe("ListLiteral");
        const listLit = condition.left as ListLiteralExpr;
        expect(listLit.values).toEqual([1, 2, 3]);
      }
    });

    it("should parse list with expressions", () => {
      const query = `MATCH (n:Person) WHERE [n.value, n.value * 2, 3] = n.items RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        expect((condition.left as ListLiteralExpr).type).toBe("ListLiteral");
        const listLit = condition.left as ListLiteralExpr;
        expect((listLit.values[0] as any).type).toBe("PropertyAccess");
        expect((listLit.values[1] as any).type).toBe("ArithmeticExpression");
        expect(listLit.values[2]).toBe(3);
      }
    });
  });

  describe("Step Conversion", () => {
    it("should convert list index expression to step format", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3][0] = 1 RETURN n`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      expect(steps.length).toBeGreaterThan(0);
    });

    it("should convert slice expression to step format", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3][1..2] = [2] RETURN n`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      expect(steps.length).toBeGreaterThan(0);
    });

    it("should convert list literal expression to step format", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3] = n.items RETURN n`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      expect(steps.length).toBeGreaterThan(0);
    });
  });

  describe("Query Execution - List Indexing", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });
      graph.addVertex("Person", { name: "Alice", items: [10, 20, 30, 40, 50] });
      graph.addVertex("Person", { name: "Bob", items: [1, 2, 3] });
      graph.addVertex("Person", { name: "Charlie", items: [] });
    });

    it("should filter by first element [0]", () => {
      const query = `MATCH (n:Person) WHERE n.items[0] = 10 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should filter by last element [-1]", () => {
      const query = `MATCH (n:Person) WHERE n.items[-1] = 3 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Bob");
    });

    it("should filter by second-to-last element [-2]", () => {
      const query = `MATCH (n:Person) WHERE n.items[-2] = 40 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should return null for out-of-bounds index", () => {
      const query = `MATCH (n:Person) WHERE n.items[100] IS NULL RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(3);
    });

    it("should handle index on empty array", () => {
      const query = `MATCH (n:Person) WHERE n.items[0] IS NULL RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Single return value is not wrapped in array
      expect(results).toContain("Charlie");
    });

    it("should evaluate list literal index", () => {
      const query = `MATCH (n:Person) WHERE [100, 200, 300][1] = 200 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // All persons match since the condition is always true
      expect(results).toHaveLength(3);
    });

    it("should use parameter as index", () => {
      setQueryParams({ idx: 2 });

      const query = `MATCH (n:Person) WHERE n.items[$idx] = 30 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");

      clearQueryParams();
    });
  });

  describe("Query Execution - List Slicing", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });
      graph.addVertex("Person", { name: "Alice", items: [1, 2, 3, 4, 5] });
      graph.addVertex("Person", { name: "Bob", items: ["a", "b", "c", "d"] });
    });

    it("should slice from start to end [1..3]", () => {
      const query = `MATCH (n:Person) WHERE size(n.items[1..3]) = 2 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(2);
    });

    it("should slice from beginning [..2]", () => {
      const query = `MATCH (n:Person) WHERE n.items[..2][0] = 1 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should slice to end [3..]", () => {
      const query = `MATCH (n:Person) WHERE size(n.items[3..]) = 2 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should handle negative start index [-3..]", () => {
      const query = `MATCH (n:Person) WHERE size(n.items[-3..]) = 3 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice has 5 items, last 3 = [3,4,5]. Bob has 4 items, last 3 = [b,c,d]
      // Both have size 3 for last 3 elements
      expect(results).toHaveLength(2);
    });

    it("should handle negative end index [..-1]", () => {
      const query = `MATCH (n:Person) WHERE size(n.items[..-1]) = 4 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should return empty slice for invalid range", () => {
      const query = `MATCH (n:Person) WHERE size(n.items[5..2]) = 0 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Both match since start > end gives empty array
      expect(results).toHaveLength(2);
    });

    it("should slice list literal", () => {
      const query = `MATCH (n:Person) WHERE [10, 20, 30, 40][1..3][0] = 20 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // All match since condition is always true
      expect(results).toHaveLength(2);
    });

    it("should use parameter in slice bounds", () => {
      setQueryParams({ start: 1, end: 4 });

      const query = `MATCH (n:Person) WHERE size(n.items[$start..$end]) = 3 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(2);

      clearQueryParams();
    });
  });

  describe("Query Execution - String Indexing and Slicing", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });
      graph.addVertex("Person", { name: "Alice" });
      graph.addVertex("Person", { name: "Bob" });
    });

    it("should index into string", () => {
      const query = `MATCH (n:Person) WHERE n.name[0] = 'A' RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should slice string", () => {
      const query = `MATCH (n:Person) WHERE n.name[..3] = 'Ali' RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should get last character of string", () => {
      const query = `MATCH (n:Person) WHERE n.name[-1] = 'e' RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });
  });

  describe("Query Execution - List Literals", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });
      graph.addVertex("Person", { name: "Alice", value: 2 });
      graph.addVertex("Person", { name: "Bob", value: 5 });
    });

    it("should evaluate list literal with expressions", () => {
      const query = `MATCH (n:Person) WHERE [n.value, n.value * 2][1] = 4 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should evaluate list literal comparison", () => {
      const query = `MATCH (n:Person) WHERE [1, 2, 3] = [1, 2, 3] RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Both match since condition is always true
      expect(results).toHaveLength(2);
    });
  });

  describe("Edge Cases", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });
      graph.addVertex("Person", { name: "Alice", items: [1, 2, 3] });
      graph.addVertex("Person", { name: "Bob", items: null });
      graph.addVertex("Person", { name: "Charlie" }); // no items property
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should handle null list in index operation", () => {
      const query = `MATCH (n:Person) WHERE n.items[0] IS NULL RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Single return value is returned directly (not wrapped in array)
      expect(results).toContain("Bob");
      expect(results).toContain("Charlie");
    });

    it("should handle null list in slice operation", () => {
      const query = `MATCH (n:Person) WHERE n.items[..2] IS NULL RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Single return value is returned directly (not wrapped in array)
      expect(results).toContain("Bob");
      expect(results).toContain("Charlie");
    });

    it("should handle null parameter as index", () => {
      setQueryParams({ idx: null });

      const query = `MATCH (n:Person) WHERE n.items[$idx] IS NULL RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // All should match since null index returns null
      expect(results).toHaveLength(3);
    });

    it("should handle non-numeric index gracefully", () => {
      setQueryParams({ idx: "not a number" });

      const query = `MATCH (n:Person) WHERE n.items[$idx] IS NULL RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // All should match since NaN index returns null
      expect(results).toHaveLength(3);
    });

    it("should clamp slice indices to valid range", () => {
      const query = `MATCH (n:Person) WHERE size(n.items[-100..100]) = 3 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });
  });
});
