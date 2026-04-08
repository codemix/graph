/**
 * TCK Comparison2 - Half-bounded Range
 * Translated from tmp/tck/features/expressions/comparison/Comparison2.feature
 *
 * Tests for <, >, <=, >= operators (half-bounded ranges).
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Comparison2 - Half-bounded Range", () => {
  test("[1] Comparing strings and integers using > in an AND'd predicate", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (root:Root)-[:T]->(:Child {var: 0}),
             (root)-[:T]->(:Child {var: 'xx'}),
             (root)-[:T]->(:Child)`,
    );
    const results = executeTckQuery(
      graph,
      "MATCH (:Root)-->(i:Child) WHERE i.var IS NOT NULL AND i.var > 'x' RETURN i.var",
    );
    expect(results).toEqual(["xx"]);
  });

  test("[2] Comparing strings and integers using > in an OR'd predicate", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (root:Root)-[:T]->(:Child {var: 0}),
             (root)-[:T]->(:Child {var: 'xx'}),
             (root)-[:T]->(:Child)`,
    );
    const results = executeTckQuery(
      graph,
      "MATCH (:Root)-->(i:Child) WHERE i.var IS NULL OR i.var > 'x' RETURN i.var",
    );
    // Should return 'xx' and undefined (missing property is undefined, not null)
    expect(results).toHaveLength(2);
    expect(results).toContain("xx");
    expect(results).toContain(undefined);
  });

  test.fails(
    "[3] Comparing across types yields null, except numbers - named paths and complex expressions not supported",
    () => {
      // Original TCK Scenario Outline:
      // MATCH p = (n)-[r]->()
      // WITH [n, r, p, '', 1, 3.14, true, null, [], {}] AS types
      // UNWIND range(0, size(types) - 1) AS i
      // UNWIND range(0, size(types) - 1) AS j
      // WITH types[i] AS lhs, types[j] AS rhs
      // WHERE i <> j
      // WITH lhs, rhs, lhs < rhs AS result
      // WHERE result
      // RETURN lhs, rhs
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:R]->(:B)");
      const results = executeTckQuery(
        graph,
        `MATCH p = (n)-[r]->()
       WITH [n, r, p, '', 1, 3.14, true, null, [], {}] AS types
       UNWIND range(0, size(types) - 1) AS i
       UNWIND range(0, size(types) - 1) AS j
       WITH types[i] AS lhs, types[j] AS rhs
       WHERE i <> j
       WITH lhs, rhs, lhs < rhs AS result
       WHERE result
       RETURN lhs, rhs`,
      );
      // Only numbers should be comparable: 1 < 3.14
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual([1, 3.14]);
    },
  );

  test("[4] Comparing lists", () => {
    const graph = createTckGraph();

    // [1, 0] >= [1] is true (lexicographic: [1,0] > [1])
    let results = executeTckQuery(graph, "RETURN [1, 0] >= [1] AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);

    // [1, 2] >= [1] is true
    results = executeTckQuery(graph, "RETURN [1, 2] >= [1] AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);

    // [1] < [1, 2] is true
    results = executeTckQuery(graph, "RETURN [1] < [1, 2] AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[5] Comparing NaN", () => {
    const graph = createTckGraph();

    // NaN > 1 is false
    let results = executeTckQuery(graph, "RETURN 0.0 / 0.0 > 1 AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);

    // NaN >= 1 is false
    results = executeTckQuery(graph, "RETURN 0.0 / 0.0 >= 1 AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);

    // NaN < 1 is false
    results = executeTckQuery(graph, "RETURN 0.0 / 0.0 < 1 AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);

    // NaN <= 1 is false
    results = executeTckQuery(graph, "RETURN 0.0 / 0.0 <= 1 AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[6] Comparability between numbers and strings", () => {
    const graph = createTckGraph();

    // 1.0 < 1.0 is false
    let results = executeTckQuery(graph, "RETURN 1.0 < 1.0 AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);

    // 1 < 1.0 is false (numeric comparison)
    results = executeTckQuery(graph, "RETURN 1 < 1.0 AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);

    // 1.0 <= 1.0 is true
    results = executeTckQuery(graph, "RETURN 1.0 <= 1.0 AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);

    // 1.5 > 1 is true
    results = executeTckQuery(graph, "RETURN 1.5 > 1 AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  // Custom tests demonstrating half-bounded range operators in WHERE clause
  test("[custom-1] Greater than comparison with integers", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3}), (:A {num: 4}), (:A {num: 5})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num > 3 RETURN n.num",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual(4);
    expect(results).toContainEqual(5);
  });

  test("[custom-2] Less than comparison with integers", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3}), (:A {num: 4}), (:A {num: 5})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num < 3 RETURN n.num",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual(1);
    expect(results).toContainEqual(2);
  });

  test("[custom-3] Greater than or equal comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3}), (:A {num: 4}), (:A {num: 5})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num >= 3 RETURN n.num",
    );

    expect(results).toHaveLength(3);
    expect(results).toContainEqual(3);
    expect(results).toContainEqual(4);
    expect(results).toContainEqual(5);
  });

  test("[custom-4] Less than or equal comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3}), (:A {num: 4}), (:A {num: 5})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num <= 3 RETURN n.num",
    );

    expect(results).toHaveLength(3);
    expect(results).toContainEqual(1);
    expect(results).toContainEqual(2);
    expect(results).toContainEqual(3);
  });

  test("[custom-5] String comparison with >", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'apple'}), (:A {name: 'banana'}), (:A {name: 'cherry'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name > 'banana' RETURN n.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("cherry");
  });

  test("[custom-6] String comparison with >=", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'apple'}), (:A {name: 'banana'}), (:A {name: 'cherry'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name >= 'banana' RETURN n.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual("banana");
    expect(results).toContainEqual("cherry");
  });

  test("[custom-7] Float comparison with >", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1.5}), (:A {num: 2.5}), (:A {num: 3.14})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num > 2.0 RETURN n.num",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual(2.5);
    expect(results).toContainEqual(3.14);
  });

  test("[custom-8] Integer and float comparison (1 < 1.5)", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num < 1.5 RETURN n.num",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom-9] Combined > and AND conditions", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:Root)-[:T]->(:Child {var: 'xx'}), (:Root)-[:T]->(:Child {var: 'ab'})",
    );

    // Filter strings greater than 'x'
    const results = executeTckQuery(
      graph,
      "MATCH (:Root)-[:T]->(c:Child) WHERE c.var > 'x' RETURN c.var",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("xx");
  });

  test("[custom-10] Comparison with property on both sides", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {x: 1, y: 5}), (:A {x: 3, y: 2}), (:A {x: 4, y: 4})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.x < n.y RETURN n.x, n.y",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 5]);
  });
});
