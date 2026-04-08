import { ElementSchema, PropertiesFromSchema } from "@codemix/graph";
import type * as Y from "yjs";

const $YMap = Symbol("YMap");
/**
 * Create a lazy property dictionary for an element.
 * @param schema The schema of the element.
 * @param map The Y.Map the properties are stored in.
 * @returns A dictionary of properties that are lazy loaded from the Y.Map.
 */
export function createLazyPropertyDictionary<TSchema extends ElementSchema>(
  schema: TSchema,
  map: Y.Map<unknown>,
): PropertiesFromSchema<TSchema> {
  const descriptors = createLazyPropertyDescriptors(schema);

  const base = { [$YMap]: map };

  return Object.defineProperties(base, descriptors) as unknown as PropertiesFromSchema<TSchema>;
}

type DescriptorShape = {
  [$YMap]: Y.Map<unknown>;
};

const descriptorCache = new WeakMap<object, PropertyDescriptorMap>();

function createLazyPropertyDescriptors(schema: ElementSchema): PropertyDescriptorMap {
  if (descriptorCache.has(schema)) {
    return descriptorCache.get(schema)!;
  }
  const descriptors: PropertyDescriptorMap = {};
  for (const key of Object.keys(schema.properties)) {
    descriptors[key] = {
      get(this: DescriptorShape) {
        return this[$YMap].get(key);
      },
      set(this: DescriptorShape, value: any) {
        this[$YMap].set(key, value);
      },
      configurable: true,
      enumerable: true,
    };
  }
  descriptorCache.set(schema, descriptors);
  return descriptors;
}
