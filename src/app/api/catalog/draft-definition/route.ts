import { NextResponse } from "next/server";
import { requireStewardOrAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAIClient } from "@/lib/ai/factory";
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildUserPromptWithDocs,
} from "@/lib/ai/prompts";
import { searchServiceNowDocs } from "@/lib/ai/docs-search";

export async function POST(request: Request) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tableName, element } = body;

  if (!tableName || !element) {
    return NextResponse.json(
      { error: "tableName and element are required" },
      { status: 400 }
    );
  }

  // 1. Load the catalog entry for full context
  const entry = await prisma.catalogEntry.findUnique({
    where: { tableName_element: { tableName, element } },
  });

  if (!entry) {
    return NextResponse.json(
      { error: "Catalog entry not found" },
      { status: 404 }
    );
  }

  try {
    // 2. Get the active AI client
    const { client, modelConfig } = await getActiveAIClient();

    // 3. Try to find ServiceNow documentation for this field
    const docs = await searchServiceNowDocs(tableName, element);

    // 4. Build the prompt with or without docs
    const systemPrompt = buildSystemPrompt();
    const fieldContext = {
      tableName,
      element,
      label: entry.label,
      internalType: entry.internalType,
      existingDefinition: entry.definition,
    };

    const userPrompt = docs
      ? buildUserPromptWithDocs(fieldContext, docs)
      : buildUserPrompt(fieldContext);

    // 5. Call the AI model
    const response = await client.complete({
      systemPrompt,
      userPrompt,
      maxTokens: 500,
      temperature: 0.3,
    });

    return NextResponse.json({
      definition: response.content.trim(),
      model: modelConfig.name,
      modelId: modelConfig.modelId,
      provider: modelConfig.provider,
      hadDocumentation: !!docs,
      usage: response.usage,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI definition drafting failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
