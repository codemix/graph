/**
 * TCK WithOrderBy4 - Order by in combination with projection and aliasing
 * Translated from tmp/tck/features/clauses/with-orderBy/WithOrderBy4.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("WithOrderBy4 - Order by in combination with projection and aliasing", () => {
  test("[1] Sort by a projected expression", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30}), (:A {num: 4, num2: 40}), (:A {num: 5, num2: 50})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a, a.num + a.num2 AS total ORDER BY a.num + a.num2 LIMIT 3 RETURN a.num AS num, total`,
    );

    expect(results).toHaveLength(3);
    // Sorted by num + num2 ascending: (1+10=11), (2+20=22), (3+30=33)
    expect(results[0]).toEqual([1, 11]);
    expect(results[1]).toEqual([2, 22]);
    expect(results[2]).toEqual([3, 33]);
  });

  // [2] Sort by an alias of a projected expression
  test("[2] Sort by an alias of a projected expression", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30}), (:A {num: 4, num2: 40}), (:A {num: 5, num2: 50})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a, a.num + a.num2 AS sum ORDER BY sum LIMIT 3 RETURN a.num AS num, sum`,
    );

    expect(results).toHaveLength(3);
    // Sorted by sum ascending: (1+10=11), (2+20=22), (3+30=33)
    expect(results[0]).toEqual([1, 11]);
    expect(results[1]).toEqual([2, 22]);
    expect(results[2]).toEqual([3, 33]);
  });

  test.fails(
    "[3] Sort by two projected expressions - ORDER BY expression evaluation not supported at runtime",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30}), (:A {num: 4, num2: 40}), (:A {num: 5, num2: 50})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a, a.num + a.num2 AS total, a.num2 % 3 AS remainder ORDER BY a.num2 % 3, a.num + a.num2 LIMIT 3 RETURN a.num AS num, total, remainder",
      );
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual([3, 33, 0]);
      expect(results[1]).toEqual([1, 11, 1]);
      expect(results[2]).toEqual([4, 44, 1]);
    },
  );

  // [4] Sort by one projected expression and one alias with order priority different than projection
  // Requires runtime evaluation of expressions in ORDER BY (a.num2 % 3), not just alias lookup
  test.fails(
    "[4] Sort by projected expression and alias - ORDER BY expression evaluation not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30}), (:A {num: 4, num2: 40}), (:A {num: 5, num2: 50})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a, a.num + a.num2 AS sum, a.num2 % 3 AS mod ORDER BY a.num2 % 3, sum LIMIT 3 RETURN a.num AS num, sum, mod",
      );
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual([3, 33, 0]);
      expect(results[1]).toEqual([1, 11, 1]);
      expect(results[2]).toEqual([4, 44, 1]);
    },
  );

  // [5] Sort by one alias and one projected expression with order priority different than projection
  test("[5] Sort by alias and projected expression", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30}), (:A {num: 4, num2: 40}), (:A {num: 5, num2: 50})`,
    );

    // ORDER BY mod (alias), then by a.num + a.num2 (expression)
    // Same logic as [4]: sort by mod first, then by sum
    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a, a.num + a.num2 AS sum, a.num2 % 3 AS mod ORDER BY mod, a.num + a.num2 LIMIT 3 RETURN a.num AS num, sum, mod`,
    );

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([3, 33, 0]); // mod=0, sum=33
    expect(results[1]).toEqual([1, 11, 1]); // mod=1, sum=11
    expect(results[2]).toEqual([4, 44, 1]); // mod=1, sum=44
  });

  // [6] Sort by aliases of two projected expressions with order priority different than projection
  test("[6] Sort by two aliases", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30}), (:A {num: 4, num2: 40}), (:A {num: 5, num2: 50})`,
    );

    // ORDER BY mod (alias), then by sum (alias)
    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a, a.num + a.num2 AS sum, a.num2 % 3 AS mod ORDER BY mod, sum LIMIT 3 RETURN a.num AS num, sum, mod`,
    );

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([3, 33, 0]); // mod=0, sum=33
    expect(results[1]).toEqual([1, 11, 1]); // mod=1, sum=11
    expect(results[2]).toEqual([4, 44, 1]); // mod=1, sum=44
  });

  // [7] Sort by alias where alias shadows existing variable
  test("[7] Sort by alias that shadows existing variable", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30}), (:A {num: 4, num2: 40}), (:A {num: 5, num2: 50})`,
    );

    // First WITH: x = a.num2 % 3 (1, 2, 0, 1, 2)
    // Second WITH: x = a.num + a.num2 (11, 22, 33, 44, 55) - shadows previous x
    // ORDER BY x (the new x, which is sum)
    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a, a.num2 % 3 AS x WITH a, a.num + a.num2 AS x ORDER BY x LIMIT 3 RETURN a.num AS num, x`,
    );

    expect(results).toHaveLength(3);
    // Sorted by sum (x) ascending: 11, 22, 33
    expect(results[0]).toEqual([1, 11]);
    expect(results[1]).toEqual([2, 22]);
    expect(results[2]).toEqual([3, 33]);
  });

  // [8] Sort by non-projected existing variable
  test("[8] Sort by non-projected existing variable - ORDER BY alias not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30}), (:A {num: 4, num2: 40}), (:A {num: 5, num2: 50})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a, a.num + a.num2 AS sum WITH a, a.num2 % 3 AS mod ORDER BY sum LIMIT 3 RETURN a, mod",
    );
    expect(results).toHaveLength(3);
  });

  // [9] Sort by alias containing the variable shadowed by the alias
  test("[9] Sort by alias containing shadowed variable", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30}), (:A {num: 4, num2: 40}), (:A {num: 5, num2: 50})`,
    );

    // First WITH: x = a.num2 (10, 20, 30, 40, 50)
    // Second WITH: x = x % 3 (1, 2, 0, 1, 2) - uses old x, shadows with new x
    // ORDER BY x (the new x, which is the modulo result)
    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a.num2 AS x WITH x % 3 AS x ORDER BY x LIMIT 3 RETURN x`,
    );

    expect(results).toHaveLength(3);
    // Sorted by modulo result ascending: 0, 1, 1
    expect(results[0]).toEqual([0]);
    expect(results[1]).toEqual([1]);
    expect(results[2]).toEqual([1]);
  });

  // [10] Sort by non-projected expression containing alias containing shadowed variable
  // Requires runtime evaluation of expressions in ORDER BY (x * -1), not just alias lookup
  test.fails(
    "[10] Sort by expression containing alias - ORDER BY expression evaluation not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30}), (:A {num: 4, num2: 40}), (:A {num: 5, num2: 50})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a.num2 AS x WITH x % 3 AS x ORDER BY x * -1 LIMIT 3 RETURN x",
      );
      expect(results).toHaveLength(3);
      // Sorted by x * -1 descending (0, -1, -1, -2, -2) -> ascending order of x * -1 is -2, -2, -1
      expect(results[0]).toEqual([2]);
      expect(results[1]).toEqual([2]);
      expect(results[2]).toEqual([1]);
    },
  );

  // [11] Sort by an aggregate projection
  test.fails(
    "[11] Sort by an aggregate projection - aggregation in ORDER BY not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30}), (:A {num: 4, num2: 40}), (:A {num: 5, num2: 50})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a.num2 % 3 AS mod, sum(a.num + a.num2) AS s ORDER BY sum(a.num + a.num2) LIMIT 2 RETURN mod, s",
      );
      expect(results).toHaveLength(2);
    },
  );

  // [12] Sort by an aliased aggregate projection
  test.fails(
    "[12] Sort by an aliased aggregate projection - ORDER BY alias not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20}), (:A {num: 3, num2: 30}), (:A {num: 4, num2: 40}), (:A {num: 5, num2: 50})",
      );
      const results = executeTckQuery(
        graph,
        "MATCH (a:A) WITH a.num2 % 3 AS mod, sum(a.num + a.num2) AS s ORDER BY s LIMIT 2 RETURN mod, s",
      );
      expect(results).toHaveLength(2);
    },
  );

  // [13] Fail on sorting by non-projected aggregation on a variable
  test.fails(
    "[13] Fail on sorting by non-projected aggregation - semantic validation not implemented",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A {num: 1}), (:A {num: 2})");
      expect(() => {
        executeTckQuery(
          graph,
          "MATCH (a:A) WITH a.num AS num ORDER BY count(a) RETURN num",
        );
      }).toThrow();
    },
  );

  // [14] Fail on sorting by non-projected aggregation on an expression
  test.fails(
    "[14] Fail on sorting by non-projected aggregation - semantic validation not implemented",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A {num: 1}), (:A {num: 2})");
      expect(() => {
        executeTckQuery(
          graph,
          "MATCH (a:A) WITH a.num AS num ORDER BY sum(a.num * 2) RETURN num",
        );
      }).toThrow();
    },
  );

  // [15] Sort by aliased aggregate projection allows subsequent matching - uses WITH...MATCH chaining
  test.fails(
    "[15] Sort by aliased aggregate allows subsequent matching - WITH...MATCH chaining not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A)-[:REL]->(:X), (:A)-[:REL]->(:X)");
      const results = executeTckQuery(
        graph,
        "MATCH (a:A)-[r:REL]->(b:X) WITH a, r, b, count(*) AS c ORDER BY c MATCH (a)-[r]->(b) RETURN r",
      );
      expect(results).toHaveLength(2);
    },
  );

  // [16] Handle constants and parameters - parameters not supported
  test("[16] Handle constants and parameters - parameters not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Person {age: 30}), (:Person {age: 25})");
    const results = executeTckQuery(
      graph,
      "MATCH (person:Person) WITH person ORDER BY $age + avg(person.age) - 1000 RETURN person",
      { age: 20 },
    );
    expect(results).toHaveLength(2);
  });

  // [17] Handle projected variables in ORDER BY with aggregation
  test("[17] Handle projected variables with aggregation - aggregation in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:Person {age: 30})-[:KNOWS]->(:Person {age: 25})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (me:Person)-[:KNOWS]->(you:Person) WITH me.age AS age, you ORDER BY age, age + count(you.age) RETURN age",
    );
    expect(results).toHaveLength(1);
  });

  // [18] Handle projected property accesses in ORDER BY with aggregation
  test("[18] Handle property accesses with aggregation - aggregation in ORDER BY not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:Person {age: 30})-[:KNOWS]->(:Person {age: 25})",
    );
    const results = executeTckQuery(
      graph,
      "MATCH (me:Person)-[:KNOWS]->(you:Person) WITH me, you ORDER BY me.age + count(you.age) RETURN me",
    );
    expect(results).toHaveLength(1);
  });

  // [19] Fail if non-projected variables used in ORDER BY with aggregation
  test.fails(
    "[19] Fail if non-projected variables used - semantic validation not implemented",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:Person {age: 30})-[:KNOWS]->(:Person {age: 25})",
      );
      expect(() => {
        executeTckQuery(
          graph,
          "MATCH (me:Person)-[:KNOWS]->(you:Person) WITH me.age AS age ORDER BY you.age + count(you) RETURN age",
        );
      }).toThrow();
    },
  );

  // [20] Fail if complex expressions used in ORDER BY with aggregation
  test.fails(
    "[20] Fail if complex expressions with aggregation - semantic validation not implemented",
    () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (:Person {age: 30})-[:KNOWS]->(:Person {age: 25})",
      );
      expect(() => {
        executeTckQuery(
          graph,
          "MATCH (me:Person)-[:KNOWS]->(you:Person) WITH me.age AS age, you ORDER BY age + you.age + count(you) RETURN age",
        );
      }).toThrow();
    },
  );

  // Custom tests for supported patterns
  test("[custom-1] WITH node projection with ORDER BY on property expression", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 3, val: 30}), (:A {num: 1, val: 10}), (:A {num: 2, val: 20})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a ORDER BY a.num RETURN a.val AS val`,
    );
    expect(results.length).toBe(3);
    // Ordered by num (1,2,3) so vals are (10, 20, 30)
    expect(results).toEqual([10, 20, 30]);
  });

  test("[custom-2] WITH ORDER BY then project multiple values", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {x: 3, y: 'c'}), (:A {x: 1, y: 'a'}), (:A {x: 2, y: 'b'})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a ORDER BY a.x RETURN a.x AS x, a.y AS y`,
    );
    expect(results.length).toBe(3);
    expect(results).toEqual([
      [1, "a"],
      [2, "b"],
      [3, "c"],
    ]);
  });

  test("[custom-3] WITH ORDER BY property then return property", () => {
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

  test("[custom-4] WITH arithmetic expression projection", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 3, num2: 30}), (:A {num: 1, num2: 10}), (:A {num: 2, num2: 20})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH a.num + a.num2 AS total ORDER BY total RETURN total`,
    );

    expect(results).toHaveLength(3);
    // Results are wrapped in arrays when there's a single projection
    expect(results.map((r) => (r as [number])[0])).toEqual([11, 22, 33]);
  });

  test("[custom-5] WITH DISTINCT on property then ORDER BY", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {num: 1}), (:A {num: 2}), (:A {num: 1}), (:A {num: 3})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (a:A) WITH DISTINCT a.num AS num ORDER BY a.num RETURN num`,
    );
    expect(results.length).toBe(3);
    // Results are wrapped in arrays when there's a single projection
    const nums = results.map((r) => (r as [number])[0]);
    expect(nums).toEqual([1, 2, 3]);
  });
});
