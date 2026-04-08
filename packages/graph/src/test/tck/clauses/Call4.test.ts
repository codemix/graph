/**
 * TCK Call4 - Null Arguments
 *
 * Tests CALL clause with null arguments.
 *
 * Note: All tests fail because TCK requires user-defined test procedures
 * (test.my.proc) which would need to be registered at runtime. The graph package
 * only supports built-in procedures (db.*, dbms.*).
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Call4 - Null Arguments", () => {
  // [1] Standalone call to procedure with null argument
  test.fails("[1] Standalone call to procedure with null argument", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.my.proc(null)");
    expect(results).toEqual([["nix"]]);
  });

  // [2] In-query call to procedure with null argument
  test.fails("[2] In-query call to procedure with null argument", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD out RETURN out",
    );
    expect(results).toEqual([["nix"]]);
  });
});
