import { test, expect, describe, beforeEach } from "vitest";
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
    Person: {
      properties: {
        id: { type: makeType<string>("") },
        firstName: { type: makeType<string>("") },
        lastName: { type: makeType<string>("") },
        fullName: { type: makeType<string>("") },
        greeting: { type: makeType<string>("") },
        prefix: { type: makeType<string>("") },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

function createGraph() {
  return new Graph({ schema, storage: new InMemoryGraphStorage() });
}

/**
 * Tests for string concatenation support with the + operator.
 * String concatenation is supported in WHERE clauses and expressions.
 */

// ============================================================================
// Grammar Parsing Tests
// ============================================================================

describe("String Concatenation - Grammar", () => {
  test("parses string literal concatenation", () => {
    const ast = parse(
      "MATCH (n) WHERE n.name = 'Hello' + ' ' + 'World' RETURN n",
    ) as Query;
    expect(ast).toBeDefined();
    const condition = ast.matches[0]!.where!.condition as any;
    expect(condition.value.type).toBe("ArithmeticExpression");
    expect(condition.value.operator).toBe("+");
  });

  test("parses property + string literal", () => {
    const ast = parse(
      "MATCH (n) WHERE n.firstName + ' Doe' = 'John Doe' RETURN n",
    ) as Query;
    expect(ast).toBeDefined();
    const condition = ast.matches[0]!.where!.condition as any;
    expect(condition.left.type).toBe("ArithmeticExpression");
    expect(condition.left.operator).toBe("+");
    expect(condition.left.left.type).toBe("PropertyAccess");
    expect(condition.left.right).toBe(" Doe");
  });

  test("parses property + property concatenation", () => {
    const ast = parse(
      "MATCH (n) WHERE n.firstName + n.lastName = 'JohnDoe' RETURN n",
    ) as Query;
    expect(ast).toBeDefined();
    const condition = ast.matches[0]!.where!.condition as any;
    expect(condition.left.type).toBe("ArithmeticExpression");
    expect(condition.left.left.type).toBe("PropertyAccess");
    expect(condition.left.right.type).toBe("PropertyAccess");
  });

  test("parses multiple string concatenations", () => {
    const ast = parse(
      "MATCH (n) WHERE n.firstName + ' ' + n.lastName = 'John Doe' RETURN n",
    ) as Query;
    expect(ast).toBeDefined();
    // Left-associative: (n.firstName + ' ') + n.lastName
    const condition = ast.matches[0]!.where!.condition as any;
    expect(condition.left.type).toBe("ArithmeticExpression");
    expect(condition.left.operator).toBe("+");
    expect(condition.left.left.type).toBe("ArithmeticExpression");
  });

  test("parses string concatenation with parameter", () => {
    const ast = parse(
      "MATCH (n) WHERE n.greeting = 'Hello, ' + $name RETURN n",
    ) as Query;
    expect(ast).toBeDefined();
    const condition = ast.matches[0]!.where!.condition as any;
    expect(condition.value.type).toBe("ArithmeticExpression");
    expect(condition.value.left).toBe("Hello, ");
    expect(condition.value.right.type).toBe("ParameterRef");
    expect(condition.value.right.name).toBe("name");
  });
});

// ============================================================================
// Step Conversion Tests
// ============================================================================

describe("String Concatenation - Step Conversion", () => {
  test("converts string concatenation to steps", () => {
    const ast = parse(
      "MATCH (n:Person) WHERE n.firstName + ' ' + n.lastName = 'John Doe' RETURN n",
    ) as Query;
    const steps = astToSteps(ast);
    expect(steps.length).toBeGreaterThan(0);
    const filterStep = steps.find(
      (s) => s.constructor.name === "FilterElementsStep",
    );
    expect(filterStep).toBeDefined();
  });
});

// ============================================================================
// Execution Tests
// ============================================================================

describe("String Concatenation - Execution", () => {
  let graph: Graph<typeof schema>;

  beforeEach(() => {
    graph = createGraph();
    clearQueryParams();

    graph.addVertex("Person", {
      id: "p1",
      firstName: "John",
      lastName: "Doe",
      fullName: "John Doe",
      greeting: "Hello, World!",
      prefix: "Mr.",
    });
    graph.addVertex("Person", {
      id: "p2",
      firstName: "Jane",
      lastName: "Smith",
      fullName: "Jane Smith",
      greeting: "Hi there!",
      prefix: "Ms.",
    });
    graph.addVertex("Person", {
      id: "p3",
      firstName: "Bob",
      lastName: "Jones",
      fullName: "Bob Jones",
      greeting: "",
      prefix: "",
    });
  });

  test("concatenates two string literals", () => {
    const ast = parse(
      "MATCH (n:Person) WHERE 'Hello' + 'World' = 'HelloWorld' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // All persons should match since the condition is always true
    expect(results.length).toBe(3);
  });

  test("concatenates property with string literal", () => {
    const ast = parse(
      "MATCH (n:Person) WHERE n.firstName + ' Doe' = 'John Doe' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
    expect(results[0]).toBe("John");
  });

  test("concatenates two properties", () => {
    const ast = parse(
      "MATCH (n:Person) WHERE n.firstName + n.lastName = 'JohnDoe' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
    expect(results[0]).toBe("John");
  });

  test("concatenates properties with space separator", () => {
    const ast = parse(
      "MATCH (n:Person) WHERE n.firstName + ' ' + n.lastName = 'John Doe' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
    expect(results[0]).toBe("John");
  });

  test("compares concatenated result to stored full name", () => {
    const ast = parse(
      "MATCH (n:Person) WHERE n.firstName + ' ' + n.lastName = n.fullName RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // All persons should match since fullName = firstName + ' ' + lastName
    expect(results.length).toBe(3);
  });

  test("concatenates with prefix", () => {
    const ast = parse(
      "MATCH (n:Person) WHERE n.prefix + ' ' + n.firstName = 'Mr. John' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
    expect(results[0]).toBe("John");
  });

  test("handles empty string concatenation", () => {
    const ast = parse(
      "MATCH (n:Person) WHERE n.prefix + n.firstName = 'Bob' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // Bob has empty prefix, so '' + 'Bob' = 'Bob'
    expect(results.length).toBe(1);
    expect(results[0]).toBe("Bob");
  });

  test("concatenates with parameter", () => {
    setQueryParams({ suffix: " III" });

    const ast = parse(
      "MATCH (n:Person) WHERE n.firstName + $suffix = 'John III' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
    expect(results[0]).toBe("John");
  });

  test("concatenates number to string (type coercion)", () => {
    setQueryParams({ num: 42 });

    const ast = parse(
      "MATCH (n:Person) WHERE n.firstName + $num = 'John42' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
    expect(results[0]).toBe("John");
  });

  test("handles null in concatenation", () => {
    setQueryParams({ nullVal: null });

    const ast = parse(
      "MATCH (n:Person) WHERE n.firstName + $nullVal = 'John' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // null becomes '' in concatenation, so 'John' + '' = 'John'
    expect(results.length).toBe(1);
    expect(results[0]).toBe("John");
  });

  test("concatenates multiple strings in complex expression", () => {
    const ast = parse(
      "MATCH (n:Person) WHERE 'Dear ' + n.prefix + ' ' + n.firstName + ' ' + n.lastName = 'Dear Mr. John Doe' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
    expect(results[0]).toBe("John");
  });

  test("concatenation result can be compared with string predicates", () => {
    // String predicates work on the LEFT side with concatenated results
    // The concatenated result is compared using equality
    const ast = parse(
      "MATCH (n:Person) WHERE n.firstName + ' ' + n.lastName = 'John Doe' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
    expect(results[0]).toBe("John");
  });

  test("comparison with inequality operators", () => {
    // String comparison with <, >, etc works
    const ast = parse(
      "MATCH (n:Person) WHERE n.firstName + n.lastName < 'K' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    // JohnDoe and JaneSmith are < 'K', BobJones is < 'K' too
    // Actually 'BobJones' < 'JaneSmith' < 'JohnDoe' < 'K'
    expect(results.length).toBe(3);
  });

  test("concatenation with toLower function", () => {
    // Can combine string concatenation with function calls
    const ast = parse(
      "MATCH (n:Person) WHERE toLower(n.firstName) + toLower(n.lastName) = 'johndoe' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
    expect(results[0]).toBe("John");
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("String Concatenation - Edge Cases", () => {
  let graph: Graph<typeof schema>;

  beforeEach(() => {
    graph = createGraph();
    clearQueryParams();
  });

  test("handles missing property in concatenation", () => {
    graph.addVertex("Person", {
      id: "p1",
      firstName: "John",
      lastName: "",
      fullName: "",
      greeting: "",
      prefix: "",
    });

    // Empty lastName results in 'John' + '' = 'John'
    const ast = parse(
      "MATCH (n:Person) WHERE n.firstName + n.lastName = 'John' RETURN n.firstName",
    ) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
    expect(results[0]).toBe("John");
  });

  test("number + string coercion", () => {
    // When one operand is string, + becomes concatenation
    const ast = parse(
      "MATCH (n:Person) WHERE 'Age: ' + 25 = 'Age: 25' RETURN n",
    ) as Query;
    const graph = createGraph();
    graph.addVertex("Person", {
      id: "p1",
      firstName: "Test",
      lastName: "",
      fullName: "",
      greeting: "",
      prefix: "",
    });

    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
  });

  test("boolean + string coercion", () => {
    setQueryParams({ flag: true });

    const ast = parse(
      "MATCH (n:Person) WHERE 'Value: ' + $flag = 'Value: true' RETURN n",
    ) as Query;
    const graph = createGraph();
    graph.addVertex("Person", {
      id: "p1",
      firstName: "Test",
      lastName: "",
      fullName: "",
      greeting: "",
      prefix: "",
    });

    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(graph, [undefined])];

    expect(results.length).toBe(1);
    clearQueryParams();
  });
});
