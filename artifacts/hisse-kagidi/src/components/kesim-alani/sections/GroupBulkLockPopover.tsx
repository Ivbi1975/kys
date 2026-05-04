import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, Unlock } from "lucide-react";
import { useGroupContext } from "../KesimAlaniContext";

interface GroupBulkLockDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GroupBulkLockPopover({ open, onOpenChange }: GroupBulkLockDialogProps) {
  const {
    applyRangeLock, kesim, lockAllGroups, rangeLockInput,
    setRangeLockInput, unlockAllGroups,
  } = useGroupContext();

  if (!kesim) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Toplu Kilitleme
            {kesim.animalGroups.filter(g => g.locked).length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                {kesim.animalGroups.filter(g => g.locked).length} kilitli
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={lockAllGroups}><Lock className="w-3 h-3 mr-1" />Tümünü Kilitle</Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={unlockAllGroups}><Unlock className="w-3 h-3 mr-1" />Tümünü Aç</Button>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground mb-2">Hayvan numarası aralığı veya çoklu seçim girin (örn: 1-5 veya 3, 7, 12)</p>
            <Input
              className="h-9 text-sm"
              placeholder="1-5 veya 3, 7, 12"
              value={rangeLockInput}
              onChange={(e) => setRangeLockInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyRangeLock(true); }}
            />
            <div className="flex gap-2 mt-2">
              <Button variant="default" size="sm" className="flex-1" onClick={() => applyRangeLock(true)} disabled={!rangeLockInput.trim()}><Lock className="w-3 h-3 mr-1" />Kilitle</Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => applyRangeLock(false)} disabled={!rangeLockInput.trim()}><Unlock className="w-3 h-3 mr-1" />Kilidi Aç</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
