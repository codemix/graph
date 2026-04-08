/**
 * TCK Union3 - Union in combination with Union All
 * Translated from tmp/tck/features/clauses/union/Union3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Union3 - Union in combination with Union All", () => {
  test.fails("[1] Failing when mixing UNION and UNION ALL - semantic validation not implemented", () => {
    // Original TCK:
    // Query: RETURN 1 AS a UNION RETURN 2 AS a UNION ALL RETURN 3 AS a
    // Should raise SyntaxError: InvalidClauseComposition
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(graph, "RETURN 1 AS a UNION RETURN 2 AS a UNION ALL RETURN 3 AS a"),
    ).toThrow();
  });

  test.fails("[2] Failing when mixing UNION ALL and UNION - semantic validation not implemented", () => {
    // Original TCK:
    // Query: RETURN 1 AS a UNION ALL RETURN 2 AS a UNION RETURN 3 AS a
    // Should raise SyntaxError: InvalidClauseComposition
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(graph, "RETURN 1 AS a UNION ALL RETURN 2 AS a UNION RETURN 3 AS a"),
    ).toThrow();
  });
});
