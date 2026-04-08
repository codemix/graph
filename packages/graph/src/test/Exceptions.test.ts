import { test, expect } from "vitest";
import {
  GraphError,
  GraphConsistencyError,
  ElementNotFoundError,
  VertexNotFoundError,
  EdgeNotFoundError,
  LabelNotFoundError,
  InvalidComparisonError,
  MaxIterationsExceededError,
  MemoryLimitExceededError,
  PropertyValidationError,
  PropertyTypeError,
  AsyncValidationError,
  ReadonlyGraphError,
} from "../Exceptions.js";

test("GraphConsistencyError - creates error with message", () => {
  const error = new GraphConsistencyError("Test consistency error");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(GraphConsistencyError);
  expect(error.message).toBe("Test consistency error");
  expect(error.name).toBe("GraphConsistencyError");
});

test("GraphConsistencyError - is throwable", () => {
  expect(() => {
    throw new GraphConsistencyError("Graph is inconsistent");
  }).toThrow(GraphConsistencyError);
});

test("ElementNotFoundError - creates error with element id", () => {
  const error = new ElementNotFoundError("Person:123");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(ElementNotFoundError);
  expect(error.message).toBe("Element Person:123 not found");
  expect(error.name).toBe("ElementNotFoundError");
});

test("ElementNotFoundError - is throwable", () => {
  expect(() => {
    throw new ElementNotFoundError("Edge:456");
  }).toThrow(ElementNotFoundError);
});

test("VertexNotFoundError - creates error with vertex id", () => {
  const error = new VertexNotFoundError("Person:789");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(VertexNotFoundError);
  expect(error.message).toBe("Vertex Person:789 not found");
  expect(error.name).toBe("VertexNotFoundError");
});

test("VertexNotFoundError - is throwable", () => {
  expect(() => {
    throw new VertexNotFoundError("Thing:999");
  }).toThrow(VertexNotFoundError);
});

test("VertexNotFoundError - is catchable as Error", () => {
  try {
    throw new VertexNotFoundError("Test:1");
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).toContain("Test:1");
  }
});

test("EdgeNotFoundError - creates error with edge id", () => {
  const error = new EdgeNotFoundError("knows:123");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(EdgeNotFoundError);
  expect(error.message).toBe("Edge knows:123 not found");
});

test("EdgeNotFoundError - is throwable", () => {
  expect(() => {
    throw new EdgeNotFoundError("likes:456");
  }).toThrow(EdgeNotFoundError);
});

test("EdgeNotFoundError - has correct message format", () => {
  const error = new EdgeNotFoundError("relationship:test");
  expect(error.message).toMatch(/^Edge .+ not found$/);
});

test("LabelNotFoundError - creates error with label name", () => {
  const error = new LabelNotFoundError("UnknownLabel");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(LabelNotFoundError);
  expect(error.message).toBe("Label UnknownLabel not found");
  expect(error.name).toBe("LabelNotFoundError");
});

test("LabelNotFoundError - is throwable", () => {
  expect(() => {
    throw new LabelNotFoundError("MissingLabel");
  }).toThrow(LabelNotFoundError);
});

test("LabelNotFoundError - handles empty label", () => {
  const error = new LabelNotFoundError("");
  expect(error.message).toBe("Label  not found");
});

test("Error inheritance - all custom errors inherit from Error", () => {
  expect(new GraphConsistencyError("test")).toBeInstanceOf(Error);
  expect(new ElementNotFoundError("test:1")).toBeInstanceOf(Error);
  expect(new VertexNotFoundError("test:1")).toBeInstanceOf(Error);
  expect(new EdgeNotFoundError("test:1")).toBeInstanceOf(Error);
  expect(new LabelNotFoundError("test")).toBeInstanceOf(Error);
});

test("Error inheritance - preserves stack trace", () => {
  const error = new GraphConsistencyError("test");
  expect(error.stack).toBeDefined();
  expect(error.stack).toContain("GraphConsistencyError");
});

// GraphError base class tests
test("GraphError - creates error with message", () => {
  const error = new GraphError("Test graph error");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(GraphError);
  expect(error.message).toBe("Test graph error");
  expect(error.name).toBe("GraphError");
});

test("GraphError - all custom errors inherit from GraphError", () => {
  expect(new GraphConsistencyError("test")).toBeInstanceOf(GraphError);
  expect(new ElementNotFoundError("test:1")).toBeInstanceOf(GraphError);
  expect(new VertexNotFoundError("test:1")).toBeInstanceOf(GraphError);
  expect(new EdgeNotFoundError("test:1")).toBeInstanceOf(GraphError);
  expect(new LabelNotFoundError("test")).toBeInstanceOf(GraphError);
  expect(new InvalidComparisonError(1, "a")).toBeInstanceOf(GraphError);
  expect(new MaxIterationsExceededError(1000, "RepeatStep")).toBeInstanceOf(
    GraphError,
  );
  expect(new MemoryLimitExceededError(100000, 150000)).toBeInstanceOf(
    GraphError,
  );
  expect(new PropertyValidationError("foo", "Person")).toBeInstanceOf(
    GraphError,
  );
});

// InvalidComparisonError tests
test("InvalidComparisonError - creates error with values", () => {
  const error = new InvalidComparisonError(42, "hello");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(GraphError);
  expect(error).toBeInstanceOf(InvalidComparisonError);
  expect(error.message).toBe(
    "Cannot compare values of incompatible types: number and string",
  );
  expect(error.name).toBe("InvalidComparisonError");
  expect(error.valueA).toBe(42);
  expect(error.valueB).toBe("hello");
});

test("InvalidComparisonError - is throwable", () => {
  expect(() => {
    throw new InvalidComparisonError({}, []);
  }).toThrow(InvalidComparisonError);
});

// MaxIterationsExceededError tests
test("MaxIterationsExceededError - creates error with limit and step", () => {
  const error = new MaxIterationsExceededError(1000, "RepeatStep");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(GraphError);
  expect(error).toBeInstanceOf(MaxIterationsExceededError);
  expect(error.message).toBe(
    "Maximum iterations (1000) exceeded in RepeatStep. Consider adding a LIMIT clause or increasing maxIterations.",
  );
  expect(error.name).toBe("MaxIterationsExceededError");
  expect(error.limit).toBe(1000);
  expect(error.step).toBe("RepeatStep");
});

test("MaxIterationsExceededError - is throwable", () => {
  expect(() => {
    throw new MaxIterationsExceededError(500, "WhileStep");
  }).toThrow(MaxIterationsExceededError);
});

// MemoryLimitExceededError tests
test("MemoryLimitExceededError - creates error with limit and actual", () => {
  const error = new MemoryLimitExceededError(100000, 150000);

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(GraphError);
  expect(error).toBeInstanceOf(MemoryLimitExceededError);
  expect(error.message).toBe(
    "Collection size (150000) exceeds limit (100000). Consider adding a LIMIT clause or increasing maxCollectionSize.",
  );
  expect(error.name).toBe("MemoryLimitExceededError");
  expect(error.limit).toBe(100000);
  expect(error.actual).toBe(150000);
});

test("MemoryLimitExceededError - is throwable", () => {
  expect(() => {
    throw new MemoryLimitExceededError(1000, 2000);
  }).toThrow(MemoryLimitExceededError);
});

// PropertyValidationError tests
test("PropertyValidationError - creates error with key and label", () => {
  const error = new PropertyValidationError("invalidProp", "Person");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(GraphError);
  expect(error).toBeInstanceOf(PropertyValidationError);
  expect(error.message).toBe(
    "Property 'invalidProp' is not valid for label 'Person'",
  );
  expect(error.name).toBe("PropertyValidationError");
  expect(error.key).toBe("invalidProp");
  expect(error.label).toBe("Person");
});

test("PropertyValidationError - is throwable", () => {
  expect(() => {
    throw new PropertyValidationError("badKey", "Company");
  }).toThrow(PropertyValidationError);
});

// Test that context fields are accessible
test("VertexNotFoundError - exposes vertexId field", () => {
  const error = new VertexNotFoundError("Person:123");
  expect(error.vertexId).toBe("Person:123");
});

test("EdgeNotFoundError - exposes edgeId field", () => {
  const error = new EdgeNotFoundError("knows:456");
  expect(error.edgeId).toBe("knows:456");
});

test("ElementNotFoundError - exposes elementId field", () => {
  const error = new ElementNotFoundError("Element:789");
  expect(error.elementId).toBe("Element:789");
});

test("LabelNotFoundError - exposes label field", () => {
  const error = new LabelNotFoundError("UnknownType");
  expect(error.label).toBe("UnknownType");
});

// PropertyTypeError tests
test("PropertyTypeError - creates error with key, label, value, and issues", () => {
  const error = new PropertyTypeError("age", "Person", "not a number", [
    "Expected number, received string",
  ]);

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(GraphError);
  expect(error).toBeInstanceOf(PropertyTypeError);
  expect(error.message).toBe(
    "Property 'age' on label 'Person' failed validation: Expected number, received string",
  );
  expect(error.name).toBe("PropertyTypeError");
  expect(error.key).toBe("age");
  expect(error.label).toBe("Person");
  expect(error.value).toBe("not a number");
  expect(error.issues).toEqual(["Expected number, received string"]);
});

test("PropertyTypeError - handles multiple issues", () => {
  const error = new PropertyTypeError("email", "User", null, [
    "Expected string",
    "Cannot be null",
  ]);

  expect(error.message).toBe(
    "Property 'email' on label 'User' failed validation: Expected string; Cannot be null",
  );
  expect(error.issues).toEqual(["Expected string", "Cannot be null"]);
});

test("PropertyTypeError - is throwable", () => {
  expect(() => {
    throw new PropertyTypeError("name", "Company", 123, ["Expected string"]);
  }).toThrow(PropertyTypeError);
});

test("PropertyTypeError - exposes all context fields", () => {
  const error = new PropertyTypeError("status", "Order", undefined, [
    "Required field",
  ]);
  expect(error.key).toBe("status");
  expect(error.label).toBe("Order");
  expect(error.value).toBe(undefined);
  expect(error.issues).toEqual(["Required field"]);
});

// AsyncValidationError tests
test("AsyncValidationError - creates error with key and label", () => {
  const error = new AsyncValidationError("data", "User");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(GraphError);
  expect(error).toBeInstanceOf(AsyncValidationError);
  expect(error.message).toBe(
    "Property 'data' on label 'User' returned async validation result (not supported)",
  );
  expect(error.name).toBe("AsyncValidationError");
  expect(error.key).toBe("data");
  expect(error.label).toBe("User");
});

test("AsyncValidationError - is throwable", () => {
  expect(() => {
    throw new AsyncValidationError("field", "Entity");
  }).toThrow(AsyncValidationError);
});

test("AsyncValidationError - inherits from GraphError", () => {
  const error = new AsyncValidationError("prop", "Label");
  expect(error).toBeInstanceOf(GraphError);
});

// ReadonlyGraphError tests
test("ReadonlyGraphError - creates error with step name", () => {
  const error = new ReadonlyGraphError("Create");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(GraphError);
  expect(error).toBeInstanceOf(ReadonlyGraphError);
  expect(error.message).toBe(
    "Query contains mutation step 'Create' but readonly mode is enabled",
  );
  expect(error.name).toBe("ReadonlyGraphError");
  expect(error.stepName).toBe("Create");
});

test("ReadonlyGraphError - is throwable", () => {
  expect(() => {
    throw new ReadonlyGraphError("Delete");
  }).toThrow(ReadonlyGraphError);
});

test("ReadonlyGraphError - inherits from GraphError", () => {
  const error = new ReadonlyGraphError("Set");
  expect(error).toBeInstanceOf(GraphError);
});

test("ReadonlyGraphError - exposes stepName field", () => {
  const error = new ReadonlyGraphError("Merge");
  expect(error.stepName).toBe("Merge");
});
