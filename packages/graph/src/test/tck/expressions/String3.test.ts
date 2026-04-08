/**
 * TCK String3 - String Reversal
 * Translated from tmp/tck/features/expressions/string/String3.feature
 *
 * NOTE: Tests are skipped because the grammar does not support:
 * - RETURN-only queries (must start with MATCH, CREATE, UNWIND, etc.)
 * - reverse() function not implemented for strings
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("String3 - String Reversal", () => {
  test("[1] `reverse()`", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN reverse('raksO')");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Oskar");
  });

  // Custom tests demonstrating string operations we can do
  test("[custom-1] String property comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Oskar'}), (:A {name: 'raksO'})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name = 'Oskar' RETURN n.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Oskar");
  });
});
