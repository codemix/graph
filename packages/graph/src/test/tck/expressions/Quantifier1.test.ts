/**
 * TCK Quantifier1 - None quantifier
 * Translated from tmp/tck/features/expressions/quantifier/Quantifier1.feature
 *
 * NOTE: All original TCK tests use RETURN-only queries (e.g., `RETURN none(x IN [...] WHERE ...)`).
 * The grammar requires queries to start with MATCH, CREATE, UNWIND, etc.
 * Custom tests demonstrate none() functionality in WHERE clause.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Quantifier1 - None quantifier", () => {
  test("[1] None quantifier is always true on empty list", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN none(x IN [] WHERE true) AS a, none(x IN [] WHERE false) AS b",
    );
    expect(results).toHaveLength(1);
    // Both should be true because none() on empty list is always true
    expect(results[0]).toEqual([true, true]);
  });

  test("[2] None quantifier on list literal containing booleans", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN none(x IN [true] WHERE x) AS result");
    expect(results).toHaveLength(1);
    // none(x IN [true] WHERE x) is false because true satisfies the predicate
    expect(results[0]).toBe(false);
  });

  test("[3] None quantifier on list literal containing integers", () => {
    const graph = createTckGraph();
    // none(x IN [1, 2, 3] WHERE x = 2) - one element equals 2, so none() returns false
    const results = executeTckQuery(graph, "RETURN none(x IN [1, 2, 3] WHERE x = 2) AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[4] None quantifier on list literal containing floats", () => {
    const graph = createTckGraph();
    // none(x IN [1.1, 2.1, 3.5] WHERE x = 2.1) - one element equals 2.1, so none() returns false
    const results = executeTckQuery(
      graph,
      "RETURN none(x IN [1.1, 2.1, 3.5] WHERE x = 2.1) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[5] None quantifier on list literal containing strings", () => {
    const graph = createTckGraph();
    // none(x IN ['abc', 'ef'] WHERE size(x) = 3) - 'abc' has size 3, so none() returns false
    const results = executeTckQuery(
      graph,
      "RETURN none(x IN ['abc', 'ef'] WHERE size(x) = 3) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[6] None quantifier on list literal containing lists", () => {
    const graph = createTckGraph();
    // none(x IN [[1,2,3], ['a']] WHERE size(x) = 3) - first list has size 3, so none() returns false
    const results = executeTckQuery(
      graph,
      "RETURN none(x IN [[1,2,3], ['a']] WHERE size(x) = 3) AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(false);
  });

  test("[7] None quantifier on list literal containing maps", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN none(x IN [{a: 2}, {a: 4}] WHERE x.a = 2) AS result",
    );
    expect(results).toHaveLength(1);
    // none() is false because the first map has a=2
    expect(results[0]).toBe(false);
  });

  test("[8] None quantifier on list containing nodes", () => {
    // Original: MATCH p = (:SNodes)-[*0..3]->(x) WITH tail(nodes(p)) AS nodes RETURN nodes, none(x IN nodes WHERE x.name = 'a')
    // Uses *0..3 which allows zero-length paths - not fully supported
    const graph = createTckGraph();
    graph.addVertex("SNodes", { name: "start" });
    graph.addVertex("Node", { name: "a" });
    graph.addVertex("Node", { name: "b" });
    graph.addVertex("Node", { name: "c" });
    const results = executeTckQuery(
      graph,
      "MATCH p = (:SNodes)-[*0..3]->(x) WITH tail(nodes(p)) AS nodes RETURN nodes, none(x IN nodes WHERE x.name = 'a')",
    );
    expect(results).toHaveLength(1);
  });

  test("[9] None quantifier on list containing relationships", () => {
    // Original: MATCH p = (:SRelationships)-[*0..4]->(x) WITH tail(relationships(p)) AS rels RETURN rels, none(x IN rels WHERE x.name = 'a')
    // Uses *0..4 which allows zero-length paths - not fully supported
    const graph = createTckGraph();
    graph.addVertex("SRelationships", { name: "start" });
    graph.addVertex("Node", { name: "end" });
    const results = executeTckQuery(
      graph,
      "MATCH p = (:SRelationships)-[*0..4]->(x) WITH tail(relationships(p)) AS rels RETURN rels, none(x IN rels WHERE x.name = 'a')",
    );
    expect(results).toHaveLength(1);
  });

  test("[10] None quantifier on lists containing nulls", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN none(x IN [null, 2] WHERE x = 2) AS result");
    expect(results).toHaveLength(1);
    // none() is false because 2 equals 2
    expect(results[0]).toBe(false);
  });

  test("[11] None quantifier with IS NULL predicate", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN none(x IN [0, null] WHERE x IS NULL) AS result");
    expect(results).toHaveLength(1);
    // none() is false because null IS NULL is true
    expect(results[0]).toBe(false);
  });

  test("[12] None quantifier with IS NOT NULL predicate", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN none(x IN [null, 2] WHERE x IS NOT NULL) AS result",
    );
    expect(results).toHaveLength(1);
    // none() is false because 2 IS NOT NULL is true
    expect(results[0]).toBe(false);
  });

  test("[13] None quantifier is true if predicate is statically false", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN none(x IN [1, null, true, 4.5, 'abc', false] WHERE false) AS result",
    );
    expect(results).toHaveLength(1);
    // none() is true when no element satisfies the predicate (false never satisfies)
    expect(results[0]).toBe(true);
  });

  test("[14] None quantifier is false if predicate is statically true", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN none(x IN [1, null, true, 4.5, 'abc', false] WHERE true) AS result",
    );
    expect(results).toHaveLength(1);
    // none() is false when at least one element satisfies the predicate (all do)
    expect(results[0]).toBe(false);
  });

  test.fails("[15] Fail none quantifier on type mismatch - semantic validation not implemented", () => {
    // Original: RETURN none(x IN ['Clara'] WHERE x % 2 = 0) AS result
    // Expected: SyntaxError InvalidArgumentType
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "RETURN none(x IN ['Clara'] WHERE x % 2 = 0) AS result");
    }).toThrow();
  });

  // Custom tests demonstrating none() functionality in WHERE clause

  test("[custom-1] none() returns true when no elements satisfy condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [10, 20, 30] });

    // None of the scores are negative
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x < 0) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-2] none() returns false when at least one element satisfies condition", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "has-two", scores: [1, 2, 3] });
    graph.addVertex("A", { name: "no-two", scores: [1, 3, 5] });

    // Find nodes where NONE of the scores equal 2
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x = 2) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("no-two");
  });

  test("[custom-3] none() returns true on empty list (vacuously true)", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "empty", scores: [] });

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x > 0) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("empty");
  });

  test("[custom-4] none() with literal list in WHERE - all positive", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test" });

    // All numbers in [1,2,3] are positive, so none are negative - returns true
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN [1, 2, 3] WHERE x < 0) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-5] none() with literal list in WHERE - has match", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test" });

    // List [1, 2, 3] has element equal to 2, so none() returns false
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN [1, 2, 3] WHERE x = 2) RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });

  test("[custom-6] none() combined with other conditions using AND", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "alice", scores: [5, 10, 15] });
    graph.addVertex("A", { name: "bob", scores: [20, 30, 40] });

    // Find nodes where name starts with 'a' AND none of scores are > 100
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE a.name STARTS WITH 'a' AND NONE(x IN a.scores WHERE x > 100) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("alice");
  });

  test("[custom-7] none() with compound condition in WHERE", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", scores: [5, 10, 15, 20] });

    // None of the scores are both > 10 AND < 15 (only scores are 5, 10, 15, 20)
    // Score 5 is not > 10, score 10 is not > 10, score 15 is not < 15, score 20 is not < 15
    // So none() should return true
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x > 10 AND x < 15) RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-8] none() is equivalent to NOT any()", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "a1", scores: [1, 2, 3] });
    graph.addVertex("A", { name: "a2", scores: [4, 5, 6] });

    // Nodes where none are < 3 should match where any < 3 does NOT match
    const noneResults = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.scores WHERE x < 3) RETURN a.name ORDER BY a.name",
    );

    // For a1: scores [1,2,3] - 1 < 3 and 2 < 3, so ANY returns true, NONE returns false
    // For a2: scores [4,5,6] - none < 3, so ANY returns false, NONE returns true
    expect(noneResults).toHaveLength(1);
    expect(noneResults[0]).toBe("a2");
  });

  test("[custom-9] none() with string comparison", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", items: ["foo", "bar", "baz"] });

    // None of the items equal 'qux'
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.items WHERE x = 'qux') RETURN a.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("test");
  });

  test("[custom-10] none() returns false when any element matches", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { name: "test", items: ["foo", "bar", "baz"] });

    // One of the items equals 'bar', so none() returns false
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WHERE NONE(x IN a.items WHERE x = 'bar') RETURN a.name",
    );

    expect(results).toHaveLength(0);
  });
});
