/**
 * TCK WithSkipLimit3 - Skip and limit
 * Translated from tmp/tck/features/clauses/with-skip-limit/WithSkipLimit3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("WithSkipLimit3 - Skip and limit", () => {
  // [1] Get rows in the middle
  // Uses unlabeled nodes
  test("[1] Get rows in the middle - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE ({name: 'A'}), ({name: 'B'}), ({name: 'C'}), ({name: 'D'}), ({name: 'E'})",
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n)
       WITH n
       ORDER BY n.name ASC
       SKIP 2
       LIMIT 2
       RETURN n`,
    );
    expect(results).toHaveLength(2);
    const names = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "name");
    });
    expect(names).toEqual(["C", "D"]);
  });

  test("[1-custom] Get rows in the middle with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'A'})");
    executeTckQuery(graph, "CREATE (:A {name: 'B'})");
    executeTckQuery(graph, "CREATE (:A {name: 'C'})");
    executeTckQuery(graph, "CREATE (:A {name: 'D'})");
    executeTckQuery(graph, "CREATE (:A {name: 'E'})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WITH n ORDER BY n.name ASC SKIP 2 LIMIT 2 RETURN n",
    );
    expect(results.length).toBe(2);
    // Results are wrapped when returning full nodes
    const names = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "name");
    });
    expect(names).toEqual(["C", "D"]);
  });

  // [2] Get rows in the middle by param
  // Uses unlabeled nodes and parameters
  test.fails("[2] Get rows in the middle by param - unlabeled nodes and parameters not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE ({name: 'A'}), ({name: 'B'}), ({name: 'C'}), ({name: 'D'}), ({name: 'E'})",
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n)
       WITH n
       ORDER BY n.name ASC
       SKIP $s
       LIMIT $l
       RETURN n`,
      { s: 2, l: 2 },
    );
    expect(results).toHaveLength(2);
    const names = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "name");
    });
    expect(names).toEqual(["C", "D"]);
  });

  // [3] Limiting amount of rows when there are fewer left than the LIMIT argument
  // Uses UNWIND
  test.fails("[3] Limiting amount of rows when there are fewer left - unlabeled nodes (by design)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "UNWIND range(0, 15) AS i CREATE ({count: i})");

    const results = executeTckQuery(
      graph,
      `MATCH (a)
       WITH a.count AS count
         ORDER BY a.count
         SKIP 10
         LIMIT 10
       RETURN count`,
    );
    expect(results).toEqual([10, 11, 12, 13, 14, 15]);
  });

  test("[3-custom] Limiting amount of rows when there are fewer left than the LIMIT argument", () => {
    const graph = createTckGraph();
    // Create 16 nodes with num values 0-15
    for (let i = 0; i <= 15; i++) {
      executeTckQuery(graph, `CREATE (:A {num: ${i}})`);
    }

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num SKIP 10 LIMIT 10 RETURN a.num AS num",
    );
    expect(results).toEqual([10, 11, 12, 13, 14, 15]);
  });

  // Custom tests for WITH SKIP + LIMIT combination
  test("[custom-1] WITH ORDER BY SKIP LIMIT with property return", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 4})");
    executeTckQuery(graph, "CREATE (:A {num: 5})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num SKIP 1 LIMIT 3 RETURN a.num AS num",
    );
    expect(results).toEqual([2, 3, 4]);
  });

  test("[custom-2] WITH SKIP 0 LIMIT 2 same as LIMIT 2", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num SKIP 0 LIMIT 2 RETURN a.num AS num",
    );
    expect(results).toEqual([1, 2]);
  });

  test("[custom-3] WITH SKIP all returns empty even with LIMIT", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num SKIP 10 LIMIT 5 RETURN a.num AS num",
    );
    expect(results).toEqual([]);
  });

  test("[custom-4] WITH ORDER BY DESC SKIP LIMIT", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 4})");
    executeTckQuery(graph, "CREATE (:A {num: 5})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num DESC SKIP 1 LIMIT 2 RETURN a.num AS num",
    );
    expect(results).toEqual([4, 3]);
  });

  test("[custom-5] WITH SKIP LIMIT with strings", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'alice'})");
    executeTckQuery(graph, "CREATE (:A {name: 'bob'})");
    executeTckQuery(graph, "CREATE (:A {name: 'charlie'})");
    executeTckQuery(graph, "CREATE (:A {name: 'diana'})");
    executeTckQuery(graph, "CREATE (:A {name: 'eve'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.name SKIP 2 LIMIT 2 RETURN a.name AS name",
    );
    expect(results).toEqual(["charlie", "diana"]);
  });

  test("[custom-6] WITH SKIP equals total returns empty with LIMIT", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num SKIP 3 LIMIT 2 RETURN a.num AS num",
    );
    expect(results).toEqual([]);
  });

  test("[custom-7] WITH SKIP 1 LIMIT 1 gets second element", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 10})");
    executeTckQuery(graph, "CREATE (:A {num: 20})");
    executeTckQuery(graph, "CREATE (:A {num: 30})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.num SKIP 1 LIMIT 1 RETURN a.num AS num",
    );
    expect(results).toEqual([20]);
  });
});
