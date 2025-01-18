export default {
  dependencyChain: [
    {
      kind: "FunctionCall",
      calledFunction: "APIClient.makeRequest",
      // arguments: [options, retriesRemaining - 1],
      code: `private async makeRequest<Req>(
  optionsInput: PromiseOrValue<FinalRequestOptions<Req>>,
  retriesRemaining: number | null,
): Promise<APIResponseProps> {
  const options = await optionsInput;
  if (retriesRemaining == null) // <OmittedCode reason="NotExecuted" />

  await this.prepareOptions(options);

  const { req, url, timeout } = this.buildRequest(options);

  await this.prepareRequest(req, { url, options });

  debug('request', url, options, req.headers);

  if (options.signal?.aborted) // <OmittedCode reason="NotExecuted" />

  const controller = new AbortController();
  const response = await this./*POINT:29531188383191014164885245121265680*/fetchWithTimeout(url, req, timeout, controller)./*POINT:29531188383191022235335777369194513*/catch(castToError);

  /*POINT:29531188383191031458707814223970322*/if (response instanceof Error) {
    if (options.signal?.aborted)  // <OmittedCode reason="NotExecuted" />
    if (retriesRemaining)  // <OmittedCode reason="NotExecuted" />
    if (response.name === 'AbortError')  // <OmittedCode reason="NotExecuted" />
    /*POINT:29531188383191036070393862716135586*/throw new APIConnectionError({ cause: response });
  }
  // <OmittedCode reason="NotExecuted" />
}
`,
      children: [
        {
          // throw new APIConnectionError({ cause: response });
          kind: "Throw",
          point: "29531188383191036070393862716135586",
          inputs: ["APIConnectionError", "response"],
        },
        {
          // if (response instanceof Error)
          kind: "If",
          point: "29531188383191031458707814223970322",
          inputs: ["response"],
        },
        {
          // .catch(castToError);
          kind: "FunctionCall",
          point: "29531188383191022235335777369194513",
          calledFunction: "castToError",
          returnPointInFunction: "29531188383191030305786309617123331",
          returnCode: "if (err instanceof Error) return /*POINT*/err;"
        },
        {
          // const response = await this.fetchWithTimeout(url, req, timeout, controller)
          kind: "FunctionCall",
          point: "29531188383191014164885245121265680",
          calledFunction: "APIClient.fetchWithTimeout",
          returnPointInFunction: "29531188383191016470728219975221257",
          returnCode: `return (
      this.getRequestClient()
        // use undefined this binding; fetch errors if bound to something else in browser/cloudflare
        .fetch./*POINT*/call(undefined, url, { signal: controller.signal as any, ...options })
        .finally(() => {
          clearTimeout(timeout);
        })
    );`
        },
        {
          kind: "FetchCall",
          point: "29531188383191016470728219975221257",
          code: "fetch./*POINT*/call(undefined, url, { signal: controller.signal as any, ...options })",
          url: "https://api.anthropic.com/v1/messages",
          error: "Failed to fetch",
          IMPORTANT_NOTES: "The fetch call errored while running in a browser environment. If this is a problem, make sure to implement a server-side middleware and redirect through that to avoid CORS and other networking issues."
        }
      ],
    },
  ],
};
