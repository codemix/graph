/**
 * Test WITH...MATCH chaining
 */
import { describe, test, expect } from "vitest";
import {
  createTckGraph,
  executeTckQuery,
  getLabel,
  getProperty,
} from "./tck/tckHelpers.js";

describe("WITH...MATCH chaining", () => {
  test("MATCH (a:A) WITH a MATCH (b:B) RETURN a, b", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'test'})-[:REL]->(:B {name: 'other'})",
    );

    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a MATCH (b:B) RETURN a, b",
    );

    expect(results.length).toBe(1);
    const [a, b] = results[0] as [unknown, unknown];
    expect(getLabel(a as Record<string, unknown>)).toBe("A");
    expect(getLabel(b as Record<string, unknown>)).toBe("B");
  });

  test("WITH a MATCH using forwarded variable in pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'test'})-[:REL]->(:B {name: 'other'})",
    );

    // This is the key WITH...MATCH use case - using forwarded variable in MATCH
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a MATCH (a)-[:REL]->(b:B) RETURN a, b",
    );

    expect(results.length).toBe(1);
    const [a, b] = results[0] as [unknown, unknown];
    expect(getLabel(a as Record<string, unknown>)).toBe("A");
    expect(getLabel(b as Record<string, unknown>)).toBe("B");
  });

  test("WITH aliasing variable to new name", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Alice'})");

    // Forward with alias
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a AS person MATCH (b:A) RETURN person, b",
    );

    expect(results.length).toBe(1);
    const [person, b] = results[0] as [unknown, unknown];
    expect(getLabel(person as Record<string, unknown>)).toBe("A");
    expect(getLabel(b as Record<string, unknown>)).toBe("A");
    expect(getProperty(person as Record<string, unknown>, "name")).toBe(
      "Alice",
    );
  });

  test("WITH filtering before second MATCH", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'keep', num: 10})");
    executeTckQuery(graph, "CREATE (:A {name: 'filter', num: 5})");
    executeTckQuery(graph, "CREATE (:B {name: 'target'})");

    // Filter in WITH clause, then MATCH
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a WHERE a.num > 7 MATCH (b:B) RETURN a, b",
    );

    expect(results.length).toBe(1);
    const [a, b] = results[0] as [unknown, unknown];
    expect(getProperty(a as Record<string, unknown>, "name")).toBe("keep");
    expect(getLabel(b as Record<string, unknown>)).toBe("B");
  });

  test("WITH forwarding property value to MATCH", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Alice'})");
    executeTckQuery(graph, "CREATE (:B {name: 'Bob'})");

    // Forward property value, not node
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a.name AS name MATCH (b:B) RETURN name, b",
    );

    expect(results.length).toBe(1);
    const [name, b] = results[0] as [string, unknown];
    expect(name).toBe("Alice");
    expect(getLabel(b as Record<string, unknown>)).toBe("B");
  });

  test("Cartesian product after WITH", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'a1'})");
    executeTckQuery(graph, "CREATE (:A {name: 'a2'})");
    executeTckQuery(graph, "CREATE (:B {name: 'b1'})");
    executeTckQuery(graph, "CREATE (:B {name: 'b2'})");

    // Should produce cartesian product: 2 A nodes x 2 B nodes = 4 results
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a MATCH (b:B) RETURN a, b",
    );

    expect(results.length).toBe(4);
  });

  test("Multiple WITH clauses in chain", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A {name: 'Alice'})");
    executeTckQuery(graph, "CREATE (:B {name: 'Bob'})");
    executeTckQuery(graph, "CREATE (:C {name: 'Carol'})");

    // Chain: MATCH...WITH...MATCH...WITH...MATCH
    const results = executeTckQuery(
      graph,
      "MATCH (a:A) WITH a MATCH (b:B) WITH a, b MATCH (c:C) RETURN a, b, c",
    );

    expect(results.length).toBe(1);
    const [a, b, c] = results[0] as [unknown, unknown, unknown];
    expect(getLabel(a as Record<string, unknown>)).toBe("A");
    expect(getLabel(b as Record<string, unknown>)).toBe("B");
    expect(getLabel(c as Record<string, unknown>)).toBe("C");
  });
});
