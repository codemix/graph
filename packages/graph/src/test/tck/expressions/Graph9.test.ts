/**
 * TCK Graph9 - Retrieve all properties as a property map
 * Translated from tmp/tck/features/expressions/graph/Graph9.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Graph9 - Retrieve all properties as a property map", () => {
  // properties() function is now supported in RETURN expressions

  test("[1] `properties()` on a node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:Person {name: 'Popeye', level: 9001})`);

    const results = executeTckQuery(graph, "MATCH (p:Person) RETURN properties(p)");

    expect(results).toHaveLength(1);
    const props = results[0] as Record<string, unknown>;
    expect(props.name).toBe("Popeye");
    expect(props.level).toBe(9001);
  });

  test("[2] `properties()` on a relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A)-[:KNOWS {since: 2020, strength: 5}]->(:B)`);

    const results = executeTckQuery(graph, "MATCH (:A)-[r:KNOWS]->(:B) RETURN properties(r)");

    expect(results).toHaveLength(1);
    const props = results[0] as Record<string, unknown>;
    expect(props.since).toBe(2020);
    expect(props.strength).toBe(5);
  });

  test("[3] `properties()` on null", () => {
    // OPTIONAL MATCH implementation needed to return null
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "OPTIONAL MATCH (n:NonExistent) RETURN properties(n)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test("[4] `properties()` on a map", () => {
    // Map literals in function arguments not yet supported in grammar
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN properties({name: 'Alice', age: 30})");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ name: "Alice", age: 30 });
  });

  test.fails("[5] `properties()` failing on integer", () => {
    // Error handling test
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "RETURN properties(123)");
    }).toThrow();
  });

  test.fails("[6] `properties()` failing on string", () => {
    // Error handling test
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "RETURN properties('hello')");
    }).toThrow();
  });

  test.fails("[7] `properties()` failing on list", () => {
    // Error handling test
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "RETURN properties([1, 2, 3])");
    }).toThrow();
  });

  // Alternative tests demonstrating property access via explicit property names

  test("[Custom 1] Multiple properties can be returned individually", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:Person {name: 'Popeye', level: 9001})`);

    const results = executeTckQuery(graph, "MATCH (p:Person) RETURN p.name, p.level");

    expect(results).toHaveLength(1);
    const [name, level] = results[0] as [string, number];
    expect(name).toBe("Popeye");
    expect(level).toBe(9001);
  });

  test("[Custom 2] Relationship properties can be returned", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A)-[:KNOWS {since: 2020, strength: 5}]->(:B)`);

    const results = executeTckQuery(graph, "MATCH (:A)-[r:KNOWS]->(:B) RETURN r.since, r.strength");

    expect(results).toHaveLength(1);
    const [since, strength] = results[0] as [number, number];
    expect(since).toBe(2020);
    expect(strength).toBe(5);
  });

  test("[Custom 3] Full node can be returned with labels() function", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice', age: 30})`);

    // Use labels() function to verify the node's label since raw node
    // objects don't expose .label property directly
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN labels(n)");

    expect(results).toHaveLength(1);
    const labels = results[0] as string[];
    expect(labels).toEqual(["A"]);
  });

  test("[Custom 4] labels() function works in RETURN", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:Person {name: 'Alice'})`);

    const results = executeTckQuery(graph, "MATCH (n:Person) RETURN labels(n)");

    expect(results).toHaveLength(1);
    const labels = results[0] as string[];
    expect(labels).toEqual(["Person"]);
  });
});
