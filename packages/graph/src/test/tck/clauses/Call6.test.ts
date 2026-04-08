/**
 * TCK Call6 - Call clause interoperation with other clauses
 *
 * Tests CALL clause combined with other Cypher clauses.
 *
 * Note: All tests fail because TCK requires user-defined test procedures
 * (test.labels, test.my.proc) which would need to be registered at runtime.
 * The graph package only supports built-in procedures (db.*, dbms.*).
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Call6 - Call clause interoperation with other clauses", () => {
  // [1] Calling the same STRING procedure twice using the same outputs in each call
  test.fails("[1] Calling the same STRING procedure twice using the same outputs", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `CALL test.labels() YIELD label
       WITH count(label) AS c
       CALL test.labels() YIELD label
       RETURN c, label`,
    );
    expect(results).toHaveLength(3);
  });

  // [2] Project procedure results between query scopes with WITH clause
  test.fails("[2] Project procedure results between query scopes with WITH clause", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CALL test.my.proc(null) YIELD out WITH out RETURN out");
    expect(results).toEqual([["nix"]]);
  });

  // [3] Project procedure results between query scopes with WITH clause and rename the projection
  test.fails("[3] Project procedure results with WITH and rename", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD out WITH out AS a RETURN a",
    );
    expect(results).toEqual([["nix"]]);
  });
});
