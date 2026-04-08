import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import { createDemoGraph, type DemoSchema } from "../getDemoGraph.js";
import type { Query, SetAllProperties, SetAddProperties } from "../AST.js";
import type { Graph } from "../Graph.js";

describe("SET clause enhancements", () => {
  describe("Grammar parsing", () => {
    describe("SET n = {props} (replace all properties)", () => {
      it("should parse SET n = {props} syntax", () => {
        const ast = parse(
          "MATCH (n:Person) SET n = {name: 'Alice', age: 30} RETURN n",
        ) as Query;

        expect(ast.set).toBeDefined();
        expect(ast.set!.assignments).toHaveLength(1);

        const assignment = ast.set!.assignments[0] as SetAllProperties;
        expect(assignment.type).toBe("SetAllProperties");
        expect(assignment.variable).toBe("n");
        expect(assignment.properties).toEqual({ name: "Alice", age: 30 });
      });

      it("should parse SET n = $param syntax", () => {
        const ast = parse("MATCH (n:Person) SET n = $props RETURN n") as Query;

        expect(ast.set).toBeDefined();
        expect(ast.set!.assignments).toHaveLength(1);

        const assignment = ast.set!.assignments[0] as SetAllProperties;
        expect(assignment.type).toBe("SetAllProperties");
        expect(assignment.variable).toBe("n");
        expect(assignment.properties).toEqual({
          type: "ParameterRef",
          name: "props",
        });
      });

      it("should parse SET n = {} (empty map)", () => {
        const ast = parse("MATCH (n:Person) SET n = {} RETURN n") as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAllProperties;
        expect(assignment.type).toBe("SetAllProperties");
        expect(assignment.properties).toEqual({});
      });
    });

    describe("SET n += {props} (add/merge properties)", () => {
      it("should parse SET n += {props} syntax", () => {
        const ast = parse(
          "MATCH (n:Person) SET n += {status: 'active'} RETURN n",
        ) as Query;

        expect(ast.set).toBeDefined();
        expect(ast.set!.assignments).toHaveLength(1);

        const assignment = ast.set!.assignments[0] as SetAddProperties;
        expect(assignment.type).toBe("SetAddProperties");
        expect(assignment.variable).toBe("n");
        expect(assignment.properties).toEqual({ status: "active" });
      });

      it("should parse SET n += $param syntax", () => {
        const ast = parse(
          "MATCH (n:Person) SET n += $newProps RETURN n",
        ) as Query;

        expect(ast.set).toBeDefined();
        const assignment = ast.set!.assignments[0] as SetAddProperties;
        expect(assignment.type).toBe("SetAddProperties");
        expect(assignment.variable).toBe("n");
        expect(assignment.properties).toEqual({
          type: "ParameterRef",
          name: "newProps",
        });
      });
    });

    describe("Mixed SET operations", () => {
      it("should parse mixed SET operations (property, replace, add)", () => {
        const ast = parse(
          "MATCH (n:Person), (m:Thing) SET n.name = 'Bob', m = {name: 'test'}, n += {age: 25} RETURN n, m",
        ) as Query;

        expect(ast.set).toBeDefined();
        expect(ast.set!.assignments).toHaveLength(3);

        // First: individual property assignment
        const first = ast.set!.assignments[0]!;
        expect("property" in first).toBe(true);
        expect((first as { variable: string }).variable).toBe("n");
        expect((first as { property: string }).property).toBe("name");

        // Second: replace all properties
        const second = ast.set!.assignments[1] as SetAllProperties;
        expect(second.type).toBe("SetAllProperties");
        expect(second.variable).toBe("m");

        // Third: add properties
        const third = ast.set!.assignments[2] as SetAddProperties;
        expect(third.type).toBe("SetAddProperties");
        expect(third.variable).toBe("n");
      });
    });
  });

  describe("Step conversion", () => {
    it("should convert SET n = {props} to SetStep with setAllProperties", () => {
      const ast = parse(
        "MATCH (n:Person) SET n = {name: 'Alice'} RETURN n",
      ) as Query;
      const steps = astToSteps(ast);

      // Find the SetStep
      const setStep = steps.find((s) => s.name === "Set");
      expect(setStep).toBeDefined();

      // Check the assignment
      const config = (setStep as any).config;
      expect(config.assignments).toHaveLength(1);
      expect(config.assignments[0].type).toBe("setAllProperties");
      expect(config.assignments[0].variable).toBe("n");
      expect(config.assignments[0].properties).toEqual({ name: "Alice" });
    });

    it("should convert SET n += {props} to SetStep with setAddProperties", () => {
      const ast = parse(
        "MATCH (n:Person) SET n += {status: 'active'} RETURN n",
      ) as Query;
      const steps = astToSteps(ast);

      const setStep = steps.find((s) => s.name === "Set");
      expect(setStep).toBeDefined();

      const config = (setStep as any).config;
      expect(config.assignments).toHaveLength(1);
      expect(config.assignments[0].type).toBe("setAddProperties");
      expect(config.assignments[0].variable).toBe("n");
      expect(config.assignments[0].properties).toEqual({ status: "active" });
    });

    it("should convert SET n = $param with parameter reference", () => {
      const ast = parse("MATCH (n:Person) SET n = $props RETURN n") as Query;
      const steps = astToSteps(ast);

      const setStep = steps.find((s) => s.name === "Set");
      const config = (setStep as any).config;
      expect(config.assignments[0].properties).toEqual({
        type: "parameter",
        name: "props",
      });
    });
  });

  describe("Query execution", () => {
    let graph: Graph<DemoSchema>;
    let alice: ReturnType<typeof createDemoGraph>["alice"];
    let bob: ReturnType<typeof createDemoGraph>["bob"];

    beforeEach(() => {
      const demo = createDemoGraph();
      graph = demo.graph;
      alice = demo.alice;
      bob = demo.bob;
      clearQueryParams();
    });

    afterEach(() => {
      clearQueryParams();
    });

    describe("SET n = {props} (replace all properties)", () => {
      it("should replace all properties on a node", () => {
        // Alice initially has name: "Alice", age: 30
        expect(alice.get("name")).toBe("Alice");
        expect(alice.get("age")).toBe(30);

        // Execute SET n = {props}
        const ast = parse(
          "MATCH (n:Person) WHERE n.name = 'Alice' SET n = {name: 'NewAlice', age: 99} RETURN n",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toHaveLength(1);

        // Check that properties were replaced
        expect(alice.get("name")).toBe("NewAlice");
        expect(alice.get("age")).toBe(99);
      });

      it("should replace properties with parameter map", () => {
        setQueryParams({ props: { name: "Charlie", age: 100 } });

        const ast = parse(
          "MATCH (n:Person) WHERE n.name = 'Alice' SET n = $props RETURN n",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toHaveLength(1);
        expect(alice.get("name")).toBe("Charlie");
        expect(alice.get("age")).toBe(100);
      });

      it("should handle SET n = {} (clear specified properties)", () => {
        const ast = parse(
          "MATCH (n:Person) WHERE n.name = 'Alice' SET n = {} RETURN n",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toHaveLength(1);
        // Properties should be cleared
        expect(alice.get("name")).toBeUndefined();
        expect(alice.get("age")).toBeUndefined();
      });
    });

    describe("SET n += {props} (add/merge properties)", () => {
      it("should add new properties while preserving existing ones", () => {
        // Bob initially has name: "Bob", age: 25
        expect(bob.get("name")).toBe("Bob");
        expect(bob.get("age")).toBe(25);

        const ast = parse(
          "MATCH (n:Person) WHERE n.name = 'Bob' SET n += {ref: 'bob-ref'} RETURN n",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toHaveLength(1);
        // Original properties preserved
        expect(bob.get("name")).toBe("Bob");
        expect(bob.get("age")).toBe(25);
        // New property added
        expect(bob.get("ref")).toBe("bob-ref");
      });

      it("should update existing properties when using +=", () => {
        const ast = parse(
          "MATCH (n:Person) WHERE n.name = 'Bob' SET n += {name: 'Robert', ref: 'bob-123'} RETURN n",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toHaveLength(1);
        // Updated property
        expect(bob.get("name")).toBe("Robert");
        // Preserved property
        expect(bob.get("age")).toBe(25);
        // New property
        expect(bob.get("ref")).toBe("bob-123");
      });

      it("should merge properties with parameter map", () => {
        setQueryParams({ newProps: { age: 99, ref: "updated-ref" } });

        const ast = parse(
          "MATCH (n:Person) WHERE n.name = 'Bob' SET n += $newProps RETURN n",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toHaveLength(1);
        expect(bob.get("name")).toBe("Bob");
        expect(bob.get("age")).toBe(99);
        expect(bob.get("ref")).toBe("updated-ref");
      });
    });

    describe("Mixed SET operations", () => {
      it("should handle mixed individual and map-based SET operations", () => {
        const ast = parse(
          "MATCH (n:Person) WHERE n.name = 'Alice' SET n.ref = 'alice-ref', n += {age: 31} RETURN n",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toHaveLength(1);

        // Individual property set
        expect(alice.get("ref")).toBe("alice-ref");
        // Preserved by +=
        expect(alice.get("name")).toBe("Alice");
        // Updated by +=
        expect(alice.get("age")).toBe(31);
      });

      it("should work with multiple nodes in MATCH", () => {
        const ast = parse(
          "MATCH (n:Person) SET n += {ref: 'updated'} RETURN n.name, n.ref",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // Should update all Person nodes (there are 7 in demo graph)
        expect(results.length).toBeGreaterThan(1);
        // All should have the ref property updated
        results.forEach((result: any) => {
          expect(result[1]).toBe("updated");
        });
      });
    });

    describe("Error handling", () => {
      it("should throw error when parameter is not an object", () => {
        setQueryParams({ props: "not an object" });

        const ast = parse(
          "MATCH (n:Person) WHERE n.name = 'Alice' SET n = $props RETURN n",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);

        expect(() => [...traverser.traverse(graph, [undefined])]).toThrow(
          "Parameter 'props' must be an object/map",
        );
      });

      it("should throw error when parameter is null", () => {
        setQueryParams({ props: null });

        const ast = parse(
          "MATCH (n:Person) WHERE n.name = 'Alice' SET n = $props RETURN n",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);

        expect(() => [...traverser.traverse(graph, [undefined])]).toThrow(
          "Parameter 'props' must be an object/map",
        );
      });

      it("should throw error when variable is not found", () => {
        const ast = parse(
          "MATCH (n:Person) SET m = {name: 'Bob'} RETURN n",
        ) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);

        expect(() => [...traverser.traverse(graph, [undefined])]).toThrow(
          "Variable 'm' not found in path",
        );
      });
    });
  });
});
