import type { ElementId } from "../GraphStorage.js";
import type { IndexType } from "../GraphSchema.js";

/**
 * Base interface for all index implementations.
 */
export interface Index {
  /**
   * The type of the index.
   */
  readonly type: IndexType;

  /**
   * The element label this index is for.
   */
  readonly label: string;

  /**
   * The property name this index is for.
   */
  readonly property: string;

  /**
   * Add a value to the index.
   * @param elementId The ID of the element.
   * @param value The property value to index.
   */
  add(elementId: ElementId, value: unknown): void;

  /**
   * Remove a value from the index.
   * @param elementId The ID of the element.
   * @param value The property value to remove.
   */
  remove(elementId: ElementId, value: unknown): void;

  /**
   * Update a value in the index.
   * @param elementId The ID of the element.
   * @param oldValue The old property value.
   * @param newValue The new property value.
   */
  update(elementId: ElementId, oldValue: unknown, newValue: unknown): void;

  /**
   * Clear all entries from the index.
   */
  clear(): void;

  /**
   * Get statistics about the index.
   */
  statistics(): IndexStatistics;
}

/**
 * Statistics about an index.
 */
export interface IndexStatistics {
  /**
   * Total number of entries in the index.
   */
  entries: number;

  /**
   * Number of unique values indexed.
   */
  uniqueValues: number;
}
