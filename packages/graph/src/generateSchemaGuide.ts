import type { GraphSchema } from "./GraphSchema.js";

/**
 * Generate a pure, LLM-friendly description of the graph query language grammar.
 * This description is optimized for LLM understanding and does not reference
 * other query languages to avoid confusion.
 *
 * @returns A comprehensive grammar description suitable for LLM prompts
 */
export function generateGrammarDescription(): string {
  const sections: string[] = [];

  sections.push("# Graph Query Language Grammar");
  sections.push("");
  sections.push(
    "This is a declarative query language for traversing and querying graph data structures.",
  );
  sections.push("");

  // Core Structure
  sections.push("## Query Structure");
  sections.push("");
  sections.push("Every query follows this fixed structure:");
  sections.push("");
  sections.push("```");
  sections.push("MATCH <pattern>");
  sections.push("[WHERE <condition>]");
  sections.push("RETURN <items>");
  sections.push("[ORDER BY <expression> [ASC|DESC]]");
  sections.push("[SKIP <number>]");
  sections.push("[LIMIT <number>]");
  sections.push("```");
  sections.push("");
  sections.push("- `MATCH` is required and defines the graph pattern to find");
  sections.push("- `WHERE` is optional and filters the matched results");
  sections.push("- `RETURN` is required and specifies what data to return");
  sections.push(
    "- `ORDER BY`, `SKIP`, and `LIMIT` are optional result modifiers",
  );
  sections.push("");

  // Pattern Matching
  sections.push("## Pattern Matching (MATCH)");
  sections.push("");
  sections.push("Patterns describe the shape of graph structures to find:");
  sections.push("");

  sections.push("### Node Patterns");
  sections.push("");
  sections.push(
    "Nodes are written using parentheses with a variable and optional label:",
  );
  sections.push("");
  sections.push("- `(n)` - Any node, bound to variable `n`");
  sections.push(
    '- `(n:Person)` - Node with label "Person", bound to variable `n`',
  );
  sections.push(
    '- `(user:User)` - Node with label "User", bound to variable `user`',
  );
  sections.push("");

  sections.push("### Edge Patterns");
  sections.push("");
  sections.push(
    "Edges connect nodes and use arrow syntax to indicate direction:",
  );
  sections.push("");
  sections.push("**Outgoing (left to right):**");
  sections.push(
    '- `(a)-[:follows]->(b)` - Node `a` has outgoing "follows" edge to node `b`',
  );
  sections.push(
    "- `(a)-[r:likes]->(b)` - Same, but edge is bound to variable `r`",
  );
  sections.push("");
  sections.push("**Incoming (right to left):**");
  sections.push(
    '- `(a)<-[:follows]-(b)` - Node `a` has incoming "follows" edge from node `b`',
  );
  sections.push("");
  sections.push("**Bidirectional (either direction):**");
  sections.push(
    '- `(a)-[:knows]-(b)` - Nodes `a` and `b` are connected by "knows" edge in either direction',
  );
  sections.push("");
  sections.push("**Any edge type:**");
  sections.push(
    "- `(a)-[r:]-(b)` - Any edge type between `a` and `b`, bound to variable `r`",
  );
  sections.push("- `(a)-[r:]->(b)` - Any edge type outgoing from `a` to `b`");
  sections.push("");

  sections.push("### Multiple Edge Types");
  sections.push("");
  sections.push("Use the pipe operator `|` to match multiple edge types:");
  sections.push("");
  sections.push(
    '- `(a)-[:follows|likes]->(b)` - Match either "follows" OR "likes" edges',
  );
  sections.push(
    "- `(a)-[:type1|type2|type3]->(b)` - Match any of three edge types",
  );
  sections.push("");

  sections.push("### Variable-Length Paths");
  sections.push("");
  sections.push("Use `*` notation to traverse multiple hops:");
  sections.push("");
  sections.push("- `(a)-[:follows*2]->(b)` - Exactly 2 hops");
  sections.push(
    "- `(a)-[:follows*1..3]->(b)` - Between 1 and 3 hops (emits results at EACH hop: 1, 2, and 3)",
  );
  sections.push(
    "- `(a)-[:follows*2..]->(b)` - 2 or more hops (emits at each level)",
  );
  sections.push(
    "- `(a)-[:follows*..5]->(b)` - Up to 5 hops (emits results at 1, 2, 3, 4, and 5 hops)",
  );
  sections.push("");
  sections.push(
    "**Important:** Range quantifiers (`*min..max`) emit results at EACH hop within the range.",
  );
  sections.push(
    "This means `*1..3` returns nodes reachable in 1 hop, 2 hops, OR 3 hops.",
  );
  sections.push(
    "Use `DISTINCT` to remove duplicate nodes when using variable-length paths.",
  );
  sections.push("");

  sections.push("### Multi-Segment Patterns");
  sections.push("");
  sections.push("Chain multiple segments together to match longer paths:");
  sections.push("");
  sections.push(
    "- `(a)-[:follows]->(b)-[:likes]->(c)` - Two-hop path through specific edge types",
  );
  sections.push("- `(a)-[:r1]->(b)<-[:r2]-(c)` - Fan-in pattern");
  sections.push("");

  // Filtering
  sections.push("## Filtering (WHERE)");
  sections.push("");
  sections.push(
    "Filter matched patterns using property comparisons and logical operators:",
  );
  sections.push("");

  sections.push("### Property Access");
  sections.push("");
  sections.push("Access node and edge properties using dot notation:");
  sections.push("");
  sections.push('- `n.name` - Property "name" of node `n`');
  sections.push('- `r.weight` - Property "weight" of edge `r`');
  sections.push("- `n.@id` - Special property: unique identifier");
  sections.push("- `n.@label` - Special property: node/edge type label");
  sections.push("");

  sections.push("### Comparison Operators");
  sections.push("");
  sections.push("- `=` - Equals");
  sections.push("- `!=` - Not equals");
  sections.push("- `<` - Less than");
  sections.push("- `<=` - Less than or equal");
  sections.push("- `>` - Greater than");
  sections.push("- `>=` - Greater than or equal");
  sections.push("");

  sections.push("### Logical Operators");
  sections.push("");
  sections.push("- `AND` - Both conditions must be true");
  sections.push("- `OR` - At least one condition must be true");
  sections.push("- Parentheses group conditions: `(A AND B) OR C`");
  sections.push("");

  sections.push("### Existence Check");
  sections.push("");
  sections.push(
    "- `property EXISTS` - Check if a property exists on a node/edge",
  );
  sections.push("- Example: `WHERE n.email EXISTS`");
  sections.push("");

  sections.push("### Filter Examples");
  sections.push("");
  sections.push("```");
  sections.push("WHERE n.age > 18");
  sections.push('WHERE n.name = "Alice"');
  sections.push("WHERE n.age >= 21 AND n.verified = true");
  sections.push("WHERE n.score > 100 OR n.premium = true");
  sections.push("WHERE (n.age > 18 AND n.age < 65) OR n.admin = true");
  sections.push("WHERE n.email EXISTS");
  sections.push("```");
  sections.push("");

  // Return Clause
  sections.push("## Returning Results (RETURN)");
  sections.push("");
  sections.push("Specify what data to return from matched patterns:");
  sections.push("");

  sections.push("### Return Items");
  sections.push("");
  sections.push("- `RETURN n` - Return the node bound to variable `n`");
  sections.push(
    "- `RETURN a, b, r` - Return multiple variables (nodes and edges)",
  );
  sections.push("");

  sections.push("### DISTINCT Modifier");
  sections.push("");
  sections.push("Remove duplicate results:");
  sections.push("");
  sections.push("- `RETURN DISTINCT n` - Only unique nodes");
  sections.push(
    "- Use when graph traversal might reach the same node multiple times",
  );
  sections.push("");

  sections.push("### COUNT Aggregation");
  sections.push("");
  sections.push("Count the number of results:");
  sections.push("");
  sections.push("- `RETURN COUNT(n)` - Count how many nodes match");
  sections.push("- Returns a single number instead of the nodes themselves");
  sections.push("");

  // Sorting and Pagination
  sections.push("## Sorting and Pagination");
  sections.push("");

  sections.push("### ORDER BY");
  sections.push("");
  sections.push("Sort results by property values:");
  sections.push("");
  sections.push("- `ORDER BY n.name` - Sort ascending (A-Z, 0-9) - default");
  sections.push("- `ORDER BY n.age DESC` - Sort descending (Z-A, 9-0)");
  sections.push(
    "- `ORDER BY n.lastName ASC, n.firstName ASC` - Multi-level sort",
  );
  sections.push("");

  sections.push("### SKIP");
  sections.push("");
  sections.push("Skip the first N results:");
  sections.push("");
  sections.push("- `SKIP 10` - Skip first 10 results");
  sections.push("- Useful for pagination");
  sections.push("");

  sections.push("### LIMIT");
  sections.push("");
  sections.push("Limit the number of results returned:");
  sections.push("");
  sections.push("- `LIMIT 20` - Return at most 20 results");
  sections.push("- Always use LIMIT for large result sets");
  sections.push("");

  sections.push("### Pagination Pattern");
  sections.push("");
  sections.push("Combine SKIP and LIMIT for pagination:");
  sections.push("");
  sections.push("```");
  sections.push("RETURN n SKIP 0 LIMIT 20   // Page 1");
  sections.push("RETURN n SKIP 20 LIMIT 20  // Page 2");
  sections.push("RETURN n SKIP 40 LIMIT 20  // Page 3");
  sections.push("```");
  sections.push("");

  // Data Types
  sections.push("## Data Types and Literals");
  sections.push("");
  sections.push("### Supported Literal Values");
  sections.push("");
  sections.push(
    "- **Strings**: `\"text\"` or `'text'` (single or double quotes)",
  );
  sections.push("- **Numbers**: `42` (integer) or `3.14` (decimal)");
  sections.push("- **Booleans**: `true` or `false`");
  sections.push("- **Null**: `null`");
  sections.push("");

  sections.push("### Special Properties");
  sections.push("");
  sections.push("Every node and edge has these built-in properties:");
  sections.push("");
  sections.push("- `@id` - Unique identifier, format: `<TypeName>:<uuid>`");
  sections.push("  - Example: `User:12345678-1234-1234-1234-123456789abc`");
  sections.push("- `@label` - The type/label of the node or edge");
  sections.push('  - Example: `"User"`, `"follows"`, `"likes"`');
  sections.push("");

  // Keywords
  sections.push("## Keywords");
  sections.push("");
  sections.push("All keywords are case-insensitive (MATCH = match = Match):");
  sections.push("");
  sections.push("- `MATCH` - Define graph pattern to match");
  sections.push("- `WHERE` - Filter matched results");
  sections.push("- `RETURN` - Specify return values");
  sections.push("- `DISTINCT` - Remove duplicate results");
  sections.push("- `COUNT` - Count aggregate function");
  sections.push("- `ORDER BY` - Sort results");
  sections.push("- `ASC` - Ascending sort order (default)");
  sections.push("- `DESC` - Descending sort order");
  sections.push("- `SKIP` - Skip first N results");
  sections.push("- `LIMIT` - Limit number of results");
  sections.push("- `AND` - Logical AND operator");
  sections.push("- `OR` - Logical OR operator");
  sections.push("- `EXISTS` - Property existence check");
  sections.push("");

  // Comments
  sections.push("## Comments");
  sections.push("");
  sections.push("Comments are ignored by the parser:");
  sections.push("");
  sections.push("- `// Single-line comment`");
  sections.push("- `/* Multi-line comment */`");
  sections.push("");

  // Complete Examples
  sections.push("## Complete Query Examples");
  sections.push("");
  sections.push("### Basic Queries");
  sections.push("");
  sections.push("```");
  sections.push("// Find all users");
  sections.push("MATCH (u:User) RETURN u");
  sections.push("");
  sections.push("// Find users by property");
  sections.push('MATCH (u:User) WHERE u.name = "Alice" RETURN u');
  sections.push("");
  sections.push("// Find user by ID");
  sections.push('MATCH (u:User) WHERE u.@id = "User:12345678-..." RETURN u');
  sections.push("```");
  sections.push("");

  sections.push("### Traversal Queries");
  sections.push("");
  sections.push("```");
  sections.push("// Find who a user follows");
  sections.push("MATCH (u:User)-[:follows]->(f) RETURN f");
  sections.push("");
  sections.push("// Find followers of a user");
  sections.push("MATCH (u:User)<-[:follows]-(follower) RETURN follower");
  sections.push("");
  sections.push("// Multi-hop: friends of friends (exactly 2 hops)");
  sections.push("MATCH (u:User)-[:follows*2]->(fof) RETURN DISTINCT fof");
  sections.push("");
  sections.push(
    "// Find all users within 3 hops (returns at 1, 2, AND 3 hops)",
  );
  sections.push(
    "MATCH (u:User)-[:follows*1..3]->(connected) RETURN DISTINCT connected",
  );
  sections.push("");
  sections.push("// Complex path");
  sections.push("MATCH (u:User)-[:follows]->(f)-[:likes]->(p:Post) RETURN p");
  sections.push("```");
  sections.push("");

  sections.push("### Filtered Queries");
  sections.push("");
  sections.push("```");
  sections.push("// Find active users over 18");
  sections.push("MATCH (u:User)");
  sections.push("WHERE u.age > 18 AND u.active = true");
  sections.push("RETURN u");
  sections.push("");
  sections.push("// Find posts liked by adult users");
  sections.push("MATCH (u:User)-[:likes]->(p:Post)");
  sections.push("WHERE u.age >= 18");
  sections.push("RETURN p");
  sections.push("LIMIT 100");
  sections.push("```");
  sections.push("");

  sections.push("### Aggregation Queries");
  sections.push("");
  sections.push("```");
  sections.push("// Count all users");
  sections.push("MATCH (u:User) RETURN COUNT(u)");
  sections.push("");
  sections.push("// Count connections");
  sections.push("MATCH (u:User)-[:follows]->(f)");
  sections.push('WHERE u.@id = "User:123..."');
  sections.push("RETURN COUNT(f)");
  sections.push("```");
  sections.push("");

  sections.push("### Sorted and Paginated Queries");
  sections.push("");
  sections.push("```");
  sections.push("// Top 10 users by name");
  sections.push("MATCH (u:User)");
  sections.push("RETURN u");
  sections.push("ORDER BY u.name");
  sections.push("LIMIT 10");
  sections.push("");
  sections.push("// Paginated results");
  sections.push("MATCH (u:User)");
  sections.push("WHERE u.active = true");
  sections.push("RETURN u");
  sections.push("ORDER BY u.createdAt DESC");
  sections.push("SKIP 20");
  sections.push("LIMIT 20");
  sections.push("```");
  sections.push("");

  // Best Practices
  sections.push("## Best Practices for Query Construction");
  sections.push("");
  sections.push(
    "1. **Always start with MATCH** - Define the graph pattern first",
  );
  sections.push(
    "2. **Use meaningful variable names** - `user`, `post`, `comment` instead of `a`, `b`, `c`",
  );
  sections.push("3. **Add WHERE for filtering** - Narrow down results early");
  sections.push(
    "4. **Use DISTINCT for multi-hop** - Variable-length paths emit at each level and often produce duplicates",
  );
  sections.push(
    "5. **Always add LIMIT** - Prevent returning massive result sets",
  );
  sections.push(
    "6. **Match specific patterns** - Use labels and edge types when known",
  );
  sections.push(
    "7. **Filter by @id for specific entities** - Most efficient way to start from a known node",
  );
  sections.push(
    '8. **Use variable-length for "within depth N" queries** - `*1..4` finds all nodes within 4 hops (emits at depths 1, 2, 3, AND 4)',
  );
  sections.push(
    "9. **Remember range behavior** - `*1..3` returns results at 1 hop, 2 hops, AND 3 hops, not just at exactly 3",
  );
  sections.push("");

  return sections.join("\n");
}

/**
 * Generate an LLM-friendly description of the graph query language
 * customized to a specific graph's schema.
 *
 * This output is designed to be directly included in LLM prompts to teach
 * the LLM about both the query language syntax and the specific graph structure.
 */
export function generateSchemaGuide<TSchema extends GraphSchema>(
  schema: TSchema,
): string {
  const sections: string[] = [];

  // Header
  sections.push("# Graph Query Language Guide");
  sections.push("");
  sections.push(
    "This graph database supports a declarative query language for traversing and querying graph data.",
  );
  sections.push("");

  // Schema Overview
  sections.push("## Graph Schema");
  sections.push("");
  sections.push("### Vertex Types");
  sections.push("");

  const vertexLabels = Object.keys(schema.vertices);
  if (vertexLabels.length === 0) {
    sections.push("No vertex types defined.");
  } else {
    for (const label of vertexLabels) {
      const properties = schema.vertices[label]?.properties;
      sections.push(`**${label}**`);

      if (properties && Object.keys(properties).length > 0) {
        sections.push("Properties:");
        for (const [propName] of Object.entries(properties)) {
          sections.push(`  - \`${propName}\``);
        }
      } else {
        sections.push("  No properties defined.");
      }
      sections.push("");
    }
  }

  sections.push("### Edge Types");
  sections.push("");

  const edgeLabels = Object.keys(schema.edges);
  if (edgeLabels.length === 0) {
    sections.push("No edge types defined.");
  } else {
    for (const label of edgeLabels) {
      const properties = schema.edges[label]?.properties;
      sections.push(`**${label}**`);

      if (properties && Object.keys(properties).length > 0) {
        sections.push("Properties:");
        for (const [propName] of Object.entries(properties)) {
          sections.push(`  - \`${propName}\``);
        }
      } else {
        sections.push("  No properties defined.");
      }
      sections.push("");
    }
  }

  // Query Language Syntax
  sections.push("## Query Language Syntax");
  sections.push("");
  sections.push("Queries follow this structure:");
  sections.push("```");
  sections.push("MATCH <pattern>");
  sections.push("[WHERE <condition>]");
  sections.push("RETURN <items>");
  sections.push("[ORDER BY <property> [ASC|DESC]]");
  sections.push("[SKIP <number>]");
  sections.push("[LIMIT <number>]");
  sections.push("```");
  sections.push("");

  // Pattern Syntax with Schema Examples
  sections.push("### MATCH Patterns");
  sections.push("");
  sections.push("Match vertex and edge patterns in the graph:");
  sections.push("");

  if (vertexLabels.length > 0) {
    const firstVertex = vertexLabels[0];
    sections.push(`**Match vertices:**`);
    sections.push("```");
    sections.push(`// Match all ${firstVertex} vertices`);
    sections.push(`MATCH (v:${firstVertex}) RETURN v`);
    sections.push("");
    sections.push("// Match with variable");
    sections.push(`MATCH (u:${firstVertex}) RETURN u`);
    sections.push("");
    sections.push("// Match by ID (format: ${firstVertex}:<uuid>)");
    sections.push(
      `MATCH (v:${firstVertex}) WHERE v.@id = "${firstVertex}:12345678-1234-1234-1234-123456789abc" RETURN v`,
    );
    sections.push("```");
    sections.push("");
  }

  if (vertexLabels.length > 1 && edgeLabels.length > 0) {
    const vertex1 = vertexLabels[0];
    const vertex2 = vertexLabels[1];
    const edge = edgeLabels[0];

    sections.push("**Traverse edges:**");
    sections.push("```");
    sections.push(`// Outgoing: ${vertex1} -[${edge}]-> ${vertex2}`);
    sections.push(`MATCH (a:${vertex1})-[:${edge}]->(b:${vertex2}) RETURN b`);
    sections.push("");
    sections.push(`// Incoming: ${vertex1} <-[${edge}]- ${vertex2}`);
    sections.push(`MATCH (a:${vertex1})<-[:${edge}]-(b:${vertex2}) RETURN b`);
    sections.push("");
    sections.push(`// Bidirectional: ${vertex1} -[${edge}]- ${vertex2}`);
    sections.push(`MATCH (a:${vertex1})-[:${edge}]-(b) RETURN b`);
    sections.push("");
    sections.push(`// Any edge type (omit label) and capture relationship`);
    sections.push(`MATCH (a:${vertex1})-[r:]-(b:${vertex2}) RETURN a, r, b`);
    sections.push("");
    sections.push(`// Any edge type in specific direction`);
    sections.push(`MATCH (a:${vertex1})-[r:]->(b:${vertex2}) RETURN a, r, b`);
    sections.push("```");
    sections.push("");
  }

  if (edgeLabels.length > 1) {
    sections.push("**Multiple edge types:**");
    sections.push("```");
    const edges = edgeLabels.slice(0, 2).join("|");
    sections.push(`MATCH (a)-[:${edges}]->(b) RETURN b`);
    sections.push("```");
    sections.push("");
  }

  if (edgeLabels.length > 0) {
    sections.push("**Variable-length paths:**");
    sections.push("```");
    const edge = edgeLabels[0];
    sections.push(`// Exactly 2 hops`);
    sections.push(`MATCH (a)-[:${edge}*2]->(b) RETURN b`);
    sections.push("");
    sections.push(`// 1 to 3 hops (returns nodes at EACH depth: 1, 2, AND 3)`);
    sections.push(`MATCH (a)-[:${edge}*1..3]->(b) RETURN DISTINCT b`);
    sections.push("");
    sections.push(
      `// Up to 4 hops (search within depth 4, emits at each level)`,
    );
    sections.push(`MATCH (a)-[:${edge}*1..4]->(b) RETURN DISTINCT b`);
    sections.push("");
    sections.push(`// 2 or more hops (emits at each level from 2 onwards)`);
    sections.push(`MATCH (a)-[:${edge}*2..]->(b) RETURN DISTINCT b`);
    sections.push("```");
    sections.push("");
    sections.push(
      "**Note:** Range quantifiers emit results at EACH hop within the range. Use `DISTINCT` to avoid duplicates.",
    );
    sections.push("");
  }

  // WHERE Clause with Schema-Specific Examples
  sections.push("### WHERE Conditions");
  sections.push("");
  sections.push("Filter results using property comparisons:");
  sections.push("");

  // Find a vertex type with properties for examples
  let exampleVertex: string | null = null;
  let exampleProps: [string, string][] = [];

  for (const label of vertexLabels) {
    const props = schema.vertices[label]?.properties;
    if (props && Object.keys(props).length > 0) {
      exampleVertex = label;
      exampleProps = Object.entries(props)
        .slice(0, 3)
        .map(([name]) => [name, "unknown"]);
      break;
    }
  }

  if (exampleVertex && exampleProps.length > 0) {
    sections.push("```");

    const [prop1Name] = exampleProps[0]!;

    sections.push(`// Property comparison`);
    sections.push(
      `MATCH (v:${exampleVertex}) WHERE v.${prop1Name} = "value" RETURN v`,
    );
    sections.push("");

    if (exampleProps.length > 1) {
      const [prop2Name] = exampleProps[1]!;
      sections.push(`// Property exists`);
      sections.push(
        `MATCH (v:${exampleVertex}) WHERE v.${prop2Name} EXISTS RETURN v`,
      );
      sections.push("");
    }

    if (exampleProps.length >= 2) {
      const [prop2Name] = exampleProps[1]!;
      sections.push(`// AND condition`);
      sections.push(
        `MATCH (v:${exampleVertex}) WHERE v.${prop1Name} = "x" AND v.${prop2Name} = "y" RETURN v`,
      );
      sections.push("");
    }

    sections.push("```");
    sections.push("");
  }

  sections.push("**Supported operators:**");
  sections.push("- Comparison: `=`, `!=`, `<`, `<=`, `>`, `>=`");
  sections.push("- Logical: `AND`, `OR`");
  sections.push("- Existence: `EXISTS`");
  sections.push("");

  // RETURN Clause
  sections.push("### RETURN Values");
  sections.push("");
  sections.push("Specify what to return from the query:");
  sections.push("");
  sections.push("```");
  if (vertexLabels.length > 0) {
    const vertex = vertexLabels[0];
    sections.push(`// Return vertices`);
    sections.push(`MATCH (v:${vertex}) RETURN v`);
    sections.push("");
    sections.push(`// Return distinct results`);
    sections.push(`MATCH (v:${vertex}) RETURN DISTINCT v`);
    sections.push("");
    sections.push(`// Count results`);
    sections.push(`MATCH (v:${vertex}) RETURN COUNT(v)`);
    sections.push("");
    if (vertexLabels.length > 1 && edgeLabels.length > 0) {
      const vertex2 = vertexLabels[1];
      sections.push(`// Return multiple variables (vertices and edges)`);
      sections.push(
        `MATCH (v:${vertex})-[r:]->(v2:${vertex2}) RETURN v, r, v2`,
      );
      sections.push("");
    }
  }
  sections.push("```");
  sections.push("");

  // ORDER BY, SKIP, LIMIT
  sections.push("### Sorting and Pagination");
  sections.push("");

  if (exampleVertex && exampleProps.length > 0) {
    sections.push("```");
    const [propName] = exampleProps[0]!;
    sections.push(`// Order by property`);
    sections.push(`MATCH (v:${exampleVertex}) RETURN v ORDER BY v.${propName}`);
    sections.push("");
    sections.push(`// Order descending`);
    sections.push(
      `MATCH (v:${exampleVertex}) RETURN v ORDER BY v.${propName} DESC`,
    );
    sections.push("");
    sections.push(`// Pagination`);
    sections.push(`MATCH (v:${exampleVertex}) RETURN v SKIP 10 LIMIT 20`);
    sections.push("```");
    sections.push("");
  }

  // Complete Examples
  sections.push("## Complete Query Examples");
  sections.push("");
  sections.push("Here are full examples using this graph schema:");
  sections.push("");

  if (
    vertexLabels.length >= 2 &&
    edgeLabels.length > 0 &&
    exampleVertex &&
    exampleProps.length > 0
  ) {
    const vertex1 = vertexLabels[0];
    const vertex2 = vertexLabels[1];
    const edge = edgeLabels[0];
    const [propName] = exampleProps[0]!;

    sections.push("```");
    sections.push(`// Query by specific ID`);
    sections.push(
      `MATCH (a:${vertex1}) WHERE a.@id = "${vertex1}:12345678-1234-1234-1234-123456789abc"`,
    );
    sections.push(`RETURN a`);
    sections.push("");

    sections.push(`// Find all ${vertex2} connected to ${vertex1} via ${edge}`);
    sections.push(`MATCH (a:${vertex1})-[:${edge}]->(b:${vertex2})`);
    sections.push(`RETURN b`);
    sections.push("");

    sections.push(`// Find all connections regardless of edge type`);
    sections.push(`MATCH (a:${vertex1})-[r:]-(b:${vertex2})`);
    sections.push(`RETURN a, r, b`);
    sections.push("");

    sections.push(`// Find ${vertex2} with filtering`);
    sections.push(`MATCH (a:${vertex1})-[:${edge}]->(b:${vertex2})`);
    sections.push(`WHERE b.${propName} = "value"`);
    sections.push(`RETURN b`);
    sections.push(`LIMIT 10`);
    sections.push("");

    sections.push(`// Start from specific ${vertex1} and traverse`);
    sections.push(`MATCH (a:${vertex1})-[:${edge}]->(b:${vertex2})`);
    sections.push(
      `WHERE a.@id = "${vertex1}:12345678-1234-1234-1234-123456789abc"`,
    );
    sections.push(`RETURN b`);
    sections.push("");

    sections.push(`// Return relationship properties`);
    sections.push(`MATCH (a:${vertex1})-[r:${edge}]->(b:${vertex2})`);
    sections.push(`RETURN a, r.@id, r.@label, b`);
    sections.push("");

    sections.push(`// Count second-degree connections`);
    sections.push(`MATCH (a:${vertex1})-[:${edge}]->(b)-[:${edge}]->(c)`);
    sections.push(`RETURN COUNT(c)`);
    sections.push("");

    sections.push(`// Find paths with multiple hops`);
    sections.push(`MATCH (a:${vertex1})-[:${edge}*2..3]->(b:${vertex2})`);
    sections.push(`RETURN DISTINCT b`);
    sections.push(`LIMIT 50`);
    sections.push("```");
    sections.push("");
  } else if (vertexLabels.length > 0) {
    const vertex = vertexLabels[0];
    sections.push("```");
    sections.push(`// Simple query`);
    sections.push(`MATCH (v:${vertex})`);
    sections.push(`RETURN v`);
    sections.push(`LIMIT 10`);
    sections.push("");
    sections.push(`// Query by ID`);
    sections.push(`MATCH (v:${vertex})`);
    sections.push(
      `WHERE v.@id = "${vertex}:12345678-1234-1234-1234-123456789abc"`,
    );
    sections.push(`RETURN v`);
    sections.push("```");
    sections.push("");
  }

  // Keywords Reference
  sections.push("## Keywords Reference");
  sections.push("");
  sections.push("All keywords are case-insensitive:");
  sections.push("");
  sections.push("- `MATCH` - Define graph pattern to match");
  sections.push("- `WHERE` - Filter results by conditions");
  sections.push("- `RETURN` - Specify what to return");
  sections.push("- `DISTINCT` - Remove duplicate results");
  sections.push("- `COUNT` - Count aggregate function");
  sections.push("- `ORDER BY` - Sort results");
  sections.push("- `ASC` - Ascending sort order (default)");
  sections.push("- `DESC` - Descending sort order");
  sections.push("- `SKIP` - Skip first N results");
  sections.push("- `LIMIT` - Limit number of results");
  sections.push("- `AND` - Logical AND");
  sections.push("- `OR` - Logical OR");
  sections.push("- `EXISTS` - Check if property exists");
  sections.push("");

  // Data Types
  sections.push("## Data Types");
  sections.push("");
  sections.push("Supported literal values:");
  sections.push("");
  sections.push("- **Strings**: `\"text\"` or `'text'`");
  sections.push("- **Numbers**: `42` or `3.14`");
  sections.push("- **Booleans**: `true` or `false`");
  sections.push("- **Null**: `null`");
  sections.push("");

  // Special Properties
  sections.push("## Special Properties");
  sections.push("");
  sections.push("- `@id` - Element ID (format: `<EntityName>:<uuid>`)");
  sections.push("  - Example: `User:12345678-1234-1234-1234-123456789abc`");
  sections.push("- `@label` - Element label (vertex or edge type)");
  sections.push("");

  // Tips for LLMs
  sections.push("## Query Construction Tips");
  sections.push("");
  sections.push("1. Always start with `MATCH` to define the pattern");
  sections.push(
    "2. Use meaningful variable names (e.g., `u` for user, `p` for post)",
  );
  sections.push("3. Add `WHERE` conditions to filter results");
  sections.push(
    "4. Specify what to `RETURN` - typically the last variable in the pattern",
  );
  sections.push(
    "5. Use `DISTINCT` when variable-length paths may produce duplicates (they emit at each hop)",
  );
  sections.push("6. Add `LIMIT` for large result sets");
  sections.push(
    "7. Use variable-length paths to search within a depth: `*1..4` finds nodes within 4 hops",
  );
  sections.push(
    "8. Remember `*1..N` emits results at EACH level (1, 2, 3, ..., N), not just at exactly N",
  );
  sections.push("");

  // Schema Summary
  sections.push("## Quick Reference");
  sections.push("");
  sections.push(
    `**Available Vertex Types:** ${vertexLabels.join(", ") || "None"}`,
  );
  sections.push("");
  sections.push(`**Available Edge Types:** ${edgeLabels.join(", ") || "None"}`);
  sections.push("");

  return sections.join("\n");
}

/**
 * Generate a compact version of the schema guide suitable for inclusion
 * in system prompts or context windows with token limits.
 */
export function generateCompactSchemaGuide<TSchema extends GraphSchema>(
  schema: TSchema,
): string {
  const sections: string[] = [];

  sections.push("# Graph Query Language");
  sections.push("");

  // Compact Schema
  sections.push("**Schema:**");
  const vertexLabels = Object.keys(schema.vertices);
  const edgeLabels = Object.keys(schema.edges);

  if (vertexLabels.length > 0) {
    sections.push(`Vertices: ${vertexLabels.join(", ")}`);
    for (const label of vertexLabels) {
      const props = schema.vertices[label]?.properties;
      if (props && Object.keys(props).length > 0) {
        const propList = Object.keys(props).join(", ");
        sections.push(`  ${label}: {${propList}}`);
      }
    }
  }

  if (edgeLabels.length > 0) {
    sections.push(`Edges: ${edgeLabels.join(", ")}`);
  }
  sections.push("");

  // Compact Syntax
  sections.push("**Syntax:**");
  sections.push("```");
  sections.push("MATCH (v:Label)-[:edge]->(v2:Label2)");
  sections.push("WHERE v.property > value");
  sections.push("RETURN v [DISTINCT] [ORDER BY v.prop] [LIMIT n]");
  sections.push("```");
  sections.push("");
  sections.push(
    "**Note:** IDs use format `<EntityName>:<uuid>` (e.g., `User:12345678-1234-1234-1234-123456789abc`)",
  );
  sections.push("");

  // One complete example
  if (vertexLabels.length >= 2 && edgeLabels.length > 0) {
    const v1 = vertexLabels[0];
    const v2 = vertexLabels[1];
    const edge = edgeLabels[0];
    sections.push("**Examples:**");
    sections.push("```");
    sections.push(`// Query by ID`);
    sections.push(
      `MATCH (a:${v1}) WHERE a.@id = "${v1}:12345678-1234-1234-1234-123456789abc" RETURN a`,
    );
    sections.push("");
    sections.push(`// Traverse relationships`);
    sections.push(`MATCH (a:${v1})-[:${edge}]->(b:${v2}) RETURN b LIMIT 10`);
    sections.push("```");
  }

  return sections.join("\n");
}
