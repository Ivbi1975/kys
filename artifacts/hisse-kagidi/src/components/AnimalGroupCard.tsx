import { memo, useCallback, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocalInput } from "@/components/LocalInput";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Donation, AnimalGroup, KesimAlani, ColorTag, Team } from "@/lib/types";
import { COLOR_MAP } from "@/lib/constants";
import { turkishTitleCase } from "@/lib/formatting";
import type { ColumnKey } from "@/lib/useWorkspacePreferences";
import { CategoryBadge } from "@/lib/categoryConfig";
import { GroupFlagPopover } from "@/components/animal-group/GroupFlagPopover";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Lock,
  Unlock,
  Trash2,
  ArrowLeftRight,
  ShoppingBag,
  CheckSquare,
  Square,
  Camera,
  Package,
  MoreHorizontal,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  StickyNote,
} from "lucide-react";

const SORTABLE_COLUMNS: ColumnKey[] = ["vekalet", "description", "name", "donationType", "fiyat", "yerTalebi", "gunTalebi", "ilkHayvan", "safi"];

interface AnimalGroupCardProps {
  group: AnimalGroup;
  groupIdx: number;
  kesimName: string;
  kesimId: string;
  projectId?: string;
  swapLabel?: string;
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
  onSplit: (groupIdx: number) => void;
  onAddGroupToBasket: (groupIdx: number) => void;
  onAddWholeAnimalToBasket: (groupIdx: number) => void;
  basketAnimalGroupIds: Set<string>;
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
  onUpdateGroupFiyat: (groupIdx: number, fiyat: string) => void;
  onDragStart: (groupIdx: number, donationIdx: number, e?: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, groupIdx: number, donationIdx: number) => void;
  onDrop: (groupIdx: number, donationIdx: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOverCard: (e: React.DragEvent, groupIdx: number) => void;
  onDragLeaveCard: (e: React.DragEvent, groupIdx: number) => void;
  onToggleGroupDonationSelect: (donationId: string) => void;
  onSelectAllGroupDonations: (donations: Donation[], allSelected: boolean) => void;
  onBasketDrop?: (donationId: string, targetGroupIdx: number, targetSlotIdx: number) => boolean;
  onFlagDonation?: (id: string, reason: string) => void;
  onUnflagDonation?: (id: string) => void;

  groupCardDragState?: { dragIdx: number | null; overIdx: number | null };
  onGroupCardDragStart?: (e: React.DragEvent, groupIdx: number) => void;
  onGroupCardDragOver?: (e: React.DragEvent, groupIdx: number) => void;
  onGroupCardDrop?: (e: React.DragEvent, toIdx: number) => void;
  onGroupCardDragEnd?: () => void;

  columnHeaderLabel: (key: ColumnKey) => string;
  columnHeaderWidth: (key: ColumnKey) => string;
}

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
  onBasketDrop,
  onFlagDonation,
  onUnflagDonation,
  projectId,
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
  onBasketDrop?: (donationId: string, targetGroupIdx: number, targetSlotIdx: number) => boolean;
  onFlagDonation?: (id: string, reason: string) => void;
  onUnflagDonation?: (id: string) => void;
  projectId?: string;
}) {
  const d = donation;
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteValue, setNoteValue] = useState(d.notes || "");
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
          <td key={colKey} className={cellPad}>
            <div className="flex items-center gap-0.5">
              {d.isFlagged && (
                <span title={d.flagReason || "Sorunlu bağış"}><AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" /></span>
              )}
              {d.vekalet && projectId ? (
                <a
                  href={`/bagis-havuzu/${projectId}?q=${encodeURIComponent(d.vekalet)}&ka=all`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${inputH} flex items-center text-primary hover:underline cursor-pointer`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {turkishTitleCase(d.vekalet)}
                </a>
              ) : (
                <span className={`${inputH} flex items-center select-text`}>{turkishTitleCase(d.vekalet) || "—"}</span>
              )}
            </div>
          </td>
        );
      case "description":
        return (
          <td key={colKey} className={`${cellPad} max-w-[150px] overflow-hidden`}>
            <span className={`${inputH} flex items-center select-text whitespace-nowrap overflow-hidden overflow-ellipsis`} title={d.description}>{turkishTitleCase(d.description) || "—"}</span>
          </td>
        );
      case "name":
        return (
          <td key={colKey} className={`${cellPad} max-w-[150px] overflow-hidden`}>
            <span className={`${inputH} flex items-center select-text whitespace-nowrap overflow-hidden overflow-ellipsis`} title={d.name}>{turkishTitleCase(d.name) || "—"}</span>
          </td>
        );
      case "donationType":
        return (
          <td key={colKey} className={cellPad}>
            <span className={`${inputH} flex items-center select-text`}>{turkishTitleCase(d.donationType) || "—"}</span>
          </td>
        );
      case "fiyat":
        return (
          <td key={colKey} className={`${cellPad} text-center`}>
            <span className={`${inputH} flex items-center justify-center text-muted-foreground`}>{d.fiyat || <span className="text-muted-foreground/30">—</span>}</span>
          </td>
        );
      case "yerTalebi":
        return (
          <td key={colKey} className={`${cellPad} text-center`}>
            <span className={`${inputH} flex items-center justify-center text-muted-foreground`}>{d.yerTalebi || <span className="text-muted-foreground/30">—</span>}</span>
          </td>
        );
      case "gunTalebi":
        return (
          <td key={colKey} className={`${cellPad} text-center`}>
            <span className={`${inputH} flex items-center justify-center text-muted-foreground`}>{d.gunTalebi || <span className="text-muted-foreground/30">—</span>}</span>
          </td>
        );
      case "ilkHayvan":
        return (
          <td key={colKey} className={`${cellPad} text-center`}>
            <span className={`${inputH} flex items-center justify-center text-muted-foreground`}>{d.ilkHayvan || <span className="text-muted-foreground/30">—</span>}</span>
          </td>
        );
      case "safi":
        return (
          <td key={colKey} className={`${cellPad} text-center`}>
            <span className={`${inputH} flex items-center justify-center text-muted-foreground`}>{d.safi || <span className="text-muted-foreground/30">—</span>}</span>
          </td>
        );
      case "notes":
        return (
          <td key={colKey} className={cellPad}>
            {d.notes?.trim() ? (
              <span className={`${inputH} flex items-center text-muted-foreground truncate max-w-[100px]`} title={d.notes.trim()}>
                <StickyNote className="w-2.5 h-2.5 mr-0.5 text-amber-500 flex-shrink-0" />{d.notes.trim()}
              </span>
            ) : <span className="text-muted-foreground/30">—</span>}
          </td>
        );
      case "aiTags": {
        const hasAiData = (d.aiCategories && d.aiCategories.length > 0) || !!(d.aiWarnings && d.aiWarnings.trim());
        const hasNote = !!d.notes?.trim();
        return (
          <td key={colKey} className={cellPad}>
            <div className="flex gap-0.5 flex-wrap items-center min-h-[1.25rem]">
              {hasAiData && (
                <>
                  {(d.aiCategories || []).map(cat => (
                    <CategoryBadge key={cat} cat={cat} size="sm" />
                  ))}
                  {d.aiWarnings && d.aiWarnings.trim() && (
                    <span className="px-1 py-0 rounded text-[10px] font-medium bg-red-600 text-white flex items-center gap-0.5" title={d.aiWarnings}>
                      ⚠
                    </span>
                  )}
                </>
              )}
              {hasNote && (
                <span
                  className={`${inputH} flex items-center text-muted-foreground max-w-[120px] overflow-hidden`}
                  title={d.notes!.trim()}
                >
                  <StickyNote className="w-2.5 h-2.5 mr-0.5 text-amber-500 flex-shrink-0" />
                  <span className="truncate">{d.notes!.trim()}</span>
                </span>
              )}
              {!hasAiData && !hasNote && (
                <span className="text-muted-foreground/30">—</span>
              )}
            </div>
          </td>
        );
      }
      case "actions":
        return (
          <td key={colKey} className={cellPad}>
            <div className="flex gap-0.5">
              <Popover open={noteOpen} onOpenChange={(o) => { setNoteOpen(o); if (o) setNoteValue(d.notes || ""); }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${compact ? "h-4 w-4" : "h-5 w-5"} p-0 ${d.notes ? "text-amber-500" : "text-muted-foreground"}`}
                    title={d.notes ? `Not: ${d.notes}` : "Not ekle"}
                    aria-label="Not düzenle"
                  >
                    <StickyNote className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" side="left" align="start">
                  <p className="text-xs font-medium mb-1.5 text-muted-foreground">Not</p>
                  <textarea
                    className="w-full text-xs border rounded p-1.5 resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                    rows={3}
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    placeholder="Not girin..."
                    autoFocus
                  />
                  <div className="flex gap-1 mt-1.5 justify-end">
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setNoteOpen(false)}>İptal</Button>
                    <Button size="sm" className="h-6 px-2 text-xs" onClick={() => { handleCommit("notes", noteValue); setNoteOpen(false); }}>Kaydet</Button>
                  </div>
                </PopoverContent>
              </Popover>
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
                  {d.isFlagged ? (
                    onUnflagDonation && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`${compact ? "h-4 w-4" : "h-5 w-5"} p-0 text-amber-600`}
                        onClick={() => onUnflagDonation(d.id)}
                        title="İşareti kaldır"
                        aria-label="İşareti kaldır"
                      >
                        <AlertTriangle className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
                      </Button>
                    )
                  ) : (
                    onFlagDonation && (
                      <GroupFlagPopover donationId={d.id} compact={compact} onFlag={onFlagDonation} />
                    )
                  )}
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
          : d.isFlagged
          ? "bg-amber-50 dark:bg-amber-950/30"
          : selectedGroupDonations.has(d.id)
          ? "bg-blue-50 dark:bg-blue-950/40"
          : "hover:bg-muted/20"
      } ${isDragSource ? "opacity-50 scale-95" : ""}`}
      draggable
      onDragStart={(e) => onDragStart(groupIdx, dIdx, e)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, groupIdx, dIdx); }}
      onDrop={(e) => {
        const basketData = e.dataTransfer.getData("application/basket-item");
        if (basketData && onBasketDrop) {
          e.preventDefault();
          e.stopPropagation();
          try {
            const parsed = JSON.parse(basketData);
            onBasketDrop(parsed.donationId, groupIdx, dIdx);
          } catch {}
          return;
        }
        onDrop(groupIdx, dIdx);
      }}
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

const GroupOverflowMenu = memo(function GroupOverflowMenu({
  group, groupIdx, compact, filledCount, totalGroupCount, teams,
  basketAnimalGroupIds, onSplit,
  onAddWholeAnimalToBasket, onAssignTeam, onSetColorTag, onDelete,
}: {
  group: AnimalGroup;
  groupIdx: number;
  compact: boolean;
  filledCount: number;
  totalGroupCount: number;
  teams: Team[];
  basketAnimalGroupIds: Set<string>;
  onSplit: (groupIdx: number) => void;
  onAddWholeAnimalToBasket: (groupIdx: number) => void;
  onAssignTeam: (groupId: string, teamId: string | null) => void;
  onSetColorTag: (groupIdx: number, tag: ColorTag) => void;
  onDelete: (groupIdx: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="p-1 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Daha fazla"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="end" side="bottom">
        <div className="space-y-0.5">
          <div className="h-px bg-border my-1" />

          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => { onSplit(groupIdx); setOpen(false); }}
            disabled={group.locked || filledCount <= 1}
          >
            <img src="/kurban-logo.png" alt="" className="w-3.5 h-3.5 object-contain invert dark:invert-0" />
            Grubu Böl
          </button>
          <button
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              basketAnimalGroupIds.has(group.id) ? "bg-orange-50 dark:bg-orange-950 text-orange-600" : "hover:bg-muted"
            }`}
            onClick={() => { onAddWholeAnimalToBasket(groupIdx); setOpen(false); }}
            disabled={group.locked || group.kesildi || filledCount === 0 || basketAnimalGroupIds.has(group.id)}
          >
            <Package className="w-3.5 h-3.5 text-orange-500" />
            {basketAnimalGroupIds.has(group.id) ? "Komple Hayvan Sepette" : "Komple Hayvanı Sepete Ekle"}
          </button>

          {teams.length > 0 && (
            <>
              <div className="h-px bg-border my-1" />
              <div className="px-2 py-1">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">Ekip Ata</p>
                <select
                  value={group.teamId || ""}
                  onChange={(e) => { onAssignTeam(group.id, e.target.value || null); }}
                  className="w-full h-6 text-xs rounded border bg-background px-1"
                >
                  <option value="">Ekip yok</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="h-px bg-border my-1" />

          <div className="px-2 py-1">
            <p className="text-[10px] text-muted-foreground font-medium mb-1.5">Renk Etiketi</p>
            <div className="flex items-center gap-1.5">
              {(["green", "orange", "red", ""] as ColorTag[]).map((c) => (
                <button
                  key={c || "none"}
                  onClick={() => { onSetColorTag(groupIdx, c); }}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    (group.colorTag || "") === c ? "scale-110 ring-2 ring-offset-1 ring-primary" : "opacity-60 hover:opacity-100 hover:scale-105"
                  } ${c === "" ? "border-dashed border-muted-foreground/40" : "border-transparent"}`}
                  style={c ? { backgroundColor: COLOR_MAP[c] } : {}}
                  title={c === "green" ? "Yeşil" : c === "orange" ? "Turuncu" : c === "red" ? "Kırmızı" : "Renksiz"}
                />
              ))}
            </div>
          </div>

          <div className="h-px bg-border my-1" />

          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => {
              if (group.locked) return;
              if (!confirm(`Hayvan ${group.animalNo} grubunu silmek istediğinize emin misiniz? İçindeki bağışçılar grupsuz kalacaktır.`)) return;
              onDelete(groupIdx);
              setOpen(false);
            }}
            disabled={group.locked}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Grubu Sil
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
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
    onSplit,
    onAddGroupToBasket,
    onAddWholeAnimalToBasket,
    basketAnimalGroupIds,
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
    onUpdateGroupFiyat,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onDragOverCard,
    onDragLeaveCard,
    onToggleGroupDonationSelect,
    onSelectAllGroupDonations,
    groupCardDragState,
    onGroupCardDragStart,
    onGroupCardDragOver,
    onGroupCardDrop,
    onGroupCardDragEnd,
    columnHeaderLabel,
    columnHeaderWidth,
    projectId,
    swapLabel,
  } = props;

  const isGroupCardBeingDragged = groupCardDragState?.dragIdx === groupIdx;
  const isGroupCardDropTarget = groupCardDragState != null &&
    groupCardDragState.dragIdx !== null &&
    groupCardDragState.dragIdx !== groupIdx &&
    groupCardDragState.overIdx === groupIdx;

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

  const handleFiyatCommit = useCallback((value: string) => {
    onUpdateGroupFiyat(groupIdx, value);
  }, [groupIdx, onUpdateGroupFiyat]);

  const filledDonations = useMemo(() => group.donations.filter(d => d.name.trim()), [group.donations]);
  const allDonationsSelected = useMemo(() => 
    filledDonations.length > 0 && filledDonations.every(d => selectedGroupDonations.has(d.id)),
    [filledDonations, selectedGroupDonations]
  );

  const team = useMemo(() => group.teamId ? teams.find(t => t.id === group.teamId) : undefined, [group.teamId, teams]);

  const [sortState, setSortState] = useState<{ field: ColumnKey | null; dir: "asc" | "desc" }>({ field: null, dir: "asc" });

  const handleSortHeader = useCallback((key: ColumnKey) => {
    if (!SORTABLE_COLUMNS.includes(key)) return;
    setSortState(prev =>
      prev.field === key
        ? { field: key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field: key, dir: "asc" }
    );
  }, []);

  const sortedDonations = useMemo(() => {
    const withIdx = group.donations.map((d, i) => ({ d, origIdx: i }));
    if (!sortState.field) return withIdx;
    const field = sortState.field;
    return [...withIdx].sort((a, b) => {
      const valA = ((a.d[field as keyof Donation] as string) || "").toLowerCase();
      const valB = ((b.d[field as keyof Donation] as string) || "").toLowerCase();
      const cmp = valA.localeCompare(valB, "tr");
      return sortState.dir === "asc" ? cmp : -cmp;
    });
  }, [group.donations, sortState]);

  return (
    <Card
      id={`animal-group-${group.animalNo}`}
      className={`overflow-hidden transition-all ${isGroupCardBeingDragged ? "opacity-40 scale-[0.98]" : ""} ${isGroupCardDropTarget ? "ring-2 ring-indigo-500 shadow-xl scale-[1.01]" : ""} ${swapSelection?.groupIdx === groupIdx ? "ring-2 ring-purple-400" : ""} ${highlightIncomplete && isIncomplete ? "ring-2 ring-orange-400" : ""} ${dragItem && dragItem.groupIdx !== groupIdx && dragOverGroup === groupIdx ? (filledCount >= 7 ? "ring-2 ring-red-500 shadow-lg scale-[1.01] bg-red-50/50 dark:bg-red-950/30" : "ring-2 ring-primary shadow-lg scale-[1.01]") : ""} ${dragItem && dragItem.groupIdx !== groupIdx && !isLocked ? "border-dashed border-2 border-primary/30" : ""}`}
      style={group.colorTag ? { borderLeft: `4px solid ${COLOR_MAP[group.colorTag]}` } : (highlightIncomplete && isIncomplete ? { borderLeft: "4px solid #f97316" } : {})}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/group-card-drag") && onGroupCardDragOver) {
          onGroupCardDragOver(e, groupIdx);
        } else {
          e.preventDefault();
          onDragOverCard(e, groupIdx);
        }
      }}
      onDragLeave={(e) => onDragLeaveCard(e, groupIdx)}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes("application/group-card-drag") && onGroupCardDrop) {
          onGroupCardDrop(e, groupIdx);
          return;
        }
        const basketData = e.dataTransfer.getData("application/basket-item");
        if (basketData && props.onBasketDrop) {
          e.preventDefault();
          e.stopPropagation();
          try {
            const parsed = JSON.parse(basketData);
            props.onBasketDrop(parsed.donationId, groupIdx, 0);
          } catch {}
        }
      }}
    >
      <div
        className={`flex items-center justify-between ${compact ? "p-2" : "p-3"} ${group.locked ? "bg-amber-500/10" : "bg-primary/10"} cursor-pointer`}
        onClick={() => onToggleCollapse(group.id)}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onToggleCollapse(group.id); } }}
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        aria-label={`Hayvan ${group.animalNo} grubunu ${isCollapsed ? "genişlet" : "daralt"}`}
      >
        <div className="flex items-center gap-2">
          {onGroupCardDragStart && (
            <div
              className="cursor-grab active:cursor-grabbing flex-shrink-0 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors -ml-0.5"
              draggable
              onDragStart={(e) => { e.stopPropagation(); onGroupCardDragStart(e, groupIdx); }}
              onDragEnd={(e) => { e.stopPropagation(); onGroupCardDragEnd?.(); }}
              onClick={(e) => e.stopPropagation()}
              title="Grubu sürükleyerek yeniden sırala"
            >
              <GripVertical className={compact ? "w-3 h-3" : "w-4 h-4"} />
            </div>
          )}
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
          <h3 className={`font-semibold ${compact ? "text-xs" : "text-sm"} flex items-center gap-1.5 flex-wrap`}>
            <span>Hayvan <span className="tabular-nums">{group.animalNo}</span></span>
            {swapLabel && (
              <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono font-normal bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 tabular-nums" title={`Eski No: ${swapLabel.split("-")[0]} → Yeni No: ${swapLabel.split("-")[1]}`}>
                {swapLabel}
              </span>
            )}
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
          {group.colorTag && (
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_MAP[group.colorTag] }} />
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-0.5 mr-1" title={`${filledCount}/7 hisse dolu`}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className={`${compact ? "w-2 h-2" : "w-2.5 h-2.5"} rounded-sm transition-colors ${
                  i < filledCount
                    ? filledCount === 7 ? "bg-emerald-500" : "bg-primary"
                    : "bg-muted-foreground/20"
                }`}
              />
            ))}
            <span className={`${compact ? "text-[10px]" : "text-xs"} text-muted-foreground ml-1`}>
              {filledCount}/7
            </span>
          </div>
          <button
            onClick={() => onAddGroupToBasket(groupIdx)}
            className={`p-1 rounded transition-colors ${group.locked || group.kesildi || filledCount === 0 ? "opacity-30 cursor-not-allowed" : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"}`}
            title={group.locked ? "Kilitli grup sepete eklenemez" : group.kesildi ? "Kesilmiş grup sepete eklenemez" : filledCount === 0 ? "Grupta bağışçı yok" : `Bağışçıları Sepete Ekle (${filledCount})`}
            aria-label={`Hayvan ${group.animalNo} bağışçılarını sepete ekle`}
            disabled={group.locked || group.kesildi || filledCount === 0}
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleLock(groupIdx)}
            className={`p-1 rounded transition-colors ${group.locked ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950" : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted"}`}
            title={group.locked ? "Kilidi Aç" : "Kilitle"}
            aria-label={group.locked ? `Hayvan ${group.animalNo} kilidini aç` : `Hayvan ${group.animalNo} kilitle`}
          >
            {group.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
          {(photoCounts[group.id] ?? 0) > 0 && (
            <button
              onClick={() => onViewPhotos(group.id, group.animalNo)}
              className="p-1 rounded transition-colors text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 relative"
              title={`${photoCounts[group.id]} fotoğraf`}
            >
              <Camera className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none font-bold">
                {photoCounts[group.id]}
              </span>
            </button>
          )}
          <GroupOverflowMenu
            group={group}
            groupIdx={groupIdx}
            compact={compact}
            filledCount={filledCount}
            totalGroupCount={totalGroupCount}
            teams={teams}
            basketAnimalGroupIds={basketAnimalGroupIds}
            onSplit={onSplit}
            onAddWholeAnimalToBasket={onAddWholeAnimalToBasket}
            onAssignTeam={onAssignTeam}
            onSetColorTag={onSetColorTag}
            onDelete={onDelete}
          />
        </div>
      </div>
      {!isCollapsed && (
        <>
          <div className="overflow-x-auto">
          <table className={`w-full min-w-max ${compact ? "text-[10px]" : "text-xs"}`}>
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
                {visibleColumns.map(key => {
                  const isSortable = SORTABLE_COLUMNS.includes(key);
                  const isActive = sortState.field === key;
                  return (
                    <th
                      key={key}
                      className={`${compact ? "p-0.5" : "p-1.5"} text-left whitespace-nowrap ${columnHeaderWidth(key)} ${isSortable ? "cursor-pointer select-none hover:bg-muted/50 transition-colors" : ""}`}
                      onClick={isSortable ? () => handleSortHeader(key) : undefined}
                    >
                      {key === "drag" || key === "actions" ? "" : (
                        <span className="inline-flex items-center gap-0.5">
                          {columnHeaderLabel(key)}
                          {isSortable && (
                            isActive
                              ? sortState.dir === "asc"
                                ? <ArrowUp className="w-2.5 h-2.5 text-primary" />
                                : <ArrowDown className="w-2.5 h-2.5 text-primary" />
                              : <ArrowUpDown className="w-2.5 h-2.5 text-muted-foreground/40" />
                          )}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedDonations.map(({ d, origIdx }) => (
                <GroupDonationRow
                  key={d.id}
                  donation={d}
                  dIdx={origIdx}
                  groupIdx={groupIdx}
                  compact={compact}
                  visibleColumns={visibleColumns}
                  basketItemIds={basketItemIds}
                  selectedGroupDonations={selectedGroupDonations}
                  swapSelection={swapSelection}
                  dragItem={dragItem}
                  dragOverItem={dragOverItem}
                  isSearchMatch={isGroupSearchMatchFn(origIdx)}
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
                  onBasketDrop={props.onBasketDrop}
                  onFlagDonation={props.onFlagDonation}
                  onUnflagDonation={props.onUnflagDonation}
                  projectId={projectId}
                />
              ))}
            </tbody>
          </table>
          </div>
          <div className={`${compact ? "p-1" : "p-2"} border-t flex items-center gap-2`}>
            <LocalInput
              value={group.notes || ""}
              onCommit={handleNotesCommit}
              className={`flex-1 ${compact ? "text-[10px]" : "text-xs"} bg-transparent border-0 outline-none placeholder:text-muted-foreground/50 text-muted-foreground h-auto`}
              placeholder="Grup notu..."
              aria-label={`Hayvan ${group.animalNo} grup notu`}
            />
            <div className="flex items-center gap-1 flex-shrink-0 border-l pl-2">
              <span className={`${compact ? "text-[9px]" : "text-[10px]"} text-muted-foreground/60 font-medium select-none`}>₺</span>
              <LocalInput
                value={group.fiyat || ""}
                onCommit={handleFiyatCommit}
                className={`w-20 ${compact ? "text-[10px]" : "text-xs"} bg-transparent border-0 outline-none placeholder:text-muted-foreground/50 text-muted-foreground h-auto`}
                placeholder="Fiyat..."
                aria-label={`Hayvan ${group.animalNo} fiyat`}
              />
            </div>
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

  const gId2 = prev.group.id;
  if (prev.basketAnimalGroupIds.has(gId2) !== next.basketAnimalGroupIds.has(gId2)) return false;

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
