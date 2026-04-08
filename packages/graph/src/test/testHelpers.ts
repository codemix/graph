/**
 * Shared test utilities for graph package tests.
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { GraphSchema } from "../GraphSchema.js";
import type { Query } from "../AST.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, stringifySteps } from "../Steps.js";

/**
 * Creates a mock StandardSchemaV1 type for testing.
 * The validator simply returns the value as-is without actual validation.
 */
export function makeType<T>(_defaultValue: T): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "codemix",
      validate: (value) => {
        return { value: value as T };
      },
    },
  };
}

/**
 * Strips ANSI escape codes from a string.
 * Useful for testing stringified output that may contain color codes.
 */
export function stripAnsiEscapeCodes(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Dumps steps as a string with ANSI codes stripped.
 * Useful for testing step stringification.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dumpSteps(steps: readonly any[]): string {
  return stripAnsiEscapeCodes(stringifySteps(steps));
}

/**
 * Parses and executes a query string against a graph.
 * Returns the results as an array.
 */
export function executeQuery(
  graph: Graph<GraphSchema>,
  queryString: string,
  debug: boolean = false,
): unknown[] {
  const ast = parse(queryString) as Query;
  const steps = astToSteps(ast);
  if (debug) {
    console.log(stringifySteps(steps));
  }
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

/**
 * Standard test schema with Person and Thing vertices, knows and likes edges.
 * Commonly used across many graph tests.
 */
export const standardTestSchema = {
  vertices: {
    Person: {
      properties: {
        name: { type: makeType<string>("") },
        age: { type: makeType<number>(0) },
      },
    },
    Thing: {
      properties: {
        name: { type: makeType<string>("") },
      },
    },
  },
  edges: {
    knows: {
      properties: {
        since: { type: makeType<number>(0) },
      },
    },
    likes: {
      properties: {},
    },
  },
} as const satisfies GraphSchema;

export type StandardTestSchema = typeof standardTestSchema;

/**
 * Creates a new graph with the standard test schema and in-memory storage.
 * Note: validateProperties is set to false for backward compatibility with existing tests.
 */
export function createTestGraph(): Graph<StandardTestSchema> {
  return new Graph({
    schema: standardTestSchema,
    storage: new InMemoryGraphStorage(),
    validateProperties: false,
  });
}

/**
 * Schema for testing CREATE queries with User and Post vertices.
 */
export const createTestSchema = {
  vertices: {
    User: {
      properties: {
        name: { type: makeType<string>("") },
        age: { type: makeType<number>(0) },
      },
    },
    Post: {
      properties: {
        title: { type: makeType<string>("") },
      },
    },
  },
  edges: {
    follows: {
      properties: {},
    },
  },
} as const satisfies GraphSchema;

export type CreateTestSchema = typeof createTestSchema;

/**
 * Creates a graph with the CREATE test schema.
 * Note: validateProperties is set to false for backward compatibility with existing tests.
 */
export function createUserPostGraph(): Graph<CreateTestSchema> {
  return new Graph({
    schema: createTestSchema,
    storage: new InMemoryGraphStorage(),
    validateProperties: false,
  });
}

/**
 * Flexible schema for testing write operations with arbitrary properties.
 * All properties are optional except name/title for flexibility in tests.
 */
export const flexibleTestSchema = {
  vertices: {
    User: {
      properties: {
        name: { type: makeType<string>("") },
        age: { type: makeType<number | undefined>(undefined) },
        email: { type: makeType<string | undefined>(undefined) },
        status: { type: makeType<string | undefined>(undefined) },
        verified: { type: makeType<boolean | undefined>(undefined) },
        createdAt: { type: makeType<number | undefined>(undefined) },
        lastSeen: { type: makeType<number | undefined>(undefined) },
        deleteme: { type: makeType<boolean | undefined>(undefined) },
        data: { type: makeType<string | undefined>(undefined) },
        temp: { type: makeType<string | undefined>(undefined) },
        keep: { type: makeType<boolean | undefined>(undefined) },
        marker: { type: makeType<string | undefined>(undefined) },
        newProp: { type: makeType<string | undefined>(undefined) },
      },
    },
    Post: {
      properties: {
        title: { type: makeType<string>("") },
        author: { type: makeType<string | undefined>(undefined) },
      },
    },
  },
  edges: {
    follows: { properties: {} },
    authored: {
      properties: {
        timestamp: { type: makeType<number | undefined>(undefined) },
      },
    },
    viewed: {
      properties: { count: { type: makeType<number | undefined>(undefined) } },
    },
    temp: { properties: {} },
    knows: { properties: {} },
  },
} as const satisfies GraphSchema;

export type FlexibleTestSchema = typeof flexibleTestSchema;

/**
 * Creates a graph with the flexible test schema for write operation tests.
 * Note: validateProperties is set to false for backward compatibility with existing tests.
 */
export function createFlexibleGraph(): Graph<FlexibleTestSchema> {
  return new Graph({
    schema: flexibleTestSchema,
    storage: new InMemoryGraphStorage(),
    validateProperties: false,
  });
}

/**
 * Comprehensive schema for testing all new query features including
 * domain modeling concepts like Concept, Property, Screen, etc.
 */
export const comprehensiveTestSchema = {
  vertices: {
    User: {
      properties: {
        name: { type: makeType<string>("") },
        age: { type: makeType<number | undefined>(undefined) },
        email: { type: makeType<string | undefined>(undefined) },
        status: { type: makeType<string | undefined>(undefined) },
        verified: { type: makeType<boolean | undefined>(undefined) },
        setting_name: { type: makeType<string | undefined>(undefined) },
      },
    },
    Post: {
      properties: {
        title: { type: makeType<string>("") },
        author: { type: makeType<string | undefined>(undefined) },
      },
    },
    Profile: {
      properties: {
        verified: { type: makeType<boolean | undefined>(undefined) },
      },
    },
    Concept: {
      properties: {
        name: { type: makeType<string>("") },
        description: { type: makeType<string | undefined>(undefined) },
      },
    },
    Property: {
      properties: {
        name: { type: makeType<string>("") },
        description: { type: makeType<string | undefined>(undefined) },
        presence: { type: makeType<string | undefined>(undefined) },
      },
    },
    DataType: {
      properties: {
        name: { type: makeType<string>("") },
      },
    },
    Screen: {
      properties: {
        name: { type: makeType<string>("") },
        description: { type: makeType<string | undefined>(undefined) },
      },
    },
    Config: {
      properties: {
        setting_name: { type: makeType<string | undefined>(undefined) },
        other: { type: makeType<string | undefined>(undefined) },
      },
    },
  },
  edges: {
    follows: { properties: {} },
    HAS: { properties: {} },
    FOLLOWS: { properties: {} },
    LIKES: { properties: {} },
    KNOWS: { properties: {} },
    HasAttribute: { properties: {} },
    Contains: { properties: {} },
    LinksTo: { properties: {} },
    IsA: { properties: {} },
    temp: { properties: {} },
  },
} as const satisfies GraphSchema;

export type ComprehensiveTestSchema = typeof comprehensiveTestSchema;

/**
 * Creates a graph with the comprehensive test schema for testing new query features.
 * Note: validateProperties is set to false for backward compatibility with existing tests.
 */
export function createComprehensiveGraph(): Graph<ComprehensiveTestSchema> {
  return new Graph({
    schema: comprehensiveTestSchema,
    storage: new InMemoryGraphStorage(),
    validateProperties: false,
  });
}
