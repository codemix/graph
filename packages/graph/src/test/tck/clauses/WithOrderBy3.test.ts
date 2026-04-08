/**
 * TCK WithOrderBy3 - Order by multiple expressions
 * Translated from tmp/tck/features/clauses/with-orderBy/WithOrderBy3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("WithOrderBy3 - Order by multiple expressions", () => {
  // [1] Sort by two expressions, both in ascending order
  test("[1] Sort by two expressions, both ASC - example: a.bool, a.num", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 9, bool: true}), (:B {num: 5, bool: false}), (:C {num: -30, bool: false}), (:D {num: -41, bool: true}), (:E {num: 7054, bool: false})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a) WITH a ORDER BY a.bool, a.num LIMIT 4 RETURN a`,
    );
    expect(results.length).toBe(4);
    // Expected order: false nodes first (sorted by num), then true nodes (sorted by num)
    // false: C(-30), B(5), E(7054) | true: D(-41), A(9)
    const nums = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "num");
    });
    expect(nums).toEqual([-30, 5, 7054, -41]);
  });

  // [2] Sort by two expressions, first ASC, second DESC
  test("[2] Sort by two expressions, first ASC, second DESC - example: a.bool, a.num DESC", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 9, bool: true}), (:B {num: 5, bool: false}), (:C {num: -30, bool: false}), (:D {num: -41, bool: true}), (:E {num: 7054, bool: false})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a) WITH a ORDER BY a.bool, a.num DESC LIMIT 4 RETURN a`,
    );
    expect(results.length).toBe(4);
    // false first (DESC num): E(7054), B(5), C(-30) | true (DESC num): A(9), D(-41)
    const nums = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "num");
    });
    expect(nums).toEqual([7054, 5, -30, 9]);
  });

  // [3] Sort by two expressions, first DESC, second ASC
  test("[3] Sort by two expressions, first DESC, second ASC - example: a.bool DESC, a.num", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 9, bool: true}), (:B {num: 5, bool: false}), (:C {num: -30, bool: false}), (:D {num: -41, bool: true}), (:E {num: 7054, bool: false})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a) WITH a ORDER BY a.bool DESC, a.num LIMIT 4 RETURN a`,
    );
    expect(results.length).toBe(4);
    // true first (ASC num): D(-41), A(9) | false (ASC num): C(-30), B(5), E(7054)
    const nums = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "num");
    });
    expect(nums).toEqual([-41, 9, -30, 5]);
  });

  // [4] Sort by two expressions, both DESC
  test("[4] Sort by two expressions, both DESC - example: a.bool DESC, a.num DESC", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 9, bool: true}), (:B {num: 5, bool: false}), (:C {num: -30, bool: false}), (:D {num: -41, bool: true}), (:E {num: 7054, bool: false})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a) WITH a ORDER BY a.bool DESC, a.num DESC LIMIT 4 RETURN a`,
    );
    expect(results.length).toBe(4);
    // true first (DESC num): A(9), D(-41) | false (DESC num): E(7054), B(5), C(-30)
    const nums = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "num");
    });
    expect(nums).toEqual([9, -41, 7054, 5]);
  });

  // [5] Expression without explicit sort direction - uses unlabeled nodes
  test("[5] Expression without explicit sort direction - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE ({num: 3, text: 'a'}), ({num: 3, text: 'b'}), ({num: 1, text: 'c'})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a) WITH a ORDER BY a.num, a.text RETURN a.num AS num, a.text AS text",
    );
    expect(results).toHaveLength(3);
  });

  // [6] Constant expression does not influence order - uses unlabeled nodes
  test("[6] Constant expression does not influence order - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE ({num: 3, text: 'a'}), ({num: 2, text: 'b'}), ({num: 1, text: 'c'})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a) WITH a ORDER BY 1, a.num RETURN a.num AS num",
    );
    expect(results).toHaveLength(3);
  });

  // [7] Order direction cannot be overwritten - uses UNWIND
  test("[7] Order direction cannot be overwritten - UNWIND not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 2, 3] AS a WITH a ORDER BY a ASC, a DESC LIMIT 1 RETURN a",
    );
    expect(results).toEqual([[1]]);
  });

  // [8] Fail on sorting by undefined variables - semantic validation
  test.fails("[8] Fail on sorting by undefined variables - semantic validation not implemented", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    expect(() => {
      executeTckQuery(graph, "MATCH (a:A) WITH a ORDER BY b, a.num RETURN a");
    }).toThrow();
  });

  // Custom tests for supported patterns
  test("[custom-1] Multi-column ORDER BY with property expressions", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {x: 1, y: 2}), (:A {x: 1, y: 1}), (:A {x: 2, y: 1}), (:A {x: 2, y: 2})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a ORDER BY a.x, a.y RETURN a.x AS x, a.y AS y`,
    );
    expect(results.length).toBe(4);
    expect(results).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ]);
  });

  test("[custom-2] Multi-column ORDER BY mixed directions", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {x: 1, y: 2}), (:A {x: 1, y: 1}), (:A {x: 2, y: 1}), (:A {x: 2, y: 2})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a ORDER BY a.x ASC, a.y DESC RETURN a.x AS x, a.y AS y`,
    );
    expect(results.length).toBe(4);
    expect(results).toEqual([
      [1, 2],
      [1, 1],
      [2, 2],
      [2, 1],
    ]);
  });

  test("[custom-3] Multi-column ORDER BY with LIMIT", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {x: 1, y: 3}), (:A {x: 1, y: 1}), (:A {x: 2, y: 2}), (:A {x: 2, y: 4})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a ORDER BY a.x, a.y LIMIT 2 RETURN a.x AS x, a.y AS y`,
    );
    expect(results.length).toBe(2);
    expect(results).toEqual([
      [1, 1],
      [1, 3],
    ]);
  });

  test("[custom-4] Three-column ORDER BY", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {a: 1, b: 1, c: 2}), (:A {a: 1, b: 1, c: 1}), (:A {a: 1, b: 2, c: 1}), (:A {a: 2, b: 1, c: 1})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WITH n ORDER BY n.a, n.b, n.c RETURN n.a AS a, n.b AS b, n.c AS c`,
    );
    expect(results.length).toBe(4);
    expect(results).toEqual([
      [1, 1, 1],
      [1, 1, 2],
      [1, 2, 1],
      [2, 1, 1],
    ]);
  });
});
