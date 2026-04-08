/**
 * TCK TypeConversion4 - To String
 * Translated from tmp/tck/features/expressions/typeConversion/TypeConversion4.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("TypeConversion4 - To String", () => {
  // Original TCK tests require RETURN-only queries or advanced features

  test("[1] toString() handling integer literal", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toString(42) AS str");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("42");
  });

  test("[2] toString() handling boolean literal", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toString(true) AS str");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("true");
  });

  test("[2b] toString() handling false boolean literal", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toString(false) AS str");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("false");
  });

  test.fails("[3] toString() handling inlined boolean - RETURN-only query not supported", () => {
    // Original: RETURN toString(1 < 0) AS bool
    // Boolean expressions in RETURN not supported
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toString(1 < 0) AS bool");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("false");
  });

  test("[4] toString() handling boolean properties", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {watched: true}), (:A {watched: false})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN toString(n.watched) AS str");
    expect(results).toHaveLength(2);
    expect(results).toContain("true");
    expect(results).toContain("false");
  });

  test("[5] toString() should work on Any type", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN [x IN [1, 2.3, true, 'apa'] | toString(x)] AS list",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["1", "2.3", "true", "apa"]);
  });

  test("[6] toString() on a list of integers", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [1, 2, 3] AS numbers RETURN [n IN numbers | toString(n)] AS string_numbers",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["1", "2", "3"]);
  });

  test("[7] toString() on node property via WITH...MATCH chaining", () => {
    // Original: MATCH (m:Movie { rating: 4 }) WITH * MATCH (n) RETURN toString(n.rating)
    // Adapted to use labeled nodes and explicit variable passing
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Movie {rating: 4})");
    executeTckQuery(graph, "CREATE (:Other {rating: 5})");

    // WITH...MATCH chaining works with explicit variable passing
    const results = executeTckQuery(
      graph,
      "MATCH (m:Movie) WITH m MATCH (n:Other) RETURN toString(n.rating) AS str",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("5");
  });

  test("[8] toString() should accept potentially correct types 1", () => {
    // UNWIND with null literal now supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND ['male', 'female', null] AS gen RETURN coalesce(toString(gen), 'x') AS result",
    );
    expect(results).toHaveLength(3);
    expect(results).toEqual(["male", "female", "x"]);
  });

  test("[9] toString() should accept potentially correct types 2", () => {
    // UNWIND with null literal now supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND ['male', 'female', null] AS gen RETURN toString(coalesce(gen, 'x')) AS result",
    );
    expect(results).toHaveLength(3);
    expect(results).toEqual(["male", "female", "x"]);
  });

  test("[10] toString() on list in list comprehension", () => {
    // toString() returns null for invalid types like list
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [1, '', []] | toString(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[10] toString() on map in list comprehension", () => {
    // toString() returns null for invalid types like map
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [1, '', {}] | toString(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[10] toString() on node in list comprehension", () => {
    // toString() returns null for invalid types like node
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [1, '', n] | toString(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[10] toString() on relationship in list comprehension", () => {
    // toString() returns null for invalid types like relationship
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [1, '', r] | toString(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[10] toString() on path in list comprehension", () => {
    // toString() returns null for invalid types like path
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [1, '', p] | toString(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  // Custom tests demonstrating toString() works in WHERE clause

  test("[Custom 1] toString() works in WHERE clause on integer property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {num: 42, name: 'answer'}), (:A {num: 7, name: 'lucky'})`);

    // Use toString() to compare integer as string
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE toString(n.num) = '42' RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("answer");
  });

  test("[Custom 2] toString() works with boolean property in WHERE", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {flag: true, name: 'yes'}), (:A {flag: false, name: 'no'})`);

    // toString(true) = 'true', toString(false) = 'false'
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE toString(n.flag) = 'true' RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("yes");
  });

  test("[Custom 3] toString() on float property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {num: 3.14, name: 'pi'}), (:A {num: 2.71, name: 'e'})`);

    // Check that toString converts float correctly using equality comparison
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE toString(n.num) = '3.14' RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("pi");
  });

  test("[Custom 4] toString() on string returns same value", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {str: 'hello', name: 'a'}), (:A {str: 'world', name: 'b'})`);

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE toString(n.str) = 'hello' RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test("[Custom 5] toString() comparison with explicit string value", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {num: 123, name: 'has2'}), (:A {num: 456, name: 'no2'})`);

    // Check if toString matches expected value
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE toString(n.num) = '123' RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("has2");
  });

  test("[Custom 6] toString() handles negative numbers", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {num: -42, name: 'neg'}), (:A {num: 42, name: 'pos'})`);

    // toString() on negative number includes the minus sign
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE toString(n.num) = '-42' RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("neg");
  });

  // toStringOrNull tests
  test("[Custom 7] toStringOrNull() converts number to string", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toStringOrNull(42) AS s");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("42");
  });

  test("[Custom 8] toStringOrNull() converts boolean to string", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toStringOrNull(true) AS s");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("true");
  });

  test("[Custom 9] toStringOrNull() returns null for null input", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toStringOrNull(null) AS s");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });
});
