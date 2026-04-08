import { describe, expect, test } from "vitest";
import * as Y from "yjs";
import * as z from "zod";
import {
  ZodYText,
  ZodYArray,
  ZodYMap,
  ZodYXmlFragment,
  ZodYXmlText,
  ZodYXmlElement,
} from "./ZodYTypes.js";

const doc = new Y.Doc();
const DEMO = doc.getMap("DEMO");

describe("ZodYText", () => {
  test("accepts Y.Text and returns it unchanged", () => {
    const ytext = new Y.Text("hello");
    const result = ZodYText.parse(ytext);
    expect(result).toBe(ytext);
    expect(result).toBeInstanceOf(Y.Text);
    DEMO.set("text", result);
    expect(result.toString()).toBe("hello");
  });

  test("accepts string and transforms to Y.Text", () => {
    const result = ZodYText.parse("hello world");
    expect(result).toBeInstanceOf(Y.Text);
    DEMO.set("text", result);
    expect(result.toString()).toBe("hello world");
  });

  test("accepts empty string", () => {
    const result = ZodYText.parse("");
    expect(result).toBeInstanceOf(Y.Text);
    DEMO.set("text", result);
    expect(result.toString()).toBe("");
  });

  test("preserves unicode content", () => {
    const result = ZodYText.parse("こんにちは 🌍");
    expect(result).toBeInstanceOf(Y.Text);
    DEMO.set("text", result);
    expect(result.toString()).toBe("こんにちは 🌍");
  });

  test("rejects non-string, non-Y.Text values", () => {
    expect(() => ZodYText.parse(123)).toThrow();
    expect(() => ZodYText.parse(null)).toThrow();
    expect(() => ZodYText.parse(undefined)).toThrow();
    expect(() => ZodYText.parse({})).toThrow();
    expect(() => ZodYText.parse([])).toThrow();
  });
});

describe("ZodYArray", () => {
  const ZodYStringArray = ZodYArray(z.string());

  test("accepts Y.Array and returns it unchanged", () => {
    const yarr = Y.Array.from(["a", "b", "c"]);
    const result = ZodYStringArray.parse(yarr);
    expect(result).toBe(yarr);
    expect(result).toBeInstanceOf(Y.Array);
    DEMO.set("array", result);
    expect(result.toArray()).toEqual(["a", "b", "c"]);
  });

  test("accepts native array and transforms to Y.Array", () => {
    const result = ZodYStringArray.parse(["x", "y", "z"]);
    expect(result).toBeInstanceOf(Y.Array);
    DEMO.set("array", result);
    expect(result.toArray()).toEqual(["x", "y", "z"]);
  });

  test("accepts empty array", () => {
    const result = ZodYStringArray.parse([]);
    expect(result).toBeInstanceOf(Y.Array);
    DEMO.set("array", result);
    expect(result.toArray()).toEqual([]);
  });

  test("works with number schema", () => {
    const ZodYNumberArray = ZodYArray(z.number());
    const result = ZodYNumberArray.parse([1, 2, 3]);
    expect(result).toBeInstanceOf(Y.Array);
    DEMO.set("array", result);
    expect(result.toArray()).toEqual([1, 2, 3]);
  });

  test("works with nested Y.Text items", () => {
    const ZodYTextArray = ZodYArray(ZodYText);
    const result = ZodYTextArray.parse(["hello", "world"]);
    expect(result).toBeInstanceOf(Y.Array);
    DEMO.set("array", result);
    expect(result.length).toBe(2);
    expect(result.get(0)).toBeInstanceOf(Y.Text);
    expect(result.get(0).toString()).toBe("hello");
    expect(result.get(1).toString()).toBe("world");
  });

  test("accepts Y.Array with Y.Text items", () => {
    const ZodYTextArray = ZodYArray(ZodYText);
    const yarr = new Y.Array<Y.Text>();
    yarr.push([new Y.Text("foo"), new Y.Text("bar")]);
    const result = ZodYTextArray.parse(yarr);
    expect(result).toBe(yarr);
  });

  test("validates array item types", () => {
    expect(() => ZodYStringArray.parse([1, 2, 3])).toThrow();
    expect(() => ZodYStringArray.parse(["a", 1, "b"])).toThrow();
  });

  test("rejects non-array values", () => {
    expect(() => ZodYStringArray.parse("not an array")).toThrow();
    expect(() => ZodYStringArray.parse(123)).toThrow();
    expect(() => ZodYStringArray.parse({})).toThrow();
  });
});

describe("ZodYMap", () => {
  const ZodYStringMap = ZodYMap(z.string());

  test("accepts Y.Map and returns it unchanged", () => {
    const ymap = new Y.Map<string>();
    ymap.set("key1", "value1");
    ymap.set("key2", "value2");
    const result = ZodYStringMap.parse(ymap);
    expect(result).toBe(ymap);
    expect(result).toBeInstanceOf(Y.Map);
    DEMO.set("map", result);
    expect(result.get("key1")).toBe("value1");
  });

  test("accepts plain object and transforms to Y.Map", () => {
    const result = ZodYStringMap.parse({ foo: "bar", baz: "qux" });
    expect(result).toBeInstanceOf(Y.Map);
    DEMO.set("map", result);
    expect(result.get("foo")).toBe("bar");
    expect(result.get("baz")).toBe("qux");
  });

  test("accepts empty object", () => {
    const result = ZodYStringMap.parse({});
    expect(result).toBeInstanceOf(Y.Map);
    DEMO.set("map", result);
    expect(result.size).toBe(0);
  });

  test("works with number values", () => {
    const ZodYNumberMap = ZodYMap(z.number());
    const result = ZodYNumberMap.parse({ a: 1, b: 2, c: 3 });
    expect(result).toBeInstanceOf(Y.Map);
    DEMO.set("map", result);
    expect(result.get("a")).toBe(1);
    expect(result.get("b")).toBe(2);
  });

  test("works with nested Y.Text values", () => {
    const ZodYTextMap = ZodYMap(ZodYText);
    const result = ZodYTextMap.parse({ greeting: "hello", name: "world" });
    expect(result).toBeInstanceOf(Y.Map);
    DEMO.set("map", result);
    expect(result.get("greeting")).toBeInstanceOf(Y.Text);
    expect(result.get("greeting")!.toString()).toBe("hello");
    expect(result.get("name")!.toString()).toBe("world");
  });

  test("accepts Y.Map with Y.Text values", () => {
    const ZodYTextMap = ZodYMap(ZodYText);
    const ymap = new Y.Map<Y.Text>();
    ymap.set("key", new Y.Text("value"));
    const result = ZodYTextMap.parse(ymap);
    expect(result).toBe(ymap);
  });

  test("validates value types", () => {
    expect(() => ZodYStringMap.parse({ a: 1 })).toThrow();
    expect(() => ZodYStringMap.parse({ a: "ok", b: 123 })).toThrow();
  });

  test("rejects non-object values", () => {
    expect(() => ZodYStringMap.parse("not an object")).toThrow();
    expect(() => ZodYStringMap.parse(123)).toThrow();
    expect(() => ZodYStringMap.parse([])).toThrow();
  });
});

describe("ZodYXmlText", () => {
  test("accepts Y.XmlText and returns it unchanged", () => {
    const xmltext = new Y.XmlText("hello");
    const result = ZodYXmlText.parse(xmltext);
    expect(result).toBe(xmltext);
    expect(result).toBeInstanceOf(Y.XmlText);
    DEMO.set("xmltext", result);
    expect(result.toString()).toBe("hello");
  });

  test("accepts string and transforms to Y.XmlText", () => {
    const result = ZodYXmlText.parse("hello xml");
    expect(result).toBeInstanceOf(Y.XmlText);
    DEMO.set("xmltext", result);
    expect(result.toString()).toBe("hello xml");
  });

  test("accepts empty string", () => {
    const result = ZodYXmlText.parse("");
    expect(result).toBeInstanceOf(Y.XmlText);
    DEMO.set("xmltext", result);
    expect(result.toString()).toBe("");
  });

  test("rejects non-string, non-Y.XmlText values", () => {
    expect(() => ZodYXmlText.parse(123)).toThrow();
    expect(() => ZodYXmlText.parse(null)).toThrow();
    expect(() => ZodYXmlText.parse({})).toThrow();
  });
});

describe("ZodYXmlFragment", () => {
  test("accepts Y.XmlFragment and returns it unchanged", () => {
    const fragment = new Y.XmlFragment();
    fragment.insert(0, [new Y.XmlText("content")]);
    const result = ZodYXmlFragment.parse(fragment);
    expect(result).toBe(fragment);
    expect(result).toBeInstanceOf(Y.XmlFragment);
  });

  test("accepts string and transforms to Y.XmlFragment with XmlText child", () => {
    const result = ZodYXmlFragment.parse("hello fragment");
    expect(result).toBeInstanceOf(Y.XmlFragment);
    DEMO.set("xmlfragment", result);
    expect(result.length).toBe(1);
    expect(result.get(0)).toBeInstanceOf(Y.XmlText);
    expect(result.get(0).toString()).toBe("hello fragment");
  });

  test("accepts empty string", () => {
    const result = ZodYXmlFragment.parse("");
    expect(result).toBeInstanceOf(Y.XmlFragment);
    DEMO.set("xmlfragment", result);
    expect(result.length).toBe(1);
    expect(result.get(0).toString()).toBe("");
  });

  test("rejects non-string, non-Y.XmlFragment values", () => {
    expect(() => ZodYXmlFragment.parse(123)).toThrow();
    expect(() => ZodYXmlFragment.parse(null)).toThrow();
    expect(() => ZodYXmlFragment.parse([])).toThrow();
  });
});

describe("ZodYXmlElement", () => {
  test("accepts Y.XmlElement and returns it unchanged", () => {
    const element = new Y.XmlElement("div");
    element.setAttribute("class", "container");
    const result = ZodYXmlElement.parse(element);
    expect(result).toBe(element);
    expect(result).toBeInstanceOf(Y.XmlElement);
    DEMO.set("xmlelement", result);
    expect(result.nodeName).toBe("div");
  });

  test("accepts object with tag and transforms to Y.XmlElement", () => {
    const result = ZodYXmlElement.parse({ tag: "span" });
    expect(result).toBeInstanceOf(Y.XmlElement);
    expect(result.nodeName).toBe("span");
  });

  test("accepts object with tag and attrs", () => {
    const result = ZodYXmlElement.parse({
      tag: "div",
      attrs: { class: "wrapper", id: "main" },
    });
    expect(result).toBeInstanceOf(Y.XmlElement);
    DEMO.set("xmlelement", result);

    expect(result.nodeName).toBe("div");
    expect(result.getAttribute("class")).toBe("wrapper");
    expect(result.getAttribute("id")).toBe("main");
  });

  test("accepts object with tag, attrs, and children", () => {
    const result = ZodYXmlElement.parse({
      tag: "p",
      attrs: { class: "text" },
      children: ["Hello, ", "World!"],
    });
    expect(result).toBeInstanceOf(Y.XmlElement);
    DEMO.set("xmlelement", result);

    expect(result.nodeName).toBe("p");
    expect(result.getAttribute("class")).toBe("text");
    expect(result.length).toBe(2);
    expect(result.get(0)).toBeInstanceOf(Y.XmlText);
    expect(result.get(0).toString()).toBe("Hello, ");
    expect(result.get(1).toString()).toBe("World!");
  });

  test("accepts object with empty attrs and children", () => {
    const result = ZodYXmlElement.parse({
      tag: "br",
      attrs: {},
      children: [],
    });
    expect(result).toBeInstanceOf(Y.XmlElement);
    expect(result.nodeName).toBe("br");
    expect(result.length).toBe(0);
  });

  test("rejects object without tag", () => {
    expect(() => ZodYXmlElement.parse({})).toThrow();
    expect(() => ZodYXmlElement.parse({ attrs: {} })).toThrow();
  });

  test("rejects non-object values", () => {
    expect(() => ZodYXmlElement.parse("div")).toThrow();
    expect(() => ZodYXmlElement.parse(123)).toThrow();
    expect(() => ZodYXmlElement.parse(null)).toThrow();
  });
});

describe("type inference", () => {
  test("ZodYText output type is Y.Text", () => {
    const result = ZodYText.parse("test");
    // TypeScript should infer result as Y.Text
    const _check: Y.Text = result;
    expect(_check).toBeInstanceOf(Y.Text);
  });

  test("ZodYArray output type is Y.Array", () => {
    const schema = ZodYArray(z.number());
    const result = schema.parse([1, 2, 3]);
    // TypeScript should infer result as Y.Array<number>
    const _check: Y.Array<number> = result;
    expect(_check).toBeInstanceOf(Y.Array);
  });

  test("ZodYMap output type is Y.Map", () => {
    const schema = ZodYMap(z.boolean());
    const result = schema.parse({ flag: true });
    // TypeScript should infer result as Y.Map<boolean>
    const _check: Y.Map<boolean> = result;
    expect(_check).toBeInstanceOf(Y.Map);
  });

  test("ZodYXmlText output type is Y.XmlText", () => {
    const result = ZodYXmlText.parse("test");
    const _check: Y.XmlText = result;
    expect(_check).toBeInstanceOf(Y.XmlText);
  });

  test("ZodYXmlFragment output type is Y.XmlFragment", () => {
    const result = ZodYXmlFragment.parse("test");
    const _check: Y.XmlFragment = result;
    expect(_check).toBeInstanceOf(Y.XmlFragment);
  });

  test("ZodYXmlElement output type is Y.XmlElement", () => {
    const result = ZodYXmlElement.parse({ tag: "div" });
    const _check: Y.XmlElement = result;
    expect(_check).toBeInstanceOf(Y.XmlElement);
  });
});

describe("safeParse", () => {
  test("ZodYText safeParse returns success for valid input", () => {
    const result = ZodYText.safeParse("hello");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeInstanceOf(Y.Text);
    }
  });

  test("ZodYText safeParse returns error for invalid input", () => {
    const result = ZodYText.safeParse(123);
    expect(result.success).toBe(false);
  });

  test("ZodYArray safeParse validates nested items", () => {
    const schema = ZodYArray(z.string());
    const validResult = schema.safeParse(["a", "b"]);
    expect(validResult.success).toBe(true);

    const invalidResult = schema.safeParse([1, 2]);
    expect(invalidResult.success).toBe(false);
  });

  test("ZodYMap safeParse validates nested values", () => {
    const schema = ZodYMap(z.number());
    const validResult = schema.safeParse({ a: 1 });
    expect(validResult.success).toBe(true);

    const invalidResult = schema.safeParse({ a: "not a number" });
    expect(invalidResult.success).toBe(false);
  });
});
