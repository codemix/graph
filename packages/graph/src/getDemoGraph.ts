import { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph } from "./Graph.js";
import { GraphSchema } from "./GraphSchema.js";
import { InMemoryGraphStorage } from "./GraphStorage.js";

function makeType<T>(_defaultValue: T): StandardSchemaV1<T> {
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

const demoSchema = {
  vertices: {
    Person: {
      properties: {
        ref: { type: makeType(undefined as undefined | string) },
        name: {
          type: makeType(""),
          comparator: (a: any, b: any) => a.localeCompare(b),
        },
        age: { type: makeType(0) },
      },
    },
    Thing: {
      properties: {
        ref: { type: makeType(0) },
        name: { type: makeType("") },
      },
    },
  },
  edges: {
    knows: { properties: {} },
    likes: { properties: {} },
  },
} as const satisfies GraphSchema;

export type DemoSchema = typeof demoSchema;

export function createDemoGraph(
  graph = new Graph<DemoSchema>({
    schema: demoSchema,
    storage: new InMemoryGraphStorage(),
    validateProperties: false,
  }),
) {
  // People
  const alice = graph.addVertex("Person", { name: "Alice", age: 30 });
  const bob = graph.addVertex("Person", { name: "Bob", age: 25 });
  const charlie = graph.addVertex("Person", { name: "Charlie", age: 35 });
  const dave = graph.addVertex("Person", { name: "Dave", age: 40 });
  const erin = graph.addVertex("Person", { name: "Erin", age: 45 });
  const fiona = graph.addVertex("Person", { name: "Fiona", age: 50 });
  const george = graph.addVertex("Person", { name: "George", age: 55 });

  // Things
  const apple = graph.addVertex("Thing", { ref: 1, name: "Apple" });
  const banana = graph.addVertex("Thing", { ref: 2, name: "Banana" });
  const cherry = graph.addVertex("Thing", { ref: 3, name: "Cherry" });
  const dates = graph.addVertex("Thing", { ref: 4, name: "Dates" });
  const eggplant = graph.addVertex("Thing", { ref: 5, name: "Eggplant" });
  const fig = graph.addVertex("Thing", { ref: 6, name: "Fig" });
  const grape = graph.addVertex("Thing", { ref: 7, name: "Grape" });

  // Relationships
  const aliceKnowsBob = graph.addEdge(alice, "knows", bob, {});
  graph.addEdge(alice, "knows", charlie, {});
  const bobKnowsCharlie = graph.addEdge(bob, "knows", charlie, {});
  graph.addEdge(charlie, "knows", dave, {});
  const georgeKnowsCharlie = graph.addEdge(george, "knows", charlie, {});
  graph.addEdge(dave, "knows", erin, {});
  graph.addEdge(erin, "knows", fiona, {});
  graph.addEdge(erin, "knows", alice, {});

  graph.addEdge(bob, "likes", banana, {});
  graph.addEdge(charlie, "likes", cherry, {});
  graph.addEdge(dave, "likes", dates, {});
  graph.addEdge(erin, "likes", eggplant, {});
  graph.addEdge(fiona, "likes", fig, {});

  return {
    graph,
    alice,
    bob,
    charlie,
    dave,
    erin,
    fiona,
    george,

    apple,
    banana,
    cherry,
    dates,
    eggplant,
    fig,
    grape,

    aliceKnowsBob,
    bobKnowsCharlie,
    georgeKnowsCharlie,
  };
}
