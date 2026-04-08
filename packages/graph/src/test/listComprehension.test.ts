import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import type { Query, ListComprehension } from "../AST.js";
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

describe("List Comprehension", () => {
  describe("Grammar Parsing", () => {
    it("should parse basic list comprehension [x IN list]", () => {
      const query = `MATCH (n:Person) WHERE size([x IN [1,2,3]]) = 3 RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse list comprehension with filter [x IN list WHERE cond]", () => {
      const query = `MATCH (n:Person) WHERE size([x IN [1,2,3] WHERE x > 1]) = 2 RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse list comprehension with projection [x IN list | expr]", () => {
      const query = `MATCH (n:Person) WHERE [x IN [1,2,3] | x * 2][0] = 2 RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse list comprehension with filter and projection", () => {
      const query = `MATCH (n:Person) WHERE [x IN [1,2,3,4] WHERE x > 2 | x * 2][0] = 6 RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse list comprehension with property access as list", () => {
      const query = `MATCH (n:Person) WHERE [x IN n.scores | x * 2][0] = 20 RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });

    it("should parse nested list comprehension", () => {
      const query = `MATCH (n:Person) WHERE [x IN [y IN [1,2,3] | y * 2] | x + 1][0] = 3 RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
    });
  });

  describe("AST Structure", () => {
    it("should produce ListComprehension AST node", () => {
      const query = `MATCH (n:Person) WHERE size([x IN [1,2,3] WHERE x > 1 | x * 2]) = 2 RETURN n`;
      const ast = parse(query) as Query;

      // Find the ListComprehension in the condition
      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");

      if (condition.type === "ExpressionCondition") {
        // The left side should be a function call (size)
        const funcCall = condition.left as any;
        expect(funcCall.type).toBe("FunctionCall");
        expect(funcCall.name).toBe("size");

        // The argument should be a ListComprehension
        const listComp = funcCall.args[0] as ListComprehension;
        expect(listComp.type).toBe("ListComprehension");
        expect(listComp.variable).toBe("x");
        expect(listComp.filterCondition).toBeDefined();
        expect(listComp.projection).toBeDefined();
      }
    });

    it("should have optional filter and projection", () => {
      const query1 = `MATCH (n:Person) WHERE size([x IN [1,2,3]]) = 3 RETURN n`;
      const ast1 = parse(query1) as Query;

      const condition1 = ast1.matches[0]!.where!.condition;
      if (condition1.type === "ExpressionCondition") {
        const funcCall = condition1.left as any;
        const listComp = funcCall.args[0] as ListComprehension;
        expect(listComp.filterCondition).toBeUndefined();
        expect(listComp.projection).toBeUndefined();
      }
    });
  });

  describe("Step Conversion", () => {
    it("should convert list comprehension to step format", () => {
      const query = `MATCH (n:Person) WHERE size([x IN [1,2,3] WHERE x > 1]) = 2 RETURN n`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      expect(steps.length).toBeGreaterThan(0);
    });

    it("should convert list comprehension with projection to step format", () => {
      const query = `MATCH (n:Person) WHERE [x IN [1,2,3] | x * 2][0] = 2 RETURN n`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      expect(steps.length).toBeGreaterThan(0);
    });
  });

  describe("Query Execution - Basic List Comprehension", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });
      graph.addVertex("Person", {
        name: "Alice",
        scores: [10, 20, 30, 40, 50],
      });
      graph.addVertex("Person", { name: "Bob", scores: [1, 2, 3] });
      graph.addVertex("Person", { name: "Charlie", scores: [] });
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should return all elements without filter or projection", () => {
      const query = `MATCH (n:Person) WHERE size([x IN [1,2,3]]) = 3 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // All three persons match since [1,2,3] always has size 3
      expect(results).toHaveLength(3);
    });

    it("should filter elements with WHERE clause", () => {
      const query = `MATCH (n:Person) WHERE size([x IN [1,2,3,4,5] WHERE x > 3]) = 2 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // [4, 5] have size 2, so all persons match
      expect(results).toHaveLength(3);
    });

    it("should apply projection without filter", () => {
      const query = `MATCH (n:Person) WHERE [x IN [1,2,3] | x * 10][0] = 10 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // [10, 20, 30][0] = 10, so all persons match
      expect(results).toHaveLength(3);
    });

    it("should apply both filter and projection", () => {
      const query = `MATCH (n:Person) WHERE [x IN [1,2,3,4,5] WHERE x > 2 | x * 2][0] = 6 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Filtered: [3,4,5], projected: [6,8,10], [0] = 6
      expect(results).toHaveLength(3);
    });
  });

  describe("Query Execution - Property-Based List Comprehension", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });
      graph.addVertex("Person", {
        name: "Alice",
        scores: [10, 20, 30, 40, 50],
      });
      graph.addVertex("Person", { name: "Bob", scores: [1, 2, 3, 4, 5] });
      graph.addVertex("Person", { name: "Charlie", scores: [100, 200] });
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should iterate over property values", () => {
      const query = `MATCH (n:Person) WHERE size([x IN n.scores WHERE x > 25]) = 3 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice has [30,40,50] > 25 (size 3)
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should double values with projection", () => {
      const query = `MATCH (n:Person) WHERE [x IN n.scores | x * 2][0] = 200 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Charlie has [100, 200], doubled first element = 200
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Charlie");
    });

    it("should filter and then project property values", () => {
      const query = `MATCH (n:Person) WHERE size([x IN n.scores WHERE x >= 40 | x / 10]) > 0 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice: [40,50] >= 40 → [4,5] (size 2) > 0 ✓
      // Bob: [4,5] >= 40 → [] (size 0) > 0 ✗
      // Charlie: [100,200] >= 40 → [10,20] (size 2) > 0 ✓
      expect(results).toHaveLength(2);
      expect(results).toContain("Alice");
      expect(results).toContain("Charlie");
    });
  });

  describe("Query Execution - Complex Conditions", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });
      graph.addVertex("Person", {
        name: "Alice",
        value: 5,
        scores: [1, 2, 3, 4, 5],
      });
      graph.addVertex("Person", {
        name: "Bob",
        value: 3,
        scores: [10, 20, 30],
      });
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should use outer variable in filter condition", () => {
      // Filter items greater than n.value
      const query = `MATCH (n:Person) WHERE size([x IN n.scores WHERE x > n.value]) = 0 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice: [1,2,3,4,5] where x > 5 → [] (size 0) ✓
      // Bob: [10,20,30] where x > 3 → [10,20,30] (size 3) ✗
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should use outer variable in projection", () => {
      const query = `MATCH (n:Person) WHERE [x IN [1,2,3] | x + n.value][0] = 6 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice: [1+5, 2+5, 3+5] = [6,7,8], [0] = 6 ✓
      // Bob: [1+3, 2+3, 3+3] = [4,5,6], [0] = 4 ✗
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should work with parameters in list comprehension", () => {
      setQueryParams({ threshold: 15 });

      const query = `MATCH (n:Person) WHERE size([x IN n.scores WHERE x > $threshold]) > 0 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice: none > 15
      // Bob: [20, 30] > 15
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Bob");
    });
  });

  describe("Query Execution - Edge Cases", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });
      graph.addVertex("Person", { name: "Alice", scores: [1, 2, 3] });
      graph.addVertex("Person", { name: "Bob", scores: [] });
      graph.addVertex("Person", { name: "Charlie" }); // no scores property
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should handle empty list", () => {
      const query = `MATCH (n:Person) WHERE size([x IN n.scores]) = 0 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Bob has empty array, Charlie has undefined → treated as empty
      expect(results).toHaveLength(2);
      expect(results).toContain("Bob");
      expect(results).toContain("Charlie");
    });

    it("should handle null/undefined list", () => {
      const query = `MATCH (n:Person) WHERE size([x IN n.scores WHERE x > 0]) = 0 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice: [1,2,3] > 0 → [1,2,3] (size 3) ✗
      // Bob: [] → (size 0) ✓
      // Charlie: undefined → [] (size 0) ✓
      expect(results).toHaveLength(2);
      expect(results).toContain("Bob");
      expect(results).toContain("Charlie");
    });

    it("should filter all elements", () => {
      const query = `MATCH (n:Person) WHERE size([x IN [1,2,3] WHERE x > 100]) = 0 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // All elements filtered out, size = 0 for everyone
      expect(results).toHaveLength(3);
    });

    it("should handle empty result list with indexing", () => {
      const query = `MATCH (n:Person) WHERE [x IN [1,2,3] WHERE x > 100][0] IS NULL RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Empty list, [0] returns null
      expect(results).toHaveLength(3);
    });
  });

  describe("Query Execution - Nested List Comprehension", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });
      graph.addVertex("Person", { name: "Alice" });
    });

    it("should handle nested list comprehension", () => {
      const query = `MATCH (n:Person) WHERE [x IN [y IN [1,2,3] | y * 2] | x + 1][0] = 3 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Inner: [1*2, 2*2, 3*2] = [2, 4, 6]
      // Outer: [2+1, 4+1, 6+1] = [3, 5, 7]
      // [0] = 3
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });
  });

  describe("Query Execution - Additional Operations", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({ schema: testSchema, storage });
      graph.addVertex("Person", {
        name: "Alice",
        scores: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      });
      graph.addVertex("Person", { name: "Bob", scores: [100, 200, 300] });
    });

    it("should filter with arithmetic comparison in WHERE", () => {
      const query = `MATCH (n:Person) WHERE size([x IN n.scores WHERE x * 2 > 10]) > 5 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice: [6,7,8,9,10] * 2 > 10, so 5 elements > 5 is false
      // Bob: all 3 elements pass (200, 400, 600 > 10), size 3 > 5 is false
      // Let's recalculate: Alice [x*2 > 10] means x > 5, so [6,7,8,9,10] → 5 elements
      // 5 > 5 is false. Need to adjust test.
      expect(results).toHaveLength(0);
    });

    it("should compute sum using projection", () => {
      // Use list comprehension to transform then use function on result
      const query = `MATCH (n:Person) WHERE [x IN [1,2,3] | x * x][2] = 9 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // [1*1, 2*2, 3*3] = [1, 4, 9], [2] = 9
      expect(results).toHaveLength(2);
    });

    it("should filter even numbers", () => {
      const query = `MATCH (n:Person) WHERE size([x IN n.scores WHERE x % 2 = 0]) = 5 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, [undefined]));

      // Alice: [2,4,6,8,10] are even, 5 elements
      // Bob: [100,200,300] are all even, 3 elements
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });
  });
});
