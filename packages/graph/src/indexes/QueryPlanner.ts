import type { Condition } from "../Steps.js";
import type { IndexConfig } from "../GraphSchema.js";

/**
 * Index operation types.
 */
export type IndexOperation =
  | "equals" // property = value (hash, btree)
  | "in" // property IN [values] (hash)
  | "lessThan" // property < value (btree)
  | "lessThanOrEqual" // property <= value (btree)
  | "greaterThan" // property > value (btree)
  | "greaterThanOrEqual" // property >= value (btree)
  | "startsWith" // property STARTS WITH 'prefix' (fulltext)
  | "contains" // property CONTAINS 'text' (fulltext)
  | "search"; // fulltext.search() (fulltext)

/**
 * A hint suggesting an index can be used for a condition.
 */
export interface IndexHint {
  /**
   * The index type that can satisfy this condition.
   */
  type: IndexConfig["type"];

  /**
   * The property being filtered.
   */
  property: string;

  /**
   * The operation being performed.
   */
  operation: IndexOperation;

  /**
   * The value(s) being compared against.
   */
  value: unknown;

  /**
   * The original condition (for reference).
   */
  condition: Condition;
}

/**
 * Maps condition operators to index operations.
 */
const OPERATOR_TO_OPERATION: Record<
  string,
  { operation: IndexOperation; indexTypes: IndexConfig["type"][] }
> = {
  "=": { operation: "equals", indexTypes: ["hash", "btree"] },
  in: { operation: "in", indexTypes: ["hash"] },
  "<": { operation: "lessThan", indexTypes: ["btree"] },
  "<=": { operation: "lessThanOrEqual", indexTypes: ["btree"] },
  ">": { operation: "greaterThan", indexTypes: ["btree"] },
  ">=": { operation: "greaterThanOrEqual", indexTypes: ["btree"] },
  startsWith: { operation: "startsWith", indexTypes: ["fulltext"] },
  contains: { operation: "contains", indexTypes: ["fulltext"] },
};

/**
 * Analyze a condition to find index opportunities.
 *
 * @param condition The condition to analyze.
 * @returns Array of index hints that could optimize this condition.
 */
export function analyzeCondition(condition: Condition): IndexHint[] {
  const hints: IndexHint[] = [];
  analyzeConditionRecursive(condition, hints);
  return hints;
}

/**
 * Recursively analyze a condition tree.
 */
function analyzeConditionRecursive(condition: Condition, hints: IndexHint[]): void {
  const [operator, ...args] = condition;

  switch (operator) {
    case "and":
    case "or":
    case "xor":
      // Recursively analyze sub-conditions
      for (const subCondition of args as Condition[]) {
        analyzeConditionRecursive(subCondition, hints);
      }
      break;

    case "not":
      // NOT conditions generally can't use indexes efficiently
      // (though NOT IN could potentially use hash index)
      break;

    case "exists":
    case "isNull":
    case "isNotNull":
      // Existence checks can't use value indexes
      break;

    case "=":
    case "<":
    case "<=":
    case ">":
    case ">=":
    case "startsWith":
    case "contains": {
      const [property, value] = args;

      // Skip special properties (@id, @label)
      if (typeof property !== "string" || property.startsWith("@")) {
        break;
      }

      // Skip if value is a reference (not a literal)
      if (value !== null && typeof value === "object" && "type" in value) {
        break;
      }

      const mapping = OPERATOR_TO_OPERATION[operator];
      if (mapping) {
        for (const indexType of mapping.indexTypes) {
          hints.push({
            type: indexType,
            property,
            operation: mapping.operation,
            value,
            condition,
          });
        }
      }
      break;
    }

    case "in": {
      const [property, values] = args;

      if (typeof property !== "string" || property.startsWith("@")) {
        break;
      }

      hints.push({
        type: "hash",
        property,
        operation: "in",
        value: values,
        condition,
      });
      break;
    }

    case "=~":
      // Regex conditions can't use indexes efficiently
      break;

    default:
      // Unknown operator
      break;
  }
}

/**
 * Selects the best index hint based on available indexes and selectivity estimates.
 *
 * @param hints Array of index hints from condition analysis.
 * @param hasIndex Function to check if an index exists for a property.
 * @returns The best hint to use, or undefined if no index available.
 */
export function selectBestIndexHint(
  hints: IndexHint[],
  hasIndex: (property: string, type: IndexConfig["type"]) => boolean,
): IndexHint | undefined {
  // Filter to hints where we have the required index
  const usableHints = hints.filter((hint) => hasIndex(hint.property, hint.type));

  if (usableHints.length === 0) {
    return undefined;
  }

  // Priority order (higher = better):
  // 1. Equality on hash index (most selective)
  // 2. Range on btree index
  // 3. Full-text search (least selective usually)
  const priority: Record<IndexOperation, number> = {
    equals: 100,
    in: 90,
    lessThan: 80,
    lessThanOrEqual: 80,
    greaterThan: 80,
    greaterThanOrEqual: 80,
    startsWith: 70,
    contains: 60,
    search: 50,
  };

  // Sort by priority descending
  usableHints.sort((a, b) => {
    const priorityDiff = (priority[b.operation] ?? 0) - (priority[a.operation] ?? 0);
    if (priorityDiff !== 0) return priorityDiff;

    // Prefer hash over btree for equality
    if (a.operation === "equals" && a.type === "hash" && b.type !== "hash") {
      return -1;
    }
    if (b.operation === "equals" && b.type === "hash" && a.type !== "hash") {
      return 1;
    }

    return 0;
  });

  return usableHints[0];
}

/**
 * Check if a condition can be fully satisfied by an index lookup.
 * If true, the FilterElementsStep can be skipped entirely.
 *
 * @param condition The condition to check.
 * @param hint The index hint being used.
 * @returns True if the condition is fully covered by the index.
 */
export function isConditionFullyCovered(condition: Condition, hint: IndexHint): boolean {
  // Only simple conditions can be fully covered
  const [operator] = condition;

  switch (operator) {
    case "=":
    case "<":
    case "<=":
    case ">":
    case ">=":
    case "in":
      // These are fully covered if the hint matches the condition
      return hint.condition === condition;

    case "startsWith":
    case "contains":
      // Full-text operations might have false positives, so we should
      // still filter to be safe
      return false;

    default:
      return false;
  }
}

/**
 * Extract conditions that can't be satisfied by indexes.
 * These need to be applied as post-filters.
 *
 * @param condition The full condition.
 * @param usedHint The index hint being used.
 * @returns Remaining condition to filter, or undefined if fully covered.
 */
export function extractRemainingCondition(
  condition: Condition,
  usedHint: IndexHint,
): Condition | undefined {
  const [operator] = condition;

  // If this is the exact condition being handled by index
  if (isConditionFullyCovered(condition, usedHint)) {
    return undefined;
  }

  // For AND conditions, remove the covered sub-condition
  if (operator === "and") {
    const remaining: Condition[] = [];

    for (let i = 1; i < condition.length; i++) {
      const subCondition = condition[i] as Condition;
      if (subCondition !== usedHint.condition) {
        remaining.push(subCondition);
      }
    }

    if (remaining.length === 0) {
      return undefined;
    }

    if (remaining.length === 1) {
      return remaining[0];
    }

    return ["and", ...remaining] as Condition;
  }

  // For other conditions, we need to keep the whole thing
  return condition;
}
