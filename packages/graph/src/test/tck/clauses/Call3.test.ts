/**
 * TCK Call3 - Assignable-type arguments
 *
 * Tests CALL clause with arguments of compatible types (e.g., INTEGER for NUMBER).
 *
 * Note: All tests fail because TCK requires user-defined test procedures
 * (test.my.proc) which would need to be registered at runtime. The graph package
 * only supports built-in procedures (db.*, dbms.*).
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Call3 - Assignable-type arguments", () => {
  // [1] Standalone call to procedure with argument of type NUMBER accepts value of type INTEGER
  test.fails("[1] Standalone call: NUMBER param accepts INTEGER", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.my.proc(42)");
    expect(results).toEqual([["wisdom"]]);
  });

  // [2] In-query call to procedure with argument of type NUMBER accepts value of type INTEGER
  test.fails("[2] In-query call: NUMBER param accepts INTEGER", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.my.proc(42) YIELD out RETURN out");
    expect(results).toEqual([["wisdom"]]);
  });

  // [3] Standalone call to procedure with argument of type NUMBER accepts value of type FLOAT
  test.fails("[3] Standalone call: NUMBER param accepts FLOAT", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.my.proc(42.3)");
    expect(results).toEqual([["about right"]]);
  });

  // [4] In-query call to procedure with argument of type NUMBER accepts value of type FLOAT
  test.fails("[4] In-query call: NUMBER param accepts FLOAT", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.my.proc(42.3) YIELD out RETURN out");
    expect(results).toEqual([["about right"]]);
  });

  // [5] Standalone call to procedure with argument of type FLOAT accepts value of type INTEGER
  test.fails("[5] Standalone call: FLOAT param accepts INTEGER", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.my.proc(42)");
    expect(results).toEqual([["close enough"]]);
  });

  // [6] In-query call to procedure with argument of type FLOAT accepts value of type INTEGER
  test.fails("[6] In-query call: FLOAT param accepts INTEGER", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.my.proc(42) YIELD out RETURN out");
    expect(results).toEqual([["close enough"]]);
  });
});
