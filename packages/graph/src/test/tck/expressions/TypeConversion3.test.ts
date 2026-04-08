/**
 * TCK TypeConversion3 - To Float
 * Translated from tmp/tck/features/expressions/typeConversion/TypeConversion3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("TypeConversion3 - To Float", () => {
  // Original TCK tests require list comprehension and WITH...MATCH chaining

  test("[1] toFloat() on mixed number types", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [3.4, 3] AS numbers RETURN [n IN numbers | toFloat(n)] AS float_numbers",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([3.4, 3.0]);
  });

  test("[1b] toFloat() on integer literal", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toFloat(42) AS f");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(42.0);
  });

  test("[1c] toFloat() on float literal", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toFloat(3.14) AS f");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeCloseTo(3.14, 5);
  });

  test("[1d] toFloat() on string literal", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toFloat('3.14') AS f");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeCloseTo(3.14, 5);
  });

  test("[1e] toFloat() on invalid string returns null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toFloat('abc') AS f");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test.fails("[2] toFloat() returning null on non-numerical string - WITH multiple vars not supported", () => {
    // Original: WITH 'foo' AS foo_string, '' AS empty_string
    //           RETURN toFloat(foo_string) AS foo, toFloat(empty_string) AS empty
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH 'foo' AS foo_string, '' AS empty_string RETURN toFloat(foo_string) AS foo, toFloat(empty_string) AS empty",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ foo: null, empty: null });
  });

  test("[3] toFloat() handling Any type", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [3.4, 3, '5'] AS numbers RETURN [n IN numbers | toFloat(n)] AS float_numbers",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([3.4, 3.0, 5.0]);
  });

  test("[4] toFloat() on a list of strings", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH ['1', '2', 'foo'] AS numbers RETURN [n IN numbers | toFloat(n)] AS float_numbers",
    );
    expect(results).toHaveLength(1);
    // 'foo' returns null
    expect(results[0]).toEqual([1.0, 2.0, null]);
  });

  test("[5] toFloat() on node property via WITH...MATCH chaining", () => {
    // Original: MATCH (m:Movie { rating: 4 }) WITH * MATCH (n) RETURN toFloat(n.rating) AS float
    // Adapted to use labeled nodes and explicit variable passing
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Movie {rating: 4})");
    executeTckQuery(graph, "CREATE (:Other {rating: 5})");

    // WITH...MATCH chaining works with explicit variable passing
    const results = executeTckQuery(
      graph,
      "MATCH (m:Movie) WITH m MATCH (n:Other) RETURN toFloat(n.rating) AS f",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(5.0);
  });

  test("[6] toFloat() on boolean in list comprehension", () => {
    // toFloat() returns null for invalid types like boolean
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [1.0, true] | toFloat(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[6] toFloat() on list in list comprehension", () => {
    // toFloat() returns null for invalid types like list
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [1.0, []] | toFloat(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[6] toFloat() on map in list comprehension", () => {
    // toFloat() returns null for invalid types like map
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [1.0, {}] | toFloat(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[6] toFloat() on node in list comprehension", () => {
    // toFloat() returns null for invalid types like node
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [1.0, n] | toFloat(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[6] toFloat() on relationship in list comprehension", () => {
    // toFloat() returns null for invalid types like relationship
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [1.0, r] | toFloat(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[6] toFloat() on path in list comprehension", () => {
    // toFloat() returns null for invalid types like path
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [1.0, p] | toFloat(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  // Custom tests demonstrating toFloat() works in WHERE clause

  test("[Custom 1] toFloat() works in WHERE clause on string property", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {numStr: '3.14'}), (:A {numStr: '2.71'}), (:A {numStr: '1.0'})`,
    );

    // Filter using toFloat() comparison
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE toFloat(n.numStr) > 2.5 RETURN n.numStr`,
    );

    expect(results).toHaveLength(2);
    expect(results).toContain("3.14");
    expect(results).toContain("2.71");
  });

  test("[Custom 2] toFloat() converts integer to float in WHERE", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {num: 5, name: 'a'}), (:A {num: 10, name: 'b'})`);

    // toFloat() on integer returns float value
    const results = executeTckQuery(graph, `MATCH (n:A) WHERE toFloat(n.num) = 5.0 RETURN n.name`);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test("[Custom 3] toFloat() returns null for non-numeric strings", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {val: 'abc', name: 'invalid'}), (:A {val: '3.14', name: 'valid'})`,
    );

    // Non-numeric string returns null, which won't match > 0
    const results = executeTckQuery(graph, `MATCH (n:A) WHERE toFloat(n.val) > 0 RETURN n.name`);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("valid");
  });

  test("[Custom 4] toFloat() on float returns same value", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {num: 3.14, name: 'pi'}), (:A {num: 2.71, name: 'e'})`);

    const results = executeTckQuery(graph, `MATCH (n:A) WHERE toFloat(n.num) > 3.0 RETURN n.name`);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("pi");
  });

  test("[Custom 5] toFloat() handles negative numbers", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {numStr: '-3.5', name: 'neg'}), (:A {numStr: '3.5', name: 'pos'})`,
    );

    const results = executeTckQuery(graph, `MATCH (n:A) WHERE toFloat(n.numStr) < 0 RETURN n.name`);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("neg");
  });

  test("[Custom 6] toFloat() handles scientific notation strings", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {numStr: '1e3', name: 'thousand'}), (:A {numStr: '1e-3', name: 'milli'})`,
    );

    const results = executeTckQuery(graph, `MATCH (n:A) WHERE toFloat(n.numStr) > 1 RETURN n.name`);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("thousand");
  });

  // toFloatOrNull tests
  test("[Custom 7] toFloatOrNull() converts string to float", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toFloatOrNull('3.14') AS f");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeCloseTo(3.14, 5);
  });

  test("[Custom 8] toFloatOrNull() returns null for invalid string", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toFloatOrNull('abc') AS f");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test("[Custom 9] toFloatOrNull() returns null for boolean (unlike toInteger)", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toFloatOrNull(true) AS f");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });
});
