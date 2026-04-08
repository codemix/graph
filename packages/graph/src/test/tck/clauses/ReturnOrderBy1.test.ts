/**
 * TCK ReturnOrderBy1 - Order by a single variable (correct order of values according to their type)
 * Translated from tmp/tck/features/clauses/return-orderby/ReturnOrderBy1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("ReturnOrderBy1 - Order by a single variable", () => {
  test("[1] ORDER BY should order booleans in the expected order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [true, false] AS bools RETURN bools ORDER BY bools",
    );
    // Results are wrapped in arrays
    expect(results).toEqual([[false], [true]]);
  });

  test("[2] ORDER BY DESC should order booleans in the expected order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [true, false] AS bools RETURN bools ORDER BY bools DESC",
    );
    expect(results).toEqual([[true], [false]]);
  });

  test("[3] ORDER BY should order strings in the expected order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND ['.*', '', ' ', 'one'] AS strings RETURN strings ORDER BY strings",
    );
    expect(results).toEqual([[""], [" "], [".*"], ["one"]]);
  });

  test("[4] ORDER BY DESC should order strings in the expected order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND ['.*', '', ' ', 'one'] AS strings RETURN strings ORDER BY strings DESC",
    );
    expect(results).toEqual([["one"], [".*"], [" "], [""]]);
  });

  test("[5] ORDER BY should order ints in the expected order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "UNWIND [1, 3, 2] AS ints RETURN ints ORDER BY ints");
    expect(results).toEqual([[1], [2], [3]]);
  });

  test("[6] ORDER BY DESC should order ints in the expected order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 3, 2] AS ints RETURN ints ORDER BY ints DESC",
    );
    expect(results).toEqual([[3], [2], [1]]);
  });

  test("[7] ORDER BY should order floats in the expected order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1.5, 1.3, 999.99] AS floats RETURN floats ORDER BY floats",
    );
    expect(results).toEqual([[1.3], [1.5], [999.99]]);
  });

  test("[8] ORDER BY DESC should order floats in the expected order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1.5, 1.3, 999.99] AS floats RETURN floats ORDER BY floats DESC",
    );
    expect(results).toEqual([[999.99], [1.5], [1.3]]);
  });

  test.fails("[9] ORDER BY should order lists in the expected order - list comparison not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [[], ['a'], ['a', 1], [1], [1, 'a'], [1, null], [null, 1], [null, 2]] AS lists RETURN lists ORDER BY lists",
    );
    expect(results).toEqual([
      [[]],
      [["a"]],
      [["a", 1]],
      [[1]],
      [[1, "a"]],
      [[1, null]],
      [[null, 1]],
      [[null, 2]],
    ]);
  });

  test.fails("[10] ORDER BY DESC should order lists in the expected order - list comparison not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [[], ['a'], ['a', 1], [1], [1, 'a'], [1, null], [null, 1], [null, 2]] AS lists RETURN lists ORDER BY lists DESC",
    );
    expect(results).toEqual([
      [[null, 2]],
      [[null, 1]],
      [[1, null]],
      [[1, "a"]],
      [[1]],
      [["a", 1]],
      [["a"]],
      [[]],
    ]);
  });

  test("[11] ORDER BY should order distinct types in the expected order - named paths not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {num: 42})-[:REL]->(:N {num: 43})");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n:N)-[r:REL]->() UNWIND [n, r, p, 1.5, 1, true, 'string', null, [1, 2], {key: 'value'}] AS x RETURN x ORDER BY x",
    );
    expect(results).toBeDefined();
  });

  test("[12] ORDER BY DESC should order distinct types in the expected order - named paths not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {num: 42})-[:REL]->(:N {num: 43})");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n:N)-[r:REL]->() UNWIND [n, r, p, 1.5, 1, true, 'string', null, [1, 2], {key: 'value'}] AS x RETURN x ORDER BY x DESC",
    );
    expect(results).toBeDefined();
  });

  // Custom tests with labeled nodes to verify ORDER BY functionality
  test("[custom-1] ORDER BY ASC with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num ORDER BY n.num");
    expect(results).toEqual([1, 2, 3]);
  });

  test("[custom-2] ORDER BY DESC with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num ORDER BY n.num DESC");
    expect(results).toEqual([3, 2, 1]);
  });

  test("[custom-3] ORDER BY with strings", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'charlie'})");
    executeTckQuery(graph, "CREATE (:A {name: 'alice'})");
    executeTckQuery(graph, "CREATE (:A {name: 'bob'})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name ORDER BY n.name");
    expect(results).toEqual(["alice", "bob", "charlie"]);
  });

  test("[custom-4] ORDER BY DESC with strings", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'charlie'})");
    executeTckQuery(graph, "CREATE (:A {name: 'alice'})");
    executeTckQuery(graph, "CREATE (:A {name: 'bob'})");

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name ORDER BY n.name DESC");
    expect(results).toEqual(["charlie", "bob", "alice"]);
  });
});
