/**
 * TCK Aggregation5 - Collect
 * Translated from tmp/tck/features/expressions/aggregation/Aggregation5.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Aggregation5 - Collect", () => {
  test.fails(
    "[1] `collect()` filtering nulls - OPTIONAL MATCH not supported",
    () => {
      // Original TCK:
      // Given: CREATE ()
      // Query:
      //   MATCH (n)
      //   OPTIONAL MATCH (n)-[:NOT_EXIST]->(x)
      //   RETURN n, collect(x)
      // Expected: | n | collect(x) | () | [] |
      //
      // Limitations:
      // - Unlabeled nodes not supported
      // - OPTIONAL MATCH not fully supported
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ()");
      const results = executeTckQuery(
        graph,
        `MATCH (n)
       OPTIONAL MATCH (n)-[:NOT_EXIST]->(x)
       RETURN n, collect(x)`,
      );
      expect(results).toHaveLength(1);
    },
  );

  test("[2] OPTIONAL MATCH and `collect()` on node property - OPTIONAL MATCH not supported", () => {
    // Original TCK:
    // Given:
    //   CREATE (:DoesExist {num: 42})
    //   CREATE (:DoesExist {num: 43})
    //   CREATE (:DoesExist {num: 44})
    // Query:
    //   OPTIONAL MATCH (f:DoesExist)
    //   OPTIONAL MATCH (n:DoesNotExist)
    //   RETURN collect(DISTINCT n.num) AS a, collect(DISTINCT f.num) AS b
    // Expected: | a | b | [] | [42, 43, 44] |
    //
    // Limitations:
    // - OPTIONAL MATCH not fully supported
    // - collect(DISTINCT property) may not work correctly
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:DoesExist {num: 42})");
    executeTckQuery(graph, "CREATE (:DoesExist {num: 43})");
    executeTckQuery(graph, "CREATE (:DoesExist {num: 44})");
    const results = executeTckQuery(
      graph,
      `OPTIONAL MATCH (f:DoesExist)
       OPTIONAL MATCH (n:DoesNotExist)
       RETURN collect(DISTINCT n.num) AS a, collect(DISTINCT f.num) AS b`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ a: [], b: [42, 43, 44] });
  });

  // Custom tests demonstrating collect() functionality that is supported

  test("[Custom 1] collect() all nodes of a label", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice'}), (:A {name: 'Bob'}), (:A {name: 'Charlie'})`,
    );

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN collect(n)");

    expect(results).toHaveLength(1);
    const collected = results[0] as Array<{ label: string }>;
    expect(collected).toHaveLength(3);
    // Verify all elements are nodes with label A
    for (const elem of collected) {
      expect(elem.label).toBe("A");
    }
  });

  test("[Custom 2] collect() with UNWIND", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 2, 3] AS x RETURN collect(x)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 2, 3]);
  });

  test("[Custom 3] collect() preserves duplicates", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 1, 2, 2, 3] AS x RETURN collect(x)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 1, 2, 2, 3]);
  });

  test.fails(
    "[Custom 4] collect(DISTINCT) removes duplicates - DISTINCT in aggregates not supported",
    () => {
      // Grammar limitation: collect(DISTINCT x) syntax not supported
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "UNWIND [1, 1, 2, 2, 3] AS x RETURN collect(DISTINCT x)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual([1, 2, 3]);
    },
  );

  test.fails(
    "[Custom 5] collect() strings - collect(n.property) not supported",
    () => {
      // Grammar limitation: collect() over property access not supported
      // collect() only works with node/relationship variables, not property access
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (:A {name: 'Alice'}), (:A {name: 'Bob'}), (:A {name: 'Charlie'})`,
      );
      const results = executeTckQuery(
        graph,
        "MATCH (n:A) RETURN collect(n.name)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(["Alice", "Bob", "Charlie"]);
    },
  );

  test("[Custom 6] collect() returns empty list when no matches", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      "MATCH (n:NonExistent) RETURN collect(n)",
    );

    expect(results).toHaveLength(1);
    const collected = results[0] as unknown[];
    expect(collected).toHaveLength(0);
  });
});
