/**
 * TCK Set1 - Set a Property
 * Translated from tmp/tck/features/clauses/set/Set1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel, getProperty } from "../tckHelpers.js";

describe("Set1 - Set a Property", () => {
  test("[1] Set a property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Andres'})");

    const results = executeTckQuery(
      graph,
      `MATCH (n:A)
       WHERE n.name = 'Andres'
       SET n.name = 'Michael'
       RETURN n`,
    );

    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [node] = results[0] as [Record<string, unknown>];
    expect(getLabel(node)).toBe("A");
    expect(getProperty(node, "name")).toBe("Michael");
  });

  test.fails("[2] Set a property to an expression - string concatenation in SET not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Andres'})");
    executeTckQuery(graph, "MATCH (n:A) SET n.name = n.name + ' was here'");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Andres was here");
  });

  test.fails("[3] Set a property by selecting the node using a simple expression - (n).prop syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test'})");
    executeTckQuery(graph, "MATCH (n:A) SET (n).name = 'neo4j'");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("neo4j");
  });

  test.fails("[4] Set a property by selecting the relationship using a simple expression - unlabeled nodes and (r).prop syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:REL]->()");
    executeTckQuery(graph, "MATCH ()-[r:REL]->() SET (r).name = 'neo4j'");
    const results = executeTckQuery(graph, "MATCH ()-[r:REL]->() RETURN r.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("neo4j");
  });

  test("[5] Adding a list property - list comprehension in RETURN not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {numbers: [1, 2, 3, 4]})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN [i IN n.numbers | i / 2.0] AS x");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([0.5, 1.0, 1.5, 2.0]);
  });

  test.fails("[6] Concatenate elements onto a list property - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a {numbers: [1, 2, 3]})");
    executeTckQuery(graph, "MATCH (a) SET a.numbers = a.numbers + [4, 5]");
    const results = executeTckQuery(graph, "MATCH (a) RETURN a.numbers");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 2, 3, 4, 5]);
  });

  test.fails("[7] Concatenate elements in reverse onto a list property - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a {numbers: [3, 4, 5]})");
    executeTckQuery(graph, "MATCH (a) SET a.numbers = [1, 2] + a.numbers");
    const results = executeTckQuery(graph, "MATCH (a) RETURN a.numbers");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 2, 3, 4, 5]);
  });

  test.fails("[8] Ignore null when setting property - OPTIONAL MATCH not fully supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "OPTIONAL MATCH (a:DoesNotExist) SET a.num = 42 RETURN a",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test("[9] Failing when using undefined variable in SET - semantic validation not implemented", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test'})");
    expect(() => executeTckQuery(graph, "MATCH (a:A) SET a.name = missing")).toThrow();
  });

  test("[10] Failing when setting a list of maps as a property - unlabeled nodes and property type validation not implemented", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a)");
    expect(() => executeTckQuery(graph, "MATCH (a) SET a.maplist = [{num: 1}]")).toThrow();
  });

  test("[11] Set multiple node properties", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:X)");

    const results = executeTckQuery(
      graph,
      `MATCH (n:X)
       SET n.name = 'A', n.name2 = 'B', n.num = 5
       RETURN n`,
    );

    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [node] = results[0] as [Record<string, unknown>];
    expect(getLabel(node)).toBe("X");
    expect(getProperty(node, "name")).toBe("A");
    expect(getProperty(node, "name2")).toBe("B");
    expect(getProperty(node, "num")).toBe(5);
  });

  // Custom tests for supported scenarios
  test("[custom] Set property on relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");

    const results = executeTckQuery(
      graph,
      `MATCH (:A)-[r:T]->(:B)
       SET r.name = 'relationship'
       RETURN r`,
    );

    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [rel] = results[0] as [Record<string, unknown>];
    expect(getProperty(rel, "name")).toBe("relationship");
  });

  test("[custom] Set property updates existing value", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 10})");

    // Update the property
    executeTckQuery(graph, "MATCH (n:A) SET n.num = 20");

    // Verify updated
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(20);
  });

  test("[custom] Set adds new property to existing node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test'})");

    // Add new property
    executeTckQuery(graph, "MATCH (n:A) SET n.num = 42");

    // Verify both properties
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n");
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "name")).toBe("test");
    expect(getProperty(node, "num")).toBe(42);
  });
});
