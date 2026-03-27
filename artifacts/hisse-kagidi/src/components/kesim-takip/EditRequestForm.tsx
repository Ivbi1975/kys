import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Edit3, X } from "lucide-react";
import { createTrackingNote } from "@/lib/api";
import type { TrackingNote, TrackingGroup } from "@/lib/api";
import { FIELD_LABELS, NoteType } from "@/lib/constants";
import type { DonorFieldKey } from "@/lib/constants";

export function EditRequestForm({
  donor,
  donorIndex,
  groupId,
  token,
  onNoteAdded,
  onClose,
  initialField,
}: {
  donor: TrackingGroup["donors"][0];
  donorIndex: number;
  groupId: string;
  token: string;
  onNoteAdded: (note: TrackingNote) => void;
  onClose: () => void;
  initialField?: DonorFieldKey;
}) {
  const [field, setField] = useState<DonorFieldKey>(initialField || "name");
  const [newValue, setNewValue] = useState("");
  const [sending, setSending] = useState(false);

  const currentValue = donor[field] || "";

  const handleSubmit = async () => {
    if (!newValue.trim() || sending) return;
    setSending(true);
    try {
      const note = await createTrackingNote(token, {
        animalGroupId: groupId,
        type: NoteType.EDIT_REQUEST,
        content: `Sıra ${donorIndex + 1}: ${FIELD_LABELS[field] || field} değişiklik talebi`,
        fieldName: field,
        oldValue: currentValue,
        newValue: newValue.trim(),
      });
      onNoteAdded(note);
      onClose();
    } catch {
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
          <Edit3 className="w-3 h-3" /> Düzenleme Talebi — Sıra {donorIndex + 1}
        </span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {(Object.entries(FIELD_LABELS) as [DonorFieldKey, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              field === key
                ? "bg-amber-200 dark:bg-amber-800 border-amber-400 font-semibold"
                : "bg-background border-border"
            }`}
            onClick={() => { setField(key); setNewValue(""); }}
          >
            {label}
          </button>
        ))}
      </div>
      {currentValue && (
        <div className="text-xs">
          <span className="text-muted-foreground">Mevcut: </span>
          <span className="line-through text-red-500">{currentValue}</span>
        </div>
      )}
      <Input
        placeholder="Yeni değer..."
        value={newValue}
        onChange={(e) => setNewValue(e.target.value)}
        className="h-8 text-sm"
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
      />
      <Button size="sm" className="w-full h-8" onClick={handleSubmit} disabled={!newValue.trim() || sending}>
        {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
        Talep Gönder
      </Button>
    </div>
  );
}
