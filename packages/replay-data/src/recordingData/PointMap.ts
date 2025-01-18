function makeBigInt(value: string): BigInt | null {
  try {
    if (!value.endsWith("n")) {
      value += "n";
    }
    return BigInt(value);
  } catch {
    return null;
  }
}

const PointPrefix = "Point";

function isMappedPoint(point: string): boolean {
  return new RegExp(`^${PointPrefix}\\d+$`).test(point);
}

/**
 * Remap BigInt points to `PointX` strings for better compression and LLM comprehension.
 */
export default class PointMap {
  private nextId = 1;
  private originalToMapped = new Map<BigInt, string>();
  private mappedSet = new Set<string>();

  private newPoint(point: BigInt): string {
    const mapped = `${PointPrefix}${this.nextId}`;
    this.nextId++;
    this.originalToMapped.set(point, mapped);
    this.mappedSet.add(mapped);
    return mapped;
  }

  lookup(point: string): string {
    if (isMappedPoint(point)) {
      if (!this.mappedSet.has(point)) {
        throw new Error(`Unknown mapped point: ${point}`);
      }
      return point;
    }
    const p = makeBigInt(point);
    if (!p) {
      throw new Error(`Invalid point - must start with "Point" or must be BigInt: ${point}`);
    }
    return this.newPoint(p);
  }

  // async serialize() {
  //   // TODO
  // }
  // async deserialize() {
  //   // TODO
  // }
}
