/**
 * TCK Temporal4 - Store Temporal Values
 * Translated from tmp/tck/features/expressions/temporal/Temporal4.feature
 *
 * NOTE: Storing temporal values in CREATE with function calls in property
 * values requires grammar support for function calls in PropertyMap.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Temporal4 - Store Temporal Values", () => {
  // CREATE with temporal function calls in property values requires grammar changes

  test.fails("[1] Should store and retrieve date property - function call in CREATE property not supported", () => {
    // Original TCK:
    // CREATE (a:A {d: date('1984-10-11')})
    // RETURN a.d AS d
    // Expected: '1984-10-11'
    // Reason: Function calls in CREATE property values not supported
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "CREATE (a:A {d: date('1984-10-11')}) RETURN a.d");
    expect(result).toHaveLength(1);
    expect(String(result[0])).toBe("1984-10-11");
  });

  test.fails("[2] Should store and retrieve localtime property - function call in CREATE property not supported", () => {
    // Original TCK:
    // CREATE (a:A {t: localtime('12:31:14.645876123')})
    // RETURN a.t AS t
    // Expected: '12:31:14.645876123'
    // Reason: Function calls in CREATE property values not supported
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "CREATE (a:A {t: localtime('12:31:14.645876123')}) RETURN a.t",
    );
    expect(result).toHaveLength(1);
    expect(String(result[0])).toBe("12:31:14.645876123");
  });

  test.fails("[3] Should store and retrieve time property - function call in CREATE property not supported", () => {
    // Original TCK:
    // CREATE (a:A {t: time('12:31:14.645876123+01:00')})
    // RETURN a.t AS t
    // Expected: '12:31:14.645876123+01:00'
    // Reason: Function calls in CREATE property values not supported
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "CREATE (a:A {t: time('12:31:14.645876123+01:00')}) RETURN a.t",
    );
    expect(result).toHaveLength(1);
    expect(String(result[0])).toBe("12:31:14.645876123+01:00");
  });

  test.fails("[4] Should store and retrieve localdatetime property - function call in CREATE property not supported", () => {
    // Original TCK:
    // CREATE (a:A {dt: localdatetime('1984-10-11T12:31:14.645876123')})
    // RETURN a.dt AS dt
    // Expected: '1984-10-11T12:31:14.645876123'
    // Reason: Function calls in CREATE property values not supported
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "CREATE (a:A {dt: localdatetime('1984-10-11T12:31:14.645876123')}) RETURN a.dt",
    );
    expect(result).toHaveLength(1);
    expect(String(result[0])).toBe("1984-10-11T12:31:14.645876123");
  });

  test.fails("[5] Should store and retrieve datetime property - function call in CREATE property not supported", () => {
    // Original TCK:
    // CREATE (a:A {dt: datetime('1984-10-11T12:31:14.645876123+01:00')})
    // RETURN a.dt AS dt
    // Expected: '1984-10-11T12:31:14.645876123+01:00'
    // Reason: Function calls in CREATE property values not supported
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "CREATE (a:A {dt: datetime('1984-10-11T12:31:14.645876123+01:00')}) RETURN a.dt",
    );
    expect(result).toHaveLength(1);
    expect(String(result[0])).toBe("1984-10-11T12:31:14.645876123+01:00");
  });

  test.fails("[6] Should store and retrieve duration property - function call in CREATE property not supported", () => {
    // Original TCK:
    // CREATE (a:A {d: duration('P1Y2M14DT12H31M14.645876123S')})
    // RETURN a.d AS d
    // Expected: 'P1Y2M14DT12H31M14.645876123S'
    // Reason: Function calls in CREATE property values not supported
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "CREATE (a:A {d: duration('P1Y2M14DT12H31M14.645876123S')}) RETURN a.d",
    );
    expect(result).toHaveLength(1);
    expect(String(result[0])).toBe("P1Y2M14DT12H31M14.645876123S");
  });

  test.fails("[7] Should store array of dates - function call in CREATE property not supported", () => {
    // Original TCK:
    // CREATE (a:A {dates: [date('1984-10-11'), date('1985-11-12')]})
    // RETURN a.dates AS dates
    // Expected: ['1984-10-11', '1985-11-12']
    // Reason: Function calls in CREATE property values not supported
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "CREATE (a:A {dates: [date('1984-10-11'), date('1985-11-12')]}) RETURN a.dates",
    );
    expect(result).toHaveLength(1);
    const dates = result[0] as unknown[];
    expect(dates.map(String)).toEqual(["1984-10-11", "1985-11-12"]);
  });

  test.fails("[8] Should store array of datetimes - function call in CREATE property not supported", () => {
    // Original TCK:
    // CREATE (a:A {dts: [datetime('1984-10-11T12:31:14+01:00'), datetime('1985-11-12T13:32:15+02:00')]})
    // RETURN a.dts AS dts
    // Expected: ['1984-10-11T12:31:14+01:00', '1985-11-12T13:32:15+02:00']
    // Reason: Function calls in CREATE property values not supported
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "CREATE (a:A {dts: [datetime('1984-10-11T12:31:14+01:00'), datetime('1985-11-12T13:32:15+02:00')]}) RETURN a.dts",
    );
    expect(result).toHaveLength(1);
    const dts = result[0] as unknown[];
    expect(dts.map(String)).toEqual(["1984-10-11T12:31:14+01:00", "1985-11-12T13:32:15+02:00"]);
  });

  test("[9] Should handle null in temporal function", () => {
    // Original TCK: RETURN date(null) AS d
    // Expected: null
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN date(null)");
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  test("[10-custom] Should handle null in datetime function", () => {
    // RETURN datetime(null) AS dt
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN datetime(null)");
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  test("[11-custom] Should handle null in time function", () => {
    // RETURN time(null) AS t
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN time(null)");
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  test("[12-custom] Should handle null in localtime function", () => {
    // RETURN localtime(null) AS t
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN localtime(null)");
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  test("[13-custom] Should handle null in localdatetime function", () => {
    // RETURN localdatetime(null) AS dt
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN localdatetime(null)");
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  test.fails("[10] Should handle null propagation through temporal - requires MATCH first", () => {
    // Original TCK:
    // MATCH (a)
    // RETURN date(a.nonexistent) AS d
    // Expected: null
    // Reason: Need to set up graph with node first
    const graph = createTckGraph();
    // Create a node first
    executeTckQuery(graph, "CREATE (:A {name: 'test'})");
    const result = executeTckQuery(graph, "MATCH (a) RETURN date(a.nonexistent)");
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });
});
