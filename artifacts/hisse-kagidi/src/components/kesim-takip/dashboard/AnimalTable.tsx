import { memo, useState, useCallback } from "react";
import { GripVertical, CheckCircle2, Circle, Loader2, MessageSquarePlus, Clock } from "lucide-react";
import { formatKesildiTime } from "@/lib/formatting";
import { COLOR_MAP } from "@/lib/constants";
import type { TrackingGroup, TrackingTeam } from "@/lib/api";

interface AnimalTableProps {
  groups: TrackingGroup[];
  toggling: Set<string>;
  noteCountByGroup: Record<string, number>;
  teams: TrackingTeam[];
  onToggle: (group: TrackingGroup) => void;
  onSelect: (index: number) => void;
  emptyState: "no-data" | "no-match";
  onClearFilter?: () => void;
  onReorder?: (orderedIds: string[]) => void;
  isDragEnabled?: boolean;
}

export function AnimalTable({
  groups,
  toggling,
  noteCountByGroup,
  teams,
  onToggle,
  onSelect,
  emptyState,
  onClearFilter,
  onReorder,
  isDragEnabled = false,
}: AnimalTableProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ id: string; position: "before" | "after" } | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, group: TrackingGroup) => {
    setDragId(group.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", group.id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, group: TrackingGroup) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: "before" | "after" = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDragOver(prev =>
      prev?.id === group.id && prev.position === position ? prev : { id: group.id, position }
    );
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDragOver(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetGroup: TrackingGroup) => {
    e.preventDefault();
    if (!dragId || dragId === targetGroup.id || !onReorder) {
      setDragId(null);
      setDragOver(null);
      return;
    }

    const fromIdx = groups.findIndex(g => g.id === dragId);
    const targetIdx = groups.findIndex(g => g.id === targetGroup.id);
    if (fromIdx === -1 || targetIdx === -1) {
      setDragId(null);
      setDragOver(null);
      return;
    }

    const position = dragOver?.position ?? "after";
    const newGroups = [...groups];
    const [moved] = newGroups.splice(fromIdx, 1);
    let insertAt: number;
    if (fromIdx < targetIdx) {
      insertAt = position === "before" ? targetIdx - 1 : targetIdx;
    } else {
      insertAt = position === "before" ? targetIdx : targetIdx + 1;
    }
    newGroups.splice(insertAt, 0, moved);
    onReorder(newGroups.map(g => g.id));
    setDragId(null);
    setDragOver(null);
  }, [dragId, dragOver, groups, onReorder]);

  if (groups.length === 0) {
    return (
      <div
        className="rounded-2xl border flex flex-col items-center justify-center py-16 text-center"
        style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.14)" }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "rgba(148,163,184,0.08)" }}
        >
          <Circle className="w-6 h-6" style={{ color: "#94a3b8" }} aria-hidden="true" />
        </div>
        {emptyState === "no-match" ? (
          <>
            <p className="text-sm font-semibold mb-1" style={{ color: "#cbd5e1" }}>Sonuç bulunamadı</p>
            <p className="text-xs mb-4" style={{ color: "#94a3b8" }}>Arama veya filtre kriterlerini değiştirerek tekrar deneyin</p>
            {onClearFilter && (
              <button
                onClick={onClearFilter}
                className="text-xs px-4 py-2 rounded-xl font-medium transition-all"
                style={{ background: "rgba(0,201,134,0.14)", color: "#00c986" }}
              >
                Filtreleri Temizle
              </button>
            )}
          </>
        ) : (
          <p className="text-sm" style={{ color: "#94a3b8" }}>Henüz hayvan grubu oluşturulmamış</p>
        )}
      </div>
    );
  }

  const headerCols = isDragEnabled
    ? ["", "#", "Hayvan", "Vekalet / Sahip", "Ekip", "Kesim Zamanı", "Durum", ""]
    : ["#", "Hayvan", "Vekalet / Sahip", "Ekip", "Kesim Zamanı", "Durum", ""];

  return (
    <>
      {/* Desktop table */}
      <div
        className="hidden sm:block rounded-2xl border overflow-hidden"
        style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.14)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.10)" }}>
                {headerCols.map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-4 py-3 text-xs font-semibold whitespace-nowrap"
                    style={{ color: "#94a3b8", ...(isDragEnabled && i === 0 ? { width: "32px", paddingRight: 0 } : {}) }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group, idx) => {
                const isDragging = dragId === group.id;
                const isDropTarget = dragOver?.id === group.id;
                return (
                  <AnimalRow
                    key={group.id}
                    group={group}
                    index={idx}
                    isToggling={toggling.has(group.id)}
                    noteCount={noteCountByGroup[group.id] || 0}
                    teams={teams}
                    onToggle={onToggle}
                    onSelect={onSelect}
                    isDragEnabled={isDragEnabled}
                    isDragging={isDragging}
                    dropPosition={isDropTarget ? dragOver!.position : null}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDrop={handleDrop}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div
          className="flex items-center justify-between px-4 py-3 border-t text-xs"
          style={{ borderColor: "rgba(148,163,184,0.10)", color: "#94a3b8" }}
        >
          <span>Toplam {groups.length} hayvan</span>
          {isDragEnabled && (
            <span style={{ color: "rgba(148,163,184,0.5)" }}>Sürükleyerek sıralayabilirsiniz</span>
          )}
        </div>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {groups.map((group, idx) => (
          <AnimalMobileCard
            key={group.id}
            group={group}
            index={idx}
            isToggling={toggling.has(group.id)}
            noteCount={noteCountByGroup[group.id] || 0}
            teams={teams}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
      </div>
    </>
  );
}

const AnimalRow = memo(function AnimalRow({
  group, index, isToggling, noteCount, teams, onToggle, onSelect,
  isDragEnabled, isDragging, dropPosition, onDragStart, onDragOver, onDragEnd, onDrop,
}: {
  group: TrackingGroup; index: number; isToggling: boolean;
  noteCount: number; teams: TrackingTeam[];
  onToggle: (g: TrackingGroup) => void; onSelect: (i: number) => void;
  isDragEnabled: boolean; isDragging: boolean;
  dropPosition: "before" | "after" | null;
  onDragStart: (e: React.DragEvent, g: TrackingGroup) => void;
  onDragOver: (e: React.DragEvent, g: TrackingGroup) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, g: TrackingGroup) => void;
}) {
  const team = group.teamId ? teams.find(t => t.id === group.teamId) : null;
  const colorBorder = group.colorTag && COLOR_MAP[group.colorTag] ? COLOR_MAP[group.colorTag] : null;

  const rowStyle: React.CSSProperties = {
    borderBottom: dropPosition === "after"
      ? "2px solid rgba(0,201,134,0.7)"
      : "1px solid rgba(148,163,184,0.06)",
    borderTop: dropPosition === "before" ? "2px solid rgba(0,201,134,0.7)" : undefined,
    opacity: isDragging ? 0.35 : 1,
    transition: "opacity 0.15s",
    cursor: isDragEnabled ? "grab" : "pointer",
    userSelect: isDragEnabled ? "none" : undefined,
  };

  return (
    <tr
      className="transition-colors group"
      style={rowStyle}
      draggable={isDragEnabled}
      onDragStart={isDragEnabled ? (e) => onDragStart(e, group) : undefined}
      onDragOver={isDragEnabled ? (e) => onDragOver(e, group) : undefined}
      onDragEnd={isDragEnabled ? onDragEnd : undefined}
      onDrop={isDragEnabled ? (e) => onDrop(e, group) : undefined}
      onClick={() => onSelect(index)}
      role="button"
      tabIndex={0}
      aria-label={`Hayvan ${group.animalNo}${group.kesildi ? ", kesildi" : ", bekliyor"}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(index); } }}
      onMouseEnter={(e) => { if (!isDragging) (e.currentTarget as HTMLElement).style.background = "rgba(148,163,184,0.04)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {/* Drag handle */}
      {isDragEnabled && (
        <td className="pl-3 pr-0 py-3.5" style={{ width: "32px" }}>
          <div
            className="flex items-center justify-center w-5 h-5"
            style={{ color: "rgba(148,163,184,0.35)" }}
            aria-hidden="true"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        </td>
      )}

      {/* # */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          {colorBorder && <div className="w-0.5 h-5 rounded-full shrink-0" style={{ background: colorBorder }} />}
          <span className="text-sm font-bold tabular-nums" style={{ color: "#cbd5e1" }}>
            {group.animalNo}
          </span>
        </div>
      </td>

      {/* Hayvan */}
      <td className="px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#f8fafc" }}>Hayvan {group.animalNo}</p>
          <p className="text-xs" style={{ color: "#94a3b8" }}>{group.filledCount}/7 hisse</p>
        </div>
      </td>

      {/* Vekalet / Sahip */}
      <td className="px-4 py-3.5 max-w-[180px]">
        <div>
          {group.donors[0] && (
            <>
              {group.donors[0].vekalet && (
                <span
                  className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md mb-1"
                  style={{ background: "rgba(59,130,246,0.14)", color: "#60a5fa" }}
                >
                  Vekaletli
                </span>
              )}
              <p className="text-xs truncate" style={{ color: "#cbd5e1" }}>
                {group.donors[0].description || group.donors[0].name}
              </p>
              {group.donors.length > 1 && (
                <p className="text-[10px]" style={{ color: "#94a3b8" }}>+{group.donors.length - 1} kişi</p>
              )}
            </>
          )}
          {!group.donors[0] && <span style={{ color: "#94a3b8" }}>—</span>}
        </div>
      </td>

      {/* Ekip */}
      <td className="px-4 py-3.5">
        {team ? (
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: team.color + "20", color: team.color }}
          >
            {team.name}
          </span>
        ) : (
          <span style={{ color: "#94a3b8" }}>—</span>
        )}
        {noteCount > 0 && (
          <span
            className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{ background: "rgba(59,130,246,0.14)", color: "#60a5fa" }}
          >
            <MessageSquarePlus className="w-2.5 h-2.5" aria-hidden="true" />
            {noteCount}
          </span>
        )}
      </td>

      {/* Kesim Zamanı */}
      <td className="px-4 py-3.5">
        {group.kesildiAt ? (
          <span className="flex items-center gap-1 text-xs" style={{ color: "#cbd5e1" }}>
            <Clock className="w-3 h-3" aria-hidden="true" />
            {formatKesildiTime(group.kesildiAt)}
          </span>
        ) : (
          <span style={{ color: "#94a3b8" }}>—</span>
        )}
      </td>

      {/* Durum */}
      <td className="px-4 py-3.5">
        {group.kesildi ? (
          <span
            className="text-xs font-semibold px-3 py-1 rounded-lg"
            style={{ background: "rgba(0,201,134,0.14)", color: "#00e59b" }}
          >
            Kesildi
          </span>
        ) : (
          <span
            className="text-xs font-semibold px-3 py-1 rounded-lg"
            style={{ background: "rgba(245,158,11,0.14)", color: "#fbbf24" }}
          >
            Bekliyor
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5">
        <button
          className="w-8 h-8 flex items-center justify-center rounded-xl transition-all opacity-0 group-hover:opacity-100"
          style={{ color: "#94a3b8" }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(group);
          }}
          disabled={isToggling}
          aria-label={group.kesildi ? `Hayvan ${group.animalNo} işaretini kaldır` : `Hayvan ${group.animalNo} kesildi işaretle`}
          title={group.kesildi ? "İşareti kaldır" : "Kesildi işaretle"}
        >
          {isToggling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : group.kesildi ? (
            <Circle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" style={{ color: "#00c986" }} />
          )}
        </button>
      </td>
    </tr>
  );
});

const AnimalMobileCard = memo(function AnimalMobileCard({
  group, index, isToggling, noteCount, teams, onToggle, onSelect,
}: {
  group: TrackingGroup; index: number; isToggling: boolean;
  noteCount: number; teams: TrackingTeam[];
  onToggle: (g: TrackingGroup) => void; onSelect: (i: number) => void;
}) {
  const team = group.teamId ? teams.find(t => t.id === group.teamId) : null;

  return (
    <div
      className="rounded-xl border p-4 cursor-pointer transition-all active:scale-[0.99]"
      style={{
        background: "#0b1a2b",
        borderColor: group.kesildi ? "rgba(0,201,134,0.25)" : "rgba(148,163,184,0.14)",
      }}
      onClick={() => onSelect(index)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(index); } }}
      aria-label={`Hayvan ${group.animalNo}${group.kesildi ? ", kesildi" : ", bekliyor"}`}
    >
      <div className="flex items-center gap-3">
        <button
          className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl transition-all shrink-0"
          style={{
            background: group.kesildi ? "rgba(0,201,134,0.16)" : "rgba(148,163,184,0.08)",
            color: group.kesildi ? "#00c986" : "#94a3b8",
          }}
          onClick={(e) => { e.stopPropagation(); onToggle(group); }}
          disabled={isToggling}
          aria-label={group.kesildi ? "İşareti kaldır" : "Kesildi işaretle"}
        >
          {isToggling ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : group.kesildi ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold" style={{ color: "#f8fafc" }}>Hayvan {group.animalNo}</span>
            {group.kesildi ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: "rgba(0,201,134,0.14)", color: "#00e59b" }}>
                Kesildi {group.kesildiAt ? formatKesildiTime(group.kesildiAt) : ""}
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: "rgba(245,158,11,0.14)", color: "#fbbf24" }}>
                Bekliyor
              </span>
            )}
            {noteCount > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-0.5" style={{ background: "rgba(59,130,246,0.14)", color: "#60a5fa" }}>
                <MessageSquarePlus className="w-2.5 h-2.5" />
                {noteCount}
              </span>
            )}
          </div>
          <p className="text-xs truncate" style={{ color: "#94a3b8" }}>
            {group.donors[0]?.vekalet && <span style={{ color: "#60a5fa" }}>Vekaletli · </span>}
            {group.donors.slice(0, 2).map(d => d.description || d.name).join(", ")}
            {group.donors.length > 2 && ` +${group.donors.length - 2}`}
          </p>
          {team && (
            <span className="text-[10px] font-semibold mt-1 inline-block px-2 py-0.5 rounded-md" style={{ background: team.color + "20", color: team.color }}>
              {team.name}
            </span>
          )}
        </div>

        <span className="text-xs shrink-0" style={{ color: "#94a3b8" }}>{group.filledCount}/7</span>
      </div>
    </div>
  );
});
