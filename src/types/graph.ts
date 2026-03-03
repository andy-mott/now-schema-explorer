export interface GraphNode {
  name: string;
  label: string;
  scopeName: string | null;
  scopeLabel: string | null;
  ownColumnCount: number;
  totalColumnCount: number;
  childTableCount: number;
  isExtendable: boolean;
  isCenter: boolean;
  isTruncated: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "inheritance" | "reference";
  label?: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
}
