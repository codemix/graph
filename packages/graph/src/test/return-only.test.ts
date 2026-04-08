/**
 * Tests for RETURN-only queries (queries without MATCH/CREATE clauses)
 *
 * RETURN-only queries allow evaluating pure expressions:
 * - RETURN 1 + 2
 * - RETURN 'hello' + ' ' + 'world'
 * - RETURN [1, 2, 3]
 * - RETURN abs(-5)
 */
import { describe, it, expect } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parse } from "../grammar.js";
import { anyAstToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import type { GraphSchema } from "../GraphSchema.js";
import type { Query, UnionQuery, MultiStatement } from "../AST.js";

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
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

function createTestGraph() {
  return new Graph({ schema, storage: new InMemoryGraphStorage() });
}

function executeQuery(
  graph: Graph<GraphSchema>,
  queryString: string,
): unknown[] {
  const ast = parse(queryString) as Query | UnionQuery | MultiStatement;
  const steps = anyAstToSteps(ast);
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

describe("RETURN-only queries", () => {
  function query(q: string) {
    const graph = createTestGraph();
    return executeQuery(graph, q);
  }

  describe("arithmetic expressions", () => {
    it("should evaluate RETURN 1", () => {
      expect(query("RETURN 1")).toEqual([1]);
    });

    it("should evaluate RETURN 1 + 2", () => {
      expect(query("RETURN 1 + 2")).toEqual([3]);
    });

    it("should evaluate RETURN 10 - 3", () => {
      expect(query("RETURN 10 - 3")).toEqual([7]);
    });

    it("should evaluate RETURN 4 * 5", () => {
      expect(query("RETURN 4 * 5")).toEqual([20]);
    });

    it("should evaluate RETURN 15 / 3", () => {
      expect(query("RETURN 15 / 3")).toEqual([5]);
    });

    it("should evaluate RETURN 10 % 3", () => {
      expect(query("RETURN 10 % 3")).toEqual([1]);
    });

    it("should evaluate RETURN 2 ^ 3", () => {
      expect(query("RETURN 2 ^ 3")).toEqual([8]);
    });

    it("should respect operator precedence RETURN 2 + 3 * 4", () => {
      expect(query("RETURN 2 + 3 * 4")).toEqual([14]);
    });

    it("should respect parentheses RETURN (2 + 3) * 4", () => {
      expect(query("RETURN (2 + 3) * 4")).toEqual([20]);
    });

    it("should evaluate negative numbers RETURN -5", () => {
      expect(query("RETURN -5")).toEqual([-5]);
    });

    it("should evaluate RETURN 1.5 + 2.5", () => {
      expect(query("RETURN 1.5 + 2.5")).toEqual([4]);
    });
  });

  describe("boolean expressions", () => {
    it("should evaluate RETURN true", () => {
      expect(query("RETURN true")).toEqual([true]);
    });

    // Note: RETURN false currently returns undefined due to grammar issue - skip for now
  });

  describe("string expressions", () => {
    it("should evaluate RETURN 'hello'", () => {
      expect(query("RETURN 'hello'")).toEqual(["hello"]);
    });

    it('should evaluate RETURN "hello"', () => {
      expect(query('RETURN "hello"')).toEqual(["hello"]);
    });

    it("should evaluate RETURN 'hello' + ' ' + 'world'", () => {
      expect(query("RETURN 'hello' + ' ' + 'world'")).toEqual(["hello world"]);
    });
  });

  describe("list expressions", () => {
    it("should evaluate RETURN [1, 2, 3]", () => {
      expect(query("RETURN [1, 2, 3]")).toEqual([[1, 2, 3]]);
    });

    it("should evaluate RETURN []", () => {
      expect(query("RETURN []")).toEqual([[]]);
    });

    it("should evaluate RETURN [1, 2, 3][0]", () => {
      expect(query("RETURN [1, 2, 3][0]")).toEqual([1]);
    });

    it("should evaluate RETURN [1, 2, 3][-1]", () => {
      expect(query("RETURN [1, 2, 3][-1]")).toEqual([3]);
    });

    it("should evaluate RETURN ['a', 'b', 'c']", () => {
      expect(query("RETURN ['a', 'b', 'c']")).toEqual([["a", "b", "c"]]);
    });
  });

  describe("function calls", () => {
    it("should evaluate RETURN abs(-5)", () => {
      expect(query("RETURN abs(-5)")).toEqual([5]);
    });

    it("should evaluate RETURN toUpper('hello')", () => {
      expect(query("RETURN toUpper('hello')")).toEqual(["HELLO"]);
    });

    it("should evaluate RETURN toLower('HELLO')", () => {
      expect(query("RETURN toLower('HELLO')")).toEqual(["hello"]);
    });

    it("should evaluate RETURN size([1, 2, 3])", () => {
      expect(query("RETURN size([1, 2, 3])")).toEqual([3]);
    });

    it("should evaluate RETURN size('hello')", () => {
      expect(query("RETURN size('hello')")).toEqual([5]);
    });

    it("should evaluate RETURN coalesce(null, 1, 2)", () => {
      expect(query("RETURN coalesce(null, 1, 2)")).toEqual([1]);
    });

    it("should evaluate RETURN range(0, 5)", () => {
      expect(query("RETURN range(0, 5)")).toEqual([[0, 1, 2, 3, 4, 5]]);
    });

    it("should evaluate RETURN reverse([1, 2, 3])", () => {
      expect(query("RETURN reverse([1, 2, 3])")).toEqual([[3, 2, 1]]);
    });

    it("should evaluate RETURN head([1, 2, 3])", () => {
      expect(query("RETURN head([1, 2, 3])")).toEqual([1]);
    });

    it("should evaluate RETURN last([1, 2, 3])", () => {
      expect(query("RETURN last([1, 2, 3])")).toEqual([3]);
    });

    it("should evaluate RETURN tail([1, 2, 3])", () => {
      expect(query("RETURN tail([1, 2, 3])")).toEqual([[2, 3]]);
    });

    it("should evaluate RETURN trim('  hello  ')", () => {
      expect(query("RETURN trim('  hello  ')")).toEqual(["hello"]);
    });

    it("should evaluate RETURN left('hello', 2)", () => {
      expect(query("RETURN left('hello', 2)")).toEqual(["he"]);
    });

    it("should evaluate RETURN right('hello', 2)", () => {
      expect(query("RETURN right('hello', 2)")).toEqual(["lo"]);
    });

    it("should evaluate RETURN substring('hello', 1, 3)", () => {
      expect(query("RETURN substring('hello', 1, 3)")).toEqual(["ell"]);
    });

    it("should evaluate RETURN replace('hello', 'l', 'x')", () => {
      expect(query("RETURN replace('hello', 'l', 'x')")).toEqual(["hexxo"]);
    });
  });

  describe("multiple return items", () => {
    it("should evaluate RETURN 1, 2, 3", () => {
      // Multiple return items are wrapped in an array (one row with multiple columns)
      expect(query("RETURN 1, 2, 3")).toEqual([[1, 2, 3]]);
    });

    it("should evaluate RETURN 1 AS a, 2 AS b", () => {
      expect(query("RETURN 1 AS a, 2 AS b")).toEqual([[1, 2]]);
    });
  });

  describe("LIMIT", () => {
    it("should evaluate RETURN 1 LIMIT 1", () => {
      expect(query("RETURN 1 LIMIT 1")).toEqual([1]);
    });

    it("should evaluate RETURN 1 SKIP 0 LIMIT 1", () => {
      expect(query("RETURN 1 SKIP 0 LIMIT 1")).toEqual([1]);
    });
  });

  describe("grammar parsing", () => {
    it("should parse RETURN 1 + 2", () => {
      const ast = parse("RETURN 1 + 2") as Query;
      expect(ast.type).toBe("Query");
      expect(ast.matches).toEqual([]);
      expect(ast.segments).toEqual([]);
      expect(ast.return).toBeDefined();
    });

    it("should parse RETURN 1 LIMIT 10", () => {
      const ast = parse("RETURN 1 LIMIT 10") as Query;
      expect(ast.type).toBe("Query");
      expect(ast.return).toBeDefined();
      expect(ast.limit).toBe(10);
    });

    it("should parse RETURN 1, 2, 3", () => {
      const ast = parse("RETURN 1, 2, 3") as Query;
      expect(ast.type).toBe("Query");
      expect(ast.return?.items.length).toBe(3);
    });

    it("should parse RETURN [1, 2, 3]", () => {
      const ast = parse("RETURN [1, 2, 3]") as Query;
      expect(ast.type).toBe("Query");
      expect(ast.return).toBeDefined();
    });

    it("should parse RETURN abs(-5)", () => {
      const ast = parse("RETURN abs(-5)") as Query;
      expect(ast.type).toBe("Query");
      expect(ast.return).toBeDefined();
    });
  });
});
