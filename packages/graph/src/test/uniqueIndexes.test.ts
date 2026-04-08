import { describe, it, expect, beforeEach } from "vitest";
import { makeType } from "./testHelpers.js";
import {
  Graph,
  InMemoryGraphStorage,
  UniqueConstraintViolationError,
  type GraphSchema,
} from "../index.js";
import { parse } from "../grammar.js";
import { astToSteps } from "../astToSteps.js";
import { createTraverser, setQueryParams, clearQueryParams } from "../Steps.js";
import type { Query } from "../AST.js";

// Test schema with unique indexed properties
const testSchema = {
  vertices: {
    User: {
      properties: {
        email: {
          type: makeType<string>(""),
          index: { type: "hash" as const, unique: true },
        },
        username: {
          type: makeType<string>(""),
          index: { type: "btree" as const, unique: true },
        },
        name: {
          type: makeType<string>(""),
        },
        age: {
          type: makeType<number>(0),
          index: { type: "btree" as const },
        },
      },
    },
    Organization: {
      properties: {
        slug: {
          type: makeType<string>(""),
          index: { type: "hash" as const, unique: true },
        },
        name: {
          type: makeType<string>(""),
        },
      },
    },
  },
  edges: {
    memberOf: {
      properties: {
        inviteCode: {
          type: makeType<string>(""),
          index: { type: "hash" as const, unique: true },
        },
        role: {
          type: makeType<"admin" | "member">("member"),
        },
      },
    },
  },
} satisfies GraphSchema;

describe("Unique Indexes", () => {
  let graph: Graph<typeof testSchema>;

  beforeEach(() => {
    graph = new Graph({
      schema: testSchema,
      storage: new InMemoryGraphStorage(),
    });
  });

  describe("IndexManager unique property detection", () => {
    it("should detect unique properties from schema", () => {
      const manager = graph.indexManager;

      expect(manager.isUnique("User", "email")).toBe(true);
      expect(manager.isUnique("User", "username")).toBe(true);
      expect(manager.isUnique("User", "name")).toBe(false);
      expect(manager.isUnique("User", "age")).toBe(false);
      expect(manager.isUnique("Organization", "slug")).toBe(true);
      expect(manager.isUnique("memberOf", "inviteCode")).toBe(true);
    });

    it("should list unique properties for a label", () => {
      const manager = graph.indexManager;

      const userUniqueProps = manager.getUniqueProperties("User");
      expect(userUniqueProps).toContain("email");
      expect(userUniqueProps).toContain("username");
      expect(userUniqueProps).not.toContain("name");
      expect(userUniqueProps).not.toContain("age");

      const orgUniqueProps = manager.getUniqueProperties("Organization");
      expect(orgUniqueProps).toEqual(["slug"]);
    });

    it("should list all unique index configurations", () => {
      const manager = graph.indexManager;
      const configs = manager.getAllUniqueIndexConfigs();

      expect(configs.length).toBe(4); // email, username, slug, inviteCode

      const emailConfig = configs.find((c) => c.label === "User" && c.property === "email");
      expect(emailConfig).toBeDefined();
      expect(emailConfig!.config.type).toBe("hash");
      expect(emailConfig!.elementType).toBe("vertex");

      const inviteCodeConfig = configs.find(
        (c) => c.label === "memberOf" && c.property === "inviteCode",
      );
      expect(inviteCodeConfig).toBeDefined();
      expect(inviteCodeConfig!.elementType).toBe("edge");
    });
  });

  describe("Unique constraint enforcement on vertex creation", () => {
    it("should allow creating vertices with unique property values", () => {
      const user1 = graph.addVertex("User", {
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        age: 25,
      });

      const user2 = graph.addVertex("User", {
        email: "bob@example.com",
        username: "bob",
        name: "Bob",
        age: 30,
      });

      expect(user1.get("email")).toBe("alice@example.com");
      expect(user2.get("email")).toBe("bob@example.com");
    });

    it("should throw UniqueConstraintViolationError on duplicate email", () => {
      graph.addVertex("User", {
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        age: 25,
      });

      expect(() => {
        graph.addVertex("User", {
          email: "alice@example.com", // duplicate
          username: "alice2",
          name: "Alice 2",
          age: 26,
        });
      }).toThrow(UniqueConstraintViolationError);
    });

    it("should throw UniqueConstraintViolationError on duplicate username", () => {
      graph.addVertex("User", {
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        age: 25,
      });

      expect(() => {
        graph.addVertex("User", {
          email: "alice2@example.com",
          username: "alice", // duplicate
          name: "Alice 2",
          age: 26,
        });
      }).toThrow(UniqueConstraintViolationError);
    });

    it("should provide detailed error information", () => {
      const user1 = graph.addVertex("User", {
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        age: 25,
      });

      try {
        graph.addVertex("User", {
          email: "alice@example.com",
          username: "alice2",
          name: "Alice 2",
          age: 26,
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(UniqueConstraintViolationError);
        const e = error as UniqueConstraintViolationError;
        expect(e.label).toBe("User");
        expect(e.property).toBe("email");
        expect(e.value).toBe("alice@example.com");
        expect(e.existingElementId).toBe(user1.id);
      }
    });

    it("should allow null/undefined values without constraint violation", () => {
      // Using a schema where the property is optional
      const optionalSchema = {
        vertices: {
          Item: {
            properties: {
              code: {
                type: makeType<string | undefined>(undefined),
                index: { type: "hash" as const, unique: true },
              },
              name: {
                type: makeType<string>(""),
              },
            },
          },
        },
        edges: {},
      } satisfies GraphSchema;

      const optionalGraph = new Graph({
        schema: optionalSchema,
        storage: new InMemoryGraphStorage(),
      });

      // Both can have undefined code
      const item1 = optionalGraph.addVertex("Item", {
        code: undefined,
        name: "Item 1",
      });
      const item2 = optionalGraph.addVertex("Item", {
        code: undefined,
        name: "Item 2",
      });

      expect(item1.get("code")).toBeUndefined();
      expect(item2.get("code")).toBeUndefined();
    });
  });

  describe("Unique constraint enforcement on property update", () => {
    it("should allow updating to a unique value", () => {
      const user = graph.addVertex("User", {
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        age: 25,
      });

      user.set("email", "alice.new@example.com");

      expect(user.get("email")).toBe("alice.new@example.com");
    });

    it("should allow updating to the same value", () => {
      const user = graph.addVertex("User", {
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        age: 25,
      });

      // Updating to the same value should not throw
      user.set("email", "alice@example.com");

      expect(user.get("email")).toBe("alice@example.com");
    });

    it("should throw on update that would violate uniqueness", () => {
      graph.addVertex("User", {
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        age: 25,
      });

      const user2 = graph.addVertex("User", {
        email: "bob@example.com",
        username: "bob",
        name: "Bob",
        age: 30,
      });

      expect(() => {
        user2.set("email", "alice@example.com");
      }).toThrow(UniqueConstraintViolationError);
    });
  });

  describe("Unique constraint enforcement on edge creation", () => {
    it("should enforce unique constraints on edges", () => {
      const user = graph.addVertex("User", {
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        age: 25,
      });

      const org = graph.addVertex("Organization", {
        slug: "acme",
        name: "Acme Corp",
      });

      graph.addEdge(user, "memberOf", org, {
        inviteCode: "ABC123",
        role: "admin",
      });

      // Should throw on duplicate inviteCode
      const user2 = graph.addVertex("User", {
        email: "bob@example.com",
        username: "bob",
        name: "Bob",
        age: 30,
      });

      expect(() => {
        graph.addEdge(user2, "memberOf", org, {
          inviteCode: "ABC123", // duplicate
          role: "member",
        });
      }).toThrow(UniqueConstraintViolationError);
    });
  });

  describe("MERGE with unique indexes", () => {
    it("should use unique index to find existing vertex in MERGE", () => {
      // Create initial user
      graph.addVertex("User", {
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        age: 25,
      });

      // MERGE should find existing user by unique email
      const ast = parse(`
        MERGE (u:User {email: "alice@example.com"})
        ON MATCH SET u.age = 26
        RETURN u.email, u.age
      `) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, []));

      expect(results.length).toBe(1);
      expect(results[0]).toEqual(["alice@example.com", 26]);

      // Should not create a new user
      const allUsers = Array.from(graph.getVertices("User"));
      expect(allUsers.length).toBe(1);
    });

    it("should create new vertex when unique property not found in MERGE", () => {
      // MERGE should create new user since email doesn't exist
      const ast = parse(`
        MERGE (u:User {email: "newuser@example.com"})
        ON CREATE SET u.username = "newuser", u.name = "New User", u.age = 20
        RETURN u.email, u.username
      `) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, []));

      expect(results.length).toBe(1);
      expect(results[0]).toEqual(["newuser@example.com", "newuser"]);

      // Should have created one user
      const allUsers = Array.from(graph.getVertices("User"));
      expect(allUsers.length).toBe(1);
    });

    it("should use unique index for faster lookups in MERGE", () => {
      // Create many users
      for (let i = 0; i < 100; i++) {
        graph.addVertex("User", {
          email: `user${i}@example.com`,
          username: `user${i}`,
          name: `User ${i}`,
          age: 20 + i,
        });
      }

      // MERGE should find existing user efficiently via unique index
      const ast = parse(`
        MERGE (u:User {email: "user50@example.com"})
        ON MATCH SET u.name = "Updated User 50"
        RETURN u.email, u.name
      `) as Query;
      const steps = astToSteps(ast);
      const traverser = createTraverser(steps);
      const results = Array.from(traverser.traverse(graph, []));

      expect(results.length).toBe(1);
      expect(results[0]).toEqual(["user50@example.com", "Updated User 50"]);

      // Should not create a new user
      const allUsers = Array.from(graph.getVertices("User"));
      expect(allUsers.length).toBe(100);
    });

    it("should handle MERGE with parameters and unique index", () => {
      graph.addVertex("User", {
        email: "existing@example.com",
        username: "existing",
        name: "Existing",
        age: 30,
      });

      const ast = parse(`
        MERGE (u:User {email: $email})
        ON CREATE SET u.username = $username, u.name = $name, u.age = $age
        ON MATCH SET u.age = $age
        RETURN u.email, u.age
      `) as Query;
      const steps = astToSteps(ast);

      // First, match existing user
      setQueryParams({
        email: "existing@example.com",
        username: "existing2",
        name: "Should Not Create",
        age: 35,
      });
      const traverser1 = createTraverser(steps);
      const results1 = Array.from(traverser1.traverse(graph, []));

      expect(results1.length).toBe(1);
      expect(results1[0]).toEqual(["existing@example.com", 35]);

      // Then, create new user
      setQueryParams({
        email: "newuser@example.com",
        username: "newuser",
        name: "New User",
        age: 25,
      });
      const traverser2 = createTraverser(steps);
      const results2 = Array.from(traverser2.traverse(graph, []));

      expect(results2.length).toBe(1);
      expect(results2[0]).toEqual(["newuser@example.com", 25]);

      const allUsers = Array.from(graph.getVertices("User"));
      expect(allUsers.length).toBe(2);

      clearQueryParams();
    });
  });

  describe("Index building with unique constraints", () => {
    it("should throw when building index with duplicate values", () => {
      // Create a graph without unique constraint first
      const nonUniqueSchema = {
        vertices: {
          User: {
            properties: {
              email: {
                type: makeType<string>(""),
                // No unique constraint initially
              },
            },
          },
        },
        edges: {},
      } satisfies GraphSchema;

      const storage = new InMemoryGraphStorage();
      const nonUniqueGraph = new Graph({
        schema: nonUniqueSchema,
        storage,
      });

      // Add duplicate emails
      nonUniqueGraph.addVertex("User", { email: "dup@example.com" });
      nonUniqueGraph.addVertex("User", { email: "dup@example.com" });

      // Now create a graph with unique constraint on the same storage
      const uniqueSchema = {
        vertices: {
          User: {
            properties: {
              email: {
                type: makeType<string>(""),
                index: { type: "hash" as const, unique: true },
              },
            },
          },
        },
        edges: {},
      } satisfies GraphSchema;

      const uniqueGraph = new Graph({
        schema: uniqueSchema,
        storage,
      });

      // Building the index should throw due to duplicates
      expect(() => {
        uniqueGraph.indexManager.buildIndex("User", "email", storage.getVertices(["User"]));
      }).toThrow(UniqueConstraintViolationError);
    });
  });

  describe("Lookup by unique properties", () => {
    it("should look up element by unique property", () => {
      const user = graph.addVertex("User", {
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        age: 25,
      });

      const manager = graph.indexManager;

      // Ensure index is built
      manager.ensureUniqueIndexesBuilt("User", graph.storage.getVertices(["User"]));

      const foundId = manager.lookupUnique("User", "email", "alice@example.com");
      expect(foundId).toBe(user.id);

      const notFoundId = manager.lookupUnique("User", "email", "nonexistent@example.com");
      expect(notFoundId).toBeUndefined();
    });

    it("should find by unique properties", () => {
      const user = graph.addVertex("User", {
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        age: 25,
      });

      const manager = graph.indexManager;

      const foundId = manager.findByUniqueProperties(
        "User",
        { email: "alice@example.com", name: "Alice" },
        graph.storage.getVertices(["User"]),
      );

      expect(foundId).toBe(user.id);
    });
  });
});
