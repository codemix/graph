import { EdgeNotFoundError, ElementNotFoundError, VertexNotFoundError } from "./Exceptions.js";

export type ElementId<TLabel extends string = string> = `${TLabel}:${string}`;

/**
 * Parse an element id into a label and a uuid.
 * @param id The element id.
 * @returns The label and uuid.
 */
export function parseElementId<TLabel extends string = string>(
  id: ElementId<TLabel>,
): [label: TLabel, uuid: string] {
  const parts = id.split(":", 2);
  if (parts.length !== 2) {
    throw new Error(`Invalid element id: ${id}`);
  }
  return parts as [TLabel, string];
}

/**
 * Get the label from an element id.
 * @param id The element id.
 * @returns The label.
 */
export function getLabelFromElementId<const TLabel extends string>(id: ElementId<TLabel>): TLabel {
  for (let i = 0; i < id.length; i++) {
    if (id.charAt(i) === ":") {
      return id.slice(0, i) as TLabel;
    }
  }
  throw new Error(`Invalid element id: ${id}`);
}

export interface GraphStorage {
  /**
   * Get a specific vertex by its unique identifier.
   */
  getVertexById(id: ElementId): StoredVertex | undefined;

  /**
   * Get all vertices, optionally filtered by labels.
   * @param labels The labels to filter by.
   */
  getVertices(labels: string[]): Iterable<StoredVertex>;

  /**
   * Get multiple vertices by their IDs efficiently.
   * Used for index lookups where we already know the element IDs.
   * @param ids The element IDs to fetch.
   */
  getVerticesByIds(ids: Iterable<ElementId>): Iterable<StoredVertex>;

  /**
   * Get a specific edge by its unique identifier.
   */
  getEdgeById(id: ElementId): StoredEdge | undefined;

  /**
   * Get all edges, optionally filtered by labels.
   * @param labels The labels to filter by.
   */
  getEdges(labels: string[]): Iterable<StoredEdge>;

  /**
   * Get multiple edges by their IDs efficiently.
   * Used for index lookups where we already know the element IDs.
   * @param ids The element IDs to fetch.
   */
  getEdgesByIds(ids: Iterable<ElementId>): Iterable<StoredEdge>;

  /**
   * Get all incoming edges of a vertex.
   * @param vertexId The id of the vertex.
   */
  getIncomingEdges(vertexId: ElementId): Iterable<StoredEdge>;

  /**
   * Get all outgoing edges of a vertex.
   * @param vertexId The id of the vertex.
   */
  getOutgoingEdges(vertexId: ElementId): Iterable<StoredEdge>;

  /**
   * Add a vertex to the graph.
   * @param vertex The vertex to add.
   */
  addVertex(vertex: StoredVertex): void;

  /**
   * Add an edge to the graph.
   * @param edge The edge to add.
   */
  addEdge(edge: StoredEdge): void;

  /**
   * Delete a vertex from the graph.
   * @param id The id of the vertex to delete.
   */
  deleteVertex(id: ElementId): void;

  /**
   * Delete an edge from the graph.
   * @param id The id of the edge to delete.
   */
  deleteEdge(id: ElementId): void;

  /**
   * Update a property of a vertex or edge.
   * @param id The id of the vertex or edge.
   * @param key The key of the property.
   * @param value The value of the property.
   */
  updateProperty(id: ElementId, key: string, value: any): void;
}

export interface StoredElement {
  id: ElementId;
  properties: object;
}

export interface StoredVertex extends StoredElement {
  "@type": "Vertex";
}

export interface StoredEdge extends StoredElement {
  "@type": "Edge";
  inV: ElementId;
  outV: ElementId;
}

export class InMemoryGraphStorage implements GraphStorage {
  #vertices: Map<ElementId, StoredVertex>;
  #edges: Map<ElementId, StoredEdge>;
  #incomingEdges: Map<ElementId, StoredEdge[]>;
  #outgoingEdges: Map<ElementId, StoredEdge[]>;

  public constructor(data?: { vertices: StoredVertex[]; edges: StoredEdge[] }) {
    const vertices: Map<ElementId, StoredVertex> = new Map();
    const edges: Map<ElementId, StoredEdge> = new Map();

    this.#vertices = vertices;
    this.#edges = edges;
    this.#incomingEdges = new Map();
    this.#outgoingEdges = new Map();
    if (data != null) {
      for (const vertex of data.vertices) {
        this.addVertex(vertex);
      }
      for (const edge of data.edges) {
        this.addEdge(edge);
      }
    }
  }

  protected get vertices(): Map<ElementId, StoredVertex> {
    return this.#vertices;
  }

  protected get edges(): Map<ElementId, StoredEdge> {
    return this.#edges;
  }

  protected get incomingEdges(): Map<ElementId, StoredEdge[]> {
    return this.#incomingEdges;
  }

  protected get outgoingEdges(): Map<ElementId, StoredEdge[]> {
    return this.#outgoingEdges;
  }

  public getVertexById(id: ElementId): StoredVertex | undefined {
    return this.#vertices.get(id);
  }

  public *getVertices(labels: string[]): Iterable<StoredVertex> {
    // Snapshot keys to prevent infinite loops when vertices are added during iteration.
    // Keys are just strings so this is cheap; actual vertex data is still fetched lazily.
    const keys = [...this.#vertices.keys()];
    for (const key of keys) {
      const vertex = this.#vertices.get(key);
      if (
        vertex !== undefined &&
        (labels.length === 0 || labels.includes(getLabelFromElementId(vertex.id)))
      ) {
        yield vertex;
      }
    }
  }

  public *getVerticesByIds(ids: Iterable<ElementId>): Iterable<StoredVertex> {
    for (const id of ids) {
      const vertex = this.#vertices.get(id);
      if (vertex !== undefined) {
        yield vertex;
      }
    }
  }

  public getEdgeById(id: ElementId): StoredEdge | undefined {
    return this.#edges.get(id);
  }

  public *getEdges(labels: string[]): Iterable<StoredEdge> {
    // Snapshot keys to prevent infinite loops when edges are added during iteration.
    // Keys are just strings so this is cheap; actual edge data is still fetched lazily.
    const keys = [...this.#edges.keys()];
    for (const key of keys) {
      const edge = this.#edges.get(key);
      if (
        edge !== undefined &&
        (labels.length === 0 || labels.includes(getLabelFromElementId(edge.id)))
      ) {
        yield edge;
      }
    }
  }

  public *getEdgesByIds(ids: Iterable<ElementId>): Iterable<StoredEdge> {
    for (const id of ids) {
      const edge = this.#edges.get(id);
      if (edge !== undefined) {
        yield edge;
      }
    }
  }

  public addVertex(vertex: StoredVertex): void {
    if (this.#vertices.has(vertex.id)) {
      throw new Error(`Vertex with id ${vertex.id} already exists`);
    }
    this.#vertices.set(vertex.id, vertex);
  }

  public deleteVertex(id: ElementId): void {
    const vertex = this.#vertices.get(id);
    if (vertex == null) {
      throw new VertexNotFoundError(id);
    }
    // For incoming edges, this vertex is the target (inV)
    // We need to remove the edge from the source's outgoing edges
    const incomingEdges = this.#incomingEdges.get(id);
    if (incomingEdges != null) {
      for (const edge of incomingEdges) {
        // edge.outV is the source - remove from its outgoing edges
        const outgoingEdges = this.#outgoingEdges.get(edge.outV);
        if (outgoingEdges != null) {
          const index = outgoingEdges.indexOf(edge);
          if (index !== -1) {
            outgoingEdges.splice(index, 1);
          }
        }
        this.#edges.delete(edge.id);
      }
      this.#incomingEdges.delete(id);
    }
    // For outgoing edges, this vertex is the source (outV)
    // We need to remove the edge from the target's incoming edges
    const outgoingEdges = this.#outgoingEdges.get(id);
    if (outgoingEdges != null) {
      for (const edge of outgoingEdges) {
        // edge.inV is the target - remove from its incoming edges
        const incomingEdges = this.#incomingEdges.get(edge.inV);
        if (incomingEdges != null) {
          const index = incomingEdges.indexOf(edge);
          if (index !== -1) {
            incomingEdges.splice(index, 1);
          }
        }
        this.#edges.delete(edge.id);
      }
      this.#outgoingEdges.delete(id);
    }
    this.#vertices.delete(id);
  }

  public addEdge(edge: StoredEdge): void {
    if (this.#edges.has(edge.id)) {
      throw new Error(`Edge with id ${edge.id} already exists`);
    }
    this.#edges.set(edge.id, edge);
    // inV is the target - it receives incoming edges
    const incomingEdges = this.#incomingEdges.get(edge.inV);
    if (incomingEdges == null) {
      this.#incomingEdges.set(edge.inV, [edge]);
    } else {
      incomingEdges.push(edge);
    }
    // outV is the source - it has outgoing edges
    const outgoingEdges = this.#outgoingEdges.get(edge.outV);
    if (outgoingEdges == null) {
      this.#outgoingEdges.set(edge.outV, [edge]);
    } else {
      outgoingEdges.push(edge);
    }
  }

  public deleteEdge(id: ElementId): void {
    const edge = this.#edges.get(id);
    if (edge == null) {
      throw new EdgeNotFoundError(id);
    }
    // edge.inV is the target - remove from target's incoming edges
    const incomingEdges = this.#incomingEdges.get(edge.inV);
    if (incomingEdges != null) {
      const index = incomingEdges.indexOf(edge);
      if (index !== -1) {
        incomingEdges.splice(index, 1);
      }
    }
    // edge.outV is the source - remove from source's outgoing edges
    const outgoingEdges = this.#outgoingEdges.get(edge.outV);
    if (outgoingEdges != null) {
      const index = outgoingEdges.indexOf(edge);
      if (index !== -1) {
        outgoingEdges.splice(index, 1);
      }
    }
    this.#edges.delete(id);
  }

  public getIncomingEdges(vertexId: ElementId): Iterable<StoredEdge> {
    const existing = this.#incomingEdges.get(vertexId);
    if (existing != null) {
      return existing;
    }
    const edges = [] as StoredEdge[];
    this.#incomingEdges.set(vertexId, edges);
    return edges;
  }

  public getOutgoingEdges(vertexId: ElementId): Iterable<StoredEdge> {
    const existing = this.#outgoingEdges.get(vertexId);
    if (existing != null) {
      return existing;
    }
    const edges = [] as StoredEdge[];
    this.#outgoingEdges.set(vertexId, edges);
    return edges;
  }

  public updateProperty(id: ElementId, key: string, value: any): void {
    const element = this.#vertices.get(id) ?? this.#edges.get(id);
    if (element == null) {
      throw new ElementNotFoundError(id);
    }
    (element.properties as any)[key] = value;
  }

  /**
   * Get the statistics of the graph.
   */
  public statistics() {
    return {
      vertices: this.#vertices.size,
      edges: this.#edges.size,
    };
  }
}
