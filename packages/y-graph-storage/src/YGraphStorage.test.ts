import { expect, test } from "vitest";
import * as Y from "yjs";
import * as z from "zod";
import { GraphSchema, GraphTraversal } from "@codemix/graph";
import { ZodYArray, ZodYText } from "./ZodYTypes.js";
import { YGraph } from "./YGraph.js";

const schema = {
  vertices: {
    Person: {
      properties: {
        name: { type: ZodYText },
      },
    },
    Thing: {
      properties: {
        name: { type: ZodYText },
        isActive: { type: z.boolean() },
        features: { type: ZodYArray(ZodYText) },
      },
    },
  },
  edges: {
    knows: { properties: {} },
    likes: { properties: {} },
  },
} as const satisfies GraphSchema;

type _DemoSchema = typeof schema;
interface DemoSchema extends _DemoSchema {}

function createGraph(doc = new Y.Doc()) {
  const graph = new YGraph<DemoSchema>({
    schema,
    doc,
  });

  const alice = graph.addVertex("Person", { name: new Y.Text("Alice") });

  const raspberries = graph.addVertex("Thing", {
    name: new Y.Text("Raspberries"),
    isActive: true,
    features: Y.Array.from<Y.Text>([new Y.Text("sweet"), new Y.Text("juicy")]),
  });

  graph.addEdge(alice, "likes", raspberries, {});
  return graph;
}

test("YGraphStorage", () => {
  const graph = createGraph();
  const g = new GraphTraversal(graph);

  expect(Array.from(g.V().hasLabel("Person").out("likes"))).toHaveLength(1);
});

test("Identity", () => {
  const graph = createGraph();

  const [alice] = Array.from(graph.getVertices("Person"));
  if (alice == null) {
    throw new Error("Alice not found");
  }
  const [clone] = Array.from(graph.getVertices("Person"));
  if (clone == null) {
    throw new Error("Clone not found");
  }
  expect(clone.id).toBe(alice.id);
  expect(clone).toBe(alice);
});

test("Add and delete vertex", () => {
  const doc = new Y.Doc();

  const graph = createGraph(doc);
  const history: string[] = [];

  const unsubscribe = graph.subscribe({
    next(value) {
      history.push(value.kind);
    },
  });
  const g = new GraphTraversal(graph);

  const people = g.V().hasLabel("Person");
  const [alice] = Array.from(people.values());

  const bob = graph.addVertex("Person", { name: new Y.Text("Bob") });

  graph.addEdge(alice!, "knows", bob, {});
  {
    const name = bob.get("name");
    name.delete(0, name.length);
    name.insert(0, "Robert");
  }

  const apple = graph.addVertex("Thing", {
    name: new Y.Text("Apple"),
    isActive: false,
    features: Y.Array.from<Y.Text>([new Y.Text("tart"), new Y.Text("green")]),
  });

  graph.addEdge(alice!, "likes", apple, {});
  {
    apple.set("isActive", true);
    const firstFeature = apple.get("features").get(0);
    firstFeature.delete(0, firstFeature.length);
    firstFeature.insert(0, "red");
  }
  graph.deleteVertex(bob);
  expect(history).toMatchInlineSnapshot(`
    [
      "vertex.added",
      "edge.added",
      "vertex.property.changed",
      "vertex.property.changed",
      "vertex.added",
      "edge.added",
      "vertex.property.set",
      "vertex.property.changed",
      "vertex.property.changed",
      "vertex.deleted",
      "edge.deleted",
    ]
  `);
  unsubscribe();
});

test("Reactivity", () => {
  const doc = new Y.Doc();

  const graph = createGraph(doc);
  const history: string[] = [];

  const people = graph.query((g) => g.V().hasLabel("Person").values());
  const unsubscribe = people.subscribe({
    next(value) {
      history.push(value.kind);
    },
  });

  const [alice] = Array.from(people);

  const bob = graph.addVertex("Person", { name: new Y.Text("Bob") });

  graph.addEdge(alice!, "knows", bob, {});

  graph.deleteVertex(bob);

  expect(history).toMatchInlineSnapshot(`
    [
      "vertex.added",
      "vertex.deleted",
    ]
  `);
  unsubscribe();
});
