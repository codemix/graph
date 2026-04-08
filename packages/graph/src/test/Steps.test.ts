import { expect, test, describe } from "vitest";
import {
  createTraverser,
  DedupStep,
  EdgeStep,
  FetchVerticesStep,
  FilterElementsStep,
  RepeatStep,
  createStepsFromJSON,
  stringifySteps,
  UnionStep,
  VertexStep,
} from "../Steps.js";
import { createDemoGraph } from "../getDemoGraph.js";
import { TraversalPath } from "../Traversals.js";

const { graph } = createDemoGraph();

test("RepeatStep", () => {
  const steps = [
    new FetchVerticesStep({
      vertexLabels: ["Person"],
      ids: ["Person:1"],
      stepLabels: ["origin"],
    }),
    new FilterElementsStep({
      condition: ["=", "@label", "Person"],
    }),
    new RepeatStep({ times: 5 }, [
      new EdgeStep({
        direction: "out",
        edgeLabels: ["knows"],
      }),
      new VertexStep({
        direction: "out",
        edgeLabels: [],
        stepLabels: ["friend"],
      }),
      new FilterElementsStep({
        condition: ["=", "@label", "Person"],
      }),
    ]),
    new DedupStep({}),
    new UnionStep({}, [
      new FetchVerticesStep({
        vertexLabels: ["Person"],
        ids: ["Person:1"],
      }),
      new VertexStep({
        direction: "both",
        edgeLabels: ["knows"],
      }),
    ]),
  ];

  // Verify steps can be stringified
  const stepString = stringifySteps(steps);
  expect(stepString).toContain("FetchVertices");
  expect(stepString).toContain("Repeat");
  expect(stepString).toContain("Dedup");
  expect(stepString).toContain("Union");

  // Verify steps can be traversed
  const paths = Array.from(createTraverser(steps).traverse(graph, []));
  expect(paths.length).toBeGreaterThanOrEqual(0);

  // Verify steps can be serialized and deserialized
  const serialized = JSON.parse(JSON.stringify(steps, null, 2));
  expect(Array.isArray(serialized)).toBe(true);
  expect(serialized.length).toBe(steps.length);

  // Verify deserialized steps produce same string representation
  expect(stringifySteps(createStepsFromJSON(serialized))).toBe(
    stringifySteps(steps),
  );
});

describe("DedupStep", () => {
  test("deduplicates primitive values", () => {
    const dedup = new DedupStep({});
    const input = [1, 2, 2, 3, 1, 3];
    const result = Array.from(dedup.traverse({} as any, input));
    expect(result).toEqual([1, 2, 3]);
  });

  test("deduplicates string arrays", () => {
    const dedup = new DedupStep({});
    const input = [["User"], ["Post"], ["User"], ["Comment"], ["Post"]];
    const result = Array.from(dedup.traverse({} as any, input));
    expect(result).toEqual([["User"], ["Post"], ["Comment"]]);
  });

  test("deduplicates number arrays", () => {
    const dedup = new DedupStep({});
    const input = [
      [1, 2],
      [3, 4],
      [1, 2],
      [5, 6],
    ];
    const result = Array.from(dedup.traverse({} as any, input));
    expect(result).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  test("deduplicates mixed primitive arrays", () => {
    const dedup = new DedupStep({});
    const input = [
      [1, "a"],
      [2, "b"],
      [1, "a"],
      [1, "b"],
    ];
    const result = Array.from(dedup.traverse({} as any, input));
    expect(result).toEqual([
      [1, "a"],
      [2, "b"],
      [1, "b"],
    ]);
  });

  test("distinguishes arrays with different types but same string value", () => {
    const dedup = new DedupStep({});
    // [1] and ["1"] should be different
    const input = [[1], ["1"], [1]];
    const result = Array.from(dedup.traverse({} as any, input));
    expect(result).toEqual([[1], ["1"]]);
  });

  test("handles empty arrays", () => {
    const dedup = new DedupStep({});
    const input = [[], [], [1], []];
    const result = Array.from(dedup.traverse({} as any, input));
    expect(result).toEqual([[], [1]]);
  });

  test("handles arrays with null and undefined", () => {
    const dedup = new DedupStep({});
    const input = [[null], [undefined], [null], ["null"]];
    const result = Array.from(dedup.traverse({} as any, input));
    expect(result).toEqual([[null], [undefined], ["null"]]);
  });

  test("handles nested object arrays with JSON fallback", () => {
    const dedup = new DedupStep({});
    const obj1 = { a: 1 };
    const obj2 = { a: 1 };
    const obj3 = { a: 2 };
    const input = [[obj1], [obj2], [obj3]];
    const result = Array.from(dedup.traverse({} as any, input));
    // obj1 and obj2 have same JSON representation, so should deduplicate to 1
    // obj3 is different, so total should be 2
    expect(result).toHaveLength(2);
    expect(result).toEqual([[obj1], [obj3]]);
  });

  test("handles TraversalPath input", () => {
    const dedup = new DedupStep({});
    const path1 = new TraversalPath(undefined, "value1", []);
    const path2 = new TraversalPath(undefined, "value2", []);
    const path3 = new TraversalPath(undefined, "value1", []);
    const input = [path1, path2, path3];
    const result = Array.from(dedup.traverse({} as any, input));
    // path1 and path3 have same value, should deduplicate
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(path1);
    expect(result[1]).toBe(path2);
  });
});
