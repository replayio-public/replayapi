import { Value as ProtocolValue } from "@replayio/protocol";
import { clientValueCache, objectCache } from "replay-next/src/suspense/ObjectPreviews";
import { ReplayClientInterface } from "shared/client/types";

/**
 * Sort an object's values by keys recursively and return them as a flat list of strings.
 * The result is a reliable, human-readable hash.
 */
export function deterministicObjectValues(obj: Record<string, any>): string[] {
  // Get top-level values first
  const topValues = Object.keys(obj)
    .sort()
    .filter(key => typeof obj[key] !== "object" || obj[key] === null)
    .map(key => String(obj[key]));

  // Then get nested values
  const nestedValues = Object.keys(obj)
    .sort()
    .filter(key => typeof obj[key] === "object" && obj[key] !== null)
    .flatMap(key => deterministicObjectValues(obj[key]));

  return [...topValues, ...nestedValues];
}

export function deterministicObjectHash(obj: Record<string, any>): string {
  return deterministicObjectValues(obj).join("-");
}

// like JSON, but including `undefined`
export type JSONishValue =
  | boolean
  | string
  | number
  | null
  | undefined
  | JSONishValue[]
  | { [key: string]: JSONishValue };

/**
 * Takes a backend `objectId`, loads its data preview, and
 * fetches/caches data for all of its fields that are objects/arrays.
 * Note that this does not return the object with its contents - it
 * just makes sure all the fields exist in the cache.
 */
export async function loadObjectProperties(
  replayClient: ReplayClientInterface,
  pauseId: string,
  objectId: string
): Promise<void> {
  const obj = await objectCache.readAsync(replayClient, pauseId, objectId, "full");

  const properties = obj.preview?.properties ?? [];
  const objectProperties = properties.filter(entry => "object" in entry) ?? [];

  const propertyPromises = objectProperties.map(prop =>
    objectCache.readAsync(replayClient, pauseId, prop.object!, "canOverflow")
  );

  await Promise.all(propertyPromises);
}

/**
 * COPIED from devtools.
 * @see https://github.com/replayio/devtools/blob/main/src/ui/utils/objectFetching.ts
 */
export async function objectPreviewToJSON(
  replayClient: ReplayClientInterface,
  pauseId: string,
  value: ProtocolValue,
  visitedObjectIds = new Set<string>()
): Promise<JSONishValue> {
  const clientObject = await clientValueCache.readAsync(replayClient, pauseId, value);

  if (clientObject.objectId) {
    if (visitedObjectIds.has(clientObject.objectId!)) {
      return undefined;
    }

    visitedObjectIds = new Set(visitedObjectIds);
    visitedObjectIds.add(clientObject.objectId!);

    await loadObjectProperties(replayClient, pauseId, clientObject.objectId!);
    const obj = await objectCache.readAsync(
      replayClient,
      pauseId,
      clientObject.objectId!,
      "canOverflow"
    );

    const properties = obj.preview?.properties ?? [];

    const actualPropValues = await Promise.all(
      properties.map(async val => {
        const value = await objectPreviewToJSON(replayClient, pauseId, val, visitedObjectIds);
        const key = val.name;
        return [key, value] as [string, JSONishValue];
      })
    );

    if (clientObject.type === "array") {
      let result: JSONishValue[] = [];
      for (const [key, value] of actualPropValues) {
        const index = parseInt(key);
        if (Number.isInteger(index)) {
          result[index] = value;
        }
      }
      return result;
    }

    return Object.fromEntries(actualPropValues);
  }
  switch (clientObject.type) {
    case "boolean": {
      return clientObject.preview === "true";
    }
    case "string":
    case "symbol": {
      return clientObject.preview!;
    }
    case "number":
    case "nan": {
      return Number(clientObject.preview!);
    }
    case "null": {
      return null;
    }
    case "undefined": {
      return undefined;
    }
  }

  throw new Error("Unexpected client value! " + JSON.stringify(clientObject));
}
