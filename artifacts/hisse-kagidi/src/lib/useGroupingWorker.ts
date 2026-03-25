import { useRef, useCallback } from "react";
import type { Donation, AnimalGroup } from "./types";
import type { GroupingProgress } from "./grouping";
import type { WorkerResponse } from "./grouping.worker";

let sharedWorker: Worker | null = null;
let workerSupported: boolean | null = null;

function getWorker(): Worker | null {
  if (workerSupported === false) return null;

  if (sharedWorker) return sharedWorker;

  try {
    sharedWorker = new Worker(
      new URL("./grouping.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerSupported = true;
    return sharedWorker;
  } catch {
    workerSupported = false;
    return null;
  }
}

class CancelledError extends Error {
  constructor() {
    super("Grouping cancelled");
    this.name = "CancelledError";
  }
}

export function useGroupingWorker() {
  const activeIdRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const runGrouping = useCallback(
    (
      donations: Donation[],
      onProgress?: (progress: GroupingProgress) => void
    ): Promise<AnimalGroup[]> => {
      const worker = getWorker();

      if (!worker) {
        return fallbackGrouping(donations, onProgress);
      }

      const id = crypto.randomUUID();
      activeIdRef.current = id;

      return new Promise<AnimalGroup[]>((resolve, reject) => {
        function handler(e: MessageEvent<WorkerResponse>) {
          const msg = e.data;
          if (msg.id !== id) return;

          if (msg.type === "progress") {
            onProgress?.({ current: msg.current, total: msg.total });
            return;
          }

          cleanup();

          if (msg.type === "result") {
            if (msg.cancelled) {
              reject(new CancelledError());
            } else {
              resolve(msg.groups);
            }
          } else if (msg.type === "error") {
            reject(new Error(msg.message));
          }
        }

        function cleanup() {
          worker!.removeEventListener("message", handler);
          activeIdRef.current = null;
          cleanupRef.current = null;
        }

        cleanupRef.current = () => {
          cleanup();
          reject(new CancelledError());
        };

        worker.addEventListener("message", handler);
        worker.postMessage({ type: "group", id, donations });
      });
    },
    []
  );

  const cancelGrouping = useCallback(() => {
    const worker = getWorker();
    if (worker && activeIdRef.current) {
      worker.postMessage({ type: "cancel", id: activeIdRef.current });
    }
    if (cleanupRef.current) {
      cleanupRef.current();
    }
  }, []);

  const isRunning = useCallback(() => activeIdRef.current !== null, []);

  const runIncrementalGrouping = useCallback(
    (
      donations: Donation[],
      existingGroups: AnimalGroup[],
      changedDonationIds: string[],
      lockedGroupIndices: number[]
    ): Promise<AnimalGroup[]> => {
      const worker = getWorker();

      if (!worker) {
        return fallbackGrouping(donations);
      }

      const id = crypto.randomUUID();
      activeIdRef.current = id;

      return new Promise<AnimalGroup[]>((resolve, reject) => {
        function handler(e: MessageEvent<WorkerResponse>) {
          const msg = e.data;
          if (msg.id !== id) return;

          if (msg.type === "progress") return;

          cleanup();

          if (msg.type === "result") {
            if (msg.cancelled) {
              reject(new CancelledError());
            } else {
              resolve(msg.groups);
            }
          } else if (msg.type === "error") {
            reject(new Error(msg.message));
          }
        }

        function cleanup() {
          worker!.removeEventListener("message", handler);
          activeIdRef.current = null;
          cleanupRef.current = null;
        }

        cleanupRef.current = () => {
          cleanup();
          reject(new CancelledError());
        };

        worker.addEventListener("message", handler);
        worker.postMessage({
          type: "incrementalGroup",
          id,
          donations,
          existingGroups,
          changedDonationIds,
          lockedGroupIndices,
        });
      });
    },
    []
  );

  return { runGrouping, runIncrementalGrouping, cancelGrouping, isRunning };
}

async function fallbackGrouping(
  donations: Donation[],
  onProgress?: (progress: GroupingProgress) => void
): Promise<AnimalGroup[]> {
  const { autoGroupDonationsAsync } = await import("./grouping");
  return autoGroupDonationsAsync(donations, onProgress);
}
