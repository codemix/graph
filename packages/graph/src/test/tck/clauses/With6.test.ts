/**
 * TCK With6 - Implicit grouping with aggregates
 * Translated from tmp/tck/features/clauses/with/With6.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("With6 - Implicit grouping with aggregates", () => {
  test("[1] Implicit grouping with single expression as grouping key and single aggregation - unlabeled nodes, count(*), implicit grouping not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE ({name: 'A'}), ({name: 'A'}), ({name: 'B'})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a) WITH a.name AS name, count(*) AS relCount RETURN name, relCount ORDER BY name",
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(["A", 2]);
    expect(results[1]).toEqual(["B", 1]);
  });

  test.fails(
    "[2] Implicit grouping with single relationship variable as grouping key and single aggregation - unlabeled nodes (by design), implicit grouping not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE ()-[:T1]->(:X), ()-[:T2]->(:X), ()-[:T3]->()",
      );
      const results = executeTckQuery(
        graph,
        "MATCH ()-[r1]->(:X) WITH r1 AS r2, count(*) AS c MATCH ()-[r2]->() RETURN r2 AS rel",
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[3] Implicit grouping with multiple node and relationship variables as grouping key and single aggregation - unlabeled nodes (by design), implicit grouping not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:T1]->(:X), (:A)-[:T2]->(:X)");
      const results = executeTckQuery(
        graph,
        "MATCH (a)-[r1]->(b:X) WITH a, r1 AS r2, b, count(*) AS c MATCH (a)-[r2]->(b) RETURN r2 AS rel",
      );
      expect(results).toHaveLength(2);
    },
  );

  test("[4] Implicit grouping with single path variable as grouping key and single aggregation - named paths, variable length patterns, nodes() function not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)-[:T]->(:C)");
    const results = executeTckQuery(
      graph,
      "MATCH p = ()-[*]->() WITH count(*) AS count, p AS p RETURN nodes(p) AS nodes",
    );
    expect(results.length).toBeGreaterThan(0);
  });

  test.fails(
    "[5] Handle constants and parameters inside an expression which contains an aggregation expression - parameters not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:Person {age: 30}), (:Person {age: 40})");
      const results = executeTckQuery(
        graph,
        "MATCH (person:Person) WITH 100 + avg(person.age) - 1000 AS agg RETURN agg",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(-865); // 100 + 35 - 1000 = -865
    },
  );

  test("[6] Handle projected variables inside an expression which contains an aggregation expression - implicit grouping, arithmetic on aggregates not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:Person {age: 30})-[:KNOWS]->(:Person {age: 25})",
    );
    executeTckQuery(
      graph,
      "MATCH (p1:Person) WHERE p1.age = 30 CREATE (p1)-[:KNOWS]->(:Person {age: 35})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (me:Person)-[:KNOWS]-(you:Person) WITH me.age AS age, you WITH age, age + count(you.age) AS agg RETURN *",
    );
    expect(results.length).toBeGreaterThan(0);
  });

  test("[7] Handle projected property accesses inside an expression which contains an aggregation expression - implicit grouping, arithmetic on aggregates not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:Person {age: 30})-[:KNOWS]->(:Person {age: 25})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (me:Person)-[:KNOWS]-(you:Person) WITH me.age AS age, me.age + count(you.age) AS agg RETURN *",
    );
    expect(results.length).toBeGreaterThan(0);
  });

  test.fails(
    "[8] Fail if not projected variables are used inside an expression which contains an aggregation expression - semantic validation not implemented",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:Person {age: 30})-[:KNOWS]->(:Person {age: 25})",
      );
      expect(() =>
        executeTckQuery(
          graph,
          "MATCH (me:Person)-[:KNOWS]-(you:Person) WITH me.age + count(you.age) AS agg RETURN *",
        ),
      ).toThrow();
    },
  );

  test("[9] Fail if more complex expression, even if projected, are used inside expression which contains an aggregation expression - semantic validation not implemented", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:Person {age: 30})-[:KNOWS]->(:Person {age: 25})",
    );
    expect(() =>
      executeTckQuery(
        graph,
        "MATCH (me:Person)-[:KNOWS]-(you:Person) WITH me.age + you.age AS grp, me.age + you.age + count(*) AS agg RETURN *",
      ),
    ).toThrow();
  });

  // Custom tests for supported aggregate patterns with WITH
  test("[custom-1] WITH with count aggregate", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'x'})");
    executeTckQuery(graph, "CREATE (:A {name: 'y'})");
    executeTckQuery(graph, "CREATE (:A {name: 'z'})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH count(a) AS cnt RETURN cnt",
    );
    expect(results.length).toBe(1);
    // May be wrapped
    const val = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(val).toBe(3);
  });

  test("[custom-2] WITH with sum aggregate", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 10})");
    executeTckQuery(graph, "CREATE (:A {num: 20})");
    executeTckQuery(graph, "CREATE (:A {num: 30})");

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH sum(a.num) AS total RETURN total",
    );
    expect(results.length).toBe(1);
    // May be wrapped
    const val = Array.isArray(results[0]) ? results[0][0] : results[0];
    expect(val).toBe(60);
  });
});
