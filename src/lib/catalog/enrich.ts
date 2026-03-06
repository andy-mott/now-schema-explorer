import { prisma } from "@/lib/db";
import type { DefinitionSource } from "@/generated/prisma/client";

export type ConflictResolution = "replace" | "append" | "skip";

export interface EnrichmentItem {
  tableName: string;
  element: string;
  definition: string;
}

export interface PreviewItem {
  tableName: string;
  element: string;
  label: string;
  internalType: string;
  currentDefinition: string | null;
  incomingDefinition: string;
  resultDefinition: string;
  changeType: "new" | "replace" | "append" | "skip";
  hasConflict: boolean;
}

export interface PreviewResult {
  items: PreviewItem[];
  summary: {
    newCount: number;
    replaceCount: number;
    appendCount: number;
    skipCount: number;
    notFoundCount: number;
  };
}

export interface CommitItem {
  tableName: string;
  element: string;
  resultDefinition: string;
}

export interface CommitResult {
  updated: number;
  total: number;
}

const APPEND_SEPARATOR = "\n\n---\n\n";

/**
 * Generate a preview of what enrichment will do without applying changes.
 */
export async function previewEnrichment(
  items: EnrichmentItem[],
  conflictResolution: ConflictResolution
): Promise<PreviewResult> {
  // Batch-load all matching catalog entries
  const keys = items.map((i) => ({
    tableName: i.tableName,
    element: i.element,
  }));

  // Build a map of existing entries
  const existingEntries = await prisma.catalogEntry.findMany({
    where: {
      OR: keys.map((k) => ({
        tableName: k.tableName,
        element: k.element,
      })),
    },
    select: {
      tableName: true,
      element: true,
      label: true,
      internalType: true,
      definition: true,
    },
  });

  const entryMap = new Map<string, (typeof existingEntries)[0]>();
  for (const entry of existingEntries) {
    entryMap.set(`${entry.tableName}::${entry.element}`, entry);
  }

  const previewItems: PreviewItem[] = [];
  let newCount = 0;
  let replaceCount = 0;
  let appendCount = 0;
  let skipCount = 0;
  let notFoundCount = 0;

  for (const item of items) {
    const key = `${item.tableName}::${item.element}`;
    const entry = entryMap.get(key);

    if (!entry) {
      notFoundCount++;
      continue;
    }

    const hasExisting = entry.definition !== null && entry.definition.trim() !== "";

    let changeType: PreviewItem["changeType"];
    let resultDefinition: string;

    if (!hasExisting) {
      changeType = "new";
      resultDefinition = item.definition;
      newCount++;
    } else if (conflictResolution === "skip") {
      changeType = "skip";
      resultDefinition = entry.definition!;
      skipCount++;
    } else if (conflictResolution === "replace") {
      changeType = "replace";
      resultDefinition = item.definition;
      replaceCount++;
    } else {
      // append
      changeType = "append";
      resultDefinition = entry.definition + APPEND_SEPARATOR + item.definition;
      appendCount++;
    }

    previewItems.push({
      tableName: item.tableName,
      element: item.element,
      label: entry.label,
      internalType: entry.internalType,
      currentDefinition: entry.definition,
      incomingDefinition: item.definition,
      resultDefinition,
      changeType,
      hasConflict: hasExisting,
    });
  }

  return {
    items: previewItems,
    summary: {
      newCount,
      replaceCount,
      appendCount,
      skipCount,
      notFoundCount,
    },
  };
}

/**
 * Commit selected enrichment items — applies definitions to catalog entries.
 * Creates audit records for each definition change.
 */
export async function commitEnrichment(
  selectedItems: CommitItem[],
  source: DefinitionSource,
  sourceDetail: string,
  userId?: string | null,
  comment?: string | null
): Promise<CommitResult> {
  let updated = 0;

  // Process in a transaction for atomicity
  await prisma.$transaction(async (tx) => {
    for (const item of selectedItems) {
      // Read the current value before updating
      const existing = await tx.catalogEntry.findUnique({
        where: {
          tableName_element: {
            tableName: item.tableName,
            element: item.element,
          },
        },
        select: { id: true, definition: true },
      });

      if (!existing) continue;

      await tx.catalogEntry.update({
        where: { id: existing.id },
        data: {
          definition: item.resultDefinition,
          definitionSource: source,
          definitionSourceDetail: sourceDetail,
          validationStatus: "DRAFT",
          validatedAt: null,
          validatedById: null,
        },
      });

      // Create audit record
      await tx.catalogFieldAudit.create({
        data: {
          catalogEntryId: existing.id,
          fieldName: "definition",
          oldValue: existing.definition,
          newValue: item.resultDefinition,
          comment: comment || null,
          userId: userId || null,
        },
      });

      updated++;
    }
  });

  return { updated, total: selectedItems.length };
}
