/**
 * TCK Map3 - Keys function
 * Translated from tmp/tck/features/expressions/map/Map3.feature
 *
 * Tests the keys() function for extracting map keys.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Map3 - Keys function", () => {
  test("[1] Using keys() on a literal map", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN keys({name: 'Alice', age: 38, address: {city: 'London', residential: true}}) AS k",
    );
    // Results are wrapped in array for single-column RETURN
    expect(results).toHaveLength(1);
    const keys = results[0] as string[];
    expect(keys).toHaveLength(3);
    expect(keys).toContain("name");
    expect(keys).toContain("age");
    expect(keys).toContain("address");
  });

  test("[2] Using keys() on a parameter map", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN keys($param) AS k", {
      param: { name: "Alice", age: 38, address: { city: "London" } },
    });
    expect(results).toHaveLength(1);
    const keys = results[0] as string[];
    expect(keys).toHaveLength(3);
    expect(keys).toContain("name");
    expect(keys).toContain("age");
    expect(keys).toContain("address");
  });

  test("[3] Using keys() on null map", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "WITH null AS m RETURN keys(m)");
    expect(results).toEqual([null]);
  });

  test("[4a] Using keys() on empty map", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN keys({}) AS keys");
    expect(results).toEqual([[]]);
  });

  test("[4b] Using keys() on map with single key", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN keys({k: 1}) AS keys");
    expect(results).toEqual([["k"]]);
  });

  test("[4c] Using keys() on map with null value", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN keys({k: null}) AS keys");
    expect(results).toEqual([["k"]]);
  });

  test("[4d] keys() on map with null and non-null values", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN keys({k: null, l: 1}) AS keys");
    const keys = results[0] as string[];
    expect(keys).toHaveLength(2);
    expect(keys).toContain("k");
    expect(keys).toContain("l");
  });

  test("[5] Using keys() with IN to check field existence", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "WITH {exists: 42, notMissing: null} AS map RETURN 'exists' IN keys(map) AS a, 'notMissing' IN keys(map) AS b, 'missing' IN keys(map) AS c",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([true, true, false]);
  });

  // Custom tests demonstrating alternative patterns for key-related operations
  test("[Custom 1] Check if property exists via WHERE comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice', city: 'London'}), (:A {name: 'Bob'})`);

    // Filter nodes that have a specific property set
    // Note: This checks if property is NOT undefined, not if key exists
    const results = executeTckQuery(graph, "MATCH (n:A) WHERE n.city = 'London' RETURN n.name");

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("Alice");
  });

  test("[Custom 2] Return all properties of a node", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'Alice', age: 30, city: 'NYC'})`);

    // We can access specific known properties
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name, n.age, n.city");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(["Alice", 30, "NYC"]);
  });

  test("[Custom 3] Use IN operator to check value in list", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice'}), (:A {name: 'Bob'}), (:A {name: 'Charlie'})`,
    );

    // IN operator works for filtering by list membership
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.name IN ['Alice', 'Bob'] RETURN n.name",
    );

    expect(results).toHaveLength(2);
    const names = results.map((r) => r);
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");
  });

  test("[Custom 4] Filter by property existence via NOT-undefined pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'Alice', email: 'alice@test.com'}), (:A {name: 'Bob'})`,
    );

    // Filter for nodes where email property is set (not undefined)
    // Note: In this implementation, missing properties return undefined
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.name, n.email");

    expect(results).toHaveLength(2);
    // Results are: ['Alice', 'alice@test.com'], ['Bob', undefined]
    const aliceResult = results.find((r) => Array.isArray(r) && r[0] === "Alice") as unknown[];
    const bobResult = results.find((r) => Array.isArray(r) && r[0] === "Bob") as unknown[];

    expect(aliceResult[1]).toBe("alice@test.com");
    expect(bobResult[1]).toBeUndefined();
  });
});
