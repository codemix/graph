<p align="center">
  <a href="https://codemix.com/">
    <img src="./codemix-logo.png" alt="codemix" width="240" />
  </a>
</p>

# @codemix/graph

A fully type-safe, TypeScript-first in-memory property graph database with a Cypher-like query language, a **type-safe [TinkerPop](https://tinkerpop.apache.org/) / [Gremlin](https://tinkerpop.apache.org/docs/current/reference/#gremlin)-style traversal API** (`GraphTraversal`), multiple index types, and pluggable storage adapters including a [Yjs](https://yjs.dev/) CRDT-based adapter for collaborative/realtime/offline-first use.

This is the knowledge graph database for the [codemix](https://codemix.com/) product intelligence platform.

## Packages

| Package                                                  | Description                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`@codemix/graph`](./packages/graph)                     | Core graph database: Cypher queries + type-safe Gremlin-style traversals (`GraphTraversal`) |
| [`@codemix/text-search`](./packages/text-search)         | BM25-based full-text search with English stemming                                           |
| [`@codemix/y-graph-storage`](./packages/y-graph-storage) | [Yjs](https://yjs.dev/) CRDT storage adapter for collaborative/offline-first use            |

---

## `@codemix/graph`

A fully typed, in-memory graph database. Vertices and edges are strongly typed against a user-defined schema. You can query with a subset of [Cypher](https://neo4j.com/docs/cypher-manual/current/) **or** with a fluent, **type-safe [Apache TinkerPop](https://tinkerpop.apache.org/) / [Gremlin](https://tinkerpop.apache.org/docs/current/reference/#gremlin)-style API** — see [`GraphTraversal`](./packages/graph/README.md#type-safe-tinkerpop--gremlin-traversal-api) in the package docs.

### Features

- **Type-safe TinkerPop / Gremlin traversals** — `GraphTraversal` exposes familiar steps (`V()`, `E()`, `out()`, `in()`, `both()`, `hasLabel()`, `as()` / `select()`, `repeat()` …) with schema-derived typing on paths and properties; pairs with `AsyncGraph.query` for remote execution
- **Cypher query language** — parsed via a PEG grammar, supporting `MATCH`, `WHERE`, `RETURN`, `CREATE`, `SET`, `DELETE`, `MERGE`, `UNWIND`, `UNION`, `WITH`, multi-statement queries, and more
- **Strongly typed schema** — vertex/edge labels and their properties are defined once and inferred throughout
- **Standard Schema validation** — property values are validated using [Standard Schema](https://standardschema.dev/) compatible validators (works with Zod, Valibot, etc.)
- **Multiple index types** — hash (O(1) equality), B-tree (O(log n) range), and full-text (BM25-scored)
- **Async/distributed graph** — `AsyncGraph` supports serializable operations for use across network boundaries
- **Readonly mode** — parse queries with `readonly: true` to prevent mutation steps

### Installation

```bash
pnpm add @codemix/graph
```

### Development

Running `pnpm install` in the monorepo configures Git to use the tracked hooks in `.githooks`.

The pre-commit hook formats staged supported source files with `oxfmt` and restages them automatically. You can re-run the hook setup at any time with `pnpm run setup:hooks`.

### Quick Start

```typescript
import { Graph, GraphSchema } from "@codemix/graph";
import { InMemoryGraphStorage } from "@codemix/graph";
import * as z from "zod";

// 1. Define your schema
const schema = {
  vertices: {
    Person: {
      properties: {
        name: { type: z.string() },
        age: { type: z.number() },
      },
    },
  },
  edges: {
    knows: { properties: {} },
  },
} as const satisfies GraphSchema;

// 2. Create the graph
const graph = new Graph({
  schema,
  storage: new InMemoryGraphStorage(),
});

// 3. Add data
const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
graph.addEdge(alice, "knows", bob, {});

// 4. Query with Cypher
const results = graph.query("MATCH (a:Person)-[:knows]->(b:Person) RETURN a.name, b.name");
// [{ a: { name: "Alice" }, b: { name: "Bob" } }]
```

### Type-safe Gremlin-style traversals

The same graph is navigable with a fluent API modeled on [Apache TinkerPop Gremlin](https://tinkerpop.apache.org/docs/current/reference/#gremlin); labels and properties stay typed end-to-end:

```typescript
import { GraphTraversal } from "@codemix/graph";

const g = new GraphTraversal(graph);
for (const path of g.V().hasLabel("Person").out("knows")) {
  console.log(path.value.get("name"));
}
```

See the [type-safe TinkerPop / Gremlin traversal API](./packages/graph/README.md#type-safe-tinkerpop--gremlin-traversal-api) section in `@codemix/graph` for the full step reference.

### Defining a Schema

```typescript
import { GraphSchema } from "@codemix/graph";
import * as z from "zod";

const schema = {
  vertices: {
    Product: {
      properties: {
        sku: { type: z.string() },
        price: { type: z.number().positive() },
        name: {
          type: z.string(),
          index: { type: "fulltext" }, // full-text search index
        },
      },
      indexes: {
        sku: { type: "hash", unique: true }, // unique hash index
      },
    },
  },
  edges: {
    PURCHASED: {
      properties: {
        quantity: { type: z.number().int().positive() },
      },
    },
  },
} as const satisfies GraphSchema;
```

### Index Types

| Type       | Lookup      | Use case                                                 |
| ---------- | ----------- | -------------------------------------------------------- |
| `hash`     | O(1)        | Equality (`=`) on high-cardinality properties            |
| `btree`    | O(log n)    | Range queries (`>`, `<`, `>=`, `<=`, `BETWEEN`)          |
| `fulltext` | BM25 scored | `CONTAINS` / free-text search via `@codemix/text-search` |

All index types support a `unique: true` constraint that throws `UniqueConstraintViolationError` on duplicate values.

### Supported Cypher Features

- `MATCH` with node and relationship patterns, variable-length paths (`*1..5`), shortest path
- `WHERE` with boolean logic, property access, `IN`, `STARTS WITH`, `ENDS WITH`, `CONTAINS`, `IS NULL`, `IS NOT NULL`, label expressions (`IS LABELED`)
- `RETURN` with aliases (`AS`), `DISTINCT`, `ORDER BY`, `SKIP`, `LIMIT`
- `CREATE`, `SET`, `DELETE`, `REMOVE`, `MERGE`
- `WITH` (pipeline intermediate results)
- `UNWIND`
- `UNION` / `UNION ALL`
- Multi-statement queries (semicolon-separated)
- `CALL` procedures (built-in and custom via `ProcedureRegistry`)
- Aggregation functions: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `COLLECT`
- List comprehensions, pattern comprehensions, `REDUCE`, `EXISTS` subqueries
- Temporal types: `date`, `datetime`, `localtime`, `localdatetime`, `duration`
- Arithmetic, string functions, math functions, type conversion functions
- `CASE` expressions (simple and searched)

### Parsing Queries

For advanced use cases, you can parse a query to a step plan without running it:

```typescript
import { parseQueryToSteps } from "@codemix/graph";

const { steps, postprocess } = parseQueryToSteps(
  "MATCH (n:Person) RETURN n.name",
  { readonly: true }, // throws ReadonlyGraphError if query mutates
);
```

### Custom Functions and Procedures

```typescript
import { functionRegistry, procedureRegistry } from "@codemix/graph";

// Register a custom scalar function
functionRegistry.register("myLib.greet", {
  call: ([name]) => `Hello, ${name}!`,
});

// Register a custom procedure
procedureRegistry.register("myLib.listItems", {
  call: function* (ctx, [], yields) {
    yield { item: "foo" };
    yield { item: "bar" };
  },
});
```

### AsyncGraph

`AsyncGraph` wraps a regular `Graph` and exposes mutations as serializable operation objects. This is useful for sending graph mutations over a network or message bus.

```typescript
import { AsyncGraph } from "@codemix/graph";

const asyncGraph = new AsyncGraph({
  schema,
  storage: new InMemoryGraphStorage(),
});

// Subscribe to operations emitted by writes
asyncGraph.on("operation", (op) => {
  sendToRemote(op); // op is a plain JSON-serializable object
});

asyncGraph.addVertex("Person", { name: "Alice", age: 30 });
```

---

## `@codemix/text-search`

A lightweight, dependency-free full-text search library used internally by `@codemix/graph` for full-text indexes.

### Features

- BM25-inspired relevance scoring
- English word stemming
- Works on plain strings — no indexing infrastructure required

### Usage

```typescript
import { createMatcher, rankDocuments } from "@codemix/text-search";

// Score a single document
const match = createMatcher("quick brown fox");
match("The quick brown fox jumps over the lazy dog"); // ~0.85
match("A slow gray elephant"); // ~0.0

// Rank a list of documents
const results = rankDocuments("database performance", [
  "How to improve database query performance",
  "Database connection pooling best practices",
  "Unrelated article about cooking",
]);
// Returns documents sorted by relevance score descending
```

---

## `@codemix/y-graph-storage`

A [Yjs](https://yjs.dev/) CRDT-backed storage adapter for `@codemix/graph`. Enables real-time collaborative and offline-first graph databases that sync automatically between peers.

### Features

- Stores graph data inside a `Y.Doc` — compatible with any Yjs provider (WebSocket, WebRTC, IndexedDB, etc.)
- Observable — subscribe to vertex/edge changes reactively
- Zod integration via `ZodYTypes` helpers for schema validation

### Usage

```typescript
import * as Y from "yjs";
import { Graph } from "@codemix/graph";
import { YGraphStorage } from "@codemix/y-graph-storage";

const doc = new Y.Doc();
const storage = new YGraphStorage(doc, schema);
const graph = new Graph({ schema, storage });

// Changes to the graph are automatically reflected in the Y.Doc
// and will sync to connected peers via any Yjs provider
graph.addVertex("Person", { name: "Alice", age: 30 });
```

---

## Development

This is a pnpm monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces).

### Prerequisites

- Node.js 20+
- pnpm 9+

### Setup

```bash
pnpm install
```

### Common Commands

| Command              | Description                                |
| -------------------- | ------------------------------------------ |
| `pnpm test`          | Run all tests across packages (watch mode) |
| `pnpm test:coverage` | Run all tests with coverage report         |
| `pnpm build`         | Build all packages                         |
| `pnpm typecheck`     | Type-check all packages                    |
| `pnpm lint`          | Lint with oxlint                           |
| `pnpm lint:fix`      | Lint and auto-fix                          |
| `pnpm format`        | Format with oxfmt                          |
| `pnpm format:check`  | Check formatting                           |

### Package-level commands

```bash
# Run tests for a single package
pnpm --filter @codemix/graph test

# Build a single package
pnpm --filter @codemix/graph build
```

## License

MIT
