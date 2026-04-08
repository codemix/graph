import { ElementId } from "./GraphStorage.js";

/**
 * Base class for all graph-related errors.
 * Provides a common type for catching graph-specific errors.
 */
export class GraphError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GraphError";
  }
}

export class GraphConsistencyError extends GraphError {
  public constructor(message: string) {
    super(message);
    this.name = "GraphConsistencyError";
  }
}

export class ElementNotFoundError extends GraphError {
  public readonly elementId: ElementId;

  public constructor(id: ElementId) {
    super(`Element ${id} not found`);
    this.name = "ElementNotFoundError";
    this.elementId = id;
  }
}

export class VertexNotFoundError extends GraphError {
  public readonly vertexId: ElementId;

  public constructor(id: ElementId) {
    super(`Vertex ${id} not found`);
    this.name = "VertexNotFoundError";
    this.vertexId = id;
  }
}

export class EdgeNotFoundError extends GraphError {
  public readonly edgeId: ElementId;

  public constructor(id: ElementId) {
    super(`Edge ${id} not found`);
    this.name = "EdgeNotFoundError";
    this.edgeId = id;
  }
}

export class LabelNotFoundError extends GraphError {
  public readonly label: string;

  public constructor(label: string) {
    super(`Label ${label} not found`);
    this.name = "LabelNotFoundError";
    this.label = label;
  }
}

/**
 * Thrown when comparing values of incompatible types.
 */
export class InvalidComparisonError extends GraphError {
  public readonly valueA: unknown;
  public readonly valueB: unknown;

  public constructor(valueA: unknown, valueB: unknown) {
    super(`Cannot compare values of incompatible types: ${typeof valueA} and ${typeof valueB}`);
    this.name = "InvalidComparisonError";
    this.valueA = valueA;
    this.valueB = valueB;
  }
}

/**
 * Thrown when a traversal step exceeds the configured iteration limit.
 */
export class MaxIterationsExceededError extends GraphError {
  public readonly limit: number;
  public readonly step: string;

  public constructor(limit: number, step: string) {
    super(
      `Maximum iterations (${limit}) exceeded in ${step}. Consider adding a LIMIT clause or increasing maxIterations.`,
    );
    this.name = "MaxIterationsExceededError";
    this.limit = limit;
    this.step = step;
  }
}

/**
 * Thrown when a collection operation exceeds the configured size limit.
 */
export class MemoryLimitExceededError extends GraphError {
  public readonly limit: number;
  public readonly actual: number;

  public constructor(limit: number, actual: number) {
    super(
      `Collection size (${actual}) exceeds limit (${limit}). Consider adding a LIMIT clause or increasing maxCollectionSize.`,
    );
    this.name = "MemoryLimitExceededError";
    this.limit = limit;
    this.actual = actual;
  }
}

/**
 * Thrown when property validation fails (when strict schema validation is enabled).
 * This error is thrown when a property key is not defined in the schema.
 */
export class PropertyValidationError extends GraphError {
  public readonly key: string;
  public readonly label: string;

  public constructor(key: string, label: string) {
    super(`Property '${key}' is not valid for label '${label}'`);
    this.name = "PropertyValidationError";
    this.key = key;
    this.label = label;
  }
}

/**
 * Thrown when a property value fails schema type validation.
 * This error is thrown when the value doesn't match the expected type in the schema.
 */
export class PropertyTypeError extends GraphError {
  public readonly key: string;
  public readonly label: string;
  public readonly value: unknown;
  public readonly issues: readonly string[];

  public constructor(key: string, label: string, value: unknown, issues: readonly string[]) {
    const issueText = issues.join("; ");
    super(`Property '${key}' on label '${label}' failed validation: ${issueText}`);
    this.name = "PropertyTypeError";
    this.key = key;
    this.label = label;
    this.value = value;
    this.issues = issues;
  }
}

/**
 * Thrown when an insert or update would violate a unique index constraint.
 * This error indicates that another element with the same label already has
 * the same value for the unique property.
 */
export class UniqueConstraintViolationError extends GraphError {
  public readonly label: string;
  public readonly property: string;
  public readonly value: unknown;
  public readonly existingElementId: ElementId;

  public constructor(
    label: string,
    property: string,
    value: unknown,
    existingElementId: ElementId,
  ) {
    super(
      `Unique constraint violation: property '${property}' on label '${label}' already has value ${JSON.stringify(value)} (existing element: ${existingElementId})`,
    );
    this.name = "UniqueConstraintViolationError";
    this.label = label;
    this.property = property;
    this.value = value;
    this.existingElementId = existingElementId;
  }
}

/**
 * Thrown when a property schema returns a Promise from validate().
 * The graph database only supports synchronous validation.
 */
export class AsyncValidationError extends GraphError {
  public readonly key: string;
  public readonly label: string;

  public constructor(key: string, label: string) {
    super(`Property '${key}' on label '${label}' returned async validation result (not supported)`);
    this.name = "AsyncValidationError";
    this.key = key;
    this.label = label;
  }
}

/**
 * Thrown when a query contains mutation steps but readonly mode is enabled.
 * This error is thrown during query parsing before any traversal occurs.
 */
export class ReadonlyGraphError extends GraphError {
  public readonly stepName: string;

  public constructor(stepName: string) {
    super(`Query contains mutation step '${stepName}' but readonly mode is enabled`);
    this.name = "ReadonlyGraphError";
    this.stepName = stepName;
  }
}
