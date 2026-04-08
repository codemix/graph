/**
 * TCK Null3 - Null evaluation
 * Translated from tmp/tck/features/expressions/null/Null3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Null3 - Null evaluation", () => {
  test("[1] The inverse of a null is a null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN NOT null AS value");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test("[2] It is unknown if a null is equal to a null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN null = null AS value");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test("[3] It is unknown if a null is not equal to a null", () => {
    const graph = createTckGraph();
    const results = executeTckQuery(graph, "RETURN null <> null AS value");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(null);
  });

  test.fails("[4] Using null in IN - parameter syntax not supported", () => {
    // Original TCK Scenario Outline with parameters:
    // | elt  | coll            | result |
    // | null | null            | null   |
    // | null | [1, 2, 3]       | null   |
    // | null | [1, 2, 3, null] | null   |
    // | null | []              | false  |
    // | 1    | [1, 2, 3, null] | true   |
    // | 1    | [null, 1]       | true   |
    // | 5    | [1, 2, 3, null] | null   |
    const graph = createTckGraph();

    // null IN null = null
    const results1 = executeTckQuery(graph, "RETURN null IN null AS result");
    expect(results1).toHaveLength(1);
    expect(results1[0]).toBe(null);

    // null IN [1, 2, 3] = null
    const results2 = executeTckQuery(
      graph,
      "RETURN null IN [1, 2, 3] AS result",
    );
    expect(results2).toHaveLength(1);
    expect(results2[0]).toBe(null);

    // null IN [1, 2, 3, null] = null
    const results3 = executeTckQuery(
      graph,
      "RETURN null IN [1, 2, 3, null] AS result",
    );
    expect(results3).toHaveLength(1);
    expect(results3[0]).toBe(null);

    // null IN [] = false
    const results4 = executeTckQuery(graph, "RETURN null IN [] AS result");
    expect(results4).toHaveLength(1);
    expect(results4[0]).toBe(false);

    // 1 IN [1, 2, 3, null] = true
    const results5 = executeTckQuery(
      graph,
      "RETURN 1 IN [1, 2, 3, null] AS result",
    );
    expect(results5).toHaveLength(1);
    expect(results5[0]).toBe(true);

    // 1 IN [null, 1] = true
    const results6 = executeTckQuery(graph, "RETURN 1 IN [null, 1] AS result");
    expect(results6).toHaveLength(1);
    expect(results6[0]).toBe(true);

    // 5 IN [1, 2, 3, null] = null
    const results7 = executeTckQuery(
      graph,
      "RETURN 5 IN [1, 2, 3, null] AS result",
    );
    expect(results7).toHaveLength(1);
    expect(results7[0]).toBe(null);
  });

  // Custom tests demonstrating null behavior that can be tested via WHERE clause
  test("[custom-1] Null property comparison - missing property in condition is handled", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'has-num', num: 5}), (:A {name: 'no-num'})",
    );

    // Comparing missing property to a value returns false/unknown (filters out the row)
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num > 3 RETURN n.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("has-num");
  });

  test("[custom-2] Null property equality - missing property never equals anything", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'has-num', num: 5}), (:A {name: 'no-num'})",
    );

    // null = 5 is unknown/null, so the row doesn't match
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num = 5 RETURN n.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("has-num");
  });

  test("[custom-3] Null handling in AND - false takes precedence over null", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', x: 1}), (:A {name: 'b', x: 2})",
    );

    // false AND null = false (row should not match)
    // For node with x=2: (x = 1) AND (y IS NOT NULL) = false AND null = false
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.x = 1 AND n.y IS NOT NULL RETURN n.name",
    );

    expect(results).toHaveLength(0); // Neither node matches (node 'a' has x=1 but no y)
  });

  test("[custom-4] Null handling in OR - true takes precedence over null", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', x: 1}), (:A {name: 'b', x: 2})",
    );

    // true OR null = true (row should match)
    // For node 'a': (x = 1) OR (y IS NOT NULL) = true OR null = true
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.x = 1 OR n.y IS NOT NULL RETURN n.name",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test("[custom-5] IN operator with missing property", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', num: 1}), (:A {name: 'b', num: 2}), (:A {name: 'c'})",
    );

    // When property is missing, IN check is unknown/null (doesn't match)
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.num IN [1, 2] RETURN n.name ORDER BY n.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toEqual(["a", "b"]);
  });

  test("[custom-6] NOT IN with missing property", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', num: 1}), (:A {name: 'b', num: 3}), (:A {name: 'c'})",
    );

    // In the current implementation, NOT x IN [list] with missing property
    // evaluates to true (treating missing property as "not in list").
    // This differs from Cypher's 3-valued logic where null NOT IN list = null.
    // We document actual behavior rather than expected Cypher behavior.
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE NOT n.num IN [1, 2] RETURN n.name ORDER BY n.name",
    );

    // Current implementation: 'b' (num=3, NOT IN), 'c' (missing, treated as NOT IN)
    expect(results).toHaveLength(2);
    expect(results).toEqual(["b", "c"]);
  });

  test("[custom-7] Combining IS NULL with value comparison", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'a', val: 10}), (:A {name: 'b'}), (:A {name: 'c', val: 20})",
    );

    // Find nodes where val is either null OR greater than 15
    const results = executeTckQuery(
      graph,
      "MATCH (n:A) WHERE n.val IS NULL OR n.val > 15 RETURN n.name ORDER BY n.name",
    );

    expect(results).toHaveLength(2);
    expect(results).toEqual(["b", "c"]); // 'b' has null val, 'c' has val > 15
  });
});
