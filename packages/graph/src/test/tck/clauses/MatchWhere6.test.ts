/**
 * TCK MatchWhere6 - Filter optional matches
 * Translated from tmp/tck/features/clauses/match-where/MatchWhere6.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("MatchWhere6 - Filter optional matches", () => {
  test.fails(
    "[1] Filter node with label predicate after MATCH and OPTIONAL MATCH - requires unlabeled nodes",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (a:A {name: 'A'}), (b:B {name: 'B'}), (c:C {name: 'C'}), (d:D {name: 'C'})
       CREATE (a)-[:T]->(b),
             (a)-[:T]->(c),
             (a)-[:T]->(d)`,
      );
      const results = executeTckQuery(
        graph,
        `MATCH (a)-->(b)
       WHERE b:B
       OPTIONAL MATCH (a)-->(c)
       WHERE c:C
       RETURN a.name`,
      );
      expect(results).toHaveLength(1);
      expect((results[0] as [string])[0]).toBe("A");
    },
  );

  test.fails(
    "[2] Filter node with false node label predicate after OPTIONAL MATCH - OPTIONAL MATCH not fully supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (a:A {name: 'A'}), (b:B {name: 'B'}), (c:C {name: 'C'})
       CREATE (a)-[:T]->(b),
             (a)-[:T]->(c)`,
      );
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)
       OPTIONAL MATCH (a)-->(b)
       WHERE b:D
       RETURN a.name, b.name`,
      );
      expect(results).toHaveLength(1);
      const [aName, bName] = results[0] as [string, string | null];
      expect(aName).toBe("A");
      expect(bName).toBe(null);
    },
  );

  test("[3] Filter node with property predicate after OPTIONAL MATCH", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (a:A {name: 'A'}), (b:B {name: 'B'}), (c:C {name: 'C'})
       CREATE (a)-[:T]->(b),
             (a)-[:T]->(c)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)
       OPTIONAL MATCH (a)-->(b)
       WHERE b.name = 'X'
       RETURN a.name, b.name`,
    );
    expect(results).toHaveLength(1);
    const [aName, bName] = results[0] as [string, string | null];
    expect(aName).toBe("A");
    expect(bName).toBe(null);
  });

  test("[4] Do not fail when predicates on optionally matched and missed nodes are invalid", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (a:A {id: 1}), (b:B {id: 2})
       CREATE (a)-[:T]->(b)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)
       OPTIONAL MATCH (a)-->(b:C)
       WHERE b.id > 0
       RETURN a.id, b.id`,
    );
    expect(results).toHaveLength(1);
    const [aId, bId] = results[0] as [number, number | null];
    expect(aId).toBe(1);
    expect(bId).toBe(null);
  });

  test.fails(
    "[5] Matching and optionally matching with unbound nodes - OPTIONAL MATCH with WITH not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (a:A {name: 'A'}), (b:B {name: 'B'}), (c:C {name: 'C'})
       CREATE (a)-[:KNOWS]->(b),
             (b)-[:KNOWS]->(c)`,
      );
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)
       WITH a
       MATCH (b:B)
       OPTIONAL MATCH (a)-[r:KNOWS]->(b)
       RETURN a.name, b.name, r`,
      );
      expect(results).toHaveLength(1);
      const [aName, bName] = results[0] as [string, string];
      expect(aName).toBe("A");
      expect(bName).toBe("B");
    },
  );

  test("[6] Join nodes on non-equality of properties", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE
        (:X {val: 1})-[:E1]->(:Y {val: 2})-[:E2]->(:Z {val: 3}),
        (:X {val: 4})-[:E1]->(:Y {val: 5}),
        (:X {val: 6})`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (x:X)
       OPTIONAL MATCH (x)-[:E1]->(y:Y)
       WHERE x.val < y.val
       RETURN x, y`,
    );
    expect(results).toHaveLength(3);
  });

  test("[7] OPTIONAL MATCH on two relationships", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (a:A {name: 'A'}), (b:B {name: 'B'}), (c:C {name: 'C'}), (d:D {name: 'D'})
       CREATE (a)-[:T]->(b),
             (b)-[:T]->(c),
             (c)-[:T]->(d)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-->(b:B)
       OPTIONAL MATCH (b)-->(c:C)-->(d:D)
       RETURN a.name, b.name, c.name, d.name`,
    );
    expect(results).toHaveLength(1);
    const [aName, bName, cName, dName] = results[0] as [
      string,
      string,
      string,
      string,
    ];
    expect(aName).toBe("A");
    expect(bName).toBe("B");
    expect(cName).toBe("C");
    expect(dName).toBe("D");
  });

  test.fails(
    "[8] Two OPTIONAL MATCH clauses and WHERE - multiple OPTIONAL MATCH not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (a:A {name: 'A'}), (b:B {name: 'B'}), (c:C {name: 'C'})
       CREATE (a)-[:T]->(b),
             (a)-[:T]->(c)`,
      );
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)
       OPTIONAL MATCH (a)-->(b:B)
       OPTIONAL MATCH (a)-->(c:C)
       WHERE c.name = 'C'
       RETURN a.name, b.name, c.name`,
      );
      expect(results).toHaveLength(1);
      const [aName, bName, cName] = results[0] as [string, string, string];
      expect(aName).toBe("A");
      expect(bName).toBe("B");
      expect(cName).toBe("C");
    },
  );
});
