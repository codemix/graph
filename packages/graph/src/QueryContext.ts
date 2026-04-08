import { GraphSource } from "./Graph.js";
import { GraphSchema } from "./GraphSchema.js";

/**
 * Query parameters for parameterized queries.
 * Used with $paramName syntax in Cypher queries.
 */
export type QueryParams = Record<string, unknown>;

/**
 * Options for configuring query execution limits.
 */
export interface QueryContextOptions {
  /**
   * Maximum number of iterations for repeat/loop operations.
   * Default: 1000
   */
  maxIterations?: number;

  /**
   * Maximum number of elements allowed in collection operations (collect, delete).
   * Default: 100000
   */
  maxCollectionSize?: number;
}

/**
 * Default options for query execution.
 */
export const DEFAULT_QUERY_CONTEXT_OPTIONS: Required<QueryContextOptions> = {
  maxIterations: 1000,
  maxCollectionSize: 100000,
};

/**
 * Context for query execution that replaces global mutable state.
 *
 * This class holds all the state needed during query execution:
 * - Query parameters ($param references)
 * - The graph source being queried
 * - Execution limits and options
 *
 * By passing this context explicitly through the traversal chain,
 * we avoid race conditions from concurrent queries sharing global state.
 */
export class QueryContext<TSchema extends GraphSchema = GraphSchema> {
  readonly #params: QueryParams;
  readonly #graph: GraphSource<TSchema>;
  readonly #options: Required<QueryContextOptions>;

  public constructor(
    graph: GraphSource<TSchema>,
    params: QueryParams = {},
    options: QueryContextOptions = {},
  ) {
    this.#params = params;
    this.#graph = graph;
    this.#options = {
      ...DEFAULT_QUERY_CONTEXT_OPTIONS,
      ...options,
    };
  }

  /**
   * Get the query parameters.
   */
  public get params(): QueryParams {
    return this.#params;
  }

  /**
   * Get the graph source being queried.
   */
  public get graph(): GraphSource<TSchema> {
    return this.#graph;
  }

  /**
   * Get the resolved options (with defaults applied).
   */
  public get options(): Required<QueryContextOptions> {
    return this.#options;
  }

  /**
   * Get a specific parameter value.
   * @param name The parameter name (without $ prefix)
   */
  public getParam(name: string): unknown {
    return this.#params[name];
  }

  /**
   * Check if a parameter exists.
   * @param name The parameter name (without $ prefix)
   */
  public hasParam(name: string): boolean {
    return name in this.#params;
  }

  /**
   * Create a new context with additional/updated parameters.
   * The original context remains unchanged.
   */
  public withParams(additionalParams: QueryParams): QueryContext<TSchema> {
    return new QueryContext(
      this.#graph,
      { ...this.#params, ...additionalParams },
      this.#options,
    );
  }

  /**
   * Create a new context with updated options.
   * The original context remains unchanged.
   */
  public withOptions(newOptions: QueryContextOptions): QueryContext<TSchema> {
    return new QueryContext(this.#graph, this.#params, {
      ...this.#options,
      ...newOptions,
    });
  }
}
