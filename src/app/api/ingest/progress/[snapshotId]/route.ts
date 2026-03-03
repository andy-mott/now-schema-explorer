import { progressStore } from "@/lib/servicenow/progress-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const { snapshotId } = await params;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream may be closed
        }
      }

      // Send current state immediately if available
      const current = progressStore.get(snapshotId);
      if (current) {
        send(current);
      }

      // Subscribe to future updates
      function onProgress(progress: { phase: string; current: number; total: number; message: string }) {
        send(progress);

        // Close the stream when ingestion is done
        if (progress.phase === "complete" || progress.phase === "error") {
          progressStore.unsubscribe(snapshotId, onProgress);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      }

      progressStore.subscribe(snapshotId, onProgress);

      // If no progress exists and nothing is running, send a "waiting" event
      if (!current) {
        send({ phase: "waiting", current: 0, total: 0, message: "Waiting for ingestion to start..." });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
