import React from "react";
import type { Donation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertTriangle, Eye, EyeOff, Scissors, ShoppingBag, Tag, Trash2, UserCog, Wand2,
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
}

function EditableCell({
  d, field, isEditing, editDraft, onSetEditDraft, onCommitEdit, onKeyDown, onStartEditing, displayValue,
}: {
  d: Donation; field: string; isEditing: boolean; editDraft: string;
  onSetEditDraft: (v: string) => void; onCommitEdit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, id: string, field: string) => void;
  onStartEditing: (id: string, field: string) => void; displayValue: string;
}) {
  if (isEditing) {
    return (
      <Input className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5" value={editDraft}
        onChange={(e) => onSetEditDraft(e.target.value)} onBlur={() => onCommitEdit()}
        onKeyDown={(e) => onKeyDown(e, d.id, field)} autoFocus />
    );
  }
  return (
    <span className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
      onClick={() => onStartEditing(d.id, field)}>{displayValue || "—"}</span>
  );
}

function DonorRowInner({
  d, idx, descCount, effectiveShare, isSelected, isEditing, editField, editDraft,
  isInBasket, isGrouped, canSplit, splitShares, globalTags, tagPopoverOpen,
  onToggleSelect, onStartEditing, onSetEditDraft, onCommitEdit, onKeyDown,
  onSetPersonEditDesc, onUpdateField, onToggleTag, onSetTagPopover,
  onAddToBasket, onRemoveFromBasket, onSmartPlace, onSplitShare, onDelete,
}: DonorRowProps) {
  return (<>
    <td className="p-2"><input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(d.id)} className="rounded" /></td>
    <td className="p-2 text-muted-foreground">{idx + 1}</td>
    <td className="p-2">
      <EditableCell d={d} field="vekalet" isEditing={isEditing && editField === "vekalet"}
        editDraft={editDraft} onSetEditDraft={onSetEditDraft} onCommitEdit={onCommitEdit}
        onKeyDown={onKeyDown} onStartEditing={onStartEditing} displayValue={d.vekalet} />
    </td>
    <td className="p-2">
      {isEditing && editField === "description" ? (
        <Input className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5" value={editDraft}
          onChange={(e) => onSetEditDraft(e.target.value)} onBlur={() => onCommitEdit()}
          onKeyDown={(e) => onKeyDown(e, d.id, "description")} autoFocus />
      ) : (
        <div className="flex items-center gap-1">
          <span className="cursor-text flex-1 block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
            onClick={() => onStartEditing(d.id, "description")}>{d.description || "—"}</span>
          {d.description && descCount > 1 && (
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0"
              title="Bu kişinin tüm kayıtlarını düzenle" aria-label="Bu kişinin tüm kayıtlarını düzenle"
              onClick={() => onSetPersonEditDesc(d.description)}><UserCog className="w-3 h-3 text-muted-foreground" /></Button>
          )}
        </div>
      )}
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
      {isEditing && editField === "notes" ? (
        <Input className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5" value={editDraft}
          onChange={(e) => onSetEditDraft(e.target.value)} onBlur={() => onCommitEdit()}
          onKeyDown={(e) => onKeyDown(e, d.id, "notes")} autoFocus />
      ) : (
        <div className="flex flex-col gap-0.5">
          <span className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
            onClick={() => onStartEditing(d.id, "notes")}>{d.notes || "—"}</span>
          {((d.aiCategories && d.aiCategories.length > 0) || (d.aiWarnings && d.aiWarnings.trim())) && (
            <div className="flex gap-0.5 flex-wrap px-1">
              {(d.aiCategories || []).map(cat => (
                <span key={cat} className="px-1.5 py-0 rounded-full text-[9px] font-medium bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">{cat}</span>
              ))}
              {d.aiWarnings && d.aiWarnings.trim() && (
                <span className="px-1.5 py-0 rounded-full text-[9px] font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-0.5" title={d.aiWarnings}>
                  <AlertTriangle className="w-2.5 h-2.5" /> uyarı
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </td>
    <td className="p-2 text-center">
      {descCount > 1 ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">{effectiveShare}</span>
      ) : (
        <Select value={String(d.shareCount)} onValueChange={(v) => onUpdateField(d.id, "shareCount", parseInt(v))}>
          <SelectTrigger className="h-7 w-16 text-sm mx-auto"><SelectValue /></SelectTrigger>
          <SelectContent>{[1, 2, 3, 4, 5, 6, 7].map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}</SelectContent>
        </Select>
      )}
    </td>
    <td className="p-2">
      <div className="flex items-center gap-1 flex-wrap">
        {(d.tags || []).length > 0 && globalTags.length > 0 && (
          <div className="flex gap-0.5 flex-wrap mr-1">
            {(d.tags || []).map(tagId => {
              const tag = globalTags.find(t => t.id === tagId);
              if (!tag) return null;
              return (<span key={tagId} className="px-1.5 py-0 rounded-full text-[9px] font-medium text-white leading-4" style={{ backgroundColor: tag.color }}>{tag.name}</span>);
            })}
          </div>
        )}
        {globalTags.length > 0 && (
          <Popover open={tagPopoverOpen} onOpenChange={(open) => onSetTagPopover(open ? d.id : null)}>
            <PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Etiket ata" aria-label="Etiket ata"><Tag className="w-3 h-3 text-muted-foreground" /></Button></PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="end">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">Etiket Ata</p>
                {globalTags.map(tag => {
                  const isActive = (d.tags || []).includes(tag.id);
                  return (
                    <button key={tag.id} className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted transition-colors ${isActive ? "bg-muted" : ""}`}
                      onClick={() => onToggleTag(d.id, tag.id)}>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1 text-left">{tag.name}</span>
                      {isActive && <span className="text-primary">✓</span>}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {!d.excluded && (
          <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${isInBasket ? "bg-emerald-100 dark:bg-emerald-900" : ""}`}
            title={isInBasket ? "Sepetten Çıkar" : "Sepete Ekle"} aria-label={isInBasket ? "Sepetten Çıkar" : "Sepete Ekle"}
            onClick={() => isInBasket ? onRemoveFromBasket(d.id) : onAddToBasket(d.id)}>
            <ShoppingBag className={`w-3 h-3 ${isInBasket ? "text-emerald-600" : "text-muted-foreground"}`} />
          </Button>
        )}
        {!d.excluded && !isGrouped && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Akıllı Yerleştir" aria-label="Akıllı Yerleştir"
            onClick={() => onSmartPlace(d.id)}><Wand2 className="w-3 h-3 text-primary" /></Button>
        )}
        {canSplit && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Hisse Böl" aria-label="Hisse Böl"
            onClick={() => onSplitShare({ donationId: d.id, totalShares: splitShares })}><Scissors className="w-3 h-3 text-amber-600" /></Button>
        )}
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
          title={d.excluded ? "Dahil et" : "Hariç tut"} aria-label={d.excluded ? "Dahil et" : "Hariç tut"}
          onClick={() => onUpdateField(d.id, "excluded", !d.excluded)}>
          {d.excluded ? <Eye className="w-3 h-3 text-green-600" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Bağışçıyı sil"
          onClick={() => onDelete(d.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
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
