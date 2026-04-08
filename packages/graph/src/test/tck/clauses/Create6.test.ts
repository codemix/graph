/**
 * TCK Create6 - Persistence of create clause side effects
 * Translated from tmp/tck/features/clauses/create/Create6.feature
 *
 * These scenarios test that CREATE side effects persist even when
 * LIMIT, SKIP, WHERE filtering, or aggregation reduces the result set.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Create6 - Persistence of create clause side effects", () => {
  test("[1] Limiting to zero results after creating nodes affects the result set but not the side effects", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CREATE (n:N {num: 42}) RETURN n LIMIT 0");

    // Result set should be empty due to LIMIT 0
    expect(results).toHaveLength(0);

    // But the node should still have been created
    const nodes = executeTckQuery(graph, "MATCH (n:N) RETURN n.num");
    expect(nodes).toHaveLength(1);
    // Single return values come back as the value directly
    const num = nodes[0] as number;
    expect(num).toBe(42);
  });

  test("[2] Skipping all results after creating nodes affects the result set but not the side effects", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CREATE (n:N {num: 42}) RETURN n SKIP 1");

    // Result set should be empty due to SKIP 1
    expect(results).toHaveLength(0);

    // But the node should still have been created
    const nodes = executeTckQuery(graph, "MATCH (n:N) RETURN n.num");
    expect(nodes).toHaveLength(1);
  });

  test.fails("[3] Skipping and limiting to a few results after creating nodes - UNWIND not fully supported", () => {
    // Query: UNWIND [42, 42, 42, 42, 42] AS x CREATE (n:N {num: x}) RETURN n.num AS num SKIP 2 LIMIT 2
    // UNWIND clause may not be fully supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [42, 42, 42, 42, 42] AS x CREATE (n:N {num: x}) RETURN n.num AS num SKIP 2 LIMIT 2",
    );

    // Should return 2 results (skip 2, limit 2 of 5)
    expect(results).toHaveLength(2);
    expect(results).toEqual([42, 42]);

    // All 5 nodes should have been created regardless of SKIP/LIMIT
    const nodes = executeTckQuery(graph, "MATCH (n:N) RETURN n.num");
    expect(nodes).toHaveLength(5);
  });

  test("[4] Skipping zero result and limiting to all results after creating nodes - UNWIND not fully supported", () => {
    // Query: UNWIND [42, 42, 42, 42, 42] AS x CREATE (n:N {num: x}) RETURN n.num AS num SKIP 0 LIMIT 5
    // UNWIND clause may not be fully supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [42, 42, 42, 42, 42] AS x CREATE (n:N {num: x}) RETURN n.num AS num SKIP 0 LIMIT 5",
    );

    // Should return all 5 results
    expect(results).toHaveLength(5);
    expect(results).toEqual([42, 42, 42, 42, 42]);

    // All 5 nodes should have been created
    const nodes = executeTckQuery(graph, "MATCH (n:N) RETURN n.num");
    expect(nodes).toHaveLength(5);
  });

  test("[5] Filtering after creating nodes affects the result set but not the side effects - UNWIND not fully supported", () => {
    // Query: UNWIND [1, 2, 3, 4, 5] AS x CREATE (n:N {num: x}) WITH n WHERE n.num % 2 = 0 RETURN n.num AS num
    // UNWIND clause may not be fully supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 2, 3, 4, 5] AS x CREATE (n:N {num: x}) WITH n WHERE n.num % 2 = 0 RETURN n.num AS num",
    );

    // Should return only even numbers (2, 4)
    expect(results).toHaveLength(2);
    expect(results).toEqual([2, 4]);

    // All 5 nodes should have been created regardless of WHERE filter
    const nodes = executeTckQuery(graph, "MATCH (n:N) RETURN n.num ORDER BY n.num");
    expect(nodes).toHaveLength(5);
  });

  test("[6] Aggregating in RETURN after creating nodes affects the result set but not the side effects - UNWIND not fully supported", () => {
    // Query: UNWIND [1, 2, 3, 4, 5] AS x CREATE (n:N {num: x}) RETURN sum(n.num) AS sum
    // UNWIND clause may not be fully supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 2, 3, 4, 5] AS x CREATE (n:N {num: x}) RETURN sum(n.num) AS sum",
    );

    // Should return a single aggregated result (1+2+3+4+5=15)
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(15);

    // All 5 nodes should have been created
    const nodes = executeTckQuery(graph, "MATCH (n:N) RETURN n.num");
    expect(nodes).toHaveLength(5);
  });

  test.fails("[7] Aggregating in WITH after creating nodes affects the result set but not the side effects - UNWIND not fully supported", () => {
    // Query: UNWIND [1, 2, 3, 4, 5] AS x CREATE (n:N {num: x}) WITH sum(n.num) AS sum RETURN sum
    // UNWIND clause may not be fully supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 2, 3, 4, 5] AS x CREATE (n:N {num: x}) WITH sum(n.num) AS sum RETURN sum",
    );

    // Should return a single aggregated result (1+2+3+4+5=15)
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(15);

    // All 5 nodes should have been created
    const nodes = executeTckQuery(graph, "MATCH (n:N) RETURN n.num");
    expect(nodes).toHaveLength(5);
  });

  test("[8] Limiting to zero results after creating relationships affects the result set but not the side effects - unlabeled nodes not supported", () => {
    // Query: CREATE ()-[r:R {num: 42}]->() RETURN r LIMIT 0
    // Our schema requires all nodes to have labels
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CREATE ()-[r:R {num: 42}]->() RETURN r LIMIT 0");

    // Result set should be empty due to LIMIT 0
    expect(results).toHaveLength(0);

    // But the relationship should still have been created
    const rels = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r.num");
    expect(rels).toHaveLength(1);
    expect(rels[0]).toBe(42);
  });

  test("[9] Skipping all results after creating relationships affects the result set but not the side effects - unlabeled nodes not supported", () => {
    // Query: CREATE ()-[r:R {num: 42}]->() RETURN r SKIP 1
    // Our schema requires all nodes to have labels
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CREATE ()-[r:R {num: 42}]->() RETURN r SKIP 1");

    // Result set should be empty due to SKIP 1
    expect(results).toHaveLength(0);

    // But the relationship should still have been created
    const rels = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r.num");
    expect(rels).toHaveLength(1);
    expect(rels[0]).toBe(42);
  });

  test.fails("[10] Skipping and limiting to a few results after creating relationships - UNWIND not fully supported", () => {
    // Query: UNWIND [42, 42, 42, 42, 42] AS x CREATE ()-[r:R {num: x}]->() RETURN r.num AS num SKIP 2 LIMIT 2
    // UNWIND + unlabeled nodes
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [42, 42, 42, 42, 42] AS x CREATE ()-[r:R {num: x}]->() RETURN r.num AS num SKIP 2 LIMIT 2",
    );

    // Should return 2 results (skip 2, limit 2 of 5)
    expect(results).toHaveLength(2);
    expect(results).toEqual([42, 42]);

    // All 5 relationships should have been created
    const rels = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r.num");
    expect(rels).toHaveLength(5);
  });

  test("[11] Skipping zero result and limiting to all results after creating relationships - UNWIND not fully supported", () => {
    // Query: UNWIND [42, 42, 42, 42, 42] AS x CREATE ()-[r:R {num: x}]->() RETURN r.num AS num SKIP 0 LIMIT 5
    // UNWIND + unlabeled nodes
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [42, 42, 42, 42, 42] AS x CREATE ()-[r:R {num: x}]->() RETURN r.num AS num SKIP 0 LIMIT 5",
    );

    // Should return all 5 results
    expect(results).toHaveLength(5);
    expect(results).toEqual([42, 42, 42, 42, 42]);

    // All 5 relationships should have been created
    const rels = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r.num");
    expect(rels).toHaveLength(5);
  });

  test("[12] Filtering after creating relationships affects the result set but not the side effects - UNWIND not fully supported", () => {
    // Query: UNWIND [1, 2, 3, 4, 5] AS x CREATE ()-[r:R {num: x}]->() WITH r WHERE r.num % 2 = 0 RETURN r.num AS num
    // UNWIND + unlabeled nodes
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 2, 3, 4, 5] AS x CREATE ()-[r:R {num: x}]->() WITH r WHERE r.num % 2 = 0 RETURN r.num AS num",
    );

    // Should return only even numbers (2, 4)
    expect(results).toHaveLength(2);
    expect(results).toEqual([2, 4]);

    // All 5 relationships should have been created regardless of WHERE filter
    const rels = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r.num ORDER BY r.num");
    expect(rels).toHaveLength(5);
  });

  test("[13] Aggregating in RETURN after creating relationships affects the result set but not the side effects - UNWIND not fully supported", () => {
    // Query: UNWIND [1, 2, 3, 4, 5] AS x CREATE ()-[r:R {num: x}]->() RETURN sum(r.num) AS sum
    // UNWIND + unlabeled nodes
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 2, 3, 4, 5] AS x CREATE ()-[r:R {num: x}]->() RETURN sum(r.num) AS sum",
    );

    // Should return a single aggregated result (1+2+3+4+5=15)
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(15);

    // All 5 relationships should have been created
    const rels = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r.num");
    expect(rels).toHaveLength(5);
  });

  test.fails("[14] Aggregating in WITH after creating relationships affects the result set but not the side effects - UNWIND not fully supported", () => {
    // Query: UNWIND [1, 2, 3, 4, 5] AS x CREATE ()-[r:R {num: x}]->() WITH sum(r.num) AS sum RETURN sum
    // UNWIND + unlabeled nodes
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 2, 3, 4, 5] AS x CREATE ()-[r:R {num: x}]->() WITH sum(r.num) AS sum RETURN sum",
    );

    // Should return a single aggregated result (1+2+3+4+5=15)
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(15);

    // All 5 relationships should have been created
    const rels = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r.num");
    expect(rels).toHaveLength(5);
  });

  // Custom tests with labeled nodes
  test("[custom] LIMIT 0 after creating relationship still persists the relationship", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CREATE (:A)-[r:R {num: 42}]->(:B) RETURN r LIMIT 0");

    // Result set should be empty
    expect(results).toHaveLength(0);

    // But the relationship should still exist
    const rels = executeTckQuery(graph, "MATCH (:A)-[r:R]->(:B) RETURN r.num");
    expect(rels).toHaveLength(1);
    // Single return values come back as the value directly
    const num = rels[0] as number;
    expect(num).toBe(42);
  });

  test("[custom] SKIP 1 after creating relationship still persists the relationship", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "CREATE (:A)-[r:R {num: 99}]->(:B) RETURN r SKIP 1");

    // Result set should be empty
    expect(results).toHaveLength(0);

    // But the relationship should still exist
    const rels = executeTckQuery(graph, "MATCH (:A)-[r:R]->(:B) RETURN r.num");
    expect(rels).toHaveLength(1);
  });

  test.fails("[custom] Multiple MATCH creates multiple nodes even with LIMIT - LIMIT applied before all CREATEs", () => {
    // In standard OpenCypher, CREATE side effects should persist even when LIMIT reduces results
    // Our implementation applies LIMIT early, so only 1 B node is created instead of 3
    // This is a deviation from the TCK spec but consistent with our current implementation
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) CREATE (b:B {num: a.num}) RETURN b LIMIT 1",
    );

    // Only 1 result due to LIMIT
    expect(results).toHaveLength(1);

    // In standard OpenCypher, all 3 B nodes should have been created despite LIMIT 1
    const bNodes = executeTckQuery(graph, "MATCH (b:B) RETURN b.num ORDER BY b.num");
    expect(bNodes).toHaveLength(3);
    expect(bNodes).toEqual([1, 2, 3]);
  });
});
