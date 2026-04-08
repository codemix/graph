import { StandardSchemaV1 } from "@standard-schema/spec";
import type { MatcherOptions } from "@codemix/text-search";

/**
 * Index types supported by the graph database.
 */
export type IndexType = "hash" | "btree" | "fulltext";

/**
 * Configuration for a hash index.
 * Hash indexes provide O(1) lookups for equality comparisons.
 */
export interface HashIndexConfig {
  type: "hash";
  /**
   * When true, the indexed property must have a unique value across all elements
   * with the same label. Attempts to insert or update duplicate values will throw
   * a UniqueConstraintViolationError.
   */
  unique?: boolean;
}

/**
 * Configuration for a B-tree index.
 * B-tree indexes provide O(log n) lookups for range queries.
 */
export interface BTreeIndexConfig {
  type: "btree";
  /**
   * When true, the indexed property must have a unique value across all elements
   * with the same label. Attempts to insert or update duplicate values will throw
   * a UniqueConstraintViolationError.
   */
  unique?: boolean;
}

/**
 * Configuration for a full-text index.
 * Full-text indexes provide text search with BM25-based scoring.
 */
export interface FullTextIndexConfig {
  type: "fulltext";
  /**
   * Options for the text-search matcher.
   * @see @codemix/text-search MatcherOptions
   */
  options?: MatcherOptions;
}

/**
 * Index configuration for a property.
 */
export type IndexConfig =
  | HashIndexConfig
  | BTreeIndexConfig
  | FullTextIndexConfig;

export interface GraphSchema {
  /**
   * A dictionary of vertex labels and their properties.
   */
  vertices: Record<string, VertexSchema>;

  /**
   * A dictionary of edge labels and their properties.
   */
  edges: Record<string, EdgeSchema>;
}

export interface ElementSchema {
  /**
   * The properties of the element.
   */
  properties: Record<string, PropertySchema>;
}

/**
 * Get the properties from an element schema.
 */
export type PropertiesFromSchema<TSchema extends ElementSchema> =
  UndefinedToOptional<{
    [K in keyof TSchema["properties"]]: StandardSchemaV1.InferOutput<
      TSchema["properties"][K]["type"]
    >;
  }>;

export interface VertexSchema extends ElementSchema {}

export interface EdgeSchema extends ElementSchema {}

export interface PropertySchema<TInput = unknown, TOutput = TInput> {
  /**
   * The type of the property.
   */
  type: StandardSchemaV1<TInput, TOutput>;

  /**
   * The comparator for the property values.
   */
  comparator?: (a: TInput, b: TInput) => number;

  /**
   * Optional index configuration for this property.
   * When specified, an index will be built lazily on first query.
   */
  index?: IndexConfig;
}

/**
 * A valid element label for the given graph schema.
 */
export type ElementLabel<TSchema extends GraphSchema> = (
  | keyof TSchema["vertices"]
  | keyof TSchema["edges"]
) &
  string;

/**
 * The properties associated with an element label.
 */
export type ElementProperties<
  TSchema extends GraphSchema,
  TLabel extends ElementLabel<TSchema>,
> = TLabel extends keyof TSchema["vertices"]
  ? VertexProperties<TSchema, TLabel>
  : EdgeProperties<TSchema, TLabel>;

/**
 * The properties associated with an element label that are sortable.
 */
export type SortableElementProperties<
  TSchema extends GraphSchema,
  TLabel extends ElementLabel<TSchema>,
> = TLabel extends keyof TSchema["vertices"]
  ? UndefinedToOptional<{
      [K in keyof TSchema["vertices"][TLabel]["properties"] as "comparator" extends keyof TSchema["vertices"][TLabel]["properties"][K]
        ? K
        : never]: StandardSchemaV1.InferOutput<
        TSchema["vertices"][TLabel]["properties"][K]["type"]
      >;
    }>
  : EdgeProperties<TSchema, TLabel>;

/**
 * A valid vertex label for the given graph schema.
 */
export type VertexLabel<TSchema extends GraphSchema> =
  keyof TSchema["vertices"] & string;

/**
 * The properties associated with a vertex label.
 */
export type VertexProperties<
  TSchema extends GraphSchema,
  TLabelName extends keyof TSchema["vertices"] & string,
> = UndefinedToOptional<{
  [K in keyof TSchema["vertices"][TLabelName]["properties"]]: StandardSchemaV1.InferOutput<
    TSchema["vertices"][TLabelName]["properties"][K]["type"]
  >;
}>;

/**
 * A valid edge label for the given graph schema.
 */
export type EdgeLabel<TSchema extends GraphSchema> = keyof TSchema["edges"] &
  string;

/**
 * The properties associated with an edge label.
 */
export type EdgeProperties<
  TSchema extends GraphSchema,
  TLabelName extends keyof TSchema["edges"] & string,
> = UndefinedToOptional<{
  [K in keyof TSchema["edges"][TLabelName]["properties"]]: StandardSchemaV1.InferOutput<
    TSchema["edges"][TLabelName]["properties"][K]["type"]
  >;
}>;

type UndefinedToOptional<T> = {
  [K in keyof T as undefined extends T[K] ? never : K]-?: T[K];
} & {
  [K in keyof T as undefined extends T[K] ? K : never]?: T[K];
};

export type AnyLabel<TSchema extends GraphSchema> =
  | VertexLabel<TSchema>
  | EdgeLabel<TSchema>;

/**
 * A valid property name for any edge in the given graph schema.
 */
export type AnyEdgePropertyName<TSchema extends GraphSchema> = {
  [L in EdgeLabel<TSchema>]: keyof TSchema["edges"][L]["properties"] & string;
}[EdgeLabel<TSchema>];

/**
 * A valid property name for any vertex in the given graph schema.
 */
export type AnyVertexPropertyName<TSchema extends GraphSchema> = {
  [L in VertexLabel<TSchema>]: keyof TSchema["vertices"][L]["properties"] &
    string;
}[VertexLabel<TSchema>];

/**
 * A valid property name for any element (vertex or edge) in the given graph schema.
 */
export type AnyPropertyName<TSchema extends GraphSchema> =
  | AnyVertexPropertyName<TSchema>
  | AnyEdgePropertyName<TSchema>;
