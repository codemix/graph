import { test, expect } from "vitest";
import {
  tokenize,
  extractTerms,
  buildTermFrequency,
  buildPositionMap,
  STOPWORDS,
} from "./tokenizer.js";

test("Tokenizer tokenize should tokenize a simple sentence", () => {
  const tokens = tokenize("The quick brown fox");
  expect(tokens.map((t) => t.original)).toEqual(["quick", "brown", "fox"]);
});

test("Tokenizer tokenize should stem words by default", () => {
  const tokens = tokenize("running dogs are jumping");
  expect(tokens.map((t) => t.stemmed)).toEqual(["run", "dog", "jump"]);
});

test("Tokenizer tokenize should preserve original words alongside stems", () => {
  const tokens = tokenize("running dogs");
  expect(tokens[0]).toEqual({
    original: "running",
    stemmed: "run",
    position: 0,
  });
  expect(tokens[1]).toEqual({
    original: "dogs",
    stemmed: "dog",
    position: 1,
  });
});

test("Tokenizer tokenize should remove stopwords by default", () => {
  const tokens = tokenize("The cat is in the hat");
  expect(tokens.map((t) => t.original)).toEqual(["cat", "hat"]);
});

test("Tokenizer tokenize should preserve stopwords when configured", () => {
  const tokens = tokenize("The cat is in the hat", {
    removeStopwords: false,
  });
  expect(tokens.map((t) => t.original)).toEqual(["the", "cat", "is", "in", "the", "hat"]);
});

test("Tokenizer tokenize should disable stemming when configured", () => {
  const tokens = tokenize("running dogs", { stem: false });
  expect(tokens.map((t) => t.stemmed)).toEqual(["running", "dogs"]);
});

test("Tokenizer tokenize should filter by minimum length", () => {
  const tokens = tokenize("I am a programmer", { minLength: 3 });
  expect(tokens.map((t) => t.original)).toEqual(["programmer"]);
});

test("Tokenizer tokenize should handle punctuation", () => {
  // "are" is a stopword, but "you" is not
  const tokens = tokenize("Hello, world! How are you?");
  expect(tokens.map((t) => t.original)).toEqual(["hello", "world", "how", "you"]);
});

test("Tokenizer tokenize should handle mixed case", () => {
  const tokens = tokenize("ThE QuIcK BrOwN FoX");
  expect(tokens.map((t) => t.original)).toEqual(["quick", "brown", "fox"]);
});

test("Tokenizer tokenize should handle numbers", () => {
  const tokens = tokenize("test123 abc456");
  expect(tokens.map((t) => t.original)).toEqual(["test123", "abc456"]);
});

test("Tokenizer tokenize should track positions correctly with stopwords removed", () => {
  const tokens = tokenize("The quick brown fox");
  // Positions are based on original word positions (before stopword removal)
  expect(tokens[0]?.position).toBe(1); // "quick" is at position 1
  expect(tokens[1]?.position).toBe(2); // "brown" is at position 2
  expect(tokens[2]?.position).toBe(3); // "fox" is at position 3
});

test("Tokenizer tokenize should handle empty string", () => {
  const tokens = tokenize("");
  expect(tokens).toEqual([]);
});

test("Tokenizer tokenize should handle string with only stopwords", () => {
  const tokens = tokenize("the a an is are");
  expect(tokens).toEqual([]);
});

test("Tokenizer tokenize should handle string with only punctuation", () => {
  const tokens = tokenize("!@#$%^&*()");
  expect(tokens).toEqual([]);
});

test("Tokenizer tokenize should handle multiple spaces", () => {
  const tokens = tokenize("hello    world");
  expect(tokens.map((t) => t.original)).toEqual(["hello", "world"]);
});

test("Tokenizer tokenize should handle newlines and tabs", () => {
  const tokens = tokenize("hello\nworld\tthere");
  expect(tokens.map((t) => t.original)).toEqual(["hello", "world"]);
});

test("Tokenizer extractTerms should return just the stemmed terms", () => {
  const terms = extractTerms("running dogs are jumping");
  expect(terms).toEqual(["run", "dog", "jump"]);
});

test("Tokenizer extractTerms should respect options", () => {
  const terms = extractTerms("running dogs", { stem: false });
  expect(terms).toEqual(["running", "dogs"]);
});

test("Tokenizer buildTermFrequency should count term frequencies", () => {
  const tokens = tokenize("dog dog cat dog bird cat", {
    removeStopwords: false,
  });
  const freq = buildTermFrequency(tokens);
  expect(freq.get("dog")).toBe(3);
  expect(freq.get("cat")).toBe(2);
  expect(freq.get("bird")).toBe(1);
});

test("Tokenizer buildTermFrequency should count stemmed terms", () => {
  const tokens = tokenize("running runs run", { removeStopwords: false });
  const freq = buildTermFrequency(tokens);
  expect(freq.get("run")).toBe(3);
});

test("Tokenizer buildTermFrequency should handle empty input", () => {
  const freq = buildTermFrequency([]);
  expect(freq.size).toBe(0);
});

test("Tokenizer buildPositionMap should track all positions for each term", () => {
  const tokens = tokenize("dog cat dog bird dog", {
    removeStopwords: false,
  });
  const positions = buildPositionMap(tokens);
  expect(positions.get("dog")).toEqual([0, 2, 4]);
  expect(positions.get("cat")).toEqual([1]);
  expect(positions.get("bird")).toEqual([3]);
});

test("Tokenizer buildPositionMap should track positions with stemming", () => {
  // Note: "ran" is irregular and stems to "ran", not "run"
  const tokens = tokenize("running walks runs", { removeStopwords: false });
  const positions = buildPositionMap(tokens);
  // "running" and "runs" stem to "run", "walks" stems to "walk"
  expect(positions.get("run")).toEqual([0, 2]);
  expect(positions.get("walk")).toEqual([1]);
});

test("Tokenizer buildPositionMap should handle empty input", () => {
  const positions = buildPositionMap([]);
  expect(positions.size).toBe(0);
});

test("Tokenizer STOPWORDS should contain common English stopwords", () => {
  expect(STOPWORDS.has("the")).toBe(true);
  expect(STOPWORDS.has("a")).toBe(true);
  expect(STOPWORDS.has("an")).toBe(true);
  expect(STOPWORDS.has("and")).toBe(true);
  expect(STOPWORDS.has("or")).toBe(true);
  expect(STOPWORDS.has("is")).toBe(true);
  expect(STOPWORDS.has("are")).toBe(true);
  expect(STOPWORDS.has("was")).toBe(true);
  expect(STOPWORDS.has("to")).toBe(true);
  expect(STOPWORDS.has("of")).toBe(true);
  expect(STOPWORDS.has("in")).toBe(true);
  expect(STOPWORDS.has("for")).toBe(true);
  expect(STOPWORDS.has("with")).toBe(true);
});

test("Tokenizer STOPWORDS should not contain content words", () => {
  expect(STOPWORDS.has("dog")).toBe(false);
  expect(STOPWORDS.has("run")).toBe(false);
  expect(STOPWORDS.has("quick")).toBe(false);
  expect(STOPWORDS.has("database")).toBe(false);
});

test("Tokenizer real-world text processing should tokenize a technical sentence", () => {
  const tokens = tokenize("The database connection is experiencing timeout errors");
  expect(tokens.map((t) => t.stemmed)).toEqual([
    "databas",
    "connect",
    "experienc",
    "timeout",
    "error",
  ]);
});

test("Tokenizer real-world text processing should tokenize a programming description", () => {
  const tokens = tokenize("Implementing a caching layer for improved performance");
  expect(tokens.map((t) => t.stemmed)).toEqual(["implement", "cach", "layer", "improv", "perform"]);
});

test("Tokenizer real-world text processing should handle code-like text", () => {
  const tokens = tokenize("getUserById returns a User object");
  expect(tokens.map((t) => t.original)).toEqual(["getuserbyid", "returns", "user", "object"]);
});

test("Tokenizer real-world text processing should handle mixed content", () => {
  const tokens = tokenize("Error 404: Page not found at /users/123");
  expect(tokens.map((t) => t.original)).toEqual(["error", "404", "page", "found", "users", "123"]);
});
