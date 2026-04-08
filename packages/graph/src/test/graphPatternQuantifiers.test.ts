import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { clearQueryParams } from "../Steps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import type { Query, Pattern, EdgePattern } from "../AST.js";
import type { GraphSchema } from "../GraphSchema.js";
import { makeType, executeQuery } from "./testHelpers.js";

const schema = {
  vertices: {
    Person: {
      properties: {
        name: { type: makeType<string>("") },
      },
    },
  },
  edges: {
    FOLLOWS: {
      properties: {},
    },
  },
} as const satisfies GraphSchema;

describe("Graph Pattern Quantifiers", () => {
  describe("Grammar Parsing", () => {
    describe("Plus quantifier (+)", () => {
      test("should parse [+] - one or more", () => {
        const ast = parse("MATCH (a)-[+]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.quantifier).toBeDefined();
        expect(edge.quantifier!.min).toBe(1);
        expect(edge.quantifier!.max).toBeUndefined();
      });

      test("should parse [:KNOWS+] - labeled one or more", () => {
        const ast = parse("MATCH (a)-[:KNOWS+]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.labels).toContain("KNOWS");
        expect(edge.quantifier!.min).toBe(1);
        expect(edge.quantifier!.max).toBeUndefined();
      });

      test("should parse [r+] - variable one or more", () => {
        const ast = parse("MATCH (a)-[r+]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.variable).toBe("r");
        expect(edge.quantifier!.min).toBe(1);
        expect(edge.quantifier!.max).toBeUndefined();
      });

      test("should parse [r:KNOWS+] - variable with label and plus", () => {
        const ast = parse("MATCH (a)-[r:KNOWS+]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.variable).toBe("r");
        expect(edge.labels).toContain("KNOWS");
        expect(edge.quantifier!.min).toBe(1);
        expect(edge.quantifier!.max).toBeUndefined();
      });
    });

    describe("Curly brace quantifiers", () => {
      test("should parse [{2}] - exactly n", () => {
        const ast = parse("MATCH (a)-[{2}]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.quantifier!.min).toBe(2);
        expect(edge.quantifier!.max).toBe(2);
      });

      test("should parse [{1,3}] - range n to m", () => {
        const ast = parse("MATCH (a)-[{1,3}]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.quantifier!.min).toBe(1);
        expect(edge.quantifier!.max).toBe(3);
      });

      test("should parse [{2,}] - n or more", () => {
        const ast = parse("MATCH (a)-[{2,}]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.quantifier!.min).toBe(2);
        expect(edge.quantifier!.max).toBeUndefined();
      });

      test("should parse [{,3}] - zero to m", () => {
        const ast = parse("MATCH (a)-[{,3}]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.quantifier!.min).toBe(0);
        expect(edge.quantifier!.max).toBe(3);
      });

      test("should parse [:KNOWS{2}] - labeled exact count", () => {
        const ast = parse("MATCH (a)-[:KNOWS{2}]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.labels).toContain("KNOWS");
        expect(edge.quantifier!.min).toBe(2);
        expect(edge.quantifier!.max).toBe(2);
      });

      test("should parse [r:KNOWS{1,5}] - full form with range", () => {
        const ast = parse("MATCH (a)-[r:KNOWS{1,5}]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.variable).toBe("r");
        expect(edge.labels).toContain("KNOWS");
        expect(edge.quantifier!.min).toBe(1);
        expect(edge.quantifier!.max).toBe(5);
      });

      test("should allow whitespace in curly braces", () => {
        const ast = parse("MATCH (a)-[{ 1 , 3 }]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.quantifier!.min).toBe(1);
        expect(edge.quantifier!.max).toBe(3);
      });
    });

    describe("Open start range (*..n)", () => {
      test("should parse [*..3] - defaults min to 1", () => {
        const ast = parse("MATCH (a)-[*..3]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.quantifier!.min).toBe(1);
        expect(edge.quantifier!.max).toBe(3);
      });

      test("should parse [:KNOWS*..5] - labeled open start", () => {
        const ast = parse("MATCH (a)-[:KNOWS*..5]->(b) RETURN a, b") as Query;
        const edge = (ast.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edge.labels).toContain("KNOWS");
        expect(edge.quantifier!.min).toBe(1);
        expect(edge.quantifier!.max).toBe(5);
      });
    });

    describe("Equivalence checks", () => {
      test("[*] and [+] should be equivalent (both 1+)", () => {
        const astStar = parse("MATCH (a)-[*]->(b) RETURN a, b") as Query;
        const astPlus = parse("MATCH (a)-[+]->(b) RETURN a, b") as Query;
        const edgeStar = (astStar.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        const edgePlus = (astPlus.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edgeStar.quantifier!.min).toBe(edgePlus.quantifier!.min);
        expect(edgeStar.quantifier!.max).toBe(edgePlus.quantifier!.max);
      });

      test("[*2] and [{2}] should be equivalent", () => {
        const astStar = parse("MATCH (a)-[*2]->(b) RETURN a, b") as Query;
        const astCurly = parse("MATCH (a)-[{2}]->(b) RETURN a, b") as Query;
        const edgeStar = (astStar.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        const edgeCurly = (astCurly.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edgeStar.quantifier!.min).toBe(edgeCurly.quantifier!.min);
        expect(edgeStar.quantifier!.max).toBe(edgeCurly.quantifier!.max);
      });

      test("[*1..3] and [{1,3}] should be equivalent", () => {
        const astStar = parse("MATCH (a)-[*1..3]->(b) RETURN a, b") as Query;
        const astCurly = parse("MATCH (a)-[{1,3}]->(b) RETURN a, b") as Query;
        const edgeStar = (astStar.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        const edgeCurly = (astCurly.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edgeStar.quantifier!.min).toBe(edgeCurly.quantifier!.min);
        expect(edgeStar.quantifier!.max).toBe(edgeCurly.quantifier!.max);
      });

      test("[*2..] and [{2,}] should be equivalent", () => {
        const astStar = parse("MATCH (a)-[*2..]->(b) RETURN a, b") as Query;
        const astCurly = parse("MATCH (a)-[{2,}]->(b) RETURN a, b") as Query;
        const edgeStar = (astStar.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        const edgeCurly = (astCurly.matches[0]!.pattern as Pattern)
          .elements[1] as EdgePattern;
        expect(edgeStar.quantifier!.min).toBe(edgeCurly.quantifier!.min);
        expect(edgeStar.quantifier!.max).toBe(edgeCurly.quantifier!.max);
      });
    });
  });

  describe("Query Execution", () => {
    let graph: Graph<typeof schema>;

    beforeEach(() => {
      graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
      // Create a chain: a -> b -> c -> d -> e
      const a = graph.addVertex("Person", { name: "a" });
      const b = graph.addVertex("Person", { name: "b" });
      const c = graph.addVertex("Person", { name: "c" });
      const d = graph.addVertex("Person", { name: "d" });
      const e = graph.addVertex("Person", { name: "e" });

      graph.addEdge(a, "FOLLOWS", b, {});
      graph.addEdge(b, "FOLLOWS", c, {});
      graph.addEdge(c, "FOLLOWS", d, {});
      graph.addEdge(d, "FOLLOWS", e, {});
    });

    afterEach(() => {
      clearQueryParams();
    });

    test("should execute [+] - one or more hops", () => {
      // NOTE: Inline property filters don't work in MATCH, so using WHERE
      const results = executeQuery(
        graph,
        "MATCH (a:Person)-[:FOLLOWS+]->(b) WHERE a.name = 'a' RETURN b.name",
      );
      // Should find b, c, d, e (all reachable from a)
      expect(results).toContain("b");
      expect(results).toContain("c");
      expect(results).toContain("d");
      expect(results).toContain("e");
    });

    test("should execute [{2}] - exactly 2 hops", () => {
      const results = executeQuery(
        graph,
        "MATCH (a:Person)-[:FOLLOWS{2}]->(b) WHERE a.name = 'a' RETURN b.name",
      );
      // Should only find c (exactly 2 hops from a)
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("c");
    });

    test("should execute [{1,2}] - 1 to 2 hops", () => {
      const results = executeQuery(
        graph,
        "MATCH (a:Person)-[:FOLLOWS{1,2}]->(b) WHERE a.name = 'a' RETURN b.name",
      );
      // Should find b (1 hop) and c (2 hops)
      expect(results).toContain("b");
      expect(results).toContain("c");
      expect(results).not.toContain("d");
    });

    test("should execute [{2,}] - 2 or more hops", () => {
      const results = executeQuery(
        graph,
        "MATCH (a:Person)-[:FOLLOWS{2,}]->(b) WHERE a.name = 'a' RETURN b.name",
      );
      // Should find c, d, e (2+ hops from a)
      expect(results).not.toContain("b"); // 1 hop
      expect(results).toContain("c"); // 2 hops
      expect(results).toContain("d"); // 3 hops
      expect(results).toContain("e"); // 4 hops
    });

    test("should execute [{,3}] - 0 to 3 hops", () => {
      const results = executeQuery(
        graph,
        "MATCH (a:Person)-[:FOLLOWS{,3}]->(b) WHERE a.name = 'a' RETURN b.name",
      );
      // Should find a (0 hops), b (1), c (2), d (3), but not e (4)
      expect(results).toContain("a"); // 0 hops (self)
      expect(results).toContain("b");
      expect(results).toContain("c");
      expect(results).toContain("d");
      expect(results).not.toContain("e");
    });

    test("should execute [*..2] - 1 to 2 hops (open start)", () => {
      const results = executeQuery(
        graph,
        "MATCH (a:Person)-[:FOLLOWS*..2]->(b) WHERE a.name = 'a' RETURN b.name",
      );
      // min defaults to 1, so should find b and c
      expect(results).toContain("b");
      expect(results).toContain("c");
      expect(results).not.toContain("d");
    });

    test("[*] and [+] should produce same results", () => {
      const resultsStar = executeQuery(
        graph,
        "MATCH (a:Person)-[:FOLLOWS*]->(b) WHERE a.name = 'a' RETURN b.name",
      );
      const resultsPlus = executeQuery(
        graph,
        "MATCH (a:Person)-[:FOLLOWS+]->(b) WHERE a.name = 'a' RETURN b.name",
      );
      expect([...resultsStar].sort()).toEqual([...resultsPlus].sort());
    });

    test("[*2] and [{2}] should produce same results", () => {
      const resultsStar = executeQuery(
        graph,
        "MATCH (a:Person)-[:FOLLOWS*2]->(b) WHERE a.name = 'a' RETURN b.name",
      );
      const resultsCurly = executeQuery(
        graph,
        "MATCH (a:Person)-[:FOLLOWS{2}]->(b) WHERE a.name = 'a' RETURN b.name",
      );
      expect([...resultsStar].sort()).toEqual([...resultsCurly].sort());
    });
  });

  describe("Edge Cases", () => {
    test("should parse {0} - zero hops (self)", () => {
      const ast = parse("MATCH (a)-[{0}]->(b) RETURN a, b") as Query;
      const edge = (ast.matches[0]!.pattern as Pattern)
        .elements[1] as EdgePattern;
      expect(edge.quantifier!.min).toBe(0);
      expect(edge.quantifier!.max).toBe(0);
    });

    test("should parse {0,0} - explicitly zero", () => {
      const ast = parse("MATCH (a)-[{0,0}]->(b) RETURN a, b") as Query;
      const edge = (ast.matches[0]!.pattern as Pattern)
        .elements[1] as EdgePattern;
      expect(edge.quantifier!.min).toBe(0);
      expect(edge.quantifier!.max).toBe(0);
    });

    test("should parse large quantifiers", () => {
      const ast = parse("MATCH (a)-[{100}]->(b) RETURN a, b") as Query;
      const edge = (ast.matches[0]!.pattern as Pattern)
        .elements[1] as EdgePattern;
      expect(edge.quantifier!.min).toBe(100);
      expect(edge.quantifier!.max).toBe(100);
    });

    test("should work with bidirectional relationships", () => {
      const ast = parse("MATCH (a)-[{1,3}]-(b) RETURN a, b") as Query;
      const edge = (ast.matches[0]!.pattern as Pattern)
        .elements[1] as EdgePattern;
      expect(edge.direction).toBe("both");
      expect(edge.quantifier!.min).toBe(1);
      expect(edge.quantifier!.max).toBe(3);
    });

    test("should work with incoming relationships", () => {
      const ast = parse("MATCH (a)<-[{1,2}]-(b) RETURN a, b") as Query;
      const edge = (ast.matches[0]!.pattern as Pattern)
        .elements[1] as EdgePattern;
      expect(edge.direction).toBe("in");
      expect(edge.quantifier!.min).toBe(1);
      expect(edge.quantifier!.max).toBe(2);
    });
  });
});
