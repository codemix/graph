import { test, expect } from "vitest";
import { Vertex } from "../Graph.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { CreateStep } from "../Steps.js";
import type { Query, CreateNodePattern } from "../AST.js";
import { dumpSteps, executeQuery, createUserPostGraph } from "./testHelpers.js";

test("CREATE clause - Grammar parsing - should parse CREATE (u:User) RETURN u", () => {
  const query = `MATCH (x:User) CREATE (u:User) RETURN u`;
  const ast = parse(query) as Query;

  expect(ast.type).toBe("Query");
  expect(ast.create).toBeDefined();
  expect(ast.create!.type).toBe("CreateClause");
  expect(ast.create!.patterns).toHaveLength(1);

  const pattern = ast.create!.patterns[0] as CreateNodePattern;
  expect(pattern.type).toBe("CreateNodePattern");
  expect(pattern.variable).toBe("u");
  expect(pattern.labels).toEqual(["User"]);
});

test("CREATE clause - Grammar parsing - should parse CREATE with properties", () => {
  const query = `MATCH (x:User) CREATE (u:User {name: "Alice", age: 30}) RETURN u`;
  const ast = parse(query) as Query;

  expect(ast.create).toBeDefined();
  const pattern = ast.create!.patterns[0] as CreateNodePattern;
  expect(pattern.properties).toEqual({ name: "Alice", age: 30 });
});

test("CREATE clause - Grammar parsing - should parse CREATE with multiple patterns", () => {
  const query = `MATCH (x:User) CREATE (u:User {name: "Alice"}), (p:Post {title: "Hello"}) RETURN u, p`;
  const ast = parse(query) as Query;

  expect(ast.create!.patterns).toHaveLength(2);
  expect((ast.create!.patterns[0] as CreateNodePattern).labels).toEqual([
    "User",
  ]);
  expect((ast.create!.patterns[1] as CreateNodePattern).labels).toEqual([
    "Post",
  ]);
});

test("CREATE clause - AST to Steps conversion - should convert CREATE clause to CreateStep", () => {
  const query = `MATCH (x:User) CREATE (u:User {name: "Alice"}) RETURN u`;
  const ast = parse(query) as Query;
  const steps = astToSteps(ast);

  expect(dumpSteps(steps)).toContain("Create");

  const createStep = steps.find((s) => s instanceof CreateStep);
  expect(createStep).toBeDefined();
  expect((createStep as CreateStep).config.vertices).toHaveLength(1);
  expect((createStep as CreateStep).config.vertices[0]).toEqual({
    variable: "u",
    label: "User",
    properties: { name: "Alice" },
  });
});

test("CREATE clause - Query execution - should create a vertex with properties", () => {
  const graph = createUserPostGraph();

  // First add a user so MATCH has something to match
  graph.addVertex("User", { name: "Existing", age: 0 });

  const results = executeQuery(
    graph,
    `MATCH (x:User) CREATE (u:User {name: "Alice", age: 25}) RETURN u`,
  );

  expect(results).toHaveLength(1);
  const created = (results[0] as any[])[0];
  expect(created).toBeInstanceOf(Vertex);
  expect(created.get("name")).toBe("Alice");
  expect(created.get("age")).toBe(25);
  expect(created.label).toBe("User");
});

test("CREATE clause - Query execution - should create multiple vertices", () => {
  const graph = createUserPostGraph();

  // First add a user so MATCH has something to match
  graph.addVertex("User", { name: "Existing", age: 0 });

  const results = executeQuery(
    graph,
    `MATCH (x:User) CREATE (u:User {name: "Bob"}), (p:Post {title: "Hello"}) RETURN u, p`,
  );

  expect(results).toHaveLength(1);
  const row = results[0] as any[];
  expect(row).toHaveLength(2);
  expect(row[0].get("name")).toBe("Bob");
  expect(row[1].get("title")).toBe("Hello");
});

test("CREATE clause - Query execution - should add vertices to the graph", () => {
  const graph = createUserPostGraph();

  // First add a user so MATCH has something to match
  graph.addVertex("User", { name: "Existing", age: 0 });

  const initialCount = Array.from(graph.getVertices("User")).length;

  executeQuery(
    graph,
    `MATCH (x:User) CREATE (u:User {name: "NewUser"}) RETURN u`,
  );

  const finalCount = Array.from(graph.getVertices("User")).length;
  expect(finalCount).toBe(initialCount + 1);
});
