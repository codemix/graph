/**
 * TCK Create5 - Multiple hops create patterns
 * Translated from tmp/tck/features/clauses/create/Create5.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel, getType } from "../tckHelpers.js";

describe("Create5 - Multiple hops create patterns", () => {
  test("[1] Create a pattern with multiple hops", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:R]->(:B)-[:R]->(:C)");

    // Verify the chain was created
    const results = executeTckQuery(graph, "MATCH (a:A)-[:R]->(b:B)-[:R]->(c:C) RETURN a, b, c");
    expect(results).toHaveLength(1);

    const [a, b, c] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(a)).toBe("A");
    expect(getLabel(b)).toBe("B");
    expect(getLabel(c)).toBe("C");
  });

  test("[2] Create a pattern with multiple hops in the reverse direction", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)<-[:R]-(:B)<-[:R]-(:C)");

    // Verify the chain was created (C->B->A)
    const results = executeTckQuery(graph, "MATCH (a:A)<-[:R]-(b:B)<-[:R]-(c:C) RETURN a, b, c");
    expect(results).toHaveLength(1);

    const [a, b, c] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(a)).toBe("A");
    expect(getLabel(b)).toBe("B");
    expect(getLabel(c)).toBe("C");
  });

  test("[3] Create a pattern with multiple hops in varying directions", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:R]->(:B)<-[:R]-(:C)");

    // Verify the pattern (A->B<-C)
    const results = executeTckQuery(graph, "MATCH (a:A)-[:R]->(b:B)<-[:R]-(c:C) RETURN a, b, c");
    expect(results).toHaveLength(1);

    const [a, b, c] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(a)).toBe("A");
    expect(getLabel(b)).toBe("B");
    expect(getLabel(c)).toBe("C");
  });

  test("[4] Create a pattern with multiple hops with multiple types and varying directions - unlabeled nodes not supported", () => {
    // Query: CREATE ()-[:R1]->()<-[:R2]-()-[:R3]->()
    // Our schema requires all nodes to have labels
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:R1]->()<-[:R2]-()-[:R3]->()");

    // Verify the pattern was created
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r1:R1]->()<-[r2:R2]-()-[r3:R3]->() RETURN r1, r2, r3",
    );
    expect(results).toHaveLength(1);
    const [r1, r2, r3] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getType(r1)).toBe("R1");
    expect(getType(r2)).toBe("R2");
    expect(getType(r3)).toBe("R3");
  });

  test("[5] Create a pattern with multiple hops and varying directions", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)<-[:R1]-(:B)-[:R2]->(:C)");

    // Verify the pattern (A<-B->C)
    const results = executeTckQuery(graph, "MATCH (a:A)<-[:R1]-(b:B)-[:R2]->(c:C) RETURN a, b, c");
    expect(results).toHaveLength(1);

    const [a, b, c] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(a)).toBe("A");
    expect(getLabel(b)).toBe("B");
    expect(getLabel(c)).toBe("C");
  });

  // Custom test for scenario [4] with labeled nodes
  test("[custom] Create a pattern with multiple hops with multiple types and varying directions (labeled)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:R1]->(:B)<-[:R2]-(:C)-[:R3]->(:D)");

    // Verify each relationship exists
    const r1Check = executeTckQuery(graph, "MATCH (:A)-[r:R1]->(:B) RETURN r");
    expect(r1Check).toHaveLength(1);

    const r2Check = executeTckQuery(graph, "MATCH (:B)<-[r:R2]-(:C) RETURN r");
    expect(r2Check).toHaveLength(1);

    const r3Check = executeTckQuery(graph, "MATCH (:C)-[r:R3]->(:D) RETURN r");
    expect(r3Check).toHaveLength(1);
  });
});
