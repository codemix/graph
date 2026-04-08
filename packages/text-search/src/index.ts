/**
 * @codemix/text-search
 *
 * A fast, accurate text search library with BM25-inspired scoring
 * and English stemming support.
 *
 * @example
 * ```typescript
 * import { createMatcher, rankDocuments } from "@codemix/text-search";
 *
 * // Create a matcher function for a query
 * const match = createMatcher("quick brown fox");
 *
 * // Score individual documents
 * match("The quick brown fox jumps over the lazy dog"); // ~0.85
 * match("A slow gray elephant"); // ~0.0
 *
 * // Or rank multiple documents at once
 * const results = rankDocuments("database connection", [
 *   "How to connect to a database",
 *   "Database connection pooling best practices",
 *   "Unrelated article about cooking",
 * ]);
 * // Returns sorted by relevance
 * ```
 */

// Core matcher functionality
export {
  createMatcher,
  createDetailedMatcher,
  rankDocuments,
  type MatcherFn,
  type MatcherOptions,
  type MatchResult,
  type RankConfig,
  type RankResult,
} from "./matcher.js";

// Tokenization utilities
export {
  tokenize,
  extractTerms,
  buildTermFrequency,
  buildPositionMap,
  STOPWORDS,
  type Token,
  type TokenizeOptions,
} from "./tokenizer.js";

// Stemmer
export { stem } from "./stemmer.js";
