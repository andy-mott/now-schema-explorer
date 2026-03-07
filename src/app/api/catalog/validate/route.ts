import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStewardOrAdmin } from "@/lib/auth";
import { auditFieldChangesBulk } from "@/lib/catalog/audit";

export async function PATCH(request: Request) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { entryIds, action } = body as {
    entryIds: string[];
    action: "validate" | "unvalidate";
  };

  if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
    return NextResponse.json(
      { error: "entryIds array is required" },
      { status: 400 }
    );
  }

  if (!["validate", "unvalidate"].includes(action)) {
    return NextResponse.json(
      { error: 'action must be "validate" or "unvalidate"' },
      { status: 400 }
    );
  }

  // Get the current user's ID from the session
  const userId =
    typeof session === "object" && "user" in session
      ? session.user?.userId
      : undefined;

  // Fetch current values for audit trail
  const currentEntries = await prisma.catalogEntry.findMany({
    where: { id: { in: entryIds } },
    select: { id: true, validationStatus: true },
  });

  if (action === "validate") {
    // Only validate entries that have a definition
    const validatable = await prisma.catalogEntry.findMany({
      where: {
        id: { in: entryIds },
        definition: { not: null },
      },
      select: { id: true, validationStatus: true },
    });

    const result = await prisma.catalogEntry.updateMany({
      where: {
        id: { in: validatable.map((e) => e.id) },
      },
      data: {
        validationStatus: "VALIDATED",
        validatedAt: new Date(),
        validatedById: userId || null,
      },
    });

    // Create audit records for entries that actually changed
    await auditFieldChangesBulk(
      prisma,
      validatable.map((e) => ({
        id: e.id,
        oldValues: { validationStatus: e.validationStatus },
      })),
      { validationStatus: "VALIDATED" },
      userId || null
    );

    return NextResponse.json({ updated: result.count });
  } else {
    const result = await prisma.catalogEntry.updateMany({
      where: { id: { in: entryIds } },
      data: {
        validationStatus: "DRAFT",
        validatedAt: null,
        validatedById: null,
      },
    });

    // Create audit records for entries that actually changed
    await auditFieldChangesBulk(
      prisma,
      currentEntries.map((e) => ({
        id: e.id,
        oldValues: { validationStatus: e.validationStatus },
      })),
      { validationStatus: "DRAFT" },
      userId || null
    );

    return NextResponse.json({ updated: result.count });
  }
}
