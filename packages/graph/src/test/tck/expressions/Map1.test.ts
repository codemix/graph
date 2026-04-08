/**
 * TCK Map1 - Static value access
 * Translated from tmp/tck/features/expressions/map/Map1.feature
 *
 * Static value access refers to the dot-operator – map.key – which does not
 * allow any dynamic computation of the map key.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Map1 - Static value access", () => {
  test("[1] Statically access a field of a non-null map", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {existing: 42, notMissing: null} AS m RETURN m.missing, m.notMissing, m.existing",
    );
    expect(results).toHaveLength(1);
    // missing key returns undefined, notMissing is null, existing is 42
    expect(results[0]).toEqual([undefined, null, 42]);
  });

  test("[2] Statically access a field of a null map", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH null AS m RETURN m.missing");
    expect(results).toEqual([null]);
  });

  test("[3] Statically access a field from map expression result", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH [123, {existing: 42, notMissing: null}] AS list RETURN (list[1]).missing, (list[1]).notMissing, (list[1]).existing",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([null, null, 42]);
  });

  test("[4a] Static access is case-sensitive - name key", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', nome: 'Pontus'} AS map RETURN map.name AS result",
    );
    expect(results).toEqual(["Mats"]);
  });

  test("[4b] Static access is case-sensitive - lowercase vs uppercase", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', Name: 'Pontus'} AS map RETURN map.name AS result",
    );
    expect(results).toEqual(["Mats"]);
  });

  test("[4c] Static access is case-sensitive - uppercase key", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', Name: 'Pontus'} AS map RETURN map.Name AS result",
    );
    expect(results).toEqual(["Pontus"]);
  });

  test("[4d] Static access returns null for missing case", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', Name: 'Pontus'} AS map RETURN map.nAMe AS result",
    );
    // Missing key returns undefined
    expect(results).toEqual([undefined]);
  });

  test("[5a] Static access with delimited identifier", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', nome: 'Pontus'} AS map RETURN map.`name` AS result",
    );
    expect(results).toEqual(["Mats"]);
  });

  test("[5b] Static access with delimited identifier - nome key", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', nome: 'Pontus'} AS map RETURN map.`nome` AS result",
    );
    expect(results).toEqual(["Pontus"]);
  });

  test("[5c] Static access with delimited identifier matching value", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', nome: 'Pontus'} AS map RETURN map.`Mats` AS result",
    );
    // Key 'Mats' doesn't exist - returns undefined
    expect(results).toEqual([undefined]);
  });

  test("[5d] Static access with delimited identifier null key", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', null: 'nullValue'} AS map RETURN map.`null` AS result",
    );
    expect(results).toEqual(["nullValue"]);
  });

  test("[5e] Static access with delimited identifier NULL key", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {name: 'Mats', NULL: 'NULLVALUE'} AS map RETURN map.`NULL` AS result",
    );
    expect(results).toEqual(["NULLVALUE"]);
  });

  test.fails(
    "[6a] Fail property access on integer - TypeError not validated",
    () => {
      const graph = createTckGraph();
      expect(() => {
        executeTckQuery(graph, "WITH 123 AS nonMap RETURN nonMap.num");
      }).toThrow();
    },
  );

  test.fails(
    "[6b] Fail property access on float - TypeError not validated",
    () => {
      const graph = createTckGraph();
      expect(() => {
        executeTckQuery(graph, "WITH 42.45 AS nonMap RETURN nonMap.num");
      }).toThrow();
    },
  );

  test.fails(
    "[6c] Fail property access on boolean - TypeError not validated",
    () => {
      const graph = createTckGraph();
      expect(() => {
        executeTckQuery(graph, "WITH true AS nonMap RETURN nonMap.num");
      }).toThrow();
    },
  );

  test.fails(
    "[6d] Fail property access on string - TypeError not validated",
    () => {
      const graph = createTckGraph();
      expect(() => {
        executeTckQuery(graph, "WITH 'string' AS nonMap RETURN nonMap.num");
      }).toThrow();
    },
  );

  test.fails(
    "[6e] Fail property access on list - TypeError not validated",
    () => {
      const graph = createTckGraph();
      expect(() => {
        executeTckQuery(graph, "WITH [123, true] AS nonMap RETURN nonMap.num");
      }).toThrow();
    },
  );

  // Custom tests demonstrating property access on nodes (the supported use case)
  test("[Custom 1] Access property of a matched node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice', age: 30})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name, n.age");

    expect(results).toHaveLength(1);
    // Multiple return items come as array
    expect(results[0]).toEqual(["Alice", 30]);
  });

  test("[Custom 2] Access missing property returns undefined", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice'})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.missing");

    expect(results).toHaveLength(1);
    // Missing properties return undefined (not null like in Cypher)
    expect(results[0]).toBeUndefined();
  });

  test("[Custom 3] Property access is case-sensitive", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice', Name: 'Bob'})`);

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name, n.Name");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["Alice", "Bob"]);
  });

  test("[Custom 4] Access multiple properties in WHERE clause", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice', age: 30}), (:A {name: 'Bob', age: 25})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.age > 28 RETURN n.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Alice");
  });

  test("[Custom 5] Access relationship property", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice'})-[:KNOWS {since: 2020}]->(:B {name: 'Bob'})`,
    );

    const results = executeTckQuery(
      graph,
      "MATCH (:A)-[r:KNOWS]->(:B) RETURN r.since",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2020);
  });
});
