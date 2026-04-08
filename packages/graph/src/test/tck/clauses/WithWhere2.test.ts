/**
 * TCK WithWhere2 - Filter multiple variables
 * Translated from tmp/tck/features/clauses/with-where/WithWhere2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("WithWhere2 - Filter multiple variables", () => {
  test.fails("[1] Filter nodes with conjunctive two-part property predicate on multi variables with multiple bindings - unlabeled edge pattern not supported", () => {
    // Original test uses: MATCH (a)--(b)--(c)--(d)--(a), (b)--(d)
    // Undirected edge patterns not well supported
    // Also requires multiple comma-separated patterns
    // WITH a, c, d WHERE a.id = 1 AND c.id = 2 RETURN d
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:N {id: 1}), (b:N {id: 2}), (c:N {id: 2}), (d:N {id: 3})");
    executeTckQuery(
      graph,
      "MATCH (a:N {id: 1}), (b:N {id: 2}), (c:N {id: 2}), (d:N {id: 3}) CREATE (a)-[:R]->(b), (b)-[:R]->(c), (c)-[:R]->(d), (d)-[:R]->(a), (b)-[:R]->(d)",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a)--(b)--(c)--(d)--(a), (b)--(d) WITH a, c, d WHERE a.id = 1 AND c.id = 2 RETURN d",
    );
    expect(results.length).toBe(1);
    const node = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(getProperty(node as Record<string, unknown>, "id")).toBe(3);
  });

  test.fails("[2] Filter node with conjunctive multi-part property predicates on multi variables with multiple bindings - undirected edges not supported", () => {
    // Original test uses: MATCH (advertiser)--(a)--(b)--(advertiser)
    // Parameters ($1, $2) ARE supported, but undirected edges not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (adv:Advertiser {id: 1}), (a:N {id: 2}), (b:N {id: 3})");
    executeTckQuery(
      graph,
      "MATCH (adv:Advertiser), (a:N {id: 2}), (b:N {id: 3}) CREATE (adv)-[:R]->(a), (a)-[:R]->(b), (b)-[:R]->(adv)",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (advertiser)--(a)--(b)--(advertiser) WITH a, b WHERE a.id = $1 AND b.id = $2 RETURN a, b",
      { params: { 1: 2, 2: 3 } },
    );
    expect(results.length).toBe(1);
    const [aNode, bNode] = results[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(getProperty(aNode, "id")).toBe(2);
    expect(getProperty(bNode, "id")).toBe(3);
  });

  // Custom tests for WITH WHERE with multiple variables
  test("[custom-1] Filter on multiple variables with AND", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a1', value: 1})");
    executeTckQuery(graph, "CREATE (:B {name: 'b1', value: 2})");
    executeTckQuery(graph, "CREATE (:A {name: 'a2', value: 3})");
    executeTckQuery(graph, "CREATE (:B {name: 'b2', value: 4})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) WITH a, b WHERE a.value < 2 AND b.value > 3 RETURN a.name, b.name",
    );
    expect(results.length).toBe(1);
    const [aName, bName] = results[0] as [string, string];
    expect(aName).toBe("a1");
    expect(bName).toBe("b2");
  });

  test("[custom-2] Filter on multiple related variables", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {id: 1})-[:T]->(:B {id: 2})-[:T]->(:C {id: 3})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:T]->(b:B)-[:T]->(c:C) WITH a, b, c WHERE b.id = 2 RETURN a.id, b.id, c.id",
    );
    expect(results.length).toBe(1);
    const [aId, bId, cId] = results[0] as [number, number, number];
    expect(aId).toBe(1);
    expect(bId).toBe(2);
    expect(cId).toBe(3);
  });
});
