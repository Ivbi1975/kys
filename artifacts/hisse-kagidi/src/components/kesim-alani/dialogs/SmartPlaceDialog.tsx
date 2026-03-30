import type { KesimAlani } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wand2 } from "lucide-react";
import { computeEffectiveShares } from "@/lib/grouping";

interface SmartPlaceDialogProps {
  kesim: KesimAlani;
  smartPlacePopover: string | null;
  setSmartPlacePopover: (v: string | null) => void;
  smartPlaceDonor: (donationId: string, groupIdx: number) => void;
  getAvailableGroupsForDonor: (donationId: string) => Array<{ groupIdx: number; animalNo: number; emptySlots: number }>;
  getSwapSuggestions: (donationId: string) => Array<{ groupIdx: number; animalNo: number; description: string; swapOutIds: string[]; swapOutNames: string[] }>;
  executeSwapSuggestion: (donationId: string, groupIdx: number, swapOutIds: string[]) => void;
}

export function SmartPlaceDialog({
  kesim, smartPlacePopover, setSmartPlacePopover,
  smartPlaceDonor, getAvailableGroupsForDonor, getSwapSuggestions, executeSwapSuggestion,
}: SmartPlaceDialogProps) {
  if (smartPlacePopover === null) return null;

  const donor = kesim.donations.find(d => d.id === smartPlacePopover);
  if (!donor) return null;

  const available = getAvailableGroupsForDonor(smartPlacePopover);
  const swapSuggestions = getSwapSuggestions(smartPlacePopover);
  const effectiveShares = computeEffectiveShares(kesim.donations).get(donor.id) || donor.shareCount;

  return (
    <Dialog open={smartPlacePopover !== null} onOpenChange={(open) => { if (!open) setSmartPlacePopover(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            Akıllı Yerleştirme
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            <strong>{donor.description || donor.name}</strong> ({effectiveShares} hisse) nereye yerleştirilsin?
          </p>
          {available.length > 0 && (
            <>
              <p className="text-xs font-semibold text-primary">Doğrudan Yerleştirme</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {available.map(g => (
                  <Button
                    key={g.groupIdx}
                    variant="outline"
                    className="w-full justify-between h-auto py-2"
                    onClick={() => smartPlaceDonor(smartPlacePopover, g.groupIdx)}
                  >
                    <span className="font-semibold">Hayvan {g.animalNo}</span>
                    <span className="text-xs text-muted-foreground">{g.emptySlots} boş slot</span>
                  </Button>
                ))}
              </div>
            </>
          )}
          {swapSuggestions.length > 0 && (
            <>
              <p className="text-xs font-semibold text-amber-600">Takas Önerileri</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {swapSuggestions.map((s, i) => (
                  <Button
                    key={`swap-${i}`}
                    variant="outline"
                    className="w-full justify-between h-auto py-2 border-amber-300"
                    onClick={() => executeSwapSuggestion(smartPlacePopover, s.groupIdx, s.swapOutIds)}
                  >
                    <div className="text-left">
                      <span className="font-semibold block">Hayvan {s.animalNo}</span>
                      <span className="text-[10px] text-muted-foreground">{s.description}</span>
                    </div>
                    <span className="text-[10px] text-amber-600">{s.swapOutNames.join(", ")}</span>
                  </Button>
                ))}
              </div>
            </>
          )}
          {available.length === 0 && swapSuggestions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Uygun boşluğu olan veya takas yapılabilecek hayvan grubu bulunamadı.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
