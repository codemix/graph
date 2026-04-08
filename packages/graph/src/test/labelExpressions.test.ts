import { test, expect, beforeEach } from "vitest";
import { parse } from "../grammar.js";
import { Graph } from "../Graph.js";
import { GraphSchema } from "../GraphSchema.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import type { Query, NodePattern, LabelExpression } from "../AST.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Tests for Advanced Label Expressions
 *
 * Supports:
 * - :A|B (OR) - matches nodes with label A or B
 * - :A&B (AND) - matches nodes with label A and B (semantic: node has both labels)
 * - :!A (NOT) - matches nodes without label A
 * - :% (wildcard) - matches any node with a label
 * - Parenthesized: :(A|B)&C
 * - Combinations of above
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
    Manager: {
      properties: {
        name: { type: makeType<string>("") },
      },
    },
  },
  edges: {
    knows: { properties: {} },
    reports_to: { properties: {} },
  },
} as const satisfies GraphSchema;

let g: Graph<typeof schema>;

function createGraph() {
  return new Graph({ schema, storage: new InMemoryGraphStorage() });
}

let person1: ReturnType<typeof g.addVertex>;
let person2: ReturnType<typeof g.addVertex>;
let admin1: ReturnType<typeof g.addVertex>;
let employee1: ReturnType<typeof g.addVertex>;
let manager1: ReturnType<typeof g.addVertex>;

beforeEach(() => {
  // Create a fresh graph for each test
  g = createGraph();

  // Add vertices with various labels
  person1 = g.addVertex("Person", { name: "Alice" });
  person2 = g.addVertex("Person", { name: "Bob" });
  admin1 = g.addVertex("Admin", { name: "Charlie" });
  employee1 = g.addVertex("Employee", { name: "David" });
  manager1 = g.addVertex("Manager", { name: "Eve" });

  // Add some edges
  g.addEdge(person1, "knows", admin1, {});
  g.addEdge(person2, "knows", employee1, {});
  g.addEdge(admin1, "reports_to", manager1, {});
});

/**
 * Grammar Parsing Tests
 */

test("Grammar - parses single label :Person", () => {
  const ast = parse("MATCH (n:Person) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern!;
  const node = (pattern as any).elements[0] as NodePattern;
  expect(node.labels).toEqual(["Person"]);
  expect(node.labelExpression).toBeUndefined();
});

test("Grammar - parses OR label expression :A|B", () => {
  const ast = parse("MATCH (n:Person|Admin) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern!;
  const node = (pattern as any).elements[0] as NodePattern;
  expect(node.labels).toEqual([]); // OR uses labelExpression
  expect(node.labelExpression).toBeDefined();
  expect(node.labelExpression!.type).toBe("LabelOr");
});

test("Grammar - parses AND label expression :A&B", () => {
  const ast = parse("MATCH (n:Person&Admin) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern!;
  const node = (pattern as any).elements[0] as NodePattern;
  expect(node.labels).toEqual([]);
  expect(node.labelExpression).toBeDefined();
  expect(node.labelExpression!.type).toBe("LabelAnd");
});

test("Grammar - parses NOT label expression :!A", () => {
  const ast = parse("MATCH (n:!Person) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern!;
  const node = (pattern as any).elements[0] as NodePattern;
  expect(node.labels).toEqual([]);
  expect(node.labelExpression).toBeDefined();
  expect(node.labelExpression!.type).toBe("LabelNot");
});

test("Grammar - parses wildcard label expression :%", () => {
  const ast = parse("MATCH (n:%) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern!;
  const node = (pattern as any).elements[0] as NodePattern;
  expect(node.labels).toEqual([]);
  expect(node.labelExpression).toBeDefined();
  expect(node.labelExpression!.type).toBe("LabelWildcard");
});

test("Grammar - parses parenthesized label expression :(A|B)", () => {
  const ast = parse("MATCH (n:(Person|Admin)) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern!;
  const node = (pattern as any).elements[0] as NodePattern;
  expect(node.labels).toEqual([]);
  expect(node.labelExpression).toBeDefined();
  expect(node.labelExpression!.type).toBe("LabelOr");
});

test("Grammar - parses complex expression :(A|B)&!C", () => {
  const ast = parse("MATCH (n:(Person|Admin)&!Manager) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern!;
  const node = (pattern as any).elements[0] as NodePattern;
  expect(node.labels).toEqual([]);
  expect(node.labelExpression).toBeDefined();
  // Top level should be AND
  expect(node.labelExpression!.type).toBe("LabelAnd");
});

test("Grammar - preserves backwards-compatible multi-label :A:B:C", () => {
  const ast = parse("MATCH (n:Person:Admin:Manager) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern!;
  const node = (pattern as any).elements[0] as NodePattern;
  expect(node.labels).toEqual(["Person", "Admin", "Manager"]);
  expect(node.labelExpression).toBeUndefined();
});

test("Grammar - operator precedence: NOT > AND > OR", () => {
  const ast = parse("MATCH (n:A|B&!C) RETURN n") as Query;
  const pattern = ast.matches[0]!.pattern!;
  const node = (pattern as any).elements[0] as NodePattern;
  expect(node.labelExpression).toBeDefined();

  // Should parse as: A | (B & (!C))
  const expr = node.labelExpression as LabelExpression;
  expect(expr.type).toBe("LabelOr");

  // Left side should be LabelName "A"
  const orExpr = expr as {
    type: "LabelOr";
    left: LabelExpression;
    right: LabelExpression;
  };
  expect(orExpr.left.type).toBe("LabelName");
  expect((orExpr.left as { type: "LabelName"; name: string }).name).toBe("A");

  // Right side should be LabelAnd
  expect(orExpr.right.type).toBe("LabelAnd");
});

/**
 * Query Execution Tests
 */

test("Execution - OR label expression matches correct nodes", () => {
  const ast = parse("MATCH (n:Person|Admin) RETURN n.name") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  // Should match Alice (Person), Bob (Person), Charlie (Admin)
  expect(results).toHaveLength(3);
  expect(results).toContain("Alice");
  expect(results).toContain("Bob");
  expect(results).toContain("Charlie");
});

test("Execution - NOT label expression excludes correct nodes", () => {
  const ast = parse("MATCH (n:!Person) RETURN n.name") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  // Should match Admin, Employee, Manager (not Person)
  expect(results).toHaveLength(3);
  expect(results).toContain("Charlie");
  expect(results).toContain("David");
  expect(results).toContain("Eve");
});

test("Execution - wildcard label expression matches all labeled nodes", () => {
  const ast = parse("MATCH (n:%) RETURN n.name") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  // Should match all nodes (they all have labels)
  expect(results).toHaveLength(5);
});

test("Execution - complex expression (A|B)&!C", () => {
  const ast = parse("MATCH (n:(Person|Admin)&!Manager) RETURN n.name") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  // Should match Person and Admin, but not Manager
  // Our graph has Person (Alice, Bob), Admin (Charlie), but no Manager is Person|Admin
  expect(results).toHaveLength(3);
  expect(results).toContain("Alice");
  expect(results).toContain("Bob");
  expect(results).toContain("Charlie");
});

test("Execution - OR with three labels", () => {
  const ast = parse("MATCH (n:Person|Admin|Manager) RETURN n.name") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  // Should match Person, Admin, Manager
  expect(results).toHaveLength(4);
  expect(results).toContain("Alice");
  expect(results).toContain("Bob");
  expect(results).toContain("Charlie");
  expect(results).toContain("Eve");
});

test("Execution - double NOT :!!A", () => {
  const ast = parse("MATCH (n:!!Person) RETURN n.name") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  // Double NOT should be equivalent to just :Person
  expect(results).toHaveLength(2);
  expect(results).toContain("Alice");
  expect(results).toContain("Bob");
});

test("Execution - NOT wildcard :!%", () => {
  // Note: This should match nothing since all our nodes have labels
  const ast = parse("MATCH (n:!%) RETURN n.name") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  expect(results).toHaveLength(0);
});

test("Execution - label expression with edge pattern", () => {
  const ast = parse("MATCH (a:Person)-[:knows]->(b:!Person) RETURN a.name, b.name") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  // Person nodes knowing non-Person nodes
  // Alice knows Charlie (Admin), Bob knows David (Employee)
  expect(results).toHaveLength(2);
});

/**
 * Edge Cases
 */

test("Edge case - empty result when no match", () => {
  const ast = parse("MATCH (n:NonExistent) RETURN n") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  expect(results).toHaveLength(0);
});

test("Edge case - NOT on non-existent label matches all", () => {
  const ast = parse("MATCH (n:!NonExistent) RETURN n.name") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  // All nodes don't have "NonExistent" label
  expect(results).toHaveLength(5);
});

test("Edge case - OR with same label twice", () => {
  const ast = parse("MATCH (n:Person|Person) RETURN n.name") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  // Should still match only Person nodes (no duplicates)
  expect(results).toHaveLength(2);
  expect(results).toContain("Alice");
  expect(results).toContain("Bob");
});

/**
 * Tests for backwards compatibility
 */

test("Backwards compatibility - simple single label still works", () => {
  const ast = parse("MATCH (n:Person) RETURN n.name") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  expect(results).toHaveLength(2);
  expect(results).toContain("Alice");
  expect(results).toContain("Bob");
});

test("Backwards compatibility - no label matches all", () => {
  const ast = parse("MATCH (n) RETURN n.name") as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(g, [undefined]));

  expect(results).toHaveLength(5);
});
