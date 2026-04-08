/**
 * TCK Remove2 - Remove a Label
 * Translated from tmp/tck/features/clauses/remove/Remove2.feature
 *
 * Note: All tests are skipped because label removal is not supported.
 * Labels are immutable in this implementation.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Remove2 - Remove a Label", () => {
  test.fails(
    "[1] Remove a single label from a node with a single label - label removal not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:L {num: 42})");
      executeTckQuery(graph, "MATCH (n:L) REMOVE n:L");
      const results = executeTckQuery(graph, "MATCH (n) RETURN n.num");
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(42);
    },
  );

  test.fails(
    "[2] Remove a single label from a node with two labels - multi-label and label removal not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:Foo:Bar {num: 42})");
      executeTckQuery(graph, "MATCH (n:Foo:Bar) REMOVE n:Foo");
      const results = executeTckQuery(graph, "MATCH (n:Bar) RETURN labels(n)");
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(["Bar"]);
    },
  );

  test.fails(
    "[3] Remove two labels from a node with three labels - multi-label and label removal not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:L1:L2:L3 {num: 42})");
      executeTckQuery(graph, "MATCH (n:L1:L2:L3) REMOVE n:L1:L3");
      const results = executeTckQuery(graph, "MATCH (n:L2) RETURN labels(n)");
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(["L2"]);
    },
  );

  test.fails(
    "[4] Remove a non-existent node label - label removal not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:Foo {num: 42})");
      executeTckQuery(graph, "MATCH (n:Foo) REMOVE n:Bar");
      const results = executeTckQuery(graph, "MATCH (n:Foo) RETURN labels(n)");
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(["Foo"]);
    },
  );

  test.fails(
    "[5] Ignore null when removing a node label - OPTIONAL MATCH and label removal not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "OPTIONAL MATCH (a:DoesNotExist) REMOVE a:L RETURN a",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBeNull();
    },
  );

  // Test that verifies label removal throws an error (as documented in implementation)
  test("[custom-1] Label removal should throw error", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Foo {num: 42})");

    expect(() =>
      executeTckQuery(
        graph,
        `MATCH (n:Foo)
         REMOVE n:Foo
         RETURN n`,
      ),
    ).toThrow(/label removal is not supported/i);
  });
});
