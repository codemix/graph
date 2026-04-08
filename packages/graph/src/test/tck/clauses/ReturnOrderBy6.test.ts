/**
 * TCK ReturnOrderBy6 - Aggregation expressions in order by
 * Translated from tmp/tck/features/clauses/return-orderby/ReturnOrderBy6.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("ReturnOrderBy6 - Aggregation expressions in order by", () => {
  test("[1] Handle constants and parameters inside an order by item which contains an aggregation expression - parameters not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Person {age: 30}), (:Person {age: 40})");
    const results = executeTckQuery(
      graph,
      "MATCH (person:Person) RETURN avg(person.age) AS avgAge ORDER BY $age + avg(person.age) - 1000",
      { age: 38 },
    );
    expect(results).toEqual([35]);
  });

  test.fails(
    "[2] Handle returned aliases inside an order by item which contains an aggregation expression - arithmetic on aggregates not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "MATCH (me:Person)--(you:Person) RETURN me.age AS age, count(you.age) AS cnt ORDER BY age, age + count(you.age)",
      );
      expect(results).toEqual([]);
    },
  );

  test.fails(
    "[3] Handle returned property accesses inside an order by item which contains an aggregation expression - arithmetic on aggregates not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "MATCH (me:Person)--(you:Person) RETURN me.age AS age, count(you.age) AS cnt ORDER BY me.age + count(you.age)",
      );
      expect(results).toEqual([]);
    },
  );

  test.fails(
    "[4] Fail if not returned variables are used inside an order by item which contains an aggregation expression - semantic validation not implemented",
    () => {
      const graph = createTckGraph();
      expect(() => {
        executeTckQuery(
          graph,
          "MATCH (me:Person)--(you:Person) RETURN count(you.age) AS agg ORDER BY me.age + count(you.age)",
        );
      }).toThrow();
    },
  );

  test("[5] Fail if more complex expressions, even if returned, are used inside an order by item which contains an aggregation expression - semantic validation not implemented", () => {
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(
        graph,
        "MATCH (me:Person)--(you:Person) RETURN me.age + you.age, count(*) AS cnt ORDER BY me.age + you.age + count(*)",
      );
    }).toThrow();
  });

  test.fails(
    "[custom-1] ORDER BY with simple count aggregation - implicit grouping not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:Person {name: 'Alice'})");
      executeTckQuery(graph, "CREATE (:Person {name: 'Bob'})");
      executeTckQuery(graph, "CREATE (:Person {name: 'Alice'})");
      const results = executeTckQuery(
        graph,
        "MATCH (p:Person) RETURN p.name, count(p) AS cnt ORDER BY p.name",
      );
      expect(results).toEqual([
        ["Alice", 2],
        ["Bob", 1],
      ]);
    },
  );

  test("[custom-2] ORDER BY with pure aggregate", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Person {name: 'Alice', age: 30})");
    executeTckQuery(graph, "CREATE (:Person {name: 'Bob', age: 25})");
    executeTckQuery(graph, "CREATE (:Person {name: 'Charlie', age: 35})");

    const results = executeTckQuery(graph, "MATCH (p:Person) RETURN count(p)");
    expect(results).toEqual([3]);
  });
});
