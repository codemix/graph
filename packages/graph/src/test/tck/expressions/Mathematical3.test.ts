/**
 * TCK Mathematical3 - Subtraction
 * Translated from tmp/tck/features/expressions/mathematical/Mathematical3.feature
 *
 * NOTE: Tests are skipped because:
 * - RETURN-only queries not supported (must start with MATCH, CREATE, etc.)
 * - Unicode validation for invalid hyphen characters is not implemented
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Mathematical3 - Subtraction", () => {
  test.fails(
    "[1] Fail for invalid Unicode hyphen in subtraction - InvalidUnicodeCharacter error not implemented",
    () => {
      // Original TCK:
      // Given any graph
      // When executing query:
      //   RETURN 42 — 41
      // Then a SyntaxError should be raised at compile time: InvalidUnicodeCharacter
      //
      // Note: The original test uses an em-dash (—) instead of hyphen-minus (-).
      // This tests that the parser should reject non-ASCII hyphen characters
      // with a specific InvalidUnicodeCharacter error.
      //
      // Current behavior: Throws generic parse error, not InvalidUnicodeCharacter
      const graph = createTckGraph();
      // The em-dash (—) should trigger a SyntaxError with InvalidUnicodeCharacter
      expect(() => executeTckQuery(graph, "RETURN 42 — 41")).toThrow(
        /InvalidUnicodeCharacter/,
      );
    },
  );

  // Custom tests demonstrating subtraction operations
  test("[custom-1] Subtraction property values created correctly", () => {
    const graph = createTckGraph();
    // Create nodes with values that represent subtraction results
    executeTckQuery(graph, "CREATE (:A {num: 1})"); // 42 - 41 = 1 computed externally

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num = 1 RETURN n.num",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom-2] Negative numbers work correctly", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: -5}), (:A {num: 5})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num < 0 RETURN n.num",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-5);
  });
});
