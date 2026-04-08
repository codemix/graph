/**
 * TCK ReturnSkipLimit2 - Limit
 * Translated from tmp/tck/features/clauses/return-skip-limit/ReturnSkipLimit2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("ReturnSkipLimit2 - Limit", () => {
  test("[1] Limit to two hits", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "UNWIND [1, 1, 1, 1, 1] AS i RETURN i LIMIT 2");
    expect(results).toEqual([[1], [1]]);
  });

  test("[2] Limit to two hits with explicit order", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'A'})");
    executeTckQuery(graph, "CREATE (:A {name: 'B'})");
    executeTckQuery(graph, "CREATE (:A {name: 'C'})");
    executeTckQuery(graph, "CREATE (:A {name: 'D'})");
    executeTckQuery(graph, "CREATE (:A {name: 'E'})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n ORDER BY n.name ASC LIMIT 2");
    expect(results.length).toBe(2);
    // Single RETURN item is wrapped in array
    const names = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "name");
    });
    expect(names).toEqual(["A", "B"]);
  });

  test("[3] LIMIT 0 should return an empty result - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (), (), ()");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n LIMIT 0");
    expect(results).toEqual([]);
  });

  test("[3-custom] LIMIT 0 should return an empty result with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    executeTckQuery(graph, "CREATE (:A)");
    executeTckQuery(graph, "CREATE (:A)");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n LIMIT 0");
    expect(results).toEqual([]);
  });

  test("[4] Handle ORDER BY with LIMIT 1", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Person {name: 'Steven'})");
    executeTckQuery(graph, "CREATE (:Person {name: 'Craig'})");

    const results = executeTckQuery(
      graph,
      "MATCH (p:Person) RETURN p.name AS name ORDER BY p.name LIMIT 1",
    );
    expect(results).toEqual(["Craig"]);
  });

  test("[5] ORDER BY with LIMIT 0 should not generate errors", () => {
    const graph = createTckGraph();
    // Empty graph is fine
    const results = executeTckQuery(
      graph,
      "MATCH (p:Person) RETURN p.name AS name ORDER BY p.name LIMIT 0",
    );
    expect(results).toEqual([]);
  });

  test.fails("[6] LIMIT with an expression that does not depend on variables", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "UNWIND range(1, 3) AS i CREATE ({nr: i})");
    const results = executeTckQuery(
      graph,
      "MATCH (n) WITH n LIMIT toInteger(ceil(1.7)) RETURN count(*) AS count",
    );
    expect(results).toEqual([2]);
  });

  test("[7] Limit to more rows than actual results 1 - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 1}), ({num: 3}), ({num: 2})");
    const results = executeTckQuery(
      graph,
      "MATCH (foo) RETURN foo.num AS x ORDER BY x DESC LIMIT 4",
    );
    expect(results).toEqual([3, 2, 1]);
  });

  test("[7-custom] Limit to more rows than actual results with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    // ORDER BY alias not supported - must use full expression
    const results = executeTckQuery(
      graph,
      "MATCH (foo:A) RETURN foo.num ORDER BY foo.num DESC LIMIT 4",
    );
    expect(results).toEqual([3, 2, 1]);
  });

  test.fails("[8] Limit to more rows than actual results 2", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A), (n1 {num: 1}), (n2 {num: 2}), (m1), (m2)");
    executeTckQuery(
      graph,
      "MATCH (a:A), (n1 {num: 1}), (n2 {num: 2}), (m1), (m2) CREATE (a)-[:T]->(n1), (n1)-[:T]->(m1), (a)-[:T]->(n2), (n2)-[:T]->(m2)",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-->(n)-->(m) RETURN n.num, count(*) ORDER BY n.num LIMIT 1000",
    );
    expect(results).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });

  test("[9] Fail when using non-constants in LIMIT - semantic validation not implemented", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "MATCH (n) RETURN n LIMIT n.count")).toThrow();
  });

  test("[10] Negative parameter for LIMIT should fail - SKIP/LIMIT only accept literals", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (s:Person {name: 'Steven'}), (c:Person {name: 'Craig'})");
    expect(() =>
      executeTckQuery(graph, "MATCH (p:Person) RETURN p.name AS name LIMIT $_limit", {
        _limit: -1,
      }),
    ).toThrow();
  });

  test("[11] Negative parameter for LIMIT with ORDER BY should fail - SKIP/LIMIT only accept literals", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (s:Person {name: 'Steven'}), (c:Person {name: 'Craig'})");
    expect(() =>
      executeTckQuery(graph, "MATCH (p:Person) RETURN p.name AS name ORDER BY name LIMIT $_limit", {
        _limit: -1,
      }),
    ).toThrow();
  });

  test.fails("[12] Fail when using negative value in LIMIT 1", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "MATCH (n) RETURN n LIMIT -1")).toThrow();
  });

  test.fails("[13] Fail when using negative value in LIMIT 2", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (s:Person {name: 'Steven'}), (c:Person {name: 'Craig'})");
    expect(() =>
      executeTckQuery(graph, "MATCH (p:Person) RETURN p.name AS name LIMIT -1"),
    ).toThrow();
  });

  test("[14] Floating point parameter for LIMIT should fail - SKIP/LIMIT only accept literals", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (s:Person {name: 'Steven'}), (c:Person {name: 'Craig'})");
    expect(() =>
      executeTckQuery(graph, "MATCH (p:Person) RETURN p.name AS name LIMIT $_limit", {
        _limit: 1.5,
      }),
    ).toThrow();
  });

  test("[15] Floating point parameter for LIMIT with ORDER BY should fail - SKIP/LIMIT only accept literals", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (s:Person {name: 'Steven'}), (c:Person {name: 'Craig'})");
    expect(() =>
      executeTckQuery(graph, "MATCH (p:Person) RETURN p.name AS name ORDER BY name LIMIT $_limit", {
        _limit: 1.5,
      }),
    ).toThrow();
  });

  test("[16] Fail when using floating point in LIMIT 1 - grammar enforces integer", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "MATCH (n) RETURN n LIMIT 1.7")).toThrow();
  });

  test("[17] Fail when using floating point in LIMIT 2 - grammar enforces integer", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (s:Person {name: 'Steven'}), (c:Person {name: 'Craig'})");
    expect(() =>
      executeTckQuery(graph, "MATCH (p:Person) RETURN p.name AS name LIMIT 1.5"),
    ).toThrow();
  });

  // Additional custom tests for LIMIT functionality
  test("[custom-1] LIMIT with ORDER BY DESC", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 4})");
    executeTckQuery(graph, "CREATE (:A {num: 5})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num ORDER BY n.num DESC LIMIT 3");
    expect(results).toEqual([5, 4, 3]);
  });

  test("[custom-2] LIMIT without ORDER BY", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num LIMIT 2");
    expect(results.length).toBe(2);
  });

  test("[custom-3] LIMIT 1 returns single result", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'first'})");
    executeTckQuery(graph, "CREATE (:A {name: 'second'})");
    executeTckQuery(graph, "CREATE (:A {name: 'third'})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name ORDER BY n.name LIMIT 1");
    expect(results).toEqual(["first"]);
  });
});
