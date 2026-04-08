import { test, expect } from "vitest";
import type { GraphSchema } from "../GraphSchema.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { makeType, executeQuery } from "./testHelpers.js";

function createTestGraph(): Graph<GraphSchema> {
  const schema = {
    vertices: {
      Sensor: {
        properties: {
          name: { type: makeType<string>("") },
          temperature: { type: makeType<number>(0) },
          humidity: { type: makeType<number>(0) },
          location: { type: makeType<string>("") },
          status: { type: makeType<string>("") },
        },
      },
      Product: {
        properties: {
          sku: { type: makeType<string>("") },
          name: { type: makeType<string>("") },
          price: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      monitors: {
        properties: {},
      },
    },
  } as const satisfies GraphSchema;

  const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

  // Add sensors with various temperatures (including negative)
  graph.addVertex("Sensor", {
    name: "Arctic-1",
    temperature: -40,
    humidity: 20,
    location: "arctic-base-alpha",
    status: "active",
  });
  graph.addVertex("Sensor", {
    name: "Arctic-2",
    temperature: -25,
    humidity: 35,
    location: "arctic-base-beta",
    status: "maintenance",
  });
  graph.addVertex("Sensor", {
    name: "Freezer-1",
    temperature: -18,
    humidity: 45,
    location: "warehouse-a",
    status: "active",
  });
  graph.addVertex("Sensor", {
    name: "Room-1",
    temperature: 22,
    humidity: 50,
    location: "office-floor-1",
    status: "active",
  });
  graph.addVertex("Sensor", {
    name: "Room-2",
    temperature: 24,
    humidity: 55,
    location: "office-floor-2",
    status: "inactive",
  });
  graph.addVertex("Sensor", {
    name: "Desert-1",
    temperature: 45,
    humidity: 5,
    location: "desert-outpost",
    status: "active",
  });

  // Add products with various prices
  graph.addVertex("Product", {
    sku: "PROD-001",
    name: "Widget Alpha",
    price: 29.99,
  });
  graph.addVertex("Product", {
    sku: "PROD-002",
    name: "Widget Beta",
    price: -5.0, // Negative price (discount/credit)
  });
  graph.addVertex("Product", {
    sku: "ITEM-100",
    name: "Gadget Gamma",
    price: 149.99,
  });

  return graph;
}

test("Negative Numbers and Regex Matching Execution - Negative Number Filtering - should find sensors with temperature below zero", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.temperature < 0 RETURN s",
  );
  expect(results).toHaveLength(3); // Arctic-1, Arctic-2, Freezer-1
});

test("Negative Numbers and Regex Matching Execution - Negative Number Filtering - should find sensors with temperature equal to a negative value", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.temperature = -25 RETURN s",
  );
  expect(results).toHaveLength(1);
});

test("Negative Numbers and Regex Matching Execution - Negative Number Filtering - should find sensors with temperature greater than a negative value", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.temperature > -20 RETURN s",
  );
  // Freezer-1 (-18), Room-1 (22), Room-2 (24), Desert-1 (45)
  expect(results).toHaveLength(4);
});

test("Negative Numbers and Regex Matching Execution - Negative Number Filtering - should find sensors with temperature in a negative range", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.temperature >= -30 AND s.temperature <= -15 RETURN s",
  );
  // Arctic-2 (-25), Freezer-1 (-18)
  expect(results).toHaveLength(2);
});

test("Negative Numbers and Regex Matching Execution - Negative Number Filtering - should find sensors with temperature not equal to negative value", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.temperature != -40 RETURN s",
  );
  // All except Arctic-1
  expect(results).toHaveLength(5);
});

test("Negative Numbers and Regex Matching Execution - Negative Number Filtering - should handle negative float comparisons", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (p:Product) WHERE p.price < 0 RETURN p",
  );
  expect(results).toHaveLength(1);
});

test("Negative Numbers and Regex Matching Execution - Negative Number Filtering - should combine negative number conditions with other conditions", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.temperature < -10 AND s.humidity > 30 RETURN s",
  );
  // Arctic-2 (-25, 35), Freezer-1 (-18, 45)
  expect(results).toHaveLength(2);
});

test("Negative Numbers and Regex Matching Execution - Regex Pattern Matching - should match with simple prefix pattern", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.name =~ 'Arctic.*' RETURN s",
  );
  expect(results).toHaveLength(2); // Arctic-1, Arctic-2
});

test("Negative Numbers and Regex Matching Execution - Regex Pattern Matching - should match with suffix pattern", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.name =~ '.*-1' RETURN s",
  );
  // Arctic-1, Freezer-1, Room-1, Desert-1
  expect(results).toHaveLength(4);
});

test("Negative Numbers and Regex Matching Execution - Regex Pattern Matching - should match with contains pattern", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.location =~ '.*base.*' RETURN s",
  );
  // arctic-base-alpha, arctic-base-beta
  expect(results).toHaveLength(2);
});

test("Negative Numbers and Regex Matching Execution - Regex Pattern Matching - should match with character class pattern", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.name =~ 'Room-[0-9]+' RETURN s",
  );
  // Room-1, Room-2
  expect(results).toHaveLength(2);
});

test("Negative Numbers and Regex Matching Execution - Regex Pattern Matching - should match with alternation pattern", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.status =~ 'active|inactive' RETURN s",
  );
  // All sensors with 'active' or 'inactive' status
  expect(results).toHaveLength(5); // excludes maintenance
});

test("Negative Numbers and Regex Matching Execution - Regex Pattern Matching - should match case-sensitive by default", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.name =~ 'ARCTIC.*' RETURN s",
  );
  // No match because actual names are 'Arctic-1', 'Arctic-2' (capitalized differently)
  expect(results).toHaveLength(0);
});

test("Negative Numbers and Regex Matching Execution - Regex Pattern Matching - should match exact case when using regex", () => {
  const graph = createTestGraph();
  // JavaScript regex: case-insensitive requires flags on RegExp constructor
  // We match exact case - use [Aa] for case variation if needed
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.name =~ '[Aa]rctic.*' RETURN s",
  );
  // Arctic-1, Arctic-2 (matches with character class for case)
  expect(results).toHaveLength(2);
});

test("Negative Numbers and Regex Matching Execution - Regex Pattern Matching - should match product SKUs with pattern", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (p:Product) WHERE p.sku =~ 'PROD-.*' RETURN p",
  );
  expect(results).toHaveLength(2); // PROD-001, PROD-002
});

test("Negative Numbers and Regex Matching Execution - Regex Pattern Matching - should not match when pattern doesn't match", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.name =~ 'NoMatch.*' RETURN s",
  );
  expect(results).toHaveLength(0);
});

test("Negative Numbers and Regex Matching Execution - Regex Pattern Matching - should combine regex with other conditions", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.name =~ 'Arctic.*' AND s.temperature > -30 RETURN s",
  );
  // Only Arctic-2 (-25 > -30), Arctic-1 (-40) doesn't match
  expect(results).toHaveLength(1);
});

test("Negative Numbers and Regex Matching Execution - Regex Pattern Matching - should combine regex with negative number conditions", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.location =~ '.*arctic.*' AND s.temperature < -20 RETURN s",
  );
  // Arctic-1 (-40), Arctic-2 (-25)
  expect(results).toHaveLength(2);
});

test("Negative Numbers and Regex Matching Execution - Regex Pattern Matching - should work with OR conditions", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.name =~ 'Arctic.*' OR s.name =~ 'Desert.*' RETURN s",
  );
  // Arctic-1, Arctic-2, Desert-1
  expect(results).toHaveLength(3);
});

test("Negative Numbers and Regex Matching Execution - Edge Cases - should handle regex on non-string property gracefully", () => {
  const graph = createTestGraph();
  // This should not match anything since temperature is a number
  // The evaluator should handle this gracefully
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.humidity =~ '50' RETURN s",
  );
  // humidity is a number, regex matching should return false
  expect(results).toHaveLength(0);
});

test("Negative Numbers and Regex Matching Execution - Edge Cases - should handle empty string regex", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.name =~ '' RETURN s",
  );
  // Empty regex matches any string
  expect(results).toHaveLength(6);
});

test("Negative Numbers and Regex Matching Execution - Edge Cases - should handle special regex characters in pattern", () => {
  const graph = createTestGraph();
  const results = executeQuery(
    graph,
    "MATCH (s:Sensor) WHERE s.name =~ 'Room-1' RETURN s",
  );
  // '-' is a special char in character classes but works fine in normal context
  expect(results).toHaveLength(1);
});
