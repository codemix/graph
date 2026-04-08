/**
 * TCK String4 - String Splitting
 * Translated from tmp/tck/features/expressions/string/String4.feature
 *
 * NOTE: Tests are skipped because the grammar does not support:
 * - split() function result UNWIND iteration
 * - split() function not implemented
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("String4 - String Splitting", () => {
  test("[1] `split()`", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND split('one1two', '1') AS item RETURN count(item) AS item",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  // Custom tests demonstrating UNWIND with lists we can create
  test("[custom-1] UNWIND with literal list", () => {
    const graph = createTckGraph();

    // Simulate what split would do by using a literal list
    const results = executeTckQuery(
      graph,
      "UNWIND ['one', 'two'] AS item RETURN item",
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(["one"]);
    expect(results[1]).toEqual(["two"]);
  });

  test("[custom-2] Count items from UNWIND", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      "UNWIND ['one', 'two'] AS item RETURN count(item)",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });
});
