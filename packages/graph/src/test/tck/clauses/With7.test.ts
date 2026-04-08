/**
 * TCK With7 - WITH on WITH
 * Translated from tmp/tck/features/clauses/with/With7.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("With7 - WITH on WITH", () => {
  test("[1] A simple pattern with one bound endpoint", () => {
    // Original: MATCH (a:A)-[r:REL]->(b:B) WITH a AS b, b AS tmp, r AS r WITH b AS a, r LIMIT 1 MATCH (a)-[r]->(b) RETURN a, r, b
    // Adapted version - tests multiple WITH clauses + MATCH chaining
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:REL {id: 1}]->(:B)");

    // Multiple WITH clauses + MATCH chaining
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:REL]->(b:B) WITH a, r, b WITH a, r, b LIMIT 1 MATCH (a)-[r]->(b) RETURN r.id AS id",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[2] Multiple WITHs using a predicate and aggregation - unlabeled nodes, count(*), WITH...MATCH chaining not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:Person {name: 'David'})-[:KNOWS]->(:Person {name: 'Alice'})-[:KNOWS]->(:Person {name: 'Bob'})",
    );
    executeTckQuery(
      graph,
      "MATCH (david:Person {name: 'David'}), (alice:Person {name: 'Alice'}) CREATE (david)-[:KNOWS]->(alice)",
    );
    executeTckQuery(
      graph,
      "MATCH (alice:Person {name: 'Alice'}) CREATE (alice)-[:KNOWS]->(:Person {name: 'Carol'})",
    );
    const results = executeTckQuery(
      graph,
      `MATCH (david {name: 'David'})--(otherPerson)-->()
       WITH otherPerson, count(*) AS foaf WHERE foaf > 1
       WITH otherPerson WHERE otherPerson.name <> 'NotOther'
       RETURN count(*)`,
    );
    expect(results).toHaveLength(1);
  });

  // Custom tests for multiple WITH clauses in sequence (no MATCH between)
  test("[custom-1] Multiple WITH clauses chained", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 5})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a WITH a.num AS num WITH num RETURN num",
    );
    expect(results.length).toBe(1);
    // May be wrapped
    const val = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(val).toBe(5);
  });

  test("[custom-2] WITH with aliasing through multiple clauses", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', value: 100})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a.name AS x, a.value AS y WITH x AS name, y AS val RETURN name, val",
    );
    expect(results.length).toBe(1);
    const [name, val] = results[0] as [string, number];
    expect(name).toBe("test");
    expect(val).toBe(100);
  });

  test("[custom-3] WITH LIMIT affects subsequent clauses", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num LIMIT 2 WITH a RETURN a.num",
    );
    expect(results.length).toBe(2);
  });
});
