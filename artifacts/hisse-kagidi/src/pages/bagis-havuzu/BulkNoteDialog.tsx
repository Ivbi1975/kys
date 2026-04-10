import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface BulkNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onSubmit: (note: string, mode: "append" | "replace") => Promise<void>;
}

export function BulkNoteDialog({ open, onOpenChange, selectedCount, onSubmit }: BulkNoteDialogProps) {
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(note.trim(), mode);
      setNote("");
      setMode("append");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Toplu Not Ekle</DialogTitle>
          <DialogDescription>
            {selectedCount} bağışa not eklenecek
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Not</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Eklenecek notu yazın..."
              className="mt-1 min-h-[80px]"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("append")}
              className={`flex-1 text-xs px-3 py-2 rounded-md border transition-colors ${mode === "append" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted/50"}`}
            >
              Mevcut notun sonuna ekle
            </button>
            <button
              onClick={() => setMode("replace")}
              className={`flex-1 text-xs px-3 py-2 rounded-md border transition-colors ${mode === "replace" ? "bg-destructive text-destructive-foreground border-destructive" : "bg-background border-input hover:bg-muted/50"}`}
            >
              Mevcut notu değiştir
            </button>
          </div>
          {mode === "replace" && (
            <p className="text-xs text-destructive">
              Dikkat: Bu işlem seçili {selectedCount} bağışın mevcut notlarını silecek ve yerine yeni notu yazacak.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={!note.trim() || submitting}>
            {submitting ? "Ekleniyor..." : `${selectedCount} Bağışa Ekle`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
