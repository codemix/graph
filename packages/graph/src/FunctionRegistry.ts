/**
 * FunctionRegistry - Central registry for built-in Cypher functions.
 *
 * This module provides a type-safe framework for defining and invoking
 * built-in functions in graph queries. Functions are categorized by type:
 * - Scalar: Operate on single values (toLower, abs, etc.)
 * - Aggregate: Operate on collections with DISTINCT support (count, sum, etc.)
 * - List: Operate on lists (head, tail, size, etc.)
 * - Type: Provide type information (type, labels, id, etc.)
 */

import { Edge, Vertex, $StoredElement } from "./Graph.js";
import { TraversalPath } from "./Traversals.js";
import {
  DateValue,
  LocalTimeValue,
  TimeValue,
  LocalDateTimeValue,
  DateTimeValue,
  DurationValue,
  isTemporalValue,
  durationBetween,
  durationInMonths,
  durationInDays,
  durationInSeconds,
  TruncateUnit,
  truncateDate,
  truncateDateTime,
  truncateLocalDateTime,
  truncateTime,
  truncateLocalTime,
} from "./TemporalTypes.js";

/**
 * Function argument specification for validation.
 */
export interface FunctionArgSpec {
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
    | "path"
    | "any"
  )[];
}

/**
 * Function definition in the registry.
 */
export interface FunctionDefinition {
  /** Function name (case-insensitive matching) */
  name: string;
  /** Function category */
  category: "scalar" | "aggregate" | "list" | "type" | "math" | "string" | "temporal";
  /** Whether this function supports DISTINCT modifier */
  supportsDistinct: boolean;
  /** Argument specifications */
  args: readonly FunctionArgSpec[];
  /** Whether this function accepts unlimited additional arguments beyond those specified in args */
  variadic?: boolean;
  /** Implementation function */
  impl: (args: readonly unknown[], path: TraversalPath<any, any, any>) => unknown;
}

/**
 * Function call context containing all information needed to evaluate a function.
 */
export interface FunctionCallContext {
  /** The function name */
  name: string;
  /** Function arguments (already resolved values) */
  args: readonly unknown[];
  /** Whether DISTINCT was specified */
  distinct: boolean;
  /** The current traversal path (for context-dependent functions) */
  path: TraversalPath<any, any, any>;
}

/**
 * Registry of all built-in functions.
 */
export class FunctionRegistry {
  #functions: Map<string, FunctionDefinition> = new Map();

  public constructor() {
    this.registerBuiltins();
  }

  /**
   * Register a function definition.
   */
  public register(def: FunctionDefinition): void {
    // Store with lowercase name for case-insensitive lookup
    this.#functions.set(def.name.toLowerCase(), def);
  }

  /**
   * Look up a function by name (case-insensitive).
   */
  public get(name: string): FunctionDefinition | undefined {
    return this.#functions.get(name.toLowerCase());
  }

  /**
   * Check if a function exists.
   */
  public has(name: string): boolean {
    return this.#functions.has(name.toLowerCase());
  }

  /**
   * Invoke a function with the given context.
   */
  public invoke(ctx: FunctionCallContext): unknown {
    const def = this.get(ctx.name);
    if (!def) {
      throw new Error(`Unknown function: ${ctx.name}`);
    }

    // Validate argument count
    const requiredArgs = def.args.filter((a) => a.required).length;
    if (ctx.args.length < requiredArgs) {
      throw new Error(
        `Function ${ctx.name} requires at least ${requiredArgs} argument(s), got ${ctx.args.length}`,
      );
    }
    // Skip max args check for variadic functions
    if (!def.variadic && ctx.args.length > def.args.length) {
      throw new Error(
        `Function ${ctx.name} accepts at most ${def.args.length} argument(s), got ${ctx.args.length}`,
      );
    }

    // Validate DISTINCT usage
    if (ctx.distinct && !def.supportsDistinct) {
      throw new Error(`Function ${ctx.name} does not support DISTINCT`);
    }

    return def.impl(ctx.args, ctx.path);
  }

  /**
   * Get all registered function names.
   */
  public functionNames(): string[] {
    return Array.from(this.#functions.values()).map((f) => f.name);
  }

  /**
   * Register all built-in functions.
   */
  protected registerBuiltins(): void {
    // Type functions
    this.registerTypeFunctions();
    // String functions
    this.registerStringFunctions();
    // Math functions
    this.registerMathFunctions();
    // List functions
    this.registerListFunctions();
    // Aggregate functions
    this.registerAggregateFunctions();
    // Path functions
    this.registerPathFunctions();
    // Temporal functions
    this.registerTemporalFunctions();
  }

  protected registerTypeFunctions(): void {
    // type(relationship) - returns the type of a relationship
    this.register({
      name: "type",
      category: "type",
      supportsDistinct: false,
      args: [{ name: "relationship", required: true, types: ["relationship"] }],
      impl: (args) => {
        const rel = args[0];
        if (rel instanceof Edge) {
          return rel.label;
        }
        return null;
      },
    });

    // labels(node) - returns the labels of a node
    this.register({
      name: "labels",
      category: "type",
      supportsDistinct: false,
      args: [{ name: "node", required: true, types: ["node"] }],
      impl: (args) => {
        const node = args[0];
        if (node instanceof Vertex) {
          return [node.label];
        }
        // Per Cypher semantics, labels(null) should return null
        if (node === null || node === undefined) {
          return null;
        }
        return [];
      },
    });

    // id(element) - returns the internal ID of a node or relationship
    this.register({
      name: "id",
      category: "type",
      supportsDistinct: false,
      args: [{ name: "element", required: true, types: ["node", "relationship"] }],
      impl: (args) => {
        const element = args[0];
        if (element instanceof Vertex || element instanceof Edge) {
          return element.id;
        }
        return null;
      },
    });

    // elementId(element) - returns the element ID (alias for id in our implementation)
    this.register({
      name: "elementId",
      category: "type",
      supportsDistinct: false,
      args: [{ name: "element", required: true, types: ["node", "relationship"] }],
      impl: (args) => {
        const element = args[0];
        if (element instanceof Vertex || element instanceof Edge) {
          return String(element.id);
        }
        return null;
      },
    });

    // properties(element) - returns all properties as a map
    this.register({
      name: "properties",
      category: "type",
      supportsDistinct: false,
      args: [
        {
          name: "element",
          required: true,
          types: ["node", "relationship", "map"],
        },
      ],
      impl: (args) => {
        const element = args[0];
        if (element instanceof Vertex || element instanceof Edge) {
          return element[$StoredElement].properties;
        }
        if (typeof element === "object" && element !== null) {
          return element;
        }
        return null;
      },
    });

    // startNode(relationship) - returns the start node of a relationship (source)
    this.register({
      name: "startNode",
      category: "type",
      supportsDistinct: false,
      args: [{ name: "relationship", required: true, types: ["relationship"] }],
      impl: (args) => {
        const rel = args[0];
        if (rel instanceof Edge) {
          // outV is the source (where the edge comes OUT of)
          return rel.outV;
        }
        return null;
      },
    });

    // endNode(relationship) - returns the end node of a relationship (target)
    this.register({
      name: "endNode",
      category: "type",
      supportsDistinct: false,
      args: [{ name: "relationship", required: true, types: ["relationship"] }],
      impl: (args) => {
        const rel = args[0];
        if (rel instanceof Edge) {
          // inV is the target (where the edge goes IN to)
          return rel.inV;
        }
        return null;
      },
    });
  }

  protected registerStringFunctions(): void {
    // toLower(string) - converts to lowercase
    this.register({
      name: "toLower",
      category: "string",
      supportsDistinct: false,
      args: [{ name: "original", required: true, types: ["string"] }],
      impl: (args) => {
        const str = args[0];
        return typeof str === "string" ? str.toLowerCase() : null;
      },
    });

    // toUpper(string) - converts to uppercase
    this.register({
      name: "toUpper",
      category: "string",
      supportsDistinct: false,
      args: [{ name: "original", required: true, types: ["string"] }],
      impl: (args) => {
        const str = args[0];
        return typeof str === "string" ? str.toUpperCase() : null;
      },
    });

    // trim(string) - removes leading and trailing whitespace
    this.register({
      name: "trim",
      category: "string",
      supportsDistinct: false,
      args: [{ name: "original", required: true, types: ["string"] }],
      impl: (args) => {
        const str = args[0];
        return typeof str === "string" ? str.trim() : null;
      },
    });

    // ltrim(string) - removes leading whitespace
    this.register({
      name: "ltrim",
      category: "string",
      supportsDistinct: false,
      args: [{ name: "original", required: true, types: ["string"] }],
      impl: (args) => {
        const str = args[0];
        return typeof str === "string" ? str.trimStart() : null;
      },
    });

    // rtrim(string) - removes trailing whitespace
    this.register({
      name: "rtrim",
      category: "string",
      supportsDistinct: false,
      args: [{ name: "original", required: true, types: ["string"] }],
      impl: (args) => {
        const str = args[0];
        return typeof str === "string" ? str.trimEnd() : null;
      },
    });

    // substring(string, start, length?) - extracts a substring
    this.register({
      name: "substring",
      category: "string",
      supportsDistinct: false,
      args: [
        { name: "original", required: true, types: ["string"] },
        { name: "start", required: true, types: ["number"] },
        { name: "length", required: false, types: ["number"] },
      ],
      impl: (args) => {
        const str = args[0];
        const start = args[1];
        const length = args[2];
        if (typeof str !== "string" || typeof start !== "number") return null;
        if (length === undefined) {
          return str.substring(start);
        }
        if (typeof length !== "number") return null;
        return str.substring(start, start + length);
      },
    });

    // left(string, length) - returns leftmost characters
    this.register({
      name: "left",
      category: "string",
      supportsDistinct: false,
      args: [
        { name: "original", required: true, types: ["string"] },
        { name: "length", required: true, types: ["number"] },
      ],
      impl: (args) => {
        const str = args[0];
        const length = args[1];
        if (typeof str !== "string" || typeof length !== "number") return null;
        return str.substring(0, length);
      },
    });

    // right(string, length) - returns rightmost characters
    this.register({
      name: "right",
      category: "string",
      supportsDistinct: false,
      args: [
        { name: "original", required: true, types: ["string"] },
        { name: "length", required: true, types: ["number"] },
      ],
      impl: (args) => {
        const str = args[0];
        const length = args[1];
        if (typeof str !== "string" || typeof length !== "number") return null;
        return str.substring(str.length - length);
      },
    });

    // replace(original, search, replace) - replaces all occurrences
    this.register({
      name: "replace",
      category: "string",
      supportsDistinct: false,
      args: [
        { name: "original", required: true, types: ["string"] },
        { name: "search", required: true, types: ["string"] },
        { name: "replace", required: true, types: ["string"] },
      ],
      impl: (args) => {
        const str = args[0];
        const search = args[1];
        const replacement = args[2];
        if (
          typeof str !== "string" ||
          typeof search !== "string" ||
          typeof replacement !== "string"
        )
          return null;
        return str.split(search).join(replacement);
      },
    });

    // reverse(string) - reverses a string
    this.register({
      name: "reverse",
      category: "string",
      supportsDistinct: false,
      args: [{ name: "original", required: true, types: ["string", "list"] }],
      impl: (args) => {
        const val = args[0];
        if (typeof val === "string") {
          return val.split("").reverse().join("");
        }
        if (Array.isArray(val)) {
          return [...val].reverse();
        }
        return null;
      },
    });

    // split(string, delimiter) - splits string into list
    this.register({
      name: "split",
      category: "string",
      supportsDistinct: false,
      args: [
        { name: "original", required: true, types: ["string"] },
        { name: "delimiter", required: true, types: ["string"] },
      ],
      impl: (args) => {
        const str = args[0];
        const delimiter = args[1];
        if (typeof str !== "string" || typeof delimiter !== "string") return null;
        return str.split(delimiter);
      },
    });

    // toString(value) - converts to string
    this.register({
      name: "toString",
      category: "string",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["any"] }],
      impl: (args) => {
        const val = args[0];
        if (val === null || val === undefined) return null;
        return String(val);
      },
    });

    // size(value) - returns size of string or list
    this.register({
      name: "size",
      category: "string",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["string", "list"] }],
      impl: (args) => {
        const val = args[0];
        if (typeof val === "string") return val.length;
        if (Array.isArray(val)) return val.length;
        return null;
      },
    });
  }

  protected registerMathFunctions(): void {
    // abs(number) - absolute value
    this.register({
      name: "abs",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.abs(val) : null;
      },
    });

    // ceil(number) - ceiling
    this.register({
      name: "ceil",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.ceil(val) : null;
      },
    });

    // floor(number) - floor
    this.register({
      name: "floor",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.floor(val) : null;
      },
    });

    // round(number, precision?) - round to precision
    this.register({
      name: "round",
      category: "math",
      supportsDistinct: false,
      args: [
        { name: "value", required: true, types: ["number"] },
        { name: "precision", required: false, types: ["number"] },
      ],
      impl: (args) => {
        const val = args[0];
        const precision = args[1];
        if (typeof val !== "number") return null;
        if (precision === undefined) return Math.round(val);
        if (typeof precision !== "number") return null;
        const factor = Math.pow(10, precision);
        return Math.round(val * factor) / factor;
      },
    });

    // sign(number) - returns sign (-1, 0, or 1)
    this.register({
      name: "sign",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.sign(val) : null;
      },
    });

    // sqrt(number) - square root
    this.register({
      name: "sqrt",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.sqrt(val) : null;
      },
    });

    // exp(number) - e^x
    this.register({
      name: "exp",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.exp(val) : null;
      },
    });

    // log(number) - natural logarithm
    this.register({
      name: "log",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.log(val) : null;
      },
    });

    // log10(number) - base-10 logarithm
    this.register({
      name: "log10",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.log10(val) : null;
      },
    });

    // sin(number) - sine
    this.register({
      name: "sin",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.sin(val) : null;
      },
    });

    // cos(number) - cosine
    this.register({
      name: "cos",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.cos(val) : null;
      },
    });

    // tan(number) - tangent
    this.register({
      name: "tan",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.tan(val) : null;
      },
    });

    // asin(number) - arc sine
    this.register({
      name: "asin",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.asin(val) : null;
      },
    });

    // acos(number) - arc cosine
    this.register({
      name: "acos",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.acos(val) : null;
      },
    });

    // atan(number) - arc tangent
    this.register({
      name: "atan",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: (args) => {
        const val = args[0];
        return typeof val === "number" ? Math.atan(val) : null;
      },
    });

    // atan2(y, x) - two-argument arc tangent
    this.register({
      name: "atan2",
      category: "math",
      supportsDistinct: false,
      args: [
        { name: "y", required: true, types: ["number"] },
        { name: "x", required: true, types: ["number"] },
      ],
      impl: (args) => {
        const y = args[0];
        const x = args[1];
        if (typeof y !== "number" || typeof x !== "number") return null;
        return Math.atan2(y, x);
      },
    });

    // rand() - random number between 0 and 1
    this.register({
      name: "rand",
      category: "math",
      supportsDistinct: false,
      args: [],
      impl: () => Math.random(),
    });

    // toInteger(value) - convert to integer
    this.register({
      name: "toInteger",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["any"] }],
      impl: (args) => {
        const val = args[0];
        if (val === null || val === undefined) return null;
        if (typeof val === "number") return Math.trunc(val);
        if (typeof val === "string") {
          const parsed = parseInt(val, 10);
          return isNaN(parsed) ? null : parsed;
        }
        if (typeof val === "boolean") return val ? 1 : 0;
        return null;
      },
    });

    // toFloat(value) - convert to float
    this.register({
      name: "toFloat",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["any"] }],
      impl: (args) => {
        const val = args[0];
        if (val === null || val === undefined) return null;
        if (typeof val === "number") return val;
        if (typeof val === "string") {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? null : parsed;
        }
        if (typeof val === "boolean") return val ? 1.0 : 0.0;
        return null;
      },
    });

    // toBoolean(value) - convert to boolean
    this.register({
      name: "toBoolean",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["any"] }],
      impl: (args) => {
        const val = args[0];
        if (val === null || val === undefined) return null;
        if (typeof val === "boolean") return val;
        if (typeof val === "string") {
          const lower = val.toLowerCase();
          if (lower === "true") return true;
          if (lower === "false") return false;
          return null;
        }
        // toBoolean on numbers, lists, maps, nodes, relationships, paths returns null
        return null;
      },
    });

    // pi() - returns PI
    this.register({
      name: "pi",
      category: "math",
      supportsDistinct: false,
      args: [],
      impl: () => Math.PI,
    });

    // e() - returns E
    this.register({
      name: "e",
      category: "math",
      supportsDistinct: false,
      args: [],
      impl: () => Math.E,
    });

    // toIntegerOrNull(value) - convert to integer, returning null for invalid types
    // Unlike toInteger(), never throws - returns null for lists, maps, nodes, relationships, paths
    this.register({
      name: "toIntegerOrNull",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["any"] }],
      impl: (args) => {
        const val = args[0];
        if (val === null || val === undefined) return null;
        if (typeof val === "number") return Math.trunc(val);
        if (typeof val === "string") {
          const parsed = parseInt(val, 10);
          return isNaN(parsed) ? null : parsed;
        }
        if (typeof val === "boolean") return val ? 1 : 0;
        // For any other type (list, map, node, relationship, path), return null
        return null;
      },
    });

    // toFloatOrNull(value) - convert to float, returning null for invalid types
    // Unlike toFloat(), never throws - returns null for booleans, lists, maps, nodes, relationships, paths
    this.register({
      name: "toFloatOrNull",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["any"] }],
      impl: (args) => {
        const val = args[0];
        if (val === null || val === undefined) return null;
        if (typeof val === "number") return val;
        if (typeof val === "string") {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? null : parsed;
        }
        // toFloatOrNull returns null for boolean (unlike toIntegerOrNull)
        // For any other type (boolean, list, map, node, relationship, path), return null
        return null;
      },
    });

    // toBooleanOrNull(value) - convert to boolean, returning null for invalid types
    // Unlike toBoolean(), never throws - returns null for numbers, lists, maps, nodes, relationships, paths
    this.register({
      name: "toBooleanOrNull",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["any"] }],
      impl: (args) => {
        const val = args[0];
        if (val === null || val === undefined) return null;
        if (typeof val === "boolean") return val;
        if (typeof val === "string") {
          const lower = val.toLowerCase();
          if (lower === "true") return true;
          if (lower === "false") return false;
          return null;
        }
        // For any other type (number, list, map, node, relationship, path), return null
        return null;
      },
    });

    // toStringOrNull(value) - convert to string, returning null for invalid types
    // Unlike toString(), returns null for lists, maps, nodes, relationships, paths
    this.register({
      name: "toStringOrNull",
      category: "math",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["any"] }],
      impl: (args) => {
        const val = args[0];
        if (val === null || val === undefined) return null;
        if (typeof val === "string") return val;
        if (typeof val === "number") return String(val);
        if (typeof val === "boolean") return String(val);
        // For any other type (list, map, node, relationship, path), return null
        return null;
      },
    });
  }

  protected registerListFunctions(): void {
    // head(list) - returns first element
    this.register({
      name: "head",
      category: "list",
      supportsDistinct: false,
      args: [{ name: "list", required: true, types: ["list"] }],
      impl: (args) => {
        const list = args[0];
        if (!Array.isArray(list) || list.length === 0) return null;
        return list[0];
      },
    });

    // tail(list) - returns all except first
    this.register({
      name: "tail",
      category: "list",
      supportsDistinct: false,
      args: [{ name: "list", required: true, types: ["list"] }],
      impl: (args) => {
        const list = args[0];
        if (!Array.isArray(list)) return null;
        return list.slice(1);
      },
    });

    // last(list) - returns last element
    this.register({
      name: "last",
      category: "list",
      supportsDistinct: false,
      args: [{ name: "list", required: true, types: ["list"] }],
      impl: (args) => {
        const list = args[0];
        if (!Array.isArray(list) || list.length === 0) return null;
        return list[list.length - 1];
      },
    });

    // range(start, end, step?) - creates a list of integers
    this.register({
      name: "range",
      category: "list",
      supportsDistinct: false,
      args: [
        { name: "start", required: true, types: ["number"] },
        { name: "end", required: true, types: ["number"] },
        { name: "step", required: false, types: ["number"] },
      ],
      impl: (args) => {
        const start = args[0];
        const end = args[1];
        const step = args[2] ?? 1;
        if (typeof start !== "number" || typeof end !== "number" || typeof step !== "number")
          return null;
        if (step === 0) return null; // Prevent infinite loop
        const result: number[] = [];
        if (step > 0) {
          for (let i = start; i <= end; i += step) {
            result.push(i);
          }
        } else {
          for (let i = start; i >= end; i += step) {
            result.push(i);
          }
        }
        return result;
      },
    });

    // keys(map) - returns keys of a map
    this.register({
      name: "keys",
      category: "list",
      supportsDistinct: false,
      args: [{ name: "map", required: true, types: ["map", "node", "relationship"] }],
      impl: (args) => {
        const val = args[0];
        if (val instanceof Vertex || val instanceof Edge) {
          return Object.keys(val[$StoredElement].properties);
        }
        if (typeof val === "object" && val !== null) {
          return Object.keys(val);
        }
        return null;
      },
    });

    // coalesce(value1, value2, ...) - returns first non-null value
    // This is a variadic function with no upper limit on arguments
    this.register({
      name: "coalesce",
      category: "list",
      supportsDistinct: false,
      variadic: true,
      args: [{ name: "value", required: true, types: ["any"] }],
      impl: (args) => {
        for (const arg of args) {
          if (arg !== null && arg !== undefined) {
            return arg;
          }
        }
        return null;
      },
    });
  }

  protected registerAggregateFunctions(): void {
    // Note: Aggregate functions are special-cased in the query pipeline.
    // These definitions exist primarily for validation and documentation.
    // The actual aggregation logic is in WithStep.computeSingleAggregate
    // and similar places in the step pipeline.

    // count - counts elements
    this.register({
      name: "count",
      category: "aggregate",
      supportsDistinct: true,
      args: [{ name: "value", required: false, types: ["any"] }],
      impl: () => {
        // Aggregate functions are handled specially - this is just a placeholder
        throw new Error("Aggregate functions must be handled at the step level");
      },
    });

    // sum - sums numeric values
    this.register({
      name: "sum",
      category: "aggregate",
      supportsDistinct: true,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: () => {
        throw new Error("Aggregate functions must be handled at the step level");
      },
    });

    // avg - averages numeric values
    this.register({
      name: "avg",
      category: "aggregate",
      supportsDistinct: true,
      args: [{ name: "value", required: true, types: ["number"] }],
      impl: () => {
        throw new Error("Aggregate functions must be handled at the step level");
      },
    });

    // min - returns minimum value
    this.register({
      name: "min",
      category: "aggregate",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["any"] }],
      impl: () => {
        throw new Error("Aggregate functions must be handled at the step level");
      },
    });

    // max - returns maximum value
    this.register({
      name: "max",
      category: "aggregate",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["any"] }],
      impl: () => {
        throw new Error("Aggregate functions must be handled at the step level");
      },
    });

    // collect - collects values into a list
    this.register({
      name: "collect",
      category: "aggregate",
      supportsDistinct: true,
      args: [{ name: "value", required: true, types: ["any"] }],
      impl: () => {
        throw new Error("Aggregate functions must be handled at the step level");
      },
    });
  }

  protected registerPathFunctions(): void {
    // length(path) - returns the length of a path (number of relationships)
    this.register({
      name: "length",
      category: "scalar",
      supportsDistinct: false,
      args: [{ name: "path", required: true, types: ["path"] }],
      impl: (args) => {
        const pathArg = args[0];
        // If the argument is a TraversalPath, count the edges in it
        if (pathArg instanceof TraversalPath) {
          let edgeCount = 0;
          for (const node of pathArg) {
            if (node.value instanceof Edge) {
              edgeCount++;
            }
          }
          return edgeCount;
        }
        // If it's already a list (from nodes() or relationships()), return its length
        if (Array.isArray(pathArg)) {
          return pathArg.length;
        }
        // If it's a string, return its length (overload for string length)
        if (typeof pathArg === "string") {
          return pathArg.length;
        }
        return null;
      },
    });

    // nodes(path) - returns the list of nodes in a path
    this.register({
      name: "nodes",
      category: "list",
      supportsDistinct: false,
      args: [{ name: "path", required: true, types: ["path"] }],
      impl: (args) => {
        const pathArg = args[0];
        if (pathArg instanceof TraversalPath) {
          const nodes: Vertex<any, any>[] = [];
          for (const node of pathArg) {
            if (node.value instanceof Vertex) {
              nodes.push(node.value);
            }
          }
          return nodes;
        }
        return null;
      },
    });

    // relationships(path) - returns the list of relationships in a path
    this.register({
      name: "relationships",
      category: "list",
      supportsDistinct: false,
      args: [{ name: "path", required: true, types: ["path"] }],
      impl: (args) => {
        const pathArg = args[0];
        if (pathArg instanceof TraversalPath) {
          const edges: Edge<any, any>[] = [];
          for (const node of pathArg) {
            if (node.value instanceof Edge) {
              edges.push(node.value);
            }
          }
          return edges;
        }
        return null;
      },
    });
  }

  protected registerTemporalFunctions(): void {
    // date() - creates a date value from a string or map
    // Syntax: date('YYYY-MM-DD') or date({year: YYYY, month: MM, day: DD})
    this.register({
      name: "date",
      category: "temporal",
      supportsDistinct: false,
      args: [{ name: "value", required: false, types: ["string", "map", "any"] }],
      impl: (args) => {
        const val = args[0];

        // date() with no args returns current date
        if (val === undefined) {
          const now = new Date();
          return new DateValue(now.getFullYear(), now.getMonth() + 1, now.getDate());
        }

        // Null propagation
        if (val === null) {
          return null;
        }

        // date(string) - parse ISO date
        if (typeof val === "string") {
          const dateValue = DateValue.fromString(val);
          if (!dateValue) {
            throw new Error(`Invalid date string: ${val}. Expected format: YYYY-MM-DD`);
          }
          return dateValue;
        }

        // date(map) - construct from components
        if (typeof val === "object" && val !== null) {
          const map = val as Record<string, unknown>;
          const dateValue = DateValue.fromMap(map);
          if (!dateValue) {
            throw new Error(`Invalid date map: must have year, month, day as numbers`);
          }
          return dateValue;
        }

        return null;
      },
    });

    // localtime() - creates a local time value (no timezone)
    // Syntax: localtime(), localtime('HH:MM:SS.nnn'), localtime({hour, minute, second, nanosecond})
    this.register({
      name: "localtime",
      category: "temporal",
      supportsDistinct: false,
      args: [{ name: "value", required: false, types: ["string", "map", "any"] }],
      impl: (args) => {
        const val = args[0];

        // localtime() with no args returns current local time
        if (val === undefined) {
          const now = new Date();
          return new LocalTimeValue(
            now.getHours(),
            now.getMinutes(),
            now.getSeconds(),
            now.getMilliseconds() * 1_000_000,
          );
        }

        // Null propagation
        if (val === null) {
          return null;
        }

        // localtime(string) - parse ISO time
        if (typeof val === "string") {
          const timeValue = LocalTimeValue.fromString(val);
          if (!timeValue) {
            throw new Error(
              `Invalid localtime string: ${val}. Expected format: HH:MM:SS or HH:MM:SS.nnnnnnnnn`,
            );
          }
          return timeValue;
        }

        // localtime(map) - construct from components
        if (typeof val === "object" && val !== null) {
          const map = val as Record<string, unknown>;
          const timeValue = LocalTimeValue.fromMap(map);
          if (!timeValue) {
            throw new Error(`Invalid localtime map: must have hour, minute, second as numbers`);
          }
          return timeValue;
        }

        return null;
      },
    });

    // time() - creates a time value with timezone offset
    // Syntax: time(), time('HH:MM:SS.nnn+HH:MM'), time({hour, minute, second, nanosecond, offset})
    this.register({
      name: "time",
      category: "temporal",
      supportsDistinct: false,
      args: [{ name: "value", required: false, types: ["string", "map", "any"] }],
      impl: (args) => {
        const val = args[0];

        // time() with no args returns current time with local offset
        if (val === undefined) {
          const now = new Date();
          // Get local timezone offset in seconds (JS returns minutes, negated)
          const offsetSeconds = -now.getTimezoneOffset() * 60;
          return new TimeValue(
            now.getHours(),
            now.getMinutes(),
            now.getSeconds(),
            now.getMilliseconds() * 1_000_000,
            offsetSeconds,
          );
        }

        // Null propagation
        if (val === null) {
          return null;
        }

        // time(string) - parse ISO time with offset
        if (typeof val === "string") {
          const timeValue = TimeValue.fromString(val);
          if (!timeValue) {
            throw new Error(
              `Invalid time string: ${val}. Expected format: HH:MM:SS+HH:MM, HH:MM:SS-HH:MM, or HH:MM:SSZ`,
            );
          }
          return timeValue;
        }

        // time(map) - construct from components
        if (typeof val === "object" && val !== null) {
          const map = val as Record<string, unknown>;
          const timeValue = TimeValue.fromMap(map);
          if (!timeValue) {
            throw new Error(`Invalid time map: must have hour, minute, second as numbers`);
          }
          return timeValue;
        }

        return null;
      },
    });

    // localdatetime() - creates a local datetime value (no timezone)
    // Syntax: localdatetime(), localdatetime('YYYY-MM-DDTHH:MM:SS.nnn'), localdatetime({...})
    this.register({
      name: "localdatetime",
      category: "temporal",
      supportsDistinct: false,
      args: [{ name: "value", required: false, types: ["string", "map", "any"] }],
      impl: (args) => {
        const val = args[0];

        // localdatetime() with no args returns current local datetime
        if (val === undefined) {
          const now = new Date();
          return new LocalDateTimeValue(
            now.getFullYear(),
            now.getMonth() + 1,
            now.getDate(),
            now.getHours(),
            now.getMinutes(),
            now.getSeconds(),
            now.getMilliseconds() * 1_000_000,
          );
        }

        // Null propagation
        if (val === null) {
          return null;
        }

        // localdatetime(string) - parse ISO datetime
        if (typeof val === "string") {
          const dtValue = LocalDateTimeValue.fromString(val);
          if (!dtValue) {
            throw new Error(
              `Invalid localdatetime string: ${val}. Expected format: YYYY-MM-DDTHH:MM:SS or YYYY-MM-DDTHH:MM:SS.nnnnnnnnn`,
            );
          }
          return dtValue;
        }

        // localdatetime(map) - construct from components
        if (typeof val === "object" && val !== null) {
          const map = val as Record<string, unknown>;
          const dtValue = LocalDateTimeValue.fromMap(map);
          if (!dtValue) {
            throw new Error(`Invalid localdatetime map: must have year, month, day as numbers`);
          }
          return dtValue;
        }

        return null;
      },
    });

    // datetime() - creates a datetime value with timezone
    // Syntax: datetime(), datetime('YYYY-MM-DDTHH:MM:SS.nnn+HH:MM'), datetime({...})
    this.register({
      name: "datetime",
      category: "temporal",
      supportsDistinct: false,
      args: [{ name: "value", required: false, types: ["string", "map", "any"] }],
      impl: (args) => {
        const val = args[0];

        // datetime() with no args returns current datetime with local offset
        if (val === undefined) {
          const now = new Date();
          const offsetSeconds = -now.getTimezoneOffset() * 60;
          return new DateTimeValue(
            now.getFullYear(),
            now.getMonth() + 1,
            now.getDate(),
            now.getHours(),
            now.getMinutes(),
            now.getSeconds(),
            now.getMilliseconds() * 1_000_000,
            offsetSeconds,
          );
        }

        // Null propagation
        if (val === null) {
          return null;
        }

        // datetime(string) - parse ISO datetime with timezone
        if (typeof val === "string") {
          const dtValue = DateTimeValue.fromString(val);
          if (!dtValue) {
            throw new Error(
              `Invalid datetime string: ${val}. Expected format: YYYY-MM-DDTHH:MM:SS+HH:MM, YYYY-MM-DDTHH:MM:SSZ, or YYYY-MM-DDTHH:MM:SS[Timezone]`,
            );
          }
          return dtValue;
        }

        // datetime(map) - construct from components
        if (typeof val === "object" && val !== null) {
          const map = val as Record<string, unknown>;
          const dtValue = DateTimeValue.fromMap(map);
          if (!dtValue) {
            throw new Error(`Invalid datetime map: must have year, month, day as numbers`);
          }
          return dtValue;
        }

        return null;
      },
    });

    // duration() - creates a duration value
    // Syntax: duration('P1Y2M3D'), duration({years: 1, months: 2, days: 3})
    this.register({
      name: "duration",
      category: "temporal",
      supportsDistinct: false,
      args: [{ name: "value", required: true, types: ["string", "map", "any"] }],
      impl: (args) => {
        const val = args[0];

        // Null propagation
        if (val === null || val === undefined) {
          return null;
        }

        // duration(string) - parse ISO 8601 duration
        if (typeof val === "string") {
          const durationValue = DurationValue.fromString(val);
          if (!durationValue) {
            throw new Error(
              `Invalid duration string: ${val}. Expected ISO 8601 format: P[n]Y[n]M[n]DT[n]H[n]M[n]S (e.g., P1Y2M3D, PT1H30M, P1DT12H)`,
            );
          }
          return durationValue;
        }

        // duration(map) - construct from components
        if (typeof val === "object" && val !== null) {
          const map = val as Record<string, unknown>;
          const durationValue = DurationValue.fromMap(map);
          if (!durationValue) {
            throw new Error(
              `Invalid duration map: must have numeric values for years, months, days, hours, minutes, seconds, etc.`,
            );
          }
          return durationValue;
        }

        return null;
      },
    });

    // duration.between() - compute duration between two temporal values
    this.register({
      name: "duration.between",
      category: "temporal",
      supportsDistinct: false,
      args: [
        { name: "temporal1", required: true, types: ["any"] },
        { name: "temporal2", required: true, types: ["any"] },
      ],
      impl: (args) => {
        const start = args[0];
        const end = args[1];

        // Null propagation
        if (start === null || start === undefined) return null;
        if (end === null || end === undefined) return null;

        if (!isTemporalValue(start) || !isTemporalValue(end)) {
          throw new Error(`duration.between requires two temporal values`);
        }

        return durationBetween(start, end);
      },
    });

    // duration.inMonths() - compute duration in months between two temporal values
    this.register({
      name: "duration.inMonths",
      category: "temporal",
      supportsDistinct: false,
      args: [
        { name: "temporal1", required: true, types: ["any"] },
        { name: "temporal2", required: true, types: ["any"] },
      ],
      impl: (args) => {
        const start = args[0];
        const end = args[1];

        // Null propagation
        if (start === null || start === undefined) return null;
        if (end === null || end === undefined) return null;

        if (!isTemporalValue(start) || !isTemporalValue(end)) {
          throw new Error(`duration.inMonths requires two temporal values`);
        }

        return durationInMonths(start, end);
      },
    });

    // duration.inDays() - compute duration in days between two temporal values
    this.register({
      name: "duration.inDays",
      category: "temporal",
      supportsDistinct: false,
      args: [
        { name: "temporal1", required: true, types: ["any"] },
        { name: "temporal2", required: true, types: ["any"] },
      ],
      impl: (args) => {
        const start = args[0];
        const end = args[1];

        // Null propagation
        if (start === null || start === undefined) return null;
        if (end === null || end === undefined) return null;

        if (!isTemporalValue(start) || !isTemporalValue(end)) {
          throw new Error(`duration.inDays requires two temporal values`);
        }

        return durationInDays(start, end);
      },
    });

    // duration.inSeconds() - compute duration in seconds between two temporal values
    this.register({
      name: "duration.inSeconds",
      category: "temporal",
      supportsDistinct: false,
      args: [
        { name: "temporal1", required: true, types: ["any"] },
        { name: "temporal2", required: true, types: ["any"] },
      ],
      impl: (args) => {
        const start = args[0];
        const end = args[1];

        // Null propagation
        if (start === null || start === undefined) return null;
        if (end === null || end === undefined) return null;

        if (!isTemporalValue(start) || !isTemporalValue(end)) {
          throw new Error(`duration.inSeconds requires two temporal values`);
        }

        return durationInSeconds(start, end);
      },
    });

    // date.truncate() - truncate a date to a specific unit
    this.register({
      name: "date.truncate",
      category: "temporal",
      supportsDistinct: false,
      args: [
        { name: "unit", required: true, types: ["string"] },
        { name: "input", required: true, types: ["any"] },
        { name: "overrides", required: false, types: ["map"] },
      ],
      impl: (args) => {
        const unit = args[0] as string;
        const input = args[1];
        const overrides = args[2] as Record<string, number> | undefined;

        if (input === null || input === undefined) return null;
        if (!(input instanceof DateValue)) {
          throw new Error(`date.truncate requires a date value`);
        }

        return truncateDate(unit as TruncateUnit, input, overrides);
      },
    });

    // datetime.truncate() - truncate a datetime to a specific unit
    this.register({
      name: "datetime.truncate",
      category: "temporal",
      supportsDistinct: false,
      args: [
        { name: "unit", required: true, types: ["string"] },
        { name: "input", required: true, types: ["any"] },
        { name: "overrides", required: false, types: ["map"] },
      ],
      impl: (args) => {
        const unit = args[0] as string;
        const input = args[1];
        const overrides = args[2] as Record<string, number> | undefined;

        if (input === null || input === undefined) return null;
        if (!(input instanceof DateTimeValue)) {
          throw new Error(`datetime.truncate requires a datetime value`);
        }

        return truncateDateTime(unit as TruncateUnit, input, overrides);
      },
    });

    // localdatetime.truncate() - truncate a localdatetime to a specific unit
    this.register({
      name: "localdatetime.truncate",
      category: "temporal",
      supportsDistinct: false,
      args: [
        { name: "unit", required: true, types: ["string"] },
        { name: "input", required: true, types: ["any"] },
        { name: "overrides", required: false, types: ["map"] },
      ],
      impl: (args) => {
        const unit = args[0] as string;
        const input = args[1];
        const overrides = args[2] as Record<string, number> | undefined;

        if (input === null || input === undefined) return null;
        if (!(input instanceof LocalDateTimeValue)) {
          throw new Error(`localdatetime.truncate requires a localdatetime value`);
        }

        return truncateLocalDateTime(unit as TruncateUnit, input, overrides);
      },
    });

    // time.truncate() - truncate a time to a specific unit
    this.register({
      name: "time.truncate",
      category: "temporal",
      supportsDistinct: false,
      args: [
        { name: "unit", required: true, types: ["string"] },
        { name: "input", required: true, types: ["any"] },
        { name: "overrides", required: false, types: ["map"] },
      ],
      impl: (args) => {
        const unit = args[0] as string;
        const input = args[1];
        const overrides = args[2] as Record<string, number> | undefined;

        if (input === null || input === undefined) return null;
        if (!(input instanceof TimeValue)) {
          throw new Error(`time.truncate requires a time value`);
        }

        return truncateTime(unit as TruncateUnit, input, overrides);
      },
    });

    // localtime.truncate() - truncate a localtime to a specific unit
    this.register({
      name: "localtime.truncate",
      category: "temporal",
      supportsDistinct: false,
      args: [
        { name: "unit", required: true, types: ["string"] },
        { name: "input", required: true, types: ["any"] },
        { name: "overrides", required: false, types: ["map"] },
      ],
      impl: (args) => {
        const unit = args[0] as string;
        const input = args[1];
        const overrides = args[2] as Record<string, number> | undefined;

        if (input === null || input === undefined) return null;
        if (!(input instanceof LocalTimeValue)) {
          throw new Error(`localtime.truncate requires a localtime value`);
        }

        return truncateLocalTime(unit as TruncateUnit, input, overrides);
      },
    });
  }
}

/**
 * Global function registry instance.
 */
export const functionRegistry = new FunctionRegistry();

/**
 * Evaluate a function call with the given arguments.
 *
 * @param name The function name
 * @param args The resolved argument values
 * @param path The current traversal path
 * @param distinct Whether DISTINCT was specified
 */
export function evaluateFunction(
  name: string,
  args: readonly unknown[],
  path: TraversalPath<any, any, any>,
  distinct = false,
): unknown {
  return functionRegistry.invoke({ name, args, path, distinct });
}

/**
 * Check if a function name is a known built-in function.
 */
export function isBuiltinFunction(name: string): boolean {
  return functionRegistry.has(name);
}

/**
 * Check if a function is an aggregate function.
 */
export function isAggregateFunction(name: string): boolean {
  const def = functionRegistry.get(name);
  return def?.category === "aggregate";
}

/**
 * Check if a function's argument at the given index expects a path.
 * This is used to convert VariableRef to pathRef for path functions like nodes(), relationships(), length().
 */
export function functionArgExpectsPath(name: string, argIndex: number): boolean {
  const def = functionRegistry.get(name);
  if (!def) return false;
  const argSpec = def.args[argIndex];
  if (!argSpec) return false;
  return argSpec.types?.includes("path") ?? false;
}
