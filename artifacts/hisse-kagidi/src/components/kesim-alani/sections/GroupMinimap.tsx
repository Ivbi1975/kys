import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapIcon } from "lucide-react";
import { useKesimAlaniContext } from "../KesimAlaniContext";

export function GroupMinimap() {
  const { kesim, minimapOpen, scrollToAnimalGroup, setMinimapOpen } = useKesimAlaniContext();

  if (!minimapOpen || !kesim || kesim.animalGroups.length === 0) return null;

  return (
    <Card className="p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <MapIcon className="w-4 h-4" />Genel Bakış
        </h3>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setMinimapOpen(false)}>✕</Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {kesim.animalGroups.map((group) => {
          const filled = group.donations.filter(d => d.name.trim() !== "").length;
          const ratio = filled / 7;
          let bg = "#ef4444";
          if (ratio >= 1) bg = "#22c55e";
          else if (ratio >= 0.5) bg = "#eab308";
          else if (ratio > 0) bg = "#f97316";
          return (
            <button key={group.id} className="w-7 h-7 rounded text-[10px] font-bold text-white flex items-center justify-center transition-transform hover:scale-110 hover:shadow-md" style={{ backgroundColor: bg }} title={`Hayvan ${group.animalNo}: ${filled}/7 dolu`} onClick={() => scrollToAnimalGroup(group.animalNo)}>
              {group.animalNo}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor:"#22c55e"}} /> Dolu (7/7)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor:"#eab308"}} /> Yarı dolu</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor:"#f97316"}} /> Az dolu</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor:"#ef4444"}} /> Boş</span>
      </div>
    </Card>
  );
}
