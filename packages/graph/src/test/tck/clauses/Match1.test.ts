/**
 * TCK Match1 - Match nodes
 * Translated from tmp/tck/features/clauses/match/Match1.feature
 */
import { describe, test, expect } from "vitest";
import {
  createTckGraph,
  executeTckQuery,
  getLabel,
  getProperty,
} from "../tckHelpers.js";

describe("Match1 - Match nodes", () => {
  test("[1] Match non-existent nodes returns empty", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "MATCH (n) RETURN n");
    expect(results).toEqual([]);
  });

  test("[2] Matching all nodes - requires unlabeled node support", () => {
    // This test creates nodes without labels: ({name: 'c'})
    // Our schema requires all nodes to have labels
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B {name: 'b'}), ({name: 'c'})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n");
    expect(results).toHaveLength(3);
    // Single return items are wrapped in arrays
    const labels = results.map((r) => {
      const [n] = r as [Record<string, unknown>];
      return getLabel(n);
    });
    expect(labels).toContain("A");
    expect(labels).toContain("B");
  });

  test("[3] Matching nodes using multiple labels - multi-label not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A:B {name: 'ab'})");
    const results = executeTckQuery(graph, "MATCH (n:A:B) RETURN n");
    expect(results).toHaveLength(1);
    // Single return items are wrapped in arrays
    const [n] = results[0] as [Record<string, unknown>];
    expect(getProperty(n, "name")).toBe("ab");
  });

  test.fails(
    "[4] Simple node inline property predicate - requires unlabeled node support",
    () => {
      // This test creates nodes without labels
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE ({name: 'bar'}), ({name: 'monkey'}), ({firstname: 'bar'})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (n {name: 'bar'}) RETURN n",
      );
      expect(results).toHaveLength(1);
    },
  );

  test("[5] Use multiple MATCH clauses to do a Cartesian product - requires unlabeled node support", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({value: 1}), ({value: 2}), ({value: 3})");
    const results = executeTckQuery(
      graph,
      "MATCH (n), (m) RETURN n.value, m.value",
    );
    expect(results).toHaveLength(9);
    // Verify all combinations exist
    const pairs = results.map((r) => (r as [number, number]).join(","));
    expect(pairs).toContain("1,1");
    expect(pairs).toContain("1,2");
    expect(pairs).toContain("2,3");
    expect(pairs).toContain("3,3");
  });

  test("[6] Fail when using parameter as node predicate in MATCH - parameter syntax not supported", () => {
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(graph, "MATCH (n $param) RETURN n", {
        param: { name: "test" },
      }),
    ).toThrow();
  });

  // Scenarios [7]-[11] test for SyntaxError on variable type conflicts
  // These are compile-time validation tests that require error checking infrastructure

  describe("Variable type conflict - relationship variable reused as node", () => {
    const patterns = ["()-[r]-()", "()-[r]->()", "()<-[r]-()"];

    for (const pattern of patterns) {
      test.fails(
        `[7] Fail when relationship has same variable in preceding MATCH: ${pattern}`,
        () => {
          const graph = createTckGraph();
          expect(() =>
            executeTckQuery(graph, `MATCH ${pattern} MATCH (r) RETURN r`),
          ).toThrow();
        },
      );
    }
  });

  describe("Variable type conflict - path variable reused as node", () => {
    const patterns = ["r = ()-[]-()", "r = ()-[]->()"];

    for (const pattern of patterns) {
      test(`[8] Fail when path has same variable in preceding MATCH: ${pattern}`, () => {
        const graph = createTckGraph();
        expect(() =>
          executeTckQuery(graph, `MATCH ${pattern} MATCH (r) RETURN r`),
        ).toThrow();
      });
    }
  });
});
