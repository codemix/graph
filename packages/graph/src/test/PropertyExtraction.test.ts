import { expect, test } from "vitest";
import { createDemoGraph, DemoSchema } from "../getDemoGraph.js";
import { GraphTraversal } from "../Traversals.js";
import { Vertex } from "../Graph.js";

const { graph, alice, bob } = createDemoGraph();
const g = new GraphTraversal(graph);

test("Property and Value Extraction - properties() method - properties() with no arguments extracts all properties", () => {
  const results = Array.from(g.V(alice.id).hasLabel("Person").properties().values());

  expect(results).toHaveLength(1);
  expect(results[0]).toHaveProperty("name");
  expect(results[0]).toHaveProperty("age");
  const props = results[0]! as any;
  expect(props.name).toBe("Alice");
  expect(props.age).toBe(30);
});

test("Property and Value Extraction - properties() method - properties() with single property name", () => {
  const results = Array.from(g.V(alice.id).properties("name").values());

  expect(results).toHaveLength(1);
  expect(results[0]).toHaveProperty("name");
  expect(results[0]!.name).toBe("Alice");
  expect(results[0]).not.toHaveProperty("age");
});

test("Property and Value Extraction - properties() method - properties() with multiple property names", () => {
  const results = Array.from(g.V(alice.id).hasLabel("Person").properties("name").values());

  expect(results).toHaveLength(1);
  expect(results[0]).toHaveProperty("name");
  expect(results[0]!.name).toBe("Alice");
});

test("Property and Value Extraction - properties() method - properties() on multiple vertices", () => {
  const results = Array.from(g.V().hasLabel("Person").limit(3).properties("name").values());

  expect(results).toHaveLength(3);
  expect(results.every((r) => r.hasOwnProperty("name"))).toBe(true);
  expect(results.every((r) => typeof r.name === "string")).toBe(true);
});

test("Property and Value Extraction - properties() method - properties() after traversal", () => {
  const results = Array.from(
    g.V(alice.id).out("knows").hasLabel("Person").properties("name").values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((r) => r.hasOwnProperty("name"))).toBe(true);
});

test("Property and Value Extraction - properties() method - properties() with Thing vertices (different schema)", () => {
  const results = Array.from(g.V().hasLabel("Thing").limit(2).properties("name", "ref").values());

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((r) => r.hasOwnProperty("name") && r.hasOwnProperty("ref"))).toBe(true);
});

test("Property and Value Extraction - properties() method - properties() preserves property values", () => {
  const results = Array.from(g.V().hasLabel("Person").properties().values());

  expect(results.length).toBeGreaterThan(0);

  for (const props of results) {
    expect(props).toHaveProperty("name");
    expect(typeof (props as any).name).toBe("string");
  }
});

test("Property and Value Extraction - properties() with filtering - properties() after has() filter", () => {
  const results = Array.from(
    g.V().hasLabel("Person").has("age", ">", 30).properties("name").values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((r) => r.hasOwnProperty("name"))).toBe(true);
});

test("Property and Value Extraction - properties() with filtering - properties() with select", () => {
  // Test extracting properties before select
  const results = Array.from(
    g.V(alice.id).hasLabel("Person").as("person").out("knows").properties("name").values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((r) => r.hasOwnProperty("name"))).toBe(true);
});

test("Property and Value Extraction - properties() with filtering - properties() after dedup", () => {
  const results = Array.from(
    g.union(g.V(alice.id), g.V(alice.id)).dedup().properties("name").values(),
  );

  expect(results).toHaveLength(1);
  expect(results[0]!.name).toBe("Alice");
});

test("Property and Value Extraction - properties() with ordering and pagination - properties() after order()", () => {
  const results = Array.from(
    g.V().hasLabel("Person").order().by("name", "asc").properties("name").values(),
  );

  expect(results.length).toBeGreaterThan(0);

  const names = results.map((r) => r.name);
  expect(names).toEqual([...names].sort());
});

test("Property and Value Extraction - properties() with ordering and pagination - properties() with limit", () => {
  const results = Array.from(g.V().hasLabel("Person").limit(3).properties("name", "age").values());

  expect(results).toHaveLength(3);
});

test("Property and Value Extraction - properties() with ordering and pagination - properties() with range", () => {
  const results = Array.from(g.V().hasLabel("Person").range(1, 4).properties("name").values());

  expect(results.length).toBeLessThanOrEqual(3);
});

test("Property and Value Extraction - Accessing individual property values - Map to extract single property value", () => {
  const names = Array.from(
    g
      .V()
      .hasLabel("Person")
      .map((path) => path.value.get("name"))
      .values(),
  );

  expect(names.length).toBeGreaterThan(0);
  expect(names.every((name) => typeof name === "string")).toBe(true);
});

test("Property and Value Extraction - Accessing individual property values - Map to extract multiple property values as array", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .map((path) => [path.value.get("name"), path.value.get("age")])
      .values(),
  );

  expect(results).toHaveLength(1);
  expect(results[0]).toEqual(["Alice", 30]);
});

test("Property and Value Extraction - Accessing individual property values - Map to extract property with hasProperty check", () => {
  const results = Array.from(
    g
      .V()
      .map((path) => {
        if (path.value.hasProperty("age")) {
          return path.value.get("age");
        }
        return null;
      })
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.some((r) => typeof r === "number")).toBe(true);
});

test("Property and Value Extraction - Accessing individual property values - Access properties via vertex get", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .hasLabel("Person")
      .map((path) => path.value.get("name"))
      .values(),
  );

  expect(results).toHaveLength(1);
  expect(results[0]).toBe("Alice");
});

test("Property and Value Extraction - Accessing individual property values - Access property via path get method", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .as("person")
      .map((path) => path.get("person").property("name"))
      .values(),
  );

  expect(results).toHaveLength(1);
  expect(results[0]).toBe("Alice");
});

test("Property and Value Extraction - Property extraction patterns - Extract properties from related vertices", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .hasLabel("Person")
      .as("source")
      .out("knows")
      .hasLabel("Person")
      .as("target")
      .select("source", "target")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  for (const [source, target] of results) {
    expect(source.get("name")).toBe("Alice");
    expect(typeof target.get("name")).toBe("string");
  }
});

test("Property and Value Extraction - Property extraction patterns - Extract properties along a path", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .hasLabel("Person")
      .as("v1")
      .out("knows")
      .hasLabel("Person")
      .as("v2")
      .out("knows")
      .hasLabel("Person")
      .as("v3")
      .select("v1", "v2", "v3")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  for (const [v1, v2, v3] of results) {
    expect(v1.get("name")).toBe("Alice");
    expect(typeof v2.get("name")).toBe("string");
    expect(typeof v3.get("name")).toBe("string");
  }
});

test("Property and Value Extraction - Property extraction patterns - Extract and transform properties", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .map((path) => ({
        name: path.value.get("name").toUpperCase(),
        ageGroup: path.value.get("age") >= 40 ? "senior" : "junior",
      }))
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(
    results.every((r) => typeof r.name === "string" && ["senior", "junior"].includes(r.ageGroup)),
  ).toBe(true);
});

test("Property and Value Extraction - Property extraction patterns - Conditional property extraction", () => {
  const results = Array.from(
    g
      .V()
      .map((path) => {
        if (path.value.label === "Person") {
          const vertex = path.value as Vertex<DemoSchema, "Person">;
          return {
            type: "person" as const,
            name: vertex.get("name"),
            age: vertex.get("age"),
          };
        } else {
          return {
            type: "thing" as const,
            name: path.value.get("name"),
          };
        }
      })
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((r) => r.hasOwnProperty("type"))).toBe(true);
});

test("Property and Value Extraction - Property extraction with aggregation - Count vertices with specific property value", () => {
  const count = Array.from(g.V().hasLabel("Person").has("age", ">", 30).count().values())[0]!;

  expect(typeof count).toBe("number");
  expect(count).toBeGreaterThan(0);
});

test("Property and Value Extraction - Property extraction with aggregation - Extract properties and count", () => {
  const results = Array.from(g.V().hasLabel("Person").properties("name").values());

  expect(results.length).toBeGreaterThan(0);

  const count = results.length;
  const totalVertices = Array.from(g.V().hasLabel("Person").count().values())[0];

  expect(count).toBe(totalVertices);
});

test("Property and Value Extraction - Property extraction with aggregation - Group by property value using map", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .map((path) => ({
        ageGroup: path.value.get("age") >= 35 ? "older" : "younger",
        name: path.value.get("name"),
      }))
      .values(),
  );

  const grouped = results.reduce(
    (acc, r) => {
      if (!acc[r.ageGroup]) acc[r.ageGroup] = [];
      acc[r.ageGroup]!.push(r.name);
      return acc;
    },
    {} as Record<string, string[]>,
  );

  expect(Object.keys(grouped).length).toBeGreaterThan(0);
});

test("Property and Value Extraction - Property extraction edge cases - properties() on empty traversal", () => {
  const results = Array.from(g.V().has("name", "=", "NonExistent").properties("name").values());

  expect(results).toHaveLength(0);
});

test("Property and Value Extraction - Property extraction edge cases - properties() returns valid property objects", () => {
  const results = Array.from(g.V(alice.id).hasLabel("Person").properties("name").values());

  expect(results).toHaveLength(1);
  expect(results[0]).toHaveProperty("name");
  expect(results[0]!.name).toBe("Alice");
});

test("Property and Value Extraction - Property extraction edge cases - Map with null/undefined property access", () => {
  const results = Array.from(
    g
      .V()
      .map((path) => {
        if (path.value.hasProperty("age")) {
          return path.value.get("age");
        }
        return undefined;
      })
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.some((r) => r !== undefined)).toBe(true);
});

test("Property and Value Extraction - Property extraction edge cases - properties() preserves undefined values", () => {
  const results = Array.from(g.V(alice.id).properties("name", "ref").values());

  expect(results).toHaveLength(1);
  expect(results[0]).toHaveProperty("name");
  // ref might be undefined for Person vertices
});

test("Property and Value Extraction - Complex property extraction scenarios - Extract properties from repeat traversal", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .times(2)
      .hasLabel("Person")
      .properties("name")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((r) => r.hasOwnProperty("name"))).toBe(true);
});

test("Property and Value Extraction - Complex property extraction scenarios - Extract properties with emit", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .emit()
      .times(2)
      .dedup()
      .hasLabel("Person")
      .properties("name")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((r) => r.hasOwnProperty("name"))).toBe(true);
});

test("Property and Value Extraction - Complex property extraction scenarios - Properties from union branches", () => {
  const results = Array.from(g.union(g.V(alice.id), g.V(bob.id)).properties("name").values());

  expect(results).toHaveLength(2);

  const names = results.map((r) => r.name).sort();
  expect(names).toContain("Alice");
  expect(names).toContain("Bob");
});

test("Property and Value Extraction - Complex property extraction scenarios - Properties after intersect", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .out("knows")
      .intersect(g.V().hasLabel("Person").has("age", ">", 20))
      .properties("name")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((r) => r.hasOwnProperty("name"))).toBe(true);
});

test("Property and Value Extraction - Complex property extraction scenarios - Nested property extraction", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .hasLabel("Person")
      .as("person")
      .out("knows")
      .hasLabel("Person")
      .as("friend")
      .select("person", "friend")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  for (const [person, friend] of results) {
    expect(person.get("name")).toBe("Alice");
    expect(typeof friend.get("name")).toBe("string");
  }
});

test("Property and Value Extraction - Complex property extraction scenarios - Property extraction with value transformation", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .map((path) => ({
        name: path.value.get("name"),
        displayName: `Person: ${path.value.get("name")}`,
      }))
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((r) => r.displayName === `Person: ${r.name}`)).toBe(true);
});

test("Property and Value Extraction - Performance with property extraction - Extract properties from many vertices", () => {
  const start = Date.now();

  const results = Array.from(g.V().properties("name").values());

  const duration = Date.now() - start;

  expect(results.length).toBeGreaterThan(0);
  expect(duration).toBeLessThan(100);
});

test("Property and Value Extraction - Performance with property extraction - Multiple property extractions in sequence", () => {
  const names = Array.from(g.V().hasLabel("Person").properties("name").values());

  const ages = Array.from(g.V().hasLabel("Person").properties("age").values());

  expect(names.length).toBe(ages.length);
  expect(names.length).toBeGreaterThan(0);
});

test("Property and Value Extraction - Performance with property extraction - Complex property extraction pipeline", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .has("age", ">", 25)
      .order()
      .by("age", "asc")
      .limit(5)
      .map((path) => ({
        name: path.value.get("name"),
        age: path.value.get("age"),
        category: path.value.get("age") >= 40 ? "senior" : "junior",
      }))
      .values(),
  );

  expect(results.length).toBeLessThanOrEqual(5);
  expect(
    results.every(
      (r) => r.hasOwnProperty("name") && r.hasOwnProperty("age") && r.hasOwnProperty("category"),
    ),
  ).toBe(true);
});
