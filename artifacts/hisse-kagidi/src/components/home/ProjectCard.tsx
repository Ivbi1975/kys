import { FolderOpen, ChevronRight, AlertTriangle, Info, Pencil } from "lucide-react";
import type { KesimAlani, Project } from "@/lib/types";
import { getTotalShares } from "@/lib/grouping";

const CARD = "#0d1c2e";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT = "#f8fafc";
const MUTED = "#6f8097";
const SEC = "#aab8cc";

interface ProjectCardProps {
  project: Project;
  kesimAlanlari: KesimAlani[];
  onNavigate: (projectId: string) => void;
  onEdit?: (project: Project) => void;
}

export function ProjectCard({ project, kesimAlanlari, onNavigate, onEdit }: ProjectCardProps) {
  const projectKesimAlanlari = kesimAlanlari.filter(k => k.projectId === project.id);

  const projTotals = projectKesimAlanlari.reduce((acc, k) => {
    const shares = getTotalShares(k.donations);
    const activeDonors = k.donations.filter(d => !d.excluded).length;
    const kesildi = k.animalGroups.filter(g => g.kesildi).length;
    const kesildiTimes = k.animalGroups.filter(g => g.kesildiAt).map(g => g.kesildiAt!);
    return {
      donors: acc.donors + activeDonors,
      shares: acc.shares + shares,
      areas: acc.areas + 1,
      groups: acc.groups + k.animalGroups.length,
      kesildi: acc.kesildi + kesildi,
      kesildiTimes: [...acc.kesildiTimes, ...kesildiTimes],
    };
  }, { donors: 0, shares: 0, areas: 0, groups: 0, kesildi: 0, kesildiTimes: [] as string[] });

  const projKesildiPercent = projTotals.groups > 0
    ? Math.round((projTotals.kesildi / projTotals.groups) * 100)
    : 0;
  const projLastKesildiAt = projTotals.kesildiTimes.sort().pop();

  const w = project.warnings;
  const criticalWarnings: { label: string; count: number }[] = [];
  const infoWarnings: { label: string; count: number }[] = [];

  if (w) {
    if (w.unassignedShares > 0) criticalWarnings.push({ label: "gruba atanmamış hisse", count: w.unassignedShares });
    if (w.duplicateVekalets > 0) criticalWarnings.push({ label: "tekrarlayan vekalet no", count: w.duplicateVekalets });
    if (w.wrongCountGroups > 0) infoWarnings.push({ label: "7 hisse tamamlanmamış grup", count: w.wrongCountGroups });
    if (w.missingVekalet > 0) infoWarnings.push({ label: "vekalet numarası eksik hisse", count: w.missingVekalet });
  }

  const progressColor = projKesildiPercent === 100 ? "#22c55e" : "#3b82f6";

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200 group"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      {/* Main clickable row */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => onNavigate(project.id)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && onNavigate(project.id)}
        aria-label={`${project.name} projesine git`}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.20)" }}
        >
          <FolderOpen className="w-4 h-4" style={{ color: "#3b82f6" }} aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold truncate" style={{ color: TEXT }}>{project.name}</h2>
            {onEdit && (
              <button
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg transition-all hover:bg-white/10"
                title="Projeyi düzenle"
                onClick={e => { e.stopPropagation(); onEdit(project); }}
                aria-label="Projeyi düzenle"
              >
                <Pencil className="w-3 h-3" style={{ color: MUTED }} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {[
              { val: projTotals.areas, label: "kesim alanı" },
              { val: projTotals.donors, label: "bağışçı" },
              { val: projTotals.shares, label: "hisse" },
              { val: projTotals.groups, label: "grup" },
            ].map(({ val, label }) => (
              <span key={label} className="text-xs" style={{ color: SEC }}>
                <strong className="font-semibold" style={{ color: TEXT }}>{val}</strong>{" "}
                {label}
              </span>
            ))}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: MUTED }} />
      </div>

      {/* Warnings */}
      {(criticalWarnings.length > 0 || infoWarnings.length > 0) && (
        <div
          className="flex flex-wrap gap-2 px-5 py-3 border-t"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          {criticalWarnings.map(w => (
            <span
              key={w.label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.20)" }}
            >
              <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
              <strong>{w.count}</strong> {w.label}
            </span>
          ))}
          {infoWarnings.map(w => (
            <span
              key={w.label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(245,158,11,0.10)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.20)" }}
            >
              <Info className="w-3 h-3 shrink-0" aria-hidden="true" />
              <strong>{w.count}</strong> {w.label}
            </span>
          ))}
        </div>
      )}

      {/* Progress */}
      {projTotals.groups > 0 && (
        <div
          className="px-5 py-3 border-t"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium" style={{ color: MUTED }}>Kesim Durumu</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tabular-nums" style={{ color: projKesildiPercent === 100 ? "#22c55e" : TEXT }}>
                {projTotals.kesildi}/{projTotals.groups} · %{projKesildiPercent}
              </span>
              {projLastKesildiAt && (
                <span className="text-[10px]" style={{ color: MUTED }}>
                  son: {new Date(projLastKesildiAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.07)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${projKesildiPercent}%`, background: progressColor }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
