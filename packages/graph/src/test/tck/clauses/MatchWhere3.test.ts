/**
 * TCK MatchWhere3 - Equi-Joins on variables
 * Translated from tmp/tck/features/clauses/match-where/MatchWhere3.feature
 */
import { describe, test, expect } from "vitest";
import {
  createTckGraph,
  executeTckQuery,
  getLabel,
  getProperty,
} from "../tckHelpers.js";

describe("MatchWhere3 - Equi-Joins on variables", () => {
  test("[1] Join between node identities", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B)");
    const results = executeTckQuery(
      graph,
      `MATCH (a), (b)
       WHERE a = b
       RETURN a, b`,
    );
    expect(results).toHaveLength(2);
    // Each result should have a = b (same node)
    for (const row of results) {
      const [a, b] = row as [Record<string, unknown>, Record<string, unknown>];
      expect(a).toBe(b);
    }
    const labels = results.map((r) => {
      const [a] = r as [Record<string, unknown>, unknown];
      return getLabel(a);
    });
    expect(labels).toContain("A");
    expect(labels).toContain("B");
  });

  test("[2] Join between node properties of disconnected nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {id: 1}),
             (:A {id: 2}),
             (:B {id: 2}),
             (:B {id: 3})`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (a:A), (b:B)
       WHERE a.id = b.id
       RETURN a, b`,
    );
    expect(results).toHaveLength(1);
    const [a, b] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(a)).toBe("A");
    expect(getProperty(a, "id")).toBe(2);
    expect(getLabel(b)).toBe("B");
    expect(getProperty(b, "id")).toBe(2);
  });

  test.fails(
    "[3] Join between node properties of adjacent nodes - WHERE property comparison on relationship vars not working",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (a:A {animal: 'monkey'}),
        (b:B {animal: 'cow'}),
        (c:C {animal: 'monkey'}),
        (d:D {animal: 'cow'}),
        (a)-[:KNOWS]->(b),
        (a)-[:KNOWS]->(c),
        (d)-[:KNOWS]->(b),
        (d)-[:KNOWS]->(c)`,
      );
      const results = executeTckQuery(
        graph,
        `MATCH (n)-[rel]->(x)
       WHERE n.animal = x.animal
       RETURN n, x`,
      );
      expect(results).toHaveLength(2);
      // A (monkey) -> C (monkey) and D (cow) -> B (cow)
      for (const row of results) {
        const [n, x] = row as [
          Record<string, unknown>,
          Record<string, unknown>,
        ];
        expect(getProperty(n, "animal")).toBe(getProperty(x, "animal"));
      }
    },
  );
});
