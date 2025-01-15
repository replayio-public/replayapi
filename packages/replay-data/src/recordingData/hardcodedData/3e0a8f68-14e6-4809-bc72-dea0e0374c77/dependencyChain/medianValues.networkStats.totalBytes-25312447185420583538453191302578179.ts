export default {
  dependencyChain: [
    {
      kind: "WriteProperty",
      point: "25312447185383432948810210512732191",
    },
    {
      kind: "FunctionCall",
      point: "25312447185383432948810210512732191",
      calledFunction: "getMedian",
      arguments: [],
      params: "value: number, median: number",
      code: `export function getMedian(numbers: number[]): number {
  /*POINT:children[3]*/if (!numbers?.length) { /*<OmittedCode reason="BranchNotTaken"/>*/ }
  
  const sorted = [...numbers]./*POINT:children[2]*/sort((a, b) => a - b);
  const middle = Math./*POINT:children[1]*/floor(sorted.length / 2);
  
  return /*POINT:children[0]*/sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}`,
      children: [
        {
          point: "25312447185383435254653185366687752",
          kind: "Return",
          expression:
            "sorted.length % 2 === 0\n    ? (sorted[middle - 1] + sorted[middle]) / 2\n    : sorted[middle]",
          // inputs: ["sorted", "middle"],
        },
        {
          // const middle = ...
          point: "25312447185383435254653185366687751",
          kind: "Assign",
          // inputs: ["sorted"],
        },
        {
          // const sorted = ...
          point: "25312447185383434101731680759840772",
          kind: "Assign",
          // inputs: ["numbers"],
        },
        {
          // if (...)
          point: "25312447185383434101731680759840770",
          kind: "BranchNotTaken",
          // inputs: ["numbers"],
        },
      ],
    },
  ],
};
