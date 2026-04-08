import { describe, it, expect, beforeEach } from "vitest";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, clearQueryParams } from "../Steps.js";
import {
  functionRegistry,
  evaluateFunction,
  isBuiltinFunction,
  isAggregateFunction,
} from "../FunctionRegistry.js";
import { TraversalPath } from "../Traversals.js";
import type { Query, FunctionCall } from "../AST.js";
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
        age: { type: makeType(0) },
      },
    },
  },
  edges: {
    KNOWS: { properties: { since: { type: makeType(0) } } },
  },
} as const satisfies GraphSchema;

describe("FunctionRegistry", () => {
  describe("registration and lookup", () => {
    it("should have built-in functions registered", () => {
      expect(functionRegistry.has("toLower")).toBe(true);
      expect(functionRegistry.has("toUpper")).toBe(true);
      expect(functionRegistry.has("abs")).toBe(true);
      expect(functionRegistry.has("count")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(functionRegistry.has("TOLOWER")).toBe(true);
      expect(functionRegistry.has("ToLower")).toBe(true);
      expect(functionRegistry.has("tolower")).toBe(true);
    });

    it("should return undefined for unknown functions", () => {
      expect(functionRegistry.get("unknownFunction")).toBeUndefined();
    });

    it("should correctly identify aggregate functions", () => {
      expect(isAggregateFunction("count")).toBe(true);
      expect(isAggregateFunction("sum")).toBe(true);
      expect(isAggregateFunction("avg")).toBe(true);
      expect(isAggregateFunction("min")).toBe(true);
      expect(isAggregateFunction("max")).toBe(true);
      expect(isAggregateFunction("collect")).toBe(true);
      expect(isAggregateFunction("toLower")).toBe(false);
      expect(isAggregateFunction("abs")).toBe(false);
    });

    it("should correctly identify builtin functions", () => {
      expect(isBuiltinFunction("toLower")).toBe(true);
      expect(isBuiltinFunction("notAFunction")).toBe(false);
    });
  });

  describe("string functions", () => {
    const path = new TraversalPath(undefined, undefined, []);

    it("should evaluate toLower", () => {
      expect(evaluateFunction("toLower", ["HELLO"], path)).toBe("hello");
      expect(evaluateFunction("toLower", [null], path)).toBe(null);
    });

    it("should evaluate toUpper", () => {
      expect(evaluateFunction("toUpper", ["hello"], path)).toBe("HELLO");
      expect(evaluateFunction("toUpper", [null], path)).toBe(null);
    });

    it("should evaluate trim", () => {
      expect(evaluateFunction("trim", ["  hello  "], path)).toBe("hello");
    });

    it("should evaluate ltrim", () => {
      expect(evaluateFunction("ltrim", ["  hello  "], path)).toBe("hello  ");
    });

    it("should evaluate rtrim", () => {
      expect(evaluateFunction("rtrim", ["  hello  "], path)).toBe("  hello");
    });

    it("should evaluate substring", () => {
      expect(evaluateFunction("substring", ["hello", 1], path)).toBe("ello");
      expect(evaluateFunction("substring", ["hello", 1, 3], path)).toBe("ell");
    });

    it("should evaluate left", () => {
      expect(evaluateFunction("left", ["hello", 2], path)).toBe("he");
    });

    it("should evaluate right", () => {
      expect(evaluateFunction("right", ["hello", 2], path)).toBe("lo");
    });

    it("should evaluate replace", () => {
      expect(evaluateFunction("replace", ["hello", "l", "L"], path)).toBe("heLLo");
    });

    it("should evaluate reverse", () => {
      expect(evaluateFunction("reverse", ["hello"], path)).toBe("olleh");
    });

    it("should evaluate split", () => {
      expect(evaluateFunction("split", ["a,b,c", ","], path)).toEqual(["a", "b", "c"]);
    });

    it("should evaluate toString", () => {
      expect(evaluateFunction("toString", [123], path)).toBe("123");
      expect(evaluateFunction("toString", [true], path)).toBe("true");
    });

    it("should evaluate size for strings", () => {
      expect(evaluateFunction("size", ["hello"], path)).toBe(5);
    });
  });

  describe("math functions", () => {
    const path = new TraversalPath(undefined, undefined, []);

    it("should evaluate abs", () => {
      expect(evaluateFunction("abs", [-5], path)).toBe(5);
      expect(evaluateFunction("abs", [5], path)).toBe(5);
    });

    it("should evaluate ceil", () => {
      expect(evaluateFunction("ceil", [4.2], path)).toBe(5);
    });

    it("should evaluate floor", () => {
      expect(evaluateFunction("floor", [4.8], path)).toBe(4);
    });

    it("should evaluate round", () => {
      expect(evaluateFunction("round", [4.5], path)).toBe(5);
      expect(evaluateFunction("round", [4.4], path)).toBe(4);
      expect(evaluateFunction("round", [4.567, 2], path)).toBe(4.57);
    });

    it("should evaluate sign", () => {
      expect(evaluateFunction("sign", [-5], path)).toBe(-1);
      expect(evaluateFunction("sign", [0], path)).toBe(0);
      expect(evaluateFunction("sign", [5], path)).toBe(1);
    });

    it("should evaluate sqrt", () => {
      expect(evaluateFunction("sqrt", [16], path)).toBe(4);
    });

    it("should evaluate exp", () => {
      expect(evaluateFunction("exp", [0], path)).toBe(1);
    });

    it("should evaluate log", () => {
      expect(evaluateFunction("log", [Math.E], path)).toBeCloseTo(1);
    });

    it("should evaluate log10", () => {
      expect(evaluateFunction("log10", [100], path)).toBe(2);
    });

    it("should evaluate trigonometric functions", () => {
      expect(evaluateFunction("sin", [0], path)).toBe(0);
      expect(evaluateFunction("cos", [0], path)).toBe(1);
      expect(evaluateFunction("tan", [0], path)).toBe(0);
    });

    it("should evaluate inverse trigonometric functions", () => {
      expect(evaluateFunction("asin", [0], path)).toBe(0);
      expect(evaluateFunction("acos", [1], path)).toBe(0);
      expect(evaluateFunction("atan", [0], path)).toBe(0);
    });

    it("should evaluate atan2", () => {
      expect(evaluateFunction("atan2", [1, 1], path)).toBeCloseTo(Math.PI / 4);
    });

    it("should evaluate rand", () => {
      const result = evaluateFunction("rand", [], path);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    });

    it("should evaluate toInteger", () => {
      expect(evaluateFunction("toInteger", [4.8], path)).toBe(4);
      expect(evaluateFunction("toInteger", ["123"], path)).toBe(123);
      expect(evaluateFunction("toInteger", [true], path)).toBe(1);
    });

    it("should evaluate toFloat", () => {
      expect(evaluateFunction("toFloat", ["3.14"], path)).toBe(3.14);
      expect(evaluateFunction("toFloat", [42], path)).toBe(42);
    });

    it("should evaluate pi and e", () => {
      expect(evaluateFunction("pi", [], path)).toBe(Math.PI);
      expect(evaluateFunction("e", [], path)).toBe(Math.E);
    });
  });

  describe("list functions", () => {
    const path = new TraversalPath(undefined, undefined, []);

    it("should evaluate head", () => {
      expect(evaluateFunction("head", [[1, 2, 3]], path)).toBe(1);
      expect(evaluateFunction("head", [[]], path)).toBe(null);
    });

    it("should evaluate tail", () => {
      expect(evaluateFunction("tail", [[1, 2, 3]], path)).toEqual([2, 3]);
    });

    it("should evaluate last", () => {
      expect(evaluateFunction("last", [[1, 2, 3]], path)).toBe(3);
      expect(evaluateFunction("last", [[]], path)).toBe(null);
    });

    it("should evaluate range", () => {
      expect(evaluateFunction("range", [1, 5], path)).toEqual([1, 2, 3, 4, 5]);
      expect(evaluateFunction("range", [0, 10, 2], path)).toEqual([0, 2, 4, 6, 8, 10]);
    });

    it("should evaluate size for lists", () => {
      expect(evaluateFunction("size", [[1, 2, 3]], path)).toBe(3);
    });

    it("should evaluate coalesce", () => {
      expect(evaluateFunction("coalesce", [null, "a", "b"], path)).toBe("a");
      expect(evaluateFunction("coalesce", [null, null], path)).toBe(null);
    });

    it("should evaluate reverse for lists", () => {
      expect(evaluateFunction("reverse", [[1, 2, 3]], path)).toEqual([3, 2, 1]);
    });
  });
});

describe("Grammar: Function Call Parsing", () => {
  it("should parse simple function call with no arguments", () => {
    const query = parse("MATCH (n:Person) WHERE rand() > 0.5 RETURN n") as Query;
    const where = query.matches[0]!.where;
    expect(where).toBeDefined();
    expect(where!.condition.type).toBe("ExpressionCondition");
  });

  it("should parse function call with single argument", () => {
    const query = parse("MATCH (n:Person) WHERE toLower(n.name) = 'alice' RETURN n") as Query;
    const where = query.matches[0]!.where;
    expect(where).toBeDefined();
    // The left side should be a FunctionCall
    const condition = where!.condition;
    if (condition.type === "ExpressionCondition") {
      expect((condition.left as FunctionCall).type).toBe("FunctionCall");
      expect((condition.left as FunctionCall).name).toBe("toLower");
    }
  });

  it("should parse function call with multiple arguments", () => {
    const query = parse("MATCH (n:Person) WHERE substring(n.name, 0, 3) = 'Ali' RETURN n") as Query;
    const where = query.matches[0]!.where;
    expect(where).toBeDefined();
  });

  it("should parse nested function calls", () => {
    const query = parse("MATCH (n:Person) WHERE toLower(trim(n.name)) = 'alice' RETURN n") as Query;
    const where = query.matches[0]!.where;
    expect(where).toBeDefined();
    // The outer function should be toLower
    const condition = where!.condition;
    if (condition.type === "ExpressionCondition") {
      const func = condition.left as FunctionCall;
      expect(func.type).toBe("FunctionCall");
      expect(func.name).toBe("toLower");
      // The argument should be another function call
      expect(func.args[0]).toHaveProperty("type", "FunctionCall");
      expect((func.args[0] as FunctionCall).name).toBe("trim");
    }
  });

  it("should parse function call with DISTINCT", () => {
    const query = parse("MATCH (n:Person) WHERE count(DISTINCT n.age) > 0 RETURN n") as Query;
    // Even though this doesn't make semantic sense in WHERE, it should parse
    const where = query.matches[0]!.where;
    expect(where).toBeDefined();
    const condition = where!.condition;
    if (condition.type === "ExpressionCondition") {
      const func = condition.left as FunctionCall;
      expect(func.distinct).toBe(true);
    }
  });

  it("should parse arithmetic with function calls", () => {
    const query = parse("MATCH (n:Person) WHERE abs(n.age - 30) < 5 RETURN n") as Query;
    const where = query.matches[0]!.where;
    expect(where).toBeDefined();
  });
});

describe("Query Execution: Function Calls", () => {
  let graph: Graph<typeof testSchema>;

  beforeEach(() => {
    graph = new Graph({
      schema: testSchema,
      storage: new InMemoryGraphStorage(),
    });
    graph.addVertex("Person", { name: "Alice", age: 30 });
    graph.addVertex("Person", { name: "BOB", age: 25 });
    graph.addVertex("Person", { name: "  Charlie  ", age: 35 });
    clearQueryParams();
  });

  it("should execute query with toLower in WHERE", () => {
    const query = "MATCH (n:Person) WHERE toLower(n.name) = 'alice' RETURN n";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results.length).toBe(1);
    expect(results[0]).toHaveLength(1);
  });

  it("should execute query with toUpper in WHERE", () => {
    const query = "MATCH (n:Person) WHERE toUpper(n.name) = 'BOB' RETURN n";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results.length).toBe(1);
  });

  it("should execute query with trim in WHERE", () => {
    const query = "MATCH (n:Person) WHERE trim(n.name) = 'Charlie' RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results.length).toBe(1);
    // Single property in RETURN returns the value directly, not an array
    expect(results[0]).toBe("  Charlie  ");
  });

  it("should execute query with abs in WHERE", () => {
    const query = "MATCH (n:Person) WHERE abs(n.age - 32) <= 3 RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    // Alice (30) and Charlie (35) are within 3 of 32
    expect(results.length).toBe(2);
  });

  it("should execute query with nested functions", () => {
    const query = "MATCH (n:Person) WHERE toLower(trim(n.name)) = 'charlie' RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results.length).toBe(1);
    expect(results[0]).toBe("  Charlie  ");
  });

  it("should execute query with size function", () => {
    const query = "MATCH (n:Person) WHERE size(n.name) > 5 RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    // "  Charlie  " has length 12
    expect(results.length).toBe(1);
  });

  it("should execute query with substring function", () => {
    const query = "MATCH (n:Person) WHERE substring(n.name, 0, 3) = 'Ali' RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results.length).toBe(1);
    expect(results[0]).toBe("Alice");
  });

  it("should execute query with coalesce function", () => {
    // Add a person with no name
    graph.addVertex("Person", { age: 40 });

    const query = "MATCH (n:Person) WHERE coalesce(n.name, 'Unknown') = 'Unknown' RETURN n.age";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results.length).toBe(1);
    expect(results[0]).toBe(40);
  });

  it("should handle null values in function arguments", () => {
    graph.addVertex("Person", { age: 45 }); // No name

    const query = "MATCH (n:Person) WHERE toLower(n.name) = 'alice' RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    // Should only match Alice, not the person without a name
    const results = [...traverser.traverse(graph, [undefined])];
    expect(results.length).toBe(1);
    expect(results[0]).toBe("Alice");
  });
});

describe("Type Functions with Graph Elements", () => {
  let graph: Graph<typeof testSchema>;

  beforeEach(() => {
    graph = new Graph({
      schema: testSchema,
      storage: new InMemoryGraphStorage(),
    });
    const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
    const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
    graph.addEdge(alice, "KNOWS", bob, { since: 2020 });
    clearQueryParams();
  });

  it("should evaluate id() function on nodes", () => {
    // ID comparisons are complex since IDs are strings like "Person:uuid"
    // Just test that we can call id() and get back a value
    const path = new TraversalPath(undefined, undefined, []);
    const vertices = [...graph.getVertices("Person")];
    const vertex = vertices[0]!;
    const result = evaluateFunction("id", [vertex], path);
    expect(typeof result).toBe("string");
    expect(result).toContain("Person");
  });

  it("should evaluate labels() function on nodes", () => {
    const path = new TraversalPath(undefined, undefined, []);
    const vertices = [...graph.getVertices("Person")];
    const vertex = vertices[0]!;
    const result = evaluateFunction("labels", [vertex], path);
    expect(result).toEqual(["Person"]);
  });

  it("should evaluate type() function on relationships", () => {
    const edges = [...graph.getEdges("KNOWS")];
    const edge = edges[0]!;
    const path = new TraversalPath(undefined, undefined, []);
    const result = evaluateFunction("type", [edge], path);
    expect(result).toBe("KNOWS");
  });

  it("should evaluate properties() function", () => {
    const vertices = [...graph.getVertices("Person")];
    const vertex = vertices[0]!;
    const path = new TraversalPath(undefined, undefined, []);
    const result = evaluateFunction("properties", [vertex], path);
    expect(result).toHaveProperty("name");
  });
});

describe("Function Registry - Argument Validation", () => {
  const path = new TraversalPath(undefined, undefined, []);

  it("should throw error for unknown function", () => {
    expect(() => {
      functionRegistry.invoke({
        name: "unknownFunction",
        args: [],
        distinct: false,
        path,
      });
    }).toThrow("Unknown function: unknownFunction");
  });

  it("should throw error for missing required arguments", () => {
    expect(() => {
      functionRegistry.invoke({
        name: "toLower",
        args: [],
        distinct: false,
        path,
      });
    }).toThrow(/requires at least 1 argument/);
  });

  it("should throw error for too many arguments", () => {
    expect(() => {
      functionRegistry.invoke({
        name: "toLower",
        args: ["hello", "extra"],
        distinct: false,
        path,
      });
    }).toThrow(/accepts at most 1 argument/);
  });

  it("should throw error for DISTINCT on non-aggregate function", () => {
    expect(() => {
      functionRegistry.invoke({
        name: "toLower",
        args: ["hello"],
        distinct: true,
        path,
      });
    }).toThrow(/does not support DISTINCT/);
  });
});
