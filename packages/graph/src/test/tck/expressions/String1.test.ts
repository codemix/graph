/**
 * TCK String1 - Substring extraction
 * Translated from tmp/tck/features/expressions/string/String1.feature
 *
 * NOTE: Tests are skipped because the grammar does not support:
 * - RETURN-only queries (must start with MATCH, CREATE, UNWIND, etc.)
 * - substring() function not implemented
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("String1 - Substring extraction", () => {
  test("[1] `substring()` with default second argument", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN substring('0123456789', 1) AS s");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("123456789");
  });

  // Custom tests demonstrating string property operations in WHERE clause
  test("[custom-1] Filter by substring comparison using STARTS WITH", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: '0123456789'}), (:A {name: 'abcdefghij'})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name STARTS WITH '012' RETURN n.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("0123456789");
  });

  test("[custom-2] Filter strings by length using properties", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'short', len: 5}), (:A {name: 'longer', len: 6})");

    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.len > 5 RETURN n.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("longer");
  });
});
