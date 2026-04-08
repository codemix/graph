/**
 * TCK TypeConversion1 - To Boolean
 * Translated from tmp/tck/features/expressions/typeConversion/TypeConversion1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("TypeConversion1 - To Boolean", () => {
  test("[1] toBoolean() on booleans", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [true, false] AS b RETURN toBoolean(b) AS b",
    );
    expect(results).toEqual([true, false]);
  });

  test("[1b] toBoolean() on boolean true literal", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toBoolean(true) AS b");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[1c] toBoolean() on boolean false literal", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toBoolean(false) AS b");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[2] toBoolean() on valid literal string", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toBoolean('true') AS b");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[2b] toBoolean() on 'false' string", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toBoolean('false') AS b");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[3] toBoolean() on variables with valid string values", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND ['true', 'false'] AS s RETURN toBoolean(s) AS b",
    );
    expect(results).toEqual([true, false]);
  });

  test("[4] toBoolean() on invalid strings", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [null, '', ' tru ', 'f alse'] AS things RETURN toBoolean(things) AS b",
    );
    // null, '', and invalid strings return null
    expect(results).toEqual([null, null, null, null]);
  });

  test("[4b] toBoolean() on null returns null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toBoolean(null) AS b");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test("[4c] toBoolean() on invalid string returns null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toBoolean('invalid') AS b");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test("[4d] toBoolean() on empty string returns null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toBoolean('') AS b");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test("[5] toBoolean() on list in list comprehension", () => {
    // toBoolean() returns null for invalid types like list
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [true, []] | toBoolean(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[5] toBoolean() on map in list comprehension", () => {
    // toBoolean() returns null for invalid types like map
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [true, {}] | toBoolean(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[5] toBoolean() on float in list comprehension", () => {
    // toBoolean() returns null for invalid types like float
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [true, 1.0] | toBoolean(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[5] toBoolean() on node in list comprehension", () => {
    // toBoolean() returns null for invalid types like node
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [true, n] | toBoolean(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[5] toBoolean() on relationship in list comprehension", () => {
    // toBoolean() returns null for invalid types like relationship
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [true, r] | toBoolean(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  test("[5] toBoolean() on path in list comprehension", () => {
    // toBoolean() returns null for invalid types like path
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-[r:T]->() RETURN [x IN [true, p] | toBoolean(x)] AS list",
    );
    expect(results).toHaveLength(1);
  });

  // Custom tests demonstrating boolean handling in WHERE clause

  test("[Custom 1] Boolean literals work in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {flag: true}), (:A {flag: false})`);

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE n.flag = true RETURN n.flag`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[Custom 2] Boolean strings can be compared directly", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {str: 'true'}), (:A {str: 'false'}), (:A {str: 'invalid'})`,
    );

    // Filter for nodes with string 'true'
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE n.str = 'true' RETURN n.str`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("true");
  });

  test("[Custom 3] Boolean properties filter correctly", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice', active: true}), (:A {name: 'Bob', active: false}), (:A {name: 'Charlie', active: true})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE n.active = true RETURN n.name`,
    );

    expect(results).toHaveLength(2);
    expect(results).toContain("Alice");
    expect(results).toContain("Charlie");
  });

  test("[Custom 4] Boolean AND in WHERE", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {a: true, b: true}), (:A {a: true, b: false}), (:A {a: false, b: true})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE n.a = true AND n.b = true RETURN n`,
    );

    expect(results).toHaveLength(1);
  });

  test("[Custom 5] Boolean OR in WHERE", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {a: true, b: false}), (:A {a: false, b: true}), (:A {a: false, b: false})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE n.a = true OR n.b = true RETURN n`,
    );

    expect(results).toHaveLength(2);
  });

  // toBooleanOrNull tests
  test("[Custom 6] toBooleanOrNull() returns true for 'true' string", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN toBooleanOrNull('true') AS b",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[Custom 7] toBooleanOrNull() returns null for invalid string", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN toBooleanOrNull('invalid') AS b",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test("[Custom 8] toBooleanOrNull() returns null for number (unlike toInteger)", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN toBooleanOrNull(42) AS b");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });
});
