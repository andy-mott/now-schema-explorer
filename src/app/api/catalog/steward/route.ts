import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStewardOrAdmin } from "@/lib/auth";

export async function PATCH(request: Request) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { entryIds, stewardId } = body as {
    entryIds: string[];
    stewardId: string | null;
  };

  if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
    return NextResponse.json(
      { error: "entryIds array is required" },
      { status: 400 }
    );
  }

  const result = await prisma.catalogEntry.updateMany({
    where: { id: { in: entryIds } },
    data: { stewardId: stewardId || null },
  });

  return NextResponse.json({ updated: result.count });
}
