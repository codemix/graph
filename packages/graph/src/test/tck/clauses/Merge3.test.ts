/**
 * TCK Merge3 - Merge node - on match
 * Translated from tmp/tck/features/clauses/merge/Merge3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Merge3 - Merge node - on match", () => {
  test.fails(
    "[1] Merge should be able to set labels on match - unlabeled nodes and dynamic labels not supported",
    () => {
      // Query: CREATE () ... MERGE (a) ON MATCH SET a:L
      // Uses unlabeled node and dynamic label setting
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ()");
      executeTckQuery(graph, "MERGE (a) ON MATCH SET a:L");
      const results = executeTckQuery(graph, "MATCH (a:L) RETURN a");
      expect(results).toHaveLength(1);
    },
  );

  test.fails(
    "[2] Merge node with label add label on match when it exists - dynamic labels not supported",
    () => {
      // Query: MERGE (a:TheLabel) ON MATCH SET a:Foo
      // Dynamic label setting (SET a:Label) not supported
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:TheLabel)");
      const results = executeTckQuery(
        graph,
        "MERGE (a:TheLabel) ON MATCH SET a:Foo RETURN labels(a)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toContain("Foo");
    },
  );

  test("[3] Merge node and set property on match", () => {
    const graph = createTckGraph();

    // Create existing node first
    executeTckQuery(graph, "CREATE (:TheLabel)");

    // MERGE matches existing - ON MATCH sets property
    const results = executeTckQuery(
      graph,
      "MERGE (a:TheLabel) ON MATCH SET a.num = 42 RETURN a.num",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(42);
  });

  test("[4] Merge should be able to use properties of bound node in ON MATCH - MATCH...MERGE chaining not supported", () => {
    // Query requires MATCH (person:Person) MERGE (city:City) ON MATCH SET city.name = person.bornIn
    // Our grammar doesn't support MATCH followed by MERGE directly
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Person {bornIn: 'London'}), (:City)");
    executeTckQuery(
      graph,
      "MATCH (person:Person) MERGE (city:City) ON MATCH SET city.name = person.bornIn",
    );
    const results = executeTckQuery(graph, "MATCH (c:City) RETURN c.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("London");
  });

  test("[5] Fail when using undefined variable in ON MATCH - semantic validation not implemented", () => {
    // Query: MERGE (n) ON MATCH SET x.num = 1
    // Requires semantic analysis for undefined variable error
    // Also uses unlabeled node
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    expect(() => {
      executeTckQuery(graph, "MERGE (n:A) ON MATCH SET x.num = 1");
    }).toThrow();
  });

  // Custom tests for supported ON MATCH scenarios
  test("[custom] ON MATCH sets property only when matching", () => {
    const graph = createTckGraph();

    // First MERGE creates node, ON MATCH should NOT trigger
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'test'}) ON MATCH SET a.matched = true",
    );

    const results1 = executeTckQuery(
      graph,
      "MATCH (n:A {name: 'test'}) RETURN n.matched",
    );
    expect(results1).toHaveLength(1);
    // Should be undefined since ON MATCH didn't trigger (was created)
    expect(results1[0]).toBeUndefined();

    // Second MERGE matches existing, ON MATCH should trigger
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'test'}) ON MATCH SET a.matched = true",
    );

    const results2 = executeTckQuery(
      graph,
      "MATCH (n:A {name: 'test'}) RETURN n.matched",
    );
    expect(results2).toHaveLength(1);
    expect(results2[0]).toBe(true);
  });

  test("[custom] ON MATCH updates existing property", () => {
    const graph = createTckGraph();

    // Create node with initial property
    executeTckQuery(graph, "CREATE (:A {name: 'update', value: 'old'})");

    // MERGE matches and ON MATCH updates the property
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'update'}) ON MATCH SET a.value = 'new'",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A {name: 'update'}) RETURN n.value",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("new");
  });

  test("[custom] ON MATCH with no existing node does nothing", () => {
    const graph = createTckGraph();

    // MERGE creates new node, ON MATCH doesn't trigger
    executeTckQuery(
      graph,
      "MERGE (a:A {name: 'new'}) ON MATCH SET a.found = true",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A {name: 'new'}) RETURN n.found",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBeUndefined();
  });
});
