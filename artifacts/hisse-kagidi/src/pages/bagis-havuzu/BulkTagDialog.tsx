import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tag, Plus, Loader2 } from "lucide-react";
import type { CustomTag } from "@/lib/types";

interface BulkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: CustomTag[];
  selectedCount: number;
  onTag: (tagId: string, action: "add" | "remove") => Promise<void>;
  onCreateTag: (name: string, color: string) => Promise<CustomTag | null>;
}

const TAG_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

export function BulkTagDialog({
  open, onOpenChange, tags, selectedCount, onTag, onCreateTag,
}: BulkTagDialogProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [showCreate, setShowCreate] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewName("");
      setShowCreate(false);
      setProcessing(false);
      setCreatingTag(false);
    }
  }, [open]);

  async function handleTag(tagId: string) {
    setProcessing(true);
    try {
      await onTag(tagId, "add");
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreatingTag(true);
    try {
      const tag = await onCreateTag(newName.trim(), newColor);
      if (tag) {
        await onTag(tag.id, "add");
        onOpenChange(false);
      }
    } finally {
      setCreatingTag(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Sonuçları Etiketle
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          <strong>{selectedCount}</strong> bağışa etiket eklenecek.
        </p>

        {tags.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mevcut etiket seç:</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleTag(tag.id)}
                  disabled={processing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border hover:bg-muted/50 transition-colors text-sm disabled:opacity-50"
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-3">
          {!showCreate ? (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" />Yeni Etiket Oluştur
            </Button>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Yeni etiket:</label>
              <Input
                placeholder="Etiket adı..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
                className="h-8 text-sm"
                autoFocus
              />
              <div className="flex gap-1.5">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleCreate}
                  disabled={!newName.trim() || creatingTag}
                >
                  {creatingTag && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Oluştur ve Etiketle
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>İptal</Button>
              </div>
            </div>
          )}
        </div>

        {processing && (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Etiketleniyor...</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
