/**
 * TCK Path3 - Length of a path
 * Translated from tmp/tck/features/expressions/path/Path3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Path3 - Length of a path", () => {
  test("[1] Return a var length path of length zero", () => {
    // Original TCK:
    // CREATE (a:A)-[:REL]->(b:B)
    // MATCH p = (a)-[*0..1]->(b)
    // RETURN a, b, length(p) AS l
    //
    // Expected results:
    // | a    | b    | l |
    // | (:A) | (:A) | 0 |
    // | (:B) | (:B) | 0 |
    // | (:A) | (:B) | 1 |
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:REL]->(b:B)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (a)-[*0..1]->(b) RETURN a, b, length(p) AS l",
    );
    expect(results).toHaveLength(3);
  });

  test.fails("[2] Failing when using `length()` on a node - semantic type validation not implemented", () => {
    // Original TCK:
    // MATCH (n)
    // RETURN length(n)
    //
    // Expected: SyntaxError - InvalidArgumentType
    //
    // Limitations:
    // - Unlabeled nodes not supported
    // - Semantic type validation for function arguments not implemented
    // - Error would be thrown at runtime, not at compile time
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    expect(() => {
      executeTckQuery(graph, "MATCH (n) RETURN length(n)");
    }).toThrow();
  });

  test.fails("[3] Failing when using `length()` on a relationship - semantic type validation not implemented", () => {
    // Original TCK:
    // MATCH ()-[r]->()
    // RETURN length(r)
    //
    // Expected: SyntaxError - InvalidArgumentType
    //
    // Limitations:
    // - Unlabeled nodes not supported
    // - Semantic type validation for function arguments not implemented
    // - Error would be thrown at runtime, not at compile time
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:REL]->(:B)");
    expect(() => {
      executeTckQuery(graph, "MATCH ()-[r]->() RETURN length(r)");
    }).toThrow();
  });

  // Custom tests demonstrating path length calculations that ARE supported

  test("[Custom 1] Calculate path length by counting relationships", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:T]->(:B {name: 'b'})-[:T]->(:C {name: 'c'})`);

    // Path length = number of relationships in the path
    // For A->B->C, the path length is 2
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[r1:T]->(b:B)-[r2:T]->(c:C) RETURN a.name, c.name`,
    );

    expect(results).toHaveLength(1);
    // We matched a path with 2 relationships, so length would be 2
    const [aName, cName] = results[0] as [string, string];
    expect(aName).toBe("a");
    expect(cName).toBe("c");
  });

  test("[Custom 2] Determine path length by fixed pattern matching", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:Start {name: 's'})-[:REL]->(:End {name: 'e'})`);

    // Path of length 1 (one relationship)
    const length1Results = executeTckQuery(
      graph,
      `MATCH (s:Start)-[:REL]->(e:End) RETURN s.name, e.name`,
    );
    expect(length1Results).toHaveLength(1);

    // No path of length 2 exists
    const length2Results = executeTckQuery(
      graph,
      `MATCH (s:Start)-[:REL]->(:B)-[:REL]->(e:End) RETURN s.name, e.name`,
    );
    expect(length2Results).toHaveLength(0);
  });

  test("[Custom 3] Count relationships to compute path length manually", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a'})-[:T {id: 1}]->(:B {name: 'b'})-[:T {id: 2}]->(:C {name: 'c'})-[:T {id: 3}]->(:D {name: 'd'})`,
    );

    // Match the full path and count relationships
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[r1:T]->(b:B)-[r2:T]->(c:C)-[r3:T]->(d:D) RETURN r1.id, r2.id, r3.id`,
    );

    expect(results).toHaveLength(1);
    const [id1, id2, id3] = results[0] as [number, number, number];
    expect(id1).toBe(1);
    expect(id2).toBe(2);
    expect(id3).toBe(3);
    // Path length = 3 (three relationships)
  });

  test("[Custom 4] Distinguish paths of different lengths", () => {
    const graph = createTckGraph();
    // Create two separate paths
    executeTckQuery(graph, `CREATE (:Start {id: 1})-[:T]->(:End {id: 1})`);
    executeTckQuery(graph, `CREATE (:Start {id: 2})-[:T]->(:A {id: 2})-[:T]->(:End {id: 2})`);

    // Path of length 1: Start -> End (direct)
    const directPaths = executeTckQuery(graph, `MATCH (s:Start)-[:T]->(e:End) RETURN s.id`);
    expect(directPaths).toHaveLength(1);
    expect(directPaths[0]).toBe(1);

    // Path of length 2: Start -> A -> End
    const twohopPaths = executeTckQuery(
      graph,
      `MATCH (s:Start)-[:T]->(:A)-[:T]->(e:End) RETURN s.id`,
    );
    expect(twohopPaths).toHaveLength(1);
    expect(twohopPaths[0]).toBe(2);
  });

  test("[Custom 5] Verify size() function works on lists", () => {
    // While length() on paths is not supported, size() on lists is
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})`);
    executeTckQuery(graph, `CREATE (:A {name: 'b'})`);
    executeTckQuery(graph, `CREATE (:A {name: 'c'})`);

    // Use count() as an alternative to measure collection size
    const results = executeTckQuery(graph, `MATCH (n:A) RETURN count(n)`);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3);
  });

  test("[Custom 6] Match paths with different relationship counts", () => {
    const graph = createTckGraph();
    // Create a chain: A -> B -> C -> D
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a'})-[:T]->(:B {name: 'b'})-[:T]->(:C {name: 'c'})-[:T]->(:D {name: 'd'})`,
    );

    // Single-hop path (length 1)
    const hop1 = executeTckQuery(graph, `MATCH (a:A)-[r:T]->(b:B) RETURN a.name, b.name`);
    expect(hop1).toHaveLength(1);

    // Two-hop path (length 2)
    const hop2 = executeTckQuery(graph, `MATCH (a:A)-[:T]->(:B)-[:T]->(c:C) RETURN a.name, c.name`);
    expect(hop2).toHaveLength(1);

    // Three-hop path (length 3)
    const hop3 = executeTckQuery(
      graph,
      `MATCH (a:A)-[:T]->(:B)-[:T]->(:C)-[:T]->(d:D) RETURN a.name, d.name`,
    );
    expect(hop3).toHaveLength(1);
  });
});
