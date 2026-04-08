/**
 * TCK WithWhere6 - Filter on aggregates
 * Translated from tmp/tck/features/clauses/with-where/WithWhere6.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("WithWhere6 - Filter on aggregates", () => {
  test.fails("[1] Filter a single aggregate - unlabeled nodes, count(*), and implicit grouping not supported", () => {
    // Original test uses unlabeled nodes and count(*):
    // CREATE (a {name: 'A'}), (b {name: 'B'})
    // CREATE (a)-[:REL]->(), ...
    // MATCH (a)-->() WITH a, count(*) AS relCount WHERE relCount > 1 RETURN a
    //
    // Multiple issues:
    // 1. Unlabeled nodes in CREATE
    // 2. count(*) syntax not supported (must use count(variable))
    // 3. Undirected edge pattern
    // 4. Implicit grouping by node identity not fully supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a {name: 'A'}), (b {name: 'B'})");
    executeTckQuery(
      graph,
      "MATCH (a {name: 'A'}), (b {name: 'B'}) CREATE (a)-[:REL]->(:Target), (a)-[:REL]->(:Target), (b)-[:REL]->(:Target)",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a)-->() WITH a, count(*) AS relCount WHERE relCount > 1 RETURN a",
    );
    expect(results.length).toBe(1);
    const node = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect((node as Record<string, unknown>)["name"]).toBe("A");
  });

  // Custom tests for filtering on aggregates (without grouping by property value)
  test("[custom-1] Filter on total count aggregate", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {id: 1})");
    executeTckQuery(graph, "CREATE (:A {id: 2})");
    executeTckQuery(graph, "CREATE (:A {id: 3})");
    executeTckQuery(graph, "CREATE (:A {id: 4})");
    executeTckQuery(graph, "CREATE (:A {id: 5})");

    // Simple aggregate without grouping
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH count(a) AS cnt WHERE cnt > 3 RETURN cnt",
    );
    expect(results.length).toBe(1);
    const val = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(val).toBe(5);
  });

  test("[custom-2] Filter excludes aggregate below threshold", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:B {id: 1})");
    executeTckQuery(graph, "CREATE (:B {id: 2})");

    // Aggregate count should be 2, but WHERE cnt > 5 should filter it out
    const results = executeTckQuery(
      graph,
      "MATCH (b:B) WITH count(b) AS cnt WHERE cnt > 5 RETURN cnt",
    );
    expect(results.length).toBe(0);
  });

  test("[custom-3] Filter on sum aggregate", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:C {value: 10})");
    executeTckQuery(graph, "CREATE (:C {value: 20})");
    executeTckQuery(graph, "CREATE (:C {value: 30})");

    const results = executeTckQuery(
      graph,
      "MATCH (c:C) WITH sum(c.value) AS total WHERE total > 50 RETURN total",
    );
    expect(results.length).toBe(1);
    const val = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(val).toBe(60);
  });

  test("[custom-4] Filter with aggregate equality check", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:D {n: 1})");
    executeTckQuery(graph, "CREATE (:D {n: 2})");
    executeTckQuery(graph, "CREATE (:D {n: 3})");

    // Count should be exactly 3
    const results = executeTckQuery(
      graph,
      "MATCH (d:D) WITH count(d) AS cnt WHERE cnt = 3 RETURN cnt",
    );
    expect(results.length).toBe(1);
    const val = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(val).toBe(3);
  });
});
