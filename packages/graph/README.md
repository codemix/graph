# @codemix/graph

A fully type-safe, TypeScript-first in-memory property graph database with a Cypher-compatible query language, a **type-safe [Apache TinkerPop](https://tinkerpop.apache.org/) / [Gremlin](https://tinkerpop.apache.org/docs/current/reference/#gremlin)-style traversal API** (`GraphTraversal`), lazy indexes, and async transport support.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Defining a Schema](#defining-a-schema)
- [Creating a Graph](#creating-a-graph)
- [Mutating the Graph](#mutating-the-graph)
  - [Vertices](#vertices)
  - [Edges](#edges)
  - [Updating Properties](#updating-properties)
  - [Deleting Elements](#deleting-elements)
- [Querying with Cypher](#querying-with-cypher)
  - [Parsing Queries](#parsing-queries)
  - [Supported Clauses](#supported-clauses)
  - [Supported Functions](#supported-functions)
  - [Supported Procedures](#supported-procedures)
- [Type-safe TinkerPop / Gremlin traversal API](#type-safe-tinkerpop--gremlin-traversal-api)
  - [Starting a Traversal](#starting-a-traversal)
  - [Navigation Steps](#navigation-steps)
  - [Filtering](#filtering)
  - [Labeling and Selection](#labeling-and-selection)
  - [Ordering, Skipping, Limiting](#ordering-skipping-limiting)
  - [Aggregation](#aggregation)
  - [Repeat Traversals](#repeat-traversals)
  - [Shortest Path](#shortest-path)
  - [Union and Intersection](#union-and-intersection)
- [Indexes](#indexes)
  - [Hash Index](#hash-index)
  - [B-Tree Index](#b-tree-index)
  - [Full-Text Index](#full-text-index)
- [Async Transport](#async-transport)
- [Custom Storage](#custom-storage)
- [Schema Guide Generation](#schema-guide-generation)
- [Error Reference](#error-reference)

---

## Features

- **TypeScript-first** — schema-derived types flow through the entire API; vertex/edge properties are fully typed.
- **Cypher-compatible query language** — parse and execute `MATCH … WHERE … RETURN` queries, `UNION`, multi-statement queries, `CREATE`, `SET`, `DELETE`, `MERGE`, `UNWIND`, `CALL`, `FOREACH`, and more.
- **Type-safe TinkerPop / Gremlin traversals** — `GraphTraversal` mirrors familiar Gremlin steps (`V`, `E`, `out` / `in` / `both`, `hasLabel`, `as` / `select`, `repeat`, …) with **schema-derived TypeScript types** on `TraversalPath` and property access, not untyped strings at every hop.
- **Lazy indexes** — hash, B-tree, and full-text indexes are built on first use and maintained incrementally on every mutation.
- **Unique constraints** — enforce uniqueness on any indexed property.
- **Standard Schema validation** — property types are validated via the [Standard Schema](https://github.com/standard-schema/standard-schema) spec (compatible with Zod, Valibot, ArkType, etc.).
- **Async transport** — serialize traversal steps to JSON and execute them on a remote graph via any async channel.
- **In-memory storage** — built-in `InMemoryGraphStorage` with optional custom `GraphStorage` implementations.

---

## Installation

```bash
npm install @codemix/graph
# or
pnpm add @codemix/graph
```

---

## Quick Start

```ts
import { Graph, GraphSchema, InMemoryGraphStorage, GraphTraversal } from "@codemix/graph";
import * as v from "valibot"; // any Standard Schema library

const schema = {
  vertices: {
    Person: {
      properties: {
        name: { type: v.string() },
        age: { type: v.number() },
      },
    },
  },
  edges: {
    knows: { properties: {} },
  },
} as const satisfies GraphSchema;

const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
graph.addEdge(alice, "knows", bob, {});

const g = new GraphTraversal(graph);
for (const path of g.V().hasLabel("Person").out("knows")) {
  console.log(path.value.get("name")); // "Bob"
}
```

---

## Defining a Schema

A schema is a plain object that satisfies the `GraphSchema` interface:

```ts
import { GraphSchema } from "@codemix/graph";
import { StandardSchemaV1 } from "@standard-schema/spec";

// Minimal helper – use Zod/Valibot/ArkType in practice
function t<T>(defaultValue: T): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "my-app",
      validate: (v) => ({ value: v as T }),
    },
  };
}

const schema = {
  vertices: {
    Movie: {
      properties: {
        title: { type: t("") },
        released: { type: t(0) },
      },
    },
    Person: {
      properties: {
        name: { type: t("") },
        born: { type: t(0) },
      },
    },
  },
  edges: {
    ACTED_IN: {
      properties: {
        roles: { type: t([] as string[]) },
      },
    },
    DIRECTED: { properties: {} },
  },
} as const satisfies GraphSchema;

export type MySchema = typeof schema;
```

Properties defined in the schema are validated on every `addVertex`, `addEdge`, and `updateProperty` call (disable with `validateProperties: false`).

---

## Creating a Graph

```ts
import { Graph, InMemoryGraphStorage } from "@codemix/graph";

const graph = new Graph<MySchema>({
  schema, // required
  storage: new InMemoryGraphStorage(), // required
  validateProperties: true, // default: true
  generateId: () => crypto.randomUUID(), // optional custom ID generator
});
```

---

## Mutating the Graph

### Vertices

```ts
// Two equivalent signatures:
const person = graph.addVertex("Person", { name: "Keanu Reeves", born: 1964 });
const movie = graph.addVertex({
  label: "Movie",
  properties: { title: "The Matrix", released: 1999 },
});

// Read properties
person.get("name"); // "Keanu Reeves"
person.label; // "Person"
person.id; // "Person:<uuid>"
```

### Edges

```ts
// Four-argument form:
const edge = graph.addEdge(person, "ACTED_IN", movie, { roles: ["Neo"] });

// Object form:
graph.addEdge({
  outV: person,
  label: "ACTED_IN",
  inV: movie,
  properties: { roles: ["Neo"] },
});

// Access endpoints
edge.outV; // source Vertex
edge.inV; // target Vertex
```

### Updating Properties

```ts
graph.updateProperty(person, "born", 1965);
// or via the element itself:
person.set("born", 1965);
```

### Deleting Elements

```ts
graph.deleteVertex(person); // also accepts ElementId string
graph.deleteEdge(edge);
```

---

## Querying with Cypher

### Parsing Queries

Use `parseQueryToSteps` to compile a Cypher string and get back executable steps plus a result mapper:

```ts
import { Graph, InMemoryGraphStorage, parseQueryToSteps, GraphTraversal } from "@codemix/graph";

const { steps, postprocess } = parseQueryToSteps(
  "MATCH (p:Person)-[:ACTED_IN]->(m:Movie) WHERE p.name = $name RETURN p.name, m.title",
);

// Execute against a graph:
import { createTraverser } from "@codemix/graph";
const traverser = createTraverser(steps);
for (const row of traverser.traverse(graph, [{ name: "Keanu Reeves" }])) {
  console.log(postprocess(row));
  // { p: { name: "Keanu Reeves" }, m: { title: "The Matrix" } }
}
```

Enforce read-only mode (throws `ReadonlyGraphError` on `CREATE` / `SET` / `DELETE` / etc.):

```ts
const { steps } = parseQueryToSteps(query, { readonly: true });
```

You can also access the lower-level parse → AST → steps pipeline:

```ts
import { parse, astToSteps, anyAstToSteps } from "@codemix/graph";

const ast = parse("MATCH (n) RETURN n");
const steps = astToSteps(ast);
```

### Supported Clauses

| Clause                     | Description                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `MATCH`                    | Pattern matching with node/edge/path patterns                                           |
| `OPTIONAL MATCH`           | Left-outer-join style optional pattern                                                  |
| `WHERE`                    | Boolean conditions, `IS NULL`, `IN`, `STARTS WITH`, `ENDS WITH`, `CONTAINS`, `=~` regex |
| `RETURN`                   | Property projection, aliases, `DISTINCT`                                                |
| `ORDER BY … ASC/DESC`      | Multi-key ordering                                                                      |
| `SKIP` / `LIMIT`           | Pagination                                                                              |
| `CREATE`                   | Create nodes and edges                                                                  |
| `MERGE`                    | Upsert node/edge patterns                                                               |
| `SET`                      | Update properties or labels                                                             |
| `DELETE` / `DETACH DELETE` | Remove elements                                                                         |
| `REMOVE`                   | Remove properties or labels                                                             |
| `UNWIND`                   | Expand a list into rows                                                                 |
| `WITH`                     | Pipeline intermediate results                                                           |
| `CALL … YIELD`             | Invoke registered procedures                                                            |
| `FOREACH`                  | Iterate and apply mutations                                                             |
| `UNION` / `UNION ALL`      | Combine result sets                                                                     |
| Multi-statement (`;`)      | Execute multiple statements sequentially                                                |

Pattern quantifiers (`*`, `+`, `{n,m}`) and parenthesised path patterns are supported.

### Supported Functions

Scalar: `abs`, `ceil`, `floor`, `round`, `sign`, `sqrt`, `exp`, `log`, `log10`, `toInteger`, `toFloat`, `toString`, `toBoolean`, `toLower`, `toUpper`, `trim`, `ltrim`, `rtrim`, `left`, `right`, `substring`, `replace`, `split`, `reverse`, `length`, `size`, `isEmpty`, `coalesce`, `nullIf`, `type`, `startNode`, `endNode`, `id`, `labels`, `keys`, `properties`, `nodes`, `relationships`, `range`, `randomUUID`

List: `head`, `last`, `tail`, `reverse` (list), `sort`, `reduce`, `zip`, `unzip`

Aggregate: `count`, `sum`, `avg`, `min`, `max`, `collect`, `percentileCont`, `percentileDisc`, `stDev`, `stDevP`

Temporal: `date`, `time`, `localTime`, `datetime`, `localdatetime`, `duration`, `date.truncate`, `datetime.truncate`, and arithmetic on temporal values.

Path: `shortestPath`, `allShortestPaths`

Predicate: `exists`, `any`, `all`, `none`, `single`

### Supported Procedures

| Procedure                        | Description                           |
| -------------------------------- | ------------------------------------- |
| `db.labels()`                    | Return all vertex labels in the graph |
| `db.relationshipTypes()`         | Return all edge labels                |
| `db.propertyKeys()`              | Return all property keys              |
| `db.schema.nodeTypeProperties()` | Return node type/property metadata    |
| `db.schema.relTypeProperties()`  | Return edge type/property metadata    |

Register custom procedures via `ProcedureRegistry`:

```ts
import { procedureRegistry } from "@codemix/graph";

procedureRegistry.register({
  name: "my.procedure",
  description: "Does something useful",
  params: [{ name: "input", required: true }],
  yields: [{ name: "result" }],
  invoke({ params }) {
    yield[params[0]?.toString().toUpperCase()];
  },
});
```

---

## Type-safe TinkerPop / Gremlin traversal API

`GraphTraversal` ([`src/Traversals.ts`](./src/Traversals.ts)) is the programmatic counterpart to Cypher: a **fluent, Gremlin-style** API in the spirit of [Apache TinkerPop](https://tinkerpop.apache.org/) — same mental model as `g.V().out('knows')` in Gremlin — but **fully typed** against your `GraphSchema` so labels, edge directions, and property keys are checked by TypeScript.

If you already know Gremlin, the step names and composition will feel familiar; the main difference is that paths carry typed vertices/edges from your schema instead of generic maps.

### Starting a Traversal

```ts
import { GraphTraversal } from "@codemix/graph";

const g = new GraphTraversal(graph);

// All vertices (optionally filtered by id)
g.V();
g.V("Person:abc-123");

// All edges (optionally filtered by id)
g.E();
g.E("ACTED_IN:xyz-456");
```

### Navigation Steps

```ts
g.V()
  .out("ACTED_IN") // outgoing edges of type ACTED_IN → arrive at movies
  .in("DIRECTED") // incoming edges of type DIRECTED  → arrive at directors
  .both() // traverse any edge in either direction
  .outE("ACTED_IN") // outgoing edges (stay on Edge)
  .inE() // incoming edges (stay on Edge)
  .bothE(); // both directions (stay on Edge)
```

### Filtering

```ts
g.V()
  .hasLabel("Person")
  .has("born", 1964) // exact value match
  .has("name", (name) => name.startsWith("K"))
  .where((v) => v.get("age") > 30);
```

### Labeling and Selection

```ts
g.V().hasLabel("Person").as("actor").out("ACTED_IN").as("movie").select("actor", "movie");
// yields { actor: TraversalPath, movie: TraversalPath }
```

### Ordering, Skipping, Limiting

```ts
g.V().hasLabel("Person").order("born", "asc").skip(10).limit(5);
```

### Aggregation

```ts
// Count
g.V().hasLabel("Person").count();

// Values
g.V().hasLabel("Person").values("name"); // yields strings

// Dedup
g.V().hasLabel("Person").values("name").dedup();
```

### Repeat Traversals

```ts
// Walk up to 3 hops outward via "knows"
g.V()
  .hasLabel("Person")
  .repeat((t) => t.out("knows"))
  .times(3)
  .emit();
```

### Shortest Path

```ts
g.V()
  .hasLabel("Person")
  .shortestPath(
    (t) => t.out("knows"), // expansion
    targetVertex, // destination vertex or id
    { maxDepth: 10 },
  );
```

### Union and Intersection

```ts
// Union two traversals
g.union(g.V().hasLabel("Person"), g.V().hasLabel("Organisation"));

// Intersection
g.intersect(g.V().hasLabel("Person"), g.V().has("name", "Alice"));
```

---

## Indexes

Indexes are declared in the schema and built lazily on first use, then maintained incrementally on every mutation.

### Hash Index

O(1) equality lookups. Supports optional unique constraint.

```ts
const schema = {
  vertices: {
    User: {
      properties: {
        email: {
          type: t(""),
          index: { type: "hash", unique: true }, // enforce uniqueness
        },
        role: {
          type: t(""),
          index: { type: "hash" },
        },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;
```

### B-Tree Index

O(log n) range queries (less-than, greater-than, between). Also supports unique constraint.

```ts
age: {
  type: t(0),
  index: { type: "btree" },
}
```

### Full-Text Index

BM25-ranked text search via `@codemix/text-search`.

```ts
bio: {
  type: t(""),
  index: {
    type: "fulltext",
    options: { stemming: true }, // MatcherOptions from @codemix/text-search
  },
}
```

Query with the `CALL db.index.fulltext.queryNodes` procedure or use the `IndexManager` directly:

```ts
const results = graph.indexManager.query("User", "bio", "machine learning");
```

Duplicate inserts into a unique-indexed property throw `UniqueConstraintViolationError`.

---

## Async Transport

`AsyncGraph` decouples query compilation from execution. The client serialises steps to JSON; the server executes them against a real `Graph` and streams results back.

**Server side:**

```ts
import { Graph, InMemoryGraphStorage, handleAsyncCommand } from "@codemix/graph";

const graph = new Graph({ schema, storage: new InMemoryGraphStorage() });

// In your WebSocket / worker message handler:
async function* onMessage(command) {
  yield* handleAsyncCommand(graph, command);
}
```

**Client side:**

```ts
import { AsyncGraph, GraphTraversal } from "@codemix/graph";

const remote = new AsyncGraph({
  schema,
  transport: async function* (command) {
    // Send command to the server and stream back results
    const ws = getWebSocket();
    ws.send(JSON.stringify(command));
    for await (const message of ws) {
      yield JSON.parse(message);
    }
  },
});

for await (const path of remote.query((g) => g.V().hasLabel("Person"))) {
  console.log(path.value.get("name"));
}
```

---

## Custom Storage

Implement the `GraphStorage` interface to plug in any backend:

```ts
import { GraphStorage, StoredVertex, StoredEdge, ElementId } from "@codemix/graph";

class MyStorage implements GraphStorage {
  getVertexById(id: ElementId): StoredVertex | undefined {
    /* … */
  }
  getVertices(labels: string[]): Iterable<StoredVertex> {
    /* … */
  }
  getVerticesByIds(ids: Iterable<ElementId>): Iterable<StoredVertex> {
    /* … */
  }
  getEdgeById(id: ElementId): StoredEdge | undefined {
    /* … */
  }
  getEdges(labels: string[]): Iterable<StoredEdge> {
    /* … */
  }
  getEdgesByIds(ids: Iterable<ElementId>): Iterable<StoredEdge> {
    /* … */
  }
  getIncomingEdges(vertexId: ElementId): Iterable<StoredEdge> {
    /* … */
  }
  getOutgoingEdges(vertexId: ElementId): Iterable<StoredEdge> {
    /* … */
  }
  addVertex(vertex: StoredVertex): void {
    /* … */
  }
  addEdge(edge: StoredEdge): void {
    /* … */
  }
  deleteVertex(id: ElementId): void {
    /* … */
  }
  deleteEdge(id: ElementId): void {
    /* … */
  }
  updateProperty(id: ElementId, key: string, value: unknown): void {
    /* … */
  }
}

const graph = new Graph({ schema, storage: new MyStorage() });
```

---

## Schema Guide Generation

Generate a human (or LLM) readable description of the query language and your schema for use in prompts or documentation:

```ts
import { generateGrammarDescription, generateSchemaGuide } from "@codemix/graph";

// Language grammar description (schema-agnostic)
const grammar = generateGrammarDescription();

// Schema-specific guide (lists vertex/edge labels, their properties, and indexes)
const guide = generateSchemaGuide(schema);

console.log(grammar);
console.log(guide);
```

---

## Error Reference

All errors extend `GraphError`.

| Error class                      | Thrown when                                                 |
| -------------------------------- | ----------------------------------------------------------- |
| `VertexNotFoundError`            | `getVertexById` with `throwIfNotFound: true` and no match   |
| `EdgeNotFoundError`              | `getEdgeById` with `throwIfNotFound: true` and no match     |
| `ElementNotFoundError`           | Generic element lookup failure                              |
| `LabelNotFoundError`             | `getElementById` called with an unknown label               |
| `GraphConsistencyError`          | An edge references a vertex that no longer exists           |
| `PropertyValidationError`        | A property key is not defined in the schema (strict mode)   |
| `PropertyTypeError`              | A property value fails Standard Schema validation           |
| `AsyncValidationError`           | A property schema returns a `Promise` (only sync supported) |
| `UniqueConstraintViolationError` | An insert/update would violate a unique index               |
| `ReadonlyGraphError`             | A mutation step is found when `readonly: true` is set       |
| `MaxIterationsExceededError`     | A traversal step hits the configured iteration limit        |
| `MemoryLimitExceededError`       | A collection operation exceeds the configured size limit    |
| `InvalidComparisonError`         | Comparing values of incompatible types                      |

```ts
import { UniqueConstraintViolationError } from "@codemix/graph";

try {
  graph.addVertex("User", { email: "alice@example.com" });
  graph.addVertex("User", { email: "alice@example.com" }); // duplicate
} catch (err) {
  if (err instanceof UniqueConstraintViolationError) {
    console.error(err.property, err.value, err.existingElementId);
  }
}
```

---

## License

MIT
