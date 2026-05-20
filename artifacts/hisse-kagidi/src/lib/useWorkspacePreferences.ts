import { useState, useEffect, useCallback } from "react";

export type ColumnKey = "drag" | "index" | "vekalet" | "description" | "name" | "donationType" | "fiyat" | "yerTalebi" | "gunTalebi" | "ilkHayvan" | "safi" | "notes" | "aiTags" | "actions";

export const ALL_GROUP_COLUMNS: { key: ColumnKey; label: string; alwaysVisible?: boolean }[] = [
  { key: "drag", label: "Sürükle" },
  { key: "index", label: "Sıra", alwaysVisible: true },
  { key: "vekalet", label: "Vekalet" },
  { key: "description", label: "Vekaleti Veren" },
  { key: "name", label: "Adına Kesilen" },
  { key: "donationType", label: "Cinsi" },
  { key: "fiyat", label: "Fiyat" },
  { key: "yerTalebi", label: "Yer Tal." },
  { key: "gunTalebi", label: "Gün Tal." },
  { key: "ilkHayvan", label: "İlk H." },
  { key: "safi", label: "Şafi" },
  { key: "notes", label: "Notlar" },
  { key: "aiTags", label: "AI Etiketi / Not" },
  { key: "actions", label: "İşlemler" },
];

export const DEFAULT_COLUMN_ORDER: ColumnKey[] = ["drag", "index", "vekalet", "description", "name", "donationType", "fiyat", "yerTalebi", "gunTalebi", "ilkHayvan", "safi", "notes", "aiTags", "actions"];

export interface WorkspacePreferences {
  columnCount: 1 | 2 | 3;
  hiddenColumns: ColumnKey[];
  compactMode: boolean;
  columnOrder: ColumnKey[];
  splitRatio: number;
}

const STORAGE_KEY = "workspace-preferences";

const DEFAULT_PREFS: WorkspacePreferences = {
  columnCount: 1,
  hiddenColumns: [],
  compactMode: false,
  columnOrder: [...DEFAULT_COLUMN_ORDER],
  splitRatio: 50,
};

function isValidColumnKey(key: string): key is ColumnKey {
  return DEFAULT_COLUMN_ORDER.includes(key as ColumnKey);
}

function sanitizeColumnOrder(order: unknown): ColumnKey[] {
  if (!Array.isArray(order)) return [...DEFAULT_COLUMN_ORDER];
  const valid = order.filter((k): k is ColumnKey => typeof k === "string" && isValidColumnKey(k));
  const unique = [...new Set(valid)];
  if (unique.length === 0) return [...DEFAULT_COLUMN_ORDER];
  const missing = DEFAULT_COLUMN_ORDER.filter(k => !unique.includes(k));
  if (missing.length === 0) return unique;
  const result = [...unique];
  for (const k of missing) {
    const defaultIdx = DEFAULT_COLUMN_ORDER.indexOf(k);
    let insertAt = result.length;
    for (let i = defaultIdx - 1; i >= 0; i--) {
      const prevKey = DEFAULT_COLUMN_ORDER[i];
      const prevIdx = result.indexOf(prevKey);
      if (prevIdx >= 0) { insertAt = prevIdx + 1; break; }
    }
    result.splice(insertAt, 0, k);
  }
  return result;
}

function sanitizeHiddenColumns(cols: unknown): ColumnKey[] {
  if (!Array.isArray(cols)) return [];
  return [...new Set(
    cols.filter((k): k is ColumnKey =>
      typeof k === "string" && isValidColumnKey(k) && !ALL_GROUP_COLUMNS.find(c => c.key === k)?.alwaysVisible
    )
  )];
}

function loadPreferences(): WorkspacePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      columnCount: [1, 2, 3].includes(parsed.columnCount) ? parsed.columnCount : 1,
      hiddenColumns: sanitizeHiddenColumns(parsed.hiddenColumns),
      compactMode: typeof parsed.compactMode === "boolean" ? parsed.compactMode : false,
      columnOrder: sanitizeColumnOrder(parsed.columnOrder),
      splitRatio: typeof parsed.splitRatio === "number" ? Math.max(20, Math.min(80, parsed.splitRatio)) : 50,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePreferences(prefs: WorkspacePreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

export function useWorkspacePreferences() {
  const [prefs, setPrefs] = useState<WorkspacePreferences>(loadPreferences);

  useEffect(() => {
    savePreferences(prefs);
  }, [prefs]);

  const setColumnCount = useCallback((count: 1 | 2 | 3) => {
    setPrefs(p => ({ ...p, columnCount: count }));
  }, []);

  const toggleColumn = useCallback((key: ColumnKey) => {
    const col = ALL_GROUP_COLUMNS.find(c => c.key === key);
    if (col?.alwaysVisible) return;
    setPrefs(p => {
      const hidden = p.hiddenColumns.includes(key)
        ? p.hiddenColumns.filter(k => k !== key)
        : [...p.hiddenColumns, key];
      return { ...p, hiddenColumns: hidden };
    });
  }, []);

  const setCompactMode = useCallback((enabled: boolean) => {
    setPrefs(p => ({ ...p, compactMode: enabled }));
  }, []);

  const setColumnOrder = useCallback((order: ColumnKey[]) => {
    setPrefs(p => ({ ...p, columnOrder: order }));
  }, []);

  const setSplitRatio = useCallback((ratio: number) => {
    setPrefs(p => ({ ...p, splitRatio: Math.max(20, Math.min(80, ratio)) }));
  }, []);

  const visibleColumns = prefs.columnOrder.filter(key => !prefs.hiddenColumns.includes(key));

  return {
    prefs,
    visibleColumns,
    setColumnCount,
    toggleColumn,
    setCompactMode,
    setColumnOrder,
    setSplitRatio,
  };
}
