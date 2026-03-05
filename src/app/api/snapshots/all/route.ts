import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const snapshots = await prisma.schemaSnapshot.findMany({
    select: {
      id: true,
      label: true,
      version: true,
      description: true,
      status: true,
      sourceType: true,
      tableCount: true,
      columnCount: true,
      isBaseline: true,
      createdAt: true,
      errorMessage: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(snapshots);
}
