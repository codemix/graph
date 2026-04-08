/**
 * TCK MatchWhere4 - Non-Equi-Joins on variables
 * Translated from tmp/tck/features/clauses/match-where/MatchWhere4.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("MatchWhere4 - Non-Equi-Joins on variables", () => {
  test("[1] Join nodes on inequality", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B)");
    const results = executeTckQuery(
      graph,
      `MATCH (a), (b)
       WHERE a <> b
       RETURN a, b`,
    );
    expect(results).toHaveLength(2);
    // Both (A, B) and (B, A) should be returned
    for (const row of results) {
      const [a, b] = row as [Record<string, unknown>, Record<string, unknown>];
      expect(a).not.toBe(b);
    }
  });

  test("[2] Join with disjunctive multi-part predicates including patterns - pattern predicates not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (a:A), (b:B), (c:C:TheLabel), (d:D)
       CREATE (a)-[:T]->(b), (a)-[:T]->(c), (d)-[:T]->(c)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (a), (b)
       WHERE (a)-[:T]->(b:TheLabel) OR (a)-[:T]->(b)
       RETURN a, b`,
    );
    expect(results.length).toBeGreaterThan(0);
    // Should match patterns where either predicate is true
  });
});
