import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get("snapshotId");
  const tableName = searchParams.get("table") || "cmdb_ci_aix_server";

  if (!snapshotId) {
    // Return first available snapshot
    const snap = await prisma.schemaSnapshot.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true },
    });
    return NextResponse.json({
      hint: "Add ?snapshotId=<id>&table=<name> to inspect a table",
      latestSnapshot: snap,
    });
  }

  const table = await prisma.snapshotTable.findUnique({
    where: { snapshotId_name: { snapshotId, name: tableName } },
    select: {
      id: true,
      name: true,
      label: true,
      superClassName: true,
      scopeName: true,
      scopeLabel: true,
      ownColumnCount: true,
      totalColumnCount: true,
      childTableCount: true,
    },
  });

  if (!table) {
    return NextResponse.json({ error: "Table not found", snapshotId, tableName }, { status: 404 });
  }

  // Walk inheritance chain
  const chain: { name: string; superClassName: string | null; ownColumnCount: number }[] = [];
  let current = table.superClassName;
  while (current) {
    const parent = await prisma.snapshotTable.findUnique({
      where: { snapshotId_name: { snapshotId, name: current } },
      select: { name: true, superClassName: true, ownColumnCount: true },
    });
    if (!parent) {
      chain.push({ name: current, superClassName: null, ownColumnCount: -1 });
      break;
    }
    chain.push({ name: parent.name, superClassName: parent.superClassName, ownColumnCount: parent.ownColumnCount });
    current = parent.superClassName;
  }

  // Get a sample of columns for this table
  const ownColumns = await prisma.snapshotColumn.findMany({
    where: { tableId: table.id },
    select: { element: true, definedOnTable: true, internalType: true },
    take: 10,
  });

  // Check distinct definedOnTable values in columns
  const distinctDefinedOn = await prisma.snapshotColumn.groupBy({
    by: ["definedOnTable"],
    where: { tableId: table.id },
    _count: true,
  });

  return NextResponse.json({
    table,
    inheritanceChain: chain,
    columnsLinkedToThisTable: {
      total: await prisma.snapshotColumn.count({ where: { tableId: table.id } }),
      sample: ownColumns,
      distinctDefinedOnTable: distinctDefinedOn,
    },
  });
}
