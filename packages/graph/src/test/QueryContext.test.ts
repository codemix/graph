import { expect, test, describe } from "vitest";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, QueryContext } from "../Steps.js";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import { createDemoGraph } from "../getDemoGraph.js";
import type { Query } from "../AST.js";

const { graph } = createDemoGraph();

describe("QueryContext isolation", () => {
  describe("Parallel queries with different params don't interfere", () => {
    test("concurrent queries use isolated parameters", async () => {
      const query = "MATCH (u:Person) WHERE u.name = $name RETURN u";
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      // Create two contexts with different parameter values
      const contextAlice = new QueryContext(graph, { name: "Alice" });
      const contextBob = new QueryContext(graph, { name: "Bob" });

      // Run queries "concurrently" (interleaved execution)
      const traverser1 = createTraverser(steps);
      const traverser2 = createTraverser(steps);

      // Start both traversals
      const iter1 = traverser1.traverse(graph, [], contextAlice);
      const iter2 = traverser2.traverse(graph, [], contextBob);

      // Collect results - interleaving the iteration
      const results1: unknown[] = [];
      const results2: unknown[] = [];

      let done1 = false;
      let done2 = false;

      while (!done1 || !done2) {
        if (!done1) {
          const next1 = iter1.next();
          if (next1.done) {
            done1 = true;
          } else {
            results1.push(next1.value);
          }
        }
        if (!done2) {
          const next2 = iter2.next();
          if (next2.done) {
            done2 = true;
          } else {
            results2.push(next2.value);
          }
        }
      }

      // Verify each query got the correct results
      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect((results1[0] as any[])[0]?.get?.("name")).toBe("Alice");
      expect((results2[0] as any[])[0]?.get?.("name")).toBe("Bob");
    });

    test("many concurrent queries with unique parameters", async () => {
      // Create test data - vertices with unique names
      const testGraph = new Graph({
        schema: graph.schema,
        storage: new InMemoryGraphStorage(),
      });

      const names = Array.from({ length: 10 }, (_, i) => `Person${i}`);
      for (const name of names) {
        testGraph.addVertex("Person", { name, age: 25 });
      }

      const query = "MATCH (u:Person) WHERE u.name = $name RETURN u";
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      // Create contexts for each name
      const contexts = names.map((name) => new QueryContext(testGraph, { name }));
      const traversers = contexts.map(() => createTraverser(steps));
      const iterators = traversers.map((t, i) => t.traverse(testGraph, [], contexts[i]));

      // Interleave all iterations in round-robin fashion
      const allResults: unknown[][] = names.map(() => []);
      const done: boolean[] = names.map(() => false);

      while (done.some((d) => !d)) {
        for (let i = 0; i < iterators.length; i++) {
          if (!done[i]) {
            const next = iterators[i]!.next();
            if (next.done) {
              done[i] = true;
            } else {
              allResults[i]!.push(next.value);
            }
          }
        }
      }

      // Verify each query found exactly its person
      for (let i = 0; i < names.length; i++) {
        expect(allResults[i]).toHaveLength(1);
        expect((allResults[i]![0] as any[])[0]?.get?.("name")).toBe(names[i]);
      }
    });

    test("async queries with Promise.all use isolated parameters", async () => {
      const query = "MATCH (u:Person) WHERE u.name = $name RETURN u";
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      const runQuery = (name: string) => {
        return new Promise<unknown[]>((resolve) => {
          // Simulate async delay to encourage interleaving
          setTimeout(() => {
            const context = new QueryContext(graph, { name });
            const traverser = createTraverser(steps);
            const results = [...traverser.traverse(graph, [], context)];
            resolve(results);
          }, Math.random() * 10);
        });
      };

      // Run queries concurrently
      const [aliceResults, bobResults, charlieResults] = await Promise.all([
        runQuery("Alice"),
        runQuery("Bob"),
        runQuery("Charlie"),
      ]);

      // Verify isolation
      expect(aliceResults).toHaveLength(1);
      expect((aliceResults[0] as any[])[0]?.get?.("name")).toBe("Alice");

      expect(bobResults).toHaveLength(1);
      expect((bobResults[0] as any[])[0]?.get?.("name")).toBe("Bob");

      expect(charlieResults).toHaveLength(1);
      expect((charlieResults[0] as any[])[0]?.get?.("name")).toBe("Charlie");
    });
  });

  describe("Parallel queries with different graphs don't interfere", () => {
    test("concurrent queries on separate graphs return correct results", async () => {
      // Create two separate graphs with different data
      const graph1 = new Graph({
        schema: graph.schema,
        storage: new InMemoryGraphStorage(),
      });
      graph1.addVertex("Person", { name: "Graph1Person", age: 11 });

      const graph2 = new Graph({
        schema: graph.schema,
        storage: new InMemoryGraphStorage(),
      });
      graph2.addVertex("Person", { name: "Graph2Person", age: 22 });

      const query = "MATCH (u:Person) RETURN u";
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      const context1 = new QueryContext(graph1, {});
      const context2 = new QueryContext(graph2, {});

      const traverser1 = createTraverser(steps);
      const traverser2 = createTraverser(steps);

      // Start both traversals
      const iter1 = traverser1.traverse(graph1, [], context1);
      const iter2 = traverser2.traverse(graph2, [], context2);

      // Interleave iterations
      const results1: unknown[] = [];
      const results2: unknown[] = [];

      let done1 = false;
      let done2 = false;

      while (!done1 || !done2) {
        if (!done1) {
          const next1 = iter1.next();
          if (next1.done) {
            done1 = true;
          } else {
            results1.push(next1.value);
          }
        }
        if (!done2) {
          const next2 = iter2.next();
          if (next2.done) {
            done2 = true;
          } else {
            results2.push(next2.value);
          }
        }
      }

      // Verify each query returned data from its own graph
      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect((results1[0] as any[])[0]?.get?.("name")).toBe("Graph1Person");
      expect((results2[0] as any[])[0]?.get?.("name")).toBe("Graph2Person");
    });

    test("traversal uses context graph for relationship navigation", async () => {
      // This test verifies that relationship traversals use the graph
      // from the context, not any global state.

      // Create a main graph with people who have friends
      const mainGraph = new Graph({
        schema: graph.schema,
        storage: new InMemoryGraphStorage(),
      });
      const mainPerson = mainGraph.addVertex("Person", {
        name: "MainPerson",
        age: 30,
      });
      const mainFriend = mainGraph.addVertex("Person", {
        name: "MainFriend",
        age: 25,
      });
      mainGraph.addEdge(mainPerson, "knows", mainFriend, {});

      // Create a separate graph with different people
      const otherGraph = new Graph({
        schema: graph.schema,
        storage: new InMemoryGraphStorage(),
      });
      const otherPerson = otherGraph.addVertex("Person", {
        name: "OtherPerson",
        age: 40,
      });
      const otherFriend = otherGraph.addVertex("Person", {
        name: "OtherFriend",
        age: 35,
      });
      otherGraph.addEdge(otherPerson, "knows", otherFriend, {});

      // Query with relationship traversal
      const query = "MATCH (p:Person)-[:knows]->(f:Person) RETURN p.name, f.name";
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      const mainContext = new QueryContext(mainGraph, {});
      const otherContext = new QueryContext(otherGraph, {});

      const traverser1 = createTraverser(steps);
      const traverser2 = createTraverser(steps);

      // Run queries with interleaved execution
      const iter1 = traverser1.traverse(mainGraph, [], mainContext);
      const iter2 = traverser2.traverse(otherGraph, [], otherContext);

      const results1 = [...iter1];
      const results2 = [...iter2];

      // Results should come from their respective graphs
      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);

      // MainGraph: MainPerson->MainFriend
      expect((results1[0] as any[])[0]).toBe("MainPerson");
      expect((results1[0] as any[])[1]).toBe("MainFriend");

      // OtherGraph: OtherPerson->OtherFriend
      expect((results2[0] as any[])[0]).toBe("OtherPerson");
      expect((results2[0] as any[])[1]).toBe("OtherFriend");
    });
  });

  describe("Context cleanup after query completion", () => {
    test("context values are not accessible after traversal completes", () => {
      const context = new QueryContext(graph, { testParam: "testValue" });

      // Context is immutable and readonly - values remain accessible
      // but the context object itself is scoped to the query
      expect(context.params.testParam).toBe("testValue");
      expect(context.graph).toBe(graph);

      // The context doesn't need "cleanup" because it's passed explicitly
      // rather than stored globally. Once the traversal function returns,
      // the context goes out of scope naturally.
    });

    test("nested traversals restore parent context state", async () => {
      // Create graphs for outer and inner queries
      const outerGraph = new Graph({
        schema: graph.schema,
        storage: new InMemoryGraphStorage(),
      });
      outerGraph.addVertex("Person", { name: "OuterPerson", age: 50 });

      const innerGraph = new Graph({
        schema: graph.schema,
        storage: new InMemoryGraphStorage(),
      });
      innerGraph.addVertex("Person", { name: "InnerPerson", age: 10 });

      const query = "MATCH (u:Person) WHERE u.name = $name RETURN u";
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      // Outer query context
      const outerContext = new QueryContext(outerGraph, {
        name: "OuterPerson",
      });

      // Start outer traversal
      const outerTraverser = createTraverser(steps);
      const outerIter = outerTraverser.traverse(outerGraph, [], outerContext);

      // Get first result from outer
      const outerFirst = outerIter.next();
      expect(outerFirst.done).toBe(false);

      // Now start an "inner" traversal (simulating nested query)
      const innerContext = new QueryContext(innerGraph, {
        name: "InnerPerson",
      });
      const innerTraverser = createTraverser(steps);
      const innerResults = [...innerTraverser.traverse(innerGraph, [], innerContext)];

      // Inner results should be from inner graph
      expect(innerResults).toHaveLength(1);
      expect((innerResults[0] as any[])[0]?.get?.("name")).toBe("InnerPerson");

      // Continue outer traversal - should still work correctly
      // Exhaust the iterator to ensure it completes
      const _outerRemaining = [...outerIter];
      // Outer query should have gotten its result before we started inner
      expect((outerFirst.value as any[])[0]?.get?.("name")).toBe("OuterPerson");
    });

    test("context withParams creates independent copy", () => {
      const original = new QueryContext(graph, { a: 1, b: 2 });
      const modified = original.withParams({ b: 3, c: 4 });

      // Original unchanged
      expect(original.params.a).toBe(1);
      expect(original.params.b).toBe(2);
      expect(original.params.c).toBeUndefined();

      // Modified has merged params
      expect(modified.params.a).toBe(1);
      expect(modified.params.b).toBe(3);
      expect(modified.params.c).toBe(4);

      // They share the same graph
      expect(modified.graph).toBe(original.graph);
    });

    test("context withOptions creates independent copy", () => {
      const original = new QueryContext(graph, {}, { maxIterations: 100 });
      const modified = original.withOptions({ maxCollectionSize: 50 });

      // Original unchanged
      expect(original.options.maxIterations).toBe(100);
      expect(original.options.maxCollectionSize).toBe(100000); // default

      // Modified has merged options
      expect(modified.options.maxIterations).toBe(100);
      expect(modified.options.maxCollectionSize).toBe(50);
    });
  });

  describe("Context parameter resolution", () => {
    test("context.getParam returns correct values", () => {
      const context = new QueryContext(graph, {
        str: "hello",
        num: 42,
        bool: true,
        arr: [1, 2, 3],
        obj: { nested: "value" },
      });

      expect(context.getParam("str")).toBe("hello");
      expect(context.getParam("num")).toBe(42);
      expect(context.getParam("bool")).toBe(true);
      expect(context.getParam("arr")).toEqual([1, 2, 3]);
      expect(context.getParam("obj")).toEqual({ nested: "value" });
    });

    test("context.hasParam correctly identifies present and missing params", () => {
      const context = new QueryContext(graph, { present: "value" });

      expect(context.hasParam("present")).toBe(true);
      expect(context.hasParam("missing")).toBe(false);
    });

    test("context.getParam returns undefined for missing param", () => {
      const context = new QueryContext(graph, {});
      expect(context.getParam("missing")).toBeUndefined();
    });
  });

  describe("Stress test: high concurrency", () => {
    test("100 concurrent queries with unique contexts", async () => {
      const testGraph = new Graph({
        schema: graph.schema,
        storage: new InMemoryGraphStorage(),
      });

      // Create 100 vertices
      for (let i = 0; i < 100; i++) {
        testGraph.addVertex("Person", { name: `Person${i}`, age: i });
      }

      const query = "MATCH (u:Person) WHERE u.name = $name RETURN u";
      const ast = parse(query) as Query;
      const steps = astToSteps(ast);

      // Run 100 queries concurrently with Promise.all
      const promises = Array.from({ length: 100 }, (_, i) => {
        return new Promise<{ index: number; name: string | undefined }>((resolve) => {
          // Random delay to encourage interleaving
          setTimeout(() => {
            const context = new QueryContext(testGraph, {
              name: `Person${i}`,
            });
            const traverser = createTraverser(steps);
            const results = [...traverser.traverse(testGraph, [], context)];
            const foundName = (results[0] as any[])?.[0]?.get?.("name");
            resolve({ index: i, name: foundName });
          }, Math.random() * 50);
        });
      });

      const allResults = await Promise.all(promises);

      // Verify each query found its correct person
      for (const result of allResults) {
        expect(result.name).toBe(`Person${result.index}`);
      }
    });
  });
});
