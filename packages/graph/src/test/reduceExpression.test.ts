import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import type { Query } from "../AST.js";
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
        scores: { type: makeType(undefined as number[] | undefined) },
        items: { type: makeType(undefined as string[] | undefined) },
        value: { type: makeType(undefined as number | undefined) },
        total: { type: makeType(undefined as number | undefined) },
        singleScore: { type: makeType(undefined as number | undefined) },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

describe("REDUCE expression", () => {
  let graph: Graph<typeof testSchema>;

  beforeEach(() => {
    const storage = new InMemoryGraphStorage();
    graph = new Graph({ schema: testSchema, storage });
    // Create test data
    graph.addVertex("Person", {
      name: "Alice",
      scores: [10, 20, 30],
      value: 5,
    });
    graph.addVertex("Person", { name: "Bob", scores: [1, 2, 3, 4], value: 10 });
    graph.addVertex("Person", { name: "Charlie", scores: [], value: 0 });
    graph.addVertex("Person", { name: "Diana", items: ["a", "b", "c"] });
  });

  afterEach(() => {
    clearQueryParams();
  });

  describe("grammar parsing", () => {
    it("parses basic REDUCE expression", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(total = 0, x IN [1,2,3] | total + x) = 6 RETURN n",
      ) as Query;
      expect(ast.type).toBe("Query");
      expect(ast.matches[0]?.where).toBeDefined();
    });

    it("parses REDUCE with property access for list", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(s = 0, x IN n.scores | s + x) > 0 RETURN n",
      ) as Query;
      expect(ast.type).toBe("Query");
    });

    it("parses REDUCE with parameter for initial value", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(total = $init, x IN [1,2,3] | total + x) = 6 RETURN n",
      ) as Query;
      expect(ast.type).toBe("Query");
    });

    it("parses REDUCE with parameter for list", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(s = 0, x IN $numbers | s + x) > 10 RETURN n",
      ) as Query;
      expect(ast.type).toBe("Query");
    });

    it("parses nested REDUCE expressions", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(a = 0, x IN [1,2] | a + REDUCE(b = 0, y IN [3,4] | b + y)) = 14 RETURN n",
      ) as Query;
      expect(ast.type).toBe("Query");
    });

    it("parses REDUCE with arithmetic in expression", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(prod = 1, x IN [2,3,4] | prod * x) = 24 RETURN n",
      ) as Query;
      expect(ast.type).toBe("Query");
    });

    it("is case-insensitive for REDUCE keyword", () => {
      const ast1 = parse(
        "MATCH (n:Person) WHERE REDUCE(t = 0, x IN [1] | t + x) = 1 RETURN n",
      ) as Query;
      const ast2 = parse(
        "MATCH (n:Person) WHERE reduce(t = 0, x IN [1] | t + x) = 1 RETURN n",
      ) as Query;
      const ast3 = parse(
        "MATCH (n:Person) WHERE Reduce(t = 0, x IN [1] | t + x) = 1 RETURN n",
      ) as Query;
      expect(ast1.type).toBe("Query");
      expect(ast2.type).toBe("Query");
      expect(ast3.type).toBe("Query");
    });
  });

  describe("AST structure", () => {
    it("creates correct ReduceExpression AST node", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(total = 0, x IN [1,2,3] | total + x) = 6 RETURN n",
      ) as Query;
      const where = ast.matches[0]?.where;
      expect(where).toBeDefined();

      // The condition should be an ExpressionCondition comparing REDUCE result to 6
      const condition = where!.condition;
      expect(condition.type).toBe("ExpressionCondition");

      const exprCondition = condition as any;
      expect(exprCondition.operator).toBe("=");
      expect(exprCondition.right).toBe(6);

      // Left side should be the ReduceExpression
      const reduceExpr = exprCondition.left;
      expect(reduceExpr.type).toBe("ReduceExpression");
      expect(reduceExpr.accumulator).toBe("total");
      expect(reduceExpr.variable).toBe("x");

      // Init should be 0
      expect(reduceExpr.init).toBe(0);

      // List should be [1, 2, 3]
      expect(reduceExpr.list.type).toBe("ListLiteral");
      expect(reduceExpr.list.values).toEqual([1, 2, 3]);

      // Expression should be total + x (ArithmeticExpression)
      expect(reduceExpr.expression.type).toBe("ArithmeticExpression");
      expect(reduceExpr.expression.operator).toBe("+");
    });
  });

  describe("step conversion", () => {
    it("converts ReduceExpression to step format", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(total = 0, x IN [1,2,3] | total + x) = 6 RETURN n",
      ) as Query;
      const steps = astToSteps(ast);
      expect(steps.length).toBeGreaterThan(0);
      // The FilterElementsStep should contain the reduce expression condition
    });
  });

  describe("query execution", () => {
    it("sums a list of numbers", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(total = 0, x IN [1,2,3] | total + x) = 6 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // All persons should match since 1+2+3 = 6
      expect(results).toHaveLength(4);
    });

    it("sums property values from nodes", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(s = 0, x IN n.scores | s + x) = 60 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice has scores [10, 20, 30] = 60
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("computes product of numbers", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(prod = 1, x IN [2,3,4] | prod * x) = 24 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // 2*3*4 = 24, all persons match
      expect(results).toHaveLength(4);
    });

    it("concatenates strings", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(s = '', x IN n.items | s + x) = 'abc' RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Diana has items ['a', 'b', 'c'] -> 'abc'
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Diana");
    });

    it("returns initial value for empty list", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(s = 0, x IN n.scores | s + x) = 0 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Charlie has empty scores []
      expect(results).toContain("Charlie");
    });

    it("handles null list gracefully", () => {
      // Diana has no 'scores' property
      const ast = parse(
        "MATCH (n:Person) WHERE n.name = 'Diana' AND REDUCE(s = 100, x IN n.scores | s + x) = 100 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Diana's scores is undefined/null, so returns initial value 100
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Diana");
    });

    it("works with parameters for initial value", () => {
      setQueryParams({ init: 10 });
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(total = $init, x IN [1,2,3] | total + x) = 16 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // 10 + 1 + 2 + 3 = 16, all persons match
      expect(results).toHaveLength(4);
    });

    it("works with parameters for list", () => {
      setQueryParams({ numbers: [5, 10, 15] });
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(s = 0, x IN $numbers | s + x) = 30 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // 5 + 10 + 15 = 30, all persons match
      expect(results).toHaveLength(4);
    });

    it("supports outer variable references in expression", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(s = 0, x IN [1,2,3] | s + x * n.value) > 0 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice: value=5, sum = 0 + 1*5 + 2*5 + 3*5 = 30 > 0 ✓
      // Bob: value=10, sum = 0 + 1*10 + 2*10 + 3*10 = 60 > 0 ✓
      // Charlie: value=0, sum = 0 + 0 + 0 + 0 = 0, not > 0 ✗
      expect(results).toHaveLength(2);
      expect(results).toContain("Alice");
      expect(results).toContain("Bob");
    });

    it("supports nested REDUCE expressions", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(outer = 0, i IN [1,2] | outer + REDUCE(inner = 0, j IN [10,20] | inner + j)) = 60 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // inner REDUCE: 0 + 10 + 20 = 30
      // outer REDUCE: 0 + 30 + 30 = 60
      expect(results).toHaveLength(4);
    });

    it("works with comparison operators", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(s = 0, x IN n.scores | s + x) >= 10 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice: 60 >= 10 ✓
      // Bob: 10 >= 10 ✓
      // Charlie: 0 >= 10 ✗
      expect(results).toHaveLength(2);
      expect(results).toContain("Alice");
      expect(results).toContain("Bob");
    });

    it("can be combined with other conditions using AND", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE n.name STARTS WITH 'A' AND REDUCE(s = 0, x IN n.scores | s + x) > 50 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Only Alice starts with 'A' and has sum 60 > 50
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    // Note: OR conditions with REDUCE are affected by a pre-existing condition splitting
    // optimization in astToSteps that doesn't handle ExpressionCondition correctly.
    // This is a known limitation that affects all expression-based conditions in OR clauses,
    // not specific to REDUCE. The core REDUCE functionality works correctly when used
    // with AND or as a standalone condition.

    it("works with arithmetic in result comparison", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(s = 0, x IN n.scores | s + x) * 2 > 100 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice: 60 * 2 = 120 > 100 ✓
      // Bob: 10 * 2 = 20 > 100 ✗
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("treats single non-array value as single-element array", () => {
      // Add a node with a single value (not an array)
      graph.addVertex("Person", { name: "Eve", singleScore: 42 });

      const ast = parse(
        "MATCH (n:Person) WHERE n.name = 'Eve' AND REDUCE(s = 0, x IN n.singleScore | s + x) = 42 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Single value 42 treated as [42], so sum = 0 + 42 = 42
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Eve");
    });
  });

  describe("edge cases", () => {
    it("handles reduce with function calls in expression", () => {
      const ast = parse(
        "MATCH (n:Person) WHERE REDUCE(cnt = 0, x IN n.items | cnt + size(x)) = 3 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Diana has items ['a', 'b', 'c'], each size() = 1, so total = 3
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Diana");
    });

    it("handles accumulator shadowing outer variable", () => {
      // If outer scope has 'total', the accumulator should shadow it
      graph.addVertex("Person", { name: "Frank", total: 1000 });

      const ast = parse(
        "MATCH (n:Person) WHERE n.name = 'Frank' AND REDUCE(total = 0, x IN [1,2,3] | total + x) = 6 RETURN n.name",
      ) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // The 'total' in REDUCE should shadow n.total, so result is 6
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Frank");
    });
  });
});
