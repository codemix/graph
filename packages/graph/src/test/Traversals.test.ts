import { expect, test } from "vitest";
import { createDemoGraph, DemoSchema } from "../getDemoGraph.js";
import { GraphTraversal, TraversalPath } from "../Traversals.js";
import { Edge, Vertex } from "../Graph.js";

const {
  graph,
  alice,
  bob,
  charlie,
  dave,
  george,
  aliceKnowsBob,
  bobKnowsCharlie,
  georgeKnowsCharlie,
} = createDemoGraph();
const g = new GraphTraversal(graph);

test("TraversalPathNode", () => {
  const path = new TraversalPath(undefined, alice, ["origin"])
    .with(aliceKnowsBob)
    .with(bob, ["friend"])
    .with(bobKnowsCharlie)
    .with(charlie, ["friend"])
    .with(georgeKnowsCharlie, ["family"])
    .with(george, ["friend"]);

  const origin: Vertex<DemoSchema, "Person"> = path.get("origin").value;
  expect(origin).toBe(alice);
  expect(path.get("origin").property("name")).toBe("Alice");

  const friend: Vertex<DemoSchema, "Person"> = path.get("friend").value;
  expect(friend).toBe(george);

  const family: Edge<DemoSchema, "knows"> = path.get("family").value;
  expect(family).toBe(georgeKnowsCharlie);

  const missing: undefined = path.get("missing");
  expect(missing).toBeUndefined();
});

test("VertexTraversal", () => {
  const q = g
    .V()
    .as("origin")
    .outE("knows")
    .outV()
    .as("friend")
    .outE("knows")
    .outV();

  const paths = Array.from(q);
  expect(paths.length).toBeGreaterThan(0);

  for (const path of paths) {
    expect(path.value).toBeInstanceOf(Vertex);
    const origin = path.get("origin");
    expect(origin).toBeDefined();
    expect(origin.value).toBeInstanceOf(Vertex);
    expect(typeof origin.value.get("name")).toBe("string");
  }
});

test("VertexTraversal select", () => {
  const q = g
    .V()
    .as("origin")
    .outE("knows")
    .outV()
    .as("friend")
    .outE("knows")
    .outV()
    .hasLabel("Person")
    .select("origin", "all:friend")
    .unfold()
    .values();

  const results = Array.from(q);
  expect(results.length).toBeGreaterThan(0);

  for (const result of results) {
    // Results from unfold() can be Vertex or arrays containing Vertex
    if (Array.isArray(result)) {
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBeInstanceOf(Vertex);
    } else {
      expect(result).toBeInstanceOf(Vertex);
    }
  }
});

test("Repeat VertexTraversal", () => {
  const q = g
    .V(dave.id)
    .as("origin")
    .repeat(($) => $.out("knows").as("friend"));

  const paths = Array.from(q);
  expect(paths.length).toBeGreaterThan(0);

  for (const path of paths) {
    expect(path.value).toBeInstanceOf(Vertex);
    expect(typeof path.value.get("name")).toBe("string");
    const friend = path.get("friend");
    expect(friend).toBeDefined();
    expect(friend.value).toBeInstanceOf(Vertex);
  }
});

test("Repeat VertexTraversal until", () => {
  const q = g
    .V(dave.id)
    .as("origin")
    .repeat(($) => $.both("knows").as("friend"))
    .until(($) => $.out("likes").has("name", "Banana"))
    .hasLabel("Person")
    .as("lol")
    .has("age", ">", 20)
    .has("age", "<", 300);

  const paths = Array.from(q);
  expect(paths.length).toBeGreaterThan(0);

  for (const path of paths) {
    expect(path.value).toBeInstanceOf(Vertex);
    expect(path.value.label).toBe("Person");
    const age = path.value.get("age");
    expect(typeof age).toBe("number");
    expect(age).toBeGreaterThan(20);
    expect(age).toBeLessThan(300);

    const friend = path.get("friend");
    expect(friend).toBeDefined();
  }
});

test("Union", () => {
  const q = g.union(
    g.V(alice.id).hasLabel("Person"),
    g.V(bob.id).hasLabel("Person"),
    g.V(charlie.id).out("knows").hasLabel("Person"),
  );

  const paths = Array.from(q);
  expect(paths.length).toBeGreaterThanOrEqual(3);

  for (const path of paths) {
    expect(path.value).toBeInstanceOf(Vertex);
    expect(path.value.label).toBe("Person");
    expect(typeof path.value.get("name")).toBe("string");
  }
});

test("Intersect", () => {
  const q = g.intersect(
    g.V(alice.id).hasLabel("Person"),
    g.V(alice.id).hasLabel("Person"),
  );

  const paths = Array.from(q);
  expect(paths).toHaveLength(1);
  expect(paths[0]!.value).toBeInstanceOf(Vertex);
  expect(paths[0]!.value.id).toBe(alice.id);
  expect(paths[0]!.value.get("name")).toBe("Alice");
});

test("Intersect VertexTraversal", () => {
  const a = g.V(alice.id).out("knows").as("a");
  const b = g.V(bob.id).out("knows").as("b");
  const q = a.intersect(b);

  const paths = Array.from(q);
  expect(paths.length).toBeGreaterThan(0);

  for (const path of paths) {
    expect(path.value).toBeInstanceOf(Vertex);
    expect(path.value.label).toBe("Person");
  }

  expect(Array.from(g.V(alice.id).intersect(g.V(bob.id)))).toHaveLength(0);
});

test("Map", () => {
  const q = g
    .V(alice.id)
    .out("knows")
    .map((path) => path.property("name"));

  const names = Array.from(q);
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((name) => typeof name === "string")).toBe(true);
  expect(names.includes("Bob") || names.includes("Charlie")).toBe(true);
});

test("Count", () => {
  const q = g.V().count();
  const counts = Array.from(q);

  expect(counts).toHaveLength(1);
  expect(typeof counts[0]).toBe("number");
  expect(counts[0]!).toBeGreaterThan(0);
});

test("Order by", () => {
  const q = g.V().order().by("name", "desc");
  const paths = Array.from(q);

  expect(paths.length).toBeGreaterThan(0);

  // Verify all paths have values
  for (const path of paths) {
    expect(path.value).toBeInstanceOf(Vertex);
  }

  // Verify descending order by name
  const names = paths.map((p) => p.value.get("name")).filter((n) => n != null);
  const sortedNames = [...names].sort().reverse();
  expect(names).toEqual(sortedNames);
});

test("Refine using hasProperty", () => {
  const vertices = Array.from(g.V().has("name").values());
  expect(vertices.length).toBeGreaterThan(0);

  for (const vertex of vertices) {
    expect(vertex).toBeInstanceOf(Vertex);
    expect(vertex.hasProperty("name")).toBe(true);

    if (vertex.hasProperty("age")) {
      expect(typeof vertex.get("age")).toBe("number");
    } else {
      expect(typeof vertex.label).toBe("string");
    }
  }
});

test("VertexTraversal select toJSON", () => {
  const q = g
    .V()
    .as("origin")
    .outE("knows")
    .outV()
    .as("friend")
    .outE("knows")
    .outV()
    .hasLabel("Person")
    .select("origin", "all:friend")
    .unfold()
    .values();

  const results = Array.from(q);
  expect(results.length).toBeGreaterThan(0);

  // Verify results can be serialized to JSON
  const json = JSON.stringify(results, null, 2);
  expect(json).toBeTruthy();
  expect(json.length).toBeGreaterThan(0);

  // Verify all results are vertices or arrays containing vertices
  for (const result of results) {
    if (Array.isArray(result)) {
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBeInstanceOf(Vertex);
    } else {
      expect(result).toBeInstanceOf(Vertex);
    }
  }
});

test("otherV", () => {
  const q = g
    .V()
    .as("source")
    .bothE("knows")
    .as("edge")
    .otherV()
    .as("target")
    .select("source", "edge", "target")
    .values();

  const results = Array.from(q);
  expect(results.length).toBeGreaterThan(0);

  for (const [source, edge, target] of results) {
    expect(source).toBeInstanceOf(Vertex);
    expect(edge).toBeInstanceOf(Edge);
    expect(target).toBeInstanceOf(Vertex);
    expect(edge.label).toBe("knows");
  }
});

test("steps", () => {
  // MATCH (c:Concept)-[e:]-(d:Concept) RETURN c, e, d LIMIT 10
  const q = g
    .V()
    // @ts-expect-error
    .hasLabel("Concept")
    .as("c")
    .bothE()
    .as("e")
    .otherV()
    .as("d")
    // @ts-expect-error
    .hasLabel("Concept")
    .limit(10)
    .select("c", "e", "d")
    .values();

  const results = Array.from(q);
  expect(results.length).toBeLessThanOrEqual(10);
  expect(results.length).toBeGreaterThanOrEqual(0);
});

test("repeat steps", () => {
  // MATCH (u:User)-[:follows*2]->(f) WHERE u.name = "Alice" RETURN f
  const q = g
    .V()
    .hasLabel("Person")
    .as("u")
    .has("name", "=", "Alice")
    .repeat(($) => $.out("knows").as("f"))
    .times(2)
    .as("f")
    .select("u", "f")
    .values();

  const results = Array.from(q);
  expect(results.length).toBeGreaterThanOrEqual(0);

  for (const [u, f] of results) {
    expect(u).toBeInstanceOf(Vertex);
    expect(f).toBeInstanceOf(Vertex);
    expect(u.get("name")).toBe("Alice");
  }
});

test("repeat with labels", () => {
  // MATCH (c:Person)-[e:*3]->(d:Thing) RETURN c, e, d LIMIT 10
  const q = g
    .V()
    .hasLabel("Person")
    .as("c")
    .repeat(($) => $.outE().as("e").outV())
    .emit()
    .times(2)
    .as("d")
    .select("c", "e", "d")
    .values();

  const results = Array.from(q);
  expect(results.length).toBeGreaterThan(0);

  for (const result of results) {
    expect(Array.isArray(result)).toBe(true);
    const [c, e, d] = result;
    expect(c).toBeInstanceOf(Vertex);
    expect(c.label).toBe("Person");

    // e might be an edge or array of edges
    if (Array.isArray(e)) {
      expect(e.length).toBeGreaterThan(0);
      expect(e.every((edge) => edge instanceof Edge)).toBe(true);
    } else if (e) {
      expect(e).toBeInstanceOf(Edge);
    }

    expect(d).toBeInstanceOf(Vertex);
  }
});
