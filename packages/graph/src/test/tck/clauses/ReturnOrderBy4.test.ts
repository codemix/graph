/**
 * TCK ReturnOrderBy4 - Order by in combination with projection
 * Translated from tmp/tck/features/clauses/return-orderby/ReturnOrderBy4.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("ReturnOrderBy4 - Order by in combination with projection", () => {
  test.fails("[1] ORDER BY of a column introduced in RETURN should return salient results - UNWIND, list indexing not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [0, 1] AS prows, [[2], [3, 4]] AS qrows UNWIND prows AS p UNWIND qrows[p] AS q WITH p, count(q) AS rng RETURN p ORDER BY rng",
    );
    expect(results).toEqual([0, 1]);
  });

  test("[2] Handle projections with ORDER BY - requires Crew label in schema", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:Crew {name: 'Neo', rank: 1}), (:Crew {name: 'Neo', rank: 2}), (:Crew {name: 'Neo', rank: 3}), (:Crew {name: 'Neo', rank: 4}), (:Crew {name: 'Neo', rank: 5})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (c:Crew {name: 'Neo'}) WITH c, 0 AS relevance RETURN c.rank AS rank ORDER BY relevance, c.rank",
    );
    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  // Custom tests for ORDER BY with projections
  test("[custom-1] ORDER BY with aliased projection", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 3}), (:A {num: 1}), (:A {num: 2})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num AS val ORDER BY val");
    expect(results).toEqual([1, 2, 3]);
  });

  test("[custom-2] ORDER BY with multiple projections", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 10}), (:A {x: 3, y: 30}), (:A {x: 2, y: 20})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.x AS a, n.y AS b ORDER BY a DESC");
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([3, 30]);
    expect(results[1]).toEqual([2, 20]);
    expect(results[2]).toEqual([1, 10]);
  });

  test("[custom-3] ORDER BY expression not in RETURN", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'alice', age: 30})");
    executeTckQuery(graph, "CREATE (:A {name: 'bob', age: 25})");
    executeTckQuery(graph, "CREATE (:A {name: 'charlie', age: 35})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name ORDER BY n.age");
    expect(results).toEqual(["bob", "alice", "charlie"]);
  });
});
