/**
 * TCK ReturnSkipLimit3 - Skip and limit
 * Translated from tmp/tck/features/clauses/return-skip-limit/ReturnSkipLimit3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("ReturnSkipLimit3 - Skip and limit", () => {
  test("[1] Get rows in the middle - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE ({name: 'A'}), ({name: 'B'}), ({name: 'C'}), ({name: 'D'}), ({name: 'E'})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (n) RETURN n ORDER BY n.name ASC SKIP 2 LIMIT 2",
    );
    expect(results.length).toBe(2);
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
      "MATCH (n:A) RETURN n ORDER BY n.name ASC SKIP 2 LIMIT 2",
    );
    expect(results.length).toBe(2);
    // Single RETURN item is wrapped in array
    const names = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "name");
    });
    expect(names).toEqual(["C", "D"]);
  });

  test.fails(
    "[2] Get rows in the middle by param - unlabeled nodes and parameter in SKIP/LIMIT not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE ({name: 'A'}), ({name: 'B'}), ({name: 'C'}), ({name: 'D'}), ({name: 'E'})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (n) RETURN n ORDER BY n.name ASC SKIP $s LIMIT $l",
        { s: 2, l: 2 },
      );
      expect(results.length).toBe(2);
      const names = results.map((r) => {
        const [node] = r as [Record<string, unknown>];
        return getProperty(node, "name");
      });
      expect(names).toEqual(["C", "D"]);
    },
  );

  test("[3] Limiting amount of rows when there are fewer left than the LIMIT argument - unlabeled nodes (by design)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "UNWIND range(0, 15) AS i CREATE ({count: i})");
    const results = executeTckQuery(
      graph,
      "MATCH (a) RETURN a.count ORDER BY a.count SKIP 10 LIMIT 10",
    );
    expect(results).toEqual([10, 11, 12, 13, 14, 15]);
  });

  test("[3-custom] Limiting amount of rows when there are fewer left than the LIMIT argument", () => {
    const graph = createTckGraph();
    // Create 16 nodes with count values 0-15
    for (let i = 0; i <= 15; i++) {
      executeTckQuery(graph, `CREATE (:A {num: ${i}})`);
    }

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) RETURN a.num ORDER BY a.num SKIP 10 LIMIT 10",
    );
    expect(results).toEqual([10, 11, 12, 13, 14, 15]);
  });

  // Additional custom tests for SKIP + LIMIT combination
  test("[custom-1] SKIP and LIMIT with property return", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 4})");
    executeTckQuery(graph, "CREATE (:A {num: 5})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.num ORDER BY n.num SKIP 1 LIMIT 3",
    );
    expect(results).toEqual([2, 3, 4]);
  });

  test("[custom-2] SKIP 0 LIMIT 2 is same as just LIMIT 2", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.num ORDER BY n.num SKIP 0 LIMIT 2",
    );
    expect(results).toEqual([1, 2]);
  });

  test("[custom-3] SKIP all returns empty with LIMIT", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.num ORDER BY n.num SKIP 10 LIMIT 5",
    );
    expect(results).toEqual([]);
  });

  test("[custom-4] SKIP and LIMIT with DESC ordering", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 4})");
    executeTckQuery(graph, "CREATE (:A {num: 5})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.num ORDER BY n.num DESC SKIP 1 LIMIT 2",
    );
    expect(results).toEqual([4, 3]);
  });

  test("[custom-5] SKIP and LIMIT with strings", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'alice'})");
    executeTckQuery(graph, "CREATE (:A {name: 'bob'})");
    executeTckQuery(graph, "CREATE (:A {name: 'charlie'})");
    executeTckQuery(graph, "CREATE (:A {name: 'diana'})");
    executeTckQuery(graph, "CREATE (:A {name: 'eve'})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.name ORDER BY n.name SKIP 2 LIMIT 2",
    );
    expect(results).toEqual(["charlie", "diana"]);
  });
});
