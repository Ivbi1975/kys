import { memo } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2, MessageSquarePlus, Clock } from "lucide-react";
import { formatKesildiTime } from "@/lib/formatting";
import { COLOR_MAP } from "@/lib/constants";
import type { TrackingGroup, TrackingTeam } from "@/lib/api";

export const GroupCard = memo(function GroupCard({
  group,
  index,
  isToggling,
  noteCount,
  teams,
  onToggle,
  onSelect,
}: {
  group: TrackingGroup;
  index: number;
  isToggling: boolean;
  noteCount: number;
  teams: TrackingTeam[];
  onToggle: (group: TrackingGroup) => void;
  onSelect: (index: number) => void;
}) {
  const team = group.teamId ? teams.find(t => t.id === group.teamId) : null;
  return (
    <div className="pb-2">
      <Card
        className={`p-3 cursor-pointer transition-all active:scale-[0.98] ${
          group.kesildi
            ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800"
            : "hover:bg-muted/50"
        }`}
        style={group.colorTag && COLOR_MAP[group.colorTag] ? { borderLeft: `4px solid ${COLOR_MAP[group.colorTag]}` } : {}}
        onClick={() => onSelect(index)}
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0" onClick={(e) => { e.stopPropagation(); onToggle(group); }}>
            {isToggling ? (
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            ) : group.kesildi ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : (
              <Circle className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">Hayvan {group.animalNo}</span>
              <span className="text-xs text-muted-foreground">({group.filledCount}/7 dolu)</span>
              {noteCount > 0 && (
                <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                  <MessageSquarePlus className="w-2.5 h-2.5" />
                  {noteCount}
                </span>
              )}
              {team && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: team.color + "20", color: team.color }}
                >
                  {team.name}
                </span>
              )}
              {group.kesildi && (
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                  Kesildi
                  {group.kesildiAt && (
                    <>
                      <Clock className="w-2.5 h-2.5" />
                      {formatKesildiTime(group.kesildiAt)}
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {group.donors.slice(0, 3).map(d => d.description || d.name).join(", ")}
              {group.donors.length > 3 && ` +${group.donors.length - 3}`}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
});
