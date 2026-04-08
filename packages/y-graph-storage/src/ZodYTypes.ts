import * as z from "zod";
import * as Y from "yjs";

/**
 * Schema that accepts Y.Text or string, always outputs Y.Text
 */
export const ZodYText = z
  .union([z.custom<Y.Text>((v) => v instanceof Y.Text), z.string()])
  .transform((val): Y.Text => {
    if (val instanceof Y.Text) return val;
    const text = new Y.Text(val);
    return text;
  });

/**
 * Schema that accepts Y.Array or native array, always outputs Y.Array
 */
export function ZodYArray<TItemType extends z.ZodType>(schema: TItemType) {
  type ItemOutput = z.output<TItemType>;
  return z
    .union([
      z.custom<Y.Array<ItemOutput>>((v) => v instanceof Y.Array),
      z.array(schema),
    ])
    .transform((val): Y.Array<ItemOutput> => {
      if (val instanceof Y.Array) return val;
      const arr = Y.Array.from(val as any[]);
      return arr;
    });
}

/**
 * Schema that accepts Y.Map or plain object, always outputs Y.Map
 */
export function ZodYMap<TValueType extends z.ZodType>(schema: TValueType) {
  type ValueOutput = z.output<TValueType>;
  return z
    .union([
      z.custom<Y.Map<ValueOutput>>((v) => v instanceof Y.Map),
      z.record(z.string(), schema),
    ])
    .transform((val): Y.Map<ValueOutput> => {
      if (val instanceof Y.Map) return val;
      const map = new Y.Map<ValueOutput>();
      for (const [key, value] of Object.entries(val)) {
        map.set(key, value as ValueOutput);
      }
      return map;
    });
}

/**
 * Schema that accepts Y.XmlFragment or string (parsed as XML), always outputs Y.XmlFragment
 */
export const ZodYXmlFragment = z
  .union([
    z.custom<Y.XmlFragment>((v) => v instanceof Y.XmlFragment),
    z.string(),
  ])
  .transform((val): Y.XmlFragment => {
    if (val instanceof Y.XmlFragment) return val;
    const fragment = new Y.XmlFragment();
    const text = new Y.XmlText(val);
    fragment.insert(0, [text]);
    return fragment;
  });

/**
 * Schema that accepts Y.XmlText or string, always outputs Y.XmlText
 */
export const ZodYXmlText = z
  .union([z.custom<Y.XmlText>((v) => v instanceof Y.XmlText), z.string()])
  .transform((val): Y.XmlText => {
    if (val instanceof Y.XmlText) return val;
    return new Y.XmlText(val);
  });

/**
 * Schema that accepts Y.XmlElement or object with tag/attrs/children, always outputs Y.XmlElement
 */
export const ZodYXmlElement = z
  .union([
    z.custom<Y.XmlElement>((v) => v instanceof Y.XmlElement),
    z.object({
      tag: z.string(),
      attrs: z.record(z.string(), z.string()).optional(),
      children: z.array(z.string()).optional(),
    }),
  ])
  .transform((val): Y.XmlElement => {
    if (val instanceof Y.XmlElement) return val;
    const element = new Y.XmlElement(val.tag);
    if (val.attrs) {
      for (const [key, value] of Object.entries(val.attrs)) {
        element.setAttribute(key, value);
      }
    }
    if (val.children) {
      const xmlChildren = val.children.map((text) => new Y.XmlText(text));
      element.insert(0, xmlChildren);
    }
    return element;
  });
