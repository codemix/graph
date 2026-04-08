import {
  type ElementId,
  type StoredVertex,
  type GraphStorage,
  parseElementId,
  StoredEdge,
  GraphSchema,
  LabelNotFoundError,
  VertexNotFoundError,
  EdgeNotFoundError,
  ElementNotFoundError,
} from "@codemix/graph";
import * as Y from "yjs";
import { createLazyPropertyDictionary } from "./LazyPropertyDictionary.js";

export interface YGraphStorageConfig {
  schema: GraphSchema;
}

function makeInternalKey(key: string): string {
  return `@${key}`;
}

export const $InVKey = makeInternalKey("inV");
export const $OutVKey = makeInternalKey("outV");

export const $InEKey = makeInternalKey("inE");
export const $OutEKey = makeInternalKey("outE");

export class YGraphStorage implements GraphStorage {
  #doc: Y.Doc;
  #config: YGraphStorageConfig;
  #vertexIdentities: WeakMap<Y.Map<unknown>, StoredVertex>;
  #edgeIdentities: WeakMap<Y.Map<unknown>, StoredEdge>;

  public constructor(doc: Y.Doc, config: YGraphStorageConfig) {
    this.#doc = doc;
    this.#config = config;
    this.#vertexIdentities = new WeakMap();
    this.#edgeIdentities = new WeakMap();
  }

  public get doc(): Y.Doc {
    return this.#doc;
  }

  public getVertexCollectionMap(label: string): Y.Map<Y.Map<unknown>> {
    if (!(label in this.#config.schema.vertices)) {
      throw new LabelNotFoundError(label);
    }
    return this.#doc.getMap(`V:${label}`);
  }

  public getEdgeCollectionMap(label: string): Y.Map<Y.Map<unknown>> {
    if (!(label in this.#config.schema.edges)) {
      throw new LabelNotFoundError(label);
    }
    return this.#doc.getMap(`E:${label}`);
  }

  protected getVertexProperties(
    label: string,
    uuid: string,
    map: Y.Map<unknown>,
  ): object {
    const schema = this.#config.schema.vertices[label];
    if (schema == null) {
      throw new LabelNotFoundError(label);
    }
    return createLazyPropertyDictionary(schema, map);
  }

  protected getEdgeProperties(
    label: string,
    uuid: string,
    map: Y.Map<unknown>,
  ): object {
    const schema = this.#config.schema.edges[label];
    if (schema == null) {
      throw new LabelNotFoundError(label);
    }
    return createLazyPropertyDictionary(schema, map);
  }

  public getVertexById(id: ElementId): StoredVertex | undefined {
    const [label, uuid] = parseElementId(id);
    const collection = this.getVertexCollectionMap(label);
    const data = collection.get(uuid);
    if (data == null) {
      return undefined;
    }
    const existing = this.#vertexIdentities.get(data);
    if (existing != null) {
      return existing;
    }
    const vertex: StoredVertex = {
      "@type": "Vertex",
      id,
      properties: this.getVertexProperties(label, uuid, data),
    };
    this.#vertexIdentities.set(data, vertex);
    return vertex;
  }

  public *getVerticesByIds(ids: ElementId[]): Iterable<StoredVertex> {
    for (const id of ids) {
      const vertex = this.getVertexById(id);
      if (vertex != null) {
        yield vertex;
      }
    }
  }

  public *getVertices(labels: string[]): Iterable<StoredVertex> {
    if (labels.length === 0) {
      labels = Object.keys(this.#config.schema.vertices) as string[];
    }
    for (const label of labels) {
      for (const [uuid, data] of this.getVertexCollectionMap(label)) {
        const id = `${label}:${uuid}` as ElementId;
        const existing = this.#vertexIdentities.get(data);
        if (existing != null) {
          yield existing;
        } else {
          const vertex: StoredVertex = {
            "@type": "Vertex",
            id,
            properties: this.getVertexProperties(label, uuid, data),
          };
          this.#vertexIdentities.set(data, vertex);
          yield vertex;
        }
      }
    }
  }

  public getEdgeById(id: ElementId): StoredEdge | undefined {
    const [label, uuid] = parseElementId(id);
    const collection = this.getEdgeCollectionMap(label);
    const data = collection.get(uuid);
    if (data == null) {
      return undefined;
    }
    const existing = this.#edgeIdentities.get(data);
    if (existing != null) {
      return existing;
    }
    const inV = data.get($InVKey) as ElementId | undefined;
    if (inV == null) {
      return undefined;
    }
    const outV = data.get($OutVKey) as ElementId | undefined;
    if (outV == null) {
      return undefined;
    }
    const properties = this.getEdgeProperties(label, uuid, data);
    const edge: StoredEdge = { "@type": "Edge", id, properties, inV, outV };
    this.#edgeIdentities.set(data, edge);
    return edge;
  }

  public *getEdgesByIds(ids: ElementId[]): Iterable<StoredEdge> {
    for (const id of ids) {
      const edge = this.getEdgeById(id);
      if (edge != null) {
        yield edge;
      }
    }
  }

  public *getEdges(labels: string[]): Iterable<StoredEdge> {
    if (labels.length === 0) {
      labels = Object.keys(this.#config.schema.edges) as string[];
    }
    for (const label of labels) {
      for (const [uuid, data] of this.getEdgeCollectionMap(label)) {
        const id = `${label}:${uuid}` as ElementId;
        const existing = this.#edgeIdentities.get(data);
        if (existing != null) {
          yield existing;
        } else {
          const inV = data.get($InVKey) as ElementId | undefined;
          if (inV == null) {
            continue;
          }
          const outV = data.get($OutVKey) as ElementId | undefined;
          if (outV == null) {
            continue;
          }
          const properties = this.getEdgeProperties(label, uuid, data);
          const edge: StoredEdge = {
            "@type": "Edge",
            id,
            properties,
            inV,
            outV,
          };
          this.#edgeIdentities.set(data, edge);
          yield edge;
        }
      }
    }
  }

  public *getIncomingEdges(vertexId: ElementId): Iterable<StoredEdge> {
    const [label, uuid] = parseElementId(vertexId);
    const collection = this.getVertexCollectionMap(label);
    const data = collection.get(uuid);
    if (data == null) {
      return;
    }
    const incomingEdges = data.get($InEKey) as undefined | Y.Map<unknown>;
    if (incomingEdges == null) {
      return;
    }
    for (const edgeId of incomingEdges.keys() as IterableIterator<ElementId>) {
      const edge = this.getEdgeById(edgeId);
      if (edge == null) {
        continue;
      }
      yield edge;
    }
  }

  public *getOutgoingEdges(vertexId: ElementId): Iterable<StoredEdge> {
    const [label, uuid] = parseElementId(vertexId);
    const collection = this.getVertexCollectionMap(label);
    const data = collection.get(uuid);
    if (data == null) {
      return;
    }
    const outgoingEdges = data.get($OutEKey) as undefined | Y.Map<unknown>;
    if (outgoingEdges == null) {
      return;
    }
    for (const edgeId of outgoingEdges.keys() as IterableIterator<ElementId>) {
      const edge = this.getEdgeById(edgeId);
      if (edge == null) {
        continue;
      }
      yield edge;
    }
  }

  public addVertex(vertex: StoredVertex): void {
    const [label, uuid] = parseElementId(vertex.id);
    const schema = this.#config.schema.vertices[label];
    if (schema == null) {
      throw new LabelNotFoundError(label);
    }
    const collection = this.getVertexCollectionMap(label);
    this.transact(() => {
      const map = new Y.Map<unknown>();

      collection.set(uuid, map);
      for (const [key] of Object.entries(schema.properties)) {
        const value = vertex.properties[key as keyof typeof vertex.properties];
        if (value === undefined) {
          continue;
        }
        map.set(key, value);
      }
    });
  }

  public deleteVertex(id: ElementId): void {
    const [label, uuid] = parseElementId(id);
    const collection = this.getVertexCollectionMap(label);
    const data = collection.get(uuid);
    if (data == null) {
      throw new VertexNotFoundError(id);
    }
    this.transact(() => {
      // For incoming edges, this vertex is the target (inV)
      // We need to remove the edge from the source's outgoing edges
      const incomingEdges = data.get($InEKey) as undefined | Y.Map<unknown>;
      if (incomingEdges != null) {
        for (const edgeId of incomingEdges.keys() as IterableIterator<ElementId>) {
          const [edgeLabel, edgeUuid] = parseElementId(edgeId);
          const edgeCollection = this.getEdgeCollectionMap(edgeLabel);
          const edgeData = edgeCollection.get(edgeUuid);
          if (edgeData == null) {
            continue;
          }
          // Get the source vertex (outV) and remove from its outgoing edges
          const sourceV = edgeData.get($OutVKey) as ElementId | undefined;
          if (sourceV == null) {
            continue;
          }
          const sourceOutgoingEdges = this.getVertexMap(sourceV)?.get(
            $OutEKey,
          ) as undefined | Y.Map<unknown>;
          if (sourceOutgoingEdges != null) {
            sourceOutgoingEdges.delete(edgeId);
          }
          edgeCollection.delete(edgeUuid);
        }
      }
      // For outgoing edges, this vertex is the source (outV)
      // We need to remove the edge from the target's incoming edges
      const outgoingEdges = data.get($OutEKey) as undefined | Y.Map<unknown>;
      if (outgoingEdges != null) {
        for (const edgeId of outgoingEdges.keys() as IterableIterator<ElementId>) {
          const [edgeLabel, edgeUuid] = parseElementId(edgeId);
          const edgeCollection = this.getEdgeCollectionMap(edgeLabel);
          const edgeData = edgeCollection.get(edgeUuid);
          if (edgeData == null) {
            continue;
          }
          // Get the target vertex (inV) and remove from its incoming edges
          const targetV = edgeData.get($InVKey) as ElementId | undefined;
          if (targetV != null) {
            const targetIncomingEdges = this.getVertexMap(targetV)?.get(
              $InEKey,
            ) as undefined | Y.Map<unknown>;
            if (targetIncomingEdges != null) {
              targetIncomingEdges.delete(edgeId);
            }
          }
          edgeCollection.delete(edgeUuid);
        }
      }
      collection.delete(uuid);
    });
  }

  public addEdge(edge: StoredEdge): void {
    const [label, uuid] = parseElementId(edge.id);
    const schema = this.#config.schema.edges[label];
    if (schema == null) {
      throw new LabelNotFoundError(label);
    }
    // inV is the target vertex, outV is the source vertex
    const inVMap = this.getVertexMap(edge.inV);
    const outVMap = this.getVertexMap(edge.outV);
    const collection = this.getEdgeCollectionMap(label);
    this.transact(() => {
      const map = new Y.Map<unknown>();
      map.set($InVKey, edge.inV);
      map.set($OutVKey, edge.outV);
      collection.set(uuid, map);
      for (const key of Object.keys(schema.properties)) {
        const value = edge.properties[key as keyof typeof edge.properties];
        if (value === undefined) {
          continue;
        }
        map.set(key, value);
      }

      // inV (target) receives incoming edges
      let incomingEdges = inVMap.get($InEKey) as undefined | Y.Map<unknown>;
      if (incomingEdges == null) {
        incomingEdges = new Y.Map<unknown>([[edge.id, true]]);
        inVMap.set($InEKey, incomingEdges);
      } else {
        incomingEdges.set(edge.id, true);
      }
      // outV (source) has outgoing edges
      let outgoingEdges = outVMap.get($OutEKey) as undefined | Y.Map<unknown>;
      if (outgoingEdges == null) {
        outgoingEdges = new Y.Map<unknown>([[edge.id, true]]);
        outVMap.set($OutEKey, outgoingEdges);
      } else {
        outgoingEdges.set(edge.id, true);
      }
    });
  }

  public deleteEdge(id: ElementId): void {
    const [label, uuid] = parseElementId(id);
    const collection = this.getEdgeCollectionMap(label);
    const data = collection.get(uuid);
    if (data == null) {
      throw new EdgeNotFoundError(id);
    }
    // inV is the target, outV is the source
    const inV = data.get($InVKey) as ElementId;
    const outV = data.get($OutVKey) as ElementId;
    const inVMap = this.getVertexMap(inV);
    const outVMap = this.getVertexMap(outV);
    this.transact(() => {
      // Remove from target's incoming edges
      const incomingEdges = inVMap.get($InEKey) as undefined | Y.Map<unknown>;
      incomingEdges?.delete(id);
      // Remove from source's outgoing edges
      const outgoingEdges = outVMap.get($OutEKey) as undefined | Y.Map<unknown>;
      outgoingEdges?.delete(id);
      collection.delete(uuid);
    });
  }

  protected getVertexMap(vertexId: ElementId): Y.Map<unknown> {
    const [label, uuid] = parseElementId(vertexId);
    const collection = this.getVertexCollectionMap(label);
    const data = collection.get(uuid);
    if (data == null) {
      throw new VertexNotFoundError(vertexId);
    }
    return data as Y.Map<unknown>;
  }
  protected getEdgeMap(edgeId: ElementId): Y.Map<unknown> {
    const [label, uuid] = parseElementId(edgeId);
    const collection = this.getEdgeCollectionMap(label);
    const data = collection.get(uuid);
    if (data == null) {
      throw new EdgeNotFoundError(edgeId);
    }
    return data as Y.Map<unknown>;
  }

  public updateProperty(id: ElementId, key: string, value: any): void {
    const [label, uuid] = parseElementId(id);
    const isVertex = label in this.#config.schema.vertices;
    const collection = isVertex
      ? this.getVertexCollectionMap(label)
      : this.getEdgeCollectionMap(label);
    const data = collection.get(uuid);
    if (data == null) {
      throw new ElementNotFoundError(id);
    }
    data.set(key, value);
  }

  protected transact(callback: (tx: Y.Transaction) => void): void {
    this.#doc.transact(callback);
  }
}
