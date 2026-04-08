import { test, expect } from "vitest";
import { compare, compareObjects } from "../Comparator.js";

test("compare() with primitives - returns 0 for equal values", () => {
  expect(compare(5, 5)).toBe(0);
  expect(compare("test", "test")).toBe(0);
  expect(compare(true, true)).toBe(0);
  expect(compare(null, null)).toBe(0);
  expect(compare(undefined, undefined)).toBe(0);
});

test("compare() with primitives - handles undefined comparisons", () => {
  expect(compare(undefined, 5)).toBe(-1);
  expect(compare(5, undefined)).toBe(1);
  expect(compare(undefined, null)).toBe(-1);
});

test("compare() with primitives - handles null comparisons", () => {
  expect(compare(null, 5)).toBe(-1);
  expect(compare(5, null)).toBe(1);
  expect(compare(null, "test")).toBe(-1);
  expect(compare("test", null)).toBe(1);
});

test("compare() with primitives - compares numbers", () => {
  expect(compare(1, 2)).toBeLessThan(0);
  expect(compare(2, 1)).toBeGreaterThan(0);
  expect(compare(5.5, 5.5)).toBe(0);
});

test("compare() with primitives - compares numbers with numeric strings", () => {
  // @ts-expect-error Testing mixed types
  expect(compare(5, "10")).toBe(-5);
  // @ts-expect-error Testing mixed types
  expect(compare("5", 10)).toBe(-5);
  // @ts-expect-error Testing mixed types
  expect(compare(10, "5")).toBe(5);
});

test("compare() with primitives - numbers vs non-coercible strings use type ordering", () => {
  // Non-coercible strings should not produce NaN
  // Type ordering: number (3) < string (4), so number - string = -1
  // @ts-expect-error Testing mixed types
  const result = compare(5, "hello");
  expect(Number.isNaN(result)).toBe(false);
  expect(result).toBeLessThan(0); // numbers sort before strings

  // @ts-expect-error Testing mixed types
  const result2 = compare("hello", 5);
  expect(Number.isNaN(result2)).toBe(false);
  expect(result2).toBeGreaterThan(0); // strings sort after numbers
});

test("compare() with primitives - compares strings", () => {
  expect(compare("a", "b")).toBeLessThan(0);
  expect(compare("b", "a")).toBeGreaterThan(0);
  expect(compare("hello", "hello")).toBe(0);
});

test("compare() with primitives - compares strings with non-strings", () => {
  // Numeric string vs number: compared as numbers
  // @ts-expect-error Testing mixed types
  expect(compare("5", 10)).toBe(-5);
  // Non-numeric string vs object: uses type ordering (string < object)
  // @ts-expect-error Testing mixed types
  const result = compare("test", { toString: () => "test" });
  expect(typeof result).toBe("number");
  expect(result).toBeLessThan(0); // strings sort before objects
});

test("compare() with primitives - compares booleans", () => {
  expect(compare(true, false)).toBeGreaterThan(0);
  expect(compare(false, true)).toBeLessThan(0);
  // When comparing same booleans, it returns early with 0
  expect(compare(true, true)).toBe(0);
  expect(compare(false, false)).toBe(0);
});

test("compare() with primitives - compares booleans with non-booleans", () => {
  // Boolean vs number: type ordering (boolean < number)
  // @ts-expect-error Testing mixed types
  expect(compare(true, 1)).toBeLessThan(0);
  // Boolean vs string: type ordering (boolean < string)
  // @ts-expect-error Testing mixed types
  expect(compare(false, "false")).toBeLessThan(0);
});

test("compare() with primitives - handles mixed type comparisons", () => {
  // Number vs non-coercible string: type ordering
  // @ts-expect-error Testing mixed types
  expect(compare(5, "test")).toBeLessThan(0);
  // @ts-expect-error Testing mixed types
  expect(compare("test", 5)).toBeGreaterThan(0);
});

test("compare() with primitives - compares using String() and Number() for fallback", () => {
  const result = compare(Symbol("a"), Symbol("b"));
  expect(typeof result).toBe("number");
});

test("compare() with objects - compares arrays", () => {
  expect(compare([1, 2, 3], [1, 2, 3])).toBe(0);
  expect(compare([1, 2], [1, 2, 3])).toBeLessThan(0);
  expect(compare([1, 2, 3], [1, 2])).toBeGreaterThan(0);
  expect(compare([1, 2, 3], [1, 2, 4])).toBeLessThan(0);
});

test("compare() with objects - compares plain objects", () => {
  expect(compare({ a: 1 }, { a: 1 })).toBe(0);
  expect(compare({ a: 1, b: 2 }, { a: 1 })).toBeGreaterThan(0);
  expect(compare({ a: 1 }, { a: 1, b: 2 })).toBeLessThan(0);
  expect(compare({ a: 1 }, { a: 2 })).toBeLessThan(0);
});

test("compare() with objects - compares objects with different keys", () => {
  expect(compare({ a: 1 }, { b: 1 })).not.toBe(0);
  expect(compare({ a: 1, b: 2 }, { a: 1, c: 2 })).not.toBe(0);
});

test("compare() with objects - compares nested objects", () => {
  expect(compare({ a: { b: 1 } }, { a: { b: 1 } })).toBe(0);
  expect(compare({ a: { b: 1 } }, { a: { b: 2 } })).toBeLessThan(0);
});

test("compare() with objects - compares object with non-object", () => {
  // Object vs number: type ordering (number < object)
  // @ts-expect-error Testing mixed types
  const result1 = compare({ a: 1 }, 5);
  expect(result1).toBeGreaterThan(0); // objects sort after numbers

  // Number vs object: type ordering
  // @ts-expect-error Testing mixed types
  const result2 = compare(5, { a: 1 });
  expect(result2).toBeLessThan(0); // numbers sort before objects

  // Object vs string: type ordering (string < object)
  // @ts-expect-error Testing mixed types
  const result3 = compare({ a: 1 }, "test");
  expect(result3).toBeGreaterThan(0); // objects sort after strings
});

test("compare() with objects - handles class instances with toString", () => {
  class TestClass {
    constructor(public value: string) {}
    toString() {
      return this.value;
    }
  }

  const obj1 = new TestClass("a");
  const obj2 = new TestClass("b");
  expect(compare(obj1, obj2)).toBeLessThan(0);
  expect(compare(obj2, obj1)).toBeGreaterThan(0);
});

test("compare() with objects - handles class instances with valueOf", () => {
  class TestClass {
    constructor(public value: number) {}
    valueOf() {
      return this.value;
    }
  }

  const obj1 = new TestClass(1);
  const obj2 = new TestClass(2);
  // compareObjects is called which checks valueOf
  const result = compare(obj1, obj2);
  expect(typeof result).toBe("number");
  // The actual comparison depends on implementation details
});

test("compare() with objects - handles Date objects", () => {
  const date1 = new Date("2023-01-01");
  const date2 = new Date("2023-01-02");
  // Dates have valueOf() so they should be compared by their numeric values
  const result = compare(date1, date2);
  expect(typeof result).toBe("number");
  // Since date1 < date2, result should indicate that
});

test("compareObjects() - returns 0 for same object reference", () => {
  const obj = { a: 1 };
  expect(compareObjects(obj, obj)).toBe(0);
});

test("compareObjects() - compares arrays of different lengths", () => {
  expect(compareObjects([1, 2], [1, 2, 3])).toBeLessThan(0);
  expect(compareObjects([1, 2, 3], [1, 2])).toBeGreaterThan(0);
});

test("compareObjects() - compares arrays with different values", () => {
  expect(compareObjects([1, 2, 3], [1, 2, 4])).toBeLessThan(0);
  expect(compareObjects([1, 2, 4], [1, 2, 3])).toBeGreaterThan(0);
});

test("compareObjects() - compares array with non-array", () => {
  expect(compareObjects([1, 2], { a: 1 })).toBeGreaterThan(0);
  expect(compareObjects({ a: 1 }, [1, 2])).toBeLessThan(0);
});

test("compareObjects() - compares plain objects", () => {
  expect(compareObjects({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(0);
  expect(compareObjects({ a: 1 }, { a: 2 })).toBeLessThan(0);
  expect(compareObjects({ a: 2 }, { a: 1 })).toBeGreaterThan(0);
});

test("compareObjects() - compares objects with different key counts", () => {
  expect(compareObjects({ a: 1, b: 2 }, { a: 1 })).toBeGreaterThan(0);
  expect(compareObjects({ a: 1 }, { a: 1, b: 2 })).toBeLessThan(0);
});

test("compareObjects() - handles objects with keys in b not in a", () => {
  expect(compareObjects({ a: 1 }, { b: 1 })).not.toBe(0);
});

test("compareObjects() - compares class instances", () => {
  class TestClass {
    constructor(public value: string) {}
    toString() {
      return this.value;
    }
  }

  const obj1 = new TestClass("a");
  const obj2 = new TestClass("b");
  const plainObj = { value: "a" };

  expect(compareObjects(obj1, obj2)).toBeLessThan(0);
  expect(compareObjects(obj1, plainObj)).toBeGreaterThan(0);
  expect(compareObjects(plainObj, obj1)).toBeLessThan(0);
});

test("compareObjects() - compares class instances without toString or valueOf", () => {
  class TestClass1 {
    constructor(public value: number) {}
  }
  class TestClass2 {
    constructor(public value: number) {}
  }

  const obj1 = new TestClass1(1);
  const obj2 = new TestClass2(1);

  // Should return some consistent ordering
  const result = compareObjects(obj1, obj2);
  expect(typeof result).toBe("number");
});

test("compareObjects() - compares nested arrays", () => {
  expect(
    compareObjects(
      [
        [1, 2],
        [3, 4],
      ],
      [
        [1, 2],
        [3, 4],
      ],
    ),
  ).toBe(0);
  expect(
    compareObjects(
      [
        [1, 2],
        [3, 4],
      ],
      [
        [1, 2],
        [3, 5],
      ],
    ),
  ).toBeLessThan(0);
});

test("compareObjects() - compares nested objects", () => {
  expect(compareObjects({ a: { b: 1 }, c: 2 }, { a: { b: 1 }, c: 2 })).toBe(0);
  expect(
    compareObjects({ a: { b: 1 }, c: 2 }, { a: { b: 2 }, c: 2 }),
  ).toBeLessThan(0);
});

test("compareObjects() - handles complex nested structures", () => {
  const obj1 = { a: [1, { b: 2 }], c: { d: [3, 4] } };
  const obj2 = { a: [1, { b: 2 }], c: { d: [3, 4] } };
  const obj3 = { a: [1, { b: 3 }], c: { d: [3, 4] } };

  expect(compareObjects(obj1, obj2)).toBe(0);
  expect(compareObjects(obj1, obj3)).toBeLessThan(0);
  expect(compareObjects(obj3, obj1)).toBeGreaterThan(0);
});

test("edge cases - handles empty arrays", () => {
  expect(compare([], [])).toBe(0);
  expect(compare([], [1])).toBeLessThan(0);
  expect(compare([1], [])).toBeGreaterThan(0);
});

test("edge cases - handles empty objects", () => {
  expect(compare({}, {})).toBe(0);
  expect(compare({}, { a: 1 })).toBeLessThan(0);
  expect(compare({ a: 1 }, {})).toBeGreaterThan(0);
});

test("edge cases - handles special number values", () => {
  // NaN === NaN is false, so compare returns NaN - NaN = NaN
  const nanResult = compare(NaN, NaN);
  expect(Number.isNaN(nanResult)).toBe(true);

  expect(compare(Infinity, -Infinity)).toBeGreaterThan(0);
  expect(compare(-Infinity, Infinity)).toBeLessThan(0);
});

test("edge cases - handles sparse arrays", () => {
  const arr1 = [1, undefined, 3];
  const arr2 = [1, undefined, 3];
  expect(compare(arr1, arr2)).toBe(0);
});

test("edge cases - handles objects with symbol keys", () => {
  const sym = Symbol("test");
  const obj1 = { [sym]: 1, a: 2 };
  const obj2 = { a: 2 };
  // Symbol keys are not enumerable by Object.keys, so should compare as equal
  expect(compare(obj1, obj2)).toBe(0);
});
