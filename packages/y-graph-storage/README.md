# @codemix/y-graph-storage

A [Yjs](https://yjs.dev) storage adapter for `@codemix/graph` that persists the graph inside a `Y.Doc`, enabling real-time collaborative graph editing, CRDT-based conflict resolution, live reactive queries, and support for rich Yjs shared types (`Y.Text`, `Y.Array`, `Y.Map`) as property values.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [YGraph](#ygraph)
  - [Creating a YGraph](#creating-a-ygraph)
  - [Mutating the Graph](#mutating-the-graph)
  - [Traversals and Queries](#traversals-and-queries)
- [Subscribing to Changes](#subscribing-to-changes)
  - [Change Events](#change-events)
- [Live Queries](#live-queries)
- [Yjs Shared Types as Properties](#yjs-shared-types-as-properties)
  - [ZodYText](#zodytext)
  - [ZodYArray](#zodyarray)
  - [ZodYMap](#zodymap)
  - [ZodYXmlFragment / ZodYXmlText / ZodYXmlElement](#zodyxmlfragment--zodyxmltext--zodyxmlelement)
- [Syncing with Yjs Providers](#syncing-with-yjs-providers)
- [Low-level: YGraphStorage](#low-level-ygraphstorage)
- [Internal Y.Doc Layout](#internal-ydoc-layout)

---

## Features

- **CRDT-backed persistence** — all graph data lives inside a `Y.Doc`; merges are automatic and conflict-free.
- **Real-time collaboration** — plug in any Yjs provider (WebSocket, WebRTC, IndexedDB, …) and every peer sees the same graph with no extra code.
- **Reactive change events** — subscribe to fine-grained events: `vertex.added`, `vertex.deleted`, `edge.added`, `edge.deleted`, `vertex.property.set`, `vertex.property.changed`, and edge equivalents.
- **Live queries** — a `LiveQuery` wraps a traversal and re-fires whenever a relevant change occurs.
- **Rich Yjs property types** — use `Y.Text`, `Y.Array<T>`, and `Y.Map<V>` as property values with built-in Zod schema helpers that convert plain values transparently.
- **Full `@codemix/graph` API** — `YGraph` extends `Graph`, so every traversal, Cypher query, and index feature works unchanged.

---

## Installation

```bash
npm install @codemix/y-graph-storage yjs
# or
pnpm add @codemix/y-graph-storage yjs
```

`@codemix/graph` is a peer dependency and must also be installed.

---

## Quick Start

```ts
import * as Y from "yjs";
import * as z from "zod";
import { GraphSchema, GraphTraversal } from "@codemix/graph";
import { YGraph, ZodYText } from "@codemix/y-graph-storage";

const schema = {
  vertices: {
    Person: {
      properties: {
        name: { type: ZodYText }, // stored as Y.Text
        age: { type: z.number() },
      },
    },
  },
  edges: {
    knows: { properties: {} },
  },
} as const satisfies GraphSchema;

const doc = new Y.Doc();
const graph = new YGraph({ schema, doc });

const alice = graph.addVertex("Person", { name: new Y.Text("Alice"), age: 30 });
const bob = graph.addVertex("Person", { name: new Y.Text("Bob"), age: 25 });
graph.addEdge(alice, "knows", bob, {});

// Read a collaborative text property
alice.get("name").toString(); // "Alice"

// Traverse with the standard API
const g = new GraphTraversal(graph);
for (const path of g.V().hasLabel("Person").out("knows")) {
  console.log(path.value.get("name").toString()); // "Bob"
}
```

---

## How It Works

`YGraphStorage` maps the graph onto a `Y.Doc` using shared `Y.Map` collections:

- Each vertex label gets a top-level `Y.Map` keyed `V:<Label>`. The map's values are per-vertex `Y.Map` instances whose keys are the vertex UUID and whose values are the property values.
- Each edge label gets a top-level `Y.Map` keyed `E:<Label>`. Each edge `Y.Map` stores `@inV` (target element ID), `@outV` (source element ID), and all edge properties.
- Incoming/outgoing edge adjacency is stored inside each vertex `Y.Map` under the internal keys `@inE` and `@outE` as nested `Y.Map<edgeId, true>`. This avoids full scans when traversing neighbours.

Because everything is a native Yjs shared type, any two peers that apply the same set of operations will converge to the same state.

`YGraph` wraps `YGraphStorage` and the base `Graph` class. It also manages a shared `Observable` stream of `YGraphChange` events that powers subscriptions and live queries.

---

## YGraph

### Creating a YGraph

```ts
import * as Y from "yjs";
import { YGraph } from "@codemix/y-graph-storage";

const doc = new Y.Doc();
const graph = new YGraph({ schema, doc });
```

`YGraph` accepts:

| Option   | Type          | Description                                                         |
| -------- | ------------- | ------------------------------------------------------------------- |
| `schema` | `GraphSchema` | The graph schema (vertex/edge labels and property types).           |
| `doc`    | `Y.Doc`       | The Yjs document. Provide a shared instance to sync with providers. |

### Mutating the Graph

`YGraph` inherits the full `Graph` mutation API. All mutations are automatically wrapped in a `Y.Doc` transaction:

```ts
// Add vertices
const alice = graph.addVertex("Person", { name: new Y.Text("Alice"), age: 30 });

// Add edges
const edge = graph.addEdge(alice, "knows", bob, {});

// Update a scalar property
graph.updateProperty(alice, "age", 31);
// or
alice.set("age", 31);

// Mutate a Y.Text property in place (triggers vertex.property.changed)
const name = alice.get("name");
name.delete(0, name.length);
name.insert(0, "Alicia");

// Delete
graph.deleteEdge(edge);
graph.deleteVertex(alice); // also cleans up attached edges
```

### Traversals and Queries

Any `@codemix/graph` traversal or Cypher query runs unchanged:

```ts
import { GraphTraversal, parseQueryToSteps, createTraverser } from "@codemix/graph";

// Fluent traversal
const g = new GraphTraversal(graph);
const results = Array.from(g.V().hasLabel("Person").out("knows").values("name"));

// Cypher
const { steps, postprocess } = parseQueryToSteps(
  "MATCH (a:Person)-[:knows]->(b:Person) RETURN a.name, b.name",
);
const traverser = createTraverser(steps);
for (const row of traverser.traverse(graph, [])) {
  console.log(postprocess(row));
}
```

---

## Subscribing to Changes

`YGraph.subscribe` returns a function that, when called, unsubscribes:

```ts
const unsubscribe = graph.subscribe({
  next(change) {
    console.log(change.kind, change.id);
  },
});

graph.addVertex("Person", { name: new Y.Text("Charlie"), age: 22 });
// logs: "vertex.added" "Person:<uuid>"

unsubscribe();
```

Multiple `subscribe` calls share a single underlying Yjs `observeDeep` listener; it is set up on the first call and torn down when the last subscriber unsubscribes.

### Change Events

| `kind`                    | Extra fields                      | Description                                                        |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| `vertex.added`            | `id`                              | A vertex was inserted.                                             |
| `vertex.deleted`          | `id`                              | A vertex was removed.                                              |
| `edge.added`              | `id`                              | An edge was inserted.                                              |
| `edge.deleted`            | `id`                              | An edge was removed.                                               |
| `vertex.property.set`     | `id`, `property`                  | A scalar property was set on a vertex.                             |
| `vertex.property.changed` | `id`, `property`, `path`, `event` | A Yjs shared-type property (e.g. `Y.Text`) was mutated internally. |
| `edge.property.set`       | `id`, `property`                  | A scalar property was set on an edge.                              |
| `edge.property.changed`   | `id`, `property`, `path`, `event` | A Yjs shared-type property on an edge was mutated.                 |

---

## Live Queries

`YGraph.query` wraps a traversal in a `LiveQuery` that re-fires its subscription whenever a change could affect the result set:

```ts
const people = graph.query((g) => g.V().hasLabel("Person"));

// Initial traversal
for (const path of people) {
  console.log(path.value.get("name").toString());
}

// React to changes
const unsubscribe = people.subscribe({
  next(change) {
    // Re-run the traversal when relevant
    for (const path of people) {
      console.log("updated:", path.value.get("name").toString());
    }
  },
});

graph.addVertex("Person", { name: new Y.Text("Dave"), age: 28 });
// triggers subscriber

unsubscribe();
```

`LiveQuery` analyses the traversal steps to determine which change kinds are relevant. A `FetchVerticesStep` filtered by label only fires on `vertex.added`/`vertex.deleted` events for that label; a `FilterElementsStep` (e.g. `has(…)`) also watches `vertex.property.set` events; edge traversal steps watch `edge.added`/`edge.deleted`.

---

## Yjs Shared Types as Properties

When properties need collaborative editing (e.g. a text field that multiple users can type into simultaneously), declare them with the Zod helpers exported from this package. Each helper accepts either the native Yjs type or a plain JS equivalent, and always outputs the Yjs type — so you can seed the graph with plain values and they will be converted automatically.

### ZodYText

Accepts `Y.Text` or `string`, always stores a `Y.Text`.

```ts
import { ZodYText } from "@codemix/y-graph-storage";

const schema = {
  vertices: {
    Document: {
      properties: {
        title: { type: ZodYText },
        content: { type: ZodYText },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

const doc = graph.addVertex("Document", {
  title: "My Doc", // string → Y.Text
  content: new Y.Text("..."), // Y.Text → Y.Text (unchanged)
});

// Collaborative edit
doc.get("content").insert(0, "Hello, ");
```

### ZodYArray

```ts
import { ZodYArray, ZodYText } from "@codemix/y-graph-storage";
import * as z from "zod";

const Tags = ZodYArray(z.string()); // Y.Array<string>
const Lines = ZodYArray(ZodYText); // Y.Array<Y.Text>

// In a schema:
tags: {
  type: Tags;
}

// Usage — accepts native array or Y.Array:
graph.addVertex("Post", { tags: ["crdt", "graph"] }); // converted
graph.addVertex("Post", { tags: Y.Array.from(["crdt"]) }); // stored as-is

post.get("tags").push(["realtime"]);
```

### ZodYMap

```ts
import { ZodYMap } from "@codemix/y-graph-storage";
import * as z from "zod";

const Metadata = ZodYMap(z.string()); // Y.Map<string>

metadata: {
  type: Metadata;
}

// Accepts plain object or Y.Map:
graph.addVertex("Asset", { metadata: { author: "Alice" } });

asset.get("metadata").set("version", "2");
```

### ZodYXmlFragment / ZodYXmlText / ZodYXmlElement

For rich-text or structured XML content:

```ts
import { ZodYXmlFragment, ZodYXmlText, ZodYXmlElement } from "@codemix/y-graph-storage";

body: {
  type: ZodYXmlFragment;
} // accepts string, outputs Y.XmlFragment
```

| Helper              | Input                                      | Output          |
| ------------------- | ------------------------------------------ | --------------- |
| `ZodYText`          | `string \| Y.Text`                         | `Y.Text`        |
| `ZodYArray(schema)` | `T[] \| Y.Array<T>`                        | `Y.Array<T>`    |
| `ZodYMap(schema)`   | `Record<string, V> \| Y.Map<V>`            | `Y.Map<V>`      |
| `ZodYXmlFragment`   | `string \| Y.XmlFragment`                  | `Y.XmlFragment` |
| `ZodYXmlText`       | `string \| Y.XmlText`                      | `Y.XmlText`     |
| `ZodYXmlElement`    | `{tag, attrs?, children?} \| Y.XmlElement` | `Y.XmlElement`  |

---

## Syncing with Yjs Providers

Because all data lives in a `Y.Doc`, you can connect any standard Yjs provider and get real-time sync for free:

```ts
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { YGraph } from "@codemix/y-graph-storage";

const doc = new Y.Doc();
const provider = new WebsocketProvider("wss://my-server", "my-room", doc);
const graph = new YGraph({ schema, doc });

// On every connected peer, graph mutations propagate automatically.
// Changes from remote peers emit YGraphChange events via graph.subscribe().
```

Other providers work the same way: `y-indexeddb` for offline persistence, `y-webrtc` for peer-to-peer, `y-leveldb` for Node.js, etc.

---

## Low-level: YGraphStorage

If you need direct access to the storage layer — for example, to register custom Yjs observers or to inspect the raw `Y.Map` collections — use `YGraphStorage` directly:

```ts
import * as Y from "yjs";
import { YGraphStorage } from "@codemix/y-graph-storage";
import { Graph } from "@codemix/graph";

const doc = new Y.Doc();
const storage = new YGraphStorage(doc, { schema });
const graph = new Graph({ schema, storage });

// Access raw collections
const personCollection = storage.getVertexCollectionMap("Person");
const knowsCollection = storage.getEdgeCollectionMap("knows");

// Observe at the Yjs level
personCollection.observeDeep((events) => {
  for (const event of events) {
    console.log("raw yjs event", event);
  }
});
```

`YGraphStorage` implements the `GraphStorage` interface from `@codemix/graph` and can be used wherever a `GraphStorage` is accepted.

---

## Internal Y.Doc Layout

Understanding the layout can help when debugging or building custom tooling.

| Y.Doc key   | Type                    | Contents                                        |
| ----------- | ----------------------- | ----------------------------------------------- |
| `V:<Label>` | `Y.Map<Y.Map<unknown>>` | All vertices of label `<Label>`. Keyed by UUID. |
| `E:<Label>` | `Y.Map<Y.Map<unknown>>` | All edges of label `<Label>`. Keyed by UUID.    |

Each vertex `Y.Map` contains:

| Key              | Value                    | Description                                                                           |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `<propertyName>` | any Yjs-compatible value | The vertex's properties.                                                              |
| `@inE`           | `Y.Map<edgeId, true>`    | IDs of incoming edges (populated when an edge targeting this vertex is added).        |
| `@outE`          | `Y.Map<edgeId, true>`    | IDs of outgoing edges (populated when an edge originating from this vertex is added). |

Each edge `Y.Map` contains:

| Key              | Value                    | Description            |
| ---------------- | ------------------------ | ---------------------- |
| `@inV`           | `ElementId`              | Target vertex ID.      |
| `@outV`          | `ElementId`              | Source vertex ID.      |
| `<propertyName>` | any Yjs-compatible value | The edge's properties. |

Internal keys all start with `@` and are skipped by the change observer so they never surface as `property.set`/`property.changed` events.
