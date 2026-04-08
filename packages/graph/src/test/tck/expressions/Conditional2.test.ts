/**
 * TCK Conditional2 - Case Expression
 * Translated from tmp/tck/features/expressions/conditional/Conditional2.feature
 *
 * NOTE: The original TCK tests use RETURN-only queries which are not supported.
 * Custom tests demonstrate CASE WHEN functionality in WHERE clause and via node properties.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Conditional2 - Case Expression", () => {
  // Original TCK Scenario Outline [1] - Simple cases over integers

  test("[1] Simple cases over integers - example -10 -> 'minus ten'", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN CASE -10 WHEN -10 THEN 'minus ten' WHEN 0 THEN 'zero' WHEN 1 THEN 'one' WHEN 5 THEN 'five' WHEN 10 THEN 'ten' WHEN 3000 THEN 'three thousand' ELSE 'something else' END AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("minus ten");
  });

  test("[1] Simple cases over integers - example 0 -> 'zero'", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN CASE 0 WHEN -10 THEN 'minus ten' WHEN 0 THEN 'zero' WHEN 1 THEN 'one' WHEN 5 THEN 'five' WHEN 10 THEN 'ten' WHEN 3000 THEN 'three thousand' ELSE 'something else' END AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("zero");
  });

  test("[1] Simple cases over integers - example 1 -> 'one'", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN CASE 1 WHEN -10 THEN 'minus ten' WHEN 0 THEN 'zero' WHEN 1 THEN 'one' WHEN 5 THEN 'five' WHEN 10 THEN 'ten' WHEN 3000 THEN 'three thousand' ELSE 'something else' END AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("one");
  });

  test("[1] Simple cases over integers - example 5 -> 'five'", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN CASE 5 WHEN -10 THEN 'minus ten' WHEN 0 THEN 'zero' WHEN 1 THEN 'one' WHEN 5 THEN 'five' WHEN 10 THEN 'ten' WHEN 3000 THEN 'three thousand' ELSE 'something else' END AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("five");
  });

  test("[1] Simple cases over integers - example 10 -> 'ten'", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN CASE 10 WHEN -10 THEN 'minus ten' WHEN 0 THEN 'zero' WHEN 1 THEN 'one' WHEN 5 THEN 'five' WHEN 10 THEN 'ten' WHEN 3000 THEN 'three thousand' ELSE 'something else' END AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("ten");
  });

  test("[1] Simple cases over integers - example 3000 -> 'three thousand'", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN CASE 3000 WHEN -10 THEN 'minus ten' WHEN 0 THEN 'zero' WHEN 1 THEN 'one' WHEN 5 THEN 'five' WHEN 10 THEN 'ten' WHEN 3000 THEN 'three thousand' ELSE 'something else' END AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("three thousand");
  });

  test("[1] Simple cases over integers - example -30 -> 'something else'", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN CASE -30 WHEN -10 THEN 'minus ten' WHEN 0 THEN 'zero' WHEN 1 THEN 'one' WHEN 5 THEN 'five' WHEN 10 THEN 'ten' WHEN 3000 THEN 'three thousand' ELSE 'something else' END AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("something else");
  });

  test("[1] Simple cases over integers - example 3 -> 'something else'", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN CASE 3 WHEN -10 THEN 'minus ten' WHEN 0 THEN 'zero' WHEN 1 THEN 'one' WHEN 5 THEN 'five' WHEN 10 THEN 'ten' WHEN 3000 THEN 'three thousand' ELSE 'something else' END AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("something else");
  });

  test("[1] Simple cases over integers - example 3001 -> 'something else'", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN CASE 3001 WHEN -10 THEN 'minus ten' WHEN 0 THEN 'zero' WHEN 1 THEN 'one' WHEN 5 THEN 'five' WHEN 10 THEN 'ten' WHEN 3000 THEN 'three thousand' ELSE 'something else' END AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("something else");
  });

  test("[1] Simple cases over integers - example '0' (string) -> 'something else'", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN CASE '0' WHEN -10 THEN 'minus ten' WHEN 0 THEN 'zero' WHEN 1 THEN 'one' WHEN 5 THEN 'five' WHEN 10 THEN 'ten' WHEN 3000 THEN 'three thousand' ELSE 'something else' END AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("something else");
  });

  test("[1] Simple cases over integers - example true -> 'something else'", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN CASE true WHEN -10 THEN 'minus ten' WHEN 0 THEN 'zero' WHEN 1 THEN 'one' WHEN 5 THEN 'five' WHEN 10 THEN 'ten' WHEN 3000 THEN 'three thousand' ELSE 'something else' END AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("something else");
  });

  test("[1] Simple cases over integers - example 10.1 -> 'something else'", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN CASE 10.1 WHEN -10 THEN 'minus ten' WHEN 0 THEN 'zero' WHEN 1 THEN 'one' WHEN 5 THEN 'five' WHEN 10 THEN 'ten' WHEN 3000 THEN 'three thousand' ELSE 'something else' END AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("something else");
  });

  // Custom tests demonstrating CASE WHEN functionality in WHERE clause

  test("[custom-1] Simple CASE expression in WHERE clause - integer matching", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', num: -10}), (:A {name: 'b', num: 0}), (:A {name: 'c', num: 1}), (:A {name: 'd', num: 5}), (:A {name: 'e', num: 10})",
    );

    // Test CASE WHEN matching specific integer
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE n.num
          WHEN -10 THEN 'minus ten'
          WHEN 0 THEN 'zero'
          WHEN 1 THEN 'one'
          WHEN 5 THEN 'five'
          WHEN 10 THEN 'ten'
          ELSE 'something else'
        END = 'zero'
      RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("b");
  });

  test("[custom-2] Simple CASE expression with ELSE fallback", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', num: 100}), (:A {name: 'b', num: 1})",
    );

    // Test that unmatched values fall through to ELSE
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE n.num
          WHEN 1 THEN 'one'
          WHEN 2 THEN 'two'
          ELSE 'other'
        END = 'other'
      RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test("[custom-3] Searched CASE expression - boolean conditions", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'young', age: 15}), (:A {name: 'adult', age: 30}), (:A {name: 'senior', age: 70})",
    );

    // Test searched CASE with boolean conditions
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE
          WHEN n.age < 18 THEN 'minor'
          WHEN n.age < 65 THEN 'adult'
          ELSE 'senior'
        END = 'adult'
      RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("adult");
  });

  test("[custom-4] CASE expression with string comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'alice', role: 'admin'}), (:A {name: 'bob', role: 'user'}), (:A {name: 'carol', role: 'guest'})",
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE n.role
          WHEN 'admin' THEN 'full'
          WHEN 'user' THEN 'limited'
          ELSE 'none'
        END = 'limited'
      RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("bob");
  });

  test("[custom-5] CASE expression with no matching WHEN and no ELSE returns null", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', num: 999})");

    // CASE without ELSE returns null when no WHEN matches
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE n.num
          WHEN 1 THEN 'one'
          WHEN 2 THEN 'two'
        END IS NULL
      RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-6] CASE expression evaluates WHEN clauses in order", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', num: 5})");

    // First matching WHEN should be returned
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE n.num
          WHEN 5 THEN 'first-match'
          WHEN 5 THEN 'second-match'
          ELSE 'no-match'
        END = 'first-match'
      RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-7] Searched CASE with multiple conditions per WHEN", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'x', a: 1, b: 1}), (:A {name: 'y', a: 1, b: 2}), (:A {name: 'z', a: 2, b: 2})",
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE
          WHEN n.a = 1 AND n.b = 1 THEN 'both'
          WHEN n.a = 1 THEN 'just-a'
          ELSE 'other'
        END = 'both'
      RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("x");
  });

  test("[custom-8] CASE expression with property access in THEN", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test', x: 10, y: 20})");

    // CASE returning property values
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE
          WHEN n.x > 5 THEN n.y
          ELSE 0
        END = 20
      RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-9] Nested CASE expressions", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', type: 'inner', level: 1}), (:A {name: 'b', type: 'outer', level: 2})",
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE n.type
          WHEN 'inner' THEN
            CASE n.level
              WHEN 1 THEN 'deep'
              ELSE 'shallow'
            END
          ELSE 'surface'
        END = 'deep'
      RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test("[custom-10] CASE with null value handling", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'has-value', prop: 'exists'}), (:A {name: 'no-value'})",
    );

    // Test that missing property (null) can be detected with searched CASE
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE
          WHEN n.prop IS NULL THEN 'missing'
          ELSE 'present'
        END = 'missing'
      RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("no-value");
  });

  test("[custom-11] CASE expression with arithmetic in WHEN", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'ten', x: 7, y: 3}), (:A {name: 'twenty', x: 15, y: 5})",
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE
          WHEN n.x + n.y = 10 THEN 'sum-ten'
          WHEN n.x + n.y = 20 THEN 'sum-twenty'
          ELSE 'other'
        END = 'sum-ten'
      RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("ten");
  });

  test("[custom-12] Simple CASE vs Searched CASE behavior", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'true-node', flag: true}), (:A {name: 'false-node', flag: false})",
    );

    // Simple CASE compares value directly
    const simpleResults = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE n.flag
          WHEN true THEN 'yes'
          WHEN false THEN 'no'
        END = 'yes'
      RETURN n.name`,
    );
    expect(simpleResults).toHaveLength(1);
    expect(simpleResults[0]).toBe("true-node");

    // Searched CASE evaluates boolean conditions
    const searchedResults = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE
        CASE
          WHEN n.flag = true THEN 'yes'
          WHEN n.flag = false THEN 'no'
        END = 'no'
      RETURN n.name`,
    );
    expect(searchedResults).toHaveLength(1);
    expect(searchedResults[0]).toBe("false-node");
  });
});
