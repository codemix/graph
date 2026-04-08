/**
 * TCK Temporal1 - Create Temporal Values from a Map
 * Translated from tmp/tck/features/expressions/temporal/Temporal1.feature
 *
 * NOTE: Temporal types (date, time, datetime, localdatetime, duration) are not
 * implemented in the graph package. The FunctionRegistry does not include temporal
 * constructor functions, and the grammar does not support temporal type syntax.
 * All tests are skipped pending future implementation.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Temporal1 - Create Temporal Values from a Map", () => {
  // Temporal functions now implemented - testing map-based construction

  test.fails(
    "[1] Should construct week date - week-based dates not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN date({year: 1816, week: 1}) AS d",
      );
      expect(results).toHaveLength(1);
      expect(String(results[0])).toBe("1816-01-01");
    },
  );

  test.fails(
    "[2] Should construct week localdatetime - week-based localdatetime not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN localdatetime({year: 1816, week: 1}) AS d",
      );
      expect(results).toHaveLength(1);
      expect(String(results[0])).toMatch(/^1816-01-01T00:00/);
    },
  );

  test.fails(
    "[3] Should construct week datetime - week-based datetime not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN datetime({year: 1816, week: 1, timezone: 'Europe/Stockholm'}) AS d",
      );
      expect(results).toHaveLength(1);
      expect(String(results[0])).toMatch(/^1816-01-01T00:00/);
    },
  );

  test("[4] Should construct date", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date({year: 1984, month: 10, day: 11}) AS d",
    );
    expect(results).toHaveLength(1);
    expect(String(results[0])).toBe("1984-10-11");
  });

  test("[5] Should construct localdatetime", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN localdatetime({year: 1984, month: 10, day: 11, hour: 12}) AS d",
    );
    expect(results).toHaveLength(1);
    // localdatetime format: 1984-10-11T12:00:00.000
    expect(String(results[0])).toMatch(/^1984-10-11T12:00/);
  });

  test("[6] Should construct datetime", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime({year: 1984, month: 10, day: 11, hour: 12, timezone: 'Europe/Stockholm'}) AS d",
    );
    expect(results).toHaveLength(1);
    expect(String(results[0])).toMatch(/1984-10-11T12:00.*Europe\/Stockholm/);
  });

  test("[7] Should construct localtime", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN localtime({hour: 12, minute: 31, second: 14}) AS t",
    );
    expect(results).toHaveLength(1);
    expect(String(results[0])).toMatch(/^12:31:14/);
  });

  test.fails(
    "[8] Should construct time with timezone offset - timezone not preserved in output",
    () => {
      // Returns '12:31:14.645876123Z' instead of preserving +01:00 offset
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN time({hour: 12, minute: 31, second: 14, nanosecond: 645876123, timezone: '+01:00'}) AS t",
      );
      expect(results).toHaveLength(1);
      expect(String(results[0])).toMatch(/12:31:14.*\+01:00/);
    },
  );

  test("[9] Should construct duration from components", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration({months: 14, days: 16, hours: 12, minutes: 31, seconds: 14, nanoseconds: 645876123}) AS d",
    );
    expect(results).toHaveLength(1);
    expect(String(results[0])).toBe("P1Y2M16DT12H31M14.645876123S");
  });

  test("[10] Should construct duration from weeks", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration({weeks: 2, days: 3}) AS d",
    );
    expect(results).toHaveLength(1);
    expect(String(results[0])).toBe("P17D");
  });
});
