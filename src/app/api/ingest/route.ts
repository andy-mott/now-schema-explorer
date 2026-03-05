import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ingestFromInstance } from "@/lib/servicenow/ingest";
import { progressStore } from "@/lib/servicenow/progress-store";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { snapshotId, instanceId } = body;

  if (!snapshotId || !instanceId) {
    return NextResponse.json(
      { error: "snapshotId and instanceId are required" },
      { status: 400 }
    );
  }

  const instance = await prisma.serviceNowInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) {
    return NextResponse.json(
      { error: "Instance not found" },
      { status: 404 }
    );
  }

  // Start ingestion in background (non-blocking) with progress tracking
  ingestFromInstance(
    snapshotId,
    {
      url: instance.url,
      username: instance.username,
      password: instance.encryptedPassword, // TODO: decrypt
    },
    (progress) => {
      progressStore.set(snapshotId, progress);
    }
  ).catch((err) => {
    console.error(
      `Ingestion failed for snapshot ${snapshotId} (instance: ${instance.name} / ${instance.url}):`,
      err instanceof Error ? err.message : err
    );
  });

  return NextResponse.json({ status: "started", snapshotId });
}
