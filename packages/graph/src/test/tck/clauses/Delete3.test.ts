/**
 * TCK Delete3 - Deleting named paths
 * Translated from tmp/tck/features/clauses/delete/Delete3.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("Delete3 - Deleting named paths", () => {
  test.fails(
    "[1] Detach deleting paths - named path syntax not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "CREATE (:X)-[:R]->(:Y)-[:R]->(:Z)-[:R]->(:W)");
      executeTckQuery(graph, "MATCH p = (:X)-->()-->()-->() DETACH DELETE p");
      const results = executeTckQuery(graph, "MATCH (n) RETURN n");
      expect(results).toHaveLength(0);
    },
  );

  test.fails(
    "[2] Delete on null path - named path and OPTIONAL MATCH not supported",
    () => {
      const graph = createTckGraph();
      executeTckQuery(graph, "OPTIONAL MATCH p = ()-->() DETACH DELETE p");
      const results = executeTckQuery(graph, "MATCH (n) RETURN n");
      expect(results).toHaveLength(0);
    },
  );

  // Note: Named path syntax (p = pattern) is not supported in the grammar
  // All TCK tests in this feature file require named paths, so they are all skipped
});
