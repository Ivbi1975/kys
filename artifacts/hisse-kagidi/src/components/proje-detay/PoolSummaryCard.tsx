import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Package, Users, ShoppingBasket, Tag, ArrowRightLeft, Layers, AlertCircle } from "lucide-react";
import type { PoolStats } from "@/lib/types";

interface PoolSummaryCardProps {
  stats: PoolStats | undefined;
  loading?: boolean;
  onNavigate: () => void;
}

export function PoolSummaryCard({ stats, loading, onNavigate }: PoolSummaryCardProps) {
  if (loading) {
    return (
      <Card className="p-4 mb-4 bg-muted/30 border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-muted-foreground" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </Card>
    );
  }

  if (!stats) return null;

  const missingFields: { label: string; count: number }[] = [
    { label: "Tür", count: stats.empty_type_count || 0 },
    { label: "Birim", count: stats.empty_birim_count || 0 },
    { label: "Temsilci", count: stats.empty_temsilci_count || 0 },
    { label: "Özellik", count: stats.empty_ozellik_count || 0 },
    { label: "Fiyat", count: stats.empty_fiyat_count || 0 },
    { label: "Gün Talebi", count: stats.empty_gun_talebi_count || 0 },
  ];
  const missingDetails = missingFields.filter(f => f.count > 0);
  const missingCount = missingDetails.reduce((s, f) => s + f.count, 0);

  const transferRate = stats.active > 0
    ? Math.round((stats.transferredToLists / stats.active) * 100)
    : 0;

  return (
    <button
      onClick={onNavigate}
      className="w-full text-left mb-4 group"
    >
      <Card className="p-4 bg-muted/30 border-border/60 hover:border-primary/40 hover:bg-muted/50 transition-colors cursor-pointer">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Bağış Havuzu Özeti</h3>
          </div>
          {missingCount > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <div
                  role="button"
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 cursor-pointer hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{missingCount} eksik bilgi</span>
                </div>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="end"
                className="w-56 p-3 text-xs"
                onClick={e => e.stopPropagation()}
              >
                <p className="font-semibold mb-2 text-foreground">Eksik alanlar:</p>
                <div className="space-y-1.5">
                  {missingDetails.map(({ label, count }) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{label} eksik</span>
                      <span className="font-bold text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Toplam Kayıt</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold text-primary">{stats.total_shares}</div>
            <div className="text-xs text-muted-foreground">Toplam Hisse</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <ShoppingBasket className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.active}</div>
            <div className="text-xs text-muted-foreground">Aktif (Sepette)</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <ShoppingBasket className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold text-orange-500 dark:text-orange-400">{stats.excluded}</div>
            <div className="text-xs text-muted-foreground">Sepet Dışı</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.transferredToLists ?? 0}</div>
            <div className="text-xs text-muted-foreground">
              {transferRate > 0 ? `%${transferRate} Aktarıldı` : "Aktarılan"}
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{stats.inGroups ?? 0}</div>
            <div className="text-xs text-muted-foreground">Gruplanmış</div>
          </div>
        </div>
      </Card>
    </button>
  );
}
