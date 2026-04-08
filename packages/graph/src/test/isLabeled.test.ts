import { test, expect, beforeEach, describe } from "vitest";
import { parse } from "../grammar.js";
import { Graph } from "../Graph.js";
import { GraphSchema } from "../GraphSchema.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import type { Query, IsLabeledCondition } from "../AST.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Tests for IS LABELED Predicate
 *
 * Syntax: variable IS :Label or variable IS :LabelExpression
 *
 * Supports:
 * - n IS :Person - true if n has the Person label
 * - n IS :Person|Admin - true if n has Person OR Admin label
 * - n IS :!Person - true if n does NOT have Person label
 * - n IS NOT :Person - negated form
 * - Combined with other conditions using AND/OR
 */

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
        name: { type: makeType<string>("") },
        age: { type: makeType<number>(0) },
      },
    },
    Admin: {
      properties: {
        name: { type: makeType<string>("") },
      },
    },
    Employee: {
      properties: {
        name: { type: makeType<string>("") },
      },
    },
  },
  edges: {
    knows: { properties: {} },
    manages: { properties: {} },
  },
} as const satisfies GraphSchema;

let g: Graph<typeof schema>;

function createGraph() {
  return new Graph({ schema, storage: new InMemoryGraphStorage() });
}

let alice: ReturnType<typeof g.addVertex>;
let bob: ReturnType<typeof g.addVertex>;
let charlie: ReturnType<typeof g.addVertex>;
let david: ReturnType<typeof g.addVertex>;

beforeEach(() => {
  // Create a fresh graph for each test
  g = createGraph();

  // Add vertices with various labels
  alice = g.addVertex("Person", { name: "Alice", age: 30 });
  bob = g.addVertex("Person", { name: "Bob", age: 25 });
  charlie = g.addVertex("Admin", { name: "Charlie" });
  david = g.addVertex("Employee", { name: "David" });

  // Add some edges
  g.addEdge(alice, "knows", bob, {});
  g.addEdge(charlie, "manages", david, {});
});

/**
 * Grammar Parsing Tests
 */
describe("Grammar Parsing", () => {
  test("parses simple IS :Label condition", () => {
    const ast = parse("MATCH (n) WHERE n IS :Person RETURN n") as Query;
    expect(ast.matches[0]!.where).toBeDefined();
    const condition = ast.matches[0]!.where!.condition as IsLabeledCondition;
    expect(condition.type).toBe("IsLabeledCondition");
    expect(condition.variable).toBe("n");
    expect((condition.labelExpression as any).type).toBe("LabelName");
    expect((condition.labelExpression as any).name).toBe("Person");
  });

  test("parses IS with OR label expression :A|B", () => {
    const ast = parse("MATCH (n) WHERE n IS :Person|Admin RETURN n") as Query;
    expect(ast.matches[0]!.where).toBeDefined();
    const condition = ast.matches[0]!.where!.condition as IsLabeledCondition;
    expect(condition.type).toBe("IsLabeledCondition");
    const expr = condition.labelExpression as { type: string };
    expect(expr.type).toBe("LabelOr");
  });

  test("parses IS with NOT label expression :!A", () => {
    const ast = parse("MATCH (n) WHERE n IS :!Person RETURN n") as Query;
    expect(ast.matches[0]!.where).toBeDefined();
    const condition = ast.matches[0]!.where!.condition as IsLabeledCondition;
    expect(condition.type).toBe("IsLabeledCondition");
    const expr = condition.labelExpression as { type: string };
    expect(expr.type).toBe("LabelNot");
  });

  test("parses IS NOT :Label negated form", () => {
    const ast = parse("MATCH (n) WHERE n IS NOT :Person RETURN n") as Query;
    expect(ast.matches[0]!.where).toBeDefined();
    const condition = ast.matches[0]!.where!.condition as any;
    // IS NOT becomes NotCondition wrapping IsLabeledCondition
    expect(condition.type).toBe("NotCondition");
    expect(condition.condition.type).toBe("IsLabeledCondition");
  });

  test("parses IS with wildcard :% ", () => {
    const ast = parse("MATCH (n) WHERE n IS :% RETURN n") as Query;
    expect(ast.matches[0]!.where).toBeDefined();
    const condition = ast.matches[0]!.where!.condition as IsLabeledCondition;
    expect(condition.type).toBe("IsLabeledCondition");
    const expr = condition.labelExpression as { type: string };
    expect(expr.type).toBe("LabelWildcard");
  });

  test("parses IS with AND label expression :A&B", () => {
    const ast = parse("MATCH (n) WHERE n IS :Person&Admin RETURN n") as Query;
    expect(ast.matches[0]!.where).toBeDefined();
    const condition = ast.matches[0]!.where!.condition as IsLabeledCondition;
    expect(condition.type).toBe("IsLabeledCondition");
    const expr = condition.labelExpression as { type: string };
    expect(expr.type).toBe("LabelAnd");
  });

  test("parses IS with parenthesized expression", () => {
    const ast = parse("MATCH (n) WHERE n IS :(Person|Admin)&!Employee RETURN n") as Query;
    expect(ast.matches[0]!.where).toBeDefined();
    const condition = ast.matches[0]!.where!.condition as IsLabeledCondition;
    expect(condition.type).toBe("IsLabeledCondition");
    // The expression is (Person|Admin)&!Employee which is LabelAnd at top level
    const expr = condition.labelExpression as { type: string };
    expect(expr.type).toBe("LabelAnd");
  });

  test("parses IS combined with AND condition", () => {
    const ast = parse("MATCH (n) WHERE n IS :Person AND n.age > 20 RETURN n") as Query;
    expect(ast.matches[0]!.where).toBeDefined();
    const condition = ast.matches[0]!.where!.condition as any;
    expect(condition.type).toBe("AndCondition");
    expect(condition.left.type).toBe("IsLabeledCondition");
    // The right side is a PropertyCondition (property comparison)
    // n.age > 20 parses as PropertyCondition or ExpressionCondition depending on grammar
    expect(["PropertyCondition", "ExpressionCondition"]).toContain(condition.right.type);
  });
});

/**
 * Step Conversion Tests
 */
describe("Step Conversion", () => {
  test("converts IsLabeledCondition to steps", () => {
    const ast = parse("MATCH (n) WHERE n IS :Person RETURN n") as Query;
    const steps = astToSteps(ast);
    expect(steps.length).toBeGreaterThan(0);
    // Should have a FilterElementsStep with isLabeled condition
    const filterStep = steps.find((s) => s.name === "FilterElements");
    expect(filterStep).toBeDefined();
  });

  test("converts negated IsLabeledCondition to steps", () => {
    const ast = parse("MATCH (n) WHERE n IS NOT :Person RETURN n") as Query;
    const steps = astToSteps(ast);
    expect(steps.length).toBeGreaterThan(0);
    const filterStep = steps.find((s) => s.name === "FilterElements");
    expect(filterStep).toBeDefined();
  });
});

/**
 * Query Execution Tests
 */
describe("Query Execution", () => {
  test("filters by single label", () => {
    const query = "MATCH (n) WHERE n IS :Person RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(g, [undefined])] as string[];

    expect(results).toHaveLength(2);
    expect(results.sort()).toEqual(["Alice", "Bob"]);
  });

  test("filters with OR label expression", () => {
    const query = "MATCH (n) WHERE n IS :Person|Admin RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(g, [undefined])] as string[];

    expect(results).toHaveLength(3);
    expect(results.sort()).toEqual(["Alice", "Bob", "Charlie"]);
  });

  test("filters with NOT label expression", () => {
    const query = "MATCH (n) WHERE n IS :!Person RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(g, [undefined])] as string[];

    expect(results).toHaveLength(2);
    expect(results.sort()).toEqual(["Charlie", "David"]);
  });

  test("filters with IS NOT :Label", () => {
    const query = "MATCH (n) WHERE n IS NOT :Person RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(g, [undefined])] as string[];

    expect(results).toHaveLength(2);
    expect(results.sort()).toEqual(["Charlie", "David"]);
  });

  test("filters with wildcard :% matches any label", () => {
    const query = "MATCH (n) WHERE n IS :% RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(g, [undefined])] as string[];

    // All nodes have labels
    expect(results).toHaveLength(4);
  });

  test("IS :Label combined with property condition", () => {
    const query = "MATCH (n) WHERE n IS :Person AND n.age > 26 RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(g, [undefined])] as string[];

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Alice");
  });

  test("IS :Label with relationship traversal", () => {
    const query =
      "MATCH (a)-[:knows]->(b) WHERE a IS :Person AND b IS :Person RETURN a.name, b.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(g, [undefined])];

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["Alice", "Bob"]);
  });

  test("IS :Label in OR condition", () => {
    const query = "MATCH (n) WHERE n IS :Person OR n IS :Admin RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(g, [undefined])] as string[];

    expect(results).toHaveLength(3);
    expect(results.sort()).toEqual(["Alice", "Bob", "Charlie"]);
  });

  test("NOT (n IS :Person) - double negation test", () => {
    const query = "MATCH (n) WHERE NOT (n IS :Person) RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(g, [undefined])] as string[];

    expect(results).toHaveLength(2);
    expect(results.sort()).toEqual(["Charlie", "David"]);
  });

  test("handles non-existent label", () => {
    const query = "MATCH (n) WHERE n IS :NonExistent RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(g, [undefined])];

    expect(results).toHaveLength(0);
  });
});

/**
 * Edge Cases
 */
describe("Edge Cases", () => {
  test("IS :Label on relationship pattern variable - checks edge type", () => {
    // This tests using IS on a relationship variable
    const query = "MATCH (a)-[r]->(b) WHERE r IS :knows RETURN a.name, b.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(g, [undefined])];

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["Alice", "Bob"]);
  });

  test("IS :Label with backtick-quoted identifier", () => {
    const query = "MATCH (n) WHERE n IS :`Person` RETURN n.name";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);
    const results = [...traverser.traverse(g, [undefined])] as string[];

    expect(results).toHaveLength(2);
    expect(results.sort()).toEqual(["Alice", "Bob"]);
  });
});
