import { memo, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LocalInput } from "@/components/LocalInput";
import type { Donation, AnimalGroup, KesimAlani, ColorTag, Team } from "@/lib/types";
import type { ColumnKey } from "@/lib/useWorkspacePreferences";
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  Lock,
  Unlock,
  Trash2,
  Scissors,
  ArrowLeftRight,
  ShoppingBag,
  CheckSquare,
  Square,
  Camera,
} from "lucide-react";

interface AnimalGroupCardProps {
  group: AnimalGroup;
  groupIdx: number;
  kesimName: string;
  kesimId: string;
  isCollapsed: boolean;
  isSelected: boolean;
  compact: boolean;
  visibleColumns: ColumnKey[];
  totalGroupCount: number;
  photoCounts: Record<string, number>;
  teams: Team[];
  basketItemIds: Set<string>;
  selectedGroupDonations: Set<string>;
  swapSelection: { groupIdx: number; donationIdx: number } | null;
  highlightIncomplete: boolean;
  dragItem: { groupIdx: number; donationIdx: number } | null;
  dragOverGroup: number | null;
  dragOverItem: { groupIdx: number; donationIdx: number } | null;
  groupSearchQuery: string;

  onToggleCollapse: (groupId: string) => void;
  onToggleSelect: (groupId: string) => void;
  onSetColorTag: (groupIdx: number, tag: ColorTag) => void;
  onMoveUp: (groupIdx: number) => void;
  onMoveDown: (groupIdx: number) => void;
  onSplit: (groupIdx: number) => void;
  onAddGroupToBasket: (groupIdx: number) => void;
  onToggleLock: (groupIdx: number) => void;
  onDelete: (groupIdx: number) => void;
  onAssignTeam: (groupId: string, teamId: string | null) => void;
  onViewPhotos: (groupId: string, animalNo: number) => void;
  onUpdateGroupDonation: (groupIdx: number, donationIdx: number, field: keyof Donation, value: string | number) => void;
  onHandleGroupCellTab: (e: React.KeyboardEvent<HTMLInputElement>, groupIdx: number, dIdx: number, colKey: ColumnKey) => void;
  onToggleBasketItem: (groupIdx: number, dIdx: number, donationId: string, isInBasket: boolean) => void;
  onSwapSelect: (groupIdx: number, donationIdx: number) => void;
  onRemoveFromGroup: (groupIdx: number, donationIdx: number) => void;
  onUpdateGroupNotes: (groupIdx: number, notes: string) => void;
  onDragStart: (groupIdx: number, donationIdx: number, e?: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, groupIdx: number, donationIdx: number) => void;
  onDrop: (groupIdx: number, donationIdx: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOverCard: (e: React.DragEvent, groupIdx: number) => void;
  onDragLeaveCard: (e: React.DragEvent, groupIdx: number) => void;
  onToggleGroupDonationSelect: (donationId: string) => void;
  onSelectAllGroupDonations: (donations: Donation[], allSelected: boolean) => void;

  columnHeaderLabel: (key: ColumnKey) => string;
  columnHeaderWidth: (key: ColumnKey) => string;
}

const colorMap: Record<string, string> = {
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
};

const GroupDonationRow = memo(function GroupDonationRow({
  donation,
  dIdx,
  groupIdx,
  compact,
  visibleColumns,
  basketItemIds,
  selectedGroupDonations,
  swapSelection,
  dragItem,
  dragOverItem,
  isSearchMatch,
  isGroupLocked,
  onUpdateField,
  onHandleGroupCellTab,
  onToggleBasketItem,
  onSwapSelect,
  onRemoveFromGroup,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleSelect,
}: {
  donation: Donation;
  dIdx: number;
  groupIdx: number;
  compact: boolean;
  visibleColumns: ColumnKey[];
  basketItemIds: Set<string>;
  selectedGroupDonations: Set<string>;
  swapSelection: { groupIdx: number; donationIdx: number } | null;
  dragItem: { groupIdx: number; donationIdx: number } | null;
  dragOverItem: { groupIdx: number; donationIdx: number } | null;
  isSearchMatch: boolean;
  isGroupLocked: boolean;
  onUpdateField: (groupIdx: number, donationIdx: number, field: keyof Donation, value: string | number) => void;
  onHandleGroupCellTab: (e: React.KeyboardEvent<HTMLInputElement>, groupIdx: number, dIdx: number, colKey: ColumnKey) => void;
  onToggleBasketItem: (groupIdx: number, dIdx: number, donationId: string, isInBasket: boolean) => void;
  onSwapSelect: (groupIdx: number, donationIdx: number) => void;
  onRemoveFromGroup: (groupIdx: number, donationIdx: number) => void;
  onDragStart: (groupIdx: number, donationIdx: number, e?: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, groupIdx: number, donationIdx: number) => void;
  onDrop: (groupIdx: number, donationIdx: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onToggleSelect: (donationId: string) => void;
}) {
  const d = donation;
  const cellPad = compact ? "p-0.5" : "p-1.5";
  const inputH = compact ? "h-5 text-[10px]" : "h-6 text-xs";
  const inputClass = `${inputH} border-0 bg-transparent p-0 focus:bg-primary/5 focus:ring-1 focus:ring-primary/30 rounded transition-colors`;

  const isDragSource = dragItem?.groupIdx === groupIdx && dragItem?.donationIdx === dIdx;
  const isDragTarget = dragOverItem?.groupIdx === groupIdx && dragOverItem?.donationIdx === dIdx;

  const handleCommit = useCallback((field: keyof Donation, value: string) => {
    onUpdateField(groupIdx, dIdx, field, value);
  }, [groupIdx, dIdx, onUpdateField]);

  const handleKeyDown = useCallback((colKey: ColumnKey) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    onHandleGroupCellTab(e, groupIdx, dIdx, colKey);
  }, [groupIdx, dIdx, onHandleGroupCellTab]);

  const renderCell = (colKey: ColumnKey) => {
    switch (colKey) {
      case "drag":
        return (
          <td key={colKey} className={`${cellPad} cursor-grab`}>
            <GripVertical className={compact ? "w-2.5 h-2.5 text-muted-foreground" : "w-3 h-3 text-muted-foreground"} />
          </td>
        );
      case "index":
        return (
          <td key={colKey} className={`${cellPad} text-muted-foreground`}>
            {dIdx + 1}
          </td>
        );
      case "vekalet":
        return (
          <td key={colKey} className={cellPad} data-group-cell={`${groupIdx}-${dIdx}-vekalet`}>
            <LocalInput
              className={inputClass}
              value={d.vekalet || ""}
              onCommit={(v) => handleCommit("vekalet", v)}
              onKeyDown={handleKeyDown("vekalet")}
              placeholder="—"
              aria-label={`Satır ${dIdx + 1} Vekalet`}
            />
          </td>
        );
      case "description":
        return (
          <td key={colKey} className={cellPad} data-group-cell={`${groupIdx}-${dIdx}-description`}>
            <LocalInput
              className={inputClass}
              value={d.description}
              onCommit={(v) => handleCommit("description", v)}
              onKeyDown={handleKeyDown("description")}
              placeholder="—"
              aria-label={`Satır ${dIdx + 1} Açıklama`}
            />
          </td>
        );
      case "name":
        return (
          <td key={colKey} className={cellPad} data-group-cell={`${groupIdx}-${dIdx}-name`}>
            <LocalInput
              className={inputClass}
              value={d.name}
              onCommit={(v) => handleCommit("name", v)}
              onKeyDown={handleKeyDown("name")}
              placeholder="—"
              aria-label={`Satır ${dIdx + 1} Ad Soyad`}
            />
          </td>
        );
      case "donationType":
        return (
          <td key={colKey} className={cellPad} data-group-cell={`${groupIdx}-${dIdx}-donationType`}>
            <LocalInput
              className={inputClass}
              value={d.donationType}
              onCommit={(v) => handleCommit("donationType", v)}
              onKeyDown={handleKeyDown("donationType")}
              placeholder="—"
              aria-label={`Satır ${dIdx + 1} Bağış Türü`}
            />
          </td>
        );
      case "notes":
        return (
          <td key={colKey} className={cellPad} data-group-cell={`${groupIdx}-${dIdx}-notes`}>
            <div className="flex flex-col gap-0.5">
              <LocalInput
                className={inputClass}
                value={d.notes || ""}
                onCommit={(v) => handleCommit("notes", v)}
                onKeyDown={handleKeyDown("notes")}
                placeholder="—"
                aria-label={`Satır ${dIdx + 1} Notlar`}
              />
              {((d.aiCategories && d.aiCategories.length > 0) || (d.aiWarnings && d.aiWarnings.trim())) && (
                <div className="flex gap-0.5 flex-wrap">
                  {(d.aiCategories || []).map(cat => (
                    <span key={cat} className="px-1 py-0 rounded-full text-[8px] font-medium bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400 border border-violet-200/50 dark:border-violet-800/50 opacity-70">
                      {cat}
                    </span>
                  ))}
                  {d.aiWarnings && d.aiWarnings.trim() && (
                    <span className="px-1 py-0 rounded-full text-[8px] font-medium bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-800/50 opacity-70 flex items-center gap-0.5" title={d.aiWarnings}>
                      ⚠
                    </span>
                  )}
                </div>
              )}
            </div>
          </td>
        );
      case "actions":
        return (
          <td key={colKey} className={cellPad}>
            <div className="flex gap-0.5">
              {d.name.trim() && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${compact ? "h-4 w-4" : "h-5 w-5"} p-0 ${
                      basketItemIds.has(d.id) ? "bg-emerald-200 dark:bg-emerald-800" : ""
                    }`}
                    onClick={() => onToggleBasketItem(groupIdx, dIdx, d.id, basketItemIds.has(d.id))}
                    title={basketItemIds.has(d.id) ? "Sepetten Çıkar" : "Keseye Koy"}
                    aria-label={basketItemIds.has(d.id) ? "Sepetten Çıkar" : "Keseye Koy"}
                  >
                    <ShoppingBag className={compact ? "w-2.5 h-2.5 text-emerald-600" : "w-3 h-3 text-emerald-600"} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${compact ? "h-4 w-4" : "h-5 w-5"} p-0 ${
                      swapSelection?.groupIdx === groupIdx && swapSelection?.donationIdx === dIdx
                        ? "bg-purple-200 dark:bg-purple-800"
                        : ""
                    }`}
                    onClick={() => onSwapSelect(groupIdx, dIdx)}
                    title="Takas için seç"
                    aria-label="Takas için seç"
                  >
                    <ArrowLeftRight className={compact ? "w-2.5 h-2.5 text-purple-500" : "w-3 h-3 text-purple-500"} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${compact ? "h-4 w-4" : "h-5 w-5"} p-0`}
                    onClick={() => onRemoveFromGroup(groupIdx, dIdx)}
                    aria-label="Gruptan çıkar"
                  >
                    <Trash2 className={compact ? "w-2.5 h-2.5 text-destructive" : "w-3 h-3 text-destructive"} />
                  </Button>
                </>
              )}
            </div>
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <tr
      className={`border-b transition-all duration-150 ${
        isDragTarget
          ? "bg-primary/20 shadow-inner"
          : isSearchMatch
          ? "bg-yellow-100 dark:bg-yellow-900/40"
          : selectedGroupDonations.has(d.id)
          ? "bg-blue-50 dark:bg-blue-950/40"
          : "hover:bg-muted/20"
      } ${isDragSource ? "opacity-50 scale-95" : ""}`}
      draggable
      onDragStart={(e) => onDragStart(groupIdx, dIdx, e)}
      onDragOver={(e) => onDragOver(e, groupIdx, dIdx)}
      onDrop={() => onDrop(groupIdx, dIdx)}
      onDragEnd={onDragEnd}
    >
      <td className={compact ? "p-0.5" : "p-1.5"}>
        {d.name.trim() && (
          <input
            type="checkbox"
            className="rounded"
            checked={selectedGroupDonations.has(d.id)}
            onChange={() => onToggleSelect(d.id)}
            aria-label={`${d.name} seç`}
          />
        )}
      </td>
      {visibleColumns.map(key => renderCell(key))}
    </tr>
  );
}, (prev, next) => {
  if (prev.donation !== next.donation) return false;
  if (prev.dIdx !== next.dIdx) return false;
  if (prev.groupIdx !== next.groupIdx) return false;
  if (prev.compact !== next.compact) return false;
  if (prev.visibleColumns !== next.visibleColumns) return false;
  if (prev.isSearchMatch !== next.isSearchMatch) return false;
  if (prev.isGroupLocked !== next.isGroupLocked) return false;
  const dId = prev.donation.id;
  if (prev.basketItemIds.has(dId) !== next.basketItemIds.has(dId)) return false;
  if (prev.selectedGroupDonations.has(dId) !== next.selectedGroupDonations.has(dId)) return false;
  const prevSwap = prev.swapSelection;
  const nextSwap = next.swapSelection;
  const prevIsSwapped = prevSwap?.groupIdx === prev.groupIdx && prevSwap?.donationIdx === prev.dIdx;
  const nextIsSwapped = nextSwap?.groupIdx === next.groupIdx && nextSwap?.donationIdx === next.dIdx;
  if (prevIsSwapped !== nextIsSwapped) return false;
  const prevIsDragSrc = prev.dragItem?.groupIdx === prev.groupIdx && prev.dragItem?.donationIdx === prev.dIdx;
  const nextIsDragSrc = next.dragItem?.groupIdx === next.groupIdx && next.dragItem?.donationIdx === next.dIdx;
  if (prevIsDragSrc !== nextIsDragSrc) return false;
  const prevIsDragTgt = prev.dragOverItem?.groupIdx === prev.groupIdx && prev.dragOverItem?.donationIdx === prev.dIdx;
  const nextIsDragTgt = next.dragOverItem?.groupIdx === next.groupIdx && next.dragOverItem?.donationIdx === next.dIdx;
  if (prevIsDragTgt !== nextIsDragTgt) return false;
  return true;
});

export const AnimalGroupCard = memo(function AnimalGroupCard(props: AnimalGroupCardProps) {
  const {
    group,
    groupIdx,
    kesimName,
    kesimId,
    isCollapsed,
    isSelected,
    compact,
    visibleColumns,
    totalGroupCount,
    photoCounts,
    teams,
    basketItemIds,
    selectedGroupDonations,
    swapSelection,
    highlightIncomplete,
    dragItem,
    dragOverGroup,
    dragOverItem,
    groupSearchQuery,
    onToggleCollapse,
    onToggleSelect,
    onSetColorTag,
    onMoveUp,
    onMoveDown,
    onSplit,
    onAddGroupToBasket,
    onToggleLock,
    onDelete,
    onAssignTeam,
    onViewPhotos,
    onUpdateGroupDonation,
    onHandleGroupCellTab,
    onToggleBasketItem,
    onSwapSelect,
    onRemoveFromGroup,
    onUpdateGroupNotes,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onDragOverCard,
    onDragLeaveCard,
    onToggleGroupDonationSelect,
    onSelectAllGroupDonations,
    columnHeaderLabel,
    columnHeaderWidth,
  } = props;

  const filledCount = useMemo(() => group.donations.filter(d => d.name.trim() !== "").length, [group.donations]);
  const isIncomplete = filledCount < 7;
  const isLocked = !!group.locked;

  const isGroupSearchMatchFn = useCallback((dIdx: number): boolean => {
    if (!groupSearchQuery.trim()) return false;
    const q = groupSearchQuery.trim().toLowerCase();
    const d = group.donations[dIdx];
    if (!d) return false;
    return (
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.vekalet.toLowerCase().includes(q) ||
      d.donationType.toLowerCase().includes(q) ||
      (d.notes || "").toLowerCase().includes(q)
    );
  }, [groupSearchQuery, group.donations]);

  const handleNotesCommit = useCallback((value: string) => {
    onUpdateGroupNotes(groupIdx, value);
  }, [groupIdx, onUpdateGroupNotes]);

  const filledDonations = useMemo(() => group.donations.filter(d => d.name.trim()), [group.donations]);
  const allDonationsSelected = useMemo(() => 
    filledDonations.length > 0 && filledDonations.every(d => selectedGroupDonations.has(d.id)),
    [filledDonations, selectedGroupDonations]
  );

  const team = useMemo(() => group.teamId ? teams.find(t => t.id === group.teamId) : undefined, [group.teamId, teams]);

  return (
    <Card
      id={`animal-group-${group.animalNo}`}
      className={`overflow-hidden transition-all ${swapSelection?.groupIdx === groupIdx ? "ring-2 ring-purple-400" : ""} ${highlightIncomplete && isIncomplete ? "ring-2 ring-orange-400" : ""} ${dragItem && dragItem.groupIdx !== groupIdx && dragOverGroup === groupIdx ? (filledCount >= 7 ? "ring-2 ring-red-500 shadow-lg scale-[1.01] bg-red-50/50 dark:bg-red-950/30" : "ring-2 ring-primary shadow-lg scale-[1.01]") : ""} ${dragItem && dragItem.groupIdx !== groupIdx && !isLocked ? "border-dashed border-2 border-primary/30" : ""}`}
      style={group.colorTag ? { borderLeft: `4px solid ${colorMap[group.colorTag]}` } : (highlightIncomplete && isIncomplete ? { borderLeft: "4px solid #f97316" } : {})}
      onDragOver={(e) => { e.preventDefault(); onDragOverCard(e, groupIdx); }}
      onDragLeave={(e) => onDragLeaveCard(e, groupIdx)}
    >
      <div
        className={`flex items-center justify-between ${compact ? "p-2" : "p-3"} ${group.locked ? "bg-amber-500/10" : "bg-primary/10"} cursor-pointer`}
        onClick={() => onToggleCollapse(group.id)}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); if (!group.locked) onToggleSelect(group.id); }}
            className={`flex-shrink-0 ${group.locked ? "opacity-30 cursor-not-allowed" : ""}`}
            title={group.locked ? "Kilitli grup seçilemez" : "Seç"}
            aria-label={group.locked ? "Kilitli grup seçilemez" : isSelected ? `Hayvan ${group.animalNo} grubunu seçimden kaldır` : `Hayvan ${group.animalNo} grubunu seç`}
            aria-pressed={isSelected}
          >
            {isSelected
              ? <CheckSquare className={`${compact ? "w-3.5 h-3.5" : "w-4 h-4"} text-primary`} />
              : <Square className={`${compact ? "w-3.5 h-3.5" : "w-4 h-4"} text-muted-foreground`} />
            }
          </button>
          {isCollapsed ? (
            <ChevronDown className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
          ) : (
            <ChevronUp className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
          )}
          <h3 className={`font-semibold ${compact ? "text-xs" : "text-sm"}`}>
            {kesimName} - HAYVAN NO: {group.animalNo}
          </h3>
          {group.locked && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-semibold border border-amber-500/30">
              <Lock className="w-2.5 h-2.5" />
              Kilitli
            </span>
          )}
          {group.kesildi && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
              ✓ Kesildi
              {group.kesildiAt && (
                <span className="ml-0.5 opacity-75">
                  {new Date(group.kesildiAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </span>
          )}
          {team && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: team.color + "20", color: team.color }}
            >
              {team.name}
            </span>
          )}
          <div className="flex items-center gap-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
            {(["green", "orange", "red", ""] as ColorTag[]).map((c) => (
              <button
                key={c || "none"}
                onClick={() => onSetColorTag(groupIdx, c)}
                className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} rounded-full border transition-transform ${
                  (group.colorTag || "") === c ? "scale-125 ring-1 ring-offset-1" : "opacity-50 hover:opacity-100"
                } ${c === "" ? "border-dashed" : ""}`}
                style={c ? { backgroundColor: colorMap[c] } : {}}
                title={c === "green" ? "Yeşil" : c === "orange" ? "Turuncu" : c === "red" ? "Kırmızı" : "Renksiz"}
                aria-label={c === "green" ? "Yeşil etiket" : c === "orange" ? "Turuncu etiket" : c === "red" ? "Kırmızı etiket" : "Renk etiketini kaldır"}
                aria-pressed={(group.colorTag || "") === c}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`${compact ? "text-[10px]" : "text-xs"} text-muted-foreground`}>
            {filledCount}/7 dolu
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(groupIdx); }}
            className={`p-0.5 rounded transition-colors ${groupIdx <= 0 ? "opacity-30 cursor-not-allowed" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
            title="Yukarı Taşı"
            aria-label="Yukarı Taşı"
            disabled={groupIdx <= 0}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(groupIdx); }}
            className={`p-0.5 rounded transition-colors ${groupIdx >= totalGroupCount - 1 ? "opacity-30 cursor-not-allowed" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
            title="Aşağı Taşı"
            aria-label="Aşağı Taşı"
            disabled={groupIdx >= totalGroupCount - 1}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSplit(groupIdx); }}
            className={`p-0.5 rounded transition-colors ${group.locked || filledCount <= 1 ? "opacity-30 cursor-not-allowed" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
            title={group.locked ? "Kilitli grup bölünemez" : filledCount <= 1 ? "Bölmek için en az 2 bağışçı gerekli" : "Grubu Böl"}
            aria-label={group.locked ? "Kilitli grup bölünemez" : filledCount <= 1 ? "Bölmek için en az 2 bağışçı gerekli" : "Grubu Böl"}
            disabled={group.locked || filledCount <= 1}
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddGroupToBasket(groupIdx);
            }}
            className={`p-0.5 rounded transition-colors ${group.locked || filledCount === 0 ? "opacity-30 cursor-not-allowed" : "text-emerald-500/60 hover:text-emerald-600"}`}
            title={group.locked ? "Kilitli grup sepete eklenemez" : filledCount === 0 ? "Grupta bağışçı yok" : `Tümünü Sepete Ekle (${filledCount})`}
            aria-label={group.locked ? "Kilitli grup sepete eklenemez" : filledCount === 0 ? "Grupta bağışçı yok" : `Tümünü Sepete Ekle (${filledCount})`}
            disabled={group.locked || filledCount === 0}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
          </button>
          {(photoCounts[group.id] ?? 0) > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewPhotos(group.id, group.animalNo);
              }}
              className="p-0.5 rounded transition-colors text-blue-500 hover:text-blue-600 relative"
              title={`${photoCounts[group.id]} fotoğraf`}
              aria-label={`${photoCounts[group.id]} fotoğraf görüntüle`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none font-bold" aria-hidden="true">
                {photoCounts[group.id]}
              </span>
            </button>
          )}
          {teams.length > 0 && (
            <select
              value={group.teamId || ""}
              onChange={(e) => { e.stopPropagation(); onAssignTeam(group.id, e.target.value || null); }}
              onClick={(e) => e.stopPropagation()}
              className="h-5 text-[10px] rounded border bg-background px-1 max-w-[80px]"
              title="Ekip Ata"
              aria-label={`Hayvan ${group.animalNo} için ekip ata`}
            >
              <option value="">Ekip yok</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleLock(groupIdx); }}
            className={`p-0.5 rounded transition-colors ${group.locked ? "text-amber-500" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
            title={group.locked ? "Kilidi Aç" : "Kilitle"}
            aria-label={group.locked ? "Kilidi Aç" : "Kilitle"}
            aria-pressed={!!group.locked}
          >
            {group.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (group.locked) return;
              if (!confirm(`Hayvan ${group.animalNo} grubunu silmek istediğinize emin misiniz? İçindeki bağışçılar grupsuz kalacaktır.`)) return;
              onDelete(groupIdx);
            }}
            className={`p-0.5 rounded transition-colors ${group.locked ? "opacity-30 cursor-not-allowed" : "text-red-400/60 hover:text-red-500"}`}
            title={group.locked ? "Kilitli grup silinemez" : "Grubu Sil"}
            aria-label={group.locked ? "Kilitli grup silinemez" : "Grubu Sil"}
            disabled={group.locked}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {!isCollapsed && (
        <>
          <table className={`w-full ${compact ? "text-[10px]" : "text-xs"}`}>
            <thead>
              <tr className="border-b bg-muted/30">
                <th className={`${compact ? "p-0.5" : "p-1.5"} w-6`}>
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={allDonationsSelected}
                    onChange={() => onSelectAllGroupDonations(filledDonations, allDonationsSelected)}
                    aria-label={`Hayvan ${group.animalNo} tüm bağışçıları seç`}
                  />
                </th>
                {visibleColumns.map(key => (
                  <th key={key} className={`${compact ? "p-0.5" : "p-1.5"} text-left ${columnHeaderWidth(key)}`}>
                    {key === "drag" ? "" : key === "actions" ? "" : columnHeaderLabel(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.donations.map((d, dIdx) => (
                <GroupDonationRow
                  key={d.id}
                  donation={d}
                  dIdx={dIdx}
                  groupIdx={groupIdx}
                  compact={compact}
                  visibleColumns={visibleColumns}
                  basketItemIds={basketItemIds}
                  selectedGroupDonations={selectedGroupDonations}
                  swapSelection={swapSelection}
                  dragItem={dragItem}
                  dragOverItem={dragOverItem}
                  isSearchMatch={isGroupSearchMatchFn(dIdx)}
                  isGroupLocked={isLocked}
                  onUpdateField={onUpdateGroupDonation}
                  onHandleGroupCellTab={onHandleGroupCellTab}
                  onToggleBasketItem={onToggleBasketItem}
                  onSwapSelect={onSwapSelect}
                  onRemoveFromGroup={onRemoveFromGroup}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                  onToggleSelect={onToggleGroupDonationSelect}
                />
              ))}
            </tbody>
          </table>
          <div className={`${compact ? "p-1" : "p-2"} border-t`}>
            <LocalInput
              value={group.notes || ""}
              onCommit={handleNotesCommit}
              className={`w-full ${compact ? "text-[10px]" : "text-xs"} bg-transparent border-0 outline-none placeholder:text-muted-foreground/50 text-muted-foreground h-auto`}
              placeholder="Grup notu..."
              aria-label={`Hayvan ${group.animalNo} grup notu`}
            />
          </div>
        </>
      )}
    </Card>
  );
}, (prev, next) => {
  if (prev.group !== next.group) return false;
  if (prev.groupIdx !== next.groupIdx) return false;
  if (prev.isCollapsed !== next.isCollapsed) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.compact !== next.compact) return false;
  if (prev.totalGroupCount !== next.totalGroupCount) return false;
  if (prev.highlightIncomplete !== next.highlightIncomplete) return false;
  if (prev.groupSearchQuery !== next.groupSearchQuery) return false;
  if (prev.visibleColumns !== next.visibleColumns) return false;
  if (prev.teams !== next.teams) return false;
  if (prev.kesimName !== next.kesimName) return false;

  const gIdx = prev.groupIdx;
  const prevDragOverThis = prev.dragOverGroup === gIdx;
  const nextDragOverThis = next.dragOverGroup === gIdx;
  if (prevDragOverThis !== nextDragOverThis) return false;

  const prevSwapThis = prev.swapSelection?.groupIdx === gIdx;
  const nextSwapThis = next.swapSelection?.groupIdx === gIdx;
  if (prevSwapThis !== nextSwapThis) return false;

  const prevDragFromThis = prev.dragItem?.groupIdx === gIdx;
  const nextDragFromThis = next.dragItem?.groupIdx === gIdx;
  if (prevDragFromThis !== nextDragFromThis) return false;

  const prevDragAny = prev.dragItem !== null;
  const nextDragAny = next.dragItem !== null;
  if (prevDragAny !== nextDragAny) return false;

  if (prev.dragItem?.groupIdx === gIdx || next.dragItem?.groupIdx === gIdx) {
    if (prev.dragItem?.donationIdx !== next.dragItem?.donationIdx) return false;
  }

  if (prev.dragOverItem?.groupIdx === gIdx || next.dragOverItem?.groupIdx === gIdx) {
    if (prev.dragOverItem !== next.dragOverItem) return false;
  }

  const gId = prev.group.id;
  if ((prev.photoCounts[gId] ?? 0) !== (next.photoCounts[gId] ?? 0)) return false;

  if (prev.basketItemIds !== next.basketItemIds) {
    for (const d of prev.group.donations) {
      if (d.name.trim() && prev.basketItemIds.has(d.id) !== next.basketItemIds.has(d.id)) return false;
    }
  }

  if (prev.selectedGroupDonations !== next.selectedGroupDonations) {
    for (const d of prev.group.donations) {
      if (d.name.trim() && prev.selectedGroupDonations.has(d.id) !== next.selectedGroupDonations.has(d.id)) return false;
    }
  }

  return true;
});
