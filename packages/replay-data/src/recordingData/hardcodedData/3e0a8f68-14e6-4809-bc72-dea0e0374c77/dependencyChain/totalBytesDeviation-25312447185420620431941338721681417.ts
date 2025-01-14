export default {
  dependencyChain: [
    /** ###########################################################################
     * NetworkStats
     * ##########################################################################*/
    {
      // const totalBytesDeviation = calculateDeviation(...)
      // We don't need `expression` or `value` because we have the RHS from the `Return` point.
      point: "25312447185420583538453191302578179",
      kind: "Assign",
      // TODO: inputs is uninteresting here.
    },
    /** ###########################################################################
     * calculateDeviation
     * ##########################################################################*/
    {
      kind: "Return",
      point: "25312447185420584691374661549686789",
    },
    {
      // /*POINT*/if (median === 0)
      kind: "BranchTaken",
      point: "25312447185420584691374661549686788",
      inputs: ["median"],
    },
    {
      // /*POINT*/if (typeof value !== 'number' || typeof median !== 'number')
      kind: "BranchNotTaken",
      point: "25312447185420584691374661549686786",
      inputs: ["value", "median"],
    },
    {
      kind: "CallExpression",
      point: "25312447185420583538453191302578179",
      calledFunction: {
        name: "calculateDeviation",
        params: "value: number, median: number",
      },
    },
  ],
};
