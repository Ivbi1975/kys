import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type { PoolStats } from "@/lib/types";

interface CinsStatsBarProps {
  stats: PoolStats | undefined;
  items: { donationType: string; shareCount: number; kesimAlaniName?: string }[];
  donationTypeFilter: string[];
  onToggleType: (type: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  "Vacip": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60",
  "Akika": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60",
  "Adak": "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60",
  "Nafile": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60",
  "Şükür": "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/60",
};

const SELECTED_RING = "ring-2 ring-primary ring-offset-1 dark:ring-offset-background";

function computeFallbackDistribution(items: { donationType: string; shareCount: number; kesimAlaniName?: string }[]) {
  const map = new Map<string, { count: number; shares: number }>();
  for (const item of items) {
    if (item.kesimAlaniName !== undefined && item.kesimAlaniName !== "__havuz__") continue;
    const type = item.donationType || "";
    if (!type) continue;
    const entry = map.get(type) || { count: 0, shares: 0 };
    entry.count += 1;
    entry.shares += item.shareCount || 0;
    map.set(type, entry);
  }
  return Array.from(map.entries())
    .map(([type, { count, shares }]) => ({ type, count, shares }))
    .sort((a, b) => b.count - a.count);
}

export function CinsStatsBar({ stats, items, donationTypeFilter, onToggleType }: CinsStatsBarProps) {
  const entries = useMemo(() => {
    const base = stats?.typeDistribution ?? computeFallbackDistribution(items);
    const distMap = new Map(base.map(t => [t.type, t]));
    const result = [...base];
    for (const ft of donationTypeFilter) {
      if (!distMap.has(ft)) {
        result.push({ type: ft, count: 0, shares: 0 });
      }
    }
    return result;
  }, [stats, items, donationTypeFilter]);

  if (entries.length === 0) return null;

  const totalCount = entries.reduce((sum, t) => sum + t.count, 0);
  const totalShares = entries.reduce((sum, t) => sum + t.shares, 0);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 mr-1">
        <span className="text-xs font-medium text-muted-foreground">Cins:</span>
        <Badge variant="outline" className="text-xs h-6 px-2 font-semibold">
          {totalCount} bağış · {totalShares} hisse
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {entries.map(t => {
          const isActive = donationTypeFilter.includes(t.type);
          const colorClass = TYPE_COLORS[t.type] || "bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800/60";

          return (
            <button
              key={t.type}
              onClick={() => onToggleType(t.type)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer select-none ${colorClass} ${isActive ? SELECTED_RING : ""}`}
              title={`${t.type}: ${t.count} bağış, ${t.shares} hisse — filtrelemek için tıklayın`}
            >
              <span>{t.type}</span>
              <span className="font-semibold">{t.count}</span>
              <span className="opacity-60">({t.shares}h)</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
