import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import type { Query, QuantifierExpression } from "../AST.js";
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
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

describe("Quantifier Expressions", () => {
  describe("Grammar Parsing", () => {
    it("should parse ALL quantifier expression", () => {
      const query = `MATCH (n:Person) WHERE ALL(x IN [1,2,3] WHERE x > 0) RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
    });

    it("should parse ANY quantifier expression", () => {
      const query = `MATCH (n:Person) WHERE ANY(x IN [1,2,3] WHERE x > 2) RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse NONE quantifier expression", () => {
      const query = `MATCH (n:Person) WHERE NONE(x IN [1,2,3] WHERE x < 0) RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse SINGLE quantifier expression", () => {
      const query = `MATCH (n:Person) WHERE SINGLE(x IN [1,2,3] WHERE x = 2) RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse quantifier with property access as list", () => {
      const query = `MATCH (n:Person) WHERE ALL(x IN n.scores WHERE x > 0) RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse quantifier with parameter as list", () => {
      const query = `MATCH (n:Person) WHERE ANY(x IN $values WHERE x > 5) RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse quantifier in boolean expression", () => {
      const query = `MATCH (n:Person) WHERE ALL(x IN [1,2,3] WHERE x > 0) AND n.name = 'Alice' RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
      expect(ast.matches[0]!.where!.condition.type).toBe("AndCondition");
    });

    it("should parse case-insensitive quantifier keywords", () => {
      const query1 = `MATCH (n:Person) WHERE all(x IN [1,2,3] WHERE x > 0) RETURN n`;
      const query2 = `MATCH (n:Person) WHERE ANY(x IN [1,2,3] WHERE x > 0) RETURN n`;
      const query3 = `MATCH (n:Person) WHERE None(x IN [1,2,3] WHERE x < 0) RETURN n`;
      const query4 = `MATCH (n:Person) WHERE SINGLE(x IN [1,2,3] WHERE x = 2) RETURN n`;

      expect(() => parse(query1)).not.toThrow();
      expect(() => parse(query2)).not.toThrow();
      expect(() => parse(query3)).not.toThrow();
      expect(() => parse(query4)).not.toThrow();
    });
  });

  describe("AST Structure", () => {
    it("should produce QuantifierExpression AST node for ALL", () => {
      const query = `MATCH (n:Person) WHERE ALL(x IN [1,2,3] WHERE x > 0) RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");

      if (condition.type === "ExpressionCondition") {
        const quantExpr = condition.left as QuantifierExpression;
        expect(quantExpr.type).toBe("QuantifierExpression");
        expect(quantExpr.quantifier).toBe("ALL");
        expect(quantExpr.variable).toBe("x");
        expect(quantExpr.list).toBeDefined();
        expect(quantExpr.condition).toBeDefined();
      }
    });

    it("should produce QuantifierExpression AST node for ANY", () => {
      const query = `MATCH (n:Person) WHERE ANY(item IN n.items WHERE item = 'test') RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      if (condition.type === "ExpressionCondition") {
        const quantExpr = condition.left as QuantifierExpression;
        expect(quantExpr.type).toBe("QuantifierExpression");
        expect(quantExpr.quantifier).toBe("ANY");
        expect(quantExpr.variable).toBe("item");
      }
    });

    it("should produce QuantifierExpression AST node for NONE", () => {
      const query = `MATCH (n:Person) WHERE NONE(x IN [1,2,3] WHERE x < 0) RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      if (condition.type === "ExpressionCondition") {
        const quantExpr = condition.left as QuantifierExpression;
        expect(quantExpr.type).toBe("QuantifierExpression");
        expect(quantExpr.quantifier).toBe("NONE");
      }
    });

    it("should produce QuantifierExpression AST node for SINGLE", () => {
      const query = `MATCH (n:Person) WHERE SINGLE(x IN [1,2,3] WHERE x = 2) RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition;
      if (condition.type === "ExpressionCondition") {
        const quantExpr = condition.left as QuantifierExpression;
        expect(quantExpr.type).toBe("QuantifierExpression");
        expect(quantExpr.quantifier).toBe("SINGLE");
      }
    });
  });

  describe("Step Conversion", () => {
    it("should convert ALL quantifier to step condition", () => {
      const query = `MATCH (n:Person) WHERE ALL(x IN [1,2,3] WHERE x > 0) RETURN n`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      expect(steps).toBeDefined();
      expect(steps.length).toBeGreaterThan(0);
    });

    it("should convert ANY quantifier to step condition", () => {
      const query = `MATCH (n:Person) WHERE ANY(x IN n.scores WHERE x > 50) RETURN n`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      expect(steps).toBeDefined();
    });

    it("should convert NONE quantifier to step condition", () => {
      const query = `MATCH (n:Person) WHERE NONE(x IN [1,2,3] WHERE x < 0) RETURN n`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      expect(steps).toBeDefined();
    });

    it("should convert SINGLE quantifier to step condition", () => {
      const query = `MATCH (n:Person) WHERE SINGLE(x IN [1,2,3] WHERE x = 2) RETURN n`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      expect(steps).toBeDefined();
    });
  });

  describe("Query Execution", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });

      // Create test data
      graph.addVertex("Person", {
        name: "Alice",
        scores: [10, 20, 30],
        items: ["a", "b", "c"],
      });
      graph.addVertex("Person", {
        name: "Bob",
        scores: [5, -2, 15],
        items: ["x", "y"],
      });
      graph.addVertex("Person", { name: "Charlie", scores: [], items: [] });
      graph.addVertex("Person", {
        name: "Diana",
        scores: [100],
        items: ["single"],
      });
    });

    afterEach(() => {
      clearQueryParams();
    });

    describe("ALL quantifier", () => {
      it("should return true when all elements satisfy condition", () => {
        // Alice has all scores > 0
        const query = `MATCH (n:Person) WHERE ALL(x IN n.scores WHERE x > 0) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toContain("Alice");
        expect(results).toContain("Diana");
        expect(results).toContain("Charlie"); // Empty list - vacuously true
        expect(results).not.toContain("Bob"); // Bob has -2
      });

      it("should return true for empty list (vacuously true)", () => {
        const query = `MATCH (n:Person) WHERE n.name = 'Charlie' AND ALL(x IN n.scores WHERE x > 0) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toContain("Charlie");
      });

      it("should return false when any element does not satisfy condition", () => {
        const query = `MATCH (n:Person) WHERE ALL(x IN n.scores WHERE x > 10) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).not.toContain("Alice"); // Alice has 10, which is not > 10
        expect(results).toContain("Diana"); // Diana has 100
        expect(results).toContain("Charlie"); // Empty list - vacuously true
      });
    });

    describe("ANY quantifier", () => {
      it("should return true when at least one element satisfies condition", () => {
        // Bob has at least one score > 10 (15)
        const query = `MATCH (n:Person) WHERE ANY(x IN n.scores WHERE x > 10) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toContain("Alice"); // Has 20 and 30
        expect(results).toContain("Bob"); // Has 15
        expect(results).toContain("Diana"); // Has 100
        expect(results).not.toContain("Charlie"); // Empty list
      });

      it("should return false for empty list", () => {
        const query = `MATCH (n:Person) WHERE n.name = 'Charlie' AND ANY(x IN n.scores WHERE x > 0) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).not.toContain("Charlie");
      });

      it("should return false when no elements satisfy condition", () => {
        const query = `MATCH (n:Person) WHERE ANY(x IN n.scores WHERE x > 1000) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toHaveLength(0);
      });
    });

    describe("NONE quantifier", () => {
      it("should return true when no elements satisfy condition", () => {
        const query = `MATCH (n:Person) WHERE NONE(x IN n.scores WHERE x < 0) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toContain("Alice"); // No negative scores
        expect(results).toContain("Diana"); // No negative scores
        expect(results).toContain("Charlie"); // Empty list - vacuously true
        expect(results).not.toContain("Bob"); // Bob has -2
      });

      it("should return true for empty list", () => {
        const query = `MATCH (n:Person) WHERE n.name = 'Charlie' AND NONE(x IN n.scores WHERE x > 0) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toContain("Charlie");
      });

      it("should return false when any element satisfies condition", () => {
        const query = `MATCH (n:Person) WHERE NONE(x IN n.scores WHERE x > 5) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).not.toContain("Alice");
        expect(results).not.toContain("Bob");
        expect(results).not.toContain("Diana");
        expect(results).toContain("Charlie"); // Empty list
      });
    });

    describe("SINGLE quantifier", () => {
      it("should return true when exactly one element satisfies condition", () => {
        const query = `MATCH (n:Person) WHERE SINGLE(x IN n.scores WHERE x >= 100) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toContain("Diana"); // Has exactly one score >= 100
        expect(results).not.toContain("Alice");
        expect(results).not.toContain("Bob");
        expect(results).not.toContain("Charlie"); // Empty list
      });

      it("should return false for empty list", () => {
        const query = `MATCH (n:Person) WHERE n.name = 'Charlie' AND SINGLE(x IN n.scores WHERE x > 0) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).not.toContain("Charlie");
      });

      it("should return false when more than one element satisfies condition", () => {
        const query = `MATCH (n:Person) WHERE SINGLE(x IN n.scores WHERE x > 0) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).not.toContain("Alice"); // Has 3 scores > 0
        expect(results).not.toContain("Bob"); // Has 2 scores > 0
        expect(results).toContain("Diana"); // Has exactly 1 score > 0
        expect(results).not.toContain("Charlie"); // Empty list
      });

      it("should return false when no elements satisfy condition", () => {
        const query = `MATCH (n:Person) WHERE SINGLE(x IN n.scores WHERE x > 1000) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toHaveLength(0);
      });
    });

    describe("With parameters", () => {
      it("should work with parameter as list", () => {
        setQueryParams({ values: [1, 2, 3, 4, 5] });
        const query = `MATCH (n:Person) WHERE ALL(x IN $values WHERE x > 0) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results.length).toBeGreaterThan(0);
      });

      it("should work with parameter in condition", () => {
        setQueryParams({ threshold: 15 });
        const query = `MATCH (n:Person) WHERE ANY(x IN n.scores WHERE x > $threshold) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toContain("Alice"); // Has 20, 30
        expect(results).toContain("Diana"); // Has 100
        expect(results).not.toContain("Bob"); // Max is 15, not > 15
        expect(results).not.toContain("Charlie");
      });
    });

    describe("With literal lists", () => {
      it("should work with ALL on literal list", () => {
        const query = `MATCH (n:Person) WHERE ALL(x IN [1, 2, 3] WHERE x > 0) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // All people should match since the quantifier is on a literal list
        expect(results.length).toBe(4);
      });

      it("should work with SINGLE on literal list", () => {
        const query = `MATCH (n:Person) WHERE SINGLE(x IN [1, 2, 3] WHERE x = 2) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results.length).toBe(4);
      });

      it("should work with NONE on literal list that fails", () => {
        const query = `MATCH (n:Person) WHERE NONE(x IN [1, 2, 3] WHERE x > 0) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results.length).toBe(0);
      });
    });

    describe("Complex conditions", () => {
      it("should work with compound condition in quantifier", () => {
        const query = `MATCH (n:Person) WHERE ALL(x IN n.scores WHERE x > 0 AND x < 50) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toContain("Alice"); // All scores between 0 and 50
        expect(results).not.toContain("Diana"); // 100 is not < 50
        expect(results).toContain("Charlie"); // Empty - vacuously true
      });

      it("should work with OR condition in quantifier", () => {
        const query = `MATCH (n:Person) WHERE ANY(x IN n.scores WHERE x < 0 OR x > 50) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toContain("Bob"); // Has -2
        expect(results).toContain("Diana"); // Has 100
        expect(results).not.toContain("Alice"); // All between 0 and 50
        expect(results).not.toContain("Charlie"); // Empty
      });

      it("should combine quantifiers with other conditions", () => {
        const query = `MATCH (n:Person) WHERE ALL(x IN n.scores WHERE x > 0) AND n.name STARTS WITH 'A' RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toContain("Alice");
        expect(results).not.toContain("Diana"); // Doesn't start with 'A'
        expect(results).not.toContain("Charlie"); // Doesn't start with 'A'
      });
    });

    describe("Edge cases", () => {
      it("should handle null/undefined list gracefully", () => {
        graph.addVertex("Person", { name: "NoScores" }); // No scores property

        const query = `MATCH (n:Person) WHERE n.name = 'NoScores' AND ALL(x IN n.scores WHERE x > 0) RETURN n.name`;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // ALL on null list should be vacuously true
        expect(results).toContain("NoScores");
      });

      it("should handle variable accessing outer scope property", () => {
        const query = `MATCH (n:Person) WHERE ANY(x IN n.scores WHERE x > n.value) RETURN n.name`;
        const ast = parse(query) as Query;

        // Add a person with value to compare
        graph.addVertex("Person", {
          name: "Eve",
          scores: [10, 20, 30],
          value: 25,
        });

        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toContain("Eve"); // 30 > 25
      });
    });
  });
});
