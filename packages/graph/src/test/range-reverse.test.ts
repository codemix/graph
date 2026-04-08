/**
 * Tests for range() and reverse() list functions.
 *
 * These functions are used to create and manipulate lists:
 * - range(start, end) creates a list of integers from start to end (inclusive)
 * - range(start, end, step) creates a list with custom step
 * - reverse(list) reverses the order of elements in a list
 * - reverse(string) reverses a string
 */
import { test, expect, describe } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { parse } from "../grammar.js";
import { anyAstToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import type { Query, UnionQuery, MultiStatement } from "../AST.js";
import type { GraphSchema } from "../GraphSchema.js";
import { functionRegistry } from "../FunctionRegistry.js";
import { TraversalPath } from "../Traversals.js";

function makeType<T>(_defaultValue: T): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "codemix",
      validate: (value) => {
        return { value: value as T };
      },
    },
  };
}

const schema = {
  vertices: {
    A: {
      properties: {
        num: { type: makeType<number>(0) },
        name: { type: makeType<string>("") },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

function createTestGraph() {
  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  return graph;
}

function executeQuery(graph: Graph<GraphSchema>, queryString: string): unknown[] {
  const ast = parse(queryString) as Query | UnionQuery | MultiStatement;
  const steps = anyAstToSteps(ast);
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

// Create a mock TraversalPath for direct function testing
function createMockPath(): TraversalPath<any, any, any> {
  return new TraversalPath(undefined, null, []);
}

describe("range() function", () => {
  describe("direct function invocation", () => {
    test("range(0, 5) returns [0, 1, 2, 3, 4, 5]", () => {
      const result = functionRegistry.invoke({
        name: "range",
        args: [0, 5],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toEqual([0, 1, 2, 3, 4, 5]);
    });

    test("range(1, 3) returns [1, 2, 3]", () => {
      const result = functionRegistry.invoke({
        name: "range",
        args: [1, 3],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toEqual([1, 2, 3]);
    });

    test("range(0, 10, 2) returns [0, 2, 4, 6, 8, 10]", () => {
      const result = functionRegistry.invoke({
        name: "range",
        args: [0, 10, 2],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toEqual([0, 2, 4, 6, 8, 10]);
    });

    test("range(5, 0, -1) returns [5, 4, 3, 2, 1, 0]", () => {
      const result = functionRegistry.invoke({
        name: "range",
        args: [5, 0, -1],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toEqual([5, 4, 3, 2, 1, 0]);
    });

    test("range(10, -10, -3) returns [10, 7, 4, 1, -2, -5, -8]", () => {
      const result = functionRegistry.invoke({
        name: "range",
        args: [10, -10, -3],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toEqual([10, 7, 4, 1, -2, -5, -8]);
    });

    test("range(0, -1) returns [] (empty list for invalid range)", () => {
      const result = functionRegistry.invoke({
        name: "range",
        args: [0, -1],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toEqual([]);
    });

    test("range(-3, -1) returns [-3, -2, -1]", () => {
      const result = functionRegistry.invoke({
        name: "range",
        args: [-3, -1],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toEqual([-3, -2, -1]);
    });

    test("range(2, 8, 0) returns null (step cannot be 0)", () => {
      const result = functionRegistry.invoke({
        name: "range",
        args: [2, 8, 0],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toBe(null);
    });
  });

  describe("query integration via UNWIND", () => {
    test("UNWIND range(1, 3) AS x returns 3 rows", () => {
      const graph = createTestGraph();
      const results = executeQuery(graph, "UNWIND range(1, 3) AS x RETURN x");

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual([1]);
      expect(results[1]).toEqual([2]);
      expect(results[2]).toEqual([3]);
    });

    test("UNWIND range(0, 10, 2) AS x returns even numbers", () => {
      const graph = createTestGraph();
      const results = executeQuery(graph, "UNWIND range(0, 10, 2) AS x RETURN x");

      expect(results).toHaveLength(6);
      expect(results.map((r) => (r as [number])[0])).toEqual([0, 2, 4, 6, 8, 10]);
    });

    test("UNWIND range(5, 1, -1) AS x returns descending numbers", () => {
      const graph = createTestGraph();
      const results = executeQuery(graph, "UNWIND range(5, 1, -1) AS x RETURN x");

      expect(results).toHaveLength(5);
      expect(results.map((r) => (r as [number])[0])).toEqual([5, 4, 3, 2, 1]);
    });

    test("UNWIND range(0, -1) AS x returns empty (no rows)", () => {
      const graph = createTestGraph();
      const results = executeQuery(graph, "UNWIND range(0, -1) AS x RETURN x");

      expect(results).toHaveLength(0);
    });
  });
});

describe("reverse() function", () => {
  describe("direct function invocation", () => {
    test("reverse([1, 2, 3]) returns [3, 2, 1]", () => {
      const result = functionRegistry.invoke({
        name: "reverse",
        args: [[1, 2, 3]],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toEqual([3, 2, 1]);
    });

    test("reverse([]) returns []", () => {
      const result = functionRegistry.invoke({
        name: "reverse",
        args: [[]],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toEqual([]);
    });

    test("reverse(['a', 'b', 'c']) returns ['c', 'b', 'a']", () => {
      const result = functionRegistry.invoke({
        name: "reverse",
        args: [["a", "b", "c"]],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toEqual(["c", "b", "a"]);
    });

    test("reverse('hello') returns 'olleh'", () => {
      const result = functionRegistry.invoke({
        name: "reverse",
        args: ["hello"],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toBe("olleh");
    });

    test("reverse('') returns ''", () => {
      const result = functionRegistry.invoke({
        name: "reverse",
        args: [""],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toBe("");
    });

    test("reverse(null) returns null", () => {
      const result = functionRegistry.invoke({
        name: "reverse",
        args: [null],
        distinct: false,
        path: createMockPath(),
      });
      expect(result).toBe(null);
    });
  });

  describe("query integration via UNWIND", () => {
    test("UNWIND reverse([1, 2, 3]) AS x returns reversed order", () => {
      const graph = createTestGraph();
      const results = executeQuery(graph, "UNWIND reverse([1, 2, 3]) AS x RETURN x");

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual([3]);
      expect(results[1]).toEqual([2]);
      expect(results[2]).toEqual([1]);
    });

    test("UNWIND reverse(range(1, 5)) AS x combines range and reverse", () => {
      const graph = createTestGraph();
      const results = executeQuery(graph, "UNWIND reverse(range(1, 5)) AS x RETURN x");

      expect(results).toHaveLength(5);
      expect(results.map((r) => (r as [number])[0])).toEqual([5, 4, 3, 2, 1]);
    });
  });
});

describe("combined range() and reverse() operations", () => {
  test("reverse(range(0, 5)) equals range(5, 0, -1)", () => {
    const path = createMockPath();

    const reversed = functionRegistry.invoke({
      name: "reverse",
      args: [
        functionRegistry.invoke({
          name: "range",
          args: [0, 5],
          distinct: false,
          path,
        }),
      ],
      distinct: false,
      path,
    });

    const descending = functionRegistry.invoke({
      name: "range",
      args: [5, 0, -1],
      distinct: false,
      path,
    });

    expect(reversed).toEqual(descending);
  });
});
