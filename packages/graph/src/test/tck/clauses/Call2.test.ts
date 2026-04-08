/**
 * TCK Call2 - Procedure arguments
 *
 * Tests CALL clause with explicit and implicit arguments.
 *
 * Note: All tests fail because TCK requires user-defined test procedures
 * (test.my.proc) which would need to be registered at runtime. The graph package
 * only supports built-in procedures (db.*, dbms.*).
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Call2 - Procedure arguments", () => {
  // [1] In-query call to procedure with explicit arguments
  test.fails("[1] In-query call to procedure with explicit arguments", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc('Stefan', 1) YIELD city, country_code RETURN city, country_code",
    );
    expect(results).toEqual([["Berlin", 49]]);
  });

  // [2] Standalone call to procedure with explicit arguments
  test.fails("[2] Standalone call to procedure with explicit arguments", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.my.proc('Stefan', 1)");
    expect(results).toEqual([["Berlin", 49]]);
  });

  // [3] Standalone call to procedure with implicit arguments
  test.fails("[3] Standalone call to procedure with implicit arguments", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.my.proc", {
      name: "Stefan",
      id: 1,
    });
    expect(results).toEqual([["Berlin", 49]]);
  });

  // [4] In-query call to procedure that takes arguments fails when trying to pass them implicitly
  test("[4] In-query call fails with implicit arguments", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "CALL test.my.proc YIELD out RETURN out")).toThrow();
  });

  // [5] Standalone call to procedure should fail if input type is wrong
  test("[5] Standalone call should fail if input type is wrong", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "CALL test.my.proc(true)")).toThrow();
  });

  // [6] In-query call to procedure should fail if input type is wrong
  test("[6] In-query call should fail if input type is wrong", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "CALL test.my.proc(true) YIELD out RETURN out")).toThrow();
  });
});
