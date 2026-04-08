import { test, expect, beforeEach, afterEach, describe } from "vitest";
import { parse } from "../grammar.js";
import type { Query } from "../AST.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import { Graph } from "../Graph.js";
import { GraphSchema } from "../GraphSchema.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";

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
    User: {
      properties: {
        id: { type: makeType<string>("") },
        age: { type: makeType<number>(0) },
        score: { type: makeType<number>(0) },
      },
    },
    Item: {
      properties: {
        id: { type: makeType<string>("") },
        price: { type: makeType<number>(0) },
        cost: { type: makeType<number>(0) },
      },
    },
    Account: {
      properties: {
        id: { type: makeType<string>("") },
        balance: { type: makeType<number>(0) },
      },
    },
    Test: {
      properties: {
        id: { type: makeType<string>("") },
        value: { type: makeType<any>(null) },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

function createGraph() {
  return new Graph({ schema, storage: new InMemoryGraphStorage() });
}

/**
 * Tests for arithmetic expression support in the graph query language.
 *
 * Operator precedence (lowest to highest):
 * 1. +, - (addition/subtraction)
 * 2. *, /, % (multiplication/division/modulo)
 * 3. ^ (power/exponentiation)
 * 4. unary +, - (positive/negative)
 */

// ============================================================================
// Grammar Parsing Tests
// ============================================================================

test("Arithmetic - Grammar - should parse simple addition", () => {
  const result = parse("MATCH (n) WHERE n.age > 10 + 5 RETURN n") as Query;
  expect(result).toBeDefined();
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("ArithmeticExpression");
  expect(condition.value.operator).toBe("+");
  expect(condition.value.left).toBe(10);
  expect(condition.value.right).toBe(5);
});

test("Arithmetic - Grammar - should parse simple subtraction", () => {
  const result = parse("MATCH (n) WHERE n.age > 10 - 5 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("ArithmeticExpression");
  expect(condition.value.operator).toBe("-");
});

test("Arithmetic - Grammar - should parse multiplication", () => {
  const result = parse("MATCH (n) WHERE n.value = 5 * 3 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("ArithmeticExpression");
  expect(condition.value.operator).toBe("*");
  expect(condition.value.left).toBe(5);
  expect(condition.value.right).toBe(3);
});

test("Arithmetic - Grammar - should parse division", () => {
  const result = parse("MATCH (n) WHERE n.value = 10 / 2 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.operator).toBe("/");
});

test("Arithmetic - Grammar - should parse modulo", () => {
  const result = parse("MATCH (n) WHERE n.value = 10 % 3 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.operator).toBe("%");
});

test("Arithmetic - Grammar - should parse power/exponentiation", () => {
  const result = parse("MATCH (n) WHERE n.value = 2 ^ 3 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("ArithmeticExpression");
  expect(condition.value.operator).toBe("^");
  expect(condition.value.left).toBe(2);
  expect(condition.value.right).toBe(3);
});

test("Arithmetic - Grammar - should parse unary minus", () => {
  const result = parse("MATCH (n) WHERE n.value = -5 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  // Note: unary minus is now parsed as UnaryExpression
  expect(condition.value.type).toBe("UnaryExpression");
  expect(condition.value.operator).toBe("-");
  expect(condition.value.operand).toBe(5);
});

test("Arithmetic - Grammar - should parse unary minus with parentheses", () => {
  const result = parse("MATCH (n) WHERE n.value = -(5 + 3) RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("UnaryExpression");
  expect(condition.value.operator).toBe("-");
  expect(condition.value.operand.type).toBe("ArithmeticExpression");
});

test("Arithmetic - Grammar - should parse unary plus", () => {
  const result = parse("MATCH (n) WHERE n.value = +5 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("UnaryExpression");
  expect(condition.value.operator).toBe("+");
});

// ============================================================================
// Operator Precedence Tests
// ============================================================================

test("Arithmetic - Precedence - should respect * over +", () => {
  // 2 + 3 * 4 should be parsed as 2 + (3 * 4) = 14, not (2 + 3) * 4 = 20
  const result = parse("MATCH (n) WHERE n.value = 2 + 3 * 4 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("ArithmeticExpression");
  expect(condition.value.operator).toBe("+");
  expect(condition.value.left).toBe(2);
  expect(condition.value.right.type).toBe("ArithmeticExpression");
  expect(condition.value.right.operator).toBe("*");
});

test("Arithmetic - Precedence - should respect / over -", () => {
  // 10 - 6 / 2 should be parsed as 10 - (6 / 2) = 7
  const result = parse("MATCH (n) WHERE n.value = 10 - 6 / 2 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.operator).toBe("-");
  expect(condition.value.right.operator).toBe("/");
});

test("Arithmetic - Precedence - should respect ^ over *", () => {
  // 2 * 3 ^ 2 should be parsed as 2 * (3 ^ 2) = 18
  const result = parse("MATCH (n) WHERE n.value = 2 * 3 ^ 2 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.operator).toBe("*");
  expect(condition.value.right.operator).toBe("^");
});

test("Arithmetic - Precedence - should handle parentheses override precedence", () => {
  // (2 + 3) * 4 should be parsed as addition first
  const result = parse("MATCH (n) WHERE n.value = (2 + 3) * 4 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.operator).toBe("*");
  expect(condition.value.left.type).toBe("ArithmeticExpression");
  expect(condition.value.left.operator).toBe("+");
});

test("Arithmetic - Precedence - power should be right-associative", () => {
  // 2 ^ 3 ^ 2 should be parsed as 2 ^ (3 ^ 2) = 2 ^ 9 = 512, not (2 ^ 3) ^ 2 = 8 ^ 2 = 64
  const result = parse("MATCH (n) WHERE n.value = 2 ^ 3 ^ 2 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.operator).toBe("^");
  expect(condition.value.left).toBe(2);
  expect(condition.value.right.operator).toBe("^");
  expect(condition.value.right.left).toBe(3);
  expect(condition.value.right.right).toBe(2);
});

// ============================================================================
// Property Reference Tests
// ============================================================================

test("Arithmetic - Property Refs - should parse property + literal", () => {
  const result = parse("MATCH (n) WHERE n.total > n.base + 10 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("ArithmeticExpression");
  expect(condition.value.left.type).toBe("PropertyAccess");
  expect(condition.value.left.variable).toBe("n");
  expect(condition.value.left.property).toBe("base");
  expect(condition.value.right).toBe(10);
});

test("Arithmetic - Property Refs - should parse property + property", () => {
  const result = parse("MATCH (n) WHERE n.total = n.a + n.b RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.left.type).toBe("PropertyAccess");
  expect(condition.value.right.type).toBe("PropertyAccess");
});

test("Arithmetic - Property Refs - should parse complex expression with properties", () => {
  const result = parse("MATCH (n) WHERE n.price > n.cost * 1.5 + 10 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  // n.cost * 1.5 + 10 => (n.cost * 1.5) + 10
  expect(condition.value.operator).toBe("+");
  expect(condition.value.left.operator).toBe("*");
});

// ============================================================================
// Parameter Tests
// ============================================================================

test("Arithmetic - Parameters - should parse parameter in arithmetic", () => {
  const result = parse("MATCH (n) WHERE n.age > $minAge + 5 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("ArithmeticExpression");
  expect(condition.value.left.type).toBe("ParameterRef");
  expect(condition.value.left.name).toBe("minAge");
  expect(condition.value.right).toBe(5);
});

// ============================================================================
// Step Conversion Tests
// ============================================================================

test("Arithmetic - astToSteps - should convert arithmetic expressions to steps", () => {
  const ast = parse("MATCH (n:User) WHERE n.age > 10 + 5 RETURN n") as Query;
  const steps = astToSteps(ast);
  expect(steps.length).toBeGreaterThan(0);
  // Should have a filter step with the condition
  const filterStep = steps.find((s) => s.constructor.name === "FilterElementsStep");
  expect(filterStep).toBeDefined();
});

// ============================================================================
// Execution Tests
// ============================================================================

describe("Arithmetic - Execution", () => {
  let graph: Graph<typeof schema>;

  beforeEach(() => {
    graph = createGraph();
    // Create test vertices
    graph.addVertex("User", { id: "user1", age: 25, score: 100 });
    graph.addVertex("User", { id: "user2", age: 30, score: 150 });
    graph.addVertex("User", { id: "user3", age: 20, score: 80 });
    graph.addVertex("User", { id: "user4", age: 35, score: 200 });
  });

  afterEach(() => {
    clearQueryParams();
  });

  test("should evaluate simple addition in WHERE", () => {
    // Find users where age > 10 + 15 (i.e., age > 25)
    const ast = parse("MATCH (n:User) WHERE n.age > 10 + 15 RETURN n") as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // Should return user2 (30), user4 (35)
    expect(results.length).toBe(2);
    const ids = results.map((r: any) => r[0]?.get("id"));
    expect(ids).toContain("user2");
    expect(ids).toContain("user4");
    expect(ids).not.toContain("user1"); // age 25 is not > 25
    expect(ids).not.toContain("user3");
  });

  test("should evaluate multiplication in WHERE", () => {
    // Find users where score > 20 * 5 (i.e., score > 100)
    const ast = parse("MATCH (n:User) WHERE n.score > 20 * 5 RETURN n") as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // Should return user2 (150), user4 (200)
    expect(results.length).toBe(2);
    const ids = results.map((r: any) => r[0]?.get("id"));
    expect(ids).toContain("user2");
    expect(ids).toContain("user4");
  });

  test("should evaluate division in WHERE", () => {
    // Find users where age > 60 / 2 (i.e., age > 30)
    const ast = parse("MATCH (n:User) WHERE n.age > 60 / 2 RETURN n") as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // Should return user4 (35)
    expect(results.length).toBe(1);
    expect((results[0] as any)[0]?.get("id")).toBe("user4");
  });

  test("should evaluate modulo in WHERE", () => {
    // Find users where age % 10 = 0 (ages divisible by 10)
    const ast = parse("MATCH (n:User) WHERE n.age % 10 = 0 RETURN n") as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // Should return user2 (30), user3 (20)
    expect(results.length).toBe(2);
    const ids = results.map((r: any) => r[0]?.get("id"));
    expect(ids).toContain("user2");
    expect(ids).toContain("user3");
  });

  test("should evaluate power in WHERE", () => {
    // Find users where score > 10 ^ 2 (i.e., score > 100)
    const ast = parse("MATCH (n:User) WHERE n.score > 10 ^ 2 RETURN n") as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // Should return user2 (150), user4 (200)
    expect(results.length).toBe(2);
  });

  test("should evaluate complex expression with precedence", () => {
    // Find users where score > 10 + 20 * 5 (= 10 + 100 = 110)
    const ast = parse("MATCH (n:User) WHERE n.score > 10 + 20 * 5 RETURN n") as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // Should return user2 (150), user4 (200)
    expect(results.length).toBe(2);
    const ids = results.map((r: any) => r[0]?.get("id"));
    expect(ids).toContain("user2");
    expect(ids).toContain("user4");
  });

  test("should evaluate parenthesized expressions", () => {
    // Find users where score > (10 + 20) * 5 (= 30 * 5 = 150)
    const ast = parse("MATCH (n:User) WHERE n.score > (10 + 20) * 5 RETURN n") as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // Should return only user4 (200) since score > 150
    expect(results.length).toBe(1);
    expect((results[0] as any)[0]?.get("id")).toBe("user4");
  });

  test("should evaluate property comparison with arithmetic", () => {
    // Add vertices with related values
    graph.addVertex("Item", { id: "item1", price: 100, cost: 60 });
    graph.addVertex("Item", { id: "item2", price: 100, cost: 80 });
    graph.addVertex("Item", { id: "item3", price: 200, cost: 100 });

    // Find items where price > cost * 1.5 (i.e., price > cost * 1.5)
    const ast = parse("MATCH (n:Item) WHERE n.price > n.cost * 1.5 RETURN n") as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // item1: 100 > 90 (true), item2: 100 > 120 (false), item3: 200 > 150 (true)
    expect(results.length).toBe(2);
    const ids = results.map((r: any) => r[0]?.get("id"));
    expect(ids).toContain("item1");
    expect(ids).toContain("item3");
  });

  test("should evaluate arithmetic with parameters", () => {
    setQueryParams({ minAge: 20 });

    // Find users where age > $minAge + 5 (i.e., age > 25)
    const ast = parse("MATCH (n:User) WHERE n.age > $minAge + 5 RETURN n") as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // Should return user2 (30), user4 (35)
    expect(results.length).toBe(2);
    const ids = results.map((r: any) => r[0]?.get("id"));
    expect(ids).toContain("user2");
    expect(ids).toContain("user4");
  });

  test("should evaluate unary minus", () => {
    // Add a vertex with negative value
    graph.addVertex("Account", { id: "acc1", balance: -50 });
    graph.addVertex("Account", { id: "acc2", balance: 100 });

    // Find accounts where balance < -25
    const ast = parse("MATCH (n:Account) WHERE n.balance < -25 RETURN n") as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
    expect((results[0] as any)[0]?.get("id")).toBe("acc1");
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

test("Arithmetic - Edge Cases - should handle division by zero", () => {
  const graph = createGraph();
  graph.addVertex("Test", { id: "t1", value: 10 });

  const ast = parse("MATCH (n:Test) WHERE n.value / 0 = 1 RETURN n") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = [...traverser.traverse(graph, [undefined])];

  // Division by zero produces Infinity, so condition should fail
  expect(results.length).toBe(0);
});

test("Arithmetic - Edge Cases - should handle NaN comparisons", () => {
  const graph = createGraph();
  graph.addVertex("Test", { id: "t1", value: "not a number" });

  const ast = parse("MATCH (n:Test) WHERE n.value + 5 > 10 RETURN n") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = [...traverser.traverse(graph, [undefined])];

  // NaN comparisons should fail
  expect(results.length).toBe(0);
});

test("Arithmetic - Edge Cases - should handle missing properties", () => {
  const graph = createGraph();
  graph.addVertex("Test", { id: "t1", value: undefined }); // No 'value' property

  const ast = parse("MATCH (n:Test) WHERE n.value + 5 > 10 RETURN n") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = [...traverser.traverse(graph, [undefined])];

  // Missing property results in undefined/NaN, should fail
  expect(results.length).toBe(0);
});
