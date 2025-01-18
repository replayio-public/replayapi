export default {
  dependencyChain: [
    {
      // const totalBytesDeviation = calculateDeviation(...)
      // We don't need `expression` or `value` because we have the RHS from the `Return` point.
      kind: "Assign",
      point: "25312447185420583538453191302578179",
    },
    {
      kind: "FunctionCall",
      point: "25312447185420583538453191302578179",
      calledFunction: "calculateDeviation",
      arguments: ["stats.total.bytes", "medianValues.networkStats.totalBytes"],
      params: "value: number, median: number",
      code: `export function calculateDeviation(value: number, median: number): number {
  /*POINT:children[2]*/if (typeof value !== 'number' || typeof median !== 'number') { /*<OmittedCode reason="BranchNotTaken" />*/ }
  /*POINT:children[1]*/if (median === 0) return /*POINT:children[0]*/0; // No deviation if there's no median
  // <OmittedCode reason="BranchNotTaken" />
}`,
      children: [
        {
          kind: "Return",
          point: "25312447185420584691374661549686789",
        },
        {
          // /*POINT*/if (median === 0)
          kind: "BranchTaken",
          point: "25312447185420584691374661549686788",
          // inputs: ["median"],
        },
        {
          // /*POINT*/if (typeof value !== 'number' || typeof median !== 'number')
          kind: "BranchNotTaken",
          point: "25312447185420584691374661549686786",
          // inputs: ["value", "median"],
        },
      ],
    },
  ],
};
