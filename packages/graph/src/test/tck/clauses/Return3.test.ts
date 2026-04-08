/**
 * TCK Return3 - Return multiple expressions (if column order correct)
 * Translated from tmp/tck/features/clauses/return/Return3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel, getType } from "../tckHelpers.js";

describe("Return3 - Return multiple expressions", () => {
  test("[1] Returning multiple expressions - unlabeled nodes not supported", () => {
    // Query: MATCH (a) RETURN a.id IS NOT NULL AS a, a IS NOT NULL AS b
    // Expected: false, true
    // Our schema requires all nodes to have labels
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    const results = executeTckQuery(
      graph,
      "MATCH (a) RETURN a.id IS NOT NULL AS a, a IS NOT NULL AS b",
    );
    expect(results).toHaveLength(1);
    const [a, b] = results[0] as [boolean, boolean];
    expect(a).toBe(false);
    expect(b).toBe(true);
  });

  test("[custom] Returning multiple expressions with labeled node - IS NOT NULL syntax not supported", () => {
    // Query: MATCH (a:A) RETURN a.id IS NOT NULL AS x, a IS NOT NULL AS y
    // IS NOT NULL syntax in RETURN may not be supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) RETURN a.id IS NOT NULL AS x, a IS NOT NULL AS y",
    );
    expect(results).toHaveLength(1);
    const [x, y] = results[0] as [boolean, boolean];
    expect(x).toBe(false);
    expect(y).toBe(true);
  });

  test("[2] Returning multiple node property values - unlabeled nodes not supported", () => {
    // Given: CREATE ({name: 'Philip J. Fry', age: 2046, seasons: [1, 2, 3, 4, 5, 6, 7]})
    // Query: MATCH (a) RETURN a.name, a.age, a.seasons
    // Expected: 'Philip J. Fry', 2046, [1, 2, 3, 4, 5, 6, 7]
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE ({name: 'Philip J. Fry', age: 2046, seasons: [1, 2, 3, 4, 5, 6, 7]})",
    );
    const results = executeTckQuery(graph, "MATCH (a) RETURN a.name, a.age, a.seasons");
    expect(results).toHaveLength(1);
    const [name, age, seasons] = results[0] as [string, number, number[]];
    expect(name).toBe("Philip J. Fry");
    expect(age).toBe(2046);
    expect(seasons).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test("[custom] Returning multiple node property values with labeled node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Person {name: 'Philip J. Fry', age: 2046})");

    const results = executeTckQuery(graph, "MATCH (a:Person) RETURN a.name, a.age");
    expect(results).toHaveLength(1);
    const [name, age] = results[0] as [string, number];
    expect(name).toBe("Philip J. Fry");
    expect(age).toBe(2046);
  });

  test("[3] Projecting nodes and relationships", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B)");
    executeTckQuery(graph, "MATCH (a:A), (b:B) CREATE (a)-[:T]->(b)");

    const results = executeTckQuery(graph, "MATCH (a:A)-[r:T]->(:B) RETURN a AS foo, r AS bar");
    expect(results).toHaveLength(1);
    const [foo, bar] = results[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(getLabel(foo)).toBe("A");
    expect(getType(bar)).toBe("T");
  });
});
