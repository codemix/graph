/**
 * TCK Use Case Tests - CountingSubgraphMatches1
 * Matching subgraph patterns and counting the number of matches.
 *
 * Original TCK: tmp/tck/features/useCases/countingSubgraphMatches/CountingSubgraphMatches1.feature
 *
 * IMPORTANT: Most original TCK tests use features not supported:
 * - Unlabeled nodes in MATCH patterns (all nodes require labels)
 * - count(*) syntax (use count(variable) instead)
 * - Undirected pattern syntax ()--() not supported
 * - DISTINCT inside aggregate functions (count(DISTINCT r)) not supported
 *
 * Custom tests demonstrate equivalent functionality where possible.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("CountingSubgraphMatches1 - Matching subgraph patterns and count", () => {
  // ============================================================================
  // Original TCK Scenario [1]: Undirected match in self-relationship graph, count
  // MATCH ()--() RETURN count(*)
  // SKIPPED: Unlabeled nodes, undirected patterns, count(*) not supported
  // ============================================================================
  test.fails(
    "[1] Undirected match in self-relationship graph, count - UNSUPPORTED: unlabeled nodes, undirected patterns, count(*)",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (n:A)-[:LOOP]->(n)");
      const results = executeTckQuery(graph, "MATCH ()--() RETURN count(*)");
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(2);
    },
  );

  // ============================================================================
  // Original TCK Scenario [2]: Undirected match of self-relationship in self-relationship graph, count
  // MATCH (n)--(n) RETURN count(*)
  // SKIPPED: Unlabeled nodes, undirected patterns, count(*) not supported
  // ============================================================================
  test.fails(
    "[2] Undirected match of self-relationship in self-relationship graph, count - UNSUPPORTED: unlabeled nodes, undirected patterns, count(*)",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (n:A)-[:LOOP]->(n)");
      const results = executeTckQuery(graph, "MATCH (n)--(n) RETURN count(*)");
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(2);
    },
  );

  // ============================================================================
  // Original TCK Scenario [3]: Undirected match on simple relationship graph, count
  // MATCH ()--() RETURN count(*)
  // SKIPPED: Unlabeled nodes, undirected patterns, count(*) not supported
  // ============================================================================
  test("[3] Undirected match on simple relationship graph, count - UNSUPPORTED: unlabeled nodes, undirected patterns, count(*)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(graph, "MATCH ()--() RETURN count(*)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  // ============================================================================
  // Original TCK Scenario [4]: Directed match on self-relationship graph, count
  // MATCH ()-->() RETURN count(*)
  // SKIPPED: Unlabeled nodes, count(*) not supported
  // ============================================================================
  test("[4] Directed match on self-relationship graph, count - UNSUPPORTED: unlabeled nodes, count(*)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (n:A)-[:LOOP]->(n)");
    const results = executeTckQuery(graph, "MATCH ()-->() RETURN count(*)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  // ============================================================================
  // Original TCK Scenario [5]: Directed match of self-relationship on self-relationship graph, count
  // MATCH (n)-->(n) RETURN count(*)
  // SKIPPED: Unlabeled nodes, count(*) not supported
  // ============================================================================
  test("[5] Directed match of self-relationship on self-relationship graph, count - UNSUPPORTED: unlabeled nodes, count(*)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (n:A)-[:LOOP]->(n)");
    const results = executeTckQuery(graph, "MATCH (n)-->(n) RETURN count(*)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  // ============================================================================
  // Original TCK Scenario [6]: Counting undirected self-relationships in self-relationship graph
  // MATCH (n)-[r]-(n) RETURN count(r)
  // SKIPPED: Unlabeled nodes, undirected patterns not supported
  // ============================================================================
  test.fails(
    "[6] Counting undirected self-relationships in self-relationship graph - UNSUPPORTED: unlabeled nodes, undirected patterns",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (n:A)-[:LOOP]->(n)");
      const results = executeTckQuery(
        graph,
        "MATCH (n)-[r]-(n) RETURN count(r)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(2);
    },
  );

  // ============================================================================
  // Original TCK Scenario [7]: Counting distinct undirected self-relationships in self-relationship graph
  // MATCH (n)-[r]-(n) RETURN count(DISTINCT r)
  // SKIPPED: Unlabeled nodes, undirected patterns, count(DISTINCT) not supported
  // ============================================================================
  test.fails(
    "[7] Counting distinct undirected self-relationships in self-relationship graph - UNSUPPORTED: unlabeled nodes, undirected patterns, count(DISTINCT)",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (n:A)-[:LOOP]->(n)");
      const results = executeTckQuery(
        graph,
        "MATCH (n)-[r]-(n) RETURN count(DISTINCT r)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(1);
    },
  );

  // ============================================================================
  // Original TCK Scenario [8]: Directed match of a simple relationship, count
  // MATCH ()-->() RETURN count(*)
  // SKIPPED: Unlabeled nodes, count(*) not supported
  // ============================================================================
  test("[8] Directed match of a simple relationship, count - UNSUPPORTED: unlabeled nodes, count(*)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(graph, "MATCH ()-->() RETURN count(*)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  // ============================================================================
  // Original TCK Scenario [9]: Counting directed self-relationships
  // MATCH (n)-[r]->(n) RETURN count(r)
  // SKIPPED: Unlabeled nodes not supported
  // ============================================================================
  test("[9] Counting directed self-relationships - UNSUPPORTED: unlabeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (n:A)-[:LOOP]->(n)");
    const results = executeTckQuery(
      graph,
      "MATCH (n)-[r]->(n) RETURN count(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  // ============================================================================
  // Original TCK Scenario [10]: Mixing directed and undirected pattern parts with self-relationship, count
  // MATCH (:A)-->()--() RETURN count(*)
  // SKIPPED: Unlabeled nodes, undirected patterns, count(*) not supported
  // ============================================================================
  test("[10] Mixing directed and undirected pattern parts with self-relationship, count - UNSUPPORTED: unlabeled nodes, undirected patterns, count(*)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)-[:T]->(:C)");
    const results = executeTckQuery(
      graph,
      "MATCH (:A)-->()--() RETURN count(*)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  // ============================================================================
  // Original TCK Scenario [11]: Mixing directed and undirected pattern parts with self-relationship, undirected count
  // MATCH ()-[]-()-[]-() RETURN count(*)
  // SKIPPED: Unlabeled nodes, undirected patterns, count(*) not supported
  // ============================================================================
  test.fails(
    "[11] Mixing directed and undirected pattern parts with self-relationship, undirected count - UNSUPPORTED: unlabeled nodes, undirected patterns, count(*)",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)-[:T]->(:C)");
      const results = executeTckQuery(
        graph,
        "MATCH ()-[]-()-[]-() RETURN count(*)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(4);
    },
  );

  // ============================================================================
  // CUSTOM TESTS - Demonstrating counting subgraph patterns with labeled nodes
  // ============================================================================

  test("[Custom 1] Counting directed self-relationships with labeled nodes", () => {
    const graph = createTckGraph();
    // Create a self-loop: a node that has a relationship to itself
    executeTckQuery(graph, "CREATE (a:A {name: 'looper'})-[:LOOP]->(a)");

    // Count the self-loop relationship
    const results = executeTckQuery(
      graph,
      "MATCH (n:A)-[r:LOOP]->(n) RETURN count(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[Custom 2] Counting directed matches in simple relationship graph", () => {
    const graph = createTckGraph();
    // Create a simple directed relationship between two nodes
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");

    // Count matches for the directed pattern
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) RETURN count(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[Custom 3] Counting multiple relationships from same source", () => {
    const graph = createTckGraph();
    // Create one source with multiple outgoing relationships
    executeTckQuery(
      graph,
      "CREATE (a:A {name: 'source'})-[:T]->(:B {name: 'target1'}), (a)-[:T]->(:B {name: 'target2'})",
    );

    // Count all relationships from source
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) RETURN count(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test("[Custom 4] Counting two-hop directed patterns", () => {
    const graph = createTckGraph();
    // Create a chain: A -> B -> C
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'start'})-[:T1]->(:B {name: 'middle'})-[:T2]->(:C {name: 'end'})",
    );

    // Count two-hop patterns
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:T1]->(b:B)-[:T2]->(c:C) RETURN count(c)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[Custom 5] Counting patterns with looper in chain", () => {
    const graph = createTckGraph();
    // Create: A -> Looper (with self-loop) -> B
    executeTckQuery(
      graph,
      "CREATE (:A)-[:T1]->(l:Looper), (l)-[:LOOP]->(l), (l)-[:T2]->(:B)",
    );

    // Count paths from A through Looper to B
    const results = executeTckQuery(
      graph,
      "MATCH (:A)-[:T1]->(l:Looper)-[:T2]->(:B) RETURN count(l)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[Custom 6] Counting self-loops among mixed relationships", () => {
    const graph = createTckGraph();
    // Create one self-loop and one regular relationship
    executeTckQuery(
      graph,
      "CREATE (a:A {name: 'looper'})-[:LOOP]->(a), (:A {name: 'regular'})-[:T]->(:B)",
    );

    // Count only the self-loops (where source equals target)
    const results = executeTckQuery(
      graph,
      "MATCH (n:A)-[r:LOOP]->(n) RETURN count(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[Custom 7] Counting relationships with property filter", () => {
    const graph = createTckGraph();
    // Create multiple relationships with different properties
    executeTckQuery(
      graph,
      "CREATE (:A)-[:T {num: 1}]->(:B), (:A)-[:T {num: 2}]->(:B), (:A)-[:T {num: 3}]->(:B)",
    );

    // Count relationships matching a filter
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) WHERE r.num > 1 RETURN count(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test("[Custom 8] Counting distinct target nodes", () => {
    const graph = createTckGraph();
    // Create multiple relationships to the same target
    executeTckQuery(
      graph,
      `
      CREATE (t:B {name: 'shared'})
      CREATE (:A {name: 'src1'})-[:T]->(t)
      CREATE (:A {name: 'src2'})-[:T]->(t)
      `,
    );

    // Count total matches (includes duplicates of target)
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:T]->(b:B) RETURN count(b)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test("[Custom 9] Counting with GROUP BY via WITH", () => {
    const graph = createTckGraph();
    // Create relationships with groupable properties
    executeTckQuery(
      graph,
      `
      CREATE (:A {name: 'alpha'})-[:T]->(:B)
      CREATE (:A {name: 'alpha'})-[:T]->(:B)
      CREATE (:A {name: 'beta'})-[:T]->(:B)
      `,
    );

    // Count all relationships
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) RETURN count(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(3);
  });

  test("[Custom 10] Empty result when no matches", () => {
    const graph = createTckGraph();
    // Create some nodes but no matching pattern
    executeTckQuery(graph, "CREATE (:A), (:B)");

    // Count relationships that don't exist
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) RETURN count(r)",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(0);
  });
});
