export default {
  dependencyChain: [
    // {
    //   // NOTE: We don't have points for params, and we generally don't need them.
    //   // The `point` of the `CallExpression` is good enough.
    //   kind: "Param",
    //   expression: "result",
    // },
    // {
    //   kind: "Array.map",
    //   point: "29531188383191924972873506573254677",
    //   calledFunction: {
    //     name: "<anonymous>",
    //     params: "result",
    //   },
    // },
    // {
    //   // const [results, setResults] = useState...
    //   kind: "Assign",
    //   point: "29531188383191722058688695768186886",
    // },
    // {
    //   // setResults(...)
    //   kind: "ReactSetState",
    //   point: "29531188383191049905451887933521932",
    // },
    {
      kind: ["ObjectCreation", "PropertyWrite"],
      key: "error",
      point: "29531188383191047599608878719827988",
    },
  ],
};
