import { Graph } from "./Graph.js";
import { GraphSchema } from "./GraphSchema.js";
import {
  ElementId,
  InMemoryGraphStorage,
  StoredEdge,
  StoredVertex,
} from "./GraphStorage.js";
import { createStepsFromJSON, createTraverser, StepJSON } from "./Steps.js";
import {
  GraphTraversal,
  Traversal,
  TraversalPath,
  TraversalPathJSON,
} from "./Traversals.js";

/**
 * Serialize a value to JSON and back. Alias for JSON.parse(JSON.stringify(value)).
 * Used where we explicitly want JSON serialization behavior.
 */
function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export interface AsyncQuery {
  "@type": "AsyncQuery";
  steps: StepJSON[];
}

interface AddVertexOperation {
  "@type": "AddVertexOperation";
  vertex: StoredVertex;
}
interface AddEdgeOperation {
  "@type": "AddEdgeOperation";
  edge: StoredEdge;
}
interface DeleteVertexOperation {
  "@type": "DeleteVertexOperation";
  id: ElementId;
}
interface DeleteEdgeOperation {
  "@type": "DeleteEdgeOperation";
  id: ElementId;
}
interface UpdatePropertyOperation {
  "@type": "UpdatePropertyOperation";
  id: ElementId;
  key: string;
  value: any;
}

export type AsyncTransactionOperation =
  | AddVertexOperation
  | AddEdgeOperation
  | DeleteVertexOperation
  | DeleteEdgeOperation
  | UpdatePropertyOperation;

export type AsyncTransactionOperationResult =
  | {
      "@type": "AsyncOperationSuccess";
    }
  | {
      "@type": "AsyncOperationFailure";
      operation: AsyncTransactionOperation;
      error: string;
    };

export interface AsyncTransaction {
  "@type": "AsyncTransaction";
  operations: AsyncTransactionOperation[];
}

export type TransportableValue =
  | TraversalPathJSON
  | StoredEdge
  | StoredVertex
  | AsyncTransactionOperationResult;

export type AsyncCommand = AsyncQuery | AsyncTransaction;

export interface AsyncGraphConfig<TSchema extends GraphSchema> {
  schema: TSchema;
  transport: (command: AsyncCommand) => AsyncIterable<TransportableValue>;
}

export class AsyncGraph<const TSchema extends GraphSchema> {
  #config: AsyncGraphConfig<TSchema>;
  #storage: AsyncGraphStorage;
  #graph: Graph<TSchema>;
  public constructor(config: AsyncGraphConfig<TSchema>) {
    this.#config = config;
    this.#storage = new AsyncGraphStorage();
    this.#graph = new Graph({
      schema: config.schema,
      storage: this.#storage,
    });
  }

  public async *query<const TPath>(
    query: (g: GraphTraversal<TSchema>) => Traversal<TSchema, TPath>,
  ): AsyncIterable<TPath> {
    const traversal = query(new GraphTraversal(this.#graph));
    // Steps have custom toJSON methods, so we use JSON serialization
    const steps = jsonClone(traversal.steps) as unknown as StepJSON[];

    const results = this.#config.transport({
      "@type": "AsyncQuery",
      steps,
    });

    for await (const result of results) {
      if (result != null && "@type" in result) {
        yield this.instantiateResult(result) as TPath;
      } else {
        yield result as TPath;
      }
    }
  }

  protected instantiateResult<TPath>(result: TransportableValue): TPath {
    switch (result["@type"]) {
      case "TraversalPath": {
        let value: any = result.value;
        if (value != null && "@type" in value) {
          value = this.instantiateResult(value);
        }
        return new TraversalPath(
          result.parent == null
            ? undefined
            : this.instantiateResult(result.parent),
          value,
          result.labels,
        ) as TPath;
      }
      case "Vertex":
        this.#storage.push(result);
        return this.#graph.getVertexById(result.id) as TPath;
      case "Edge":
        this.#storage.push(result);
        return this.#graph.getEdgeById(result.id) as TPath;
      case "AsyncOperationSuccess":
        return undefined as TPath;
      case "AsyncOperationFailure":
        throw new Error(result.error);
      default:
        throw new Error(`Unknown result type: ${result["@type"]}`);
    }
  }
}

class AsyncGraphStorage extends InMemoryGraphStorage {
  /**
   * Push an element into the storage, updating properties individually if the
   * element already exists. This ensures that updateProperty is called for each
   * property change, which maintains index consistency.
   *
   * Note: In AsyncGraphStorage, we don't have an IndexManager directly.
   * This method uses updateProperty to ensure any future index integration
   * would work correctly. For now, it provides consistent update semantics.
   */
  public push(element: StoredEdge | StoredVertex): void {
    if (element["@type"] === "Vertex") {
      const existing = this.vertices.get(element.id);
      if (existing != null) {
        // Update each property individually instead of using Object.assign
        // to maintain consistency with updateProperty semantics
        for (const [key, value] of Object.entries(element.properties)) {
          this.updateProperty(element.id, key, value);
        }
      } else {
        this.addVertex(element);
      }
    } else if (element["@type"] === "Edge") {
      const existing = this.edges.get(element.id);
      if (existing != null) {
        // Update each property individually instead of using Object.assign
        // to maintain consistency with updateProperty semantics
        for (const [key, value] of Object.entries(element.properties)) {
          this.updateProperty(element.id, key, value);
        }
      } else {
        this.addEdge(element);
      }
    } else {
      throw new Error(`Unknown element type: ${element["@type"]}`);
    }
  }
}

export async function* handleAsyncCommand<TSchema extends GraphSchema>(
  graph: Graph<TSchema>,
  command: AsyncCommand,
): AsyncIterable<TransportableValue> {
  switch (command["@type"]) {
    case "AsyncQuery":
      return yield* handleAsyncQuery(graph, command);
    case "AsyncTransaction":
      return yield* handleAsyncTransaction(graph, command);
  }
}

function* handleAsyncQuery<TSchema extends GraphSchema>(
  graph: Graph<TSchema>,
  command: AsyncQuery,
) {
  const steps = createStepsFromJSON(command.steps);
  const traverser = createTraverser(steps);
  for (const path of traverser.traverse(graph, [])) {
    yield jsonClone(path) as TraversalPathJSON | StoredEdge | StoredVertex;
  }
}

function* handleAsyncTransaction<TSchema extends GraphSchema>(
  graph: Graph<TSchema>,
  command: AsyncTransaction,
): Iterable<AsyncTransactionOperationResult> {
  for (const operation of command.operations) {
    try {
      switch (operation["@type"]) {
        case "AddVertexOperation": {
          graph.storage.addVertex(operation.vertex);
          yield {
            "@type": "AsyncOperationSuccess",
          };
          break;
        }
        case "AddEdgeOperation": {
          graph.storage.addEdge(operation.edge);
          yield {
            "@type": "AsyncOperationSuccess",
          };
          break;
        }
        case "DeleteVertexOperation": {
          graph.storage.deleteVertex(operation.id);
          yield {
            "@type": "AsyncOperationSuccess",
          };
          break;
        }
        case "DeleteEdgeOperation": {
          graph.storage.deleteEdge(operation.id);
          yield {
            "@type": "AsyncOperationSuccess",
          };
          break;
        }
        case "UpdatePropertyOperation": {
          graph.storage.updateProperty(
            operation.id,
            operation.key,
            operation.value,
          );
          yield {
            "@type": "AsyncOperationSuccess",
          };
          break;
        }
        default: {
          throw new Error(`Unknown operation type: ${operation["@type"]}`);
        }
      }
    } catch (error) {
      yield {
        "@type": "AsyncOperationFailure",
        operation: operation,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
