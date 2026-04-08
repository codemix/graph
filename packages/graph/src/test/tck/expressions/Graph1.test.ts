/**
 * TCK Graph1 - Node and edge identifier - ID function
 * Translated from tmp/tck/features/expressions/graph/Graph1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Graph1 - Node and edge identifier - ID function", () => {
  // id() and elementId() are now supported in RETURN expressions

  test("[Custom 1] id() function returns node ID", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice'})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN id(n)");

    expect(results).toHaveLength(1);
    // In this implementation, id() returns the internal ElementId (Label:uuid format)
    const id = results[0];
    expect(id).toBeDefined();
    // ID should be in format "A:<uuid>"
    expect(typeof id === "string" || typeof id === "number").toBe(true);
  });

  test("[Custom 2] id() on relationship returns relationship ID", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice'})-[:KNOWS]->(:B {name: 'Bob'})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (:A)-[r:KNOWS]->(:B) RETURN id(r)",
    );

    expect(results).toHaveLength(1);
    // In this implementation, id() returns the internal ElementId
    const id = results[0];
    expect(id).toBeDefined();
    expect(typeof id === "string" || typeof id === "number").toBe(true);
  });

  test("[Custom 3] elementId() returns string ID", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice'})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN elementId(n)");

    expect(results).toHaveLength(1);
    // elementId() returns a string
    expect(typeof results[0]).toBe("string");
  });

  // Tests demonstrating node identity comparison works via WHERE clause

  test("[Custom 4] Node identity can be compared in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice'}), (:A {name: 'Bob'})`);

    // Self-join where a = a (identity comparison)
    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:A) WHERE a = b RETURN a.name",
    );

    // Should return 2 results (Alice matches Alice, Bob matches Bob)
    // Single return item comes back directly
    expect(results).toHaveLength(2);
    const names = results as string[];
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");
  });

  test("[Custom 5] Different nodes can be compared in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice'}), (:A {name: 'Bob'})`);

    // Cross-join where a <> b
    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:A) WHERE a <> b RETURN a.name, b.name",
    );

    // Should return 2 results (Alice-Bob, Bob-Alice)
    expect(results).toHaveLength(2);
    const pairs = results.map((r) => {
      const [a, b] = r as [string, string];
      return `${a}-${b}`;
    });
    expect(pairs).toContain("Alice-Bob");
    expect(pairs).toContain("Bob-Alice");
  });
});
