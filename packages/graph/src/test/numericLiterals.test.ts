import { test, expect, beforeEach, describe } from "vitest";
import { parse } from "../grammar.js";
import type { Query, Pattern } from "../AST.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
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
    Test: {
      properties: {
        id: { type: makeType<string>("") },
        value: { type: makeType<number>(0) },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

/**
 * Tests for standardized numeric literals in the graph query language.
 *
 * Supports:
 * - Hexadecimal: 0x1A2B, 0X1a2b
 * - Octal: 0o755, 0O777
 * - Scientific notation: 1e10, 1.5E-3, 2.5e+6
 * - Standard decimals: 42, 3.14, -100
 */

// ============================================================================
// Grammar Parsing Tests - Hexadecimal
// ============================================================================

test("NumericLiterals - Grammar - should parse hexadecimal integer (lowercase x)", () => {
  const result = parse("MATCH (n) WHERE n.value = 0x1a RETURN n") as Query;
  expect(result).toBeDefined();
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(26); // 0x1a = 26
});

test("NumericLiterals - Grammar - should parse hexadecimal integer (uppercase X)", () => {
  const result = parse("MATCH (n) WHERE n.value = 0X1A RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(26); // 0X1A = 26
});

test("NumericLiterals - Grammar - should parse large hexadecimal integer", () => {
  const result = parse("MATCH (n) WHERE n.value = 0xFF00 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(65280); // 0xFF00 = 65280
});

test("NumericLiterals - Grammar - should parse negative hexadecimal integer", () => {
  const result = parse("MATCH (n) WHERE n.value = -0x10 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  // Note: negative hex is parsed as UnaryExpression with '-' operator
  expect(condition.value.type).toBe("UnaryExpression");
  expect(condition.value.operator).toBe("-");
  expect(condition.value.operand).toBe(16);
});

test("NumericLiterals - Grammar - should parse hexadecimal with all digit types", () => {
  const result = parse("MATCH (n) WHERE n.value = 0xABCDEF RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(11259375); // 0xABCDEF = 11259375
});

// ============================================================================
// Grammar Parsing Tests - Octal
// ============================================================================

test("NumericLiterals - Grammar - should parse octal integer (lowercase o)", () => {
  const result = parse("MATCH (n) WHERE n.value = 0o755 RETURN n") as Query;
  expect(result).toBeDefined();
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(493); // 0o755 = 493
});

test("NumericLiterals - Grammar - should parse octal integer (uppercase O)", () => {
  const result = parse("MATCH (n) WHERE n.value = 0O777 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(511); // 0O777 = 511
});

test("NumericLiterals - Grammar - should parse small octal integer", () => {
  const result = parse("MATCH (n) WHERE n.value = 0o7 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(7); // 0o7 = 7
});

test("NumericLiterals - Grammar - should parse negative octal integer", () => {
  const result = parse("MATCH (n) WHERE n.value = -0o10 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  // Note: negative octal is parsed as UnaryExpression with '-' operator
  expect(condition.value.type).toBe("UnaryExpression");
  expect(condition.value.operator).toBe("-");
  expect(condition.value.operand).toBe(8); // 0o10 = 8
});

// ============================================================================
// Grammar Parsing Tests - Scientific Notation
// ============================================================================

test("NumericLiterals - Grammar - should parse scientific notation (integer mantissa)", () => {
  const result = parse("MATCH (n) WHERE n.value = 1e10 RETURN n") as Query;
  expect(result).toBeDefined();
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(1e10);
});

test("NumericLiterals - Grammar - should parse scientific notation (uppercase E)", () => {
  const result = parse("MATCH (n) WHERE n.value = 5E3 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(5000);
});

test("NumericLiterals - Grammar - should parse scientific notation (float mantissa)", () => {
  const result = parse("MATCH (n) WHERE n.value = 1.5e3 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(1500);
});

test("NumericLiterals - Grammar - should parse scientific notation (positive exponent)", () => {
  const result = parse("MATCH (n) WHERE n.value = 2.5e+6 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(2500000);
});

test("NumericLiterals - Grammar - should parse scientific notation (negative exponent)", () => {
  const result = parse("MATCH (n) WHERE n.value = 1.5E-3 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBeCloseTo(0.0015, 10);
});

test("NumericLiterals - Grammar - should parse negative scientific notation", () => {
  const result = parse("MATCH (n) WHERE n.value = -3e2 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  // Note: negative scientific is parsed as UnaryExpression with '-' operator
  expect(condition.value.type).toBe("UnaryExpression");
  expect(condition.value.operator).toBe("-");
  expect(condition.value.operand).toBe(300);
});

test("NumericLiterals - Grammar - should parse very small scientific notation", () => {
  const result = parse("MATCH (n) WHERE n.value = 1e-10 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBeCloseTo(1e-10, 15);
});

// ============================================================================
// Grammar Parsing Tests - Standard Decimals (regression)
// ============================================================================

test("NumericLiterals - Grammar - should still parse standard integers", () => {
  const result = parse("MATCH (n) WHERE n.value = 42 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(42);
});

test("NumericLiterals - Grammar - should still parse standard floats", () => {
  const result = parse("MATCH (n) WHERE n.value = 3.14 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBeCloseTo(3.14, 10);
});

test("NumericLiterals - Grammar - should still parse negative integers", () => {
  const result = parse("MATCH (n) WHERE n.value = -100 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("UnaryExpression");
  expect(condition.value.operator).toBe("-");
  expect(condition.value.operand).toBe(100);
});

test("NumericLiterals - Grammar - should still parse negative floats", () => {
  const result = parse("MATCH (n) WHERE n.value = -2.5 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("UnaryExpression");
  expect(condition.value.operator).toBe("-");
  expect(condition.value.operand).toBeCloseTo(2.5, 10);
});

// ============================================================================
// Arithmetic with Different Numeric Formats
// ============================================================================

test("NumericLiterals - Arithmetic - hex in addition", () => {
  const result = parse("MATCH (n) WHERE n.value = 0x10 + 16 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("ArithmeticExpression");
  expect(condition.value.operator).toBe("+");
  expect(condition.value.left).toBe(16); // 0x10 = 16
  expect(condition.value.right).toBe(16);
});

test("NumericLiterals - Arithmetic - octal in multiplication", () => {
  const result = parse("MATCH (n) WHERE n.value = 0o10 * 2 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("ArithmeticExpression");
  expect(condition.value.operator).toBe("*");
  expect(condition.value.left).toBe(8); // 0o10 = 8
  expect(condition.value.right).toBe(2);
});

test("NumericLiterals - Arithmetic - scientific in division", () => {
  const result = parse("MATCH (n) WHERE n.value = 1e6 / 1000 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value.type).toBe("ArithmeticExpression");
  expect(condition.value.operator).toBe("/");
  expect(condition.value.left).toBe(1e6);
  expect(condition.value.right).toBe(1000);
});

test("NumericLiterals - Arithmetic - mixed formats in expression", () => {
  const result = parse("MATCH (n) WHERE n.value = 0xFF + 0o77 + 1e2 RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  // Should parse as ((0xFF + 0o77) + 1e2) due to left associativity
  expect(condition.value.type).toBe("ArithmeticExpression");
  expect(condition.value.operator).toBe("+");
  // 0xFF = 255, 0o77 = 63, 1e2 = 100
  expect(condition.value.right).toBe(100);
  expect(condition.value.left.type).toBe("ArithmeticExpression");
  expect(condition.value.left.left).toBe(255);
  expect(condition.value.left.right).toBe(63);
});

// ============================================================================
// Query Execution Tests
// ============================================================================

describe("NumericLiterals - Execution", () => {
  let graph: Graph<typeof schema>;

  beforeEach(() => {
    const storage = new InMemoryGraphStorage();
    graph = new Graph({ schema, storage });
    graph.addVertex("Test", { id: "t1", value: 255 }); // 0xFF
    graph.addVertex("Test", { id: "t2", value: 493 }); // 0o755
    graph.addVertex("Test", { id: "t3", value: 1e6 }); // scientific
    graph.addVertex("Test", { id: "t4", value: 42 }); // standard
  });

  test("should filter using hex literal", () => {
    const steps = astToSteps(parse("MATCH (n:Test) WHERE n.value = 0xFF RETURN n.id") as Query);
    const traverser = createTraverser(steps);
    const results = Array.from(traverser.traverse(graph, [undefined]));
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("t1");
  });

  test("should filter using octal literal", () => {
    const steps = astToSteps(parse("MATCH (n:Test) WHERE n.value = 0o755 RETURN n.id") as Query);
    const traverser = createTraverser(steps);
    const results = Array.from(traverser.traverse(graph, [undefined]));
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("t2");
  });

  test("should filter using scientific notation", () => {
    const steps = astToSteps(parse("MATCH (n:Test) WHERE n.value = 1e6 RETURN n.id") as Query);
    const traverser = createTraverser(steps);
    const results = Array.from(traverser.traverse(graph, [undefined]));
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("t3");
  });

  test("should filter using hex in arithmetic", () => {
    // 0xFE + 1 = 255 (matches t1)
    const steps = astToSteps(parse("MATCH (n:Test) WHERE n.value = 0xFE + 1 RETURN n.id") as Query);
    const traverser = createTraverser(steps);
    const results = Array.from(traverser.traverse(graph, [undefined]));
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("t1");
  });

  test("should filter using comparison with scientific notation", () => {
    // Find values greater than 1e5 (100000)
    const steps = astToSteps(parse("MATCH (n:Test) WHERE n.value > 1e5 RETURN n.id") as Query);
    const traverser = createTraverser(steps);
    const results = Array.from(traverser.traverse(graph, [undefined]));
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("t3"); // only 1e6 is > 1e5
  });
});

// ============================================================================
// Property Map Tests
// ============================================================================

test("NumericLiterals - PropertyMap - hex value in node pattern", () => {
  const result = parse("MATCH (n:Test {value: 0xFF}) RETURN n") as Query;
  const pattern = result.matches[0]!.pattern as Pattern;
  const nodePattern = pattern.elements[0] as any;
  expect(nodePattern.properties.value).toBe(255);
});

test("NumericLiterals - PropertyMap - octal value in node pattern", () => {
  const result = parse("MATCH (n:Test {value: 0o777}) RETURN n") as Query;
  const pattern = result.matches[0]!.pattern as Pattern;
  const nodePattern = pattern.elements[0] as any;
  expect(nodePattern.properties.value).toBe(511);
});

test("NumericLiterals - PropertyMap - scientific value in node pattern", () => {
  const result = parse("MATCH (n:Test {value: 1.5e3}) RETURN n") as Query;
  const pattern = result.matches[0]!.pattern as Pattern;
  const nodePattern = pattern.elements[0] as any;
  expect(nodePattern.properties.value).toBe(1500);
});

// ============================================================================
// Edge Cases
// ============================================================================

test("NumericLiterals - EdgeCases - zero in different formats", () => {
  const hexZero = parse("MATCH (n) WHERE n.value = 0x0 RETURN n") as Query;
  const octalZero = parse("MATCH (n) WHERE n.value = 0o0 RETURN n") as Query;
  const sciZero = parse("MATCH (n) WHERE n.value = 0e0 RETURN n") as Query;

  expect((hexZero.matches[0]!.where!.condition as any).value).toBe(0);
  expect((octalZero.matches[0]!.where!.condition as any).value).toBe(0);
  expect((sciZero.matches[0]!.where!.condition as any).value).toBe(0);
});

test("NumericLiterals - EdgeCases - max safe integer in hex", () => {
  // Number.MAX_SAFE_INTEGER = 9007199254740991 = 0x1FFFFFFFFFFFFF
  const result = parse("MATCH (n) WHERE n.value = 0x1FFFFFFFFFFFFF RETURN n") as Query;
  const condition = result.matches[0]!.where!.condition as any;
  expect(condition.value).toBe(Number.MAX_SAFE_INTEGER);
});
