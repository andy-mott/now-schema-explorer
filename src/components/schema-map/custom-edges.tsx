"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
} from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";

function InheritanceEdgeComponent(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
  } = props;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <BaseEdge
      path={edgePath}
      style={{
        stroke: "hsl(var(--muted-foreground))",
        strokeWidth: 2,
        ...style,
      }}
    />
  );
}

function ReferenceEdgeComponent(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    data,
  } = props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const label = data?.label as string | undefined;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: "hsl(210, 70%, 55%)",
          strokeWidth: 1.5,
          strokeDasharray: "6 3",
          ...style,
        }}
        markerEnd="url(#reference-arrow)"
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="absolute bg-background/90 text-[10px] text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const InheritanceEdge = memo(InheritanceEdgeComponent);
export const ReferenceEdge = memo(ReferenceEdgeComponent);
