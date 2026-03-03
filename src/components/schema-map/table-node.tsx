"use client";

import { memo, useState, useEffect, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight, Columns3, ArrowUpRight } from "lucide-react";

// Deterministic color from scope name
function scopeColor(scope: string | null): string {
  if (!scope) return "hsl(0, 0%, 75%)";
  let hash = 0;
  for (let i = 0; i < scope.length; i++) {
    hash = scope.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 55%)`;
}

interface ColumnInfo {
  element: string;
  label: string;
  internalType: string;
  referenceTable: string | null;
}

interface TableNodeData {
  label: string;
  name: string;
  scopeName: string | null;
  scopeLabel: string | null;
  ownColumnCount: number;
  totalColumnCount: number;
  childTableCount: number;
  isCenter: boolean;
  isTruncated: boolean;
  expanded: boolean;
  columnCount: number;
  snapshotId: string;
  onToggleExpand: (nodeId: string) => void;
  onDoubleClick: (tableName: string) => void;
  [key: string]: unknown;
}

function TableNodeComponent({ id, data }: NodeProps) {
  const d = data as unknown as TableNodeData;
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      d.onToggleExpand(id);
    },
    [id, d]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      d.onDoubleClick(d.name);
    },
    [d]
  );

  // Fetch columns when expanded
  useEffect(() => {
    if (!d.expanded || columns.length > 0) return;

    setLoadingColumns(true);
    fetch(
      `/api/tables/${encodeURIComponent(d.name)}?snapshotId=${d.snapshotId}`
    )
      .then((r) => r.json())
      .then((detail) => {
        // Only show own columns (defined on this table), limit to 20
        const own = (detail.columns || [])
          .filter(
            (c: { definedOnTable: string }) => c.definedOnTable === d.name
          )
          .slice(0, 20);
        setColumns(own);
      })
      .catch(console.error)
      .finally(() => setLoadingColumns(false));
  }, [d.expanded, d.name, d.snapshotId, columns.length]);

  const borderColor = scopeColor(d.scopeName);

  return (
    <div
      className={`
        bg-background rounded-lg shadow-md border-2 transition-all duration-150
        ${d.isCenter ? "ring-2 ring-primary ring-offset-2" : ""}
        hover:shadow-lg
      `}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: borderColor,
        minWidth: 220,
        maxWidth: 300,
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Handles for edges */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground !w-2 !h-2"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground !w-2 !h-2"
      />

      {/* Header */}
      <div className="px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{d.label}</div>
            <div className="text-xs text-muted-foreground truncate">
              {d.name}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {d.isTruncated && (
              <span
                className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium"
                title="Has hidden children — double-click to explore"
              >
                +
              </span>
            )}
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          <button
            onClick={handleToggle}
            className="flex items-center gap-0.5 hover:text-foreground transition-colors cursor-pointer"
          >
            {d.expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <Columns3 className="w-3 h-3" />
            <span>{d.ownColumnCount}</span>
          </button>
          {d.scopeLabel && (
            <span
              className="truncate max-w-[100px]"
              title={d.scopeLabel}
              style={{ color: borderColor }}
            >
              {d.scopeLabel}
            </span>
          )}
        </div>
      </div>

      {/* Expanded columns list */}
      {d.expanded && (
        <div className="border-t px-2 py-1.5 max-h-[220px] overflow-y-auto">
          {loadingColumns ? (
            <div className="text-xs text-muted-foreground py-1 px-1">
              Loading...
            </div>
          ) : columns.length === 0 ? (
            <div className="text-xs text-muted-foreground py-1 px-1">
              No columns
            </div>
          ) : (
            <ul className="space-y-0.5">
              {columns.map((col) => (
                <li
                  key={col.element}
                  className="flex items-center gap-1.5 text-xs py-0.5 px-1 rounded hover:bg-muted/50"
                >
                  <span className="font-mono truncate flex-1 min-w-0">
                    {col.element}
                  </span>
                  <span className="text-muted-foreground text-[10px] flex-shrink-0">
                    {col.internalType}
                  </span>
                  {col.referenceTable && (
                    <ArrowUpRight className="w-3 h-3 text-blue-500 flex-shrink-0" />
                  )}
                </li>
              ))}
              {d.ownColumnCount > 20 && (
                <li className="text-xs text-muted-foreground py-0.5 px-1">
                  +{d.ownColumnCount - 20} more...
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
