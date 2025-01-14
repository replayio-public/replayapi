export default {
  dependencyChain: [
    {
      point: "25312447185383432948810210512732191",
      kind: ["PropertyWrite", "CallExpression"],
      // NOTE: We already have the value from the Return.
      calledFunction: {
        name: "getMedian",
        params: "numbers: number[]",
      },
    },
    {
      point: "25312447185383435254653185366687752",
      kind: "Return",
      expression: "sorted.length % 2 === 0\n    ? (sorted[middle - 1] + sorted[middle]) / 2\n    : sorted[middle]",
      inputs: ["sorted", "middle"],
    },
    {
      // const middle = ...
      point: "25312447185383435254653185366687751",
      kind: "Assign",
      inputs: ["sorted"],
    },
    {
      // const sorted = ...
      point: "25312447185383434101731680759840772",
      kind: "Assign",
      inputs: ["numbers"],
    },
    {
      // if (...)
      point: "25312447185383434101731680759840770",
      kind: "BranchNotTaken",
      inputs: ["numbers"],
    },
  ],
};
