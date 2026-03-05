import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  commitEnrichment,
  type CommitItem,
} from "@/lib/catalog/enrich";
import type { DefinitionSource } from "@/generated/prisma/client";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { items, source, sourceDetail } = body as {
    items: CommitItem[];
    source: DefinitionSource;
    sourceDetail: string;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "items array is required and must not be empty" },
      { status: 400 }
    );
  }

  if (!source || !sourceDetail) {
    return NextResponse.json(
      { error: "source and sourceDetail are required" },
      { status: 400 }
    );
  }

  const result = await commitEnrichment(items, source, sourceDetail);

  return NextResponse.json(result);
}
