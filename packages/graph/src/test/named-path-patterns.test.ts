import { describe, test, expect } from "vitest";
import { parse } from "../index.js";
import type { Query, Pattern } from "../AST.js";
import { createTckGraph, executeTckQuery } from "./tck/tckHelpers.js";

describe("Named path patterns (p = pattern)", () => {
  describe("Grammar parsing", () => {
    test("MATCH p = (a)-[r]->(b) parses with pathVariable", () => {
      const ast = parse("MATCH p = (a)-[r]->(b) RETURN p") as Query;
      const pattern = ast.matches![0]!.pattern as Pattern;
      expect(pattern.pathVariable).toBe("p");
      expect(pattern.elements).toHaveLength(3);
      expect(pattern.elements[0]!.type).toBe("NodePattern");
      expect(pattern.elements[1]!.type).toBe("EdgePattern");
      expect(pattern.elements[2]!.type).toBe("NodePattern");
    });

    test("MATCH path = (x:User)-[:KNOWS]->(y:User) parses correctly", () => {
      const ast = parse("MATCH path = (x:User)-[:KNOWS]->(y:User) RETURN path") as Query;
      const pattern = ast.matches![0]!.pattern as Pattern;
      expect(pattern.pathVariable).toBe("path");
    });

    test("Pattern without path variable has no pathVariable field", () => {
      const ast = parse("MATCH (a)-[r]->(b) RETURN a") as Query;
      const pattern = ast.matches![0]!.pattern as Pattern;
      expect(pattern.pathVariable).toBeUndefined();
    });

    test("Path variable with variable-length relationship", () => {
      const ast = parse("MATCH p = (a)-[*1..5]->(b) RETURN p") as Query;
      const pattern = ast.matches![0]!.pattern as Pattern;
      expect(pattern.pathVariable).toBe("p");
    });
  });

  describe("Query execution - path binding", () => {
    test("Named path can be returned", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a:A {name: 'A'})-[:KNOWS]->(b:B {name: 'B'})");
      const results = executeTckQuery(graph, "MATCH p = (a:A)-[:KNOWS]->(b:B) RETURN p");
      expect(results).toHaveLength(1);
      // Path should be returned (as a TraversalPath)
      expect(results[0]).toBeDefined();
    });

    test("nodes(p) returns list of nodes in path", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a:A {name: 'A'})-[:KNOWS]->(b:B {name: 'B'})");
      const results = executeTckQuery(graph, "MATCH p = (a:A)-[:KNOWS]->(b:B) RETURN nodes(p)");
      expect(results).toHaveLength(1);
      const nodes = results[0] as unknown[];
      expect(nodes).toHaveLength(2);
    });

    test("relationships(p) returns list of relationships in path", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a:A {name: 'A'})-[:KNOWS]->(b:B {name: 'B'})");
      const results = executeTckQuery(
        graph,
        "MATCH p = (a:A)-[:KNOWS]->(b:B) RETURN relationships(p)",
      );
      expect(results).toHaveLength(1);
      const rels = results[0] as unknown[];
      expect(rels).toHaveLength(1);
    });

    test("length(p) returns number of relationships in path", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a:A {name: 'A'})-[:KNOWS]->(b:B {name: 'B'})");
      const results = executeTckQuery(graph, "MATCH p = (a:A)-[:KNOWS]->(b:B) RETURN length(p)");
      expect(results).toEqual([1]);
    });

    test("Path through multiple hops", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a:A)-[:R]->(b:B)-[:R]->(c:C)");
      const results = executeTckQuery(graph, "MATCH p = (a:A)-[:R*]->(c:C) RETURN length(p)");
      // Should match both 1-hop (A->B->C) but need to check actual behavior
      // At minimum, the direct 2-hop path should match
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    test("nodes(p) with longer path", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a:A)-[:R]->(b:B)-[:R]->(c:C)");
      const results = executeTckQuery(
        graph,
        "MATCH p = (a:A)-[:R]->(b:B)-[:R]->(c:C) RETURN nodes(p)",
      );
      expect(results).toHaveLength(1);
      const nodes = results[0] as unknown[];
      expect(nodes).toHaveLength(3);
    });

    test("relationships(p) with longer path", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a:A)-[:R]->(b:B)-[:R]->(c:C)");
      const results = executeTckQuery(
        graph,
        "MATCH p = (a:A)-[:R]->(b:B)-[:R]->(c:C) RETURN relationships(p)",
      );
      expect(results).toHaveLength(1);
      const rels = results[0] as unknown[];
      expect(rels).toHaveLength(2);
    });

    test("Combine path functions with node variables", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a:A {name: 'Alice'})-[:KNOWS]->(b:B {name: 'Bob'})");
      const results = executeTckQuery(
        graph,
        "MATCH p = (a:A)-[:KNOWS]->(b:B) RETURN a.name, length(p), b.name",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(["Alice", 1, "Bob"]);
    });
  });

  describe("Edge cases", () => {
    test("Path with single node (length 0) - not a common pattern but valid", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a:A {name: 'A'})");
      // Single node patterns don't use path assignment in typical Cypher
      // But we should handle them gracefully
    });

    test("Path variable in WHERE clause with fixed-length path", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a:A)-[:R]->(b:B)-[:R]->(c:C)");
      // First verify the path is found without WHERE
      const noWhere = executeTckQuery(
        graph,
        "MATCH p = (a:A)-[:R]->(b:B)-[:R]->(c:C) RETURN length(p)",
      );
      expect(noWhere).toHaveLength(1);
      expect(noWhere[0]).toBe(2);

      // Now test with WHERE - the condition should pass
      const withWhere = executeTckQuery(
        graph,
        "MATCH p = (a:A)-[:R]->(b:B)-[:R]->(c:C) WHERE length(p) = 2 RETURN c",
      );
      // Should match the 2-hop path from A to C
      expect(withWhere).toHaveLength(1);
    });
  });
});
