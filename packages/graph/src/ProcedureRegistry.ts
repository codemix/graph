/**
 * ProcedureRegistry - Central registry for built-in Cypher procedures.
 *
 * This module provides a framework for defining and invoking procedures
 * in graph queries. Procedures are standalone operations that can:
 * - Query schema metadata (db.labels, db.propertyKeys, etc.)
 * - Perform administrative operations
 * - Execute custom logic
 *
 * Unlike functions, procedures:
 * - Return multiple rows (yield multiple records)
 * - Can perform side effects
 * - Are invoked with CALL, not in expressions
 */

import { $StoredElement, type GraphSource } from "./Graph.js";
import { TraversalPath } from "./Traversals.js";
import type { FunctionRegistry } from "./FunctionRegistry.js";

/**
 * Parameter specification for procedure validation.
 */
export interface ProcedureParamSpec {
  name: string;
  required: boolean;
  types?: readonly (
    | "string"
    | "number"
    | "boolean"
    | "list"
    | "map"
    | "node"
    | "relationship"
    | "any"
  )[];
}

/**
 * Output column specification for procedure results.
 */
export interface ProcedureYieldSpec {
  /** Column name in the result */
  name: string;
  /** Description of this output column */
  description?: string;
}

/**
 * Procedure definition in the registry.
 */
export interface ProcedureDefinition {
  /** Procedure name (case-insensitive matching, may include namespace like db.labels) */
  name: string;
  /** Description of what this procedure does */
  description: string;
  /** Parameter specifications */
  params: readonly ProcedureParamSpec[];
  /** Output columns that can be yielded */
  yields: readonly ProcedureYieldSpec[];
  /** Implementation function - yields result records */
  impl: (
    args: readonly unknown[],
    context: ProcedureCallContext,
  ) => Iterable<Record<string, unknown>>;
}

/**
 * Context passed to procedure implementations.
 */
export interface ProcedureCallContext {
  /** The graph source (if available) */
  graph?: GraphSource<any>;
  /** The current traversal path (if available) */
  path?: TraversalPath<any, any, any>;
  /** The function registry for dbms.functions() procedure */
  functionRegistry?: FunctionRegistry;
}

/**
 * Registry of all procedures.
 */
export class ProcedureRegistry {
  #procedures: Map<string, ProcedureDefinition> = new Map();

  public constructor() {
    this.registerBuiltins();
  }

  /**
   * Register a procedure definition.
   */
  public register(def: ProcedureDefinition): void {
    // Store with lowercase name for case-insensitive lookup
    this.#procedures.set(def.name.toLowerCase(), def);
  }

  /**
   * Look up a procedure by name (case-insensitive).
   */
  public get(name: string): ProcedureDefinition | undefined {
    return this.#procedures.get(name.toLowerCase());
  }

  /**
   * Check if a procedure exists.
   */
  public has(name: string): boolean {
    return this.#procedures.has(name.toLowerCase());
  }

  /**
   * Invoke a procedure with the given arguments.
   * Returns an iterator of result records.
   */
  public *invoke(
    name: string,
    args: readonly unknown[],
    context: ProcedureCallContext,
  ): Iterable<Record<string, unknown>> {
    const def = this.get(name);
    if (!def) {
      throw new Error(`Unknown procedure: ${name}`);
    }

    // Validate argument count
    const requiredParams = def.params.filter((p) => p.required).length;
    if (args.length < requiredParams) {
      throw new Error(
        `Procedure ${name} requires at least ${requiredParams} argument(s), got ${args.length}`,
      );
    }
    if (args.length > def.params.length) {
      throw new Error(
        `Procedure ${name} accepts at most ${def.params.length} argument(s), got ${args.length}`,
      );
    }

    yield* def.impl(args, context);
  }

  /**
   * Get all registered procedure names.
   */
  public procedureNames(): string[] {
    return Array.from(this.#procedures.values()).map((p) => p.name);
  }

  /**
   * Get the yield columns for a procedure.
   */
  public getYieldColumns(name: string): readonly ProcedureYieldSpec[] {
    const def = this.get(name);
    return def?.yields ?? [];
  }

  /**
   * Register all built-in procedures.
   */
  protected registerBuiltins(): void {
    this.registerSchemaProcedures();
    this.registerUtilityProcedures();
  }

  /**
   * Schema introspection procedures (db.* namespace).
   */
  protected registerSchemaProcedures(): void {
    // db.labels() - returns all node labels in the graph
    this.register({
      name: "db.labels",
      description: "Returns all node labels in the graph",
      params: [],
      yields: [{ name: "label", description: "A node label" }],
      impl: function* (_args, context) {
        if (!context.graph) {
          return;
        }
        const labels = new Set<string>();
        for (const vertex of context.graph.getVertices()) {
          labels.add(vertex.label);
        }
        for (const label of labels) {
          yield { label };
        }
      },
    });

    // db.relationshipTypes() - returns all relationship types
    this.register({
      name: "db.relationshipTypes",
      description: "Returns all relationship types in the graph",
      params: [],
      yields: [{ name: "relationshipType", description: "A relationship type" }],
      impl: function* (_args, context) {
        if (!context.graph) {
          return;
        }
        const types = new Set<string>();
        for (const edge of context.graph.getEdges()) {
          types.add(edge.label);
        }
        for (const type of types) {
          yield { relationshipType: type };
        }
      },
    });

    // db.propertyKeys() - returns all property keys used in the graph
    this.register({
      name: "db.propertyKeys",
      description: "Returns all property keys used in the graph",
      params: [],
      yields: [{ name: "propertyKey", description: "A property key" }],
      impl: function* (_args, context) {
        if (!context.graph) {
          return;
        }
        const keys = new Set<string>();
        // Collect from vertices
        for (const vertex of context.graph.getVertices()) {
          for (const key of Object.keys(vertex[$StoredElement].properties)) {
            keys.add(key);
          }
        }
        // Collect from edges
        for (const edge of context.graph.getEdges()) {
          for (const key of Object.keys(edge[$StoredElement].properties)) {
            keys.add(key);
          }
        }
        for (const key of keys) {
          yield { propertyKey: key };
        }
      },
    });

    // db.schema.nodeTypeProperties() - returns node types with their properties
    this.register({
      name: "db.schema.nodeTypeProperties",
      description: "Returns node types with their properties",
      params: [],
      yields: [
        { name: "nodeType", description: "The node type/label" },
        { name: "propertyName", description: "A property name on this type" },
        {
          name: "propertyTypes",
          description: "Types of values for this property",
        },
        {
          name: "mandatory",
          description: "Whether this property is always present",
        },
      ],
      impl: function* (_args, context) {
        if (!context.graph) {
          return;
        }
        // Group nodes by label and collect property info
        const typeProps = new Map<string, Map<string, { types: Set<string>; count: number }>>();
        const typeCounts = new Map<string, number>();

        for (const vertex of context.graph.getVertices()) {
          const label = vertex.label;
          typeCounts.set(label, (typeCounts.get(label) || 0) + 1);

          if (!typeProps.has(label)) {
            typeProps.set(label, new Map());
          }
          const propsMap = typeProps.get(label)!;

          for (const [key, value] of Object.entries(vertex[$StoredElement].properties)) {
            if (!propsMap.has(key)) {
              propsMap.set(key, { types: new Set(), count: 0 });
            }
            const propInfo = propsMap.get(key)!;
            propInfo.types.add(typeof value);
            propInfo.count++;
          }
        }

        for (const [nodeType, propsMap] of typeProps) {
          const totalCount = typeCounts.get(nodeType) || 0;
          for (const [propertyName, info] of propsMap) {
            yield {
              nodeType,
              propertyName,
              propertyTypes: Array.from(info.types),
              mandatory: info.count === totalCount,
            };
          }
        }
      },
    });

    // db.schema.relTypeProperties() - returns relationship types with their properties
    this.register({
      name: "db.schema.relTypeProperties",
      description: "Returns relationship types with their properties",
      params: [],
      yields: [
        { name: "relType", description: "The relationship type" },
        { name: "propertyName", description: "A property name on this type" },
        {
          name: "propertyTypes",
          description: "Types of values for this property",
        },
        {
          name: "mandatory",
          description: "Whether this property is always present",
        },
      ],
      impl: function* (_args, context) {
        if (!context.graph) {
          return;
        }
        // Group edges by type and collect property info
        const typeProps = new Map<string, Map<string, { types: Set<string>; count: number }>>();
        const typeCounts = new Map<string, number>();

        for (const edge of context.graph.getEdges()) {
          const relType = edge.label;
          typeCounts.set(relType, (typeCounts.get(relType) || 0) + 1);

          if (!typeProps.has(relType)) {
            typeProps.set(relType, new Map());
          }
          const propsMap = typeProps.get(relType)!;

          for (const [key, value] of Object.entries(edge[$StoredElement].properties)) {
            if (!propsMap.has(key)) {
              propsMap.set(key, { types: new Set(), count: 0 });
            }
            const propInfo = propsMap.get(key)!;
            propInfo.types.add(typeof value);
            propInfo.count++;
          }
        }

        for (const [relType, propsMap] of typeProps) {
          const totalCount = typeCounts.get(relType) || 0;
          for (const [propertyName, info] of propsMap) {
            yield {
              relType,
              propertyName,
              propertyTypes: Array.from(info.types),
              mandatory: info.count === totalCount,
            };
          }
        }
      },
    });
  }

  /**
   * Utility procedures.
   */
  protected registerUtilityProcedures(): void {
    // dbms.procedures() - returns all available procedures
    this.register({
      name: "dbms.procedures",
      description: "Returns all available procedures",
      params: [],
      yields: [
        { name: "name", description: "The procedure name" },
        { name: "description", description: "Description of the procedure" },
        { name: "signature", description: "The procedure signature" },
      ],
      impl: (_args, _context) => {
        const procedures = Array.from(this.#procedures.values());
        return procedures.map((p) => ({
          name: p.name,
          description: p.description,
          signature: `${p.name}(${p.params.map((a) => `${a.name}${a.required ? "" : "?"}`).join(", ")}) :: (${p.yields.map((y) => y.name).join(", ")})`,
        }));
      },
    });

    // dbms.functions() - returns all available functions
    this.register({
      name: "dbms.functions",
      description: "Returns all available functions",
      params: [],
      yields: [
        { name: "name", description: "The function name" },
        { name: "category", description: "Function category" },
        { name: "signature", description: "The function signature" },
      ],
      impl: function* (_args, context) {
        if (!context.functionRegistry) {
          return;
        }
        for (const name of context.functionRegistry.functionNames()) {
          const def = context.functionRegistry.get(name);
          if (def) {
            yield {
              name: def.name,
              category: def.category,
              signature: `${def.name}(${def.args.map((a) => `${a.name}${a.required ? "" : "?"}`).join(", ")})`,
            };
          }
        }
      },
    });
  }
}

/**
 * Global procedure registry instance.
 */
export const procedureRegistry = new ProcedureRegistry();

/**
 * Check if a procedure name is a known built-in procedure.
 */
export function isBuiltinProcedure(name: string): boolean {
  return procedureRegistry.has(name);
}
