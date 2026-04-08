/**
 * TCK Infrastructure verification test.
 * Ensures the TCK test helpers work correctly.
 */
import { test, expect } from "vitest";
import {
  createTckGraph,
  executeTckQuery,
  resultsMatch,
  normalizeResult,
  extractProperties,
  getLabel,
} from "./tckHelpers.js";

test("TCK - createTckGraph creates an empty graph", () => {
  const graph = createTckGraph();
  const results = executeTckQuery(graph, "MATCH (n) RETURN n");
  expect(results).toEqual([]);
});

test("TCK - executeTckQuery can create and match nodes", () => {
  const graph = createTckGraph();
  executeTckQuery(graph, "CREATE (:A {name: 'test'})");
  const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name");
  // Results are returned as raw values, not keyed objects
  expect(results).toEqual(["test"]);
});

test("TCK - resultsMatch compares unordered results", () => {
  const a = [{ x: 1 }, { x: 2 }, { x: 3 }];
  const b = [{ x: 3 }, { x: 1 }, { x: 2 }];
  expect(resultsMatch(a, b)).toBe(true);
});

test("TCK - resultsMatch detects mismatches", () => {
  const a = [{ x: 1 }, { x: 2 }];
  const b = [{ x: 1 }, { x: 3 }];
  expect(resultsMatch(a, b)).toBe(false);
});

test("TCK - normalizeResult strips internal properties", () => {
  const result = {
    $id: "123",
    $label: "A",
    name: "test",
    num: 42,
  };
  expect(normalizeResult(result)).toEqual({ name: "test", num: 42 });
});

test("TCK - extractProperties returns user properties", () => {
  const result = {
    $id: "123",
    $label: "A",
    name: "test",
  };
  expect(extractProperties(result)).toEqual({ name: "test" });
});

test("TCK - getLabel extracts node label", () => {
  const node = { $label: "Person", name: "Alice" };
  expect(getLabel(node)).toBe("Person");
});

test("TCK - can create relationships", () => {
  const graph = createTckGraph();
  executeTckQuery(graph, "CREATE (:A {name: 'a'})-[:KNOWS]->(:B {name: 'b'})");
  const results = executeTckQuery(
    graph,
    "MATCH (a:A)-[:KNOWS]->(b:B) RETURN a.name, b.name",
  );
  // Multiple return items come back as arrays
  expect(results).toEqual([["a", "b"]]);
});

test("TCK - can handle multiple labels in schema", () => {
  const graph = createTckGraph();
  executeTckQuery(graph, "CREATE (:X), (:Y), (:Z)");
  const results = executeTckQuery(graph, "MATCH (n) RETURN COUNT(n)");
  // COUNT returns the scalar value
  expect(results).toEqual([3]);
});
