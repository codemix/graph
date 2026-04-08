import { expect, test, describe } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, WithStep } from "../Steps.js";
import { createDemoGraph } from "../getDemoGraph.js";
import type { Query } from "../AST.js";

const { graph } = createDemoGraph();

describe("WITH clause grammar parsing", () => {
  test("parses simple WITH clause", () => {
    const query = "MATCH (u:Person) WITH u RETURN u";
    const ast = parse(query) as Query;

    expect(ast.type).toBe("Query");
    expect(ast.matches).toHaveLength(1);
    expect(ast.with).toHaveLength(1);

    const withClause = ast.with![0]!;
    expect(withClause.type).toBe("WithClause");
    expect(withClause.distinct).toBe(false);
    expect(withClause.items).toHaveLength(1);
    expect(withClause.items[0]!.alias).toBe("u");
  });

  test("parses WITH clause with alias", () => {
    const query = "MATCH (u:Person) WITH u AS person RETURN person";
    const ast = parse(query) as Query;

    expect(ast.with).toHaveLength(1);
    const withClause = ast.with![0]!;
    expect(withClause.items[0]!.alias).toBe("person");
    expect(withClause.items[0]!.expression).toEqual({
      type: "VariableRef",
      variable: "u",
    });
  });

  test("parses WITH DISTINCT", () => {
    const query = "MATCH (u:Person) WITH DISTINCT u RETURN u";
    const ast = parse(query) as Query;

    expect(ast.with![0]!.distinct).toBe(true);
  });

  test("parses WITH with multiple items", () => {
    const query = "MATCH (u:Person)-[:knows]->(f:Person) WITH u, f RETURN u, f";
    const ast = parse(query) as Query;

    expect(ast.with![0]!.items).toHaveLength(2);
    expect(ast.with![0]!.items[0]!.alias).toBe("u");
    expect(ast.with![0]!.items[1]!.alias).toBe("f");
  });

  test("parses WITH with property access", () => {
    const query = "MATCH (u:Person) WITH u.name AS name RETURN name";
    const ast = parse(query) as Query;

    const item = ast.with![0]!.items[0]!;
    expect(item.alias).toBe("name");
    expect(item.expression).toEqual({
      type: "PropertyAccess",
      variable: "u",
      property: "name",
    });
  });

  test("parses WITH with COUNT aggregate", () => {
    const query =
      "MATCH (u:Person)-[:knows]->(f) WITH u, COUNT(f) AS friendCount RETURN u, friendCount";
    const ast = parse(query) as Query;

    expect(ast.with![0]!.items).toHaveLength(2);
    const countItem = ast.with![0]!.items[1]!;
    expect(countItem.alias).toBe("friendCount");
    expect(countItem.expression).toEqual({
      type: "WithAggregate",
      function: "COUNT",
      variable: "f",
    });
  });

  test("parses WITH with ORDER BY", () => {
    const query = "MATCH (u:Person) WITH u ORDER BY u.name RETURN u";
    const ast = parse(query) as Query;

    expect(ast.with![0]!.orderBy).toBeDefined();
    expect(ast.with![0]!.orderBy!.orders).toHaveLength(1);
    expect(ast.with![0]!.orderBy!.orders[0]!.property).toBe("name");
    expect(ast.with![0]!.orderBy!.orders[0]!.direction).toBe("ASC");
  });

  test("parses WITH with SKIP and LIMIT", () => {
    const query = "MATCH (u:Person) WITH u SKIP 5 LIMIT 10 RETURN u";
    const ast = parse(query) as Query;

    expect(ast.with![0]!.skip).toBe(5);
    expect(ast.with![0]!.limit).toBe(10);
  });

  test("parses WITH with WHERE", () => {
    const query = "MATCH (u:Person) WITH u WHERE u.age > 18 RETURN u";
    const ast = parse(query) as Query;

    expect(ast.with![0]!.where).toBeDefined();
    expect(ast.with![0]!.where!.condition.type).toBe("PropertyCondition");
  });

  test("parses multiple WITH clauses", () => {
    const query = "MATCH (u:Person) WITH u WITH u AS person RETURN person";
    const ast = parse(query) as Query;

    expect(ast.with).toHaveLength(2);
  });

  test("parses WITH with COLLECT aggregate", () => {
    const query =
      "MATCH (u:Person)-[:knows]->(f) WITH u, COLLECT(f) AS friends RETURN u, friends";
    const ast = parse(query) as Query;

    const collectItem = ast.with![0]!.items[1]!;
    expect(collectItem.expression).toEqual({
      type: "WithAggregate",
      function: "COLLECT",
      variable: "f",
    });
  });

  test("parses WITH with SUM aggregate", () => {
    const query =
      "MATCH (u:Person) WITH SUM(u.age) AS totalAge RETURN totalAge";
    const ast = parse(query) as Query;

    const sumItem = ast.with![0]!.items[0]!;
    expect(sumItem.expression).toEqual({
      type: "WithAggregate",
      function: "SUM",
      variable: "u",
      property: "age",
    });
  });
});

describe("WITH clause step conversion", () => {
  test("converts WITH clause to WithStep", () => {
    const query = "MATCH (u:Person) WITH u RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);

    // Find the WithStep
    const withStep = steps.find((s) => s.name === "With") as WithStep;
    expect(withStep).toBeDefined();
    expect(withStep.config.distinct).toBe(false);
    expect(withStep.config.items).toHaveLength(1);
    expect(withStep.config.items[0]!.type).toBe("variable");
  });

  test("converts WITH DISTINCT to WithStep with distinct flag", () => {
    const query = "MATCH (u:Person) WITH DISTINCT u RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);

    const withStep = steps.find((s) => s.name === "With") as WithStep;
    expect(withStep.config.distinct).toBe(true);
  });
});

describe("WITH clause execution", () => {
  test("basic WITH clause passes through results", () => {
    const query = "MATCH (u:Person) WITH u RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results.length).toBeGreaterThan(0);
  });

  test("WITH clause with LIMIT limits results", () => {
    const query = "MATCH (u:Person) WITH u LIMIT 2 RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results.length).toBe(2);
  });

  test("WITH clause with SKIP skips results", () => {
    const query = "MATCH (u:Person) WITH u SKIP 3 RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    // Get all person count first
    const allQuery = "MATCH (u:Person) RETURN u";
    const allAst = parse(allQuery) as Query;
    const allSteps = astToSteps(allAst);
    const allTraverser = createTraverser(allSteps);
    const allResults = [...allTraverser.traverse(graph, [undefined])];

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results.length).toBe(Math.max(0, allResults.length - 3));
  });

  test("WITH DISTINCT deduplicates results", () => {
    // This test creates duplicates through edge traversal
    const query = "MATCH (u:Person)-[:knows]->() WITH DISTINCT u RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];

    // All results should be unique (check by extracting ids)
    const ids = results.map((r: any) => {
      if (r && typeof r === "object" && "id" in r) {
        return r.id;
      }
      if (
        Array.isArray(r) &&
        r[0] &&
        typeof r[0] === "object" &&
        "id" in r[0]
      ) {
        return r[0].id;
      }
      return JSON.stringify(r);
    });
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test("WITH clause with COUNT aggregate", () => {
    const query =
      "MATCH (u:Person)-[:knows]->(f) WITH COUNT(f) AS cnt RETURN cnt";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];
    expect(results.length).toBe(1);
    // The result is an array with a single value (from ValuesStep after WithStep)
    const resultValue = results[0];
    // Could be an array with the count or just the count depending on pipeline
    const count = Array.isArray(resultValue) ? resultValue[0] : resultValue;
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThan(0);
  });

  test("WITH clause with ORDER BY alias", () => {
    // This tests ORDER BY using an alias defined in the WITH clause
    const query = "MATCH (u:Person) WITH u.age AS age ORDER BY age RETURN age";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];

    // Results should be sorted by age
    const ages = results.map((r: any) => (Array.isArray(r) ? r[0] : r));
    for (let i = 1; i < ages.length; i++) {
      expect(ages[i]).toBeGreaterThanOrEqual(ages[i - 1]);
    }
  });

  test("WITH clause with ORDER BY alias DESC", () => {
    // This tests ORDER BY DESC using an alias defined in the WITH clause
    const query =
      "MATCH (u:Person) WITH u.age AS age ORDER BY age DESC RETURN age";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];

    // Results should be sorted by age descending
    const ages = results.map((r: any) => (Array.isArray(r) ? r[0] : r));
    for (let i = 1; i < ages.length; i++) {
      expect(ages[i]).toBeLessThanOrEqual(ages[i - 1]);
    }
  });
});
