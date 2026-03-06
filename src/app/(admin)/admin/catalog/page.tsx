"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SnapshotSummary } from "@/types";

interface CatalogStats {
  totalEntries: number;
  definedCount: number;
  undefinedCount: number;
  stewardedCount: number;
  tableCount: number;
  validatedCount: number;
  draftWithDefinitionCount: number;
}

interface GenerateResult {
  created: number;
  updated: number;
  total: number;
  snapshotLabel: string;
}

interface ServiceNowInstance {
  id: string;
  name: string;
  url: string;
}

interface PreviewItem {
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

interface PreviewResult {
  items: PreviewItem[];
  summary: {
    newCount: number;
    replaceCount: number;
    appendCount: number;
    skipCount: number;
    notFoundCount: number;
  };
  source: string;
  sourceDetail: string;
}

type ConflictResolution = "replace" | "append" | "skip";
type ChangeTypeFilter = "all" | "new" | "replace" | "append" | "skip";

async function safeJsonParse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      text
        ? `Server returned invalid response: ${text.slice(0, 200)}`
        : `Server returned an empty response (HTTP ${res.status})`
    );
  }
}

export default function AdminCatalogPage() {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // ServiceNow enrichment state
  const [instances, setInstances] = useState<ServiceNowInstance[]>([]);
  const [snInstanceId, setSnInstanceId] = useState("");
  const [snConflict, setSnConflict] = useState<ConflictResolution>("skip");
  const [snIncludeHelp, setSnIncludeHelp] = useState(false);
  const [snPreviewing, setSnPreviewing] = useState(false);
  const [snError, setSnError] = useState<string | null>(null);

  // Excel enrichment state
  const [excelConflict, setExcelConflict] = useState<ConflictResolution>("skip");
  const [excelPreviewing, setExcelPreviewing] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview state (shared between enrichment sources)
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [previewSearch, setPreviewSearch] = useState("");
  const [changeTypeFilter, setChangeTypeFilter] = useState<ChangeTypeFilter>("all");
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ updated: number } | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitComment, setCommitComment] = useState("");

  const refreshStats = useCallback(() => {
    fetch("/api/catalog/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch("/api/snapshots")
      .then((r) => r.json())
      .then((data: SnapshotSummary[]) => {
        const completed = data.filter((s) => s.status === "COMPLETED");
        setSnapshots(completed);
      })
      .catch(console.error);

    fetch("/api/instances")
      .then((r) => r.json())
      .then((data) => setInstances(Array.isArray(data) ? data : []))
      .catch(console.error);

    refreshStats();
  }, [refreshStats]);

  // Generate catalog
  const handleGenerate = async () => {
    if (!selectedSnapshotId) return;

    const snapshot = snapshots.find((s) => s.id === selectedSnapshotId);
    if (
      !confirm(
        `Generate catalog entries from "${snapshot?.label}"? This will create entries for new fields and update metadata for existing ones. Existing definitions and steward assignments will be preserved.`
      )
    ) {
      return;
    }

    setGenerating(true);
    setGenerateResult(null);
    setGenerateError(null);

    try {
      const res = await fetch("/api/admin/catalog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: selectedSnapshotId }),
      });
      const data = await safeJsonParse(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate catalog");
      }
      setGenerateResult(data);
      refreshStats();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  };

  // ServiceNow enrichment preview
  const handleSnPreview = async () => {
    if (!snInstanceId) return;
    setSnPreviewing(true);
    setSnError(null);
    setPreview(null);
    setCommitResult(null);

    try {
      const res = await fetch("/api/admin/catalog/enrich/servicenow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId: snInstanceId,
          conflictResolution: snConflict,
          includeHelp: snIncludeHelp,
        }),
      });
      const data = await safeJsonParse(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch documentation");
      }
      setPreview(data);
      // Select all non-skip items by default
      const defaultSelected = new Set<string>();
      for (const item of data.items) {
        if (item.changeType !== "skip") {
          defaultSelected.add(`${item.tableName}::${item.element}`);
        }
      }
      setSelectedItems(defaultSelected);
      setPreviewSearch("");
      setChangeTypeFilter("all");
    } catch (err) {
      setSnError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSnPreviewing(false);
    }
  };

  // Excel enrichment preview
  const handleExcelPreview = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setExcelPreviewing(true);
    setExcelError(null);
    setPreview(null);
    setCommitResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conflictResolution", excelConflict);

      const res = await fetch("/api/admin/catalog/enrich/excel", {
        method: "POST",
        body: formData,
      });
      const data = await safeJsonParse(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse Excel file");
      }
      setPreview(data);
      // Select all non-skip items by default
      const defaultSelected = new Set<string>();
      for (const item of data.items) {
        if (item.changeType !== "skip") {
          defaultSelected.add(`${item.tableName}::${item.element}`);
        }
      }
      setSelectedItems(defaultSelected);
      setPreviewSearch("");
      setChangeTypeFilter("all");
    } catch (err) {
      setExcelError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExcelPreviewing(false);
    }
  };

  // Commit enrichment
  const handleCommit = async () => {
    if (!preview || selectedItems.size === 0) return;

    const items = preview.items
      .filter((item) => selectedItems.has(`${item.tableName}::${item.element}`))
      .map((item) => ({
        tableName: item.tableName,
        element: item.element,
        resultDefinition: item.resultDefinition,
      }));

    setCommitting(true);
    setCommitError(null);
    try {
      const res = await fetch("/api/admin/catalog/enrich/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          source: preview.source,
          sourceDetail: preview.sourceDetail,
          comment: commitComment.trim() || undefined,
        }),
      });
      const data = await safeJsonParse(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to commit enrichment");
      }
      setCommitResult(data);
      setPreview(null);
      setCommitComment("");
      refreshStats();
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : "Failed to apply enrichment");
      console.error("Commit error:", err);
    } finally {
      setCommitting(false);
    }
  };

  // Filtered preview items
  const filteredPreview = useMemo(() => {
    if (!preview) return [];
    return preview.items.filter((item) => {
      if (changeTypeFilter !== "all" && item.changeType !== changeTypeFilter) return false;
      if (previewSearch) {
        const q = previewSearch.toLowerCase();
        return (
          item.tableName.toLowerCase().includes(q) ||
          item.element.toLowerCase().includes(q) ||
          item.label.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [preview, changeTypeFilter, previewSearch]);

  // Toggle helpers
  const toggleItem = (key: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      for (const item of filteredPreview) {
        next.add(`${item.tableName}::${item.element}`);
      }
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      for (const item of filteredPreview) {
        next.delete(`${item.tableName}::${item.element}`);
      }
      return next;
    });
  };

  const changeTypeBadge = (type: string) => {
    switch (type) {
      case "new":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]">New</Badge>;
      case "replace":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">Replace</Badge>;
      case "append":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px]">Append</Badge>;
      case "skip":
        return <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px]">Skip</Badge>;
      default:
        return null;
    }
  };

  // If preview is showing, render the preview UI instead of the tabs
  if (preview) {
    const selectedCount = selectedItems.size;
    const filteredSelectedCount = filteredPreview.filter(
      (item) => selectedItems.has(`${item.tableName}::${item.element}`)
    ).length;

    return (
      <div className="p-6 max-w-7xl mx-auto overflow-auto h-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Enrichment Preview</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Source: {preview.sourceDetail}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setPreview(null);
              setCommitResult(null);
            }}
          >
            Cancel
          </Button>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Card>
            <CardContent className="py-2 px-3">
              <div className="text-lg font-bold text-green-600">
                {preview.summary.newCount}
              </div>
              <div className="text-[11px] text-muted-foreground">New definitions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-2 px-3">
              <div className="text-lg font-bold text-amber-600">
                {preview.summary.replaceCount}
              </div>
              <div className="text-[11px] text-muted-foreground">Replacements</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-2 px-3">
              <div className="text-lg font-bold text-blue-600">
                {preview.summary.appendCount}
              </div>
              <div className="text-[11px] text-muted-foreground">Appends</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-2 px-3">
              <div className="text-lg font-bold text-gray-500">
                {preview.summary.skipCount}
              </div>
              <div className="text-[11px] text-muted-foreground">Skipped</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-2 px-3">
              <div className="text-lg font-bold text-muted-foreground">
                {preview.summary.notFoundCount}
              </div>
              <div className="text-[11px] text-muted-foreground">Not in catalog</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & selection controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Input
            placeholder="Search table or field..."
            value={previewSearch}
            onChange={(e) => setPreviewSearch(e.target.value)}
            className="w-56"
          />
          <Select
            value={changeTypeFilter}
            onValueChange={(v) => setChangeTypeFilter(v as ChangeTypeFilter)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All changes</SelectItem>
              <SelectItem value="new">New only</SelectItem>
              <SelectItem value="replace">Replace only</SelectItem>
              <SelectItem value="append">Append only</SelectItem>
              <SelectItem value="skip">Skipped only</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={selectAllFiltered}>
              Select all ({filteredPreview.length})
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAllFiltered}>
              Deselect all
            </Button>
          </div>
        </div>

        {/* Preview table */}
        <Card className="mb-4">
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={filteredSelectedCount === filteredPreview.length && filteredPreview.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) selectAllFiltered();
                        else deselectAllFiltered();
                      }}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Current Definition</TableHead>
                  <TableHead className="w-8 text-center"></TableHead>
                  <TableHead>Incoming Definition</TableHead>
                  <TableHead className="w-[80px]">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPreview.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No entries match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPreview.map((item) => {
                    const key = `${item.tableName}::${item.element}`;
                    const isSelected = selectedItems.has(key);
                    return (
                      <TableRow
                        key={key}
                        className={`${isSelected ? "" : "opacity-50"} ${
                          item.changeType === "skip" ? "bg-muted/30" : ""
                        }`}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItem(key)}
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.tableName}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.element}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px]">
                          {item.currentDefinition ? (
                            <span className="line-clamp-3">
                              {item.currentDefinition}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">
                              empty
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          &rarr;
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px]">
                          <span className="line-clamp-3">
                            {item.changeType === "skip"
                              ? item.currentDefinition || ""
                              : item.changeType === "append"
                                ? item.resultDefinition
                                : item.incomingDefinition}
                          </span>
                        </TableCell>
                        <TableCell>{changeTypeBadge(item.changeType)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Action bar */}
        <div className="p-3 rounded-lg border bg-background sticky bottom-4 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Update comment (optional)..."
              value={commitComment}
              onChange={(e) => setCommitComment(e.target.value)}
              className="flex-1 text-sm"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedCount} of {preview.items.length} entries selected
            </span>
            <div className="flex gap-3 items-center">
              {commitError && (
                <span className="text-sm text-red-600 font-medium">
                  Error: {commitError}
                </span>
              )}
              {commitResult && (
                <span className="text-sm text-green-600 font-medium">
                  {commitResult.updated} definitions updated
                </span>
              )}
              <Button
                onClick={handleCommit}
                disabled={selectedCount === 0 || committing}
              >
                {committing
                  ? "Applying..."
                  : `Apply ${selectedCount} selected`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Catalog Management</h1>
        <Button variant="outline" asChild>
          <Link href="/catalog">View Catalog &rarr;</Link>
        </Button>
      </div>

      {/* Stats */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Catalog Stats</CardTitle>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold">{stats.totalEntries}</div>
                <div className="text-xs text-muted-foreground">Total entries</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {stats.definedCount}
                </div>
                <div className="text-xs text-muted-foreground">With definitions</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">
                  {stats.undefinedCount}
                </div>
                <div className="text-xs text-muted-foreground">Needs definition</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.validatedCount}
                </div>
                <div className="text-xs text-muted-foreground">Validated</div>
              </div>
              {stats.totalEntries > 0 && (
                <div className="col-span-2 md:col-span-4">
                  <div className="flex gap-6 items-center">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">
                        Definition coverage
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.round((stats.definedCount / stats.totalEntries) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {Math.round((stats.definedCount / stats.totalEntries) * 100)}%
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">
                        Validation coverage
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${stats.definedCount > 0 ? Math.round((stats.validatedCount / stats.definedCount) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {stats.definedCount > 0
                          ? Math.round((stats.validatedCount / stats.definedCount) * 100)
                          : 0}
                        % of defined
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading stats...</p>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="generate">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="generate" className="flex-1">
            Generate
          </TabsTrigger>
          <TabsTrigger value="enrich" className="flex-1">
            Enrich
          </TabsTrigger>
        </TabsList>

        {/* Generate tab */}
        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>Generate from Snapshot</CardTitle>
              <CardDescription>
                Populate the data catalog from an ingested schema snapshot.
                Existing definitions and steward assignments are preserved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Schema Snapshot
                </label>
                <Select
                  value={selectedSnapshotId}
                  onValueChange={setSelectedSnapshotId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a snapshot..." />
                  </SelectTrigger>
                  <SelectContent>
                    {snapshots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label} ({s.tableCount} tables, {s.columnCount} columns)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!selectedSnapshotId || generating}
                className="w-full"
              >
                {generating ? "Generating..." : "Generate Catalog"}
              </Button>

              {generateResult && (
                <div className="p-3 rounded-md bg-green-50 dark:bg-green-950 text-sm">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Catalog generated from &ldquo;{generateResult.snapshotLabel}&rdquo;
                  </p>
                  <p className="text-green-700 dark:text-green-300 mt-1">
                    {generateResult.created} new entries created,{" "}
                    {generateResult.updated} existing entries updated (
                    {generateResult.total} total fields processed)
                  </p>
                </div>
              )}

              {generateError && (
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 text-sm text-red-800 dark:text-red-200">
                  {generateError}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Enrich tab */}
        <TabsContent value="enrich">
          {commitResult && (
            <div className="p-3 rounded-md bg-green-50 dark:bg-green-950 text-sm mb-4">
              <p className="font-medium text-green-800 dark:text-green-200">
                Enrichment complete: {commitResult.updated} definitions updated
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ServiceNow enrichment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Enrich from ServiceNow
                </CardTitle>
                <CardDescription>
                  Pull field definitions from sys_documentation hints.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Instance
                  </label>
                  <Select
                    value={snInstanceId}
                    onValueChange={setSnInstanceId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select instance..." />
                    </SelectTrigger>
                    <SelectContent>
                      {instances.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          {inst.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Conflict resolution
                  </label>
                  <Select
                    value={snConflict}
                    onValueChange={(v) => setSnConflict(v as ConflictResolution)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">
                        Skip (keep existing)
                      </SelectItem>
                      <SelectItem value="replace">
                        Replace existing
                      </SelectItem>
                      <SelectItem value="append">
                        Append to existing
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={snIncludeHelp}
                    onChange={(e) => setSnIncludeHelp(e.target.checked)}
                    className="rounded"
                  />
                  Include help text (longer descriptions)
                </label>

                <Button
                  onClick={handleSnPreview}
                  disabled={!snInstanceId || snPreviewing}
                  className="w-full"
                >
                  {snPreviewing ? "Fetching documentation..." : "Preview"}
                </Button>

                {snError && (
                  <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 text-sm text-red-800 dark:text-red-200">
                    {snError}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Excel enrichment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Enrich from Excel
                </CardTitle>
                <CardDescription>
                  Upload an .xlsx file with definitions. Expected columns:
                  table_name, element, definition.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Excel file (.xlsx)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Conflict resolution
                  </label>
                  <Select
                    value={excelConflict}
                    onValueChange={(v) => setExcelConflict(v as ConflictResolution)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">
                        Skip (keep existing)
                      </SelectItem>
                      <SelectItem value="replace">
                        Replace existing
                      </SelectItem>
                      <SelectItem value="append">
                        Append to existing
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleExcelPreview}
                  disabled={excelPreviewing}
                  className="w-full"
                >
                  {excelPreviewing ? "Parsing..." : "Preview"}
                </Button>

                {excelError && (
                  <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 text-sm text-red-800 dark:text-red-200">
                    {excelError}
                  </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">Column name variants accepted:</p>
                  <p>Table: table_name, tablename, table, name</p>
                  <p>Field: element, field, field_name, column</p>
                  <p>Definition: definition, description, hint</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
