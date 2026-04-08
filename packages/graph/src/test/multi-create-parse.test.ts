import { test, expect } from "vitest";
import { parse } from "../grammar.js";
import type { Query } from "../AST.js";

test("CREATE with count(*)", () => {
  const query = `CREATE (c1:Concept {name: "Test"})
RETURN count(*) as created`;

  const ast = parse(query) as Query;
  expect(ast.type).toBe("Query");
  const returnItem = ast.return!.items[0]!;
  expect(returnItem.aggregate).toBe("COUNT");
  expect(returnItem.variable).toBe("*");
  expect(returnItem.alias).toBe("created");
});

test("Multi-CREATE query with 12 concepts and count(*)", () => {
  const query = `CREATE (c:Concept {name: "Organization User", description: "Association between a user and an organization, including role and membership timestamps."})
CREATE (c2:Concept {name: "User Email Address", description: "An email address belonging to a user, with verification status."})
CREATE (c3:Concept {name: "User Password", description: "Hashed password credentials for a user."})
CREATE (c4:Concept {name: "User OAuth Account", description: "External OAuth identity linked to a user account."})
CREATE (c5:Concept {name: "Project Workflow Instance", description: "Execution instance of a workflow associated with a project or branch."})
CREATE (c6:Concept {name: "Project Git Repository", description: "Git repository configuration for a project, including URL and metadata."})
CREATE (c7:Concept {name: "Project Text Resource", description: "Arbitrary text content associated with a project, such as documentation or prompts."})
CREATE (c8:Concept {name: "GitHub Installation", description: "GitHub App installation linking an organization to GitHub resources."})
CREATE (c9:Concept {name: "OAuth State", description: "Temporary state information used during OAuth flows for security and routing."})
CREATE (c10:Concept {name: "Organization User Invitation", description: "Invitation sent to a prospective member to join an organization."})
CREATE (c11:Concept {name: "Project Branch Naming Settings", description: "Configuration governing automatic naming of new branches within a project."})
CREATE (c12:Concept {name: "Project AI Settings", description: "Feature flags and parameters for AI-assisted functionality in a project."})
RETURN count(*) as created`;

  const ast = parse(query) as Query;

  expect(ast.type).toBe("Query");

  // Should have 12 CREATE clauses in mutations array
  expect(ast.mutations).toBeDefined();
  expect(ast.mutations).toHaveLength(12);

  // All should be CreateClause type
  for (const mutation of ast.mutations!) {
    expect(mutation.type).toBe("CreateClause");
  }

  // Check RETURN clause
  expect(ast.return).toBeDefined();
  const returnItem = ast.return!.items[0]!;
  expect(returnItem.aggregate).toBe("COUNT");
  expect(returnItem.variable).toBe("*");
  expect(returnItem.alias).toBe("created");
});

test("WITH count(*) AS total", () => {
  const query = `MATCH (n:Node)
WITH count(*) AS total
RETURN total`;

  const ast = parse(query) as Query;
  expect(ast.with).toBeDefined();
  const withItem = ast.with![0]!.items[0]!;
  expect(withItem.expression).toEqual({
    type: "WithAggregate",
    function: "COUNT",
    variable: "*",
  });
});
