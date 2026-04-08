/**
 * TCK Graph7 - Dynamic property access
 * Translated from tmp/tck/features/expressions/graph/Graph7.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Graph7 - Dynamic property access", () => {
  test.fails("[1] Execute n['name'] in read queries - dynamic property access not supported", () => {
    // Original TCK:
    // CREATE ({name: 'Apa'})
    // MATCH (n {name: 'Apa'}) RETURN n['nam' + 'e'] AS value
    // Expected: 'Apa'
    //
    // Limitations:
    // - Unlabeled nodes not supported
    // - Dynamic property access syntax (n['key']) not supported
    // - String concatenation in property key expression not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name: 'Apa'})");
    const results = executeTckQuery(
      graph,
      "MATCH (n {name: 'Apa'}) RETURN n['nam' + 'e'] AS value",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Apa");
  });

  test.fails("[2] Execute n['name'] in update queries - dynamic property access not supported", () => {
    // Original TCK:
    // CREATE (n {name: 'Apa'}) RETURN n['nam' + 'e'] AS value
    //
    // Limitations:
    // - Unlabeled nodes not supported
    // - Dynamic property access syntax not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE (n {name: 'Apa'}) RETURN n['nam' + 'e'] AS value",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Apa");
  });

  test.fails("[3] Use dynamic property lookup based on parameters - parameters not supported", () => {
    // Original TCK:
    // Parameters: idx = 'name'
    // CREATE (n {name: 'Apa'}) RETURN n[$idx] AS value
    //
    // Limitations:
    // - Unlabeled nodes not supported
    // - Parameter syntax ($idx) not supported
    // - Dynamic property access not supported
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CREATE (n {name: 'Apa'}) RETURN n[$idx] AS value", {
      idx: "name",
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Apa");
  });

  // Custom tests - since dynamic property access is not supported,
  // we demonstrate static property access as the alternative

  test("[Custom 1] Static property access works as alternative", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Apa'})`);

    const results = executeTckQuery(graph, "MATCH (n:A {name: 'Apa'}) RETURN n.name");

    expect(results).toHaveLength(1);
    // Single return item comes back directly
    expect(results[0]).toBe("Apa");
  });

  test("[Custom 2] Static property access in CREATE and RETURN", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CREATE (n:A {name: 'Test'}) RETURN n.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Test");
  });

  test("[Custom 3] Multiple property access", () => {
    const graph = createTckGraph();
    // Using 'foo' and 'bar' instead of 'first' and 'second' since FIRST is a reserved keyword
    executeTckQuery(graph, `CREATE (:A {foo: 'Hello', bar: 'World'})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.foo, n.bar");

    expect(results).toHaveLength(1);
    const [foo, bar] = results[0] as [string, string];
    expect(foo).toBe("Hello");
    expect(bar).toBe("World");
  });
});
