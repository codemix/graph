import {
  GraphSchema,
  Graph,
  Traversal,
  GraphTraversal,
  KnownSteps,
  FetchEdgesStep,
  FetchVerticesStep,
  FilterElementsStep,
  ElementId,
  EdgeStep,
  VertexStep,
  getLabelFromElementId,
  RepeatStep,
} from "@codemix/graph";
import * as Y from "yjs";
import { YGraphStorage } from "./YGraphStorage.js";
import { Observable, Subscription, Observer } from "zen-observable-ts";

export interface YGraphConfig<TSchema extends GraphSchema> {
  schema: TSchema;
  doc: Y.Doc;
}

export class YGraph<const TSchema extends GraphSchema> extends Graph<TSchema> {
  #doc: Y.Doc;
  #subscription: Subscription | undefined;
  #subscribers: Set<Observer<YGraphChange>> = new Set();

  public constructor(config: YGraphConfig<TSchema>) {
    const storage = new YGraphStorage(config.doc, {
      schema: config.schema,
    });
    super({
      schema: config.schema,
      storage,
    });
    this.#doc = config.doc;
  }

  /**
   * The Yjs document that the graph is stored in.
   */
  public get doc(): Y.Doc {
    return this.#doc;
  }

  public override get storage(): YGraphStorage {
    return super.storage as YGraphStorage;
  }

  /**
   * Subscribe to changes to the graph.
   * @param observer The observer to subscribe to.
   * @returns A function to unsubscribe from the changes.
   */
  public subscribe(observer: Observer<YGraphChange>) {
    const subscribers = this.#subscribers;
    subscribers.add(observer);
    if (this.#subscription === undefined) {
      this.#subscription = createGraphObserver(this).subscribe({
        next(value) {
          for (const subscriber of subscribers) {
            subscriber.next?.(value);
          }
        },
      });
    }
    return () => {
      subscribers.delete(observer);
      if (subscribers.size === 0) {
        this.#subscription?.unsubscribe();
        this.#subscription = undefined;
      }
    };
  }

  /**
   * Create a live query.
   * @param query The query to create a live query for.
   * @returns A live query.
   */
  public query<TTraversal extends Traversal<TSchema, any>>(
    query: (g: GraphTraversal<TSchema>) => TTraversal,
  ) {
    return new LiveQuery(this, query(new GraphTraversal(this)));
  }
}

function createGraphObserver<TSchema extends GraphSchema>(
  graph: YGraph<TSchema>,
) {
  const { schema, storage } = graph;
  return new Observable<YGraphChange>((o) => {
    const unsubscribers: (() => void)[] = [];
    for (const vertexLabel of Object.keys(schema.vertices)) {
      const collection = storage.getVertexCollectionMap(vertexLabel);
      const observer = (events: Y.YEvent<any>[]) => {
        for (const event of events) {
          const { path } = event;
          if (path.length === 0) {
            if (event instanceof Y.YMapEvent) {
              for (const [uuid, change] of event.changes.keys) {
                if (change.action === "add") {
                  o.next({
                    kind: "vertex.added",
                    id: `${vertexLabel}:${uuid}`,
                  });
                } else if (change.action === "delete") {
                  o.next({
                    kind: "vertex.deleted",
                    id: `${vertexLabel}:${uuid}`,
                  });
                }
              }
            }
          } else if (path.length === 1) {
            for (const [key] of event.changes.keys) {
              if (key.startsWith("@")) {
                continue;
              }
              o.next({
                kind: "vertex.property.set",
                id: `${vertexLabel}:${path[0]!}`,
                property: key,
              });
            }
          } else {
            const [uuid, property, ...path] = event.path as [
              string,
              string,
              ...(string | number)[],
            ];
            if (property.startsWith("@")) {
              continue;
            }
            o.next({
              kind: "vertex.property.changed",
              id: `${vertexLabel}:${uuid}`,
              property,
              path,
              event,
            });
          }
        }
      };
      collection.observeDeep(observer);
      unsubscribers.push(() => collection.unobserveDeep(observer));
    }
    for (const edgeLabel of Object.keys(schema.edges)) {
      const collection = storage.getEdgeCollectionMap(edgeLabel);
      const observer = (events: Y.YEvent<any>[]) => {
        for (const event of events) {
          const { path } = event;
          if (path.length === 0) {
            if (event instanceof Y.YMapEvent) {
              for (const [uuid, change] of event.changes.keys) {
                if (change.action === "add") {
                  o.next({
                    kind: "edge.added",
                    id: `${edgeLabel}:${uuid}`,
                  });
                } else if (change.action === "delete") {
                  o.next({
                    kind: "edge.deleted",
                    id: `${edgeLabel}:${uuid}`,
                  });
                }
              }
            }
          } else if (path.length === 1) {
            for (const [key] of event.changes.keys) {
              if (key.startsWith("@")) {
                continue;
              }
              o.next({
                kind: "edge.property.set",
                id: `${edgeLabel}:${path[0]!}`,
                property: key,
              });
            }
          } else {
            const [uuid, property, ...path] = event.path as [
              string,
              string,
              ...(string | number)[],
            ];
            if (property.startsWith("@")) {
              continue;
            }
            o.next({
              kind: "edge.property.changed",
              id: `${edgeLabel}:${uuid}`,
              property,
              path,
              event,
            });
          }
        }
      };
      collection.observeDeep(observer);
      unsubscribers.push(() => collection.unobserveDeep(observer));
    }

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  });
}

export interface YGraphVertexAddedChange {
  kind: "vertex.added";
  id: ElementId;
}

export interface YGraphVertexDeletedChange {
  kind: "vertex.deleted";
  id: ElementId;
}

export interface YGraphEdgeAddedChange {
  kind: "edge.added";
  id: ElementId;
}

export interface YGraphEdgeDeletedChange {
  kind: "edge.deleted";
  id: ElementId;
}

export interface YGraphPropertySet {
  kind: `${"vertex" | "edge"}.property.set`;
  id: ElementId;
  property: string;
}

export interface YGraphPropertyChange {
  kind: `${"vertex" | "edge"}.property.changed`;
  id: ElementId;
  property: string;
  path: (string | number)[];
  event: Y.YEvent<any>;
}

export type YGraphChange =
  | YGraphVertexAddedChange
  | YGraphVertexDeletedChange
  | YGraphEdgeAddedChange
  | YGraphEdgeDeletedChange
  | YGraphPropertySet
  | YGraphPropertyChange;

type PathFromTraversal<TTraversal extends Traversal<any, any>> =
  TTraversal extends Traversal<any, infer TPath> ? TPath : never;

export class LiveQuery<
  const TSchema extends GraphSchema,
  const TTraversal extends Traversal<TSchema, any>,
> {
  #graph: YGraph<TSchema>;
  #traversal: TTraversal;
  #predicate: QueryPredicate;
  public constructor(graph: YGraph<TSchema>, traversal: TTraversal) {
    this.#graph = graph;
    this.#traversal = traversal;
    this.#predicate = createPredicatesForTraversalSteps(traversal.steps);
  }

  public get graph(): YGraph<TSchema> {
    return this.#graph;
  }

  public subscribe(observer: Observer<YGraphChange>) {
    const predicate = this.#predicate;
    return this.#graph.subscribe({
      next(value) {
        const step = predicate(value);
        if (step != undefined) {
          observer.next?.(value);
        }
      },
    });
  }

  public traverse(): Iterable<PathFromTraversal<TTraversal>> {
    return this.#traversal.traverse();
  }

  public *[Symbol.iterator](): IterableIterator<PathFromTraversal<TTraversal>> {
    yield* this.traverse();
  }

  public toString() {
    return this.#traversal.toString();
  }
}

type QueryPredicate = (change: YGraphChange) => KnownSteps | undefined;

function createPredicatesForTraversalSteps(
  steps: readonly KnownSteps[],
): QueryPredicate {
  const predicates: QueryPredicate[] = [];
  for (const step of steps) {
    if (step instanceof FetchVerticesStep) {
      if (step.config.ids && step.config.ids.length > 0) {
        predicates.push((change) => {
          if (
            change.kind === "vertex.added" ||
            change.kind === "vertex.deleted"
          ) {
            return step.config.ids!.includes(change.id) ? step : undefined;
          }
          return undefined;
        });
      } else if (
        step.config.vertexLabels &&
        step.config.vertexLabels.length > 0
      ) {
        predicates.push((change) => {
          if (
            change.kind === "vertex.added" ||
            change.kind === "vertex.deleted"
          ) {
            return step.config.vertexLabels!.includes(
              getLabelFromElementId(change.id),
            )
              ? step
              : undefined;
          }
          return undefined;
        });
      } else {
        predicates.push((change) => {
          if (
            change.kind === "vertex.added" ||
            change.kind === "vertex.deleted"
          ) {
            return step ? step : undefined;
          }
          return undefined;
        });
      }
    } else if (step instanceof FetchEdgesStep) {
      if (step.config.ids && step.config.ids.length > 0) {
        predicates.push((change) => {
          if (change.kind === "edge.added" || change.kind === "edge.deleted") {
            return step.config.ids!.includes(change.id) ? step : undefined;
          }
          return undefined;
        });
      } else if (step.config.edgeLabels && step.config.edgeLabels.length > 0) {
        predicates.push((change) => {
          if (change.kind === "edge.added" || change.kind === "edge.deleted") {
            return step.config.edgeLabels!.includes(
              getLabelFromElementId(change.id),
            )
              ? step
              : undefined;
          }
          return undefined;
        });
      } else {
        predicates.push((change) => {
          if (change.kind === "edge.added" || change.kind === "edge.deleted") {
            return step;
          }
          return undefined;
        });
      }
    } else if (step instanceof FilterElementsStep) {
      predicates.push((change) => {
        if (
          change.kind === "vertex.property.set" ||
          change.kind === "edge.property.set"
        ) {
          // todo make this smarter
          return step;
        }
        return undefined;
      });
    } else if (step instanceof VertexStep || step instanceof EdgeStep) {
      if (step.config.edgeLabels.length > 0) {
        predicates.push((change) => {
          if (change.kind === "edge.added" || change.kind === "edge.deleted") {
            return step.config.edgeLabels!.includes(
              getLabelFromElementId(change.id),
            )
              ? step
              : undefined;
          }
          return undefined;
        });
      } else {
        predicates.push((change) => {
          if (change.kind === "edge.added" || change.kind === "edge.deleted") {
            return step ? step : undefined;
          }
          return undefined;
        });
      }
    } else if (step instanceof RepeatStep) {
      predicates.push(createPredicatesForTraversalSteps(step.steps));
    }
  }
  if (predicates.length === 0) {
    return (_change: YGraphChange) => undefined;
  }
  return predicates.length === 1
    ? predicates[0]!
    : (change: YGraphChange) => {
        for (const predicate of predicates) {
          const step = predicate(change);
          if (step) {
            return step;
          }
        }
        return undefined;
      };
}
