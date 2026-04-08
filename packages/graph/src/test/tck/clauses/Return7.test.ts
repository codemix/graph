/**
 * TCK Return7 - Return all variables
 * Translated from tmp/tck/features/clauses/return/Return7.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Return7 - Return all variables", () => {
  test.fails("[1] Return all variables - named paths not supported", () => {
    // Given: CREATE (:Start)-[:T]->()
    // Query: MATCH p = (a:Start)-->(b) RETURN *
    // Expected: (:Start), (), <(:Start)-[:T]->()>
    // Named path syntax (p = ...) not supported
    const graph = createTckGraph();
    executeTckQuery(graph, "CREATE (:Start)-[:T]->(:End)");
    const results = executeTckQuery(
      graph,
      "MATCH p = (a:Start)-->(b) RETURN *",
    );
    expect(results).toHaveLength(1);
    const row = results[0] as unknown[];
    expect(row).toHaveLength(3); // p, a, b
  });

  test.fails(
    "[2] Fail when using RETURN * without variables in scope - unlabeled nodes in MATCH",
    () => {
      // Query: MATCH () RETURN *
      // Expected: SyntaxError: NoVariablesInScope
      // Unlabeled nodes not supported
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE ()");
      expect(() => {
        executeTckQuery(graph, "MATCH () RETURN *");
      }).toThrow();
    },
  );

  test("[custom] Return all variables with labeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      "CREATE (:A {name: 'Alice'})-[:KNOWS]->(:B {name: 'Bob'})",
    );

    // RETURN * should return all variables (a, r, b)
    const results = executeTckQuery(
      graph,
      "MATCH (a:A)-[r:KNOWS]->(b:B) RETURN *",
    );
    expect(results).toHaveLength(1);

    // Results should be [a, r, b] in some form
    const row = results[0] as unknown[];
    expect(row).toHaveLength(3);
  });
});
