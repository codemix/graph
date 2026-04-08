/**
 * TCK Temporal8 - Compute Arithmetic Operations on Temporal Values
 * Translated from tmp/tck/features/expressions/temporal/Temporal8.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";
import {
  DateValue,
  DurationValue,
  LocalTimeValue,
} from "../../../TemporalTypes.js";

describe("Temporal8 - Compute Arithmetic Operations on Temporal Values", () => {
  test("[1] Should add duration to date", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date('1984-10-11') + duration('P1D') AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateValue;
    expect(result).toBeInstanceOf(DateValue);
    expect(result.toString()).toBe("1984-10-12");
  });

  test("[2] Should subtract duration from date", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date('1984-10-11') - duration('P1D') AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateValue;
    expect(result).toBeInstanceOf(DateValue);
    expect(result.toString()).toBe("1984-10-10");
  });

  test("[3] Should add duration to datetime", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime('1984-10-11T12:31:14+01:00') + duration('PT1H') AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as { hour: number };
    expect(result.hour).toBe(13);
  });

  test("[4] Should subtract duration from datetime", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime('1984-10-11T12:31:14+01:00') - duration('PT1H') AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as { hour: number };
    expect(result.hour).toBe(11);
  });

  test("[5] Should add duration to localtime", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN localtime('12:31:14') + duration('PT1H') AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as LocalTimeValue;
    expect(result).toBeInstanceOf(LocalTimeValue);
    expect(result.toString()).toBe("13:31:14");
  });

  test("[6] Should subtract duration from localtime", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN localtime('12:31:14') - duration('PT1H') AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as LocalTimeValue;
    expect(result).toBeInstanceOf(LocalTimeValue);
    expect(result.toString()).toBe("11:31:14");
  });

  test.fails(
    "[7] Should add durations together - duration + duration not fully supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN duration('P1D') + duration('P1D') AS result",
      );
      expect(results).toHaveLength(1);
      const result = results[0] as DurationValue;
      expect(result).toBeInstanceOf(DurationValue);
      expect(result.days).toBe(2);
    },
  );

  test.fails(
    "[8] Should subtract durations - duration - duration not fully supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN duration('P2D') - duration('P1D') AS result",
      );
      expect(results).toHaveLength(1);
      const result = results[0] as DurationValue;
      expect(result).toBeInstanceOf(DurationValue);
      expect(result.days).toBe(1);
    },
  );

  test("[9] Should multiply duration by scalar", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration('P1D') * 2 AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DurationValue;
    expect(result).toBeInstanceOf(DurationValue);
    expect(result.days).toBe(2);
  });

  test("[10] Should divide duration by scalar", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration('P2D') / 2 AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DurationValue;
    expect(result).toBeInstanceOf(DurationValue);
    expect(result.days).toBe(1);
  });

  test("[11] Should add year-month duration to date", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date('1984-10-11') + duration('P1Y2M') AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as DateValue;
    expect(result).toBeInstanceOf(DateValue);
    expect(result.toString()).toBe("1985-12-11");
  });

  test.fails(
    "[12] Should handle duration arithmetic with mixed signs - duration - duration not fully supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN duration('P1M') - duration('P2M') AS result",
      );
      expect(results).toHaveLength(1);
      const result = results[0] as DurationValue;
      expect(result).toBeInstanceOf(DurationValue);
      expect(result.months).toBe(-1);
    },
  );

  test("[13] Should add time duration to time", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN time('12:31:14+01:00') + duration('PT30M15S') AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as {
      hour: number;
      minute: number;
      second: number;
    };
    expect(result.hour).toBe(13);
    expect(result.minute).toBe(1);
    expect(result.second).toBe(29);
  });

  test("[14] Should handle overflow in time addition", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN localtime('23:00:00') + duration('PT2H') AS result",
    );
    expect(results).toHaveLength(1);
    const result = results[0] as LocalTimeValue;
    expect(result).toBeInstanceOf(LocalTimeValue);
    expect(result.toString()).toBe("01:00:00");
  });

  test("[15] Should negate duration", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN -duration('P1D') AS result");
    expect(results).toHaveLength(1);
    const result = results[0] as DurationValue;
    expect(result).toBeInstanceOf(DurationValue);
    expect(result.days).toBe(-1);
  });
});
