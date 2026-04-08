import { test, expect } from "vitest";
import { createMatcher, rankDocuments } from "./matcher.js";
import { tokenize } from "./tokenizer.js";

/**
 * Generate a realistic document with the specified word count.
 * Uses a mix of common words and technical terms.
 */
function generateDocument(wordCount: number, seed: number = 0): string {
  const commonWords = [
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "need",
    "dare",
    "ought",
    "used",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "up",
    "about",
    "into",
    "over",
    "after",
    "beneath",
    "under",
    "above",
    "and",
    "but",
    "or",
    "as",
    "if",
    "when",
    "than",
    "because",
    "while",
    "although",
    "though",
  ];

  const technicalTerms = [
    "database",
    "server",
    "application",
    "framework",
    "component",
    "module",
    "function",
    "method",
    "class",
    "interface",
    "type",
    "object",
    "array",
    "string",
    "number",
    "boolean",
    "null",
    "undefined",
    "promise",
    "async",
    "await",
    "callback",
    "event",
    "handler",
    "listener",
    "middleware",
    "router",
    "controller",
    "service",
    "repository",
    "model",
    "view",
    "template",
    "render",
    "state",
    "props",
    "context",
    "hook",
    "effect",
    "reducer",
    "action",
    "dispatch",
    "store",
    "selector",
    "mutation",
    "query",
    "schema",
    "migration",
    "seed",
    "fixture",
    "test",
    "spec",
    "mock",
    "stub",
    "spy",
    "assertion",
    "expect",
    "describe",
    "it",
    "configuration",
    "environment",
    "variable",
    "secret",
    "token",
    "key",
    "authentication",
    "authorization",
    "permission",
    "role",
    "user",
    "session",
    "cookie",
    "header",
    "body",
    "request",
    "response",
    "status",
    "error",
    "exception",
    "logging",
    "monitoring",
    "metrics",
    "tracing",
    "debugging",
    "performance",
    "optimization",
    "caching",
    "indexing",
    "sharding",
    "replication",
    "clustering",
    "scaling",
    "deployment",
    "container",
    "orchestration",
    "kubernetes",
    "docker",
    "microservice",
    "api",
    "rest",
    "graphql",
    "websocket",
    "protocol",
    "encryption",
    "hashing",
    "signing",
  ];

  const verbs = [
    "implement",
    "create",
    "build",
    "develop",
    "design",
    "configure",
    "deploy",
    "test",
    "debug",
    "optimize",
    "refactor",
    "migrate",
    "update",
    "upgrade",
    "install",
    "uninstall",
    "enable",
    "disable",
    "start",
    "stop",
    "restart",
    "initialize",
    "terminate",
    "execute",
    "process",
    "handle",
    "manage",
    "monitor",
    "log",
    "track",
    "analyze",
    "validate",
    "verify",
    "authenticate",
    "authorize",
    "encrypt",
    "decrypt",
    "compress",
    "decompress",
    "serialize",
    "deserialize",
    "parse",
    "format",
    "transform",
    "convert",
    "map",
    "filter",
    "reduce",
    "sort",
    "search",
    "find",
    "get",
    "set",
    "add",
    "remove",
    "delete",
    "insert",
    "update",
  ];

  const adjectives = [
    "new",
    "old",
    "fast",
    "slow",
    "large",
    "small",
    "high",
    "low",
    "good",
    "bad",
    "best",
    "worst",
    "first",
    "last",
    "next",
    "previous",
    "current",
    "default",
    "custom",
    "static",
    "dynamic",
    "public",
    "private",
    "internal",
    "external",
    "local",
    "remote",
    "global",
    "specific",
    "general",
    "common",
    "rare",
    "unique",
    "standard",
    "advanced",
    "basic",
    "simple",
    "complex",
    "easy",
    "difficult",
    "important",
    "critical",
    "optional",
    "required",
    "recommended",
    "deprecated",
    "experimental",
  ];

  const allWords = [...technicalTerms, ...verbs, ...adjectives];
  const words: string[] = [];

  // Use a simple seeded random for reproducibility
  let random = seed;
  const nextRandom = () => {
    random = (random * 1103515245 + 12345) & 0x7fffffff;
    return random / 0x7fffffff;
  };

  for (let i = 0; i < wordCount; i++) {
    // Mix common words with technical terms (70% common, 30% technical)
    if (nextRandom() < 0.7) {
      words.push(commonWords[Math.floor(nextRandom() * commonWords.length)]!);
    } else {
      words.push(allWords[Math.floor(nextRandom() * allWords.length)]!);
    }
  }

  // Add some sentence structure
  let result = "";
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (i === 0 || result.endsWith(". ")) {
      result += word.charAt(0).toUpperCase() + word.slice(1);
    } else {
      result += word;
    }

    // Add punctuation occasionally
    if (i > 0 && i % 15 === 0) {
      result += ".";
    }
    if (i < words.length - 1) {
      result += " ";
    }
  }

  return result;
}

/**
 * Generate a document with specific keywords embedded.
 */
function generateDocumentWithKeywords(
  wordCount: number,
  keywords: string[],
  keywordDensity: number = 0.05,
  seed: number = 0,
): string {
  const baseDoc = generateDocument(wordCount, seed);
  const words = baseDoc.split(/\s+/);

  // Sprinkle keywords throughout the document
  const keywordPositions = new Set<number>();
  let random = seed + 1000;
  const nextRandom = () => {
    random = (random * 1103515245 + 12345) & 0x7fffffff;
    return random / 0x7fffffff;
  };

  const numKeywords = Math.floor(wordCount * keywordDensity);
  for (let i = 0; i < numKeywords; i++) {
    const pos = Math.floor(nextRandom() * words.length);
    if (!keywordPositions.has(pos)) {
      keywordPositions.add(pos);
      words[pos] = keywords[Math.floor(nextRandom() * keywords.length)]!;
    }
  }

  return words.join(" ");
}

test("Performance and Large Document Tests large document handling should handle a 1000-word document", () => {
  const doc = generateDocument(1000);
  const matcher = createMatcher("database configuration optimization");

  const score = matcher(doc);
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(1);
});

test("Performance and Large Document Tests large document handling should correctly rank 100 documents of ~1000 words each", () => {
  // Generate 100 documents
  const documents: string[] = [];
  for (let i = 0; i < 100; i++) {
    documents.push(generateDocument(1000, i));
  }

  // Add specific documents with known keywords
  const targetDoc = generateDocumentWithKeywords(
    1000,
    ["database", "connection", "pooling", "optimization"],
    0.1,
    999,
  );
  documents[50] = targetDoc;

  const results = rankDocuments("database connection pooling", documents);

  // The document with embedded keywords should rank high
  expect(results.length).toBe(100);
  expect(results[0]?.score).toBeGreaterThan(0);

  // Find where our target document ranked
  const targetRank = results.findIndex((r) => r.document === targetDoc);
  expect(targetRank).toBeLessThan(10); // Should be in top 10
});

test("Performance and Large Document Tests large document handling should maintain accuracy with long documents", () => {
  // Create documents with varying relevance using controlled content
  const highRelevance = "software engineering ".repeat(100) + generateDocument(800, 1);

  const mediumRelevance = "software engineering ".repeat(30) + generateDocument(940, 2);

  const lowRelevance = generateDocument(1000, 3);

  const results = rankDocuments("software engineering", [
    lowRelevance,
    highRelevance,
    mediumRelevance,
  ]);

  // High and medium relevance should score higher than low
  const highScore = results.find((r) => r.document === highRelevance)?.score ?? 0;
  const mediumScore = results.find((r) => r.document === mediumRelevance)?.score ?? 0;
  const lowScore = results.find((r) => r.document === lowRelevance)?.score ?? 0;

  // Documents with keywords should score higher than random
  expect(highScore).toBeGreaterThan(lowScore);
  expect(mediumScore).toBeGreaterThan(lowScore);
  // Higher keyword density should score better
  expect(highScore).toBeGreaterThan(mediumScore);
});

test("Performance and Large Document Tests performance benchmarks should tokenize a 1000-word document quickly", () => {
  const doc = generateDocument(1000);

  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    tokenize(doc);
  }
  const elapsed = performance.now() - start;

  // Should tokenize 100 documents in under 500ms
  expect(elapsed).toBeLessThan(500);

  // Log for visibility
  console.log(`Tokenized 1000-word doc 100 times in ${elapsed.toFixed(2)}ms`);
});

test("Performance and Large Document Tests performance benchmarks should score a 1000-word document quickly", () => {
  const doc = generateDocument(1000);
  const matcher = createMatcher("database optimization performance");

  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    matcher(doc);
  }
  const elapsed = performance.now() - start;

  // Should score 100 documents in under 500ms
  expect(elapsed).toBeLessThan(500);

  console.log(`Scored 1000-word doc 100 times in ${elapsed.toFixed(2)}ms`);
});

test("Performance and Large Document Tests performance benchmarks should rank 100 x 1000-word documents quickly", () => {
  const documents: string[] = [];
  for (let i = 0; i < 100; i++) {
    documents.push(generateDocument(1000, i));
  }

  const start = performance.now();
  const results = rankDocuments("database connection pooling optimization", documents);
  const elapsed = performance.now() - start;

  expect(results.length).toBe(100);
  // Should rank 100 documents in under 1000ms
  expect(elapsed).toBeLessThan(1000);

  console.log(`Ranked 100 x 1000-word docs in ${elapsed.toFixed(2)}ms`);
});

test("Performance and Large Document Tests performance benchmarks should handle repeated queries efficiently (query reuse)", () => {
  const documents: string[] = [];
  for (let i = 0; i < 50; i++) {
    documents.push(generateDocument(500, i));
  }

  // Pre-create the matcher (simulating query preparation)
  const matcher = createMatcher("software development testing");

  const start = performance.now();
  for (let i = 0; i < 10; i++) {
    documents.map((doc) => matcher(doc));
  }
  const elapsed = performance.now() - start;

  // 10 passes over 50 docs = 500 scoring operations
  // Should complete in under 1000ms
  expect(elapsed).toBeLessThan(1000);

  console.log(`500 scoring operations (50 docs x 10 passes) in ${elapsed.toFixed(2)}ms`);
});

test("Performance and Large Document Tests object-based ranking with large datasets should rank 100 article objects efficiently", () => {
  interface Article {
    id: number;
    title: string;
    content: string;
    author: string;
  }

  const articles: Article[] = [];
  for (let i = 0; i < 100; i++) {
    articles.push({
      id: i,
      title: `Article ${i}: ${generateDocument(10, i)}`,
      content: generateDocument(1000, i + 1000),
      author: `Author ${i % 10}`,
    });
  }

  // Add a highly relevant article
  articles[42] = {
    id: 42,
    title: "Complete Guide to Database Optimization",
    content: generateDocumentWithKeywords(
      1000,
      ["database", "optimization", "performance", "indexing", "query"],
      0.1,
      42,
    ),
    author: "Expert Author",
  };

  const start = performance.now();
  const results = rankDocuments(
    "database optimization",
    { key: "id", text: (a) => `${a.title} ${a.content}` },
    articles,
  );
  const elapsed = performance.now() - start;

  expect(results.length).toBe(100);
  expect(results[0]?.key).toBe(42); // Our relevant article should be first
  expect(elapsed).toBeLessThan(1000);

  console.log(`Ranked 100 article objects in ${elapsed.toFixed(2)}ms`);
});

test("Performance and Large Document Tests edge cases with long documents should handle documents with repetitive content", () => {
  // Document with the same word repeated many times
  const repetitive = "database ".repeat(500) + "optimization ".repeat(500);
  const matcher = createMatcher("database optimization");

  const score = matcher(repetitive);
  expect(score).toBeGreaterThan(0);
  expect(score).toBeLessThanOrEqual(1);
});

test("Performance and Large Document Tests edge cases with long documents should handle very long queries against long documents", () => {
  const doc = generateDocument(1000);
  const longQuery =
    "database connection pooling optimization performance scaling caching indexing replication clustering deployment";

  const matcher = createMatcher(longQuery);
  const score = matcher(doc);

  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(1);
});

test("Performance and Large Document Tests edge cases with long documents should handle documents with special characters", () => {
  const docWithSpecials =
    generateDocument(500) + " !@#$%^&*()_+-=[]{}|;':\",./<>? " + generateDocument(500, 1);

  const matcher = createMatcher("database configuration");
  const score = matcher(docWithSpecials);

  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(1);
});

test("Performance and Large Document Tests edge cases with long documents should normalize scores appropriately for varying document lengths", () => {
  const shortDoc = "Database configuration and optimization guide";
  const mediumDoc = generateDocumentWithKeywords(
    200,
    ["database", "configuration", "optimization"],
    0.1,
    1,
  );
  const longDoc = generateDocumentWithKeywords(
    1000,
    ["database", "configuration", "optimization"],
    0.1,
    2,
  );

  const matcher = createMatcher("database configuration optimization");

  const shortScore = matcher(shortDoc);
  const mediumScore = matcher(mediumDoc);
  const longScore = matcher(longDoc);

  // All scores should be in valid range
  expect(shortScore).toBeGreaterThan(0);
  expect(mediumScore).toBeGreaterThan(0);
  expect(longScore).toBeGreaterThan(0);

  expect(shortScore).toBeLessThanOrEqual(1);
  expect(mediumScore).toBeLessThanOrEqual(1);
  expect(longScore).toBeLessThanOrEqual(1);

  // All documents with relevant content should have reasonable scores
  // BM25 naturally adjusts for document length, but longer docs with
  // more term occurrences may score slightly higher
  expect(shortScore).toBeGreaterThan(0.5); // Short exact phrase should score well
  expect(mediumScore).toBeGreaterThan(0.3);
  expect(longScore).toBeGreaterThan(0.3);
});
