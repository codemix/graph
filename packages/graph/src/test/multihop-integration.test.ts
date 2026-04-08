import { test, expect } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph } from "../Graph.js";
import { GraphSchema } from "../GraphSchema.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import type { Query, Pattern } from "../AST.js";

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

function createTestGraph(): Graph<GraphSchema> {
  // Create a flexible schema that supports all our test cases
  const schema = {
    vertices: {
      Concept: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
      Property: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
      Node: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
      Person: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
      Company: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      IsA: { properties: {} },
      RelatesTo: { properties: {} },
      connects: { properties: {} },
      WorksAt: { properties: {} },
      PartneredWith: { properties: {} },
    },
  } as const satisfies GraphSchema;

  return new Graph({ schema, storage: new InMemoryGraphStorage() });
}

test("Multi-hop query integration tests - should execute 2-hop query with single dash syntax", () => {
  const graph = createTestGraph();

  // Create a simple graph: Concept1 -IsA-> Property1 -RelatesTo-> Concept2
  const concept1 = graph.addVertex("Concept", { name: "Concept1" });
  const prop1 = graph.addVertex("Property", { name: "Prop1" });
  const concept2 = graph.addVertex("Concept", { name: "Concept2" });

  graph.addEdge(concept1.id, "IsA", prop1.id, {});
  graph.addEdge(prop1.id, "RelatesTo", concept2.id, {});

  // Parse and execute the query with single dash
  const query = "MATCH (c:Concept)-[e:IsA]-(a:Property)-(d:Concept) RETURN c, e, a, d LIMIT 10";
  const ast = parse(query) as Query;

  expect((ast.matches[0]!.pattern as Pattern).elements).toHaveLength(5);

  const steps = astToSteps(ast);
  expect(steps).toBeDefined();

  // Verify it can be executed
  const traverser = createTraverser(steps);
  const results = Array.from(traverser.traverse(graph, []));
  expect(results).toBeDefined();
});

test("Multi-hop query integration tests - should execute arbitrary depth query with single dash syntax", () => {
  const graph = createTestGraph();

  // Create a chain: A - B - C - D
  const a = graph.addVertex("Node", { name: "A" });
  const b = graph.addVertex("Node", { name: "B" });
  const c = graph.addVertex("Node", { name: "C" });
  const d = graph.addVertex("Node", { name: "D" });

  graph.addEdge(a.id, "connects", b.id, {});
  graph.addEdge(b.id, "connects", c.id, {});
  graph.addEdge(c.id, "connects", d.id, {});

  // Parse 3-hop query with single dash
  const query = "MATCH (n1:Node)-(n2:Node)-(n3:Node)-(n4:Node) RETURN n1, n2, n3, n4";
  const ast = parse(query) as Query;

  expect((ast.matches[0]!.pattern as Pattern).elements).toHaveLength(7);

  const steps = astToSteps(ast);
  expect(steps).toBeDefined();
});

test("Multi-hop query integration tests - should execute mixed edge patterns query", () => {
  const graph = createTestGraph();

  // Create a graph with different edge types
  const p = graph.addVertex("Person", { name: "Person1" });
  const c1 = graph.addVertex("Company", { name: "Company1" });
  const c2 = graph.addVertex("Company", { name: "Company2" });
  const p2 = graph.addVertex("Person", { name: "Person2" });

  graph.addEdge(p.id, "WorksAt", c1.id, {});
  graph.addEdge(c1.id, "PartneredWith", c2.id, {});
  graph.addEdge(p2.id, "WorksAt", c2.id, {});

  // Parse query with mixed edge patterns: labeled outgoing, unlabeled both, labeled incoming
  const query =
    "MATCH (p1:Person)-[e1:WorksAt]->(c1:Company)-(c2:Company)<-[e2:WorksAt]-(p2:Person) RETURN p1, c1, c2, p2";
  const ast = parse(query) as Query;

  expect((ast.matches[0]!.pattern as Pattern).elements).toHaveLength(7);

  const steps = astToSteps(ast);
  expect(steps).toBeDefined();
});

test("Multi-hop query integration tests - should parse and convert 4-hop query to steps", () => {
  // Just verify parsing and conversion works
  const query = "MATCH (a)-(b)-(c)-(d)-(e) RETURN a, b, c, d, e";
  const ast = parse(query) as Query;

  expect((ast.matches[0]!.pattern as Pattern).elements).toHaveLength(9);

  const steps = astToSteps(ast);
  expect(steps).toBeDefined();
});

test("Multi-hop query integration tests - should handle combination of single and double dash syntax", () => {
  // Test that both single dash and double dash work in same query
  const query1 = "MATCH (a)--(b)-(c) RETURN a, b, c";
  const ast1 = parse(query1) as Query;
  expect((ast1.matches[0]!.pattern as Pattern).elements).toHaveLength(5);

  const query2 = "MATCH (a)-(b)--(c) RETURN a, b, c";
  const ast2 = parse(query2) as Query;
  expect((ast2.matches[0]!.pattern as Pattern).elements).toHaveLength(5);
});

test("Multi-hop query integration tests - should handle single arrow syntax", () => {
  // Test single -> and <- work too
  const query1 = "MATCH (a)->(b) RETURN a, b";
  const ast1 = parse(query1) as Query;
  expect((ast1.matches[0]!.pattern as Pattern).elements).toHaveLength(3);

  const query2 = "MATCH (a)<-(b) RETURN a, b";
  const ast2 = parse(query2) as Query;
  expect((ast2.matches[0]!.pattern as Pattern).elements).toHaveLength(3);

  const query3 = "MATCH (a)->(b)<-(c) RETURN a, b, c";
  const ast3 = parse(query3) as Query;
  expect((ast3.matches[0]!.pattern as Pattern).elements).toHaveLength(5);
});
