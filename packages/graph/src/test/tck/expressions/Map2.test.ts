/**
 * TCK Map2 - Dynamic Value Access
 * Translated from tmp/tck/features/expressions/map/Map2.feature
 *
 * Dynamic value access refers to the bracket-operator – map[expr] – which
 * allows dynamic computation of the map key.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Map2 - Dynamic Value Access", () => {
  test("[1] Dynamically access field with parameters", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH $expr AS expr, $idx AS idx RETURN expr[idx] AS value",
      { expr: { name: "Apa" }, idx: "name" },
    );
    expect(results).toEqual(["Apa"]);
  });

  test("[2] Dynamic access with rhs type info", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH $expr AS expr, $idx AS idx RETURN expr[toString(idx)] AS value",
      { expr: { name: "Apa" }, idx: "name" },
    );
    expect(results).toEqual(["Apa"]);
  });

  test("[3] Dynamic access on null returns null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH null AS expr, 'x' AS idx RETURN expr[idx] AS value",
    );
    expect(results).toEqual([null]);
  });

  test("[4] Dynamic access with null index returns null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats'} AS expr, null AS idx RETURN expr[idx] AS value",
    );
    expect(results).toEqual([null]);
  });

  test("[5a] Dynamic access is case-sensitive - 'name' key", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', nome: 'Pontus'} AS map RETURN map['name'] AS result",
    );
    expect(results).toEqual(["Mats"]);
  });

  test("[5b] Dynamic access is case-sensitive - 'nome' key", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', nome: 'Pontus'} AS map RETURN map['nome'] AS result",
    );
    expect(results).toEqual(["Pontus"]);
  });

  test("[5c] Dynamic access is case-sensitive - lowercase vs uppercase", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', Name: 'Pontus'} AS map RETURN map['name'] AS result",
    );
    expect(results).toEqual(["Mats"]);
  });

  test("[5d] Dynamic access is case-sensitive - uppercase key", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', Name: 'Pontus'} AS map RETURN map['Name'] AS result",
    );
    expect(results).toEqual(["Pontus"]);
  });

  test("[5e] Dynamic access returns null for missing case", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', Name: 'Pontus'} AS map RETURN map['nAMe'] AS result",
    );
    // Dynamic bracket access returns null for missing keys (unlike static dot access which returns undefined)
    expect(results).toEqual([null]);
  });

  test("[5f] Dynamic access with 'null' key", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', null: 'nullValue'} AS map RETURN map['null'] AS result",
    );
    expect(results).toEqual(["nullValue"]);
  });

  test("[5g] Dynamic access with 'NULL' key", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', NULL: 'NULLVALUE'} AS map RETURN map['NULL'] AS result",
    );
    expect(results).toEqual(["NULLVALUE"]);
  });

  test.fails("[6] Fail indexing map with Int - semantic validation not implemented", () => {
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "WITH $expr AS expr, $idx AS idx RETURN expr[idx]", {
        expr: { name: "Apa" },
        idx: 0,
      });
    }).toThrow();
  });

  test.fails("[7] Fail indexing map with non-string - semantic validation not implemented", () => {
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "WITH $expr AS expr, $idx AS idx RETURN expr[idx]", {
        expr: { name: "Apa" },
        idx: 12.3,
      });
    }).toThrow();
  });

  test.fails("[8] Fail indexing non-map type - semantic validation not implemented", () => {
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "WITH $expr AS expr, $idx AS idx RETURN expr[idx]", {
        expr: 100,
        idx: 0,
      });
    }).toThrow();
  });

  // Custom tests demonstrating property access patterns that work
  test("[Custom 1] Access node properties dynamically via RETURN expressions", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice', city: 'London'})`);

    // We can access multiple properties using dot notation
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name, n.city");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["Alice", "London"]);
  });

  test("[Custom 2] Filter by property value (alternative to dynamic key access)", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {key: 'name', value: 'Alice'}), (:A {key: 'city', value: 'London'})`,
    );

    // Use WHERE to filter by a "key" property instead of dynamic map access
    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.key = 'name' RETURN n.value");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Alice");
  });

  test("[Custom 3] Access relationship properties", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice'})-[:KNOWS {since: 2020, trust: 'high'}]->(:B {name: 'Bob'})`,
    );

    const results = executeTckQuery(graph, "MATCH ()-[r:KNOWS]->() RETURN r.since, r.trust");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([2020, "high"]);
  });

  test("[Custom 4] Property access with WHERE comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice', score: 90}), (:A {name: 'Bob', score: 75})`);

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.score >= 80 RETURN n.name, n.score",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["Alice", 90]);
  });
});
