/**
 * TCK MatchWhere5 - Filter on predicate resulting in null
 * Translated from tmp/tck/features/clauses/match-where/MatchWhere5.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery, getLabel, getProperty } from "../tckHelpers.js";

describe("MatchWhere5 - Filter on predicate resulting in null", () => {
  test("[1] Filter out on null", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (root:Root {name: 'x'}),
             (child1:TextNode {var: 'text'}),
             (child2:IntNode {var: 0})
       CREATE (root)-[:T]->(child1),
             (root)-[:T]->(child2)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (:Root {name: 'x'})-->(i:TextNode)
       WHERE i.var > 'te'
       RETURN i`,
    );
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [i] = results[0] as [Record<string, unknown>];
    expect(getLabel(i)).toBe("TextNode");
    expect(getProperty(i, "var")).toBe("text");
  });

  test.fails("[2] Filter out on null if the AND'd predicate evaluates to false - WHERE i:TextNode label syntax not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (root:Root {name: 'x'}),
             (child1:TextNode {var: 'text'}),
             (child2:IntNode {var: 0})
       CREATE (root)-[:T]->(child1),
             (root)-[:T]->(child2)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (:Root {name: 'x'})-->(i)
       WHERE i.var > 'te' AND i:IntNode
       RETURN i`,
    );
    expect(results).toHaveLength(0);
  });

  test("[3] Filter out on null if the AND'd predicate evaluates to true", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (root:Root {name: 'x'}),
             (child1:TextNode {var: 'text'}),
             (child2:IntNode {var: 0})
       CREATE (root)-[:T]->(child1),
             (root)-[:T]->(child2)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (:Root {name: 'x'})-->(i:TextNode)
       WHERE i.var > 'te' AND i.var IS NOT NULL
       RETURN i`,
    );
    expect(results).toHaveLength(1);
    // Single RETURN item is wrapped in array
    const [i] = results[0] as [Record<string, unknown>];
    expect(getLabel(i)).toBe("TextNode");
    expect(getProperty(i, "var")).toBe("text");
  });

  test("[4] Do not filter out on null if OR'd predicate evaluates to true - requires unlabeled nodes in pattern", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (root:Root {name: 'x'}),
             (child1:Child {var: 'text'}),
             (child2:Child {var: 0})
       CREATE (root)-[:T]->(child1),
             (root)-[:T]->(child2)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (:Root {name: 'x'})-->(i)
       WHERE i.var > 'te' OR i.var = 0
       RETURN i`,
    );
    expect(results).toHaveLength(2);
  });
});
