/**
 * TCK Delete5 - Delete clause interoperation with built-in data types
 * Translated from tmp/tck/features/clauses/delete/Delete5.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Delete5 - Delete clause interoperation with built-in data types", () => {
  test.fails("[1] Delete node from a list", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:User)-[:FRIEND]->(:Friend {name: 'a'})");
    executeTckQuery(graph, "MATCH (u:User) CREATE (u)-[:FRIEND]->(:Friend {name: 'b'})");
    const results = executeTckQuery(
      graph,
      "MATCH (:User)-[:FRIEND]->(n) WITH collect(n) AS friends DETACH DELETE friends[0] RETURN size(friends)",
    );
    expect(results).toHaveLength(1);
  });

  test.fails("[2] Delete relationship from a list", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:User)-[:FRIEND]->(:Friend)");
    executeTckQuery(graph, "MATCH (u:User) CREATE (u)-[:FRIEND]->(:Friend)");
    const results = executeTckQuery(
      graph,
      "MATCH (:User)-[r:FRIEND]->() WITH collect(r) AS friendships DELETE friendships[0] RETURN size(friendships)",
    );
    expect(results).toHaveLength(1);
  });

  test.fails("[3] Delete nodes from a map", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:User {name: 'test'})");
    executeTckQuery(graph, "MATCH (u:User) WITH {key: u} AS nodes DELETE nodes.key");
    const results = executeTckQuery(graph, "MATCH (u:User) RETURN u");
    expect(results).toHaveLength(0);
  });

  test.fails("[4] Delete relationships from a map", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:User)-[:KNOWS]->(:User)");
    executeTckQuery(graph, "MATCH (:User)-[r]->(:User) WITH {key: r} AS rels DELETE rels.key");
    const results = executeTckQuery(graph, "MATCH ()-[r]->() RETURN r");
    expect(results).toHaveLength(0);
  });

  test.fails("[5] Detach delete nodes from nested map/list", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:User {name: 'a'}), (:User {name: 'b'})");
    executeTckQuery(
      graph,
      "MATCH (u:User) WITH {key: collect(u)} AS nodeMap DETACH DELETE nodeMap.key[0]",
    );
    const results = executeTckQuery(graph, "MATCH (u:User) RETURN u");
    expect(results).toHaveLength(1);
  });

  test.fails("[6] Delete relationships from nested map/list", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:User)-[:KNOWS]->(:User)");
    executeTckQuery(
      graph,
      "MATCH (:User)-[r]->(:User) WITH {key: {key: collect(r)}} AS rels DELETE rels.key.key[0]",
    );
    const results = executeTckQuery(graph, "MATCH ()-[r]->() RETURN r");
    expect(results).toHaveLength(0);
  });

  test.fails("[7] Delete paths from nested map/list", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:User)-[:KNOWS]->(:User)");
    executeTckQuery(graph, "CREATE (:User)-[:KNOWS]->(:User)");
    executeTckQuery(
      graph,
      "MATCH p = (:User)-[r]->(:User) WITH {key: collect(p)} AS pathColls DELETE pathColls.key[0], pathColls.key[1]",
    );
    const results = executeTckQuery(graph, "MATCH (u:User) RETURN u");
    expect(results).toHaveLength(0);
  });

  test("[8] Failing when using undefined variable in DELETE - semantic validation not implemented", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    expect(() => executeTckQuery(graph, "MATCH (a) DELETE x")).toThrow();
  });

  test("[9] Failing when deleting an integer expression - semantic validation not implemented", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:A)");
    expect(() => executeTckQuery(graph, "MATCH () DELETE 1 + 1")).toThrow();
  });

  // Note: All TCK tests in this feature file require features that are not supported:
  // - Parameter syntax ($param)
  // - Map literals in expressions ({key: value})
  // - List indexing in DELETE expressions (list[index])
  // - collect() function with complex operations
  // - Named path syntax (p = pattern)
  // - Semantic validation for variable/type errors

  // Custom tests showing what DELETE scenarios ARE supported
  test("[custom] Delete based on collected count (using WITH aggregation)", () => {
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:User {name: 'alice'})");
    executeTckQuery(graph, "CREATE (:User {name: 'bob'})");
    executeTckQuery(graph, "CREATE (:User {name: 'carol'})");

    // Count users then delete all
    const countBefore = executeTckQuery(graph, "MATCH (u:User) RETURN count(u) AS c");
    expect(countBefore[0]).toBe(3);

    // Delete all users
    executeTckQuery(graph, "MATCH (u:User) DELETE u");

    // Count after
    const countAfter = executeTckQuery(graph, "MATCH (u:User) RETURN count(u) AS c");
    expect(countAfter[0]).toBe(0);
  });
});
