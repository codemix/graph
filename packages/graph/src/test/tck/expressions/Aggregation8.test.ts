/**
 * TCK Aggregation8 - DISTINCT
 * Translated from tmp/tck/features/expressions/aggregation/Aggregation8.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Aggregation8 - DISTINCT", () => {
  test.fails(
    "[1] Distinct on unbound node - OPTIONAL MATCH on empty graph not supported",
    () => {
      // Original TCK:
      // Given empty graph
      // Query: OPTIONAL MATCH (a) RETURN count(DISTINCT a)
      // Expected: | count(DISTINCT a) | 0 |
      //
      // Limitation: OPTIONAL MATCH on completely empty graph not supported
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "OPTIONAL MATCH (a) RETURN count(DISTINCT a)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(0);
    },
  );

  test.fails("[2] Distinct on null - unlabeled nodes not supported", () => {
    // Original TCK:
    // Given: CREATE ()
    // Query: MATCH (a) RETURN count(DISTINCT a.name)
    // Expected: | count(DISTINCT a.name) | 0 |
    //
    // Limitation: Unlabeled nodes not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    const results = executeTckQuery(
      graph,
      "MATCH (a) RETURN count(DISTINCT a.name)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0);
  });

  test("[3] Collect distinct nulls", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [null, null] AS x RETURN collect(DISTINCT x) AS c",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ c: [] });
  });

  test("[4] Collect distinct values mixed with nulls", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [null, 1, null] AS x RETURN collect(DISTINCT x) AS c",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ c: [1] });
  });

  // Custom tests demonstrating DISTINCT in aggregate functionality

  test("[Custom 1] count(DISTINCT) on node property", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:Person {name: 'Alice'}), (:Person {name: 'Bob'}), (:Person {name: 'Alice'})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:Person) RETURN count(DISTINCT n.name) AS cnt",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ cnt: 2 }); // Alice and Bob
  });

  test("[Custom 2] count(DISTINCT) on node variable", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:Person {name: 'Alice'}), (:Person {name: 'Bob'}), (:Person {name: 'Charlie'})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:Person) RETURN count(DISTINCT n) AS cnt",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ cnt: 3 }); // 3 unique nodes
  });

  test("[Custom 3] collect(DISTINCT) on property values", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:Item {category: 'A'}), (:Item {category: 'B'}), (:Item {category: 'A'}), (:Item {category: 'C'})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (i:Item) RETURN collect(DISTINCT i.category) AS categories",
    );

    expect(results).toHaveLength(1);
    const categories = (results[0] as { categories: string[] }).categories;
    expect(categories).toHaveLength(3);
    expect(categories.sort()).toEqual(["A", "B", "C"]);
  });

  test("[Custom 4] sum(DISTINCT) on property values", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:Item {price: 10}), (:Item {price: 20}), (:Item {price: 10}), (:Item {price: 30})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (i:Item) RETURN sum(DISTINCT i.price) AS total",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ total: 60 }); // 10 + 20 + 30
  });

  test("[Custom 5] avg(DISTINCT) on property values", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:Item {score: 10}), (:Item {score: 20}), (:Item {score: 10}), (:Item {score: 30})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (i:Item) RETURN avg(DISTINCT i.score) AS average",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ average: 20 }); // (10 + 20 + 30) / 3
  });

  test("[Custom 6] min(DISTINCT) is same as min()", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:Item {value: 10}), (:Item {value: 5}), (:Item {value: 10}), (:Item {value: 20})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (i:Item) RETURN min(DISTINCT i.value) AS minVal",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ minVal: 5 });
  });

  test("[Custom 7] max(DISTINCT) is same as max()", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:Item {value: 10}), (:Item {value: 5}), (:Item {value: 10}), (:Item {value: 20})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (i:Item) RETURN max(DISTINCT i.value) AS maxVal",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ maxVal: 20 });
  });

  test("[Custom 8] RETURN DISTINCT with count (alternative approach)", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice'}), (:A {name: 'Bob'}), (:A {name: 'Alice'})`,
    );

    // Use WITH DISTINCT to de-duplicate before counting
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WITH DISTINCT n.name AS name RETURN count(name)",
    );

    expect(results).toHaveLength(1);
  });
});
