import { useCallback, useState } from "react";
import type { KesimAlani } from "@/lib/types";
import { useHistory } from "@/lib/useHistory";

interface UseUndoRedoParams {
  setKesim: React.Dispatch<React.SetStateAction<KesimAlani | null>>;
  saveToApi: (data: KesimAlani, saveType?: "full" | "donations" | "groups") => void;
  discardPendingSave: () => void;
}

export function useUndoRedo({ setKesim, saveToApi, discardPendingSave }: UseUndoRedoParams) {
  const history = useHistory();
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

  const handleUndo = useCallback(() => {
    const prev = history.undo();
    if (prev) {
      setKesim(prev);
      discardPendingSave();
      saveToApi(prev);
    }
  }, [history, setKesim, saveToApi, discardPendingSave]);

  const handleRedo = useCallback(() => {
    const next = history.redo();
    if (next) {
      setKesim(next);
      discardPendingSave();
      saveToApi(next);
    }
  }, [history, setKesim, saveToApi, discardPendingSave]);

  const handleGoToStep = useCallback((index: number) => {
    const target = history.goToStep(index);
    if (target) {
      setKesim(target);
      saveToApi(target);
    }
  }, [history, setKesim, saveToApi]);

  return {
    history,
    historyPanelOpen,
    setHistoryPanelOpen,
    handleUndo,
    handleRedo,
    handleGoToStep,
  };
}
