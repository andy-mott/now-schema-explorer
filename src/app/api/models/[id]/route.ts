import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, provider, baseUrl, modelId, apiKey } = body;

  if (!name || !provider || !modelId) {
    return NextResponse.json(
      { error: "Name, provider, and model ID are required" },
      { status: 400 }
    );
  }

  if (!["OPENAI", "ANTHROPIC"].includes(provider)) {
    return NextResponse.json(
      { error: "Provider must be OPENAI or ANTHROPIC" },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {
    name,
    provider,
    baseUrl: baseUrl || null,
    modelId,
  };

  // Only update API key if a new one is provided
  if (apiKey) {
    data.encryptedApiKey = apiKey; // TODO: encrypt
  }

  const model = await prisma.aIModelConfig.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      provider: true,
      baseUrl: true,
      modelId: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json(model);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.aIModelConfig.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
