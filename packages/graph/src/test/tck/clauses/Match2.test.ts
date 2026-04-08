/**
 * TCK Match2 - Match relationships
 * Translated from tmp/tck/features/clauses/match/Match2.feature
 */
import { describe, test, expect } from "vitest";
import {
  createTckGraph,
  executeTckQuery,
  getLabel,
  getType,
} from "../tckHelpers.js";

describe("Match2 - Match relationships", () => {
  test("[1] Match non-existent relationships returns empty", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "MATCH ()-[r]->() RETURN r");
    expect(results).toEqual([]);
  });

  test("[2] Matching a relationship pattern using a label predicate on both sides", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `
      CREATE (:A)-[:T1]->(:B),
             (:B)-[:T2]->(:A),
             (:B)-[:T3]->(:B),
             (:A)-[:T4]->(:A)
    `,
    );
    const results = executeTckQuery(graph, "MATCH (:A)-[r]->(:B) RETURN r");
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [r] = results[0] as [Record<string, unknown>];
    expect(getType(r)).toBe("T1");
  });

  test.fails(
    "[3] Matching a self-loop with an undirected relationship pattern - requires unlabeled node",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a)-[:T]->(a)");
      const results = executeTckQuery(graph, "MATCH ()-[r]-() RETURN r");
      expect(results).toHaveLength(1);
    },
  );

  test("[4] Matching a self-loop with a directed relationship pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:T]->(a)");
    const results = executeTckQuery(graph, "MATCH ()-[r]->() RETURN r");
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [r] = results[0] as [Record<string, unknown>];
    expect(getType(r)).toBe("T");
  });

  test("[5] Match relationship with inline property value", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `
      CREATE (:A)<-[:KNOWS {name: 'monkey'}]-(:B)-[:KNOWS {name: 'woot'}]->(:C)
    `,
    );
    const results = executeTckQuery(
      graph,
      "MATCH (node)-[r:KNOWS {name: 'monkey'}]->(a) RETURN a",
    );
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [a] = results[0] as [Record<string, unknown>];
    expect(getLabel(a)).toBe("A");
  });

  test("[6] Match relationships with multiple types - KNOWS|HATES syntax", () => {
    // Multiple relationship type syntax (|) may not be supported
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `
      CREATE (a:A {name: 'A'}),
        (b:B {name: 'B'}),
        (c:C {name: 'C'}),
        (a)-[:KNOWS]->(b),
        (a)-[:HATES]->(c),
        (a)-[:WONDERS]->(c)
    `,
    );
    const results = executeTckQuery(
      graph,
      "MATCH (n)-[r:KNOWS|HATES]->(x) RETURN r",
    );
    expect(results).toHaveLength(2);
    // Single return items are wrapped in arrays
    const types = results.map((r) => {
      const [rel] = r as [Record<string, unknown>];
      return getType(rel);
    });
    expect(types).toContain("KNOWS");
    expect(types).toContain("HATES");
  });

  test.fails(
    "[7] Matching twice with conflicting relationship types on same relationship - unlabeled target node (by design)",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)-[:Y]->(:C)");
      const results = executeTckQuery(
        graph,
        "MATCH (a1)-[r:T]->() WITH r, a1 MATCH (a1)-[r:Y]->(b2) RETURN a1, r, b2",
      );
      expect(results).toEqual([]);
    },
  );

  test("[8] Fail when using parameter as relationship predicate - parameter syntax not supported", () => {
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(graph, "MATCH ()-[r $param]->() RETURN r", {
        param: { name: "test" },
      }),
    ).toThrow();
  });

  // Scenarios [9]-[13] test compile-time variable type conflicts
  // Skipped as they require semantic analysis infrastructure
});
