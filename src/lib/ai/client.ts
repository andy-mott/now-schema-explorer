/**
 * Shared AI client interface for provider-agnostic completions.
 */

export interface AICompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIClient {
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}
