import type { IngestProgress } from "./types";

type ProgressCallback = (progress: IngestProgress) => void;

class ProgressStore {
  private progress = new Map<string, IngestProgress>();
  private subscribers = new Map<string, Set<ProgressCallback>>();

  set(snapshotId: string, progress: IngestProgress) {
    this.progress.set(snapshotId, progress);

    // Notify all subscribers for this snapshot
    const subs = this.subscribers.get(snapshotId);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(progress);
        } catch {
          // Ignore errors in callbacks (e.g., closed streams)
        }
      }
    }

    // Auto-cleanup completed/errored entries after 60s
    if (progress.phase === "complete" || progress.phase === "error") {
      setTimeout(() => {
        this.progress.delete(snapshotId);
        this.subscribers.delete(snapshotId);
      }, 60_000);
    }
  }

  get(snapshotId: string): IngestProgress | undefined {
    return this.progress.get(snapshotId);
  }

  subscribe(snapshotId: string, callback: ProgressCallback) {
    if (!this.subscribers.has(snapshotId)) {
      this.subscribers.set(snapshotId, new Set());
    }
    this.subscribers.get(snapshotId)!.add(callback);
  }

  unsubscribe(snapshotId: string, callback: ProgressCallback) {
    const subs = this.subscribers.get(snapshotId);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        this.subscribers.delete(snapshotId);
      }
    }
  }
}

// Singleton — survives across requests in the same process
export const progressStore = new ProgressStore();
