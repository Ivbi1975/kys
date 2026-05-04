import { useRef, useCallback, useState, useMemo, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, CheckSquare, Square, ArrowUp, ArrowDown, ArrowUpDown, Flag, FlagOff, Loader2 } from "lucide-react";
import type { PoolDonation } from "@/lib/types";
import { ALL_TABLE_COLUMNS, getStatusLabel, type TableColumnKey } from "./types";
import { turkishTitleCase } from "@/lib/formatting";
import { fetchDonationSiblings } from "@/lib/api";
import type { DonorSiblings } from "@/lib/api/bagis-havuzu";

const SORT_KEY_MAP: Partial<Record<TableColumnKey, string>> = {
  vekalet: "vekalet",
  name: "name",
  description: "description",
  donationType: "donationType",
  birim: "birim",
  temsilci: "temsilci",
  ozellik: "ozellik",
  fiyat: "fiyat",
  yerTalebi: "yerTalebi",
  gunTalebi: "gunTalebi",
  ilkHayvan: "ilkHayvan",
  safi: "safi",
  notes: "notes",
  phone: "phone",
  shareCount: "shareCount",
  kesimAlani: "kesimAlaniId",
};

const EDITABLE_COLUMNS: Set<TableColumnKey> = new Set([]);

interface VirtualizedDonationTableProps {
  items: PoolDonation[];
  isLoading: boolean;
  activeFilterCount: number;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  multiLocationVekalets: Set<string>;
  visibleColumns: Set<TableColumnKey>;
  sortBy: string;
  sortDir: "asc" | "desc";
  onColumnSort: (colKey: string) => void;
  onFlagDonation?: (id: string, reason: string) => void;
  onUnflagDonation?: (id: string) => void;
  onInlineEdit?: (donationId: string, field: string, value: string) => void;
  donorMissedCounts?: Record<string, number>;
  kesimAlaniColorMap?: Record<string, string>;
  assignedVekalets?: Set<string>;
  projectId?: string;
}

const ROW_HEIGHT = 36;

const COLUMN_WIDTHS: Record<TableColumnKey, number> = {
  vekalet: 110,
  name: 150,
  description: 150,
  donationType: 90,
  birim: 100,
  temsilci: 110,
  ozellik: 120,
  fiyat: 90,
  yerTalebi: 110,
  gunTalebi: 110,
  ilkHayvan: 100,
  safi: 80,
  notes: 150,
  phone: 110,
  shareCount: 70,
  kesimAlani: 120,
  durum: 80,
  aiEtiket: 130,
};

const CHECKBOX_WIDTH = 40;
const FLAG_ACTION_WIDTH = 32;

function getFieldValue(d: PoolDonation, key: TableColumnKey): string {
  switch (key) {
    case "vekalet": return d.vekalet || "";
    case "name": return d.name || "";
    case "description": return d.description || "";
    case "donationType": return d.donationType || "";
    case "birim": return d.birim || "";
    case "temsilci": return d.temsilci || "";
    case "ozellik": return d.ozellik || "";
    case "fiyat": return d.fiyat || "";
    case "yerTalebi": return d.yerTalebi || "";
    case "gunTalebi": return d.gunTalebi || "";
    case "ilkHayvan": return d.ilkHayvan || "";
    case "safi": return d.safi || "";
    case "notes": return d.notes || "";
    case "phone": return d.phone || "";
    case "shareCount": return String(d.shareCount ?? 1);
    default: return "";
  }
}

function SiblingsBadge({ donationId, donorName, missedCount, projectId }: {
  donationId: string;
  donorName: string;
  missedCount: number;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [siblings, setSiblings] = useState<DonorSiblings[]>([]);
  const fetchedRef = useRef(false);

  const handleOpen = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
    if (fetchedRef.current) return;
    setLoading(true);
    try {
      const result = await fetchDonationSiblings(projectId, [donationId]);
      setSiblings(result.siblings);
      fetchedRef.current = true;
    } catch {
      setSiblings([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, donationId]);

  const allDonations = siblings.flatMap(s => s.donations);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="ml-1 inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-semibold px-1.5 py-0 leading-tight border border-blue-200 dark:border-blue-700 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/70 transition-colors"
          title={`Bu bağışçının ${missedCount} ek bağışını görmek için tıklayın`}
          onClick={handleOpen}
        >
          +{missedCount}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2 border-b bg-muted/30">
          <p className="text-xs font-semibold text-foreground">{donorName}</p>
          <p className="text-[10px] text-muted-foreground">Bu filtreye girmeyen {missedCount} ek bağış</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-4 gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Yükleniyor...
          </div>
        ) : allDonations.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Bağış bulunamadı</p>
        ) : (
          <div className="max-h-56 overflow-y-auto">
            {allDonations.map((d, idx) => (
              <div key={d.id} className={`px-3 py-2 text-xs ${idx < allDonations.length - 1 ? "border-b" : ""}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground/60 flex-shrink-0">{d.vekalet || "—"}</span>
                  {d.donationType && (
                    <span className="px-1 py-0 rounded bg-muted text-[10px]">{d.donationType}</span>
                  )}
                  {d.shareCount > 1 && (
                    <span className="text-[10px] text-muted-foreground ml-auto">{d.shareCount} hisse</span>
                  )}
                </div>
                {d.name && d.name !== donorName && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{d.name}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function renderReadOnlyCell(d: PoolDonation, key: TableColumnKey, isMultiLoc: boolean, missedCount?: number, projectId?: string) {
  switch (key) {
    case "vekalet":
      return (
        <>
          {d.isFlagged && (
            <span className="mr-1 text-amber-500" title={d.flagReason || "Sorunlu bağış"}>
              <AlertTriangle className="w-3 h-3 inline" />
            </span>
          )}
          <span>{turkishTitleCase(d.vekalet) || "—"}</span>
          {isMultiLoc && (
            <span className="ml-1 text-orange-500" title="Bu vekalet birden fazla listede mevcut">
              <AlertTriangle className="w-3 h-3 inline" />
            </span>
          )}
          {missedCount && missedCount > 0 && projectId && d.name ? (
            <SiblingsBadge
              donationId={d.id}
              donorName={d.name}
              missedCount={missedCount}
              projectId={projectId}
            />
          ) : missedCount && missedCount > 0 ? (
            <span
              className="ml-1 inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-semibold px-1.5 py-0 leading-tight border border-blue-200 dark:border-blue-700 cursor-default"
              title={`Bu bağışçının ${missedCount} adet daha bağışı bu filtreye girmedi`}
            >
              +{missedCount}
            </span>
          ) : null}
        </>
      );
    case "name": return <span className="font-medium">{turkishTitleCase(d.name) || "—"}</span>;
    case "description": return <span>{turkishTitleCase(d.description) || "—"}</span>;
    case "donationType": return <span>{turkishTitleCase(d.donationType) || "—"}</span>;
    case "notes": return <span className="max-w-[150px] truncate block" title={d.notes}>{d.notes || "—"}</span>;
    case "phone": return <span>{d.phone || "—"}</span>;
    case "shareCount": return <span className="font-bold">{d.shareCount ?? 1}</span>;
    case "kesimAlani": return <Badge variant="outline" className="text-xs">{d.kesimAlaniName}</Badge>;
    case "durum": {
      const { label, color } = getStatusLabel(d);
      return <span className={`font-medium ${color}`}>{label}</span>;
    }
    case "aiEtiket":
      return (
        <>
          {d.aiCategories && d.aiCategories.length > 0
            ? d.aiCategories.map((c: string) => (
              <Badge key={c} variant="secondary" className="text-xs mr-0.5 mb-0.5">{c}</Badge>
            ))
            : "—"}
          {d.aiWarnings && (
            <span className="text-orange-500 text-xs ml-1" title={d.aiWarnings}>
              <AlertTriangle className="w-3 h-3 inline" />
            </span>
          )}
        </>
      );
    default: return <span>{turkishTitleCase(getFieldValue(d, key)) || "—"}</span>;
  }
}

function renderDisplayValue(d: PoolDonation, key: TableColumnKey, isMultiLoc: boolean, missedCount?: number, projectId?: string) {
  switch (key) {
    case "vekalet":
      return (
        <>
          {d.isFlagged && (
            <span className="mr-1 text-amber-500" title={d.flagReason || "Sorunlu bağış"}>
              <AlertTriangle className="w-3 h-3 inline" />
            </span>
          )}
          {turkishTitleCase(d.vekalet) || "—"}
          {isMultiLoc && (
            <span className="ml-1 text-orange-500" title="Bu vekalet birden fazla listede mevcut">
              <AlertTriangle className="w-3 h-3 inline" />
            </span>
          )}
          {missedCount && missedCount > 0 && projectId && d.name ? (
            <SiblingsBadge
              donationId={d.id}
              donorName={d.name}
              missedCount={missedCount}
              projectId={projectId}
            />
          ) : missedCount && missedCount > 0 ? (
            <span
              className="ml-1 inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-semibold px-1.5 py-0 leading-tight border border-blue-200 dark:border-blue-700 cursor-default"
              title={`Bu bağışçının ${missedCount} adet daha bağışı bu filtreye girmedi`}
            >
              +{missedCount}
            </span>
          ) : null}
        </>
      );
    case "name": return <span className="font-medium">{turkishTitleCase(d.name) || "—"}</span>;
    case "notes": return <span className="max-w-[150px] truncate block" title={d.notes}>{d.notes || "—"}</span>;
    case "phone": return d.phone || "—";
    case "shareCount": return <span className="font-bold">{d.shareCount ?? 1}</span>;
    default: return turkishTitleCase(getFieldValue(d, key)) || "—";
  }
}

function ColGroup({ cols }: { cols: { key: TableColumnKey; label: string }[] }) {
  return (
    <colgroup>
      <col style={{ width: CHECKBOX_WIDTH }} />
      {cols.map(col => (
        <col key={col.key} style={{ width: COLUMN_WIDTHS[col.key] }} />
      ))}
      <col style={{ width: FLAG_ACTION_WIDTH }} />
    </colgroup>
  );
}

function getTableWidth(cols: { key: TableColumnKey }[]) {
  return CHECKBOX_WIDTH + cols.reduce((sum, col) => sum + COLUMN_WIDTHS[col.key], 0) + FLAG_ACTION_WIDTH;
}

function FlagAction({ d, onFlag, onUnflag }: { d: PoolDonation; onFlag?: (id: string, reason: string) => void; onUnflag?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (d.isFlagged && onUnflag) {
    return (
      <Button
        variant="ghost" size="sm" className="h-6 w-6 p-0 text-amber-600 hover:text-amber-800"
        title="İşareti kaldır"
        onClick={(e) => { e.stopPropagation(); onUnflag(d.id); }}
      >
        <FlagOff className="w-3.5 h-3.5" />
      </Button>
    );
  }
  if (!onFlag) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-amber-600" title="Sorunlu işaretle">
          <Flag className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium mb-1">Sorun açıklaması</p>
        <Input
          value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Neden sorunlu?" className="h-7 text-xs mb-1"
          onKeyDown={(e) => { if (e.key === "Enter" && reason.trim()) { onFlag(d.id, reason.trim()); setOpen(false); setReason(""); } }}
        />
        <Button size="sm" className="w-full h-6 text-xs"
          disabled={!reason.trim()}
          onClick={() => { onFlag(d.id, reason.trim()); setOpen(false); setReason(""); }}
        >
          İşaretle
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function InlineEditInput({
  initialValue,
  onCommit,
  onCancel,
  onTab,
}: {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  onTab: (shiftKey: boolean) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const committedRef = useRef(false);

  const commit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    if (value !== initialValue) {
      onCommit(value);
    } else {
      onCancel();
    }
  }, [value, initialValue, onCommit, onCancel]);

  return (
    <Input
      className="h-7 text-xs ring-2 ring-primary/40 bg-primary/5 w-full"
      value={value}
      onChange={(e) => { committedRef.current = false; setValue(e.target.value); }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          committedRef.current = true;
          onCancel();
        } else if (e.key === "Tab") {
          e.preventDefault();
          commit();
          onTab(e.shiftKey);
        }
      }}
      autoFocus
    />
  );
}

export function VirtualizedDonationTable({
  items, isLoading, activeFilterCount, selectedIds, toggleSelect, toggleSelectAll, multiLocationVekalets, visibleColumns,
  sortBy, sortDir, onColumnSort, onFlagDonation, onUnflagDonation, onInlineEdit, donorMissedCounts, kesimAlaniColorMap,
  assignedVekalets, projectId,
}: VirtualizedDonationTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const headerInnerRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<TableColumnKey | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const cols = useMemo(() => ALL_TABLE_COLUMNS.filter(c => visibleColumns.has(c.key)), [visibleColumns]);
  const editableCols = useMemo(() => cols.filter(c => EDITABLE_COLUMNS.has(c.key)), [cols]);
  const tableWidth = useMemo(() => getTableWidth(cols), [cols]);

  const handleBodyScroll = useCallback(() => {
    if (headerInnerRef.current && parentRef.current) {
      headerInnerRef.current.style.transform = `translateX(-${parentRef.current.scrollLeft}px)`;
    }
  }, []);

  useEffect(() => {
    if (headerInnerRef.current && parentRef.current) {
      headerInnerRef.current.style.transform = `translateX(-${parentRef.current.scrollLeft}px)`;
    }
  }, []);

  const handleHeaderClick = useCallback((colKey: TableColumnKey) => {
    const sortKey = SORT_KEY_MAP[colKey];
    if (sortKey) {
      onColumnSort(sortKey);
    }
  }, [onColumnSort]);

  const getSortIcon = useCallback((colKey: TableColumnKey) => {
    const sortKey = SORT_KEY_MAP[colKey];
    if (!sortKey) return null;
    if (sortBy === sortKey) {
      return sortDir === "asc"
        ? <ArrowUp className="w-3 h-3 text-primary" />
        : <ArrowDown className="w-3 h-3 text-primary" />;
    }
    return <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />;
  }, [sortBy, sortDir]);

  const startEditing = useCallback((id: string, field: TableColumnKey) => {
    if (!onInlineEdit || !EDITABLE_COLUMNS.has(field)) return;
    setEditingId(id);
    setEditingField(field);
  }, [onInlineEdit]);

  const clearEditing = useCallback(() => {
    setEditingId(null);
    setEditingField(null);
  }, []);

  const handleCommit = useCallback((donationId: string, field: TableColumnKey, value: string) => {
    onInlineEdit?.(donationId, field, value);
    clearEditing();
  }, [onInlineEdit, clearEditing]);

  const handleTab = useCallback((donationId: string, currentField: TableColumnKey, shiftKey: boolean) => {
    const currentIdx = editableCols.findIndex(c => c.key === currentField);
    if (currentIdx < 0) { clearEditing(); return; }

    const rowIdx = items.findIndex(d => d.id === donationId);
    if (rowIdx < 0) { clearEditing(); return; }

    if (!shiftKey) {
      if (currentIdx < editableCols.length - 1) {
        setEditingField(editableCols[currentIdx + 1].key);
      } else if (rowIdx < items.length - 1) {
        setEditingId(items[rowIdx + 1].id);
        setEditingField(editableCols[0].key);
      } else {
        clearEditing();
      }
    } else {
      if (currentIdx > 0) {
        setEditingField(editableCols[currentIdx - 1].key);
      } else if (rowIdx > 0) {
        setEditingId(items[rowIdx - 1].id);
        setEditingField(editableCols[editableCols.length - 1].key);
      } else {
        clearEditing();
      }
    }
  }, [editableCols, items, clearEditing]);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Fixed header */}
      <div className="overflow-hidden bg-background border-b shadow-sm relative z-10">
        <div ref={headerInnerRef} style={{ minWidth: tableWidth }}>
          <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: tableWidth }}>
            <ColGroup cols={cols} />
            <thead>
              <tr>
                <th className="p-2 text-center">
                  <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground">
                    {selectedIds.size === items.length && items.length > 0
                      ? <CheckSquare className="w-4 h-4" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                {cols.map(col => {
                  const sortable = !!SORT_KEY_MAP[col.key];
                  return (
                    <th
                      key={col.key}
                      className={`p-2 text-xs font-medium text-muted-foreground text-left ${sortable ? "cursor-pointer hover:text-foreground hover:bg-muted/80 select-none" : ""}`}
                      onClick={sortable ? () => handleHeaderClick(col.key) : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {getSortIcon(col.key)}
                      </span>
                    </th>
                  );
                })}
                <th style={{ width: FLAG_ACTION_WIDTH }} />
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* Scrollable body */}
      <div
        className="overflow-auto"
        ref={parentRef}
        style={{ maxHeight: "calc(100vh - 180px)" }}
        onScroll={handleBodyScroll}
      >
        <div style={{ minWidth: tableWidth }}>
          {items.length === 0 && !isLoading && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {activeFilterCount > 0 ? "Filtreye uygun bağış bulunamadı." : "Bu projede henüz bağış yok."}
            </div>
          )}

          {items.length > 0 && (
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const d = items[virtualRow.index];
                const isSelected = selectedIds.has(d.id);
                const isMultiLoc = multiLocationVekalets.has((d.vekalet || "").trim());
                const isRowEditing = editingId === d.id;
                const isAssigned = !!d.vekalet && !!assignedVekalets?.has(d.vekalet.trim());
                const missedCount = (activeFilterCount > 0 && d.name && donorMissedCounts)
                  ? (donorMissedCounts[d.name] ?? 0)
                  : 0;
                return (
                  <div
                    key={d.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: ROW_HEIGHT,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: tableWidth }}>
                      <ColGroup cols={cols} />
                      <tbody>
                        <tr
                          className={`border-b hover:bg-muted/30 transition-colors ${d.isFlagged ? "bg-amber-50/50 dark:bg-amber-950/20" : isAssigned ? "bg-green-300/80 dark:bg-green-600/50" : isSelected ? "bg-primary/5" : ""}`}
                          style={!d.isFlagged && !isAssigned && !isSelected && kesimAlaniColorMap?.[d.kesimAlaniId] ? { backgroundColor: kesimAlaniColorMap[d.kesimAlaniId] } : undefined}
                        >
                          <td className="p-2 text-center">
                            <button onClick={() => toggleSelect(d.id)} className="text-muted-foreground hover:text-foreground">
                              {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                            </button>
                          </td>
                          {cols.map(col => {
                            const isEditable = EDITABLE_COLUMNS.has(col.key) && !!onInlineEdit;
                            const isCellEditing = isRowEditing && editingField === col.key;

                            if (isCellEditing) {
                              return (
                                <td key={col.key} className="p-1">
                                  <InlineEditInput
                                    initialValue={getFieldValue(d, col.key)}
                                    onCommit={(val) => handleCommit(d.id, col.key, val)}
                                    onCancel={clearEditing}
                                    onTab={(shift) => handleTab(d.id, col.key, shift)}
                                  />
                                </td>
                              );
                            }

                            if (isEditable) {
                              return (
                                <td
                                  key={col.key}
                                  className={`p-2 text-xs overflow-hidden text-ellipsis whitespace-nowrap cursor-text hover:bg-muted/50 ${col.key === "vekalet" ? "font-mono" : ""}`}
                                  onClick={() => startEditing(d.id, col.key)}
                                >
                                  {renderDisplayValue(d, col.key, isMultiLoc, col.key === "vekalet" ? missedCount : undefined, projectId)}
                                </td>
                              );
                            }

                            return (
                              <td key={col.key} className={`p-2 text-xs overflow-hidden text-ellipsis whitespace-nowrap ${col.key === "vekalet" ? "font-mono" : ""}`}>
                                {renderReadOnlyCell(d, col.key, isMultiLoc, col.key === "vekalet" ? missedCount : undefined, projectId)}
                              </td>
                            );
                          })}
                          <td className="p-1 text-center" style={{ width: 32 }}>
                            <FlagAction d={d} onFlag={onFlagDonation} onUnflag={onUnflagDonation} />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
