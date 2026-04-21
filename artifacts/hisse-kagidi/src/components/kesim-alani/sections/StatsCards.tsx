import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useKesimAlaniContext } from "../KesimAlaniContext";
import type { Donation } from "@/lib/types";

function useCollapsible(storageKey: string, defaultOpen = false) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) return stored === "true";
    } catch {}
    return defaultOpen;
  });

  const toggle = () => {
    setOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(storageKey, String(next)); } catch {}
      return next;
    });
  };

  return { open, toggle };
}

function CollapsibleCardHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between mb-2 group"
    >
      <h4 className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
        {title}
      </h4>
      {open ? (
        <ChevronUp className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
      ) : (
        <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
      )}
    </button>
  );
}

function StatBarRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 text-right text-muted-foreground truncate shrink-0" title={label}>{label}:</span>
      <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
        <div
          className="h-full bg-primary/70 rounded-full transition-all"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="w-8 text-right font-medium shrink-0">{count}</span>
    </div>
  );
}

type DonationStringKey =
  | "name"
  | "description"
  | "donationType"
  | "vekalet"
  | "notes"
  | "phone"
  | "birim"
  | "temsilci"
  | "ozellik"
  | "fiyat"
  | "yerTalebi"
  | "gunTalebi"
  | "ilkHayvan"
  | "safi"
  | "aiWarnings"
  | "flagReason";

function countByField(donations: Donation[], field: DonationStringKey): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of donations) {
    const raw = d[field];
    const val = typeof raw === "string" ? raw.trim() : "";
    if (val) {
      map.set(val, (map.get(val) || 0) + 1);
    }
  }
  return map;
}

export function StatsCards() {
  const {
    kesim, totalShares, requiredAnimals, remainingSlots,
    shareDistribution, groupCompositions, photoCounts,
    ungroupedDonors, ungroupedShareCount, filterUngrouped,
    setFilterUngrouped, donorListVisible, setDonorListVisible,
  } = useKesimAlaniContext();

  const grupKomp = useCollapsible("statsCards.grupKomposisyon", false);
  const bagisStats = useCollapsible("statsCards.bagisIstatistikleri", false);

  if (!kesim) return null;

  const activeDonations = kesim.donations.filter(d => !d.excluded);

  const donationTypeMap = countByField(activeDonations, "donationType");
  const birimMap = countByField(activeDonations, "birim");
  const temsilciMap = countByField(activeDonations, "temsilci");
  const ozellikMap = countByField(activeDonations, "ozellik");
  const ilkHayvanMap = countByField(activeDonations, "ilkHayvan");
  const yerTalebiMap = countByField(activeDonations, "yerTalebi");
  const gunTalebiMap = countByField(activeDonations, "gunTalebi");
  const safiMap = countByField(activeDonations, "safi");

  const hasBagisStats = activeDonations.length > 0 && (
    donationTypeMap.size > 0 || birimMap.size > 0 || temsilciMap.size > 0 ||
    ozellikMap.size > 0 || ilkHayvanMap.size > 0 || yerTalebiMap.size > 0 ||
    gunTalebiMap.size > 0 || safiMap.size > 0
  );

  function renderStatSection(title: string, map: Map<string, number>) {
    if (map.size === 0) return null;
    const total = Array.from(map.values()).reduce((s, c) => s + c, 0);
    return (
      <div className="mb-2">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{title}</div>
        <div className="space-y-1">
          {Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => (
              <StatBarRow key={label} label={label} count={count} total={total} />
            ))}
        </div>
      </div>
    );
  }

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
              <CollapsibleCardHeader
                title="Grup Kompozisyonları"
                open={grupKomp.open}
                onToggle={grupKomp.toggle}
              />
              {grupKomp.open && (
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
              )}
            </Card>
          )}

          {hasBagisStats && (
            <Card className="p-3">
              <CollapsibleCardHeader
                title="Bağış İstatistikleri"
                open={bagisStats.open}
                onToggle={bagisStats.toggle}
              />
              {bagisStats.open && (
                <div>
                  {renderStatSection("Bağış Tipi", donationTypeMap)}
                  {renderStatSection("Birim", birimMap)}
                  {renderStatSection("Temsilci", temsilciMap)}
                  {renderStatSection("Özellik", ozellikMap)}
                  {renderStatSection("İlk Hayvan", ilkHayvanMap)}
                  {renderStatSection("Yer Talebi", yerTalebiMap)}
                  {renderStatSection("Gün Talebi", gunTalebiMap)}
                  {renderStatSection("Safi", safiMap)}
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
