import { expect, test, describe, beforeEach, afterEach } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import { createDemoGraph } from "../getDemoGraph.js";
import type { Query, PropertyMap, NodePattern, Pattern } from "../AST.js";

function createTestGraph() {
  const demo = createDemoGraph();
  return { graph: demo.graph, alice: demo.alice, bob: demo.bob };
}

describe("MERGE with parameter properties - Grammar parsing", () => {
  test("parses MERGE node with parameter in property value", () => {
    const query = "MERGE (u:Person {name: $name}) RETURN u";
    const ast = parse(query) as Query;

    expect(ast.type).toBe("Query");
    expect(ast.merge).toHaveLength(1);
    const mergeClause = ast.merge![0]!;
    expect(mergeClause.pattern.type).toBe("NodePattern");

    const nodePattern = mergeClause.pattern as {
      type: "NodePattern";
      properties?: PropertyMap;
    };
    expect(nodePattern.properties).toBeDefined();
    expect(nodePattern.properties!.name).toEqual({
      type: "ParameterRef",
      name: "name",
    });
  });

  test("parses MERGE with mixed literal and parameter properties", () => {
    const query = "MERGE (u:Person {name: $name, age: 25}) RETURN u";
    const ast = parse(query) as Query;

    const mergeClause = ast.merge![0]!;
    const nodePattern = mergeClause.pattern as {
      type: "NodePattern";
      properties?: PropertyMap;
    };
    expect(nodePattern.properties).toBeDefined();

    // Parameter property
    expect(nodePattern.properties!.name).toEqual({
      type: "ParameterRef",
      name: "name",
    });

    // Literal property
    expect(nodePattern.properties!.age).toBe(25);
  });

  test("parses MERGE relationship with parameter properties", () => {
    const query =
      "MATCH (a:Person), (b:Person) MERGE (a)-[r:knows {since: $year}]->(b) RETURN r";
    const ast = parse(query) as Query;

    expect(ast.merge).toHaveLength(1);
    const mergeClause = ast.merge![0]!;
    expect(mergeClause.pattern.type).toBe("MergeRelationshipPattern");

    const relPattern = mergeClause.pattern as {
      type: "MergeRelationshipPattern";
      edge: { properties?: PropertyMap };
    };
    expect(relPattern.edge.properties).toBeDefined();
    expect(relPattern.edge.properties!.since).toEqual({
      type: "ParameterRef",
      name: "year",
    });
  });

  test("parses MATCH with parameter in property map", () => {
    const query = "MATCH (u:Person {name: $name}) RETURN u";
    const ast = parse(query) as Query;

    expect(ast.matches).toHaveLength(1);
    const pattern = ast.matches[0]!.pattern as Pattern;
    const nodePattern = pattern.elements[0] as NodePattern;
    expect(nodePattern.properties).toBeDefined();
    expect(nodePattern.properties!.name).toEqual({
      type: "ParameterRef",
      name: "name",
    });
  });

  test("parses CREATE with parameter in property map", () => {
    const query = "CREATE (u:Person {name: $name, age: $age}) RETURN u";
    const ast = parse(query) as Query;

    expect(ast.create).toBeDefined();
    const createPattern = ast.create!.patterns[0] as {
      type: "CreateNodePattern";
      properties?: PropertyMap;
    };
    expect(createPattern.properties).toBeDefined();
    expect(createPattern.properties!.name).toEqual({
      type: "ParameterRef",
      name: "name",
    });
    expect(createPattern.properties!.age).toEqual({
      type: "ParameterRef",
      name: "age",
    });
  });
});

describe("MERGE with parameter properties - Step conversion", () => {
  test("converts MERGE with parameter properties to MergeStep", () => {
    const query = "MERGE (u:Person {name: $name}) RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);

    const mergeStep = steps.find((s) => s.name === "Merge");
    expect(mergeStep).toBeDefined();

    // The properties should contain the parameter reference structure
    const config = (mergeStep as any).config;
    expect(config.pattern.type).toBe("node");
    expect(config.pattern.properties).toBeDefined();
    // Property value should be the ParameterRef object
    expect(config.pattern.properties.name).toEqual({
      type: "ParameterRef",
      name: "name",
    });
  });
});

describe("MERGE with parameter properties - Query execution", () => {
  beforeEach(() => {
    clearQueryParams();
  });

  afterEach(() => {
    clearQueryParams();
  });

  test("MERGE creates node when no match found using parameter", () => {
    const { graph } = createTestGraph();

    // Count initial persons (demo graph has 7)
    const initialPersonCount = [...graph.getVertices("Person")].length;

    // Set parameter for a name that doesn't exist
    setQueryParams({ name: "Zephyr" });

    const query = "MERGE (u:Person {name: $name}) RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];

    expect(results).toHaveLength(1);
    // Result is an array containing the vertex
    const resultVertex = (results[0] as any[])[0];
    expect(resultVertex.get("name")).toBe("Zephyr");

    // Verify a new vertex was created
    const allPersons = [...graph.getVertices("Person")];
    expect(allPersons).toHaveLength(initialPersonCount + 1);
  });

  test("MERGE matches existing node using parameter", () => {
    const { graph, alice } = createTestGraph();

    // Count initial persons (demo graph has 7)
    const initialPersonCount = [...graph.getVertices("Person")].length;

    // Set parameter for a name that exists
    setQueryParams({ name: "Alice" });

    const query = "MERGE (u:Person {name: $name}) RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];

    expect(results).toHaveLength(1);
    const resultVertex = (results[0] as any[])[0];
    expect(resultVertex.id).toBe(alice.id);

    // Verify no new vertex was created
    const allPersons = [...graph.getVertices("Person")];
    expect(allPersons).toHaveLength(initialPersonCount);
  });

  test("MERGE with mixed literal and parameter properties", () => {
    const { graph } = createTestGraph();

    setQueryParams({ name: "David" });

    const query = "MERGE (u:Person {name: $name, age: 35}) RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];

    expect(results).toHaveLength(1);
    const resultVertex = (results[0] as any[])[0];
    expect(resultVertex.get("name")).toBe("David");
    expect(resultVertex.get("age")).toBe(35);
  });

  test("MERGE creates relationship with parameter property", () => {
    const { graph } = createTestGraph();

    setQueryParams({ rating: 5 });

    const query = `
      MATCH (a:Person {name: 'Alice'}), (b:Person {name: 'Bob'})
      MERGE (a)-[r:rates {rating: $rating}]->(b)
      RETURN r
    `;
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];

    expect(results).toHaveLength(1);
    const resultEdge = (results[0] as any[])[0];
    expect(resultEdge.get("rating")).toBe(5);
    expect(resultEdge.label).toBe("rates");
  });

  test("MERGE matches existing relationship with no properties", () => {
    const { graph } = createTestGraph();

    // The demo graph has Alice->knows->Bob with no properties
    // MERGE with empty property map should match the existing edge

    const query = `
      MATCH (a:Person {name: 'Alice'}), (b:Person {name: 'Bob'})
      MERGE (a)-[r:knows]->(b)
      RETURN r
    `;
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    // Count existing knows edges from Alice before MERGE
    const aliceVertex = [...graph.getVertices("Person")].find(
      (v) => v.get("name") === "Alice",
    )!;
    const initialEdges = [...graph.getOutgoingEdges(aliceVertex.id)];
    const initialKnowsEdges = initialEdges.filter((e) => e.label === "knows");
    const initialKnowsCount = initialKnowsEdges.length;

    const results = [...traverser.traverse(graph, [undefined])];

    expect(results).toHaveLength(1);
    const resultEdge = (results[0] as any[])[0];
    expect(resultEdge.label).toBe("knows");

    // Should not create a new edge - existing one should match
    const edges = [...graph.getOutgoingEdges(aliceVertex.id)];
    const knowsEdges = edges.filter((e) => e.label === "knows");
    expect(knowsEdges).toHaveLength(initialKnowsCount);
  });

  test("MERGE creates relationship when property required", () => {
    const { graph } = createTestGraph();

    // The existing 'knows' edges have no properties, so requiring {since: $year}
    // should create a new edge with that property
    setQueryParams({ year: 2023 });

    const query = `
      MATCH (a:Person {name: 'Alice'}), (b:Person {name: 'Bob'})
      MERGE (a)-[r:knows {since: $year}]->(b)
      RETURN r
    `;
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    // Count existing knows edges from Alice before MERGE
    const aliceVertex = [...graph.getVertices("Person")].find(
      (v) => v.get("name") === "Alice",
    )!;
    const initialEdges = [...graph.getOutgoingEdges(aliceVertex.id)];
    const initialKnowsEdges = initialEdges.filter((e) => e.label === "knows");
    const initialKnowsCount = initialKnowsEdges.length;

    const results = [...traverser.traverse(graph, [undefined])];

    expect(results).toHaveLength(1);
    const resultEdge = (results[0] as any[])[0];
    expect(resultEdge.get("since")).toBe(2023);

    // Should create a new edge since the existing edges don't have the property
    const edges = [...graph.getOutgoingEdges(aliceVertex.id)];
    const knowsEdges = edges.filter((e) => e.label === "knows");
    expect(knowsEdges).toHaveLength(initialKnowsCount + 1);
  });

  test("MERGE with multiple parameters", () => {
    const { graph } = createTestGraph();

    setQueryParams({ name: "Eve", age: 28, city: "NYC" });

    const query =
      "MERGE (u:Person {name: $name, age: $age, city: $city}) RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];

    expect(results).toHaveLength(1);
    const resultVertex = (results[0] as any[])[0];
    expect(resultVertex.get("name")).toBe("Eve");
    expect(resultVertex.get("age")).toBe(28);
    expect(resultVertex.get("city")).toBe("NYC");
  });

  test("MERGE with null parameter value", () => {
    const { graph } = createTestGraph();

    setQueryParams({ name: "Frank", status: null });

    const query = "MERGE (u:Person {name: $name, status: $status}) RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];

    expect(results).toHaveLength(1);
    const resultVertex = (results[0] as any[])[0];
    expect(resultVertex.get("name")).toBe("Frank");
    expect(resultVertex.get("status")).toBe(null);
  });

  test("MERGE with boolean parameter value", () => {
    const { graph } = createTestGraph();

    setQueryParams({ name: "Grace", active: true });

    const query = "MERGE (u:Person {name: $name, active: $active}) RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];

    expect(results).toHaveLength(1);
    const resultVertex = (results[0] as any[])[0];
    expect(resultVertex.get("name")).toBe("Grace");
    expect(resultVertex.get("active")).toBe(true);
  });
});

describe("MERGE with ON CREATE/ON MATCH and parameters", () => {
  beforeEach(() => {
    clearQueryParams();
  });

  afterEach(() => {
    clearQueryParams();
  });

  test("MERGE with ON CREATE SET using parameter", () => {
    const { graph } = createTestGraph();

    setQueryParams({ name: "Henry", createdBy: "system" });

    const query =
      "MERGE (u:Person {name: $name}) ON CREATE SET u.createdBy = $createdBy RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];

    expect(results).toHaveLength(1);
    const resultVertex = (results[0] as any[])[0];
    expect(resultVertex.get("name")).toBe("Henry");
    expect(resultVertex.get("createdBy")).toBe("system");
  });

  test("MERGE with ON MATCH SET when matching with parameter", () => {
    const { graph, alice } = createTestGraph();

    setQueryParams({ name: "Alice", updatedAt: "2024-01-01" });

    const query =
      "MERGE (u:Person {name: $name}) ON MATCH SET u.updatedAt = $updatedAt RETURN u";
    const ast = parse(query) as Query;
    const steps = astToSteps(ast);
    const traverser = createTraverser(steps);

    const results = [...traverser.traverse(graph, [undefined])];

    expect(results).toHaveLength(1);
    const resultVertex = (results[0] as any[])[0];
    expect(resultVertex.id).toBe(alice.id);
    expect(resultVertex.get("updatedAt")).toBe("2024-01-01");
  });
});
