import type {
  AnyLabel,
  EdgeLabel,
  EdgeProperties,
  ElementSchema,
  GraphSchema,
  VertexLabel,
  VertexProperties,
} from "./GraphSchema.js";
import {
  ElementId,
  getLabelFromElementId,
  GraphStorage,
  parseElementId,
  StoredEdge,
  StoredElement,
  StoredVertex,
} from "./GraphStorage.js";
import {
  AsyncValidationError,
  EdgeNotFoundError,
  GraphConsistencyError,
  LabelNotFoundError,
  PropertyTypeError,
  VertexNotFoundError,
} from "./Exceptions.js";
import { IndexManager } from "./indexes/IndexManager.js";

/**
 * Parse a property value through its Standard Schema validator.
 * Returns the transformed output value on success, or throws on validation failure.
 *
 * @param key The property key being validated
 * @param label The element label (for error messages)
 * @param value The input value to validate
 * @param schemaProperties The element's schema properties definition
 * @returns The transformed/validated value (may be different from input)
 * @throws PropertyValidationError if key is not in schema
 * @throws PropertyTypeError if value fails validation
 * @throws AsyncValidationError if schema returns a Promise (not supported)
 */
export function parsePropertyValue<T>(
  key: string,
  label: string,
  value: T,
  schemaProperties: ElementSchema["properties"] | undefined,
): T {
  if (!schemaProperties) {
    return value;
  }

  // If key is not in schema, allow it without validation
  // (only validate properties that have explicit schema definitions)
  if (!(key in schemaProperties)) {
    return value;
  }

  // Validate and transform value using the property's type schema
  const propertySchema = schemaProperties[key];
  if (propertySchema?.type?.["~standard"]?.validate) {
    const result = propertySchema.type["~standard"].validate(value);

    // Check for async result (not supported)
    if (result instanceof Promise) {
      throw new AsyncValidationError(key, label);
    }

    // Check for validation errors (empty issues array is treated as success)
    if ("issues" in result && result.issues && result.issues.length > 0) {
      const issues = result.issues.map((issue) => issue.message);
      throw new PropertyTypeError(key, label, value, issues);
    }

    // Return the transformed/validated value
    if ("value" in result) {
      return result.value as T;
    }
  }

  return value;
}

/**
 * Parse all properties of an element through their Standard Schema validators.
 * Returns a new object with all values transformed according to their schemas.
 *
 * @param label The element label (for error messages)
 * @param properties The properties object to validate
 * @param schemaProperties The element's schema properties definition
 * @returns A new object with all transformed/validated values
 */
export function parseProperties<T extends Record<string, unknown>>(
  label: string,
  properties: T,
  schemaProperties: ElementSchema["properties"] | undefined,
): T {
  if (!schemaProperties) {
    return properties;
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(properties)) {
    result[key] = parsePropertyValue(
      key,
      label,
      properties[key],
      schemaProperties,
    );
  }
  return result as T;
}

const customInspectSymbol = Symbol.for("nodejs.util.inspect.custom");

export interface GraphSource<TSchema extends GraphSchema> {
  /**
   * The schema of the graph.
   */
  readonly schema: TSchema;

  /**
   * The index manager for query optimization.
   * Optional - sources that don't support indexing can return undefined.
   */
  readonly indexManager?: IndexManager<TSchema>;

  /**
   * Get all incoming edges of a vertex.
   * @param vertexId The id of the vertex.
   */
  getIncomingEdges(vertexId: ElementId): Iterable<Edge<TSchema, any>>;

  /**
   * Get all outgoing edges of a vertex.
   * @param vertexId The id of the vertex.
   */
  getOutgoingEdges(vertexId: ElementId): Iterable<Edge<TSchema, any>>;

  /**
   * Get a specific vertex by its unique identifier.
   * @param id The id of the vertex.
   * @param options.throwIfNotFound If true, throws VertexNotFoundError instead of returning undefined.
   */
  getVertexById<TVertexLabel extends VertexLabel<TSchema>>(
    id: ElementId,
    options: { throwIfNotFound: true },
  ): Vertex<TSchema, TVertexLabel>;
  getVertexById<TVertexLabel extends VertexLabel<TSchema>>(
    id: ElementId,
    options?: { throwIfNotFound?: false },
  ): Vertex<TSchema, TVertexLabel> | undefined;

  /**
   * Get all vertices, optionally filtered by labels.
   * @param labels The labels to filter by.
   */
  getVertices<TVertexLabel extends VertexLabel<TSchema>>(
    ...labels: TVertexLabel[]
  ): Iterable<Vertex<TSchema, TVertexLabel>>;

  /**
   * Get a specific edge by its unique identifier.
   * @param id The id of the edge.
   * @param options.throwIfNotFound If true, throws EdgeNotFoundError instead of returning undefined.
   */
  getEdgeById<TEdgeLabel extends EdgeLabel<TSchema>>(
    id: ElementId,
    options: { throwIfNotFound: true },
  ): Edge<TSchema, TEdgeLabel>;
  getEdgeById<TEdgeLabel extends EdgeLabel<TSchema>>(
    id: ElementId,
    options?: { throwIfNotFound?: false },
  ): Edge<TSchema, TEdgeLabel> | undefined;

  /**
   * Get all edges, optionally filtered by labels.
   * @param labels The labels to filter by.
   */
  getEdges<TEdgeLabel extends EdgeLabel<TSchema>>(
    ...labels: TEdgeLabel[]
  ): Iterable<Edge<TSchema, TEdgeLabel>>;
}

/**
 * Extension of GraphSource that includes mutation methods.
 * Used by write operation steps (CREATE, DELETE, MERGE, etc.) that require
 * the ability to modify the graph. This provides compile-time type safety
 * for mutation operations instead of runtime duck-typing checks.
 */
export interface MutableGraphSource<
  TSchema extends GraphSchema,
> extends GraphSource<TSchema> {
  /**
   * Add a vertex to the graph.
   */
  addVertex<TVertexLabel extends VertexLabel<TSchema>>(
    label: TVertexLabel,
    properties: VertexProperties<TSchema, TVertexLabel>,
  ): Vertex<TSchema, TVertexLabel>;

  /**
   * Add an edge between two vertices.
   * @param outV The source vertex (where the edge originates from).
   * @param label The label of the edge.
   * @param inV The target vertex (where the edge points to).
   * @param properties The properties of the edge.
   */
  addEdge<TEdgeLabel extends EdgeLabel<TSchema>>(
    outV: ElementId | Vertex<TSchema, any>,
    label: TEdgeLabel,
    inV: ElementId | Vertex<TSchema, any>,
    properties: EdgeProperties<TSchema, TEdgeLabel>,
  ): Edge<TSchema, TEdgeLabel>;

  /**
   * Delete a vertex from the graph.
   */
  deleteVertex(id: ElementId | Vertex<TSchema, any>): void;

  /**
   * Delete an edge from the graph.
   */
  deleteEdge(id: ElementId | Edge<TSchema, any>): void;
}

export interface EmptyGraphSourceConfig<TSchema extends GraphSchema> {
  schema: TSchema;
}

export class EmptyGraphSource<
  const TSchema extends GraphSchema,
> implements GraphSource<TSchema> {
  #config: EmptyGraphSourceConfig<TSchema>;
  public constructor(config: EmptyGraphSourceConfig<TSchema>) {
    this.#config = config;
  }
  public get schema(): TSchema {
    return this.#config.schema;
  }

  public getIncomingEdges(_vertexId: ElementId): Iterable<Edge<TSchema, any>> {
    throw new Error("Cannot get incoming edges from an empty graph source.");
  }
  public getOutgoingEdges(_vertexId: ElementId): Iterable<Edge<TSchema, any>> {
    throw new Error("Cannot get outgoing edges from an empty graph source.");
  }
  public getVertexById<TVertexLabel extends VertexLabel<TSchema>>(
    _id: ElementId,
    _options: { throwIfNotFound: true },
  ): Vertex<TSchema, TVertexLabel>;
  public getVertexById<TVertexLabel extends VertexLabel<TSchema>>(
    _id: ElementId,
    _options?: { throwIfNotFound?: false },
  ): Vertex<TSchema, TVertexLabel> | undefined;
  public getVertexById<TVertexLabel extends VertexLabel<TSchema>>(
    _id: ElementId,
    _options?: { throwIfNotFound?: boolean },
  ): Vertex<TSchema, TVertexLabel> | undefined {
    throw new Error("Cannot get vertex by id from an empty graph source.");
  }
  public getVertices<TVertexLabel extends VertexLabel<TSchema>>(
    ..._labels: TVertexLabel[]
  ): Iterable<Vertex<TSchema, TVertexLabel>> {
    throw new Error("Cannot get vertices from an empty graph source.");
  }
  public getEdges<TEdgeLabel extends EdgeLabel<TSchema>>(
    ..._labels: TEdgeLabel[]
  ): Iterable<Edge<TSchema, TEdgeLabel>> {
    throw new Error("Cannot get edges from an empty graph source.");
  }
  public getEdgeById<TEdgeLabel extends EdgeLabel<TSchema>>(
    _id: ElementId,
    _options: { throwIfNotFound: true },
  ): Edge<TSchema, TEdgeLabel>;
  public getEdgeById<TEdgeLabel extends EdgeLabel<TSchema>>(
    _id: ElementId,
    _options?: { throwIfNotFound?: false },
  ): Edge<TSchema, TEdgeLabel> | undefined;
  public getEdgeById<TEdgeLabel extends EdgeLabel<TSchema>>(
    _id: ElementId,
    _options?: { throwIfNotFound?: boolean },
  ): Edge<TSchema, TEdgeLabel> | undefined {
    throw new Error("Cannot get edge by id from an empty graph source.");
  }
}

/**
 * A function that generates a unique identifier.
 * The function receives no arguments and should return a unique string.
 */
export type IdGenerator = () => string;

/**
 * Default ID generator using crypto.randomUUID().
 */
export const defaultIdGenerator: IdGenerator = () => crypto.randomUUID();

export interface GraphConfig<TSchema extends GraphSchema> {
  schema: TSchema;
  storage: GraphStorage;
  /**
   * Optional custom ID generator function.
   * If not provided, crypto.randomUUID() is used.
   */
  generateId?: IdGenerator;
  /**
   * When true, property updates are validated against the schema.
   * Setting a property that is not defined in the schema for the element's
   * label will throw a PropertyValidationError.
   * Defaults to true for strict schema validation.
   * Set to false for schema-loose mode.
   */
  validateProperties?: boolean;
}

export class Graph<
  TSchema extends GraphSchema,
> implements GraphSource<TSchema> {
  #config: GraphConfig<TSchema>;

  #vertexIdentities: WeakMap<StoredVertex, Vertex<TSchema, any>>;
  #edgeIdentities: WeakMap<StoredEdge, Edge<TSchema, any>>;
  #indexManager: IndexManager<TSchema>;

  public constructor(config: GraphConfig<TSchema>) {
    this.#config = config;
    this.#vertexIdentities = new WeakMap();
    this.#edgeIdentities = new WeakMap();
    this.#indexManager = new IndexManager(config.schema);
  }

  /**
   * The index manager for the graph.
   * Use this to access indexes for query optimization.
   */
  public get indexManager(): IndexManager<TSchema> {
    return this.#indexManager;
  }

  /**
   * The schema of the graph.
   */
  public get schema(): TSchema {
    return this.#config.schema;
  }

  /**
   * The storage of the graph.
   */
  public get storage(): GraphStorage {
    return this.#config.storage;
  }
  /**
   * Generate a new unique identifier for an element.
   */
  public generateElementId(label: string): ElementId {
    const generateId = this.#config.generateId ?? defaultIdGenerator;
    return `${label}:${generateId()}`;
  }

  /**
   * Get an element by its id.
   * @param id The id of the element.
   * @returns The element.
   */
  public getElementById<TLabel extends VertexLabel<TSchema>>(
    id: ElementId<TLabel>,
  ): Vertex<TSchema, TLabel>;
  public getElementById<TLabel extends EdgeLabel<TSchema>>(
    id: ElementId<TLabel>,
  ): Edge<TSchema, TLabel>;
  public getElementById<TLabel extends AnyLabel<TSchema>>(
    id: ElementId<TLabel>,
  ) {
    const label = getLabelFromElementId<TLabel>(id);
    if (label in this.#config.schema.vertices) {
      return this.getVertexById<TLabel>(id);
    } else if (label in this.#config.schema.edges) {
      return this.getEdgeById<TLabel>(id);
    } else {
      throw new LabelNotFoundError(label);
    }
  }

  /**
   * Instantiate a vertex from a stored vertex.
   * @param storedVertex The stored vertex.
   * @returns The instantiated vertex.
   */
  protected instantiateVertex<TVertexLabel extends VertexLabel<TSchema>>(
    storedVertex: StoredVertex,
  ): Vertex<TSchema, TVertexLabel> {
    const existing = this.#vertexIdentities.get(storedVertex);
    if (existing != null) {
      return existing;
    }
    const vertex = new Vertex<TSchema, TVertexLabel>(this, storedVertex);
    this.#vertexIdentities.set(storedVertex, vertex);
    return vertex;
  }

  /**
   * Instantiate an edge from a stored edge.
   * @param storedEdge The stored edge.
   * @returns The instantiated edge.
   */
  protected instantiateEdge<TEdgeLabel extends EdgeLabel<TSchema>>(
    storedEdge: StoredEdge,
  ): Edge<TSchema, TEdgeLabel> {
    const existing = this.#edgeIdentities.get(storedEdge);
    if (existing != null) {
      return existing;
    }
    const edge = new Edge<TSchema, TEdgeLabel>(this, storedEdge);
    this.#edgeIdentities.set(storedEdge, edge);
    return edge;
  }

  /**
   * Get a vertex by its id.
   * @param id The id of the vertex.
   * @param options.throwIfNotFound If true, throws VertexNotFoundError instead of returning undefined.
   */
  public getVertexById<TVertexLabel extends VertexLabel<TSchema>>(
    id: ElementId,
    options: { throwIfNotFound: true },
  ): Vertex<TSchema, TVertexLabel>;
  public getVertexById<TVertexLabel extends VertexLabel<TSchema>>(
    id: ElementId,
    options?: { throwIfNotFound?: false },
  ): Vertex<TSchema, TVertexLabel> | undefined;
  public getVertexById<TVertexLabel extends VertexLabel<TSchema>>(
    id: ElementId,
    options?: { throwIfNotFound?: boolean },
  ): Vertex<TSchema, TVertexLabel> | undefined {
    const data = this.#config.storage.getVertexById(id);
    if (data === undefined) {
      if (options?.throwIfNotFound) {
        throw new VertexNotFoundError(id);
      }
      return undefined;
    }
    return this.instantiateVertex<TVertexLabel>(data);
  }

  public *getVertices<TVertexLabel extends VertexLabel<TSchema>>(
    ...labels: TVertexLabel[]
  ): Iterable<Vertex<TSchema, TVertexLabel>> {
    for (const data of this.#config.storage.getVertices(labels)) {
      yield this.instantiateVertex<TVertexLabel>(data);
    }
  }

  /**
   * Get an edge by its id.
   * @param id The id of the edge.
   * @param options.throwIfNotFound If true, throws EdgeNotFoundError instead of returning undefined.
   */
  public getEdgeById<TEdgeLabel extends EdgeLabel<TSchema>>(
    id: ElementId,
    options: { throwIfNotFound: true },
  ): Edge<TSchema, TEdgeLabel>;
  public getEdgeById<TEdgeLabel extends EdgeLabel<TSchema>>(
    id: ElementId,
    options?: { throwIfNotFound?: false },
  ): Edge<TSchema, TEdgeLabel> | undefined;
  public getEdgeById<TEdgeLabel extends EdgeLabel<TSchema>>(
    id: ElementId,
    options?: { throwIfNotFound?: boolean },
  ): Edge<TSchema, TEdgeLabel> | undefined {
    const data = this.#config.storage.getEdgeById(id);
    if (data === undefined) {
      if (options?.throwIfNotFound) {
        throw new EdgeNotFoundError(id);
      }
      return undefined;
    }
    return this.instantiateEdge<TEdgeLabel>(data);
  }

  public *getEdges<TEdgeLabel extends EdgeLabel<TSchema>>(
    ...labels: TEdgeLabel[]
  ): Iterable<Edge<TSchema, TEdgeLabel>> {
    for (const data of this.#config.storage.getEdges(labels)) {
      yield this.instantiateEdge<TEdgeLabel>(data);
    }
  }

  public *getIncomingEdges(vertexId: ElementId): Iterable<Edge<TSchema, any>> {
    for (const data of this.#config.storage.getIncomingEdges(vertexId)) {
      yield this.instantiateEdge<any>(data);
    }
  }

  public *getOutgoingEdges(vertexId: ElementId): Iterable<Edge<TSchema, any>> {
    for (const data of this.#config.storage.getOutgoingEdges(vertexId)) {
      yield this.instantiateEdge<any>(data);
    }
  }

  /**
   * Add a vertex to the graph.
   * @param partialVertex The vertex to add.
   * @throws PropertyValidationError if validateProperties is enabled and a property key is not in schema.
   * @throws PropertyTypeError if validateProperties is enabled and a property value fails validation.
   * @throws AsyncValidationError if a schema returns async validation (not supported).
   * @throws UniqueConstraintViolationError if a unique constraint would be violated.
   */
  public addVertex<TVertexLabel extends VertexLabel<TSchema>>(partialVertex: {
    label: TVertexLabel;
    properties: VertexProperties<TSchema, TVertexLabel>;
  }): Vertex<TSchema, TVertexLabel>;
  /**
   * Add a vertex to the graph.
   * @param label The label of the vertex
   * @param properties The properties of the vertex
   * @throws PropertyValidationError if validateProperties is enabled and a property key is not in schema.
   * @throws PropertyTypeError if validateProperties is enabled and a property value fails validation.
   * @throws AsyncValidationError if a schema returns async validation (not supported).
   * @throws UniqueConstraintViolationError if a unique constraint would be violated.
   */
  public addVertex<TVertexLabel extends VertexLabel<TSchema>>(
    label: TVertexLabel,
    properties: VertexProperties<TSchema, TVertexLabel>,
  ): Vertex<TSchema, TVertexLabel>;
  public addVertex(...args: any[]) {
    let label: string;
    let properties: Record<string, unknown>;
    if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
      label = args[0].label;
      properties = args[0].properties;
    } else {
      label = args[0];
      properties = args[1];
    }

    // Validate and transform properties when validation is enabled
    const validateProperties = this.#config.validateProperties ?? true;
    if (validateProperties) {
      const schemaProperties = this.#config.schema.vertices[label]?.properties;
      properties = parseProperties(label, properties, schemaProperties);
    }

    const data: StoredVertex = {
      "@type": "Vertex",
      id: this.generateElementId(label),
      properties,
    };

    // Ensure unique indexes are built before checking constraints
    this.#indexManager.ensureUniqueIndexesBuilt(
      label,
      this.#config.storage.getVertices([label]),
    );

    // Check unique constraints before adding (throws if violated)
    this.#indexManager.checkAllUniqueConstraints(
      label,
      data.properties as Record<string, unknown>,
    );

    // Add to storage
    this.#config.storage.addVertex(data);

    // Add to indexes
    this.#indexManager.onElementAdd(data);

    return this.instantiateVertex(data);
  }

  /**
   * Delete a vertex from the graph.
   * @param id The id of the vertex to delete, or the vertex itself.
   */
  public deleteVertex(id: ElementId | Vertex<TSchema, any>): void {
    if (typeof id === "object") {
      id = id.id;
    }
    const vertex = this.#config.storage.getVertexById(id);
    if (vertex) {
      this.#indexManager.onElementRemove(vertex);
    }
    this.#config.storage.deleteVertex(id);
  }

  /**
   * Add an edge to the graph.
   * @param outV The vertex that the edge originates from (source).
   * @param label The label of the edge.
   * @param inV The vertex that the edge points to (target).
   * @param properties The properties of the edge.
   * @throws PropertyValidationError if validateProperties is enabled and a property key is not in schema.
   * @throws PropertyTypeError if validateProperties is enabled and a property value fails validation.
   * @throws AsyncValidationError if a schema returns async validation (not supported).
   * @throws UniqueConstraintViolationError if a unique constraint would be violated.
   */
  public addEdge<TEdgeLabel extends EdgeLabel<TSchema>>(partialEdge: {
    id?: ElementId;
    outV: Vertex<TSchema, any> | ElementId;
    label: TEdgeLabel;
    inV: Vertex<TSchema, any> | ElementId;
    properties: EdgeProperties<TSchema, TEdgeLabel>;
  }): Edge<TSchema, TEdgeLabel>;
  public addEdge<TEdgeLabel extends EdgeLabel<TSchema>>(
    outV: Vertex<TSchema, any> | ElementId,
    label: TEdgeLabel,
    inV: Vertex<TSchema, any> | ElementId,
    properties: EdgeProperties<TSchema, TEdgeLabel>,
  ): Edge<TSchema, TEdgeLabel>;
  public addEdge(...args: any[]) {
    let rawOutV: Vertex<TSchema, any> | ElementId;
    let label: EdgeLabel<TSchema>;
    let rawInV: Vertex<TSchema, any> | ElementId;
    let properties: EdgeProperties<TSchema, any>;
    if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
      ({ outV: rawOutV, label, inV: rawInV, properties } = args[0]);
    } else {
      [rawOutV, label, rawInV, properties] = args;
    }

    // Validate and transform properties when validation is enabled
    const validateProperties = this.#config.validateProperties ?? true;
    if (validateProperties) {
      const schemaProperties = this.#config.schema.edges[label]?.properties;
      properties = parseProperties(label, properties, schemaProperties);
    }

    const id = this.generateElementId(label);

    const outV =
      typeof rawOutV === "object" ? rawOutV : this.getVertexById(rawOutV);
    const inV =
      typeof rawInV === "object" ? rawInV : this.getVertexById(rawInV);

    if (outV == null) {
      throw new VertexNotFoundError(rawOutV as ElementId);
    }
    if (inV == null) {
      throw new VertexNotFoundError(rawInV as ElementId);
    }
    const data: StoredEdge = {
      "@type": "Edge",
      id,
      properties,
      inV: inV.id,
      outV: outV.id,
    };

    // Ensure unique indexes are built before checking constraints
    this.#indexManager.ensureUniqueIndexesBuilt(
      label,
      this.#config.storage.getEdges([label]),
    );

    // Check unique constraints before adding (throws if violated)
    this.#indexManager.checkAllUniqueConstraints(label, properties);

    // Add to storage
    this.#config.storage.addEdge(data);

    // Add to indexes
    this.#indexManager.onElementAdd(data);

    const edge = this.instantiateEdge(data);

    return edge;
  }

  /**
   * Delete an edge from the graph.
   * @param id The id of the edge to delete, or the edge itself.
   */
  public deleteEdge(id: ElementId | Edge<TSchema, any>): void {
    if (typeof id === "object") {
      id = id.id;
    }
    const edge = this.#config.storage.getEdgeById(id);
    if (edge) {
      this.#indexManager.onElementRemove(edge);
    }
    this.#config.storage.deleteEdge(id);
  }

  /**
   * Update a property of a vertex or edge.
   * @param id The id of the vertex or edge, or the vertex or edge itself.
   * @param key The key of the property.
   * @param value The value of the property.
   * @throws PropertyValidationError if validateProperties is enabled and key is not in schema.
   * @throws PropertyTypeError if validateProperties is enabled and value fails type validation.
   * @throws AsyncValidationError if schema returns async validation (not supported).
   * @throws UniqueConstraintViolationError if a unique constraint would be violated.
   */
  public updateProperty(
    id: ElementId | Vertex<TSchema, any> | Edge<TSchema, any>,
    key: string,
    value: any,
  ): void {
    if (typeof id === "object") {
      id = id.id;
    }
    const label = getLabelFromElementId(id);
    const isVertex = label in this.#config.schema.vertices;
    const isEdge = label in this.#config.schema.edges;

    // Validate and transform property value when validation is enabled (default: false)
    let parsedValue = value;
    const validateProperties = this.#config.validateProperties ?? true;
    if (validateProperties) {
      const schemaProperties = isVertex
        ? this.#config.schema.vertices[label]?.properties
        : isEdge
          ? this.#config.schema.edges[label]?.properties
          : undefined;
      // parsePropertyValue validates key exists and transforms value
      parsedValue = parsePropertyValue(key, label, value, schemaProperties);
    }

    // Ensure unique indexes are built before checking constraints
    if (this.#indexManager.isUnique(label, key)) {
      const elements = isVertex
        ? this.#config.storage.getVertices([label])
        : this.#config.storage.getEdges([label]);
      this.#indexManager.ensureUniqueIndexesBuilt(label, elements);

      // Check unique constraint (exclude current element since it's an update)
      // Use parsedValue for unique constraint check
      this.#indexManager.checkUniqueConstraint(label, key, parsedValue, id);
    }

    const element = isVertex
      ? this.#config.storage.getVertexById(id)
      : isEdge
        ? this.#config.storage.getEdgeById(id)
        : undefined;
    const oldValue = element
      ? (element.properties as Record<string, unknown>)[key]
      : undefined;
    // Store the parsed/transformed value, not the raw input
    this.#config.storage.updateProperty(id, key, parsedValue);
    if (element) {
      this.#indexManager.onPropertyUpdate(id, key, oldValue, parsedValue);
    }
  }

  public toJSON() {
    return {
      "@type": "Graph" as const,
      vertices: Array.from(this.getVertices(), (v) => v.toJSON()),
      edges: Array.from(this.getEdges(), (e) => e.toJSON()),
    };
  }
}

export const $StoredElement = Symbol("$StoredElement");

/**
 * The base class for all elements in the graph.
 */
export abstract class Element<
  const TSchema extends GraphSchema,
  const TLabel,
  const TProperties,
  const TStoredElement extends StoredElement,
> {
  #graph: Graph<TSchema>;
  [$StoredElement]: TStoredElement;
  #parsedId: [label: TLabel, uuid: string] | undefined;

  public constructor(graph: Graph<TSchema>, storedElement: TStoredElement) {
    this.#graph = graph;
    this[$StoredElement] = storedElement;
  }

  /**
   * The graph that the element belongs to.
   */
  public get graph(): Graph<TSchema> {
    return this.#graph;
  }

  /**
   * The unique identifier of the element.
   */
  public get id(): ElementId<TLabel & string> {
    return this[$StoredElement].id as ElementId<TLabel & string>;
  }

  /**
   * The label of the element.
   */
  public get label(): TLabel {
    if (this.#parsedId == null) {
      this.#parsedId = parseElementId<TLabel & string>(
        this[$StoredElement].id as any,
      );
    }
    return this.#parsedId[0];
  }

  /**
   * The uuid of the element.
   */
  public get uuid(): string {
    if (this.#parsedId == null) {
      this.#parsedId = parseElementId<TLabel & string>(
        this[$StoredElement].id as any,
      );
    }
    return this.#parsedId[1];
  }

  /**
   * Check if the element has a specific label.
   */
  public hasLabel<TOtherLabel>(
    label: TOtherLabel,
  ): this is Element<TSchema, TOtherLabel, TProperties, TStoredElement> {
    return this.label === (label as unknown);
  }

  /**
   * Check if the element has a specific property.
   * @param key The key of the property.
   */
  public hasProperty<TKey extends string>(
    key: TKey,
  ): this is Element<
    TSchema,
    TLabel,
    TProperties & { [K in TKey]: any },
    TStoredElement
  >;
  /**
   * Check if the element has a specific property with a specific value.
   * @param key The key of the property.
   * @param value The value of the property.
   */
  public hasProperty<TKey extends keyof TProperties>(
    key: TKey,
    value: TProperties[TKey],
  ): this is Element<
    TSchema,
    TLabel,
    TProperties & { [K in TKey]: TProperties[TKey] },
    TStoredElement
  >;
  public hasProperty(key: string, value: any = undefined) {
    if (value === undefined) {
      return this[$StoredElement].properties[key as keyof object] !== undefined;
    }
    return this[$StoredElement].properties[key as keyof object] === value;
  }

  /**
   * Get a specific property of the element.
   * @param key The key of the property.
   */
  public get<TKey extends keyof TProperties>(key: TKey): TProperties[TKey] {
    return this[$StoredElement].properties[key as keyof object];
  }

  /**
   * Set a property of the element.
   * @param key The key of the property.
   * @param value The value of the property.
   */
  public set<TKey extends keyof TProperties>(
    key: TKey,
    value: TProperties[TKey],
  ): void {
    this.#graph.updateProperty(this.id, key as string, value);
  }

  /**
   * A string representation of the element.
   */
  public toString() {
    return `${this.id}`;
  }

  /**
   * A JSON representation of the element.
   */
  public abstract toJSON(): object;
}

type VertexLabelsWithProperty<
  TSchema extends GraphSchema,
  TProperty extends string,
> = keyof {
  [K in keyof TSchema["vertices"] as TProperty extends keyof TSchema["vertices"][K]["properties"]
    ? K
    : never]: true;
};

export class Vertex<
  const TSchema extends GraphSchema,
  const TVertexLabel extends VertexLabel<TSchema> = VertexLabel<TSchema>,
> extends Element<
  TSchema,
  TVertexLabel,
  VertexProperties<TSchema, TVertexLabel>,
  StoredVertex
> {
  public toJSON(): StoredVertex {
    return this[$StoredElement];
  }

  /**
   * Check if the element has a specific property.
   * @param key The key of the property.
   */
  public hasProperty<const TKey extends string>(
    key: TKey,
  ): this is Vertex<
    TSchema,
    [TVertexLabel] extends [VertexLabel<TSchema>]
      ? TVertexLabel & VertexLabelsWithProperty<TSchema, TKey>
      : TVertexLabel
  >;
  /**
   * Check if the element has a specific property with a specific value.
   * @param key The key of the property.
   * @param value The value of the property.
   */
  public hasProperty<
    const TKey extends keyof VertexProperties<TSchema, TVertexLabel>,
  >(
    key: TKey,
    value: VertexProperties<TSchema, TVertexLabel>[TKey],
  ): this is Vertex<
    TSchema,
    TVertexLabel & VertexLabelsWithProperty<TSchema, TKey>
  >;
  public hasProperty(key: string, value: any = undefined) {
    if (value === undefined) {
      return this[$StoredElement].properties[key as keyof object] !== undefined;
    }
    return this[$StoredElement].properties[key as keyof object] === value;
  }

  [customInspectSymbol]() {
    return `Vertex("${this.id}", ${JSON.stringify(this[$StoredElement].properties)})`;
  }
}

export class Edge<
  const TSchema extends GraphSchema,
  const TEdgeLabel extends EdgeLabel<TSchema> = EdgeLabel<TSchema>,
> extends Element<
  TSchema,
  TEdgeLabel,
  EdgeProperties<TSchema, TEdgeLabel>,
  StoredEdge
> {
  /**
   * The vertex that the edge points to (target).
   * Named "inV" because this is the vertex the edge goes INTO.
   */
  public get inV(): Vertex<TSchema, any> {
    const vertex = this.graph.getVertexById(this[$StoredElement].inV);
    if (vertex == null) {
      throw new GraphConsistencyError(
        `Vertex with id ${this[$StoredElement].inV} not found`,
      );
    }
    return vertex;
  }

  /**
   * The vertex that the edge originates from (source).
   * Named "outV" because this is the vertex the edge comes OUT of.
   */
  public get outV(): Vertex<TSchema, any> {
    const vertex = this.graph.getVertexById(this[$StoredElement].outV);
    if (vertex == null) {
      throw new GraphConsistencyError(
        `Vertex with id ${this[$StoredElement].outV} not found`,
      );
    }
    return vertex;
  }

  public toJSON(): StoredEdge {
    return this[$StoredElement];
  }

  [customInspectSymbol]() {
    return `Edge("${this.id}", ${JSON.stringify(this[$StoredElement].properties)})`;
  }
}
