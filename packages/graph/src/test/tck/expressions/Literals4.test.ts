/**
 * TCK Literals4 - Octal integer
 * Translated from tmp/tck/features/expressions/literals/Literals4.feature
 *
 * NOTE: Original TCK tests use RETURN-only queries (e.g., `RETURN 0o1 AS literal`)
 * which are not supported in the grammar. Queries must start with MATCH, CREATE, etc.
 * Custom tests demonstrate octal integer literal functionality in supported contexts.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Literals4 - Octal integer", () => {
  // TCK tests for RETURN-only queries with octal literals

  test("[1] Return a short positive octal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 0o1 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[2] Return a long positive octal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 0o2613152366 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(372036854);
  });

  test.fails(
    "[3] Return the largest octal integer - JS precision limits",
    () => {
      // Query: RETURN 0o777777777777777777777 AS literal
      // Expected: 9223372036854775807
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN 0o777777777777777777777 AS literal",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(9223372036854775807n);
    },
  );

  test("[4] Return a positive octal zero", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN 0o0 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0);
  });

  test("[5] Return a negative octal zero", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -0o0 AS literal");
    expect(results).toHaveLength(1);
    // In JavaScript, -0 === 0 is true but Object.is(-0, 0) is false
    expect(results[0] === 0).toBe(true);
  });

  test("[6] Return a short negative octal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -0o1 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-1);
  });

  test("[7] Return a long negative octal integer", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -0o2613152366 AS literal");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(-372036854);
  });

  test.fails(
    "[8] Return the smallest octal integer - JS precision limits",
    () => {
      // Query: RETURN -0o1000000000000000000000 AS literal
      // Expected: -9223372036854775808
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN -0o1000000000000000000000 AS literal",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(-9223372036854775808n);
    },
  );

  test.fails(
    "[9] Fail on a too large octal integer - validation not implemented",
    () => {
      // Query: RETURN 0o1000000000000000000000 AS literal
      // Expected: SyntaxError IntegerOverflow
      const graph = createTckGraph();
      expect(() => {
        executeTckQuery(graph, "RETURN 0o1000000000000000000000 AS literal");
      }).toThrow();
    },
  );

  test.fails(
    "[10] Fail on a too small octal integer - validation not implemented",
    () => {
      // Query: RETURN -0o1000000000000000000001 AS literal
      // Expected: SyntaxError IntegerOverflow
      const graph = createTckGraph();
      expect(() => {
        executeTckQuery(graph, "RETURN -0o1000000000000000000001 AS literal");
      }).toThrow();
    },
  );

  // Custom tests demonstrating octal integer literals in supported contexts

  test("[custom-1] Octal integer 0o1 in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'oct', num: 0o1})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num = 1 RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("oct");
  });

  test("[custom-2] Octal integer 0o10 equals 8 in decimal", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'oct', num: 0o10})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num = 8 RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("oct");
  });

  test("[custom-3] Octal integer 0o77 equals 63 in decimal", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'oct', num: 0o77})");

    // 0o77 = 7*8 + 7 = 63
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num = 63 RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("oct");
  });

  test("[custom-4] Octal integer in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', num: 63}), (:A {name: 'b', num: 64})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num = 0o77 RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test("[custom-5] Octal zero equals decimal zero", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'zero', num: 0})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num = 0o0 RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("zero");
  });

  test("[custom-6] Negative octal integer in CREATE property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'neg-oct', num: -0o10})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num = -8 RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("neg-oct");
  });

  test("[custom-7] Octal integer 0o100 equals 64 in decimal", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'oct100', num: 0o100})");

    // 0o100 = 1*64 = 64
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num = 64 RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("oct100");
  });

  test("[custom-8] Octal integer in UNWIND list", () => {
    const graph = createTckGraph();

    const results = executeTckQuery(
      graph,
      "UNWIND [0o1, 0o10, 0o100] AS num RETURN num",
    );

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([1]);
    expect(results[1]).toEqual([8]);
    expect(results[2]).toEqual([64]);
  });

  test("[custom-9] Comparing octal and decimal", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'oct', num: 0o77}), (:A {name: 'dec', num: 63})",
    );

    // Both should have the same value (63), so both should match
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num = 63 RETURN a.name ORDER BY a.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toContain("oct");
    expect(results).toContain("dec");
  });

  test("[custom-10] Octal integer 0o777 equals 511 in decimal", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'oct', num: 0o777})");

    // 0o777 = 7*64 + 7*8 + 7 = 448 + 56 + 7 = 511
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.num = 511 RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("oct");
  });
});
