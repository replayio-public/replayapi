export default {
  dependencyChain: [
    /** ###########################################################################
     * formatDeviation
     * ##########################################################################*/
    {
      // return `${sign}${deviation.toFixed(1)}%`;
      point: "25312447185420621584862808968790024",
      kind: "Return",
      expression: "`${sign}${deviation.toFixed(1)}%`",
      inputs: ["sign", "deviation"],
    },
    {
      // const sign = ...
      point: "25312447185420621584862808968790022",
      kind: "Assign",
      expression: "deviation > 0 ? '+' : ''",
      inputs: ["deviation"],
    },
    {
      // if (!/*POINT*/isFinite(deviation) || isNaN(deviation))
      kind: "BranchNotTaken",
      point: "25312447185420621584862808968790019",
      inputs: ["deviation"],
    },
    {
      kind: "CallExpression",
      point: "25312447185420620431941338721681417",
      // NOTE: We already have the value from the Return.
      calledFunction: {
        name: "formatDeviation",
        params: "deviation: number",
      },
      inputs: ["totalBytesDeviation"],
    },
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
