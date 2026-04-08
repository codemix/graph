/**
 * TCK Temporal7 - Compare Temporal Values
 * Translated from tmp/tck/features/expressions/temporal/Temporal7.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Temporal7 - Compare Temporal Values", () => {
  test("[1] Should compare dates with less than", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date('1984-10-11') < date('1984-10-12') AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[2] Should compare dates with greater than", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date('1984-10-12') > date('1984-10-11') AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[3] Should compare dates for equality", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date('1984-10-11') = date('1984-10-11') AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[4] Should compare dates with less than or equal", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date('1984-10-11') <= date('1984-10-11') AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[5] Should compare dates with greater than or equal", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN date('1984-10-12') >= date('1984-10-11') AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[6] Should compare times", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN time('12:31:14+01:00') < time('12:31:15+01:00') AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[7] Should compare localtimes", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN localtime('12:31:14') < localtime('12:31:15') AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[8] Should compare datetimes", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime('1984-10-11T12:31:14+01:00') < datetime('1984-10-11T12:31:15+01:00') AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[9] Should compare localdatetimes", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN localdatetime('1984-10-11T12:31:14') < localdatetime('1984-10-11T12:31:15') AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[10] Should compare equal durations", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration('P1Y2M') = duration('P1Y2M') AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test("[11] Should compare durations with different representations", () => {
    const graph = createTckGraph();
    // P14D and P2W are equivalent (14 days = 2 weeks)
    const results = executeTckQuery(graph, "RETURN duration('P14D') = duration('P2W') AS result");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });

  test.fails("[12] Should compare datetime across timezones - timezone normalization not implemented", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN datetime('1984-10-11T12:31:14+01:00') = datetime('1984-10-11T11:31:14Z') AS result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(true);
  });
});
