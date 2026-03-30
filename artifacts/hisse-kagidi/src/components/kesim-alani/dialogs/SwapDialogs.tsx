import type { KesimAlani } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, ArrowLeftRight, Sparkles } from "lucide-react";

interface SwapDialogsProps {
  kesim: KesimAlani;
  swapPreviewOpen: boolean;
  cancelSwap: () => void;
  swapSelection: { groupIdx: number; donationIdx: number } | null;
  swapTarget: { groupIdx: number; donationIdx: number } | null;
  executeSwap: () => void;
  autoResolveOpen: boolean;
  setAutoResolveOpen: (open: boolean) => void;
  resolveResults: Array<{ desc: string; swaps: Array<{ fromGroup: number; fromIdx: number; toGroup: number; toIdx: number; fromName: string; toName: string }> }>;
  applyAutoResolve: () => void;
}

export function SwapDialogs({
  kesim, swapPreviewOpen, cancelSwap, swapSelection, swapTarget, executeSwap,
  autoResolveOpen, setAutoResolveOpen, resolveResults, applyAutoResolve,
}: SwapDialogsProps) {
  return (
    <>
      {swapPreviewOpen && <Dialog open={swapPreviewOpen} onOpenChange={(open) => { if (!open) cancelSwap(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-purple-600" />
              Takas Önizleme
            </DialogTitle>
          </DialogHeader>
          {swapSelection && swapTarget && (() => {
            const srcDonor = kesim.animalGroups[swapSelection.groupIdx]?.donations[swapSelection.donationIdx];
            const tgtDonor = kesim.animalGroups[swapTarget.groupIdx]?.donations[swapTarget.donationIdx];
            const srcShare = srcDonor?.shareCount || 1;
            const tgtShare = tgtDonor?.shareCount || 1;
            const shareMismatch = srcShare !== tgtShare;
            return (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-950">
                    <p className="text-xs text-muted-foreground mb-1">
                      Hayvan {kesim.animalGroups[swapSelection.groupIdx]?.animalNo}, Sıra {swapSelection.donationIdx + 1}
                    </p>
                    <p className="font-semibold text-sm">{srcDonor?.description || "—"}</p>
                    <p className="text-xs text-muted-foreground">{srcDonor?.name || "—"}</p>
                    <p className="text-xs mt-1 font-medium">{srcShare} hisse</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-950">
                    <p className="text-xs text-muted-foreground mb-1">
                      Hayvan {kesim.animalGroups[swapTarget.groupIdx]?.animalNo}, Sıra {swapTarget.donationIdx + 1}
                    </p>
                    <p className="font-semibold text-sm">{tgtDonor?.description || "—"}</p>
                    <p className="text-xs text-muted-foreground">{tgtDonor?.name || "—"}</p>
                    <p className="text-xs mt-1 font-medium">{tgtShare} hisse</p>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowLeftRight className="w-6 h-6 text-purple-400" />
                </div>
                {shareMismatch && (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Hisse sayıları farklı ({srcShare} ↔ {tgtShare}). Takas sonrası grup toplamları değişecek.</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={cancelSwap} className="flex-1">İptal</Button>
                  <Button onClick={executeSwap} className="flex-1">
                    <ArrowLeftRight className="w-4 h-4 mr-1" />
                    Takas Et
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>}

      {autoResolveOpen && <Dialog open={autoResolveOpen} onOpenChange={setAutoResolveOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              Otomatik Çakışma Çözümü
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {resolveResults.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Otomatik çözülebilecek çakışma bulunamadı. Bazı gruplar kilitli olabilir veya uygun takas bulunamadı.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {resolveResults.length} kişi için toplam {resolveResults.reduce((sum, r) => sum + r.swaps.length, 0)} takas öneriliyor:
                </p>
                <div className="space-y-3">
                  {resolveResults.map((result, i) => (
                    <Card key={i} className="p-3">
                      <p className="font-semibold text-sm mb-2">{result.desc}</p>
                      <div className="space-y-1">
                        {result.swaps.map((swap, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Hayvan {kesim.animalGroups[swap.fromGroup]?.animalNo} #{swap.fromIdx + 1}</span>
                            <ArrowLeftRight className="w-3 h-3" />
                            <span>Hayvan {kesim.animalGroups[swap.toGroup]?.animalNo} #{swap.toIdx + 1}</span>
                            <span className="text-xs opacity-60">({swap.fromName} ↔ {swap.toName})</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setAutoResolveOpen(false)} className="flex-1">İptal</Button>
                  <Button onClick={applyAutoResolve} className="flex-1">
                    <Sparkles className="w-4 h-4 mr-1" />
                    Tümünü Uygula
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>}
    </>
  );
}
