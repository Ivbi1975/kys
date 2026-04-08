import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Lock, Unlock } from "lucide-react";
import { useGroupContext } from "../KesimAlaniContext";

export function GroupBulkLockPopover() {
  const {
    applyRangeLock, kesim, lockAllGroups, rangeLockInput,
    setRangeLockInput, unlockAllGroups,
  } = useGroupContext();

  if (!kesim) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" title="Toplu Kilitleme">
          <Lock className="w-4 h-4 mr-1" />Kilit
          {kesim.animalGroups.filter(g => g.locked).length > 0 && (
            <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
              {kesim.animalGroups.filter(g => g.locked).length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-xs font-semibold mb-2">Toplu Kilitleme</p>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={lockAllGroups}><Lock className="w-3 h-3 mr-1" />Tümünü Kilitle</Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={unlockAllGroups}><Unlock className="w-3 h-3 mr-1" />Tümünü Aç</Button>
          </div>
          <div className="border-t pt-2">
            <p className="text-xs text-muted-foreground mb-2">Hayvan numarası aralığı veya çoklu seçim girin (örn: 1-5 veya 3, 7, 12)</p>
            <div className="flex gap-2">
              <Input className="h-8 text-sm flex-1" placeholder="1-5 veya 3, 7, 12" value={rangeLockInput} onChange={(e) => setRangeLockInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyRangeLock(true); }} />
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="default" size="sm" className="flex-1" onClick={() => applyRangeLock(true)} disabled={!rangeLockInput.trim()}><Lock className="w-3 h-3 mr-1" />Kilitle</Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => applyRangeLock(false)} disabled={!rangeLockInput.trim()}><Unlock className="w-3 h-3 mr-1" />Kilidi Aç</Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
