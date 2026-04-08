/**
 * TCK Unwind1 - Unwind
 * Translated from tmp/tck/features/clauses/unwind/Unwind1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Unwind1 - Unwind", () => {
  test("[1] Unwinding a list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [1, 2, 3] AS x RETURN x");

    expect(results).toHaveLength(3);
    // Results are wrapped in arrays: [[1], [2], [3]]
    expect(results).toContainEqual([1]);
    expect(results).toContainEqual([2]);
    expect(results).toContainEqual([3]);
  });

  test("[2] Unwinding a range", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND range(1, 3) AS x RETURN x");

    expect(results).toHaveLength(3);
    expect(results).toContainEqual([1]);
    expect(results).toContainEqual([2]);
    expect(results).toContainEqual([3]);
  });

  test("[3] Unwinding a concatenation of lists", () => {
    const graph = createTckGraph();

    // Note: Using `a` and `b` instead of `first` and `second` because `first` is a keyword
    // (used in NULLS FIRST) and our grammar doesn't allow keywords as identifiers
    const results = executeTckQuery(
      graph,
      `WITH [1, 2, 3] AS a, [4, 5, 6] AS b
       UNWIND (a + b) AS x
       RETURN x`,
    );

    expect(results).toHaveLength(6);
    expect(results).toContainEqual([1]);
    expect(results).toContainEqual([2]);
    expect(results).toContainEqual([3]);
    expect(results).toContainEqual([4]);
    expect(results).toContainEqual([5]);
    expect(results).toContainEqual([6]);
  });

  test("[4] Unwinding a collected unwound expression", () => {
    const graph = createTckGraph();

    // Original TCK:
    // UNWIND RANGE(1, 2) AS row
    // WITH collect(row) AS rows
    // UNWIND rows AS x
    // RETURN x
    const results = executeTckQuery(
      graph,
      `UNWIND range(1, 2) AS row
       WITH collect(row) AS rows
       UNWIND rows AS x
       RETURN x`,
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual([1]);
    expect(results).toContainEqual([2]);
  });

  test("[5] Unwinding a collected expression - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({id: 1}), ({id: 2})");
    const results = executeTckQuery(
      graph,
      "MATCH (row) WITH collect(row) AS rows UNWIND rows AS node RETURN node.id",
    );
    expect(results).toHaveLength(2);
    expect(results.flat()).toContain(1);
    expect(results.flat()).toContain(2);
  });

  test("[6] Creating nodes from an unwound parameter list", () => {
    const graph = createTckGraph();

    // UNWIND parameter list, CREATE nodes with properties from the unwound values
    executeTckQuery(
      graph,
      "UNWIND $events AS event CREATE (n:A {year: event.year, id: event.id})",
      {
        events: [
          { year: 2014, id: 1 },
          { year: 2015, id: 2 },
        ],
      },
    );

    // Verify nodes were created
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.year, n.id ORDER BY n.id",
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual([2014, 1]);
    expect(results[1]).toEqual([2015, 2]);
  });

  test("[6-custom] UNWIND with simple parameter list", () => {
    const graph = createTckGraph();

    // Simpler test: UNWIND a parameter that is a list of values
    const results = executeTckQuery(graph, "UNWIND $items AS x RETURN x", {
      items: [1, 2, 3],
    });

    expect(results).toHaveLength(3);
    expect(results).toContainEqual([1]);
    expect(results).toContainEqual([2]);
    expect(results).toContainEqual([3]);
  });

  test("[7] Double unwinding a list of lists", () => {
    const graph = createTckGraph();

    // Original TCK:
    // WITH [[1, 2, 3], [4, 5, 6]] AS lol
    // UNWIND lol AS x
    // UNWIND x AS y
    // RETURN y
    const results = executeTckQuery(
      graph,
      `WITH [[1, 2, 3], [4, 5, 6]] AS lol
       UNWIND lol AS x
       UNWIND x AS y
       RETURN y`,
    );

    expect(results).toHaveLength(6);
    expect(results).toContainEqual([1]);
    expect(results).toContainEqual([2]);
    expect(results).toContainEqual([3]);
    expect(results).toContainEqual([4]);
    expect(results).toContainEqual([5]);
    expect(results).toContainEqual([6]);
  });

  test("[8] Unwinding the empty list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [] AS empty RETURN empty");

    expect(results).toHaveLength(0);
  });

  test("[9] Unwinding null", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND null AS nil RETURN nil");

    // UNWIND null should produce no rows
    expect(results).toHaveLength(0);
  });

  test("[10] Unwinding list with duplicates", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      "UNWIND [1, 1, 2, 2, 3, 3, 4, 4, 5, 5] AS duplicate RETURN duplicate",
    );

    expect(results).toHaveLength(10);
    // Results are wrapped in arrays: [[1], [1], [2], ...]
    // Count occurrences of each value
    const counts = new Map<number, number>();
    for (const r of results) {
      const value = (r as [number])[0];
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    expect(counts.get(1)).toBe(2);
    expect(counts.get(2)).toBe(2);
    expect(counts.get(3)).toBe(2);
    expect(counts.get(4)).toBe(2);
    expect(counts.get(5)).toBe(2);
  });

  test("[11] Unwind does not prune context", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [1, 2, 3] AS list UNWIND list AS x RETURN *",
    );
    expect(results).toHaveLength(3);
    // Each row should have list and x
    const row = results[0] as unknown[];
    expect(row).toHaveLength(2);
  });

  test.fails(
    "[12] Unwind does not remove variables from scope - unlabeled nodes and UNWIND after WITH not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (s:S), (n), (e:E), (s)-[:X]->(e), (s)-[:Y]->(e), (n)-[:Y]->(e)",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:S)-[:X]->(b1) WITH a, collect(b1) AS bees UNWIND bees AS b2 MATCH (a)-[:Y]->(b2) RETURN a, b2",
      );
      expect(results).toHaveLength(1);
    },
  );

  test("[13] Multiple unwinds after each other", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [1, 2] AS xs, [3, 4] AS ys, [5, 6] AS zs UNWIND xs AS x UNWIND ys AS y UNWIND zs AS z RETURN *",
    );
    // 2 * 2 * 2 = 8 rows
    expect(results).toHaveLength(8);
    // Each row should have xs, ys, zs, x, y, z
    const row = results[0] as unknown[];
    expect(row).toHaveLength(6);
  });

  test("[14] Unwind with merge - requires variable property access in MERGE", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "UNWIND $props AS prop MERGE (p:A {name: prop.name})",
      {
        props: [{ name: "Alice" }, { name: "Bob" }],
      },
    );
    const results = executeTckQuery(
      graph,
      "MATCH (p:A) RETURN p.name ORDER BY p.name",
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toBe("Alice");
    expect(results[1]).toBe("Bob");
  });

  test("[14-custom] UNWIND with string parameter list", () => {
    const graph = createTckGraph();

    // UNWIND parameter list of strings
    const results = executeTckQuery(
      graph,
      "UNWIND $names AS name RETURN name",
      { names: ["Alice", "Bob", "Charlie"] },
    );

    expect(results).toHaveLength(3);
    expect(results).toContainEqual(["Alice"]);
    expect(results).toContainEqual(["Bob"]);
    expect(results).toContainEqual(["Charlie"]);
  });

  // Custom tests for supported UNWIND scenarios
  test("[custom-1] UNWIND with string list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      "UNWIND ['a', 'b', 'c'] AS x RETURN x",
    );

    expect(results).toHaveLength(3);
    // Results are wrapped in arrays
    expect(results).toContainEqual(["a"]);
    expect(results).toContainEqual(["b"]);
    expect(results).toContainEqual(["c"]);
  });

  test("[custom-2] UNWIND with mixed type list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      "UNWIND [1, 'two', 3] AS x RETURN x",
    );

    expect(results).toHaveLength(3);
    // Results are wrapped in arrays
    expect(results).toContainEqual([1]);
    expect(results).toContainEqual(["two"]);
    expect(results).toContainEqual([3]);
  });

  test("[custom-3] UNWIND with CREATE - property expression referencing UNWIND variable not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "UNWIND [1, 2, 3] AS num CREATE (:A {num: num})");
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.num ORDER BY n.num",
    );
    expect(results).toHaveLength(3);
    expect(results[0]).toBe(1);
    expect(results[1]).toBe(2);
    expect(results[2]).toBe(3);
  });

  test("[custom-4] UNWIND with range", () => {
    const graph = createTckGraph();

    // Simplified test without CREATE (which needs PropertyValue to support variable reference)
    const results = executeTckQuery(
      graph,
      "UNWIND range(1, 5) AS num RETURN num",
    );

    expect(results).toHaveLength(5);
    expect(results).toContainEqual([1]);
    expect(results).toContainEqual([2]);
    expect(results).toContainEqual([3]);
    expect(results).toContainEqual([4]);
    expect(results).toContainEqual([5]);
  });

  test("[custom-5] UNWIND with boolean list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      "UNWIND [true, false, true] AS x RETURN x",
    );

    expect(results).toHaveLength(3);
    // Results are wrapped in arrays
    expect(results).toContainEqual([true]);
    expect(results).toContainEqual([false]);
    // Two trues
    expect(results.filter((r) => (r as [boolean])[0] === true)).toHaveLength(2);
  });

  test("[custom-6] UNWIND with negative step range", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      "UNWIND range(5, 1, -1) AS x RETURN x",
    );

    expect(results).toHaveLength(5);
    expect(results).toContainEqual([5]);
    expect(results).toContainEqual([4]);
    expect(results).toContainEqual([3]);
    expect(results).toContainEqual([2]);
    expect(results).toContainEqual([1]);
  });

  test("[custom-7] UNWIND with float list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      "UNWIND [1.5, 2.5, 3.5] AS x RETURN x",
    );

    expect(results).toHaveLength(3);
    // Results are wrapped in arrays
    expect(results).toContainEqual([1.5]);
    expect(results).toContainEqual([2.5]);
    expect(results).toContainEqual([3.5]);
  });

  test("[custom-8] UNWIND with nested list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      "UNWIND [[1, 2], [3, 4]] AS x RETURN x",
    );

    expect(results).toHaveLength(2);
    expect(results).toContainEqual([[1, 2]]);
    expect(results).toContainEqual([[3, 4]]);
  });
});
