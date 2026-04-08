import { test, expect, describe } from "vitest";
import { parse } from "../grammar.js";
import { anyAstToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import type { Query } from "../AST.js";
import type { GraphSchema } from "../GraphSchema.js";

const schema = {
  vertices: {
    Person: { properties: { name: { type: {} as any } } },
  },
  edges: {},
} as const satisfies GraphSchema;

function createGraph() {
  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  graph.addVertex("Person", { name: "Alice" });
  graph.addVertex("Person", { name: "Bob" });
  graph.addVertex("Person", { name: "Charlie" });
  return graph;
}

function executeQuery(graph: Graph<typeof schema>, queryString: string): unknown[] {
  const ast = parse(queryString) as Query;
  const steps = anyAstToSteps(ast);
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

describe("count(*) support", () => {
  test("count(*) should count all matched rows", () => {
    const graph = createGraph();
    const results = executeQuery(graph, "MATCH (n:Person) RETURN count(*)");
    expect(results).toEqual([3]);
  });

  test("count(*) with alias", () => {
    const graph = createGraph();
    const results = executeQuery(graph, "MATCH (n:Person) RETURN count(*) AS total");
    expect(results).toEqual([3]);
  });

  test("count(*) parse to correct AST", () => {
    const ast = parse("MATCH (n:Person) RETURN count(*)") as Query;
    expect(ast.return?.items[0]?.variable).toBe("*");
    expect(ast.return?.items[0]?.aggregate).toBe("COUNT");
  });

  test("WITH count(*) should work", () => {
    const graph = createGraph();
    const results = executeQuery(graph, "MATCH (n:Person) WITH count(*) AS total RETURN total");
    // The result format is [[3]] - the count wrapped
    expect(results.length).toBe(1);
    // Access the inner value - results is [[3]]
    const inner = results[0] as number[];
    expect(inner[0]).toBe(3);
  });
});
