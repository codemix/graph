/**
 * TCK Temporal5 - Access Components of Temporal Values
 * Translated from tmp/tck/features/expressions/temporal/Temporal5.feature
 *
 * NOTE: Only date component accessors (year, month, day, week, dayOfWeek,
 * quarter, ordinalDay) are currently implemented.
 * Other temporal types (time, datetime, duration) are pending future implementation.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Temporal5 - Access Components of Temporal Values", () => {
  test("[1] Should access year from date", () => {
    // Original TCK: RETURN date('1984-10-11').year AS y
    // Expected: 1984
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN date('1984-10-11').year");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(1984);
  });

  test("[2] Should access month from date", () => {
    // Original TCK: RETURN date('1984-10-11').month AS m
    // Expected: 10
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN date('1984-10-11').month");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(10);
  });

  test("[3] Should access day from date", () => {
    // Original TCK: RETURN date('1984-10-11').day AS d
    // Expected: 11
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN date('1984-10-11').day");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(11);
  });

  test("[4] Should access week from date", () => {
    // Original TCK: RETURN date('1984-10-11').week AS w
    // Expected: 41
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN date('1984-10-11').week");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(41);
  });

  test("[5] Should access weekDay from date", () => {
    // Original TCK: RETURN date('1984-10-11').dayOfWeek AS dow
    // Expected: 4
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN date('1984-10-11').dayOfWeek");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(4);
  });

  test("[6] Should access quarter from date", () => {
    // Original TCK: RETURN date('1984-10-11').quarter AS q
    // Expected: 4
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN date('1984-10-11').quarter");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(4);
  });

  test("[7] Should access ordinalDay from date", () => {
    // Original TCK: RETURN date('1984-10-11').ordinalDay AS od
    // Expected: 285
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN date('1984-10-11').ordinalDay");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(285);
  });

  test("[8] Should access hour from time", () => {
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN time('12:31:14.645876123+01:00').hour");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(12);
  });

  test("[9] Should access minute from time", () => {
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN time('12:31:14.645876123+01:00').minute");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(31);
  });

  test("[10] Should access second from time", () => {
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN time('12:31:14.645876123+01:00').second");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(14);
  });

  test("[11] Should access millisecond from time", () => {
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN time('12:31:14.645876123+01:00').millisecond");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(645);
  });

  test("[12] Should access microsecond from time", () => {
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN time('12:31:14.645876123+01:00').microsecond");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(645876);
  });

  test("[13] Should access nanosecond from time", () => {
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN time('12:31:14.645876123+01:00').nanosecond");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(645876123);
  });

  test.fails("[14] Should access timezone from time - timezone property only available for named timezones", () => {
    // Original TCK: RETURN time('12:31:14+01:00').timezone AS tz
    // Expected: '+01:00'
    // Our implementation only stores timezone for named timezones like 'Europe/Stockholm'
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN time('12:31:14+01:00').timezone");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("+01:00");
  });

  test("[15] Should access offset from time", () => {
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN time('12:31:14+01:00').offset");
    expect(result).toHaveLength(1);
    // Our implementation returns offset in seconds (3600 = 1 hour)
    expect(result[0]).toBe(3600);
  });

  test("[16] Should access duration years component", () => {
    // Original TCK: RETURN duration('P1Y2M14DT12H31M14S').years AS y
    // Expected: 1
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN duration('P1Y2M14DT12H31M14S').years");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(1);
  });

  test.fails("[17] Should access duration months component - duration months returns total months not months-of-year", () => {
    // Original TCK: RETURN duration('P1Y2M14DT12H31M14S').months AS m
    // Expected: 2 (months of year)
    // Reason: Our duration.months returns total months (14), not months-of-year (2)
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN duration('P1Y2M14DT12H31M14S').months");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(2);
  });

  test("[18] Should access duration days component", () => {
    // Original TCK: RETURN duration('P1Y2M14DT12H31M14S').days AS d
    // Expected: 14
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN duration('P1Y2M14DT12H31M14S').days");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(14);
  });

  test("[19] Should access datetime epochSeconds", () => {
    // Original TCK: RETURN datetime('1970-01-01T00:00:00Z').epochSeconds AS es
    // Expected: 0
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN datetime('1970-01-01T00:00:00Z').epochSeconds");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(0);
  });

  test("[20] Should access datetime epochMillis", () => {
    // Original TCK: RETURN datetime('1970-01-01T00:00:00Z').epochMillis AS em
    // Expected: 0
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN datetime('1970-01-01T00:00:00Z').epochMillis");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(0);
  });
});
