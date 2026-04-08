/**
 * TCK Aggregation6 - Percentiles
 * Translated from tmp/tck/features/expressions/aggregation/Aggregation6.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Aggregation6 - Percentiles", () => {
  test("[1a] `percentileDisc()` at 0.0 - percentileDisc not implemented", () => {
    // Original TCK (Scenario Outline example p=0.0):
    // Given: CREATE ({price: 10.0}), ({price: 20.0}), ({price: 30.0})
    // Query: MATCH (n) RETURN percentileDisc(n.price, $percentile) AS p
    // With parameter percentile = 0.0
    // Expected: 10.0
    //
    // Limitations:
    // - percentileDisc() function not implemented
    // - Parameter syntax ($param) not supported
    // - Unlabeled nodes not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({price: 10.0}), ({price: 20.0}), ({price: 30.0})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN percentileDisc(n.price, 0.0) AS p");
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).p).toBe(10.0);
  });

  test("[1b] `percentileDisc()` at 0.5 - percentileDisc not implemented", () => {
    // Same scenario with percentile = 0.5
    // Expected: 20.0
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({price: 10.0}), ({price: 20.0}), ({price: 30.0})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN percentileDisc(n.price, 0.5) AS p");
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).p).toBe(20.0);
  });

  test("[1c] `percentileDisc()` at 1.0 - percentileDisc not implemented", () => {
    // Same scenario with percentile = 1.0
    // Expected: 30.0
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({price: 10.0}), ({price: 20.0}), ({price: 30.0})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN percentileDisc(n.price, 1.0) AS p");
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).p).toBe(30.0);
  });

  test("[2a] `percentileCont()` at 0.0 - percentileCont not implemented", () => {
    // Original TCK (Scenario Outline example p=0.0):
    // Given: CREATE ({price: 10.0}), ({price: 20.0}), ({price: 30.0})
    // Query: MATCH (n) RETURN percentileCont(n.price, $percentile) AS p
    // With parameter percentile = 0.0
    // Expected: 10.0
    //
    // Limitations:
    // - percentileCont() function not implemented
    // - Parameter syntax ($param) not supported
    // - Unlabeled nodes not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({price: 10.0}), ({price: 20.0}), ({price: 30.0})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN percentileCont(n.price, 0.0) AS p");
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).p).toBe(10.0);
  });

  test("[2b] `percentileCont()` at 0.5 - percentileCont not implemented", () => {
    // Same scenario with percentile = 0.5
    // Expected: 20.0
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({price: 10.0}), ({price: 20.0}), ({price: 30.0})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN percentileCont(n.price, 0.5) AS p");
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).p).toBe(20.0);
  });

  test("[2c] `percentileCont()` at 1.0 - percentileCont not implemented", () => {
    // Same scenario with percentile = 1.0
    // Expected: 30.0
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({price: 10.0}), ({price: 20.0}), ({price: 30.0})");
    const results = executeTckQuery(graph, "MATCH (n) RETURN percentileCont(n.price, 1.0) AS p");
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).p).toBe(30.0);
  });

  test("[3a] `percentileCont()` failing on bad arguments (1000) - not implemented", () => {
    // Original TCK:
    // Given: CREATE ({price: 10.0})
    // Query: MATCH (n) RETURN percentileCont(n.price, $param)
    // With param = 1000
    // Expected: ArgumentError: NumberOutOfRange
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({price: 10.0})");
    expect(() => {
      executeTckQuery(graph, "MATCH (n) RETURN percentileCont(n.price, 1000) AS p");
    }).toThrow();
  });

  test("[3b] `percentileCont()` failing on bad arguments (-1) - not implemented", () => {
    // With param = -1
    // Expected: ArgumentError: NumberOutOfRange
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({price: 10.0})");
    expect(() => {
      executeTckQuery(graph, "MATCH (n) RETURN percentileCont(n.price, -1) AS p");
    }).toThrow();
  });

  test("[3c] `percentileCont()` failing on bad arguments (1.1) - not implemented", () => {
    // With param = 1.1
    // Expected: ArgumentError: NumberOutOfRange
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({price: 10.0})");
    expect(() => {
      executeTckQuery(graph, "MATCH (n) RETURN percentileCont(n.price, 1.1) AS p");
    }).toThrow();
  });

  test("[4a] `percentileDisc()` failing on bad arguments (1000) - not implemented", () => {
    // Original TCK:
    // Given: CREATE ({price: 10.0})
    // Query: MATCH (n) RETURN percentileDisc(n.price, $param)
    // With param = 1000
    // Expected: ArgumentError: NumberOutOfRange
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({price: 10.0})");
    expect(() => {
      executeTckQuery(graph, "MATCH (n) RETURN percentileDisc(n.price, 1000) AS p");
    }).toThrow();
  });

  test("[4b] `percentileDisc()` failing on bad arguments (-1) - not implemented", () => {
    // With param = -1
    // Expected: ArgumentError: NumberOutOfRange
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({price: 10.0})");
    expect(() => {
      executeTckQuery(graph, "MATCH (n) RETURN percentileDisc(n.price, -1) AS p");
    }).toThrow();
  });

  test("[4c] `percentileDisc()` failing on bad arguments (1.1) - not implemented", () => {
    // With param = 1.1
    // Expected: ArgumentError: NumberOutOfRange
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE ({price: 10.0})");
    expect(() => {
      executeTckQuery(graph, "MATCH (n) RETURN percentileDisc(n.price, 1.1) AS p");
    }).toThrow();
  });

  test("[5] `percentileDisc()` failing in more involved query - not implemented", () => {
    // Original TCK:
    // Given:
    //   UNWIND range(0, 10) AS i
    //   CREATE (s:S)
    //   WITH s, i
    //   UNWIND range(0, i) AS j
    //   CREATE (s)-[:REL]->()
    // Query:
    //   MATCH (n:S)
    //   WITH n, size([(n)-->() | 1]) AS deg
    //   WHERE deg > 2
    //   WITH deg LIMIT 100
    //   RETURN percentileDisc(0.90, deg), deg
    // Expected: ArgumentError: NumberOutOfRange
    //
    // Limitations:
    // - percentileDisc() not implemented
    // - range() function not supported
    // - Pattern comprehension [(n)-->() | 1] not supported
    // - size() over pattern not supported
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `UNWIND range(0, 10) AS i
       CREATE (s:S)
       WITH s, i
       UNWIND range(0, i) AS j
       CREATE (s)-[:REL]->()`,
    );
    expect(() => {
      executeTckQuery(
        graph,
        `MATCH (n:S)
         WITH n, size([(n)-->() | 1]) AS deg
         WHERE deg > 2
         WITH deg LIMIT 100
         RETURN percentileDisc(0.90, deg), deg`,
      );
    }).toThrow();
  });

  // Custom tests using labeled nodes (since unlabeled nodes require additional feature support)
  test("[custom-1] percentileDisc() at 0.0 with labeled nodes", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { price: 10.0 });
    graph.addVertex("A", { price: 20.0 });
    graph.addVertex("A", { price: 30.0 });

    const result = executeTckQuery(graph, "MATCH (n:A) RETURN percentileDisc(n.price, 0.0) AS p");
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).p).toBe(10.0);
  });

  test("[custom-2] percentileDisc() at 0.5 with labeled nodes", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { price: 10.0 });
    graph.addVertex("A", { price: 20.0 });
    graph.addVertex("A", { price: 30.0 });

    const result = executeTckQuery(graph, "MATCH (n:A) RETURN percentileDisc(n.price, 0.5) AS p");
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).p).toBe(20.0);
  });

  test("[custom-3] percentileDisc() at 1.0 with labeled nodes", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { price: 10.0 });
    graph.addVertex("A", { price: 20.0 });
    graph.addVertex("A", { price: 30.0 });

    const result = executeTckQuery(graph, "MATCH (n:A) RETURN percentileDisc(n.price, 1.0) AS p");
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).p).toBe(30.0);
  });

  test("[custom-4] percentileCont() at 0.0 with labeled nodes", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { price: 10.0 });
    graph.addVertex("A", { price: 20.0 });
    graph.addVertex("A", { price: 30.0 });

    const result = executeTckQuery(graph, "MATCH (n:A) RETURN percentileCont(n.price, 0.0) AS p");
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).p).toBe(10.0);
  });

  test("[custom-5] percentileCont() at 0.5 with labeled nodes", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { price: 10.0 });
    graph.addVertex("A", { price: 20.0 });
    graph.addVertex("A", { price: 30.0 });

    const result = executeTckQuery(graph, "MATCH (n:A) RETURN percentileCont(n.price, 0.5) AS p");
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).p).toBe(20.0);
  });

  test("[custom-6] percentileCont() at 1.0 with labeled nodes", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { price: 10.0 });
    graph.addVertex("A", { price: 20.0 });
    graph.addVertex("A", { price: 30.0 });

    const result = executeTckQuery(graph, "MATCH (n:A) RETURN percentileCont(n.price, 1.0) AS p");
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).p).toBe(30.0);
  });

  test("[custom-7] percentileCont() interpolates between values", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { price: 10.0 });
    graph.addVertex("A", { price: 20.0 });

    const result = executeTckQuery(graph, "MATCH (n:A) RETURN percentileCont(n.price, 0.25) AS p");
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).p).toBe(12.5);
  });

  test("[custom-8] stDev() sample standard deviation", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { price: 10.0 });
    graph.addVertex("A", { price: 20.0 });
    graph.addVertex("A", { price: 30.0 });

    const result = executeTckQuery(graph, "MATCH (n:A) RETURN stDev(n.price) AS s");
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).s).toBe(10);
  });

  test("[custom-9] stDevP() population standard deviation", () => {
    const graph = createTckGraph();
    graph.addVertex("A", { price: 10.0 });
    graph.addVertex("A", { price: 20.0 });
    graph.addVertex("A", { price: 30.0 });

    const result = executeTckQuery(graph, "MATCH (n:A) RETURN stDevP(n.price) AS s");
    expect(result).toHaveLength(1);
    // Population stdev: sqrt(200/3) ≈ 8.165
    expect((result[0] as Record<string, unknown>).s).toBeCloseTo(8.165, 2);
  });
});
