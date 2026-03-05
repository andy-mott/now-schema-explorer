import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { parseDefinitionExcel } from "@/lib/catalog/excel-parser";
import {
  previewEnrichment,
  type ConflictResolution,
} from "@/lib/catalog/enrich";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const conflictResolution = formData.get("conflictResolution") as ConflictResolution | null;

  if (!file) {
    return NextResponse.json(
      { error: "file is required" },
      { status: 400 }
    );
  }

  if (!conflictResolution || !["replace", "append", "skip"].includes(conflictResolution)) {
    return NextResponse.json(
      { error: "conflictResolution must be one of: replace, append, skip" },
      { status: 400 }
    );
  }

  // Parse Excel file
  let rows;
  try {
    const buffer = await file.arrayBuffer();
    rows = await parseDefinitionExcel(buffer);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to parse Excel file: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows found in Excel file. Expected columns: table_name, element, definition" },
      { status: 400 }
    );
  }

  // Convert to enrichment items and generate preview
  const enrichmentItems = rows.map((row) => ({
    tableName: row.tableName,
    element: row.element,
    definition: row.definition,
  }));

  const preview = await previewEnrichment(enrichmentItems, conflictResolution);

  return NextResponse.json({
    ...preview,
    sourceDetail: `Excel upload: ${file.name}`,
    source: "EXCEL_UPLOAD",
    parsedRows: rows.length,
  });
}
