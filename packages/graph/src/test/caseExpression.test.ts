import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import type { Query, SimpleCaseExpression, SearchedCaseExpression } from "../AST.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";

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
    User: {
      properties: {
        name: { type: makeType<string>("") },
        age: { type: makeType<number>(0) },
        status: { type: makeType<string>("") },
        role: { type: makeType<string>("") },
        score: { type: makeType<number>(0) },
      },
    },
  },
  edges: {},
};

function createGraph(): Graph<any> {
  return new Graph({
    schema: schema as any,
    storage: new InMemoryGraphStorage(),
  });
}

describe("CASE expression support", () => {
  describe("grammar parsing", () => {
    describe("simple CASE expressions", () => {
      it("should parse simple CASE with two alternatives", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE n.status WHEN 'active' THEN 1 WHEN 'inactive' THEN 0 END = 1
          RETURN n
        `;
        const ast = parse(query) as Query;
        expect(ast.matches).toHaveLength(1);
        expect(ast.matches[0]!.where).toBeDefined();
        const condition = ast.matches[0]!.where!.condition;
        expect(condition.type).toBe("ExpressionCondition");
      });

      it("should parse simple CASE with ELSE clause", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE n.role WHEN 'admin' THEN 100 WHEN 'user' THEN 10 ELSE 1 END > 5
          RETURN n
        `;
        const ast = parse(query) as Query;
        expect(ast.matches[0]!.where).toBeDefined();
      });

      it("should parse simple CASE with property access as test", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE n.level WHEN 1 THEN 'low' WHEN 2 THEN 'medium' WHEN 3 THEN 'high' END = 'high'
          RETURN n
        `;
        const ast = parse(query) as Query;
        expect(ast.matches).toHaveLength(1);
      });

      it("should parse nested CASE in THEN clause", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE n.type
            WHEN 'A' THEN CASE n.subtype WHEN 1 THEN 100 ELSE 50 END
            ELSE 0
          END > 0
          RETURN n
        `;
        const ast = parse(query) as Query;
        expect(ast.matches).toHaveLength(1);
      });
    });

    describe("searched CASE expressions", () => {
      it("should parse searched CASE with comparison conditions", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE WHEN n.age > 60 THEN 'senior' WHEN n.age > 18 THEN 'adult' ELSE 'minor' END = 'adult'
          RETURN n
        `;
        const ast = parse(query) as Query;
        expect(ast.matches).toHaveLength(1);
        expect(ast.matches[0]!.where).toBeDefined();
      });

      it("should parse searched CASE with multiple conditions", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE
            WHEN n.score > 90 THEN 'A'
            WHEN n.score > 80 THEN 'B'
            WHEN n.score > 70 THEN 'C'
            WHEN n.score > 60 THEN 'D'
            ELSE 'F'
          END = 'A'
          RETURN n
        `;
        const ast = parse(query) as Query;
        expect(ast.matches).toHaveLength(1);
      });

      it("should parse searched CASE with AND/OR conditions", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE
            WHEN n.active = true AND n.verified = true THEN 'verified'
            WHEN n.active = true THEN 'active'
            ELSE 'inactive'
          END = 'verified'
          RETURN n
        `;
        const ast = parse(query) as Query;
        expect(ast.matches).toHaveLength(1);
      });

      it("should parse searched CASE without ELSE", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE WHEN n.premium = true THEN 'premium' END = 'premium'
          RETURN n
        `;
        const ast = parse(query) as Query;
        expect(ast.matches).toHaveLength(1);
      });
    });

    describe("CASE in arithmetic expressions", () => {
      it("should parse CASE as part of arithmetic expression", () => {
        const query = `
          MATCH (n:User)
          WHERE n.score + CASE WHEN n.bonus = true THEN 10 ELSE 0 END > 100
          RETURN n
        `;
        const ast = parse(query) as Query;
        expect(ast.matches).toHaveLength(1);
      });

      it("should parse CASE multiplied by value", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE n.type WHEN 'premium' THEN 2 ELSE 1 END * n.points > 500
          RETURN n
        `;
        const ast = parse(query) as Query;
        expect(ast.matches).toHaveLength(1);
      });
    });
  });

  describe("AST structure", () => {
    it("should produce SimpleCaseExpression AST node", () => {
      const query = `
        MATCH (n:User)
        WHERE CASE n.status WHEN 'active' THEN 1 ELSE 0 END = 1
        RETURN n
      `;
      const ast = parse(query) as Query;
      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");

      if (condition.type === "ExpressionCondition") {
        const leftExpr = condition.left;
        expect(leftExpr).toBeDefined();
        expect(typeof leftExpr).toBe("object");
        if (leftExpr && typeof leftExpr === "object" && "type" in leftExpr) {
          expect(leftExpr.type).toBe("SimpleCaseExpression");
          const caseExpr = leftExpr as SimpleCaseExpression;
          expect(caseExpr.alternatives).toHaveLength(1);
          expect(caseExpr.else).toBeDefined();
        }
      }
    });

    it("should produce SearchedCaseExpression AST node", () => {
      const query = `
        MATCH (n:User)
        WHERE CASE WHEN n.age > 18 THEN 'adult' ELSE 'minor' END = 'adult'
        RETURN n
      `;
      const ast = parse(query) as Query;
      const condition = ast.matches[0]!.where!.condition;
      expect(condition.type).toBe("ExpressionCondition");

      if (condition.type === "ExpressionCondition") {
        const leftExpr = condition.left;
        expect(leftExpr).toBeDefined();
        expect(typeof leftExpr).toBe("object");
        if (leftExpr && typeof leftExpr === "object" && "type" in leftExpr) {
          expect(leftExpr.type).toBe("SearchedCaseExpression");
          const caseExpr = leftExpr as SearchedCaseExpression;
          expect(caseExpr.alternatives).toHaveLength(1);
          expect(caseExpr.else).toBeDefined();
        }
      }
    });
  });

  describe("step conversion", () => {
    it("should convert simple CASE to steps", () => {
      const query = `
        MATCH (n:User)
        WHERE CASE n.status WHEN 'active' THEN 1 ELSE 0 END = 1
        RETURN n
      `;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      expect(steps.length).toBeGreaterThan(0);
    });

    it("should convert searched CASE to steps", () => {
      const query = `
        MATCH (n:User)
        WHERE CASE WHEN n.age > 18 THEN 'adult' ELSE 'minor' END = 'adult'
        RETURN n
      `;
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);
      expect(steps.length).toBeGreaterThan(0);
    });
  });

  describe("query execution", () => {
    let graph: Graph<any>;

    beforeEach(() => {
      graph = createGraph();

      // Create test users
      graph.addVertex("User", {
        name: "Alice",
        age: 30,
        status: "active",
        role: "admin",
        score: 95,
      });
      graph.addVertex("User", {
        name: "Bob",
        age: 25,
        status: "inactive",
        role: "user",
        score: 75,
      });
      graph.addVertex("User", {
        name: "Charlie",
        age: 15,
        status: "active",
        role: "user",
        score: 85,
      });
      graph.addVertex("User", {
        name: "Diana",
        age: 65,
        status: "active",
        role: "admin",
        score: 60,
      });
    });

    describe("simple CASE execution", () => {
      it("should filter by simple CASE expression", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE n.status WHEN 'active' THEN 1 ELSE 0 END = 1
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // Should return Alice, Charlie, and Diana (status = 'active')
        expect(results).toHaveLength(3);
        const names = results.map((r) => (r as any[])[0]?.get("name"));
        expect(names).toContain("Alice");
        expect(names).toContain("Charlie");
        expect(names).toContain("Diana");
        expect(names).not.toContain("Bob");
      });

      it("should match first alternative in simple CASE", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE n.role WHEN 'admin' THEN 100 WHEN 'user' THEN 10 ELSE 1 END = 100
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // Should return Alice and Diana (role = 'admin')
        expect(results).toHaveLength(2);
        const names = results.map((r) => (r as any[])[0]?.get("name"));
        expect(names).toContain("Alice");
        expect(names).toContain("Diana");
      });

      it("should use ELSE when no alternative matches in simple CASE", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE n.role WHEN 'manager' THEN 50 ELSE 1 END = 1
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // All users have role admin or user, not manager, so all should return ELSE value
        expect(results).toHaveLength(4);
      });

      it("should return null when no match and no ELSE", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE n.role WHEN 'manager' THEN 50 END = 50
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // No one has role 'manager', and CASE returns null without ELSE
        // null = 50 is false, so no results
        expect(results).toHaveLength(0);
      });
    });

    describe("searched CASE execution", () => {
      it("should filter by searched CASE with comparison", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE WHEN n.age > 60 THEN 'senior' WHEN n.age > 18 THEN 'adult' ELSE 'minor' END = 'adult'
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // Alice (30) and Bob (25) are adults (18 < age <= 60)
        expect(results).toHaveLength(2);
        const names = results.map((r) => (r as any[])[0]?.get("name"));
        expect(names).toContain("Alice");
        expect(names).toContain("Bob");
      });

      it("should match first true condition in searched CASE", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE WHEN n.age > 60 THEN 'senior' WHEN n.age > 18 THEN 'adult' ELSE 'minor' END = 'senior'
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // Only Diana (65) is a senior
        expect(results).toHaveLength(1);
        const names = results.map((r) => (r as any[])[0]?.get("name"));
        expect(names).toContain("Diana");
      });

      it("should use ELSE when no condition is true in searched CASE", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE WHEN n.age > 60 THEN 'senior' WHEN n.age > 18 THEN 'adult' ELSE 'minor' END = 'minor'
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // Only Charlie (15) is a minor
        expect(results).toHaveLength(1);
        const names = results.map((r) => (r as any[])[0]?.get("name"));
        expect(names).toContain("Charlie");
      });

      it("should handle complex conditions in searched CASE", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE
            WHEN n.role = 'admin' AND n.score > 90 THEN 'top-admin'
            WHEN n.role = 'admin' THEN 'admin'
            WHEN n.score > 80 THEN 'high-scorer'
            ELSE 'regular'
          END = 'top-admin'
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // Only Alice is admin with score > 90
        expect(results).toHaveLength(1);
        const names = results.map((r) => (r as any[])[0]?.get("name"));
        expect(names).toContain("Alice");
      });
    });

    describe("CASE in arithmetic expressions", () => {
      it("should use CASE result in arithmetic", () => {
        const query = `
          MATCH (n:User)
          WHERE n.score + CASE WHEN n.role = 'admin' THEN 10 ELSE 0 END > 100
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // Alice: 95 + 10 = 105 > 100 ✓
        // Diana: 60 + 10 = 70 < 100 ✗
        // Bob: 75 + 0 = 75 < 100 ✗
        // Charlie: 85 + 0 = 85 < 100 ✗
        expect(results).toHaveLength(1);
        const names = results.map((r) => (r as any[])[0]?.get("name"));
        expect(names).toContain("Alice");
      });

      it("should multiply CASE result", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE n.status WHEN 'active' THEN 2 ELSE 1 END * n.score > 150
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // Alice: 2 * 95 = 190 > 150 ✓
        // Bob: 1 * 75 = 75 < 150 ✗ (inactive)
        // Charlie: 2 * 85 = 170 > 150 ✓
        // Diana: 2 * 60 = 120 < 150 ✗
        expect(results).toHaveLength(2);
        const names = results.map((r) => (r as any[])[0]?.get("name"));
        expect(names).toContain("Alice");
        expect(names).toContain("Charlie");
      });
    });

    describe("CASE with parameters", () => {
      beforeEach(() => {
        clearQueryParams();
      });

      afterEach(() => {
        clearQueryParams();
      });

      it("should use parameters in simple CASE alternatives", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE n.status WHEN $status THEN 1 ELSE 0 END = 1
          RETURN n
        `;
        setQueryParams({ status: "active" });
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toHaveLength(3);
      });

      it("should use parameters in searched CASE conditions", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE WHEN n.age > $minAge THEN 'adult' ELSE 'minor' END = 'adult'
          RETURN n
        `;
        setQueryParams({ minAge: 18 });
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // Alice (30), Bob (25), Diana (65) are over 18
        expect(results).toHaveLength(3);
      });
    });

    describe("CASE with functions", () => {
      it("should use functions in CASE results", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE WHEN toLower(n.name) = 'alice' THEN 100 ELSE 0 END = 100
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        expect(results).toHaveLength(1);
        const names = results.map((r) => (r as any[])[0]?.get("name"));
        expect(names).toContain("Alice");
      });
    });

    describe("edge cases", () => {
      it("should handle CASE with null values", () => {
        // Add a user with null status
        graph.addVertex("User", {
          name: "Eve",
          age: 40,
          role: "user",
          score: 70,
        });

        const query = `
          MATCH (n:User)
          WHERE CASE n.status WHEN 'active' THEN 1 ELSE 0 END = 0
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // Bob (inactive) and Eve (null status) should match
        expect(results).toHaveLength(2);
        const names = results.map((r) => (r as any[])[0]?.get("name"));
        expect(names).toContain("Bob");
        expect(names).toContain("Eve");
      });

      it("should handle deeply nested CASE expressions", () => {
        const query = `
          MATCH (n:User)
          WHERE CASE
            WHEN n.role = 'admin' THEN
              CASE WHEN n.score > 90 THEN 3 ELSE 2 END
            ELSE 1
          END = 3
          RETURN n
        `;
        const ast = parse(query) as Query;
        const steps = astToSteps(ast);
        const traverser = createTraverser(steps);
        const results = [...traverser.traverse(graph, [undefined])];

        // Only Alice is admin with score > 90
        expect(results).toHaveLength(1);
        const names = results.map((r) => (r as any[])[0]?.get("name"));
        expect(names).toContain("Alice");
      });
    });
  });
});
