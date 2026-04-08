/**
 * Tests for Standard Schema property parsing and validation.
 *
 * These tests verify that property values are parsed through their Standard Schema
 * validators, and that the transformed output values are stored (not raw input).
 */
import { test, expect, describe } from "vitest";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph, parsePropertyValue, parseProperties } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { PropertyTypeError, AsyncValidationError } from "../Exceptions.js";
import type { GraphSchema } from "../GraphSchema.js";

/**
 * Creates a transforming schema that converts input to uppercase.
 */
function makeUpperCaseType(): StandardSchemaV1<string, string> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => {
        if (typeof value !== "string") {
          return {
            issues: [{ message: "Expected string" }],
          };
        }
        return { value: value.toUpperCase() };
      },
    },
  };
}

/**
 * Creates a schema that trims whitespace from strings.
 */
function makeTrimType(): StandardSchemaV1<string, string> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => {
        if (typeof value !== "string") {
          return {
            issues: [{ message: "Expected string" }],
          };
        }
        return { value: value.trim() };
      },
    },
  };
}

/**
 * Creates a schema that parses string numbers to integers.
 */
function makeIntegerType(): StandardSchemaV1<string | number, number> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => {
        const num = typeof value === "number" ? value : parseInt(String(value), 10);
        if (isNaN(num)) {
          return {
            issues: [{ message: "Expected integer" }],
          };
        }
        return { value: num };
      },
    },
  };
}

/**
 * Creates a schema that always fails validation.
 */
function makeFailingType(errorMessage: string): StandardSchemaV1<unknown> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: () => {
        return {
          issues: [{ message: errorMessage }],
        };
      },
    },
  };
}

/**
 * Creates a schema that returns a Promise (async validation - not supported).
 */
function makeAsyncType(): StandardSchemaV1<unknown> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: () => {
        return Promise.resolve({ value: "async result" });
      },
    },
  };
}

/**
 * Creates a pass-through schema (no transformation).
 */
function makePassThroughType<T>(): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => ({ value: value as T }),
    },
  };
}

// Schema with transforming types
const transformingSchema = {
  vertices: {
    Person: {
      properties: {
        name: { type: makeUpperCaseType() },
        bio: { type: makeTrimType() },
        age: { type: makeIntegerType() },
      },
    },
    Thing: {
      properties: {
        title: { type: makePassThroughType<string>() },
      },
    },
  },
  edges: {
    knows: {
      properties: {
        since: { type: makeIntegerType() },
        note: { type: makeTrimType() },
      },
    },
    likes: {
      properties: {},
    },
  },
} as const satisfies GraphSchema;

// Schema with failing validation
const failingSchema = {
  vertices: {
    User: {
      properties: {
        email: { type: makeFailingType("Invalid email format") },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

// Schema with async validation
const asyncSchema = {
  vertices: {
    User: {
      properties: {
        data: { type: makeAsyncType() },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

describe("parsePropertyValue", () => {
  const schemaProperties = transformingSchema.vertices.Person.properties;

  test("transforms value through schema validator", () => {
    const result = parsePropertyValue("name", "Person", "alice", schemaProperties);
    expect(result).toBe("ALICE");
  });

  test("trims whitespace from string values", () => {
    const result = parsePropertyValue("bio", "Person", "  hello world  ", schemaProperties);
    expect(result).toBe("hello world");
  });

  test("parses string to integer", () => {
    const result = parsePropertyValue("age", "Person", "42", schemaProperties);
    expect(result).toBe(42);
  });

  test("returns value unchanged for unknown property key", () => {
    // Unknown properties are allowed without validation
    const result = parsePropertyValue("unknownProp", "Person", "value", schemaProperties);
    expect(result).toBe("value");
  });

  test("throws PropertyTypeError for validation failure", () => {
    const failingProps = failingSchema.vertices.User.properties;
    expect(() => parsePropertyValue("email", "User", "invalid", failingProps)).toThrow(
      PropertyTypeError,
    );

    try {
      parsePropertyValue("email", "User", "invalid", failingProps);
    } catch (e) {
      expect((e as PropertyTypeError).key).toBe("email");
      expect((e as PropertyTypeError).label).toBe("User");
      expect((e as PropertyTypeError).issues).toContain("Invalid email format");
    }
  });

  test("throws AsyncValidationError for async validation", () => {
    const asyncProps = asyncSchema.vertices.User.properties;
    expect(() => parsePropertyValue("data", "User", "test", asyncProps)).toThrow(
      AsyncValidationError,
    );

    try {
      parsePropertyValue("data", "User", "test", asyncProps);
    } catch (e) {
      expect((e as AsyncValidationError).key).toBe("data");
      expect((e as AsyncValidationError).label).toBe("User");
    }
  });

  test("returns value unchanged when schemaProperties is undefined", () => {
    const result = parsePropertyValue("anything", "Label", "value", undefined);
    expect(result).toBe("value");
  });
});

describe("parseProperties", () => {
  const schemaProperties = transformingSchema.vertices.Person.properties;

  test("transforms all properties through schema validators", () => {
    const input = {
      name: "alice",
      bio: "  developer  ",
      age: "30",
    };
    const result = parseProperties("Person", input, schemaProperties);

    expect(result.name).toBe("ALICE");
    expect(result.bio).toBe("developer");
    expect(result.age).toBe(30);
  });

  test("returns original object when schemaProperties is undefined", () => {
    const input = { foo: "bar" };
    const result = parseProperties("Label", input, undefined);
    expect(result).toEqual(input);
  });

  test("allows unknown properties without validation", () => {
    const input = {
      name: "alice",
      unknownProp: "value",
    };
    // Unknown properties are allowed and passed through unchanged
    const result = parseProperties("Person", input, schemaProperties);
    expect(result.name).toBe("ALICE"); // Known property is transformed
    expect(result.unknownProp).toBe("value"); // Unknown property is passed through
  });
});

describe("Graph.addVertex with validateProperties", () => {
  test("stores transformed values by default (validation on)", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      // validateProperties defaults to true
    });

    const vertex = graph.addVertex("Person", {
      name: "alice",
      bio: "  developer  ",
      age: "25" as unknown as number,
    });

    expect(vertex.get("name")).toBe("ALICE");
    expect(vertex.get("bio")).toBe("developer");
    expect(vertex.get("age")).toBe(25);
  });

  test("stores raw values when validation is explicitly disabled", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: false,
    });

    const vertex = graph.addVertex("Person", {
      name: "alice",
      bio: "  developer  ",
      age: "25" as unknown as number,
    });

    // Raw values stored without transformation
    expect(vertex.get("name")).toBe("alice");
    expect(vertex.get("bio")).toBe("  developer  ");
    expect(vertex.get("age")).toBe("25");
  });

  test("allows unknown properties on vertex", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    // Unknown properties are allowed and stored
    const vertex = graph.addVertex("Person", {
      name: "alice",
      bio: "dev",
      age: 25,
      unknownProp: "value",
    } as any);

    expect(vertex.get("name")).toBe("ALICE"); // Known property is transformed
    expect((vertex as any).get("unknownProp")).toBe("value"); // Unknown property is stored
  });

  test("throws PropertyTypeError for invalid value", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    expect(() =>
      graph.addVertex("Person", {
        name: 123 as unknown as string, // should be string
        bio: "dev",
        age: 25,
      }),
    ).toThrow(PropertyTypeError);
  });

  test("works with object syntax for addVertex", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    const vertex = graph.addVertex({
      label: "Person",
      properties: {
        name: "bob",
        bio: "  engineer  ",
        age: "30" as unknown as number,
      },
    });

    expect(vertex.get("name")).toBe("BOB");
    expect(vertex.get("bio")).toBe("engineer");
    expect(vertex.get("age")).toBe(30);
  });
});

describe("Graph.addEdge with validateProperties", () => {
  test("stores transformed values when validation is enabled", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    const alice = graph.addVertex("Person", {
      name: "alice",
      bio: "dev",
      age: 25,
    });
    const bob = graph.addVertex("Person", { name: "bob", bio: "eng", age: 30 });

    const edge = graph.addEdge(alice.id, "knows", bob.id, {
      since: "2020" as unknown as number,
      note: "  colleagues  ",
    });

    expect(edge.get("since")).toBe(2020);
    expect(edge.get("note")).toBe("colleagues");
  });

  test("stores raw values when validation is disabled", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: false,
    });

    const alice = graph.addVertex("Person", {
      name: "alice",
      bio: "dev",
      age: 25,
    });
    const bob = graph.addVertex("Person", { name: "bob", bio: "eng", age: 30 });

    const edge = graph.addEdge(alice.id, "knows", bob.id, {
      since: "2020" as unknown as number,
      note: "  colleagues  ",
    });

    expect(edge.get("since")).toBe("2020");
    expect(edge.get("note")).toBe("  colleagues  ");
  });

  test("allows unknown properties on edge", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    const alice = graph.addVertex("Person", {
      name: "alice",
      bio: "dev",
      age: 25,
    });
    const bob = graph.addVertex("Person", { name: "bob", bio: "eng", age: 30 });

    // Unknown properties are allowed and stored
    const edge = graph.addEdge(alice.id, "knows", bob.id, {
      since: 2020,
      note: "hi",
      unknownProp: "value",
    } as any);

    expect(edge.get("since")).toBe(2020); // Known property is stored
    expect((edge as any).get("unknownProp")).toBe("value"); // Unknown property is stored
  });

  test("works with object syntax for addEdge", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    const alice = graph.addVertex("Person", {
      name: "alice",
      bio: "dev",
      age: 25,
    });
    const bob = graph.addVertex("Person", { name: "bob", bio: "eng", age: 30 });

    const edge = graph.addEdge({
      inV: alice,
      label: "knows",
      outV: bob,
      properties: {
        since: "2021" as unknown as number,
        note: "  friends  ",
      },
    });

    expect(edge.get("since")).toBe(2021);
    expect(edge.get("note")).toBe("friends");
  });
});

describe("Graph.updateProperty with validateProperties", () => {
  test("stores transformed value when updating property", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    const vertex = graph.addVertex("Person", {
      name: "alice",
      bio: "dev",
      age: 25,
    });

    graph.updateProperty(vertex.id, "name", "bob");
    expect(vertex.get("name")).toBe("BOB");

    graph.updateProperty(vertex.id, "bio", "  engineer  ");
    expect(vertex.get("bio")).toBe("engineer");

    graph.updateProperty(vertex.id, "age", "35");
    expect(vertex.get("age")).toBe(35);
  });

  test("stores raw value when validation is disabled", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: false,
    });

    const vertex = graph.addVertex("Person", {
      name: "alice",
      bio: "dev",
      age: 25,
    });

    graph.updateProperty(vertex.id, "name", "bob");
    expect(vertex.get("name")).toBe("bob"); // not transformed

    graph.updateProperty(vertex.id, "bio", "  engineer  ");
    expect(vertex.get("bio")).toBe("  engineer  "); // not trimmed
  });

  test("transforms edge property values", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    const alice = graph.addVertex("Person", {
      name: "alice",
      bio: "dev",
      age: 25,
    });
    const bob = graph.addVertex("Person", { name: "bob", bio: "eng", age: 30 });
    const edge = graph.addEdge(alice.id, "knows", bob.id, {
      since: 2020,
      note: "hi",
    });

    graph.updateProperty(edge.id, "since", "2021");
    expect(edge.get("since")).toBe(2021);

    graph.updateProperty(edge.id, "note", "  best friends  ");
    expect(edge.get("note")).toBe("best friends");
  });

  test("allows unknown property updates", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    const vertex = graph.addVertex("Person", {
      name: "alice",
      bio: "dev",
      age: 25,
    });

    // Unknown properties are allowed
    graph.updateProperty(vertex.id, "unknownProp", "value");
    expect((vertex as any).get("unknownProp")).toBe("value");
  });

  test("throws PropertyTypeError for invalid value type", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    const vertex = graph.addVertex("Person", {
      name: "alice",
      bio: "dev",
      age: 25,
    });

    // name expects string, pass number
    expect(() => graph.updateProperty(vertex.id, "name", 123)).toThrow(PropertyTypeError);
  });
});

describe("Vertex.set and Edge.set with transformation", () => {
  test("Vertex.set transforms value", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    const vertex = graph.addVertex("Person", {
      name: "alice",
      bio: "dev",
      age: 25,
    });

    vertex.set("name", "charlie");
    expect(vertex.get("name")).toBe("CHARLIE");

    vertex.set("bio", "  data scientist  ");
    expect(vertex.get("bio")).toBe("data scientist");
  });

  test("Edge.set transforms value", () => {
    const graph = new Graph({
      schema: transformingSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    const alice = graph.addVertex("Person", {
      name: "alice",
      bio: "dev",
      age: 25,
    });
    const bob = graph.addVertex("Person", { name: "bob", bio: "eng", age: 30 });
    const edge = graph.addEdge(alice.id, "knows", bob.id, {
      since: 2020,
      note: "hi",
    });

    edge.set("note", "  work buddies  ");
    expect(edge.get("note")).toBe("work buddies");
  });
});

describe("AsyncValidationError", () => {
  test("is thrown for async validation in addVertex", () => {
    const graph = new Graph({
      schema: asyncSchema,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    expect(() => graph.addVertex("User", { data: "test" })).toThrow(AsyncValidationError);
  });

  test("is thrown for async validation in updateProperty", () => {
    // Create a schema with a property that starts as pass-through
    // but we'll test async validation directly with parsePropertyValue
    const asyncProps = asyncSchema.vertices.User.properties;

    expect(() => parsePropertyValue("data", "User", "test", asyncProps)).toThrow(
      AsyncValidationError,
    );
  });

  test("AsyncValidationError has correct properties", () => {
    const error = new AsyncValidationError("data", "User");
    expect(error.key).toBe("data");
    expect(error.label).toBe("User");
    expect(error.message).toContain("async validation");
    expect(error.name).toBe("AsyncValidationError");
  });
});

describe("Edge cases", () => {
  test("schema without validate function passes value through", () => {
    // Test parsePropertyValue directly with a schema missing validate
    const schemaPropsWithoutValidate = {
      value: {
        type: {
          "~standard": {
            version: 1,
            vendor: "test",
            // No validate function
          },
        },
      },
    } as unknown as Record<string, { type: StandardSchemaV1<unknown> }>;

    const result = parsePropertyValue("value", "Simple", "test", schemaPropsWithoutValidate);
    expect(result).toBe("test");
  });

  test("validation result without value property passes input through", () => {
    // Test parsePropertyValue directly with a schema that returns weird result
    const schemaPropsWithWeirdResult = {
      field: {
        type: {
          "~standard": {
            version: 1,
            vendor: "test",
            validate: () => ({ valid: true }), // No value or issues
          },
        },
      },
    } as unknown as Record<string, { type: StandardSchemaV1<unknown> }>;

    const result = parsePropertyValue("field", "Weird", "original", schemaPropsWithWeirdResult);
    expect(result).toBe("original");
  });

  test("empty issues array is treated as success", () => {
    // Test parsePropertyValue directly with empty issues array
    const schemaPropsWithEmptyIssues = {
      data: {
        type: {
          "~standard": {
            version: 1,
            vendor: "test",
            validate: (v: unknown) => ({ value: v, issues: [] }),
          },
        },
      },
    } as unknown as Record<string, { type: StandardSchemaV1<unknown> }>;

    // Empty issues array should not throw
    const result = parsePropertyValue("data", "Test", "test", schemaPropsWithEmptyIssues);
    expect(result).toBe("test");
  });
});

describe("Transformation with unique constraints", () => {
  test("unique constraint checks use transformed value", () => {
    const schemaWithUnique = {
      vertices: {
        User: {
          properties: {
            email: {
              type: makeTrimType(),
              index: { type: "hash" as const, unique: true },
            },
          },
        },
      },
      edges: {},
    } as const satisfies GraphSchema;

    const graph = new Graph({
      schema: schemaWithUnique,
      storage: new InMemoryGraphStorage(),
      validateProperties: true,
    });

    // Add user with email
    graph.addVertex("User", { email: "  test@example.com  " });

    // Trying to add another user with same email (after trimming) should fail
    expect(() => graph.addVertex("User", { email: "test@example.com" })).toThrow();
  });
});
