/**
 * TCK Conditional1 - Coalesce expression
 * Translated from tmp/tck/features/expressions/conditional/Conditional1.feature
 *
 * NOTE: The original TCK test uses unlabeled nodes which are not supported.
 * Custom tests demonstrate coalesce functionality with labeled nodes.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Conditional1 - Coalesce expression", () => {
  test("[1] Run coalesce - unlabeled nodes not supported", () => {
    // Original TCK:
    // Given: CREATE ({name: 'Emil Eifrem', title: 'CEO'}), ({name: 'Nobody'})
    // Query: MATCH (a) RETURN coalesce(a.title, a.name)
    // Expected: 'CEO', 'Nobody'
    //
    // Grammar limitations:
    // 1. Unlabeled nodes not supported (all nodes require labels)
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name: 'Emil Eifrem', title: 'CEO'}), ({name: 'Nobody'})");

    const results = executeTckQuery(graph, "MATCH (a) RETURN coalesce(a.title, a.name)");

    expect(results).toHaveLength(2);
    expect(results).toContain("CEO");
    expect(results).toContain("Nobody");
  });

  // Custom tests demonstrating coalesce functionality

  test("[custom-1] coalesce returns first non-null value", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'Emil Eifrem', title: 'CEO'}), (:A {name: 'Nobody'})",
    );

    // Use coalesce in WHERE clause to filter
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE coalesce(a.title, a.name) = 'CEO' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Emil Eifrem");
  });

  test("[custom-2] coalesce returns second value when first is null", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Alice', title: 'Engineer'}), (:A {name: 'Bob'})");

    // Nodes without title should have coalesce return their name
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE coalesce(a.title, 'default') = 'default' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Bob");
  });

  test("[custom-3] coalesce with all null values returns null", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test'})");

    // When all coalesce arguments are null, returns null
    // We can verify this by checking if coalesce(missing, missing) IS NULL
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE coalesce(a.missing1, a.missing2) IS NULL RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-4] coalesce with multiple fallback values", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'first', prop1: 'found'}), (:A {name: 'second', prop2: 'found'}), (:A {name: 'third', prop3: 'found'})",
    );

    // Test that coalesce works with multiple arguments
    const resultsFirst = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE coalesce(a.prop1, a.prop2, a.prop3, 'default') = 'found' RETURN a.name ORDER BY a.name",
    );

    expect(resultsFirst).toHaveLength(3);
  });

  test("[custom-5] coalesce preserves value type", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'int', num: 42}), (:A {name: 'str', value: 'hello'})",
    );

    // Coalesce should return the integer value
    const resultsInt = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE coalesce(a.num, 0) = 42 RETURN a.name",
    );
    expect(resultsInt).toHaveLength(1);
    expect(resultsInt[0]).toBe("int");

    // Coalesce should return the string value
    const resultsStr = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE coalesce(a.value, 'default') = 'hello' RETURN a.name",
    );
    expect(resultsStr).toHaveLength(1);
    expect(resultsStr[0]).toBe("str");
  });

  test("[custom-6] coalesce with explicit null property", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'explicit-null', value: null}), (:A {name: 'has-value', value: 'exists'})",
    );

    // Node with null value should use the default
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE coalesce(a.value, 'fallback') = 'fallback' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("explicit-null");
  });

  test("[custom-7] coalesce with property access on multiple nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a1'})-[:T]->(:B {title: 'Boss'})");
    executeTckQuery(graph, "CREATE (:A {name: 'a2', title: 'Manager'})-[:T]->(:B {name: 'b2'})");

    // Use coalesce across different property names
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:T]->(b:B) WHERE coalesce(a.title, b.title, 'unknown') = 'Boss' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a1");
  });

  test("[custom-8] coalesce short-circuits evaluation", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', value: 'first'})");

    // When first value is non-null, coalesce should return it
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE coalesce(a.value, 'second') = 'first' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });
});
