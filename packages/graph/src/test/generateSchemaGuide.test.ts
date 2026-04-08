import { test, expect } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import {
  generateSchemaGuide,
  generateCompactSchemaGuide,
  generateGrammarDescription,
} from "../generateSchemaGuide.js";

function makeType<T>(_defaultValue: T): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "codemix",
      validate: (value) => {
        return { value: value as T };
      },
    },
  };
}

test("generateSchemaGuide - should generate a guide for a social network schema", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
          email: { type: makeType<string>("") },
          verified: { type: makeType<boolean>(false) },
        },
      },
      Post: {
        properties: {
          title: { type: makeType<string>("") },
          content: { type: makeType<string>("") },
          likes: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      follows: {
        properties: {},
      },
      likes: {
        properties: {},
      },
      authored: {
        properties: {},
      },
    },
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const guide = generateSchemaGuide(schema);

  // Check header
  expect(guide).toContain("# Graph Query Language Guide");

  // Check vertex types are documented
  expect(guide).toContain("**User**");
  expect(guide).toContain("**Post**");
  expect(guide).toContain("`name`");
  expect(guide).toContain("`age`");
  expect(guide).toContain("`title`");

  // Check edge types are documented
  expect(guide).toContain("**follows**");
  expect(guide).toContain("**likes**");
  expect(guide).toContain("**authored**");

  // Check syntax examples use schema labels
  expect(guide).toContain("MATCH (v:User)");
  expect(guide).toContain("MATCH (a:User)-[:follows]->(b:Post)");

  // Check WHERE examples use actual properties
  expect(guide).toContain("v.name");
  expect(guide).toContain("v.age");

  // Check query construction tips
  expect(guide).toContain("Query Construction Tips");

  // Check keywords reference
  expect(guide).toContain("Keywords Reference");
  expect(guide).toContain("MATCH");
  expect(guide).toContain("WHERE");
  expect(guide).toContain("RETURN");
});

test("generateSchemaGuide - should generate a guide for a simple schema with no properties", () => {
  const schema = {
    vertices: {
      Node: {
        properties: {},
      },
    },
    edges: {
      connects: {
        properties: {},
      },
    },
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const guide = generateSchemaGuide(schema);

  expect(guide).toContain("**Node**");
  expect(guide).toContain("**connects**");
  expect(guide).toContain("No properties defined");
});

test("generateSchemaGuide - should handle schema with vertices but no edges", () => {
  const schema = {
    vertices: {
      Item: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
    },
    edges: {},
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const guide = generateSchemaGuide(schema);

  expect(guide).toContain("**Item**");
  expect(guide).toContain("No edge types defined");
});

test("generateSchemaGuide - should handle empty schema", () => {
  const schema = {
    vertices: {},
    edges: {},
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const guide = generateSchemaGuide(schema);

  expect(guide).toContain("No vertex types defined");
  expect(guide).toContain("No edge types defined");
});

test("generateSchemaGuide - should include variable-length path examples when edges exist", () => {
  const schema = {
    vertices: {
      Person: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      knows: {
        properties: {},
      },
    },
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const guide = generateSchemaGuide(schema);

  expect(guide).toContain("Variable-length paths");
  expect(guide).toContain("[:knows*2]");
  expect(guide).toContain("[:knows*1..3]");
  expect(guide).toContain("[:knows*2..]");
});

test("generateSchemaGuide - should include multiple edge type syntax when multiple edges exist", () => {
  const schema = {
    vertices: {
      User: {
        properties: {},
      },
    },
    edges: {
      follows: {
        properties: {},
      },
      blocks: {
        properties: {},
      },
      mentions: {
        properties: {},
      },
    },
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const guide = generateSchemaGuide(schema);

  expect(guide).toContain("Multiple edge types");
  expect(guide).toContain("follows|blocks");
});

test("generateSchemaGuide - should generate property-specific WHERE examples", () => {
  const schema = {
    vertices: {
      Product: {
        properties: {
          price: { type: makeType<number>(0) },
          name: { type: makeType<string>("") },
          inStock: { type: makeType<boolean>(false) },
        },
      },
    },
    edges: {},
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const guide = generateSchemaGuide(schema);

  // Property comparison examples
  expect(guide).toContain('v.price = "value"');

  // Check that properties are documented
  expect(guide).toContain("`price`");
  expect(guide).toContain("`name`");
  expect(guide).toContain("`inStock`");
});

test("generateSchemaGuide - should include complete query examples for complex schemas", () => {
  const schema = {
    vertices: {
      Author: {
        properties: {
          name: { type: makeType<string>("") },
          reputation: { type: makeType<number>(0) },
        },
      },
      Article: {
        properties: {
          title: { type: makeType<string>("") },
          views: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      wrote: {
        properties: {},
      },
      cites: {
        properties: {},
      },
    },
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const guide = generateSchemaGuide(schema);

  expect(guide).toContain("Complete Query Examples");
  expect(guide).toContain("MATCH (a:Author)-[:wrote]->(b:Article)");
  expect(guide).toContain("second-degree connections");
});

test("generateCompactSchemaGuide - should generate a compact guide", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
          age: { type: makeType<number>(0) },
        },
      },
      Post: {
        properties: {
          title: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {},
      },
      likes: {
        properties: {},
      },
    },
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const compactGuide = generateCompactSchemaGuide(schema);

  // Check it's more compact
  const fullGuide = generateSchemaGuide(schema);
  expect(compactGuide.length).toBeLessThan(fullGuide.length / 2);

  // Check essential information is present
  expect(compactGuide).toContain("Vertices: User, Post");
  expect(compactGuide).toContain("Edges: follows, likes");
  expect(compactGuide).toContain("User: {name, age}");
  expect(compactGuide).toContain("Post: {title}");

  // Check syntax example is present
  expect(compactGuide).toContain("MATCH (v:Label)");

  // Check concrete example with schema labels
  expect(compactGuide).toContain("MATCH (a:User)-[:follows]->(b:Post)");
});

test("generateCompactSchemaGuide - should handle simple schemas compactly", () => {
  const schema = {
    vertices: {
      Node: {
        properties: {},
      },
    },
    edges: {
      link: {
        properties: {},
      },
    },
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const compactGuide = generateCompactSchemaGuide(schema);

  expect(compactGuide).toContain("Vertices: Node");
  expect(compactGuide).toContain("Edges: link");
  expect(compactGuide.length).toBeLessThan(500); // Should be quite short
});

test("generateCompactSchemaGuide - should handle empty schema gracefully", () => {
  const schema = {
    vertices: {},
    edges: {},
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const compactGuide = generateCompactSchemaGuide(schema);

  expect(compactGuide).toContain("Graph Query Language");
  expect(compactGuide.length).toBeLessThan(300);
});

test("Edge patterns without labels - should include examples of matching edges without specifying labels", () => {
  const schema = {
    vertices: {
      Concept: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
      UserStory: {
        properties: {
          title: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      relatesTo: {
        properties: {},
      },
    },
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const guide = generateSchemaGuide(schema);

  // Check that examples include matching any edge type
  expect(guide).toContain(
    "MATCH (a:Concept)-[r:]-(b:UserStory) RETURN a, r, b",
  );

  // Check that examples show capturing edge variables
  expect(guide).toContain("-[r:]-");

  // Check that examples show returning edges
  expect(guide).toContain("RETURN v, r, v2");

  // Check that examples show accessing edge properties
  expect(guide).toContain("r.@id");
  expect(guide).toContain("r.@label");
});

test("ID format documentation - should include properly formatted ID examples in the guide", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
      Post: {
        properties: {
          title: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      follows: {
        properties: {},
      },
    },
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const guide = generateSchemaGuide(schema);

  // Check that ID format is documented
  expect(guide).toContain("<EntityName>:<uuid>");
  expect(guide).toContain("User:12345678-1234-1234-1234-123456789abc");

  // Check that examples include ID queries
  expect(guide).toContain(
    'v.@id = "User:12345678-1234-1234-1234-123456789abc"',
  );
  expect(guide).toContain(
    'WHERE a.@id = "User:12345678-1234-1234-1234-123456789abc"',
  );
});

test("ID format documentation - should include ID format in compact guide", () => {
  const schema = {
    vertices: {
      Concept: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
      Property: {
        properties: {
          value: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      hasProperty: {
        properties: {},
      },
    },
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const compactGuide = generateCompactSchemaGuide(schema);

  // Check that ID format is mentioned
  expect(compactGuide).toContain("<EntityName>:<uuid>");
  expect(compactGuide).toContain("12345678-1234-1234-1234-123456789abc");

  // Check that examples include ID queries
  expect(compactGuide).toContain("@id");
});

test("generateGrammarDescription - should generate a comprehensive grammar description", () => {
  const grammar = generateGrammarDescription();

  // Check main header
  expect(grammar).toContain("# Graph Query Language Grammar");

  // Check that it's a substantial guide
  expect(grammar.length).toBeGreaterThan(5000);

  // Check major sections exist
  expect(grammar).toContain("## Query Structure");
  expect(grammar).toContain("## Pattern Matching (MATCH)");
  expect(grammar).toContain("## Filtering (WHERE)");
  expect(grammar).toContain("## Returning Results (RETURN)");
  expect(grammar).toContain("## Sorting and Pagination");
  expect(grammar).toContain("## Data Types and Literals");
});

test("generateGrammarDescription - should document node patterns", () => {
  const grammar = generateGrammarDescription();

  // Check node pattern syntax
  expect(grammar).toContain("### Node Patterns");
  expect(grammar).toContain("(n)");
  expect(grammar).toContain("(n:Person)");
  expect(grammar).toContain("(user:User)");
});

test("generateGrammarDescription - should document edge patterns", () => {
  const grammar = generateGrammarDescription();

  // Check edge pattern syntax
  expect(grammar).toContain("### Edge Patterns");
  expect(grammar).toContain("(a)-[:follows]->(b)");
  expect(grammar).toContain("(a)-[r:likes]->(b)");
  expect(grammar).toContain("(a)<-[:follows]-(b)");
  expect(grammar).toContain("(a)-[:knows]-(b)");
});

test("generateGrammarDescription - should document variable-length paths", () => {
  const grammar = generateGrammarDescription();

  expect(grammar).toContain("Variable-length");
  expect(grammar).toContain("*2");
  expect(grammar).toContain("*1..3");
  expect(grammar).toContain("*2..");
  expect(grammar).toContain("*..");
});

test("generateGrammarDescription - should document WHERE clause operators", () => {
  const grammar = generateGrammarDescription();

  // Check comparison operators section exists
  expect(grammar).toContain("### Comparison Operators");
  expect(grammar).toContain("- `=` - Equals");
  expect(grammar).toContain("- `!=` - Not equals");
  expect(grammar).toContain("- `<` - Less than");
  expect(grammar).toContain("- `>` - Greater than");
  expect(grammar).toContain("- `<=` - Less than or equal");
  expect(grammar).toContain("- `>=` - Greater than or equal");

  // Check logical operators
  expect(grammar).toContain("### Logical Operators");
  expect(grammar).toContain("- `AND` - Both conditions must be true");
  expect(grammar).toContain("- `OR` - At least one condition must be true");
});

test("generateGrammarDescription - should document RETURN expressions", () => {
  const grammar = generateGrammarDescription();

  expect(grammar).toContain("## Returning Results (RETURN)");
  expect(grammar).toContain("RETURN n");
  expect(grammar).toContain("RETURN a, b, r");
  expect(grammar).toContain("RETURN DISTINCT");
});

test("generateGrammarDescription - should document aggregate functions", () => {
  const grammar = generateGrammarDescription();

  expect(grammar).toContain("### COUNT Aggregation");
  expect(grammar).toContain("RETURN COUNT(n)");
  expect(grammar).toContain("Count how many nodes match");
});

test("generateGrammarDescription - should document ORDER BY clause", () => {
  const grammar = generateGrammarDescription();

  expect(grammar).toContain("ORDER BY");
  expect(grammar).toContain("ASC");
  expect(grammar).toContain("DESC");
});

test("generateGrammarDescription - should document SKIP and LIMIT", () => {
  const grammar = generateGrammarDescription();

  expect(grammar).toContain("SKIP");
  expect(grammar).toContain("LIMIT");
});

test("generateGrammarDescription - should provide complete query examples", () => {
  const grammar = generateGrammarDescription();

  // Check that complete examples are present
  expect(grammar).toContain("MATCH");
  expect(grammar).toContain("WHERE");
  expect(grammar).toContain("RETURN");

  // Should have markdown code blocks
  expect(grammar).toContain("```");
});

test("generateGrammarDescription - should use proper markdown formatting", () => {
  const grammar = generateGrammarDescription();

  // Check markdown elements
  expect(grammar).toMatch(/^# /m); // H1 headers
  expect(grammar).toMatch(/^## /m); // H2 headers
  expect(grammar).toMatch(/^### /m); // H3 headers
  expect(grammar).toMatch(/```/); // Code blocks
  expect(grammar).toMatch(/`\w+`/); // Inline code
});

test("LLM consumption format - should produce markdown-formatted output suitable for LLM prompts", () => {
  const schema = {
    vertices: {
      Employee: {
        properties: {
          name: { type: makeType<string>("") },
          salary: { type: makeType<number>(0) },
        },
      },
    },
    edges: {
      reportsTo: {
        properties: {},
      },
    },
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const guide = generateSchemaGuide(schema);

  // Check markdown formatting
  expect(guide).toMatch(/^# /m); // Has headers
  expect(guide).toMatch(/^## /m); // Has subheaders
  expect(guide).toMatch(/```/); // Has code blocks
  expect(guide).toMatch(/\*\*\w+\*\*/); // Has bold text
  expect(guide).toMatch(/`\w+`/); // Has inline code

  // Check structure for LLM consumption
  const sections = guide.split("\n## ");
  expect(sections.length).toBeGreaterThan(5); // Multiple sections
  expect(sections[0]).toContain("Graph Query Language Guide");
});

test("LLM consumption format - should provide progressive examples from simple to complex", () => {
  const schema = {
    vertices: {
      User: {
        properties: {
          name: { type: makeType<string>("") },
        },
      },
      Post: {
        properties: {
          title: { type: makeType<string>("") },
        },
      },
    },
    edges: {
      posted: {
        properties: {},
      },
    },
  } as const;

  new Graph({ schema, storage: new InMemoryGraphStorage() });
  const guide = generateSchemaGuide(schema);

  // Find positions of different complexity levels
  const simpleMatch = guide.indexOf("MATCH (v:User)");
  const edgeMatch = guide.indexOf("MATCH (a:User)-[:posted]->(b:Post)");
  const countMatch = guide.indexOf("COUNT");

  // Verify progression: simple -> edges -> aggregates
  expect(simpleMatch).toBeLessThan(edgeMatch);
  expect(edgeMatch).toBeLessThan(countMatch);
});
