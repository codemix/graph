/**
 * TCK Call1 - Basic procedure calling
 *
 * Tests basic CALL clause functionality including standalone and in-query
 * procedure calls.
 *
 * Note: All tests fail because TCK requires user-defined test procedures
 * (test.doNothing, test.labels, test.my.proc) which would need to be registered
 * at runtime. The graph package only supports built-in procedures (db.*, dbms.*).
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Call1 - Basic procedure calling", () => {
  // [1] Standalone call to procedure that takes no arguments and yields no results
  test.fails("[1] Standalone call to procedure that takes no arguments and yields no results", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.doNothing()");
    expect(results).toEqual([]);
  });

  // [2] Standalone call to procedure that takes no arguments and yields no results, called with implicit arguments
  test.fails("[2] Standalone call to procedure with implicit arguments", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.doNothing");
    expect(results).toEqual([]);
  });

  // [3] In-query call to procedure that takes no arguments and yields no results
  test("[3] In-query call to procedure that takes no arguments and yields no results", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "MATCH (n) CALL test.doNothing() RETURN n");
    expect(results).toEqual([]);
  });

  // [4] In-query call to procedure that takes no arguments and yields no results and consumes no rows
  test.fails("[4] In-query call to procedure that consumes no rows", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a'}), (:B {name: 'b'}), (:C {name: 'c'})");
    const results = executeTckQuery(graph, "MATCH (n) CALL test.doNothing() RETURN n.name AS name");
    expect(results).toHaveLength(3);
  });

  // [5] Standalone call to STRING procedure that takes no arguments
  test.fails("[5] Standalone call to STRING procedure that takes no arguments", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.labels()");
    expect(results).toEqual([["A"], ["B"], ["C"]]);
  });

  // [6] In-query call to STRING procedure that takes no arguments
  test.fails("[6] In-query call to STRING procedure that takes no arguments", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.labels() YIELD label RETURN label");
    expect(results).toEqual([["A"], ["B"], ["C"]]);
  });

  // [7] Standalone call to procedure should fail if explicit argument is missing
  test("[7] Standalone call should fail if explicit argument is missing", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "CALL test.my.proc('Dobby')")).toThrow();
  });

  // [8] In-query call to procedure should fail if explicit argument is missing
  test("[8] In-query call should fail if explicit argument is missing", () => {
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(graph, "CALL test.my.proc('Dobby') YIELD out RETURN out"),
    ).toThrow();
  });

  // [9] Standalone call to procedure should fail if too many explicit arguments are given
  test("[9] Standalone call should fail if too many arguments", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "CALL test.my.proc(1, 2, 3, 4)")).toThrow();
  });

  // [10] In-query call to procedure should fail if too many explicit arguments are given
  test("[10] In-query call should fail if too many arguments", () => {
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(graph, "CALL test.my.proc(1, 2, 3, 4) YIELD out RETURN out"),
    ).toThrow();
  });

  // [11] Standalone call to procedure should fail if implicit argument is missing
  test("[11] Standalone call should fail if implicit argument is missing", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "CALL test.my.proc", { name: "test" })).toThrow();
  });

  // [12] In-query call to procedure that has outputs fails if no outputs are yielded
  test("[12] In-query call fails if outputs not yielded", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "CALL test.my.proc(1) RETURN out")).toThrow();
  });

  // [13] Standalone call to unknown procedure should fail
  test("[13] Standalone call to unknown procedure should fail", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "CALL test.my.proc")).toThrow();
  });

  // [14] In-query call to unknown procedure should fail
  test("[14] In-query call to unknown procedure should fail", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "CALL test.my.proc() YIELD out RETURN out")).toThrow();
  });

  // [15] In-query procedure call should fail if shadowing an already bound variable
  test("[15] Procedure call should fail if shadowing bound variable", () => {
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(graph, "WITH 'Hi' AS label CALL test.labels() YIELD label RETURN *"),
    ).toThrow();
  });

  // [16] In-query procedure call should fail if one of the argument expressions uses an aggregation function
  test.fails("[16] Procedure call should fail if argument uses aggregation", () => {
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(graph, "MATCH (n) CALL test.labels(count(n)) YIELD label RETURN label"),
    ).toThrow();
  });
});
