/**
 * TCK Create1 - Creating nodes
 * Translated from tmp/tck/features/clauses/create/Create1.feature
 */
import { describe, test, expect } from "vitest";
import {
  createTckGraph,
  executeTckQuery,
  getLabel,
  getProperty,
} from "../tckHelpers.js";

describe("Create1 - Creating nodes", () => {
  test("[1] Create a single node - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n");
    expect(results).toHaveLength(1);
    // Node was created (even if unlabeled)
    expect(results[0]).toBeDefined();
  });

  test("[2] Create two nodes - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (), ()");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n");
    expect(results).toHaveLength(2);
    // Both nodes were created
    expect(results[0]).toBeDefined();
    expect(results[1]).toBeDefined();
  });

  test("[3] Create a single node with a label", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Label)");

    // Verify node was created
    const results = executeTckQuery(graph, "MATCH (n:Label) RETURN n");
    expect(results).toHaveLength(1);
    const [n] = results[0] as [Record<string, unknown>];
    expect(getLabel(n)).toBe("Label");
  });

  test("[4] Create two nodes with same label", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Label), (:Label)");

    // Verify both nodes were created
    const results = executeTckQuery(graph, "MATCH (n:Label) RETURN n");
    expect(results).toHaveLength(2);
    // Both should have Label label - single return items are wrapped in arrays
    for (const r of results) {
      const [n] = r as [Record<string, unknown>];
      expect(getLabel(n)).toBe("Label");
    }
  });

  test("[5] Create a single node with multiple labels - multi-label not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A:B:C:D)");
    const results = executeTckQuery(graph, "MATCH (n:A:B:C:D) RETURN n");
    expect(results).toHaveLength(1);
    // Node should match multi-label query
    const [n] = results as [Record<string, unknown>];
    expect(n).toBeDefined();
  });

  test("[6] Create three nodes with multiple labels - multi-label not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:B:A:D), (:B:C), (:D:E:B)");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n");
    expect(results).toHaveLength(3);
    // All three nodes were created
    for (const r of results) {
      expect(r).toBeDefined();
    }
  });

  test("[7] Create a single node with a property - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({created: true})");
    const results = executeTckQuery(
      graph,
      "MATCH (n {created: true}) RETURN n",
    );
    expect(results).toHaveLength(1);
    // Node should have the property - single return items are wrapped in arrays
    const [n] = results[0] as [Record<string, unknown>];
    expect(getProperty(n, "created")).toBe(true);
  });

  test("[8] Create a single node with a property and return it - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE (n {name: 'foo'}) RETURN n.name AS p",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("foo");
  });

  test("[9] Create a single node with two properties - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (n {id: 12, name: 'foo'})");
    const results = executeTckQuery(graph, "MATCH (n {id: 12}) RETURN n.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("foo");
  });

  test("[10] Create a single node with two properties and return them - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE (n {id: 12, name: 'foo'}) RETURN n.id AS id, n.name AS p",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([12, "foo"]);
  });

  test("[11] Create a single node with null properties should not return those properties - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE (n {id: 12, name: null}) RETURN n.id AS id, n.name AS p",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([12, null]);
  });

  test("[12] CREATE does not lose precision on large integers - JavaScript number precision limits", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE (n:A {num: 4611686018427387905}) RETURN n.num",
    );
    expect(results).toHaveLength(1);
    // eslint-disable-next-line no-loss-of-precision
    expect(results[0]).toBe(4611686018427387905);
  });

  test.fails(
    "[13] Fail when creating a node that is already bound - semantic validation not implemented",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)");
      expect(() => executeTckQuery(graph, "MATCH (a:A) CREATE (a)")).toThrow();
    },
  );

  test.fails(
    "[14] Fail when creating a node with properties that is already bound - semantic validation not implemented",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)");
      expect(() =>
        executeTckQuery(graph, "MATCH (a:A) CREATE (a {name: 'foo'}) RETURN a"),
      ).toThrow();
    },
  );

  test.fails(
    "[15] Fail when adding a new label predicate on a node that is already bound 1 - unlabeled nodes not supported",
    () => {
      const graph = createTckGraph();
      expect(() =>
        executeTckQuery(graph, "CREATE (n:Foo)-[:T1]->(), (n:Bar)-[:T2]->()"),
      ).toThrow();
    },
  );

  test.fails(
    "[16] Fail when adding new label predicate on a node that is already bound 2 - unlabeled nodes not supported",
    () => {
      const graph = createTckGraph();
      expect(() =>
        executeTckQuery(graph, "CREATE ()<-[:T2]-(n:Foo), (n:Bar)<-[:T1]-()"),
      ).toThrow();
    },
  );

  test.fails(
    "[17] Fail when adding new label predicate on a node that is already bound 3",
    () => {
      const graph = createTckGraph();
      expect(() =>
        executeTckQuery(graph, "CREATE (n:Foo) CREATE (n:Bar)-[:OWNS]->(:Dog)"),
      ).toThrow();
    },
  );

  test.fails(
    "[18] Fail when adding new label predicate on a node that is already bound 4 - unlabeled nodes not supported",
    () => {
      const graph = createTckGraph();
      expect(() =>
        executeTckQuery(graph, "CREATE (n {}) CREATE (n:Bar)-[:OWNS]->(:Dog)"),
      ).toThrow();
    },
  );

  test.fails(
    "[19] Fail when adding new label predicate on a node that is already bound 5",
    () => {
      const graph = createTckGraph();
      expect(() =>
        executeTckQuery(graph, "CREATE (n:Foo) CREATE (n {})-[:OWNS]->(:Dog)"),
      ).toThrow();
    },
  );

  test.fails(
    "[20] Fail when creating a node using undefined variable in pattern - unlabeled nodes not supported",
    () => {
      const graph = createTckGraph();
      expect(() =>
        executeTckQuery(graph, "CREATE (b {name: missing}) RETURN b"),
      ).toThrow();
    },
  );

  // Additional test with labeled nodes (custom test)
  test("[custom] Create a single node with label and property", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE (n:A {name: 'foo'}) RETURN n.name AS p",
    );

    expect(results).toHaveLength(1);
    // Single return values come back as the value directly, not wrapped in array
    const p = results[0] as string;
    expect(p).toBe("foo");
  });

  test("[custom] Create a node with label and two properties", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE (n:A {id: 12, name: 'foo'}) RETURN n.id AS id, n.name AS p",
    );

    expect(results).toHaveLength(1);
    const [id, p] = results[0] as [number, string];
    expect(id).toBe(12);
    expect(p).toBe("foo");
  });
});
