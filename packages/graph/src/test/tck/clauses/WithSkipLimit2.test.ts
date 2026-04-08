/**
 * TCK WithSkipLimit2 - Limit
 * Translated from tmp/tck/features/clauses/with-skip-limit/WithSkipLimit2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("WithSkipLimit2 - Limit", () => {
  // [1] ORDER BY and LIMIT can be used
  // Uses unlabeled nodes and undirected patterns
  test("[1] ORDER BY and LIMIT can be used - unlabeled nodes (by design), undirected patterns not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A), (), (), (), (a)-[:REL]->()");

    const results = executeTckQuery(
      graph,
      `MATCH (a:A)
       WITH a
       ORDER BY a.name
       LIMIT 1
       MATCH (a)-->(b)
       RETURN a`,
    );
    expect(results).toHaveLength(1);
  });

  // [2] Handle dependencies across WITH with LIMIT
  // Uses unlabeled MATCH (b) pattern
  test("[2] Handle dependencies across WITH with LIMIT - unlabeled nodes (by design)", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (a:End {num: 42, id: 0}), (:End {num: 3}), (:Begin {num: a.id})",
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:Begin)
       WITH a.num AS property
         LIMIT 1
       MATCH (b)
       WHERE b.id = property
       RETURN b`,
    );
    expect(results).toHaveLength(1);
  });

  // [3] Connected components succeeding WITH with LIMIT
  // Uses RETURN * and multi-pattern MATCH
  test.fails(
    "[3] Connected components succeeding WITH with LIMIT - RETURN * and multi-pattern MATCH not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:REL]->(:X)");
      executeTckQuery(graph, "CREATE (:B)");

      const results = executeTckQuery(
        graph,
        `MATCH (n:A)
       WITH n
       LIMIT 1
       MATCH (m:B), (n)-->(x:X)
       RETURN *`,
      );
      expect(results).toHaveLength(1);
    },
  );

  // [4] Ordering and limiting on aggregate
  // Uses unlabeled nodes and ORDER BY alias (c)
  test("[4] Ordering and limiting on aggregate - unlabeled nodes + ORDER BY alias not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE ()-[:T1 {num: 3}]->(x:X), ()-[:T2 {num: 2}]->(x), ()-[:T3 {num: 1}]->(:Y)",
    );

    const results = executeTckQuery(
      graph,
      `MATCH ()-[r1]->(x)
       WITH x, sum(r1.num) AS c
         ORDER BY c LIMIT 1
       RETURN x, c`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([expect.anything(), 1]);
  });

  // Custom tests for WITH LIMIT patterns that are supported
  test("[custom-1] WITH ORDER BY LIMIT with property expression", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 5})");
    executeTckQuery(graph, "CREATE (:A {num: 4})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num LIMIT 3 RETURN a.num AS num",
    );
    expect(results).toEqual([1, 2, 3]);
  });

  test("[custom-2] WITH ORDER BY DESC LIMIT", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 5})");
    executeTckQuery(graph, "CREATE (:A {num: 4})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num DESC LIMIT 3 RETURN a.num AS num",
    );
    expect(results).toEqual([5, 4, 3]);
  });

  test("[custom-3] WITH LIMIT 0 returns empty", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num LIMIT 0 RETURN a.num AS num",
    );
    expect(results).toEqual([]);
  });

  test("[custom-4] WITH LIMIT more than available returns all", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num LIMIT 10 RETURN a.num AS num",
    );
    expect(results).toEqual([1, 2]);
  });

  test("[custom-5] WITH LIMIT with strings", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'alice'})");
    executeTckQuery(graph, "CREATE (:A {name: 'bob'})");
    executeTckQuery(graph, "CREATE (:A {name: 'charlie'})");
    executeTckQuery(graph, "CREATE (:A {name: 'diana'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.name LIMIT 2 RETURN a.name AS name",
    );
    expect(results).toEqual(["alice", "bob"]);
  });

  test("[custom-6] WITH LIMIT 1 returns single row", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num LIMIT 1 RETURN a.num AS num",
    );
    expect(results).toEqual([1]);
  });
});
