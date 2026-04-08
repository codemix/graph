/**
 * TCK Call5 - Results projection
 *
 * Tests YIELD clause for projecting procedure results.
 *
 * Note: All tests fail because TCK requires user-defined test procedures
 * (test.my.proc) which would need to be registered at runtime. The graph package
 * only supports built-in procedures (db.*, dbms.*).
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Call5 - Results projection", () => {
  // [1] Explicit procedure result projection
  test.fails("[1] Explicit procedure result projection", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD out RETURN out",
    );
    expect(results).toEqual([["nix"]]);
  });

  // [2] Explicit procedure result projection with RETURN *
  test.fails("[2] Explicit procedure result projection with RETURN *", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD out RETURN *",
    );
    expect(results).toEqual([["nix"]]);
  });

  // [3] The order of yield items is irrelevant - examples: a,b and b,a
  test.fails("[3] The order of yield items is irrelevant (a, b)", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD a, b RETURN a, b",
    );
    expect(results).toEqual([[1, 2]]);
  });

  test.fails("[3] The order of yield items is irrelevant (b, a)", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD b, a RETURN a, b",
    );
    expect(results).toEqual([[1, 2]]);
  });

  // [4] Rename outputs to unbound variable names - multiple examples
  test.fails("[4] Rename outputs: a AS c, b AS d", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD a AS c, b AS d RETURN c, d",
    );
    expect(results).toEqual([[1, 2]]);
  });

  test.fails("[4] Rename outputs: a AS b, b AS d", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD a AS b, b AS d RETURN b, d",
    );
    expect(results).toEqual([[1, 2]]);
  });

  test.fails("[4] Rename outputs: a AS c, b AS a", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD a AS c, b AS a RETURN c, a",
    );
    expect(results).toEqual([[1, 2]]);
  });

  test.fails("[4] Rename outputs: a AS b, b AS a", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD a AS b, b AS a RETURN b, a",
    );
    expect(results).toEqual([[1, 2]]);
  });

  test.fails("[4] Rename outputs: a AS c, b AS b", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD a AS c, b AS b RETURN c, b",
    );
    expect(results).toEqual([[1, 2]]);
  });

  test.fails("[4] Rename outputs: a AS c, b (no alias)", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD a AS c, b RETURN c, b",
    );
    expect(results).toEqual([[1, 2]]);
  });

  test.fails("[4] Rename outputs: a AS a, b AS d", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD a AS a, b AS d RETURN a, d",
    );
    expect(results).toEqual([[1, 2]]);
  });

  test.fails("[4] Rename outputs: a (no alias), b AS d", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD a, b AS d RETURN a, d",
    );
    expect(results).toEqual([[1, 2]]);
  });

  test.fails("[4] Rename outputs: a AS a, b AS b", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD a AS a, b AS b RETURN a, b",
    );
    expect(results).toEqual([[1, 2]]);
  });

  test.fails("[4] Rename outputs: a AS a, b (no alias)", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD a AS a, b RETURN a, b",
    );
    expect(results).toEqual([[1, 2]]);
  });

  test.fails("[4] Rename outputs: a (no alias), b AS b", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc(null) YIELD a, b AS b RETURN a, b",
    );
    expect(results).toEqual([[1, 2]]);
  });

  // [5] Fail on renaming to an already bound variable name
  test("[5] Fail on renaming to an already bound variable name", () => {
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(
        graph,
        "CALL test.my.proc(null) YIELD a, b AS a RETURN a",
      ),
    ).toThrow();
  });

  // [6] Fail on renaming all outputs to the same variable name
  test("[6] Fail on renaming all outputs to the same variable name", () => {
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(
        graph,
        "CALL test.my.proc(null) YIELD a AS c, b AS c RETURN c",
      ),
    ).toThrow();
  });

  // [7] Fail on in-query call to procedure with YIELD *
  test("[7] Fail on in-query call to procedure with YIELD *", () => {
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(
        graph,
        "CALL test.my.proc('Stefan', 1) YIELD * RETURN city, country_code",
      ),
    ).toThrow();
  });

  // [8] Allow standalone call to procedure with YIELD *
  test.fails("[8] Allow standalone call to procedure with YIELD *", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CALL test.my.proc('Stefan', 1) YIELD *",
    );
    expect(results).toEqual([[{ city: "Berlin", country_code: 49 }]]);
  });
});
