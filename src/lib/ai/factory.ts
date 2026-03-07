import { prisma } from "@/lib/db";
import type { AIClient } from "./client";
import { OpenAIClient } from "./openai-client";
import { AnthropicClient } from "./anthropic-client";
import { decrypt } from "@/lib/crypto";

export interface AIModelMeta {
  id: string;
  name: string;
  provider: string;
  modelId: string;
}

/**
 * Loads the active AI model configuration from the database and returns
 * the appropriate client instance plus model metadata.
 */
export async function getActiveAIClient(): Promise<{
  client: AIClient;
  modelConfig: AIModelMeta;
}> {
  const config = await prisma.aIModelConfig.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!config) {
    throw new Error(
      "No active AI model configured. An admin must configure one under Admin > AI Models."
    );
  }

  const apiKey = decrypt(config.encryptedApiKey);

  const modelConfig: AIModelMeta = {
    id: config.id,
    name: config.name,
    provider: config.provider,
    modelId: config.modelId,
  };

  if (config.provider === "OPENAI") {
    return {
      client: new OpenAIClient({
        apiKey,
        baseUrl: config.baseUrl,
        model: config.modelId,
      }),
      modelConfig,
    };
  } else {
    return {
      client: new AnthropicClient({
        apiKey,
        baseUrl: config.baseUrl,
        model: config.modelId,
      }),
      modelConfig,
    };
  }
}
