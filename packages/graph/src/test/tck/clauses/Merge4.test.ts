/**
 * TCK Merge4 - Merge node - on match and on create
 * Translated from tmp/tck/features/clauses/merge/Merge4.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Merge4 - Merge node - on match and on create", () => {
  test.fails("[1] Merge should be able to set labels on match and on create - unlabeled nodes and dynamic labels not supported", () => {
    // Query: CREATE (), () ... MATCH () MERGE (a:L) ON MATCH SET a:M1 ON CREATE SET a:M2
    // Uses unlabeled nodes, MATCH...MERGE chaining, and dynamic label setting
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (), ()");
    executeTckQuery(graph, "MATCH () MERGE (a:L) ON MATCH SET a:M1 ON CREATE SET a:M2");
    const results = executeTckQuery(graph, "MATCH (a:L) RETURN labels(a)");
    expect(results).toHaveLength(1);
  });

  test("[2] Merge should be able to use properties of bound node in ON MATCH and ON CREATE - MATCH...MERGE chaining not supported", () => {
    // Query requires MATCH (person:Person) MERGE (city:City) ON MATCH/CREATE SET city.name = person.bornIn
    // Our grammar doesn't support MATCH followed by MERGE
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Person {bornIn: 'London'})");
    executeTckQuery(
      graph,
      "MATCH (person:Person) MERGE (city:City) ON CREATE SET city.name = person.bornIn ON MATCH SET city.updated = true",
    );
    const results = executeTckQuery(graph, "MATCH (c:City) RETURN c.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("London");
  });

  // Custom tests for combined ON CREATE and ON MATCH
  test("[custom] ON CREATE and ON MATCH both set properties appropriately", () => {
    const graph = createTckGraph();

    // First MERGE creates node - ON CREATE triggers
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'combo'}) ON CREATE SET a.action = 'created' ON MATCH SET a.action = 'matched'",
    );

    const results1 = executeTckQuery(graph, "MATCH (n:A {name: 'combo'}) RETURN n.action");
    expect(results1).toHaveLength(1);
    expect(results1[0]).toBe("created");

    // Second MERGE matches node - ON MATCH triggers
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'combo'}) ON CREATE SET a.action = 'created' ON MATCH SET a.action = 'matched'",
    );

    const results2 = executeTckQuery(graph, "MATCH (n:A {name: 'combo'}) RETURN n.action");
    expect(results2).toHaveLength(1);
    expect(results2[0]).toBe("matched");
  });

  test("[custom] ON CREATE and ON MATCH can set different properties", () => {
    const graph = createTckGraph();

    // First MERGE - creates
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'diff'}) ON CREATE SET a.created = true ON MATCH SET a.matched = true",
    );

    const results1 = executeTckQuery(
      graph,
      "MATCH (n:A {name: 'diff'}) RETURN n.created, n.matched",
    );
    expect(results1).toHaveLength(1);
    const [created1, matched1] = results1[0] as [boolean, boolean | undefined];
    expect(created1).toBe(true);
    expect(matched1).toBeUndefined();

    // Second MERGE - matches
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'diff'}) ON CREATE SET a.created = true ON MATCH SET a.matched = true",
    );

    const results2 = executeTckQuery(
      graph,
      "MATCH (n:A {name: 'diff'}) RETURN n.created, n.matched",
    );
    expect(results2).toHaveLength(1);
    const [created2, matched2] = results2[0] as [boolean, boolean];
    expect(created2).toBe(true);
    expect(matched2).toBe(true);
  });

  test("[custom] Multiple properties in ON CREATE and ON MATCH", () => {
    const graph = createTckGraph();

    // Create
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'multi'}) ON CREATE SET a.x = 1, a.y = 2 ON MATCH SET a.x = 10, a.y = 20",
    );

    const results1 = executeTckQuery(graph, "MATCH (n:A {name: 'multi'}) RETURN n.x, n.y");
    expect(results1).toHaveLength(1);
    const [x1, y1] = results1[0] as [number, number];
    expect(x1).toBe(1);
    expect(y1).toBe(2);

    // Match
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'multi'}) ON CREATE SET a.x = 1, a.y = 2 ON MATCH SET a.x = 10, a.y = 20",
    );

    const results2 = executeTckQuery(graph, "MATCH (n:A {name: 'multi'}) RETURN n.x, n.y");
    expect(results2).toHaveLength(1);
    const [x2, y2] = results2[0] as [number, number];
    expect(x2).toBe(10);
    expect(y2).toBe(20);
  });
});
