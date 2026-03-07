import OpenAI from "openai";
import type { AIClient, AICompletionRequest, AICompletionResponse } from "./client";

export class OpenAIClient implements AIClient {
  private client: OpenAI;
  private model: string;

  constructor(config: { apiKey: string; baseUrl?: string | null; model: string }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
    this.model = config.model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      max_tokens: request.maxTokens ?? 500,
      temperature: request.temperature ?? 0.3,
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error("AI model returned an empty response");
    }

    return {
      content: choice.message.content,
      model: response.model,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens ?? 0,
          }
        : undefined,
    };
  }
}
