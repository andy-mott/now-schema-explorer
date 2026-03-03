import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { GraphNode, GraphEdge, GraphResponse } from "@/types/graph";

const MAX_NODES = 150;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get("snapshotId");
  const centerTable = searchParams.get("centerTable");
  const depth = Math.min(parseInt(searchParams.get("depth") || "2", 10), 5);
  const includeRefs = searchParams.get("includeRefs") !== "false";

  if (!snapshotId || !centerTable) {
    return NextResponse.json(
      { error: "snapshotId and centerTable are required" },
      { status: 400 }
    );
  }

  // Fetch all tables in the snapshot (we need superClassName for traversal)
  const allTables = await prisma.snapshotTable.findMany({
    where: { snapshotId },
    select: {
      name: true,
      label: true,
      superClassName: true,
      scopeName: true,
      scopeLabel: true,
      ownColumnCount: true,
      totalColumnCount: true,
      childTableCount: true,
      isExtendable: true,
    },
  });

  // Build lookup maps
  const tableMap = new Map(allTables.map((t) => [t.name, t]));
  const childrenMap = new Map<string, string[]>();
  for (const t of allTables) {
    if (t.superClassName) {
      const children = childrenMap.get(t.superClassName) || [];
      children.push(t.name);
      childrenMap.set(t.superClassName, children);
    }
  }

  const center = tableMap.get(centerTable);
  if (!center) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  // Collect neighborhood nodes
  const includedNames = new Set<string>();
  const edges: GraphEdge[] = [];

  // 1. Walk UP the inheritance chain (all ancestors)
  let current = centerTable;
  while (current) {
    includedNames.add(current);
    const table = tableMap.get(current);
    if (table?.superClassName && tableMap.has(table.superClassName)) {
      edges.push({
        source: table.superClassName,
        target: current,
        type: "inheritance",
      });
      current = table.superClassName;
    } else {
      break;
    }
  }

  // 2. Walk DOWN children to specified depth using BFS
  const queue: { name: string; level: number }[] = [
    { name: centerTable, level: 0 },
  ];

  while (queue.length > 0 && includedNames.size < MAX_NODES) {
    const item = queue.shift()!;
    const children = childrenMap.get(item.name) || [];

    for (const child of children) {
      if (includedNames.size >= MAX_NODES) break;

      includedNames.add(child);
      edges.push({
        source: item.name,
        target: child,
        type: "inheritance",
      });

      if (item.level + 1 < depth) {
        queue.push({ name: child, level: item.level + 1 });
      }
    }
  }

  // 3. Optionally include reference targets
  if (includeRefs && includedNames.size < MAX_NODES) {
    // Get all reference columns for included tables
    const includedArray = Array.from(includedNames);
    const refColumns = await prisma.snapshotColumn.findMany({
      where: {
        table: {
          snapshotId,
          name: { in: includedArray },
        },
        internalType: "reference",
        referenceTable: { not: null },
      },
      select: {
        element: true,
        referenceTable: true,
        table: { select: { name: true } },
      },
    });

    for (const col of refColumns) {
      if (!col.referenceTable) continue;

      // Add edge even if target is already included (for reference visualization)
      edges.push({
        source: col.table.name,
        target: col.referenceTable,
        type: "reference",
        label: col.element,
      });

      // Add the referenced table as a node if not already included
      if (
        !includedNames.has(col.referenceTable) &&
        tableMap.has(col.referenceTable) &&
        includedNames.size < MAX_NODES
      ) {
        includedNames.add(col.referenceTable);
      }
    }
  }

  // Build response
  const truncated = includedNames.size >= MAX_NODES;
  const nodes: GraphNode[] = [];

  for (const name of includedNames) {
    const t = tableMap.get(name);
    if (!t) continue;

    const totalChildren = (childrenMap.get(name) || []).length;
    const includedChildren = (childrenMap.get(name) || []).filter((c) =>
      includedNames.has(c)
    ).length;

    nodes.push({
      name: t.name,
      label: t.label,
      scopeName: t.scopeName,
      scopeLabel: t.scopeLabel,
      ownColumnCount: t.ownColumnCount,
      totalColumnCount: t.totalColumnCount,
      childTableCount: t.childTableCount,
      isExtendable: t.isExtendable,
      isCenter: t.name === centerTable,
      isTruncated: includedChildren < totalChildren,
    });
  }

  // Filter edges to only include those where both endpoints are in our node set
  const validEdges = edges.filter(
    (e) => includedNames.has(e.source) && includedNames.has(e.target)
  );

  // Deduplicate edges
  const edgeSet = new Set<string>();
  const uniqueEdges = validEdges.filter((e) => {
    const key = `${e.source}-${e.target}-${e.type}-${e.label || ""}`;
    if (edgeSet.has(key)) return false;
    edgeSet.add(key);
    return true;
  });

  const response: GraphResponse = {
    nodes,
    edges: uniqueEdges,
    truncated,
  };

  return NextResponse.json(response);
}
