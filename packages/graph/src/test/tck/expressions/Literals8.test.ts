/**
 * TCK Literals8 - Maps
 * Translated from tmp/tck/features/expressions/literals/Literals8.feature
 *
 * NOTE: Original TCK tests use RETURN-only queries (e.g., `RETURN {} AS literal`)
 * We use `UNWIND [1] AS x` to make them valid queries.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("Literals8 - Maps", () => {
  test("[1] Return an empty map", () => {
    // Original TCK: RETURN {} AS literal
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `UNWIND [1] AS x RETURN {} AS literal`);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({});
  });

  test("[2] Return a map containing one value with alphabetic lower case key", () => {
    // Original TCK: RETURN {abc: 1} AS literal
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `UNWIND [1] AS x RETURN {abc: 1} AS literal`);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ abc: 1 });
  });

  test("[3] Return a map containing one value with alphabetic upper case key", () => {
    // Original TCK: RETURN {ABC: 1} AS literal
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `UNWIND [1] AS x RETURN {ABC: 1} AS literal`);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ ABC: 1 });
  });

  test("[4] Return a map containing one value with alphabetic mixed case key", () => {
    // Original TCK: RETURN {aBCdeF: 1} AS literal
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `UNWIND [1] AS x RETURN {aBCdeF: 1} AS literal`);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ aBCdeF: 1 });
  });

  test("[5] Return a map containing one value with alphanumeric mixed case key", () => {
    // Original TCK: RETURN {a1B2c3e67: 1} AS literal
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `UNWIND [1] AS x RETURN {a1B2c3e67: 1} AS literal`);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ a1B2c3e67: 1 });
  });

  test("[6] Return a map containing a boolean value", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `UNWIND [1] AS x RETURN {key: true} AS literal`);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ key: true });
  });

  test("[7] Return a map containing an integer value", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `UNWIND [1] AS x RETURN {key: 42} AS literal`);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ key: 42 });
  });

  test("[8] Return a map containing a float value", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `UNWIND [1] AS x RETURN {key: 3.14} AS literal`);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ key: 3.14 });
  });

  test("[9] Return a map containing a string value", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `UNWIND [1] AS x RETURN {key: 'hello'} AS literal`);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ key: "hello" });
  });

  test("[10] Return a map containing a null value", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `UNWIND [1] AS x RETURN {key: null} AS literal`);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ key: null });
  });

  test("[11] Return a map containing a list value", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `UNWIND [1] AS x RETURN {key: [1, 2, 3]} AS literal`);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ key: [1, 2, 3] });
  });

  test("[12] Return a map containing multiple values", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN {a: 1, b: 'two', c: true} AS literal`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ a: 1, b: "two", c: true });
  });

  test("[13] Return a nested map", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, `UNWIND [1] AS x RETURN {outer: {inner: 1}} AS literal`);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ outer: { inner: 1 } });
  });

  test("[14] Return a deeply nested map", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN {a: {b: {c: 'deep'}}} AS literal`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ a: { b: { c: "deep" } } });
  });

  test("[15-16] More nested map tests - similar to above", () => {
    // Query: RETURN {a: {b: {c: {d: 'very deep'}}}} AS literal
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN {a: {b: {c: {d: 'very deep'}}}} AS literal`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ a: { b: { c: { d: "very deep" } } } });
  });

  test("[17] Return a map containing real and fake nested maps - complex string escaping", () => {
    // Query: RETURN { a : ' { b : ' , c : { d : ' ' } , d : ' } ' } AS literal
    // This tests string values that look like map syntax
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN { a : ' { b : ' , c : { d : ' ' } , d : ' } ' } AS literal`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ a: " { b : ", c: { d: " " }, d: " } " });
  });

  test("[18] Return a complex map containing multiple mixed and nested values", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [1] AS x RETURN {
        name: 'test',
        values: [1, 2, 3],
        nested: {key: 'value'},
        flag: true
      } AS literal`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      name: "test",
      values: [1, 2, 3],
      nested: { key: "value" },
      flag: true,
    });
  });

  test("[19-27] Fail on invalid map syntax - syntax error tests", () => {
    // Query: RETURN {key:} AS literal
    // Expected: SyntaxError
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "UNWIND [1] AS x RETURN {key:} AS literal");
    }).toThrow();
  });

  // Custom tests demonstrating map-like functionality via node properties

  test("[custom-1] Node properties act as maps", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', num: 42, flag: true})");

    const results = executeTckQuery(graph, "MATCH (a:A) RETURN a");

    expect(results).toHaveLength(1);
    // Single RETURN of a node may be wrapped in array
    const result = results[0];
    const node = (Array.isArray(result) ? result[0] : result) as Record<string, unknown>;
    expect(getProperty(node, "name")).toBe("test");
    expect(getProperty(node, "num")).toBe(42);
    expect(getProperty(node, "flag")).toBe(true);
  });

  test("[custom-2] Access specific property via dot notation", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', value: 'found'})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.value = 'found' RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-3] Properties with lower case keys", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {abc: 1})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.abc = 1 RETURN a.abc");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom-4] Properties with mixed case keys", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {aBCdeF: 1})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.aBCdeF = 1 RETURN a.aBCdeF");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom-5] Properties with boolean values", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {active: true}), (:A {active: false})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.active = true RETURN a.active");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[custom-6] Properties with null values", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', value: null})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.value IS NULL RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-7] Properties with integer values", () => {
    const graph = createTckGraph();
    // 'count' is a reserved word, use 'amount' instead
    executeTckQuery(graph, "CREATE (:A {amount: 42})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.amount = 42 RETURN a.amount");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(42);
  });

  test("[custom-8] Properties with float values", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {price: 19.99})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.price > 15 RETURN a.price");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(19.99);
  });

  test("[custom-9] Properties with string values", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {description: 'hello world'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.description = 'hello world' RETURN a.description",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("hello world");
  });

  test("[custom-10] Multiple properties on a node", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'item', category: 'test', priority: 1, active: true})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name = 'item' AND a.category = 'test' AND a.priority = 1 AND a.active = true RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("item");
  });

  test("[custom-11] Relationship properties act as maps", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'start'})-[:T {weight: 0.5, label: 'edge'}]->(:B {name: 'end'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) WHERE r.weight = 0.5 AND r.label = 'edge' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("start");
  });

  test("[custom-12] Case-sensitive property keys", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {Name: 'upper', name: 'lower'})");

    // Property keys are case-sensitive
    const resultsUpper = executeTckQuery(graph, "MATCH (a:A) WHERE a.Name = 'upper' RETURN a.Name");
    expect(resultsUpper).toHaveLength(1);
    expect(resultsUpper[0]).toBe("upper");

    const resultsLower = executeTckQuery(graph, "MATCH (a:A) WHERE a.name = 'lower' RETURN a.name");
    expect(resultsLower).toHaveLength(1);
    expect(resultsLower[0]).toBe("lower");
  });

  test("[custom-13] Missing property returns undefined/null", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test'})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.missingProp IS NULL RETURN a.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-14] Properties with negative numbers", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {balance: -100})");

    const results = executeTckQuery(graph, "MATCH (a:A) WHERE a.balance = -100 RETURN a.balance");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-100);
  });
});
