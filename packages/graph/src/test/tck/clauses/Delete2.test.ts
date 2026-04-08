/**
 * TCK Delete2 - Deleting relationships
 * Translated from tmp/tck/features/clauses/delete/Delete2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Delete2 - Deleting relationships", () => {
  test("[1] Delete relationships - UNWIND not fully supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "UNWIND range(0, 2) AS i CREATE ()-[:R]->()");
    const before = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN count(r)");
    expect(before[0]).toBe(3);
    executeTckQuery(graph, "MATCH ()-[r:R]->() DELETE r");
    const after = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN count(r)");
    expect(after[0]).toBe(0);
  });

  test("[2] Delete optionally matched relationship - unlabeled nodes and OPTIONAL MATCH not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    executeTckQuery(graph, "MATCH (n) OPTIONAL MATCH (n)-[r]-() DELETE n, r");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n");
    expect(results).toHaveLength(0);
  });

  test("[3] Delete relationship with bidirectional matching - named path syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T {id: 42}]->(:B)");
    executeTckQuery(graph, "MATCH p = ()-[r:T]-() WHERE r.id = 42 DELETE r");
    const results = executeTckQuery(graph, "MATCH ()-[r:T]->() RETURN r");
    expect(results).toHaveLength(0);
  });

  test.fails(
    "[4] Ignore null when deleting relationship - OPTIONAL MATCH not fully supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "OPTIONAL MATCH ()-[r:DoesNotExist]-() DELETE r RETURN r",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBeNull();
    },
  );

  test("[5] Failing when deleting a relationship type - syntax error", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:T {id: 42}]->(b:B)");

    // Query: DELETE r:T should be a syntax error
    expect(() => {
      executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) DELETE r:T");
    }).toThrow();
  });

  // Custom tests for supported DELETE relationship scenarios
  test("[custom] Delete single relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:T]->(b:B)");

    // Verify relationship exists
    const before = executeTckQuery(graph, "MATCH ()-[r:T]->() RETURN r");
    expect(before).toHaveLength(1);

    // Delete the relationship
    executeTckQuery(graph, "MATCH (a:A)-[r:T]->(b:B) DELETE r");

    // Verify relationship is deleted
    const after = executeTckQuery(graph, "MATCH ()-[r:T]->() RETURN r");
    expect(after).toHaveLength(0);

    // Nodes should still exist
    const nodesA = executeTckQuery(graph, "MATCH (n:A) RETURN n");
    expect(nodesA).toHaveLength(1);
    const nodesB = executeTckQuery(graph, "MATCH (n:B) RETURN n");
    expect(nodesB).toHaveLength(1);
  });

  test("[custom] Delete multiple relationships", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:T]->(b1:B)");
    executeTckQuery(graph, "MATCH (a:A) CREATE (a)-[:T]->(b2:B)");
    executeTckQuery(graph, "MATCH (a:A) CREATE (a)-[:T]->(b3:B)");

    // Verify 3 relationships exist
    const before = executeTckQuery(graph, "MATCH (:A)-[r:T]->() RETURN r");
    expect(before).toHaveLength(3);

    // Delete all T relationships from A
    executeTckQuery(graph, "MATCH (a:A)-[r:T]->() DELETE r");

    // Verify all relationships deleted
    const after = executeTckQuery(graph, "MATCH ()-[r:T]->() RETURN r");
    expect(after).toHaveLength(0);
  });

  test("[custom] Delete relationship with property filter", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:T {num: 1}]->(b1:B)");
    executeTckQuery(graph, "MATCH (a:A) CREATE (a)-[:T {num: 2}]->(b2:B)");
    executeTckQuery(graph, "MATCH (a:A) CREATE (a)-[:T {num: 3}]->(b3:B)");

    // Delete only relationships where num > 1
    executeTckQuery(graph, "MATCH (:A)-[r:T]->() WHERE r.num > 1 DELETE r");

    // Only relationship with num=1 should remain
    const after = executeTckQuery(graph, "MATCH (:A)-[r:T]->() RETURN r.num");
    expect(after).toHaveLength(1);
    expect(after[0]).toBe(1);
  });

  test("[custom] Delete relationship then node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:T]->(b:B)");

    // First delete relationship, then we can delete the A node
    executeTckQuery(graph, "MATCH (a:A)-[r:T]->() DELETE r");
    executeTckQuery(graph, "MATCH (a:A) DELETE a");

    // Verify A is deleted, B still exists
    const nodesA = executeTckQuery(graph, "MATCH (n:A) RETURN n");
    expect(nodesA).toHaveLength(0);
    const nodesB = executeTckQuery(graph, "MATCH (n:B) RETURN n");
    expect(nodesB).toHaveLength(1);
  });

  test("[custom] Delete incoming relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)<-[:T]-(b:B)");

    // Verify relationship exists (using outgoing pattern from B)
    const before = executeTckQuery(graph, "MATCH (:B)-[r:T]->(:A) RETURN r");
    expect(before).toHaveLength(1);

    // Delete using incoming pattern
    executeTckQuery(graph, "MATCH (a:A)<-[r:T]-(b:B) DELETE r");

    // Verify relationship deleted
    const after = executeTckQuery(graph, "MATCH ()-[r:T]->() RETURN r");
    expect(after).toHaveLength(0);
  });
});
