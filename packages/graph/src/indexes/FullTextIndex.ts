import type { ElementId } from "../GraphStorage.js";
import type { Index, IndexStatistics } from "./types.js";
import { createMatcher, extractTerms, type MatcherOptions } from "@codemix/text-search";

/**
 * Result of a full-text search.
 */
export interface FullTextSearchResult {
  /**
   * The element ID that matched.
   */
  elementId: ElementId;

  /**
   * The relevance score (0 to 1).
   */
  score: number;
}

/**
 * Full-text index implementation providing text search with BM25-based scoring.
 * Uses @codemix/text-search for tokenization and relevance scoring.
 *
 * Supports:
 * - Full-text search with relevance ranking
 * - Prefix search (STARTS WITH)
 * - Contains search (CONTAINS)
 */
export class FullTextIndex implements Index {
  public readonly type = "fulltext" as const;
  public readonly label: string;
  public readonly property: string;

  /**
   * Matcher options for text-search.
   */
  #options: MatcherOptions;

  /**
   * Inverted index: term -> Set<ElementId>
   */
  #invertedIndex: Map<string, Set<ElementId>> = new Map();

  /**
   * Document store: elementId -> original text
   */
  #documents: Map<ElementId, string> = new Map();

  public constructor(label: string, property: string, options?: MatcherOptions) {
    this.label = label;
    this.property = property;
    this.#options = options ?? {};
  }

  public add(elementId: ElementId, value: unknown): void {
    if (typeof value !== "string" || value.length === 0) {
      return;
    }

    // Store the original document
    this.#documents.set(elementId, value);

    // Extract and index terms
    const terms = extractTerms(value, this.#options);

    for (const term of terms) {
      let ids = this.#invertedIndex.get(term);
      if (!ids) {
        ids = new Set();
        this.#invertedIndex.set(term, ids);
      }
      ids.add(elementId);
    }
  }

  public remove(elementId: ElementId, _value: unknown): void {
    const storedText = this.#documents.get(elementId);
    if (!storedText) {
      return;
    }

    // Remove from inverted index
    const terms = extractTerms(storedText, this.#options);

    for (const term of terms) {
      const ids = this.#invertedIndex.get(term);
      if (ids) {
        ids.delete(elementId);
        if (ids.size === 0) {
          this.#invertedIndex.delete(term);
        }
      }
    }

    this.#documents.delete(elementId);
  }

  public update(elementId: ElementId, oldValue: unknown, newValue: unknown): void {
    this.remove(elementId, oldValue);
    this.add(elementId, newValue);
  }

  /**
   * Perform a full-text search with relevance scoring.
   * Returns results sorted by score descending.
   *
   * @param query The search query.
   * @param limit Maximum number of results (0 = unlimited).
   * @param minScore Minimum score threshold (0-1).
   * @returns Array of results with scores, sorted by relevance.
   */
  public search(query: string, limit: number = 0, minScore: number = 0): FullTextSearchResult[] {
    if (!query || query.trim().length === 0) {
      return [];
    }

    // Extract query terms to find candidate documents
    const queryTerms = extractTerms(query, this.#options);

    if (queryTerms.length === 0) {
      return [];
    }

    // Find candidate documents (any that contain at least one query term)
    const candidates = new Set<ElementId>();
    for (const term of queryTerms) {
      const ids = this.#invertedIndex.get(term);
      if (ids) {
        for (const id of ids) {
          candidates.add(id);
        }
      }
    }

    if (candidates.size === 0) {
      return [];
    }

    // Create matcher for scoring
    const matcher = createMatcher(query, this.#options);

    // Score all candidates
    const results: FullTextSearchResult[] = [];

    for (const elementId of candidates) {
      const text = this.#documents.get(elementId);
      if (!text) continue;

      const score = matcher(text);

      if (score >= minScore) {
        results.push({ elementId, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    if (limit > 0 && results.length > limit) {
      return results.slice(0, limit);
    }

    return results;
  }

  /**
   * Find documents where the text contains the given substring.
   * No relevance scoring - returns all matches.
   *
   * @param substring The substring to search for.
   * @returns Set of element IDs containing the substring.
   */
  public searchContains(substring: string): Set<ElementId> {
    const result = new Set<ElementId>();

    if (!substring || substring.length === 0) {
      return result;
    }

    const normalizedSubstring = substring.toLowerCase();

    for (const [elementId, text] of this.#documents) {
      if (text.toLowerCase().includes(normalizedSubstring)) {
        result.add(elementId);
      }
    }

    return result;
  }

  /**
   * Find documents where the text starts with the given prefix.
   * No relevance scoring - returns all matches.
   *
   * @param prefix The prefix to search for.
   * @returns Set of element IDs starting with the prefix.
   */
  public searchPrefix(prefix: string): Set<ElementId> {
    const result = new Set<ElementId>();

    if (!prefix || prefix.length === 0) {
      return result;
    }

    const normalizedPrefix = prefix.toLowerCase();

    for (const [elementId, text] of this.#documents) {
      if (text.toLowerCase().startsWith(normalizedPrefix)) {
        result.add(elementId);
      }
    }

    return result;
  }

  /**
   * Find documents where any indexed term starts with the given prefix.
   * This is more efficient than searchPrefix for word-based prefix search.
   *
   * @param termPrefix The term prefix to search for.
   * @returns Set of element IDs with terms starting with the prefix.
   */
  public searchTermPrefix(termPrefix: string): Set<ElementId> {
    const result = new Set<ElementId>();

    if (!termPrefix || termPrefix.length === 0) {
      return result;
    }

    // Normalize and stem the prefix
    const normalizedPrefixes = extractTerms(termPrefix, {
      ...this.#options,
      stem: false, // Don't stem for prefix matching
    });

    if (normalizedPrefixes.length === 0) {
      return result;
    }

    const prefix = normalizedPrefixes[0]!;

    for (const [term, ids] of this.#invertedIndex) {
      if (term.startsWith(prefix)) {
        for (const id of ids) {
          result.add(id);
        }
      }
    }

    return result;
  }

  /**
   * Get the document IDs that contain ALL of the given terms (AND semantics).
   * This is useful for quick filtering without scoring.
   *
   * @param query The search query.
   * @returns Set of element IDs containing all query terms.
   */
  public searchAllTerms(query: string): Set<ElementId> {
    const queryTerms = extractTerms(query, this.#options);

    if (queryTerms.length === 0) {
      return new Set();
    }

    // Start with first term's matches
    const firstTermIds = this.#invertedIndex.get(queryTerms[0]!);
    if (!firstTermIds || firstTermIds.size === 0) {
      return new Set();
    }

    const result = new Set(firstTermIds);

    // Intersect with remaining terms
    for (let i = 1; i < queryTerms.length; i++) {
      const termIds = this.#invertedIndex.get(queryTerms[i]!);
      if (!termIds) {
        return new Set(); // No matches for this term
      }

      for (const id of result) {
        if (!termIds.has(id)) {
          result.delete(id);
        }
      }

      if (result.size === 0) {
        return result;
      }
    }

    return result;
  }

  /**
   * Get the document IDs that contain ANY of the given terms (OR semantics).
   *
   * @param query The search query.
   * @returns Set of element IDs containing any query term.
   */
  public searchAnyTerms(query: string): Set<ElementId> {
    const queryTerms = extractTerms(query, this.#options);
    const result = new Set<ElementId>();

    for (const term of queryTerms) {
      const ids = this.#invertedIndex.get(term);
      if (ids) {
        for (const id of ids) {
          result.add(id);
        }
      }
    }

    return result;
  }

  public clear(): void {
    this.#invertedIndex.clear();
    this.#documents.clear();
  }

  public statistics(): IndexStatistics {
    return {
      entries: this.#documents.size,
      uniqueValues: this.#invertedIndex.size, // Number of unique terms
    };
  }
}
