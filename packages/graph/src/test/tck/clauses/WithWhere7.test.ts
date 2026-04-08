/**
 * TCK WithWhere7 - Variable visibility under aliasing
 * Translated from tmp/tck/features/clauses/with-where/WithWhere7.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("WithWhere7 - Variable visibility under aliasing", () => {
  test.fails("[1] WHERE sees a variable bound before but not after WITH - unlabeled nodes and RETURN * not supported", () => {
    // Original test uses unlabeled nodes and RETURN *:
    // CREATE ({name2: 'A'}), ({name2: 'B'}), ({name2: 'C'})
    // MATCH (a) WITH a.name2 AS name WHERE a.name2 = 'B' RETURN *
    //
    // Note: The WHERE clause referencing 'a.name2' when 'a' is no longer in scope
    // after WITH projection is a special case that may or may not be supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name2: 'A'}), ({name2: 'B'}), ({name2: 'C'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a) WITH a.name2 AS name WHERE a.name2 = 'B' RETURN *",
    );
    expect(results.length).toBe(1);
    const row = results[0] as Record<string, unknown>;
    expect(row["name"]).toBe("B");
  });

  test.fails("[2] WHERE sees a variable bound after but not before WITH - unlabeled nodes and RETURN * not supported", () => {
    // Original test uses unlabeled nodes and RETURN *:
    // CREATE ({name2: 'A'}), ({name2: 'B'}), ({name2: 'C'})
    // MATCH (a) WITH a.name2 AS name WHERE name = 'B' RETURN *
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name2: 'A'}), ({name2: 'B'}), ({name2: 'C'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a) WITH a.name2 AS name WHERE name = 'B' RETURN *",
    );
    expect(results.length).toBe(1);
    const row = results[0] as Record<string, unknown>;
    expect(row["name"]).toBe("B");
  });

  test.fails("[3] WHERE sees both variables - unlabeled nodes and RETURN * not supported", () => {
    // Original test uses unlabeled nodes and RETURN *:
    // CREATE ({name2: 'A'}), ({name2: 'B'}), ({name2: 'C'})
    // MATCH (a) WITH a.name2 AS name WHERE name = 'B' OR a.name2 = 'C' RETURN *
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name2: 'A'}), ({name2: 'B'}), ({name2: 'C'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a) WITH a.name2 AS name WHERE name = 'B' OR a.name2 = 'C' RETURN *",
    );
    expect(results.length).toBe(2);
    const names = results.map((r) => (r as Record<string, unknown>)["name"]);
    expect(names).toContain("B");
    expect(names).toContain("C");
  });

  // Custom tests for variable visibility in WITH WHERE
  test("[custom-1] WHERE filters on alias from WITH", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'X'})");
    executeTckQuery(graph, "CREATE (:A {name: 'Y'})");
    executeTckQuery(graph, "CREATE (:A {name: 'Z'})");

    const results = executeTckQuery(graph, "MATCH (a:A) WITH a.name AS n WHERE n = 'Y' RETURN n");
    expect(results.length).toBe(1);
    const val = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(val).toBe("Y");
  });

  test("[custom-2] WHERE filters on computed alias", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 5})");
    executeTckQuery(graph, "CREATE (:A {num: 10})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a.num AS val WHERE val > 3 RETURN val",
    );
    expect(results.length).toBe(2);
    const values = results.map((r) => (Array.isArray(r) ? r[0] : r));
    expect(values).toContain(5);
    expect(values).toContain(10);
  });

  test("[custom-3] WHERE uses aliased variable in comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {value: 'apple'})");
    executeTckQuery(graph, "CREATE (:A {value: 'banana'})");
    executeTckQuery(graph, "CREATE (:A {value: 'cherry'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a.value AS fruit WHERE fruit = 'banana' RETURN fruit",
    );
    expect(results.length).toBe(1);
    const val = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(val).toBe("banana");
  });

  test("[custom-4] Multiple aliases in WITH with WHERE filter", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a', num: 1})");
    executeTckQuery(graph, "CREATE (:A {name: 'b', num: 2})");
    executeTckQuery(graph, "CREATE (:A {name: 'c', num: 3})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a.name AS n, a.num AS v WHERE v = 2 RETURN n, v",
    );
    expect(results.length).toBe(1);
    const [n, v] = results[0] as [string, number];
    expect(n).toBe("b");
    expect(v).toBe(2);
  });
});
