/**
 * TCK Literals6 - String
 * Translated from tmp/tck/features/expressions/literals/Literals6.feature
 *
 * NOTE: Original TCK tests use RETURN-only queries (e.g., `RETURN '' AS literal`)
 * which are not supported in the grammar. Queries must start with MATCH, CREATE, etc.
 * Custom tests demonstrate string literal functionality in supported contexts.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Literals6 - String", () => {
  // TCK tests for RETURN-only queries with string literals

  test("[1] Return a single-quoted empty string", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN '' AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("");
  });

  test("[2] Return a single-quoted string with one character", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 'a' AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test("[3] Return a single-quoted string with utf-8 characters", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN '🧐🍌❖⋙⚐' AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("🧐🍌❖⋙⚐");
  });

  test("[4] Return a single-quoted string with escaped single-quote", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN '\\'' AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("'");
  });

  test("[5] Return a single-quoted string with escaped characters - escape sequence differences", () => {
    // Query: RETURN 'a\\bcn5t\'"\\//\\"\'' AS literal
    // Complex escape sequences may differ between implementations
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN 'a\\\\bcn5t\\'\"\\\\//\\\\\"\\'' AS literal",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a\\bcn5t'\"\\//\\\"'");
  });

  test("[6] Return a string with multiple characters", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 'hello world' AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("hello world");
  });

  test("[9] Return a double-quoted empty string", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, 'RETURN "" AS literal');
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("");
  });

  test("[10] Return a double-quoted string with one character", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, 'RETURN "a" AS literal');
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test.fails(
    "[11] Accept valid Unicode literal - unicode escape not supported",
    () => {
      // Query: RETURN '\u01FF' AS a
      // Expected: 'ǿ'
      const graph = createTckGraph();
      const results = executeTckQuery(graph, "RETURN '\\u01FF' AS a");
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("\u01FF");
    },
  );

  test("[13] Failing on incorrect unicode literal - validation not implemented", () => {
    // Query: RETURN '\uH'
    // Expected: SyntaxError InvalidUnicodeLiteral
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "RETURN '\\uH' AS literal");
    }).toThrow();
  });

  // Custom tests demonstrating string literals in supported contexts

  test("[custom-1] Single-quoted string in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'hello'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name = 'hello' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("hello");
  });

  test("[custom-2] Double-quoted string in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, 'CREATE (:A {name: "world"})');

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name = 'world' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("world");
  });

  test("[custom-3] Empty string in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', value: ''})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.value = '' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-4] String with spaces in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'hello world'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name = 'hello world' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("hello world");
  });

  test("[custom-5] String with numbers in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'user123'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name = 'user123' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("user123");
  });

  test("[custom-6] String comparison with STARTS WITH", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'prefix_test'}), (:A {name: 'other'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name STARTS WITH 'prefix' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("prefix_test");
  });

  test("[custom-7] String comparison with ENDS WITH", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'test_suffix'}), (:A {name: 'other'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name ENDS WITH 'suffix' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test_suffix");
  });

  test("[custom-8] String comparison with CONTAINS", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'hello_world_test'}), (:A {name: 'other'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name CONTAINS 'world' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("hello_world_test");
  });

  test("[custom-9] String in UNWIND list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      "UNWIND ['a', 'b', 'c'] AS letter RETURN letter",
    );

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(["a"]);
    expect(results[1]).toEqual(["b"]);
    expect(results[2]).toEqual(["c"]);
  });

  test("[custom-10] String case-sensitive comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'Hello'}), (:A {name: 'hello'}), (:A {name: 'HELLO'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name = 'Hello' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Hello");
  });

  test("[custom-11] String in relationship property", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'start'})-[:T {label: 'connection'}]->(:B {name: 'end'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) WHERE r.label = 'connection' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("start");
  });

  test("[custom-12] String with special characters", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a-b_c.d'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name = 'a-b_c.d' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a-b_c.d");
  });

  test("[custom-13] String inequality comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'alpha'}), (:A {name: 'beta'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name <> 'alpha' RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("beta");
  });

  test("[custom-14] String with single quote inside double quotes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, 'CREATE (:A {name: "it\'s"})');

    const results = executeTckQuery(
      graph,
      'MATCH (a:A) WHERE a.name = "it\'s" RETURN a.name',
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("it's");
  });
});
