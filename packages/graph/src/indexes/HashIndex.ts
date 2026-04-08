import type { ElementId } from "../GraphStorage.js";
import type { Index, IndexStatistics } from "./types.js";

/**
 * Hash index implementation providing O(1) lookups for equality comparisons.
 *
 * Supports:
 * - Equality lookup: `property = value`
 * - IN lookup: `property IN [value1, value2, ...]`
 */
export class HashIndex implements Index {
  public readonly type = "hash" as const;
  public readonly label: string;
  public readonly property: string;

  /**
   * Maps property values to sets of element IDs.
   */
  #index: Map<unknown, Set<ElementId>> = new Map();

  /**
   * Reverse mapping from element ID to its indexed value.
   * Used for efficient updates and removals.
   */
  #reverse: Map<ElementId, unknown> = new Map();

  public constructor(label: string, property: string) {
    this.label = label;
    this.property = property;
  }

  public add(elementId: ElementId, value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }

    let ids = this.#index.get(value);
    if (!ids) {
      ids = new Set();
      this.#index.set(value, ids);
    }
    ids.add(elementId);
    this.#reverse.set(elementId, value);
  }

  public remove(elementId: ElementId, _value: unknown): void {
    // Use stored value from reverse index to ensure we remove correctly
    const storedValue = this.#reverse.get(elementId);
    if (storedValue === undefined) {
      return;
    }

    const ids = this.#index.get(storedValue);
    if (ids) {
      ids.delete(elementId);
      if (ids.size === 0) {
        this.#index.delete(storedValue);
      }
    }
    this.#reverse.delete(elementId);
  }

  public update(elementId: ElementId, oldValue: unknown, newValue: unknown): void {
    this.remove(elementId, oldValue);
    this.add(elementId, newValue);
  }

  /**
   * Look up element IDs by exact value match.
   * O(1) operation.
   *
   * @param value The value to look up.
   * @returns Set of element IDs with this value.
   */
  public lookup(value: unknown): ReadonlySet<ElementId> {
    return this.#index.get(value) ?? new Set();
  }

  /**
   * Look up element IDs matching any of the given values.
   * O(n) where n is the number of values.
   *
   * @param values Array of values to look up.
   * @returns Set of element IDs matching any value.
   */
  public lookupMany(values: readonly unknown[]): Set<ElementId> {
    const result = new Set<ElementId>();
    for (const value of values) {
      const ids = this.#index.get(value);
      if (ids) {
        for (const id of ids) {
          result.add(id);
        }
      }
    }
    return result;
  }

  public clear(): void {
    this.#index.clear();
    this.#reverse.clear();
  }

  public statistics(): IndexStatistics {
    let entries = 0;
    for (const ids of this.#index.values()) {
      entries += ids.size;
    }
    return {
      entries,
      uniqueValues: this.#index.size,
    };
  }
}
