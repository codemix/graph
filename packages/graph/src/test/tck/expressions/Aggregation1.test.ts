/**
 * TCK Aggregation1 - Count
 * Translated from tmp/tck/features/expressions/aggregation/Aggregation1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Aggregation1 - Count", () => {
  test.fails(
    "[1] Count only non-null values - implicit grouping not supported",
    () => {
      // Original TCK:
      // Given:
      //   CREATE ({name: 'a', num: 33})
      //   CREATE ({name: 'a'})
      //   CREATE ({name: 'b', num: 42})
      // Query: MATCH (n) RETURN n.name, count(n.num)
      // Expected:
      //   | n.name | count(n.num) |
      //   | 'a'    | 1            |
      //   | 'b'    | 1            |
      //
      // Limitations:
      // - Unlabeled nodes not supported
      // - Implicit grouping by n.name not supported
      // - count() over property expressions (n.num) not supported
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ({name: 'a', num: 33})");
      executeTckQuery(graph, "CREATE ({name: 'a'})");
      executeTckQuery(graph, "CREATE ({name: 'b', num: 42})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) RETURN n.name, count(n.num)",
      );
      expect(results).toHaveLength(2);
    },
  );

  test("[2] Counting loop relationships - unlabeled/undirected not supported", () => {
    // Original TCK:
    // Given: CREATE (a), (a)-[:R]->(a)
    // Query: MATCH ()-[r]-() RETURN count(r)
    // Expected: | count(r) | 1 |
    //
    // Limitations:
    // - Unlabeled nodes not supported
    // - Undirected relationship patterns not supported
    // - Self-loop counting may differ
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a), (a)-[:R]->(a)");
    const results = executeTckQuery(graph, "MATCH ()-[r]-() RETURN count(r)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  // Custom tests demonstrating count() functionality that is supported

  test("[Custom 1] Count all nodes of a label", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice'}), (:A {name: 'Bob'}), (:A {name: 'Charlie'})`,
    );

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN count(n)");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3);
  });

  test("[Custom 2] Count relationships", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice'})-[:KNOWS]->(:B {name: 'Bob'}), (:A {name: 'Charlie'})-[:KNOWS]->(:B {name: 'Diana'})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (:A)-[r:KNOWS]->(:B) RETURN count(r)",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test("[Custom 3] Count with WHERE filter", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice', age: 30}), (:A {name: 'Bob', age: 25}), (:A {name: 'Charlie', age: 35})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.age >= 30 RETURN count(n)",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test("[Custom 4] Count returns 0 for no matches", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice'})`);

    const results = executeTckQuery(graph, "MATCH (n:B) RETURN count(n)");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0);
  });

  test.fails(
    "[Custom 5] Count DISTINCT nodes - DISTINCT in aggregates not supported",
    () => {
      // Grammar limitation: count(DISTINCT x) syntax not supported
      // The grammar doesn't support DISTINCT keyword inside aggregate functions
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (:A {name: 'Alice'}), (:A {name: 'Bob'}), (:A {name: 'Alice'})`,
      );
      const results = executeTckQuery(
        graph,
        "MATCH (n:A) RETURN count(DISTINCT n.name)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(2);
    },
  );

  test("[Custom 6] Count with UNWIND", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 2, 3, 4, 5] AS x RETURN count(x)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(5);
  });
});
