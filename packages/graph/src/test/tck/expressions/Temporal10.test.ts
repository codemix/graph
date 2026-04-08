/**
 * TCK Temporal10 - Compute Durations Between two Temporal Values
 * Translated from tmp/tck/features/expressions/temporal/Temporal10.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";
import { DurationValue } from "../../../TemporalTypes.js";

describe("Temporal10 - Compute Durations Between two Temporal Values", () => {
  test("[1] Should compute duration between dates", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration.between(date('1984-10-11'), date('1985-10-11')) AS d",
    );
    expect(results).toHaveLength(1);
    const d = results[0] as DurationValue;
    expect(d).toBeInstanceOf(DurationValue);
    expect(d.months).toBe(12); // 1 year = 12 months
  });

  test("[2] Should compute duration between datetimes", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration.between(datetime('1984-10-11T12:31:14+01:00'), datetime('1985-10-11T12:31:14+01:00')) AS d",
    );
    expect(results).toHaveLength(1);
    const d = results[0] as DurationValue;
    expect(d).toBeInstanceOf(DurationValue);
    expect(d.months).toBe(12); // 1 year = 12 months
  });

  test("[3] Should compute duration between times", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration.between(time('12:31:14+01:00'), time('13:31:14+01:00')) AS d",
    );
    expect(results).toHaveLength(1);
    const d = results[0] as DurationValue;
    expect(d).toBeInstanceOf(DurationValue);
    expect(d.seconds).toBe(3600); // 1 hour = 3600 seconds
  });

  test("[4] Should compute duration in months", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration.inMonths(date('1984-10-11'), date('1985-01-11')) AS d",
    );
    expect(results).toHaveLength(1);
    const d = results[0] as DurationValue;
    expect(d).toBeInstanceOf(DurationValue);
    expect(d.months).toBe(3);
  });

  test("[5] Should compute duration in days", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration.inDays(date('1984-10-11'), date('1984-10-14')) AS d",
    );
    expect(results).toHaveLength(1);
    const d = results[0] as DurationValue;
    expect(d).toBeInstanceOf(DurationValue);
    expect(d.days).toBe(3);
  });

  test("[6] Should compute duration in seconds", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration.inSeconds(localtime('12:31:14'), localtime('13:32:15')) AS d",
    );
    expect(results).toHaveLength(1);
    const d = results[0] as DurationValue;
    expect(d).toBeInstanceOf(DurationValue);
    expect(d.seconds).toBe(3661); // 1h 1m 1s
  });

  test("[7] Should compute negative duration", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration.between(date('1985-10-11'), date('1984-10-11')) AS d",
    );
    expect(results).toHaveLength(1);
    const d = results[0] as DurationValue;
    expect(d).toBeInstanceOf(DurationValue);
    expect(d.months).toBe(-12); // -1 year
  });

  test.fails(
    "[8] Should compute duration across DST transition - named timezone computation not implemented",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        `RETURN duration.between(
        datetime('2017-03-25T12:00[Europe/Stockholm]'),
        datetime('2017-03-27T12:00[Europe/Stockholm]')
      ) AS d`,
      );
      expect(results).toHaveLength(1);
      const d = results[0] as DurationValue;
      expect(d).toBeInstanceOf(DurationValue);
      expect(d.days).toBe(2);
    },
  );

  test.fails(
    "[9] Should compute duration with large year values - extreme date range not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN duration.between(date('-999999999-01-01'), date('999999999-12-31')) AS d",
      );
      expect(results).toHaveLength(1);
      const d = results[0] as DurationValue;
      expect(d).toBeInstanceOf(DurationValue);
    },
  );

  test("[10] Should handle null in duration computation", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration.between(null, date('1984-10-11')) AS d",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBeNull();
  });

  test("[11] Should compute months component only", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `WITH date('1984-10-11') AS d1, date('1985-03-14') AS d2
       RETURN duration.inMonths(d1, d2).months AS m`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(5);
  });

  test("[12] Should compute days component only", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `WITH date('1984-10-11') AS d1, date('1985-03-14') AS d2
       RETURN duration.inDays(d1, d2).days AS d`,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(154);
  });

  test("[13] Should compute duration between localtimes", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration.between(localtime('12:31:14'), localtime('14:32:15')) AS d",
    );
    expect(results).toHaveLength(1);
    const d = results[0] as DurationValue;
    expect(d).toBeInstanceOf(DurationValue);
    expect(d.seconds).toBe(7261); // 2h 1m 1s
  });

  test("[14] Should compute duration between localdatetimes", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "RETURN duration.between(localdatetime('1984-10-11T12:31:14'), localdatetime('1985-10-11T14:32:15')) AS d",
    );
    expect(results).toHaveLength(1);
    const d = results[0] as DurationValue;
    expect(d).toBeInstanceOf(DurationValue);
    expect(d.months).toBe(12); // 1 year
    expect(d.seconds).toBe(7261); // 2h 1m 1s
  });

  test.fails(
    "[15] Should compute duration between mixed temporal types - mixed type comparison not implemented",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "RETURN duration.between(date('1984-10-11'), datetime('1985-10-11T00:00Z')) AS d",
      );
      expect(results).toHaveLength(1);
      const d = results[0] as DurationValue;
      expect(d).toBeInstanceOf(DurationValue);
      expect(d.months).toBe(12);
    },
  );
});
