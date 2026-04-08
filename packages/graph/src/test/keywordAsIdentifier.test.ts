import { describe, it, expect } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph } from "../Graph.js";
import { GraphSchema } from "../GraphSchema.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import type { Query } from "../AST.js";

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

function createTestGraph(): Graph<GraphSchema> {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          temp: { type: makeType<string | undefined>(undefined) },
        },
      },
      Item: {
        properties: {
          value: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      KNOWS: {
        properties: {},
      },
    },
  } as const satisfies GraphSchema;

  return new Graph({ schema, storage: new InMemoryGraphStorage() });
}

function executeQuery(
  graph: Graph<GraphSchema>,
  queryString: string,
): unknown[] {
  const ast = parse(queryString) as Query;
  const steps = astToSteps(ast);
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

describe("Keywords as identifiers", () => {
  describe("parsing", () => {
    it("should parse keyword as alias in RETURN", () => {
      const ast = parse("MATCH (n) RETURN labels(n) AS labels") as Query;
      expect(ast.return!.items[0]!.alias).toBe("labels");
    });

    it("should parse keyword as alias in RETURN with multiple items", () => {
      const ast = parse(
        "MATCH (n) RETURN labels(n) AS labels, count(n) AS count",
      ) as Query;
      expect(ast.return!.items[0]!.alias).toBe("labels");
      expect(ast.return!.items[1]!.alias).toBe("count");
    });

    it("should parse keyword as alias in WITH", () => {
      const ast = parse(
        "MATCH (n) WITH n.name AS labels RETURN labels",
      ) as Query;
      expect(ast.with![0]!.items[0]!.alias).toBe("labels");
    });

    it("should parse keyword as variable reference after WITH", () => {
      const ast = parse("MATCH (n) WITH n AS type RETURN type") as Query;
      expect(ast.return!.items[0]!.variable).toBe("type");
    });

    it("should parse keyword as property access base", () => {
      const ast = parse(
        "MATCH (n) WITH n AS labels RETURN labels.name",
      ) as Query;
      // ReturnItem normalizes PropertyAccess to variable + property
      expect(ast.return!.items[0]!.variable).toBe("labels");
      expect(ast.return!.items[0]!.property).toBe("name");
    });

    it("should parse keyword in ORDER BY", () => {
      const ast = parse(
        "MATCH (n) WITH n.name AS labels RETURN labels ORDER BY labels",
      ) as Query;
      expect(ast.orderBy!.orders[0]!.alias).toBe("labels");
    });

    it("should parse keyword in WHERE condition", () => {
      const ast = parse(
        'MATCH (n) WITH n AS labels WHERE labels.name = "test" RETURN labels',
      ) as Query;
      expect(
        (ast.with![0]!.where!.condition as { variable: string }).variable,
      ).toBe("labels");
    });

    it("should parse keyword in aggregate function argument", () => {
      const ast = parse("MATCH (n) WITH n AS type RETURN count(type)") as Query;
      // count(type) becomes ReturnItem with aggregate: 'COUNT' and variable: 'type'
      expect(ast.return!.items[0]!.aggregate).toBe("COUNT");
      expect(ast.return!.items[0]!.variable).toBe("type");
    });

    it("should parse chained WITH with keyword aliases", () => {
      const ast = parse(
        "MATCH (n) WITH n AS labels WITH labels AS type RETURN type",
      ) as Query;
      expect(ast.with![0]!.items[0]!.alias).toBe("labels");
      expect(ast.with![1]!.items[0]!.alias).toBe("type");
    });

    it("should parse keyword as UNWIND alias", () => {
      const ast = parse("UNWIND [1, 2, 3] AS count RETURN count") as Query;
      expect(ast.unwind![0]!.alias).toBe("count");
    });

    it("should parse keyword variable in SET", () => {
      const ast = parse(
        'MATCH (n) WITH n AS labels SET labels.name = "test" RETURN labels',
      ) as Query;
      expect(ast.set!.assignments[0]!.variable).toBe("labels");
    });

    it("should parse keyword variable in DELETE", () => {
      const ast = parse("MATCH (n) WITH n AS labels DELETE labels") as Query;
      expect(ast.delete?.variables).toContain("labels");
    });

    it("should parse keyword variable in REMOVE", () => {
      const ast = parse(
        "MATCH (n) WITH n AS labels REMOVE labels.prop",
      ) as Query;
      expect(ast.remove!.items[0]!.variable).toBe("labels");
    });

    it("should parse keyword variable in IS NULL condition", () => {
      const ast = parse(
        "MATCH (n) WITH n AS labels WHERE labels.name IS NULL RETURN labels",
      ) as Query;
      expect(
        (ast.with![0]!.where!.condition as { variable: string }).variable,
      ).toBe("labels");
    });

    it("should parse keyword variable in STARTS WITH condition", () => {
      const ast = parse(
        'MATCH (n) WITH n AS labels WHERE labels.name STARTS WITH "A" RETURN labels',
      ) as Query;
      expect(
        (ast.with![0]!.where!.condition as { variable: string }).variable,
      ).toBe("labels");
    });

    it("should parse keyword variable in IN condition", () => {
      const ast = parse(
        "MATCH (n) WITH n AS labels WHERE labels.name IN ['a', 'b'] RETURN labels",
      ) as Query;
      expect(
        (ast.with![0]!.where!.condition as { variable: string }).variable,
      ).toBe("labels");
    });

    it("should parse keyword variable in regex condition", () => {
      const ast = parse(
        'MATCH (n) WITH n AS labels WHERE labels.name =~ ".*" RETURN labels',
      ) as Query;
      expect(
        (ast.with![0]!.where!.condition as { variable: string }).variable,
      ).toBe("labels");
    });

    it("should parse keyword variable in EXISTS condition", () => {
      const ast = parse(
        "MATCH (n) WITH n AS labels WHERE labels.name EXISTS RETURN labels",
      ) as Query;
      expect(
        (ast.with![0]!.where!.condition as { variable: string }).variable,
      ).toBe("labels");
    });

    it("should parse keyword variable in map projection", () => {
      const ast = parse(
        "MATCH (n) WITH n AS labels RETURN labels{.name}",
      ) as Query;
      expect(
        (ast.return!.items[0]!.expression as { variable: string }).variable,
      ).toBe("labels");
    });

    it("should parse keyword variable in GROUP BY", () => {
      const ast = parse(
        "MATCH (n) WITH n AS type RETURN type, count(*) GROUP BY type",
      ) as Query;
      expect(ast.groupBy!.items[0]!.variable).toBe("type");
    });

    it("should parse multiple different keyword aliases", () => {
      const ast = parse(`
        MATCH (n)
        WITH n.a AS labels, n.b AS type, n.c AS count, n.d AS match
        RETURN labels, type, count, match
      `) as Query;
      expect(
        ast.with![0]!.items.map((i: { alias: string }) => i.alias),
      ).toEqual(["labels", "type", "count", "match"]);
    });
  });

  describe("execution", () => {
    it("should execute query with keyword variable reference", () => {
      const graph = createTestGraph();
      graph.addVertex("Person", { name: "Alice", age: 30 });

      const results = executeQuery(
        graph,
        "MATCH (n:Person) WITH n.name AS labels RETURN labels",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toContain("Alice");
    });

    it("should execute query with keyword in property access", () => {
      const graph = createTestGraph();
      graph.addVertex("Person", { name: "Alice", age: 30 });

      const results = executeQuery(
        graph,
        "MATCH (n:Person) WITH n AS type RETURN type.name",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toContain("Alice");
    });

    it("should execute query with keyword in WHERE clause", () => {
      const graph = createTestGraph();
      graph.addVertex("Person", { name: "Alice", age: 30 });
      graph.addVertex("Person", { name: "Bob", age: 25 });

      const results = executeQuery(
        graph,
        'MATCH (n:Person) WITH n AS labels WHERE labels.name = "Alice" RETURN labels.name',
      );
      expect(results).toHaveLength(1);
    });

    it("should execute query with keyword in ORDER BY", () => {
      const graph = createTestGraph();
      graph.addVertex("Person", { name: "Charlie", age: 20 });
      graph.addVertex("Person", { name: "Alice", age: 30 });
      graph.addVertex("Person", { name: "Bob", age: 25 });

      const results = executeQuery(
        graph,
        "MATCH (n:Person) WITH n.name AS type RETURN type ORDER BY type",
      );
      expect(results).toHaveLength(3);
    });

    it("should execute query with chained keyword aliases", () => {
      const graph = createTestGraph();
      graph.addVertex("Person", { name: "Alice", age: 30 });

      const results = executeQuery(
        graph,
        "MATCH (n:Person) WITH n.name AS labels WITH labels AS type RETURN type",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toContain("Alice");
    });

    it("should execute query with keyword in aggregate", () => {
      const graph = createTestGraph();
      graph.addVertex("Item", { value: 10 });
      graph.addVertex("Item", { value: 20 });
      graph.addVertex("Item", { value: 30 });

      // Verify query parses and executes without error
      const results = executeQuery(
        graph,
        "MATCH (n:Item) WITH n AS count RETURN sum(count.value) AS total",
      );
      expect(results).toHaveLength(1);
    });

    it("should execute query with keyword in UNWIND", () => {
      const graph = createTestGraph();

      const results = executeQuery(graph, "UNWIND [1, 2, 3] AS sum RETURN sum");
      expect(results).toHaveLength(3);
    });

    it("should execute query with keyword in map projection", () => {
      const graph = createTestGraph();
      graph.addVertex("Person", { name: "Alice", age: 30 });

      const results = executeQuery(
        graph,
        "MATCH (n:Person) WITH n AS labels RETURN labels{.name, .age}",
      );
      expect(results).toHaveLength(1);
    });

    it("should execute SET with keyword variable", () => {
      const graph = createTestGraph();
      graph.addVertex("Person", { name: "Alice", age: 30 });

      // Execute SET with keyword variable
      executeQuery(
        graph,
        'MATCH (n:Person) WITH n AS labels SET labels.name = "Updated"',
      );

      // Verify the update worked
      const results = executeQuery(graph, "MATCH (n:Person) RETURN n.name");
      expect(results).toHaveLength(1);
      expect(results[0]).toContain("Updated");
    });

    it("should execute REMOVE with keyword variable", () => {
      const graph = createTestGraph();
      graph.addVertex("Person", { name: "Alice", age: 30, temp: "value" });

      // Execute REMOVE with keyword variable
      executeQuery(graph, "MATCH (n:Person) WITH n AS type REMOVE type.temp");

      // Verify the property was removed - the result should not contain 'value'
      const results = executeQuery(graph, "MATCH (n:Person) RETURN n.temp");
      expect(results).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("should still parse regular identifiers", () => {
      const ast = parse("MATCH (n) RETURN n.name AS myAlias") as Query;
      expect(ast.return!.items[0]!.alias).toBe("myAlias");
    });

    it("should still allow backtick-quoted keywords", () => {
      const ast = parse(
        "MATCH (n) WITH n AS `labels` RETURN `labels`",
      ) as Query;
      expect(ast.with![0]!.items[0]!.alias).toBe("labels");
    });

    it("should not affect node pattern variable binding", () => {
      // Node pattern variables should still not allow keywords
      // (this ensures we didn't break the restriction on bindings)
      expect(() => parse("MATCH (labels:Person) RETURN labels")).toThrow();
    });

    it("should not affect edge pattern variable binding", () => {
      // Edge pattern variables should still not allow keywords
      expect(() => parse("MATCH (a)-[type:KNOWS]->(b) RETURN type")).toThrow();
    });

    it("should work with keyword that is also a function name", () => {
      // 'count' is both a keyword/function and can be used as alias
      const graph = createTestGraph();
      graph.addVertex("Item", { value: 1 });
      graph.addVertex("Item", { value: 2 });

      const results = executeQuery(
        graph,
        "MATCH (n:Item) WITH count(n) AS count RETURN count",
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toContain(2);
    });

    it("should distinguish between function call and variable reference", () => {
      const graph = createTestGraph();
      graph.addVertex("Person", { name: "Alice", age: 30 });

      // labels(n) is a function call, labels alone is a variable reference
      const results = executeQuery(
        graph,
        `
        MATCH (n:Person)
        WITH labels(n) AS labels
        RETURN labels
      `,
      );
      expect(results).toHaveLength(1);
    });
  });
});
