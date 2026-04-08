/**
 * TCK Graph2 - Edge source and destination
 * Translated from tmp/tck/features/expressions/graph/Graph2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Graph2 - Edge source and destination", () => {
  // The original TCK feature file is empty (no scenarios defined)
  // Adding custom tests to verify startNode/endNode behavior

  test("[Custom 1] startNode() function returns source node", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Source'})-[:T {prop: 'test'}]->(:B {name: 'Target'})`,
    );

    const results = executeTckQuery(graph, "MATCH (:A)-[r:T]->(:B) RETURN startNode(r).name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Source");
  });

  test("[Custom 2] endNode() function returns target node", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Source'})-[:T {prop: 'test'}]->(:B {name: 'Target'})`,
    );

    const results = executeTckQuery(graph, "MATCH (:A)-[r:T]->(:B) RETURN endNode(r).name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Target");
  });

  // We can test edge traversal behavior instead

  test("[Custom 3] Traversing outgoing relationships gives correct target", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Source'})-[:T]->(:B {name: 'Target'})`);

    const results = executeTckQuery(graph, "MATCH (a:A)-[:T]->(b:B) RETURN a.name, b.name");

    expect(results).toHaveLength(1);
    const [source, target] = results[0] as [string, string];
    expect(source).toBe("Source");
    expect(target).toBe("Target");
  });

  test("[Custom 4] Traversing incoming relationships gives correct source", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Source'})-[:T]->(:B {name: 'Target'})`);

    const results = executeTckQuery(graph, "MATCH (b:B)<-[:T]-(a:A) RETURN a.name, b.name");

    expect(results).toHaveLength(1);
    const [source, target] = results[0] as [string, string];
    expect(source).toBe("Source");
    expect(target).toBe("Target");
  });

  test("[Custom 5] Multiple hops preserve direction", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'A1'})-[:T]->(:B {name: 'B1'})-[:T]->(:C {name: 'C1'})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:T]->(b:B)-[:T]->(c:C) RETURN a.name, b.name, c.name",
    );

    expect(results).toHaveLength(1);
    const [aName, bName, cName] = results[0] as [string, string, string];
    expect(aName).toBe("A1");
    expect(bName).toBe("B1");
    expect(cName).toBe("C1");
  });
});
