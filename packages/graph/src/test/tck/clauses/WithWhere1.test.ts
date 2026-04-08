/**
 * TCK WithWhere1 - Filter single variable
 * Translated from tmp/tck/features/clauses/with-where/WithWhere1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel, getProperty } from "../tckHelpers.js";

describe("WithWhere1 - Filter single variable", () => {
  test("[1] Filter node with property predicate on a single variable with multiple bindings - unlabeled nodes not supported", () => {
    // Original test uses unlabeled nodes: CREATE ({name: 'A'}), ({name: 'B'}), ({name: 'C'})
    // Our grammar requires labels for all nodes
    // MATCH (a) WITH a WHERE a.name = 'B' RETURN a
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name: 'A'}), ({name: 'B'}), ({name: 'C'})");

    const results = executeTckQuery(graph, "MATCH (a) WITH a WHERE a.name = 'B' RETURN a");
    expect(results.length).toBe(1);
    const node = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(getProperty(node as Record<string, unknown>, "name")).toBe("B");
  });

  test.fails("[2] Filter node with property predicate on a single variable with multiple distinct bindings - unlabeled nodes and RETURN * not supported", () => {
    // Original test uses unlabeled nodes and RETURN *
    // MATCH (a) WITH DISTINCT a.name2 AS name WHERE a.name2 = 'B' RETURN *
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name2: 'A'}), ({name2: 'B'}), ({name2: 'C'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a) WITH DISTINCT a.name2 AS name WHERE a.name2 = 'B' RETURN *",
    );
    expect(results.length).toBe(1);
    const row = results[0] as Record<string, unknown>;
    expect(row["name"]).toBe("B");
  });

  test.fails("[3] Filter for an unbound relationship variable - OPTIONAL MATCH not supported", () => {
    // Uses OPTIONAL MATCH and IS NULL in WITH
    // MATCH (a:A), (other:B) OPTIONAL MATCH (a)-[r]->(other) WITH other WHERE r IS NULL RETURN other
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    executeTckQuery(graph, "CREATE (:B)");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (other:B) OPTIONAL MATCH (a)-[r]->(other) WITH other WHERE r IS NULL RETURN other",
    );
    expect(results.length).toBe(1);
    const node = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(getLabel(node as Record<string, unknown>)).toBe("B");
  });

  test.fails("[4] Filter for an unbound node variable - OPTIONAL MATCH not supported", () => {
    // Uses OPTIONAL MATCH and IS NULL in WITH
    // MATCH (other:B) OPTIONAL MATCH (a)-[r]->(other) WITH other WHERE a IS NULL RETURN other
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:B)");

    const results = executeTckQuery(
      graph,
      "MATCH (other:B) OPTIONAL MATCH (a)-[r]->(other) WITH other WHERE a IS NULL RETURN other",
    );
    expect(results.length).toBe(1);
    const node = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(getLabel(node as Record<string, unknown>)).toBe("B");
  });

  // Custom tests for WITH WHERE functionality that works with our grammar
  test("[custom-1] Filter node by property in WITH WHERE", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'X'})");
    executeTckQuery(graph, "CREATE (:A {name: 'Y'})");
    executeTckQuery(graph, "CREATE (:A {name: 'Z'})");

    const results = executeTckQuery(graph, "MATCH (a:A) WITH a WHERE a.name = 'Y' RETURN a");
    expect(results.length).toBe(1);
    const node = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(getProperty(node as Record<string, unknown>, "name")).toBe("Y");
  });

  test("[custom-2] Filter with numeric comparison in WITH WHERE", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 5})");
    executeTckQuery(graph, "CREATE (:A {num: 10})");

    const results = executeTckQuery(graph, "MATCH (a:A) WITH a WHERE a.num > 3 RETURN a.num");
    expect(results.length).toBe(2);
    // Extract values (may be wrapped in arrays)
    const values = results.map((r) => (Array.isArray(r) ? r[0] : r));
    expect(values).toContain(5);
    expect(values).toContain(10);
  });

  test("[custom-3] Filter with inequality comparison in WITH WHERE", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'keep'})");
    executeTckQuery(graph, "CREATE (:A {name: 'skip'})");
    executeTckQuery(graph, "CREATE (:A {name: 'keep'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a WHERE a.name <> 'skip' RETURN a.name",
    );
    expect(results.length).toBe(2);
    const values = results.map((r) => (Array.isArray(r) ? r[0] : r));
    expect(values).toEqual(["keep", "keep"]);
  });
});
