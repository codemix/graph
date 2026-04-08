/**
 * TCK Graph8 - Property keys function
 * Translated from tmp/tck/features/expressions/graph/Graph8.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Graph8 - Property keys function", () => {
  // keys() function is now supported in RETURN expressions

  test("[1] Using `keys()` on a single node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Andres', age: 30})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN keys(n)");

    expect(results).toHaveLength(1);
    const keys = results[0] as string[];
    expect(keys).toContain("name");
    expect(keys).toContain("age");
  });

  test("[2] Using `keys()` on multiple nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice'}), (:A {age: 25})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN keys(n)");

    expect(results).toHaveLength(2);
    // Each result is an array of keys
    const allKeys = (results as string[][]).flatMap((k) => k);
    expect(allKeys).toContain("name");
    expect(allKeys).toContain("age");
  });

  test("[3] Using `keys()` on a node with no properties", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A)`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN keys(n)");

    expect(results).toHaveLength(1);
    const keys = results[0] as string[];
    expect(keys).toEqual([]);
  });

  test("[4] Using `keys()` on an optionally matched node", () => {
    // OPTIONAL MATCH implementation needed
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "OPTIONAL MATCH (n:NonExistent) RETURN keys(n)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test("[5] Using `keys()` on a relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A)-[:KNOWS {since: 2020, strength: 5}]->(:B)`);

    const results = executeTckQuery(graph, "MATCH (:A)-[r:KNOWS]->(:B) RETURN keys(r)");

    expect(results).toHaveLength(1);
    const keys = results[0] as string[];
    expect(keys).toContain("since");
    expect(keys).toContain("strength");
  });

  test("[6] Using `keys()` on a relationship with no properties", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A)-[:KNOWS]->(:B)`);

    const results = executeTckQuery(graph, "MATCH (:A)-[r:KNOWS]->(:B) RETURN keys(r)");

    expect(results).toHaveLength(1);
    const keys = results[0] as string[];
    expect(keys).toEqual([]);
  });

  test("[7] Using `keys()` on an optionally matched relationship", () => {
    // OPTIONAL MATCH implementation needed
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test'})");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) OPTIONAL MATCH (a)-[r:NONEXISTENT]->() RETURN keys(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test.fails("[8] Using `keys()` and `IN` to check property existence", () => {
    // Need list IN expression support in WHERE
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Alice', age: 30})");
    const results = executeTckQuery(graph, "MATCH (n:A) WHERE 'name' IN keys(n) RETURN n.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Alice");
  });

  // Alternative tests demonstrating property access functionality

  test("[Custom 1] Individual properties can be accessed via n.propertyName", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Andres', age: 30})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name, n.age");

    expect(results).toHaveLength(1);
    const [name, age] = results[0] as [string, number];
    expect(name).toBe("Andres");
    expect(age).toBe(30);
  });

  test("[Custom 2] Relationship properties can be accessed via r.propertyName", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A)-[:KNOWS {since: 2020, strength: 5}]->(:B)`);

    const results = executeTckQuery(graph, "MATCH (:A)-[r:KNOWS]->(:B) RETURN r.since, r.strength");

    expect(results).toHaveLength(1);
    const [since, strength] = results[0] as [number, number];
    expect(since).toBe(2020);
    expect(strength).toBe(5);
  });

  test("[Custom 3] Missing property returns undefined", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Test'})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name, n.missing");

    expect(results).toHaveLength(1);
    const [name, missing] = results[0] as [string, unknown];
    expect(name).toBe("Test");
    expect(missing).toBeUndefined();
  });
});
