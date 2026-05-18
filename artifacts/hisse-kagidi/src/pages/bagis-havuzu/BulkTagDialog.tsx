import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tags, Plus, Loader2, PlusCircle, MinusCircle } from "lucide-react";
import type { CustomTag } from "@/lib/types";
import { turkishTitleCase } from "@/lib/formatting";

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
  const [processing, setProcessing] = useState<string | null>(null);
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewName("");
      setShowCreate(false);
      setProcessing(null);
      setCreatingTag(false);
    }
  }, [open]);

  async function handleTag(tagId: string, action: "add" | "remove") {
    setProcessing(`${tagId}:${action}`);
    try {
      await onTag(tagId, action);
      onOpenChange(false);
    } finally {
      setProcessing(null);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreatingTag(true);
    try {
      const tag = await onCreateTag(turkishTitleCase(newName.trim()), newColor);
      if (tag) {
        await onTag(tag.id, "add");
        onOpenChange(false);
      }
    } finally {
      setCreatingTag(false);
    }
  }

  const isAnyProcessing = processing !== null || creatingTag;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="w-5 h-5" />
            Toplu Etiketleme
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          <strong>{selectedCount}</strong> seçili bağışa etiket ekle veya kaldır.
        </p>

        {tags.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Etiket seç:</label>
            <div className="space-y-1">
              {tags.map(tag => {
                const addKey = `${tag.id}:add`;
                const removeKey = `${tag.id}:remove`;
                return (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 px-2 py-1 rounded-md border bg-card hover:bg-muted/40 transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-sm font-medium">{turkishTitleCase(tag.name)}</span>
                    <button
                      onClick={() => handleTag(tag.id, "add")}
                      disabled={isAnyProcessing}
                      title="Etiket ekle"
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-40 transition-colors"
                    >
                      {processing === addKey
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <PlusCircle className="w-3.5 h-3.5" />}
                      Ekle
                    </button>
                    <button
                      onClick={() => handleTag(tag.id, "remove")}
                      disabled={isAnyProcessing}
                      title="Etiketi kaldır"
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-40 transition-colors"
                    >
                      {processing === removeKey
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <MinusCircle className="w-3.5 h-3.5" />}
                      Kaldır
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t pt-3">
          {!showCreate ? (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" />Yeni Etiket Oluştur ve Ekle
            </Button>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Yeni etiket:</label>
              <Input
                placeholder="Etiket adı..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
                className="h-8 text-sm"
                autoFocus
              />
              {newName.trim() && (
                <p className="text-xs text-muted-foreground">
                  Görünüm: <strong>{turkishTitleCase(newName.trim())}</strong>
                </p>
              )}
              <div className="flex gap-1.5 flex-wrap">
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
      </DialogContent>
    </Dialog>
  );
}
