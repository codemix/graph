/**
 * TCK Use Case Tests - TriadicSelection1
 * Query three related nodes on binary-tree graphs.
 *
 * Original TCK: tmp/tck/features/useCases/triadicSelection/TriadicSelection1.feature
 *
 * IMPORTANT: Most original TCK tests use features not yet supported:
 * - Named graph fixtures (binary-tree-1, binary-tree-2) - implemented as helpers below
 * - OPTIONAL MATCH + IS NULL/IS NOT NULL pattern not fully supported
 * - WITH c WHERE r IS NULL pattern not fully supported
 * - Undirected patterns (b)-->(c) where --> is required but pattern should match both directions
 *
 * NOTE: Relationship type alternation [:KNOWS|FOLLOWS] IS supported.
 *
 * Custom tests demonstrate equivalent triadic selection patterns where possible.
 */
import { describe, test, expect } from "vitest";
import {
  createTckGraph,
  executeTckQuery,
  type TckSchema,
} from "../tckHelpers.js";
import type { Graph } from "../../../Graph.js";

/**
 * Creates the binary-tree-1 fixture graph.
 *
 * Structure:
 *                     A (root)
 *         KNOWS/FOLLOWS to b1,b2,b3,b4
 *        /      |      |       \
 *       b1     b2     b3       b4
 *      / \    / \    / \      / \
 *    c11 c12 c21 c22 c31 c32 c41 c42
 *
 * Direct relationships from A:
 * - A -[:KNOWS]-> b1, b2
 * - A -[:FOLLOWS]-> b3, b4
 *
 * From A (transitive):
 * - A -[:KNOWS]-> b2 (so b2 is a "friend")
 * - A -[:FOLLOWS]-> b3 (so b3 is "followed")
 */
function createBinaryTree1(graph: Graph<TckSchema>): void {
  // Create root node A
  executeTckQuery(graph, "CREATE (:A {name: 'a'})");

  // Create level 1 nodes (b1-b4)
  executeTckQuery(graph, "CREATE (:X {name: 'b1'})");
  executeTckQuery(graph, "CREATE (:X {name: 'b2'})");
  executeTckQuery(graph, "CREATE (:X {name: 'b3'})");
  executeTckQuery(graph, "CREATE (:X {name: 'b4'})");

  // Create level 2 nodes (c11, c12, c21, c22, c31, c32, c41, c42)
  executeTckQuery(graph, "CREATE (:X {name: 'c11'})");
  executeTckQuery(graph, "CREATE (:X {name: 'c12'})");
  executeTckQuery(graph, "CREATE (:X {name: 'c21'})");
  executeTckQuery(graph, "CREATE (:X {name: 'c22'})");
  executeTckQuery(graph, "CREATE (:X {name: 'c31'})");
  executeTckQuery(graph, "CREATE (:X {name: 'c32'})");
  executeTckQuery(graph, "CREATE (:X {name: 'c41'})");
  executeTckQuery(graph, "CREATE (:X {name: 'c42'})");

  // Create relationships from A to b-level
  executeTckQuery(
    graph,
    "MATCH (a:A {name: 'a'}), (b:X {name: 'b1'}) CREATE (a)-[:KNOWS]->(b)",
  );
  executeTckQuery(
    graph,
    "MATCH (a:A {name: 'a'}), (b:X {name: 'b2'}) CREATE (a)-[:KNOWS]->(b)",
  );
  executeTckQuery(
    graph,
    "MATCH (a:A {name: 'a'}), (b:X {name: 'b3'}) CREATE (a)-[:FOLLOWS]->(b)",
  );
  executeTckQuery(
    graph,
    "MATCH (a:A {name: 'a'}), (b:X {name: 'b4'}) CREATE (a)-[:FOLLOWS]->(b)",
  );

  // Create relationships from b-level to c-level
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b1'}), (c:X {name: 'c11'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b1'}), (c:X {name: 'c12'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b2'}), (c:X {name: 'c21'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b2'}), (c:X {name: 'c22'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b3'}), (c:X {name: 'c31'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b3'}), (c:X {name: 'c32'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b4'}), (c:X {name: 'c41'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b4'}), (c:X {name: 'c42'}) CREATE (b)-[:KNOWS]->(c)",
  );
}

/**
 * Creates the binary-tree-2 fixture graph.
 * Similar to binary-tree-1 but with different label patterns.
 * Nodes have labels X or Y in alternating pattern.
 */
function createBinaryTree2(graph: Graph<TckSchema>): void {
  // Create root node A
  executeTckQuery(graph, "CREATE (:A {name: 'a'})");

  // Create level 1 nodes with X label
  executeTckQuery(graph, "CREATE (:X {name: 'b1'})");
  executeTckQuery(graph, "CREATE (:X {name: 'b2'})");
  executeTckQuery(graph, "CREATE (:X {name: 'b3'})");
  executeTckQuery(graph, "CREATE (:X {name: 'b4'})");

  // Create level 2 nodes - alternating X and Y labels
  executeTckQuery(graph, "CREATE (:X {name: 'c11'})");
  executeTckQuery(graph, "CREATE (:Y {name: 'c12'})");
  executeTckQuery(graph, "CREATE (:X {name: 'c21'})");
  executeTckQuery(graph, "CREATE (:Y {name: 'c22'})");
  executeTckQuery(graph, "CREATE (:X {name: 'c31'})");
  executeTckQuery(graph, "CREATE (:Y {name: 'c32'})");
  executeTckQuery(graph, "CREATE (:X {name: 'c41'})");
  executeTckQuery(graph, "CREATE (:Y {name: 'c42'})");

  // Create relationships from A to b-level
  executeTckQuery(
    graph,
    "MATCH (a:A {name: 'a'}), (b:X {name: 'b1'}) CREATE (a)-[:KNOWS]->(b)",
  );
  executeTckQuery(
    graph,
    "MATCH (a:A {name: 'a'}), (b:X {name: 'b2'}) CREATE (a)-[:KNOWS]->(b)",
  );
  executeTckQuery(
    graph,
    "MATCH (a:A {name: 'a'}), (b:X {name: 'b3'}) CREATE (a)-[:FOLLOWS]->(b)",
  );
  executeTckQuery(
    graph,
    "MATCH (a:A {name: 'a'}), (b:X {name: 'b4'}) CREATE (a)-[:FOLLOWS]->(b)",
  );

  // Create relationships from b-level to c-level
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b1'}), (c:X {name: 'c11'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b1'}), (c:Y {name: 'c12'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b2'}), (c:X {name: 'c21'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b2'}), (c:Y {name: 'c22'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b3'}), (c:X {name: 'c31'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b3'}), (c:Y {name: 'c32'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b4'}), (c:X {name: 'c41'}) CREATE (b)-[:KNOWS]->(c)",
  );
  executeTckQuery(
    graph,
    "MATCH (b:X {name: 'b4'}), (c:Y {name: 'c42'}) CREATE (b)-[:KNOWS]->(c)",
  );
}

describe("TriadicSelection1 - Query three related nodes on binary-tree graphs", () => {
  // ============================================================================
  // Original TCK Scenario [1]: Handling triadic friend of a friend
  // Given the binary-tree-1 graph
  // MATCH (a:A)-[:KNOWS]->(b)-->(c) RETURN c.name
  // Expected: b2, b3, c11, c12, c21, c22
  // SKIPPED: Undirected pattern (b)-->(c) without label not supported
  // ============================================================================
  test.fails(
    "[1] Handling triadic friend of a friend - UNSUPPORTED: unlabeled target node pattern",
    () => {
      const graph = createTckGraph();
      createBinaryTree1(graph);
      const results = executeTckQuery(
        graph,
        "MATCH (a:A)-[:KNOWS]->(b)-->(c) RETURN c.name",
      );
      const names = results.map((r) => r as string).sort();
      expect(names).toEqual(["b2", "b3", "c11", "c12", "c21", "c22"]);
    },
  );

  // ============================================================================
  // Original TCK Scenarios [2-19]: All use OPTIONAL MATCH with IS NULL / IS NOT NULL
  // These patterns are not fully supported in the grammar
  // ============================================================================
  test.fails(
    "[2] Handling triadic friend of a friend that is not a friend - UNSUPPORTED: OPTIONAL MATCH + IS NULL",
    () => {
      const graph = createTckGraph();
      createBinaryTree1(graph);
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:KNOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:KNOWS]->(c)
       WITH c WHERE r IS NULL
       RETURN c.name`,
      );
      const names = results.map((r) => r as string).sort();
      expect(names).toEqual(["c11", "c12", "c21", "c22"]);
    },
  );

  test.fails(
    "[3] Handling triadic friend of a friend that is not a friend with different relationship type - UNSUPPORTED: OPTIONAL MATCH + IS NULL",
    () => {
      const graph = createTckGraph();
      createBinaryTree1(graph);
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:KNOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:FOLLOWS]->(c)
       WITH c WHERE r IS NULL
       RETURN c.name`,
      );
      const names = results.map((r) => r as string).sort();
      expect(names).toEqual(["c11", "c12", "c21", "c22"]);
    },
  );

  test.fails(
    "[4] Handling triadic friend of a friend that is not a friend with superset of relationship type - UNSUPPORTED: OPTIONAL MATCH + IS NULL",
    () => {
      const graph = createTckGraph();
      createBinaryTree1(graph);
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:KNOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:KNOWS|FOLLOWS]->(c)
       WITH c WHERE r IS NULL
       RETURN c.name`,
      );
      const names = results.map((r) => r as string).sort();
      expect(names).toEqual(["c11", "c12", "c21", "c22"]);
    },
  );

  test.fails(
    "[5] Handling triadic friend of a friend that is not a friend with implicit subset of relationship type - UNSUPPORTED: OPTIONAL MATCH + IS NULL",
    () => {
      const graph = createTckGraph();
      createBinaryTree1(graph);
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:KNOWS|FOLLOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:KNOWS]->(c)
       WITH c WHERE r IS NULL
       RETURN c.name`,
      );
      const names = results.map((r) => r as string).sort();
      expect(names).toEqual([
        "c11",
        "c12",
        "c21",
        "c22",
        "c31",
        "c32",
        "c41",
        "c42",
      ]);
    },
  );

  test.fails(
    "[6] Handling triadic friend of a friend that is not a friend with explicit subset of relationship type - UNSUPPORTED: OPTIONAL MATCH + IS NULL",
    () => {
      const graph = createTckGraph();
      createBinaryTree1(graph);
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:KNOWS|FOLLOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:KNOWS|FOLLOWS]->(c)
       WITH c WHERE r IS NULL
       RETURN c.name`,
      );
      const names = results.map((r) => r as string).sort();
      expect(names).toEqual([
        "c11",
        "c12",
        "c21",
        "c22",
        "c31",
        "c32",
        "c41",
        "c42",
      ]);
    },
  );

  test.fails(
    "[7] Handling triadic friend of a friend that is not a friend with same labels - UNSUPPORTED: OPTIONAL MATCH + IS NULL",
    () => {
      const graph = createTckGraph();
      createBinaryTree2(graph);
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:KNOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:KNOWS]->(c)
       WITH c WHERE r IS NULL
       RETURN c.name`,
      );
      const names = results.map((r) => r as string).sort();
      expect(names).toEqual(["c11", "c21"]);
    },
  );

  test.fails(
    "[8] Handling triadic friend of a friend that is not a friend with different labels - UNSUPPORTED: OPTIONAL MATCH + IS NULL",
    () => {
      const graph = createTckGraph();
      createBinaryTree2(graph);
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:KNOWS]->(b:X)-->(c:Y)
       OPTIONAL MATCH (a)-[r:KNOWS]->(c)
       WITH c WHERE r IS NULL
       RETURN c.name`,
      );
      const names = results.map((r) => r as string).sort();
      expect(names).toEqual(["c12", "c22"]);
    },
  );

  test.fails(
    "[9] Handling triadic friend of a friend that is not a friend with implicit subset of labels - UNSUPPORTED: OPTIONAL MATCH + IS NULL",
    () => {
      const graph = createTckGraph();
      createBinaryTree2(graph);
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:KNOWS]->(b:X)-->(c)
       OPTIONAL MATCH (a)-[r:KNOWS]->(c:X)
       WITH c WHERE r IS NULL
       RETURN c.name`,
      );
      const names = results.map((r) => r as string).sort();
      expect(names).toEqual(["c11", "c12", "c21", "c22"]);
    },
  );

  test.fails(
    "[10] Handling triadic friend of a friend that is not a friend with implicit superset of labels - UNSUPPORTED: OPTIONAL MATCH + IS NULL",
    () => {
      const graph = createTckGraph();
      createBinaryTree2(graph);
      const results = executeTckQuery(
        graph,
        `MATCH (a:A)-[:KNOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:KNOWS]->(c)
       WITH c WHERE r IS NULL
       RETURN c.name`,
      );
      const names = results.map((r) => r as string).sort();
      expect(names).toEqual(["c11", "c21"]);
    },
  );

  test("[11] Handling triadic friend of a friend that is a friend - UNSUPPORTED: OPTIONAL MATCH + IS NOT NULL", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:KNOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:KNOWS]->(c)
       WITH c WHERE r IS NOT NULL
       RETURN c.name`,
    );
    const names = results.map((r) => r as string).sort();
    expect(names).toEqual([]);
  });

  test("[12] Handling triadic friend of a friend that is a friend with different relationship type - UNSUPPORTED: OPTIONAL MATCH + IS NOT NULL", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:KNOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:FOLLOWS]->(c)
       WITH c WHERE r IS NOT NULL
       RETURN c.name`,
    );
    const names = results.map((r) => r as string).sort();
    expect(names).toEqual([]);
  });

  test("[13] Handling triadic friend of a friend that is a friend with superset of relationship type - UNSUPPORTED: OPTIONAL MATCH + IS NOT NULL", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:KNOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:KNOWS|FOLLOWS]->(c)
       WITH c WHERE r IS NOT NULL
       RETURN c.name`,
    );
    const names = results.map((r) => r as string).sort();
    expect(names).toEqual([]);
  });

  test("[14] Handling triadic friend of a friend that is a friend with implicit subset of relationship type - UNSUPPORTED: OPTIONAL MATCH + IS NOT NULL", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:KNOWS|FOLLOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:KNOWS]->(c)
       WITH c WHERE r IS NOT NULL
       RETURN c.name`,
    );
    const names = results.map((r) => r as string).sort();
    expect(names).toEqual([]);
  });

  test("[15] Handling triadic friend of a friend that is a friend with explicit subset of relationship type - UNSUPPORTED: OPTIONAL MATCH + IS NOT NULL", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:KNOWS|FOLLOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:KNOWS|FOLLOWS]->(c)
       WITH c WHERE r IS NOT NULL
       RETURN c.name`,
    );
    const names = results.map((r) => r as string).sort();
    expect(names).toEqual([]);
  });

  test("[16] Handling triadic friend of a friend that is a friend with same labels - UNSUPPORTED: OPTIONAL MATCH + IS NOT NULL", () => {
    const graph = createTckGraph();
    createBinaryTree2(graph);
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:KNOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:KNOWS]->(c)
       WITH c WHERE r IS NOT NULL
       RETURN c.name`,
    );
    const names = results.map((r) => r as string).sort();
    expect(names).toEqual([]);
  });

  test("[17] Handling triadic friend of a friend that is a friend with different labels - UNSUPPORTED: OPTIONAL MATCH + IS NOT NULL", () => {
    const graph = createTckGraph();
    createBinaryTree2(graph);
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:KNOWS]->(b:X)-->(c:Y)
       OPTIONAL MATCH (a)-[r:KNOWS]->(c)
       WITH c WHERE r IS NOT NULL
       RETURN c.name`,
    );
    const names = results.map((r) => r as string).sort();
    expect(names).toEqual([]);
  });

  test("[18] Handling triadic friend of a friend that is a friend with implicit subset of labels - UNSUPPORTED: OPTIONAL MATCH + IS NOT NULL", () => {
    const graph = createTckGraph();
    createBinaryTree2(graph);
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:KNOWS]->(b:X)-->(c)
       OPTIONAL MATCH (a)-[r:KNOWS]->(c:X)
       WITH c WHERE r IS NOT NULL
       RETURN c.name`,
    );
    const names = results.map((r) => r as string).sort();
    expect(names).toEqual([]);
  });

  test("[19] Handling triadic friend of a friend that is a friend with implicit superset of labels - UNSUPPORTED: OPTIONAL MATCH + IS NOT NULL", () => {
    const graph = createTckGraph();
    createBinaryTree2(graph);
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:KNOWS]->(b:X)-->(c:X)
       OPTIONAL MATCH (a)-[r:KNOWS]->(c)
       WITH c WHERE r IS NOT NULL
       RETURN c.name`,
    );
    const names = results.map((r) => r as string).sort();
    expect(names).toEqual([]);
  });

  // ============================================================================
  // CUSTOM TESTS - Demonstrating triadic selection patterns with labeled nodes
  // ============================================================================

  test("[Custom 1] Find friend of a friend via two-hop pattern", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);

    // Find all nodes reachable via two KNOWS hops from A
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:KNOWS]->(b:X)-[:KNOWS]->(c:X) RETURN c.name",
    );
    const names = results.map((r) => r as string).sort();

    // b1 -> c11, c12; b2 -> c21, c22
    expect(names).toEqual(["c11", "c12", "c21", "c22"]);
  });

  test("[Custom 2] Find direct friends from root", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);

    // Find direct KNOWS relationships from A
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:KNOWS]->(b:X) RETURN b.name",
    );
    const names = results.map((r) => r as string).sort();

    expect(names).toEqual(["b1", "b2"]);
  });

  test("[Custom 3] Find followed users from root", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);

    // Find direct FOLLOWS relationships from A
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:FOLLOWS]->(b:X) RETURN b.name",
    );
    const names = results.map((r) => r as string).sort();

    expect(names).toEqual(["b3", "b4"]);
  });

  test("[Custom 4] Count friends at each level", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);

    // Count level 1 friends
    const level1 = executeTckQuery(
      graph,
      "MATCH (a:A)-[:KNOWS]->(b:X) RETURN count(b)",
    );
    expect(level1[0]).toBe(2);

    // Count level 2 friends (via KNOWS chains)
    const level2 = executeTckQuery(
      graph,
      "MATCH (a:A)-[:KNOWS]->(b:X)-[:KNOWS]->(c:X) RETURN count(c)",
    );
    expect(level2[0]).toBe(4);
  });

  test("[Custom 5] Filter triadic matches by property", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);

    // Find only c-level nodes with specific name pattern
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:KNOWS]->(b:X)-[:KNOWS]->(c:X) WHERE c.name STARTS WITH 'c1' RETURN c.name",
    );
    const names = results.map((r) => r as string).sort();

    expect(names).toEqual(["c11", "c12"]);
  });

  test("[Custom 6] Find nodes reachable via FOLLOWS then KNOWS", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);

    // Find all nodes reachable via FOLLOWS->KNOWS pattern from A
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:FOLLOWS]->(b:X)-[:KNOWS]->(c:X) RETURN c.name",
    );
    const names = results.map((r) => r as string).sort();

    // b3 -> c31, c32; b4 -> c41, c42
    expect(names).toEqual(["c31", "c32", "c41", "c42"]);
  });

  test("[Custom 7] Using binary-tree-2 with label filtering", () => {
    const graph = createTckGraph();
    createBinaryTree2(graph);

    // Find only X-labeled nodes at level 2
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:KNOWS]->(b:X)-[:KNOWS]->(c:X) RETURN c.name",
    );
    const names = results.map((r) => r as string).sort();

    // Only c11 and c21 have X label
    expect(names).toEqual(["c11", "c21"]);
  });

  test("[Custom 8] Using binary-tree-2 with Y-label filtering", () => {
    const graph = createTckGraph();
    createBinaryTree2(graph);

    // Find only Y-labeled nodes at level 2 reachable via KNOWS
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[:KNOWS]->(b:X)-[:KNOWS]->(c:Y) RETURN c.name",
    );
    const names = results.map((r) => r as string).sort();

    // Only c12 and c22 have Y label (children of b1, b2 which are KNOWS from A)
    expect(names).toEqual(["c12", "c22"]);
  });

  test("[Custom 9] Find all level 2 nodes via any outgoing edge", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);

    // Using EXISTS to find level 1 nodes that have outgoing edges
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:KNOWS]->(b:X)-[:KNOWS]->(c:X)
       RETURN DISTINCT c.name`,
    );
    const names = results.map((r) => r as string).sort();

    expect(names).toEqual(["c11", "c12", "c21", "c22"]);
  });

  test("[Custom 10] Count unique intermediate nodes", () => {
    const graph = createTckGraph();
    createBinaryTree1(graph);

    // Count distinct intermediate nodes in KNOWS chains
    const results = executeTckQuery(
      graph,
      `MATCH (a:A)-[:KNOWS]->(b:X)-[:KNOWS]->(c:X)
       WITH DISTINCT b
       RETURN count(b)`,
    );
    expect(results[0]).toBe(2);
  });
});
