import type {
  GraphSchema,
  IndexConfig,
  FullTextIndexConfig,
} from "../GraphSchema.js";
import type { ElementId, StoredElement } from "../GraphStorage.js";
import { getLabelFromElementId } from "../GraphStorage.js";
import type { Index, IndexStatistics } from "./types.js";
import { HashIndex } from "./HashIndex.js";
import { BTreeIndex } from "./BTreeIndex.js";
import { FullTextIndex } from "./FullTextIndex.js";
import { UniqueConstraintViolationError } from "../Exceptions.js";

/**
 * Manages all indexes for a graph.
 * Handles index creation, building, and maintenance.
 */
export class IndexManager<TSchema extends GraphSchema> {
  #schema: TSchema;

  /**
   * Map of index key ("Label.property") to Index instance.
   */
  #indexes: Map<string, Index> = new Map();

  /**
   * Set of index keys that have been built.
   */
  #built: Set<string> = new Set();

  public constructor(schema: TSchema) {
    this.#schema = schema;
  }

  /**
   * Get the key for an index.
   */
  #indexKey(label: string, property: string): string {
    return `${label}.${property}`;
  }

  /**
   * Check if a property has an index defined in the schema.
   * @param label The element label.
   * @param property The property name.
   * @returns The index configuration, or undefined if not indexed.
   */
  public getIndexConfig(
    label: string,
    property: string,
  ): IndexConfig | undefined {
    // Defensive check for incomplete schemas
    const vertices = this.#schema.vertices;
    if (vertices) {
      const vertexSchema = vertices[label];
      if (vertexSchema?.properties[property]?.index) {
        return vertexSchema.properties[property]!.index;
      }
    }

    const edges = this.#schema.edges;
    if (edges) {
      const edgeSchema = edges[label];
      if (edgeSchema?.properties[property]?.index) {
        return edgeSchema.properties[property]!.index;
      }
    }

    return undefined;
  }

  /**
   * Check if a property has an index of a specific type.
   * @param label The element label.
   * @param property The property name.
   * @param type The index type to check for.
   * @returns True if the property has an index of the specified type.
   */
  public hasIndexOfType(
    label: string,
    property: string,
    type: IndexConfig["type"],
  ): boolean {
    const config = this.getIndexConfig(label, property);
    return config?.type === type;
  }

  /**
   * Check if a property has a unique index constraint.
   * @param label The element label.
   * @param property The property name.
   * @returns True if the property has a unique constraint.
   */
  public isUnique(label: string, property: string): boolean {
    const config = this.getIndexConfig(label, property);
    if (!config) return false;
    // Only hash and btree indexes support unique constraints
    if (config.type === "hash" || config.type === "btree") {
      return config.unique === true;
    }
    return false;
  }

  /**
   * Get all unique index configurations for a label.
   * @param label The element label.
   * @returns Array of property names that have unique constraints.
   */
  public getUniqueProperties(label: string): string[] {
    const uniqueProps: string[] = [];

    // Check vertex schema
    const vertexSchema = this.#schema.vertices?.[label];
    if (vertexSchema) {
      for (const [property, propSchema] of Object.entries(
        vertexSchema.properties,
      )) {
        if (propSchema.index) {
          const indexConfig = propSchema.index;
          if (
            (indexConfig.type === "hash" || indexConfig.type === "btree") &&
            indexConfig.unique
          ) {
            uniqueProps.push(property);
          }
        }
      }
    }

    // Check edge schema
    const edgeSchema = this.#schema.edges?.[label];
    if (edgeSchema) {
      for (const [property, propSchema] of Object.entries(
        edgeSchema.properties,
      )) {
        if (propSchema.index) {
          const indexConfig = propSchema.index;
          if (
            (indexConfig.type === "hash" || indexConfig.type === "btree") &&
            indexConfig.unique
          ) {
            uniqueProps.push(property);
          }
        }
      }
    }

    return uniqueProps;
  }

  /**
   * Look up an element by a unique property value.
   * Returns the element ID if found, undefined otherwise.
   * Automatically builds the index if not already built.
   *
   * @param label The element label.
   * @param property The property name (must have a unique index).
   * @param value The value to look up.
   * @param elements Elements to build index from if not already built.
   * @returns The element ID if found, undefined otherwise.
   */
  public lookupUnique(
    label: string,
    property: string,
    value: unknown,
    elements?: Iterable<StoredElement>,
  ): ElementId | undefined {
    if (!this.isUnique(label, property)) {
      return undefined;
    }

    // Ensure index is built
    const key = this.#indexKey(label, property);
    if (!this.#built.has(key) && elements) {
      this.buildIndex(label, property, elements);
    }

    const index = this.getIndex(label, property);
    if (!index) return undefined;

    // Use hash index lookup for exact match
    if (index instanceof HashIndex) {
      const ids = index.lookup(value);
      if (ids.size > 0) {
        return [...ids][0];
      }
    } else if (index instanceof BTreeIndex) {
      // BTreeIndex only supports number | string values
      if (typeof value === "number" || typeof value === "string") {
        const ids = index.lookup(value);
        if (ids.size > 0) {
          return [...ids][0];
        }
      }
    }

    return undefined;
  }

  /**
   * Check if adding/updating a value would violate a unique constraint.
   * Throws UniqueConstraintViolationError if it would.
   *
   * @param label The element label.
   * @param property The property name.
   * @param value The value being added/updated.
   * @param excludeElementId Optional element ID to exclude (for updates).
   * @throws UniqueConstraintViolationError if constraint would be violated.
   */
  public checkUniqueConstraint(
    label: string,
    property: string,
    value: unknown,
    excludeElementId?: ElementId,
  ): void {
    if (value === undefined || value === null) {
      return; // null/undefined values don't violate unique constraints
    }

    if (!this.isUnique(label, property)) {
      return;
    }

    const key = this.#indexKey(label, property);
    if (!this.#built.has(key)) {
      return; // Index not built yet, constraint will be checked when index is built
    }

    const index = this.getIndex(label, property);
    if (!index) return;

    let existingIds: ReadonlySet<ElementId> | Set<ElementId> = new Set();
    if (index instanceof HashIndex) {
      existingIds = index.lookup(value);
    } else if (index instanceof BTreeIndex) {
      // BTreeIndex only supports number | string values
      if (typeof value === "number" || typeof value === "string") {
        existingIds = index.lookup(value);
      }
    } else {
      return;
    }

    for (const existingId of existingIds) {
      if (existingId !== excludeElementId) {
        throw new UniqueConstraintViolationError(
          label,
          property,
          value,
          existingId,
        );
      }
    }
  }

  /**
   * Check all unique constraints for an element's properties.
   * @param label The element label.
   * @param properties The properties to check.
   * @param excludeElementId Optional element ID to exclude (for updates).
   * @throws UniqueConstraintViolationError if any constraint would be violated.
   */
  public checkAllUniqueConstraints(
    label: string,
    properties: Record<string, unknown>,
    excludeElementId?: ElementId,
  ): void {
    const uniqueProps = this.getUniqueProperties(label);
    for (const property of uniqueProps) {
      if (property in properties) {
        this.checkUniqueConstraint(
          label,
          property,
          properties[property],
          excludeElementId,
        );
      }
    }
  }

  /**
   * Get or create an index for a property.
   * Returns undefined if no index is configured for this property.
   * Note: This creates the index structure but does not build it.
   *
   * @param label The element label.
   * @param property The property name.
   * @returns The index, or undefined if not configured.
   */
  public getIndex(label: string, property: string): Index | undefined {
    const key = this.#indexKey(label, property);

    // Return cached index
    const existing = this.#indexes.get(key);
    if (existing) {
      return existing;
    }

    // Check if index is configured
    const config = this.getIndexConfig(label, property);
    if (!config) {
      return undefined;
    }

    // Create the index
    const index = this.#createIndex(label, property, config);
    this.#indexes.set(key, index);

    return index;
  }

  /**
   * Get a typed index (HashIndex, BTreeIndex, or FullTextIndex).
   */
  public getHashIndex(label: string, property: string): HashIndex | undefined {
    const index = this.getIndex(label, property);
    return index instanceof HashIndex ? index : undefined;
  }

  public getBTreeIndex(
    label: string,
    property: string,
  ): BTreeIndex | undefined {
    const index = this.getIndex(label, property);
    return index instanceof BTreeIndex ? index : undefined;
  }

  public getFullTextIndex(
    label: string,
    property: string,
  ): FullTextIndex | undefined {
    const index = this.getIndex(label, property);
    return index instanceof FullTextIndex ? index : undefined;
  }

  /**
   * Create an index instance based on configuration.
   */
  #createIndex(label: string, property: string, config: IndexConfig): Index {
    switch (config.type) {
      case "hash":
        return new HashIndex(label, property);
      case "btree":
        return new BTreeIndex(label, property);
      case "fulltext": {
        // Type narrowing: at this point TypeScript knows config.type === "fulltext"
        const fulltextConfig = config as FullTextIndexConfig;
        return new FullTextIndex(label, property, fulltextConfig.options);
      }
      default: {
        // Exhaustive check - will error at compile time if a new type is added
        const exhaustiveCheck: never = config;
        throw new Error(
          `Unknown index type: ${(exhaustiveCheck as IndexConfig).type}`,
        );
      }
    }
  }

  /**
   * Check if an index has been built.
   */
  public isBuilt(label: string, property: string): boolean {
    return this.#built.has(this.#indexKey(label, property));
  }

  /**
   * Build an index by scanning all elements.
   * Called lazily on first query that could use the index.
   *
   * @param label The element label.
   * @param property The property name.
   * @param elements Iterator of elements to index.
   * @returns The built index, or undefined if not configured.
   * @throws UniqueConstraintViolationError if unique constraint is violated during build.
   */
  public buildIndex(
    label: string,
    property: string,
    elements: Iterable<StoredElement>,
  ): Index | undefined {
    const key = this.#indexKey(label, property);

    // Already built
    if (this.#built.has(key)) {
      return this.#indexes.get(key);
    }

    // Get or create the index
    const index = this.getIndex(label, property);
    if (!index) {
      return undefined;
    }

    // Check if this is a unique index
    const isUniqueIndex = this.isUnique(label, property);

    // Build the index
    for (const element of elements) {
      const elementLabel = getLabelFromElementId(element.id);
      if (elementLabel === label) {
        const value = (element.properties as Record<string, unknown>)[property];
        if (value !== undefined) {
          // For unique indexes, check for duplicates before adding
          if (isUniqueIndex) {
            let existingIds: ReadonlySet<ElementId> | Set<ElementId> =
              new Set();
            if (index instanceof HashIndex) {
              existingIds = index.lookup(value);
            } else if (index instanceof BTreeIndex) {
              // BTreeIndex only supports number | string values
              if (typeof value === "number" || typeof value === "string") {
                existingIds = index.lookup(value);
              }
            }
            if (existingIds.size > 0) {
              const existingId = [...existingIds][0]!;
              throw new UniqueConstraintViolationError(
                label,
                property,
                value,
                existingId,
              );
            }
          }
          index.add(element.id, value);
        }
      }
    }

    this.#built.add(key);
    return index;
  }

  /**
   * Called when a new element is added to the graph.
   * Updates all built indexes for this element.
   * Note: This does NOT check unique constraints - call checkAllUniqueConstraints first.
   */
  public onElementAdd(element: StoredElement): void {
    const label = getLabelFromElementId(element.id);

    // Add to indexes
    for (const [property, value] of Object.entries(element.properties)) {
      const key = this.#indexKey(label, property);

      // Only update if index exists and has been built
      if (this.#built.has(key)) {
        const index = this.#indexes.get(key);
        if (index && value !== undefined) {
          index.add(element.id, value);
        }
      }
    }
  }

  /**
   * Called when an element is removed from the graph.
   * Updates all built indexes for this element.
   */
  public onElementRemove(element: StoredElement): void {
    const label = getLabelFromElementId(element.id);

    for (const [property, value] of Object.entries(element.properties)) {
      const key = this.#indexKey(label, property);

      if (this.#built.has(key)) {
        const index = this.#indexes.get(key);
        if (index && value !== undefined) {
          index.remove(element.id, value);
        }
      }
    }
  }

  /**
   * Called when a property is updated on an element.
   * @throws UniqueConstraintViolationError if unique constraint would be violated.
   */
  public onPropertyUpdate(
    elementId: ElementId,
    property: string,
    oldValue: unknown,
    newValue: unknown,
  ): void {
    const label = getLabelFromElementId(elementId);

    // Check unique constraint (exclude current element since it's an update)
    if (newValue !== undefined) {
      this.checkUniqueConstraint(label, property, newValue, elementId);
    }

    const key = this.#indexKey(label, property);

    if (this.#built.has(key)) {
      const index = this.#indexes.get(key);
      if (index) {
        index.update(elementId, oldValue, newValue);
      }
    }
  }

  /**
   * Get statistics for all built indexes.
   */
  public statistics(): Record<string, IndexStatistics & { type: string }> {
    const stats: Record<string, IndexStatistics & { type: string }> = {};

    for (const [key, index] of this.#indexes) {
      if (this.#built.has(key)) {
        stats[key] = {
          ...index.statistics(),
          type: index.type,
        };
      }
    }

    return stats;
  }

  /**
   * Clear all indexes.
   */
  public clearAll(): void {
    for (const index of this.#indexes.values()) {
      index.clear();
    }
    this.#built.clear();
  }

  /**
   * Rebuild a specific index.
   */
  public rebuildIndex(
    label: string,
    property: string,
    elements: Iterable<StoredElement>,
  ): Index | undefined {
    const key = this.#indexKey(label, property);

    // Clear existing
    const existing = this.#indexes.get(key);
    if (existing) {
      existing.clear();
    }

    this.#built.delete(key);

    // Rebuild
    return this.buildIndex(label, property, elements);
  }

  /**
   * Ensure all unique indexes for a label are built.
   * This should be called before adding elements to ensure constraint checking works.
   *
   * @param label The element label.
   * @param elements Elements to build indexes from.
   */
  public ensureUniqueIndexesBuilt(
    label: string,
    elements: Iterable<StoredElement>,
  ): void {
    const uniqueProps = this.getUniqueProperties(label);
    for (const property of uniqueProps) {
      const key = this.#indexKey(label, property);
      if (!this.#built.has(key)) {
        this.buildIndex(label, property, elements);
      }
    }
  }

  /**
   * Find an element by its unique properties.
   * This is used by MERGE operations to find existing elements.
   *
   * @param label The element label.
   * @param properties Properties to match (only unique-indexed properties are used).
   * @param elements Elements to build index from if not already built.
   * @returns The element ID if found via a unique index, undefined otherwise.
   */
  public findByUniqueProperties(
    label: string,
    properties: Record<string, unknown>,
    elements?: Iterable<StoredElement>,
  ): ElementId | undefined {
    const uniqueProps = this.getUniqueProperties(label);

    for (const property of uniqueProps) {
      if (property in properties) {
        const value = properties[property];
        if (value !== undefined && value !== null) {
          const elementId = this.lookupUnique(label, property, value, elements);
          if (elementId !== undefined) {
            return elementId;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Get all unique index configurations from the schema.
   * Useful for understanding what uniqueness constraints exist.
   */
  public getAllUniqueIndexConfigs(): Array<{
    label: string;
    property: string;
    config: IndexConfig;
    elementType: "vertex" | "edge";
  }> {
    const configs: Array<{
      label: string;
      property: string;
      config: IndexConfig;
      elementType: "vertex" | "edge";
    }> = [];

    // Vertex indexes
    for (const [label, schema] of Object.entries(this.#schema.vertices)) {
      for (const [property, propSchema] of Object.entries(schema.properties)) {
        if (propSchema.index) {
          const indexConfig = propSchema.index;
          if (
            (indexConfig.type === "hash" || indexConfig.type === "btree") &&
            indexConfig.unique
          ) {
            configs.push({
              label,
              property,
              config: indexConfig,
              elementType: "vertex",
            });
          }
        }
      }
    }

    // Edge indexes
    for (const [label, schema] of Object.entries(this.#schema.edges)) {
      for (const [property, propSchema] of Object.entries(schema.properties)) {
        if (propSchema.index) {
          const indexConfig = propSchema.index;
          if (
            (indexConfig.type === "hash" || indexConfig.type === "btree") &&
            indexConfig.unique
          ) {
            configs.push({
              label,
              property,
              config: indexConfig,
              elementType: "edge",
            });
          }
        }
      }
    }

    return configs;
  }

  /**
   * Get all index configurations from the schema.
   * Useful for prebuilding all indexes.
   */
  public getAllIndexConfigs(): Array<{
    label: string;
    property: string;
    config: IndexConfig;
    elementType: "vertex" | "edge";
  }> {
    const configs: Array<{
      label: string;
      property: string;
      config: IndexConfig;
      elementType: "vertex" | "edge";
    }> = [];

    // Vertex indexes
    for (const [label, schema] of Object.entries(this.#schema.vertices)) {
      for (const [property, propSchema] of Object.entries(schema.properties)) {
        if (propSchema.index) {
          configs.push({
            label,
            property,
            config: propSchema.index,
            elementType: "vertex",
          });
        }
      }
    }

    // Edge indexes
    for (const [label, schema] of Object.entries(this.#schema.edges)) {
      for (const [property, propSchema] of Object.entries(schema.properties)) {
        if (propSchema.index) {
          configs.push({
            label,
            property,
            config: propSchema.index,
            elementType: "edge",
          });
        }
      }
    }

    return configs;
  }
}
