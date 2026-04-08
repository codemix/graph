/**
 * TCK Path1 - Nodes of a path
 * Translated from tmp/tck/features/expressions/path/Path1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Path1 - Nodes of a path", () => {
  test("[1] `nodes()` on null path - OPTIONAL MATCH with bound variable", () => {
    // Original TCK:
    // WITH null AS a
    // OPTIONAL MATCH p = (a)-[r]->()
    // RETURN nodes(p), nodes(null)
    //
    // Expected: nodes(p) = null, nodes(null) = null
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `WITH null AS a
       OPTIONAL MATCH p = (a)-[r]->()
       RETURN nodes(p), nodes(null)`,
    );
    expect(results).toHaveLength(1);
    const [nodesP, nodesNull] = results[0] as [unknown, unknown];
    expect(nodesP).toBeNull();
    expect(nodesNull).toBeNull();
  });

  test("[Custom] nodes() on a named path returns list of nodes", () => {
    // Demonstrate that nodes(p) DOES work with named paths
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (a:A {name: 'A'})-[:T]->(b:B {name: 'B'})-[:T]->(c:C {name: 'C'})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH p = (a:A)-[:T]->(b:B)-[:T]->(c:C) RETURN nodes(p)",
    );
    expect(results).toHaveLength(1);
    const nodes = results[0] as unknown[];
    expect(nodes).toHaveLength(3);
  });

  // Additional tests demonstrating related functionality that IS supported

  test("[Custom 1] Collect nodes along a fixed path manually", () => {
    // While we can't use nodes(p), we can collect nodes along a known path
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a1'})-[:T]->(:B {name: 'b1'})-[:T]->(:C {name: 'c1'})`,
    );

    // Get the full chain of nodes by matching the pattern
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:T]->(b:B)-[:T]->(c:C) RETURN a.name, b.name, c.name`,
    );

    expect(results).toHaveLength(1);
    const [aName, bName, cName] = results[0] as [string, string, string];
    expect(aName).toBe("a1");
    expect(bName).toBe("b1");
    expect(cName).toBe("c1");
  });

  test("[Custom 2] Count nodes in a path by matching explicitly", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:Start {name: 's'})-[:T]->(:A {name: 'a'})-[:T]->(:B {name: 'b'})`,
    );

    // Count the nodes by counting results with multiple patterns
    const startResults = executeTckQuery(graph, `MATCH (n:Start) RETURN n`);
    const aResults = executeTckQuery(graph, `MATCH (n:A) RETURN n`);
    const bResults = executeTckQuery(graph, `MATCH (n:B) RETURN n`);

    expect(startResults).toHaveLength(1);
    expect(aResults).toHaveLength(1);
    expect(bResults).toHaveLength(1);
    // Total nodes in the path: 3
    expect(startResults.length + aResults.length + bResults.length).toBe(3);
  });

  test("[Custom 3] Retrieve endpoint nodes of a relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice'})-[:T]->(:B {name: 'Bob'})`);

    const results = executeTckQuery(graph, `MATCH (s:A)-[:T]->(e:B) RETURN s.name, e.name`);

    expect(results).toHaveLength(1);
    const [startName, endName] = results[0] as [string, string];
    expect(startName).toBe("Alice");
    expect(endName).toBe("Bob");
  });

  test("[Custom 4] Match multi-hop path and return all node names", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'n1'})`);
    executeTckQuery(graph, `CREATE (:B {name: 'n2'})`);
    executeTckQuery(graph, `CREATE (:C {name: 'n3'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (a)-[:T]->(b)`);
    executeTckQuery(graph, `MATCH (b:B), (c:C) CREATE (b)-[:T]->(c)`);

    // Get all nodes in the path A -> B -> C
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:T]->(b:B)-[:T]->(c:C) RETURN a.name, b.name, c.name`,
    );

    expect(results).toHaveLength(1);
    const [n1, n2, n3] = results[0] as [string, string, string];
    expect(n1).toBe("n1");
    expect(n2).toBe("n2");
    expect(n3).toBe("n3");
  });
});
