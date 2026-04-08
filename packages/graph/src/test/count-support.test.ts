import { test, expect } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parseQueryToSteps } from "../index.js";
import type { Query } from "../AST.js";
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

function executeQuery(graph: Graph<GraphSchema>, queryString: string): unknown[] {
  const ast = parse(queryString) as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

const schema = {
  vertices: {
    Person: {
      properties: {
        name: { type: makeType<string>("") },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

test("COUNT with AS alias - should parse correctly", () => {
  const result = parse("MATCH (n) RETURN COUNT(n) AS item") as Query;
  expect(result.return).toBeDefined();
  expect(result.return!.items[0]!.aggregate).toBe("COUNT");
  expect(result.return!.items[0]!.alias).toBe("item");
});

test("COUNT without alias (lowercase) - should parse correctly", () => {
  const result = parse("MATCH (n) RETURN count(n)") as Query;
  expect(result.return).toBeDefined();
  expect(result.return!.items[0]!.aggregate).toBe("COUNT");
  expect(result.return!.items[0]!.alias).toBeUndefined();
});

test("MATCH without RETURN - should parse correctly", () => {
  const result = parse("MATCH (n)") as Query;
  expect(result.return).toBeUndefined();
  expect(result.matches).toHaveLength(1);
});

test("COUNT with AS alias - should execute correctly", () => {
  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  graph.addVertex("Person", { name: "Alice" });
  graph.addVertex("Person", { name: "Bob" });
  graph.addVertex("Person", { name: "Charlie" });

  const results = executeQuery(graph, "MATCH (n) RETURN COUNT(n) AS item");
  expect(results).toHaveLength(1);
  expect(results[0]).toBe(3);
});

test("COUNT without alias - should execute correctly", () => {
  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  graph.addVertex("Person", { name: "Alice" });
  graph.addVertex("Person", { name: "Bob" });

  const results = executeQuery(graph, "MATCH (n) RETURN count(n)");
  expect(results).toHaveLength(1);
  expect(results[0]).toBe(2);
});

test("MATCH without RETURN - should execute (drain step)", () => {
  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  graph.addVertex("Person", { name: "Alice" });

  // MATCH without RETURN should run but return no results (DrainStep)
  const results = executeQuery(graph, "MATCH (n)");
  expect(results).toHaveLength(0);
});

test("COUNT with AS alias on filtered results - should execute correctly", () => {
  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  graph.addVertex("Person", { name: "Alice" });
  graph.addVertex("Person", { name: "Bob" });
  graph.addVertex("Person", { name: "Charlie" });

  const results = executeQuery(
    graph,
    "MATCH (n:Person) WHERE n.name = 'Alice' RETURN COUNT(n) AS total",
  );
  expect(results).toHaveLength(1);
  expect(results[0]).toBe(1);
});

test("SUM with AS alias - should parse correctly", () => {
  const result = parse("MATCH (n) RETURN SUM(n.salary) AS totalSalary") as Query;
  expect(result.return).toBeDefined();
  expect(result.return!.items[0]!.aggregate).toBe("SUM");
  expect(result.return!.items[0]!.alias).toBe("totalSalary");
});

test("Property return with AS alias - should parse correctly", () => {
  const result = parse("MATCH (n) RETURN n.name AS personName") as Query;
  expect(result.return).toBeDefined();
  expect(result.return!.items[0]!.variable).toBe("n");
  expect(result.return!.items[0]!.property).toBe("name");
  expect(result.return!.items[0]!.alias).toBe("personName");
});

test("Variable return with AS alias - should parse correctly", () => {
  const result = parse("MATCH (n) RETURN n AS person") as Query;
  expect(result.return).toBeDefined();
  expect(result.return!.items[0]!.variable).toBe("n");
  expect(result.return!.items[0]!.alias).toBe("person");
});

test("DISTINCT labels and COUNT with aliases - should parse correctly", () => {
  const result = parse("MATCH (n) RETURN DISTINCT labels(n) AS label, COUNT(n) AS total") as Query;
  expect(result.return).toBeDefined();
  expect(result.return!.distinct).toBe(true);
  expect(result.return!.items).toHaveLength(2);
  // First item: labels(n) AS label
  expect(result.return!.items[0]!.function).toBe("labels");
  expect(result.return!.items[0]!.alias).toBe("label");
  // Second item: COUNT(n) AS total
  expect(result.return!.items[1]!.aggregate).toBe("COUNT");
  expect(result.return!.items[1]!.alias).toBe("total");
});

test("GROUP BY with labels and COUNT - should parse correctly", () => {
  const result = parse(
    "MATCH (n) RETURN labels(n) AS label, COUNT(n) AS total GROUP BY labels(n)",
  ) as Query;
  expect(result.return).toBeDefined();
  expect(result.groupBy).toBeDefined();
  expect(result.groupBy!.items).toHaveLength(1);
  expect(result.groupBy!.items[0]!.function).toBe("labels");
  expect(result.groupBy!.items[0]!.variable).toBe("n");
});

test("GROUP BY with labels and COUNT - should execute correctly", () => {
  const multiLabelSchema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
      Animal: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
    },
    edges: {},
  } as const satisfies GraphSchema;

  const graph = new Graph({
    schema: multiLabelSchema,
    storage: new InMemoryGraphStorage(),
  });

  // Add 3 Person vertices and 2 Animal vertices
  graph.addVertex("Person", { name: "Alice" });
  graph.addVertex("Person", { name: "Bob" });
  graph.addVertex("Person", { name: "Charlie" });
  graph.addVertex("Animal", { name: "Rex" });
  graph.addVertex("Animal", { name: "Fluffy" });

  const results = executeQuery(
    graph,
    "MATCH (n) RETURN labels(n) AS label, COUNT(n) AS total GROUP BY labels(n)",
  );

  expect(results).toHaveLength(2);

  // Results should contain both groups
  const resultMap = new Map(
    results.map((r) => {
      const rec = r as Record<string, unknown>;
      const labels = rec["label"] as string[];
      return [labels[0], rec["total"]];
    }),
  );

  expect(resultMap.get("Person")).toBe(3);
  expect(resultMap.get("Animal")).toBe(2);
});

test("COUNT with AS alias - should work with parseQueryToSteps postprocessor", () => {
  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  graph.addVertex("Person", { name: "Alice" });
  graph.addVertex("Person", { name: "Bob" });
  graph.addVertex("Person", { name: "Charlie" });

  const { steps, postprocess } = parseQueryToSteps(
    "MATCH (c:Person) RETURN COUNT(c) AS conceptCount",
  );
  const traverser = createTraverser(steps);
  const rawResults = Array.from(traverser.traverse(graph, []));

  expect(rawResults).toHaveLength(1);
  expect(rawResults[0]).toBe(3);

  // The postprocessor should correctly map the raw value to the alias
  const processed = postprocess(rawResults[0] as readonly unknown[]);
  expect(processed).toEqual({ conceptCount: 3 });
});
