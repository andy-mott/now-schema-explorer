import { create } from "zustand";
import type { SnapshotSummary } from "@/types";

interface ExplorerState {
  selectedSnapshotId: string | null;
  availableSnapshots: SnapshotSummary[];
  searchQuery: string;
  scopeFilter: string | null;
  selectedTable: string | null;
  viewMode: "detail" | "map";

  setSnapshot: (id: string) => void;
  setAvailableSnapshots: (snapshots: SnapshotSummary[]) => void;
  setSearchQuery: (query: string) => void;
  setScopeFilter: (scope: string | null) => void;
  setSelectedTable: (name: string | null) => void;
  setViewMode: (mode: "detail" | "map") => void;
}

export const useExplorerStore = create<ExplorerState>((set) => ({
  selectedSnapshotId: null,
  availableSnapshots: [],
  searchQuery: "",
  scopeFilter: null,
  selectedTable: null,
  viewMode: "detail",

  setSnapshot: (id) => set({ selectedSnapshotId: id, selectedTable: null }),
  setAvailableSnapshots: (snapshots) => {
    set((state) => ({
      availableSnapshots: snapshots,
      selectedSnapshotId: state.selectedSnapshotId || snapshots[0]?.id || null,
    }));
  },
  setSearchQuery: (query) => set({ searchQuery: query }),
  setScopeFilter: (scope) => set({ scopeFilter: scope }),
  setSelectedTable: (name) => set({ selectedTable: name }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
