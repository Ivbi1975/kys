import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRightLeft, Undo2, Trash2, X, Tag, StickyNote, Info } from "lucide-react";
import type { DonorSiblings } from "@/lib/api/bagis-havuzu";
import type { PoolDonation } from "@/lib/types";
import { turkishTitleCase } from "@/lib/formatting";

interface PoolBulkActionsProps {
  selectedCount: number;
  siblingCount?: number;
  siblingsData?: DonorSiblings[];
  selectedDonations?: PoolDonation[];
  onTransferOpen: () => void;
  onBulkAction: (action: "exclude" | "include" | "delete") => void;
  onTagOpen: () => void;
  onNoteOpen: () => void;
  onClearSelection: () => void;
}

export function PoolBulkActions({
  selectedCount,
  siblingCount = 0,
  siblingsData = [],
  selectedDonations = [],
  onTransferOpen,
  onBulkAction,
  onTagOpen,
  onNoteOpen,
  onClearSelection,
}: PoolBulkActionsProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  if (selectedCount === 0) return null;

  const potentialTotal = selectedCount + siblingCount;
  const hiddenCount = selectedCount - selectedDonations.length;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 z-50">
        <button
          type="button"
          className="text-sm font-medium text-left hover:text-primary transition-colors cursor-pointer group flex items-center gap-1"
          onClick={() => setDetailOpen(true)}
          title="Detayları görmek için tıklayın"
        >
          <span>{selectedCount} bağış seçili</span>
          {siblingCount > 0 && (
            <span className="text-muted-foreground">
              {" "}(+{siblingCount} ek = {potentialTotal} toplam)
            </span>
          )}
          <Info className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>

        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={onTagOpen}>
            <Tag className="w-4 h-4 mr-1" />Etiketle
          </Button>
          <Button size="sm" variant="outline" onClick={onNoteOpen}>
            <StickyNote className="w-4 h-4 mr-1" />Not Ekle
          </Button>
          <Button size="sm" variant="outline" onClick={onTransferOpen}>
            <ArrowRightLeft className="w-4 h-4 mr-1" />
            Kesim Listesine Aktar
            {siblingCount > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({potentialTotal})</span>
            )}
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Seçim Özeti — {potentialTotal} bağış
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">
                  {selectedCount}
                </span>
                Seçili Bağışlar
              </h3>
              <ul className="space-y-1">
                {selectedDonations.map((d) => (
                  <li key={d.id} className="flex items-start gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{turkishTitleCase(d.name)}</p>
                      {d.vekalet && d.vekalet.trim() && (
                        <p className="text-xs text-muted-foreground truncate">
                          Vekalet: {turkishTitleCase(d.vekalet)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 text-xs text-muted-foreground">
                      <p>{d.shareCount} hisse</p>
                      {d.donationType && <p className="capitalize">{d.donationType}</p>}
                    </div>
                  </li>
                ))}
                {hiddenCount > 0 && (
                  <li className="text-xs text-muted-foreground italic py-1">
                    + {hiddenCount} bağış diğer sayfalarda (görüntülenmiyor)
                  </li>
                )}
              </ul>
            </section>

            {siblingsData.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs">
                    +{siblingCount}
                  </span>
                  Bağlı Ek Bağışlar
                  <span className="text-xs font-normal text-muted-foreground">(aynı bağışçıya ait, havuzda bekleyen)</span>
                </h3>
                <ul className="space-y-1">
                  {siblingsData.map((s) => (
                    <li key={s.donorName} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                      <p className="font-medium truncate flex-1">{turkishTitleCase(s.donorName)}</p>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {s.extraCount} ek kayıt
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
