import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { OpenAIClient } from "@/lib/ai/openai-client";
import { AnthropicClient } from "@/lib/ai/anthropic-client";
import type { AIClient } from "@/lib/ai/client";

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, baseUrl, modelId, apiKey } = body;

  if (!provider || !modelId || !apiKey) {
    return NextResponse.json(
      { error: "Provider, model ID, and API key are required" },
      { status: 400 }
    );
  }

  try {
    let client: AIClient;

    if (provider === "OPENAI") {
      client = new OpenAIClient({
        apiKey,
        baseUrl: baseUrl || null,
        model: modelId,
      });
    } else if (provider === "ANTHROPIC") {
      client = new AnthropicClient({
        apiKey,
        baseUrl: baseUrl || null,
        model: modelId,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Unknown provider" },
        { status: 200 }
      );
    }

    const response = await client.complete({
      systemPrompt: "You are a helpful assistant.",
      userPrompt: "Say 'OK' and nothing else.",
      maxTokens: 10,
      temperature: 0,
    });

    return NextResponse.json({
      success: true,
      message: `Connected successfully. Model responded: "${response.content.trim()}"`,
      model: response.model,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Connection test failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 200 }
    );
  }
}
