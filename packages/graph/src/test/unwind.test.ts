import { expect, test, describe } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, UnwindStep, setQueryParams, clearQueryParams } from "../Steps.js";
import { createDemoGraph } from "../getDemoGraph.js";
import type { Query } from "../AST.js";

const { graph } = createDemoGraph();

describe("UNWIND clause grammar parsing", () => {
  test("parses UNWIND with literal list", () => {
    const query = "UNWIND [1, 2, 3] AS x RETURN x";
    const ast = parse(query) as Query;

    expect(ast.type).toBe("Query");
    expect(ast.unwind).toHaveLength(1);

    const unwindClause = ast.unwind![0]!;
    expect(unwindClause.type).toBe("UnwindClause");
    expect(unwindClause.alias).toBe("x");
    expect(unwindClause.expression).toEqual({
      type: "ListLiteral",
      values: [1, 2, 3],
    });
  });

  test("parses UNWIND with string list", () => {
    const query = "UNWIND ['a', 'b', 'c'] AS letter RETURN letter";
    const ast = parse(query) as Query;

    expect(ast.unwind![0]!.alias).toBe("letter");
    expect(ast.unwind![0]!.expression).toEqual({
      type: "ListLiteral",
      values: ["a", "b", "c"],
    });
  });

  test("parses UNWIND with property access", () => {
    const query = "MATCH (p:Person) UNWIND p.items AS item RETURN item";
    const ast = parse(query) as Query;

    expect(ast.unwind).toHaveLength(1);
    const unwindClause = ast.unwind![0]!;
    expect(unwindClause.alias).toBe("item");
    expect(unwindClause.expression).toEqual({
      type: "PropertyAccess",
      variable: "p",
      property: "items",
    });
  });

  test("parses UNWIND with variable reference", () => {
    // Uses a variable reference (not a list literal) as the expression
    const query = "MATCH (p:Person) UNWIND p AS item RETURN item";
    const ast = parse(query) as Query;

    expect(ast.unwind).toHaveLength(1);
    const unwindClause = ast.unwind![0]!;
    expect(unwindClause.alias).toBe("item");
    expect(unwindClause.expression).toEqual({
      type: "VariableRef",
      variable: "p",
    });
  });

  test("parses UNWIND with parameter reference", () => {
    const query = "UNWIND $myList AS item RETURN item";
    const ast = parse(query) as Query;

    expect(ast.unwind).toHaveLength(1);
    const unwindClause = ast.unwind![0]!;
    expect(unwindClause.alias).toBe("item");
    expect(unwindClause.expression).toEqual({
      type: "ParameterRef",
      name: "myList",
    });
  });

  test("parses multiple UNWIND clauses", () => {
    const query = "UNWIND [1, 2] AS x UNWIND ['a', 'b'] AS y RETURN x, y";
    const ast = parse(query) as Query;

    expect(ast.unwind).toHaveLength(2);
    expect(ast.unwind![0]!.alias).toBe("x");
    expect(ast.unwind![1]!.alias).toBe("y");
  });

  test("parses UNWIND with empty list", () => {
    const query = "UNWIND [] AS x RETURN x";
    const ast = parse(query) as Query;

    expect(ast.unwind![0]!.expression).toEqual({
      type: "ListLiteral",
      values: [],
    });
  });

  test("parses UNWIND case-insensitively", () => {
    const query = "unwind [1, 2] as x RETURN x";
    const ast = parse(query) as Query;

    expect(ast.unwind).toHaveLength(1);
    expect(ast.unwind![0]!.alias).toBe("x");
  });
});

describe("UNWIND clause step conversion", () => {
  test("converts UNWIND with literal list to UnwindStep", () => {
    const query = "UNWIND [1, 2, 3] AS x RETURN x";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);

    const unwindStep = steps.find((s) => s.name === "Unwind") as UnwindStep;
    expect(unwindStep).toBeDefined();
    expect(unwindStep.config.alias).toBe("x");
    expect(unwindStep.config.expression).toEqual({
      type: "literal",
      values: [1, 2, 3],
    });
  });

  test("converts UNWIND with property access to UnwindStep", () => {
    const query = "MATCH (p:Person) UNWIND p.items AS item RETURN item";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);

    const unwindStep = steps.find((s) => s.name === "Unwind") as UnwindStep;
    expect(unwindStep).toBeDefined();
    expect(unwindStep.config.expression).toEqual({
      type: "property",
      variable: "p",
      property: "items",
    });
  });

  test("converts UNWIND with parameter to UnwindStep", () => {
    const query = "UNWIND $list AS item RETURN item";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);

    const unwindStep = steps.find((s) => s.name === "Unwind") as UnwindStep;
    expect(unwindStep).toBeDefined();
    expect(unwindStep.config.expression).toEqual({
      type: "parameter",
      name: "list",
    });
  });
});

describe("UNWIND clause execution", () => {
  test("UNWIND expands literal list to multiple rows", () => {
    const query = "UNWIND [1, 2, 3] AS x RETURN x";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results).toHaveLength(3);

    // Results are arrays from ValuesStep, extract the values
    const values = results.map((r: any) => (Array.isArray(r) ? r[0] : r));
    expect(values).toContain(1);
    expect(values).toContain(2);
    expect(values).toContain(3);
  });

  test("UNWIND with empty list produces no rows", () => {
    const query = "UNWIND [] AS x RETURN x";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results).toHaveLength(0);
  });

  test("UNWIND with string list", () => {
    const query = "UNWIND ['hello', 'world'] AS word RETURN word";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results).toHaveLength(2);

    const values = results.map((r: any) => (Array.isArray(r) ? r[0] : r));
    expect(values).toContain("hello");
    expect(values).toContain("world");
  });

  test("UNWIND with parameter", () => {
    const query = "UNWIND $names AS name RETURN name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    setQueryParams({ names: ["Alice", "Bob", "Charlie"] });
    try {
      const results = [...traverser.traverse(graph, [undefined])];
      expect(results).toHaveLength(3);

      const values = results.map((r: any) => (Array.isArray(r) ? r[0] : r));
      expect(values).toContain("Alice");
      expect(values).toContain("Bob");
      expect(values).toContain("Charlie");
    } finally {
      clearQueryParams();
    }
  });

  test("UNWIND with undefined parameter produces no rows", () => {
    const query = "UNWIND $missingList AS x RETURN x";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    clearQueryParams();
    const results = [...traverser.traverse(graph, [undefined])];
    expect(results).toHaveLength(0);
  });

  test("UNWIND multiplies rows (Cartesian effect)", () => {
    // MATCH returns 5 people, UNWIND has 3 elements -> 15 results
    const query = "MATCH (p:Person) UNWIND [1, 2, 3] AS x RETURN p, x";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    // Get person count first
    const countQuery = "MATCH (p:Person) RETURN p";
    const countAst = parse(countQuery) as Query;
    const countSteps = astToSteps(countAst);
    const countTraverser = createTraverser(countSteps);
    const personCount = [...countTraverser.traverse(graph, [undefined])].length;

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results).toHaveLength(personCount * 3);
  });

  test("UNWIND preserves path bindings from MATCH", () => {
    // Each person gets combined with each number
    const query =
      "MATCH (p:Person) WHERE p.name = 'Alice' UNWIND [10, 20] AS bonus RETURN p, bonus";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results).toHaveLength(2);

    // Both results should have Alice
    for (const result of results) {
      const arr = result as unknown[];
      expect(arr[0]).toBeDefined();
      // Check it's Alice's vertex
      const vertex = arr[0] as any;
      if (vertex && typeof vertex === "object" && "get" in vertex) {
        expect(vertex.get("name")).toBe("Alice");
      }
    }
  });

  test("multiple UNWIND creates nested Cartesian product", () => {
    // 2 x 2 = 4 combinations
    const query = "UNWIND [1, 2] AS x UNWIND ['a', 'b'] AS y RETURN x, y";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results).toHaveLength(4);
  });

  test("UNWIND with mixed types", () => {
    const query = "UNWIND [1, 'two', true, null] AS x RETURN x";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results).toHaveLength(4);

    const values = results.map((r: any) => (Array.isArray(r) ? r[0] : r));
    expect(values).toContain(1);
    expect(values).toContain("two");
    expect(values).toContain(true);
    expect(values).toContain(null);
  });
});

describe("UNWIND with WITH clause", () => {
  test("UNWIND after MATCH and WITH", () => {
    const query = "MATCH (p:Person) WHERE p.name = 'Alice' WITH p UNWIND [1, 2] AS x RETURN p, x";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results).toHaveLength(2);
  });

  test("UNWIND with parameter after WITH", () => {
    const query = "MATCH (p:Person) WHERE p.name = 'Alice' WITH p UNWIND $nums AS x RETURN p, x";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    setQueryParams({ nums: [10, 20, 30] });
    try {
      const results = [...traverser.traverse(graph, [undefined])];
      expect(results).toHaveLength(3);
    } finally {
      clearQueryParams();
    }
  });
});
