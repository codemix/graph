/**
 * TCK Set2 - Set a Property to Null
 * Translated from tmp/tck/features/clauses/set/Set2.feature
 */
import { describe, test, expect } from "vitest";
import {
  createTckGraph,
  executeTckQuery,
  getLabel,
  getProperty,
} from "../tckHelpers.js";

describe("Set2 - Set a Property to Null", () => {
  test("[1] Setting a node property to null removes the existing property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {property1: 23, property2: 46})");

    const results = executeTckQuery(
      graph,
      `MATCH (n:A)
       SET n.property1 = null
       RETURN n`,
    );

    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [node] = results[0] as [Record<string, unknown>];
    expect(getLabel(node)).toBe("A");
    // property1 should be removed (null/undefined) - our implementation sets to null
    expect(getProperty(node, "property1")).toBeNull();
    expect(getProperty(node, "property2")).toBe(46);
  });

  test("[2] Setting a node property to null removes the existing property, but not before SET - unlabeled WHERE clause not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name: 'Michael', num: 42})");
    executeTckQuery(
      graph,
      "MATCH (n) WHERE n.name = 'Michael' SET n.name = null",
    );
    const results = executeTckQuery(graph, "MATCH (n) RETURN n.name, n.num");
    expect(results).toHaveLength(1);
    const [name, num] = results[0] as [unknown, number];
    expect(name).toBeNull();
    expect(num).toBe(42);
  });

  test("[3] Setting a relationship property to null removes the existing property - unlabeled nodes and untyped relationship match not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE ()-[:REL {property1: 12, property2: 24}]->()",
    );
    executeTckQuery(graph, "MATCH ()-[r]->() SET r.property1 = null");
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r]->() RETURN r.property1, r.property2",
    );
    expect(results).toHaveLength(1);
    const [prop1, prop2] = results[0] as [unknown, number];
    expect(prop1).toBeNull();
    expect(prop2).toBe(24);
  });

  // Custom tests for supported scenarios
  test("[custom] Set property to null on labeled node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', num: 42})");

    // Set name to null
    executeTckQuery(graph, "MATCH (n:A) SET n.name = null");

    // Verify name is set to null but num remains
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n");
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [node] = results[0] as [Record<string, unknown>];
    // Our implementation sets property to null rather than removing it
    expect(getProperty(node, "name")).toBeNull();
    expect(getProperty(node, "num")).toBe(42);
  });

  test("[custom] Set relationship property to null", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T {name: 'rel', num: 10}]->(:B)");

    // Set name to null
    executeTckQuery(graph, "MATCH (:A)-[r:T]->(:B) SET r.name = null");

    // Verify name is set to null but num remains
    const results = executeTckQuery(graph, "MATCH (:A)-[r:T]->(:B) RETURN r");
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [rel] = results[0] as [Record<string, unknown>];
    // Our implementation sets property to null rather than removing it
    expect(getProperty(rel, "name")).toBeNull();
    expect(getProperty(rel, "num")).toBe(10);
  });
});
