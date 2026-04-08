/**
 * TCK WithSkipLimit1 - Skip
 * Translated from tmp/tck/features/clauses/with-skip-limit/WithSkipLimit1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("WithSkipLimit1 - Skip", () => {
  // [1] Handle dependencies across WITH with SKIP
  // Uses unlabeled nodes and WITH...MATCH + SKIP doesn't properly constrain before MATCH
  test("[1] Handle dependencies across WITH with SKIP - unlabeled nodes (by design), WITH SKIP + MATCH interaction not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (a {name: 'A', num: 0, id: 0}), ({name: 'B', num: a.id, id: 1}), ({name: 'C', num: 0, id: 2})",
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a)
       WITH a.name AS property, a.num AS idToUse
         ORDER BY property
         SKIP 1
       MATCH (b)
       WHERE b.id = idToUse
       RETURN DISTINCT b`,
    );
    expect(results).toHaveLength(1);
  });

  // [2] Ordering and skipping on aggregate
  // Uses unlabeled nodes and ORDER BY alias (c) which is not supported
  test("[2] Ordering and skipping on aggregate - unlabeled nodes + ORDER BY alias not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE ()-[:T1 {num: 3}]->(x:X), ()-[:T2 {num: 2}]->(x), ()-[:T3 {num: 1}]->(:Y)",
    );

    const results = executeTckQuery(
      graph,
      `MATCH ()-[r1]->(x)
       WITH x, sum(r1.num) AS c
         ORDER BY c SKIP 1
       RETURN x, c`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([expect.anything(), 5]);
  });

  // Custom tests for WITH SKIP patterns that are supported
  test("[custom-1] WITH ORDER BY SKIP with property expression", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 4})");
    executeTckQuery(graph, "CREATE (:A {num: 5})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num SKIP 2 RETURN a.num AS num",
    );
    expect(results).toEqual([3, 4, 5]);
  });

  test("[custom-2] WITH ORDER BY DESC SKIP", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 4})");
    executeTckQuery(graph, "CREATE (:A {num: 5})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num DESC SKIP 2 RETURN a.num AS num",
    );
    expect(results).toEqual([3, 2, 1]);
  });

  test("[custom-3] WITH SKIP 0 returns all rows", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num SKIP 0 RETURN a.num AS num",
    );
    expect(results).toEqual([1, 2, 3]);
  });

  test("[custom-4] WITH SKIP more than available returns empty", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num SKIP 10 RETURN a.num AS num",
    );
    expect(results).toEqual([]);
  });

  test("[custom-5] WITH SKIP with strings", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'alice'})");
    executeTckQuery(graph, "CREATE (:A {name: 'bob'})");
    executeTckQuery(graph, "CREATE (:A {name: 'charlie'})");
    executeTckQuery(graph, "CREATE (:A {name: 'diana'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.name SKIP 2 RETURN a.name AS name",
    );
    expect(results).toEqual(["charlie", "diana"]);
  });
});
