/**
 * TCK With3 - Forward multiple expressions
 * Translated from tmp/tck/features/clauses/with/With3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel, getType } from "../tckHelpers.js";

describe("With3 - Forward multiple expressions", () => {
  test.fails("[1] Forwarding multiple node and relationship variables - relationship variable in MATCH after WITH creates Cartesian product", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T {id: 1}]->(:X)");
    executeTckQuery(graph, "CREATE (:A)-[:T {id: 2}]->(:X)");
    const results = executeTckQuery(
      graph,
      "MATCH (a)-[r]->(b:X) WITH a, r, b MATCH (a)-[r]->(b) RETURN r AS rel ORDER BY rel.id",
    );
    // Should return each relationship once (bound variable verification)
    expect(results).toHaveLength(2);
  });

  // Custom tests for supported patterns
  test("[custom-1] WITH forwarding multiple variables to RETURN", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a'})-[:T {id: 1}]->(:B {name: 'b'})");

    const results = executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) WITH a, r, b RETURN a, r, b");
    expect(results.length).toBe(1);
    const [nodeA, rel, nodeB] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(nodeA)).toBe("A");
    expect(getType(rel)).toBe("T");
    expect(getLabel(nodeB)).toBe("B");
  });

  test("[custom-2] WITH forwarding with mixed aliases", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})-[:REL]->(:B {num: 2})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:REL]->(b:B) WITH a AS x, b AS y RETURN x, y",
    );
    expect(results.length).toBe(1);
    const [x, y] = results[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(getLabel(x)).toBe("A");
    expect(getLabel(y)).toBe("B");
  });
});
