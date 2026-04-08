import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import {
  createTraverser as makeTraverser,
  clearQueryParams,
} from "../Steps.js";
import { createDemoGraph, type DemoSchema } from "../getDemoGraph.js";
import type { Query, SetAssignment } from "../AST.js";
import type { Graph } from "../Graph.js";

describe("SET property to JSON object values", () => {
  describe("Grammar parsing", () => {
    describe("Simple JSON object values", () => {
      it("should parse SET n.prop = {key: value}", () => {
        const ast = parse(
          'MATCH (n:Person) SET n.schema = {type: "string"} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        expect(ast.set!.assignments).toHaveLength(1);

        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.variable).toBe("n");
        expect(assignment.property).toBe("schema");
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: { type: "string" },
        });
      });

      it("should parse SET with multiple properties in JSON object", () => {
        const ast = parse(
          'MATCH (n:DataType) SET n.schema = {type: "string", format: "email"} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: { type: "string", format: "email" },
        });
      });

      it("should parse SET with empty JSON object", () => {
        const ast = parse(
          "MATCH (n:Config) SET n.options = {} RETURN n",
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: {},
        });
      });

      it("should parse SET with numeric values in JSON object", () => {
        const ast = parse(
          'MATCH (n:DataType) SET n.schema = {type: "string", minLength: 16, maxLength: 100} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: { type: "string", minLength: 16, maxLength: 100 },
        });
      });

      it("should parse SET with boolean values in JSON object", () => {
        const ast = parse(
          "MATCH (n:Config) SET n.flags = {enabled: true, debug: false} RETURN n",
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: { enabled: true, debug: false },
        });
      });

      it("should parse SET with null values in JSON object", () => {
        const ast = parse(
          'MATCH (n:Config) SET n.options = {default: null, fallback: "none"} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: { default: null, fallback: "none" },
        });
      });
    });

    describe("Nested JSON objects", () => {
      it("should parse SET with nested JSON object", () => {
        const ast = parse(
          "MATCH (n:Schema) SET n.config = {validation: {required: true, min: 0}} RETURN n",
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: {
            validation: {
              type: "NestedMap",
              value: { required: true, min: 0 },
            },
          },
        });
      });

      it("should parse SET with deeply nested JSON objects", () => {
        const ast = parse(
          'MATCH (n:Schema) SET n.config = {level1: {level2: {level3: "deep"}}} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: {
            level1: {
              type: "NestedMap",
              value: {
                level2: {
                  type: "NestedMap",
                  value: { level3: "deep" },
                },
              },
            },
          },
        });
      });

      it("should parse SET with arrays within JSON objects", () => {
        const ast = parse(
          'MATCH (n:Schema) SET n.definition = {type: "object", required: ["id", "name"], tags: ["a", "b"]} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: {
            type: "object",
            required: {
              type: "ListLiteral",
              values: ["id", "name"],
            },
            tags: {
              type: "ListLiteral",
              values: ["a", "b"],
            },
          },
        });
      });
    });

    describe("JSON objects with special keys", () => {
      it("should parse SET with backtick-quoted keys for special characters", () => {
        const ast = parse(
          'MATCH (n:Config) SET n.data = {`special-key`: "value", `another.key`: 123} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: { "special-key": "value", "another.key": 123 },
        });
      });

      it("should parse SET with keyword-like keys (type, format, etc)", () => {
        const ast = parse(
          'MATCH (n:DataType) SET n.schema = {type: "object", format: "uri", pattern: "^urn:"} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: { type: "object", format: "uri", pattern: "^urn:" },
        });
      });

      it("should parse SET with double-quoted string keys (JSON-style)", () => {
        const ast = parse(
          'MATCH (n:DataType) SET n.schema = {"type": "string", "format": "email"} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: { type: "string", format: "email" },
        });
      });

      it("should parse SET with mixed quoted and unquoted keys", () => {
        const ast = parse(
          'MATCH (n:DataType) SET n.schema = {"type": "string", format: "uri", "enum": ["a", "b"]} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: {
            type: "string",
            format: "uri",
            enum: {
              type: "ListLiteral",
              values: ["a", "b"],
            },
          },
        });
      });

      it("should parse SET with nested objects using quoted keys", () => {
        const ast = parse(
          'MATCH (n:Schema) SET n.definition = {"type": "object", "properties": {"name": {"type": "string"}}} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAssignment;
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: {
            type: "object",
            properties: {
              type: "NestedMap",
              value: {
                name: {
                  type: "NestedMap",
                  value: { type: "string" },
                },
              },
            },
          },
        });
      });
    });

    describe("Multiple SET assignments with JSON objects", () => {
      it("should parse multiple SET assignments including JSON objects", () => {
        const ast = parse(
          'MATCH (n:DataType) SET n.description = "A text value", n.schema = {type: "string"} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        expect(ast.set!.assignments).toHaveLength(2);

        // First assignment is a string
        expect(ast.set!.assignments[0]).toEqual({
          variable: "n",
          property: "description",
          value: "A text value",
        });

        // Second assignment is a JSON object
        expect(ast.set!.assignments[1]).toEqual({
          variable: "n",
          property: "schema",
          value: {
            type: "NestedMap",
            value: { type: "string" },
          },
        });
      });

      it("should parse multiple JSON object assignments", () => {
        const ast = parse(
          'MATCH (n:DataType) SET n.schema = {type: "string"}, n.validation = {required: true} RETURN n',
        ) as Query;

        expect(ast.set).toBeDefined();
        expect(ast.set!.assignments).toHaveLength(2);

        expect((ast.set!.assignments[0] as SetAssignment).value).toEqual({
          type: "NestedMap",
          value: { type: "string" },
        });

        expect((ast.set!.assignments[1] as SetAssignment).value).toEqual({
          type: "NestedMap",
          value: { required: true },
        });
      });
    });

    describe("JSON objects in MERGE with SET", () => {
      it("should parse MERGE with SET using JSON object", () => {
        const ast = parse(
          'MERGE (dt:DataType {name: "String"}) SET dt.schema = {type: "string"} RETURN dt',
        ) as Query;

        expect(ast.segments![0]!.set).toBeDefined();
        const assignment = ast.segments![0]!.set!
          .assignments[0] as SetAssignment;
        expect(assignment.variable).toBe("dt");
        expect(assignment.property).toBe("schema");
        expect(assignment.value).toEqual({
          type: "NestedMap",
          value: { type: "string" },
        });
      });

      it("should parse MERGE ON CREATE SET with JSON object", () => {
        const ast = parse(
          'MERGE (dt:DataType {name: "Email"}) ON CREATE SET dt.schema = {type: "string", format: "email"} RETURN dt',
        ) as Query;

        const merge = ast.segments![0]!.mutations![0] as any;
        expect(merge.type).toBe("MergeClause");
        expect(merge.onCreate).toBeDefined();
        expect(merge.onCreate.assignments[0].value).toEqual({
          type: "NestedMap",
          value: { type: "string", format: "email" },
        });
      });

      it("should parse MERGE ON MATCH SET with JSON object", () => {
        const ast = parse(
          'MERGE (dt:DataType {name: "URL"}) ON MATCH SET dt.schema = {type: "string", format: "uri"} RETURN dt',
        ) as Query;

        const merge = ast.segments![0]!.mutations![0] as any;
        expect(merge.type).toBe("MergeClause");
        expect(merge.onMatch).toBeDefined();
        expect(merge.onMatch.assignments[0].value).toEqual({
          type: "NestedMap",
          value: { type: "string", format: "uri" },
        });
      });
    });

    describe("JSON objects in CREATE", () => {
      it("should parse CREATE with inline JSON object property", () => {
        const ast = parse(
          'CREATE (dt:DataType {name: "Token", schema: {type: "string", minLength: 16}}) RETURN dt',
        ) as Query;

        const create = ast.segments![0]!.mutations![0] as any;
        expect(create.type).toBe("CreateClause");
        expect(create.patterns[0].properties).toEqual({
          name: "Token",
          schema: {
            type: "NestedMap",
            value: { type: "string", minLength: 16 },
          },
        });
      });
    });

    describe("JSON-Schema-like patterns (original issue)", () => {
      it("should parse the original failing query pattern", () => {
        const query = `
          MERGE (dt1:DataType {name: "String"})
          SET dt1.description = "A text string value.", dt1.schema = {type: "string"}
          RETURN dt1
        `;
        const ast = parse(query) as Query;

        expect(ast.segments![0]!.set).toBeDefined();
        const assignments = ast.segments![0]!.set!.assignments;
        expect(assignments).toHaveLength(2);
        expect((assignments[1] as SetAssignment).value).toEqual({
          type: "NestedMap",
          value: { type: "string" },
        });
      });

      it("should parse multiple MERGE statements with JSON schemas", () => {
        const query = `
          MERGE (dt1:DataType {name: "String"})
          SET dt1.schema = {type: "string"}
          WITH dt1
          MERGE (dt2:DataType {name: "Email"})
          SET dt2.schema = {type: "string", format: "email"}
          RETURN dt1, dt2
        `;
        const ast = parse(query) as Query;

        expect(ast.segments).toHaveLength(2);
        expect(
          (ast.segments![0]!.set!.assignments[0] as SetAssignment).value,
        ).toEqual({
          type: "NestedMap",
          value: { type: "string" },
        });
        expect(
          (ast.segments![1]!.set!.assignments[0] as SetAssignment).value,
        ).toEqual({
          type: "NestedMap",
          value: { type: "string", format: "email" },
        });
      });

      it("should parse all JSON Schema types", () => {
        const types = [
          '{type: "string"}',
          '{type: "string", format: "email"}',
          '{type: "string", format: "uri"}',
          '{type: "string", format: "uuid"}',
          '{type: "string", format: "date-time"}',
          '{type: "boolean"}',
          '{type: "integer"}',
          '{type: "number"}',
          '{type: "object"}',
          '{type: "string", minLength: 16}',
          '{type: "string", pattern: "^[a-z0-9-]+$"}',
          '{type: "string", pattern: "^urn:"}',
        ];

        for (const schemaStr of types) {
          const query = `MATCH (n:DataType) SET n.schema = ${schemaStr} RETURN n`;
          const ast = parse(query) as Query;
          expect(ast.set).toBeDefined();
          const value = (ast.set!.assignments[0] as SetAssignment).value;
          expect(
            typeof value === "object" &&
              value !== null &&
              "type" in value &&
              value.type,
          ).toBe("NestedMap");
        }
      });
    });
  });

  describe("Step conversion", () => {
    it("should convert SET with JSON object to SetStep", () => {
      const ast = parse(
        'MATCH (n:DataType) SET n.schema = {type: "string"} RETURN n',
      ) as Query;
      const steps = astToSteps(ast);

      const setStep = steps.find((s) => s.name === "Set");
      expect(setStep).toBeDefined();

      const config = (setStep as any).config;
      expect(config.assignments).toHaveLength(1);
      expect(config.assignments[0].variable).toBe("n");
      expect(config.assignments[0].property).toBe("schema");
      // NestedMap is converted to a literal value
      expect(config.assignments[0].value).toEqual({
        type: "literal",
        value: { type: "string" },
      });
    });

    it("should convert SET with nested JSON objects", () => {
      const ast = parse(
        "MATCH (n:Config) SET n.settings = {validation: {strict: true}} RETURN n",
      ) as Query;
      const steps = astToSteps(ast);

      const setStep = steps.find((s) => s.name === "Set");
      const config = (setStep as any).config;
      // Nested maps are recursively converted to plain objects
      expect(config.assignments[0].value).toEqual({
        type: "literal",
        value: {
          validation: { strict: true },
        },
      });
    });
  });

  describe("Query execution", () => {
    let graph: Graph<DemoSchema>;

    beforeEach(() => {
      const demo = createDemoGraph();
      graph = demo.graph;
      clearQueryParams();
    });

    afterEach(() => {
      clearQueryParams();
    });

    describe("Setting JSON object properties", () => {
      it("should set a property to a simple JSON object", () => {
        // Create a node first
        const createAst = parse(
          'CREATE (dt:DataType {name: "String"}) RETURN dt',
        ) as Query;
        const createSteps = astToSteps(createAst);
        const createTraverser = makeTraverser(createSteps);
        const createResults = [...createTraverser.traverse(graph, [undefined])];
        expect(createResults).toHaveLength(1);

        // Set the schema property to a JSON object
        const setAst = parse(
          'MATCH (dt:DataType {name: "String"}) SET dt.schema = {type: "string"} RETURN dt',
        ) as Query;
        const setSteps = astToSteps(setAst);
        const setTraverser = makeTraverser(setSteps);
        const setResults = [...setTraverser.traverse(graph, [undefined])];
        expect(setResults).toHaveLength(1);

        // Verify the property was set correctly
        const verifyAst = parse(
          'MATCH (dt:DataType {name: "String"}) RETURN dt.schema',
        ) as Query;
        const verifySteps = astToSteps(verifyAst);
        const verifyTraverser = makeTraverser(verifySteps);
        const verifyResults = [...verifyTraverser.traverse(graph, [undefined])];

        expect(verifyResults).toHaveLength(1);
        expect(verifyResults[0]).toEqual({ type: "string" });
      });

      it("should set a property to a JSON object with multiple fields", () => {
        const createAst = parse(
          'CREATE (dt:DataType {name: "Email"}) RETURN dt',
        ) as Query;
        const createSteps = astToSteps(createAst);
        for (const _ of makeTraverser(createSteps).traverse(graph, [
          undefined,
        ]));

        const setAst = parse(
          'MATCH (dt:DataType {name: "Email"}) SET dt.schema = {type: "string", format: "email"} RETURN dt',
        ) as Query;
        const setSteps = astToSteps(setAst);
        for (const _ of makeTraverser(setSteps).traverse(graph, [undefined]));

        const verifyAst = parse(
          'MATCH (dt:DataType {name: "Email"}) RETURN dt.schema',
        ) as Query;
        const verifySteps = astToSteps(verifyAst);
        const verifyResults = [
          ...makeTraverser(verifySteps).traverse(graph, [undefined]),
        ];

        expect(verifyResults[0]).toEqual({ type: "string", format: "email" });
      });

      it("should set a property to a nested JSON object", () => {
        const createAst = parse(
          'CREATE (c:Config {name: "main"}) RETURN c',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(createAst)).traverse(graph, [undefined])];

        const setAst = parse(
          'MATCH (c:Config {name: "main"}) SET c.settings = {validation: {strict: true, level: 3}} RETURN c',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(setAst)).traverse(graph, [undefined])];

        const verifyAst = parse(
          'MATCH (c:Config {name: "main"}) RETURN c.settings',
        ) as Query;
        const verifyResults = [
          ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
        ];

        expect(verifyResults[0]).toEqual({
          validation: { strict: true, level: 3 },
        });
      });

      it("should set multiple properties including JSON objects", () => {
        const createAst = parse(
          'CREATE (dt:DataType {name: "Token"}) RETURN dt',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(createAst)).traverse(graph, [undefined])];

        const setAst = parse(
          'MATCH (dt:DataType {name: "Token"}) SET dt.description = "A secure token", dt.schema = {type: "string", minLength: 16} RETURN dt',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(setAst)).traverse(graph, [undefined])];

        const verifyAst = parse(
          'MATCH (dt:DataType {name: "Token"}) RETURN dt.description, dt.schema',
        ) as Query;
        const verifyResults = [
          ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
        ];

        expect(verifyResults[0]).toEqual([
          "A secure token",
          { type: "string", minLength: 16 },
        ]);
      });

      it("should preserve JSON object when updating other properties", () => {
        const createAst = parse(
          'CREATE (dt:DataType {name: "URL", schema: {type: "string", format: "uri"}}) RETURN dt',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(createAst)).traverse(graph, [undefined])];

        // Update description without touching schema
        const updateAst = parse(
          'MATCH (dt:DataType {name: "URL"}) SET dt.description = "A valid URL" RETURN dt',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(updateAst)).traverse(graph, [undefined])];

        // Verify schema is preserved
        const verifyAst = parse(
          'MATCH (dt:DataType {name: "URL"}) RETURN dt.description, dt.schema',
        ) as Query;
        const verifyResults = [
          ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
        ];

        expect(verifyResults[0]).toEqual([
          "A valid URL",
          { type: "string", format: "uri" },
        ]);
      });

      it("should update an existing JSON object property", () => {
        const createAst = parse(
          'CREATE (dt:DataType {name: "Number", schema: {type: "number"}}) RETURN dt',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(createAst)).traverse(graph, [undefined])];

        // Update schema
        const updateAst = parse(
          'MATCH (dt:DataType {name: "Number"}) SET dt.schema = {type: "integer", minimum: 0} RETURN dt',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(updateAst)).traverse(graph, [undefined])];

        const verifyAst = parse(
          'MATCH (dt:DataType {name: "Number"}) RETURN dt.schema',
        ) as Query;
        const verifyResults = [
          ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
        ];

        expect(verifyResults[0]).toEqual({ type: "integer", minimum: 0 });
      });
    });

    describe("MERGE with JSON object properties", () => {
      it("should create node with JSON object property via MERGE", () => {
        const mergeAst = parse(
          'MERGE (dt:DataType {name: "Boolean"}) SET dt.schema = {type: "boolean"} RETURN dt',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(mergeAst)).traverse(graph, [undefined])];

        const verifyAst = parse(
          'MATCH (dt:DataType {name: "Boolean"}) RETURN dt.schema',
        ) as Query;
        const verifyResults = [
          ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
        ];

        expect(verifyResults[0]).toEqual({ type: "boolean" });
      });

      it("should update existing node with JSON object via MERGE", () => {
        // First create
        const createAst = parse(
          'CREATE (dt:DataType {name: "Integer", schema: {type: "number"}}) RETURN dt',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(createAst)).traverse(graph, [undefined])];

        // MERGE should match and update
        const mergeAst = parse(
          'MERGE (dt:DataType {name: "Integer"}) SET dt.schema = {type: "integer"} RETURN dt',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(mergeAst)).traverse(graph, [undefined])];

        const verifyAst = parse(
          'MATCH (dt:DataType {name: "Integer"}) RETURN dt.schema',
        ) as Query;
        const verifyResults = [
          ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
        ];

        expect(verifyResults[0]).toEqual({ type: "integer" });
      });
    });

    describe("Querying JSON object properties", () => {
      it("should be able to access nested properties", () => {
        const createAst = parse(
          'CREATE (c:Config {name: "app", settings: {debug: true, level: 3}}) RETURN c',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(createAst)).traverse(graph, [undefined])];

        const queryAst = parse(
          "MATCH (c:Config) RETURN c.settings.debug, c.settings.level",
        ) as Query;
        const results = [
          ...makeTraverser(astToSteps(queryAst)).traverse(graph, [undefined]),
        ];

        expect(results[0]).toEqual([true, 3]);
      });

      it("should filter by JSON object property value", () => {
        // Create multiple configs
        const create1 = parse(
          'CREATE (c:Config {name: "dev", settings: {debug: true}}) RETURN c',
        ) as Query;
        const create2 = parse(
          'CREATE (c:Config {name: "prod", settings: {debug: false}}) RETURN c',
        ) as Query;

        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(create1)).traverse(graph, [undefined])];
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(create2)).traverse(graph, [undefined])];

        const queryAst = parse(
          "MATCH (c:Config) WHERE c.settings.debug = true RETURN c.name",
        ) as Query;
        const results = [
          ...makeTraverser(astToSteps(queryAst)).traverse(graph, [undefined]),
        ];

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual("dev");
      });
    });

    describe("Edge cases", () => {
      it("should handle setting property to empty object", () => {
        const createAst = parse(
          'CREATE (c:Config {name: "empty"}) RETURN c',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(createAst)).traverse(graph, [undefined])];

        const setAst = parse(
          'MATCH (c:Config {name: "empty"}) SET c.options = {} RETURN c',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(setAst)).traverse(graph, [undefined])];

        const verifyAst = parse(
          'MATCH (c:Config {name: "empty"}) RETURN c.options',
        ) as Query;
        const results = [
          ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
        ];

        expect(results[0]).toEqual({});
      });

      it("should handle JSON object with null value", () => {
        const createAst = parse(
          'CREATE (c:Config {name: "nullable"}) RETURN c',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(createAst)).traverse(graph, [undefined])];

        const setAst = parse(
          'MATCH (c:Config {name: "nullable"}) SET c.options = {default: null, value: 42} RETURN c',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(setAst)).traverse(graph, [undefined])];

        const verifyAst = parse(
          'MATCH (c:Config {name: "nullable"}) RETURN c.options',
        ) as Query;
        const results = [
          ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
        ];

        expect(results[0]).toEqual({ default: null, value: 42 });
      });

      it("should handle JSON object with mixed value types", () => {
        const createAst = parse(
          'CREATE (c:Config {name: "mixed"}) RETURN c',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(createAst)).traverse(graph, [undefined])];

        const setAst = parse(
          'MATCH (c:Config {name: "mixed"}) SET c.data = {str: "hello", num: 42, bool: true, nil: null} RETURN c',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(setAst)).traverse(graph, [undefined])];

        const verifyAst = parse(
          'MATCH (c:Config {name: "mixed"}) RETURN c.data',
        ) as Query;
        const results = [
          ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
        ];

        expect(results[0]).toEqual({
          str: "hello",
          num: 42,
          bool: true,
          nil: null,
        });
      });

      it("should handle arrays within JSON objects", () => {
        const createAst = parse(
          'CREATE (s:Schema {name: "Person"}) RETURN s',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(createAst)).traverse(graph, [undefined])];

        const setAst = parse(
          'MATCH (s:Schema {name: "Person"}) SET s.definition = {type: "object", required: ["id", "name"], tags: ["user", "entity"]} RETURN s',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(setAst)).traverse(graph, [undefined])];

        const verifyAst = parse(
          'MATCH (s:Schema) WHERE s.name = "Person" RETURN s.definition',
        ) as Query;
        const results = [
          ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
        ];

        expect(results[0]).toEqual({
          type: "object",
          required: ["id", "name"],
          tags: ["user", "entity"],
        });
      });

      it("should handle nested objects within arrays within objects", () => {
        const createAst = parse(
          'CREATE (s:Schema {name: "Complex"}) RETURN s',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(createAst)).traverse(graph, [undefined])];

        // JSON Schema-like pattern with nested structure
        const setAst = parse(
          'MATCH (s:Schema {name: "Complex"}) SET s.schema = {type: "array", items: {type: "object", required: ["id"]}} RETURN s',
        ) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(setAst)).traverse(graph, [undefined])];

        const verifyAst = parse(
          'MATCH (s:Schema) WHERE s.name = "Complex" RETURN s.schema',
        ) as Query;
        const results = [
          ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
        ];

        expect(results[0]).toEqual({
          type: "array",
          items: {
            type: "object",
            required: ["id"],
          },
        });
      });
    });
  });

  describe("Full DataType scenario (original use case)", () => {
    let graph: Graph<DemoSchema>;

    beforeEach(() => {
      const demo = createDemoGraph();
      graph = demo.graph;
      clearQueryParams();
    });

    afterEach(() => {
      clearQueryParams();
    });

    it("should create all primitive data types with JSON schemas", () => {
      // Create each data type with explicit Cypher queries using CREATE
      const queries = [
        'CREATE (d:DataType {name: "StringType"}) SET d.schema = {type: "string"} RETURN d',
        'CREATE (d:DataType {name: "EmailType"}) SET d.schema = {type: "string", format: "email"} RETURN d',
        'CREATE (d:DataType {name: "URLType"}) SET d.schema = {type: "string", format: "uri"} RETURN d',
        'CREATE (d:DataType {name: "BooleanType"}) SET d.schema = {type: "boolean"} RETURN d',
      ];

      for (const query of queries) {
        const ast = parse(query) as Query;
        // eslint-disable-next-line no-unused-expressions
        [...makeTraverser(astToSteps(ast)).traverse(graph, [undefined])];
      }

      // Verify all were created
      const countAst = parse("MATCH (dt:DataType) RETURN count(dt)") as Query;
      const countResults = [
        ...makeTraverser(astToSteps(countAst)).traverse(graph, [undefined]),
      ];
      expect(countResults[0]).toEqual(queries.length);

      // Verify specific schema for Email type (use WHERE clause for reliable filtering)
      const emailAst = parse(
        'MATCH (dt:DataType) WHERE dt.name = "EmailType" RETURN dt.schema',
      ) as Query;
      const emailResults = [
        ...makeTraverser(astToSteps(emailAst)).traverse(graph, [undefined]),
      ];
      expect(emailResults).toHaveLength(1);
      expect(emailResults[0]).toEqual({ type: "string", format: "email" });
    });

    it("should create data types with pattern schemas", () => {
      const query = `
        MERGE (dt:DataType {name: "Slug"})
        SET dt.description = "A URL-friendly identifier string.",
            dt.schema = {type: "string", pattern: "^[a-z0-9-]+$"}
        RETURN dt
      `;
      const ast = parse(query) as Query;
      // eslint-disable-next-line no-unused-expressions
      [...makeTraverser(astToSteps(ast)).traverse(graph, [undefined])];

      const verifyAst = parse(
        'MATCH (dt:DataType {name: "Slug"}) RETURN dt.description, dt.schema',
      ) as Query;
      const results = [
        ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
      ];

      expect(results[0]).toEqual([
        "A URL-friendly identifier string.",
        { type: "string", pattern: "^[a-z0-9-]+$" },
      ]);
    });

    it("should create data types with minLength constraint", () => {
      const query = `
        MERGE (dt:DataType {name: "Token"})
        SET dt.description = "A secure token string.",
            dt.schema = {type: "string", minLength: 16}
        RETURN dt
      `;
      const ast = parse(query) as Query;
      // eslint-disable-next-line no-unused-expressions
      [...makeTraverser(astToSteps(ast)).traverse(graph, [undefined])];

      const verifyAst = parse(
        'MATCH (dt:DataType {name: "Token"}) RETURN dt.schema',
      ) as Query;
      const results = [
        ...makeTraverser(astToSteps(verifyAst)).traverse(graph, [undefined]),
      ];

      expect(results[0]).toEqual({ type: "string", minLength: 16 });
    });
  });
});
