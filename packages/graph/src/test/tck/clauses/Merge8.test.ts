/**
 * TCK Merge8 - Merge relationships - on match and on create
 * Translated from tmp/tck/features/clauses/merge/Merge8.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Merge8 - Merge relationships - on match and on create", () => {
  test("[1] Using ON CREATE and ON MATCH - MATCH...MERGE chaining and count(r) not supported", () => {
    // Query requires MATCH (a:A), (b:B) MERGE (a)-[r:TYPE]->(b) ON CREATE SET r.name = 'Lola' ON MATCH SET r.name = 'RUN'
    // Our grammar doesn't support MATCH followed by MERGE
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B)");
    // First merge - creates relationship
    executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) MERGE (a)-[r:TYPE]->(b) ON CREATE SET r.name = 'Lola' ON MATCH SET r.name = 'RUN'",
    );
    const results1 = executeTckQuery(
      graph,
      "MATCH ()-[r:TYPE]->() RETURN r.name",
    );
    expect(results1).toHaveLength(1);
    expect(results1[0]).toBe("Lola");

    // Second merge - matches relationship
    executeTckQuery(
      graph,
      "MATCH (a:A), (b:B) MERGE (a)-[r:TYPE]->(b) ON CREATE SET r.name = 'Lola' ON MATCH SET r.name = 'RUN'",
    );
    const results2 = executeTckQuery(
      graph,
      "MATCH ()-[r:TYPE]->() RETURN r.name",
    );
    expect(results2).toHaveLength(1);
    expect(results2[0]).toBe("RUN");
  });

  // Custom tests for combined ON CREATE and ON MATCH with relationships
  test("[custom] ON CREATE and ON MATCH both work for relationships", () => {
    const graph = createTckGraph();

    // First MERGE creates relationship - ON CREATE triggers
    executeTckQuery(
      graph,
      "CREATE (a:A), (b:B) MERGE (a)-[r:T]->(b) ON CREATE SET r.action = 'created' ON MATCH SET r.action = 'matched'",
    );

    const results1 = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) RETURN r.action",
    );
    expect(results1).toHaveLength(1);
    expect(results1[0]).toBe("created");

    // Second MERGE matches relationship - ON MATCH triggers
    executeTckQuery(
      graph,
      "MERGE (a:A) MERGE (b:B) MERGE (a)-[r:T]->(b) ON CREATE SET r.action = 'created' ON MATCH SET r.action = 'matched'",
    );

    const results2 = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) RETURN r.action",
    );
    expect(results2).toHaveLength(1);
    expect(results2[0]).toBe("matched");
  });

  test("[custom] Different properties for ON CREATE and ON MATCH", () => {
    const graph = createTckGraph();

    // Create - ON CREATE triggers
    executeTckQuery(
      graph,
      "CREATE (a:A), (b:B) MERGE (a)-[r:T]->(b) ON CREATE SET r.created = true ON MATCH SET r.matched = true",
    );

    const results1 = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) RETURN r.created, r.matched",
    );
    expect(results1).toHaveLength(1);
    const [created1, matched1] = results1[0] as [
      boolean | undefined,
      boolean | undefined,
    ];
    expect(created1).toBe(true);
    expect(matched1).toBeUndefined();

    // Match - ON MATCH triggers
    executeTckQuery(
      graph,
      "MERGE (a:A) MERGE (b:B) MERGE (a)-[r:T]->(b) ON CREATE SET r.created = true ON MATCH SET r.matched = true",
    );

    const results2 = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:T]->(b:B) RETURN r.created, r.matched",
    );
    expect(results2).toHaveLength(1);
    const [created2, matched2] = results2[0] as [boolean, boolean];
    expect(created2).toBe(true);
    expect(matched2).toBe(true);
  });

  test("[custom] ON CREATE and ON MATCH with incoming relationship", () => {
    const graph = createTckGraph();

    // Create incoming relationship
    executeTckQuery(
      graph,
      "CREATE (a:A), (b:B) MERGE (a)<-[r:T]-(b) ON CREATE SET r.dir = 'in-created' ON MATCH SET r.dir = 'in-matched'",
    );

    const results1 = executeTckQuery(
      graph,
      "MATCH (b:B)-[r:T]->(a:A) RETURN r.dir",
    );
    expect(results1).toHaveLength(1);
    expect(results1[0]).toBe("in-created");

    // Match incoming relationship
    executeTckQuery(
      graph,
      "MERGE (a:A) MERGE (b:B) MERGE (a)<-[r:T]-(b) ON CREATE SET r.dir = 'in-created' ON MATCH SET r.dir = 'in-matched'",
    );

    const results2 = executeTckQuery(
      graph,
      "MATCH (b:B)-[r:T]->(a:A) RETURN r.dir",
    );
    expect(results2).toHaveLength(1);
    expect(results2[0]).toBe("in-matched");
  });
});
