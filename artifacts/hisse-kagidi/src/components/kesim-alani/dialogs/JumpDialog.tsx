import { useState } from "react";
import type { KesimAlani } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";

interface JumpDialogProps {
  kesim: KesimAlani;
  jumpDialogOpen: boolean;
  setJumpDialogOpen: (v: boolean) => void;
  scrollToAnimalGroup: (animalNo: number) => void;
  toast: (opts: { title: string; variant?: "default" | "destructive" | null }) => void;
  showScrollTop: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  fullscreenMode: boolean;
  basketItems: Array<{ donationId: string }>;
  basketOpen: boolean;
}

export function JumpDialog({
  kesim, jumpDialogOpen, setJumpDialogOpen,
  scrollToAnimalGroup, toast,
  showScrollTop, scrollContainerRef, fullscreenMode,
  basketItems, basketOpen,
}: JumpDialogProps) {
  const [jumpDialogValue, setJumpDialogValue] = useState("");

  return (
    <>
      {jumpDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={() => { setJumpDialogOpen(false); setJumpDialogValue(""); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-background rounded-2xl shadow-2xl border p-6 w-[340px] flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium text-muted-foreground">Hayvan Numarasına Git</div>
            <input
              autoFocus
              type="number"
              min={1}
              className="w-full text-center text-4xl font-bold border-2 border-primary/30 focus:border-primary rounded-xl px-4 py-3 bg-background outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="No"
              value={jumpDialogValue}
              onChange={(e) => setJumpDialogValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && jumpDialogValue.trim()) {
                  const targetNo = parseInt(jumpDialogValue.trim(), 10);
                  const exists = kesim.animalGroups.some(g => g.animalNo === targetNo);
                  if (exists) {
                    scrollToAnimalGroup(targetNo);
                    setJumpDialogOpen(false);
                    setJumpDialogValue("");
                  } else {
                    toast({ title: `Hayvan No ${jumpDialogValue} bulunamadı`, variant: "destructive" });
                  }
                }
                if (e.key === "Escape") {
                  setJumpDialogOpen(false);
                  setJumpDialogValue("");
                }
              }}
            />
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => { setJumpDialogOpen(false); setJumpDialogValue(""); }} className="flex-1">
                İptal
              </Button>
              <Button
                onClick={() => {
                  if (!jumpDialogValue.trim()) return;
                  const targetNo = parseInt(jumpDialogValue.trim(), 10);
                  const exists = kesim.animalGroups.some(g => g.animalNo === targetNo);
                  if (exists) {
                    scrollToAnimalGroup(targetNo);
                    setJumpDialogOpen(false);
                    setJumpDialogValue("");
                  } else {
                    toast({ title: `Hayvan No ${jumpDialogValue} bulunamadı`, variant: "destructive" });
                  }
                }}
                className="flex-1"
              >
                Git
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Ctrl+G ile açılır</p>
          </div>
        </div>
      )}

      {showScrollTop && (
        <button
          className={`fixed right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all ${basketItems.length > 0 ? (basketOpen ? "bottom-36" : "bottom-16") : "bottom-6"}`}
          onClick={() => {
            const container = scrollContainerRef.current;
            if (container && fullscreenMode) {
              container.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          title="En yukarı kaydır"
        >
          <ArrowUp className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      )}
    </>
  );
}
