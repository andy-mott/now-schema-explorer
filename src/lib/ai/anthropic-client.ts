import Anthropic from "@anthropic-ai/sdk";
import type { AIClient, AICompletionRequest, AICompletionResponse } from "./client";

export class AnthropicClient implements AIClient {
  private client: Anthropic;
  private model: string;

  constructor(config: { apiKey: string; baseUrl?: string | null; model: string }) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
    this.model = config.model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userPrompt }],
      max_tokens: request.maxTokens ?? 500,
      temperature: request.temperature ?? 0.3,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("AI model returned an empty response");
    }

    return {
      content: textBlock.text,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
