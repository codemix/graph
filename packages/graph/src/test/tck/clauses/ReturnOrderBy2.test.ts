/**
 * TCK ReturnOrderBy2 - Order by a single expression (order of projection)
 * Translated from tmp/tck/features/clauses/return-orderby/ReturnOrderBy2.feature
 */
import { describe, test, expect } from "vitest";
import {
  createTckGraph,
  executeTckQuery,
  getLabel,
  getProperty,
} from "../tckHelpers.js";

describe("ReturnOrderBy2 - Order by a single expression", () => {
  test("[1] ORDER BY should return results in ascending order", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 1}), ({num: 3}), ({num: -5})");

    const results = executeTckQuery(
      graph,
      "MATCH (n) RETURN n.num AS prop ORDER BY n.num",
    );
    expect(results).toEqual([-5, 1, 3]);
  });

  test("[2] ORDER BY DESC should return results in descending order", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 1}), ({num: 3}), ({num: -5})");

    const results = executeTckQuery(
      graph,
      "MATCH (n) RETURN n.num AS prop ORDER BY n.num DESC",
    );
    expect(results).toEqual([3, 1, -5]);
  });

  test.fails(
    "[3] Sort on aggregated function - unlabeled nodes, implicit grouping not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE ({division: 'A', age: 22}), ({division: 'B', age: 33}), ({division: 'B', age: 44}), ({division: 'C', age: 55})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (n) RETURN n.division, max(n.age) ORDER BY max(n.age)",
      );
      expect(results).toEqual([
        ["A", 22],
        ["B", 44],
        ["C", 55],
      ]);
    },
  );

  test("[4] Support sort and distinct", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE ({name: 'A'}), ({name: 'B'}), ({name: 'C'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a) RETURN DISTINCT a ORDER BY a.name",
    );
    expect(results).toHaveLength(3);
    // Single RETURN item results are wrapped in arrays
    const [a0] = results[0] as [Record<string, unknown>];
    const [a1] = results[1] as [Record<string, unknown>];
    const [a2] = results[2] as [Record<string, unknown>];
    expect(getProperty(a0, "name")).toBe("A");
    expect(getProperty(a1, "name")).toBe("B");
    expect(getProperty(a2, "name")).toBe("C");
  });

  test("[5] Support ordering by a property after being distinct-ified", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a1'})-[:T]->(:B {name: 'b1'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-->(b:B) RETURN DISTINCT b ORDER BY b.name",
    );
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [b] = results[0] as [Record<string, unknown>];
    expect(getLabel(b)).toBe("B");
  });

  test.fails(
    "[6] Count star should count everything in scope - count(*) not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:L1), (:L2), (:L3)");
      const results = executeTckQuery(
        graph,
        "MATCH (a) RETURN a, count(*) ORDER BY count(*)",
      );
      expect(results).toHaveLength(3);
    },
  );

  test.fails(
    "[7] Ordering with aggregation - unlabeled nodes, count(*) not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ({name: 'nisse'})");
      const results = executeTckQuery(
        graph,
        "MATCH (n) RETURN n.name, count(*) AS foo ORDER BY n.name",
      );
      expect(results).toEqual([["nisse", 1]]);
    },
  );

  test("[8] Returning all variables with ordering", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({id: 1}), ({id: 10})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN * ORDER BY n.id");
    expect(results).toHaveLength(2);
  });

  test("[9] Using aliased DISTINCT expression in ORDER BY", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({id: 1}), ({id: 10})");

    const results = executeTckQuery(
      graph,
      "MATCH (n) RETURN DISTINCT n.id AS id ORDER BY id DESC",
    );
    expect(results).toEqual([10, 1]);
  });

  test("[10] Returned columns do not change from using ORDER BY", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({id: 1}), ({id: 10})");

    const results = executeTckQuery(
      graph,
      "MATCH (n) RETURN DISTINCT n ORDER BY n.id",
    );
    expect(results).toHaveLength(2);
    // Single RETURN item results are wrapped in arrays
    const [n0] = results[0] as [Record<string, unknown>];
    const [n1] = results[1] as [Record<string, unknown>];
    expect(getProperty(n0, "id")).toBe(1);
    expect(getProperty(n1, "id")).toBe(10);
  });

  test("[10-labeled] Returned columns do not change from using ORDER BY", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {id: 1})");
    executeTckQuery(graph, "CREATE (:A {id: 10})");

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) RETURN n ORDER BY n.id",
    );
    expect(results).toHaveLength(2);
    // Single RETURN item is wrapped in array
    const [n0] = results[0] as [Record<string, unknown>];
    const [n1] = results[1] as [Record<string, unknown>];
    expect(getProperty(n0, "id")).toBe(1);
    expect(getProperty(n1, "id")).toBe(10);
  });

  test.fails(
    "[11] Aggregates ordered by arithmetics - arithmetic on aggregates not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A), (:X), (:X)");
      const results = executeTckQuery(
        graph,
        "MATCH (a:A), (b:X) RETURN count(a) * 10 + count(b) * 5 AS x ORDER BY x",
      );
      expect(results).toEqual([30]);
    },
  );

  test("[12] Aggregation of named paths", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:REL]->(:B)-[:REL]->(:C)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (a)-[*]->(b) RETURN collect(nodes(p)) AS paths, length(p) AS l ORDER BY l",
    );
    expect(results).toBeDefined();
  });

  test.fails(
    "[13] Fail when sorting on variable removed by DISTINCT - semantic validation not implemented",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE ({name: 'A', age: 13}), ({name: 'B', age: 12}), ({name: 'C', age: 11})",
      );
      expect(() => {
        executeTckQuery(
          graph,
          "MATCH (a) RETURN DISTINCT a.name ORDER BY a.age",
        );
      }).toThrow();
    },
  );

  test.fails(
    "[14] Fail on aggregation in ORDER BY after RETURN - semantic validation not implemented",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ({num1: 1, num2: 2})");
      expect(() => {
        executeTckQuery(graph, "MATCH (n) RETURN n.num1 ORDER BY max(n.num2)");
      }).toThrow();
    },
  );
});
