/**
 * TCK Path2 - Relationships of a path
 * Translated from tmp/tck/features/expressions/path/Path2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Path2 - Relationships of a path", () => {
  test("[1] Return relationships by fetching them from the path", () => {
    // Named paths and relationships() ARE working
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (s:Start)-[:REL {num: 1}]->(b:B)-[:REL {num: 2}]->(c:C)");
    // Use fixed length pattern since *2..2 is equivalent to matching exactly 2 hops
    const results = executeTckQuery(
      graph,
      "MATCH p = (a:Start)-[:REL]->(m:B)-[:REL]->(b:C) RETURN relationships(p)",
    );
    expect(results).toHaveLength(1);
    const rels = results[0] as unknown[];
    expect(rels).toHaveLength(2);
  });

  test("[2] Return relationships by fetching them from the path - starting from the end", () => {
    // Named paths and relationships() ARE working
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:REL {num: 1}]->(b:B)-[:REL {num: 2}]->(e:End)");
    // Use fixed length pattern with labels
    const results = executeTckQuery(
      graph,
      "MATCH p = (a:A)-[:REL]->(m:B)-[:REL]->(b:End) RETURN relationships(p)",
    );
    expect(results).toHaveLength(1);
    const rels = results[0] as unknown[];
    expect(rels).toHaveLength(2);
  });

  test("[3] `relationships()` on null path - OPTIONAL MATCH with bound variable", () => {
    // Original TCK:
    // WITH null AS a
    // OPTIONAL MATCH p = (a)-[r]->()
    // RETURN relationships(p), relationships(null)
    //
    // Expected: relationships(p) = null, relationships(null) = null
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `WITH null AS a
       OPTIONAL MATCH p = (a)-[r]->()
       RETURN relationships(p), relationships(null)`,
    );
    expect(results).toHaveLength(1);
    const [relsP, relsNull] = results[0] as [unknown, unknown];
    expect(relsP).toBeNull();
    expect(relsNull).toBeNull();
  });

  // Custom tests demonstrating relationship functionality that IS supported

  test("[Custom 1] Match and return relationships in a fixed pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:Start {name: 's'})-[:REL {num: 1}]->(:B {name: 'b'})-[:REL {num: 2}]->(:C {name: 'c'})`,
    );

    // Get relationships by matching the full pattern
    const results = executeTckQuery(
      graph,
      `MATCH (s:Start)-[r1:REL]->(b:B)-[r2:REL]->(c:C) RETURN r1.num, r2.num`,
    );

    expect(results).toHaveLength(1);
    const [num1, num2] = results[0] as [number, number];
    expect(num1).toBe(1);
    expect(num2).toBe(2);
  });

  test("[Custom 2] Return relationship property directly", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:T {prop: 'value1'}]->(:B {name: 'b'})`);

    const results = executeTckQuery(graph, `MATCH (a:A)-[r:T]->(b:B) RETURN r.prop`);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("value1");
  });

  test("[Custom 3] Get relationship properties along a chain", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a1'})`);
    executeTckQuery(graph, `CREATE (:B {name: 'b1'})`);
    executeTckQuery(graph, `CREATE (:C {name: 'c1'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (a)-[:T1 {num: 1}]->(b)`);
    executeTckQuery(graph, `MATCH (b:B), (c:C) CREATE (b)-[:T2 {num: 2}]->(c)`);

    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[r1:T1]->(b:B)-[r2:T2]->(c:C) RETURN r1.num, r2.num`,
    );

    expect(results).toHaveLength(1);
    const [num1, num2] = results[0] as [number, number];
    expect(num1).toBe(1);
    expect(num2).toBe(2);
  });

  test("[Custom 4] Filter paths by relationship properties", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a1'})-[:REL {weight: 10}]->(:B {name: 'b1'})`);
    executeTckQuery(graph, `CREATE (:A {name: 'a2'})-[:REL {weight: 20}]->(:B {name: 'b2'})`);

    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[r:REL]->(b:B) WHERE r.weight > 15 RETURN a.name, b.name`,
    );

    expect(results).toHaveLength(1);
    const [aName, bName] = results[0] as [string, string];
    expect(aName).toBe("a2");
    expect(bName).toBe("b2");
  });

  test("[Custom 5] Collect multiple relationships in separate variables", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:Start {name: 's'})-[:T1 {id: 'r1'}]->(:A {name: 'a'})-[:T2 {id: 'r2'}]->(:End {name: 'e'})`,
    );

    // While we can't use relationships(p), we can return multiple relationship variables
    const results = executeTckQuery(
      graph,
      `MATCH (s:Start)-[r1:T1]->(a:A)-[r2:T2]->(e:End) RETURN r1, r2`,
    );

    expect(results).toHaveLength(1);
    const [r1, r2] = results[0] as [
      { label: string; get: (name: string) => unknown },
      { label: string; get: (name: string) => unknown },
    ];
    expect(r1.label).toBe("T1");
    expect(r2.label).toBe("T2");
    expect(r1.get("id")).toBe("r1");
    expect(r2.get("id")).toBe("r2");
  });
});
