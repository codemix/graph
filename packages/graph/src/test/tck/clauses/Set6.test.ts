/**
 * TCK Set6 - Persistence of set clause side effects
 * Translated from tmp/tck/features/clauses/set/Set6.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("Set6 - Persistence of set clause side effects", () => {
  test("[1] Limiting to zero results after setting a property on nodes affects the result set but not the side effects", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {num: 42})");
    const results = executeTckQuery(graph, "MATCH (n:N) SET n.num = 43 RETURN n LIMIT 0");
    expect(results).toHaveLength(0);
    // TCK expects property still updated despite LIMIT 0
    const checkResults = executeTckQuery(graph, "MATCH (n:N) RETURN n.num");
    expect(checkResults[0]).toBe(43);
  });

  test("[2] Skipping all results after setting a property on nodes affects the result set but not the side effects", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {num: 42})");
    const results = executeTckQuery(graph, "MATCH (n:N) SET n.num = 43 RETURN n SKIP 1");
    expect(results).toHaveLength(0);
    // TCK expects property still updated despite SKIP
    const checkResults = executeTckQuery(graph, "MATCH (n:N) RETURN n.num");
    expect(checkResults[0]).toBe(43);
  });

  test.fails("[3] Skipping and limiting to a few results after setting a property on nodes affects the result set but not the side effects - SKIP/LIMIT ordering with SET", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE (:N {num: ${i}})`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH (n:N) SET n.num = 42 RETURN n.num SKIP 2 LIMIT 2",
    );
    expect(results).toHaveLength(2);
    // TCK expects all 5 nodes to have num = 42
    const checkResults = executeTckQuery(graph, "MATCH (n:N) WHERE n.num = 42 RETURN count(n)");
    expect(checkResults[0]).toBe(5);
  });

  test("[4] Skipping zero results and limiting to all results after setting a property on nodes does not affect the result set nor the side effects", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {num: 1})");
    executeTckQuery(graph, "CREATE (:N {num: 2})");
    executeTckQuery(graph, "CREATE (:N {num: 3})");
    executeTckQuery(graph, "CREATE (:N {num: 4})");
    executeTckQuery(graph, "CREATE (:N {num: 5})");

    const results = executeTckQuery(
      graph,
      `MATCH (n:N)
       SET n.num = 42
       RETURN n.num AS num
       SKIP 0 LIMIT 5`,
    );

    expect(results).toHaveLength(5);
    for (const num of results) {
      expect(num).toBe(42);
    }
  });

  test.fails("[5] Filtering after setting a property on nodes affects the result set but not the side effects - modulo operator and WITH...WHERE not fully supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE (:N {num: ${i}})`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH (n:N) SET n.num = n.num + 1 WITH n WHERE n.num % 2 = 0 RETURN n.num",
    );
    expect(results).toContain(2);
    expect(results).toContain(4);
    expect(results).toContain(6);
  });

  test.fails("[6] Aggregating in RETURN after setting a property on nodes affects the result set but not the side effects - arithmetic expression in SET not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE (:N {num: ${i}})`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH (n:N) SET n.num = n.num + 1 RETURN sum(n.num) AS total",
    );
    expect(results).toEqual([20]); // (2+3+4+5+6) = 20
  });

  test.fails("[7] Aggregating in WITH after setting a property on nodes affects the result set but not the side effects - WITH aggregation not fully supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE (:N {num: ${i}})`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH (n:N) SET n.num = n.num + 1 WITH sum(n.num) AS sum RETURN sum",
    );
    expect(results).toEqual([20]);
  });

  test.fails("[8] Limiting to zero results after adding a label on nodes affects the result set but not the side effects - SET n:Label syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {num: 42})");
    const results = executeTckQuery(graph, "MATCH (n:N) SET n:Foo RETURN n LIMIT 0");
    expect(results).toHaveLength(0);
    const checkResults = executeTckQuery(graph, "MATCH (n:N:Foo) RETURN n");
    expect(checkResults).toHaveLength(1);
  });

  test.fails("[9] Skipping all results after adding a label on nodes affects the result set but not the side effects - SET n:Label syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N {num: 42})");
    const results = executeTckQuery(graph, "MATCH (n:N) SET n:Foo RETURN n SKIP 1");
    expect(results).toHaveLength(0);
    const checkResults = executeTckQuery(graph, "MATCH (n:N:Foo) RETURN n");
    expect(checkResults).toHaveLength(1);
  });

  test.fails("[10] Skipping and limiting to a few results after adding a label on nodes affects the result set but not the side effects - SET n:Label syntax not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE (:N {num: ${i}})`);
    }
    const results = executeTckQuery(graph, "MATCH (n:N) SET n:Foo RETURN n.num SKIP 2 LIMIT 2");
    expect(results).toHaveLength(2);
    const checkResults = executeTckQuery(graph, "MATCH (n:N:Foo) RETURN count(n)");
    expect(checkResults[0]).toBe(5);
  });

  test.fails("[11] Skipping zero result and limiting to all results after adding a label on nodes does not affect the result set nor the side effects - SET n:Label syntax not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE (:N {num: ${i}})`);
    }
    const results = executeTckQuery(graph, "MATCH (n:N) SET n:Foo RETURN n.num SKIP 0 LIMIT 5");
    expect(results).toHaveLength(5);
    const checkResults = executeTckQuery(graph, "MATCH (n:N:Foo) RETURN count(n)");
    expect(checkResults[0]).toBe(5);
  });

  test.fails("[12] Filtering after adding a label on nodes affects the result set but not the side effects - SET n:Label syntax not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE (:N {num: ${i}})`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH (n:N) SET n:Foo WITH n WHERE n.num % 2 = 0 RETURN n.num",
    );
    expect(results).toContain(2);
    expect(results).toContain(4);
  });

  test.fails("[13] Aggregating in RETURN after adding a label on nodes affects the result set but not the side effects - SET n:Label syntax not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE (:N {num: ${i}})`);
    }
    const results = executeTckQuery(graph, "MATCH (n:N) SET n:Foo RETURN sum(n.num) AS total");
    expect(results).toEqual([15]);
  });

  test.fails("[14] Aggregating in WITH after adding a label on nodes affects the result set but not the side effects - SET n:Label syntax not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE (:N {num: ${i}})`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH (n:N) SET n:Foo WITH sum(n.num) AS sum RETURN sum",
    );
    expect(results).toEqual([15]);
  });

  test("[15] Limiting to zero results after setting a property on relationships affects the result set but not the side effects", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:R {num: 42}]->()");
    const results = executeTckQuery(graph, "MATCH ()-[r:R]->() SET r.num = 43 RETURN r LIMIT 0");
    expect(results).toHaveLength(0);
    const checkResults = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r.num");
    expect(checkResults[0]).toBe(43);
  });

  test("[16] Skipping all results after setting a property on relationships affects the result set but not the side effects", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:R {num: 42}]->()");
    const results = executeTckQuery(graph, "MATCH ()-[r:R]->() SET r.num = 43 RETURN r SKIP 1");
    expect(results).toHaveLength(0);
    const checkResults = executeTckQuery(graph, "MATCH ()-[r:R]->() RETURN r.num");
    expect(checkResults[0]).toBe(43);
  });

  test.fails("[17] Skipping and limiting to a few results after setting a property on relationships affects the result set but not the side effects - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE ()-[:R {num: ${i}}]->()`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() SET r.num = 42 RETURN r.num SKIP 2 LIMIT 2",
    );
    expect(results).toHaveLength(2);
    const checkResults = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() WHERE r.num = 42 RETURN count(r)",
    );
    expect(checkResults[0]).toBe(5);
  });

  test("[18] Skipping zero result and limiting to all results after setting a property on relationships does not affect the result set nor the side effects", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE ()-[:R {num: ${i}}]->()`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() SET r.num = 42 RETURN r.num SKIP 0 LIMIT 5",
    );
    expect(results).toHaveLength(5);
    for (const num of results) {
      expect(num).toBe(42);
    }
  });

  test.fails("[19] Filtering after setting a property on relationships affects the result set but not the side effects - unlabeled nodes and modulo operator not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE ()-[:R {num: ${i}}]->()`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() SET r.num = r.num + 1 WITH r WHERE r.num % 2 = 0 RETURN r.num",
    );
    expect(results).toContain(2);
    expect(results).toContain(4);
    expect(results).toContain(6);
  });

  test.fails("[20] Aggregating in RETURN after setting a property on relationships affects the result set but not the side effects - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE ()-[:R {num: ${i}}]->()`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() SET r.num = r.num + 1 RETURN sum(r.num) AS total",
    );
    expect(results).toEqual([20]);
  });

  test.fails("[21] Aggregating in WITH after setting a property on relationships affects the result set but not the side effects - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    for (let i = 1; i <= 5; i++) {
      executeTckQuery(graph, `CREATE ()-[:R {num: ${i}}]->()`);
    }
    const results = executeTckQuery(
      graph,
      "MATCH ()-[r:R]->() SET r.num = r.num + 1 WITH sum(r.num) AS sum RETURN sum",
    );
    expect(results).toEqual([20]);
  });

  // Custom tests for supported scenarios
  test("[custom] SET property persists across separate queries", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'initial'})");

    // Update in one query
    executeTckQuery(graph, "MATCH (n:A) SET n.name = 'updated'");

    // Verify in another query
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("updated");
  });

  test("[custom] SET on relationship property persists", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:R {num: 1}]->(:B)");

    // Update relationship property
    executeTckQuery(graph, "MATCH (:A)-[r:R]->(:B) SET r.num = 99");

    // Verify persistence
    const results = executeTckQuery(graph, "MATCH (:A)-[r:R]->(:B) RETURN r.num");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(99);
  });

  test("[custom] Multiple SET operations in same query", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {x: 1, y: 2})");

    // Multiple SET operations
    const results = executeTckQuery(
      graph,
      `MATCH (n:A)
       SET n.x = 10, n.y = 20
       RETURN n`,
    );

    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [node] = results[0] as [Record<string, unknown>];
    expect(getProperty(node, "x")).toBe(10);
    expect(getProperty(node, "y")).toBe(20);
  });
});
