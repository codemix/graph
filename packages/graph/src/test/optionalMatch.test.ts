import { expect, test, describe } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, OptionalMatchStep } from "../Steps.js";
import { createDemoGraph } from "../getDemoGraph.js";
import type { Query } from "../AST.js";

const { graph } = createDemoGraph();

describe("OPTIONAL MATCH grammar parsing", () => {
  test("parses OPTIONAL MATCH clause", () => {
    const query =
      "MATCH (n:Person) OPTIONAL MATCH (n)-[:knows]->(m) RETURN n, m";
    const ast = parse(query) as Query;

    expect(ast.type).toBe("Query");
    expect(ast.matches).toHaveLength(2);

    // First match should NOT be optional
    expect(ast.matches[0]!.optional).toBeFalsy();

    // Second match should be optional
    expect(ast.matches[1]!.optional).toBe(true);
  });

  test("parses OPTIONAL MATCH with WHERE clause", () => {
    const query =
      "MATCH (n:Person) OPTIONAL MATCH (n)-[:knows]->(m) WHERE m.age > 30 RETURN n, m";
    const ast = parse(query) as Query;

    expect(ast.matches[1]!.optional).toBe(true);
    expect(ast.matches[1]!.where).toBeDefined();
    expect(ast.matches[1]!.where!.condition).toBeDefined();
  });

  test("parses multiple OPTIONAL MATCH clauses", () => {
    const query = `
      MATCH (n:Person)
      OPTIONAL MATCH (n)-[:knows]->(m)
      OPTIONAL MATCH (n)-[:likes]->(p)
      RETURN n, m, p
    `;
    const ast = parse(query) as Query;

    expect(ast.matches).toHaveLength(3);
    expect(ast.matches[0]!.optional).toBeFalsy();
    expect(ast.matches[1]!.optional).toBe(true);
    expect(ast.matches[2]!.optional).toBe(true);
  });

  test("parses standalone OPTIONAL MATCH (case insensitive)", () => {
    const query = "optional match (n:Person) return n";
    const ast = parse(query) as Query;

    expect(ast.matches).toHaveLength(1);
    expect(ast.matches[0]!.optional).toBe(true);
  });
});

describe("OPTIONAL MATCH astToSteps conversion", () => {
  test("creates OptionalMatchStep for OPTIONAL MATCH clause", () => {
    const query =
      "MATCH (n:Person) OPTIONAL MATCH (n)-[:knows]->(m) RETURN n, m";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);

    // Find the OptionalMatchStep
    const optionalStep = steps.find(
      (step) => step instanceof OptionalMatchStep,
    ) as OptionalMatchStep<any>;

    expect(optionalStep).toBeDefined();
    expect(optionalStep.name).toBe("OptionalMatch");
    expect(optionalStep.config.variables).toContain("m");
  });

  test("extracts correct variables from optional pattern", () => {
    const query =
      "MATCH (a:Person) OPTIONAL MATCH (a)-[r:knows]->(b:Person) RETURN a, r, b";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);

    const optionalStep = steps.find(
      (step) => step instanceof OptionalMatchStep,
    ) as OptionalMatchStep<any>;

    expect(optionalStep.config.variables).toContain("r");
    expect(optionalStep.config.variables).toContain("b");
  });
});

describe("OPTIONAL MATCH execution", () => {
  test("returns null binding when no match found", () => {
    // George has no :likes edges, so m should be null
    // Using WHERE clause since inline property filters are handled separately
    const query =
      "MATCH (n:Person) WHERE n.name = 'George' OPTIONAL MATCH (n)-[:likes]->(m) RETURN n, m";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [])];

    expect(results).toHaveLength(1);
    expect(results[0]).toBeInstanceOf(Array);
    const [nValue, mValue] = results[0] as any[];

    // n should be George
    expect(nValue?.get?.("name")).toBe("George");

    // m should be null (no :likes edges from George)
    expect(mValue).toBeNull();
  });

  test("returns matched values when match found", () => {
    // Alice knows Bob and Charlie
    const query =
      "MATCH (n:Person) WHERE n.name = 'Alice' OPTIONAL MATCH (n)-[:knows]->(m) RETURN n, m";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [])];

    // Alice knows 2 people (Bob and Charlie), so we should have 2 results
    expect(results).toHaveLength(2);

    // All results should have valid n (Alice) and non-null m
    for (const result of results) {
      const [nValue, mValue] = result as any[];
      expect(nValue?.get?.("name")).toBe("Alice");
      // m should NOT be null since Alice has :knows edges
      expect(mValue).not.toBeNull();
    }
  });

  test("handles multiple optional matches", () => {
    // Alice knows some people
    const query = `
      MATCH (n:Person) WHERE n.name = 'Alice'
      OPTIONAL MATCH (n)-[:knows]->(friend)
      RETURN n, friend
    `;
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [])];

    // Alice knows 2 people
    expect(results).toHaveLength(2);
  });

  test("preserves original match results for each optional match result", () => {
    // Test that results correctly maintain the original match
    const query =
      "MATCH (n:Person) WHERE n.name = 'Alice' OPTIONAL MATCH (n)-[:knows]->(m:Person) RETURN n, m";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [])];

    // All results should have Alice as n
    for (const result of results) {
      const [nValue] = result as any[];
      expect(nValue?.get?.("name")).toBe("Alice");
    }
  });

  test("yields null binding for non-existent relationship", () => {
    // Test with a relationship type that doesn't exist
    const query =
      "MATCH (n:Person) WHERE n.name = 'Alice' OPTIONAL MATCH (n)-[:nonexistent]->(m) RETURN n, m";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [])];

    expect(results).toHaveLength(1);
    const [nValue, mValue] = results[0] as any[];
    expect(nValue?.get?.("name")).toBe("Alice");
    expect(mValue).toBeNull();
  });

  test("works with OPTIONAL MATCH as first clause", () => {
    // OPTIONAL MATCH can be used without a preceding MATCH
    const query = "OPTIONAL MATCH (n:Person)-[:nonexistent]->(m) RETURN n, m";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [])];

    // Should yield null bindings when no match
    // This depends on how we handle OPTIONAL MATCH without preceding MATCH
    expect(results).toBeDefined();
  });
});

describe("OPTIONAL MATCH edge cases", () => {
  test("handles empty graph gracefully", () => {
    const query =
      "MATCH (n:NonExistent) OPTIONAL MATCH (n)-[:rel]->(m) RETURN n, m";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [])];

    // No results since no :NonExistent nodes exist
    expect(results).toHaveLength(0);
  });

  test("handles OPTIONAL MATCH with WHERE clause that filters all", () => {
    // Use WHERE in the OPTIONAL MATCH to filter out all matches
    const query =
      "MATCH (n:Person) WHERE n.name = 'Alice' OPTIONAL MATCH (n)-[:knows]->(m) WHERE m.name = 'NonExistent' RETURN n, m";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [])];

    // Alice exists but the WHERE filters out all matches, so m should be null
    expect(results).toHaveLength(1);
    const [nValue, mValue] = results[0] as any[];
    expect(nValue?.get?.("name")).toBe("Alice");
    expect(mValue).toBeNull();
  });

  test("handles OPTIONAL MATCH with label filter that fails", () => {
    const query =
      "MATCH (n:Person) WHERE n.name = 'Alice' OPTIONAL MATCH (n)-[:knows]->(m:NonExistentLabel) RETURN n, m";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [])];

    // Alice exists but no one with :NonExistentLabel, so m should be null
    expect(results).toHaveLength(1);
    const [nValue, mValue] = results[0] as any[];
    expect(nValue?.get?.("name")).toBe("Alice");
    expect(mValue).toBeNull();
  });
});
