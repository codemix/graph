/**
 * TCK WithOrderBy2 - Order by a single expression
 * Translated from tmp/tck/features/clauses/with-orderBy/WithOrderBy2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getProperty } from "../tckHelpers.js";

describe("WithOrderBy2 - Order by a single expression", () => {
  // [1]-[2] Sort by boolean expression
  test.fails("[1] Sort by a boolean expression in ascending order - complex boolean expression in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {bool: true, bool2: true}), (:A {bool: false, bool2: true}), (:A {bool: true, bool2: false})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY NOT (a.bool AND a.bool2) LIMIT 2 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  test.fails("[2] Sort by a boolean expression in descending order - complex boolean expression in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {bool: true, bool2: true}), (:A {bool: false, bool2: true}), (:A {bool: true, bool2: false})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY NOT (a.bool AND a.bool2) DESC LIMIT 3 RETURN a",
    );
    expect(results).toHaveLength(3);
  });

  // [3]-[4] Sort by integer expression
  test("[3] Sort by an integer expression in ascending order - complex arithmetic in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY (a.num2 + (a.num * 2)) * -1 LIMIT 3 RETURN a",
    );
    expect(results).toHaveLength(3);
  });

  test("[4] Sort by an integer expression in descending order - complex arithmetic in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY (a.num2 + (a.num * 2)) * -1 DESC LIMIT 3 RETURN a",
    );
    expect(results).toHaveLength(3);
  });

  // [5]-[6] Sort by float expression
  test("[5] Sort by a float expression in ascending order - complex arithmetic in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1.0, num2: 10.0}), (:A {num: 2.0, num2: 20.0}), (:A {num: 3.0, num2: 30.0})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY (a.num + a.num2 * 2) * -1.01 LIMIT 3 RETURN a",
    );
    expect(results).toHaveLength(3);
  });

  test("[6] Sort by a float expression in descending order - complex arithmetic in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1.0, num2: 10.0}), (:A {num: 2.0, num2: 20.0}), (:A {num: 3.0, num2: 30.0})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY (a.num + a.num2 * 2) * -1.01 DESC LIMIT 3 RETURN a",
    );
    expect(results).toHaveLength(3);
  });

  // [7]-[8] Sort by string expression - string concatenation in ORDER BY
  test("[7] Sort by a string expression in ascending order - string concatenation in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {title: 'Mr', name: 'Smith'}), (:A {title: 'Ms', name: 'Jones'}), (:A {title: 'Dr', name: 'Brown'})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.title + ' ' + a.name LIMIT 3 RETURN a",
    );
    expect(results).toHaveLength(3);
  });

  test("[8] Sort by a string expression in descending order - string concatenation in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {title: 'Mr', name: 'Smith'}), (:A {title: 'Ms', name: 'Jones'}), (:A {title: 'Dr', name: 'Brown'})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.title + ' ' + a.name DESC LIMIT 3 RETURN a",
    );
    expect(results).toHaveLength(3);
  });

  // [9]-[10] Sort by list expression
  test("[9] Sort by a list expression in ascending order - list expressions in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {list: [1, 2], list2: [3, 4]}), (:A {list: [5, 6], list2: [7, 8]})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY [a.list2[1], a.list2[0], a.list[1]] + a.list + a.list2 LIMIT 3 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  test("[10] Sort by a list expression in descending order - list expressions in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {list: [1, 2], list2: [3, 4]}), (:A {list: [5, 6], list2: [7, 8]})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY [a.list2[1], a.list2[0], a.list[1]] + a.list + a.list2 DESC LIMIT 3 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  // [11]-[20] Sort by date/time expressions - temporal types not supported
  test.fails("[11] Sort by a date expression in ascending order - date/duration not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {d: date('2020-01-01')}), (:A {d: date('2019-01-01')})");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.d + duration({days: 1}) LIMIT 2 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  test.fails("[12] Sort by a date expression in descending order - date/duration not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {d: date('2020-01-01')}), (:A {d: date('2019-01-01')})");
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.d + duration({days: 1}) DESC LIMIT 2 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  test.fails("[13] Sort by a local time expression ASC - localtime/duration not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {t: localtime('10:00:00')}), (:A {t: localtime('14:00:00')})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.t + duration({hours: 1}) LIMIT 2 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  test.fails("[14] Sort by a local time expression DESC - localtime/duration not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {t: localtime('10:00:00')}), (:A {t: localtime('14:00:00')})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.t + duration({hours: 1}) DESC LIMIT 2 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  test.fails("[15] Sort by a time expression ASC - time/duration not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {t: time('10:00:00+01:00')}), (:A {t: time('14:00:00+01:00')})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.t + duration({hours: 1}) LIMIT 2 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  test.fails("[16] Sort by a time expression DESC - time/duration not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {t: time('10:00:00+01:00')}), (:A {t: time('14:00:00+01:00')})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.t + duration({hours: 1}) DESC LIMIT 2 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  test.fails("[17] Sort by a local datetime expression ASC - localdatetime/duration not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {dt: localdatetime('2020-01-01T10:00:00')}), (:A {dt: localdatetime('2019-01-01T14:00:00')})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.dt + duration({days: 1}) LIMIT 2 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  test.fails("[18] Sort by a local datetime expression DESC - localdatetime/duration not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {dt: localdatetime('2020-01-01T10:00:00')}), (:A {dt: localdatetime('2019-01-01T14:00:00')})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.dt + duration({days: 1}) DESC LIMIT 2 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  test.fails("[19] Sort by a datetime expression ASC - datetime/duration not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {dt: datetime('2020-01-01T10:00:00+01:00')}), (:A {dt: datetime('2019-01-01T14:00:00+01:00')})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.dt + duration({days: 1}) LIMIT 2 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  test.fails("[20] Sort by a datetime expression DESC - datetime/duration not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {dt: datetime('2020-01-01T10:00:00+01:00')}), (:A {dt: datetime('2019-01-01T14:00:00+01:00')})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a ORDER BY a.dt + duration({days: 1}) DESC LIMIT 2 RETURN a",
    );
    expect(results).toHaveLength(2);
  });

  // [21]-[24] use unlabeled nodes or complex expressions
  test("[21] Sort by expression partially orderable - unlabeled nodes not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({name: 'A'}), ({name: 'B'}), ({name: 'C'})");
    const results = executeTckQuery(graph, "MATCH (a) WITH a ORDER BY a.name LIMIT 3 RETURN a");
    expect(results).toHaveLength(3);
  });

  test("[22] Sort by expression with grouping key - unlabeled nodes and count(*) not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({x: 1}), ({x: 1}), ({x: 2})");
    const results = executeTckQuery(
      graph,
      "MATCH (a) WITH a.x AS x, count(*) AS cnt ORDER BY cnt RETURN x, cnt",
    );
    expect(results).toHaveLength(2);
  });

  test("[23] Sort by expression used in parts as grouping key - unlabeled nodes and count(*) not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({x: 1}), ({x: 1}), ({x: 2})");
    const results = executeTckQuery(
      graph,
      "MATCH (a) WITH a.x AS x, count(*) AS cnt ORDER BY x RETURN x, cnt",
    );
    expect(results).toHaveLength(2);
  });

  test("[24] Sort by expression with DISTINCT - unlabeled nodes and RETURN * not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({x: 1}), ({x: 1}), ({x: 2})");
    const results = executeTckQuery(graph, "MATCH (a) WITH DISTINCT a.x AS x ORDER BY x RETURN *");
    expect(results).toHaveLength(2);
  });

  // [25] Fail on sorting by an aggregation - error tests
  test.fails("[25] Fail on sorting by an aggregation - semantic validation not implemented", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 1}), (:A {num: 2})");
    expect(() => {
      executeTckQuery(graph, "MATCH (a:A) WITH a ORDER BY count(a) RETURN a");
    }).toThrow();
  });

  // Custom tests for supported patterns
  test("[custom-1] WITH ORDER BY property expression", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {num: 3}), (:A {num: 1}), (:A {num: 2})`);

    const results = executeTckQuery(graph, `MATCH (a:A) WITH a ORDER BY a.num LIMIT 2 RETURN a`);
    expect(results.length).toBe(2);
    const nums = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "num");
    });
    expect(nums).toEqual([1, 2]);
  });

  test("[custom-2] WITH ORDER BY property expression DESC", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {num: 3}), (:A {num: 1}), (:A {num: 2})`);

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a ORDER BY a.num DESC LIMIT 2 RETURN a`,
    );
    expect(results.length).toBe(2);
    const nums = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "num");
    });
    expect(nums).toEqual([3, 2]);
  });

  test("[custom-3] WITH ORDER BY string property", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'charlie'}), (:A {name: 'alice'}), (:A {name: 'bob'})`,
    );

    const results = executeTckQuery(graph, `MATCH (a:A) WITH a ORDER BY a.name RETURN a`);
    expect(results.length).toBe(3);
    const names = results.map((r) => {
      const [node] = r as [Record<string, unknown>];
      return getProperty(node, "name");
    });
    expect(names).toEqual(["alice", "bob", "charlie"]);
  });

  test("[custom-4] WITH multiple projections ORDER BY property expression", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 3, name: 'c'}), (:A {num: 1, name: 'a'}), (:A {num: 2, name: 'b'})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a ORDER BY a.num RETURN a.num AS num, a.name AS name`,
    );
    expect(results.length).toBe(3);
    expect(results).toEqual([
      [1, "a"],
      [2, "b"],
      [3, "c"],
    ]);
  });
});
