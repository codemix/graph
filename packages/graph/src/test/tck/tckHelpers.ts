/**
 * TCK-specific test utilities.
 * Helpers for translating OpenCypher TCK tests to Vitest.
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { GraphSchema } from "../../GraphSchema.js";
import type { Query, UnionQuery } from "../../AST.js";
import { Graph, Element } from "../../Graph.js";

// Re-export Element for use in tests
export { Element };
import { InMemoryGraphStorage } from "../../GraphStorage.js";
import { parse } from "../../grammar.js";
import { anyAstToSteps } from "../../astToSteps.js";
import { createTraverser } from "../../Steps.js";
import { QueryContext, QueryParams } from "../../QueryContext.js";

/**
 * Creates a mock StandardSchemaV1 type for testing.
 * Accepts any value without validation.
 */
export function makeType<T>(): StandardSchemaV1<T> {
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
 * Dynamic property type for TCK schema.
 * Accepts any JSON-serializable value.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TckPropertyValue = any;

/**
 * Property definition that accepts any value.
 */
const anyProperty = { type: makeType<TckPropertyValue>() };

/**
 * TCK schema with permissive vertex and edge types.
 * Supports common TCK labels (A, B, C, etc.) and edge types (T, T1, T2, KNOWS, etc.).
 * Properties are flexible to accept any value.
 */
export const tckSchema = {
  vertices: {
    // Single-letter labels common in TCK
    A: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
        scores: anyProperty,
        items: anyProperty,
        price: anyProperty,
      },
    },
    B: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    C: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    D: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    E: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    X: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    Y: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    Z: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    // Common named labels
    Label: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    Foo: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    Bar: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    Node: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    Person: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
        age: anyProperty,
        email: anyProperty,
        firstname: anyProperty,
      },
    },
    Start: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    End: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    Root: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    Leaf: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    DoesExist: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    Single: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    TheLabel: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        created: anyProperty,
        x: anyProperty,
        y: anyProperty,
        a: anyProperty,
        b: anyProperty,
        c: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        foo: anyProperty,
        bar: anyProperty,
        baz: anyProperty,
        list: anyProperty,
        flag: anyProperty,
      },
    },
    // Additional labels for Match tests
    Artist: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        var: anyProperty,
      },
    },
    Blue: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    Red: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    Green: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    Yellow: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    Label1: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    Label2: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    Label3: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    Looper: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    Movie: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    NotThere: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    NonExistent: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    Player: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    Team: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    // MatchWhere test labels
    TextNode: { properties: { name: anyProperty, var: anyProperty } },
    IntNode: { properties: { name: anyProperty, var: anyProperty } },
    // Create test labels
    Dog: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    Begin: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    N: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    T: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    // Return test labels
    L: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    // Delete test labels
    User: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    DoesNotExist: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    // Comparison test labels
    Child: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        var: anyProperty,
      },
    },
    // Quantifier test labels
    SNodes: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    SRelationships: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
  },
  edges: {
    // Single-letter edge types
    T: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    T1: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    T2: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    R: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    REL: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    // Common named edge types
    KNOWS: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
        since: anyProperty,
      },
    },
    FRIEND: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    FRIENDS: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    LIKES: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    OWNS: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    HAS: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    RELATED: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    RELATED_TO: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    CONTAINS: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    LINK: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    LOOP: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    SELF: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    BLOCKS: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    FOLLOWS: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    X: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    Y: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        prop: anyProperty,
        property: anyProperty,
        value: anyProperty,
        data: anyProperty,
      },
    },
    // Additional edge types for Match tests
    A: { properties: { name: anyProperty, num: anyProperty, id: anyProperty } },
    B: { properties: { name: anyProperty, num: anyProperty, id: anyProperty } },
    T3: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    T4: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    TYPE: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    HATES: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    WONDERS: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    FOO: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    BAR: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    NOT_EXIST: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    CONNECTED_TO: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    WORKED_WITH: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        year: anyProperty,
      },
    },
    EDGE: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    NOR_THIS: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    PLAYS_FOR: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    SUPPORTS: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    ATE: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        times: anyProperty,
      },
    },
    // MatchWhere test edge types
    ADMIN: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    E1: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    E2: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    // Create test edge types
    R1: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    R2: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    R3: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    ACTED_IN: {
      properties: {
        name: anyProperty,
        num: anyProperty,
        id: anyProperty,
        roles: anyProperty,
      },
    },
    DIRECTED: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    PRODUCED: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    WROTE: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    // Delete test edge types
    DoesNotExist: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    // Pattern test edge types
    REL1: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    REL2: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    REL3: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    REL4: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
    // ExistentialSubquery test edge types
    NA: {
      properties: { name: anyProperty, num: anyProperty, id: anyProperty },
    },
  },
} as const satisfies GraphSchema;

export type TckSchema = typeof tckSchema;

/**
 * Creates a new graph with the TCK schema for testing.
 */
export function createTckGraph(): Graph<TckSchema> {
  return new Graph({
    schema: tckSchema,
    storage: new InMemoryGraphStorage(),
  });
}

/**
 * Parses and executes a query string against a TCK graph.
 * Returns the results as an array.
 * Supports both regular Query and UnionQuery.
 * @param graph The graph to query.
 * @param queryString The Cypher query string.
 * @param params Optional query parameters ($param references).
 */
export function executeTckQuery(
  graph: Graph<TckSchema>,
  queryString: string,
  params?: QueryParams,
): unknown[] {
  const ast = parse(queryString) as Query | UnionQuery;
  // Use anyAstToSteps which handles both Query and UnionQuery
  const steps = anyAstToSteps(ast);
  const traverser = createTraverser(steps);
  // Create a QueryContext with parameters if provided
  const context = params ? new QueryContext(graph, params) : undefined;
  return Array.from(traverser.traverse(graph, [], context));
}

/**
 * Compares two result sets for equality, ignoring order.
 * Each result is expected to be an object (record).
 */
export function resultsMatch(actual: unknown[], expected: unknown[]): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  const expectedCopy = [...expected];
  for (const actualItem of actual) {
    const idx = expectedCopy.findIndex((e) => deepEqual(e, actualItem));
    if (idx === -1) {
      return false;
    }
    expectedCopy.splice(idx, 1);
  }
  return true;
}

/**
 * Deep equality check for comparing TCK results.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

/**
 * Normalizes a result value from the graph for comparison.
 * Strips internal properties like $id, $label, $type, etc.
 */
export function normalizeResult(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeResult);
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      // Skip internal graph properties
      if (key.startsWith("$")) {
        continue;
      }
      result[key] = normalizeResult(val);
    }
    return result;
  }

  return value;
}

/**
 * Extracts properties from a node/edge result for comparison.
 * Returns only the user-defined properties.
 */
export function extractProperties(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (!key.startsWith("$")) {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Gets the label of a node result.
 * For Vertex/Edge instances, uses the label property.
 * For plain objects, extracts from id format "Label:uuid".
 */
export function getLabel(value: Record<string, unknown>): string | undefined {
  // If it's an Element instance, use the label property directly
  if (value instanceof Element) {
    return value.label;
  }
  // Try $label first (if set)
  if (value.$label) {
    return value.$label as string;
  }
  // Extract from id format "Label:uuid"
  const id = value.id as string | undefined;
  if (id && typeof id === "string") {
    const colonIndex = id.indexOf(":");
    if (colonIndex > 0) {
      return id.substring(0, colonIndex);
    }
  }
  return undefined;
}

/**
 * Gets the type of an edge result.
 * For Edge instances, uses the label property (edge types are stored as labels).
 * For plain objects, extracts from id format "Type:uuid".
 */
export function getType(value: Record<string, unknown>): string | undefined {
  // If it's an Element instance, use the label property directly
  if (value instanceof Element) {
    return value.label;
  }
  // Try $type first (if set)
  if (value.$type) {
    return value.$type as string;
  }
  // Extract from id format "Type:uuid"
  const id = value.id as string | undefined;
  if (id && typeof id === "string") {
    const colonIndex = id.indexOf(":");
    if (colonIndex > 0) {
      return id.substring(0, colonIndex);
    }
  }
  return undefined;
}

/**
 * Gets a property value from a node/edge result.
 * For Vertex/Edge instances, uses the get() method.
 * For plain objects, looks in the 'properties' sub-object.
 */
export function getProperty(
  value: Record<string, unknown>,
  name: string,
): unknown {
  // If it's a Vertex or Edge instance, use the get() method
  if (value instanceof Element) {
    return value.get(name as never);
  }
  // Fallback for plain objects (e.g., after JSON serialization)
  const props = value.properties as Record<string, unknown> | undefined;
  return props?.[name];
}

/**
 * Gets the internal ID of a node/edge result.
 * For Element instances, uses the id property directly.
 */
export function getId(value: Record<string, unknown>): string | undefined {
  if (value instanceof Element) {
    return value.id;
  }
  return value.id as string | undefined;
}
