export type Comparator<T> = (a: T, b: T) => number;

/**
 * Checks if a value can be safely converted to a finite number.
 * Returns false for NaN, Infinity, and non-numeric strings.
 */
function isNumericConvertible(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "string") {
    if (value.trim() === "") return false;
    const num = Number(value);
    return Number.isFinite(num);
  }
  if (typeof value === "boolean") {
    return true;
  }
  return false;
}

/**
 * Type ordering for deterministic cross-type comparisons:
 * undefined < null < boolean < number < string < object
 *
 * When comparing values of different types that cannot be coerced,
 * this ordering is used to provide stable, predictable results.
 */
function getTypeOrder(value: unknown): number {
  if (value === undefined) return 0;
  if (value === null) return 1;
  if (typeof value === "boolean") return 2;
  if (typeof value === "number") return 3;
  if (typeof value === "string") return 4;
  if (typeof value === "object") return 5;
  return 6; // symbol, function, bigint, etc.
}

/**
 * Compares two values and returns a number indicating their relative order.
 *
 * For same-type comparisons:
 * - Numbers: subtraction (handles NaN by returning NaN for NaN vs NaN)
 * - Strings: localeCompare
 * - Booleans: true > false
 * - Objects: recursive comparison
 *
 * For cross-type comparisons:
 * - If both values are numeric-convertible, compares as numbers
 * - Otherwise, uses deterministic type ordering:
 *   undefined < null < boolean < number < string < object
 */
export function compare<T>(a: T, b: T): number {
  if (a === b) return 0;
  if (a === undefined) {
    if (b === undefined) return 0;
    return -1;
  }
  if (a === null) {
    if (b === null) return 0;
    return -1;
  }
  if (b === null) {
    return 1;
  }
  if (b === undefined) {
    return 1;
  }
  if (typeof a === "number") {
    if (typeof b === "number") {
      return a - b;
    }
    // Cross-type: number vs non-number
    if (isNumericConvertible(b)) {
      return a - Number(b);
    }
    // Non-coercible: use type ordering (number < string < object)
    return getTypeOrder(a) - getTypeOrder(b);
  }
  if (typeof a === "string") {
    if (typeof b === "string") {
      return a.localeCompare(b);
    }
    // If b is a number and a is numeric-convertible, compare as numbers
    if (typeof b === "number" && isNumericConvertible(a)) {
      return Number(a) - b;
    }
    // Otherwise use type ordering
    return getTypeOrder(a) - getTypeOrder(b);
  }
  if (typeof a === "boolean") {
    if (typeof b === "boolean") {
      return a === b ? 0 : a ? 1 : -1;
    }
    return getTypeOrder(a) - getTypeOrder(b);
  }
  if (typeof b === "number") {
    if (isNumericConvertible(a)) {
      return Number(a) - b;
    }
    return getTypeOrder(a) - getTypeOrder(b);
  }
  if (typeof b === "string") {
    return getTypeOrder(a) - getTypeOrder(b);
  }
  if (typeof a === "object") {
    if (typeof b === "object") {
      return compareObjects(a, b);
    }
    return getTypeOrder(a) - getTypeOrder(b);
  }
  if (typeof b === "object") {
    return getTypeOrder(a) - getTypeOrder(b);
  }
  return String(a).localeCompare(String(b));
}

export function compareObjects(a: object, b: object): number {
  if (a === b) return 0;
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return 1;
    }
    return compareArrays(a, b);
  }
  if (Array.isArray(b)) {
    return -1;
  }
  if (!isPlainObject(a)) {
    if (isPlainObject(b)) {
      return 1;
    }
    if (typeof (a as any).toString === "function" && typeof (b as any).toString === "function") {
      return (a as any).toString().localeCompare((b as any).toString());
    }
    if (typeof (a as any).valueOf === "function" && typeof (b as any).valueOf === "function") {
      return compare((a as any).valueOf(), (b as any).valueOf());
    }
    return 1;
  }
  if (!isPlainObject(b)) {
    return -1;
  }
  const aKeys = Object.keys(a) as (keyof typeof a & string)[];
  const bKeys = Object.keys(b) as (keyof typeof b & string)[];
  if (aKeys.length !== bKeys.length) {
    return aKeys.length - bKeys.length;
  }
  const seen = new Set<string>();
  for (let i = 0; i < aKeys.length; i++) {
    const aKey = aKeys[i]!;
    seen.add(aKey);
    const aValue = a[aKey];
    const bValue = (b as any)[aKey];
    const valueResult = compare(aValue, bValue);
    if (valueResult !== 0) {
      return valueResult;
    }
  }
  for (let i = 0; i < bKeys.length; i++) {
    const bKey = bKeys[i]!;
    if (!seen.has(bKey)) {
      return -1;
    }
  }
  return 0;
}

function compareArrays(a: unknown[], b: unknown[]): number {
  if (a.length !== b.length) {
    return a.length - b.length;
  }
  for (let i = 0; i < a.length; i++) {
    const valueResult = compare(a[i], b[i]);
    if (valueResult !== 0) {
      return valueResult;
    }
  }
  return 0;
}

// only returns true for plain objects, not instances of classes
function isPlainObject(value: unknown): value is object {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    value.constructor === Object
  );
}
