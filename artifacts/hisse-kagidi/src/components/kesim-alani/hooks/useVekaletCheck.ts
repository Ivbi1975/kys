import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { KesimAlani } from "@/lib/types";
import { checkVekaletConflicts } from "@/lib/api";

export interface VekaletConflict {
  vekalet: string;
  id: string;
  name: string;
  kesimAlaniId: string;
}

export interface VekaletCheckResult {
  conflictsByVekalet: Map<string, VekaletConflict[]>;
  hasConflicts: boolean;
  isChecking: boolean;
  lastCheckedAt: number | null;
  recheckNow: () => void;
}

export function useVekaletCheck(kesim: KesimAlani | null): VekaletCheckResult {
  const [conflicts, setConflicts] = useState<VekaletConflict[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allVekalets = useMemo(() => {
    if (!kesim) return [];
    const vekalets = new Set<string>();
    for (const d of kesim.donations) {
      if (d.vekalet && d.vekalet.trim()) vekalets.add(d.vekalet.trim());
    }
    for (const g of kesim.animalGroups) {
      for (const d of g.donations) {
        if (d.vekalet && d.vekalet.trim()) vekalets.add(d.vekalet.trim());
      }
    }
    return Array.from(vekalets);
  }, [kesim?.donations, kesim?.animalGroups]);

  const doCheck = useCallback(async () => {
    if (!kesim?.projectId || allVekalets.length === 0) {
      setConflicts([]);
      return;
    }
    setIsChecking(true);
    try {
      const result = await checkVekaletConflicts(kesim.projectId, allVekalets);
      const externalConflicts = result.conflicts.filter(c => c.kesimAlaniId !== kesim.id);
      setConflicts(externalConflicts);
      setLastCheckedAt(Date.now());
    } catch {
      // silently fail
    } finally {
      setIsChecking(false);
    }
  }, [kesim?.projectId, kesim?.id, allVekalets]);

  useEffect(() => {
    doCheck();
    checkTimerRef.current = setInterval(doCheck, 120000);
    return () => {
      if (checkTimerRef.current) clearInterval(checkTimerRef.current);
    };
  }, [doCheck]);

  const conflictsByVekalet = useMemo(() => {
    const map = new Map<string, VekaletConflict[]>();
    for (const c of conflicts) {
      const existing = map.get(c.vekalet) || [];
      existing.push(c);
      map.set(c.vekalet, existing);
    }
    return map;
  }, [conflicts]);

  const recheckNow = useCallback(() => {
    doCheck();
  }, [doCheck]);

  return {
    conflictsByVekalet,
    hasConflicts: conflicts.length > 0,
    isChecking,
    lastCheckedAt,
    recheckNow,
  };
}
