import React, { useState } from "react";
import type { Donation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertTriangle, Eye, EyeOff, Flag, MoreHorizontal, ShoppingBag, StickyNote, Tag, Trash2, Wand2,
} from "lucide-react";

interface DonorRowProps {
  d: Donation;
  idx: number;
  descCount: number;
  effectiveShare: number;
  isSelected: boolean;
  isEditing: boolean;
  editField: string | null;
  editDraft: string;
  isInBasket: boolean;
  isGrouped: boolean;
  canSplit: boolean;
  splitShares: number;
  globalTags: Array<{ id: string; name: string; color: string }>;
  tagPopoverOpen: boolean;
  onToggleSelect: (id: string) => void;
  onStartEditing: (id: string, field: string) => void;
  onSetEditDraft: (v: string) => void;
  onCommitEdit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, id: string, field: string) => void;
  onSetPersonEditDesc: (desc: string) => void;
  onUpdateField: (id: string, field: keyof Donation, value: string | number | boolean) => void;
  onToggleTag: (donationId: string, tagId: string) => void;
  onSetTagPopover: (id: string | null) => void;
  onAddToBasket: (id: string) => void;
  onRemoveFromBasket: (id: string) => void;
  onSmartPlace: (id: string) => void;
  onSplitShare: (params: { donationId: string; totalShares: number }) => void;
  onDelete: (id: string) => void;
  onFlagDonation?: (id: string, reason: string) => void;
  onUnflagDonation?: (id: string) => void;
  projectId?: string;
}

function EditableCell({ displayValue }: {
  d: Donation; field: string; isEditing: boolean; editDraft: string;
  onSetEditDraft: (v: string) => void; onCommitEdit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, id: string, field: string) => void;
  onStartEditing: (id: string, field: string) => void; displayValue: string;
}) {
  return (
    <span className="block px-1 py-0.5 uppercase select-text">{displayValue || "—"}</span>
  );
}

function DonorRowOverflowMenu({
  d, isGrouped, canSplit, splitShares, globalTags, tagPopoverOpen,
  onSetPersonEditDesc, onUpdateField, onToggleTag, onSetTagPopover,
  onSmartPlace, onSplitShare, onDelete, onFlagDonation, onUnflagDonation,
}: {
  d: Donation;
  isGrouped: boolean;
  canSplit: boolean;
  splitShares: number;
  globalTags: Array<{ id: string; name: string; color: string }>;
  tagPopoverOpen: boolean;
  onSetPersonEditDesc: (desc: string) => void;
  onUpdateField: (id: string, field: keyof Donation, value: string | number | boolean) => void;
  onToggleTag: (donationId: string, tagId: string) => void;
  onSetTagPopover: (id: string | null) => void;
  onSmartPlace: (id: string) => void;
  onSplitShare: (params: { donationId: string; totalShares: number }) => void;
  onDelete: (id: string) => void;
  onFlagDonation?: (id: string, reason: string) => void;
  onUnflagDonation?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [flagReasonInput, setFlagReasonInput] = useState("");
  const [showFlagInput, setShowFlagInput] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Daha fazla" aria-label="Daha fazla seçenek">
          <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end" side="bottom">
        <div className="space-y-0.5">
          {!d.excluded && !isGrouped && (
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors"
              onClick={() => { onSmartPlace(d.id); setOpen(false); }}
            >
              <Wand2 className="w-3.5 h-3.5 text-primary" />
              Akıllı Yerleştir
            </button>
          )}
          {canSplit && (
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors"
              onClick={() => { onSplitShare({ donationId: d.id, totalShares: splitShares }); setOpen(false); }}
            >
              <img src="/kurban-logo.png" alt="" className="w-3.5 h-3.5 object-contain invert dark:invert-0" />
              Hisse Böl
            </button>
          )}
          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors"
            onClick={() => { onUpdateField(d.id, "excluded", !d.excluded); setOpen(false); }}
          >
            {d.excluded
              ? <><Eye className="w-3.5 h-3.5 text-green-600" /> Dahil Et</>
              : <><EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> Hariç Tut</>
            }
          </button>

          {globalTags.length > 0 && (
            <>
              <div className="h-px bg-border my-1" />
              <div className="px-2 py-1">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">Etiketler</p>
                <div className="space-y-0.5">
                  {globalTags.map(tag => {
                    const isActive = (d.tags || []).includes(tag.id);
                    return (
                      <button key={tag.id} className={`w-full flex items-center gap-2 px-1.5 py-1 rounded text-xs hover:bg-muted transition-colors ${isActive ? "bg-muted" : ""}`}
                        onClick={() => onToggleTag(d.id, tag.id)}>
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 text-left">{tag.name}</span>
                        {isActive && <span className="text-primary text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="h-px bg-border my-1" />

          {onFlagDonation && onUnflagDonation && (
            d.isFlagged ? (
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
                onClick={() => { onUnflagDonation(d.id); setOpen(false); }}
              >
                <Flag className="w-3.5 h-3.5" />
                Sorunu Kaldır
              </button>
            ) : showFlagInput ? (
              <div className="px-2 py-1.5 space-y-1">
                <Input
                  className="h-7 text-xs"
                  placeholder="Sorun açıklaması..."
                  value={flagReasonInput}
                  onChange={(e) => setFlagReasonInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && flagReasonInput.trim()) {
                      onFlagDonation(d.id, flagReasonInput.trim());
                      setFlagReasonInput("");
                      setShowFlagInput(false);
                      setOpen(false);
                    }
                  }}
                  autoFocus
                />
                <div className="flex gap-1">
                  <button
                    className="flex-1 text-center px-1 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50"
                    disabled={!flagReasonInput.trim()}
                    onClick={() => { onFlagDonation(d.id, flagReasonInput.trim()); setFlagReasonInput(""); setShowFlagInput(false); setOpen(false); }}
                  >
                    İşaretle
                  </button>
                  <button
                    className="px-1 py-0.5 rounded text-[10px] text-muted-foreground hover:bg-muted transition-colors"
                    onClick={() => { setShowFlagInput(false); setFlagReasonInput(""); }}
                  >
                    İptal
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
                onClick={() => setShowFlagInput(true)}
              >
                <Flag className="w-3.5 h-3.5" />
                Sorunlu İşaretle
              </button>
            )
          )}

          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors"
            onClick={() => { onDelete(d.id); setOpen(false); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Sil
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DonorRowInner({
  d, idx, descCount, effectiveShare, isSelected, isEditing, editField, editDraft,
  isInBasket, isGrouped, canSplit, splitShares, globalTags, tagPopoverOpen,
  onToggleSelect, onStartEditing, onSetEditDraft, onCommitEdit, onKeyDown,
  onSetPersonEditDesc, onUpdateField, onToggleTag, onSetTagPopover,
  onAddToBasket, onRemoveFromBasket, onSmartPlace, onSplitShare, onDelete,
  onFlagDonation, onUnflagDonation, projectId,
}: DonorRowProps) {
  const [notePopoverOpen, setNotePopoverOpen] = useState(false);
  return (<>
    <td className="p-2">
      <div className="flex items-center gap-1">
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(d.id)} className="rounded" />
        {d.isFlagged && (
          <span title={d.flagReason || "Sorunlu bağış"}>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          </span>
        )}
      </div>
    </td>
    <td className="p-2 text-muted-foreground">{idx + 1}</td>
    <td className="p-2">
      {d.vekalet && projectId ? (
        <a
          href={`/bagis-havuzu/${projectId}?vekalet=${encodeURIComponent(d.vekalet)}`}
          target="_blank"
          rel="noreferrer"
          className="block px-1 py-0.5 uppercase select-text text-blue-600 hover:underline"
        >
          {d.vekalet}
        </a>
      ) : (
        <EditableCell d={d} field="vekalet" isEditing={isEditing && editField === "vekalet"}
          editDraft={editDraft} onSetEditDraft={onSetEditDraft} onCommitEdit={onCommitEdit}
          onKeyDown={onKeyDown} onStartEditing={onStartEditing} displayValue={d.vekalet} />
      )}
    </td>
    <td className="p-2">
      <span className="block px-1 py-0.5 uppercase select-text">{d.description || "—"}</span>
    </td>
    <td className="p-2">
      <EditableCell d={d} field="name" isEditing={isEditing && editField === "name"}
        editDraft={editDraft} onSetEditDraft={onSetEditDraft} onCommitEdit={onCommitEdit}
        onKeyDown={onKeyDown} onStartEditing={onStartEditing} displayValue={d.name} />
    </td>
    <td className="p-2">
      <EditableCell d={d} field="donationType" isEditing={isEditing && editField === "donationType"}
        editDraft={editDraft} onSetEditDraft={onSetEditDraft} onCommitEdit={onCommitEdit}
        onKeyDown={onKeyDown} onStartEditing={onStartEditing} displayValue={d.donationType} />
    </td>
    <td className="p-2">
      <div className="flex gap-0.5 flex-wrap">
        {(d.aiCategories && d.aiCategories.length > 0) ? (
          <>
            {d.aiCategories.map(cat => (
              <span
                key={cat}
                className="px-1.5 leading-[18px] rounded text-[9px] font-medium bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700 whitespace-nowrap"
              >
                {cat}
              </span>
            ))}
            {d.aiWarnings && d.aiWarnings.trim() && (
              <span
                className="leading-[18px] px-1 rounded text-[9px] font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 flex items-center gap-0.5"
                title={d.aiWarnings}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </div>
    </td>
    <td className="p-2 text-center">
      {descCount > 1 ? (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-sm font-bold border border-amber-200 dark:border-amber-800">{effectiveShare}</span>
      ) : (
        <Select value={String(d.shareCount)} onValueChange={(v) => onUpdateField(d.id, "shareCount", parseInt(v))}>
          <SelectTrigger className="h-8 w-16 text-sm font-bold mx-auto"><SelectValue /></SelectTrigger>
          <SelectContent>{[1, 2, 3, 4, 5, 6, 7].map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}</SelectContent>
        </Select>
      )}
    </td>
    <td className="p-2">
      <div className="flex items-center gap-0.5">
        <Popover open={notePopoverOpen} onOpenChange={setNotePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 w-7 p-0 ${d.notes?.trim() ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
              title={d.notes?.trim() ? "Notu Gör" : "Not yok"}
            >
              <StickyNote className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="end" side="top">
            <p className="text-xs font-semibold mb-1.5 text-foreground">Not</p>
            {d.notes?.trim() ? (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{d.notes.trim()}</p>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic">Not eklenmemiş</p>
            )}
          </PopoverContent>
        </Popover>
        {(d.tags || []).length > 0 && globalTags.length > 0 && (
          <div className="flex gap-0.5 flex-wrap mr-1">
            {(d.tags || []).map(tagId => {
              const tag = globalTags.find(t => t.id === tagId);
              if (!tag) return null;
              return (<span key={tagId} className="px-1.5 py-0 rounded-full text-[9px] font-medium text-white leading-4" style={{ backgroundColor: tag.color }}>{tag.name}</span>);
            })}
          </div>
        )}
        {!d.excluded && (
          <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${isInBasket ? "bg-emerald-100 dark:bg-emerald-900 ring-1 ring-emerald-300" : ""}`}
            title={isInBasket ? "Sepetten Çıkar" : "Sepete Ekle"} aria-label={isInBasket ? "Sepetten Çıkar" : "Sepete Ekle"}
            onClick={() => isInBasket ? onRemoveFromBasket(d.id) : onAddToBasket(d.id)}>
            <ShoppingBag className={`w-3.5 h-3.5 ${isInBasket ? "text-emerald-600" : "text-muted-foreground"}`} />
          </Button>
        )}
        <DonorRowOverflowMenu
          d={d}
          isGrouped={isGrouped}
          canSplit={canSplit}
          splitShares={splitShares}
          globalTags={globalTags}
          tagPopoverOpen={tagPopoverOpen}
          onSetPersonEditDesc={onSetPersonEditDesc}
          onUpdateField={onUpdateField}
          onToggleTag={onToggleTag}
          onSetTagPopover={onSetTagPopover}
          onSmartPlace={onSmartPlace}
          onSplitShare={onSplitShare}
          onDelete={onDelete}
          onFlagDonation={onFlagDonation}
          onUnflagDonation={onUnflagDonation}
        />
      </div>
    </td>
  </>);
}

export const DonorRow = React.memo(DonorRowInner, (prev, next) => {
  if (prev.d !== next.d) return false;
  if (prev.idx !== next.idx) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isEditing !== next.isEditing) return false;
  if (prev.editField !== next.editField) return false;
  if (prev.isEditing && prev.editDraft !== next.editDraft) return false;
  if (prev.isInBasket !== next.isInBasket) return false;
  if (prev.isGrouped !== next.isGrouped) return false;
  if (prev.descCount !== next.descCount) return false;
  if (prev.effectiveShare !== next.effectiveShare) return false;
  if (prev.canSplit !== next.canSplit) return false;
  if (prev.splitShares !== next.splitShares) return false;
  if (prev.tagPopoverOpen !== next.tagPopoverOpen) return false;
  if (prev.globalTags !== next.globalTags) return false;
  return true;
});
