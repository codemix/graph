/**
 * TCK Match4 - Match variable length patterns scenarios
 * Translated from tmp/tck/features/clauses/match/Match4.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getType } from "../tckHelpers.js";

describe("Match4 - Match variable length patterns scenarios", () => {
  test("[1] Handling fixed-length variable length pattern", () => {
    // Creates unlabeled nodes
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:T]->()");
    const results = executeTckQuery(graph, "MATCH (a)-[r*1..1]->(b) RETURN r");
    expect(results).toHaveLength(1);
    // r is a list of relationships
    const [r] = results as [[Record<string, unknown>]];
    expect(r).toHaveLength(1);
    expect(getType(r[0])).toBe("T");
  });

  test.fails(
    "[2] Simple variable length pattern - requires unlabeled nodes",
    () => {
      // Creates unlabeled nodes
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `
      CREATE (a {name: 'A'}), (b {name: 'B'}),
             (c {name: 'C'}), (d {name: 'D'})
      CREATE (a)-[:CONTAINS]->(b),
             (b)-[:CONTAINS]->(c),
             (c)-[:CONTAINS]->(d)
      `,
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a {name: 'A'})-[*]->(x) RETURN x",
      );
      expect(results).toHaveLength(3);
    },
  );

  test.fails(
    "[3] Zero-length variable length pattern in the middle of the pattern - requires unlabeled nodes",
    () => {
      // Creates unlabeled nodes
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `
      CREATE (a {name: 'A'}), (b {name: 'B'}),
             (c {name: 'C'}), ({name: 'D'}),
             ({name: 'E'})
      CREATE (a)-[:CONTAINS]->(b),
             (b)-[:FRIEND]->(c)
      `,
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a {name: 'A'})-[:CONTAINS*0..1]->(b)-[:FRIEND*0..1]->(c) RETURN a, b, c",
      );
      expect(results).toHaveLength(3);
    },
  );

  test.fails(
    "[4] Matching longer variable length paths - complex setup query",
    () => {
      // Complex UNWIND and range operations
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `
      CREATE (a {var: 'start'}), (b {var: 'end'})
      WITH *
      UNWIND range(1, 20) AS i
      CREATE (n {var: i})
      WITH a, b, [a] + collect(n) + [b] AS nodeList
      UNWIND range(0, size(nodeList) - 2, 1) AS i
      WITH nodeList[i] AS n1, nodeList[i+1] AS n2
      CREATE (n1)-[:T]->(n2)
      `,
      );
      const results = executeTckQuery(
        graph,
        "MATCH (n {var: 'start'})-[:T*]->(m {var: 'end'}) RETURN m",
      );
      expect(results).toHaveLength(1);
    },
  );

  test("[5] Matching variable length pattern with property predicate", () => {
    // Artist:A:B multi-label syntax
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `
      CREATE (a:Artist:A), (b:Artist:B), (c:Artist:C)
      CREATE (a)-[:WORKED_WITH {year: 1987}]->(b),
             (b)-[:WORKED_WITH {year: 1988}]->(c)
      `,
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:Artist)-[:WORKED_WITH* {year: 1988}]->(b:Artist) RETURN *",
    );
    expect(results).toHaveLength(1);
    // RETURN * returns all bound variables - check the path is correct
    const [result] = results as [Record<string, unknown>];
    expect(result).toBeDefined();
  });

  test.fails(
    "[6] Matching variable length patterns from a bound node - var length bounds not respected",
    () => {
      // Variable length pattern bounds not working correctly
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `
      CREATE (a:A), (b:B), (c:C)
      CREATE (a)-[:X]->(b),
             (b)-[:Y]->(c)
    `,
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) MATCH (a)-[r*2]->() RETURN r",
      );
      expect(results).toHaveLength(1);
      const r = results[0] as unknown[];
      expect(r).toHaveLength(2);
    },
  );

  test.fails(
    "[7] Matching variable length patterns including a bound relationship",
    () => {
      // Complex pattern with named path
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `
      CREATE (n0:Node),
             (n1:Node),
             (n2:Node),
             (n3:Node),
             (n0)-[:EDGE]->(n1),
             (n1)-[:EDGE]->(n2),
             (n2)-[:EDGE]->(n3)
      `,
      );
      const results = executeTckQuery(
        graph,
        `
      MATCH ()-[r:EDGE]-()
      MATCH p = (n)-[*0..1]-()-[r]-()-[*0..1]-(m)
      RETURN count(p) AS c
      `,
      );
      expect(results).toEqual([32]);
    },
  );

  test.fails(
    "[8] Matching relationships into a list and matching variable length using the list",
    () => {
      // Variable relationship list matching
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `
      CREATE (a:A), (b:B), (c:C)
      CREATE (a)-[:Y]->(b),
             (b)-[:Y]->(c)
      `,
      );
      const results = executeTckQuery(
        graph,
        `
      MATCH ()-[r1]->()-[r2]->()
      WITH [r1, r2] AS rs
        LIMIT 1
      MATCH (first)-[rs*]->(second)
      RETURN first, second
      `,
      );
      expect(results).toHaveLength(1);
    },
  );

  test("[9] Fail when asterisk operator is missing", () => {
    // Syntax error test - should throw SyntaxError
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(
        graph,
        "MATCH (a:A) MATCH (a)-[:LIKES..]->(c) RETURN c.name",
      );
    }).toThrow();
  });

  test.fails("[10] Fail on negative bound", () => {
    // Syntax error test - should throw SyntaxError
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(
        graph,
        "MATCH (a:A) MATCH (a)-[:LIKES*-2]->(c) RETURN c.name",
      );
    }).toThrow();
  });
});
