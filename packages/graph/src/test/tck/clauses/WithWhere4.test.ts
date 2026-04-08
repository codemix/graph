/**
 * TCK WithWhere4 - Non-Equi-Joins on variables
 * Translated from tmp/tck/features/clauses/with-where/WithWhere4.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel } from "../tckHelpers.js";

describe("WithWhere4 - Non-Equi-Joins on variables", () => {
  test("[1] Join nodes on inequality", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    executeTckQuery(graph, "CREATE (:B)");

    const results = executeTckQuery(graph, "MATCH (a:A), (b:B) WITH a, b WHERE a <> b RETURN a, b");
    // A <> B should match since they are different nodes
    expect(results.length).toBe(1);
    const [aNode, bNode] = results[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(getLabel(aNode)).toBe("A");
    expect(getLabel(bNode)).toBe("B");
  });

  test.fails("[2] Join with disjunctive multi-part predicates including patterns - pattern predicates in WHERE not supported", () => {
    // Original test uses pattern predicates in WHERE:
    // WHERE a.id = 0 AND (a)-[:T]->(b:TheLabel) OR (a)-[:T*]->(b:MissingLabel)
    // Pattern predicates like (a)-[:T]->(b) in WHERE clause not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {id: 0})-[:T]->(:TheLabel)");
    executeTckQuery(graph, "CREATE (:A {id: 1})-[:T]->(:TheLabel)");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b) WITH a, b WHERE a.id = 0 AND (a)-[:T]->(b:TheLabel) OR (a)-[:T*]->(b:MissingLabel) RETURN a, b",
    );
    expect(results.length).toBe(1);
    const [aNode, bNode] = results[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(getLabel(aNode)).toBe("A");
    expect(getLabel(bNode)).toBe("TheLabel");
  });

  // Custom tests for non-equi joins
  test("[custom-1] Join nodes with less than comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:A) WITH a, b WHERE a.num < b.num RETURN a.num, b.num",
    );
    // Expect pairs: (1,2), (1,3), (2,3)
    expect(results.length).toBe(3);
    const pairs = results.map((r) => {
      const [aNum, bNum] = r as [number, number];
      return [aNum, bNum];
    });
    expect(pairs).toContainEqual([1, 2]);
    expect(pairs).toContainEqual([1, 3]);
    expect(pairs).toContainEqual([2, 3]);
  });

  test("[custom-2] Join nodes with not equal property comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {type: 'x'})");
    executeTckQuery(graph, "CREATE (:B {type: 'x'})");
    executeTckQuery(graph, "CREATE (:B {type: 'y'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) WITH a, b WHERE a.type <> b.type RETURN a.type, b.type",
    );
    expect(results.length).toBe(1);
    const [aType, bType] = results[0] as [string, string];
    expect(aType).toBe("x");
    expect(bType).toBe("y");
  });
});
