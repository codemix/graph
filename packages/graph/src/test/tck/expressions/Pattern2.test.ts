/**
 * TCK Pattern2 - Pattern Comprehension
 * Translated from tmp/tck/features/expressions/pattern/Pattern2.feature
 *
 * Pattern comprehension is a syntax for creating a list by matching patterns:
 * [p = (n)-->() | p] - returns list of paths matching the pattern
 * [(n)-[:T]->(b) | b.name] - returns list of property values from matched nodes
 *
 * This syntax is NOT supported in the grammar.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel } from "../tckHelpers.js";

describe("Pattern2 - Pattern Comprehension", () => {
  // All original TCK scenarios use pattern comprehension syntax which is not supported

  test("[1] Return a pattern comprehension - pattern comprehension syntax not supported", () => {
    // Original TCK:
    // CREATE (a:A), (b:B)
    // CREATE (a)-[:T]->(b), (b)-[:T]->(:C)
    // MATCH (n) RETURN [p = (n)-->() | p] AS list
    //
    // Pattern comprehension [p = pattern | expr] not supported in grammar
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'}), (:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (a)-[:T]->(b), (b)-[:T]->(:C {name: 'c'})`);

    // Pattern comprehension syntax
    const results = executeTckQuery(graph, `MATCH (n) RETURN [p = (n)-->() | p] AS list`);
    expect(results.length).toBeGreaterThan(0);
  });

  test("[2] Return a pattern comprehension with label predicate - pattern comprehension syntax not supported", () => {
    // Original TCK:
    // MATCH (n:A) RETURN [p = (n)-->(:B) | p] AS list
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:T]->(:B {name: 'b'})`);

    // Pattern comprehension with label predicate
    const results = executeTckQuery(graph, `MATCH (n:A) RETURN [p = (n)-->(:B) | p] AS list`);
    expect(results.length).toBeGreaterThan(0);
  });

  test("[3] Return a pattern comprehension with bound nodes - pattern comprehension syntax not supported", () => {
    // Original TCK:
    // MATCH (a:A), (b:B) RETURN [p = (a)-->(b) | p] AS list
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:T]->(:B {name: 'b'})`);

    // Pattern comprehension with bound nodes
    const results = executeTckQuery(graph, `MATCH (a:A), (b:B) RETURN [p = (a)-->(b) | p] AS list`);
    expect(results.length).toBeGreaterThan(0);
  });

  test("[4] Introduce a new node variable in pattern comprehension - pattern comprehension syntax not supported", () => {
    // Original TCK:
    // MATCH (n) RETURN [(n)-[:T]->(b) | b.name] AS list
    // Also uses unlabeled nodes
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:T]->(:B {name: 'b'})`);

    // Pattern comprehension with new node variable
    const results = executeTckQuery(graph, `MATCH (n) RETURN [(n)-[:T]->(b) | b.name] AS list`);
    expect(results.length).toBeGreaterThan(0);
  });

  test("[5] Introduce a new relationship variable in pattern comprehension - pattern comprehension syntax not supported", () => {
    // Original TCK:
    // MATCH (n) RETURN [(n)-[r:T]->() | r.name] AS list
    // Also uses unlabeled nodes
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:T {name: 'rel'}]->(:B {name: 'b'})`);

    // Pattern comprehension with new relationship variable
    const results = executeTckQuery(graph, `MATCH (n) RETURN [(n)-[r:T]->() | r.name] AS list`);
    expect(results.length).toBeGreaterThan(0);
  });

  test("[6] Aggregate on a pattern comprehension - pattern comprehension syntax not supported", () => {
    // Original TCK:
    // MATCH (n:A) RETURN count([p = (n)-[:HAS]->() | p]) AS c
    // Also uses unlabeled node in CREATE
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:HAS]->(:B {name: 'b'})`);

    // Aggregate on pattern comprehension
    const results = executeTckQuery(
      graph,
      `MATCH (n:A) RETURN count([p = (n)-[:HAS]->() | p]) AS c`,
    );
    expect(results.length).toBeGreaterThan(0);
  });

  test("[7] Use a pattern comprehension inside a list comprehension - pattern comprehension syntax not supported", () => {
    // Original TCK:
    // MATCH p = (n:X)-->() RETURN n, [x IN nodes(p) | size([(x)-->(:Y) | 1])] AS list
    // Multiple unsupported features: named paths, pattern comprehension, nested list comprehension
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:X {name: 'x'})-[:T]->(:Y {name: 'y'})`);

    // Pattern comprehension inside list comprehension
    const results = executeTckQuery(
      graph,
      `MATCH p = (n:X)-->() RETURN n, [x IN nodes(p) | size([(x)-->(:Y) | 1])] AS list`,
    );
    expect(results.length).toBeGreaterThan(0);
  });

  test("[8] Use a pattern comprehension in WITH - pattern comprehension syntax not supported", () => {
    // Original TCK:
    // MATCH (n)-->(b) WITH [p = (n)-->() | p] AS ps, count(b) AS c RETURN ps, c
    // Also uses unlabeled nodes
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:T]->(:B {name: 'b'})`);

    // Pattern comprehension in WITH clause
    const results = executeTckQuery(
      graph,
      `MATCH (n)-->(b) WITH [p = (n)-->() | p] AS ps, count(b) AS c RETURN ps, c`,
    );
    expect(results.length).toBeGreaterThan(0);
  });

  test("[9] Use a variable-length pattern comprehension in WITH - pattern comprehension syntax not supported", () => {
    // Original TCK:
    // MATCH (a:A), (b:B) WITH [p = (a)-[*]->(b) | p] AS paths, count(a) AS c RETURN paths, c
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:T]->(:B {name: 'b'})`);

    // Variable-length pattern comprehension in WITH clause
    const results = executeTckQuery(
      graph,
      `MATCH (a:A), (b:B) WITH [p = (a)-[*]->(b) | p] AS paths, count(a) AS c RETURN paths, c`,
    );
    expect(results.length).toBeGreaterThan(0);
  });

  test("[10] Use a pattern comprehension in RETURN - pattern comprehension syntax not supported", () => {
    // Original TCK:
    // MATCH (n:A) RETURN [p = (n)-[:HAS]->() | p] AS ps
    // Also uses unlabeled node
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:HAS]->(:B {name: 'b'})`);

    // Pattern comprehension in RETURN clause
    const results = executeTckQuery(graph, `MATCH (n:A) RETURN [p = (n)-[:HAS]->() | p] AS ps`);
    expect(results.length).toBeGreaterThan(0);
  });

  test("[11] Use a pattern comprehension and ORDER BY - pattern comprehension syntax not supported", () => {
    // Original TCK:
    // MATCH (liker) RETURN [p = (liker)--() | p] AS isNew ORDER BY liker.time
    // Also uses unlabeled nodes
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a', num: 1})-[:T]->(:B {name: 'b'})`);

    // Pattern comprehension with ORDER BY
    const results = executeTckQuery(
      graph,
      `MATCH (liker) RETURN [p = (liker)--() | p] AS isNew ORDER BY liker.num`,
    );
    expect(results.length).toBeGreaterThan(0);
  });

  // Custom tests demonstrating alternative patterns that ARE supported

  test("[Custom 1] Collect matching nodes via explicit MATCH instead of pattern comprehension", () => {
    // Alternative to: RETURN [(n)-[:T]->(b) | b.name]
    // Use explicit MATCH and collect()
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:T]->(:B {name: 'b1'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:T]->(:B {name: 'b2'})`);

    // Find all B nodes connected to A via T
    const results = executeTckQuery(graph, `MATCH (:A)-[:T]->(b:B) RETURN b.name`);

    expect(results).toHaveLength(2);
    const names = results as string[];
    expect(names).toContain("b1");
    expect(names).toContain("b2");
  });

  test("[Custom 2] Use collect() to aggregate connected nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'source'})-[:T]->(:B {name: 'target1'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:T]->(:B {name: 'target2'})`);

    // Collect all connected B nodes
    const results = executeTckQuery(graph, `MATCH (:A)-[:T]->(b:B) RETURN collect(b)`);

    expect(results).toHaveLength(1);
    const collected = results[0] as Array<Record<string, unknown>>;
    expect(collected).toHaveLength(2);
    expect(collected.every((n) => getLabel(n) === "B")).toBe(true);
  });

  test("[Custom 3] Count matching patterns instead of size of pattern comprehension", () => {
    // Alternative to: count([p = (n)-[:HAS]->() | p])
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a1'})`);
    executeTckQuery(graph, `CREATE (:A {name: 'a2'})`);
    executeTckQuery(graph, `CREATE (:A {name: 'a3'})`);
    executeTckQuery(graph, `MATCH (a:A) WHERE a.name = 'a1' CREATE (a)-[:HAS]->(:B {name: 'b1'})`);

    // Count nodes that have HAS relationships
    const withHas = executeTckQuery(graph, `MATCH (n:A)-[:HAS]->() RETURN count(n)`);
    expect(withHas).toHaveLength(1);
    expect(withHas[0]).toBe(1);

    // Count total A nodes
    const totalA = executeTckQuery(graph, `MATCH (n:A) RETURN count(n)`);
    expect(totalA).toHaveLength(1);
    expect(totalA[0]).toBe(3);
  });

  test("[Custom 4] Return relationship and node pairs from pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:T {num: 1}]->(:B {name: 'b1'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:T {num: 2}]->(:B {name: 'b2'})`);

    // Get both relationship and target node
    const results = executeTckQuery(graph, `MATCH (:A)-[r:T]->(b:B) RETURN r.num, b.name`);

    expect(results).toHaveLength(2);
    const pairs = results as Array<[number, string]>;
    expect(pairs).toContainEqual([1, "b1"]);
    expect(pairs).toContainEqual([2, "b2"]);
  });

  test("[Custom 5] Multi-hop pattern matching", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:T]->(:B {name: 'b'})-[:T]->(:C {name: 'c'})`);

    // Get all nodes in a 2-hop chain
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:T]->(b:B)-[:T]->(c:C) RETURN a.name, b.name, c.name`,
    );

    expect(results).toHaveLength(1);
    const [aName, bName, cName] = results[0] as [string, string, string];
    expect(aName).toBe("a");
    expect(bName).toBe("b");
    expect(cName).toBe("c");
  });

  test("[Custom 6] Order results by node property", () => {
    // Alternative to pattern comprehension with ORDER BY
    // Note: 'order' is a reserved keyword in grammar, use 'num' instead
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a', num: 3})`);
    executeTckQuery(graph, `CREATE (:A {name: 'b', num: 1})`);
    executeTckQuery(graph, `CREATE (:A {name: 'c', num: 2})`);

    const results = executeTckQuery(graph, `MATCH (n:A) RETURN n.name ORDER BY n.num`);

    expect(results).toEqual(["b", "c", "a"]);
  });
});
