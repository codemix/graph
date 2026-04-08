/**
 * TCK ReturnOrderBy3 - Order by multiple expressions (order obey priority of expressions)
 * Translated from tmp/tck/features/clauses/return-orderby/ReturnOrderBy3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("ReturnOrderBy3 - Order by multiple expressions", () => {
  test.fails(
    "[1] Sort on aggregate function and normal property - unlabeled nodes, count(*), implicit grouping not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE ({division: 'Sweden'}), ({division: 'Germany'}), ({division: 'England'}), ({division: 'Sweden'})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (n) RETURN n.division, count(*) ORDER BY count(*) DESC, n.division ASC",
      );
      expect(results).toEqual([
        ["Sweden", 2],
        ["England", 1],
        ["Germany", 1],
      ]);
    },
  );

  // Custom test for multi-column ORDER BY
  test("[custom-1] ORDER BY multiple columns ASC", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 'b'})");
    executeTckQuery(graph, "CREATE (:A {x: 2, y: 'a'})");
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 'a'})");
    executeTckQuery(graph, "CREATE (:A {x: 2, y: 'b'})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.x, n.y ORDER BY n.x, n.y",
    );
    expect(results).toEqual([
      [1, "a"],
      [1, "b"],
      [2, "a"],
      [2, "b"],
    ]);
  });

  test("[custom-2] ORDER BY first column DESC, second ASC", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 'b'})");
    executeTckQuery(graph, "CREATE (:A {x: 2, y: 'a'})");
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 'a'})");
    executeTckQuery(graph, "CREATE (:A {x: 2, y: 'b'})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.x, n.y ORDER BY n.x DESC, n.y ASC",
    );
    expect(results).toEqual([
      [2, "a"],
      [2, "b"],
      [1, "a"],
      [1, "b"],
    ]);
  });

  test("[custom-3] ORDER BY with three columns", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 1, c: 2})");
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 1, c: 1})");
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 2, c: 1})");
    executeTckQuery(graph, "CREATE (:A {a: 2, b: 1, c: 1})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.a, n.b, n.c ORDER BY n.a, n.b, n.c",
    );
    expect(results).toEqual([
      [1, 1, 1],
      [1, 1, 2],
      [1, 2, 1],
      [2, 1, 1],
    ]);
  });
});
