import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

const DETAILED_NODE_WIDTH = 240;
const DETAILED_NODE_HEIGHT = 80;
const MINI_NODE_WIDTH = 140;
const MINI_NODE_HEIGHT = 36;

export function computeLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 60,
    edgesep: 15,
    marginx: 40,
    marginy: 40,
  });

  // Add nodes to dagre graph with appropriate sizes
  for (const node of nodes) {
    const isMini = node.type === "miniNode";
    const width = isMini ? MINI_NODE_WIDTH : DETAILED_NODE_WIDTH;
    let height = isMini ? MINI_NODE_HEIGHT : DETAILED_NODE_HEIGHT;

    // If detailed node is expanded, increase height
    if (!isMini && node.data?.expanded) {
      height += Math.min((node.data.columnCount as number) || 0, 8) * 24 + 16;
    }

    g.setNode(node.id, { width, height });
  }

  // Use inheritance edges for hierarchical layout
  for (const edge of edges) {
    if (edge.data?.type === "inheritance") {
      g.setEdge(edge.source, edge.target);
    }
  }

  // Also add reference edges to dagre for positioning
  // (so reference-only nodes don't overlap with the hierarchy)
  for (const edge of edges) {
    if (edge.data?.type === "reference") {
      // Only add if not already present (dagre doesn't handle duplicates well)
      if (!g.hasEdge(edge.source, edge.target)) {
        g.setEdge(edge.source, edge.target);
      }
    }
  }

  // Run layout
  dagre.layout(g);

  // Apply computed positions to nodes
  const positionedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;

    const isMini = node.type === "miniNode";
    const width = isMini ? MINI_NODE_WIDTH : DETAILED_NODE_WIDTH;
    const height = nodeWithPosition.height || (isMini ? MINI_NODE_HEIGHT : DETAILED_NODE_HEIGHT);

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: positionedNodes, edges };
}
