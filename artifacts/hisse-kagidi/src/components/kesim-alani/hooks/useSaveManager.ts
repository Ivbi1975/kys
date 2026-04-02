import { useState, useCallback, useRef, useEffect, createElement } from "react";
import type { KesimAlani } from "@/lib/types";
import { apiUpdateKesimAlani, apiUpdateBulkAnimalGroups } from "@/lib/api";
import type { ChunkProgress } from "@/lib/api/kesim-alanlari";

interface UseSaveManagerDeps {
  toast: (opts: { title: string; description?: string | React.ReactNode; variant?: "default" | "destructive" }) => void;
  scrollToAnimalGroupRef: React.RefObject<((animalNo: number) => void) | undefined>;
}

export function useSaveManager({ toast, scrollToAnimalGroupRef }: UseSaveManagerDeps) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveProgress, setSaveProgress] = useState<ChunkProgress | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<KesimAlani | null>(null);
  const pendingSaveTypeRef = useRef<"full" | "donations" | "groups">("full");

  const buildErrorDescription = useCallback((errMsg: string) => {
    const animalNoMatches = errMsg.match(/[Hh]ayvan\s*(?:No|no|#)?\s*[:.]?\s*(\d+(?:\s*[,/]\s*\d+)*)/g);
    if (animalNoMatches) {
      const parts: (string | ReturnType<typeof createElement>)[] = [];
      let lastIndex = 0;
      for (const match of animalNoMatches) {
        const matchIndex = errMsg.indexOf(match, lastIndex);
        if (matchIndex > lastIndex) {
          parts.push(errMsg.substring(lastIndex, matchIndex));
        }
        const numbers = match.match(/\d+/g) || [];
        const prefix = match.replace(/\d+(?:\s*[,/]\s*\d+)*/g, "").trim();
        parts.push(prefix + " ");
        numbers.forEach((num, idx) => {
          if (idx > 0) parts.push(", ");
          const animalNo = parseInt(num, 10);
          parts.push(
            createElement(
              "button",
              {
                key: `animal-${animalNo}-${idx}`,
                className: "underline font-semibold hover:text-red-300 cursor-pointer",
                onClick: () => {
                  scrollToAnimalGroupRef.current?.(animalNo);
                },
              },
              String(animalNo)
            )
          );
        });
        lastIndex = matchIndex + match.length;
      }
      if (lastIndex < errMsg.length) {
        parts.push(errMsg.substring(lastIndex));
      }
      return createElement("span", null, ...parts);
    }
    return errMsg;
  }, [scrollToAnimalGroupRef]);

  const saveToApi = useCallback(
    (data: KesimAlani, saveType: "full" | "donations" | "groups" = "full") => {
      setSaveStatus("saving");
      setSaveProgress(null);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const apiCall =
        saveType === "groups"
          ? apiUpdateBulkAnimalGroups(data.id, data.animalGroups, (progress) => {
              setSaveProgress(progress);
            })
          : apiUpdateKesimAlani(data);
      apiCall
        .then(() => {
          setSaveStatus("saved");
          setSaveProgress(null);
          setLastSavedTime(new Date());
          saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
        })
        .catch((err) => {
          setSaveStatus("error");
          setSaveProgress(null);
          const errMsg = err instanceof Error ? err.message : "Veriler kaydedilemedi";
          toast({
            title: "Kaydetme hatası",
            description: buildErrorDescription(errMsg),
            variant: "destructive",
          });
          saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 5000);
        });
    },
    [toast, buildErrorDescription]
  );

  const debouncedSaveToApi = useCallback(
    (data: KesimAlani, saveType: "full" | "donations" | "groups" = "full") => {
      if (pendingSaveRef.current && pendingSaveTypeRef.current !== saveType) {
        saveType = "full";
      }
      pendingSaveRef.current = data;
      pendingSaveTypeRef.current = saveType;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (pendingSaveRef.current) {
          saveToApi(pendingSaveRef.current, pendingSaveTypeRef.current);
          pendingSaveRef.current = null;
        }
      }, 600);
    },
    [saveToApi]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (pendingSaveRef.current) {
        saveToApi(pendingSaveRef.current, pendingSaveTypeRef.current);
      }
    };
  }, [saveToApi]);

  const discardPendingSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingSaveRef.current = null;
  }, []);

  return {
    saveStatus,
    setSaveStatus,
    saveProgress,
    lastSavedTime,
    setLastSavedTime,
    saveTimeoutRef,
    debounceTimerRef,
    pendingSaveRef,
    pendingSaveTypeRef,
    saveToApi,
    debouncedSaveToApi,
    discardPendingSave,
    buildErrorDescription,
  };
}
