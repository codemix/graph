/**
 * TCK ReturnSkipLimit1 - Skip
 * Translated from tmp/tck/features/clauses/return-skip-limit/ReturnSkipLimit1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("ReturnSkipLimit1 - Skip", () => {
  test("[1] Start the result from the second row", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE ({name: 'A'}), ({name: 'B'}), ({name: 'C'}), ({name: 'D'}), ({name: 'E'})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (n) RETURN n ORDER BY n.name ASC SKIP 2",
    );
    expect(results.length).toBe(3);
    const names = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "name");
    });
    expect(names).toEqual(["C", "D", "E"]);
  });

  test("[1-custom] Start the result from the second row with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'A'})");
    executeTckQuery(graph, "CREATE (:A {name: 'B'})");
    executeTckQuery(graph, "CREATE (:A {name: 'C'})");
    executeTckQuery(graph, "CREATE (:A {name: 'D'})");
    executeTckQuery(graph, "CREATE (:A {name: 'E'})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n ORDER BY n.name ASC SKIP 2",
    );
    expect(results.length).toBe(3);
    // Single RETURN item is wrapped in array
    const names = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "name");
    });
    expect(names).toEqual(["C", "D", "E"]);
  });

  test.fails(
    "[2] Start the result from the second row by param - unlabeled nodes; SKIP/LIMIT only accept literals",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE ({name: 'A'}), ({name: 'B'}), ({name: 'C'}), ({name: 'D'}), ({name: 'E'})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (n) RETURN n ORDER BY n.name ASC SKIP $skipAmount",
        { skipAmount: 2 },
      );
      expect(results.length).toBe(3);
      const names = results.map((r) => {
        const [node] = r as [Record<string, unknown>];
        return getProperty(node, "name");
      });
      expect(names).toEqual(["C", "D", "E"]);
    },
  );

  test.fails(
    "[3] SKIP with an expression that does not depend on variables - UNWIND and toInteger(rand()) not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "UNWIND range(1, 10) AS i CREATE ({nr: i})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) WITH n SKIP toInteger(rand()*9) WITH count(*) AS count RETURN count > 0 AS nonEmpty",
      );
      expect(results).toEqual([true]);
    },
  );

  test("[4] Accept skip zero", () => {
    const graph = createTckGraph();
    // Empty graph, WHERE 1 = 0 should return no results
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE 1 = 0 RETURN n SKIP 0",
    );
    expect(results).toEqual([]);
  });

  test("[5] SKIP with an expression that depends on variables should fail", () => {
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(graph, "MATCH (n) RETURN n SKIP n.count"),
    ).toThrow();
  });

  test("[6] Negative parameter for SKIP should fail", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (s:Person {name: 'Steven'}), (c:Person {name: 'Craig'})",
    );
    expect(() =>
      executeTckQuery(
        graph,
        "MATCH (p:Person) RETURN p.name AS name SKIP $_skip",
        { _skip: -1 },
      ),
    ).toThrow();
  });

  test.fails(
    "[7] Negative SKIP should fail - negative literals not supported in grammar",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (s:Person {name: 'Steven'}), (c:Person {name: 'Craig'})",
      );
      expect(() =>
        executeTckQuery(
          graph,
          "MATCH (p:Person) RETURN p.name AS name SKIP -1",
        ),
      ).toThrow();
    },
  );

  test("[8] Floating point parameter for SKIP should fail", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (s:Person {name: 'Steven'}), (c:Person {name: 'Craig'})",
    );
    expect(() =>
      executeTckQuery(
        graph,
        "MATCH (p:Person) RETURN p.name AS name SKIP $_limit",
        { _limit: 1.5 },
      ),
    ).toThrow();
  });

  test("[9] Floating point SKIP should fail", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (s:Person {name: 'Steven'}), (c:Person {name: 'Craig'})",
    );
    expect(() =>
      executeTckQuery(graph, "MATCH (p:Person) RETURN p.name AS name SKIP 1.5"),
    ).toThrow();
  });

  test("[10] Fail when using non-constants in SKIP", () => {
    const graph = createTckGraph();
    expect(() =>
      executeTckQuery(graph, "MATCH (n) RETURN n SKIP n.count"),
    ).toThrow();
  });

  test.fails(
    "[11] Fail when using negative value in SKIP - negative literals not supported in grammar",
    () => {
      const graph = createTckGraph();
      expect(() =>
        executeTckQuery(graph, "MATCH (n) RETURN n SKIP -1"),
      ).toThrow();
    },
  );

  // Additional custom tests for SKIP functionality
  test("[custom-1] SKIP with ORDER BY", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");
    executeTckQuery(graph, "CREATE (:A {num: 4})");
    executeTckQuery(graph, "CREATE (:A {num: 5})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.num ORDER BY n.num SKIP 3",
    );
    expect(results).toEqual([4, 5]);
  });

  test("[custom-2] SKIP 0 returns all results", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");
    executeTckQuery(graph, "CREATE (:A {num: 3})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.num ORDER BY n.num SKIP 0",
    );
    expect(results).toEqual([1, 2, 3]);
  });

  test("[custom-3] SKIP more than results returns empty", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1})");
    executeTckQuery(graph, "CREATE (:A {num: 2})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n.num ORDER BY n.num SKIP 10",
    );
    expect(results).toEqual([]);
  });
});
