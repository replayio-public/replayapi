export default {
  dependencyChain: [
    {
      kind: "FunctionCall",
      calledFunction: "generateCompletion",
      arguments: [],
      params: "config: LLMConfig,  prompt: string,  apiKey: string",
      code: `export async function generateCompletion(
  config: LLMConfig,
  prompt: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) // <OmittedCode reason="NotExecuted" />

  try {
    if (config.provider === 'openai') {
      // <OmittedCode reason="NotExecuted" />
    } else {
      const anthropic = new Anthropic({
        apiKey,
        baseURL: 'https://api.anthropic.com',
        httpAgent: undefined // Required for browser environment
      });
      
      const response = await anthropic.messages.create({
        model: config.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature,
      });
      // <OmittedCode reason="NotExecuted" />
    }
  } catch (error) {
    // Handle API-specific error messages
    if (error instanceof Error) {
      if (error.message.includes('401')) // <OmittedCode reason="NotExecuted" />
      if (error.message.includes('429')) // <OmittedCode reason="NotExecuted" />
      /*POINT:children[0]*/throw new Error(\`\${config.provider} API error: \${error.message}\`);
    }
    // <OmittedCode reason="NotExecuted" />
  }
}
`,
      children: [
        {
          // throw new Error(`${config.provider} API error: ${error.message}`);
          kind: "Throw",
          point: "29531188383191041835001355685593108",
        },
      ],
    },
  ],
};
