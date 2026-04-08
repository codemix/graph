/**
 * TCK MatchWhere2 - Filter multiple variables
 * Translated from tmp/tck/features/clauses/match-where/MatchWhere2.feature
 */
import { describe, test, expect } from "vitest";
import { createTckGraph, executeTckQuery } from "../tckHelpers.js";

describe("MatchWhere2 - Filter multiple variables", () => {
  test.fails("[1] Filter nodes with conjunctive two-part property predicate - comma-separated edge patterns not supported", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (a:A {name: 'Alice', age: 38}),
             (b:B {name: 'Bob', age: 25}),
             (c:C {name: 'Charlie', age: 53}),
             (d:D {name: 'Diana', age: 38})
       CREATE (a)-[:T]->(b), (b)-[:T]->(c), (c)-[:T]->(d), (d)-[:T]->(a), (b)-[:T]->(d)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (a)--(b)--(c)--(d)--(a), (b)--(d)
       WHERE a.name = 'Alice' AND c.name = 'Charlie'
       RETURN d.name`,
    );
    expect(results).toHaveLength(1);
    expect((results[0] as [string])[0]).toBe("Diana");
  });

  test.fails("[2] Filter node with conjunctive multi-part property predicates - requires parameters and unlabeled nodes", () => {
    const graph = createTckGraph();
    executeTckQuery(
      graph,
      `CREATE (advertiser:Advertiser {name: 'Acme'}),
             (adValue:AdValue {amount: 500}),
             (product:Product {name: 'Widget'}),
             (campaign:Campaign {name: 'Summer'}),
             (apValue:ApValue {amount: 100})
       CREATE (advertiser)-[:ADV_HAS_PRODUCT]->(product),
             (product)-[:AA_HAS_VALUE]->(adValue),
             (product)-[:AP_HAS_VALUE]->(apValue)`,
    );
    const results = executeTckQuery(
      graph,
      `MATCH (advertiser)-[:ADV_HAS_PRODUCT]->(product)
       WHERE advertiser.name = $name
       MATCH (product)-[:AA_HAS_VALUE]->(adValue)
       MATCH (product)-[:AP_HAS_VALUE]->(apValue)
       RETURN adValue.amount, apValue.amount`,
      { name: "Acme" },
    );
    expect(results).toHaveLength(1);
    const [adAmount, apAmount] = results[0] as [number, number];
    expect(adAmount).toBe(500);
    expect(apAmount).toBe(100);
  });
});
