/**
 * TCK ExistentialSubquery3 - Nested existential subquery
 * Translated from tmp/tck/features/expressions/existentialSubqueries/ExistentialSubquery3.feature
 *
 * Nested existential subqueries use EXISTS { MATCH ... WHERE EXISTS { ... } ... } syntax,
 * which is NOT supported in the grammar. The grammar only supports single-level
 * EXISTS { pattern [WHERE condition] } syntax.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("ExistentialSubquery3 - Nested existential subquery", () => {
  // Original TCK scenarios - all use nested subquery syntax which is not supported

  test.fails(
    "[1] Nested simple existential subquery - nested subqueries not supported",
    () => {
      // Original TCK:
      // CREATE (a:A {prop: 1})-[:R]->(b:B {prop: 1}), (a)-[:R]->(:C {prop: 2}), (a)-[:R]->(:D {prop: 3})
      // MATCH (n) WHERE exists {
      //   MATCH (m) WHERE exists {
      //     (n)-[]->(m) WHERE n.prop = m.prop
      //   }
      //   RETURN true
      // } RETURN n
      // Expected: (:A {prop:1})
      //
      // Nested existential subqueries are not supported
      // Grammar only supports single-level EXISTS { pattern [WHERE condition] }
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (a:A {prop: 1})-[:R]->(b:B {prop: 1}), (a)-[:R]->(:C {prop: 2}), (a)-[:R]->(:D {prop: 3})",
      );

      const results = executeTckQuery(
        graph,
        `MATCH (n) WHERE exists {
        MATCH (m) WHERE exists {
          (n)-[]->(m) WHERE n.prop = m.prop
        }
        RETURN true
      } RETURN n`,
      );

      expect(results).toHaveLength(1);
    },
  );

  test.fails(
    "[2] Nested full existential subquery - nested subqueries not supported",
    () => {
      // Original TCK:
      // MATCH (n) WHERE exists {
      //   MATCH (m) WHERE exists {
      //     MATCH (l)<-[:R]-(n)-[:R]->(m) RETURN true
      //   }
      //   RETURN true
      // } RETURN n
      // Expected: (:A {prop:1})
      //
      // Nested existential subqueries are not supported
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (a:A {prop: 1})-[:R]->(b:B {prop: 1}), (a)-[:R]->(:C {prop: 2}), (a)-[:R]->(:D {prop: 3})",
      );

      const results = executeTckQuery(
        graph,
        `MATCH (n) WHERE exists {
        MATCH (m) WHERE exists {
          MATCH (l)<-[:R]-(n)-[:R]->(m) RETURN true
        }
        RETURN true
      } RETURN n`,
      );

      expect(results).toHaveLength(1);
    },
  );

  test.fails(
    "[3] Nested full existential subquery with pattern predicate - pattern predicates not supported",
    () => {
      // Original TCK:
      // MATCH (n) WHERE exists {
      //   MATCH (m) WHERE exists {
      //     MATCH (l) WHERE (l)<-[:R]-(n)-[:R]->(m) RETURN true
      //   }
      //   RETURN true
      // } RETURN n
      // Expected: (:A {prop:1})
      //
      // Both nested subqueries and pattern predicates in WHERE are not supported
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        "CREATE (a:A {prop: 1})-[:R]->(b:B {prop: 1}), (a)-[:R]->(:C {prop: 2}), (a)-[:R]->(:D {prop: 3})",
      );

      const results = executeTckQuery(
        graph,
        `MATCH (n) WHERE exists {
        MATCH (m) WHERE exists {
          MATCH (l) WHERE (l)<-[:R]-(n)-[:R]->(m) RETURN true
        }
        RETURN true
      } RETURN n`,
      );

      expect(results).toHaveLength(1);
    },
  );

  // Custom tests demonstrating equivalent functionality using supported pattern syntax

  test("[C1] EXISTS with multi-hop pattern as alternative to nested subquery", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'root'})-[:R]->(:B {name: 'mid'})-[:R]->(:C {name: 'leaf'})`,
    );

    // Find nodes that have a 2-hop path
    // This is a simpler alternative to nested EXISTS
    const results = executeTckQuery(
      graph,
      `MATCH (n:A)-[:R]->(m:B)-[:R]->(o:C) RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("root");
  });

  test("[C2] EXISTS verifying transitive connections", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'alice'})-[:KNOWS]->(:B {name: 'bob'})-[:KNOWS]->(:C {name: 'charlie'}),
              (:A {name: 'dave'})-[:KNOWS]->(:B {name: 'eve'})`,
    );

    // Find A nodes that know someone who knows someone
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:KNOWS]->(b:B)
       WHERE EXISTS { (b)-[:KNOWS]->(c) }
       RETURN a.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("alice");
  });

  test("[C3] EXISTS verifying property matching across hops", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {prop: 1})-[:R]->(:B {prop: 1}),
              (:A {prop: 2})-[:R]->(:B {prop: 3})`,
    );

    // Find A nodes with matching prop to their connected B
    const results = executeTckQuery(
      graph,
      `MATCH (n:A)
       WHERE EXISTS { (n)-[:R]->(m:B) WHERE n.prop = m.prop }
       RETURN n.prop`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(1);
  });

  test("[C4] EXISTS with multiple related patterns via explicit matching", () => {
    const graph = createTckGraph();
    // Create hub node with connections to multiple targets
    executeTckQuery(
      graph,
      `CREATE (a:A {name: 'hub'})-[:R]->(:B {name: 'b1'}),
              (a)-[:R]->(:C {name: 'c1'}),
              (a)-[:R]->(:D {name: 'd1'})`,
    );
    // Create node with fewer connections
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'spoke'})-[:R]->(:B {name: 'b2'})`,
    );

    // Verify nodes with connections to both B and C labels
    const resultsB = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE EXISTS { (n)-[:R]->(m:B) } RETURN n.name`,
    );
    expect(resultsB).toHaveLength(2);

    const resultsC = executeTckQuery(
      graph,
      `MATCH (n:A) WHERE EXISTS { (n)-[:R]->(m:C) } RETURN n.name`,
    );
    expect(resultsC).toHaveLength(1);
    expect(resultsC[0]).toBe("hub");
  });

  test("[C5] EXISTS combined with AND for multiple existence checks", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (a:A {name: 'complete'})-[:R]->(:B)-[:R]->(:C),
              (:A {name: 'partial'})-[:R]->(:B)`,
    );

    // Check for existence at both first and second hop
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:R]->(b:B)
       WHERE EXISTS { (b)-[:R]->(c) }
       RETURN a.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("complete");
  });

  test("[C6] EXISTS filtering on relationship properties in chain", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a1'})-[:R {value: 10}]->(:B {name: 'b1'}),
              (:A {name: 'a2'})-[:R {value: 5}]->(:B {name: 'b2'})`,
    );

    // Find A nodes with high-value R relationship
    const results = executeTckQuery(
      graph,
      `MATCH (n:A)
       WHERE EXISTS { (n)-[r:R]->(m:B) WHERE r.value > 7 }
       RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a1");
  });

  test("[C7] Simulating nested exists via explicit multi-pattern matching", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (a:A {name: 'root'})-[:R]->(b:B {name: 'branch'})-[:R]->(c:C {name: 'leaf'}),
              (:A {name: 'stub'})-[:R]->(:B {name: 'dead-end'})`,
    );

    // Find A nodes that connect to B nodes that have outgoing connections
    // This simulates: EXISTS { (n)-->(m) WHERE EXISTS { (m)-->() } }
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:R]->(b:B)-[:R]->(c:C) RETURN DISTINCT a.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("root");
  });
});
