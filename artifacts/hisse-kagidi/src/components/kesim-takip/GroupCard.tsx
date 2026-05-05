import { memo } from "react";
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
  const colorBorder = group.colorTag && COLOR_MAP[group.colorTag] ? COLOR_MAP[group.colorTag] : null;

  return (
    <div className="pb-2">
      <div
        className={`relative bg-white rounded-xl shadow-sm border transition-all duration-150 active:scale-[0.99] cursor-pointer overflow-hidden ${
          group.kesildi
            ? "border-teal-200 bg-teal-50/60"
            : "border-stone-100 hover:border-stone-200 hover:shadow-md"
        }`}
        style={colorBorder ? { borderLeftColor: colorBorder, borderLeftWidth: "4px" } : {}}
        onClick={() => onSelect(index)}
        role="button"
        tabIndex={0}
        aria-label={`Hayvan ${group.animalNo}, ${group.filledCount}/7 dolu${group.kesildi ? ", kesildi" : ", bekliyor"}`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(index); } }}
      >
        <div className="flex items-center gap-3 p-3">
          <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base ${
            group.kesildi
              ? "bg-teal-100 text-teal-700"
              : "bg-stone-100 text-stone-600"
          }`}>
            {group.animalNo}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className="font-semibold text-sm text-stone-800">Hayvan {group.animalNo}</span>
              <span className="text-[11px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-md font-medium">
                {group.filledCount}/7
              </span>
              {group.kesildi && group.kesildiAt && (
                <span className="text-[11px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  {formatKesildiTime(group.kesildiAt)}
                </span>
              )}
              {group.kesildi && !group.kesildiAt && (
                <span className="text-[11px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  Kesildi
                </span>
              )}
              {team && (
                <span
                  className="text-[11px] px-1.5 py-0.5 rounded-md font-medium"
                  style={{ backgroundColor: team.color + "1a", color: team.color }}
                >
                  {team.name}
                </span>
              )}
              {noteCount > 0 && (
                <span className="text-[11px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5">
                  <MessageSquarePlus className="w-3 h-3" aria-hidden="true" />
                  {noteCount}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 truncate leading-relaxed">
              {group.donors.slice(0, 3).map(d => d.description || d.name).join(" · ")}
              {group.donors.length > 3 && (
                <span className="text-stone-300"> +{group.donors.length - 3}</span>
              )}
            </p>
          </div>

          <button
            className={`shrink-0 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all ${
              group.kesildi
                ? "bg-teal-500 text-white shadow-sm shadow-teal-200 hover:bg-teal-600"
                : "bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-600"
            }`}
            onClick={(e) => { e.stopPropagation(); onToggle(group); }}
            aria-label={group.kesildi ? `Hayvan ${group.animalNo} kesim işaretini kaldır` : `Hayvan ${group.animalNo} kesildi olarak işaretle`}
            disabled={isToggling}
          >
            {isToggling ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : group.kesildi ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
