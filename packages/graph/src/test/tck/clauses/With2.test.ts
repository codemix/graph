/**
 * TCK With2 - Forward single expression
 * Translated from tmp/tck/features/clauses/with/With2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("With2 - Forward single expression", () => {
  test("[1] Forwarding a property to express a join", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Begin {num: 42})");
    executeTckQuery(graph, "CREATE (:End {id: 42})");
    executeTckQuery(graph, "CREATE (:End {id: 100})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:Begin) WITH a.num AS property MATCH (b:End) WHERE b.id = property RETURN b",
    );
    expect(results.length).toBe(1);
    const b = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(b).toBeDefined();
  });

  test("[2] Forwarding a nested map literal", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: {name2: 'baz'}} AS nestedMap RETURN nestedMap.name.name2",
    );
    expect(results).toEqual(["baz"]);
  });

  // Custom tests for supported WITH expression patterns
  test("[custom-1] WITH forwarding property expression", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 42})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a.num AS num RETURN num",
    );
    expect(results.length).toBe(1);
    // Single RETURN item with WITH may be wrapped
    const val = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(val).toBe(42);
  });

  test("[custom-2] WITH forwarding property with alias", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Alice'})");
    executeTckQuery(graph, "CREATE (:A {name: 'Bob'})");

    // ORDER BY alias not supported, use ORDER BY property expression
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a.name AS personName RETURN personName",
    );
    expect(results.length).toBe(2);
    // Extract values (may be wrapped)
    const names = results.map((r) => (Array.isArray(r) ? r[0] : r)).sort();
    expect(names).toEqual(["Alice", "Bob"]);
  });
});
