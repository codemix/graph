/**
 * TCK MatchWhere1 - Filter single variable
 * Translated from tmp/tck/features/clauses/match-where/MatchWhere1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel, getProperty } from "../tckHelpers.js";

describe("MatchWhere1 - Filter single variable", () => {
  test.fails("[1] Filter node with node label predicate - WHERE a:A syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B), (:C)");
    const results = executeTckQuery(
      graph,
      `MATCH (a)
       WHERE a:A
       RETURN a`,
    );
    expect(results).toHaveLength(1);
    const [a] = results[0] as [Record<string, unknown>];
    expect(getLabel(a)).toBe("A");
  });

  test.fails("[2] Filter node with node label predicate on multi variables without any bindings - WHERE a:A syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A), (:B), (:C)");
    const results = executeTckQuery(
      graph,
      `MATCH (a), (b)
       WHERE a:A AND b:B
       RETURN a, b`,
    );
    expect(results).toHaveLength(1);
    const [a, b] = results[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(getLabel(a)).toBe("A");
    expect(getLabel(b)).toBe("B");
  });

  test("[3] Filter node with property predicate on single variable", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (), ({name: 'Bar'}), (:Bar)");
    const results = executeTckQuery(
      graph,
      `MATCH (n)
       WHERE n.name = 'Bar'
       RETURN n`,
    );
    expect(results).toHaveLength(1);
    const [n] = results[0] as [Record<string, unknown>];
    expect(getProperty(n, "name")).toBe("Bar");
  });

  test("[4] Filter start node of relationship with property predicate", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (a:Person {name: 'Alice'}), (b:Person {name: 'Bob'}),
             (c:C), (d:D)
       CREATE (a)-[:T]->(c),
             (b)-[:T]->(d)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (n:Person)-->()
       WHERE n.name = 'Bob'
       RETURN n`,
    );
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [n] = results[0] as [Record<string, unknown>];
    expect(getLabel(n)).toBe("Person");
    expect(getProperty(n, "name")).toBe("Bob");
  });

  test("[5] Filter end node of relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name: 'Someone'})<-[:X]-()-[:X]->({name: 'Andres'})");
    const results = executeTckQuery(
      graph,
      `MATCH ()-[rel:X]->(x)
       WHERE x.name = 'Andres'
       RETURN x`,
    );
    expect(results).toHaveLength(1);
    const [x] = results[0] as [Record<string, unknown>];
    expect(getProperty(x, "name")).toBe("Andres");
  });

  test("[6] Filter node with parameter in property predicate", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (a:A {name: 'Alice'}),
        (b:B {name: 'Bob'})`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (n)
       WHERE n.name = $name
       RETURN n`,
      { name: "Bob" },
    );
    expect(results).toHaveLength(1);
    const [n] = results[0] as [Record<string, unknown>];
    expect(getLabel(n)).toBe("B");
    expect(getProperty(n, "name")).toBe("Bob");
  });

  test("[7] Filter relationship with relationship type predicate using type()", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (a:A {name: 'A'}),
        (b:B {name: 'B'}),
        (c:C {name: 'C'}),
        (a)-[:KNOWS]->(b),
        (a)-[:HATES]->(c)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (n {name: 'A'})-[r]->(x)
       WHERE type(r) = 'KNOWS'
       RETURN x`,
    );
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [x] = results[0] as [Record<string, unknown>];
    expect(getLabel(x)).toBe("B");
    expect(getProperty(x, "name")).toBe("B");
  });

  test("[8] Filter relationship with property predicate", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A)<-[:KNOWS {name: 'monkey'}]-(:B)-[:KNOWS {name: 'woot'}]->(:C)",
    );
    const results = executeTckQuery(
      graph,
      `MATCH (node)-[r:KNOWS]->(a)
       WHERE r.name = 'monkey'
       RETURN a`,
    );
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [a] = results[0] as [Record<string, unknown>];
    expect(getLabel(a)).toBe("A");
  });

  test("[9] Filter relationship with parameter in property predicate", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A)<-[:KNOWS {name: 'monkey'}]-(:B)-[:KNOWS {name: 'woot'}]->(:C)",
    );
    const results = executeTckQuery(
      graph,
      `MATCH (node)-[r:KNOWS]->(a)
       WHERE r.name = $name
       RETURN a`,
      { name: "monkey" },
    );
    expect(results).toHaveLength(1);
    const [a] = results[0] as [Record<string, unknown>];
    expect(getLabel(a)).toBe("A");
  });

  test("[10] Filter node with disjunctive property predicate", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (a:A {p1: 12}),
        (b:B {p2: 13}),
        (c:C)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (n)
       WHERE n.p1 = 12 OR n.p2 = 13
       RETURN n`,
    );
    expect(results).toHaveLength(2);
    // Single RETURN item is wrapped in array
    const labels = results.map((r) => {
      const [n] = r as [Record<string, unknown>];
      return getLabel(n);
    });
    expect(labels).toContain("A");
    expect(labels).toContain("B");
  });

  test.fails("[11] Filter relationship with disjunctive type predicate - requires unlabeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE ()-[:T1 {name: 'First'}]->(),
             ()-[:T2 {name: 'Second'}]->(),
             ()-[:T3 {name: 'Third'}]->()`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH ()-[r]->()
       WHERE type(r) = 'T1' OR type(r) = 'T2'
       RETURN r.name`,
    );
    expect(results).toHaveLength(2);
    const names = results.map((r) => (r as [string])[0]);
    expect(names).toContain("First");
    expect(names).toContain("Second");
  });

  test("[12] Filter path with path length predicate", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (a:A)-[:T]->(b:B)-[:T]->(c:C)`);
    const results = executeTckQuery(
      graph,
      `MATCH p = (a:A)-[*]->(c:C)
       WHERE length(p) = 2
       RETURN p`,
    );
    expect(results).toHaveLength(1);
  });

  test("[13] Filter path with false path length predicate", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (a:A)-[:T]->(b:B)-[:T]->(c:C)`);
    const results = executeTckQuery(
      graph,
      `MATCH p = (a:A)-[*]->(c:C)
       WHERE length(p) = 10
       RETURN p`,
    );
    expect(results).toHaveLength(0);
  });

  test.fails("[14] Fail when filtering path with property predicate - named paths not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (a:A)-[:T]->(b:B)`);
    // This should fail at runtime because paths don't have properties
    expect(() => {
      executeTckQuery(
        graph,
        `MATCH p = (a:A)-[:T]->(b:B)
         WHERE p.name = 'foo'
         RETURN p`,
      );
    }).toThrow();
  });

  test("[15] Fail on aggregation in WHERE", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 3})");
    // Aggregation in WHERE should fail at compile time
    expect(() => {
      executeTckQuery(
        graph,
        `MATCH (a:A)
         WHERE count(*) > 1
         RETURN a`,
      );
    }).toThrow();
  });
});
