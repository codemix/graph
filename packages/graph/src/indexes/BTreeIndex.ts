import type { ElementId } from "../GraphStorage.js";
import type { Index, IndexStatistics } from "./types.js";

/**
 * Entry in the sorted index.
 */
interface IndexEntry {
  value: number | string;
  elementId: ElementId;
}

/**
 * B-tree-like index implementation providing O(log n) lookups for range queries.
 * Uses a sorted array internally for simplicity in the in-memory case.
 *
 * Supports:
 * - Equality lookup: `property = value`
 * - Range queries: `property < value`, `property <= value`, `property > value`, `property >= value`
 * - Between queries: `value1 <= property <= value2`
 *
 * Only works with number and string values that are naturally comparable.
 */
export class BTreeIndex implements Index {
  public readonly type = "btree" as const;
  public readonly label: string;
  public readonly property: string;

  /**
   * Sorted array of entries.
   */
  #entries: IndexEntry[] = [];

  /**
   * Map from element ID to its current value for efficient updates.
   */
  #elementValues: Map<ElementId, number | string> = new Map();

  /**
   * Optional custom comparator.
   */
  #comparator: ((a: number | string, b: number | string) => number) | undefined;

  public constructor(
    label: string,
    property: string,
    comparator?: (a: number | string, b: number | string) => number,
  ) {
    this.label = label;
    this.property = property;
    this.#comparator = comparator;
  }

  #compare(a: number | string, b: number | string): number {
    if (this.#comparator) {
      return this.#comparator(a, b);
    }
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  /**
   * Find the insertion point for a value using binary search.
   */
  #findInsertionPoint(value: number | string): number {
    let low = 0;
    let high = this.#entries.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.#compare(this.#entries[mid]!.value, value) < 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  /**
   * Find the first entry with exactly this value.
   */
  #findFirstEqual(value: number | string): number {
    const pos = this.#findInsertionPoint(value);
    if (
      pos < this.#entries.length &&
      this.#compare(this.#entries[pos]!.value, value) === 0
    ) {
      return pos;
    }
    return -1;
  }

  public add(elementId: ElementId, value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }

    if (typeof value !== "number" && typeof value !== "string") {
      return;
    }

    // Store for efficient removal/update
    this.#elementValues.set(elementId, value);

    // Find insertion point
    const pos = this.#findInsertionPoint(value);

    // Insert maintaining sort order
    this.#entries.splice(pos, 0, { value, elementId });
  }

  public remove(elementId: ElementId, _value: unknown): void {
    const storedValue = this.#elementValues.get(elementId);
    if (storedValue === undefined) {
      return;
    }

    // Find and remove the entry
    const startPos = this.#findInsertionPoint(storedValue);

    for (let i = startPos; i < this.#entries.length; i++) {
      const entry = this.#entries[i]!;
      if (this.#compare(entry.value, storedValue) !== 0) {
        break;
      }
      if (entry.elementId === elementId) {
        this.#entries.splice(i, 1);
        break;
      }
    }

    this.#elementValues.delete(elementId);
  }

  public update(
    elementId: ElementId,
    oldValue: unknown,
    newValue: unknown,
  ): void {
    this.remove(elementId, oldValue);
    this.add(elementId, newValue);
  }

  /**
   * Look up element IDs by exact value match.
   * O(log n + k) where k is the number of matches.
   *
   * @param value The value to look up.
   * @returns Set of element IDs with this value.
   */
  public lookup(value: number | string): Set<ElementId> {
    const result = new Set<ElementId>();
    const startPos = this.#findFirstEqual(value);

    if (startPos === -1) {
      return result;
    }

    for (let i = startPos; i < this.#entries.length; i++) {
      const entry = this.#entries[i]!;
      if (this.#compare(entry.value, value) !== 0) {
        break;
      }
      result.add(entry.elementId);
    }

    return result;
  }

  /**
   * Find all elements with values less than the given value.
   * O(log n + k) where k is the number of matches.
   *
   * @param value The upper bound (exclusive).
   * @returns Set of element IDs with values < value.
   */
  public lookupLessThan(value: number | string): Set<ElementId> {
    const result = new Set<ElementId>();
    const upperBound = this.#findInsertionPoint(value);

    for (let i = 0; i < upperBound; i++) {
      result.add(this.#entries[i]!.elementId);
    }

    return result;
  }

  /**
   * Find all elements with values less than or equal to the given value.
   * O(log n + k) where k is the number of matches.
   *
   * @param value The upper bound (inclusive).
   * @returns Set of element IDs with values <= value.
   */
  public lookupLessThanOrEqual(value: number | string): Set<ElementId> {
    const result = new Set<ElementId>();

    // Find where values > value would start
    let upperBound = this.#findInsertionPoint(value);

    // Include all equal values
    while (
      upperBound < this.#entries.length &&
      this.#compare(this.#entries[upperBound]!.value, value) === 0
    ) {
      upperBound++;
    }

    for (let i = 0; i < upperBound; i++) {
      result.add(this.#entries[i]!.elementId);
    }

    return result;
  }

  /**
   * Find all elements with values greater than the given value.
   * O(log n + k) where k is the number of matches.
   *
   * @param value The lower bound (exclusive).
   * @returns Set of element IDs with values > value.
   */
  public lookupGreaterThan(value: number | string): Set<ElementId> {
    const result = new Set<ElementId>();

    // Find where values > value start
    let lowerBound = this.#findInsertionPoint(value);

    // Skip all equal values
    while (
      lowerBound < this.#entries.length &&
      this.#compare(this.#entries[lowerBound]!.value, value) === 0
    ) {
      lowerBound++;
    }

    for (let i = lowerBound; i < this.#entries.length; i++) {
      result.add(this.#entries[i]!.elementId);
    }

    return result;
  }

  /**
   * Find all elements with values greater than or equal to the given value.
   * O(log n + k) where k is the number of matches.
   *
   * @param value The lower bound (inclusive).
   * @returns Set of element IDs with values >= value.
   */
  public lookupGreaterThanOrEqual(value: number | string): Set<ElementId> {
    const result = new Set<ElementId>();
    const lowerBound = this.#findInsertionPoint(value);

    for (let i = lowerBound; i < this.#entries.length; i++) {
      result.add(this.#entries[i]!.elementId);
    }

    return result;
  }

  /**
   * Find all elements with values in the given range.
   * O(log n + k) where k is the number of matches.
   *
   * @param min The lower bound.
   * @param max The upper bound.
   * @param minInclusive Whether to include the lower bound.
   * @param maxInclusive Whether to include the upper bound.
   * @returns Set of element IDs with values in range.
   */
  public lookupRange(
    min: number | string,
    max: number | string,
    minInclusive: boolean = true,
    maxInclusive: boolean = true,
  ): Set<ElementId> {
    const result = new Set<ElementId>();

    // Find start position
    let lowerBound = this.#findInsertionPoint(min);

    // If not inclusive, skip equal values
    if (!minInclusive) {
      while (
        lowerBound < this.#entries.length &&
        this.#compare(this.#entries[lowerBound]!.value, min) === 0
      ) {
        lowerBound++;
      }
    }

    // Iterate until we exceed max
    for (let i = lowerBound; i < this.#entries.length; i++) {
      const entry = this.#entries[i]!;
      const cmp = this.#compare(entry.value, max);

      if (cmp > 0) {
        break;
      }

      if (cmp === 0 && !maxInclusive) {
        break;
      }

      result.add(entry.elementId);
    }

    return result;
  }

  public clear(): void {
    this.#entries = [];
    this.#elementValues.clear();
  }

  public statistics(): IndexStatistics {
    // Count unique values
    const uniqueValues = new Set<number | string>();
    for (const entry of this.#entries) {
      uniqueValues.add(entry.value);
    }

    return {
      entries: this.#entries.length,
      uniqueValues: uniqueValues.size,
    };
  }
}
