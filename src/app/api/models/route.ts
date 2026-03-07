import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const models = await prisma.aIModelConfig.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      provider: true,
      baseUrl: true,
      modelId: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(models);
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, provider, baseUrl, modelId, apiKey } = body;

  if (!name || !provider || !modelId || !apiKey) {
    return NextResponse.json(
      { error: "Name, provider, model ID, and API key are required" },
      { status: 400 }
    );
  }

  if (!["OPENAI", "ANTHROPIC"].includes(provider)) {
    return NextResponse.json(
      { error: "Provider must be OPENAI or ANTHROPIC" },
      { status: 400 }
    );
  }

  const model = await prisma.aIModelConfig.create({
    data: {
      name,
      provider,
      baseUrl: baseUrl || null,
      modelId,
      encryptedApiKey: encrypt(apiKey),
    },
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

  return NextResponse.json(model, { status: 201 });
}
