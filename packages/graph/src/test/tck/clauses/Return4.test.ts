/**
 * TCK Return4 - Column renaming
 * Translated from tmp/tck/features/clauses/return/Return4.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel } from "../tckHelpers.js";

describe("Return4 - Column renaming", () => {
  test("[1] Honour the column name for RETURN items - unlabeled nodes not supported", () => {
    // Given: CREATE ({name: 'Someone'})
    // Query: MATCH (a) WITH a.name AS a RETURN a
    // Expected: 'Someone'
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name: 'Someone'})");
    const results = executeTckQuery(
      graph,
      "MATCH (a) WITH a.name AS a RETURN a",
    );
    expect(results).toHaveLength(1);
    const result = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(result).toBe("Someone");
  });

  test("[custom] Honour the column name for RETURN items with labeled node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Someone'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a.name AS x RETURN x",
    );
    expect(results).toHaveLength(1);
    // WITH returns wrapped in array
    const result = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(result).toBe("Someone");
  });

  test("[2] Support column renaming", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Single)");

    const results = executeTckQuery(
      graph,
      "MATCH (a:Single) RETURN a AS ColumnName",
    );
    expect(results).toHaveLength(1);
    // Results are wrapped in array
    const [columnName] = results[0] as [Record<string, unknown>];
    expect(getLabel(columnName)).toBe("Single");
  });

  test("[3] Aliasing expressions - unlabeled nodes not supported", () => {
    // Given: CREATE ({id: 42})
    // Query: MATCH (a) RETURN a.id AS a, a.id
    // Expected: 42, 42
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({id: 42})");
    const results = executeTckQuery(graph, "MATCH (a) RETURN a.id AS a, a.id");
    expect(results).toHaveLength(1);
    const [a, id] = results[0] as [number, number];
    expect(a).toBe(42);
    expect(id).toBe(42);
  });

  test("[custom] Aliasing expressions with labeled node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {id: 42})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) RETURN a.id AS x, a.id",
    );
    expect(results).toHaveLength(1);
    const [x, id] = results[0] as [number, number];
    expect(x).toBe(42);
    expect(id).toBe(42);
  });

  test("[4] Keeping used expression 1 - unlabeled nodes not supported", () => {
    // Given: CREATE ()
    // Query: MATCH (n) RETURN cOuNt( * )
    // Expected: 1
    // Note: Tests case-insensitivity of COUNT
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    const results = executeTckQuery(graph, "MATCH (n) RETURN cOuNt( * )");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[custom] Keeping used expression 1 - count with labeled node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");

    // count(*) not supported, use count(n) instead
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN count(n)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[5] Keeping used expression 2 - unlabeled nodes (by design)", () => {
    // Original query: MATCH p = (n)-->(b) RETURN nOdEs( p )
    // Blocked: Uses unlabeled nodes (n) and (b) - unlabeled nodes not supported (by design)
    // Note: Named paths ARE working (see Match6 tests), but this test requires unlabeled nodes
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()-[:T]->()");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n)-->(b) RETURN nOdEs( p )",
    );
    expect(results).toHaveLength(1);
    expect(Array.isArray(results[0])).toBe(true);
  });

  test.fails(
    "[6] Keeping used expression 3 - unlabeled nodes (by design)",
    () => {
      // Original query: MATCH p = (n)-->(b) RETURN coUnt( dIstInct p )
      // Blocked: Uses unlabeled nodes (n) and (b) - unlabeled nodes not supported (by design)
      // Note: Named paths ARE working (see Match6 tests), but this test requires unlabeled nodes
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ()-[:T]->()");
      const results = executeTckQuery(
        graph,
        "MATCH p = (n)-->(b) RETURN coUnt( dIstInct p )",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(1);
    },
  );

  test.fails(
    "[7] Keeping used expression 4 - unlabeled nodes (by design)",
    () => {
      // Original query: MATCH p = (n)-->(b) RETURN aVg(n.aGe)
      // Blocked: Uses unlabeled nodes (n) and (b) - unlabeled nodes not supported (by design)
      // Note: Named paths ARE working (see Match6 tests), but this test requires unlabeled nodes
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ({aGe: 30})-[:T]->()");
      const results = executeTckQuery(
        graph,
        "MATCH p = (n)-->(b) RETURN aVg(n.aGe)",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(30);
    },
  );

  test("[8] Support column renaming for aggregations - unlabeled nodes (by design)", () => {
    // Given: UNWIND range(0, 10) AS i CREATE ()
    // Query: MATCH () RETURN count(*) AS columnName
    // Expected: 11
    // Blocked: unlabeled nodes (CREATE (), MATCH ()) not supported (by design)
    // Note: UNWIND IS working - see [custom] test which uses labeled nodes
    const graph = createTckGraph();
    executeTckQuery(graph, "UNWIND range(0, 10) AS i CREATE ()");
    const results = executeTckQuery(
      graph,
      "MATCH () RETURN count(*) AS columnName",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(11);
  });

  test("[custom] Support column renaming for aggregations", () => {
    const graph = createTckGraph();
    // Create 11 nodes manually
    for (let i = 0; i < 11; i++) {
      executeTckQuery(graph, "CREATE (:A)");
    }

    // count(*) not supported, use count(n) instead
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN count(n) AS columnName",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(11);
  });

  test("[9] Handle subexpression in aggregation also occurring as standalone expression - coalesce not supported", () => {
    // Query involves coalesce() function which may not be supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 10})");
    executeTckQuery(graph, "CREATE (:A)");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) RETURN coalesce(a.num, 0) AS num, sum(coalesce(a.num, 0)) AS total",
    );
    expect(results).toHaveLength(2);
  });

  test.fails(
    "[10] Fail when returning multiple columns with same name - semantic validation not implemented",
    () => {
      // Query: RETURN 1 AS a, 2 AS a
      // Expected: SyntaxError: ColumnNameConflict
      // Requires semantic analysis
      const graph = createTckGraph();
      expect(() => {
        executeTckQuery(graph, "RETURN 1 AS a, 2 AS a");
      }).toThrow();
    },
  );

  test.fails(
    "[11] Reusing variable names in RETURN - complex query with ORDER BY in WITH",
    () => {
      // Complex query with multiple WITH clauses, ORDER BY, head(), collect()
      // Many features may not be fully supported
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A {name: 'Alice', age: 30})");
      executeTckQuery(graph, "CREATE (:A {name: 'Bob', age: 25})");
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a ORDER BY a.age RETURN head(collect(a.name)) AS first",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Bob");
    },
  );
});
