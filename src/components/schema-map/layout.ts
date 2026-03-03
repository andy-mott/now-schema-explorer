import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

const NODE_WIDTH = 240;
const NODE_HEIGHT_COLLAPSED = 80;

export function computeLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    edgesep: 20,
    marginx: 40,
    marginy: 40,
  });

  // Add nodes to dagre graph
  for (const node of nodes) {
    const height = node.data?.expanded
      ? NODE_HEIGHT_COLLAPSED + Math.min((node.data.columnCount as number) || 0, 8) * 24 + 16
      : NODE_HEIGHT_COLLAPSED;

    g.setNode(node.id, {
      width: NODE_WIDTH,
      height,
    });
  }

  // Only use inheritance edges for layout to get a clean hierarchy
  for (const edge of edges) {
    if (edge.data?.type === "inheritance") {
      g.setEdge(edge.source, edge.target);
    }
  }

  // Run layout
  dagre.layout(g);

  // Apply computed positions to nodes
  const positionedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - (nodeWithPosition.height || NODE_HEIGHT_COLLAPSED) / 2,
      },
    };
  });

  return { nodes: positionedNodes, edges };
}
