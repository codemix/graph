/**
 * TCK Literals1 - Boolean and Null
 * Translated from tmp/tck/features/expressions/literals/Literals1.feature
 *
 * NOTE: Original TCK tests use RETURN-only queries (e.g., `RETURN true AS literal`)
 * which are not supported in the grammar. Queries must start with MATCH, CREATE, etc.
 * Custom tests demonstrate boolean and null literal functionality in supported contexts.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Literals1 - Boolean and Null", () => {
  // TCK tests for boolean and null literals

  test("[1] Return a boolean true lower case", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN true AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[2] Return a boolean true upper case", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN TRUE AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[3] Return a boolean false lower case", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN false AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[4] Return a boolean false upper case", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN FALSE AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[5] Return null lower case", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN null AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test("[6] Return null upper case", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN NULL AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  // Custom tests demonstrating boolean and null literals in supported contexts

  test("[custom-1] Boolean true in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a1', flag: true}), (:A {name: 'a2', flag: false})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.flag = true RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a1");
  });

  test("[custom-2] Boolean false in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a1', flag: true}), (:A {name: 'a2', flag: false})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.flag = false RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a2");
  });

  test("[custom-3] Boolean true in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', active: true})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.active = true RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-4] Boolean false in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', active: false})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.active = false RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-5] null literal in WHERE clause with IS NULL", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'has-value', value: 'exists'}), (:A {name: 'no-value'})",
    );

    // Node without 'value' property has null value
    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.value IS NULL RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("no-value");
  });

  test("[custom-6] null literal in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', value: null})");

    // Property set to null should match IS NULL
    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.value IS NULL RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-7] Boolean true case insensitive (TRUE)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', flag: TRUE})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.flag = true RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-8] Boolean false case insensitive (FALSE)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', flag: FALSE})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.flag = false RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-9] Using UNWIND with boolean values", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(graph, "UNWIND [true, false, true] AS val RETURN val");

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([true]);
    expect(results[1]).toEqual([false]);
    expect(results[2]).toEqual([true]);
  });

  test("[custom-10] Filtering by boolean NOT", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a1', flag: true}), (:A {name: 'a2', flag: false})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE NOT a.flag = true RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a2");
  });
});
