import { stem } from "./stemmer.js";

/**
 * Common English stopwords that are typically filtered out in search.
 * These words appear frequently but carry little semantic meaning.
 */
export const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "if",
  "in",
  "into",
  "is",
  "it",
  "no",
  "not",
  "of",
  "on",
  "or",
  "such",
  "that",
  "the",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "was",
  "will",
  "with",
]);

/**
 * Options for tokenization.
 */
export interface TokenizeOptions {
  /**
   * Whether to apply stemming to tokens.
   * @default true
   */
  stem?: boolean;

  /**
   * Whether to remove stopwords.
   * @default true
   */
  removeStopwords?: boolean;

  /**
   * Minimum token length to include.
   * @default 1
   */
  minLength?: number;
}

/**
 * A token with its position and metadata.
 */
export interface Token {
  /** The original word before processing */
  original: string;
  /** The processed/stemmed form */
  stemmed: string;
  /** Position in the original text (word index) */
  position: number;
}

/**
 * Tokenize a string into words.
 *
 * @param text - The text to tokenize
 * @param options - Tokenization options
 * @returns Array of tokens
 *
 * @example
 * tokenize("The quick brown fox") // ["quick", "brown", "fox"]
 * tokenize("running dogs", { stem: true }) // ["run", "dog"]
 */
export function tokenize(text: string, options: TokenizeOptions = {}): Token[] {
  const {
    stem: applyStem = true,
    removeStopwords = true,
    minLength = 1,
  } = options;

  // Convert to lowercase and extract words
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= minLength);

  const tokens: Token[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;

    // Skip stopwords if configured
    if (removeStopwords && STOPWORDS.has(word)) {
      continue;
    }

    // Skip very short words
    if (word.length < minLength) {
      continue;
    }

    tokens.push({
      original: word,
      stemmed: applyStem ? stem(word) : word,
      position: i,
    });
  }

  return tokens;
}

/**
 * Extract just the stemmed terms from text.
 * This is a convenience function for simple use cases.
 *
 * @param text - The text to tokenize
 * @param options - Tokenization options
 * @returns Array of stemmed term strings
 */
export function extractTerms(
  text: string,
  options: TokenizeOptions = {},
): string[] {
  return tokenize(text, options).map((t) => t.stemmed);
}

/**
 * Build a term frequency map from tokens.
 *
 * @param tokens - Array of tokens
 * @returns Map of stemmed term to frequency count
 */
export function buildTermFrequency(tokens: Token[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token.stemmed, (freq.get(token.stemmed) ?? 0) + 1);
  }
  return freq;
}

/**
 * Build a position map for tokens.
 *
 * @param tokens - Array of tokens
 * @returns Map of stemmed term to array of positions
 */
export function buildPositionMap(tokens: Token[]): Map<string, number[]> {
  const positions = new Map<string, number[]>();
  for (const token of tokens) {
    const existing = positions.get(token.stemmed);
    if (existing) {
      existing.push(token.position);
    } else {
      positions.set(token.stemmed, [token.position]);
    }
  }
  return positions;
}
