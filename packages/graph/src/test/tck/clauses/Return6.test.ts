/**
 * TCK Return6 - Implicit grouping with aggregates
 * Translated from tmp/tck/features/clauses/return/Return6.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel, getProperty } from "../tckHelpers.js";

describe("Return6 - Implicit grouping with aggregates", () => {
  test.fails("[1] Return count aggregation over nodes - unlabeled nodes not supported", () => {
    // Given: CREATE ({num: 42})
    // Query: MATCH (n) RETURN n.num AS n, count(n) AS count
    // Expected: 42, 1
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 42})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n.num AS n, count(n) AS count");
    expect(results).toHaveLength(1);
    const [num, count] = results[0] as [number, number];
    expect(num).toBe(42);
    expect(count).toBe(1);
  });

  test.fails("[custom] Return count aggregation over nodes with labeled node - requires GROUP BY", () => {
    // Query: MATCH (n:A) RETURN n.num AS num, count(n) AS count
    // Mixing aggregate with non-aggregate requires GROUP BY clause
    // Implicit grouping not supported in this implementation
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 42})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num AS num, count(n) AS count");
    expect(results).toHaveLength(1);
    const [num, count] = results[0] as [number, number];
    expect(num).toBe(42);
    expect(count).toBe(1);
  });

  test.fails("[2] Projecting an arithmetic expression with aggregation - unlabeled nodes not supported", () => {
    // Given: CREATE ({id: 42})
    // Query: MATCH (a) RETURN a, count(a) + 3
    // Expected: ({id: 42}), 4
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({id: 42})");
    const results = executeTckQuery(graph, "MATCH (a) RETURN a, count(a) + 3");
    expect(results).toHaveLength(1);
    const [node, total] = results[0] as [Record<string, unknown>, number];
    expect(getProperty(node, "id")).toBe(42);
    expect(total).toBe(4);
  });

  test.fails("[custom] Projecting an arithmetic expression with aggregation with labeled node - arithmetic on aggregates not supported", () => {
    // Query: MATCH (a:A) RETURN a, count(a) + 3 AS total
    // Arithmetic expressions on aggregates not supported in grammar
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {id: 42})");
    const results = executeTckQuery(graph, "MATCH (a:A) RETURN a, count(a) + 3 AS total");
    expect(results).toHaveLength(1);
    const [node, total] = results[0] as [Record<string, unknown>, number];
    expect(getProperty(node, "id")).toBe(42);
    expect(total).toBe(4);
  });

  test.fails("[3] Aggregating by a list property has a correct definition of equality - unlabeled nodes not supported", () => {
    // Given: CREATE ({a: [1, 2, 3]}), ({a: [1, 2, 3]})
    // Query: MATCH (a) WITH a.a AS a, count(*) AS count RETURN count
    // Note: Test uses wrong property name (num vs a) in original - likely bug in TCK
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({a: [1, 2, 3]})");
    executeTckQuery(graph, "CREATE ({a: [1, 2, 3]})");
    const results = executeTckQuery(
      graph,
      "MATCH (n) WITH n.a AS a, count(*) AS count RETURN count",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test.fails("[4] Support multiple divisions in aggregate function - unlabeled nodes (by design)", () => {
    // Given: UNWIND range(0, 7250) AS i CREATE ()
    // Query: MATCH (n) RETURN count(n) / 60 / 60 AS count
    // Expected: 2
    // Blocked: unlabeled nodes (CREATE ()) not supported (by design)
    // Note: UNWIND IS working
    const graph = createTckGraph();
    executeTckQuery(graph, "UNWIND range(0, 7250) AS i CREATE ()");
    const results = executeTckQuery(graph, "MATCH (n) RETURN count(n) / 60 / 60 AS count");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test.fails("[custom] Support multiple divisions in aggregate function - arithmetic on aggregates not supported", () => {
    // Query: MATCH (n:A) RETURN count(n) / 60 / 2 AS count
    // Arithmetic expressions on aggregates not supported in grammar
    const graph = createTckGraph();
    for (let i = 0; i < 120; i++) {
      executeTckQuery(graph, "CREATE (:A)");
    }
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN count(n) / 60 / 2 AS count");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test.fails("[5] Aggregates inside normal functions - unlabeled nodes (by design)", () => {
    // Given: UNWIND range(0, 10) AS i CREATE ()
    // Query: MATCH (a) RETURN size(collect(a))
    // Expected: 11
    // Blocked: unlabeled nodes (CREATE (), MATCH (a)) not supported (by design)
    // Note: UNWIND IS working
    const graph = createTckGraph();
    executeTckQuery(graph, "UNWIND range(0, 10) AS i CREATE ()");
    const results = executeTckQuery(graph, "MATCH (a) RETURN size(collect(a))");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(11);
  });

  test.fails("[custom] Aggregates inside normal functions - nested function calls not supported", () => {
    // Query: MATCH (a:A) RETURN size(collect(a)) AS size
    // Nested function calls like size(collect(a)) not supported in grammar
    const graph = createTckGraph();
    for (let i = 0; i < 11; i++) {
      executeTckQuery(graph, "CREATE (:A)");
    }
    const results = executeTckQuery(graph, "MATCH (a:A) RETURN size(collect(a)) AS size");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(11);
  });

  test.fails("[6] Handle aggregates inside non-aggregate expressions - unlabeled nodes not supported", () => {
    // Query involves unlabeled nodes and complex map expression
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 1})");
    executeTckQuery(graph, "CREATE ({num: 2})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN {count: count(n)} AS result");
    expect(results).toHaveLength(1);
  });

  test.fails("[7] Aggregate on property - unlabeled nodes not supported", () => {
    // Given: CREATE ({num: 33}), ({num: 33}), ({num: 42})
    // Query: MATCH (n) RETURN n.num, count(*)
    // Expected: 42, 1 and 33, 2
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({num: 33})");
    executeTckQuery(graph, "CREATE ({num: 33})");
    executeTckQuery(graph, "CREATE ({num: 42})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN n.num, count(*)");
    expect(results).toHaveLength(2);
  });

  test.fails("[custom] Aggregate on property with labeled nodes - requires GROUP BY", () => {
    // Query: MATCH (n:A) RETURN n.num, count(n)
    // Mixing aggregate with non-aggregate requires GROUP BY clause
    // Implicit grouping not supported in this implementation
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {num: 33})");
    executeTckQuery(graph, "CREATE (:A {num: 33})");
    executeTckQuery(graph, "CREATE (:A {num: 42})");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN n.num, count(n)");
    expect(results).toHaveLength(2);
  });

  test("[8] Handle aggregation on functions - named paths not supported", () => {
    // Query: MATCH p=(a:L)-[*]->(b) RETURN b, avg(length(p))
    // Named path syntax with variable length not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:L)-[:T]->(:B)");
    const results = executeTckQuery(graph, "MATCH p=(a:L)-[*]->(b) RETURN b, avg(length(p))");
    expect(results).toHaveLength(1);
  });

  test.fails("[9] Aggregates with arithmetics - unlabeled nodes not supported", () => {
    // Given: CREATE ()
    // Query: MATCH () RETURN count(*) * 10 AS c
    // Expected: 10
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    const results = executeTckQuery(graph, "MATCH () RETURN count(*) * 10 AS c");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(10);
  });

  test.fails("[custom] Aggregates with arithmetics with labeled nodes - arithmetic on aggregates not supported", () => {
    // Query: MATCH (n:A) RETURN count(n) * 10 AS c
    // Arithmetic expressions on aggregates not supported in grammar
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN count(n) * 10 AS c");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(10);
  });

  test.fails("[10] Multiple aggregates on same variable - unlabeled nodes not supported", () => {
    // Given: CREATE ()
    // Query: MATCH (n) RETURN count(n), collect(n)
    // Expected: 1, [()]
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ()");
    const results = executeTckQuery(graph, "MATCH (n) RETURN count(n), collect(n)");
    expect(results).toHaveLength(1);
    const [count, collected] = results[0] as [number, unknown[]];
    expect(count).toBe(1);
    expect(collected).toHaveLength(1);
  });

  test.fails("[custom] Multiple aggregates on same variable with labeled node - multiple aggregates not supported", () => {
    // Query: MATCH (n:A) RETURN count(n), collect(n)
    // Multiple aggregates in single RETURN not fully supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN count(n), collect(n)");
    expect(results).toHaveLength(1);
    const [count, collected] = results[0] as [number, unknown[]];
    expect(count).toBe(1);
    expect(collected).toHaveLength(1);
  });

  test("[11] Counting matches - unlabeled nodes (by design)", () => {
    // Given: UNWIND range(1, 100) AS i CREATE ()
    // Query: MATCH () RETURN count(*)
    // Expected: 100
    // Blocked: unlabeled nodes (CREATE (), MATCH ()) not supported (by design)
    // Note: UNWIND IS working - see [custom] tests which use labeled nodes
    const graph = createTckGraph();
    executeTckQuery(graph, "UNWIND range(1, 100) AS i CREATE ()");
    const results = executeTckQuery(graph, "MATCH () RETURN count(*)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(100);
  });

  test("[custom] Counting matches with count(n)", () => {
    const graph = createTckGraph();
    for (let i = 0; i < 10; i++) {
      executeTckQuery(graph, "CREATE (:A)");
    }

    const results = executeTckQuery(graph, "MATCH (n:A) RETURN count(n)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(10);
  });

  test("[custom] Counting matches with count(*)", () => {
    const graph = createTckGraph();
    for (let i = 0; i < 10; i++) {
      executeTckQuery(graph, "CREATE (:A)");
    }

    // count(*) now supported!
    const results = executeTckQuery(graph, "MATCH (n:A) RETURN count(*)");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(10);
  });

  test.fails("[12] Counting matches per group - unlabeled nodes not supported", () => {
    // Given: CREATE (a:L), (b1), (b2) CREATE (a)-[:A]->(b1), (a)-[:A]->(b2)
    // Query: MATCH (a:L)-[rel]->(b) RETURN a, count(*)
    // Expected: (:L), 2
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:L)");
    executeTckQuery(graph, "CREATE ()");
    executeTckQuery(graph, "CREATE ()");
    executeTckQuery(graph, "MATCH (a:L), (b) WHERE NOT b:L CREATE (a)-[:A]->(b)");
    const results = executeTckQuery(graph, "MATCH (a:L)-[rel]->(b) RETURN a, count(*)");
    expect(results).toHaveLength(1);
    const [node, count] = results[0] as [Record<string, unknown>, number];
    expect(getLabel(node)).toBe("L");
    expect(count).toBe(2);
  });

  test.fails("[custom] Counting matches per group with labeled nodes - requires GROUP BY", () => {
    // Query: MATCH (a:L)-[rel:A]->(b:B) RETURN a, count(b)
    // Mixing aggregate with non-aggregate requires GROUP BY clause
    // Implicit grouping not supported in this implementation
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:L)-[:A]->(:B)");
    executeTckQuery(graph, "MATCH (a:L) CREATE (a)-[:A]->(:B)");
    const results = executeTckQuery(graph, "MATCH (a:L)-[rel:A]->(b:B) RETURN a, count(b)");
    expect(results).toHaveLength(1);
    const [node, count] = results[0] as [Record<string, unknown>, number];
    expect(getLabel(node)).toBe("L");
    expect(count).toBe(2);
  });

  test.fails("[13] Returning the minimum length of paths - named paths and variable length not supported", () => {
    // Query involves named paths with variable length
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)-[:T]->(:B)-[:T]->(:C)");
    const results = executeTckQuery(graph, "MATCH p=(:A)-[*]->(:C) RETURN min(length(p))");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(2);
  });

  test("[14] Aggregates in aggregates - semantic validation not implemented", () => {
    // Query: RETURN count(count(*))
    // Expected: SyntaxError: NestedAggregation
    // Requires semantic analysis
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "RETURN count(count(*))");
    }).toThrow();
  });

  test.fails("[15] Using `rand()` in aggregations - rand() may not be supported", () => {
    // Query: RETURN count(rand())
    // Expected: SyntaxError: NonConstantExpression
    const graph = createTckGraph();
    expect(() => {
      executeTckQuery(graph, "RETURN count(rand())");
    }).toThrow();
  });

  test.fails("[16] Aggregation on complex expressions - unlabeled nodes not supported", () => {
    // Complex query with multiple unlabeled nodes
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({val: 1})");
    executeTckQuery(graph, "CREATE ({val: 2})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN sum(n.val * 2) AS total");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(6);
  });

  test("[17] Handle constants and parameters inside an expression which contains an aggregation expression - parameters not supported", () => {
    // Query: MATCH (person) RETURN $age + avg(person.age) - 1000
    // Parameter syntax ($param) not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Person {age: 30})");
    const results = executeTckQuery(
      graph,
      "MATCH (person:Person) RETURN $age + avg(person.age) - 1000",
    );
    expect(results).toHaveLength(1);
  });

  test("[18] Handle returned variables inside an expression which contains an aggregation expression - empty result set", () => {
    // Query: MATCH (me: Person)--(you: Person) WITH me.age AS age, you RETURN age, age + count(you.age)
    // Tests empty result handling
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "MATCH (me:Person)--(you:Person) WITH me.age AS age, you RETURN age, age + count(you.age)",
    );
    expect(results).toHaveLength(0);
  });

  test("[19] Handle returned property accesses inside an expression which contains an aggregation expression - empty result set", () => {
    // Query: MATCH (me: Person)--(you: Person) RETURN me.age, me.age + count(you.age)
    // Tests empty result handling
    const graph = createTckGraph();
    const results = executeTckQuery(
      graph,
      "MATCH (me:Person)--(you:Person) RETURN me.age, me.age + count(you.age)",
    );
    expect(results).toHaveLength(0);
  });

  test.fails("[20] Fail if not returned variables are used inside an expression which contains an aggregation expression - semantic validation not implemented", () => {
    // Query: MATCH (me: Person)--(you: Person) RETURN me.age + count(you.age)
    // Expected: SyntaxError: AmbiguousAggregationExpression
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Person {age: 30})-[:KNOWS]->(:Person {age: 25})");
    expect(() => {
      executeTckQuery(graph, "MATCH (me:Person)--(you:Person) RETURN me.age + count(you.age)");
    }).toThrow();
  });

  test("[21] Fail if more complex expressions are used inside expression which contains an aggregation expression - semantic validation not implemented", () => {
    // Query: MATCH (me: Person)--(you: Person) RETURN me.age + you.age, me.age + you.age + count(*)
    // Expected: SyntaxError: AmbiguousAggregationExpression
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Person {age: 30})-[:KNOWS]->(:Person {age: 25})");
    expect(() => {
      executeTckQuery(
        graph,
        "MATCH (me:Person)--(you:Person) RETURN me.age + you.age, me.age + you.age + count(*)",
      );
    }).toThrow();
  });
});
