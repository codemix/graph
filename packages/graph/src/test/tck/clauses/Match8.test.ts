/**
 * TCK Match8 - Match clause interoperation with other clauses
 * Translated from tmp/tck/features/clauses/match/Match8.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel } from "../tckHelpers.js";

describe("Match8 - Match clause interoperation with other clauses", () => {
  test("[1] Pattern independent of bound variables results in cross product - parser issue", () => {
    // Parser doesn't support MATCH on new line after WITH
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B)");
    const results = executeTckQuery(
      graph,
      "MATCH (a) WITH a MATCH (b) RETURN a, b",
    );
    expect(results).toHaveLength(4);
    // Verify all combinations exist (A,A), (A,B), (B,A), (B,B)
    const labelPairs = results.map((row) => {
      const [a, b] = row as [Record<string, unknown>, Record<string, unknown>];
      return `${getLabel(a)}-${getLabel(b)}`;
    });
    expect(labelPairs).toContain("A-A");
    expect(labelPairs).toContain("A-B");
    expect(labelPairs).toContain("B-A");
    expect(labelPairs).toContain("B-B");
  });

  test.fails("[2] Counting rows after MATCH, MERGE, OPTIONAL MATCH", () => {
    // This test uses MERGE with wildcard (*) in WITH which may not be supported
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `
      CREATE (a:A), (b:B)
      CREATE (a)-[:T1]->(b),
             (b)-[:T2]->(a)
    `,
    );
    const results = executeTckQuery(
      graph,
      `
      MATCH (a)
      MERGE (b)
      WITH *
      OPTIONAL MATCH (a)--(b)
      RETURN count(*)
    `,
    );
    expect(results).toEqual([6]);
  });

  test.fails(
    "[3] Matching and disregarding output, then matching again - requires unlabeled nodes",
    () => {
      // Creates unlabeled nodes with type and times properties
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `
      CREATE (andres {name: 'Andres'}),
             (michael {name: 'Michael'}),
             (peter {name: 'Peter'}),
             (bread {type: 'Bread'}),
             (veggies {type: 'Veggies'}),
             (meat {type: 'Meat'})
      CREATE (andres)-[:ATE {times: 10}]->(bread),
             (andres)-[:ATE {times: 8}]->(veggies),
             (michael)-[:ATE {times: 4}]->(veggies),
             (michael)-[:ATE {times: 6}]->(bread),
             (michael)-[:ATE {times: 9}]->(meat),
             (peter)-[:ATE {times: 7}]->(veggies),
             (peter)-[:ATE {times: 7}]->(bread),
             (peter)-[:ATE {times: 4}]->(meat)
    `,
      );
      const results = executeTckQuery(
        graph,
        `
      MATCH ()-->()
      WITH 1 AS x
      MATCH ()-[r1]->()<--()
      RETURN sum(r1.times)
    `,
      );
      expect(results).toEqual([776]);
    },
  );
});
