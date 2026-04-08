import { test, expect } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import {
  FetchVerticesStep,
  VertexStep,
  EdgeStep,
  FilterElementsStep,
  RangeStep,
  OrderStep,
  CountStep,
  DedupStep,
  RepeatStep,
  ValuesStep,
  SelectStep,
} from "../Steps.js";
import type { Query } from "../AST.js";
import { dumpSteps } from "./testHelpers.js";

test("AST to Steps Converter - Simple vertex fetching - should convert MATCH (u:User) RETURN u to FetchVerticesStep + Select + Values", () => {
  const query = "MATCH (u:User) RETURN u";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Select(pathLabels: ["u"]) 
    3. Values() "
  `);

  expect(steps).toHaveLength(3);
  expect(steps[0]).toBeInstanceOf(FetchVerticesStep);
  expect(steps[1]).toBeInstanceOf(SelectStep);
  expect(steps[2]).toBeInstanceOf(ValuesStep);

  const fetchStep = steps[0] as FetchVerticesStep;
  expect(fetchStep.config.vertexLabels).toEqual(["User"]);
  expect(fetchStep.config.stepLabels).toEqual(["u"]);
});

test("AST to Steps Converter - Simple vertex fetching - should convert MATCH (v) RETURN v to FetchVerticesStep without labels", () => {
  const query = "MATCH (v) RETURN v";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices() as v 
    2. Select(pathLabels: ["v"]) 
    3. Values() "
  `);

  const fetchStep = steps[0] as FetchVerticesStep;
  expect(fetchStep.config.vertexLabels).toBeUndefined();
  expect(fetchStep.config.stepLabels).toEqual(["v"]);
});

test("AST to Steps Converter - Simple vertex fetching - should convert MATCH (:User) RETURN u without variable", () => {
  const query = "MATCH (:User) RETURN u";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) 
    2. Select(pathLabels: ["u"]) 
    3. Values() "
  `);

  const fetchStep = steps[0] as FetchVerticesStep;
  expect(fetchStep.config.vertexLabels).toEqual(["User"]);
  expect(fetchStep.config.stepLabels).toBeUndefined();
});

test("AST to Steps Converter - Edge traversal - should convert outgoing edge traversal", () => {
  const query = "MATCH (u:User)-[:follows]->(f) RETURN f";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Edge(direction: "out", edgeLabels: ["follows"]) 
    3. Vertex(direction: "other", edgeLabels: []) as f 
    4. Select(pathLabels: ["f"]) 
    5. Values() "
  `);

  expect(steps).toHaveLength(5);
  expect(steps[0]).toBeInstanceOf(FetchVerticesStep);
  expect(steps[1]).toBeInstanceOf(EdgeStep);
  expect(steps[2]).toBeInstanceOf(VertexStep);
  expect(steps[3]).toBeInstanceOf(SelectStep);
  expect(steps[4]).toBeInstanceOf(ValuesStep);

  const edgeStep = steps[1] as EdgeStep;
  expect(edgeStep.config.direction).toBe("out");
  expect(edgeStep.config.edgeLabels).toEqual(["follows"]);

  const vertexStep = steps[2] as VertexStep;
  expect(vertexStep.config.direction).toBe("other");
  expect(vertexStep.config.stepLabels).toEqual(["f"]);
});

test("AST to Steps Converter - Edge traversal - should convert incoming edge traversal", () => {
  const query = "MATCH (u:User)<-[:follows]-(f) RETURN f";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Edge(direction: "in", edgeLabels: ["follows"]) 
    3. Vertex(direction: "other", edgeLabels: []) as f 
    4. Select(pathLabels: ["f"]) 
    5. Values() "
  `);

  const edgeStep = steps[1] as EdgeStep;
  expect(edgeStep.config.direction).toBe("in");
});

test("AST to Steps Converter - Edge traversal - should convert bidirectional edge traversal", () => {
  const query = "MATCH (u:User)-[:knows]-(f) RETURN f";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Edge(direction: "both", edgeLabels: ["knows"]) 
    3. Vertex(direction: "other", edgeLabels: []) as f 
    4. Select(pathLabels: ["f"]) 
    5. Values() "
  `);

  const edgeStep = steps[1] as EdgeStep;
  expect(edgeStep.config.direction).toBe("both");
});

test("AST to Steps Converter - Edge traversal - should handle multiple edge labels", () => {
  const query = "MATCH (u:User)-[:follows|likes]->(f) RETURN f";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Edge(direction: "out", edgeLabels: ["follows","likes"]) 
    3. Vertex(direction: "other", edgeLabels: []) as f 
    4. Select(pathLabels: ["f"]) 
    5. Values() "
  `);

  const edgeStep = steps[1] as EdgeStep;
  expect(edgeStep.config.edgeLabels).toEqual(["follows", "likes"]);
});

test("AST to Steps Converter - Edge traversal - should add filter for destination node labels", () => {
  const query = "MATCH (u:User)-[:follows]->(f:User) RETURN f";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Edge(direction: "out", edgeLabels: ["follows"]) 
    3. Vertex(direction: "other", edgeLabels: []) as f 
    4. FilterElements[@label = "User"] 
    5. Select(pathLabels: ["f"]) 
    6. Values() "
  `);

  expect(steps).toHaveLength(6);
  expect(steps[0]).toBeInstanceOf(FetchVerticesStep);
  expect(steps[1]).toBeInstanceOf(EdgeStep);
  expect(steps[2]).toBeInstanceOf(VertexStep);
  expect(steps[3]).toBeInstanceOf(FilterElementsStep);
  expect(steps[4]).toBeInstanceOf(SelectStep);
  expect(steps[5]).toBeInstanceOf(ValuesStep);

  const filterStep = steps[3] as FilterElementsStep<any>;
  expect(filterStep.config.condition).toEqual(["=", "@label", "User"]);
});

test("AST to Steps Converter - Edge traversal - should add step label for destination node variable", () => {
  const query = "MATCH (u:User)-[:follows]->(f:User) RETURN f";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Edge(direction: "out", edgeLabels: ["follows"]) 
    3. Vertex(direction: "other", edgeLabels: []) as f 
    4. FilterElements[@label = "User"] 
    5. Select(pathLabels: ["f"]) 
    6. Values() "
  `);

  const vertexStep = steps[2] as VertexStep;
  expect(vertexStep.config.stepLabels).toEqual(["f"]);
});

test("AST to Steps Converter - Edge traversal - should generate correct steps for edge pattern with edge and node variables", () => {
  const query = "MATCH (c:Concept)-[e:]-(d:Concept) RETURN c, e, d LIMIT 10";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["Concept"]) as c 
    2. Edge(direction: "both", edgeLabels: []) as e 
    3. Vertex(direction: "other", edgeLabels: []) as d 
    4. FilterElements[@label = "Concept"] 
    5. Range(start: 0, end: 10) 
    6. Select(pathLabels: ["c","e","d"]) 
    7. Values() "
  `);

  expect(steps).toHaveLength(7);

  // Step 1: FetchVerticesStep for c:Concept
  expect(steps[0]).toBeInstanceOf(FetchVerticesStep);
  const fetchStep = steps[0] as FetchVerticesStep;
  expect(fetchStep.config.vertexLabels).toEqual(["Concept"]);
  expect(fetchStep.config.stepLabels).toEqual(["c"]);

  // Step 2: EdgeStep for e with direction "both"
  expect(steps[1]).toBeInstanceOf(EdgeStep);
  const edgeStep = steps[1] as EdgeStep;
  expect(edgeStep.config.direction).toBe("both");
  expect(edgeStep.config.edgeLabels).toEqual([]);
  expect(edgeStep.config.stepLabels).toEqual(["e"]);

  // Step 3: VertexStep with direction "other" for d
  expect(steps[2]).toBeInstanceOf(VertexStep);
  const vertexStep = steps[2] as VertexStep;
  expect(vertexStep.config.direction).toBe("other");
  expect(vertexStep.config.edgeLabels).toEqual([]);
  expect(vertexStep.config.stepLabels).toEqual(["d"]);

  // Step 4: FilterElementsStep for d:Concept label check
  expect(steps[3]).toBeInstanceOf(FilterElementsStep);
  const filterStep = steps[3] as FilterElementsStep<any>;
  expect(filterStep.config.condition).toEqual(["=", "@label", "Concept"]);

  // Step 5: RangeStep for LIMIT 10
  expect(steps[4]).toBeInstanceOf(RangeStep);
  const rangeStep = steps[4] as RangeStep;
  expect(rangeStep.config.start).toBe(0);
  expect(rangeStep.config.end).toBe(10);

  // Steps 6-7: SelectStep + ValuesStep
  expect(steps[5]).toBeInstanceOf(SelectStep);
  expect(steps[6]).toBeInstanceOf(ValuesStep);
});

test("AST to Steps Converter - Variable-length paths - should convert exact quantifier to RepeatStep", () => {
  const query = "MATCH (u:User)-[:follows*2]->(f) RETURN f";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Repeat() {
         1. Edge(direction: "out", edgeLabels: ["follows"]) 
         2. Vertex(direction: "out", edgeLabels: []) 
       } as f times 2
    3. Select(pathLabels: ["f"]) 
    4. Values() "
  `);

  expect(steps).toHaveLength(4);
  expect(steps[0]).toBeInstanceOf(FetchVerticesStep);
  expect(steps[1]).toBeInstanceOf(RepeatStep);
  expect(steps[2]).toBeInstanceOf(SelectStep);
  expect(steps[3]).toBeInstanceOf(ValuesStep);

  const repeatStep = steps[1] as RepeatStep<any>;
  expect(repeatStep.config.times).toBe(2);
  expect(repeatStep.config.stepLabels).toEqual(["f"]);
  expect(repeatStep.steps).toHaveLength(2);
  expect(repeatStep.steps[0]).toBeInstanceOf(EdgeStep);
  expect(repeatStep.steps[1]).toBeInstanceOf(VertexStep);
});

test("AST to Steps Converter - Variable-length paths - should convert range quantifier to RepeatStep", () => {
  const query = "MATCH (u:User)-[:follows*1..3]->(f) RETURN f";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Repeat(emit: true, emitStart: 1, emitInput: false) {
         1. Edge(direction: "out", edgeLabels: ["follows"]) 
         2. Vertex(direction: "out", edgeLabels: []) 
       } as f times 3
    3. Select(pathLabels: ["f"]) 
    4. Values() "
  `);

  const repeatStep = steps[1] as RepeatStep<any>;
  expect(repeatStep.config.times).toBe(3);
});

test("AST to Steps Converter - Variable-length paths - should convert open-ended quantifier to RepeatStep with large limit", () => {
  const query = "MATCH (u:User)-[:follows*2..]->(f) RETURN f";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Repeat(emit: true, emitStart: 2, emitInput: false) {
         1. Edge(direction: "out", edgeLabels: ["follows"]) 
         2. Vertex(direction: "out", edgeLabels: []) 
       } as f times 100
    3. Select(pathLabels: ["f"]) 
    4. Values() "
  `);

  const repeatStep = steps[1] as RepeatStep<any>;
  expect(repeatStep.config.times).toBe(100);
});

test("AST to Steps Converter - Variable-length paths - should apply WHERE filter before variable-length path traversal", () => {
  const query =
    'MATCH (u:User)-[:follows*2]->(f) WHERE u.name = "Alice" RETURN f';
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);

  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. FilterElements[= expr {"type":"propertyRef","variable":"u","property":"name"}] 
    3. Repeat() {
         1. Edge(direction: "out", edgeLabels: ["follows"]) 
         2. Vertex(direction: "out", edgeLabels: []) 
       } as f times 2
    4. Select(pathLabels: ["f"]) 
    5. Values() "
  `);
});

test("AST to Steps Converter - Multi-hop traversal - should convert multi-hop pattern to multiple steps", () => {
  const query = "MATCH (u:User)-[:follows]->(f)-[:likes]->(p:Post) RETURN p";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Edge(direction: "out", edgeLabels: ["follows"]) 
    3. Vertex(direction: "other", edgeLabels: []) as f 
    4. Edge(direction: "out", edgeLabels: ["likes"]) 
    5. Vertex(direction: "other", edgeLabels: []) as p 
    6. FilterElements[@label = "Post"] 
    7. Select(pathLabels: ["p"]) 
    8. Values() "
  `);

  expect(steps.length).toBeGreaterThanOrEqual(7);

  expect(steps[0]).toBeInstanceOf(FetchVerticesStep);
  expect(steps[1]).toBeInstanceOf(EdgeStep);
  expect(steps[2]).toBeInstanceOf(VertexStep);
  expect(steps[3]).toBeInstanceOf(EdgeStep);
  expect(steps[4]).toBeInstanceOf(VertexStep);
});

test("AST to Steps Converter - WHERE clause - should convert simple condition to FilterElementsStep", () => {
  const query = "MATCH (u:User) WHERE u.age > 18 RETURN u";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. FilterElements[> expr {"type":"propertyRef","variable":"u","property":"age"}] 
    3. Select(pathLabels: ["u"]) 
    4. Values() "
  `);

  expect(steps).toHaveLength(4);
  expect(steps[1]).toBeInstanceOf(FilterElementsStep);
  expect(steps[2]).toBeInstanceOf(SelectStep);
  expect(steps[3]).toBeInstanceOf(ValuesStep);

  const filterStep = steps[1] as FilterElementsStep<any>;
  // PropertyCondition is now converted to ExpressionCondition with propertyRef
  expect(filterStep.config.condition).toEqual([
    "expr",
    ">",
    { type: "propertyRef", variable: "u", property: "age" },
    18,
  ]);
});

test("AST to Steps Converter - WHERE clause - should convert EXISTS condition", () => {
  const query = "MATCH (u:User) WHERE u.email EXISTS RETURN u";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. FilterElements[email exists] 
    3. Select(pathLabels: ["u"]) 
    4. Values() "
  `);

  const filterStep = steps[1] as FilterElementsStep<any>;
  expect(filterStep.config.condition).toEqual(["exists", "email"]);
});

test("AST to Steps Converter - WHERE clause - should convert AND condition", () => {
  const query = "MATCH (u:User) WHERE u.age > 18 AND u.active = true RETURN u";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. FilterElements[(> expr {"type":"propertyRef","variable":"u","property":"age"} and = expr {"type":"propertyRef","variable":"u","property":"active"})] 
    3. Select(pathLabels: ["u"]) 
    4. Values() "
  `);

  const filterStep = steps[1] as FilterElementsStep<any>;
  expect(filterStep.config.condition).toEqual([
    "and",
    ["expr", ">", { type: "propertyRef", variable: "u", property: "age" }, 18],
    [
      "expr",
      "=",
      { type: "propertyRef", variable: "u", property: "active" },
      true,
    ],
  ]);
});

test("AST to Steps Converter - WHERE clause - should convert OR condition", () => {
  const query = "MATCH (u:User) WHERE u.age < 25 OR u.verified = true RETURN u";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. FilterElements[(< expr {"type":"propertyRef","variable":"u","property":"age"} or = expr {"type":"propertyRef","variable":"u","property":"verified"})] 
    3. Select(pathLabels: ["u"]) 
    4. Values() "
  `);

  const filterStep = steps[1] as FilterElementsStep<any>;
  expect(filterStep.config.condition).toEqual([
    "or",
    ["expr", "<", { type: "propertyRef", variable: "u", property: "age" }, 25],
    [
      "expr",
      "=",
      { type: "propertyRef", variable: "u", property: "verified" },
      true,
    ],
  ]);
});

test("AST to Steps Converter - WHERE clause - should convert nested conditions", () => {
  const query =
    "MATCH (u:User) WHERE (u.age > 18 AND u.age < 65) OR u.verified = true RETURN u";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. FilterElements[((> expr {"type":"propertyRef","variable":"u","property":"age"} and < expr {"type":"propertyRef","variable":"u","property":"age"}) or = expr {"type":"propertyRef","variable":"u","property":"verified"})] 
    3. Select(pathLabels: ["u"]) 
    4. Values() "
  `);

  const filterStep = steps[1] as FilterElementsStep<any>;
  const condition = filterStep.config.condition;

  expect(condition[0]).toBe("or");
  expect((condition[1] as any)[0]).toBe("and");
});

test("AST to Steps Converter - RETURN clause - should add DedupStep for DISTINCT", () => {
  const query = "MATCH (u:User) RETURN DISTINCT u";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Select(pathLabels: ["u"]) 
    3. Values() 
    4. Dedup() "
  `);

  expect(steps).toHaveLength(4);
  expect(steps[0]).toBeInstanceOf(FetchVerticesStep);
  expect(steps[1]).toBeInstanceOf(SelectStep);
  expect(steps[2]).toBeInstanceOf(ValuesStep);
  expect(steps[3]).toBeInstanceOf(DedupStep);
});

test("AST to Steps Converter - RETURN clause - should add CountStep for COUNT aggregate", () => {
  const query = "MATCH (u:User) RETURN COUNT(u)";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Count() "
  `);

  expect(steps).toHaveLength(2);
  expect(steps[1]).toBeInstanceOf(CountStep);
});

test("AST to Steps Converter - ORDER BY clause - should convert ORDER BY to OrderStep", () => {
  const query = "MATCH (u:User) RETURN u ORDER BY u.name";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Order(directions: [{"key":"name","direction":"asc"}]) 
    3. Select(pathLabels: ["u"]) 
    4. Values() "
  `);

  expect(steps).toHaveLength(4);
  expect(steps[1]).toBeInstanceOf(OrderStep);
  expect(steps[2]).toBeInstanceOf(SelectStep);
  expect(steps[3]).toBeInstanceOf(ValuesStep);

  const orderStep = steps[1] as OrderStep;
  expect(orderStep.config.directions).toEqual([
    { key: "name", direction: "asc" },
  ]);
});

test("AST to Steps Converter - ORDER BY clause - should handle DESC direction", () => {
  const query = "MATCH (u:User) RETURN u ORDER BY u.age DESC";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Order(directions: [{"key":"age","direction":"desc"}]) 
    3. Select(pathLabels: ["u"]) 
    4. Values() "
  `);

  const orderStep = steps[1] as OrderStep;
  expect(orderStep.config.directions[0]!.direction).toBe("desc");
});

test("AST to Steps Converter - ORDER BY clause - should handle multiple order clauses", () => {
  const query =
    "MATCH (u:User) RETURN u ORDER BY u.lastName ASC, u.firstName ASC";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Order(directions: [{"key":"lastName","direction":"asc"},{"key":"firstName","direction":"asc"}]) 
    3. Select(pathLabels: ["u"]) 
    4. Values() "
  `);

  const orderStep = steps[1] as OrderStep;
  expect(orderStep.config.directions).toHaveLength(2);
  expect(orderStep.config.directions[0]!.key).toBe("lastName");
  expect(orderStep.config.directions[1]!.key).toBe("firstName");
});

test("AST to Steps Converter - SKIP and LIMIT - should convert LIMIT to RangeStep", () => {
  const query = "MATCH (u:User) RETURN u LIMIT 10";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Range(start: 0, end: 10) 
    3. Select(pathLabels: ["u"]) 
    4. Values() "
  `);

  expect(steps).toHaveLength(4);
  expect(steps[1]).toBeInstanceOf(RangeStep);
  expect(steps[2]).toBeInstanceOf(SelectStep);
  expect(steps[3]).toBeInstanceOf(ValuesStep);

  const rangeStep = steps[1] as RangeStep;
  expect(rangeStep.config.start).toBe(0);
  expect(rangeStep.config.end).toBe(10);
});

test("AST to Steps Converter - SKIP and LIMIT - should convert SKIP to RangeStep", () => {
  const query = "MATCH (u:User) RETURN u SKIP 5";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Range(start: 5, end: 9007199254740991) 
    3. Select(pathLabels: ["u"]) 
    4. Values() "
  `);

  const rangeStep = steps[1] as RangeStep;
  expect(rangeStep.config.start).toBe(5);
  expect(rangeStep.config.end).toBe(Number.MAX_SAFE_INTEGER);
});

test("AST to Steps Converter - SKIP and LIMIT - should convert SKIP and LIMIT together", () => {
  const query = "MATCH (u:User) RETURN u SKIP 5 LIMIT 10";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Range(start: 5, end: 15) 
    3. Select(pathLabels: ["u"]) 
    4. Values() "
  `);

  const rangeStep = steps[1] as RangeStep;
  expect(rangeStep.config.start).toBe(5);
  expect(rangeStep.config.end).toBe(15);
});

test("AST to Steps Converter - Complex queries - should convert a full complex query correctly", () => {
  const query = `
    MATCH (u:User)-[:follows]->(f)
    WHERE u.age > 18 AND f.active = true
    RETURN DISTINCT f
    ORDER BY f.name DESC
    LIMIT 10
  `;
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. FilterElements[> expr {"type":"propertyRef","variable":"u","property":"age"}] 
    3. Edge(direction: "out", edgeLabels: ["follows"]) 
    4. Vertex(direction: "other", edgeLabels: []) as f 
    5. FilterElements[= expr {"type":"propertyRef","variable":"f","property":"active"}] 
    6. Order(directions: [{"key":"name","direction":"desc"}]) 
    7. Range(start: 0, end: 10) 
    8. Select(pathLabels: ["f"]) 
    9. Values() 
    10. Dedup() "
  `);

  // Should have: FetchVerticesStep, FilterElementsStep, EdgeStep, VertexStep,
  //              FilterElementsStep, OrderStep, RangeStep, SelectStep, ValuesStep, DedupStep
  expect(steps.length).toBeGreaterThanOrEqual(6);

  // Verify presence of key steps
  expect(steps.some((s) => s instanceof FetchVerticesStep)).toBe(true);
  expect(steps.some((s) => s instanceof VertexStep)).toBe(true);
  expect(steps.some((s) => s instanceof FilterElementsStep)).toBe(true);
  expect(steps.some((s) => s instanceof SelectStep)).toBe(true);
  expect(steps.some((s) => s instanceof ValuesStep)).toBe(true);
  expect(steps.some((s) => s instanceof DedupStep)).toBe(true);
  expect(steps.some((s) => s instanceof OrderStep)).toBe(true);
  expect(steps.some((s) => s instanceof RangeStep)).toBe(true);
});

test("AST to Steps Converter - Complex queries - should handle multi-hop with filters and aggregation", () => {
  const query = `
    MATCH (u:User)-[:follows]->(f)-[:likes]->(p:Post)
    WHERE u.age > 18
    RETURN COUNT(p)
  `;
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. FilterElements[> expr {"type":"propertyRef","variable":"u","property":"age"}] 
    3. Edge(direction: "out", edgeLabels: ["follows"]) 
    4. Vertex(direction: "other", edgeLabels: []) as f 
    5. Edge(direction: "out", edgeLabels: ["likes"]) 
    6. Vertex(direction: "other", edgeLabels: []) as p 
    7. FilterElements[@label = "Post"] 
    8. Count() "
  `);

  // Should have multiple VertexSteps for the path
  const vertexSteps = steps.filter((s) => s instanceof VertexStep);
  expect(vertexSteps.length).toBe(2);

  // Should have FilterElementsStep for WHERE
  expect(steps.some((s) => s instanceof FilterElementsStep)).toBe(true);

  // Should have CountStep for COUNT aggregate
  expect(steps.some((s) => s instanceof CountStep)).toBe(true);
});

test("AST to Steps Converter - Edge cases - should handle queries without WHERE clause", () => {
  const query = "MATCH (u:User) RETURN u";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Select(pathLabels: ["u"]) 
    3. Values() "
  `);

  expect(steps.every((s) => !(s instanceof FilterElementsStep))).toBe(true);
});

test("AST to Steps Converter - Edge cases - should handle queries without ORDER BY", () => {
  const query = "MATCH (u:User) RETURN u";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Select(pathLabels: ["u"]) 
    3. Values() "
  `);

  expect(steps.every((s) => !(s instanceof OrderStep))).toBe(true);
});

test("AST to Steps Converter - Edge cases - should handle queries without SKIP/LIMIT", () => {
  const query = "MATCH (u:User) RETURN u";
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);
  expect(dumpSteps(steps)).toMatchInlineSnapshot(`
    "1. FetchVertices(vertexLabels: ["User"]) as u 
    2. Select(pathLabels: ["u"]) 
    3. Values() "
  `);

  expect(steps.every((s) => !(s instanceof RangeStep))).toBe(true);
});
