/**
 * TCK ExistentialSubquery1 - Simple existential subquery
 * Translated from tmp/tck/features/expressions/existentialSubqueries/ExistentialSubquery1.feature
 *
 * Tests EXISTS { pattern [WHERE condition] } syntax for filtering nodes based on
 * whether a matching pattern exists.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("ExistentialSubquery1 - Simple existential subquery", () => {
  // Original TCK scenarios - most use unlabeled nodes or full subquery syntax

  test("[1] Simple subquery without WHERE clause - unlabeled nodes not supported", () => {
    // Original TCK:
    // CREATE (a:A {prop: 1})-[:R]->(b:B {prop: 1}), (a)-[:R]->(:C {prop: 2}), (a)-[:R]->(:D {prop: 3})
    // MATCH (n) WHERE exists { (n)-->() } RETURN n
    // Expected: (:A {prop:1})
    //
    // The unlabeled nodes in the MATCH pattern and the undirected arrow syntax are not supported
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (a:A {prop: 1})-[:R]->(b:B {prop: 1}), (a)-[:R]->(:C {prop: 2}), (a)-[:R]->(:D {prop: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n) WHERE exists { (n)-->() } RETURN n",
    );

    expect(results).toHaveLength(1);
  });

  test("[2] Simple subquery with WHERE clause - unlabeled nodes not supported", () => {
    // Original TCK:
    // MATCH (n) WHERE exists { (n)-->(m) WHERE n.prop = m.prop } RETURN n
    // Expected: (:A {prop:1})
    //
    // Unlabeled nodes not supported
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (a:A {prop: 1})-[:R]->(b:B {prop: 1}), (a)-[:R]->(:C {prop: 2}), (a)-[:R]->(:D {prop: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n) WHERE exists { (n)-->(m) WHERE n.prop = m.prop } RETURN n",
    );

    expect(results).toHaveLength(1);
  });

  test("[3] Simple subquery without WHERE clause, not existing pattern - unlabeled nodes not supported", () => {
    // Original TCK:
    // MATCH (n) WHERE exists { (n)-[:NA]->() } RETURN n
    // Expected: empty result
    //
    // Unlabeled nodes not supported
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (a:A {prop: 1})-[:R]->(b:B {prop: 1}), (a)-[:R]->(:C {prop: 2}), (a)-[:R]->(:D {prop: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n) WHERE exists { (n)-[:NA]->() } RETURN n",
    );

    expect(results).toHaveLength(0);
  });

  test("[4] Simple subquery with WHERE clause, not existing pattern - unlabeled nodes not supported", () => {
    // Original TCK:
    // MATCH (n) WHERE exists { (n)-[r]->() WHERE type(r) = 'NA' } RETURN n
    // Expected: empty result
    //
    // Limitation: Unlabeled nodes in MATCH pattern - design limitation
    // Note: type() function IS working now
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (a:A {prop: 1})-[:R]->(b:B {prop: 1}), (a)-[:R]->(:C {prop: 2}), (a)-[:R]->(:D {prop: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n) WHERE exists { (n)-[r]->() WHERE type(r) = 'NA' } RETURN n",
    );

    expect(results).toHaveLength(0);
  });

  // Custom tests demonstrating supported EXISTS functionality

  test("[C1] EXISTS returns nodes with outgoing relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {prop: 1})-[:R]->(:B {prop: 1}), (:C {prop: 2})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE EXISTS { (n)-[:R]->(m) } RETURN n.prop`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[C2] EXISTS with label filter on target node", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a1'})-[:R]->(:B {name: 'b1'}), (:A {name: 'a2'})-[:R]->(:C {name: 'c1'})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE EXISTS { (n)-[:R]->(m:B) } RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a1");
  });

  test("[C3] EXISTS with WHERE condition filtering target properties", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'alice'})-[:R]->(:B {num: 10}), (:A {name: 'bob'})-[:R]->(:B {num: 5})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE EXISTS { (n)-[:R]->(m:B) WHERE m.num > 7 } RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("alice");
  });

  test("[C4] EXISTS returns empty when no matching relationships", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {prop: 1}), (:B {prop: 2})`);

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE EXISTS { (n)-[:NA]->(m) } RETURN n`,
    );

    expect(results).toHaveLength(0);
  });

  test("[C5] EXISTS with incoming relationship direction", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a1'})-[:R]->(:B {name: 'b1'}), (:C {name: 'c1'})`,
    );

    // Check for incoming relationships
    const results = executeTckQuery(
      graph,
      `MATCH (n:B) WHERE EXISTS { (n)<-[:R]-(m) } RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("b1");
  });

  test("[C6] EXISTS with bidirectional relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a1'})-[:R]->(:B {name: 'b1'})`);

    // Bidirectional pattern matches either direction
    const resultsA = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE EXISTS { (n)-[:R]-(m) } RETURN n.name`,
    );
    expect(resultsA).toHaveLength(1);
    expect(resultsA[0]).toBe("a1");

    const resultsB = executeTckQuery(
      graph,
      `MATCH (n:B) WHERE EXISTS { (n)-[:R]-(m) } RETURN n.name`,
    );
    expect(resultsB).toHaveLength(1);
    expect(resultsB[0]).toBe("b1");
  });

  test("[C7] EXISTS comparing properties between outer and inner pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1})-[:R]->(:B {num: 1}), (:A {num: 2})-[:R]->(:B {num: 3})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE EXISTS { (n)-[:R]->(m:B) WHERE n.num = m.num } RETURN n.num`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[C8] NOT EXISTS filters nodes without matching pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'connected'})-[:R]->(:B), (:A {name: 'isolated'})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE NOT EXISTS { (n)-[:R]->(m) } RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("isolated");
  });

  test("[C9] EXISTS combined with other conditions using AND", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a1', num: 10})-[:R]->(:B), (:A {name: 'a2', num: 5})-[:R]->(:B), (:A {name: 'a3', num: 20})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE EXISTS { (n)-[:R]->(m) } AND n.num > 7 RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a1");
  });

  test("[C10] EXISTS with multiple relationship types", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a1'})-[:R]->(:B), (:A {name: 'a2'})-[:T]->(:B), (:A {name: 'a3'})`,
    );

    const resultsR = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE EXISTS { (n)-[:R]->(m) } RETURN n.name`,
    );
    expect(resultsR).toHaveLength(1);
    expect(resultsR[0]).toBe("a1");

    const resultsT = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE EXISTS { (n)-[:T]->(m) } RETURN n.name`,
    );
    expect(resultsT).toHaveLength(1);
    expect(resultsT[0]).toBe("a2");
  });
});
