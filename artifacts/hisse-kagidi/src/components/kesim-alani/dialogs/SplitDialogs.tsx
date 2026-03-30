import type { KesimAlani } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Scissors } from "lucide-react";

interface SplitDialogsProps {
  kesim: KesimAlani;
  splitShareDialog: { donationId: string; totalShares: number } | null;
  setSplitShareDialog: (v: { donationId: string; totalShares: number } | null) => void;
  getSplitOptions: (total: number) => [number, number][];
  applySplitShare: (donationId: string, a: number, b: number) => void;
  splitGroupDialog: { groupIdx: number; splitAt: number } | null;
  setSplitGroupDialog: (v: { groupIdx: number; splitAt: number } | null) => void;
  executeSplitGroup: () => void;
}

export function SplitDialogs({
  kesim, splitShareDialog, setSplitShareDialog, getSplitOptions, applySplitShare,
  splitGroupDialog, setSplitGroupDialog, executeSplitGroup,
}: SplitDialogsProps) {
  return (
    <>
      {splitShareDialog !== null && <Dialog open={splitShareDialog !== null} onOpenChange={(open) => { if (!open) setSplitShareDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primary" />
              Hisse Bölme
            </DialogTitle>
          </DialogHeader>
          {splitShareDialog && (() => {
            const donor = kesim.donations.find(d => d.id === splitShareDialog.donationId);
            if (!donor) return null;
            const options = getSplitOptions(splitShareDialog.totalShares);
            return (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  <strong>{donor.description || donor.name}</strong> — {splitShareDialog.totalShares} hisse nasıl bölünsün?
                </p>
                <div className="space-y-2">
                  {options.map(([a, b], i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="w-full justify-between h-auto py-3"
                      onClick={() => applySplitShare(splitShareDialog.donationId, a, b)}
                    >
                      <span className="font-semibold">{a} + {b}</span>
                      <span className="text-xs text-muted-foreground">
                        {a === b ? "Eşit bölme" : a === 7 ? "Maksimum + kalan" : `Dengeli bölme`}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>}

      {splitGroupDialog !== null && <Dialog open={splitGroupDialog !== null} onOpenChange={(open) => { if (!open) setSplitGroupDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primary" />
              Grubu Böl
            </DialogTitle>
          </DialogHeader>
          {splitGroupDialog && (() => {
            const group = kesim.animalGroups[splitGroupDialog.groupIdx];
            if (!group) return null;
            const filled = group.donations.filter(d => d.name.trim() !== "");
            return (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Hayvan {group.animalNo}</strong> — {filled.length} bağışçıyı nerede bölmek istiyorsunuz?
                </p>
                <div className="space-y-1">
                  {filled.map((d, i) => {
                    if (i === 0) return null;
                    const isCurrent = splitGroupDialog.splitAt === i;
                    return (
                      <button
                        key={d.id}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors border ${
                          isCurrent
                            ? "border-primary bg-primary/10 font-medium"
                            : "border-transparent hover:bg-muted"
                        }`}
                        onClick={() => setSplitGroupDialog({ ...splitGroupDialog, splitAt: i })}
                      >
                        <span className="text-muted-foreground mr-2">{i}/{filled.length - i}</span>
                        İlk {i}: {filled.slice(0, i).map(dd => dd.description || dd.name).join(", ")}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setSplitGroupDialog(null)}>İptal</Button>
                  <Button onClick={executeSplitGroup}>
                    <Scissors className="w-3 h-3 mr-1" />
                    {splitGroupDialog.splitAt}/{filled.length - splitGroupDialog.splitAt} Olarak Böl
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>}
    </>
  );
}
