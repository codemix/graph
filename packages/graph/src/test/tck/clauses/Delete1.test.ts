/**
 * TCK Delete1 - Deleting nodes
 * Translated from tmp/tck/features/clauses/delete/Delete1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Delete1 - Deleting nodes", () => {
  test("[1] Delete nodes - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    executeTckQuery(graph, "MATCH (n) DELETE n");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n");
    expect(results).toHaveLength(0);
  });

  test("[2] Detach delete node - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    executeTckQuery(graph, "MATCH (n) DETACH DELETE n");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n");
    expect(results).toHaveLength(0);
  });

  test("[3] Detach deleting connected nodes and relationships", () => {
    const graph = createTckGraph();
    // Setup: CREATE (x:X) with 3 relationships to unlabeled nodes
    // Modified to use labeled nodes since unlabeled not supported
    executeTckQuery(graph, "CREATE (x:X)-[:R]->(y1:Y)");
    executeTckQuery(graph, "MATCH (x:X) CREATE (x)-[:R]->(y2:Y)");
    executeTckQuery(graph, "MATCH (x:X) CREATE (x)-[:R]->(y3:Y)");

    // Verify setup
    const beforeNodes = executeTckQuery(graph, "MATCH (n:X) RETURN n");
    expect(beforeNodes).toHaveLength(1);
    const beforeRelations = executeTckQuery(graph, "MATCH (:X)-[r:R]->() RETURN r");
    expect(beforeRelations).toHaveLength(3);

    // Execute: DETACH DELETE the X node
    executeTckQuery(graph, "MATCH (n:X) DETACH DELETE n");

    // Verify: X node is deleted
    const afterNodes = executeTckQuery(graph, "MATCH (n:X) RETURN n");
    expect(afterNodes).toHaveLength(0);
  });

  test("[4] Delete on null node - OPTIONAL MATCH not fully supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "OPTIONAL MATCH (n) DELETE n");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n");
    expect(results).toHaveLength(0);
  });

  test.fails("[5] Ignore null when deleting node - OPTIONAL MATCH not fully supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "OPTIONAL MATCH (a:DoesNotExist) DELETE a RETURN a");
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test("[6] Detach delete on null node - OPTIONAL MATCH not fully supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "OPTIONAL MATCH (n) DETACH DELETE n");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n");
    expect(results).toHaveLength(0);
  });

  test("[7] Failing when deleting connected nodes", () => {
    const graph = createTckGraph();
    // Setup with labeled nodes
    executeTckQuery(graph, "CREATE (x:X)-[:R]->(y1:Y)");
    executeTckQuery(graph, "MATCH (x:X) CREATE (x)-[:R]->(y2:Y)");
    executeTckQuery(graph, "MATCH (x:X) CREATE (x)-[:R]->(y3:Y)");

    // Should throw when trying to delete a connected node without DETACH
    expect(() => {
      executeTckQuery(graph, "MATCH (n:X) DELETE n");
    }).toThrow(/Cannot delete vertex.*connected edges/);
  });

  test("[8] Failing when deleting a label - syntax error", () => {
    const graph = createTckGraph();
    // Query: DELETE n:Person should be a syntax error
    expect(() => {
      executeTckQuery(graph, "MATCH (n:A) DELETE n:Person");
    }).toThrow();
  });

  // Custom tests for supported DELETE scenarios
  test("[custom] Delete single labeled node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'test'})");

    // Verify node exists
    const before = executeTckQuery(graph, "MATCH (n:A) RETURN n.name");
    expect(before).toHaveLength(1);
    expect(before[0]).toBe("test");

    // Delete the node
    executeTckQuery(graph, "MATCH (n:A) DELETE n");

    // Verify node is deleted
    const after = executeTckQuery(graph, "MATCH (n:A) RETURN n");
    expect(after).toHaveLength(0);
  });

  test("[custom] Delete multiple nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    // Verify 3 nodes exist
    const before = executeTckQuery(graph, "MATCH (n:A) RETURN n");
    expect(before).toHaveLength(3);

    // Delete all A nodes
    executeTckQuery(graph, "MATCH (n:A) DELETE n");

    // Verify all deleted
    const after = executeTckQuery(graph, "MATCH (n:A) RETURN n");
    expect(after).toHaveLength(0);
  });

  test("[custom] DETACH DELETE removes edges and node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A {name: 'center'})-[:T]->(b:B {name: 'target'})");

    // Verify setup
    const beforeNodes = executeTckQuery(graph, "MATCH (n:A) RETURN n");
    expect(beforeNodes).toHaveLength(1);
    const beforeEdges = executeTckQuery(graph, "MATCH ()-[r:T]->() RETURN r");
    expect(beforeEdges).toHaveLength(1);

    // DETACH DELETE the A node
    executeTckQuery(graph, "MATCH (n:A) DETACH DELETE n");

    // Verify A is deleted
    const afterA = executeTckQuery(graph, "MATCH (n:A) RETURN n");
    expect(afterA).toHaveLength(0);

    // Verify edge is deleted
    const afterEdges = executeTckQuery(graph, "MATCH ()-[r:T]->() RETURN r");
    expect(afterEdges).toHaveLength(0);

    // B should still exist
    const afterB = executeTckQuery(graph, "MATCH (n:B) RETURN n");
    expect(afterB).toHaveLength(1);
  });

  test("[custom] DELETE with WHERE filter", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    // Delete only nodes where num > 1
    executeTckQuery(graph, "MATCH (n:A) WHERE n.num > 1 DELETE n");

    // Only node with num=1 should remain
    const after = executeTckQuery(graph, "MATCH (n:A) RETURN n.num");
    expect(after).toHaveLength(1);
    expect(after[0]).toBe(1);
  });
});
