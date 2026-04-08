import { test, expect } from "vitest";
import {
  createMatcher,
  createDetailedMatcher,
  rankDocuments,
} from "./matcher.js";

test("Matcher createMatcher should return a function", () => {
  const matcher = createMatcher("test");
  expect(typeof matcher).toBe("function");
});

test("Matcher createMatcher should return 0 for empty query", () => {
  const matcher = createMatcher("");
  expect(matcher("anything")).toBe(0);
});

test("Matcher createMatcher should return 0 for no match", () => {
  const matcher = createMatcher("elephant");
  expect(matcher("The quick brown fox")).toBe(0);
});

test("Matcher createMatcher should return high score for exact match", () => {
  const matcher = createMatcher("quick brown fox");
  const score = matcher("quick brown fox");
  expect(score).toBeGreaterThan(0.9);
});

test("Matcher createMatcher should return high score for exact substring match", () => {
  const matcher = createMatcher("brown fox");
  const score = matcher("The quick brown fox jumps");
  expect(score).toBeGreaterThan(0.7);
});

test("Matcher createMatcher should handle stemming in queries", () => {
  const matcher = createMatcher("running dogs");
  // Should match "run" and "dog"
  expect(matcher("The dog runs quickly")).toBeGreaterThan(0.5);
});

test("Matcher createMatcher should handle stemming in documents", () => {
  const matcher = createMatcher("run dog");
  // Should match "running" and "dogs"
  expect(matcher("The running dogs")).toBeGreaterThan(0.5);
});

test("Matcher createMatcher should score partial matches lower than full matches", () => {
  const matcher = createMatcher("quick brown fox");
  const fullMatch = matcher("The quick brown fox");
  const partialMatch = matcher("The quick red fox");
  expect(fullMatch).toBeGreaterThan(partialMatch);
});

test("Matcher createMatcher should handle single word queries", () => {
  const matcher = createMatcher("database");
  expect(matcher("Connect to the database")).toBeGreaterThan(0.3);
  expect(matcher("Something unrelated")).toBe(0);
});

test("Matcher createMatcher should handle long documents", () => {
  const matcher = createMatcher("error handling");
  const longDoc = `
        This is a very long document about software development best practices.
        It covers topics like code organization, testing strategies, and error handling.
        Error handling is particularly important for robust applications.
        You should always handle errors gracefully and provide meaningful feedback.
      `;
  expect(matcher(longDoc)).toBeGreaterThan(0.3);
});

test("Matcher scoring behavior should give higher scores to documents with more query terms", () => {
  const matcher = createMatcher("quick brown fox jumps");

  const hasAll = matcher("The quick brown fox jumps over");
  const hasThree = matcher("The quick brown fox");
  const hasTwo = matcher("The quick fox");
  const hasOne = matcher("The fox");

  expect(hasAll).toBeGreaterThan(hasThree);
  expect(hasThree).toBeGreaterThan(hasTwo);
  expect(hasTwo).toBeGreaterThan(hasOne);
});

test("Matcher scoring behavior should give bonus for exact substring matches", () => {
  const matcher = createMatcher("brown fox");

  // Exact substring match
  const exact = matcher("the brown fox jumps");
  // Same words but not as substring
  const separated = matcher("fox brown"); // stemmed terms match but not exact

  expect(exact).toBeGreaterThan(separated);
});

test("Matcher scoring behavior should give bonus for prefix matches", () => {
  const matcher = createMatcher("hello");

  const prefixMatch = matcher("hello world");
  const middleMatch = matcher("say hello world");

  expect(prefixMatch).toBeGreaterThan(middleMatch);
});

test("Matcher scoring behavior should give bonus for consecutive term matches", () => {
  const matcher = createMatcher("database connection");

  // Terms appear consecutively
  const consecutive = matcher("Setup database connection pooling");
  // Terms appear but separated
  const separated = matcher("Database settings and connection info");

  expect(consecutive).toBeGreaterThan(separated);
});

test("Matcher scoring behavior should give higher scores when query terms appear earlier", () => {
  const matcher = createMatcher("error");

  const earlyMatch = matcher("Error occurred in the system");
  const lateMatch = matcher("The system reported an error");

  // Early match should score slightly higher due to position bonus
  expect(earlyMatch).toBeGreaterThanOrEqual(lateMatch);
});

test("Matcher createDetailedMatcher should return detailed match results", () => {
  const matcher = createDetailedMatcher("quick brown fox");
  const result = matcher("The quick brown fox jumps");

  expect(result).toHaveProperty("score");
  expect(result).toHaveProperty("termScore");
  expect(result).toHaveProperty("exactBonus");
  expect(result).toHaveProperty("prefixBonus");
  expect(result).toHaveProperty("consecutiveBonus");
  expect(result).toHaveProperty("positionScore");
  expect(result).toHaveProperty("matchedTerms");
  expect(result).toHaveProperty("totalTerms");
});

test("Matcher createDetailedMatcher should report correct matched term count", () => {
  const matcher = createDetailedMatcher("quick brown fox");

  const fullResult = matcher("The quick brown fox");
  expect(fullResult.matchedTerms).toBe(3);
  expect(fullResult.totalTerms).toBe(3);

  const partialResult = matcher("The quick red fox");
  expect(partialResult.matchedTerms).toBe(2);
  expect(partialResult.totalTerms).toBe(3);
});

test("Matcher createDetailedMatcher should report exact match bonus correctly", () => {
  const matcher = createDetailedMatcher("brown fox");

  const exactResult = matcher("the brown fox jumps");
  expect(exactResult.exactBonus).toBeGreaterThan(0);

  const noExactResult = matcher("fox brown");
  expect(noExactResult.exactBonus).toBe(0);
});

test("Matcher createDetailedMatcher should report prefix bonus correctly", () => {
  const matcher = createDetailedMatcher("hello");

  const prefixResult = matcher("hello world");
  expect(prefixResult.prefixBonus).toBeGreaterThan(0);

  const noPrefixResult = matcher("say hello");
  expect(noPrefixResult.prefixBonus).toBe(0);
});

test("Matcher rankDocuments should rank documents by relevance", () => {
  const documents = [
    "A slow gray elephant walks",
    "The quick brown fox jumps over the lazy dog",
    "Quick foxes are brown",
    "Something completely unrelated",
  ];

  const results = rankDocuments("quick brown fox", documents);

  // Most relevant should be first
  expect(results[0]?.document).toContain("quick brown fox");
  // Least relevant should be last
  expect(results[results.length - 1]?.score).toBe(0);
});

test("Matcher rankDocuments should return scores with documents", () => {
  const documents = ["hello world", "goodbye world"];
  const results = rankDocuments("hello", documents);

  expect(results[0]).toHaveProperty("document");
  expect(results[0]).toHaveProperty("score");
  expect(results[0]?.document).toBe("hello world");
  expect(results[0]?.score).toBeGreaterThan(0);
});

test("Matcher rankDocuments should handle empty document array", () => {
  const results = rankDocuments("test", []);
  expect(results).toEqual([]);
});

test("Matcher rankDocuments should handle empty query", () => {
  const results = rankDocuments("", ["doc1", "doc2"]);
  expect(results.every((r) => r.score === 0)).toBe(true);
});

test("Matcher rankDocuments object-based ranking should rank objects by extracted text", () => {
  interface User {
    id: number;
    name: string;
    bio: string;
  }

  const users: User[] = [
    { id: 1, name: "John Doe", bio: "Software engineer at TechCorp" },
    {
      id: 2,
      name: "Jane Smith",
      bio: "Product manager with engineering background",
    },
    { id: 3, name: "Bob Wilson", bio: "Marketing specialist" },
    { id: 4, name: "Alice Brown", bio: "Senior software developer" },
  ];

  const results = rankDocuments(
    "software engineer",
    { key: "id", text: (u) => `${u.name} ${u.bio}` },
    users,
  );

  // Software engineers should rank first
  expect(results[0]?.key).toBe(1); // John Doe - "Software engineer"
  expect(results[0]?.score).toBeGreaterThan(0);

  // Marketing specialist should rank last
  expect(results[results.length - 1]?.key).toBe(3);
});

test("Matcher rankDocuments object-based ranking should return the specified key in results", () => {
  interface User {
    id: number;
    name: string;
    bio: string;
  }

  const users: User[] = [
    { id: 1, name: "John Doe", bio: "Software engineer at TechCorp" },
    {
      id: 2,
      name: "Jane Smith",
      bio: "Product manager with engineering background",
    },
    { id: 3, name: "Bob Wilson", bio: "Marketing specialist" },
    { id: 4, name: "Alice Brown", bio: "Senior software developer" },
  ];

  const results = rankDocuments(
    "developer",
    { key: "name", text: (u) => u.bio },
    users,
  );

  expect(results[0]).toHaveProperty("key");
  expect(results[0]).toHaveProperty("score");
  expect(results[0]?.key).toBe("Alice Brown"); // "Senior software developer"
});

test("Matcher rankDocuments object-based ranking should handle empty array", () => {
  interface User {
    id: number;
    name: string;
    bio: string;
  }

  const results = rankDocuments(
    "test",
    { key: "id", text: (u: User) => u.name },
    [],
  );
  expect(results).toEqual([]);
});

test("Matcher rankDocuments object-based ranking should work with different key types", () => {
  interface Article {
    slug: string;
    title: string;
    content: string;
  }

  const articles: Article[] = [
    {
      slug: "intro-react",
      title: "Introduction to React",
      content: "Learn React basics",
    },
    {
      slug: "vue-guide",
      title: "Vue.js Guide",
      content: "Getting started with Vue",
    },
  ];

  const results = rankDocuments(
    "react",
    { key: "slug", text: (a) => `${a.title} ${a.content}` },
    articles,
  );

  expect(results[0]?.key).toBe("intro-react");
  expect(typeof results[0]?.key).toBe("string");
});

test("Matcher rankDocuments object-based ranking should accept matcher options", () => {
  interface User {
    id: number;
    name: string;
    bio: string;
  }

  const users: User[] = [
    { id: 1, name: "John Doe", bio: "Software engineer at TechCorp" },
    {
      id: 2,
      name: "Jane Smith",
      bio: "Product manager with engineering background",
    },
    { id: 3, name: "Bob Wilson", bio: "Marketing specialist" },
    { id: 4, name: "Alice Brown", bio: "Senior software developer" },
  ];

  const results = rankDocuments(
    "engineering",
    { key: "id", text: (u) => u.bio },
    users,
    { stem: false }, // Disable stemming
  );

  // With stemming disabled, "engineer" won't match "engineering"
  // The only match would be "engineering background"
  expect(results[0]?.key).toBe(2); // Jane has "engineering background"
});

test("Matcher English language examples common search scenarios should match programming documentation queries", () => {
  const docs = [
    "How to connect to a PostgreSQL database using Node.js",
    "Database connection pooling best practices",
    "Introduction to NoSQL databases",
    "Setting up a web server with Express",
    "Understanding database transactions and ACID properties",
  ];

  const results = rankDocuments("database connection", docs);
  expect(results[0]?.document).toContain("connection");
  expect(results[0]?.score).toBeGreaterThan(0.5);
});

test("Matcher English language examples common search scenarios should match error message searches", () => {
  const docs = [
    "TypeError: Cannot read property 'length' of undefined",
    "Connection timeout after 30 seconds",
    "Error: ENOENT: no such file or directory",
    "Success: Operation completed successfully",
    "Warning: Deprecated API usage detected",
  ];

  const results = rankDocuments("connection timeout error", docs);
  expect(results[0]?.document).toContain("timeout");
});

test("Matcher English language examples common search scenarios should match API documentation searches", () => {
  const docs = [
    "GET /users - Retrieve all users",
    "POST /users - Create a new user",
    "GET /users/:id - Retrieve a specific user by ID",
    "DELETE /users/:id - Delete a user",
    "PUT /products - Update product information",
  ];

  const results = rankDocuments("create user", docs);
  expect(results[0]?.document).toContain("Create");
});

test("Matcher English language examples semantic matching with stemming should match different verb forms", () => {
  const matcher = createMatcher("running");
  expect(matcher("The dog runs quickly")).toBeGreaterThan(0.2);
  // Note: "ran" is irregular and doesn't stem to "run"
  expect(matcher("We ran yesterday")).toBe(0);
  expect(matcher("They were running")).toBeGreaterThan(0.2);
});

test("Matcher English language examples semantic matching with stemming should match singular and plural forms", () => {
  const matcher = createMatcher("dogs");
  expect(matcher("The dog barks")).toBeGreaterThan(0.2);
  expect(matcher("Many dogs were barking")).toBeGreaterThan(0.2);
});

test("Matcher English language examples semantic matching with stemming should match related word forms", () => {
  // "organization" stems to "organ", "organize" stems to "organ"
  const matcher = createMatcher("organization");
  expect(matcher("How to organize your code")).toBeGreaterThan(0.2);
  // "organizational" stems to "organiz" which is different from "organ"
  expect(matcher("Organizational structure")).toBeGreaterThan(0.2);
  expect(matcher("Well-organized projects")).toBeGreaterThan(0.2);
});

test("Matcher English language examples semantic matching with stemming should match technical terms and their variations", () => {
  const matcher = createMatcher("configuration");
  expect(matcher("How to configure the server")).toBeGreaterThan(0.2);
  expect(matcher("Server configurations")).toBeGreaterThan(0.2);
  expect(matcher("Configurable options")).toBeGreaterThan(0.2);
});

test("Matcher English language examples real-world document ranking should rank React hooks documentation first for hooks query", () => {
  const techDocs = [
    "React hooks introduction and useState examples",
    "Understanding React component lifecycle methods",
    "Advanced React patterns: render props and HOCs",
    "Getting started with React Native development",
    "React state management with Redux toolkit",
    "Building forms in React with validation",
    "React performance optimization techniques",
    "Testing React components with Jest and RTL",
  ];

  const results = rankDocuments("react hooks", techDocs);
  expect(results[0]?.document).toContain("hooks");
});

test("Matcher English language examples real-world document ranking should rank state management docs for state query", () => {
  const techDocs = [
    "React hooks introduction and useState examples",
    "Understanding React component lifecycle methods",
    "Advanced React patterns: render props and HOCs",
    "Getting started with React Native development",
    "React state management with Redux toolkit",
    "Building forms in React with validation",
    "React performance optimization techniques",
    "Testing React components with Jest and RTL",
  ];

  const results = rankDocuments("react state management", techDocs);
  expect(results[0]?.document).toContain("state management");
});

test("Matcher English language examples real-world document ranking should rank testing docs for testing query", () => {
  const techDocs = [
    "React hooks introduction and useState examples",
    "Understanding React component lifecycle methods",
    "Advanced React patterns: render props and HOCs",
    "Getting started with React Native development",
    "React state management with Redux toolkit",
    "Building forms in React with validation",
    "React performance optimization techniques",
    "Testing React components with Jest and RTL",
  ];

  const results = rankDocuments("testing react", techDocs);
  expect(results[0]?.document).toContain("Testing");
});

test("Matcher English language examples real-world document ranking should rank performance docs for optimization query", () => {
  const techDocs = [
    "React hooks introduction and useState examples",
    "Understanding React component lifecycle methods",
    "Advanced React patterns: render props and HOCs",
    "Getting started with React Native development",
    "React state management with Redux toolkit",
    "Building forms in React with validation",
    "React performance optimization techniques",
    "Testing React components with Jest and RTL",
  ];

  const results = rankDocuments("performance optimization", techDocs);
  expect(results[0]?.document).toContain("performance");
});

test("Matcher English language examples question-like queries should match password-related queries", () => {
  const faqDocs = [
    "How do I reset my password?",
    "What payment methods are accepted?",
    "How to cancel my subscription",
    "Where can I find my order history?",
    "How do I contact customer support?",
    "What is the return policy?",
    "How to update billing information",
    "Why was my payment declined?",
  ];

  const results = rankDocuments("forgot password", faqDocs);
  expect(results[0]?.document).toContain("password");
});

test("Matcher English language examples question-like queries should match payment-related queries", () => {
  const faqDocs = [
    "How do I reset my password?",
    "What payment methods are accepted?",
    "How to cancel my subscription",
    "Where can I find my order history?",
    "How do I contact customer support?",
    "What is the return policy?",
    "How to update billing information",
    "Why was my payment declined?",
  ];

  const results = rankDocuments("payment problem", faqDocs);
  expect(results[0]?.document).toContain("payment");
});

test("Matcher English language examples question-like queries should match subscription queries", () => {
  const faqDocs = [
    "How do I reset my password?",
    "What payment methods are accepted?",
    "How to cancel my subscription",
    "Where can I find my order history?",
    "How do I contact customer support?",
    "What is the return policy?",
    "How to update billing information",
    "Why was my payment declined?",
  ];

  const results = rankDocuments("cancel subscription", faqDocs);
  expect(results[0]?.document).toContain("cancel");
});

test("Matcher English language examples handling typo-adjacent stemmed forms should match words that stem to the same root", () => {
  const matcher = createMatcher("connecting");
  expect(matcher("Database connections")).toBeGreaterThan(0.3);
  expect(matcher("Connected successfully")).toBeGreaterThan(0.3);
  expect(matcher("Connection established")).toBeGreaterThan(0.3);
});

test("Matcher English language examples multi-word phrase matching should prefer consecutive word matches", () => {
  const matcher = createMatcher("machine learning");

  const exact = matcher("Introduction to machine learning algorithms");
  const separated = matcher("Learning about machine translation");

  expect(exact).toBeGreaterThan(separated);
});

test("Matcher English language examples multi-word phrase matching should handle common programming phrases", () => {
  const docs = [
    "Understanding dependency injection in Spring",
    "Injecting dependencies manually",
    "Spring dependency management",
    "Constructor injection patterns",
  ];

  const results = rankDocuments("dependency injection", docs);
  expect(results[0]?.document).toContain("dependency injection");
});

test("Matcher English language examples stopword handling should ignore stopwords in queries", () => {
  const matcher1 = createMatcher("the quick brown fox");
  const matcher2 = createMatcher("quick brown fox");

  const doc = "A quick brown fox appeared";
  // Both should produce similar scores since "the" is a stopword
  // The difference may be non-zero due to exact match bonus differences
  expect(Math.abs(matcher1(doc) - matcher2(doc))).toBeLessThan(0.2);
});

test("Matcher English language examples stopword handling should still match documents despite stopwords", () => {
  const matcher = createMatcher("how to connect to database");
  expect(matcher("Connecting to the database server")).toBeGreaterThan(0.2);
});

test("Matcher English language examples edge cases should handle queries with only stopwords", () => {
  const matcher = createMatcher("the a an is are");
  expect(matcher("anything")).toBe(0);
});

test("Matcher English language examples edge cases should handle very long queries", () => {
  const longQuery =
    "how to implement a database connection pool with automatic retry and exponential backoff";
  const matcher = createMatcher(longQuery);
  expect(
    matcher("Database connection pooling with retry logic"),
  ).toBeGreaterThan(0.2);
});

test("Matcher English language examples edge cases should handle very short documents", () => {
  const matcher = createMatcher("database connection");
  expect(matcher("db")).toBe(0);
  expect(matcher("database")).toBeGreaterThan(0.2);
});

test("Matcher English language examples edge cases should handle documents with repeated terms", () => {
  const matcher = createMatcher("error");
  expect(matcher("Error error error everywhere")).toBeGreaterThan(0.3);
});

test("Matcher English language examples edge cases should handle special characters in text", () => {
  const matcher = createMatcher("user id");
  expect(matcher("Get user_id from request")).toBeGreaterThan(0);
});

test("Matcher English language examples edge cases should handle camelCase text", () => {
  const matcher = createMatcher("user");
  expect(matcher("getUserById function")).toBeGreaterThan(0);
});

test("Matcher English language examples score boundaries should always return scores between 0 and 1", () => {
  const matcher = createMatcher("test query with many words");
  const docs = [
    "test",
    "test query",
    "test query with many words exactly matching",
    "completely unrelated document",
    "",
    "test test test test test test test test test",
  ];

  for (const doc of docs) {
    const score = matcher(doc);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  }
});

test("Matcher English language examples score boundaries should return 0 for completely non-matching documents", () => {
  const matcher = createMatcher("database connection");
  expect(matcher("The weather is sunny today")).toBe(0);
  expect(matcher("Cooking recipes for beginners")).toBe(0);
});

test("Matcher options should allow disabling stemming", () => {
  const withStem = createMatcher("running", { stem: true });
  const withoutStem = createMatcher("running", { stem: false });

  // "runs" should match with stemming but not without
  expect(withStem("The dog runs")).toBeGreaterThan(0);
  expect(withoutStem("The dog runs")).toBe(0);
});

test("Matcher options should allow keeping stopwords", () => {
  const removeStopwords = createMatcher("the quick", {
    removeStopwords: true,
  });
  const keepStopwords = createMatcher("the quick", {
    removeStopwords: false,
  });

  // With stopwords removed, only "quick" matters
  // With stopwords kept, "the quick" is the query
  const doc = "the quick fox";
  expect(keepStopwords(doc)).toBeGreaterThan(removeStopwords(doc));
});

test("Matcher options should allow customizing BM25 parameters", () => {
  const defaultMatcher = createMatcher("test");
  const customMatcher = createMatcher("test", { k1: 2.0, b: 0.5 });

  // Both should work, possibly with different scores
  expect(defaultMatcher("test document")).toBeGreaterThan(0);
  expect(customMatcher("test document")).toBeGreaterThan(0);
});

test("Matcher options should allow customizing bonus weights", () => {
  const defaultMatcher = createMatcher("hello");
  const noBonusMatcher = createMatcher("hello", {
    exactMatchBonus: 0,
    prefixMatchBonus: 0,
    consecutiveBonus: 0,
    positionWeight: 0,
  });

  // Without bonuses, score should be lower
  const doc = "hello world";
  expect(defaultMatcher(doc)).toBeGreaterThan(noBonusMatcher(doc));
});
