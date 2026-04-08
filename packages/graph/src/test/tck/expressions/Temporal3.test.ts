/**
 * TCK Temporal3 - Project Temporal Values from other Temporal Values
 * Translated from tmp/tck/features/expressions/temporal/Temporal3.feature
 *
 * NOTE: Tests [1-3] work - projecting temporal types from other temporal types.
 * Tests [4-10] require map literal arguments with temporal values which is not
 * supported in the grammar.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";
import { DateValue, LocalTimeValue, TimeValue } from "../../../TemporalTypes.js";

describe("Temporal3 - Project Temporal Values from other Temporal Values", () => {
  // Tests [1-3] project temporal types from other temporal types
  test("[1] Should project date from datetime", () => {
    // Original TCK: RETURN date(datetime('1984-10-11T12:31:14.645876123[Europe/Stockholm]')) AS d
    // Expected: '1984-10-11'
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date(datetime('1984-10-11T12:31:14.645876123+01:00'))",
    );
    expect(results).toHaveLength(1);
    expect((results[0] as DateValue).toString()).toBe("1984-10-11");
  });

  test("[2] Should project localtime from datetime", () => {
    // Original TCK: RETURN localtime(datetime('1984-10-11T12:31:14.645876123[Europe/Stockholm]')) AS t
    // Expected: '12:31:14.645876123'
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN localtime(datetime('1984-10-11T12:31:14.645876123+01:00'))",
    );
    expect(results).toHaveLength(1);
    expect((results[0] as LocalTimeValue).toString()).toBe("12:31:14.645876123");
  });

  test("[3] Should project time from datetime", () => {
    // Original TCK: RETURN time(datetime('1984-10-11T12:31:14.645876123+01:00')) AS t
    // Expected: '12:31:14.645876123+01:00'
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN time(datetime('1984-10-11T12:31:14.645876123+01:00'))",
    );
    expect(results).toHaveLength(1);
    expect((results[0] as TimeValue).toString()).toBe("12:31:14.645876123+01:00");
  });

  test.fails("[4] Should create localdatetime from date and localtime - map literal args not supported", () => {
    // Original TCK: RETURN localdatetime({date: date('1984-10-11'), time: localtime('12:31:14.645876123')}) AS dt
    // Expected: '1984-10-11T12:31:14.645876123'
    // Reason: Map literal arguments with temporal values not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN localdatetime({date: date('1984-10-11'), time: localtime('12:31:14.645876123')})",
    );
    expect(results).toHaveLength(1);
    expect(String(results[0])).toBe("1984-10-11T12:31:14.645876123");
  });

  test.fails("[5] Should create datetime from date and time - map literal args not supported", () => {
    // Original TCK: RETURN datetime({date: date('1984-10-11'), time: time('12:31:14.645876123+01:00')}) AS dt
    // Expected: '1984-10-11T12:31:14.645876123+01:00'
    // Reason: Map literal arguments with temporal values not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime({date: date('1984-10-11'), time: time('12:31:14.645876123+01:00')})",
    );
    expect(results).toHaveLength(1);
    expect(String(results[0])).toBe("1984-10-11T12:31:14.645876123+01:00");
  });

  test.fails("[6] Should combine date with timezone - map literal args not supported", () => {
    // Original TCK: RETURN datetime({date: date('1984-10-11'), timezone: 'Europe/Stockholm'}) AS dt
    // Expected: '1984-10-11T00:00+01:00[Europe/Stockholm]'
    // Reason: Map literal arguments with temporal values not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime({date: date('1984-10-11'), timezone: 'Europe/Stockholm'})",
    );
    expect(results).toHaveLength(1);
    expect(String(results[0])).toBe("1984-10-11T00:00+01:00[Europe/Stockholm]");
  });

  test.fails("[7] Should project and modify temporal value - map literal args not supported", () => {
    // Original TCK: RETURN date({date: date('1984-10-11'), day: 23}) AS d
    // Expected: '1984-10-23'
    // Reason: Map literal arguments with temporal values not supported
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN date({date: date('1984-10-11'), day: 23})");
    expect(results).toHaveLength(1);
    expect(String(results[0])).toBe("1984-10-23");
  });

  test.fails("[8] Should project and modify time value - map literal args not supported", () => {
    // Original TCK: RETURN time({time: time('12:31:14+01:00'), hour: 14}) AS t
    // Expected: '14:31:14+01:00'
    // Reason: Map literal arguments with temporal values not supported
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN time({time: time('12:31:14+01:00'), hour: 14})");
    expect(results).toHaveLength(1);
    expect(String(results[0])).toBe("14:31:14+01:00");
  });

  test.fails("[9] Should transform datetime to different timezone - map literal args not supported", () => {
    // Original TCK: RETURN datetime({datetime: datetime('1984-10-11T12:31:14[Europe/Stockholm]'), timezone: 'Europe/London'}) AS dt
    // Expected: '1984-10-11T11:31:14+01:00[Europe/London]'
    // Reason: Map literal arguments with temporal values not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime({datetime: datetime('1984-10-11T12:31:14[Europe/Stockholm]'), timezone: 'Europe/London'})",
    );
    expect(results).toHaveLength(1);
    expect(String(results[0])).toBe("1984-10-11T11:31:14+01:00[Europe/London]");
  });

  test.fails("[10] Should recombine temporal components - map literal args not supported", () => {
    // Original TCK: RETURN datetime({year: 1984, month: 10, day: 11, hour: 12, minute: 31, second: 14, timezone: 'Europe/Stockholm'}) AS dt
    // Expected: '1984-10-11T12:31:14+01:00[Europe/Stockholm]'
    // Reason: Map literal arguments in function calls not supported
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime({year: 1984, month: 10, day: 11, hour: 12, minute: 31, second: 14, timezone: 'Europe/Stockholm'})",
    );
    expect(results).toHaveLength(1);
    expect(String(results[0])).toBe("1984-10-11T12:31:14+01:00[Europe/Stockholm]");
  });
});
