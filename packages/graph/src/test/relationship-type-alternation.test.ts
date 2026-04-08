import { describe, test, expect } from "vitest";
import { parse } from "../grammar.js";
import type { Query, EdgePattern, Pattern } from "../AST.js";
import { createTckGraph, executeTckQuery, getLabel } from "./tck/tckHelpers.js";

describe("Relationship Type Alternation", () => {
  describe("Grammar Parsing", () => {
    test("parses [:TYPE1|TYPE2] as array of labels", () => {
      const ast = parse(
        "MATCH (a:A)-[:KNOWS|FOLLOWS]->(b:B) RETURN b",
      ) as Query;
      const edge = (ast.matches[0]!.pattern as Pattern)
        .elements[1] as EdgePattern;
      expect(edge.labels).toEqual(["KNOWS", "FOLLOWS"]);
    });

    test("parses [:TYPE1|TYPE2|TYPE3] with three types", () => {
      const ast = parse("MATCH (a)-[:A|B|C]->(b) RETURN b") as Query;
      const edge = (ast.matches[0]!.pattern as Pattern)
        .elements[1] as EdgePattern;
      expect(edge.labels).toEqual(["A", "B", "C"]);
    });

    test("parses undirected pattern with type alternation", () => {
      const ast = parse("MATCH (a)-[:KNOWS|FOLLOWS]-(b) RETURN b") as Query;
      const edge = (ast.matches[0]!.pattern as Pattern)
        .elements[1] as EdgePattern;
      expect(edge.labels).toEqual(["KNOWS", "FOLLOWS"]);
      expect(edge.direction).toBe("both");
    });

    test("parses type alternation with variable binding", () => {
      const ast = parse("MATCH (a)-[r:X|Y]->(b) RETURN r") as Query;
      const edge = (ast.matches[0]!.pattern as Pattern)
        .elements[1] as EdgePattern;
      expect(edge.labels).toEqual(["X", "Y"]);
      expect(edge.variable).toBe("r");
    });
  });

  describe("Query Execution", () => {
    test("matches edges with either type", () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (a:Person {name: 'Alice'})-[:KNOWS]->(b:Person {name: 'Bob'})`,
      );
      executeTckQuery(
        graph,
        `CREATE (a:Person {name: 'Alice'})-[:FOLLOWS]->(c:Person {name: 'Charlie'})`,
      );

      const results = executeTckQuery(
        graph,
        `MATCH (a:Person {name: 'Alice'})-[:KNOWS|FOLLOWS]->(b) RETURN b.name`,
      );

      expect(results).toHaveLength(2);
      expect(results).toContain("Bob");
      expect(results).toContain("Charlie");
    });

    test("does not match edges with other types", () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (a:Person {name: 'Alice'})-[:KNOWS]->(b:Person {name: 'Bob'})`,
      );
      executeTckQuery(
        graph,
        `CREATE (a:Person {name: 'Alice'})-[:LIKES]->(c:Person {name: 'Charlie'})`,
      );

      // Only KNOWS|FOLLOWS, should not match LIKES
      const results = executeTckQuery(
        graph,
        `MATCH (a:Person {name: 'Alice'})-[:KNOWS|FOLLOWS]->(b) RETURN b.name`,
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Bob");
    });

    test("matches all edges when using empty label set", () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (a:Person {name: 'Alice'})-[:KNOWS]->(b:Person {name: 'Bob'})`,
      );
      executeTckQuery(
        graph,
        `CREATE (a:Person {name: 'Alice'})-[:FOLLOWS]->(c:Person {name: 'Charlie'})`,
      );
      executeTckQuery(
        graph,
        `CREATE (a:Person {name: 'Alice'})-[:LIKES]->(d:Person {name: 'David'})`,
      );

      // Empty edge labels matches all edge types
      const results = executeTckQuery(
        graph,
        `MATCH (a:Person {name: 'Alice'})-->(b) RETURN b.name`,
      );

      expect(results).toHaveLength(3);
    });

    test("works with duplicate type in alternation [:T|T]", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, `CREATE (a:A)-[:T]->(b:B)`);

      // [:T|T] should still match the edge once
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:T|T]->(b:B) RETURN b`,
      );

      expect(results).toHaveLength(1);
    });

    test("works in multi-hop patterns", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, `CREATE (a:A)-[:X]->(b:B)-[:Y]->(c:C)`);
      executeTckQuery(graph, `CREATE (a:A)-[:Z]->(d:D)`);

      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:X|Z]->(b)-[:Y]->(c) RETURN c`,
      );

      // Only X->Y path reaches C
      expect(results).toHaveLength(1);
    });

    test("works with undirected pattern", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, `CREATE (a:A)-[:KNOWS]->(b:B)`);
      executeTckQuery(graph, `CREATE (c:C)-[:FOLLOWS]->(a:A)`);

      // Undirected match from A should find both directions
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:KNOWS|FOLLOWS]-(other) RETURN other`,
      );

      expect(results).toHaveLength(2);
    });

    test("works with variable binding", () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (a:Person {name: 'Alice'})-[:KNOWS {since: 2020}]->(b:Person {name: 'Bob'})`,
      );
      executeTckQuery(
        graph,
        `CREATE (a:Person {name: 'Alice'})-[:FOLLOWS {since: 2021}]->(c:Person {name: 'Charlie'})`,
      );

      const results = executeTckQuery(
        graph,
        `MATCH (a:Person {name: 'Alice'})-[r:KNOWS|FOLLOWS]->(b) RETURN type(r), r.since`,
      );

      expect(results).toHaveLength(2);
      const types = results.map((r) => (r as unknown[])[0]);
      expect(types).toContain("KNOWS");
      expect(types).toContain("FOLLOWS");
    });

    test("works with WHERE clause filtering", () => {
      const graph = createTckGraph();
      executeTckQuery(
        graph,
        `CREATE (a:Person {name: 'Alice'})-[:KNOWS {weight: 5}]->(b:Person {name: 'Bob'})`,
      );
      executeTckQuery(
        graph,
        `CREATE (a:Person {name: 'Alice'})-[:FOLLOWS {weight: 10}]->(c:Person {name: 'Charlie'})`,
      );

      const results = executeTckQuery(
        graph,
        `MATCH (a:Person {name: 'Alice'})-[r:KNOWS|FOLLOWS]->(b) WHERE r.weight > 7 RETURN b.name`,
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Charlie");
    });

    test("works with three relationship types", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, `CREATE (a:A)-[:X]->(b:B {v: 1})`);
      executeTckQuery(graph, `CREATE (a:A)-[:Y]->(c:B {v: 2})`);
      executeTckQuery(graph, `CREATE (a:A)-[:Z]->(d:B {v: 3})`);
      executeTckQuery(graph, `CREATE (a:A)-[:W]->(e:B {v: 4})`);

      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:X|Y|Z]->(b) RETURN b.v`,
      );

      expect(results).toHaveLength(3);
      expect(results).toContain(1);
      expect(results).toContain(2);
      expect(results).toContain(3);
      expect(results).not.toContain(4);
    });
  });

  describe("TCK Compatibility", () => {
    test("[Match3.8] Matching using relationship predicate with multiples of the same type", () => {
      // From TCK Match3 Feature Scenario 8
      const graph = createTckGraph();
      executeTckQuery(graph, `CREATE (a:A)-[:T]->(b:B)`);

      // [:T|T] - duplicates should still work
      const results = executeTckQuery(
        graph,
        `MATCH (a)-[:T|T]->(b) RETURN a, b`,
      );

      // Should match the single T relationship
      expect(results).toHaveLength(1);
      const [row] = results as [
        [Record<string, unknown>, Record<string, unknown>],
      ];
      expect(getLabel(row[0])).toBe("A");
      expect(getLabel(row[1])).toBe("B");
    });

    test("[TriadicSelection1.6] Friend of friend with explicit subset of relationship type", () => {
      // From TCK TriadicSelection1 Feature Scenario 6
      const graph = createTckGraph();
      // Setup graph with KNOWS and FOLLOWS relationships
      executeTckQuery(
        graph,
        `CREATE (a:A {name: 'a'})-[:KNOWS]->(b:B {name: 'b'})-[:KNOWS]->(c:C {name: 'c'})`,
      );
      executeTckQuery(
        graph,
        `CREATE (a:A {name: 'a'})-[:FOLLOWS]->(d:D {name: 'd'})`,
      );

      // Match friend of friend pattern with type alternation
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:KNOWS|FOLLOWS]->(b)-[:KNOWS]->(c) RETURN c.name`,
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("c");
    });
  });
});
