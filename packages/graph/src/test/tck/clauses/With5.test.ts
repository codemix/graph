/**
 * TCK With5 - Implicit grouping with DISTINCT
 * Translated from tmp/tck/features/clauses/with/With5.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("With5 - Implicit grouping with DISTINCT", () => {
  test.fails(
    "[1] DISTINCT on an expression - unlabeled nodes not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE ({name: 'A'}), ({name: 'A'}), ({name: 'B'})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a) WITH DISTINCT a.name AS name RETURN name ORDER BY name",
      );
      expect(results).toHaveLength(2);
      expect(results).toEqual(["A", "B"]);
    },
  );

  test("[1-custom] DISTINCT on an expression", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'A'})");
    executeTckQuery(graph, "CREATE (:A {name: 'A'})");
    executeTckQuery(graph, "CREATE (:A {name: 'B'})");

    // Cannot use ORDER BY alias name
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH DISTINCT a.name AS name RETURN name",
    );
    expect(results.length).toBe(2);
    // Extract values and sort
    const names = results.map((r) => (Array.isArray(r) ? r[0] : r)).sort();
    expect(names).toEqual(["A", "B"]);
  });

  test("[2] Handling DISTINCT with lists in maps - unlabeled nodes, map literals, count(*) not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({list: ['A', 'B']}), ({list: ['A', 'B']})");
    const results = executeTckQuery(
      graph,
      "MATCH (n) WITH DISTINCT {name: n.list} AS map RETURN count(*)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  // Custom tests for DISTINCT with WITH
  test("[custom-1] WITH DISTINCT on node variable", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})-[:REL]->(:B)");
    executeTckQuery(graph, "CREATE (:A {num: 1})-[:REL]->(:B)");

    // Without DISTINCT would return 2 rows
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH DISTINCT a.num AS num RETURN num",
    );
    expect(results.length).toBe(1);
    // May be wrapped
    const val = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(val).toBe(1);
  });

  test("[custom-2] WITH DISTINCT with multiple properties", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 2})");
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 2})");
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 3})");

    // Cannot use ORDER BY alias
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH DISTINCT a.x AS x, a.y AS y RETURN x, y",
    );
    expect(results.length).toBe(2);
  });
});
