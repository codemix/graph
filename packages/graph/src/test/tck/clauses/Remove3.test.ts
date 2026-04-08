/**
 * TCK Remove3 - Persistence of remove clause side effects
 * Translated from tmp/tck/features/clauses/remove/Remove3.feature
 *
 * Note: Many tests involve label removal which is not supported.
 * Tests involving unlabeled nodes are also skipped.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Remove3 - Persistence of remove clause side effects", () => {
  test("[1] Limiting to zero results after removing a property from nodes affects the result set but not the side effects", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {num: 42})");

    const results = executeTckQuery(
      graph,
      `MATCH (n:N)
       REMOVE n.num
       RETURN n
       LIMIT 0`,
    );

    // Result should be empty due to LIMIT 0
    expect(results).toHaveLength(0);

    // But property should still be removed (side effect persists)
    const checkResults = executeTckQuery(graph, "MATCH (n:N) RETURN n.num");
    expect(checkResults).toHaveLength(1);
    expect(checkResults[0]).toBeUndefined();
  });

  test("[2] Skipping all results after removing a property from nodes affects the result set but not the side effects", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {num: 42})");

    const results = executeTckQuery(
      graph,
      `MATCH (n:N)
       REMOVE n.num
       RETURN n
       SKIP 1`,
    );

    // Result should be empty due to SKIP 1
    expect(results).toHaveLength(0);

    // But property should still be removed (side effect persists)
    const checkResults = executeTckQuery(graph, "MATCH (n:N) RETURN n.num");
    expect(checkResults).toHaveLength(1);
    expect(checkResults[0]).toBeUndefined();
  });

  test.fails(
    "[3] Skipping and limiting to a few results after removing a property from nodes - SKIP/LIMIT applied before REMOVE in this implementation",
    () => {
      const graph = createTckGraph();
      for (let i = 1; i <= 5; i++) {
        executeTckQuery(graph, `CREATE (:N {name: 'a', num: ${i}})`);
      }
      const results = executeTckQuery(
        graph,
        `MATCH (n:N)
       REMOVE n.name
       RETURN n.num
       SKIP 2 LIMIT 2`,
      );
      expect(results).toHaveLength(2);
      // TCK expects all 5 nodes to have name removed
      const checkResults = executeTckQuery(
        graph,
        "MATCH (n:N) WHERE n.name IS NOT NULL RETURN n",
      );
      expect(checkResults).toHaveLength(0);
    },
  );

  test("[4] Skipping zero results and limiting to all results after removing a property from nodes does not affect the result set nor the side effects", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {name: 'a', num: 42})");
    executeTckQuery(graph, "CREATE (:N {name: 'a', num: 42})");
    executeTckQuery(graph, "CREATE (:N {name: 'a', num: 42})");
    executeTckQuery(graph, "CREATE (:N {name: 'a', num: 42})");
    executeTckQuery(graph, "CREATE (:N {name: 'a', num: 42})");

    const results = executeTckQuery(
      graph,
      `MATCH (n:N)
       REMOVE n.name
       RETURN n.num
       SKIP 0 LIMIT 5`,
    );

    // Should return all 5 results
    expect(results).toHaveLength(5);
    for (const result of results) {
      expect(result).toBe(42);
    }

    // All 5 nodes should have name removed
    const checkResults = executeTckQuery(graph, "MATCH (n:N) RETURN n.name");
    expect(checkResults).toHaveLength(5);
    for (const result of checkResults) {
      expect(result).toBeUndefined();
    }
  });

  test("[5] Filtering after removing a property from nodes - WITH WHERE with modulo not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE (:N {name: 'a', num: ${i}})`);
    }
    const results = executeTckQuery(
      graph,
      `MATCH (n:N)
       REMOVE n.name
       WITH n WHERE n.num % 2 = 0
       RETURN n.num`,
    );
    expect(results).toEqual([2, 4]);
    // All 5 nodes should have name removed
    const checkResults = executeTckQuery(
      graph,
      "MATCH (n:N) WHERE n.name IS NOT NULL RETURN n",
    );
    expect(checkResults).toHaveLength(0);
  });

  test("[6] Aggregating in RETURN after removing a property from nodes affects the result set but not the side effects", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {name: 'a', num: 1})");
    executeTckQuery(graph, "CREATE (:N {name: 'a', num: 2})");
    executeTckQuery(graph, "CREATE (:N {name: 'a', num: 3})");
    executeTckQuery(graph, "CREATE (:N {name: 'a', num: 4})");
    executeTckQuery(graph, "CREATE (:N {name: 'a', num: 5})");

    const results = executeTckQuery(
      graph,
      `MATCH (n:N)
       REMOVE n.name
       RETURN sum(n.num)`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(15);

    // All 5 nodes should have name removed
    const checkResults = executeTckQuery(graph, "MATCH (n:N) RETURN n.name");
    expect(checkResults).toHaveLength(5);
    for (const result of checkResults) {
      expect(result).toBeUndefined();
    }
  });

  test.fails(
    "[7] Aggregating in WITH after removing a property from nodes - REMOVE...WITH chaining not supported in grammar",
    () => {
      const graph = createTckGraph();
      for (let i = 1; i <= 5; i++) {
        executeTckQuery(graph, `CREATE (:N {name: 'a', num: ${i}})`);
      }
      const results = executeTckQuery(
        graph,
        `MATCH (n:N)
       REMOVE n.name
       WITH sum(n.num) AS sum
       RETURN sum`,
      );
      expect(results).toEqual([15]);
    },
  );

  test.fails(
    "[8] Limiting to zero results after removing a label - label removal not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:N:X {num: 42})");
      const results = executeTckQuery(
        graph,
        "MATCH (n:N:X) REMOVE n:X RETURN n LIMIT 0",
      );
      expect(results).toHaveLength(0);
      const remaining = executeTckQuery(graph, "MATCH (n:N) RETURN labels(n)");
      expect(remaining).toHaveLength(1);
      expect(remaining[0]).toEqual(["N"]);
    },
  );

  test.fails(
    "[9] Skipping all results after removing a label - label removal not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:N:X {num: 42})");
      const results = executeTckQuery(
        graph,
        "MATCH (n:N:X) REMOVE n:X RETURN n SKIP 1",
      );
      expect(results).toHaveLength(0);
      const remaining = executeTckQuery(graph, "MATCH (n:N) RETURN labels(n)");
      expect(remaining).toHaveLength(1);
      expect(remaining[0]).toEqual(["N"]);
    },
  );

  test.fails(
    "[10] Skipping and limiting after removing a label - label removal not supported",
    () => {
      const graph = createTckGraph();
      for (let i = 1; i <= 5; i++) {
        executeTckQuery(graph, `CREATE (:N:X {num: ${i}})`);
      }
      const results = executeTckQuery(
        graph,
        "MATCH (n:N:X) REMOVE n:X RETURN n.num SKIP 2 LIMIT 2",
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[11] Skipping zero and limiting to all after removing a label - label removal not supported",
    () => {
      const graph = createTckGraph();
      for (let i = 1; i <= 5; i++) {
        executeTckQuery(graph, `CREATE (:N:X {num: ${i}})`);
      }
      const results = executeTckQuery(
        graph,
        "MATCH (n:N:X) REMOVE n:X RETURN n.num SKIP 0 LIMIT 5",
      );
      expect(results).toHaveLength(5);
    },
  );

  test.fails(
    "[12] Filtering after removing a label - label removal not supported",
    () => {
      const graph = createTckGraph();
      for (let i = 1; i <= 5; i++) {
        executeTckQuery(graph, `CREATE (:N:X {num: ${i}})`);
      }
      const results = executeTckQuery(
        graph,
        "MATCH (n:N:X) REMOVE n:X WITH n WHERE n.num % 2 = 0 RETURN n.num",
      );
      expect(results).toEqual([2, 4]);
    },
  );

  test.fails(
    "[13] Aggregating in RETURN after removing a label - label removal not supported",
    () => {
      const graph = createTckGraph();
      for (let i = 1; i <= 5; i++) {
        executeTckQuery(graph, `CREATE (:N:X {num: ${i}})`);
      }
      const results = executeTckQuery(
        graph,
        "MATCH (n:N:X) REMOVE n:X RETURN sum(n.num) AS total",
      );
      expect(results).toEqual([15]);
    },
  );

  test.fails(
    "[14] Aggregating in WITH after removing a label - label removal not supported",
    () => {
      const graph = createTckGraph();
      for (let i = 1; i <= 5; i++) {
        executeTckQuery(graph, `CREATE (:N:X {num: ${i}})`);
      }
      const results = executeTckQuery(
        graph,
        "MATCH (n:N:X) REMOVE n:X WITH sum(n.num) AS sum RETURN sum",
      );
      expect(results).toEqual([15]);
    },
  );

  test("[15] Limiting to zero results after removing a property from relationships - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:R {num: 42}]->()");
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() REMOVE r.num RETURN r LIMIT 0",
    );
    expect(results).toHaveLength(0);
    const checkResults = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() RETURN r.num",
    );
    expect(checkResults[0]).toBeUndefined();
  });

  test("[16] Skipping all results after removing a property from relationships - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:R {num: 42}]->()");
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() REMOVE r.num RETURN r SKIP 1",
    );
    expect(results).toHaveLength(0);
    const checkResults = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() RETURN r.num",
    );
    expect(checkResults[0]).toBeUndefined();
  });

  test("[17] Skipping and limiting after removing a property from relationships - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE ()-[:R {name: 'a', num: ${i}}]->()`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() REMOVE r.name RETURN r.num SKIP 2 LIMIT 2",
    );
    expect(results).toHaveLength(2);
  });

  test("[18] Skipping zero and limiting to all after removing a property from relationships - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE ()-[:R {name: 'a', num: ${i}}]->()`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() REMOVE r.name RETURN r.num SKIP 0 LIMIT 5",
    );
    expect(results).toHaveLength(5);
  });

  test("[19] Filtering after removing a property from relationships - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE ()-[:R {name: 'a', num: ${i}}]->()`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() REMOVE r.name WITH r WHERE r.num % 2 = 0 RETURN r.num",
    );
    expect(results).toContain(2);
    expect(results).toContain(4);
  });

  test.fails(
    "[20] Aggregating in RETURN after removing a property from relationships - unlabeled nodes not supported",
    () => {
      const graph = createTckGraph();
      for (let i = 1; i <= 5; i++) {
        executeTckQuery(graph, `CREATE ()-[:R {name: 'a', num: ${i}}]->()`);
      }
      const results = executeTckQuery(
        graph,
        "MATCH ()-[r:R]->() REMOVE r.name RETURN sum(r.num) AS total",
      );
      expect(results).toEqual([15]);
    },
  );

  test.fails(
    "[21] Aggregating in WITH after removing a property from relationships - unlabeled nodes not supported",
    () => {
      const graph = createTckGraph();
      for (let i = 1; i <= 5; i++) {
        executeTckQuery(graph, `CREATE ()-[:R {name: 'a', num: ${i}}]->()`);
      }
      const results = executeTckQuery(
        graph,
        "MATCH ()-[r:R]->() REMOVE r.name WITH sum(r.num) AS sum RETURN sum",
      );
      expect(results).toEqual([15]);
    },
  );

  // Custom tests with labeled nodes for relationship property removal
  test("[custom-1] Removing property from relationship without SKIP/LIMIT", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:R {name: 'a', num: 1}]->(:B)");
    executeTckQuery(graph, "CREATE (:A)-[:R {name: 'b', num: 2}]->(:B)");
    executeTckQuery(graph, "CREATE (:A)-[:R {name: 'c', num: 3}]->(:B)");

    const results = executeTckQuery(
      graph,
      `MATCH (:A)-[r:R]->(:B)
       REMOVE r.name
       RETURN r.num`,
    );

    // Should return all 3 results
    expect(results).toHaveLength(3);

    // All 3 relationships should have name removed
    const checkResults = executeTckQuery(
      graph,
      "MATCH (:A)-[r:R]->(:B) RETURN r.name",
    );
    expect(checkResults).toHaveLength(3);
    for (const result of checkResults) {
      expect(result).toBeUndefined();
    }
  });

  test("[custom-2] Removing property from multiple relationships", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:R {name: 'a', num: 10}]->(:B)");
    executeTckQuery(graph, "CREATE (:A)-[:R {name: 'b', num: 20}]->(:B)");
    executeTckQuery(graph, "CREATE (:A)-[:R {name: 'c', num: 30}]->(:B)");

    // Remove the name properties
    executeTckQuery(
      graph,
      `MATCH (:A)-[r:R]->(:B)
       REMOVE r.name`,
    );

    // Verify all relationships have name removed
    const checkResults = executeTckQuery(
      graph,
      "MATCH (:A)-[r:R]->(:B) RETURN r.name",
    );
    expect(checkResults).toHaveLength(3);
    for (const result of checkResults) {
      expect(result).toBeUndefined();
    }

    // Verify num properties still exist
    const numResults = executeTckQuery(
      graph,
      "MATCH (:A)-[r:R]->(:B) RETURN r.num",
    );
    expect(numResults).toHaveLength(3);
    const nums = numResults.map((r) => r as number).sort((a, b) => a - b);
    expect(nums).toEqual([10, 20, 30]);
  });
});
