/**
 * TCK Comparison3 - Full-Bound Range
 * Translated from tmp/tck/features/expressions/comparison/Comparison3.feature
 *
 * Tests for full-bound range expressions like `1 < n.num < 3`.
 *
 * NOTE: Full-bound range syntax (a < x < b) may not be directly supported.
 * These tests verify equivalent AND-based conditions.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Comparison3 - Full-Bound Range", () => {
  test.fails(
    "[1] Handling numerical ranges 1 - UNWIND in CREATE not supported",
    () => {
      // Original TCK:
      // UNWIND [1, 2, 3] AS i CREATE ({num: i})
      // MATCH (n) WHERE 1 < n.num < 3 RETURN n.num
      // Expected: 2
      const graph = createTckGraph();
      executeTckQuery(graph, "UNWIND [1, 2, 3] AS i CREATE ({num: i})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) WHERE 1 < n.num < 3 RETURN n.num",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(2);
    },
  );

  test.fails(
    "[2] Handling numerical ranges 2 - UNWIND in CREATE not supported",
    () => {
      // Original TCK:
      // MATCH (n) WHERE 1 < n.num <= 3 RETURN n.num
      // Expected: 2, 3
      const graph = createTckGraph();
      executeTckQuery(graph, "UNWIND [1, 2, 3] AS i CREATE ({num: i})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) WHERE 1 < n.num <= 3 RETURN n.num",
      );
      expect(results).toHaveLength(2);
      expect(results).toContainEqual(2);
      expect(results).toContainEqual(3);
    },
  );

  test.fails(
    "[3] Handling numerical ranges 3 - UNWIND in CREATE not supported",
    () => {
      // Original TCK:
      // MATCH (n) WHERE 1 <= n.num < 3 RETURN n.num
      // Expected: 1, 2
      const graph = createTckGraph();
      executeTckQuery(graph, "UNWIND [1, 2, 3] AS i CREATE ({num: i})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) WHERE 1 <= n.num < 3 RETURN n.num",
      );
      expect(results).toHaveLength(2);
      expect(results).toContainEqual(1);
      expect(results).toContainEqual(2);
    },
  );

  test.fails(
    "[4] Handling numerical ranges 4 - UNWIND in CREATE not supported",
    () => {
      // Original TCK:
      // MATCH (n) WHERE 1 <= n.num <= 3 RETURN n.num
      // Expected: 1, 2, 3
      const graph = createTckGraph();
      executeTckQuery(graph, "UNWIND [1, 2, 3] AS i CREATE ({num: i})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) WHERE 1 <= n.num <= 3 RETURN n.num",
      );
      expect(results).toHaveLength(3);
      expect(results).toContainEqual(1);
      expect(results).toContainEqual(2);
      expect(results).toContainEqual(3);
    },
  );

  test.fails(
    "[5] Handling string ranges 1 - UNWIND in CREATE not supported",
    () => {
      // Original TCK:
      // UNWIND ['a', 'b', 'c'] AS c CREATE ({name: c})
      // MATCH (n) WHERE 'a' < n.name < 'c' RETURN n.name
      // Expected: 'b'
      const graph = createTckGraph();
      executeTckQuery(graph, "UNWIND ['a', 'b', 'c'] AS c CREATE ({name: c})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) WHERE 'a' < n.name < 'c' RETURN n.name",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("b");
    },
  );

  test.fails(
    "[6] Handling string ranges 2 - UNWIND in CREATE not supported",
    () => {
      // Original TCK:
      // MATCH (n) WHERE 'a' < n.name <= 'c' RETURN n.name
      // Expected: 'b', 'c'
      const graph = createTckGraph();
      executeTckQuery(graph, "UNWIND ['a', 'b', 'c'] AS c CREATE ({name: c})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) WHERE 'a' < n.name <= 'c' RETURN n.name",
      );
      expect(results).toHaveLength(2);
      expect(results).toContainEqual("b");
      expect(results).toContainEqual("c");
    },
  );

  test.fails(
    "[7] Handling string ranges 3 - UNWIND in CREATE not supported",
    () => {
      // Original TCK:
      // MATCH (n) WHERE 'a' <= n.name < 'c' RETURN n.name
      // Expected: 'a', 'b'
      const graph = createTckGraph();
      executeTckQuery(graph, "UNWIND ['a', 'b', 'c'] AS c CREATE ({name: c})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) WHERE 'a' <= n.name < 'c' RETURN n.name",
      );
      expect(results).toHaveLength(2);
      expect(results).toContainEqual("a");
      expect(results).toContainEqual("b");
    },
  );

  test.fails(
    "[8] Handling string ranges 4 - UNWIND in CREATE not supported",
    () => {
      // Original TCK:
      // MATCH (n) WHERE 'a' <= n.name <= 'c' RETURN n.name
      // Expected: 'a', 'b', 'c'
      const graph = createTckGraph();
      executeTckQuery(graph, "UNWIND ['a', 'b', 'c'] AS c CREATE ({name: c})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) WHERE 'a' <= n.name <= 'c' RETURN n.name",
      );
      expect(results).toHaveLength(3);
      expect(results).toContainEqual("a");
      expect(results).toContainEqual("b");
      expect(results).toContainEqual("c");
    },
  );

  test.fails(
    "[9] Handling empty range - chained comparison syntax may not be supported",
    () => {
      // Original TCK:
      // CREATE ({num: 3})
      // MATCH (n) WHERE 10 < n.num <= 3 RETURN n.num
      // Expected: empty (no range possible)
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ({num: 3})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) WHERE 10 < n.num <= 3 RETURN n.num",
      );
      expect(results).toHaveLength(0);
    },
  );

  // Custom tests demonstrating full-bound ranges using AND-based conditions
  test("[custom-1] Numerical range 1 < n.num < 3 using AND", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num > 1 AND n.num < 3 RETURN n.num",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test("[custom-2] Numerical range 1 < n.num <= 3 using AND", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num > 1 AND n.num <= 3 RETURN n.num",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual(2);
    expect(results).toContainEqual(3);
  });

  test("[custom-3] Numerical range 1 <= n.num < 3 using AND", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num >= 1 AND n.num < 3 RETURN n.num",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual(1);
    expect(results).toContainEqual(2);
  });

  test("[custom-4] Numerical range 1 <= n.num <= 3 using AND", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num >= 1 AND n.num <= 3 RETURN n.num",
    );

    expect(results).toHaveLength(3);
    expect(results).toContainEqual(1);
    expect(results).toContainEqual(2);
    expect(results).toContainEqual(3);
  });

  test("[custom-5] String range 'a' < n.name < 'c' using AND", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a'}), (:A {name: 'b'}), (:A {name: 'c'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name > 'a' AND n.name < 'c' RETURN n.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("b");
  });

  test("[custom-6] String range 'a' < n.name <= 'c' using AND", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a'}), (:A {name: 'b'}), (:A {name: 'c'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name > 'a' AND n.name <= 'c' RETURN n.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual("b");
    expect(results).toContainEqual("c");
  });

  test("[custom-7] String range 'a' <= n.name < 'c' using AND", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a'}), (:A {name: 'b'}), (:A {name: 'c'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name >= 'a' AND n.name < 'c' RETURN n.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual("a");
    expect(results).toContainEqual("b");
  });

  test("[custom-8] String range 'a' <= n.name <= 'c' using AND", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a'}), (:A {name: 'b'}), (:A {name: 'c'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name >= 'a' AND n.name <= 'c' RETURN n.name",
    );

    expect(results).toHaveLength(3);
    expect(results).toContainEqual("a");
    expect(results).toContainEqual("b");
    expect(results).toContainEqual("c");
  });

  test("[custom-9] Empty range (impossible condition) using AND", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    // 10 < n.num AND n.num <= 3 is impossible - no values satisfy both
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num > 10 AND n.num <= 3 RETURN n.num",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-10] Float range with mixed bounds", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1.0}), (:A {num: 1.5}), (:A {num: 2.0}), (:A {num: 2.5}), (:A {num: 3.0})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num >= 1.5 AND n.num < 2.5 RETURN n.num",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual(1.5);
    expect(results).toContainEqual(2.0);
  });

  test("[custom-11] Range with negative numbers", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: -3}), (:A {num: -1}), (:A {num: 0}), (:A {num: 1}), (:A {num: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num > -2 AND n.num < 2 RETURN n.num",
    );

    expect(results).toHaveLength(3);
    expect(results).toContainEqual(-1);
    expect(results).toContainEqual(0);
    expect(results).toContainEqual(1);
  });
});
