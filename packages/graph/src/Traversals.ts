import { Edge, Element, GraphSource, Vertex, $StoredElement } from "./Graph.js";
import {
  GraphSchema,
  VertexLabel,
  EdgeLabel,
  VertexProperties,
  EdgeProperties,
  AnyEdgePropertyName,
} from "./GraphSchema.js";
import { ElementId } from "./GraphStorage.js";
import {
  BinaryOperator,
  Condition,
  CountStep,
  createTraverser,
  DedupStep,
  EdgeStep,
  FetchEdgesStep,
  FetchVerticesStep,
  FilterElementsStep,
  IntersectStep,
  MapElementsStep,
  OrderDirection,
  OrderStep,
  RangeStep,
  RepeatStep,
  SelectStep,
  ShortestPathStep,
  Step,
  stringifySteps,
  UnfoldStep,
  UnionStep,
  ValuesStep,
  VertexStep,
} from "./Steps.js";

const customInspectSymbol = Symbol.for("nodejs.util.inspect.custom");

export type TraversalPathJSON = {
  "@type": "TraversalPath";
  value: any;
  labels: readonly string[];
  parent: TraversalPathJSON | undefined;
};

export class TraversalPath<
  const TParent,
  const TValue,
  const TLabels extends readonly string[],
> implements Iterable<TraversalPath<any, any, any>> {
  #parent: TParent;
  #value: TValue;
  #labels: TLabels;
  #depth: number;

  public constructor(parent: TParent, value: TValue, labels: TLabels) {
    this.#parent = parent;
    this.#value = value;
    this.#labels = labels;
    // Cache depth at construction time since TraversalPath is immutable
    this.#depth = parent === undefined ? 1 : (parent as TraversalPath<any, any, any>).depth + 1;
  }

  /**
   * The unique id of the path.
   */
  public get id(): string {
    return String(this);
  }

  /**
   * The parent node in the path.
   */
  public get parent(): TParent {
    return this.#parent;
  }

  /**
   * The value in the path.
   */
  public get value(): TValue {
    return this.#value;
  }

  /**
   * The labels in the path.
   */
  public get labels(): TLabels {
    return this.#labels;
  }

  /**
   * The depth of the path.
   * The depth is the number of nodes in the path.
   * This value is cached at construction time for O(1) access.
   */
  public get depth(): number {
    return this.#depth;
  }

  /**
   * Create a new path with the value and labels added.
   * @param value The value to add to the path.
   * @param labels The labels to add to the path.
   * @returns A new path with the value and labels added.
   */
  public with<const TValue, const TLabels extends readonly string[] = []>(
    value: TValue,
    labels: TLabels = [] as unknown as TLabels,
  ): this extends TraversalPath<any, unknown, any> ? TraversalPath<this, TValue, TLabels> : never {
    return new TraversalPath(this as any, value, labels) as any;
  }

  /**
   * Get a property of the value in the path.
   * @param propertyName The name of the property to get.
   */
  public property<TPropertyName extends keyof PropertyOf<TValue>>(
    propertyName: TPropertyName,
  ): PropertyOf<TValue>[TPropertyName] {
    const value = this.#value;
    if (value instanceof Element) {
      return value.get(propertyName);
    }
    if (typeof value === "object" && value !== null) {
      return value[propertyName as keyof typeof value] as PropertyOf<TValue>[TPropertyName];
    }
    return undefined as PropertyOf<TValue>[TPropertyName];
  }

  /**
   * Get a node in the path by label.
   * @param label The label to get the node by.
   */
  public get<const TLabel extends string>(label: TLabel): GetTraversalPathByLabel<this, TLabel> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let node: TraversalPath<any, unknown, any> = this;
    while (node !== undefined) {
      if (node.labels.includes(label)) {
        return node as GetTraversalPathByLabel<this, TLabel>;
      }
      node = node.parent;
    }
    return undefined as GetTraversalPathByLabel<this, TLabel>;
  }

  /**
   * Get all the node in the path by label.
   * @param label The label to get the nodes by.
   */
  public getAll<const TLabel extends string>(
    label: TLabel,
  ): GetAllTraversalPathsByLabel<this, TLabel> {
    const nodes = [] as TraversalPath<any, unknown, any>[];
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let node: TraversalPath<any, unknown, any> = this;
    while (node !== undefined) {
      if (node.labels.includes(label)) {
        nodes.unshift(node);
      }
      node = node.parent;
    }
    return nodes as GetAllTraversalPathsByLabel<this, TLabel>;
  }

  public toJSON(): TraversalPathJSON {
    return {
      "@type": "TraversalPath",
      value: this.#value,
      labels: this.#labels,
      parent: this.#parent instanceof TraversalPath ? this.#parent.toJSON() : undefined,
    };
  }

  [customInspectSymbol]() {
    return this.toString();
  }

  public toString(): string {
    const parent = this.#parent;
    const value = this.#value;
    const labels = this.#labels;
    const formattedValue = value instanceof Element ? value.toString() : `#value`;
    const segment =
      labels.length === 0 ? formattedValue : `${formattedValue} as ${labels.join(", ")}`;

    if (parent === undefined) {
      return segment;
    }

    const parentValue = (parent as TraversalPath<any, any, any>).value;
    if (parentValue === undefined) {
      return segment;
    }
    if (parentValue instanceof Vertex && value instanceof Edge) {
      // outV is source, inV is target
      if (value.outV === parentValue) {
        // Parent vertex is the source - edge comes from it
        return `${parent} -> ${segment}`;
      }
      // Parent vertex is the target - edge points to it
      return `${parent} <- ${segment}`;
    } else if (parentValue instanceof Edge && value instanceof Vertex) {
      // outV is source, inV is target
      if (value === parentValue.inV) {
        // Current vertex is the target - edge points to it
        return `${parent} -> ${segment}`;
      }
      // Current vertex is the source - edge comes from it
      return `${parent} <- ${segment}`;
    }
    return `${parent} - ${segment}`;
  }

  *[Symbol.iterator](): IterableIterator<TraversalPath<any, any, any>> {
    const parent = this.#parent;
    if (parent !== undefined) {
      yield* parent as Iterable<TraversalPath<any, any, any>>;
    }
    yield this;
  }
}

type PropertyOf<T> = T extends Element<any, any, infer TProperties, any> ? TProperties : keyof T;

type GetTraversalPathValue<TPath> =
  TPath extends TraversalPath<any, infer TValue, any>
    ? TValue
    : TPath extends readonly [infer TValue]
      ? [GetTraversalPathValue<TValue>]
      : TPath extends readonly [infer TValue, ...infer TTail]
        ? [GetTraversalPathValue<TValue>, ...GetTraversalPathValues<TTail>]
        : TPath;

type GetTraversalPathValues<TPath> = TPath extends readonly []
  ? []
  : TPath extends readonly [infer TValue]
    ? [GetTraversalPathValue<TValue>]
    : TPath extends readonly [infer TValue, ...infer TTail]
      ? [GetTraversalPathValue<TValue>, ...GetTraversalPathValues<TTail>]
      : TPath;

type GetTraversalPathByLabel<TNode, TLabel extends string> =
  TNode extends TraversalPath<infer TParent, any, infer TLabels>
    ? TLabel extends TLabels[number]
      ? TNode
      : GetTraversalPathByLabel<TParent, TLabel>
    : undefined;

type GetAllTraversalPathsByLabel<TNode, TLabel extends string> =
  TNode extends TraversalPath<infer TParent, any, infer TLabels>
    ? TLabel extends TLabels[number]
      ? [TNode, ...GetAllTraversalPathsByLabel<TParent, TLabel>]
      : GetAllTraversalPathsByLabel<TParent, TLabel>
    : [];

type AddLabelToTraversalPath<TPath, TLabel extends string> =
  TPath extends TraversalPath<infer TParent, infer TValue, infer TLabels>
    ? TraversalPath<TParent, TValue, [...TLabels, TLabel]>
    : never;

type GetAllLabelsFromTraversalPath<TPath> =
  TPath extends TraversalPath<infer TParent, any, infer TLabels>
    ? TLabels extends readonly (infer TLabel extends string)[]
      ? TLabel | GetAllLabelsFromTraversalPath<TParent>
      : never
    : never;

type GetTraversalPathLabelModifiers<TPath> =
  GetAllLabelsFromTraversalPath<TPath> extends infer TAll
    ? TAll | `${"all" | "first" | "last"}:${TAll & string}`
    : never;

type ResolveTraversalPathLabelModifiers<TPath, TPathLabels> = TPathLabels extends readonly [
  infer THead extends string,
  ...infer TTail,
]
  ? THead extends `all:${infer TName}`
    ? [
        readonly GetTraversalPathByLabel<TPath, TName>[],
        ...ResolveTraversalPathLabelModifiers<TPath, TTail>,
      ]
    : THead extends `${"first" | "last"}:${infer TName}`
      ? [GetTraversalPathByLabel<TPath, TName>, ...ResolveTraversalPathLabelModifiers<TPath, TTail>]
      : [GetTraversalPathByLabel<TPath, THead>, ...ResolveTraversalPathLabelModifiers<TPath, TTail>]
  : [];

export abstract class Traversal<const TSchema extends GraphSchema, const TPath> {
  #graph: GraphSource<TSchema>;
  #steps: readonly Step<any>[];

  public constructor(graph: GraphSource<TSchema>, steps: readonly Step<any>[]) {
    this.#graph = graph;
    this.#steps = steps;
  }

  /**
   * The graph source for the traversal.
   */
  public get graph(): GraphSource<TSchema> {
    return this.#graph;
  }

  /**
   * The steps in the traversal.
   */
  public get steps(): readonly Step<any>[] {
    return this.#steps;
  }

  public traverse() {
    // Reset the traversed and emitted counts for each step.
    for (const step of this.steps) {
      step.traversed = 0;
      step.emitted = 0;
    }
    const traverser = createTraverser(this.steps);
    return traverser.traverse(this.graph, []) as Iterable<TPath>;
  }

  public *[Symbol.iterator]() {
    yield* this.traverse();
  }

  public toString() {
    return stringifySteps(this.steps);
  }

  public toJSON() {
    return this.steps;
  }
}

export class GraphTraversal<const TSchema extends GraphSchema> {
  #graph: GraphSource<TSchema>;

  public constructor(graph: GraphSource<TSchema>) {
    this.#graph = graph;
  }

  /**
   * The graph source for the traversal.
   */
  public get graph(): GraphSource<TSchema> {
    return this.#graph;
  }

  /**
   * Start a new traversal from the vertices in the graph.
   * @param ids The ids of the vertices to get.
   */
  public V<const TLabel extends VertexLabel<TSchema> = VertexLabel<TSchema>>(
    ...ids: ElementId<TLabel>[]
  ) {
    return new VertexTraversal<
      TSchema,
      TraversalPath<undefined, Vertex<TSchema, TLabel>, readonly []>
    >(this.graph, [
      new FetchVerticesStep({
        ids,
      }),
    ]);
  }

  /**
   * Start a new traversal from the edges in the graph.
   * @param ids The ids of the edges to get.
   */
  public E<const TLabel extends EdgeLabel<TSchema> = EdgeLabel<TSchema>>(
    ...ids: ElementId<TLabel>[]
  ) {
    return new EdgeTraversal<TSchema, TraversalPath<undefined, Edge<TSchema, TLabel>, readonly []>>(
      this.graph,
      [
        new FetchEdgesStep({
          ids,
        }),
      ],
    );
  }

  /**
   * Start a new traversal from a union of other traversals.
   * @param traversals The traversals to union.
   */
  public union<const TTraversals extends readonly VertexTraversal<TSchema, any>[]>(
    ...traversals: TTraversals
  ): VertexTraversal<TSchema, GetTraversalPaths<TTraversals>>;
  public union<const TTraversals extends readonly EdgeTraversal<TSchema, any>[]>(
    ...traversals: TTraversals
  ): EdgeTraversal<TSchema, GetTraversalPaths<TTraversals>>;
  public union(...traversals: readonly Traversal<TSchema, any>[]) {
    if (traversals.length === 0) {
      throw new Error("At least one traversal must be provided.");
    }
    return traversals.reduce((previous, traversal) => {
      if (previous instanceof VertexTraversal) {
        if (traversal instanceof VertexTraversal) {
          return previous.union(traversal);
        }
        return previous;
      }
      if (previous instanceof EdgeTraversal) {
        if (traversal instanceof EdgeTraversal) {
          return previous.union(traversal);
        }
        return previous;
      }
      return previous;
    });
  }

  /**
   * Start a new traversal from an intersection of other traversals.
   * @param traversals The traversals to intersect.
   */
  public intersect<const TTraversals extends readonly VertexTraversal<TSchema, any>[]>(
    ...traversals: TTraversals
  ): VertexTraversal<TSchema, GetTraversalPaths<UnionToIntersection<TTraversals>>>;
  public intersect<const TTraversals extends readonly EdgeTraversal<TSchema, any>[]>(
    ...traversals: TTraversals
  ): EdgeTraversal<TSchema, GetTraversalPaths<UnionToIntersection<TTraversals>>>;
  public intersect(...traversals: readonly Traversal<TSchema, any>[]) {
    if (traversals.length === 0) {
      throw new Error("At least one traversal must be provided.");
    }
    return traversals.reduce((previous, traversal) => {
      if (previous instanceof VertexTraversal) {
        if (traversal instanceof VertexTraversal) {
          return previous.intersect(traversal);
        }
        return previous;
      }
      if (previous instanceof EdgeTraversal) {
        if (traversal instanceof EdgeTraversal) {
          return previous.intersect(traversal);
        }
        return previous;
      }
      return previous;
    });
  }
}

type GetTraversalPaths<T> =
  T extends Traversal<any, infer TPath>
    ? TPath
    : T extends readonly Traversal<any, infer TPath>[]
      ? TPath
      : never;

type UnionToIntersection<T> = (T extends readonly (infer U)[] ? U : never) extends infer V
  ? (V extends any ? (k: V) => void : never) extends (k: infer W) => void
    ? W
    : never
  : never;

type GetEdgeLabels<TSchema extends GraphSchema, TEdgeLabels> = TEdgeLabels extends readonly []
  ? EdgeLabel<TSchema>
  : TEdgeLabels extends readonly (infer U extends EdgeLabel<TSchema>)[]
    ? U
    : EdgeLabel<TSchema>;

type GetVertexLabels<TSchema extends GraphSchema, TVertexLabels> = TVertexLabels extends readonly []
  ? VertexLabel<TSchema>
  : TVertexLabels extends readonly (infer U extends VertexLabel<TSchema>)[]
    ? U
    : VertexLabel<TSchema>;

export class VertexTraversal<const TSchema extends GraphSchema, const TPath> extends Traversal<
  TSchema,
  TPath
> {
  /**
   * Get the vertices that are connected to the vertices by incoming edges.
   * @param edgeLabels The labels of the edges to get. If no labels are provided, all edges are returned.
   */
  public in<const TEdgeLabels extends readonly EdgeLabel<TSchema>[]>(...edgeLabels: TEdgeLabels) {
    return new VertexTraversal<
      TSchema,
      TraversalPath<
        TraversalPath<TPath, Edge<TSchema, GetEdgeLabels<TSchema, TEdgeLabels>>, []>,
        Vertex<TSchema, VertexLabel<TSchema>>,
        []
      >
    >(this.graph, [
      ...this.steps,
      new VertexStep({
        direction: "in",
        edgeLabels: edgeLabels,
      }),
    ]);
  }

  /**
   * Get the vertices that are connected to the vertices by outgoing edges.
   * @param edgeLabels The labels of the edges to get. If no labels are provided, all edges are returned.
   */
  public out<const TEdgeLabels extends readonly EdgeLabel<TSchema>[]>(...edgeLabels: TEdgeLabels) {
    return new VertexTraversal<
      TSchema,
      TraversalPath<
        TraversalPath<TPath, Edge<TSchema, GetEdgeLabels<TSchema, TEdgeLabels>>, []>,
        Vertex<TSchema, VertexLabel<TSchema>>,
        []
      >
    >(this.graph, [
      ...this.steps,
      new VertexStep({
        direction: "out",
        edgeLabels: edgeLabels,
      }),
    ]);
  }

  /**
   * Get the vertices that are connected to the vertices by both incoming and outgoing edges.
   * @param edgeLabels The labels of the edges to get. If no labels are provided, all edges are returned.
   */
  public both<const TEdgeLabels extends readonly EdgeLabel<TSchema>[]>(...edgeLabels: TEdgeLabels) {
    return new VertexTraversal<
      TSchema,
      TraversalPath<
        TraversalPath<TPath, Edge<TSchema, GetEdgeLabels<TSchema, TEdgeLabels>>, []>,
        Vertex<TSchema, VertexLabel<TSchema>>,
        []
      >
    >(this.graph, [
      ...this.steps,
      new VertexStep({
        direction: "both",
        edgeLabels: edgeLabels,
      }),
    ]);
  }

  /**
   * Get the edges that are connected to the vertices by incoming edges.
   * @param edgeLabels The labels of the edges to get. If no labels are provided, all edges are returned.
   */
  public inE<const TEdgeLabels extends readonly EdgeLabel<TSchema>[]>(...edgeLabels: TEdgeLabels) {
    return new EdgeTraversal<
      TSchema,
      TraversalPath<TPath, Edge<TSchema, GetEdgeLabels<TSchema, TEdgeLabels>>, []>
    >(this.graph, [
      ...this.steps,
      new EdgeStep({
        direction: "in",
        edgeLabels: edgeLabels,
      }),
    ]);
  }

  /**
   * Get the edges that are connected to the vertices by outgoing edges.
   * @param edgeLabels The labels of the edges to get. If no labels are provided, all edges are returned.
   */
  public outE<const TEdgeLabels extends readonly EdgeLabel<TSchema>[]>(...edgeLabels: TEdgeLabels) {
    return new EdgeTraversal<
      TSchema,
      TraversalPath<TPath, Edge<TSchema, GetEdgeLabels<TSchema, TEdgeLabels>>, []>
    >(this.graph, [
      ...this.steps,
      new EdgeStep({
        direction: "out",
        edgeLabels: edgeLabels,
      }),
    ]);
  }

  /**
   * Get the edges that are connected to the vertices by both incoming and outgoing edges.
   * @param edgeLabels The labels of the edges to get. If no labels are provided, all edges are returned.
   */
  public bothE<const TEdgeLabels extends readonly EdgeLabel<TSchema>[]>(
    ...edgeLabels: TEdgeLabels
  ) {
    return new EdgeTraversal<
      TSchema,
      TraversalPath<TPath, Edge<TSchema, GetEdgeLabels<TSchema, TEdgeLabels>>, []>
    >(this.graph, [
      ...this.steps,
      new EdgeStep({
        direction: "both",
        edgeLabels: edgeLabels,
      }),
    ]);
  }

  /**
   * Add a label to the last element in the path.
   * @param label The label to add to the last element in the path.
   */
  public as<const TLabel extends string>(label: TLabel) {
    const steps = [...this.steps];
    if (steps.length === 0) {
      throw new Error("Cannot add a label to an empty traversal.");
    }
    steps[steps.length - 1] = steps[steps.length - 1]!.withLabel(label);
    return new VertexTraversal<TSchema, AddLabelToTraversalPath<TPath, TLabel>>(this.graph, steps);
  }

  /**
   * Filter the vertices keeping only the ones with the specified labels.
   * @param labels The labels to filter the vertices by.
   */
  public hasLabel<const TVertexLabels extends readonly VertexLabel<TSchema>[]>(
    ...labels: TVertexLabels
  ) {
    // if the previous step is a FetchVerticesStep, we need to add the labels to the step directly.
    const lastStep = this.steps.length > 0 ? this.steps[this.steps.length - 1] : undefined;
    if (lastStep instanceof FetchVerticesStep) {
      return new VertexTraversal<
        TSchema,
        TPath extends TraversalPath<infer TParent, any, infer TLabels>
          ? TraversalPath<
              TParent,
              Vertex<TSchema, GetVertexLabels<TSchema, TVertexLabels>>,
              TLabels
            >
          : TPath
      >(this.graph, [
        ...this.steps.slice(0, -1),
        lastStep.clone({
          vertexLabels: lastStep.config.vertexLabels
            ? Array.from(new Set([...lastStep.config.vertexLabels, ...labels]))
            : labels,
        }),
      ]);
    }

    return new VertexTraversal<
      TSchema,
      TPath extends TraversalPath<infer TParent, any, infer TLabels>
        ? TraversalPath<TParent, Vertex<TSchema, GetVertexLabels<TSchema, TVertexLabels>>, TLabels>
        : TPath
    >(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition:
          labels.length === 1
            ? ["=", "@label", labels[0]]
            : ["or", ...labels.map((label) => ["=", "@label", label] as const)],
      }),
    ]);
  }

  /**
   * Repeat the traversal until a sub-traversal returns at least one result, or a certain number of times have been repeated.
   * @param getTraversal A function that returns the traversal to repeat.
   */
  public repeat<
    const TGetTraversal extends (
      parent: VertexTraversal<TSchema, ReplaceRootTraversalPath<TPath, undefined>>,
    ) => VertexTraversal<TSchema, any>,
  >(getTraversal: TGetTraversal) {
    return new RepeatVertexTraversal<
      TSchema,
      RepeatVertexTraversalPaths<TPath, PathFromTraversal<ReturnType<TGetTraversal>>>
    >(this.graph, [
      ...this.steps,
      new RepeatStep(
        {},
        getTraversal(
          new VertexTraversal<TSchema, ReplaceRootTraversalPath<TPath, undefined>>(this.graph, []),
        ).steps,
      ),
    ]);
  }

  /**
   * Start a shortest path traversal.
   * Uses BFS (Breadth-First Search) for unweighted graphs - O(V + E).
   * Uses Dijkstra's algorithm for weighted graphs - O((V + E) log V).
   *
   * Chain with `.to()`, `.through()`, `.direction()`, `.maxDepth()`, `.weightedBy()` to configure.
   *
   * @example
   * ```typescript
   * // Find shortest path to a specific vertex
   * g.V(alice.id).shortestPath().to(dave.id).values()
   *
   * // Find shortest path with conditions
   * g.V(alice.id).shortestPath().to($ => $.has("name", "Dave")).through("knows").values()
   *
   * // Find weighted shortest path
   * g.V(alice.id).shortestPath().to(dave.id).weightedBy("cost").values()
   * ```
   */
  public shortestPath(): ShortestPathTraversal<TSchema, TPath> {
    return new ShortestPathTraversal<TSchema, TPath>(this.graph, [
      ...this.steps,
      new ShortestPathStep({}),
    ]);
  }

  /**
   * Filter vertices which have a property with the specified name.
   * @param propertyName The name of the property to filter the vertices by.
   */
  public has<const TPropertyName extends string>(
    propertyName: TPropertyName,
  ): VertexTraversal<TSchema, RefineTraversalPathValue<TSchema, TPath, TPropertyName>>;
  /**
   * Filter vertices which have a property with the specified name and value.
   * @param propertyName The name of the property to filter the vertices by.
   * @param propertyValue The value of the property to filter the vertices by.
   */
  public has<const TPropertyName extends string>(
    propertyName: TPropertyName,
    propertyValue: ResolveTraversalPathProperty<TSchema, TPath, TPropertyName>,
  ): VertexTraversal<TSchema, RefineTraversalPathValue<TSchema, TPath, TPropertyName>>;
  /**
   * Compare the value of a property of the vertices to a specified value.
   * @param propertyName The name of the property to filter the vertices by.
   * @param operator The operator to use to compare the property value.
   * @param propertyValue The value of the property to filter the vertices by.
   */
  public has<const TPropertyName extends string>(
    propertyName: TPropertyName,
    operator: BinaryOperator,
    propertyValue: ResolveTraversalPathProperty<TSchema, TPath, TPropertyName>,
  ): VertexTraversal<TSchema, RefineTraversalPathValue<TSchema, TPath, TPropertyName>>;
  public has(...args: any[]): VertexTraversal<TSchema, any> {
    let condition: Condition;
    if (args.length === 0) {
      return this;
    }
    if (args.length === 1) {
      condition = ["exists", args[0]];
    } else if (args.length === 2) {
      condition = ["=", args[0], args[1]];
    } else {
      condition = [args[1], args[0], args[2]];
    }
    const lastStep = this.steps[this.steps.length - 1];
    if (lastStep instanceof FilterElementsStep) {
      // Coalesce conditions if the last step is a filter step.
      if (lastStep.config.condition[0] === "and") {
        return new VertexTraversal(this.graph, [
          ...this.steps.slice(0, -1),
          lastStep.clone({
            condition: [
              "and",
              ...(lastStep.config.condition.slice(1) as Condition[]),
              condition,
            ] as const,
          }),
        ]);
      } else {
        return new VertexTraversal(this.graph, [
          ...this.steps.slice(0, -1),
          lastStep.clone({
            condition: ["and", lastStep.config.condition, condition] as const,
          }),
        ]);
      }
    }
    return new VertexTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter vertices which have a property value in the specified list.
   * @param propertyName The name of the property to filter by.
   * @param values The list of values to check against.
   */
  public hasIn<const TPropertyName extends string>(
    propertyName: TPropertyName,
    values: readonly ResolveTraversalPathProperty<TSchema, TPath, TPropertyName>[],
  ): VertexTraversal<TSchema, RefineTraversalPathValue<TSchema, TPath, TPropertyName>> {
    const condition: Condition = ["in", propertyName, values];
    return new VertexTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter vertices where the specified property is null or undefined.
   * @param propertyName The name of the property to check.
   */
  public isNull<const TPropertyName extends string>(
    propertyName: TPropertyName,
  ): VertexTraversal<TSchema, TPath> {
    const condition: Condition = ["isNull", propertyName];
    return new VertexTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter vertices where the specified property is not null or undefined.
   * @param propertyName The name of the property to check.
   */
  public isNotNull<const TPropertyName extends string>(
    propertyName: TPropertyName,
  ): VertexTraversal<TSchema, TPath> {
    const condition: Condition = ["isNotNull", propertyName];
    return new VertexTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter vertices where the specified property starts with the given value.
   * @param propertyName The name of the property to check.
   * @param value The prefix to match.
   */
  public startsWith<const TPropertyName extends string>(
    propertyName: TPropertyName,
    value: string,
  ): VertexTraversal<TSchema, TPath> {
    const condition: Condition = ["startsWith", propertyName, value];
    return new VertexTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter vertices where the specified property ends with the given value.
   * @param propertyName The name of the property to check.
   * @param value The suffix to match.
   */
  public endsWith<const TPropertyName extends string>(
    propertyName: TPropertyName,
    value: string,
  ): VertexTraversal<TSchema, TPath> {
    const condition: Condition = ["endsWith", propertyName, value];
    return new VertexTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter vertices where the specified property contains the given value.
   * @param propertyName The name of the property to check.
   * @param value The substring to match.
   */
  public containing<const TPropertyName extends string>(
    propertyName: TPropertyName,
    value: string,
  ): VertexTraversal<TSchema, TPath> {
    const condition: Condition = ["contains", propertyName, value];
    return new VertexTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter vertices where the specified property matches the given regex pattern.
   * @param propertyName The name of the property to check.
   * @param pattern The regex pattern to match.
   */
  public matches<const TPropertyName extends string>(
    propertyName: TPropertyName,
    pattern: string,
  ): VertexTraversal<TSchema, TPath> {
    const condition: Condition = ["=~", propertyName, pattern];
    return new VertexTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Negate the condition on the last filter step.
   * Note: This only works if the last step is a FilterElementsStep.
   */
  public not(): VertexTraversal<TSchema, TPath> {
    const lastStep = this.steps[this.steps.length - 1];
    if (!(lastStep instanceof FilterElementsStep)) {
      throw new Error("Cannot negate: last step is not a filter step. Use has() or similar first.");
    }
    return new VertexTraversal(this.graph, [
      ...this.steps.slice(0, -1),
      lastStep.clone({
        condition: ["not", lastStep.config.condition] as const,
      }),
    ]);
  }

  /**
   * Union the vertices in the traversal with another traversal.
   * @param other The other traversal to union with.
   */
  public union<const TOtherPath extends TraversalPath<any, any, any>>(
    other: VertexTraversal<TSchema, TOtherPath>,
  ) {
    return new VertexTraversal<TSchema, TPath | TOtherPath>(this.graph, [
      ...this.steps,
      new UnionStep({}, other.steps),
    ]);
  }

  /**
   * Intersect the vertices in the traversal with another traversal.
   * @param other The other traversal to intersect with.
   */
  public intersect<const TOtherPath extends TraversalPath<any, any, any>>(
    other: VertexTraversal<TSchema, TOtherPath>,
  ) {
    return new VertexTraversal<TSchema, TPath & TOtherPath>(this.graph, [
      ...this.steps,
      new IntersectStep({}, other.steps),
    ]);
  }

  /**
   * Deduplicate the vertices in the traversal.
   */
  public dedup() {
    return new VertexTraversal<TSchema, TPath>(this.graph, [...this.steps, new DedupStep({})]);
  }

  /**
   * Select the labeled elements in the path
   * @param pathLabels The labels to select.
   */
  public select<
    const TPathLabels extends readonly (string & GetTraversalPathLabelModifiers<TPath>)[],
  >(...pathLabels: TPathLabels) {
    return new ValueTraversal<TSchema, ResolveTraversalPathLabelModifiers<TPath, TPathLabels>>(
      this.graph,
      [
        ...this.steps,
        new SelectStep({
          pathLabels,
        }),
      ],
    );
  }

  /**
   * Get the values of the elements in the traversal.
   */
  public values() {
    return new ValueTraversal<TSchema, GetTraversalPathValue<TPath>>(this.graph, [
      ...this.steps,
      new ValuesStep({}),
    ]);
  }

  /**
   * Skip the first n vertices in the traversal.
   */
  public skip(n: number) {
    return new VertexTraversal<TSchema, TPath>(this.graph, [
      ...this.steps,
      new RangeStep({ start: n, end: Infinity }),
    ]);
  }

  /**
   * Take the first n vertices in the traversal.
   * @param n The number of vertices to take.
   */
  public limit(n: number) {
    return new VertexTraversal<TSchema, TPath>(this.graph, [
      ...this.steps,
      new RangeStep({ start: 0, end: n }),
    ]);
  }

  /**
   * Slice the vertices in the traversal.
   * @param start The index to start slicing
   * @param end The index to end slicing
   */
  public range(start: number, end: number) {
    return new VertexTraversal<TSchema, TPath>(this.graph, [
      ...this.steps,
      new RangeStep({ start, end }),
    ]);
  }

  /**
   * Count the number of vertices in the traversal.
   */
  public count() {
    return new ValueTraversal<TSchema, number>(this.graph, [...this.steps, new CountStep({})]);
  }

  /**
   * Select a single property of the vertices in the traversal.
   * @param propertyName The name of the property to select.
   */
  public property<const TPropertyName extends keyof GetTraversalPathProperties<TPath>>(
    propertyName: TPropertyName,
  ) {
    return new ValueTraversal<TSchema, GetTraversalPathProperties<TPath>[TPropertyName]>(
      this.graph,
      [
        ...this.steps,
        new MapElementsStep<any>({
          mapper: (path) => path.value.properties[propertyName],
        }),
      ],
    );
  }

  /**
   * Select specific properties of the vertices in the traversal.
   * @param propertyNames The names of the properties to select.
   */
  public properties(): ValueTraversal<TSchema, GetTraversalPathProperties<TPath>>;
  public properties<
    const TPropertyNames extends readonly (keyof GetTraversalPathProperties<TPath>)[],
  >(
    ...propertyNames: TPropertyNames
  ): ValueTraversal<TSchema, Pick<GetTraversalPathProperties<TPath>, TPropertyNames[number]>>;
  public properties<
    const TPropertyNames extends readonly (keyof GetTraversalPathProperties<TPath>)[],
  >(...propertyNames: TPropertyNames) {
    return new ValueTraversal<
      TSchema,
      Pick<GetTraversalPathProperties<TPath>, TPropertyNames[number]>
    >(this.graph, [
      ...this.steps,
      new MapElementsStep<any>({
        mapper: (path) => {
          const value = path.value;
          const storedProps = value[$StoredElement].properties;
          if (propertyNames.length === 0) {
            return storedProps;
          }
          const properties = {} as any;
          for (const propertyName of propertyNames) {
            properties[propertyName] = storedProps[propertyName as keyof typeof storedProps];
          }
          return properties;
        },
      }),
    ]);
  }

  /**
   * Map each vertex in the traversal to a new value.
   * @param mapper A function that maps the path to a new value.
   */
  public map<const TValue>(mapper: (path: TPath) => TValue) {
    return new ValueTraversal<TSchema, TValue>(this.graph, [
      ...this.steps,
      new MapElementsStep<TPath>({
        mapper,
      }),
    ]);
  }

  /**
   * Order the vertices in the traversal.
   */
  public order() {
    return new OrderVertexTraversal<TSchema, TPath>(this.graph, [
      ...this.steps,
      new OrderStep({ directions: [] }),
    ]);
  }
}

export class OrderVertexTraversal<
  const TSchema extends GraphSchema,
  const TPath,
> extends VertexTraversal<TSchema, TPath> {
  /**
   * Order the vertices in the traversal by a property.
   * @param propertyName The name of the property to order by.
   * @param direction The direction to order by.
   */
  by<const TPropertyName extends keyof GetTraversalPathProperties<TPath> & string>(
    propertyName: TPropertyName,
    direction: OrderDirection = "asc",
  ) {
    return new OrderVertexTraversal<TSchema, TPath>(
      this.graph,
      appendOrderDirection(this.steps, { key: propertyName, direction }),
    );
  }
}

export class ValueTraversal<const TSchema extends GraphSchema, const TValue> extends Traversal<
  TSchema,
  TValue
> {
  /**
   * Unfold each value in the traversal.
   */
  public unfold() {
    return new ValueTraversal<TSchema, TValue extends Iterable<infer U> ? U : TValue>(this.graph, [
      ...this.steps,
      new UnfoldStep({}),
    ]);
  }

  public values() {
    return new ValueTraversal<TSchema, GetTraversalPathValue<TValue>>(this.graph, [
      ...this.steps,
      new ValuesStep({}),
    ]);
  }

  /**
   * Order the values in the traversal.
   */
  public order() {
    return new OrderValueTraversal<TSchema, TValue>(this.graph, [
      ...this.steps,
      new OrderStep({ directions: [] }),
    ]);
  }
}

export class OrderValueTraversal<const TSchema extends GraphSchema, const TValue> extends ValueTraversal<
  TSchema,
  TValue
> {
  /**
   * Order the values in the traversal by their natural value.
   */
  public by(): OrderValueTraversal<TSchema, TValue>;
  /**
   * Order the values in the traversal by a property on the value.
   * @param propertyName The name of the property to order by.
   * @param direction The direction to order by.
   */
  public by<const TPropertyName extends keyof GetValueTraversalProperties<TValue> & string>(
    propertyName: TPropertyName,
    direction?: OrderDirection,
  ): OrderValueTraversal<TSchema, TValue>;
  public by<const TPropertyName extends keyof GetValueTraversalProperties<TValue> & string>(
    propertyName?: TPropertyName,
    direction: OrderDirection = "asc",
  ) {
    return new OrderValueTraversal<TSchema, TValue>(
      this.graph,
      appendOrderDirection(this.steps, { key: propertyName, direction }),
    );
  }
}

type ValueOf<T> = T[keyof T];

type GetValueTraversalProperties<TValue> =
  TValue extends Element<any, any, infer TProperties, any>
    ? TProperties
    : TValue extends object
      ? TValue
      : never;

function appendOrderDirection(
  steps: readonly Step<any>[],
  orderDirection: {
    key?: string;
    direction: OrderDirection;
  },
) {
  const nextSteps = [...steps];
  const orderStep =
    nextSteps.length > 0 && nextSteps[nextSteps.length - 1] instanceof OrderStep
      ? nextSteps[nextSteps.length - 1]
      : undefined;

  if (!orderStep) {
    nextSteps.push(new OrderStep({ directions: [orderDirection] }));
    return nextSteps;
  }

  nextSteps[nextSteps.length - 1] = orderStep.clone({
    directions: [...orderStep.config.directions, orderDirection],
  });

  return nextSteps;
}

type ResolveTraversalPathProperty<
  TSchema extends GraphSchema,
  TPath,
  TPropertyName extends string,
> = TPropertyName extends "@id"
  ? ElementId
  : TPropertyName extends "@label"
    ? string
    : TPath extends TraversalPath<any, infer TValue, any>
      ? RefineElementValue<TSchema, TValue, TPropertyName> extends infer TElement
        ? TElement extends Element<TSchema, any, infer TProperties, any>
          ? TPropertyName extends keyof TProperties
            ? TProperties[TPropertyName]
            : never
          : never
        : never
      : never;

type GetTraversalPathProperties<TPath> =
  TPath extends TraversalPath<any, infer TValue, any>
    ? TValue extends Element<any, any, infer TProperties, any>
      ? TProperties
      : never
    : never;

type RefineTraversalPathValue<TSchema extends GraphSchema, TPath, TPropertyName extends string> =
  TPath extends TraversalPath<infer TParent, infer TValue, infer TLabels>
    ? TraversalPath<TParent, RefineElementValue<TSchema, TValue, TPropertyName>, TLabels>
    : undefined;

type RefineElementValue<TSchema extends GraphSchema, TElement, TPropertyName extends string> =
  TElement extends Vertex<TSchema, infer TLabel>
    ? Vertex<
        TSchema,
        TPropertyName extends "@id" | "@label"
          ? TLabel
          : ValueOf<{
              [TVertexLabel in TLabel]: TPropertyName extends keyof VertexProperties<
                TSchema,
                TVertexLabel
              >
                ? TVertexLabel
                : never;
            }>
      >
    : TElement extends Edge<TSchema, infer TLabel>
      ? Edge<
          TSchema,
          TPropertyName extends "@id" | "@label"
            ? TLabel
            : ValueOf<{
                [TEdgeLabel in TLabel]: TPropertyName extends keyof EdgeProperties<
                  TSchema,
                  TEdgeLabel
                >
                  ? TEdgeLabel
                  : never;
              }>
        >
      : never;

type RepeatVertexTraversalPaths<THead, TTail> =
  THead extends TraversalPath<any, unknown, any> ? ReplaceRootTraversalPath<TTail, THead> : never;

type ReplaceRootTraversalPath<TNode, TNewRoot> =
  TNode extends TraversalPath<infer TParent, infer TValue, infer TLabels>
    ? TParent extends undefined
      ? TraversalPath<TNewRoot, TValue, TLabels>
      : TraversalPath<ReplaceRootTraversalPath<TParent, TNewRoot>, TValue, TLabels>
    : never;

type PathFromTraversal<TTraversal> = TTraversal extends Traversal<any, infer TPath> ? TPath : never;

export class RepeatVertexTraversal<
  const TSchema extends GraphSchema,
  const TPath,
> extends VertexTraversal<TSchema, TPath> {
  /**
   * Repeat the traversal until a sub-traversal returns at least one result.
   */
  public until(
    getUntilTraversal: (parent: VertexTraversal<TSchema, TPath>) => Traversal<any, any>,
  ) {
    const { steps: untilSteps } = getUntilTraversal(new VertexTraversal(this.graph, []));

    const { steps: existingSteps } = this;
    const newSteps: Step<any>[] = Array.from({ length: existingSteps.length });
    let found = false;
    for (let i = existingSteps.length - 1; i >= 0; i--) {
      const step = existingSteps[i]!;
      if (step instanceof RepeatStep) {
        found = true;
        newSteps[i] = new RepeatStep(
          {
            ...step.config,
            untilSteps,
          },
          step.steps,
        );
        for (i -= 1; i >= 0; i--) {
          newSteps[i] = existingSteps[i]!;
        }
        break;
      }
      newSteps[i] = step;
    }
    if (!found) {
      throw new Error("Cannot find a repeat step to add an until condition to.");
    }

    return new RepeatVertexTraversal<TSchema, TPath>(this.graph, newSteps);
  }

  /**
   * Repeat the traversal a certain number of times.
   * @param times The number of times to repeat the traversal.
   */
  public times(times: number) {
    const { steps: existingSteps } = this;
    const newSteps: Step<any>[] = Array.from({ length: existingSteps.length });
    let found = false;
    for (let i = existingSteps.length - 1; i >= 0; i--) {
      const step = existingSteps[i]!;
      if (step instanceof RepeatStep) {
        found = true;
        newSteps[i] = new RepeatStep(
          {
            ...step.config,
            times,
          },
          step.steps,
        );
        for (i -= 1; i >= 0; i--) {
          newSteps[i] = existingSteps[i]!;
        }
        break;
      }
      newSteps[i] = step;
    }
    if (!found) {
      throw new Error("Cannot find a repeat step to add a times number to.");
    }
    return new RepeatVertexTraversal<TSchema, TPath>(this.graph, newSteps);
  }

  /**
   * Emit the traversal path for each iteration
   */
  public emit() {
    const { steps: existingSteps } = this;
    const newSteps: Step<any>[] = Array.from({ length: existingSteps.length });
    let found = false;
    for (let i = existingSteps.length - 1; i >= 0; i--) {
      const step = existingSteps[i]!;
      if (step instanceof RepeatStep) {
        found = true;
        newSteps[i] = new RepeatStep(
          {
            ...step.config,
            emit: true,
          },
          step.steps,
        );
        for (i -= 1; i >= 0; i--) {
          newSteps[i] = existingSteps[i]!;
        }
        break;
      }
      newSteps[i] = step;
    }
    if (!found) {
      throw new Error("Cannot find a repeat step to add an emit flag to.");
    }
    return new RepeatVertexTraversal<TSchema, TPath>(this.graph, newSteps);
  }
}

/**
 * A traversal class for configuring shortest path queries.
 * Provides Gremlin-style fluent API for shortest path configuration.
 */
export class ShortestPathTraversal<
  const TSchema extends GraphSchema,
  const TPath,
> extends VertexTraversal<TSchema, TPath> {
  /**
   * Specify the target vertex by ID.
   * @param targetId The ID of the target vertex.
   */
  public to<const TTargetLabel extends VertexLabel<TSchema> = VertexLabel<TSchema>>(
    targetId: ElementId<TTargetLabel>,
  ): ShortestPathTraversal<
    TSchema,
    TraversalPath<TPath, Vertex<TSchema, TTargetLabel>, readonly []>
  >;
  /**
   * Specify the target vertex by condition.
   * @param condition A condition to match target vertices.
   */
  public to(
    condition: Condition,
  ): ShortestPathTraversal<
    TSchema,
    TraversalPath<TPath, Vertex<TSchema, VertexLabel<TSchema>>, readonly []>
  >;
  /**
   * Specify the target vertex using a traversal.
   * @param getTargetTraversal A function that returns a traversal to find the target.
   */
  public to(
    getTargetTraversal: (parent: VertexTraversal<TSchema, TPath>) => VertexTraversal<TSchema, any>,
  ): ShortestPathTraversal<
    TSchema,
    TraversalPath<TPath, Vertex<TSchema, VertexLabel<TSchema>>, readonly []>
  >;
  public to(
    targetOrConditionOrTraversal:
      | ElementId
      | Condition
      | ((parent: VertexTraversal<TSchema, TPath>) => VertexTraversal<TSchema, any>),
  ): ShortestPathTraversal<TSchema, any> {
    let targetId: ElementId | undefined;
    let targetCondition: Condition | undefined;

    if (typeof targetOrConditionOrTraversal === "function") {
      const traversal = targetOrConditionOrTraversal(
        new VertexTraversal<TSchema, TPath>(this.graph, []),
      );
      const filterStep = traversal.steps.find((step) => step.name === "FilterElements") as
        | { config: { condition: Condition } }
        | undefined;
      if (filterStep) {
        targetCondition = filterStep.config.condition;
      } else {
        throw new Error(
          "shortestPath().to() traversal must include a filter condition (e.g., has())",
        );
      }
    } else if (
      typeof targetOrConditionOrTraversal === "string" ||
      typeof targetOrConditionOrTraversal === "number"
    ) {
      targetId = targetOrConditionOrTraversal as ElementId;
    } else if (Array.isArray(targetOrConditionOrTraversal)) {
      targetCondition = targetOrConditionOrTraversal;
    } else {
      throw new Error("Invalid argument to shortestPath().to()");
    }

    return this.updateShortestPathStep({ targetId, targetCondition });
  }

  /**
   * Specify edge labels to traverse through.
   * @param edgeLabels The edge labels to traverse.
   */
  public through(...edgeLabels: EdgeLabel<TSchema>[]): ShortestPathTraversal<TSchema, TPath> {
    return this.updateShortestPathStep({ edgeLabels });
  }

  /**
   * Specify the direction of edge traversal.
   * @param direction The direction: "out", "in", or "both".
   */
  public direction(direction: "in" | "out" | "both"): ShortestPathTraversal<TSchema, TPath> {
    return this.updateShortestPathStep({ direction });
  }

  /**
   * Specify the maximum depth (number of hops) to search.
   * @param depth The maximum depth.
   */
  public maxDepth(depth: number): ShortestPathTraversal<TSchema, TPath> {
    return this.updateShortestPathStep({ maxDepth: depth });
  }

  /**
   * Enable weighted shortest path using Dijkstra's algorithm.
   * @param propertyName The edge property containing the weight.
   */
  public weightedBy(
    propertyName: AnyEdgePropertyName<TSchema> extends never
      ? string
      : AnyEdgePropertyName<TSchema>,
  ): ShortestPathTraversal<TSchema, TPath> {
    return this.updateShortestPathStep({ weightProperty: propertyName });
  }

  /**
   * Helper method to find and update the ShortestPathStep with new config.
   */
  private updateShortestPathStep(
    updates: Partial<{
      targetId: ElementId;
      targetCondition: Condition;
      direction: "in" | "out" | "both";
      edgeLabels: readonly string[];
      maxDepth: number;
      weightProperty: string;
    }>,
  ): ShortestPathTraversal<TSchema, TPath> {
    const { steps: existingSteps } = this;
    const newSteps: Step<any>[] = Array.from({ length: existingSteps.length });
    let found = false;

    for (let i = existingSteps.length - 1; i >= 0; i--) {
      const step = existingSteps[i]!;
      if (step instanceof ShortestPathStep) {
        found = true;
        newSteps[i] = step.clone(updates);
        for (i -= 1; i >= 0; i--) {
          newSteps[i] = existingSteps[i]!;
        }
        break;
      }
      newSteps[i] = step;
    }

    if (!found) {
      throw new Error("Cannot find a ShortestPathStep to update.");
    }

    return new ShortestPathTraversal<TSchema, TPath>(this.graph, newSteps);
  }
}

export class EdgeTraversal<const TSchema extends GraphSchema, const TPath> extends Traversal<
  TSchema,
  TPath
> {
  /**
   * Get the target vertices of the edges (the vertex each edge goes INTO).
   * In Gremlin, inV() returns the vertex at the "in" end of each edge.
   */
  public inV() {
    return new VertexTraversal<
      TSchema,
      TraversalPath<TPath, Vertex<TSchema, VertexLabel<TSchema>>, readonly []>
    >(this.graph, [
      ...this.steps,
      new VertexStep({
        direction: "inVertex",
        edgeLabels: [],
      }),
    ]);
  }

  /**
   * Get the source vertices of the edges (the vertex each edge comes OUT of).
   * In Gremlin, outV() returns the vertex at the "out" end of each edge.
   */
  public outV() {
    return new VertexTraversal<
      TSchema,
      TraversalPath<TPath, Vertex<TSchema, VertexLabel<TSchema>>, readonly []>
    >(this.graph, [
      ...this.steps,
      new VertexStep({
        direction: "outVertex",
        edgeLabels: [],
      }),
    ]);
  }

  /**
   * Get the other vertex of the edge.
   */
  public otherV() {
    return new VertexTraversal<
      TSchema,
      TraversalPath<TPath, Vertex<TSchema, VertexLabel<TSchema>>, readonly []>
    >(this.graph, [
      ...this.steps,
      new VertexStep({
        direction: "other",
        edgeLabels: [],
      }),
    ]);
  }

  /**
   * Get the vertices that are connected to the edges by both incoming and outgoing edges.
   */
  public bothV() {
    return new VertexTraversal<
      TSchema,
      TraversalPath<TPath, Vertex<TSchema, VertexLabel<TSchema>>, readonly []>
    >(this.graph, [
      ...this.steps,
      new VertexStep({
        direction: "both",
        edgeLabels: [],
      }),
    ]);
  }

  /**
   * Add a label to the last element in the path.
   * @param label The label to add to the last element in the path.
   */
  public as<const TLabel extends string>(label: TLabel) {
    const steps = [...this.steps];
    if (steps.length === 0) {
      throw new Error("Cannot add a label to an empty traversal.");
    }
    steps[steps.length - 1] = steps[steps.length - 1]!.withLabel(label);
    return new EdgeTraversal<TSchema, AddLabelToTraversalPath<TPath, TLabel>>(this.graph, steps);
  }

  /**
   * Filter the edges keeping only the ones with the specified labels.
   * @param labels The labels to filter the edges by.
   */
  public hasLabel<const TEdgeLabels extends readonly EdgeLabel<TSchema>[]>(...labels: TEdgeLabels) {
    return new EdgeTraversal<
      TSchema,
      TPath extends TraversalPath<infer TParent, any, infer TLabels>
        ? TraversalPath<TParent, Edge<TSchema, GetEdgeLabels<TSchema, TEdgeLabels>>, TLabels>
        : undefined
    >(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition:
          labels.length > 1
            ? ["or", ...labels.map((label) => ["=", "@label", label] as const)]
            : ["=", "@label", labels[0]],
      }),
    ]);
  }

  /**
   * Filter edges which have a property with the specified name.
   * @param propertyName The name of the property to filter the edges by.
   */
  public has<const TPropertyName extends string>(
    propertyName: TPropertyName,
  ): EdgeTraversal<TSchema, RefineTraversalPathValue<TSchema, TPath, TPropertyName>>;
  /**
   * Filter edges which have a property with the specified name and value.
   * @param propertyName The name of the property to filter the edges by.
   * @param propertyValue The value of the property to filter the edges by.
   */
  public has<const TPropertyName extends string>(
    propertyName: TPropertyName,
    propertyValue: ResolveTraversalPathProperty<TSchema, TPath, TPropertyName>,
  ): EdgeTraversal<TSchema, RefineTraversalPathValue<TSchema, TPath, TPropertyName>>;
  /**
   * Compare the value of a property of the edges to a specified value.
   * @param propertyName The name of the property to filter the edges by.
   * @param operator The operator to use to compare the property value.
   * @param propertyValue The value of the property to filter the edges by.
   */
  public has<const TPropertyName extends string>(
    propertyName: TPropertyName,
    operator: BinaryOperator,
    propertyValue: ResolveTraversalPathProperty<TSchema, TPath, TPropertyName>,
  ): EdgeTraversal<TSchema, RefineTraversalPathValue<TSchema, TPath, TPropertyName>>;
  public has(...args: any[]) {
    let condition: Condition;
    if (args.length === 0) {
      return this;
    }
    if (args.length === 1) {
      condition = ["exists", args[0]];
    } else if (args.length === 2) {
      condition = ["=", args[0], args[1]];
    } else {
      condition = [args[1], args[0], args[2]];
    }
    const lastStep = this.steps[this.steps.length - 1];
    if (lastStep instanceof FilterElementsStep) {
      // Coalesce conditions if the last step is a filter step.
      if (lastStep.config.condition[0] === "and") {
        return new EdgeTraversal(this.graph, [
          ...this.steps.slice(0, -1),
          lastStep.clone({
            condition: [
              "and",
              ...(lastStep.config.condition.slice(1) as Condition[]),
              condition,
            ] as const,
          }),
        ]);
      } else {
        return new EdgeTraversal(this.graph, [
          ...this.steps.slice(0, -1),
          lastStep.clone({
            condition: ["and", lastStep.config.condition, condition] as const,
          }),
        ]);
      }
    }
    return new EdgeTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter edges which have a property value in the specified list.
   * @param propertyName The name of the property to filter by.
   * @param values The list of values to check against.
   */
  public hasIn<const TPropertyName extends string>(
    propertyName: TPropertyName,
    values: readonly ResolveTraversalPathProperty<TSchema, TPath, TPropertyName>[],
  ): EdgeTraversal<TSchema, RefineTraversalPathValue<TSchema, TPath, TPropertyName>> {
    const condition: Condition = ["in", propertyName, values];
    return new EdgeTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter edges where the specified property is null or undefined.
   * @param propertyName The name of the property to check.
   */
  public isNull<const TPropertyName extends string>(
    propertyName: TPropertyName,
  ): EdgeTraversal<TSchema, TPath> {
    const condition: Condition = ["isNull", propertyName];
    return new EdgeTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter edges where the specified property is not null or undefined.
   * @param propertyName The name of the property to check.
   */
  public isNotNull<const TPropertyName extends string>(
    propertyName: TPropertyName,
  ): EdgeTraversal<TSchema, TPath> {
    const condition: Condition = ["isNotNull", propertyName];
    return new EdgeTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter edges where the specified property starts with the given value.
   * @param propertyName The name of the property to check.
   * @param value The prefix to match.
   */
  public startsWith<const TPropertyName extends string>(
    propertyName: TPropertyName,
    value: string,
  ): EdgeTraversal<TSchema, TPath> {
    const condition: Condition = ["startsWith", propertyName, value];
    return new EdgeTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter edges where the specified property ends with the given value.
   * @param propertyName The name of the property to check.
   * @param value The suffix to match.
   */
  public endsWith<const TPropertyName extends string>(
    propertyName: TPropertyName,
    value: string,
  ): EdgeTraversal<TSchema, TPath> {
    const condition: Condition = ["endsWith", propertyName, value];
    return new EdgeTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter edges where the specified property contains the given value.
   * @param propertyName The name of the property to check.
   * @param value The substring to match.
   */
  public containing<const TPropertyName extends string>(
    propertyName: TPropertyName,
    value: string,
  ): EdgeTraversal<TSchema, TPath> {
    const condition: Condition = ["contains", propertyName, value];
    return new EdgeTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Filter edges where the specified property matches the given regex pattern.
   * @param propertyName The name of the property to check.
   * @param pattern The regex pattern to match.
   */
  public matches<const TPropertyName extends string>(
    propertyName: TPropertyName,
    pattern: string,
  ): EdgeTraversal<TSchema, TPath> {
    const condition: Condition = ["=~", propertyName, pattern];
    return new EdgeTraversal(this.graph, [
      ...this.steps,
      new FilterElementsStep({
        condition,
      }),
    ]);
  }

  /**
   * Negate the condition on the last filter step.
   * Note: This only works if the last step is a FilterElementsStep.
   */
  public not(): EdgeTraversal<TSchema, TPath> {
    const lastStep = this.steps[this.steps.length - 1];
    if (!(lastStep instanceof FilterElementsStep)) {
      throw new Error("Cannot negate: last step is not a filter step. Use has() or similar first.");
    }
    return new EdgeTraversal(this.graph, [
      ...this.steps.slice(0, -1),
      lastStep.clone({
        condition: ["not", lastStep.config.condition] as const,
      }),
    ]);
  }

  /**
   * Union the edges in the traversal with another traversal.
   * @param other The other traversal to union with.
   */
  public union<const TOtherPath extends TraversalPath<any, any, any>>(
    other: EdgeTraversal<TSchema, TOtherPath>,
  ) {
    return new EdgeTraversal<TSchema, TPath | TOtherPath>(this.graph, [
      ...this.steps,
      new UnionStep({}, other.steps),
    ]);
  }

  /**
   * Intersect the edges in the traversal with another traversal.
   * @param other The other traversal to intersect with.
   */
  public intersect<const TOtherPath extends TraversalPath<any, any, any>>(
    other: EdgeTraversal<TSchema, TOtherPath>,
  ) {
    type TIntersection =
      TPath extends TraversalPath<any, infer TValue, any>
        ? TOtherPath extends TraversalPath<any, infer TOtherValue, any>
          ? TraversalPath<any, TValue & TOtherValue, any>
          : never
        : TPath & TOtherPath;
    return new EdgeTraversal<TSchema, TIntersection>(this.graph, [
      ...this.steps,
      new IntersectStep({}, other.steps),
    ]);
  }

  /**
   * Deduplicate the edges in the traversal.
   */
  public dedup() {
    return new EdgeTraversal<TSchema, TPath>(this.graph, [...this.steps, new DedupStep({})]);
  }

  /**
   * Select the labeled elements in the path
   * @param pathLabels The labels to select.
   */
  public select<
    const TPathLabels extends readonly (string & GetTraversalPathLabelModifiers<TPath>)[],
  >(...pathLabels: TPathLabels) {
    return new ValueTraversal<TSchema, ResolveTraversalPathLabelModifiers<TPath, TPathLabels>>(
      this.graph,
      [
        ...this.steps,
        new SelectStep({
          pathLabels,
        }),
      ],
    );
  }

  /**
   * Get the values of the elements in the traversal.
   */
  public values() {
    return new ValueTraversal<TSchema, GetTraversalPathValue<TPath>>(this.graph, [
      ...this.steps,
      new ValuesStep({}),
    ]);
  }
}
