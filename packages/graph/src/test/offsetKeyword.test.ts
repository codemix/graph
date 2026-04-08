/**
 * Tests for OFFSET keyword as a synonym for SKIP
 */
import { describe, expect, test } from "vitest";
import { parse, astToSteps, createTraverser, type Query } from "../index.js";
import { createDemoGraph } from "../getDemoGraph.js";

// Use the demo graph which has Person vertices with name and age properties
const { graph } = createDemoGraph();

describe("OFFSET keyword (synonym for SKIP)", () => {
  describe("Grammar parsing", () => {
    test("parses OFFSET in basic query", () => {
      const query = "MATCH (n:Person) RETURN n OFFSET 5";
      const ast = parse(query) as Query;
      expect(ast.skip).toEqual(5);
    });

    test("parses OFFSET with LIMIT", () => {
      const query = "MATCH (n:Person) RETURN n OFFSET 10 LIMIT 5";
      const ast = parse(query) as Query;
      expect(ast.skip).toEqual(10);
      expect(ast.limit).toEqual(5);
    });

    test("parses OFFSET case-insensitively", () => {
      const query1 = "MATCH (n) RETURN n OFFSET 3";
      const query2 = "MATCH (n) RETURN n offset 3";
      const query3 = "MATCH (n) RETURN n Offset 3";

      const ast1 = parse(query1) as Query;
      const ast2 = parse(query2) as Query;
      const ast3 = parse(query3) as Query;

      expect(ast1.skip).toEqual(3);
      expect(ast2.skip).toEqual(3);
      expect(ast3.skip).toEqual(3);
    });

    test("parses OFFSET with ORDER BY", () => {
      const query = "MATCH (n:Person) RETURN n ORDER BY n.name OFFSET 2";
      const ast = parse(query) as Query;
      expect(ast.orderBy).toBeDefined();
      expect(ast.skip).toEqual(2);
    });

    test("parses OFFSET with ORDER BY and LIMIT", () => {
      const query = "MATCH (n:Person) RETURN n ORDER BY n.name DESC OFFSET 5 LIMIT 10";
      const ast = parse(query) as Query;
      expect(ast.orderBy).toBeDefined();
      expect(ast.skip).toEqual(5);
      expect(ast.limit).toEqual(10);
    });

    test("SKIP and OFFSET produce same AST structure", () => {
      const skipQuery = "MATCH (n) RETURN n SKIP 7";
      const offsetQuery = "MATCH (n) RETURN n OFFSET 7";

      const skipAst = parse(skipQuery) as Query;
      const offsetAst = parse(offsetQuery) as Query;

      expect(skipAst.skip).toEqual(offsetAst.skip);
      expect(skipAst.skip).toEqual(7);
    });

    test("OFFSET 0 is valid", () => {
      const query = "MATCH (n) RETURN n OFFSET 0";
      const ast = parse(query) as Query;
      expect(ast.skip).toEqual(0);
    });

    test("OFFSET with large number", () => {
      const query = "MATCH (n) RETURN n OFFSET 1000000";
      const ast = parse(query) as Query;
      expect(ast.skip).toEqual(1000000);
    });
  });

  describe("Step conversion", () => {
    test("OFFSET converts to RangeStep", () => {
      const query = "MATCH (n:Person) RETURN n OFFSET 5";
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      // Find the RangeStep (step.name is "Range")
      const rangeStep = steps.find((step) => step.name === "Range");
      expect(rangeStep).toBeDefined();
      // RangeStep uses start and end; OFFSET 5 means start=5, end=Number.MAX_SAFE_INTEGER
      expect(rangeStep?.config).toMatchObject({
        start: 5,
        end: Number.MAX_SAFE_INTEGER,
      });
    });

    test("OFFSET and SKIP produce same steps", () => {
      const skipQuery = "MATCH (n:Person) RETURN n SKIP 3";
      const offsetQuery = "MATCH (n:Person) RETURN n OFFSET 3";

      const skipSteps = astToSteps(parse(skipQuery) as Query);
      const offsetSteps = astToSteps(parse(offsetQuery) as Query);

      // Both should have identical step configurations
      expect(skipSteps.length).toEqual(offsetSteps.length);

      const skipRangeStep = skipSteps.find((step) => step.name === "Range");
      const offsetRangeStep = offsetSteps.find((step) => step.name === "Range");

      expect(skipRangeStep?.config).toEqual(offsetRangeStep?.config);
    });
  });

  describe("Query execution", () => {
    // Demo graph has 7 Person vertices: Alice, Bob, Charlie, Dave, Erin, Fiona, George

    function executeQuery(query: string): unknown[] {
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      return [...traverser.traverse(graph, [undefined])];
    }

    test("OFFSET skips first N results", () => {
      // Get all persons ordered by name
      const allResults = executeQuery("MATCH (n:Person) RETURN n.name ORDER BY n.name");
      expect(allResults.length).toEqual(7);
      // First 3 names in alphabetical order: Alice, Bob, Charlie

      // Skip first 3 persons
      const offsetResults = executeQuery("MATCH (n:Person) RETURN n.name ORDER BY n.name OFFSET 3");
      expect(offsetResults.length).toEqual(4);

      // First result should be Dave (4th person alphabetically)
      expect(offsetResults[0]).toEqual("Dave");
    });

    test("OFFSET with LIMIT for pagination", () => {
      // Page 1: first 2 persons
      const page1 = executeQuery("MATCH (n:Person) RETURN n.name ORDER BY n.name OFFSET 0 LIMIT 2");
      expect(page1.length).toEqual(2);
      expect(page1[0]).toEqual("Alice");
      expect(page1[1]).toEqual("Bob");

      // Page 2: persons 3-4 (Charlie, Dave)
      const page2 = executeQuery("MATCH (n:Person) RETURN n.name ORDER BY n.name OFFSET 2 LIMIT 2");
      expect(page2.length).toEqual(2);
      expect(page2[0]).toEqual("Charlie");
      expect(page2[1]).toEqual("Dave");

      // Page 3: persons 5-6 (Erin, Fiona)
      const page3 = executeQuery("MATCH (n:Person) RETURN n.name ORDER BY n.name OFFSET 4 LIMIT 2");
      expect(page3.length).toEqual(2);
      expect(page3[0]).toEqual("Erin");
      expect(page3[1]).toEqual("Fiona");

      // Page 4: person 7 only (George)
      const page4 = executeQuery("MATCH (n:Person) RETURN n.name ORDER BY n.name OFFSET 6 LIMIT 2");
      expect(page4.length).toEqual(1);
      expect(page4[0]).toEqual("George");
    });

    test("OFFSET beyond result count returns empty", () => {
      const results = executeQuery("MATCH (n:Person) RETURN n OFFSET 100");
      expect(results.length).toEqual(0);
    });

    test("OFFSET produces same results as SKIP", () => {
      const skipResults = executeQuery(
        "MATCH (n:Person) RETURN n.name ORDER BY n.name SKIP 3 LIMIT 2",
      );
      const offsetResults = executeQuery(
        "MATCH (n:Person) RETURN n.name ORDER BY n.name OFFSET 3 LIMIT 2",
      );

      expect(skipResults.length).toEqual(offsetResults.length);
      expect(skipResults).toEqual(offsetResults);
    });
  });

  describe("WITH clause", () => {
    function executeQuery(query: string): unknown[] {
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      return [...traverser.traverse(graph, [undefined])];
    }

    test("OFFSET in WITH clause", () => {
      const query = "MATCH (n:Person) WITH n ORDER BY n.name OFFSET 4 RETURN n.name";
      const results = executeQuery(query);

      expect(results.length).toEqual(3); // Erin, Fiona, George
      expect(results[0]).toEqual("Erin");
    });

    test("OFFSET with LIMIT in WITH clause", () => {
      const query = "MATCH (n:Person) WITH n ORDER BY n.name OFFSET 2 LIMIT 3 RETURN n.name";
      const results = executeQuery(query);

      expect(results.length).toEqual(3); // Charlie, Dave, Erin
      expect(results[0]).toEqual("Charlie");
      expect(results[1]).toEqual("Dave");
      expect(results[2]).toEqual("Erin");
    });
  });
});
