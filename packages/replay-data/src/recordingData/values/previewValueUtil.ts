import { ArrayPreview, DefaultPreview, ObjectPreview, ValuePreview } from "./values";

type AnyValue = any;

interface TypeDescription {
  name: string;
  methods: ValuePreview;
}

function isObject(x: AnyValue): x is object {
  return typeof x === "object" && x !== null;
}

function isFunction(x: AnyValue): x is Function {
  return typeof x === "function";
}

const sharedUtilities = [isObject, isFunction];

function getTypeName(x: AnyValue): string {
  if (x === null) {
    /* `typeof null` is 'object', but we want 'null' */
    return "null";
  }
  if (isFunction(x)) {
    return "function";
  }
  if (typeof x === "object" && x?.constructor && x.constructor !== Object) {
    return x.constructor.name;
  }

  /* Primitives. */
  return typeof x;
}

function makePreviews(inputs: string[]): Record<string, ValuePreview> {
  const MaxOutLength = 20000;
  const MaxStringLength = 60;
  const MaxTruncatedChildren = 50;

  function describeElaborateObjectType(x: AnyValue): TypeDescription | null {
    if (typeof x === "object" && x?.constructor && x.constructor !== Object) {
      if (
        (!Object.prototype.hasOwnProperty.call(globalThis, x.constructor.name) ||
          globalThis[x.constructor.name as keyof typeof globalThis] !== x.constructor) &&
        x.constructor.prototype
      ) {
        /* Describe methods of complex non-builtin type */
        return {
          name: x.constructor.name,
          methods: previewValue(Object.getOwnPropertyNames(x.constructor.prototype)),
        };
      }
    }
    return null;
  }

  /** ###########################################################################
   * Utilities
   * ##########################################################################*/

  function nonObjectStringify(x: AnyValue): string {
    if (isFunction(x)) {
      return previewFunction(x);
    }
    if (typeof x === "string") {
      if (x.length > MaxStringLength) {
        return `"${x.slice(0, MaxStringLength)}..."`;
      }
      return JSON.stringify(x);
    }
    return String(x);
  }

  function size(collection: AnyValue): number {
    if (!collection) {
      return 0;
    }

    /* Handle Map and Set */
    if ("size" in collection) {
      return collection.size;
    }

    /* Handle array-like values (arrays, strings) */
    if ("length" in collection) {
      return collection.length;
    }

    /* Handle other iterables */
    if (typeof collection[Symbol.iterator] === "function") {
      let count = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ of collection) {
        count++;
      }
      return count;
    }

    /* Handle plain objects */
    if (typeof collection === "object") {
      return Object.keys(collection).length;
    }

    return 0;
  }

  /** ###########################################################################
   * Previews
   * ##########################################################################*/

  function previewFunction(x: Function): DefaultPreview {
    /* TODO: better function previews */
    return `Function "${x.name || ""}"`;
  }

  function previewBuiltin(x: AnyValue): string | null {
    if (Array.isArray(x)) {
      return `Array(${x.length})`;
    }
    if (isFunction(x)) {
      return previewFunction(x);
    }
    return null;
  }

  function shortSummary(x: AnyValue): string {
    const preview = previewBuiltin(x);
    if (preview) {
      return preview;
    }
    if (isObject(x)) {
      const nKeys = size(x);
      const type = getTypeName(x);
      return `Object w/ ${nKeys} keys${type !== "object" ? ` of type ${type}` : ""}`;
    }
    return nonObjectStringify(x);
  }

  function buildObjectPreview(
    keys: string[] | null,
    processedValues: string[]
  ): ObjectPreview | ArrayPreview {
    return keys ? Object.fromEntries(processedValues.map((v, i) => [keys[i], v])) : processedValues;
  }

  function stringifyObjectPreview(keys: string[] | null, processedValues: string[]): string {
    return keys
      ? `{${processedValues.map((v, i) => `${keys[i]}: ${v}`).join(", ")}}`
      : `[${processedValues.join(", ")}]`;
  }

  function _previewValue(
    x: AnyValue,
    truncateChildrenLevel = Infinity,
    seen = new Map<object, boolean>(),
    depth = 0
  ): ValuePreview {
    if (!isObject(x)) {
      /* Non-objects */
      return nonObjectStringify(x);
    }
    if (isFunction(x)) {
      return previewFunction(x);
    }

    /* Check for cycles */
    if (seen.has(x)) {
      return "(Cyclical)";
    }
    seen.set(x, true);

    /* Start building the output */
    const entries = Object.entries(x);

    const keys: string[] | null = Array.isArray(x) ? null : [];
    const processedValues: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];

      /* Key. */
      const keyStr = Array.isArray(x) ? "" : nonObjectStringify(key);
      keys?.push(keyStr);

      /* Value. */
      let valueStr: string;
      if (depth >= truncateChildrenLevel) {
        valueStr = shortSummary(value);
      } else if (isObject(value)) {
        const preview = _previewValue(value, truncateChildrenLevel, seen, depth + 1);
        valueStr = typeof preview === "string" ? preview : JSON.stringify(preview);
      } else {
        valueStr = nonObjectStringify(value);
      }

      /* Entry. */
      processedValues.push(valueStr);

      /* Check if we need to truncate. */
      if (
        i >= MaxTruncatedChildren - 1 ||
        stringifyObjectPreview(keys, processedValues).length >= MaxOutLength
      ) {
        /* Truncate. */
        const remaining = entries.length - i - 1;
        if (remaining > 0) {
          processedValues.push(`// ${remaining} more entries`);
        }
        break;
      }
    }
    return buildObjectPreview(keys, processedValues);
  }

  function previewValue(x: AnyValue): ValuePreview {
    const nMaxFullDepth = 5;
    const nMinDepth = 2;
    const depths = new Array(nMaxFullDepth + 2)
      .fill(1)
      .map((_, i) => i)
      .reverse();
    depths[0] = Infinity;
    for (let i = 0; i <= depths.length; i++) {
      const preview = _previewValue(x, depths[i]);
      console.log(`Preview at depth ${depths[i]}:`, preview);
      if (
        JSON.stringify(preview).length <= MaxOutLength ||
        /* Stop iterating at min depth. */
        depths[i] === nMinDepth
      ) {
        return preview;
      }
    }
    return shortSummary(x);
  }

  function previewValues(inputs: string[]): Record<string, ValuePreview> {
    return Object.fromEntries(
      inputs.map(input => {
        try {
          const val = eval(input);
          return [input, previewValue(val)];
        } catch (err: any) {
          return [input, `(COULD NOT EVALUATE: ${err.message})`];
        }
      })
    );
  }

  return previewValues(inputs);
}

export type CodeString = string;

function compileCall(func: Function, input: string): CodeString {
  // Convert utility functions to string declarations
  const utilityDeclarations = sharedUtilities.map(util => util.toString()).join("\n\n");

  // Create a wrapper that includes utility functions in scope
  return `
(function() {
  ${utilityDeclarations}
  
  return (${func.toString()})(${input});
})()`;
}

export function compileMakePreviewsCall(expressions: string[]): CodeString {
  return compileCall(makePreviews, `[${expressions.join(", ")}]`);
}

/**
 * Returns code that calls `getTypeName` on the given `expression`.
 */
export function compileGetTypeName(expression: string): CodeString {
  return compileCall(getTypeName, expression);
}
