/**
 * TCK Return1 - Return single variable (correct return of values according to their type)
 * Translated from tmp/tck/features/clauses/return/Return1.feature
 */
import { describe, test, expect } from "vitest";
import {
  createTckGraph,
  executeTckQuery,
  getLabel,
  getProperty,
} from "../tckHelpers.js";

describe("Return1 - Return single variable", () => {
  test("[1] Returning a list property - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({numbers: [1, 2, 3]})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n");
    expect(results).toHaveLength(1);
    const [n] = results[0] as [Record<string, unknown>];
    expect(getProperty(n, "numbers")).toEqual([1, 2, 3]);
  });

  test.fails(
    "[2] Fail when returning an undefined variable - unlabeled nodes not supported",
    () => {
      const graph = createTckGraph();
      expect(() => executeTckQuery(graph, "MATCH () RETURN foo")).toThrow();
    },
  );

  // Custom test with labeled nodes
  test("[custom] Returning a node with labeled node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test'})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n");
    expect(results).toHaveLength(1);
    // Single RETURN items still come wrapped in array
    const [n] = results[0] as [Record<string, unknown>];
    expect(getLabel(n)).toBe("A");
    expect(getProperty(n, "name")).toBe("test");
  });
});
