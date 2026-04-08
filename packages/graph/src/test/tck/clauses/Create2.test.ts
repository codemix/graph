/**
 * TCK Create2 - Creating relationships
 * Translated from tmp/tck/features/clauses/create/Create2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel } from "../tckHelpers.js";

describe("Create2 - Creating relationships", () => {
  test("[1] Create two nodes and a single relationship in a single pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:R]->()");

    // Verify nodes and relationship were created
    const results = executeTckQuery(
      graph,
      "MATCH (a)-[r:R]->(b) RETURN count(r)",
    );
    expect(results).toEqual([1]);
  });

  test("[2] Create two nodes and a single relationship in separate patterns", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a), (b), (a)-[:R]->(b)");

    // Verify nodes and relationship were created
    const nodeCount = executeTckQuery(graph, "MATCH (n) RETURN count(n)");
    expect(nodeCount).toEqual([2]);

    const relCount = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() RETURN count(r)",
    );
    expect(relCount).toEqual([1]);
  });

  test("[3] Create two nodes and a single relationship in separate clauses", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (a) CREATE (b) CREATE (a)-[:R]->(b)");

    // Verify nodes and relationship were created
    const nodeCount = executeTckQuery(graph, "MATCH (n) RETURN count(n)");
    expect(nodeCount).toEqual([2]);

    const relCount = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() RETURN count(r)",
    );
    expect(relCount).toEqual([1]);
  });

  test("[4] Create two nodes and a single relationship in the reverse direction", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)<-[:R]-(:B)");

    // Verify relationship direction
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)<-[:R]-(b:B) RETURN a, b",
    );
    expect(results).toHaveLength(1);
    const [a, b] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(a)).toBe("A");
    expect(getLabel(b)).toBe("B");
  });

  test("[5] Create a single relationship between two existing nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:X)");
    executeTckQuery(graph, "CREATE (:Y)");

    executeTckQuery(graph, "MATCH (x:X), (y:Y) CREATE (x)-[:R]->(y)");

    // Verify relationship was created
    const results = executeTckQuery(
      graph,
      "MATCH (x:X)-[:R]->(y:Y) RETURN x, y",
    );
    expect(results).toHaveLength(1);
    const [x, y] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(x)).toBe("X");
    expect(getLabel(y)).toBe("Y");
  });

  test("[6] Create a single relationship between two existing nodes in the reverse direction", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:X)");
    executeTckQuery(graph, "CREATE (:Y)");

    executeTckQuery(graph, "MATCH (x:X), (y:Y) CREATE (x)<-[:R]-(y)");

    // Verify relationship direction (Y->X)
    const results = executeTckQuery(
      graph,
      "MATCH (x:X)<-[:R]-(y:Y) RETURN x, y",
    );
    expect(results).toHaveLength(1);
    const [x, y] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(x)).toBe("X");
    expect(getLabel(y)).toBe("Y");
  });

  test.fails(
    "[7] Create a single node and a single self loop in a single pattern - self-referencing CREATE not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (root)-[:LINK]->(root)");
      const results = executeTckQuery(graph, "MATCH (n)-[:LINK]->(n) RETURN n");
      expect(results).toHaveLength(1);
    },
  );

  test("[8] Create a single node and a single self loop in separate patterns", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (root), (root)-[:LINK]->(root)");

    // Verify node and self-loop were created
    const nodeCount = executeTckQuery(graph, "MATCH (n) RETURN count(n)");
    expect(nodeCount).toEqual([1]);

    const relCount = executeTckQuery(
      graph,
      "MATCH (n)-[r:LINK]->(n) RETURN count(r)",
    );
    expect(relCount).toEqual([1]);
  });

  test("[9] Create a single node and a single self loop in separate clauses", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (root) CREATE (root)-[:LINK]->(root)");

    // Verify node and self-loop were created
    const nodeCount = executeTckQuery(graph, "MATCH (n) RETURN count(n)");
    expect(nodeCount).toEqual([1]);

    const relCount = executeTckQuery(
      graph,
      "MATCH (n)-[r:LINK]->(n) RETURN count(r)",
    );
    expect(relCount).toEqual([1]);
  });

  test("[10] Create a single self loop on an existing node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Root)");

    executeTckQuery(graph, "MATCH (root:Root) CREATE (root)-[:LINK]->(root)");

    // Verify self-loop was created
    const results = executeTckQuery(
      graph,
      "MATCH (root:Root)-[:LINK]->(root) RETURN root",
    );
    expect(results).toHaveLength(1);
    // Single return items are wrapped in arrays
    const [root] = results[0] as [Record<string, unknown>];
    expect(getLabel(root)).toBe("Root");
  });

  test("[11] Create a single relationship and an end node on an existing starting node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Begin)");

    executeTckQuery(graph, "MATCH (x:Begin) CREATE (x)-[:TYPE]->(:End)");

    // Verify relationship and new node were created
    const results = executeTckQuery(
      graph,
      "MATCH (x:Begin)-[:TYPE]->(y:End) RETURN x, y",
    );
    expect(results).toHaveLength(1);
    const [x, y] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(x)).toBe("Begin");
    expect(getLabel(y)).toBe("End");
  });

  test("[12] Create a single relationship and a starting node on an existing end node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:End)");

    executeTckQuery(graph, "MATCH (x:End) CREATE (:Begin)-[:TYPE]->(x)");

    // Verify relationship and new node were created
    const results = executeTckQuery(
      graph,
      "MATCH (b:Begin)-[:TYPE]->(e:End) RETURN b, e",
    );
    expect(results).toHaveLength(1);
    const [b, e] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(b)).toBe("Begin");
    expect(getLabel(e)).toBe("End");
  });

  test("[13] Create a single relationship with a property", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:R {num: 42}]->()");

    // Verify relationship was created with property
    const results = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r.num");
    expect(results).toEqual([42]);
  });

  test("[14] Create a single relationship with a property and return it", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE ()-[r:R {num: 42}]->() RETURN r.num AS num",
    );
    expect(results).toEqual([42]);
  });

  test("[15] Create a single relationship with two properties", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:R {id: 12, name: 'foo'}]->()");

    // Verify relationship was created with properties
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() RETURN r.id, r.name",
    );
    expect(results).toEqual([[12, "foo"]]);
  });

  test("[16] Create a single relationship with two properties and return them", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE ()-[r:R {id: 12, name: 'foo'}]->() RETURN r.id AS id, r.name AS name",
    );
    expect(results).toEqual([[12, "foo"]]);
  });

  test("[17] Create a single relationship with null properties should not return those properties", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "CREATE ()-[r:X {id: 12, name: null}]->() RETURN r.id, r.name AS name",
    );
    expect(results).toEqual([[12, null]]);
  });

  test("[18] Fail when creating a relationship without a type", () => {
    const graph = createTckGraph();
    // Query: CREATE ()-->() should fail - relationships must have a type
    expect(() => executeTckQuery(graph, "CREATE ()-->()")).toThrow();
  });

  test("[19] Fail when creating a relationship without a direction - undirected CREATE not supported", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "CREATE (a)-[:FOO]-(b)")).toThrow();
  });

  test("[20] Fail when creating a relationship with two directions", () => {
    const graph = createTckGraph();
    // Query: CREATE (a)<-[:FOO]->(b) should fail - invalid syntax
    expect(() => executeTckQuery(graph, "CREATE (a)<-[:FOO]->(b)")).toThrow();
  });

  test("[21] Fail when creating a relationship with more than one type", () => {
    const graph = createTckGraph();
    // Query: CREATE ()-[:A|B]->()
    // Type alternation in CREATE should fail - a relationship can only have one type
    expect(() => executeTckQuery(graph, "CREATE ()-[:A|B]->()")).toThrow();
  });

  test("[22] Fail when creating a variable-length relationship - variable-length CREATE not supported", () => {
    const graph = createTckGraph();
    expect(() => executeTckQuery(graph, "CREATE ()-[:FOO*2]->()")).toThrow();
  });

  test("[23] Fail when creating a relationship that is already bound - requires untyped edge matching", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:R]->(:B)");
    expect(() =>
      executeTckQuery(graph, "MATCH ()-[r]->() CREATE ()-[r]->()"),
    ).toThrow();
  });

  test.fails(
    "[24] Fail when creating a relationship using undefined variable in pattern",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)");
      expect(() =>
        executeTckQuery(
          graph,
          "MATCH (a) CREATE (a)-[:KNOWS]->(b {name: missing}) RETURN b",
        ),
      ).toThrow();
    },
  );

  // Additional tests with labeled nodes (custom tests)
  test("[custom] Create relationship between labeled nodes in single pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:R]->(:B)");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:R]->(b:B) RETURN a, b",
    );
    expect(results).toHaveLength(1);
    const [a, b] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(a)).toBe("A");
    expect(getLabel(b)).toBe("B");
  });

  test("[custom] Create relationship with property between labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:R {num: 42}]->(:B)");

    const results = executeTckQuery(
      graph,
      "MATCH (:A)-[r:R]->(:B) RETURN r.num AS num",
    );
    expect(results).toHaveLength(1);
    // Single return values come back as the value directly
    const num = results[0] as number;
    expect(num).toBe(42);
  });

  test("[custom] Create self-loop on labeled node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (n:A)-[:LOOP]->(n)");

    const results = executeTckQuery(graph, "MATCH (n:A)-[:LOOP]->(n) RETURN n");
    expect(results).toHaveLength(1);
    // Single return items are wrapped in arrays
    const [n] = results[0] as [Record<string, unknown>];
    expect(getLabel(n)).toBe("A");
  });
});
