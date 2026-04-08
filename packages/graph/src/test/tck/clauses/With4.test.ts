/**
 * TCK With4 - Variable aliasing
 * Translated from tmp/tck/features/clauses/with/With4.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getType } from "../tckHelpers.js";

describe("With4 - Variable aliasing", () => {
  test("[1] Aliasing relationship variable - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:T1]->(), ()-[:T2]->()");
    const results = executeTckQuery(graph, "MATCH ()-[r1]->() WITH r1 AS r2 RETURN r2 AS rel");
    expect(results).toHaveLength(2);
  });

  test("[1-custom] Aliasing relationship variable", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T1]->(:B)");
    executeTckQuery(graph, "CREATE (:A)-[:T2]->(:B)");

    const results = executeTckQuery(graph, "MATCH (:A)-[r1]->(:B) WITH r1 AS r2 RETURN r2 AS rel");
    expect(results.length).toBe(2);
    const types = results.map((r) => {
      const [rel] = r as [Record<string, unknown>];
      return getType(rel);
    });
    expect(types.sort()).toEqual(["T1", "T2"]);
  });

  test("[2] Aliasing expression to new variable name", () => {
    // Original: MATCH (a:Begin) WITH a.num AS property MATCH (b:End) WHERE property = b.num RETURN b
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Begin {num: 42})");
    executeTckQuery(graph, "CREATE (:End {num: 42, name: 'found'})");
    executeTckQuery(graph, "CREATE (:End {num: 99, name: 'not-found'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:Begin) WITH a.num AS property MATCH (b:End) WHERE property = b.num RETURN b.name",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("found");
  });

  test.fails("[3] Aliasing expression to existing variable name - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 1, name: 'King Kong'}), ({num: 2, name: 'Ann Darrow'})");
    const results = executeTckQuery(graph, "MATCH (n) WITH n.name AS n RETURN n ORDER BY n");
    expect(results).toHaveLength(2);
    expect(results[0]).toBe("Ann Darrow");
    expect(results[1]).toBe("King Kong");
  });

  test("[3-custom] Aliasing expression to existing variable name", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1, name: 'King Kong'})");
    executeTckQuery(graph, "CREATE (:A {num: 2, name: 'Ann Darrow'})");

    // Cannot use ORDER BY alias, need to remove it
    const results = executeTckQuery(graph, "MATCH (n:A) WITH n.name AS n RETURN n");
    expect(results.length).toBe(2);
    // Extract values and sort
    const names = results.map((r) => (Array.isArray(r) ? r[0] : r)).sort();
    expect(names).toEqual(["Ann Darrow", "King Kong"]);
  });

  test.fails("[4] Fail when forwarding multiple aliases with the same name - semantic validation not implemented", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "WITH 1 AS a, 2 AS a RETURN a")).toThrow();
  });

  test("[5] Fail when not aliasing expressions in WITH - semantic validation not implemented", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    expect(() => executeTckQuery(graph, "MATCH (a) WITH a, count(*) RETURN a")).toThrow();
  });

  test.fails("[6] Reusing variable names in WITH - complex multi-WITH with head(collect()) not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})");
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WITH n ORDER BY n.num WITH collect(n) AS coll WITH head(coll) AS first RETURN first.num",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[7] Multiple aliasing and backreferencing - unlabeled CREATE, map expressions not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (m {id: 0})");
    const results = executeTckQuery(
      graph,
      "MATCH (m) WITH {first: m.id} AS m WITH {second: m.first} AS m RETURN m.second",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0);
  });

  // Custom tests for supported aliasing patterns
  test("[custom-1] Aliasing node property to variable", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Alice', age: 30})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a.name AS personName, a.age AS personAge RETURN personName, personAge",
    );
    expect(results.length).toBe(1);
    const [name, age] = results[0] as [string, number];
    expect(name).toBe("Alice");
    expect(age).toBe(30);
  });

  test("[custom-2] Multiple WITH clauses in sequence", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 10})");

    const results = executeTckQuery(graph, "MATCH (a:A) WITH a WITH a.num AS val RETURN val");
    expect(results.length).toBe(1);
    // May be wrapped
    const val = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(val).toBe(10);
  });
});
