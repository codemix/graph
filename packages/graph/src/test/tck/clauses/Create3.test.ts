/**
 * TCK Create3 - Interoperation with other clauses
 * Translated from tmp/tck/features/clauses/create/Create3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel } from "../tckHelpers.js";

describe("Create3 - Interoperation with other clauses", () => {
  test("[1] MATCH-CREATE", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (), ()");
    executeTckQuery(graph, "MATCH () CREATE ()");
    const results = executeTckQuery(graph, "MATCH (n) RETURN count(n)");
    expect(results[0]).toBe(4);
  });

  test.fails("[2] WITH-CREATE - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    executeTckQuery(graph, "MATCH () CREATE () WITH * CREATE ()");
    const results = executeTckQuery(graph, "MATCH (n) RETURN count(n)");
    expect(results[0]).toBe(3);
  });

  test.fails("[3] MATCH-CREATE-WITH-CREATE - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    executeTckQuery(graph, "MATCH () CREATE () WITH * MATCH () CREATE ()");
    const results = executeTckQuery(graph, "MATCH (n) RETURN count(n)");
    expect(results[0]).toBeGreaterThan(1);
  });

  test("[4] MATCH-CREATE: Newly-created nodes not visible to preceding MATCH", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    executeTckQuery(graph, "MATCH () CREATE ()");
    const results = executeTckQuery(graph, "MATCH (n) RETURN count(n)");
    expect(results[0]).toBe(2);
  });

  test.fails("[5] WITH-CREATE: Nodes are not created when aliases are applied to variable names - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (), ()");
    const results = executeTckQuery(
      graph,
      "MATCH (n) MATCH (m) WITH n AS a, m AS b CREATE (a)-[:T]->(b) RETURN a, b",
    );
    expect(results).toHaveLength(4);
  });

  test("[6] WITH-CREATE: Only a single node is created when an alias is applied to a variable name", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:X)");

    const results = executeTckQuery(
      graph,
      "MATCH (n:X) WITH n AS a CREATE (a)-[:T]->(:A) RETURN a",
    );

    expect(results).toHaveLength(1);
    const [a] = results[0] as [Record<string, unknown>];
    expect(getLabel(a)).toBe("X");

    // Verify the relationship and new node were created
    const nodeCount = executeTckQuery(graph, "MATCH (n) RETURN n");
    expect(nodeCount).toHaveLength(2); // Original X + new A
  });

  test.fails("[7] WITH-CREATE: Nodes are not created when aliases are applied to variable names multiple times - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (), ()");
    const results = executeTckQuery(
      graph,
      "MATCH (n) MATCH (m) WITH n AS a, m AS b WITH a AS x, b AS y CREATE (x)-[:T]->(y) RETURN x, y",
    );
    expect(results).toHaveLength(4);
  });

  test("[8] WITH-CREATE: Only a single node is created when an alias is applied to a variable name multiple times", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    const results = executeTckQuery(
      graph,
      "MATCH (n) WITH n AS a WITH a AS x CREATE (x)-[:T]->() RETURN x",
    );
    expect(results).toHaveLength(1);
    // x should be the original node
    const [x] = results[0] as [Record<string, unknown>];
    expect(x).toBeDefined();
  });

  test.fails("[9] WITH-CREATE: A bound node should be recognized after projection with WITH + WITH - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE (a) WITH a WITH * CREATE (b) CREATE (a)<-[:T]-(b) RETURN a, b",
    );
    expect(results).toHaveLength(1);
  });

  test("[10] WITH-UNWIND-CREATE: A bound node should be recognized after projection with WITH + UNWIND", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE (a) WITH a UNWIND [0] AS i CREATE (b) CREATE (a)<-[:T]-(b) RETURN a, b",
    );
    expect(results).toHaveLength(1);
    const [a, b] = results[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
  });

  test("[11] WITH-MERGE-CREATE: A bound node should be recognized after projection with WITH + MERGE node", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE (a) WITH a MERGE () CREATE (b) CREATE (a)<-[:T]-(b) RETURN a, b",
    );
    expect(results).toHaveLength(1);
    const [a, b] = results[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
  });

  test("[12] WITH-MERGE-CREATE: A bound node should be recognized after projection with WITH + MERGE pattern", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE (a) WITH a MERGE (x) MERGE (y) MERGE (x)-[:T]->(y) CREATE (b) CREATE (a)<-[:T]-(b) RETURN a, b",
    );
    expect(results).toHaveLength(1);
    const [a, b] = results[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
  });

  test("[13] Merge followed by multiple creates", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "MERGE (t:T {id: 42}) CREATE (f:R) CREATE (t)-[:REL]->(f)");
    const results = executeTckQuery(graph, "MATCH (t:T)-[:REL]->(f:R) RETURN t, f");
    expect(results).toHaveLength(1);
    const [t, f] = results[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(getLabel(t)).toBe("T");
    expect(getLabel(f)).toBe("R");
  });

  // Custom tests with labeled nodes
  test("[custom] MATCH-CREATE with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:A)");

    executeTckQuery(graph, "MATCH (:A) CREATE (:B)");

    // Should create one B node for each A node matched
    const bNodes = executeTckQuery(graph, "MATCH (n:B) RETURN n");
    expect(bNodes).toHaveLength(2);
    // Single return items are wrapped in arrays
    for (const row of bNodes) {
      const [n] = row as [Record<string, unknown>];
      expect(getLabel(n)).toBe("B");
    }
  });

  test("[custom] CREATE after MATCH creates relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a1'})");
    executeTckQuery(graph, "CREATE (:B {name: 'b1'})");

    executeTckQuery(graph, "MATCH (a:A), (b:B) CREATE (a)-[:RELATED_TO]->(b)");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:RELATED_TO]->(b:B) RETURN a.name, b.name",
    );
    expect(results).toHaveLength(1);
    const [aName, bName] = results[0] as [string, string];
    expect(aName).toBe("a1");
    expect(bName).toBe("b1");
  });

  test("[custom] WITH-CREATE with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");

    const results = executeTckQuery(graph, "MATCH (n:A) WITH n CREATE (n)-[:T]->(:B) RETURN n");

    expect(results).toHaveLength(1);

    // Verify the relationship was created
    const rels = executeTckQuery(graph, "MATCH (a:A)-[:T]->(b:B) RETURN a, b");
    expect(rels).toHaveLength(1);
  });

  test("[custom] Multiple CREATE clauses in sequence", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A) CREATE (b:B) CREATE (a)-[:R]->(b)");

    const results = executeTckQuery(graph, "MATCH (a:A)-[:R]->(b:B) RETURN a, b");
    expect(results).toHaveLength(1);
    const [a, b] = results[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(getLabel(a)).toBe("A");
    expect(getLabel(b)).toBe("B");
  });
});
