import { test, expect, describe } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { parse } from "../grammar.js";
import { anyAstToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parseQueryToSteps } from "../index.js";
import type { Query, UnionQuery, MultiStatement } from "../AST.js";
import type { GraphSchema } from "../GraphSchema.js";

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
    Animal: {
      properties: {
        name: { type: makeType<string>("") },
        species: { type: makeType<string>("") },
      },
    },
    Repository: {
      properties: {
        repositoryName: { type: makeType<string>("") },
      },
    },
    Directory: {
      properties: {
        dirname: { type: makeType<string>("") },
      },
    },
  },
  edges: {
    KNOWS: {
      properties: {},
    },
    OWNS: {
      properties: {},
    },
  },
} as const satisfies GraphSchema;

function createTestGraph() {
  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  graph.addVertex("Person", { name: "Alice", age: 30 });
  graph.addVertex("Person", { name: "Bob", age: 25 });
  graph.addVertex("Person", { name: "Charlie", age: 35 });
  graph.addVertex("Animal", { name: "Rex", species: "dog" });
  graph.addVertex("Animal", { name: "Fluffy", species: "cat" });
  graph.addVertex("Repository", { repositoryName: "my-repo" });
  graph.addVertex("Repository", { repositoryName: "another-repo" });
  graph.addVertex("Directory", { dirname: "/src" });
  graph.addVertex("Directory", { dirname: "/test" });
  return graph;
}

function executeQuery(
  graph: Graph<GraphSchema>,
  queryString: string,
): unknown[] {
  const ast = parse(queryString) as Query | UnionQuery | MultiStatement;
  const steps = anyAstToSteps(ast);
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

describe("type() function support", () => {
  test("type() function - should parse correctly", () => {
    const result = parse("MATCH (n) RETURN type(n) AS nodeType") as Query;
    expect(result.return).toBeDefined();
    expect(result.return!.items[0]!.function).toBe("type");
    expect(result.return!.items[0]!.alias).toBe("nodeType");
  });

  test("type() function - should execute and return labels", () => {
    const graph = createTestGraph();
    const results = executeQuery(
      graph,
      "MATCH (n:Person) RETURN type(n) AS nodeType",
    );

    expect(results.length).toBeGreaterThan(0);
    // type() returns the label as a string (unlike labels() which returns an array)
    for (const result of results) {
      expect(result).toBe("Person");
    }
  });

  test("DISTINCT type() - should return unique types", () => {
    const graph = createTestGraph();
    const results = executeQuery(
      graph,
      "MATCH (n) RETURN DISTINCT type(n) AS nodeType",
    );

    // Should have unique labels: Person, Animal, Repository, Directory
    expect(results).toHaveLength(4);
  });

  test("GROUP BY type() - should work correctly", () => {
    const graph = createTestGraph();
    const results = executeQuery(
      graph,
      "MATCH (n) RETURN type(n) AS nodeType, COUNT(n) AS total GROUP BY type(n)",
    );

    expect(results).toHaveLength(4);

    const resultMap = new Map(
      results.map((r) => {
        const rec = r as Record<string, unknown>;
        // type() returns a string, not an array
        const nodeType = rec["nodeType"] as string;
        return [nodeType, rec["total"]];
      }),
    );

    expect(resultMap.get("Person")).toBe(3);
    expect(resultMap.get("Animal")).toBe(2);
    expect(resultMap.get("Repository")).toBe(2);
    expect(resultMap.get("Directory")).toBe(2);
  });
});

describe("Multiple aggregates without GROUP BY", () => {
  test("Multiple COUNT aggregates - should parse correctly", () => {
    const result = parse(
      "MATCH (n) RETURN COUNT(n) AS total1, COUNT(n) AS total2",
    ) as Query;
    expect(result.return).toBeDefined();
    expect(result.return!.items).toHaveLength(2);
    expect(result.return!.items[0]!.aggregate).toBe("COUNT");
    expect(result.return!.items[1]!.aggregate).toBe("COUNT");
  });

  test("Multiple COUNT aggregates - should execute correctly", () => {
    const graph = createTestGraph();
    const results = executeQuery(
      graph,
      "MATCH (n) RETURN COUNT(n) AS total1, COUNT(n) AS total2",
    );

    expect(results).toHaveLength(1);
    const result = results[0] as Record<string, unknown>;
    // Total nodes = 3 Person + 2 Animal + 2 Repository + 2 Directory = 9
    expect(result["total1"]).toBe(9);
    expect(result["total2"]).toBe(9);
  });

  test("Multiple different aggregates - should execute correctly", () => {
    const graph = createTestGraph();
    const results = executeQuery(
      graph,
      "MATCH (n:Person) RETURN COUNT(n) AS personCount, SUM(n.age) AS totalAge, AVG(n.age) AS avgAge",
    );

    expect(results).toHaveLength(1);
    const result = results[0] as Record<string, unknown>;
    expect(result["personCount"]).toBe(3);
    expect(result["totalAge"]).toBe(90); // 30 + 25 + 35
    expect(result["avgAge"]).toBe(30); // 90 / 3
  });

  test("Should still error when mixing aggregates with non-aggregates", () => {
    const graph = createTestGraph();
    expect(() => {
      executeQuery(graph, "MATCH (n) RETURN COUNT(n) AS total, n.name AS name");
    }).toThrow(/Cannot use aggregate.*without GROUP BY/);
  });
});

describe("Multi-statement queries (semicolon-separated)", () => {
  test("Multi-statement query - should parse correctly", () => {
    const result = parse(
      "MATCH (n) RETURN COUNT(n) AS total; MATCH (p:Person) RETURN p.name AS name",
    ) as MultiStatement;
    expect(result.type).toBe("MultiStatement");
    expect(result.statements).toHaveLength(2);
    expect(result.statements[0]!.type).toBe("Query");
    expect(result.statements[1]!.type).toBe("Query");
  });

  test("Single statement with trailing semicolon - should parse as Query", () => {
    const result = parse("MATCH (n) RETURN COUNT(n) AS total;") as Query;
    // Single statement with trailing semicolon should still be a Query, not MultiStatement
    expect(result.type).toBe("Query");
  });

  test("Three-statement query - should parse correctly", () => {
    const result = parse(
      "MATCH (n) RETURN COUNT(n) AS total; MATCH (p:Person) RETURN p.name; MATCH (a:Animal) RETURN a.species",
    ) as MultiStatement;
    expect(result.type).toBe("MultiStatement");
    expect(result.statements).toHaveLength(3);
  });

  test("Multi-statement query - should execute correctly", () => {
    const graph = createTestGraph();
    // Using multiple aggregates to get object results with aliases
    const results = executeQuery(
      graph,
      "MATCH (n) RETURN COUNT(n) AS total, COUNT(n) AS total2; MATCH (p:Person) RETURN COUNT(p) AS personCount, COUNT(p) AS personCount2",
    );

    // Results from both statements
    expect(results).toHaveLength(2);

    // First statement result should have total count (multiple aggregates return objects)
    const countResult = results.find(
      (r) => (r as Record<string, unknown>)._statementIndex === 0,
    ) as Record<string, unknown>;
    expect(countResult).toBeDefined();
    expect(countResult["total"]).toBe(9);

    // Second statement result should have person count
    const personResult = results.find(
      (r) => (r as Record<string, unknown>)._statementIndex === 1,
    ) as Record<string, unknown>;
    expect(personResult).toBeDefined();
    expect(personResult["personCount"]).toBe(3);
  });

  test("parseQueryToSteps with multi-statement query", () => {
    const graph = createTestGraph();
    // Using multiple aggregates to get object results with aliases
    const { steps } = parseQueryToSteps(
      "MATCH (n:Person) RETURN COUNT(n) AS personCount, COUNT(n) AS pc2; MATCH (n:Animal) RETURN COUNT(n) AS animalCount, COUNT(n) AS ac2",
    );

    const traverser = createTraverser(steps);
    const rawResults = Array.from(traverser.traverse(graph, []));

    expect(rawResults).toHaveLength(2);

    // For multi-statement queries with multiple aggregates, results have proper structure
    const personCountResult = rawResults.find(
      (r) => (r as Record<string, unknown>)._statementIndex === 0,
    ) as Record<string, unknown>;
    const animalCountResult = rawResults.find(
      (r) => (r as Record<string, unknown>)._statementIndex === 1,
    ) as Record<string, unknown>;

    expect(personCountResult).toBeDefined();
    expect(personCountResult["personCount"]).toBe(3);

    expect(animalCountResult).toBeDefined();
    expect(animalCountResult["animalCount"]).toBe(2);
  });
});

describe("Combined features - user's original query scenario", () => {
  test("Multiple aggregates with type() function using GROUP BY", () => {
    const graph = createTestGraph();

    // Test GROUP BY with type() function
    // Note: using 'total' instead of 'count' as alias since 'count' is a keyword
    const results = executeQuery(
      graph,
      "MATCH (n) RETURN type(n) AS label, COUNT(n) AS total GROUP BY type(n)",
    );

    expect(results).toHaveLength(4);
  });

  test("Multi-statement with multiple aggregates in each", () => {
    const graph = createTestGraph();

    // Using multiple aggregates to get object results with aliases
    const results = executeQuery(
      graph,
      `MATCH (n) RETURN COUNT(n) AS totalNodes, COUNT(n) AS total2;
       MATCH (n:Repository) RETURN COUNT(n) AS repoCount, COUNT(n) AS repo2;
       MATCH (d:Directory) RETURN COUNT(d) AS dirCount, COUNT(d) AS dir2`,
    );

    // Should have results from all three statements
    const statement0Results = results.filter(
      (r) => (r as Record<string, unknown>)._statementIndex === 0,
    );
    const statement1Results = results.filter(
      (r) => (r as Record<string, unknown>)._statementIndex === 1,
    );
    const statement2Results = results.filter(
      (r) => (r as Record<string, unknown>)._statementIndex === 2,
    );

    expect(statement0Results).toHaveLength(1);
    expect(
      (statement0Results[0] as Record<string, unknown>)["totalNodes"],
    ).toBe(9);

    expect(statement1Results).toHaveLength(1);
    expect((statement1Results[0] as Record<string, unknown>)["repoCount"]).toBe(
      2,
    );

    expect(statement2Results).toHaveLength(1);
    expect((statement2Results[0] as Record<string, unknown>)["dirCount"]).toBe(
      2,
    );
  });

  test("Multi-statement with mixed aggregates", () => {
    const graph = createTestGraph();

    // This tests the pattern the user wanted - multiple statements with mixed content
    const results = executeQuery(
      graph,
      `MATCH (n) RETURN COUNT(n) AS totalNodes, COUNT(n) AS nodeCount;
       MATCH (n:Repository) RETURN COUNT(n) AS repoCount, COUNT(n) AS repo2;
       MATCH (d:Directory) RETURN COUNT(d) AS dirCount, COUNT(d) AS dir2`,
    );

    expect(results).toHaveLength(3);

    const statement0 = results.find(
      (r) => (r as Record<string, unknown>)._statementIndex === 0,
    ) as Record<string, unknown>;
    expect(statement0["totalNodes"]).toBe(9);
    expect(statement0["nodeCount"]).toBe(9);

    const statement1 = results.find(
      (r) => (r as Record<string, unknown>)._statementIndex === 1,
    ) as Record<string, unknown>;
    expect(statement1["repoCount"]).toBe(2);

    const statement2 = results.find(
      (r) => (r as Record<string, unknown>)._statementIndex === 2,
    ) as Record<string, unknown>;
    expect(statement2["dirCount"]).toBe(2);
  });
});
