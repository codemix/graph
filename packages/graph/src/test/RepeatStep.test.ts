import { test, expect } from "vitest";
import { createManufacturingGraph } from "./createManufacturingGraph.js";
import { GraphTraversal } from "../Traversals.js";
import { Vertex } from "../Graph.js";

test("RepeatStep with manufacturing graph - repeat() traverses IsA hierarchy and collects concept attributes", () => {
  const graph = createManufacturingGraph();
  const printer = Array.from(graph.getVertices("Concept")).find(
    (v) => v.get("name")?.toString() === "3D Printer",
  );

  expect(printer).toBeDefined();
  if (printer == null) {
    throw new Error("Printer not found");
  }

  const q = new GraphTraversal(graph)
    .V(printer.id)
    .repeat(($) => $.out("IsA").hasLabel("Concept").as("concept"))
    .out("HasProperty")
    .as("property")
    .select("concept", "property")
    .values();

  const results = Array.from(q, ([concept, property]) => {
    expect(concept).toBeInstanceOf(Vertex);
    expect(property).toBeInstanceOf(Vertex);
    expect(concept.label).toBe("Concept");
    expect(property.label).toBe("Property");

    return [concept.get("name"), property.get("name")];
  });

  // Verify we got some results
  expect(results.length).toBeGreaterThan(0);

  // Verify each result has both concept and property names
  for (const [conceptName, propertyName] of results) {
    expect(conceptName).toBeDefined();
    expect(propertyName).toBeDefined();
    expect(typeof conceptName).toBe("string");
    expect(typeof propertyName).toBe("string");
    if (conceptName && propertyName) {
      expect(conceptName.length).toBeGreaterThan(0);
      expect(propertyName.length).toBeGreaterThan(0);
    }
  }

  // Verify we collected properties from parent concepts
  const conceptNames = results.map(([name]) => name);
  expect(conceptNames.length).toBeGreaterThan(0);
});
