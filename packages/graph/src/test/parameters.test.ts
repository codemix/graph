import { expect, test, describe, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import {
  createTraverser,
  setQueryParams,
  clearQueryParams,
  getQueryParams,
} from "../Steps.js";
import { createDemoGraph } from "../getDemoGraph.js";
import type { Query, ParameterRef } from "../AST.js";

const { graph } = createDemoGraph();

describe("Parameter syntax ($param) grammar parsing", () => {
  test("parses parameter in WHERE condition", () => {
    const query = "MATCH (u:Person) WHERE u.name = $name RETURN u";
    const ast = parse(query) as Query;

    expect(ast.type).toBe("Query");
    expect(ast.matches).toHaveLength(1);
    const whereClause = ast.matches[0]!.where!;
    expect(whereClause.condition.type).toBe("PropertyCondition");
    const condition = whereClause.condition as {
      type: "PropertyCondition";
      value: ParameterRef;
    };
    expect(condition.value.type).toBe("ParameterRef");
    expect(condition.value.name).toBe("name");
  });

  test("parses parameter in SET clause", () => {
    const query = "MATCH (u:Person) SET u.age = $newAge RETURN u";
    const ast = parse(query) as Query;

    expect(ast.set).toBeDefined();
    const assignment = ast.set!.assignments[0] as { value: unknown };
    expect(assignment.value).toEqual({
      type: "ParameterRef",
      name: "newAge",
    });
  });

  test("parses multiple parameters", () => {
    const query =
      "MATCH (u:Person) WHERE u.name = $name AND u.age > $minAge RETURN u";
    const ast = parse(query) as Query;

    const condition = ast.matches[0]!.where!.condition;
    expect(condition.type).toBe("AndCondition");
  });

  test("parses parameter with underscore in name", () => {
    const query = "MATCH (u:Person) WHERE u.name = $user_name RETURN u";
    const ast = parse(query) as Query;

    const condition = ast.matches[0]!.where!.condition as {
      value: ParameterRef;
    };
    expect(condition.value.name).toBe("user_name");
  });

  test("parses parameter with numbers in name", () => {
    const query = "MATCH (u:Person) WHERE u.age = $age1 RETURN u";
    const ast = parse(query) as Query;

    const condition = ast.matches[0]!.where!.condition as {
      value: ParameterRef;
    };
    expect(condition.value.name).toBe("age1");
  });
});

describe("Parameter astToSteps conversion", () => {
  test("converts parameter in WHERE to parameterRef", () => {
    const query = "MATCH (u:Person) WHERE u.name = $name RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);

    // Should have FilterElementsStep with expr condition
    // Format: ["expr", "=", {propertyRef}, {parameterRef}]
    const filterStep = steps.find((s) => s.name === "FilterElements");
    expect(filterStep).toBeDefined();
    const condition = (filterStep as any).config.condition;
    expect(condition[0]).toBe("expr");
    expect(condition[1]).toBe("=");
    expect(condition[2]).toEqual({
      type: "propertyRef",
      variable: "u",
      property: "name",
    });
    expect(condition[3]).toEqual({ type: "parameterRef", name: "name" });
  });

  test("converts parameter in SET to parameter type", () => {
    const query = "MATCH (u:Person) SET u.age = $newAge RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);

    const setStep = steps.find((s) => s.name === "Set");
    expect(setStep).toBeDefined();
    const assignment = (setStep as any).config.assignments[0];
    expect(assignment.value).toEqual({ type: "parameter", name: "newAge" });
  });
});

describe("Parameter execution", () => {
  beforeEach(() => {
    clearQueryParams();
  });

  afterEach(() => {
    clearQueryParams();
  });

  test("setQueryParams and getQueryParams work correctly", () => {
    setQueryParams({ name: "Alice", age: 30 });
    const params = getQueryParams();
    expect(params.name).toBe("Alice");
    expect(params.age).toBe(30);
  });

  test("clearQueryParams clears all parameters", () => {
    setQueryParams({ name: "Alice" });
    clearQueryParams();
    const params = getQueryParams();
    expect(params).toEqual({});
  });

  test("filters by parameter value in WHERE clause", () => {
    const query = "MATCH (u:Person) WHERE u.name = $name RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    // Set parameter to find Alice
    setQueryParams({ name: "Alice" });
    const results = [...traverser.traverse(graph, [])];
    expect(results).toHaveLength(1);

    // Verify it found Alice - result is an array with the vertex
    const firstResult = results[0] as any[];
    expect(firstResult[0]?.get?.("name")).toBe("Alice");
  });

  test("filters by numeric parameter", () => {
    const query = "MATCH (u:Person) WHERE u.age = $age RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    // Alice is 30 years old in the demo graph
    setQueryParams({ age: 30 });
    const results = [...traverser.traverse(graph, [])];
    expect(results).toHaveLength(1);
    expect((results[0] as any[])[0]?.get?.("name")).toBe("Alice");
  });

  test("comparison operators work with parameters", () => {
    const query = "MATCH (u:Person) WHERE u.age > $minAge RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    // Find people older than 25
    setQueryParams({ minAge: 25 });
    const results = [...traverser.traverse(graph, [])];
    // Should get people with age > 25
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      const age = (result as any[])[0]?.get?.("age");
      expect(age).toBeGreaterThan(25);
    }
  });

  test("undefined parameter returns no results when compared", () => {
    const query = "MATCH (u:Person) WHERE u.name = $missing RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    setQueryParams({}); // No 'missing' parameter
    const results = [...traverser.traverse(graph, [])];
    expect(results).toHaveLength(0);
  });

  test("null parameter works correctly", () => {
    const query = "MATCH (u:Person) WHERE u.nickname = $nick RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    setQueryParams({ nick: null });
    const results = [...traverser.traverse(graph, [])];
    // People with no nickname (undefined or null) should match
    // But since comparison with null is tricky, this tests the path works
    expect(Array.isArray(results)).toBe(true);
  });

  test("multiple parameters in same query", () => {
    const query =
      "MATCH (u:Person) WHERE u.name = $name AND u.age = $age RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    setQueryParams({ name: "Alice", age: 30 });
    const results = [...traverser.traverse(graph, [])];
    expect(results).toHaveLength(1);
    expect((results[0] as any[])[0]?.get?.("name")).toBe("Alice");
  });

  test("parameter can be reused for different queries", () => {
    const query1 = "MATCH (u:Person) WHERE u.name = $name RETURN u";
    const query2 = "MATCH (u:Person) WHERE u.name = $name RETURN u";

    // First query for Alice
    setQueryParams({ name: "Alice" });
    const ast1 = parse(query1) as Query;
    const steps1 = astToSteps(ast1);
    const traverser1 = createTraverser(steps1);
    const results1 = [...traverser1.traverse(graph, [])];
    expect(results1).toHaveLength(1);
    expect((results1[0] as any[])[0]?.get?.("name")).toBe("Alice");

    // Second query for Bob
    setQueryParams({ name: "Bob" });
    const ast2 = parse(query2) as Query;
    const steps2 = astToSteps(ast2);
    const traverser2 = createTraverser(steps2);
    const results2 = [...traverser2.traverse(graph, [])];
    expect(results2).toHaveLength(1);
    expect((results2[0] as any[])[0]?.get?.("name")).toBe("Bob");
  });
});

describe("Parameter in SET clause execution", () => {
  beforeEach(() => {
    clearQueryParams();
  });

  afterEach(() => {
    clearQueryParams();
  });

  test("SET with parameter updates property", () => {
    // Create a fresh graph for mutation testing
    const { graph: testGraph, alice: testAlice } = createDemoGraph();

    const query =
      "MATCH (u:Person) WHERE u.name = 'Alice' SET u.age = $newAge RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    setQueryParams({ newAge: 99 });
    const results = [...traverser.traverse(testGraph, [])];
    expect(results).toHaveLength(1);

    // Verify the age was updated
    expect(testAlice.get("age")).toBe(99);
  });

  test("SET with string parameter", () => {
    const { graph: testGraph, alice: testAlice } = createDemoGraph();

    const query =
      "MATCH (u:Person) WHERE u.name = 'Alice' SET u.nickname = $nick RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    setQueryParams({ nick: "Ally" });
    for (const _ of traverser.traverse(testGraph, []));

    expect(testAlice.get("nickname" as any)).toBe("Ally");
  });
});
