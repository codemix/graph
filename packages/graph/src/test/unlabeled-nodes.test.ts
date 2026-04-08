import { describe, test, expect } from "vitest";
import { parse } from "../index.js";
import type { Query } from "../AST.js";
import { createTckGraph, executeTckQuery } from "./tck/tckHelpers.js";

describe("Unlabeled nodes support", () => {
  describe("Grammar parsing", () => {
    test("CREATE () - anonymous unlabeled node", () => {
      const ast = parse("CREATE ()") as Query;
      expect(ast.create?.patterns[0]).toEqual({
        type: "CreateNodePattern",
        variable: undefined,
        labels: [],
      });
    });

    test("CREATE ()-[:R]->() - chain with unlabeled nodes", () => {
      const ast = parse("CREATE ()-[:R]->()") as Query;
      const chain = ast.create?.patterns[0] as {
        type: string;
        elements: unknown[];
      };
      expect(chain?.type).toBe("CreateChainPattern");
      expect(chain?.elements[0]).toEqual({
        type: "CreateNodePattern",
        variable: undefined,
        labels: [],
      });
      expect(chain?.elements[2]).toEqual({
        type: "CreateNodePattern",
        variable: undefined,
        labels: [],
      });
    });

    test("CREATE ({name: 'test'}) - anonymous node with properties", () => {
      const ast = parse("CREATE ({name: 'test'})") as Query;
      expect(ast.create?.patterns[0]).toEqual({
        type: "CreateNodePattern",
        variable: undefined,
        labels: [],
        properties: { name: "test" },
      });
    });

    test("CREATE (a), (b), (a)-[:R]->(b) - variable refs preserved", () => {
      const ast = parse("CREATE (a), (b), (a)-[:R]->(b)") as Query;
      // First pattern: (a) - unlabeled node with variable
      expect(ast.create?.patterns[0]).toEqual({
        type: "CreateNodePattern",
        variable: "a",
        labels: [],
      });
      // Second pattern: (b)
      expect(ast.create?.patterns[1]).toEqual({
        type: "CreateNodePattern",
        variable: "b",
        labels: [],
      });
      // Third pattern: (a)-[:R]->(b) - chain with variable refs
      const chain = ast.create?.patterns[2] as {
        type: string;
        elements: unknown[];
      };
      expect(chain?.type).toBe("CreateChainPattern");
      expect(chain?.elements[0]).toEqual({
        type: "CreateVariableRef",
        variable: "a",
      });
      expect(chain?.elements[2]).toEqual({
        type: "CreateVariableRef",
        variable: "b",
      });
    });

    test("CREATE (n {num: 1}), (n)-[:R]->()", () => {
      const ast = parse("CREATE (n {num: 1}), (n)-[:R]->()") as Query;
      // First: (n {num: 1}) - new node with properties
      expect(ast.create?.patterns[0]).toEqual({
        type: "CreateNodePattern",
        variable: "n",
        labels: [],
        properties: { num: 1 },
      });
      // Second: (n)-[:R]->() - chain
      const chain = ast.create?.patterns[1] as {
        type: string;
        elements: unknown[];
      };
      expect(chain?.elements[0]).toEqual({
        type: "CreateVariableRef",
        variable: "n",
      });
      expect(chain?.elements[2]).toEqual({
        type: "CreateNodePattern",
        variable: undefined,
        labels: [],
      });
    });

    test("MATCH (n) - unlabeled node in MATCH", () => {
      const ast = parse("MATCH (n) RETURN n") as Query;
      const pattern = ast.matches?.[0]?.pattern as {
        elements?: Array<{ labels?: string[] }>;
      };
      expect(pattern?.elements?.[0]?.labels).toEqual([]);
    });

    test("MATCH (n)-[:R]->(m) - unlabeled nodes in pattern", () => {
      const ast = parse("MATCH (n)-[:R]->(m) RETURN n, m") as Query;
      const pattern = ast.matches?.[0]?.pattern as {
        elements?: Array<{ labels?: string[] }>;
      };
      expect(pattern?.elements?.[0]?.labels).toEqual([]);
      expect(pattern?.elements?.[2]?.labels).toEqual([]);
    });
  });

  describe("Query execution", () => {
    test("CREATE () creates an unlabeled node", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ()");
      const results = executeTckQuery(graph, "MATCH (n) RETURN count(n)");
      expect(results).toEqual([1]);
    });

    test("CREATE ()-[:R]->() creates relationship between unlabeled nodes", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ()-[:R]->()");
      const results = executeTckQuery(graph, "MATCH (a)-[r:R]->(b) RETURN count(r)");
      expect(results).toEqual([1]);
    });

    test("CREATE (n1 {num: 1}), (n2 {num: 3}), (n3 {num: -5})", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (n1 {num: 1}), (n2 {num: 3}), (n3 {num: -5})");
      const results = executeTckQuery(graph, "MATCH (n) RETURN n.num ORDER BY n.num");
      expect(results).toEqual([-5, 1, 3]);
    });

    test("MATCH (n) returns all nodes regardless of labels", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:A {name: 'a'})");
      executeTckQuery(graph, "CREATE (:B {name: 'b'})");
      executeTckQuery(graph, "CREATE ({name: 'c'})"); // No label

      const results = executeTckQuery(graph, "MATCH (n) RETURN n.name ORDER BY n.name");
      expect(results).toEqual(["a", "b", "c"]);
    });

    test("CREATE (a), (b), (a)-[:R]->(b) - create and link in one query", () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (a), (b), (a)-[:R]->(b)");

      // Should have 2 nodes
      const nodeCount = executeTckQuery(graph, "MATCH (n) RETURN count(n)");
      expect(nodeCount).toEqual([2]);

      // Should have 1 relationship
      const relCount = executeTckQuery(graph, "MATCH ()-[r]->() RETURN count(r)");
      expect(relCount).toEqual([1]);
    });
  });
});
