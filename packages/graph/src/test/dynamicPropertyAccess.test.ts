import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import type { Query, DynamicPropertyAccess, ExpressionCondition } from "../AST.js";
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
        email: { type: makeType(undefined as string | undefined) },
        age: { type: makeType(undefined as number | undefined) },
        metadata: {
          type: makeType(undefined as Record<string, unknown> | undefined),
        },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

describe("Dynamic Property Access", () => {
  describe("Grammar Parsing", () => {
    it("should parse dynamic property access with string literal", () => {
      const query = `MATCH (n:Person) WHERE n['name'] = 'Alice' RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");
      if (condition.type === "ExpressionCondition") {
        expect((condition.left as DynamicPropertyAccess).type).toBe("DynamicPropertyAccess");
        const dynamicAccess = condition.left as DynamicPropertyAccess;
        expect((dynamicAccess.object as any).type).toBe("VariableRef");
        expect((dynamicAccess.object as any).variable).toBe("n");
        expect(dynamicAccess.property).toBe("name");
      }
    });

    it("should parse chained dynamic property access", () => {
      const query = `MATCH (n:Person) WHERE n['a']['b'] = 'value' RETURN n`;
      const ast = parse(query) as Query;

      expect(ast.matches[0]!.where).toBeDefined();
      const condition = ast.matches[0]!.where!.condition as ExpressionCondition;
      const outerAccess = condition.left as DynamicPropertyAccess;
      expect(outerAccess.type).toBe("DynamicPropertyAccess");
      expect(outerAccess.property).toBe("b");

      const innerAccess = outerAccess.object as DynamicPropertyAccess;
      expect(innerAccess.type).toBe("DynamicPropertyAccess");
      expect(innerAccess.property).toBe("a");
    });

    it("should parse double-quoted string keys", () => {
      const query = `MATCH (n:Person) WHERE n["name"] = 'Alice' RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition as ExpressionCondition;
      const dynamicAccess = condition.left as DynamicPropertyAccess;
      expect(dynamicAccess.type).toBe("DynamicPropertyAccess");
      expect(dynamicAccess.property).toBe("name");
    });

    it("should parse property name with spaces when quoted", () => {
      const query = `MATCH (n:Person) WHERE n['full name'] = 'Alice Smith' RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition as ExpressionCondition;
      const dynamicAccess = condition.left as DynamicPropertyAccess;
      expect(dynamicAccess.type).toBe("DynamicPropertyAccess");
      expect(dynamicAccess.property).toBe("full name");
    });

    it("should parse property name with special characters when quoted", () => {
      const query = `MATCH (n:Person) WHERE n['prop-with-dashes'] = 'value' RETURN n`;
      const ast = parse(query) as Query;

      const condition = ast.matches[0]!.where!.condition as ExpressionCondition;
      const dynamicAccess = condition.left as DynamicPropertyAccess;
      expect(dynamicAccess.property).toBe("prop-with-dashes");
    });
  });

  describe("AST to Steps Conversion", () => {
    it("should convert DynamicPropertyAccess to step format", () => {
      const query = `MATCH (n:Person) WHERE n['name'] = 'Alice' RETURN n`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      expect(steps).toBeDefined();
      expect(steps.length).toBeGreaterThan(0);
      // Find the step with condition config (filter step)
      const filterStep = steps.find((s) => s.config && "condition" in s.config);
      expect(filterStep).toBeDefined();
      if (filterStep) {
        const condition = filterStep.config.condition as any;
        expect(condition).toBeDefined();
        // The condition should be an expression condition
        expect(condition[0]).toBe("expr");
        const leftExpr = condition[2];
        expect(leftExpr.type).toBe("dynamicPropertyAccess");
      }
    });
  });

  describe("Query Execution", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      graph = new Graph({
        schema: testSchema,
        storage: new InMemoryGraphStorage(),
      });

      // Add test data
      graph.addVertex("Person", {
        name: "Alice",
        email: "alice@test.com",
        age: 30,
      });
      graph.addVertex("Person", {
        name: "Bob",
        email: "bob@test.com",
        age: 25,
      });
      graph.addVertex("Person", {
        name: "Charlie",
        email: "charlie@test.com",
        age: 35,
      });
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should filter using dynamic property access", () => {
      const query = `MATCH (n:Person) WHERE n['name'] = 'Alice' RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should filter using dynamic property access with double quotes", () => {
      const query = `MATCH (n:Person) WHERE n["email"] = 'bob@test.com' RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Bob");
    });

    it("should compare numeric values with dynamic property access", () => {
      const query = `MATCH (n:Person) WHERE n['age'] > 28 RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined])) as string[];
      expect(results).toHaveLength(2);
      expect(results.sort()).toEqual(["Alice", "Charlie"]);
    });

    it("should return null for non-existent property", () => {
      const query = `MATCH (n:Person) WHERE n['nonexistent'] IS NULL RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));
      // All should match since 'nonexistent' property doesn't exist
      expect(results).toHaveLength(3);
    });

    it("should work with parameterized property names", () => {
      setQueryParams({ prop: "name", val: "Charlie" });
      // When index is a parameter, it uses ListIndexExpression which falls back to dynamic access
      const query = `MATCH (n:Person) WHERE n['name'] = $val RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Charlie");
    });

    it("should combine static and dynamic property access", () => {
      const query = `MATCH (n:Person) WHERE n.age > 25 AND n['name'] = 'Alice' RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should work in complex conditions with OR", () => {
      const query = `MATCH (n:Person) WHERE n['name'] = 'Alice' OR n['name'] = 'Bob' RETURN n.name`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined])) as string[];
      expect(results).toHaveLength(2);
      expect(results.sort()).toEqual(["Alice", "Bob"]);
    });
  });

  describe("Edge Cases", () => {
    let graph: Graph<typeof testSchema>;

    beforeEach(() => {
      graph = new Graph({
        schema: testSchema,
        storage: new InMemoryGraphStorage(),
      });
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should handle empty string as property name", () => {
      const query = `MATCH (n:Person) WHERE n[''] IS NULL RETURN n`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      graph.addVertex("Person", { name: "Test" });
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));
      // Empty property name should return null, so IS NULL should match
      expect(results).toHaveLength(1);
    });

    it("should handle reserved words as property names", () => {
      // Reserved words like 'type', 'match', 'where' can be used as property names when quoted
      const query = `MATCH (n:Person) WHERE n['type'] IS NULL RETURN n`;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      graph.addVertex("Person", { name: "Test" });
      const traverser = createTraverser(steps);

      const results = Array.from(traverser.traverse(graph, [undefined]));
      expect(results).toHaveLength(1);
    });

    it("should distinguish between list indexing and property access", () => {
      // Numeric index -> list indexing
      const listQuery = `MATCH (n:Person) WHERE n.items[0] = 'first' RETURN n`;
      const listAst = parse(listQuery) as Query;
      const listCondition = listAst.matches[0]!.where!.condition as ExpressionCondition;
      expect((listCondition.left as any).type).toBe("ListIndexExpression");

      // String key -> dynamic property access
      const propQuery = `MATCH (n:Person) WHERE n['items'] = 'value' RETURN n`;
      const propAst = parse(propQuery) as Query;
      const propCondition = propAst.matches[0]!.where!.condition as ExpressionCondition;
      expect((propCondition.left as any).type).toBe("DynamicPropertyAccess");
    });
  });
});
