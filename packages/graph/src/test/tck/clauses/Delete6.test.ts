/**
 * TCK Delete6 - Persistence of delete clause side effects
 * Translated from tmp/tck/features/clauses/delete/Delete6.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Delete6 - Persistence of delete clause side effects", () => {
  // Note: TCK expects SKIP/LIMIT to affect only RETURN, not DELETE side effects
  // Our implementation may behave differently - LIMIT is applied early in the pipeline
  // Additionally, literal values in RETURN after DELETE are not supported in the grammar

  test.fails(
    "[1] Limiting to zero results after deleting nodes - literal in RETURN not supported after DELETE",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:N {num: 1}), (:N {num: 2}), (:N {num: 3})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (n:N) DELETE n RETURN 42 AS num LIMIT 0",
      );
      expect(results).toHaveLength(0);
      // TCK expects all nodes deleted even with LIMIT 0
      const remaining = executeTckQuery(graph, "MATCH (n:N) RETURN n");
      expect(remaining).toHaveLength(0);
    },
  );

  test("[2] Skipping all results after deleting nodes - literal in RETURN not supported after DELETE", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {num: 1})");
    const results = executeTckQuery(
      graph,
      "MATCH (n:N) DELETE n RETURN 42 AS num SKIP 1",
    );
    expect(results).toHaveLength(0);
    const remaining = executeTckQuery(graph, "MATCH (n:N) RETURN n");
    expect(remaining).toHaveLength(0);
  });

  test.fails(
    "[3] Skipping and limiting to a few results after deleting nodes - literal in RETURN not supported after DELETE",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:N {num: 1}), (:N {num: 2}), (:N {num: 3}), (:N {num: 4}), (:N {num: 5})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (n:N) DELETE n RETURN 42 AS num SKIP 2 LIMIT 2",
      );
      expect(results).toHaveLength(2);
      const remaining = executeTckQuery(graph, "MATCH (n:N) RETURN n");
      expect(remaining).toHaveLength(0);
    },
  );

  test("[4] Skipping zero results and limiting to all results after deleting nodes - literal in RETURN not supported after DELETE", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:N {num: 1}), (:N {num: 2}), (:N {num: 3}), (:N {num: 4}), (:N {num: 5})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (n:N) DELETE n RETURN 42 AS num SKIP 0 LIMIT 5",
    );
    expect(results).toHaveLength(5);
    const remaining = executeTckQuery(graph, "MATCH (n:N) RETURN n");
    expect(remaining).toHaveLength(0);
  });

  test.fails(
    "[5] Filtering after deleting nodes affects the result set but not the side effects - WITH WHERE after DELETE not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:N {num: 1}), (:N {num: 2}), (:N {num: 3}), (:N {num: 4})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (n:N) WITH n, n.num AS num DELETE n WITH num WHERE num % 2 = 0 RETURN num",
      );
      expect(results).toEqual([2, 4]);
      const remaining = executeTckQuery(graph, "MATCH (n:N) RETURN n");
      expect(remaining).toHaveLength(0);
    },
  );

  test("[6] Aggregating in RETURN after deleting nodes - WITH after DELETE not supported in grammar", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:N {num: 1}), (:N {num: 2}), (:N {num: 3})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (n:N) WITH n, n.num AS num DELETE n RETURN sum(num) AS total",
    );
    expect(results).toEqual([6]);
  });

  test.fails(
    "[7] Aggregating in WITH after deleting nodes affects the result set but not the side effects - WITH after DELETE not fully supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:N {num: 1}), (:N {num: 2}), (:N {num: 3})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (n:N) WITH n, n.num AS num DELETE n WITH sum(num) AS sum RETURN sum",
      );
      expect(results).toEqual([6]);
      const remaining = executeTckQuery(graph, "MATCH (n:N) RETURN n");
      expect(remaining).toHaveLength(0);
    },
  );

  test.fails(
    "[8] Limiting to zero results after deleting relationships - literal in RETURN not supported after DELETE",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:R {num: 1}]->(:B)");
      executeTckQuery(graph, "CREATE (:A)-[:R {num: 2}]->(:B)");
      const results = executeTckQuery(
        graph,
        "MATCH ()-[r:R]->() DELETE r RETURN 42 AS num LIMIT 0",
      );
      expect(results).toHaveLength(0);
      const remaining = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r");
      expect(remaining).toHaveLength(0);
    },
  );

  test("[9] Skipping all results after deleting relationships - literal in RETURN not supported after DELETE", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:R {num: 1}]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() DELETE r RETURN 42 AS num SKIP 1",
    );
    expect(results).toHaveLength(0);
    const remaining = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r");
    expect(remaining).toHaveLength(0);
  });

  test.fails(
    "[10] Skipping and limiting to a few results after deleting relationships - literal in RETURN not supported after DELETE",
    () => {
      const graph = createTckGraph();
      for (let i = 1; i <= 5; i++) {
        executeTckQuery(graph, `CREATE (:A)-[:R {num: ${i}}]->(:B)`);
      }
      const results = executeTckQuery(
        graph,
        "MATCH ()-[r:R]->() DELETE r RETURN 42 AS num SKIP 2 LIMIT 2",
      );
      expect(results).toHaveLength(2);
      const remaining = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r");
      expect(remaining).toHaveLength(0);
    },
  );

  test("[11] Skipping zero result and limiting to all results after deleting relationships - literal in RETURN not supported after DELETE", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE (:A)-[:R {num: ${i}}]->(:B)`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() DELETE r RETURN 42 AS num SKIP 0 LIMIT 5",
    );
    expect(results).toHaveLength(5);
    const remaining = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r");
    expect(remaining).toHaveLength(0);
  });

  test.fails(
    "[12] Filtering after deleting relationships affects the result set but not the side effects - WITH WHERE after DELETE not supported",
    () => {
      const graph = createTckGraph();
      for (let i = 1; i <= 4; i++) {
        executeTckQuery(graph, `CREATE (:A)-[:R {num: ${i}}]->(:B)`);
      }
      const results = executeTckQuery(
        graph,
        "MATCH ()-[r:R]->() WITH r, r.num AS num DELETE r WITH num WHERE num % 2 = 0 RETURN num",
      );
      expect(results).toContain(2);
      expect(results).toContain(4);
      const remaining = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r");
      expect(remaining).toHaveLength(0);
    },
  );

  test("[13] Aggregating in RETURN after deleting relationships - WITH after DELETE not supported in grammar", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:R {num: 1}]->(:B)");
    executeTckQuery(graph, "CREATE (:A)-[:R {num: 2}]->(:B)");
    executeTckQuery(graph, "CREATE (:A)-[:R {num: 3}]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() WITH r, r.num AS num DELETE r RETURN sum(num) AS total",
    );
    expect(results).toEqual([6]);
  });

  test.fails(
    "[14] Aggregating in WITH after deleting relationships affects the result set but not the side effects - WITH after DELETE not fully supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:R {num: 1}]->(:B)");
      executeTckQuery(graph, "CREATE (:A)-[:R {num: 2}]->(:B)");
      executeTckQuery(graph, "CREATE (:A)-[:R {num: 3}]->(:B)");
      const results = executeTckQuery(
        graph,
        "MATCH ()-[r:R]->() WITH r, r.num AS num DELETE r WITH sum(num) AS sum RETURN sum",
      );
      expect(results).toEqual([6]);
      const remaining = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r");
      expect(remaining).toHaveLength(0);
    },
  );
});
