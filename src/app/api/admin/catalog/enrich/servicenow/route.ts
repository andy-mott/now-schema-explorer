import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ServiceNowClient } from "@/lib/servicenow/client";
import {
  previewEnrichment,
  type EnrichmentItem,
  type ConflictResolution,
} from "@/lib/catalog/enrich";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      instanceId,
      conflictResolution,
      includeHelp = false,
    } = body as {
      instanceId: string;
      conflictResolution: ConflictResolution;
      includeHelp?: boolean;
    };

    if (!instanceId || !conflictResolution) {
      return NextResponse.json(
        { error: "instanceId and conflictResolution are required" },
        { status: 400 }
      );
    }

    // Fetch instance credentials
    const instance = await prisma.serviceNowInstance.findUnique({
      where: { id: instanceId },
      select: { name: true, url: true, username: true, encryptedPassword: true },
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      );
    }

    // Fetch sys_documentation from ServiceNow
    const client = new ServiceNowClient({
      url: instance.url,
      username: instance.username,
      password: instance.encryptedPassword,
    });

    let records;
    try {
      records = await client.fetchDocumentation();
    } catch (err) {
      return NextResponse.json(
        {
          error: `Failed to fetch sys_documentation: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
        { status: 502 }
      );
    }

    // Parse records and build a lookup map by (tableName, element)
    const docMap = new Map<
      string,
      { hint: string; help: string; label: string }
    >();

    for (const record of records) {
      const parsed = ServiceNowClient.parseDocumentationRecord(record);
      if (parsed.hint) {
        const key = `${parsed.tableName}::${parsed.element}`;
        // Keep the first occurrence (most specific)
        if (!docMap.has(key)) {
          docMap.set(key, {
            hint: parsed.hint,
            help: parsed.help,
            label: parsed.label,
          });
        }
      }
    }

    // Load all catalog entries to match against
    const catalogEntries = await prisma.catalogEntry.findMany({
      select: { tableName: true, element: true },
    });

    // For entries without a direct match, try to find documentation from
    // tables that inherit this field (using SnapshotColumn data)
    const unmatchedEntries = catalogEntries.filter(
      (e) => !docMap.has(`${e.tableName}::${e.element}`)
    );

    // Build a map of (definedOnTable, element) → child table names
    // from the most recent completed snapshot
    const latestSnapshot = await prisma.schemaSnapshot.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const childTableMap = new Map<string, string[]>();
    if (latestSnapshot && unmatchedEntries.length > 0) {
      const columns = await prisma.snapshotColumn.findMany({
        where: {
          table: { snapshotId: latestSnapshot.id },
          OR: unmatchedEntries.map((e) => ({
            definedOnTable: e.tableName,
            element: e.element,
          })),
        },
        select: {
          element: true,
          definedOnTable: true,
          table: { select: { name: true } },
        },
      });

      for (const col of columns) {
        const key = `${col.definedOnTable}::${col.element}`;
        if (!childTableMap.has(key)) {
          childTableMap.set(key, []);
        }
        childTableMap.get(key)!.push(col.table.name);
      }
    }

    // Build enrichment items by matching catalog entries to documentation
    const enrichmentItems: EnrichmentItem[] = [];

    for (const entry of catalogEntries) {
      const directKey = `${entry.tableName}::${entry.element}`;
      let doc = docMap.get(directKey);

      // If no direct match, check child tables
      if (!doc) {
        const childTables = childTableMap.get(directKey) || [];
        for (const childTable of childTables) {
          const childKey = `${childTable}::${entry.element}`;
          doc = docMap.get(childKey);
          if (doc) break;
        }
      }

      if (doc) {
        let definition = doc.hint;
        if (includeHelp && doc.help) {
          definition += "\n\n" + doc.help;
        }
        enrichmentItems.push({
          tableName: entry.tableName,
          element: entry.element,
          definition,
        });
      }
    }

    // Generate preview
    const preview = await previewEnrichment(enrichmentItems, conflictResolution);

    return NextResponse.json({
      ...preview,
      sourceDetail: `sys_documentation from ${instance.name} (${instance.url})`,
      source: "SYS_DOCUMENTATION",
      documentationRecords: records.length,
      matchedEntries: enrichmentItems.length,
    });
  } catch (err) {
    console.error("ServiceNow enrichment error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "An unexpected error occurred during enrichment",
      },
      { status: 500 }
    );
  }
}
