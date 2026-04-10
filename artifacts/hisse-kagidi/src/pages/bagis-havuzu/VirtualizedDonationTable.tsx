import { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckSquare, Square, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { PoolDonation } from "@/lib/types";
import { ALL_TABLE_COLUMNS, getStatusLabel, type TableColumnKey } from "./types";

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
  kesimAlani: "kesimAlaniId",
};

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
  kesimAlani: 120,
  durum: 80,
  aiEtiket: 130,
};

const CHECKBOX_WIDTH = 40;

function renderCell(d: PoolDonation, key: TableColumnKey, isMultiLoc: boolean) {
  switch (key) {
    case "vekalet":
      return (
        <>
          {d.isFlagged && (
            <span className="mr-1 text-amber-500" title={d.flagReason || "Sorunlu bağış"}>
              <AlertTriangle className="w-3 h-3 inline" />
            </span>
          )}
          {d.vekalet || "—"}
          {isMultiLoc && (
            <span className="ml-1 text-orange-500" title="Bu vekalet birden fazla listede mevcut">
              <AlertTriangle className="w-3 h-3 inline" />
            </span>
          )}
        </>
      );
    case "name": return <span className="font-medium">{d.name || "—"}</span>;
    case "description": return d.description || "—";
    case "donationType": return d.donationType || "—";
    case "birim": return d.birim || "—";
    case "temsilci": return d.temsilci || "—";
    case "ozellik": return d.ozellik || "—";
    case "fiyat": return d.fiyat || "—";
    case "yerTalebi": return d.yerTalebi || "—";
    case "gunTalebi": return d.gunTalebi || "—";
    case "ilkHayvan": return d.ilkHayvan || "—";
    case "safi": return d.safi || "—";
    case "notes": return <span className="max-w-[150px] truncate block" title={d.notes}>{d.notes || "—"}</span>;
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
    default: return "—";
  }
}

function ColGroup({ cols }: { cols: { key: TableColumnKey; label: string }[] }) {
  return (
    <colgroup>
      <col style={{ width: CHECKBOX_WIDTH }} />
      {cols.map(col => (
        <col key={col.key} style={{ width: COLUMN_WIDTHS[col.key] }} />
      ))}
    </colgroup>
  );
}

function getTableWidth(cols: { key: TableColumnKey }[]) {
  return CHECKBOX_WIDTH + cols.reduce((sum, col) => sum + COLUMN_WIDTHS[col.key], 0);
}

export function VirtualizedDonationTable({
  items, isLoading, activeFilterCount, selectedIds, toggleSelect, toggleSelectAll, multiLocationVekalets, visibleColumns,
  sortBy, sortDir, onColumnSort,
}: VirtualizedDonationTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const cols = ALL_TABLE_COLUMNS.filter(c => visibleColumns.has(c.key));
  const tableWidth = getTableWidth(cols);

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

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-auto" ref={parentRef} style={{ maxHeight: "calc(100vh - 380px)" }}>
        <div style={{ minWidth: tableWidth }}>
          <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: tableWidth }}>
            <ColGroup cols={cols} />
            <thead className="bg-background sticky top-0 z-10 shadow-sm">
              <tr className="border-b">
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
              </tr>
            </thead>
          </table>

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
                        <tr className={`border-b hover:bg-muted/30 transition-colors ${d.isFlagged ? "bg-amber-50/50 dark:bg-amber-950/20" : isSelected ? "bg-primary/5" : virtualRow.index % 2 === 1 ? "bg-muted/10" : ""}`}>
                          <td className="p-2 text-center">
                            <button onClick={() => toggleSelect(d.id)} className="text-muted-foreground hover:text-foreground">
                              {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                            </button>
                          </td>
                          {cols.map(col => (
                            <td key={col.key} className={`p-2 text-xs overflow-hidden text-ellipsis whitespace-nowrap ${col.key === "vekalet" ? "font-mono" : ""}`}>
                              {renderCell(d, col.key, isMultiLoc)}
                            </td>
                          ))}
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
