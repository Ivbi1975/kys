import { useState, useCallback, useRef } from "react";
import { freeze } from "immer";
import type { KesimAlani } from "./types";

export interface HistoryEntry {
  state: KesimAlani;
  description: string;
  timestamp: number;
}

interface UseHistoryReturn {
  current: KesimAlani | null;
  push: (state: KesimAlani, description: string) => void;
  undo: () => KesimAlani | null;
  redo: () => KesimAlani | null;
  canUndo: boolean;
  canRedo: boolean;
  currentDescription: string;
  historyList: { description: string; timestamp: number; isActive: boolean }[];
  goToStep: (index: number) => KesimAlani | null;
  undoCount: number;
  redoCount: number;
  initialize: (state: KesimAlani) => void;
}

const MAX_HISTORY = 80;

function snapshot(state: KesimAlani): KesimAlani {
  return freeze(structuredClone(state), true);
}

export function useHistory(): UseHistoryReturn {
  const entriesRef = useRef<HistoryEntry[]>([]);
  const indexRef = useRef<number>(-1);
  const [, setTick] = useState(0);

  const rerender = useCallback(() => setTick((t) => t + 1), []);

  const initialize = useCallback(
    (state: KesimAlani) => {
      entriesRef.current = [
        { state: snapshot(state), description: "Başlangıç durumu", timestamp: Date.now() },
      ];
      indexRef.current = 0;
      rerender();
    },
    [rerender]
  );

  const push = useCallback(
    (state: KesimAlani, description: string) => {
      const entries = entriesRef.current;
      const idx = indexRef.current;

      if (idx < entries.length - 1) {
        entries.splice(idx + 1);
      }

      entries.push({
        state: snapshot(state),
        description,
        timestamp: Date.now(),
      });

      if (entries.length > MAX_HISTORY) {
        entries.splice(0, entries.length - MAX_HISTORY);
      }

      indexRef.current = entries.length - 1;
      rerender();
    },
    [rerender]
  );

  const undo = useCallback((): KesimAlani | null => {
    if (indexRef.current > 0) {
      indexRef.current--;
      rerender();
      return structuredClone(entriesRef.current[indexRef.current].state);
    }
    return null;
  }, [rerender]);

  const redo = useCallback((): KesimAlani | null => {
    if (indexRef.current < entriesRef.current.length - 1) {
      indexRef.current++;
      rerender();
      return structuredClone(entriesRef.current[indexRef.current].state);
    }
    return null;
  }, [rerender]);

  const goToStep = useCallback(
    (index: number): KesimAlani | null => {
      if (index >= 0 && index < entriesRef.current.length) {
        indexRef.current = index;
        rerender();
        return structuredClone(entriesRef.current[index].state);
      }
      return null;
    },
    [rerender]
  );

  const entries = entriesRef.current;
  const idx = indexRef.current;

  const current = idx >= 0 && idx < entries.length ? entries[idx].state : null;
  const canUndo = idx > 0;
  const canRedo = idx < entries.length - 1;
  const currentDescription =
    idx >= 0 && idx < entries.length ? entries[idx].description : "";
  const undoCount = idx;
  const redoCount = entries.length - 1 - idx;

  const historyList = entries.map((e, i) => ({
    description: e.description,
    timestamp: e.timestamp,
    isActive: i === idx,
  }));

  return {
    current,
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    currentDescription,
    historyList,
    goToStep,
    undoCount,
    redoCount,
    initialize,
  };
}
