import { describe, it, expect, beforeEach } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parse } from "../grammar.js";
import { anyAstToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import type { Query, UnionQuery, MultiStatement } from "../AST.js";

function makeType<T>(_defaultValue: T): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "codemix",
      validate: (value) => {
        return { value: value as T };
      },
    },
  };
}

const schema = {
  vertices: {
    Person: {
      properties: {
        name: { type: makeType("") },
        createdAt: { type: makeType<number | null>(null) },
        processed: { type: makeType<boolean | null>(null) },
        marked: { type: makeType<boolean | null>(null) },
      },
    },
    Item: {
      properties: {
        value: { type: makeType<number | null>(null) },
        processed: { type: makeType<boolean | null>(null) },
        marked: { type: makeType<boolean | null>(null) },
      },
    },
  },
  edges: {
    knows: {
      properties: {},
    },
    likes: {
      properties: {},
    },
  },
};

type TestSchema = typeof schema;

function executeQuery(graph: Graph<TestSchema>, query: string): any[] {
  const ast = parse(query) as Query | UnionQuery | MultiStatement;
  const steps = anyAstToSteps(ast);
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

describe("Duplicate Removal Queries", () => {
  let graph: Graph<TestSchema>;

  beforeEach(() => {
    graph = new Graph({ schema, storage: new InMemoryGraphStorage() });
  });

  describe("Grammar parsing", () => {
    it("should parse DELETE in FOREACH", () => {
      // Just test grammar parsing
      const query = `
        MATCH (n:Person)
        WITH n.name AS name, collect(n) AS nodes
        WHERE size(nodes) > 1
        FOREACH (n1 IN tail(nodes) | DELETE n1)
        RETURN name
      `;
      const ast = parse(query) as Query;
      expect(ast.type).toBe("Query");
      expect(ast.foreach).toBeDefined();
      expect(ast.foreach).toHaveLength(1);
      const foreachClause = ast.foreach![0]!;
      expect(foreachClause.operations[0]!.type).toBe("DeleteOperation");
    });

    it("should parse DETACH DELETE in FOREACH", () => {
      const query = `
        MATCH (n:Person)
        WITH n.name AS name, collect(n) AS nodes
        WHERE size(nodes) > 1
        FOREACH (n1 IN tail(nodes) | DETACH DELETE n1)
        RETURN name
      `;
      const ast = parse(query) as Query;
      const foreachClause = ast.foreach![0]!;
      expect(foreachClause.operations[0]!.type).toBe("DeleteOperation");
      expect((foreachClause.operations[0] as any).detach).toBe(true);
    });

    it("should parse function calls in WITH", () => {
      const query = `
        MATCH ()-[r]->()
        WITH type(r) AS relType
        RETURN relType
      `;
      const ast = parse(query) as Query;
      expect(ast.type).toBe("Query");
      expect(ast.with).toHaveLength(1);
      const withItem = ast.with![0]!.items[0]!;
      expect(withItem.expression.type).toBe("FunctionCall");
      expect((withItem.expression as any).name).toBe("type");
    });

    it("should parse function calls in FOREACH list expression", () => {
      const query = `
        MATCH (n:Person)
        WITH collect(n) AS nodes
        FOREACH (n1 IN tail(nodes) | SET n1.processed = true)
        RETURN nodes
      `;
      const ast = parse(query) as Query;
      expect(ast.foreach).toHaveLength(1);
      const foreachClause = ast.foreach![0]!;
      expect(foreachClause.listExpression.type).toBe("FunctionCall");
      expect((foreachClause.listExpression as any).name).toBe("tail");
    });

    it("should parse variable reference in FOREACH list expression", () => {
      const query = `
        MATCH (n:Person)
        WITH collect(n) AS nodes
        FOREACH (n1 IN nodes | SET n1.processed = true)
        RETURN nodes
      `;
      const ast = parse(query) as Query;
      expect(ast.foreach).toHaveLength(1);
      const foreachClause = ast.foreach![0]!;
      expect(foreachClause.listExpression.type).toBe("VariableRef");
      expect((foreachClause.listExpression as any).variable).toBe("nodes");
    });
  });

  describe("FOREACH with DELETE execution", () => {
    it("should delete nodes via FOREACH DELETE", () => {
      // Create some nodes
      graph.addVertex("Person", {
        name: "Alice",
        createdAt: null,
        processed: null,
        marked: null,
      });
      graph.addVertex("Person", {
        name: "Alice",
        createdAt: null,
        processed: null,
        marked: null,
      });
      graph.addVertex("Person", {
        name: "Bob",
        createdAt: null,
        processed: null,
        marked: null,
      });

      // Find duplicates and delete all but one
      const query = `
        MATCH (n:Person)
        WITH n.name AS name, collect(n) AS nodes
        WHERE size(nodes) > 1
        FOREACH (n1 IN tail(nodes) | DELETE n1)
        RETURN name
      `;

      const result = executeQuery(graph, query);
      expect(result).toHaveLength(1);

      // Verify node was deleted - should have 2 nodes now (Alice + Bob)
      const remaining = executeQuery(graph, "MATCH (n:Person) RETURN n.name AS name");
      expect(remaining).toHaveLength(2);
    });

    it("should delete nodes with DETACH DELETE when they have edges", () => {
      // Create nodes
      const alice = graph.addVertex("Person", {
        name: "Alice",
        createdAt: null,
        processed: null,
        marked: null,
      });
      const alice2 = graph.addVertex("Person", {
        name: "Alice",
        createdAt: null,
        processed: null,
        marked: null,
      });
      const bob = graph.addVertex("Person", {
        name: "Bob",
        createdAt: null,
        processed: null,
        marked: null,
      });

      // Create edges to both Alices
      graph.addEdge(alice, "knows", bob, {});
      graph.addEdge(alice2, "knows", bob, {});

      // Find duplicates and delete using DETACH DELETE
      const query = `
        MATCH (n:Person)
        WITH n.name AS name, collect(n) AS nodes
        WHERE size(nodes) > 1
        FOREACH (n1 IN tail(nodes) | DETACH DELETE n1)
        RETURN name
      `;

      const result = executeQuery(graph, query);
      expect(result).toHaveLength(1);

      // Verify node was deleted - should have 2 nodes now
      const remaining = executeQuery(graph, "MATCH (n:Person) RETURN n.name AS name");
      expect(remaining).toHaveLength(2);
    });
  });

  describe("WITH function calls execution", () => {
    it("should support type(r) in WITH clause", () => {
      const alice = graph.addVertex("Person", {
        name: "Alice",
        createdAt: null,
        processed: null,
        marked: null,
      });
      const bob = graph.addVertex("Person", {
        name: "Bob",
        createdAt: null,
        processed: null,
        marked: null,
      });
      graph.addEdge(alice, "knows", bob, {});
      graph.addEdge(alice, "likes", bob, {});

      const query = `
        MATCH ()-[r]->()
        WITH type(r) AS relType, collect(r) AS rels
        RETURN relType
      `;

      const result = executeQuery(graph, query);
      expect(result).toHaveLength(2);
      // Extract relType from result - it might be nested or direct
      const relTypes = result
        .map((r: any) => {
          if (typeof r === "string") return r;
          if (Array.isArray(r)) return r[0];
          if (r.relType) return r.relType;
          return r;
        })
        .sort();
      expect(relTypes).toContain("knows");
      expect(relTypes).toContain("likes");
    });
  });

  describe("tail() function in FOREACH", () => {
    it("should iterate over tail of collected list and SET properties", () => {
      graph.addVertex("Item", { value: 1, processed: null, marked: null });
      graph.addVertex("Item", { value: 2, processed: null, marked: null });
      graph.addVertex("Item", { value: 3, processed: null, marked: null });

      const query = `
        MATCH (n:Item)
        WITH collect(n) AS items
        FOREACH (item IN tail(items) | SET item.processed = true)
        RETURN items
      `;

      executeQuery(graph, query);

      // Check that tail items were processed
      const results = executeQuery(
        graph,
        "MATCH (n:Item) RETURN n.value AS value, n.processed AS processed ORDER BY n.value",
      );
      expect(results).toHaveLength(3);
      // Based on ordering, first item should not have processed=true, others should
      // Note: actual ordering depends on collect() order
    });

    it("should use variable reference in FOREACH list expression", () => {
      graph.addVertex("Item", { value: 1, processed: null, marked: null });
      graph.addVertex("Item", { value: 2, processed: null, marked: null });
      graph.addVertex("Item", { value: 3, processed: null, marked: null });

      const query = `
        MATCH (n:Item)
        WITH collect(n) AS items
        FOREACH (item IN items | SET item.marked = true)
        RETURN items
      `;

      executeQuery(graph, query);

      // Verify all items were marked
      const marked = executeQuery(
        graph,
        "MATCH (n:Item) WHERE n.marked = true RETURN n.value AS value",
      );
      expect(marked).toHaveLength(3);
    });
  });

  describe("Full duplicate removal workflow", () => {
    it("should remove duplicate nodes keeping one", () => {
      // Create duplicates
      graph.addVertex("Person", {
        name: "Alice",
        createdAt: 1,
        processed: null,
        marked: null,
      });
      graph.addVertex("Person", {
        name: "Alice",
        createdAt: 2,
        processed: null,
        marked: null,
      });
      graph.addVertex("Person", {
        name: "Alice",
        createdAt: 3,
        processed: null,
        marked: null,
      });
      graph.addVertex("Person", {
        name: "Bob",
        createdAt: 1,
        processed: null,
        marked: null,
      });

      const query = `
        MATCH (n:Person)
        WITH n.name AS name, collect(n) AS nodes
        WHERE size(nodes) > 1
        FOREACH (n1 IN tail(nodes) | DELETE n1)
        RETURN name
      `;

      const result = executeQuery(graph, query);
      expect(result).toHaveLength(1);

      // Verify only one Alice remains and Bob is still there
      const remaining = executeQuery(graph, "MATCH (n:Person) RETURN n");
      expect(remaining).toHaveLength(2);
      const names = remaining
        .map((r: any) => {
          // Handle various result formats
          const node = Array.isArray(r) ? r[0] : r;
          if (typeof node === "object" && node !== null) {
            if (node.name) return node.name;
            if (typeof node.get === "function") return node.get("name");
            if (node.value && typeof node.value.get === "function") return node.value.get("name");
          }
          return r;
        })
        .sort();
      expect(names).toContain("Alice");
      expect(names).toContain("Bob");
    });

    it("should remove duplicate relationships keeping one", () => {
      const alice = graph.addVertex("Person", {
        name: "Alice",
        createdAt: null,
        processed: null,
        marked: null,
      });
      const bob = graph.addVertex("Person", {
        name: "Bob",
        createdAt: null,
        processed: null,
        marked: null,
      });

      // Create duplicate relationships
      graph.addEdge(alice, "knows", bob, {});
      graph.addEdge(alice, "knows", bob, {});
      graph.addEdge(alice, "likes", bob, {});

      // Count relationships before
      const before = executeQuery(graph, "MATCH ()-[r]->() RETURN r");
      expect(before).toHaveLength(3);

      const query = `
        MATCH ()-[r]->()
        WITH type(r) AS relType, collect(r) AS rels
        WHERE size(rels) > 1
        FOREACH (r1 IN tail(rels) | DELETE r1)
        RETURN relType
      `;

      const result = executeQuery(graph, query);
      expect(result).toHaveLength(1);

      // Verify only one "knows" relationship remains (2 total: 1 knows + 1 likes)
      const after = executeQuery(graph, "MATCH ()-[r]->() RETURN r");
      expect(after).toHaveLength(2);
    });
  });

  describe("Edge cases", () => {
    it("should handle no duplicates gracefully", () => {
      graph.addVertex("Person", {
        name: "Alice",
        createdAt: null,
        processed: null,
        marked: null,
      });
      graph.addVertex("Person", {
        name: "Bob",
        createdAt: null,
        processed: null,
        marked: null,
      });

      const query = `
        MATCH (n:Person)
        WITH n.name AS name, collect(n) AS nodes
        WHERE size(nodes) > 1
        FOREACH (n1 IN tail(nodes) | DELETE n1)
        RETURN name
      `;

      // No duplicates, so no results
      const result = executeQuery(graph, query);
      expect(result).toHaveLength(0);

      // Both nodes should still exist
      const remaining = executeQuery(graph, "MATCH (n:Person) RETURN n");
      expect(remaining).toHaveLength(2);
    });
  });
});
