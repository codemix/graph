import { describe, it, expect, beforeEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, CallStep } from "../Steps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import {
  ProcedureRegistry,
  procedureRegistry,
  isBuiltinProcedure,
} from "../ProcedureRegistry.js";
import type { Query } from "../AST.js";
import type { GraphSchema } from "../GraphSchema.js";

// Test schema for the graph
const testSchema = {
  vertices: {
    Person: { properties: {} },
    Company: { properties: {} },
  },
  edges: {
    knows: { properties: {} },
    worksAt: { properties: {} },
  },
} as const satisfies GraphSchema;

type TestSchema = typeof testSchema;

describe("CALL procedure support", () => {
  describe("grammar parsing", () => {
    it("should parse simple CALL without arguments", () => {
      const ast = parse("CALL db.labels()") as Query;
      expect(ast.type).toBe("Query");
      expect(ast.call).toHaveLength(1);

      const callClause = ast.call![0]!;
      expect(callClause.type).toBe("CallClause");
      expect(callClause.procedure).toBe("db.labels");
      expect(callClause.arguments).toHaveLength(0);
      expect(callClause.yield).toBeUndefined();
    });

    it("should parse CALL with YIELD", () => {
      const ast = parse("CALL db.labels() YIELD label") as Query;
      expect(ast.call).toHaveLength(1);

      const callClause = ast.call![0]!;
      expect(callClause.procedure).toBe("db.labels");
      expect(callClause.yield).toHaveLength(1);
      expect(callClause.yield![0]!.name).toBe("label");
      expect(callClause.yield![0]!.alias).toBeUndefined();
    });

    it("should parse CALL with YIELD and alias", () => {
      const ast = parse("CALL db.labels() YIELD label AS l") as Query;
      expect(ast.call).toHaveLength(1);

      const callClause = ast.call![0]!;
      expect(callClause.yield).toHaveLength(1);
      expect(callClause.yield![0]!.name).toBe("label");
      expect(callClause.yield![0]!.alias).toBe("l");
    });

    it("should parse CALL with multiple YIELD items", () => {
      const ast = parse(
        "CALL db.schema.nodeTypeProperties() YIELD nodeType, propertyName AS prop",
      ) as Query;
      expect(ast.call).toHaveLength(1);

      const callClause = ast.call![0]!;
      expect(callClause.yield).toHaveLength(2);
      expect(callClause.yield![0]!.name).toBe("nodeType");
      expect(callClause.yield![0]!.alias).toBeUndefined();
      expect(callClause.yield![1]!.name).toBe("propertyName");
      expect(callClause.yield![1]!.alias).toBe("prop");
    });

    it("should parse CALL with arguments", () => {
      const ast = parse("CALL myproc(1, 'test', true)") as Query;
      expect(ast.call).toHaveLength(1);

      const callClause = ast.call![0]!;
      expect(callClause.procedure).toBe("myproc");
      expect(callClause.arguments).toHaveLength(3);
    });

    it("should parse CALL with expression arguments", () => {
      const ast = parse("CALL myproc(1 + 2, 3 * 4)") as Query;
      expect(ast.call).toHaveLength(1);

      const callClause = ast.call![0]!;
      expect(callClause.arguments).toHaveLength(2);
      // First argument is an arithmetic expression
      const firstArg = callClause.arguments[0];
      expect(
        typeof firstArg === "object" && firstArg !== null && "type" in firstArg,
      ).toBe(true);
    });

    it("should parse CALL in combination with MATCH", () => {
      const ast = parse(
        "MATCH (n:Person) CALL db.labels() YIELD label RETURN n, label",
      ) as Query;
      expect(ast.matches).toHaveLength(1);
      expect(ast.call).toHaveLength(1);
      expect(ast.return).toBeDefined();
    });

    it("should parse qualified procedure names with multiple dots", () => {
      const ast = parse("CALL db.schema.nodeTypeProperties()") as Query;
      expect(ast.call![0]!.procedure).toBe("db.schema.nodeTypeProperties");
    });

    it("should be case-insensitive for CALL and YIELD keywords", () => {
      const ast = parse("call DB.LABELS() yield LABEL") as Query;
      expect(ast.call).toHaveLength(1);
      expect(ast.call![0]!.procedure).toBe("DB.LABELS");
      expect(ast.call![0]!.yield![0]!.name).toBe("LABEL");
    });
  });

  describe("step conversion", () => {
    it("should convert CallClause to CallStep", () => {
      const ast = parse("CALL db.labels() YIELD label") as Query;
      const steps = astToSteps(ast);

      // Find the CallStep
      const callStep = steps.find((s) => s.name === "Call") as CallStep;
      expect(callStep).toBeDefined();
      expect(callStep.config.procedureName).toBe("db.labels");
      expect(callStep.config.arguments).toHaveLength(0);
      expect(callStep.config.yieldItems).toHaveLength(1);
      expect(callStep.config.yieldItems![0]!.name).toBe("label");
    });

    it("should convert CALL with arguments", () => {
      const ast = parse("CALL myproc(42, 'hello') YIELD result") as Query;
      const steps = astToSteps(ast);

      const callStep = steps.find((s) => s.name === "Call") as CallStep;
      expect(callStep).toBeDefined();
      expect(callStep.config.procedureName).toBe("myproc");
      expect(callStep.config.arguments).toHaveLength(2);
    });

    it("should add StartStep when CALL is standalone", () => {
      const ast = parse("CALL db.labels() YIELD label") as Query;
      const steps = astToSteps(ast);

      // Standalone CALL needs a StartStep to provide initial path
      const startStep = steps.find((s) => s.name === "Start");
      expect(startStep).toBeDefined();
    });
  });

  describe("ProcedureRegistry", () => {
    it("should register and lookup procedures case-insensitively", () => {
      expect(procedureRegistry.has("db.labels")).toBe(true);
      expect(procedureRegistry.has("DB.LABELS")).toBe(true);
      expect(procedureRegistry.has("Db.Labels")).toBe(true);
    });

    it("should have db.labels procedure", () => {
      const def = procedureRegistry.get("db.labels");
      expect(def).toBeDefined();
      expect(def!.name).toBe("db.labels");
      expect(def!.yields).toContainEqual({
        name: "label",
        description: "A node label",
      });
    });

    it("should have db.relationshipTypes procedure", () => {
      const def = procedureRegistry.get("db.relationshipTypes");
      expect(def).toBeDefined();
      expect(def!.yields).toContainEqual({
        name: "relationshipType",
        description: "A relationship type",
      });
    });

    it("should have db.propertyKeys procedure", () => {
      const def = procedureRegistry.get("db.propertyKeys");
      expect(def).toBeDefined();
      expect(def!.yields).toContainEqual({
        name: "propertyKey",
        description: "A property key",
      });
    });

    it("should have dbms.procedures procedure", () => {
      const def = procedureRegistry.get("dbms.procedures");
      expect(def).toBeDefined();
      expect(def!.yields.map((y) => y.name)).toContain("name");
      expect(def!.yields.map((y) => y.name)).toContain("description");
    });

    it("should list all procedure names", () => {
      const names = procedureRegistry.procedureNames();
      expect(names).toContain("db.labels");
      expect(names).toContain("db.relationshipTypes");
      expect(names).toContain("db.propertyKeys");
      expect(names).toContain("dbms.procedures");
    });

    it("should validate argument count", () => {
      expect(() => {
        // db.labels takes no arguments
        Array.from(procedureRegistry.invoke("db.labels", ["extra"], {}));
      }).toThrow(/accepts at most 0 argument/);
    });

    it("should report unknown procedures", () => {
      expect(() => {
        Array.from(procedureRegistry.invoke("unknown.proc", [], {}));
      }).toThrow(/Unknown procedure/);
    });

    describe("isBuiltinProcedure helper", () => {
      it("should return true for known procedures", () => {
        expect(isBuiltinProcedure("db.labels")).toBe(true);
        expect(isBuiltinProcedure("DB.LABELS")).toBe(true);
      });

      it("should return false for unknown procedures", () => {
        expect(isBuiltinProcedure("unknown.proc")).toBe(false);
      });
    });
  });

  describe("query execution", () => {
    let graph: Graph<TestSchema>;

    beforeEach(() => {
      const storage = new InMemoryGraphStorage();
      graph = new Graph({
        schema: testSchema,
        storage,
        validateProperties: false,
      });

      // Create test data
      const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
      const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
      const charlie = graph.addVertex("Company", {
        name: "TechCorp",
        employees: 100,
      });

      graph.addEdge(alice, "knows", bob, { since: 2020 });
      graph.addEdge(alice, "worksAt", charlie, { role: "Engineer" });
    });

    describe("db.labels", () => {
      it("should return all node labels", () => {
        const ast = parse("CALL db.labels() YIELD label RETURN label") as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = Array.from(traverser.traverse(graph, []));

        // Should have Person and Company labels
        const labels = results.map((r) => (Array.isArray(r) ? r[0] : r));
        expect(labels).toContain("Person");
        expect(labels).toContain("Company");
      });
    });

    describe("db.relationshipTypes", () => {
      it("should return all relationship types", () => {
        const ast = parse(
          "CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = Array.from(traverser.traverse(graph, []));

        const types = results.map((r) => (Array.isArray(r) ? r[0] : r));
        expect(types).toContain("knows");
        expect(types).toContain("worksAt");
      });
    });

    describe("db.propertyKeys", () => {
      it("should return all property keys", () => {
        const ast = parse(
          "CALL db.propertyKeys() YIELD propertyKey RETURN propertyKey",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = Array.from(traverser.traverse(graph, []));

        const keys = results.map((r) => (Array.isArray(r) ? r[0] : r));
        expect(keys).toContain("name");
        expect(keys).toContain("age");
        expect(keys).toContain("employees");
        expect(keys).toContain("since");
        expect(keys).toContain("role");
      });
    });

    describe("dbms.procedures", () => {
      it("should return available procedures", () => {
        const ast = parse(
          "CALL dbms.procedures() YIELD name, description RETURN name, description",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = Array.from(traverser.traverse(graph, []));

        expect(results.length).toBeGreaterThan(0);
        // Results are [name, description] pairs
        const names = results.map((r) => (Array.isArray(r) ? r[0] : r));
        expect(names).toContain("db.labels");
      });
    });

    describe("standalone CALL without RETURN", () => {
      it("should execute without YIELD or RETURN", () => {
        const ast = parse("CALL db.labels()") as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);

        // Should not throw - procedure executes but no results returned (like Cypher)
        const results = Array.from(traverser.traverse(graph, []));
        // Without RETURN clause, no results are yielded (DrainStep consumes them)
        expect(results.length).toBe(0);
      });
    });

    describe("CALL with YIELD alias", () => {
      it("should bind results to aliases", () => {
        const ast = parse(
          "CALL db.labels() YIELD label AS nodeLabel RETURN nodeLabel",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = Array.from(traverser.traverse(graph, []));

        // Should have results bound to the alias
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe("CALL with MATCH", () => {
      it("should work after MATCH clause", () => {
        const ast = parse(
          "MATCH (n:Person) CALL db.labels() YIELD label RETURN n.name, label",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = Array.from(traverser.traverse(graph, []));

        // Each person matched should have labels yielded for each
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe("db.schema.nodeTypeProperties", () => {
      it("should return node type properties", () => {
        const ast = parse(
          "CALL db.schema.nodeTypeProperties() YIELD nodeType, propertyName RETURN nodeType, propertyName",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = Array.from(traverser.traverse(graph, []));

        // Should have property info for Person and Company
        expect(results.length).toBeGreaterThan(0);
        const nodeTypes = results.map((r) =>
          Array.isArray(r) ? r[0] : undefined,
        );
        expect(nodeTypes).toContain("Person");
        expect(nodeTypes).toContain("Company");
      });
    });

    describe("db.schema.relTypeProperties", () => {
      it("should return relationship type properties", () => {
        const ast = parse(
          "CALL db.schema.relTypeProperties() YIELD relType, propertyName RETURN relType, propertyName",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = Array.from(traverser.traverse(graph, []));

        // Should have property info for knows and worksAt
        expect(results.length).toBeGreaterThan(0);
        const relTypes = results.map((r) =>
          Array.isArray(r) ? r[0] : undefined,
        );
        expect(relTypes).toContain("knows");
        expect(relTypes).toContain("worksAt");
      });
    });
  });

  describe("custom procedure registration", () => {
    it("should allow registering custom procedures", () => {
      const customRegistry = new ProcedureRegistry();

      customRegistry.register({
        name: "custom.echo",
        description: "Echoes the input",
        params: [{ name: "input", required: true, types: ["any"] }],
        yields: [{ name: "output" }],
        impl: function* (args) {
          yield { output: args[0] };
        },
      });

      expect(customRegistry.has("custom.echo")).toBe(true);

      const results = Array.from(
        customRegistry.invoke("custom.echo", ["hello"], {}),
      );
      expect(results).toEqual([{ output: "hello" }]);
    });

    it("should support procedures that yield multiple rows", () => {
      const customRegistry = new ProcedureRegistry();

      customRegistry.register({
        name: "custom.range",
        description: "Yields numbers in a range",
        params: [
          { name: "start", required: true, types: ["number"] },
          { name: "end", required: true, types: ["number"] },
        ],
        yields: [{ name: "value" }],
        impl: function* (args) {
          const start = args[0] as number;
          const end = args[1] as number;
          for (let i = start; i <= end; i++) {
            yield { value: i };
          }
        },
      });

      const results = Array.from(
        customRegistry.invoke("custom.range", [1, 5], {}),
      );
      expect(results).toEqual([
        { value: 1 },
        { value: 2 },
        { value: 3 },
        { value: 4 },
        { value: 5 },
      ]);
    });
  });
});
