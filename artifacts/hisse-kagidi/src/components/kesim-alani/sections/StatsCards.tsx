import React, { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useKesimAlaniContext } from "../KesimAlaniContext";
import type { VekaletConflict } from "../hooks/useVekaletCheck";

function VekaletWarning({
  allEntries,
  totalCount,
  step,
  siblingKesimAlanlari,
}: {
  allEntries: [string, VekaletConflict[]][];
  totalCount: number;
  step: number;
  siblingKesimAlanlari: { id: string; name: string }[];
}) {
  const [visibleCount, setVisibleCount] = useState(step);
  const visibleEntries = allEntries.slice(0, visibleCount);
  const remaining = totalCount - visibleCount;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
            Çift Vekalet Uyarısı ({totalCount})
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
            Bu listede bulunan {totalCount} vekalet numarası başka kesim alanlarında da mevcut:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
            {visibleEntries.map(([vek, conflicts]) => {
              const kaNames = conflicts.map(c => {
                const ka = siblingKesimAlanlari.find(s => s.id === c.kesimAlaniId);
                return ka?.name || "Bilinmeyen KA";
              });
              return (
                <div key={vek} className="flex items-center gap-2 text-xs min-w-0">
                  <span className="font-mono font-medium text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded shrink-0">
                    {vek}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 shrink-0">→</span>
                  <span className="text-amber-700 dark:text-amber-300 truncate">
                    {kaNames.join(", ")}
                  </span>
                </div>
              );
            })}
          </div>
          {remaining > 0 && (
            <button
              onClick={() => setVisibleCount(prev => prev + step)}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
              {remaining} tane daha göster
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatsCards() {
  const {
    kesim, totalShares, requiredAnimals, remainingSlots,
    shareDistribution, groupCompositions, photoCounts,
    ungroupedDonors, ungroupedShareCount, filterUngrouped,
    setFilterUngrouped, donorListVisible, setDonorListVisible,
    vekaletCheck, siblingKesimAlanlari,
  } = useKesimAlaniContext();

  if (!kesim) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3 mb-4">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-primary">{kesim.donations.filter(d => !d.excluded).length}</div>
          <div className="text-xs text-muted-foreground">Aktif Bağışçı</div>
        </Card>
        {kesim.donations.filter(d => d.excluded).length > 0 && (
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-destructive">{kesim.donations.filter(d => d.excluded).length}</div>
            <div className="text-xs text-muted-foreground">Hariç Tutulan</div>
          </Card>
        )}
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-primary">{totalShares}</div>
          <div className="text-xs text-muted-foreground">Toplam Hisse</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-primary">{requiredAnimals}</div>
          <div className="text-xs text-muted-foreground">Gereken Hayvan</div>
          {remainingSlots > 0 && (
            <div className="text-[10px] text-orange-500 mt-0.5">({remainingSlots} boş slot)</div>
          )}
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-primary">
            {kesim.animalGroups.length > 0
              ? kesim.animalGroups.reduce((sum, g) => sum + g.donations.filter(d => d.name.trim() === "").length, 0)
              : 0}
          </div>
          <div className="text-xs text-muted-foreground">Boş Slot</div>
        </Card>
        {kesim.animalGroups.length > 0 && (
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">
              %{Math.round((kesim.animalGroups.reduce((s, g) => s + g.donations.filter(d => d.name.trim() !== "").length, 0) / (kesim.animalGroups.length * 7)) * 100)}
            </div>
            <div className="text-xs text-muted-foreground">Doluluk</div>
          </Card>
        )}
        {kesim.animalGroups.length > 0 && (() => {
          const kesildiCount = kesim.animalGroups.filter(g => g.kesildi).length;
          const lastAt = kesim.animalGroups
            .filter(g => g.kesildiAt)
            .map(g => g.kesildiAt!)
            .sort()
            .pop();
          return (
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {kesildiCount}/{kesim.animalGroups.length}
              </div>
              <div className="text-xs text-muted-foreground">Kesildi</div>
              {lastAt && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Son: {new Date(lastAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </Card>
          );
        })()}
        {Object.values(photoCounts).reduce((a, b) => a + b, 0) > 0 && (
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {Object.values(photoCounts).reduce((a, b) => a + b, 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              Fotoğraf ({Object.keys(photoCounts).length} grup)
            </div>
          </Card>
        )}
        {ungroupedDonors.length > 0 && (
          <Card
            className={`p-3 text-center cursor-pointer transition-colors ${filterUngrouped ? "ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950" : "hover:bg-muted"}`}
            onClick={() => {
              setFilterUngrouped(!filterUngrouped);
              if (!donorListVisible) setDonorListVisible(true);
            }}
          >
            <div className="text-2xl font-bold text-orange-600">{ungroupedDonors.length}</div>
            <div className="text-xs text-muted-foreground">{ungroupedShareCount} hisse gruplanmamış</div>
          </Card>
        )}
      </div>

      {vekaletCheck.hasConflicts && (() => {
        const STEP = 5;
        const allEntries = Array.from(vekaletCheck.conflictsByVekalet.entries());
        const totalCount = allEntries.length;
        return (
          <VekaletWarning
            allEntries={allEntries}
            totalCount={totalCount}
            step={STEP}
            siblingKesimAlanlari={siblingKesimAlanlari}
          />
        );
      })()}

      {(kesim.donations.filter(d => !d.excluded).length > 0 || kesim.animalGroups.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {kesim.donations.filter(d => !d.excluded).length > 0 && (
            <Card className="p-3">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Hisse Dağılımı</h4>
              <div className="space-y-1">
                {[1, 2, 3, 4, 5, 6, 7].map(sc => {
                  const count = shareDistribution[sc] || 0;
                  if (count === 0) return null;
                  const totalUnique = Object.values(shareDistribution).reduce((s, c) => s + c, 0);
                  const pct = totalUnique > 0 ? (count / totalUnique) * 100 : 0;
                  return (
                    <div key={sc} className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-right text-muted-foreground">{sc} hisse:</span>
                      <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded-full transition-all"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-medium">{count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {kesim.animalGroups.length > 0 && (
            <Card className="p-3">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Grup Kompozisyonları</h4>
              <div className="space-y-1">
                {Array.from(groupCompositions.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between text-xs px-1 py-0.5 rounded hover:bg-muted">
                      <span className="font-mono text-muted-foreground">{label}</span>
                      <span className="font-medium">{count} grup</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
