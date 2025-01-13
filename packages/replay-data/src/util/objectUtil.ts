
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
