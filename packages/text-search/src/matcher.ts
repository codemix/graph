import {
  tokenize,
  buildTermFrequency,
  buildPositionMap,
  type Token,
  type TokenizeOptions,
} from "./tokenizer.js";

/**
 * Options for creating a matcher.
 */
export interface MatcherOptions extends TokenizeOptions {
  /**
   * BM25 k1 parameter: controls term frequency saturation.
   * Higher values give more weight to term frequency.
   * @default 1.2
   */
  k1?: number;

  /**
   * BM25 b parameter: controls document length normalization.
   * 0 = no normalization, 1 = full normalization.
   * @default 0.75
   */
  b?: number;

  /**
   * Bonus multiplier for exact substring matches.
   * @default 0.15
   */
  exactMatchBonus?: number;

  /**
   * Bonus multiplier for prefix matches.
   * @default 0.1
   */
  prefixMatchBonus?: number;

  /**
   * Bonus for consecutive term matches (phrase-like matches).
   * @default 0.1
   */
  consecutiveBonus?: number;

  /**
   * Weight for position-based scoring (terms at start score higher).
   * @default 0.05
   */
  positionWeight?: number;
}

/**
 * A function that scores a document against the prepared query.
 * Returns a score from 0 (no match) to 1 (perfect match).
 */
export type MatcherFn = (text: string) => number;

/**
 * Result of a match operation with detailed scoring breakdown.
 */
export interface MatchResult {
  /** Overall score from 0 to 1 */
  score: number;
  /** BM25-style term matching score (normalized) */
  termScore: number;
  /** Bonus for exact substring match */
  exactBonus: number;
  /** Bonus for prefix match */
  prefixBonus: number;
  /** Bonus for consecutive term matches */
  consecutiveBonus: number;
  /** Position-based score */
  positionScore: number;
  /** Number of query terms that matched */
  matchedTerms: number;
  /** Total number of query terms */
  totalTerms: number;
}

/**
 * Internal state for a prepared query.
 */
interface PreparedQuery {
  /** Original query string (lowercase) */
  original: string;
  /** Tokenized and stemmed query terms */
  tokens: Token[];
  /** Set of unique stemmed terms */
  termSet: Set<string>;
  /** Options used for matching */
  options: Required<MatcherOptions>;
}

/**
 * Default average document length for BM25 normalization.
 * This is used when we don't have corpus statistics.
 */
const DEFAULT_AVG_DOC_LENGTH = 50;

/**
 * Prepare a query for matching.
 */
function prepareQuery(query: string, options: MatcherOptions): PreparedQuery {
  const opts: Required<MatcherOptions> = {
    stem: options.stem ?? true,
    removeStopwords: options.removeStopwords ?? true,
    minLength: options.minLength ?? 1,
    k1: options.k1 ?? 1.2,
    b: options.b ?? 0.75,
    exactMatchBonus: options.exactMatchBonus ?? 0.15,
    prefixMatchBonus: options.prefixMatchBonus ?? 0.1,
    consecutiveBonus: options.consecutiveBonus ?? 0.1,
    positionWeight: options.positionWeight ?? 0.05,
  };

  const tokens = tokenize(query, opts);
  const termSet = new Set(tokens.map((t) => t.stemmed));

  return {
    original: query.toLowerCase(),
    tokens,
    termSet,
    options: opts,
  };
}

/**
 * Calculate BM25-style score for term matching.
 *
 * For single-document matching without corpus statistics,
 * we use a simplified BM25 formula that focuses on:
 * - Term frequency in the document
 * - Document length normalization
 * - Query term coverage
 */
function calculateTermScore(
  query: PreparedQuery,
  docTokens: Token[],
  docTermFreq: Map<string, number>,
): number {
  const { k1, b } = query.options;
  const docLength = docTokens.length;

  if (query.termSet.size === 0 || docLength === 0) {
    return 0;
  }

  let totalScore = 0;
  let matchedTerms = 0;

  for (const queryTerm of query.termSet) {
    const termFreq = docTermFreq.get(queryTerm) ?? 0;

    if (termFreq > 0) {
      matchedTerms++;

      // BM25-style term frequency saturation
      // This prevents very high TF from dominating
      const tfSaturated =
        (termFreq * (k1 + 1)) /
        (termFreq + k1 * (1 - b + b * (docLength / DEFAULT_AVG_DOC_LENGTH)));

      // We don't have IDF (no corpus), so we use a flat weight
      // and rely on term coverage for scoring
      totalScore += tfSaturated;
    }
  }

  // Normalize by number of query terms
  // This gives us a score roughly in [0, 1] range
  const normalizedScore = totalScore / query.termSet.size;

  // Apply a coverage bonus: more matched terms = higher score
  const coverage = matchedTerms / query.termSet.size;

  // Combine normalized BM25 score with coverage
  // Coverage is important: matching 3/3 terms should score higher than 1/3
  // Scale to max 0.6 to leave room for bonuses
  const baseScore = normalizedScore * (0.5 + 0.5 * coverage);
  return Math.min(0.6, baseScore * 0.6);
}

/**
 * Calculate bonus for consecutive term matches (phrase-like matching).
 */
function calculateConsecutiveBonus(
  query: PreparedQuery,
  docPositions: Map<string, number[]>,
): number {
  if (query.tokens.length < 2) {
    return 0;
  }

  let consecutiveMatches = 0;
  const possibleConsecutive = query.tokens.length - 1;

  for (let i = 0; i < query.tokens.length - 1; i++) {
    const currentTerm = query.tokens[i]!.stemmed;
    const nextTerm = query.tokens[i + 1]!.stemmed;

    const currentPositions = docPositions.get(currentTerm);
    const nextPositions = docPositions.get(nextTerm);

    if (currentPositions && nextPositions) {
      // Check if any position of current term is followed by next term
      for (const pos of currentPositions) {
        if (nextPositions.includes(pos + 1)) {
          consecutiveMatches++;
          break;
        }
      }
    }
  }

  return possibleConsecutive > 0 ? consecutiveMatches / possibleConsecutive : 0;
}

/**
 * Calculate position-based score (terms at start of doc score higher).
 */
function calculatePositionScore(
  query: PreparedQuery,
  docPositions: Map<string, number[]>,
  docLength: number,
): number {
  if (query.termSet.size === 0 || docLength === 0) {
    return 0;
  }

  let positionScore = 0;
  let matchedTerms = 0;

  for (const term of query.termSet) {
    const positions = docPositions.get(term);
    if (positions && positions.length > 0) {
      matchedTerms++;
      // Use the earliest position for this term
      const earliestPos = Math.min(...positions);
      // Score based on how early in the document (1 = at start, 0 = at end)
      positionScore += 1 - earliestPos / docLength;
    }
  }

  return matchedTerms > 0 ? positionScore / matchedTerms : 0;
}

/**
 * Create a matcher function for a given query string.
 *
 * The matcher uses a hybrid scoring approach combining:
 * - BM25-inspired term frequency scoring
 * - Exact substring matching bonus
 * - Prefix matching bonus
 * - Consecutive term (phrase) matching bonus
 * - Position-based scoring (early matches score higher)
 *
 * @param query - The search query string
 * @param options - Matcher configuration options
 * @returns A function that scores documents against the query (0 to 1)
 *
 * @example
 * const match = createMatcher("quick brown fox");
 * match("The quick brown fox jumps"); // ~0.85
 * match("A slow gray elephant"); // ~0.0
 * match("quick"); // ~0.3
 */
export function createMatcher(
  query: string,
  options: MatcherOptions = {},
): MatcherFn {
  const prepared = prepareQuery(query, options);
  const queryLower = query.toLowerCase().trim();

  // If query is empty, return a function that always returns 0
  if (queryLower.length === 0 || prepared.termSet.size === 0) {
    return () => 0;
  }

  return (text: string): number => {
    const result = matchWithDetails(prepared, queryLower, text);
    return result.score;
  };
}

/**
 * Create a matcher that returns detailed match results.
 *
 * @param query - The search query string
 * @param options - Matcher configuration options
 * @returns A function that returns detailed match results
 */
export function createDetailedMatcher(
  query: string,
  options: MatcherOptions = {},
): (text: string) => MatchResult {
  const prepared = prepareQuery(query, options);
  const queryLower = query.toLowerCase().trim();

  // If query is empty, return a function that always returns empty result
  if (queryLower.length === 0 || prepared.termSet.size === 0) {
    return () => ({
      score: 0,
      termScore: 0,
      exactBonus: 0,
      prefixBonus: 0,
      consecutiveBonus: 0,
      positionScore: 0,
      matchedTerms: 0,
      totalTerms: 0,
    });
  }

  return (text: string): MatchResult => {
    return matchWithDetails(prepared, queryLower, text);
  };
}

/**
 * Internal function to perform matching with full details.
 */
function matchWithDetails(
  prepared: PreparedQuery,
  queryLower: string,
  text: string,
): MatchResult {
  const textLower = text.toLowerCase();
  const opts = prepared.options;

  // Tokenize and analyze the document
  const docTokens = tokenize(text, opts);
  const docTermFreq = buildTermFrequency(docTokens);
  const docPositions = buildPositionMap(docTokens);

  // Calculate component scores
  const termScore = calculateTermScore(prepared, docTokens, docTermFreq);

  // Exact match bonus: query appears as substring
  const hasExactMatch = textLower.includes(queryLower);
  const exactBonus = hasExactMatch ? opts.exactMatchBonus : 0;

  // Prefix match bonus: document starts with query
  const hasPrefixMatch = textLower.startsWith(queryLower);
  const prefixBonus = hasPrefixMatch ? opts.prefixMatchBonus : 0;

  // Consecutive terms bonus
  const consecutiveRatio = calculateConsecutiveBonus(prepared, docPositions);
  const consecutiveBonus = consecutiveRatio * opts.consecutiveBonus;

  // Position-based scoring
  const positionRatio = calculatePositionScore(
    prepared,
    docPositions,
    docTokens.length,
  );
  const positionScore = positionRatio * opts.positionWeight;

  // Count matched terms
  let matchedTerms = 0;
  for (const term of prepared.termSet) {
    if (docTermFreq.has(term)) {
      matchedTerms++;
    }
  }

  // Combine all scores
  // Base score is the term score, bonuses are added on top
  const rawScore =
    termScore + exactBonus + prefixBonus + consecutiveBonus + positionScore;

  // Clamp to [0, 1] range
  const score = Math.min(1, Math.max(0, rawScore));

  return {
    score,
    termScore,
    exactBonus,
    prefixBonus,
    consecutiveBonus,
    positionScore,
    matchedTerms,
    totalTerms: prepared.termSet.size,
  };
}

/**
 * Configuration for ranking objects by extracting text and returning a key.
 */
export interface RankConfig<T, K extends keyof T> {
  /** The key to extract from each document for the result */
  key: K;
  /** Function to extract searchable text from a document */
  text: (doc: T) => string;
}

/**
 * Result of ranking objects.
 */
export interface RankResult<T, K extends keyof T> {
  /** The key value from the matched document */
  key: T[K];
  /** The match score from 0 to 1 */
  score: number;
}

/**
 * Convenience function to score multiple documents against a query.
 *
 * @param query - The search query
 * @param documents - Array of string documents to score
 * @param options - Matcher options
 * @returns Array of {document, score} sorted by score descending
 */
export function rankDocuments<T extends string>(
  query: string,
  documents: T[],
  options?: MatcherOptions,
): Array<{ document: T; score: number }>;

/**
 * Score multiple objects against a query, extracting text via a function.
 *
 * @param query - The search query
 * @param config - Configuration specifying key to return and text extractor
 * @param documents - Array of objects to score
 * @param options - Matcher options
 * @returns Array of {key, score} sorted by score descending
 *
 * @example
 * const users = [
 *   { id: 1, name: "John Doe", bio: "Software engineer" },
 *   { id: 2, name: "Jane Smith", bio: "Product manager" },
 * ];
 *
 * const results = rankDocuments(
 *   "engineer",
 *   { key: "id", text: (u) => `${u.name} ${u.bio}` },
 *   users
 * );
 * // Returns: [{ key: 1, score: 0.35 }, { key: 2, score: 0 }]
 */
export function rankDocuments<T, K extends keyof T>(
  query: string,
  config: RankConfig<T, K>,
  documents: T[],
  options?: MatcherOptions,
): Array<RankResult<T, K>>;

// Implementation
export function rankDocuments<T, K extends keyof T>(
  query: string,
  documentsOrConfig: T[] | RankConfig<T, K>,
  documentsOrOptions?: T[] | MatcherOptions,
  maybeOptions?: MatcherOptions,
): Array<{ document: T; score: number }> | Array<RankResult<T, K>> {
  // Detect which overload was called
  if (Array.isArray(documentsOrConfig)) {
    // Simple string array overload
    const documents = documentsOrConfig as string[];
    const options = (documentsOrOptions as MatcherOptions) ?? {};
    const matcher = createMatcher(query, options);

    return documents
      .map((document) => ({
        document: document as T,
        score: matcher(document),
      }))
      .sort((a, b) => b.score - a.score);
  } else {
    // Object with config overload
    const config = documentsOrConfig;
    const documents = documentsOrOptions as T[];
    const options = maybeOptions ?? {};
    const matcher = createMatcher(query, options);

    return documents
      .map((doc) => ({
        key: doc[config.key],
        score: matcher(config.text(doc)),
      }))
      .sort((a, b) => b.score - a.score);
  }
}
