/**
 * TCK Graph5 - Node and edge label expressions
 * Translated from tmp/tck/features/expressions/graph/Graph5.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Graph5 - Node and edge label expressions", () => {
  test.fails("[1] Single-labels expression on nodes - label predicate in RETURN not supported", () => {
    // Original TCK:
    // CREATE (:A:B:C), (:A:B), (:A:C), (:B:C), (:A), (:B), (:C), ()
    // MATCH (a) RETURN a, a:B AS result
    //
    // Limitations:
    // - Multi-label syntax (:A:B:C) not supported
    // - Unlabeled nodes not supported
    // - Label predicate expression (a:B) in RETURN not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A:B:C), (:A:B), (:A:C), (:B:C), (:A), (:B), (:C), ()");
    const results = executeTckQuery(graph, "MATCH (a) RETURN a, a:B AS result");
    expect(results).toHaveLength(8);
  });

  test.fails("[2] Single-labels expression on relationships - label predicate not supported", () => {
    // Original TCK (marked @ignore in TCK):
    // MATCH ()-[r]->() RETURN r, r:T2 AS result
    //
    // Limitations:
    // - Unlabeled nodes not supported
    // - Label predicate expression (r:T2) on relationships not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T1]->(:B), (:A)-[:T2]->(:B)");
    const results = executeTckQuery(graph, "MATCH ()-[r]->() RETURN r, r:T2 AS result");
    expect(results).toHaveLength(2);
  });

  test.fails("[3] Conjunctive labels expression on nodes - multi-label not supported", () => {
    // Original TCK:
    // MATCH (a) RETURN a, a:A:B AS result
    //
    // Limitations:
    // - Multi-label syntax not supported
    // - Label predicate expression in RETURN not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A:B {name: 'test'})");
    const results = executeTckQuery(graph, "MATCH (a) RETURN a, a:A:B AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([expect.anything(), true]);
  });

  test.fails("[4] Conjunctive labels expression with varying order - multi-label not supported", () => {
    // Original TCK: Scenario Outline with :A:C, :C:A, :A:C:A, etc.
    //
    // Limitations:
    // - Multi-label syntax not supported
    // - Label predicate in WHERE not fully supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A:C {name: 'test'})");
    const results = executeTckQuery(graph, "MATCH (a) WHERE a:A:C RETURN a.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test.fails("[5] Label expression on null - OPTIONAL MATCH not fully supported", () => {
    // Original TCK:
    // MATCH (n:Single) OPTIONAL MATCH (n)-[r:TYPE]-(m) RETURN m:TYPE
    //
    // Limitations:
    // - Undirected relationship patterns not supported
    // - OPTIONAL MATCH not fully supported
    // - Label predicate expression in RETURN not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Single {name: 'test'})");
    const results = executeTckQuery(
      graph,
      "MATCH (n:Single) OPTIONAL MATCH (n)-[r:TYPE]-(m) RETURN m:TYPE",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  // Custom tests demonstrating label-related functionality that is supported

  test("[Custom 1] Filter nodes by single label in MATCH", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice'}), (:B {name: 'Bob'}), (:A {name: 'Charlie'})`,
    );

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name");

    expect(results).toHaveLength(2);
    // Single return item comes back directly, not wrapped
    const names = results as string[];
    expect(names).toContain("Alice");
    expect(names).toContain("Charlie");
    expect(names).not.toContain("Bob");
  });

  test("[Custom 2] Filter relationships by type in MATCH", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'A1'})-[:T1]->(:B {name: 'B1'})`);
    executeTckQuery(graph, `CREATE (:A {name: 'A2'})-[:T2]->(:B {name: 'B2'})`);

    const results = executeTckQuery(graph, "MATCH (a:A)-[:T1]->(b:B) RETURN a.name, b.name");

    expect(results).toHaveLength(1);
    const [aName, bName] = results[0] as [string, string];
    expect(aName).toBe("A1");
    expect(bName).toBe("B1");
  });

  test("[Custom 3] Multiple labels can be matched separately", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice'})`);
    executeTckQuery(graph, `CREATE (:B {name: 'Bob'})`);

    const aResults = executeTckQuery(graph, "MATCH (n:A) RETURN n.name");
    const bResults = executeTckQuery(graph, "MATCH (n:B) RETURN n.name");

    expect(aResults).toHaveLength(1);
    expect(bResults).toHaveLength(1);
    // Single return item comes back directly
    expect(aResults[0]).toBe("Alice");
    expect(bResults[0]).toBe("Bob");
  });

  test("[Custom 4] labels() function returns array with label", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:Person {name: 'Alice'})`);

    const results = executeTckQuery(graph, "MATCH (n:Person) RETURN labels(n)");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["Person"]);
  });
});
