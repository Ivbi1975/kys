import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Undo2, Trash2, X, Tag, StickyNote } from "lucide-react";

interface PoolBulkActionsProps {
  selectedCount: number;
  onTransferOpen: () => void;
  onBulkAction: (action: "exclude" | "include" | "delete") => void;
  onTagOpen: () => void;
  onNoteOpen: () => void;
  onClearSelection: () => void;
}

export function PoolBulkActions({ selectedCount, onTransferOpen, onBulkAction, onTagOpen, onNoteOpen, onClearSelection }: PoolBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 z-50">
      <span className="text-sm font-medium">{selectedCount} bağış seçili</span>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" onClick={onTagOpen}>
          <Tag className="w-4 h-4 mr-1" />Etiketle
        </Button>
        <Button size="sm" variant="outline" onClick={onNoteOpen}>
          <StickyNote className="w-4 h-4 mr-1" />Not Ekle
        </Button>
        <Button size="sm" variant="outline" onClick={onTransferOpen}>
          <ArrowRightLeft className="w-4 h-4 mr-1" />Kesim Listesine Aktar
        </Button>
        <Button size="sm" variant="outline" onClick={() => onBulkAction("exclude")}>
          <X className="w-4 h-4 mr-1" />Sepetten Çıkar
        </Button>
        <Button size="sm" variant="outline" onClick={() => onBulkAction("include")}>
          <Undo2 className="w-4 h-4 mr-1" />Sepete Ekle
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onBulkAction("delete")}>
          <Trash2 className="w-4 h-4 mr-1" />Sil
        </Button>
        <Button size="sm" variant="ghost" onClick={onClearSelection}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
