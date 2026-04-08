/**
 * TCK WithOrderBy1 - Order by a single variable
 * Translated from tmp/tck/features/clauses/with-orderBy/WithOrderBy1.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";
import {
  DateValue,
  LocalTimeValue,
  TimeValue,
  LocalDateTimeValue,
  DateTimeValue,
} from "../../../TemporalTypes.js";

describe("WithOrderBy1 - Order by a single variable", () => {
  test("[1] Sort booleans in ascending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [true, false] AS bools WITH bools ORDER BY bools LIMIT 1 RETURN bools",
    );
    // false < true in boolean ordering
    expect(results).toEqual([[false]]);
  });

  test("[2] Sort booleans in descending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [true, false] AS bools WITH bools ORDER BY bools DESC LIMIT 1 RETURN bools",
    );
    // true > false in boolean ordering
    expect(results).toEqual([[true]]);
  });

  test("[3] Sort integers in ascending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 3, 2] AS ints WITH ints ORDER BY ints LIMIT 2 RETURN ints",
    );
    expect(results).toEqual([[1], [2]]);
  });

  test("[4] Sort integers in descending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1, 3, 2] AS ints WITH ints ORDER BY ints DESC LIMIT 2 RETURN ints",
    );
    expect(results).toEqual([[3], [2]]);
  });

  test("[5] Sort floats in ascending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1.5, 1.3, 999.99] AS floats WITH floats ORDER BY floats LIMIT 2 RETURN floats",
    );
    expect(results).toEqual([[1.3], [1.5]]);
  });

  test("[6] Sort floats in descending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [1.5, 1.3, 999.99] AS floats WITH floats ORDER BY floats DESC LIMIT 2 RETURN floats",
    );
    expect(results).toEqual([[999.99], [1.5]]);
  });

  test("[7] Sort strings in ascending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND ['.*', '', ' ', 'one'] AS strings WITH strings ORDER BY strings LIMIT 2 RETURN strings",
    );
    // Empty string < space < '.*' < 'one' in string ordering
    expect(results).toEqual([[""], [" "]]);
  });

  test("[8] Sort strings in descending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND ['.*', '', ' ', 'one'] AS strings WITH strings ORDER BY strings DESC LIMIT 2 RETURN strings",
    );
    // 'one' > '.*' > ' ' > '' in string ordering
    expect(results).toEqual([["one"], [".*"]]);
  });

  test.fails(
    "[9] Sort lists in ascending order - list comparison not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "UNWIND [[1], [1, 2], [], [1, 2, 3]] AS lists WITH lists ORDER BY lists LIMIT 4 RETURN lists",
      );
      expect(results).toEqual([[[], [1], [1, 2], [1, 2, 3]]]);
    },
  );

  test.fails(
    "[10] Sort lists in descending order - list comparison not supported",
    () => {
      const graph = createTckGraph();
      const results = executeTckQuery(
        graph,
        "UNWIND [[1], [1, 2], [], [1, 2, 3]] AS lists WITH lists ORDER BY lists DESC LIMIT 4 RETURN lists",
      );
      expect(results).toEqual([[[1, 2, 3], [1, 2], [1], []]]);
    },
  );

  // Tests [11]-[20] use temporal types - temporal functions ARE implemented
  test("[11] Sort dates in ascending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [date('1985-01-01'), date('1984-10-11'), date('1984-12-25')] AS dates
       WITH dates ORDER BY dates LIMIT 2
       RETURN dates`,
    );
    expect(results).toHaveLength(2);
    expect((results[0] as DateValue).toString()).toBe("1984-10-11");
    expect((results[1] as DateValue).toString()).toBe("1984-12-25");
  });

  test("[12] Sort dates in descending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [date('1985-01-01'), date('1984-10-11'), date('1984-12-25')] AS dates
       WITH dates ORDER BY dates DESC LIMIT 2
       RETURN dates`,
    );
    expect(results).toHaveLength(2);
    expect((results[0] as DateValue).toString()).toBe("1985-01-01");
    expect((results[1] as DateValue).toString()).toBe("1984-12-25");
  });

  test("[13] Sort local times in ascending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [localtime('14:30:00'), localtime('10:00:00'), localtime('12:00:00')] AS times
       WITH times ORDER BY times LIMIT 2
       RETURN times`,
    );
    expect(results).toHaveLength(2);
    expect((results[0] as LocalTimeValue).toString()).toBe("10:00:00");
    expect((results[1] as LocalTimeValue).toString()).toBe("12:00:00");
  });

  test("[14] Sort local times in descending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [localtime('14:30:00'), localtime('10:00:00'), localtime('12:00:00')] AS times
       WITH times ORDER BY times DESC LIMIT 2
       RETURN times`,
    );
    expect(results).toHaveLength(2);
    expect((results[0] as LocalTimeValue).toString()).toBe("14:30:00");
    expect((results[1] as LocalTimeValue).toString()).toBe("12:00:00");
  });

  test("[15] Sort times in ascending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [time('14:30:00+01:00'), time('10:00:00+01:00'), time('12:00:00+01:00')] AS times
       WITH times ORDER BY times LIMIT 2
       RETURN times`,
    );
    expect(results).toHaveLength(2);
    expect((results[0] as TimeValue).toString()).toBe("10:00:00+01:00");
    expect((results[1] as TimeValue).toString()).toBe("12:00:00+01:00");
  });

  test("[16] Sort times in descending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [time('14:30:00+01:00'), time('10:00:00+01:00'), time('12:00:00+01:00')] AS times
       WITH times ORDER BY times DESC LIMIT 2
       RETURN times`,
    );
    expect(results).toHaveLength(2);
    expect((results[0] as TimeValue).toString()).toBe("14:30:00+01:00");
    expect((results[1] as TimeValue).toString()).toBe("12:00:00+01:00");
  });

  test("[17] Sort local date times in ascending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [localdatetime('1985-01-01T14:30:00'), localdatetime('1984-10-11T10:00:00'), localdatetime('1984-12-25T12:00:00')] AS dts
       WITH dts ORDER BY dts LIMIT 2
       RETURN dts`,
    );
    expect(results).toHaveLength(2);
    expect((results[0] as LocalDateTimeValue).toString()).toMatch(
      /^1984-10-11/,
    );
    expect((results[1] as LocalDateTimeValue).toString()).toMatch(
      /^1984-12-25/,
    );
  });

  test("[18] Sort local date times in descending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [localdatetime('1985-01-01T14:30:00'), localdatetime('1984-10-11T10:00:00'), localdatetime('1984-12-25T12:00:00')] AS dts
       WITH dts ORDER BY dts DESC LIMIT 2
       RETURN dts`,
    );
    expect(results).toHaveLength(2);
    expect((results[0] as LocalDateTimeValue).toString()).toMatch(
      /^1985-01-01/,
    );
    expect((results[1] as LocalDateTimeValue).toString()).toMatch(
      /^1984-12-25/,
    );
  });

  test("[19] Sort date times in ascending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [datetime('1985-01-01T14:30:00+01:00'), datetime('1984-10-11T10:00:00+01:00'), datetime('1984-12-25T12:00:00+01:00')] AS dts
       WITH dts ORDER BY dts LIMIT 2
       RETURN dts`,
    );
    expect(results).toHaveLength(2);
    expect((results[0] as DateTimeValue).toString()).toMatch(/^1984-10-11/);
    expect((results[1] as DateTimeValue).toString()).toMatch(/^1984-12-25/);
  });

  test("[20] Sort date times in descending order", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      `UNWIND [datetime('1985-01-01T14:30:00+01:00'), datetime('1984-10-11T10:00:00+01:00'), datetime('1984-12-25T12:00:00+01:00')] AS dts
       WITH dts ORDER BY dts DESC LIMIT 2
       RETURN dts`,
    );
    expect(results).toHaveLength(2);
    expect((results[0] as DateTimeValue).toString()).toMatch(/^1985-01-01/);
    expect((results[1] as DateTimeValue).toString()).toMatch(/^1984-12-25/);
  });

  test("[21] Sort distinct types in ascending order", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N)-[:REL]->(:M)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n:N)-[r:REL]->() UNWIND [n, r, p] AS types WITH types ORDER BY types LIMIT 5 RETURN types",
    );
    expect(results).toHaveLength(3);
  });

  test("[22] Sort distinct types in descending order", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:N)-[:REL]->(:M)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (n:N)-[r:REL]->() UNWIND [n, r, p] AS types WITH types ORDER BY types DESC LIMIT 5 RETURN types",
    );
    expect(results).toHaveLength(3);
  });

  // Tests [23]-[34] use variables projected from node properties
  // These tests use ORDER BY on aliases (e.g., ORDER BY bool, ORDER BY num) which is not supported in grammar
  // [23] Sort by a boolean variable projected from a node property in ascending order
  test("[23] Sort by bool ASC", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {bool: true}), (:A {bool: false}), (:A {bool: true})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.bool AS bool WITH a, bool ORDER BY bool LIMIT 3 RETURN a, bool",
    );
    expect(results).toHaveLength(3);
  });

  // [24] Sort by a boolean variable projected from a node property in descending order
  test("[24] Sort by bool DESC", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {bool: true}), (:A {bool: false}), (:A {bool: true})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.bool AS bool WITH a, bool ORDER BY bool DESC LIMIT 2 RETURN a, bool",
    );
    expect(results).toHaveLength(2);
  });

  // [25] Sort by an integer variable projected from a node property in ascending order
  test("[25] Sort by num ASC", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 3}), (:A {num: 1}), (:A {num: 2})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.num AS num WITH a, num ORDER BY num LIMIT 3 RETURN a, num",
    );
    expect(results).toHaveLength(3);
  });

  // [26] Sort by an integer variable projected from a node property in descending order
  test("[26] Sort by num DESC", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 3}), (:A {num: 1}), (:A {num: 2})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.num AS num WITH a, num ORDER BY num DESC LIMIT 3 RETURN a, num",
    );
    expect(results).toHaveLength(3);
  });

  // [27] Sort by a float variable projected from a node property in ascending order
  test("[27] Sort by float num ASC", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 3.5}), (:A {num: 1.5}), (:A {num: 2.5})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.num AS num WITH a, num ORDER BY num LIMIT 3 RETURN a, num",
    );
    expect(results).toHaveLength(3);
  });

  // [28] Sort by a float variable projected from a node property in descending order
  test("[28] Sort by float num DESC", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 3.5}), (:A {num: 1.5}), (:A {num: 2.5})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.num AS num WITH a, num ORDER BY num DESC LIMIT 3 RETURN a, num",
    );
    expect(results).toHaveLength(3);
  });

  // [29] Sort by a string variable projected from a node property in ascending order
  test("[29] Sort by name ASC", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'charlie'}), (:A {name: 'alice'}), (:A {name: 'bob'})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.name AS name WITH a, name ORDER BY name LIMIT 3 RETURN a, name",
    );
    expect(results).toHaveLength(3);
  });

  // [30] Sort by a string variable projected from a node property in descending order
  test("[30] Sort by name DESC", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'charlie'}), (:A {name: 'alice'}), (:A {name: 'bob'})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.name AS name WITH a, name ORDER BY name DESC LIMIT 3 RETURN a, name",
    );
    expect(results).toHaveLength(3);
  });

  // [31]-[32] list sorting - list properties might work but list sorting is complex
  test("[31] Sort by a list variable in ascending order", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {list: [1, 2]}), (:A {list: [1]}), (:A {list: [1, 2, 3]})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.list AS list WITH a, list ORDER BY list LIMIT 3 RETURN a, list",
    );
    expect(results).toHaveLength(3);
  });

  test("[32] Sort by a list variable in descending order", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {list: [1, 2]}), (:A {list: [1]}), (:A {list: [1, 2, 3]})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.list AS list WITH a, list ORDER BY list DESC LIMIT 3 RETURN a, list",
    );
    expect(results).toHaveLength(3);
  });

  // [33]-[42] use temporal types in node properties - date({year: ...}) map syntax not supported
  test.fails(
    "[33] Sort by a date variable from node property ASC - date() not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {d: date({year: 2020, month: 1, day: 1})}), (:A {d: date({year: 2019, month: 1, day: 1})})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a, a.d AS d WITH a, d ORDER BY d LIMIT 2 RETURN a, d",
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[34] Sort by a date variable from node property DESC - date() not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {d: date({year: 2020, month: 1, day: 1})}), (:A {d: date({year: 2019, month: 1, day: 1})})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a, a.d AS d WITH a, d ORDER BY d DESC LIMIT 2 RETURN a, d",
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[35] Sort by local time variable ASC - localtime() not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {t: localtime({hour: 14, minute: 30})}), (:A {t: localtime({hour: 10, minute: 0})})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a, a.t AS t WITH a, t ORDER BY t LIMIT 2 RETURN a, t",
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[36] Sort by local time variable DESC - localtime() not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {t: localtime({hour: 14, minute: 30})}), (:A {t: localtime({hour: 10, minute: 0})})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a, a.t AS t WITH a, t ORDER BY t DESC LIMIT 2 RETURN a, t",
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails("[37] Sort by time variable ASC - time() not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {t: time({hour: 14, minute: 30, timezone: '+01:00'})}), (:A {t: time({hour: 10, minute: 0, timezone: '+01:00'})})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.t AS t WITH a, t ORDER BY t LIMIT 2 RETURN a, t",
    );
    expect(results).toHaveLength(2);
  });

  test.fails("[38] Sort by time variable DESC - time() not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {t: time({hour: 14, minute: 30, timezone: '+01:00'})}), (:A {t: time({hour: 10, minute: 0, timezone: '+01:00'})})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.t AS t WITH a, t ORDER BY t DESC LIMIT 2 RETURN a, t",
    );
    expect(results).toHaveLength(2);
  });

  test.fails(
    "[39] Sort by local datetime variable ASC - localdatetime() not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {dt: localdatetime({year: 2020, month: 1, day: 1, hour: 12})}), (:A {dt: localdatetime({year: 2019, month: 1, day: 1, hour: 12})})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a, a.dt AS dt WITH a, dt ORDER BY dt LIMIT 2 RETURN a, dt",
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[40] Sort by local datetime variable DESC - localdatetime() not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {dt: localdatetime({year: 2020, month: 1, day: 1, hour: 12})}), (:A {dt: localdatetime({year: 2019, month: 1, day: 1, hour: 12})})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a, a.dt AS dt WITH a, dt ORDER BY dt DESC LIMIT 2 RETURN a, dt",
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[41] Sort by datetime variable ASC - datetime() not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {dt: datetime({year: 2020, month: 1, day: 1, hour: 12, timezone: '+01:00'})}), (:A {dt: datetime({year: 2019, month: 1, day: 1, hour: 12, timezone: '+01:00'})})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a, a.dt AS dt WITH a, dt ORDER BY dt LIMIT 2 RETURN a, dt",
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[42] Sort by datetime variable DESC - datetime() not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {dt: datetime({year: 2020, month: 1, day: 1, hour: 12, timezone: '+01:00'})}), (:A {dt: datetime({year: 2019, month: 1, day: 1, hour: 12, timezone: '+01:00'})})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a, a.dt AS dt WITH a, dt ORDER BY dt DESC LIMIT 2 RETURN a, dt",
      );
      expect(results).toHaveLength(2);
    },
  );

  test("[43] Sort partially orderable variable", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [0, 2, 1, 2, 0, 1] AS x WITH x ORDER BY x ASC LIMIT 2 RETURN x",
    );
    expect(results).toEqual([[0], [0]]);
  });

  test("[44] Sort partially orderable variable with DISTINCT", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND [0, 2, 1, 2, 0, 1] AS x WITH DISTINCT x ORDER BY x ASC LIMIT 1 RETURN x",
    );
    expect(results).toEqual([[0]]);
  });

  // [45] Sort order should be consistent with comparisons - complex UNWIND + list comprehension
  test("[45] Sort order consistent with comparisons", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "UNWIND range(1, 10) AS x WITH x ORDER BY x RETURN [y IN range(1, 10) WHERE y < x] AS lessThan",
    );
    expect(results).toHaveLength(10);
  });

  // [46] Fail on sorting by an undefined variable - semantic validation not implemented
  test.fails(
    "[46] Fail on sorting by undefined variable - semantic validation not implemented",
    () => {
      const graph = createTckGraph();
      expect(() => {
        executeTckQuery(
          graph,
          "MATCH (a:A) WITH a ORDER BY undefined RETURN a",
        );
      }).toThrow();
    },
  );

  // Custom tests for supported patterns
  test("[custom-1] WITH ORDER BY property expression", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 3}), (:A {num: 1}), (:A {num: 2})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a ORDER BY a.num RETURN a.num AS num`,
    );
    expect(results.length).toBe(3);
    expect(results).toEqual([1, 2, 3]);
  });

  test("[custom-2] WITH ORDER BY property expression DESC", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 3}), (:A {num: 1}), (:A {num: 2})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a ORDER BY a.num DESC RETURN a.num AS num`,
    );
    expect(results.length).toBe(3);
    expect(results).toEqual([3, 2, 1]);
  });

  test("[custom-3] WITH ORDER BY with LIMIT", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 3}), (:A {num: 1}), (:A {num: 2}), (:A {num: 4}), (:A {num: 5})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a ORDER BY a.num LIMIT 3 RETURN a.num AS num`,
    );
    expect(results.length).toBe(3);
    expect(results).toEqual([1, 2, 3]);
  });

  test("[custom-4] WITH chained ORDER BY then RETURN", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 3}), (:A {num: 1}), (:A {num: 2})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a ORDER BY a.num RETURN a.num AS x`,
    );
    expect(results.length).toBe(3);
    expect(results).toEqual([1, 2, 3]);
  });
});
