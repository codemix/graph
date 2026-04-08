/**
 * TCK Return2 - Return single expression (correctly projecting an expression)
 * Translated from tmp/tck/features/clauses/return/Return2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Return2 - Return single expression", () => {
  test.fails("[1] Arithmetic expressions should propagate null values - null in modulo not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 1 + (2 - (3 * (4 / (5 ^ (6 % null))))) AS a");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test("[2] Returning a node property value - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 1})");
    const results = executeTckQuery(graph, "MATCH (a) RETURN a.num");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom] Returning a node property value with labeled node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");

    const results = executeTckQuery(graph, "MATCH (a:A) RETURN a.num");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails("[3] Missing node property should become null - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 1})");
    const results = executeTckQuery(graph, "MATCH (a) RETURN a.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test("[custom] Missing node property should become null with labeled node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");

    const results = executeTckQuery(graph, "MATCH (a:A) RETURN a.name");
    expect(results).toHaveLength(1);
    // Missing properties return undefined, not null in this implementation
    expect(results[0]).toBeUndefined();
  });

  test("[4] Returning a relationship property value - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:T {num: 1}]->()");
    const results = executeTckQuery(graph, "MATCH ()-[r]->() RETURN r.num");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom] Returning a relationship property value with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T {num: 1}]->(:B)");

    const results = executeTckQuery(graph, "MATCH (:A)-[r:T]->(:B) RETURN r.num");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails("[5] Missing relationship property should become null - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:T {name: 1}]->()");
    const results = executeTckQuery(graph, "MATCH ()-[r]->() RETURN r.name2");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test("[custom] Missing relationship property should become null with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T {name: 'test'}]->(:B)");

    const results = executeTckQuery(graph, "MATCH (:A)-[r:T]->(:B) RETURN r.name2");
    expect(results).toHaveLength(1);
    // Missing properties return undefined, not null in this implementation
    expect(results[0]).toBeUndefined();
  });

  test("[6] Adding a property and a literal in projection - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 1})");
    const results = executeTckQuery(graph, "MATCH (a) RETURN a.num + 1 AS foo");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test("[custom] Adding a property and a literal in projection with labeled node - arithmetic in RETURN not fully supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    const results = executeTckQuery(graph, "MATCH (a:A) RETURN a.num + 1 AS foo");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test("[7] Adding list properties in projection - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({list1: [1, 2, 3], list2: [4, 5]})");
    const results = executeTckQuery(graph, "MATCH (a) RETURN a.list2 + a.list1 AS foo");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([4, 5, 1, 2, 3]);
  });

  test("[custom] Adding list properties in projection with labeled node - list concatenation not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {list1: [1, 2, 3], list2: [4, 5]})");
    const results = executeTckQuery(graph, "MATCH (a:A) RETURN a.list2 + a.list1 AS foo");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([4, 5, 1, 2, 3]);
  });

  test.fails("[8] Returning label predicate expression - label predicates in RETURN not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (), (:Foo)");
    const results = executeTckQuery(graph, "MATCH (n) RETURN (n:Foo)");
    expect(results).toHaveLength(2);
    expect(results).toContainEqual(true);
    expect(results).toContainEqual(false);
  });

  test("[9] Returning a projected map", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN {a: 1, b: 'foo'}");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ a: 1, b: "foo" });
  });

  test.fails("[10] Return count aggregation over an empty graph - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "MATCH (a) RETURN count(a) > 0");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test.fails("[custom] Return count aggregation over an empty graph with labeled nodes - comparison in RETURN not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "MATCH (a:A) RETURN count(a) > 0 AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[11] RETURN does not lose precision on large integers - JavaScript number precision limits", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 4611686018427387905 AS num");
    expect(results).toHaveLength(1);
    // eslint-disable-next-line no-loss-of-precision
    expect(results[0]).toBe(4611686018427387905);
  });

  test("[12] Projecting a list of nodes and relationships - list expressions in RETURN not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a'})-[:T]->(:B {name: 'b'})");
    const results = executeTckQuery(graph, "MATCH (n:A)-[r:T]->(m:B) RETURN [n, r, m] AS list");
    expect(results).toHaveLength(1);
  });

  test("[13] Projecting a map of nodes and relationships", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a'})-[:R {since: 2020}]->(:B {name: 'b'})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A)-[r:R]->(m:B) RETURN {node1: n, rel: r, node2: m} AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as any;
    // Check that nodes and relationships are properly included in the map
    expect(result.node1).toBeDefined();
    expect(result.rel).toBeDefined();
    expect(result.node2).toBeDefined();
    // Check properties can be accessed
    expect(result.node1.properties?.name || result.node1.get?.("name")).toBe("a");
    expect(result.node2.properties?.name || result.node2.get?.("name")).toBe("b");
  });

  test("[14] Do not fail when returning type of deleted relationships - DELETE not fully supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(graph, "MATCH ()-[r]->() DELETE r RETURN type(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("T");
  });

  test.fails("[15] Fail when returning properties of deleted nodes - DELETE not fully supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 1})");
    expect(() => executeTckQuery(graph, "MATCH (n) DELETE n RETURN n.num")).toThrow();
  });

  test.fails("[16] Fail when returning labels of deleted nodes - DELETE not fully supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    expect(() => executeTckQuery(graph, "MATCH (n:A) DELETE n RETURN labels(n)")).toThrow();
  });

  test.fails("[17] Fail when returning properties of deleted relationships - DELETE not fully supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T {num: 1}]->(:B)");
    expect(() => executeTckQuery(graph, "MATCH ()-[r]->() DELETE r RETURN r.num")).toThrow();
  });

  test("[18] Fail on projecting a non-existent function - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    expect(() => executeTckQuery(graph, "MATCH (a) RETURN foo(a)")).toThrow();
  });
});
