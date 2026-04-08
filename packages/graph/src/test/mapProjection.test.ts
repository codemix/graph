import { describe, it, expect, beforeEach } from "vitest";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createDemoGraph } from "../getDemoGraph.js";
import type { Query, MapProjection } from "../AST.js";
import { parseQueryToSteps } from "../index.js";

const { graph } = createDemoGraph();

describe("Map Projection", () => {
  describe("Grammar Parsing", () => {
    it("should parse basic property selector: n{.name}", () => {
      const result = parse("MATCH (n:Person) WHERE n{.name} = n{.name} RETURN n") as Query;
      expect(result.matches[0]?.where?.condition).toBeDefined();
    });

    it("should parse multiple property selectors: n{.name, .age}", () => {
      const query = "MATCH (n:Person) WHERE n{.name, .age} = null RETURN n";
      const result = parse(query) as Query;
      expect(result.matches[0]?.where?.condition).toBeDefined();
    });

    it("should parse all properties selector: n{.*}", () => {
      const query = "MATCH (n:Person) WHERE n{.*} = null RETURN n";
      const result = parse(query) as Query;
      expect(result.matches[0]?.where?.condition).toBeDefined();
    });

    it("should parse literal entry: n{status: 'active'}", () => {
      const query = "MATCH (n:Person) WHERE n{status: 'active'} = null RETURN n";
      const result = parse(query) as Query;
      expect(result.matches[0]?.where?.condition).toBeDefined();
    });

    it("should parse variable selector: n{m}", () => {
      const query = "MATCH (n:Person), (m:Person) WHERE n{m} = null RETURN n";
      const result = parse(query) as Query;
      expect(result.matches[0]?.where?.condition).toBeDefined();
    });

    it("should parse mixed selectors: n{.name, status: 'active', .*}", () => {
      const query = "MATCH (n:Person) WHERE n{.name, status: 'active', .*} = null RETURN n";
      const result = parse(query) as Query;
      expect(result.matches[0]?.where?.condition).toBeDefined();
    });

    it("should parse empty projection: n{}", () => {
      const query = "MATCH (n:Person) WHERE n{} = null RETURN n";
      const result = parse(query) as Query;
      expect(result.matches[0]?.where?.condition).toBeDefined();
    });

    it("should parse map projection AST structure correctly", () => {
      // Use a simpler WHERE clause to test AST structure
      const query = "MATCH (n:Person) WHERE n{.name, .age} = null RETURN n";
      const result = parse(query) as Query;
      const condition = result.matches[0]?.where?.condition;

      expect(condition).toBeDefined();
      // The condition should be ExpressionCondition with left being MapProjection
      if (condition && condition.type === "ExpressionCondition") {
        const left = condition.left as MapProjection;
        expect(left.type).toBe("MapProjection");
        expect(left.variable).toBe("n");
        expect(left.selectors).toHaveLength(2);
        expect(left.selectors[0]!.type).toBe("MapPropertySelector");
        expect(left.selectors[1]!.type).toBe("MapPropertySelector");
      }
    });

    it("should parse all properties selector AST correctly", () => {
      const query = "MATCH (n:Person) WHERE n{.*} = null RETURN n";
      const result = parse(query) as Query;
      const condition = result.matches[0]?.where?.condition;

      if (condition && condition.type === "ExpressionCondition") {
        const left = condition.left as MapProjection;
        expect(left.type).toBe("MapProjection");
        expect(left.selectors).toHaveLength(1);
        expect(left.selectors[0]!.type).toBe("MapAllPropertiesSelector");
      }
    });

    it("should parse literal entry AST correctly", () => {
      const query = "MATCH (n:Person) WHERE n{status: 'active', value: 42} = null RETURN n";
      const result = parse(query) as Query;
      const condition = result.matches[0]?.where?.condition;

      if (condition && condition.type === "ExpressionCondition") {
        const left = condition.left as MapProjection;
        expect(left.type).toBe("MapProjection");
        expect(left.selectors).toHaveLength(2);
        expect(left.selectors[0]!.type).toBe("MapLiteralEntry");
        expect(left.selectors[1]!.type).toBe("MapLiteralEntry");
      }
    });

    it("should parse variable selector AST correctly", () => {
      const query = "MATCH (n:Person), (m:Person) WHERE n{m, other} = null RETURN n";
      const result = parse(query) as Query;
      const condition = result.matches[0]?.where?.condition;

      if (condition && condition.type === "ExpressionCondition") {
        const left = condition.left as MapProjection;
        expect(left.type).toBe("MapProjection");
        expect(left.selectors).toHaveLength(2);
        expect(left.selectors[0]!.type).toBe("MapVariableSelector");
        expect(left.selectors[1]!.type).toBe("MapVariableSelector");
      }
    });
  });

  describe("AST to Steps Conversion", () => {
    it("should convert map projection to steps", () => {
      const query = "MATCH (n:Person) WHERE n{.name} = null RETURN n";
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      expect(steps.length).toBeGreaterThan(0);
    });

    it("should convert all properties selector to steps", () => {
      const query = "MATCH (n:Person) WHERE n{.*} = null RETURN n";
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      expect(steps.length).toBeGreaterThan(0);
    });

    it("should convert literal entry to steps", () => {
      const query = "MATCH (n:Person) WHERE n{status: 'active'} = null RETURN n";
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      expect(steps.length).toBeGreaterThan(0);
    });
  });

  describe("Query Execution", () => {
    beforeEach(() => {
      clearQueryParams();
    });

    it("should project single property using dynamic property access", () => {
      // Test map projection in a comparison using ['prop'] syntax
      const { steps } = parseQueryToSteps(
        "MATCH (n:Person) WHERE n{.name}['name'] = 'Alice' RETURN n.name",
      );
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should project multiple properties", () => {
      const { steps } = parseQueryToSteps(
        "MATCH (n:Person) WHERE n{.name, .age}['age'] > 40 RETURN n.name",
      );
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      // Demo graph: Alice 30, Bob 25, Charlie 35, Dave 40, Erin 45, Fiona 50, George 55
      // > 40: Erin 45, Fiona 50, George 55
      expect(results.sort()).toEqual(["Erin", "Fiona", "George"]);
    });

    it("should project all properties", () => {
      const { steps } = parseQueryToSteps(
        "MATCH (n:Person) WHERE n{.*}['name'] = 'Alice' RETURN n.name",
      );
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should include literal entry in projection", () => {
      const { steps } = parseQueryToSteps(
        "MATCH (n:Person) WHERE n{status: 'active'}['status'] = 'active' RETURN n.name",
      );
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      // All persons should match since status: 'active' is always in the projection
      expect(results.length).toBeGreaterThan(0);
    });

    it("should include variable in projection", () => {
      // Note: n{m}['m'] returns a Vertex, so we can't access .name directly
      // Instead, we compare the projected result to a known value
      const { steps } = parseQueryToSteps(
        "MATCH (n:Person)-[:knows]->(m:Person) WHERE m.name = 'Bob' AND n{m}['m'] = m RETURN n.name",
      );
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      // Alice knows Bob
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should handle empty projection", () => {
      // Empty projection should result in empty object - accessing any property returns null
      const { steps } = parseQueryToSteps(
        "MATCH (n:Person) WHERE n{}['name'] = null RETURN n.name",
      );
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      // Empty projection has no properties, so accessing 'name' returns null
      expect(results.length).toBeGreaterThan(0);
    });

    it("should work with literal entry using expressions", () => {
      const { steps } = parseQueryToSteps(
        "MATCH (n:Person) WHERE n{doubleAge: n.age * 2}['doubleAge'] > 80 RETURN n.name",
      );
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      // Demo graph: Alice 30, Bob 25, Charlie 35, Dave 40, Erin 45, Fiona 50, George 55
      // doubleAge > 80: Erin (90), Fiona (100), George (110)
      expect(results.sort()).toEqual(["Erin", "Fiona", "George"]);
    });

    it("should work with parameters in literal entry", () => {
      setQueryParams({ threshold: 90 });

      const { steps } = parseQueryToSteps(
        "MATCH (n:Person) WHERE n{doubleAge: n.age * 2}['doubleAge'] > $threshold RETURN n.name",
      );
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      // Demo graph: Alice 30, Bob 25, Charlie 35, Dave 40, Erin 45, Fiona 50, George 55
      // doubleAge > 90: Fiona (100), George (110)
      expect(results.sort()).toEqual(["Fiona", "George"]);
    });

    it("should handle null variable gracefully", () => {
      const { steps } = parseQueryToSteps(
        "MATCH (n:Person) WHERE n{.name, nonexistent}['nonexistent'] = null RETURN n.name",
      );
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      // nonexistent variable doesn't exist, so it's null
      expect(results.length).toBeGreaterThan(0);
    });

    it("should combine property and all properties selectors", () => {
      const { steps } = parseQueryToSteps(
        "MATCH (n:Person) WHERE n{.name, .*}['age'] = 30 RETURN n.name",
      );
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should work with function calls in literal entry", () => {
      const { steps } = parseQueryToSteps(
        "MATCH (n:Person) WHERE n{lowerName: toLower(n.name)}['lowerName'] = 'alice' RETURN n.name",
      );
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });

    it("should compare two map projections", () => {
      const { steps } = parseQueryToSteps(
        "MATCH (n:Person) WHERE n{.name}['name'] = 'Alice' AND n{.age}['age'] = 30 RETURN n.name",
      );
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });
  });

  describe("Edge Cases", () => {
    it("should handle property selector with reserved word property name", () => {
      // Backtick identifiers allow reserved words as property names
      const query = "MATCH (n:Person) WHERE n{.`type`} = null RETURN n";
      const result = parse(query) as Query;
      expect(result.matches[0]?.where?.condition).toBeDefined();
    });

    it("should handle property selector with special characters", () => {
      const query = "MATCH (n:Person) WHERE n{.`full name`} = null RETURN n";
      const result = parse(query) as Query;
      expect(result.matches[0]?.where?.condition).toBeDefined();
    });

    it("should handle literal entry with complex expression", () => {
      const query =
        "MATCH (n:Person) WHERE n{computed: CASE WHEN n.name = 'Alice' THEN 1 ELSE 0 END}['computed'] = 1 RETURN n.name";
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = [...traverser.traverse(graph, [undefined])];

      expect(results).toHaveLength(1);
      expect(results[0]).toBe("Alice");
    });
  });
});
