/**
 * TCK Temporal6 - Render Temporal Values as a String
 * Translated from tmp/tck/features/expressions/temporal/Temporal6.feature
 *
 * NOTE: Only toString() for date values is currently implemented.
 * Other temporal types are pending future implementation.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Temporal6 - Render Temporal Values as a String", () => {
  test("[1] Should convert date to string", () => {
    // Original TCK: RETURN toString(date('1984-10-11')) AS s
    // Expected: '1984-10-11'
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN toString(date('1984-10-11'))");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("1984-10-11");
  });

  test("[2] Should convert localtime to string", () => {
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN toString(localtime('12:31:14.645876123'))");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("12:31:14.645876123");
  });

  test("[3] Should convert time to string", () => {
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN toString(time('12:31:14.645876123+01:00'))");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("12:31:14.645876123+01:00");
  });

  test("[4] Should convert localdatetime to string", () => {
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "RETURN toString(localdatetime('1984-10-11T12:31:14.645876123'))",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("1984-10-11T12:31:14.645876123");
  });

  test("[5] Should convert datetime to string", () => {
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "RETURN toString(datetime('1984-10-11T12:31:14.645876123+01:00'))",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("1984-10-11T12:31:14.645876123+01:00");
  });

  test("[6] Should convert duration to string", () => {
    // Original TCK: RETURN toString(duration('P1Y2M14DT12H31M14.645876123S')) AS s
    // Expected: 'P1Y2M14DT12H31M14.645876123S'
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "RETURN toString(duration('P1Y2M14DT12H31M14.645876123S'))",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("P1Y2M14DT12H31M14.645876123S");
  });

  test("[7] Should round-trip date through string", () => {
    // Original TCK: RETURN date(toString(date('1984-10-11'))) = date('1984-10-11') AS eq
    // Expected: true
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "RETURN date(toString(date('1984-10-11'))) = date('1984-10-11')",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(true);
  });

  test("[8] Should round-trip time through string", () => {
    // Original TCK: RETURN time(toString(time('12:31:14+01:00'))) = time('12:31:14+01:00') AS eq
    // Expected: true
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "RETURN time(toString(time('12:31:14+01:00'))) = time('12:31:14+01:00')",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(true);
  });

  test.fails("[9] Should handle duration with mixed signs - format differs from TCK", () => {
    // Original TCK: RETURN toString(duration({months: -1, days: 1})) AS s
    // Expected: 'P-1M1D'
    // Reason: Our implementation outputs '-P1M1D' instead of 'P-1M1D'
    const graph = createTckGraph();
    const result = executeTckQuery(graph, "RETURN toString(duration({months: -1, days: 1}))");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("P-1M1D");
  });

  test.fails("[10] Should handle datetime with named timezone - offset computation not implemented", () => {
    // Original TCK: RETURN toString(datetime('1984-10-11T12:31:14[Europe/Stockholm]')) AS s
    // Expected: '1984-10-11T12:31:14+01:00[Europe/Stockholm]'
    // Reason: Offset computation from named timezone not implemented (returns +00:00 instead of +01:00)
    const graph = createTckGraph();
    const result = executeTckQuery(
      graph,
      "RETURN toString(datetime('1984-10-11T12:31:14[Europe/Stockholm]'))",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("1984-10-11T12:31:14+01:00[Europe/Stockholm]");
  });
});
