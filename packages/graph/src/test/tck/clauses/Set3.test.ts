/**
 * TCK Set3 - Set a Label
 * Translated from tmp/tck/features/clauses/set/Set3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Set3 - Set a Label", () => {
  test.fails(
    "[1] Add a single label to a node with no label - unlabeled nodes not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ()");
      executeTckQuery(graph, "MATCH (n) SET n:Foo");
      const results = executeTckQuery(graph, "MATCH (n:Foo) RETURN n");
      expect(results).toHaveLength(1);
    },
  );

  test.fails(
    "[2] Adding multiple labels to a node with no label - unlabeled nodes and multi-label not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ()");
      executeTckQuery(graph, "MATCH (n) SET n:Foo:Bar");
      const results = executeTckQuery(graph, "MATCH (n:Foo:Bar) RETURN n");
      expect(results).toHaveLength(1);
    },
  );

  test.fails(
    "[3] Add a single label to a node with an existing label - multi-label result not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)");
      executeTckQuery(graph, "MATCH (n:A) SET n:Foo");
      const results = executeTckQuery(graph, "MATCH (n:A:Foo) RETURN n");
      expect(results).toHaveLength(1);
    },
  );

  test.fails(
    "[4] Adding multiple labels to a node with an existing label - unlabeled MATCH and multi-label not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ()");
      executeTckQuery(graph, "MATCH (n) SET n:Foo:Bar");
      const results = executeTckQuery(graph, "MATCH (n:Foo:Bar) RETURN n");
      expect(results).toHaveLength(1);
    },
  );

  test.fails(
    "[5] Ignore whitespace before colon 1 - unlabeled nodes not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ()");
      executeTckQuery(graph, "MATCH (n) SET n :Foo");
      const results = executeTckQuery(graph, "MATCH (n:Foo) RETURN labels(n)");
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(["Foo"]);
    },
  );

  test.fails(
    "[6] Ignore whitespace before colon 2 - unlabeled nodes not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ()");
      executeTckQuery(graph, "MATCH (n) SET n :Foo :Bar");
      const results = executeTckQuery(
        graph,
        "MATCH (n:Foo:Bar) RETURN labels(n)",
      );
      expect(results).toHaveLength(1);
      const labels = results[0] as string[];
      expect(labels).toContain("Foo");
      expect(labels).toContain("Bar");
    },
  );

  test.fails(
    "[7] Ignore whitespace before colon 3 - unlabeled nodes not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ()");
      executeTckQuery(graph, "MATCH (n) SET n :Foo:Bar");
      const results = executeTckQuery(
        graph,
        "MATCH (n:Foo:Bar) RETURN labels(n)",
      );
      expect(results).toHaveLength(1);
      const labels = results[0] as string[];
      expect(labels).toContain("Foo");
      expect(labels).toContain("Bar");
    },
  );

  test.fails(
    "[8] Ignore null when setting label - OPTIONAL MATCH not fully supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "OPTIONAL MATCH (a:DoesNotExist) SET a:L RETURN a",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBeNull();
    },
  );

  // Note: All Set3 tests involve either:
  // - Unlabeled nodes (not supported - our schema requires labels)
  // - Adding labels to existing nodes (SET n:Label syntax for dynamic label assignment)
  // - Multi-label results (:A:B syntax)
  //
  // Note: labels() function IS working now
  // Dynamic label assignment (SET n:Label) is a fundamentally different operation
  // from property assignment and would require schema changes to support.
});
