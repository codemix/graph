/**
 * TCK Graph6 - Static property access
 * Translated from tmp/tck/features/expressions/graph/Graph6.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Graph6 - Static property access", () => {
  test.fails("[1] Statically access a property of a non-null node - unlabeled nodes not supported", () => {
    // Original TCK:
    // CREATE ({existing: 42, missing: null})
    // MATCH (n) RETURN n.missing, n.missingToo, n.existing
    //
    // Limitation: Unlabeled nodes not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({existing: 42, missing: null})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n.missing, n.missingToo, n.existing");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([null, null, 42]);
  });

  test.fails("[2] Statically access a property of an optional non-null node - unlabeled nodes not supported", () => {
    // Original TCK:
    // CREATE ({existing: 42, missing: null})
    // OPTIONAL MATCH (n) RETURN n.missing, n.missingToo, n.existing
    //
    // Limitations:
    // - Unlabeled nodes not supported
    // - OPTIONAL MATCH not fully supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({existing: 42, missing: null})");
    const results = executeTckQuery(
      graph,
      "OPTIONAL MATCH (n) RETURN n.missing, n.missingToo, n.existing",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([null, null, 42]);
  });

  test("[3] Statically access a property of a null node - OPTIONAL MATCH not supported", () => {
    // Original TCK:
    // OPTIONAL MATCH (n) RETURN n.missing
    // Expected: null
    //
    // Limitation: OPTIONAL MATCH returning null not fully supported
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "OPTIONAL MATCH (n) RETURN n.missing");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test.fails("[4] Statically access a property of a node from expression - list indexing not supported", () => {
    // Original TCK:
    // MATCH (n) WITH [123, n] AS list RETURN (list[1]).missing, ...
    //
    // Limitations:
    // - Unlabeled nodes not supported
    // - List indexing (list[1]) not supported
    // - Parenthesized property access not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {existing: 42, missing: null})");
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WITH [123, n] AS list RETURN (list[1]).missing, (list[1]).missingToo, (list[1]).existing",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([null, null, 42]);
  });

  test.fails("[5] Statically access a property of a non-null relationship - unlabeled nodes not supported", () => {
    // Original TCK:
    // CREATE ()-[:REL {existing: 42, missing: null}]->()
    //
    // Limitation: Unlabeled nodes not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:REL {existing: 42, missing: null}]->()");
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:REL]->() RETURN r.missing, r.missingToo, r.existing",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([null, null, 42]);
  });

  test.fails("[6] Statically access a property of an optional non-null relationship - OPTIONAL MATCH not supported", () => {
    // Original TCK:
    // OPTIONAL MATCH ()-[r]->() RETURN r.missing, ...
    //
    // Limitations:
    // - Unlabeled nodes not supported
    // - OPTIONAL MATCH not fully supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:REL {existing: 42, missing: null}]->(:B)");
    const results = executeTckQuery(
      graph,
      "OPTIONAL MATCH ()-[r]->() RETURN r.missing, r.missingToo, r.existing",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([null, null, 42]);
  });

  test("[7] Statically access a property of a null relationship - OPTIONAL MATCH not supported", () => {
    // Original TCK:
    // OPTIONAL MATCH ()-[r]->() RETURN r.missing
    // Expected: null
    //
    // Limitation: OPTIONAL MATCH returning null not supported
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "OPTIONAL MATCH ()-[r]->() RETURN r.missing");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test.fails("[8] Statically access a property of a relationship from expression - list indexing not supported", () => {
    // Original TCK:
    // WITH [123, r] AS list RETURN (list[1]).missing, ...
    //
    // Limitations:
    // - Unlabeled nodes not supported
    // - List indexing not supported
    // - Parenthesized property access not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:REL {existing: 42, missing: null}]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH (:A)-[r:REL]->(:B) WITH [123, r] AS list RETURN (list[1]).missing, (list[1]).missingToo, (list[1]).existing",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([null, null, 42]);
  });

  test.fails("[9] Fail when performing property access on a non-graph element - semantic validation not implemented", () => {
    // Original TCK:
    // WITH 123 AS nonGraphElement RETURN nonGraphElement.num
    // Expected: TypeError
    //
    // Limitation: Type-based semantic validation not implemented
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "WITH 123 AS nonGraphElement RETURN nonGraphElement.num");
    }).toThrow();
  });

  // Custom tests demonstrating static property access that is supported

  test("[Custom 1] Access existing property on node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice', age: 30})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name, n.age");

    expect(results).toHaveLength(1);
    const [name, age] = results[0] as [string, number];
    expect(name).toBe("Alice");
    expect(age).toBe(30);
  });

  test("[Custom 2] Access missing property returns undefined", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice'})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name, n.missing");

    expect(results).toHaveLength(1);
    const [name, missing] = results[0] as [string, unknown];
    expect(name).toBe("Alice");
    expect(missing).toBeUndefined();
  });

  test("[Custom 3] Access property on relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice'})-[:KNOWS {since: 2020}]->(:B {name: 'Bob'})`,
    );

    const results = executeTckQuery(graph, "MATCH (:A)-[r:KNOWS]->(:B) RETURN r.since");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2020);
  });

  test("[Custom 4] Access multiple properties on relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A)-[:KNOWS {since: 2020, strength: 5}]->(:B)`);

    const results = executeTckQuery(graph, "MATCH (:A)-[r:KNOWS]->(:B) RETURN r.since, r.strength");

    expect(results).toHaveLength(1);
    const [since, strength] = results[0] as [number, number];
    expect(since).toBe(2020);
    expect(strength).toBe(5);
  });

  test("[Custom 5] Property access in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice', age: 30}), (:A {name: 'Bob', age: 25})`);

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.age > 28 RETURN n.name");

    expect(results).toHaveLength(1);
    // Single return item comes back directly
    expect(results[0]).toBe("Alice");
  });

  test("[Custom 6] Property access on newly created node", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE (n:A {name: 'Test', value: 42}) RETURN n.name, n.value",
    );

    expect(results).toHaveLength(1);
    const [name, value] = results[0] as [string, number];
    expect(name).toBe("Test");
    expect(value).toBe(42);
  });

  test("[Custom 7] Property access with different data types", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {str: 'hello', num: 42, flag: true})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.str, n.num, n.flag");

    expect(results).toHaveLength(1);
    const [str, num, flag] = results[0] as [string, number, boolean];
    expect(str).toBe("hello");
    expect(num).toBe(42);
    expect(flag).toBe(true);
  });
});
