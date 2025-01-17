import groupBy from "lodash/groupBy";
import identity from "lodash/identity";

/**
 * If `transformCb` is not provided, this is like lodash/groupBy,
 * but assumes that each group only has a unique element.
 */
export function groupByUnique<K, VIn, VOut = VIn>(
  arr: VIn[],
  groupCb: (value: VIn) => K,
  transformCb: (value: VIn) => VOut = identity
): Record<string, VOut> {
  const grouped = groupBy(arr, groupCb);
  return Object.fromEntries(
    Object.entries(grouped).map(([k, v]) => [
      k,
      transformCb(
        // Assume we only want one per group.
        v[0]
      ),
    ])
  );
}
