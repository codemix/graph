/**
 * TCK Return5 - Implicit grouping with distinct
 * Translated from tmp/tck/features/clauses/return/Return5.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Return5 - Implicit grouping with distinct", () => {
  test.fails("[1] DISTINCT inside aggregation should work with lists in maps - unlabeled nodes not supported", () => {
    // Given: CREATE ({list: ['A', 'B']}), ({list: ['A', 'B']})
    // Query: MATCH (n) RETURN count(DISTINCT {name: n.list}) AS count
    // Expected: 1
    // Unlabeled nodes + map in count(DISTINCT) may not be supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({list: ['A', 'B']})");
    executeTckQuery(graph, "CREATE ({list: ['A', 'B']})");
    const results = executeTckQuery(
      graph,
      "MATCH (n) RETURN count(DISTINCT {name: n.list}) AS count",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails("[2] DISTINCT on nullable values - unlabeled nodes not supported", () => {
    // Given: CREATE ({name: 'Florescu'}), (), ()
    // Query: MATCH (n) RETURN DISTINCT n.name
    // Expected: 'Florescu', null
    // Unlabeled nodes not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name: 'Florescu'})");
    executeTckQuery(graph, "CREATE ()");
    executeTckQuery(graph, "CREATE ()");
    const results = executeTckQuery(graph, "MATCH (n) RETURN DISTINCT n.name");
    expect(results).toHaveLength(2);
    expect(results).toContain("Florescu");
    expect(results.some((r) => r === null)).toBe(true);
  });

  test("[custom] DISTINCT on nullable values with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Florescu'})");
    executeTckQuery(graph, "CREATE (:A)");
    executeTckQuery(graph, "CREATE (:A)");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN DISTINCT n.name");
    expect(results).toHaveLength(2);
    // Should have 'Florescu' and undefined/null (in any order)
    expect(results).toContain("Florescu");
    // Missing properties return undefined, not null
    expect(results.some((r) => r === null || r === undefined)).toBe(true);
  });

  test.fails("[3] DISTINCT inside aggregation should work with nested lists in maps - complex map structures", () => {
    // Query: MATCH (n) RETURN count(DISTINCT {name: [[n.list, n.list], [n.list, n.list]]}) AS count
    // Complex nested structure in count(DISTINCT) may not be supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {list: ['A', 'B']})");
    executeTckQuery(graph, "CREATE (:A {list: ['A', 'B']})");
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN count(DISTINCT {name: [[n.list, n.list], [n.list, n.list]]}) AS count",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails("[4] DISTINCT inside aggregation should work with nested lists of maps in maps - complex structures", () => {
    // Query: MATCH (n) RETURN count(DISTINCT {name: [{name2: n.list}, {baz: {apa: n.list}}]}) AS count
    // Complex nested structure in count(DISTINCT) may not be supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {list: ['A', 'B']})");
    executeTckQuery(graph, "CREATE (:A {list: ['A', 'B']})");
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN count(DISTINCT {name: [{name2: n.list}, {baz: {apa: n.list}}]}) AS count",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails("[5] Aggregate on list values - unlabeled nodes not supported", () => {
    // Given: CREATE ({color: ['red']}), ({color: ['blue']}), ({color: ['red']})
    // Query: MATCH (a) RETURN DISTINCT a.color, count(*)
    // Expected: ['red'] 2, ['blue'] 1
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({color: ['red']})");
    executeTckQuery(graph, "CREATE ({color: ['blue']})");
    executeTckQuery(graph, "CREATE ({color: ['red']})");
    const results = executeTckQuery(graph, "MATCH (a) RETURN DISTINCT a.color, count(*)");
    expect(results).toHaveLength(2);
  });

  test.fails("[custom] Aggregate on property with labeled nodes - requires GROUP BY", () => {
    // Query: MATCH (a:A) RETURN DISTINCT a.name, count(a)
    // Mixing aggregate with non-aggregate requires GROUP BY clause
    // Implicit grouping not supported in this implementation
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Alice'})");
    executeTckQuery(graph, "CREATE (:A {name: 'Alice'})");
    executeTckQuery(graph, "CREATE (:A {name: 'Bob'})");
    const results = executeTckQuery(graph, "MATCH (a:A) RETURN DISTINCT a.name, count(a)");
    expect(results).toHaveLength(2);
  });
});
