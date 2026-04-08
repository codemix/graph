/**
 * TCK Temporal9 - Truncate Temporal Values
 * Translated from tmp/tck/features/expressions/temporal/Temporal9.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";
import {
  DateValue,
  DateTimeValue,
  LocalDateTimeValue,
} from "../../../TemporalTypes.js";

describe("Temporal9 - Truncate Temporal Values", () => {
  test("[1] Should truncate date to year", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date.truncate('year', date('1984-10-11')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateValue;
    expect(result).toBeInstanceOf(DateValue);
    expect(result.toString()).toBe("1984-01-01");
  });

  test("[2] Should truncate date to month", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date.truncate('month', date('1984-10-11')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateValue;
    expect(result).toBeInstanceOf(DateValue);
    expect(result.toString()).toBe("1984-10-01");
  });

  test("[3] Should truncate date to week", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date.truncate('week', date('1984-10-11')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateValue;
    expect(result).toBeInstanceOf(DateValue);
    // 1984-10-11 is Thursday, Monday of that week is 1984-10-08
    expect(result.toString()).toBe("1984-10-08");
  });

  test("[4] Should truncate date to quarter", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date.truncate('quarter', date('1984-10-11')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateValue;
    expect(result).toBeInstanceOf(DateValue);
    // October is Q4, which starts on Oct 1
    expect(result.toString()).toBe("1984-10-01");
  });

  test("[5] Should truncate date to decade", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date.truncate('decade', date('1984-10-11')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateValue;
    expect(result).toBeInstanceOf(DateValue);
    expect(result.toString()).toBe("1980-01-01");
  });

  test("[6] Should truncate date to century", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date.truncate('century', date('1984-10-11')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateValue;
    expect(result).toBeInstanceOf(DateValue);
    expect(result.toString()).toBe("1901-01-01");
  });

  test("[7] Should truncate date to millennium", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date.truncate('millennium', date('1984-10-11')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateValue;
    expect(result).toBeInstanceOf(DateValue);
    expect(result.toString()).toBe("1001-01-01");
  });

  test("[8] Should truncate datetime to hour", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime.truncate('hour', datetime('1984-10-11T12:31:14+01:00')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateTimeValue;
    expect(result).toBeInstanceOf(DateTimeValue);
    expect(result.hour).toBe(12);
    expect(result.minute).toBe(0);
    expect(result.second).toBe(0);
  });

  test("[9] Should truncate datetime to minute", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime.truncate('minute', datetime('1984-10-11T12:31:14+01:00')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateTimeValue;
    expect(result).toBeInstanceOf(DateTimeValue);
    expect(result.hour).toBe(12);
    expect(result.minute).toBe(31);
    expect(result.second).toBe(0);
  });

  test("[10] Should truncate datetime to second", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime.truncate('second', datetime('1984-10-11T12:31:14.645+01:00')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateTimeValue;
    expect(result).toBeInstanceOf(DateTimeValue);
    expect(result.hour).toBe(12);
    expect(result.minute).toBe(31);
    expect(result.second).toBe(14);
    expect(result.nanosecond).toBe(0);
  });

  test("[11] Should truncate datetime to millisecond", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime.truncate('millisecond', datetime('1984-10-11T12:31:14.645876123+01:00')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateTimeValue;
    expect(result).toBeInstanceOf(DateTimeValue);
    expect(result.second).toBe(14);
    // nanosecond should be truncated to millisecond precision (645000000)
    expect(result.nanosecond).toBe(645000000);
  });

  test("[12] Should truncate datetime to microsecond", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime.truncate('microsecond', datetime('1984-10-11T12:31:14.645876123+01:00')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateTimeValue;
    expect(result).toBeInstanceOf(DateTimeValue);
    expect(result.second).toBe(14);
    // nanosecond should be truncated to microsecond precision (645876000)
    expect(result.nanosecond).toBe(645876000);
  });

  test("[13] Should truncate time to hour", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN time.truncate('hour', time('12:31:14+01:00')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as {
      hour: number;
      minute: number;
      second: number;
    };
    expect(result.hour).toBe(12);
    expect(result.minute).toBe(0);
    expect(result.second).toBe(0);
  });

  test("[14] Should truncate with override", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date.truncate('year', date('1984-10-11'), {day: 5}) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateValue;
    expect(result).toBeInstanceOf(DateValue);
    expect(result.toString()).toBe("1984-01-05");
  });

  test("[15] Should truncate localdatetime", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN localdatetime.truncate('day', localdatetime('1984-10-11T12:31:14')) AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as LocalDateTimeValue;
    expect(result).toBeInstanceOf(LocalDateTimeValue);
    expect(result.year).toBe(1984);
    expect(result.month).toBe(10);
    expect(result.day).toBe(11);
    expect(result.hour).toBe(0);
    expect(result.minute).toBe(0);
    expect(result.second).toBe(0);
  });
});
