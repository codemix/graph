import { test, expect } from "vitest";
import { parseQueryToSteps, ReadonlyGraphError } from "../index.js";

test("parseQueryToSteps - postprocessor - should convert single return variable to object", () => {
  const { postprocess } = parseQueryToSteps("MATCH (c:Concept) RETURN c");

  const row = [{ "@type": "Vertex", id: "Concept:123", properties: { name: "User" } }];
  const result = postprocess(row);

  expect(result).toEqual({
    c: {
      "@type": "Vertex",
      id: "Concept:123",
      properties: { name: "User" },
    },
  });
});

test("parseQueryToSteps - postprocessor - should convert multiple return variables to object", () => {
  const { postprocess } = parseQueryToSteps("MATCH (a:User)-[r:follows]->(b:User) RETURN a, r, b");

  const row = [
    { "@type": "Vertex", id: "User:1", properties: { name: "Alice" } },
    { "@type": "Edge", id: "follows:1", properties: {} },
    { "@type": "Vertex", id: "User:2", properties: { name: "Bob" } },
  ];
  const result = postprocess(row);

  expect(result).toEqual({
    a: { "@type": "Vertex", id: "User:1", properties: { name: "Alice" } },
    r: { "@type": "Edge", id: "follows:1", properties: {} },
    b: { "@type": "Vertex", id: "User:2", properties: { name: "Bob" } },
  });
});

test("parseQueryToSteps - postprocessor - should handle queries with DISTINCT", () => {
  const { postprocess } = parseQueryToSteps("MATCH (u:User) RETURN DISTINCT u");

  const row = [{ "@type": "Vertex", id: "User:1", properties: { name: "Alice" } }];
  const result = postprocess(row);

  expect(result).toEqual({
    u: { "@type": "Vertex", id: "User:1", properties: { name: "Alice" } },
  });
});

test("parseQueryToSteps - postprocessor - should handle queries with ORDER BY and LIMIT", () => {
  const { postprocess } = parseQueryToSteps("MATCH (u:User) RETURN u ORDER BY u.name LIMIT 10");

  const row = [{ "@type": "Vertex", id: "User:1", properties: { name: "Alice" } }];
  const result = postprocess(row);

  expect(result).toEqual({
    u: { "@type": "Vertex", id: "User:1", properties: { name: "Alice" } },
  });
});

test("parseQueryToSteps - postprocessor - should group multiple properties from same variable", () => {
  const { postprocess } = parseQueryToSteps("MATCH (c:Concept) RETURN c.name, c.description");

  const row = ["Organization", "A business entity"];
  const result = postprocess(row);

  expect(result).toEqual({
    c: { name: "Organization", description: "A business entity" },
  });
});

test("parseQueryToSteps - postprocessor - should wrap single property in object", () => {
  const { postprocess } = parseQueryToSteps("MATCH (c:Concept) RETURN c.name");

  const row = ["Organization"];
  const result = postprocess(row);

  expect(result).toEqual({
    c: { name: "Organization" },
  });
});

test("parseQueryToSteps - postprocessor - should handle properties from different variables", () => {
  const { postprocess } = parseQueryToSteps(
    "MATCH (a:User)-[:follows]->(b:User) RETURN a.name, b.name",
  );

  const row = ["Alice", "Bob"];
  const result = postprocess(row);

  expect(result).toEqual({
    a: { name: "Alice" },
    b: { name: "Bob" },
  });
});

test("parseQueryToSteps - postprocessor - should use alias as key when specified", () => {
  const { postprocess } = parseQueryToSteps(
    "MATCH (c:Concept) RETURN c.name AS conceptName, c.description AS conceptDesc",
  );

  const row = ["Organization", "A business entity"];
  const result = postprocess(row);

  expect(result).toEqual({
    conceptName: { name: "Organization" },
    conceptDesc: { description: "A business entity" },
  });
});

// Readonly mode tests
test("parseQueryToSteps - readonly - allows read-only queries", () => {
  expect(() => {
    parseQueryToSteps("MATCH (u:User) RETURN u", { readonly: true });
  }).not.toThrow();
});

test("parseQueryToSteps - readonly - throws on CREATE", () => {
  expect(() => {
    parseQueryToSteps("CREATE (u:User {name: 'Alice'})", { readonly: true });
  }).toThrow(ReadonlyGraphError);
});

test("parseQueryToSteps - readonly - throws on SET", () => {
  expect(() => {
    parseQueryToSteps("MATCH (u:User) SET u.name = 'Bob' RETURN u", {
      readonly: true,
    });
  }).toThrow(ReadonlyGraphError);
});

test("parseQueryToSteps - readonly - throws on DELETE", () => {
  expect(() => {
    parseQueryToSteps("MATCH (u:User) DELETE u", { readonly: true });
  }).toThrow(ReadonlyGraphError);
});

test("parseQueryToSteps - readonly - throws on REMOVE", () => {
  expect(() => {
    parseQueryToSteps("MATCH (u:User) REMOVE u.name RETURN u", {
      readonly: true,
    });
  }).toThrow(ReadonlyGraphError);
});

test("parseQueryToSteps - readonly - throws on MERGE", () => {
  expect(() => {
    parseQueryToSteps("MERGE (u:User {name: 'Alice'}) RETURN u", {
      readonly: true,
    });
  }).toThrow(ReadonlyGraphError);
});

test("parseQueryToSteps - readonly - throws on FOREACH", () => {
  expect(() => {
    parseQueryToSteps("MATCH (u:User) FOREACH (x IN [1,2,3] | SET u.count = x) RETURN u", {
      readonly: true,
    });
  }).toThrow(ReadonlyGraphError);
});

test("parseQueryToSteps - readonly - error includes step name", () => {
  try {
    parseQueryToSteps("CREATE (u:User {name: 'Alice'})", { readonly: true });
    expect.fail("Expected ReadonlyGraphError");
  } catch (error) {
    expect(error).toBeInstanceOf(ReadonlyGraphError);
    expect((error as ReadonlyGraphError).stepName).toBe("Create");
  }
});

test("parseQueryToSteps - readonly - disabled by default", () => {
  expect(() => {
    parseQueryToSteps("CREATE (u:User {name: 'Alice'})");
  }).not.toThrow();
});

test("parseQueryToSteps - readonly false - allows mutations", () => {
  expect(() => {
    parseQueryToSteps("CREATE (u:User {name: 'Alice'})", { readonly: false });
  }).not.toThrow();
});

test("parseQueryToSteps - readonly - detects nested mutations in OPTIONAL MATCH", () => {
  expect(() => {
    parseQueryToSteps(
      "MATCH (u:User) OPTIONAL MATCH (u)-[:owns]->(p:Product) SET p.viewed = true RETURN u",
      { readonly: true },
    );
  }).toThrow(ReadonlyGraphError);
});
