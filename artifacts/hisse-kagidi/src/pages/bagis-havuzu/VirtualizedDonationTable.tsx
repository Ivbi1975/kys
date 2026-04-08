import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckSquare, Square } from "lucide-react";
import type { PoolDonation } from "@/lib/types";
import { ALL_TABLE_COLUMNS, getStatusLabel, type TableColumnKey } from "./types";

interface VirtualizedDonationTableProps {
  items: PoolDonation[];
  isLoading: boolean;
  activeFilterCount: number;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  multiLocationVekalets: Set<string>;
  visibleColumns: Set<TableColumnKey>;
}

const ROW_HEIGHT = 36;

function renderCell(d: PoolDonation, key: TableColumnKey, isMultiLoc: boolean) {
  switch (key) {
    case "vekalet":
      return (
        <>
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
    case "shareCount": return <span className="font-mono">{d.shareCount}</span>;
    case "birim": return d.birim || "—";
    case "temsilci": return d.temsilci || "—";
    case "notes": return <span className="max-w-[150px] truncate block" title={d.notes}>{d.notes || "—"}</span>;
    case "phone": return d.phone || "—";
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

export function VirtualizedDonationTable({
  items, isLoading, activeFilterCount, selectedIds, toggleSelect, toggleSelectAll, multiLocationVekalets, visibleColumns,
}: VirtualizedDonationTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const cols = ALL_TABLE_COLUMNS.filter(c => visibleColumns.has(c.key));

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr className="border-b">
              <th className="p-2 w-10 text-center">
                <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground">
                  {selectedIds.size === items.length && items.length > 0
                    ? <CheckSquare className="w-4 h-4" />
                    : <Square className="w-4 h-4" />}
                </button>
              </th>
              {cols.map(col => (
                <th key={col.key} className={`p-2 text-xs font-medium text-muted-foreground ${col.key === "shareCount" ? "text-center" : "text-left"}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {items.length === 0 && !isLoading && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {activeFilterCount > 0 ? "Filtreye uygun bağış bulunamadı." : "Bu projede henüz bağış yok."}
          </div>
        )}
        {items.length > 0 && (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
            <table className="w-full text-sm" style={{ position: "absolute", top: 0, left: 0, width: "100%" }}>
              <tbody>
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                  const d = items[virtualRow.index];
                  const isSelected = selectedIds.has(d.id);
                  const isMultiLoc = multiLocationVekalets.has((d.vekalet || "").trim());
                  return (
                    <tr
                      key={d.id}
                      style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)`, position: "absolute", top: 0, left: 0, width: "100%", display: "table-row" }}
                      className={`border-b hover:bg-muted/30 transition-colors ${isSelected ? "bg-primary/5" : virtualRow.index % 2 === 1 ? "bg-muted/10" : ""}`}
                    >
                      <td className="p-2 text-center w-10">
                        <button onClick={() => toggleSelect(d.id)} className="text-muted-foreground hover:text-foreground">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      {cols.map(col => (
                        <td key={col.key} className={`p-2 text-xs ${col.key === "shareCount" ? "text-center" : ""} ${col.key === "vekalet" ? "font-mono" : ""}`}>
                          {renderCell(d, col.key, isMultiLoc)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
