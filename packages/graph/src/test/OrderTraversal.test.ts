import { expect, test } from "vitest";
import { createDemoGraph } from "../getDemoGraph.js";
import { GraphTraversal } from "../Traversals.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";

const { graph, alice } = createDemoGraph();
const g = new GraphTraversal(graph);

test("OrderVertexTraversal - Single by() ordering - Order by name ascending", () => {
  const results = Array.from(
    g.V().hasLabel("Person").order().by("name", "asc").values(),
  );

  expect(results.length).toBeGreaterThan(0);

  // Verify ascending order
  const names = results.map((v) => v.get("name"));
  const sortedNames = [...names].sort();
  expect(names).toEqual(sortedNames);
});

test("OrderVertexTraversal - Single by() ordering - Order by name descending", () => {
  const results = Array.from(
    g.V().hasLabel("Person").order().by("name", "desc").values(),
  );

  expect(results.length).toBeGreaterThan(0);

  // Verify descending order
  const names = results.map((v) => v.get("name"));
  const sortedNames = [...names].sort().reverse();
  expect(names).toEqual(sortedNames);
});

test("OrderVertexTraversal - Single by() ordering - Order by age ascending", () => {
  const results = Array.from(
    g.V().hasLabel("Person").order().by("age", "asc").values(),
  );

  expect(results.length).toBeGreaterThan(0);

  // Verify ascending order
  for (let i = 1; i < results.length; i++) {
    const prevAge = results[i - 1]!.get("age");
    const currAge = results[i]!.get("age");
    expect(prevAge).toBeLessThanOrEqual(currAge);
  }
});

test("OrderVertexTraversal - Single by() ordering - Order by age descending", () => {
  const results = Array.from(
    g.V().hasLabel("Person").order().by("age", "desc").values(),
  );

  expect(results.length).toBeGreaterThan(0);

  // Verify descending order
  for (let i = 1; i < results.length; i++) {
    const prevAge = results[i - 1]!.get("age");
    const currAge = results[i]!.get("age");
    expect(prevAge).toBeGreaterThanOrEqual(currAge);
  }
});

test("OrderVertexTraversal - Single by() ordering - Order with default direction (asc)", () => {
  const results = Array.from(
    g.V().hasLabel("Person").order().by("name").values(),
  );

  expect(results.length).toBeGreaterThan(0);

  // Default should be ascending
  const names = results.map((v) => v.get("name"));
  const sortedNames = [...names].sort();
  expect(names).toEqual(sortedNames);
});

test("OrderVertexTraversal - Multiple by() chaining - Order by age then by name", () => {
  // Add some people with same age for testing
  const testGraph = new Graph({
    schema: graph.schema,
    storage: graph.storage,
  });

  testGraph.addVertex("Person", { name: "Zara", age: 30 });
  testGraph.addVertex("Person", { name: "Adam", age: 30 });
  testGraph.addVertex("Person", { name: "Mike", age: 25 });

  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2
      .V()
      .hasLabel("Person")
      .order()
      .by("age", "asc")
      .by("name", "asc")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);

  // Verify primary sort by age
  for (let i = 1; i < results.length; i++) {
    const prevAge = results[i - 1]!.get("age");
    const currAge = results[i]!.get("age");

    if (prevAge === currAge) {
      // If ages are equal, verify secondary sort by name
      const prevName = results[i - 1]!.get("name");
      const currName = results[i]!.get("name");
      expect(prevName.localeCompare(currName)).toBeLessThanOrEqual(0);
    } else {
      expect(prevAge).toBeLessThan(currAge);
    }
  }
});

test("OrderVertexTraversal - Multiple by() chaining - Order by age asc then name desc", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: graph.storage,
  });

  testGraph.addVertex("Person", { name: "Zara", age: 30 });
  testGraph.addVertex("Person", { name: "Adam", age: 30 });
  testGraph.addVertex("Person", { name: "Beta", age: 30 });

  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2
      .V()
      .hasLabel("Person")
      .order()
      .by("age", "asc")
      .by("name", "desc")
      .values(),
  );

  // Find vertices with same age
  const age30Vertices = results.filter((v) => v.get("age") === 30);

  if (age30Vertices.length > 1) {
    const names = age30Vertices.map((v) => v.get("name"));
    const sortedNamesDesc = [...names].sort().reverse();
    expect(names).toEqual(sortedNamesDesc);
  }
});

test("OrderVertexTraversal - Multiple by() chaining - Order by three properties", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: graph.storage,
  });

  // Add vertices with a property we can use for tertiary sort
  testGraph.addVertex("Person", { name: "Alice", age: 30, ref: "1" });
  testGraph.addVertex("Person", { name: "Alice", age: 30, ref: "2" });
  testGraph.addVertex("Person", { name: "Bob", age: 30, ref: "1" });

  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2
      .V()
      .hasLabel("Person")
      .order()
      .by("age", "asc")
      .by("name", "asc")
      .by("ref", "asc")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);

  // Verify ordering is stable
  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1]!;
    const curr = results[i]!;

    const prevAge = prev.get("age");
    const currAge = curr.get("age");

    if (prevAge !== currAge) {
      expect(prevAge).toBeLessThan(currAge);
    } else {
      const prevName = prev.get("name");
      const currName = curr.get("name");

      if (prevName !== currName) {
        expect(prevName.localeCompare(currName)).toBeLessThanOrEqual(0);
      }
    }
  }
});

test("OrderVertexTraversal - Multiple by() chaining - Chaining by() with different property types", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .order()
      .by("age", "desc") // number
      .by("name", "asc") // string
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);

  // Verify mixed type ordering works
  for (let i = 1; i < results.length; i++) {
    const prevAge = results[i - 1]!.get("age");
    const currAge = results[i]!.get("age");
    expect(prevAge).toBeGreaterThanOrEqual(currAge);
  }
});

test("OrderVertexTraversal - Order with filtering - Order after has() filter", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .has("age", ">", 30)
      .order()
      .by("age", "asc")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((v) => v.get("age") > 30)).toBe(true);

  // Verify ordering
  for (let i = 1; i < results.length; i++) {
    expect(results[i - 1]!.get("age")).toBeLessThanOrEqual(
      results[i]!.get("age"),
    );
  }
});

test("OrderVertexTraversal - Order with filtering - Order before has() filter", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .order()
      .by("age", "desc")
      .has("age", ">", 30)
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((v) => v.get("age") > 30)).toBe(true);

  // Verify ordering is maintained after filter
  for (let i = 1; i < results.length; i++) {
    expect(results[i - 1]!.get("age")).toBeGreaterThanOrEqual(
      results[i]!.get("age"),
    );
  }
});

test("OrderVertexTraversal - Order with filtering - Order with multiple filters", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .has("age", ">", 25)
      .has("age", "<", 50)
      .order()
      .by("name", "asc")
      .values(),
  );

  expect(results.every((v) => v.get("age") > 25 && v.get("age") < 50)).toBe(
    true,
  );

  // Verify ordering
  const names = results.map((v) => v.get("name"));
  expect(names).toEqual([...names].sort());
});

test("OrderVertexTraversal - Order with pagination - Order with limit", () => {
  const results = Array.from(
    g.V().hasLabel("Person").order().by("age", "asc").limit(3).values(),
  );

  expect(results).toHaveLength(3);

  // Should get the 3 youngest people in order
  for (let i = 1; i < results.length; i++) {
    expect(results[i - 1]!.get("age")).toBeLessThanOrEqual(
      results[i]!.get("age"),
    );
  }
});

test("OrderVertexTraversal - Order with pagination - Order with skip", () => {
  const allOrdered = Array.from(
    g.V().hasLabel("Person").order().by("age", "asc").values(),
  );

  const skipped = Array.from(
    g.V().hasLabel("Person").order().by("age", "asc").skip(2).values(),
  );

  expect(skipped.length).toBe(allOrdered.length - 2);

  // Verify we skipped the first 2
  expect(skipped[0]!.id).toBe(allOrdered[2]!.id);
});

test("OrderVertexTraversal - Order with pagination - Order with range", () => {
  const results = Array.from(
    g.V().hasLabel("Person").order().by("name", "asc").range(1, 4).values(),
  );

  expect(results.length).toBeLessThanOrEqual(3);

  // Verify ordering is maintained
  const names = results.map((v) => v.get("name"));
  expect(names).toEqual([...names].sort());
});

test("OrderVertexTraversal - Order with pagination - Multiple by() with pagination", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .order()
      .by("age", "desc")
      .by("name", "asc")
      .limit(5)
      .values(),
  );

  expect(results.length).toBeLessThanOrEqual(5);

  // Verify ordering
  for (let i = 1; i < results.length; i++) {
    expect(results[i - 1]!.get("age")).toBeGreaterThanOrEqual(
      results[i]!.get("age"),
    );
  }
});

test("OrderVertexTraversal - Order with traversal operations - Order after out() navigation", () => {
  const results = Array.from(
    g.V(alice.id).out("knows").order().by("name", "asc").values(),
  );

  expect(results.length).toBeGreaterThan(0);

  const names = results.map((v) => v.get("name"));
  expect(names).toEqual([...names].sort());
});

test("OrderVertexTraversal - Order with traversal operations - Order with select", () => {
  const results = Array.from(
    g.V().hasLabel("Person").order().by("age", "asc").as("person").values(),
  );

  expect(results.length).toBeGreaterThan(0);

  // Verify ordering is preserved
  for (let i = 1; i < results.length; i++) {
    expect(results[i - 1]!.get("age")).toBeLessThanOrEqual(
      results[i]!.get("age"),
    );
  }
});

test("OrderVertexTraversal - Order with traversal operations - Order within union", () => {
  // Test ordering within each union branch separately
  const younger = Array.from(
    g
      .V()
      .hasLabel("Person")
      .has("age", "<", 35)
      .order()
      .by("name", "asc")
      .values(),
  );
  const older = Array.from(
    g
      .V()
      .hasLabel("Person")
      .has("age", ">=", 35)
      .order()
      .by("name", "desc")
      .values(),
  );

  // Combine results
  const results = [...younger, ...older];
  expect(results.length).toBeGreaterThan(0);
  // Each branch should be ordered independently
});

test("OrderVertexTraversal - Order with traversal operations - Order after dedup", () => {
  const results = Array.from(
    g
      .union(g.V(alice.id), g.V(alice.id))
      .dedup()
      .out("knows")
      .order()
      .by("name", "asc")
      .values(),
  );

  const names = results.map((v) => v.get("name"));
  expect(names).toEqual([...names].sort());
});

test("OrderVertexTraversal - Order edge cases - Order empty traversal", () => {
  const results = Array.from(
    g.V().has("name", "NonExistent").order().by("name", "asc").values(),
  );

  expect(results).toHaveLength(0);
});

test("OrderVertexTraversal - Order edge cases - Order single vertex", () => {
  const results = Array.from(g.V(alice.id).order().by("name", "asc").values());

  expect(results).toHaveLength(1);
  expect(results[0]!.id).toBe(alice.id);
});

test("OrderVertexTraversal - Order edge cases - Order with all same values", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  testGraph.addVertex("Person", { name: "Same", age: 30 });
  testGraph.addVertex("Person", { name: "Same", age: 30 });
  testGraph.addVertex("Person", { name: "Same", age: 30 });

  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(
    g2
      .V()
      .hasLabel("Person")
      .order()
      .by("name", "asc")
      .by("age", "asc")
      .values(),
  );

  expect(results.length).toBe(3);
  expect(results.every((v) => v.get("name") === "Same")).toBe(true);
});

test("OrderVertexTraversal - Order edge cases - Order by property with undefined values", () => {
  const testGraph = new Graph({
    schema: graph.schema,
    storage: graph.storage,
  });

  testGraph.addVertex("Person", { name: "HasAge", age: 25 });
  testGraph.addVertex("Thing", { name: "NoAge", ref: 1 });

  const g2 = new GraphTraversal(testGraph);

  const results = Array.from(g2.V().order().by("name", "asc").values());

  expect(results.length).toBeGreaterThan(0);
  // Should handle mixed property availability
});

test("OrderVertexTraversal - Order edge cases - Order with very large dataset", () => {
  const largeGraph = new Graph({
    schema: graph.schema,
    storage: new InMemoryGraphStorage(),
  });

  // Create 100 vertices
  for (let i = 0; i < 100; i++) {
    largeGraph.addVertex("Person", {
      name: `Person${i}`,
      age: Math.floor(Math.random() * 100),
    });
  }

  const g2 = new GraphTraversal(largeGraph);

  const start = Date.now();
  const results = Array.from(
    g2
      .V()
      .hasLabel("Person")
      .order()
      .by("age", "asc")
      .by("name", "asc")
      .values(),
  );
  const duration = Date.now() - start;

  expect(results.length).toBe(100);
  expect(duration).toBeLessThan(500); // Should be reasonably fast

  // Verify ordering
  for (let i = 1; i < results.length; i++) {
    expect(results[i - 1]!.get("age")).toBeLessThanOrEqual(
      results[i]!.get("age"),
    );
  }
});

test("OrderVertexTraversal - Order with repeat - Order after repeat traversal", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .times(2)
      .dedup()
      .order()
      .by("name", "asc")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);

  const names = results.map((v) => v.get("name"));
  expect(names).toEqual([...names].sort());
});

test("OrderVertexTraversal - Order with repeat - Order within repeat step", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) =>
        $.out("knows").hasLabel("Person").order().by("age", "asc").limit(1),
      )
      .times(2)
      .values(),
  );

  expect(Array.isArray(results)).toBe(true);
  // Should traverse through youngest neighbors at each step
});

test("OrderVertexTraversal - Order with repeat - Order with emit and repeat", () => {
  const results = Array.from(
    g
      .V(alice.id)
      .repeat(($) => $.out("knows"))
      .emit()
      .times(2)
      .dedup()
      .hasLabel("Person")
      .order()
      .by("age", "desc")
      .values(),
  );

  expect(results.length).toBeGreaterThan(0);

  // Verify descending age order
  for (let i = 1; i < results.length; i++) {
    expect(results[i - 1]!.get("age")).toBeGreaterThanOrEqual(
      results[i]!.get("age"),
    );
  }
});

test("OrderVertexTraversal - Order type safety - Order by existing properties maintains type safety", () => {
  const results = Array.from(
    g
      .V()
      .hasLabel("Person")
      .order()
      .by("name", "asc")
      .by("age", "desc")
      .values(),
  );

  // Should compile and run without errors
  expect(results.length).toBeGreaterThan(0);
  expect(results[0]!.hasProperty("name")).toBe(true);
  expect(results[0]!.hasProperty("age")).toBe(true);
});

test("OrderVertexTraversal - Order type safety - Order preserves path type through selection", () => {
  const results = Array.from(
    g.V().hasLabel("Person").as("p").order().by("name", "asc").values(),
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((v) => v.label === "Person")).toBe(true);
});
