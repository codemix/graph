/**
 * TCK Comparison4 - Combination of Comparisons
 * Translated from tmp/tck/features/expressions/comparison/Comparison4.feature
 *
 * Tests for complex combinations of comparison operators.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Comparison4 - Combination of Comparisons", () => {
  test.fails("[1] Handling long chains of operators - chained comparisons not supported", () => {
    // Original TCK:
    // CREATE (a:A {prop1: 3, prop2: 4})
    // CREATE (b:B {prop1: 4, prop2: 5})
    // CREATE (c:C {prop1: 4, prop2: 4})
    // CREATE (a)-[:R]->(b)
    // CREATE (b)-[:R]->(c)
    // CREATE (c)-[:R]->(a)
    // MATCH (n)-->(m) WHERE n.prop1 < m.prop1 = n.prop2 <> m.prop2 RETURN labels(m)
    // Expected: ['B']
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A {prop1: 3, prop2: 4})");
    executeTckQuery(graph, "CREATE (b:B {prop1: 4, prop2: 5})");
    executeTckQuery(graph, "CREATE (c:C {prop1: 4, prop2: 4})");
    executeTckQuery(graph, "MATCH (a:A), (b:B) CREATE (a)-[:R]->(b)");
    executeTckQuery(graph, "MATCH (b:B), (c:C) CREATE (b)-[:R]->(c)");
    executeTckQuery(graph, "MATCH (c:C), (a:A) CREATE (c)-[:R]->(a)");
    const results = executeTckQuery(
      graph,
      "MATCH (n)-->(m) WHERE n.prop1 < m.prop1 = n.prop2 <> m.prop2 RETURN labels(m)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["B"]);
  });

  // Custom tests demonstrating combined comparisons in WHERE clause
  test.fails("[custom-1] Combined < and = conditions with AND - cross-node property comparison not supported", () => {
    // Original test:
    // MATCH (n)-[:R]->(m) WHERE n.prop1 < m.prop1 AND n.prop2 <> m.prop2 RETURN m.prop1, m.prop2
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A {prop1: 3, prop2: 4})");
    executeTckQuery(graph, "CREATE (b:B {prop1: 4, prop2: 5})");
    executeTckQuery(graph, "CREATE (c:C {prop1: 4, prop2: 4})");
    executeTckQuery(graph, "MATCH (a:A), (b:B) CREATE (a)-[:R]->(b)");
    executeTckQuery(graph, "MATCH (b:B), (c:C) CREATE (b)-[:R]->(c)");
    executeTckQuery(graph, "MATCH (c:C), (a:A) CREATE (c)-[:R]->(a)");
    const results = executeTckQuery(
      graph,
      "MATCH (n)-[:R]->(m) WHERE n.prop1 < m.prop1 AND n.prop2 <> m.prop2 RETURN m.prop1, m.prop2",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([4, 5]);
  });

  test("[custom-2] Equality and inequality combined", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 1}), (:A {x: 1, y: 2}), (:A {x: 2, y: 2})");

    // Find nodes where x = 1 and y <> 1
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.x = 1 AND n.y <> 1 RETURN n.x, n.y",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 2]);
  });

  test("[custom-3] Less than and greater than combined", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {a: 1, b: 5}), (:A {a: 3, b: 3}), (:A {a: 5, b: 1})");

    // Find nodes where a < 4 AND b > 2
    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.a < 4 AND n.b > 2 RETURN n.a, n.b");

    expect(results).toHaveLength(2);
    expect(results).toContainEqual([1, 5]);
    expect(results).toContainEqual([3, 3]);
  });

  test("[custom-4] Multiple comparison types with OR", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1}), (:A {num: 5}), (:A {num: 10})");

    // Find nodes where num <= 1 OR num >= 10
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num <= 1 OR n.num >= 10 RETURN n.num",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual(1);
    expect(results).toContainEqual(10);
  });

  test("[custom-5] Nested AND and OR with comparisons", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 10}), (:A {x: 5, y: 5}), (:A {x: 10, y: 1})");

    // Find nodes where (x < 3 AND y > 5) OR (x > 7 AND y < 3)
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE (n.x < 3 AND n.y > 5) OR (n.x > 7 AND n.y < 3) RETURN n.x, n.y",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual([1, 10]);
    expect(results).toContainEqual([10, 1]);
  });

  test("[custom-6] Comparison with relationship properties", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a'})-[:R {weight: 1}]->(:B {name: 'b'}),
              (:A {name: 'c'})-[:R {weight: 5}]->(:B {name: 'd'}),
              (:A {name: 'e'})-[:R {weight: 10}]->(:B {name: 'f'})`,
    );

    // Find edges with weight between 2 and 8
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:R]->(b:B) WHERE r.weight > 2 AND r.weight < 8 RETURN a.name, b.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["c", "d"]);
  });

  test.fails("[custom-7] Cross-node property comparison - cross-variable property comparison not supported", () => {
    // Original test:
    // MATCH (a:A)-[:R]->(b:B) WHERE a.num < b.num RETURN a.num, b.num
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1})-[:R]->(:B {num: 5}), (:A {num: 3})-[:R]->(:B {num: 2})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:R]->(b:B) WHERE a.num < b.num RETURN a.num, b.num",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 5]);
  });

  test.fails("[custom-8] Cross-node property equality - cross-variable property comparison not supported", () => {
    // Original test:
    // MATCH (a:A)-[:R]->(b:B) WHERE a.num = b.num RETURN a.num, b.num
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 3})-[:R]->(:B {num: 3}), (:A {num: 1})-[:R]->(:B {num: 2})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:R]->(b:B) WHERE a.num = b.num RETURN a.num, b.num",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([3, 3]);
  });

  test("[custom-9] NOT with comparison operators", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})");

    // Find nodes where NOT (num = 2)
    const results = executeTckQuery(graph, "MATCH (n:A) WHERE NOT (n.num = 2) RETURN n.num");

    expect(results).toHaveLength(2);
    expect(results).toContainEqual(1);
    expect(results).toContainEqual(3);
  });

  test("[custom-10] Complex filter with multiple operators", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {a: 1, b: 2, c: 3}),
              (:A {a: 2, b: 2, c: 2}),
              (:A {a: 3, b: 2, c: 1}),
              (:A {a: 1, b: 1, c: 1})`,
    );

    // Find nodes where a <= b AND b = c
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.a <= n.b AND n.b = n.c RETURN n.a, n.b, n.c",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual([2, 2, 2]);
    expect(results).toContainEqual([1, 1, 1]);
  });
});
