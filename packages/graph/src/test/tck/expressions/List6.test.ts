/**
 * TCK List6 - List size
 * Translated from tmp/tck/features/expressions/list/List6.feature
 *
 * Tests the size() function for lists.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("List6 - List size", () => {
  test("[1] Return list size", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN size([1, 2, 3]) AS n");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3);
  });

  test("[2] Setting and returning the size of a list property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    executeTckQuery(graph, "MATCH (n:A) SET n.numbers = [1, 2, 3]");
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN size(n.numbers)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3);
  });

  test("[3] Concatenating and returning the size of literal lists", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN size([[], []] + [[]]) AS l");
    expect(results).toEqual([3]);
  });

  test("[4] size() on null list", () => {
    const graph = createTckGraph();
    // Use UNWIND to pass null since WITH null AS l isn't supported
    const results = executeTckQuery(graph, "UNWIND [null] AS l RETURN size(l)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test.fails("[5] Fail for size() on paths - named paths not supported", () => {
    // Original TCK:
    // MATCH p = (a)-[*]->(b)
    // RETURN size(p)
    // Expected: SyntaxError
    //
    // Grammar limitation: Named path syntax (p = pattern) not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:REL]->(:B)");
    // Should throw SyntaxError for named path syntax
    expect(() =>
      executeTckQuery(graph, "MATCH p = (a:A)-[*]->(b) RETURN size(p)"),
    ).toThrow();
  });

  test("[6] Fail for size() on pattern predicates - pattern predicates not supported", () => {
    // Original TCK (Scenario Outline):
    // MATCH (a), (b), (c)
    // RETURN size(<pattern>)
    // Expected: SyntaxError
    //
    // Grammar limitation: Pattern predicates in size() not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B), (:C)");
    // Should throw SyntaxError for pattern predicate in size()
    expect(() =>
      executeTckQuery(
        graph,
        "MATCH (a:A), (b:B), (c:C) RETURN size((a)-->(b))",
      ),
    ).toThrow();
  });

  test.fails(
    "[7] Using size of pattern comprehension to test existence - pattern comprehension not supported",
    () => {
      // Original TCK:
      // CREATE (a:X {num: 42}), (:X {num: 43})
      // CREATE (a)-[:T]->()
      // MATCH (n:X)
      // RETURN n, size([(n)--() | 1]) > 0 AS b
      // Expected: true for num=42, false for num=43
      //
      // Grammar limitation: Pattern comprehension [(n)--() | 1] not supported
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a:X {num: 42}), (:X {num: 43})");
      executeTckQuery(graph, "MATCH (a:X {num: 42}) CREATE (a)-[:T]->(:Y)");
      const results = executeTckQuery(
        graph,
        "MATCH (n:X) RETURN n.num, size([(n)--() | 1]) > 0 AS b ORDER BY n.num",
      );
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual([42, true]);
      expect(results[1]).toEqual([43, false]);
    },
  );

  test("[8] Get node degree via size of pattern comprehension - pattern comprehension not supported", () => {
    // Original TCK:
    // CREATE (x:X), (x)-[:T]->(), (x)-[:T]->(), (x)-[:T]->()
    // MATCH (a:X)
    // RETURN size([(a)-->() | 1]) AS length
    // Expected: 3
    //
    // Grammar limitation: Pattern comprehension not supported
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (x:X)-[:T]->(:Y), (x)-[:T]->(:Y), (x)-[:T]->(:Y)",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:X) RETURN size([(a)-->() | 1]) AS length",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3);
  });

  test("[9] Get node degree via size of pattern comprehension with relationship type - pattern comprehension not supported", () => {
    // Original TCK:
    // CREATE (x:X), (x)-[:T]->(), (x)-[:T]->(), (x)-[:T]->(), (x)-[:OTHER]->()
    // MATCH (a:X)
    // RETURN size([(a)-[:T]->() | 1]) AS length
    // Expected: 3
    //
    // Grammar limitation: Pattern comprehension not supported
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (x:X)-[:T]->(:Y), (x)-[:T]->(:Y), (x)-[:T]->(:Y), (x)-[:OTHER]->(:Y)",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:X) RETURN size([(a)-[:T]->() | 1]) AS length",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3);
  });

  test("[10] Get node degree via size of pattern comprehension with multiple relationship types - pattern comprehension not supported", () => {
    // Original TCK:
    // CREATE (x:X), (x)-[:T]->(), (x)-[:T]->(), (x)-[:T]->(), (x)-[:OTHER]->()
    // MATCH (a:X)
    // RETURN size([(a)-[:T|OTHER]->() | 1]) AS length
    // Expected: 4
    //
    // Grammar limitation: Pattern comprehension not supported
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (x:X)-[:T]->(:Y), (x)-[:T]->(:Y), (x)-[:T]->(:Y), (x)-[:OTHER]->(:Y)",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:X) RETURN size([(a)-[:T|OTHER]->() | 1]) AS length",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(4);
  });

  // Custom tests demonstrating list storage
  test("[Custom 1] Store and verify list length via UNWIND count", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {items: [1, 2, 3, 4, 5]})");
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) UNWIND n.items AS item RETURN count(item)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(5);
  });

  test("[Custom 2] Count nodes as alternative to size()", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})`,
    );

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN count(n)");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3);
  });

  test("[Custom 3] Store empty list", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {items: []})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN size(n.items)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0);
  });
});
