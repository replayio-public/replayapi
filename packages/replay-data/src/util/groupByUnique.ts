import groupBy from "lodash/groupBy";
import identity from "lodash/identity";

export function groupByUnique<K, VIn, VOut = VIn>(
  arr: VIn[],
  groupCb: (value: VIn) => K,
  transformCb: (value: VIn) => VOut = identity
): Record<string, VOut> {
  const grouped = groupBy(arr, groupCb);
  return Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, transformCb(v[0])]));
}
