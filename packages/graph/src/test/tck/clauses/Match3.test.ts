/**
 * TCK Match3 - Match fixed length patterns
 * Translated from tmp/tck/features/clauses/match/Match3.feature
 */
import { describe, test, expect } from "vitest";
import {
  createTckGraph,
  executeTckQuery,
  getLabel,
  getType,
  getProperty,
  getId,
} from "../tckHelpers.js";

describe("Match3 - Match fixed length patterns", () => {
  test("[1] Get neighbours", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A {num: 1})-[:KNOWS]->(b:B {num: 2})");
    const results = executeTckQuery(
      graph,
      "MATCH (n1)-[rel:KNOWS]->(n2) RETURN n1, n2",
    );
    expect(results).toHaveLength(1);
    const [n1, n2] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(n1)).toBe("A");
    expect(getProperty(n1, "num")).toBe(1);
    expect(getLabel(n2)).toBe("B");
    expect(getProperty(n2, "num")).toBe(2);
  });

  test("[2] Directed match of a simple relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:LOOP]->(:B)");
    const results = executeTckQuery(graph, "MATCH (a)-[r]->(b) RETURN a, r, b");
    expect(results).toHaveLength(1);
    const [a, r, b] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(a)).toBe("A");
    expect(getType(r)).toBe("LOOP");
    expect(getLabel(b)).toBe("B");
  });

  test("[3] Undirected match on simple relationship graph", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:LOOP]->(:B)");
    const results = executeTckQuery(graph, "MATCH (a)-[r]-(b) RETURN a, r, b");
    expect(results).toHaveLength(2);
    // Both directions: A->B and B<-A
    const labelPairs = results.map((row) => {
      const [a, , b] = row as [
        Record<string, unknown>,
        unknown,
        Record<string, unknown>,
      ];
      return `${getLabel(a)}-${getLabel(b)}`;
    });
    expect(labelPairs).toContain("A-B");
    expect(labelPairs).toContain("B-A");
  });

  test("[4] Get two related nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `
      CREATE (a:A {num: 1}),
        (a)-[:KNOWS]->(b:B {num: 2}),
        (a)-[:KNOWS]->(c:C {num: 3})
    `,
    );
    const results = executeTckQuery(
      graph,
      "MATCH ()-[rel:KNOWS]->(x) RETURN x",
    );
    expect(results).toHaveLength(2);
    // Single return items are wrapped in arrays
    const labels = results.map((r) => {
      const [x] = r as [Record<string, unknown>];
      return getLabel(x);
    });
    expect(labels).toContain("B");
    expect(labels).toContain("C");
  });

  test("[5] Return two subgraphs with bound undirected relationship", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (a:A {num: 1})-[:REL {name: 'r'}]->(b:B {num: 2})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a)-[r {name: 'r'}]-(b) RETURN a, b",
    );
    expect(results).toHaveLength(2);
    // Both directions
    const labelPairs = results.map((row) => {
      const [a, b] = row as [Record<string, unknown>, Record<string, unknown>];
      return `${getLabel(a)}-${getLabel(b)}`;
    });
    expect(labelPairs).toContain("A-B");
    expect(labelPairs).toContain("B-A");
  });

  test("[6] Matching a relationship pattern using a label predicate", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `
      CREATE (a:A), (b1:Foo), (b2:B)
      CREATE (a)-[:T]->(b1),
             (a)-[:T]->(b2)
    `,
    );
    const results = executeTckQuery(graph, "MATCH (a)-->(b:Foo) RETURN b");
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [b] = results[0] as [Record<string, unknown>];
    expect(getLabel(b)).toBe("Foo");
  });

  test("[7] Matching nodes with many labels - multi-label not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A:B:C {name: 'abc'})");
    const results = executeTckQuery(graph, "MATCH (n:A:B:C) RETURN n");
    expect(results).toHaveLength(1);
    // Single return items are wrapped in arrays
    const [n] = results[0] as [Record<string, unknown>];
    expect(getProperty(n, "name")).toBe("abc");
  });

  test("[8] Matching using relationship predicate with multiples of the same type", () => {
    // [:T|T] syntax - duplicates should match the same edge once
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:T]->(b:B)");
    const results = executeTckQuery(graph, "MATCH (a)-[:T|T]->(b) RETURN a, b");
    expect(results).toHaveLength(1);
    const [a, b] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(a)).toBe("A");
    expect(getLabel(b)).toBe("B");
  });

  test("[9] Get related to related to", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (a:A {num: 1})-[:KNOWS]->(b:B {num: 2})-[:FRIEND]->(c:C {num: 3})",
    );
    const results = executeTckQuery(graph, "MATCH (n)-->(a)-->(b) RETURN b");
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [b] = results[0] as [Record<string, unknown>];
    expect(getLabel(b)).toBe("C");
    expect(getProperty(b, "num")).toBe(3);
  });

  test("[10] Matching using self-referencing pattern returns no result - requires unlabeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({value: 1})");
    const results = executeTckQuery(graph, "MATCH (a)-->(a) RETURN a");
    expect(results).toEqual([]);
  });

  test("[11] Undirected match in self-relationship graph", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:LOOP]->(a)");
    const results = executeTckQuery(graph, "MATCH (a)-[r]-(b) RETURN a, r, b");
    // Self-loop should only be matched once with direction='both'
    expect(results).toHaveLength(1);
    const [a, r, b] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(a)).toBe("A");
    expect(getType(r)).toBe("LOOP");
    expect(getId(a)).toBe(getId(b)); // Same node (self-loop)
  });

  test("[12] Undirected match of self-relationship in self-relationship graph", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:LOOP]->(a)");
    const results = executeTckQuery(graph, "MATCH (n)-[r]-(n) RETURN n, r");
    expect(results).toHaveLength(1);
    const [n, r] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(n)).toBe("A");
    expect(getType(r)).toBe("LOOP");
  });

  test("[13] Directed match on self-relationship graph", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:LOOP]->(a)");
    const results = executeTckQuery(graph, "MATCH (a)-[r]->(b) RETURN a, r, b");
    expect(results).toHaveLength(1);
    const [a, r, b] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(a)).toBe("A");
    expect(getType(r)).toBe("LOOP");
    expect(getId(a)).toBe(getId(b)); // Same node
  });

  test("[14] Directed match of self-relationship on self-relationship graph", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a:A)-[:LOOP]->(a)");
    const results = executeTckQuery(graph, "MATCH (n)-[r]->(n) RETURN n, r");
    expect(results).toHaveLength(1);
    const [n, r] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(n)).toBe("A");
    expect(getType(r)).toBe("LOOP");
  });

  test.fails(
    "[15] Mixing directed and undirected pattern parts with self-relationship, simple - requires relationship uniqueness",
    () => {
      // This test requires relationship uniqueness constraint (same edge can't be matched twice in one pattern)
      // Currently returns 3 results instead of 2: the T1 edge is matched as both r1 (directed) and r2 (undirected)
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `
      CREATE (:A)-[:T1]->(l:Looper),
             (l)-[:LOOP]->(l),
             (l)-[:T2]->(:B)
    `,
      );
      const results = executeTckQuery(
        graph,
        "MATCH (x:A)-[r1]->(y)-[r2]-(z) RETURN x, r1, y, r2, z",
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[16] Mixing directed and undirected pattern parts with self-relationship, undirected",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (:A)-[:T1]->(l:Looper), (l)-[:LOOP]->(l), (l)-[:T2]->(:B)`,
      );
      const results = executeTckQuery(
        graph,
        "MATCH (x)-[r1]-(y)-[r2]-(z) RETURN x, r1, y, r2, z",
      );
      expect(results).toHaveLength(6);
    },
  );

  test.fails("[17] Handling cyclic patterns - requires unlabeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a)-[:T]->(b)-[:T]->(a)");
    const results = executeTckQuery(
      graph,
      "MATCH (a)-[r1]->(b)-[r2]->(a) RETURN a, r1, b, r2",
    );
    expect(results).toHaveLength(2);
  });

  test.fails(
    "[18] Handling cyclic patterns when separated into two parts - requires unlabeled nodes",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a)-[:T]->(b)-[:T]->(a)");
      const results = executeTckQuery(
        graph,
        "MATCH (a)-[r1]->(b) MATCH (b)-[r2]->(a) RETURN a, r1, b, r2",
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[19] Two bound nodes pointing to the same node - requires unlabeled nodes",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a)-[:T]->(c), (b)-[:T]->(c)");
      const results = executeTckQuery(
        graph,
        "MATCH (a)-->(c)<--(b) RETURN a, b, c",
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[20] Three bound nodes pointing to the same node - requires unlabeled nodes",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (a)-[:T]->(d), (b)-[:T]->(d), (c)-[:T]->(d)",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a)-->(d)<--(b), (c)-->(d) RETURN a, b, c, d",
      );
      expect(results).toHaveLength(6);
    },
  );

  test.fails(
    "[21] Three bound nodes pointing to the same node with extra connections - requires unlabeled nodes",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (a)-[:T]->(d), (b)-[:T]->(d), (c)-[:T]->(d), (a)-[:T]->(b), (b)-[:T]->(c), (c)-[:T]->(a)",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a)-->(d)<--(b), (c)-->(d) RETURN a, b, c, d",
      );
      expect(results).toHaveLength(6);
    },
  );

  test.fails(
    "[22] Returning bound nodes that are not part of the pattern - requires unlabeled nodes",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a)-[:T]->(b)");
      const results = executeTckQuery(
        graph,
        "MATCH (a)-->(b) RETURN a, b, 1 AS c",
      );
      expect(results).toHaveLength(1);
    },
  );

  test.fails(
    "[23] Matching disconnected patterns - unlabeled target nodes (by design)",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:T]->(:B), (:C)-[:T]->(:D)");
      const results = executeTckQuery(
        graph,
        "MATCH (a)-->(b) MATCH (c)-->(d) RETURN a, b, c, d",
      );
      expect(results).toHaveLength(4);
    },
  );

  test("[24] Matching twice with duplicate relationship types on same relationship - unlabeled target node (by design)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
    const results = executeTckQuery(
      graph,
      "MATCH (a1)-[r:T]->() WITH r, a1 MATCH (a1)-[r:T]->(b2) RETURN a1, r, b2",
    );
    expect(results).toHaveLength(1);
    const [a1, r, b2] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(a1)).toBe("A");
    expect(getType(r)).toBe("T");
    expect(getLabel(b2)).toBe("B");
  });

  test.fails(
    "[25] Matching twice with an additional node label - requires unlabeled nodes",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:T]->(:B:C)");
      const results = executeTckQuery(
        graph,
        "MATCH (a)-->(b) MATCH (a)-->(b:C) RETURN a, b",
      );
      expect(results).toHaveLength(1);
    },
  );

  test("[26] Matching twice with a duplicate predicate - multi-label not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A:B)");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A:B) MATCH (a:A) RETURN a",
    );
    expect(results).toHaveLength(1);
    // Single return items are wrapped in arrays
    const [a] = results[0] as [Record<string, unknown>];
    // Should match node with both A and B labels
    expect(getLabel(a)).toMatch(/A|B/);
  });

  test("[27] Matching from null nodes should return no results owing to finding no matches", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "OPTIONAL MATCH (a:A) MATCH (a)-->(b:B) RETURN b",
    );
    expect(results).toEqual([]);
  });

  test.fails(
    "[28] Matching from null nodes should return no results owing to matches being filtered out",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)");
      const results = executeTckQuery(
        graph,
        "OPTIONAL MATCH (a:C) MATCH (a)-->(b:B) RETURN b",
      );
      expect(results).toEqual([]);
    },
  );

  test.fails(
    "[29] Fail when re-using a relationship in the same pattern",
    () => {
      const graph = createTckGraph();
      expect(() =>
        executeTckQuery(graph, "MATCH (a)-[r]->(b)-[r]->(c) RETURN r"),
      ).toThrow();
    },
  );

  test.fails("[30] Fail when using a list or nodes as a node", () => {
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(
        graph,
        "MATCH (n) WITH collect(n) AS nodes MATCH (nodes)-->(b) RETURN b",
      ),
    ).toThrow();
  });
});
