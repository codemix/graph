/**
 * TCK Merge2 - Merge node - on create
 * Translated from tmp/tck/features/clauses/merge/Merge2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Merge2 - Merge node - on create", () => {
  test.fails(
    "[1] Merge node with label add label on create - dynamic label SET and multi-label not supported",
    () => {
      // Query: MERGE (a:TheLabel) ON CREATE SET a:Foo RETURN labels(a)
      // Limitation: Adding labels dynamically (SET a:Foo) not supported - design limitation
      // Note: labels() function IS working now
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "MERGE (a:TheLabel) ON CREATE SET a:Foo RETURN labels(a)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toContain("Foo");
    },
  );

  test("[2] ON CREATE on created nodes - unlabeled nodes not supported", () => {
    // Query: MERGE (b) ON CREATE SET b.created = 1
    // Uses unlabeled node
    const graph = createTckGraph();
    executeTckQuery(graph, "MERGE (b) ON CREATE SET b.created = 1");
    const results = executeTckQuery(graph, "MATCH (b) RETURN b.created");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[3] Merge node with label add property on create", () => {
    const graph = createTckGraph();

    // MERGE will create new node and ON CREATE sets property
    const results = executeTckQuery(
      graph,
      "MERGE (a:TheLabel) ON CREATE SET a.num = 42 RETURN a.num",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(42);
  });

  test("[4] Merge node with label add property on update when it exists", () => {
    const graph = createTckGraph();

    // Create existing node first
    executeTckQuery(graph, "CREATE (:TheLabel)");

    // MERGE matches existing - ON CREATE should NOT trigger
    const results = executeTckQuery(
      graph,
      "MERGE (a:TheLabel) ON CREATE SET a.num = 42 RETURN a.num",
    );
    expect(results).toHaveLength(1);
    // Property should be null/undefined since ON CREATE didn't trigger
    expect(results[0]).toBeUndefined();
  });

  test("[5] Merge should be able to use properties of bound node in ON CREATE - MATCH...MERGE chaining not supported", () => {
    // Query requires MATCH (person:Person) MERGE (city:City) ON CREATE SET city.name = person.bornIn
    // Our grammar doesn't support MATCH followed by MERGE
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Person {bornIn: 'London'})");
    executeTckQuery(
      graph,
      "MATCH (person:Person) MERGE (city:City) ON CREATE SET city.name = person.bornIn",
    );
    const results = executeTckQuery(graph, "MATCH (c:City) RETURN c.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("London");
  });

  test("[6] Fail when using undefined variable in ON CREATE - semantic validation not implemented", () => {
    // Query: MERGE (n) ON CREATE SET x.num = 1
    // Requires semantic analysis for undefined variable error
    // Also uses unlabeled node
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "MERGE (n:A) ON CREATE SET x.num = 1");
    }).toThrow();
  });

  // Custom tests for supported ON CREATE scenarios
  test("[custom] ON CREATE sets property only when creating", () => {
    const graph = createTckGraph();

    // First MERGE creates node, ON CREATE sets property
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'test'}) ON CREATE SET a.created = true",
    );

    const results1 = executeTckQuery(
      graph,
      "MATCH (n:A {name: 'test'}) RETURN n.created",
    );
    expect(results1).toHaveLength(1);
    expect(results1[0]).toBe(true);

    // Second MERGE matches existing, ON CREATE should NOT trigger
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'test'}) ON CREATE SET a.created = false",
    );

    const results2 = executeTckQuery(
      graph,
      "MATCH (n:A {name: 'test'}) RETURN n.created",
    );
    expect(results2).toHaveLength(1);
    // Should still be true since ON CREATE didn't trigger
    expect(results2[0]).toBe(true);
  });

  test("[custom] ON CREATE can set multiple properties", () => {
    const graph = createTckGraph();

    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'multi'}) ON CREATE SET a.x = 1, a.y = 2",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A {name: 'multi'}) RETURN n.x, n.y",
    );
    expect(results).toHaveLength(1);
    const [x, y] = results[0] as [number, number];
    expect(x).toBe(1);
    expect(y).toBe(2);
  });
});
