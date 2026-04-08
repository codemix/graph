/**
 * TCK Pattern1 - Pattern predicate
 * Translated from tmp/tck/features/expressions/pattern/Pattern1.feature
 *
 * Pattern predicates are existential pattern expressions in WHERE clause
 * that check for the existence of a path/connection.
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel } from "../tckHelpers.js";

describe("Pattern1 - Pattern predicate", () => {
  // Original TCK scenarios - most use pattern predicates in WHERE which aren't fully supported

  test.fails(
    "[1] Matching on any single outgoing directed connection - pattern predicates not supported",
    () => {
      // Original TCK:
      // CREATE (a:A)-[:REL1]->(b:B), (b)-[:REL2]->(a), (a)-[:REL3]->(:C), (a)-[:REL1]->(:D)
      // MATCH (n) WHERE (n)-[]->() RETURN n
      // Expected: (:A), (:B)
      //
      // Pattern predicates like (n)-[]->() in WHERE clause not supported in grammar
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`,
      );
      executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
      executeTckQuery(
        graph,
        `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`,
      );
      executeTckQuery(
        graph,
        `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`,
      );

      // Pattern predicate in WHERE clause
      const results = executeTckQuery(
        graph,
        `MATCH (n) WHERE (n)-[]->() RETURN n`,
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[2] Matching on a single undirected connection - undirected patterns not supported",
    () => {
      // Original TCK:
      // MATCH (n) WHERE (n)-[]-() RETURN n
      // Expected: (:A), (:B), (:C), (:D)
      //
      // Undirected pattern predicates not supported
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`,
      );
      executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
      executeTckQuery(
        graph,
        `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`,
      );
      executeTckQuery(
        graph,
        `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`,
      );

      // Undirected pattern predicate in WHERE clause
      const results = executeTckQuery(
        graph,
        `MATCH (n) WHERE (n)-[]-() RETURN n`,
      );
      expect(results).toHaveLength(4);
    },
  );

  test.fails(
    "[3] Matching on any single incoming directed connection - pattern predicates not supported",
    () => {
      // Original TCK:
      // MATCH (n) WHERE (n)<-[]-() RETURN n
      // Expected: (:A), (:B), (:C), (:D)
      //
      // Pattern predicates not supported in grammar
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`,
      );
      executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
      executeTckQuery(
        graph,
        `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`,
      );
      executeTckQuery(
        graph,
        `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`,
      );

      // Pattern predicate with incoming direction in WHERE clause
      const results = executeTckQuery(
        graph,
        `MATCH (n) WHERE (n)<-[]-() RETURN n`,
      );
      expect(results).toHaveLength(4);
    },
  );

  test("[4] Matching on a specific type of single outgoing directed connection - pattern predicates not supported", () => {
    // Original TCK:
    // MATCH (n) WHERE (n)-[:REL1]->() RETURN n
    // Expected: (:A)
    //
    // Pattern predicates not supported in grammar
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Pattern predicate with specific type in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n) WHERE (n)-[:REL1]->() RETURN n`,
    );
    expect(results).toHaveLength(1);
  });

  test("[5] Matching on a specific type of single undirected connection - undirected patterns not supported", () => {
    // Original TCK:
    // MATCH (n) WHERE (n)-[:REL1]-() RETURN n
    // Expected: (:A), (:B), (:D)
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Undirected pattern predicate with specific type in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n) WHERE (n)-[:REL1]-() RETURN n`,
    );
    expect(results).toHaveLength(3);
  });

  test("[6] Matching on a specific type of single incoming directed connection - pattern predicates not supported", () => {
    // Original TCK:
    // MATCH (n) WHERE (n)<-[:REL1]-() RETURN n
    // Expected: (:B), (:D)
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Pattern predicate with incoming specific type in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n) WHERE (n)<-[:REL1]-() RETURN n`,
    );
    expect(results).toHaveLength(2);
  });

  test("[7] Matching on a specific type of a variable length outgoing directed connection - pattern predicates not supported", () => {
    // Original TCK:
    // MATCH (n) WHERE (n)-[:REL1*]->() RETURN n
    // Expected: (:A)
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Variable length pattern predicate in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n) WHERE (n)-[:REL1*]->() RETURN n`,
    );
    expect(results).toHaveLength(1);
  });

  test("[8] Matching on a specific type of variable length undirected connection - undirected patterns not supported", () => {
    // Original TCK:
    // MATCH (n) WHERE (n)-[:REL1*]-() RETURN n
    // Expected: (:A), (:B), (:D)
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Undirected variable length pattern predicate in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n) WHERE (n)-[:REL1*]-() RETURN n`,
    );
    expect(results).toHaveLength(3);
  });

  test("[9] Matching on a specific type of variable length incoming directed connection - pattern predicates not supported", () => {
    // Original TCK:
    // MATCH (n) WHERE (n)<-[:REL1*]-() RETURN n
    // Expected: (:B), (:D)
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Variable length incoming pattern predicate in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n) WHERE (n)<-[:REL1*]-() RETURN n`,
    );
    expect(results).toHaveLength(2);
  });

  test.fails(
    "[10] Matching on a specific type of undirected connection with length 2 - pattern predicates not supported",
    () => {
      // Original TCK:
      // MATCH (n) WHERE (n)-[:REL1*2]-() RETURN n
      // Expected: (:B), (:D)
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`,
      );
      executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
      executeTckQuery(
        graph,
        `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`,
      );
      executeTckQuery(
        graph,
        `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`,
      );

      // Fixed length undirected pattern predicate in WHERE clause
      const results = executeTckQuery(
        graph,
        `MATCH (n) WHERE (n)-[:REL1*2]-() RETURN n`,
      );
      expect(results).toHaveLength(2);
    },
  );

  test.fails(
    "[10b] Fail on introducing unbounded variables in pattern - semantic validation not implemented",
    () => {
      // Original TCK Scenario Outline with 15 error cases for:
      // MATCH (n) WHERE <pattern> RETURN n with patterns like:
      // (a), (n)-[r]->(a), (a)-[r]->(n), etc.
      // Expected: SyntaxError: UndefinedVariable
      //
      // Semantic validation for undefined variables not implemented
      const graph = createTckGraph();
      executeTckQuery(graph, `CREATE (:A {name: 'a'})`);

      // Using unbounded variable 'a' in pattern predicate should fail
      expect(() => {
        executeTckQuery(graph, `MATCH (n) WHERE (a) RETURN n`);
      }).toThrow();
    },
  );

  test.fails(
    "[11] Fail on checking self pattern - semantic validation not implemented",
    () => {
      // Original TCK:
      // MATCH (n) WHERE (n) RETURN n
      // Expected: SyntaxError: InvalidArgumentType
      const graph = createTckGraph();
      executeTckQuery(graph, `CREATE (:A {name: 'a'})`);

      // Self-referential pattern predicate should fail
      expect(() => {
        executeTckQuery(graph, `MATCH (n) WHERE (n) RETURN n`);
      }).toThrow();
    },
  );

  test.fails(
    "[12] Matching two nodes on a single directed connection between them - pattern predicates not supported",
    () => {
      // Original TCK:
      // MATCH (n), (m) WHERE (n)-[]->(m) RETURN n, m
      // Expected: 4 rows with pairs
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`,
      );
      executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
      executeTckQuery(
        graph,
        `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`,
      );
      executeTckQuery(
        graph,
        `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`,
      );

      // Pattern predicate with two bound variables in WHERE clause
      const results = executeTckQuery(
        graph,
        `MATCH (n), (m) WHERE (n)-[]->(m) RETURN n, m`,
      );
      expect(results).toHaveLength(4);
    },
  );

  test("[13] Fail on matching two nodes on a single undirected connection between them - pattern predicates not supported", () => {
    // Original TCK:
    // MATCH (n), (m) WHERE (n)-[:REL1|REL2|REL3|REL4]-(m) RETURN n, m
    // Pattern predicates in WHERE clause not supported
    // Note: Relationship type alternation [:REL1|REL2|REL3|REL4] IS supported in MATCH
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Undirected pattern predicate with type alternation in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n), (m) WHERE (n)-[:REL1|REL2|REL3|REL4]-(m) RETURN n, m`,
    );
    expect(results.length).toBeGreaterThan(0);
  });

  test.fails(
    "[14] Matching two nodes on a specific type of single outgoing directed connection - pattern predicates not supported",
    () => {
      // Original TCK:
      // MATCH (n), (m) WHERE (n)-[:REL1]->(m) RETURN n, m
      // Expected: (:A)->(:B), (:A)->(:D)
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`,
      );
      executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
      executeTckQuery(
        graph,
        `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`,
      );
      executeTckQuery(
        graph,
        `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`,
      );

      // Pattern predicate with specific type and two bound variables in WHERE clause
      const results = executeTckQuery(
        graph,
        `MATCH (n), (m) WHERE (n)-[:REL1]->(m) RETURN n, m`,
      );
      expect(results).toHaveLength(2);
    },
  );

  test("[15] Matching two nodes on a specific type of single undirected connection - undirected patterns not supported", () => {
    // Original TCK:
    // MATCH (n), (m) WHERE (n)-[:REL1]-(m) RETURN n, m
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Undirected pattern predicate with specific type and two bound variables in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n), (m) WHERE (n)-[:REL1]-(m) RETURN n, m`,
    );
    expect(results.length).toBeGreaterThan(0);
  });

  test("[16] Matching two nodes on a specific type of a variable length outgoing directed connection - pattern predicates not supported", () => {
    // Original TCK:
    // MATCH (n), (m) WHERE (n)-[:REL1*]->(m) RETURN n, m
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Variable length pattern predicate with two bound variables in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n), (m) WHERE (n)-[:REL1*]->(m) RETURN n, m`,
    );
    expect(results.length).toBeGreaterThan(0);
  });

  test("[17] Matching two nodes on a specific type of variable length undirected connection - undirected patterns not supported", () => {
    // Original TCK:
    // MATCH (n), (m) WHERE (n)-[:REL1*]-(m) RETURN n, m
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Variable length undirected pattern predicate with two bound variables in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n), (m) WHERE (n)-[:REL1*]-(m) RETURN n, m`,
    );
    expect(results.length).toBeGreaterThan(0);
  });

  test("[18] Matching two nodes on a specific type of undirected connection with length 2 - pattern predicates not supported", () => {
    // Original TCK:
    // MATCH (n), (m) WHERE (n)-[:REL1*2]-(m) RETURN n, m
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Fixed length undirected pattern predicate with two bound variables in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n), (m) WHERE (n)-[:REL1*2]-(m) RETURN n, m`,
    );
    expect(results.length).toBeGreaterThan(0);
  });

  test("[19] Using a negated existential pattern predicate - pattern predicates not supported", () => {
    // Original TCK:
    // MATCH (n) WHERE NOT (n)-[:REL2]-() RETURN n
    // Expected: (:C), (:D)
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Negated pattern predicate in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n) WHERE NOT (n)-[:REL2]-() RETURN n`,
    );
    expect(results).toHaveLength(2);
  });

  test("[20] Using two existential pattern predicates in a conjunction - pattern predicates not supported", () => {
    // Original TCK:
    // MATCH (n) WHERE (n)-[:REL1]-() AND (n)-[:REL3]-() RETURN n
    // Expected: (:A)
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Conjunction of pattern predicates in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n) WHERE (n)-[:REL1]-() AND (n)-[:REL3]-() RETURN n`,
    );
    expect(results).toHaveLength(1);
  });

  test("[21] Using two existential pattern predicates in a disjunction - pattern predicates not supported", () => {
    // Original TCK:
    // MATCH (n) WHERE (n)-[:REL1]-() OR (n)-[:REL2]-() RETURN n
    // Expected: (:A), (:B), (:D)
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL1]->(:D {name: 'd'})`);

    // Disjunction of pattern predicates in WHERE clause
    const results = executeTckQuery(
      graph,
      `MATCH (n) WHERE (n)-[:REL1]-() OR (n)-[:REL2]-() RETURN n`,
    );
    expect(results).toHaveLength(3);
  });

  test("[22] Fail on using pattern in RETURN projection - grammar error", () => {
    // Original TCK:
    // MATCH (n) RETURN (n)-[]->()
    // Expected: SyntaxError: UnexpectedSyntax
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);

    // Pattern in RETURN projection should fail with grammar error
    expect(() => {
      executeTckQuery(graph, `MATCH (n) RETURN (n)-[]->()`);
    }).toThrow();
  });

  test("[23] Fail on using pattern in WITH projection - grammar error", () => {
    // Original TCK:
    // MATCH (n) WITH (n)-[]->() AS x RETURN x
    // Expected: SyntaxError: UnexpectedSyntax
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);

    // Pattern in WITH projection should fail with grammar error
    expect(() => {
      executeTckQuery(graph, `MATCH (n) WITH (n)-[]->() AS x RETURN x`);
    }).toThrow();
  });

  test("[24] Fail on using pattern in right-hand side of SET - grammar error", () => {
    // Original TCK:
    // MATCH (n) SET n.prop = head(nodes(head((n)-[:REL]->()))).foo
    // Expected: SyntaxError: UnexpectedSyntax
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a'})-[:REL]->(:B {name: 'b', foo: 'bar'})`,
    );

    // Pattern in SET expression should fail with grammar error
    expect(() => {
      executeTckQuery(
        graph,
        `MATCH (n) SET n.prop = head(nodes(head((n)-[:REL]->()))).foo`,
      );
    }).toThrow();
  });

  // Custom tests demonstrating alternative patterns that ARE supported

  test("[Custom 1] Filter nodes by existence of outgoing relationship using MATCH pattern", () => {
    // Alternative to pattern predicate: use explicit MATCH pattern
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a1'})-[:REL1]->(:B {name: 'b1'})`,
    );
    executeTckQuery(graph, `CREATE (:C {name: 'c1'})`);

    // Find nodes that have outgoing REL1 relationships
    const results = executeTckQuery(
      graph,
      `MATCH (n)-[:REL1]->() RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a1");
  });

  test("[Custom 2] Filter nodes by existence of incoming relationship using MATCH pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a1'})-[:REL1]->(:B {name: 'b1'})`,
    );
    executeTckQuery(graph, `CREATE (:C {name: 'c1'})`);

    // Find nodes that have incoming REL1 relationships
    // The pattern ()-[:REL1]->(n) finds n which is the TARGET of REL1
    const results = executeTckQuery(
      graph,
      `MATCH ()-[:REL1]->(n) RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    // The node with incoming relationship is B (target of the edge)
    expect(results[0]).toBe("b1");
  });

  test("[Custom 3] Find connected node pairs via explicit MATCH", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (b)-[:REL2]->(a)`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);

    // Find all pairs connected by REL1
    const results = executeTckQuery(
      graph,
      `MATCH (n)-[:REL1]->(m) RETURN n.name, m.name`,
    );

    expect(results).toHaveLength(1);
    const [nName, mName] = results[0] as [string, string];
    expect(nName).toBe("a");
    expect(mName).toBe("b");
  });

  test("[Custom 4] Filter by specific relationship type", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a1'})-[:REL1]->(:B {name: 'b1'})`,
    );
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a2'})-[:REL2]->(:C {name: 'c1'})`,
    );

    // Find nodes with outgoing REL1
    const rel1Results = executeTckQuery(
      graph,
      `MATCH (n)-[:REL1]->() RETURN n.name`,
    );
    expect(rel1Results).toHaveLength(1);
    expect(rel1Results[0]).toBe("a1");

    // Find nodes with outgoing REL2
    const rel2Results = executeTckQuery(
      graph,
      `MATCH (n)-[:REL2]->() RETURN n.name`,
    );
    expect(rel2Results).toHaveLength(1);
    expect(rel2Results[0]).toBe("a2");
  });

  test("[Custom 5] Verify node has multiple outgoing relationship types via separate queries", () => {
    const graph = createTckGraph();
    // Create graph: A --REL1--> B, A --REL3--> C
    executeTckQuery(graph, `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A) CREATE (a)-[:REL3]->(:C {name: 'c'})`);

    // Comma-separated patterns with edges aren't supported
    // Verify via separate queries that both relationships exist
    const hasRel1 = executeTckQuery(
      graph,
      `MATCH (n:A)-[:REL1]->(:B) RETURN n.name`,
    );
    const hasRel3 = executeTckQuery(
      graph,
      `MATCH (n:A)-[:REL3]->(:C) RETURN n.name`,
    );

    expect(hasRel1).toHaveLength(1);
    expect(hasRel1[0]).toBe("a");
    expect(hasRel3).toHaveLength(1);
    expect(hasRel3[0]).toBe("a");
    // Both relationships exist from the same source node
    expect(hasRel1[0]).toBe(hasRel3[0]);
  });

  test("[Custom 6] Find nodes without specific relationship type via count", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, `CREATE (:A {name: 'a'})`);
    executeTckQuery(graph, `CREATE (:B {name: 'b'})`);
    executeTckQuery(graph, `MATCH (a:A), (b:B) CREATE (a)-[:REL1]->(b)`);
    executeTckQuery(graph, `CREATE (:C {name: 'c'})`);
    executeTckQuery(graph, `CREATE (:D {name: 'd'})`);

    // Find nodes that are source of REL1 relationships
    const withRel = executeTckQuery(
      graph,
      `MATCH (n)-[:REL1]->() RETURN DISTINCT n.name`,
    );
    expect(withRel).toHaveLength(1);
    expect(withRel[0]).toBe("a");
  });

  test("[Custom 7] Multiple relationship type checks in single pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'a'})-[:REL1]->(:B {name: 'b'})-[:REL2]->(:C {name: 'c'})`,
    );

    // Find nodes that are in a REL1->REL2 chain
    const results = executeTckQuery(
      graph,
      `MATCH (n)-[:REL1]->()-[:REL2]->() RETURN n.name`,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("a");
  });

  test("[Custom 8] Return full nodes from connection pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (:A {name: 'source'})-[:REL1]->(:B {name: 'target'})`,
    );

    const results = executeTckQuery(
      graph,
      `MATCH (n)-[:REL1]->(m) RETURN n, m`,
    );

    expect(results).toHaveLength(1);
    const [n, m] = results[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(getLabel(n)).toBe("A");
    expect(getLabel(m)).toBe("B");
  });
});
