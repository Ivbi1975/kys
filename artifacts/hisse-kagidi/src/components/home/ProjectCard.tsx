import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, ChevronRight, Plus, AlertTriangle, Info } from "lucide-react";
import type { KesimAlani, Project } from "@/lib/types";
import { getTotalShares } from "@/lib/grouping";

interface ProjectCardProps {
  project: Project;
  kesimAlanlari: KesimAlani[];
  onNavigate: (projectId: string) => void;
  onBulkCreate?: (projectId: string) => void;
}

export function ProjectCard({ project, kesimAlanlari, onNavigate, onBulkCreate }: ProjectCardProps) {
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

  const projKesildiPercent = projTotals.groups > 0 ? Math.round((projTotals.kesildi / projTotals.groups) * 100) : 0;
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

  return (
    <div className="mb-6">
      <Card className="p-3 bg-muted/30 border-primary/10">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onNavigate(project.id)}
        >
          <FolderOpen className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground text-lg">{project.name}</h2>
            <div className="flex items-center gap-2.5 text-sm mt-1 flex-wrap">
              <span className="flex items-center gap-1 font-medium text-foreground/80">
                {projTotals.areas} kesim alanı
                {onBulkCreate && (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 hover:bg-primary/40 text-primary transition-colors"
                    title="Toplu kesim alanı ekle"
                    onClick={(e) => { e.stopPropagation(); onBulkCreate(project.id); }}
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium text-foreground/80">{projTotals.donors} bağışçı</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium text-foreground/80">{projTotals.shares} hisse</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium text-foreground/80">{projTotals.groups} grup</span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>

        {(criticalWarnings.length > 0 || infoWarnings.length > 0) && (
          <div className="mt-2.5 pt-2.5 border-t flex flex-wrap gap-2">
            {criticalWarnings.map(w => (
              <span
                key={w.label}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span><strong>{w.count}</strong> {w.label}</span>
              </span>
            ))}
            {infoWarnings.map(w => (
              <span
                key={w.label}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
              >
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span><strong>{w.count}</strong> {w.label}</span>
              </span>
            ))}
          </div>
        )}

        {projTotals.groups > 0 && (
          <div className="mt-2 pt-2 border-t">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground font-medium">Kesim Durumu</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-emerald-600">{projTotals.kesildi}/{projTotals.groups} (%{projKesildiPercent})</span>
                {projLastKesildiAt && (
                  <span className="text-[9px] text-muted-foreground">
                    (son: {new Date(projLastKesildiAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })})
                  </span>
                )}
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${projKesildiPercent}%` }}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
