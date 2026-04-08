import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ListChecks, ShoppingBasket, Tag, MapPin, Users } from "lucide-react";
import type { PoolStats } from "@/lib/types";

export function StatsPanel({ stats }: { stats: PoolStats }) {
  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Toplam</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Aktif</p>
                <p className="text-lg font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ShoppingBasket className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Sepet</p>
                <p className="text-lg font-bold">{stats.excluded}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Toplam Hisse</p>
                <p className="text-lg font-bold">{stats.total_shares}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(stats.birimDistribution.length > 0 || stats.temsilciDistribution.length > 0 || stats.typeDistribution.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {stats.birimDistribution.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-1"><CardTitle className="text-xs flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />Birim Dağılımı</CardTitle></CardHeader>
              <CardContent className="p-3 pt-1">
                <div className="space-y-1 max-h-32 overflow-auto">
                  {stats.birimDistribution.map(b => (
                    <div key={b.birim} className="flex justify-between text-xs">
                      <span className="truncate">{b.birim}</span>
                      <span className="text-muted-foreground ml-2">{b.count} ({b.shares} hisse)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {stats.temsilciDistribution.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-1"><CardTitle className="text-xs flex items-center gap-1"><Users className="w-3.5 h-3.5" />Temsilci Dağılımı</CardTitle></CardHeader>
              <CardContent className="p-3 pt-1">
                <div className="space-y-1 max-h-32 overflow-auto">
                  {stats.temsilciDistribution.map(t => (
                    <div key={t.temsilci} className="flex justify-between text-xs">
                      <span className="truncate">{t.temsilci}</span>
                      <span className="text-muted-foreground ml-2">{t.count} ({t.shares} hisse)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {stats.typeDistribution.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-1"><CardTitle className="text-xs flex items-center gap-1"><Tag className="w-3.5 h-3.5" />Cinsi Dağılımı</CardTitle></CardHeader>
              <CardContent className="p-3 pt-1">
                <div className="space-y-1 max-h-32 overflow-auto">
                  {stats.typeDistribution.map(t => (
                    <div key={t.type} className="flex justify-between text-xs">
                      <span className="truncate">{t.type}</span>
                      <span className="text-muted-foreground ml-2">{t.count} ({t.shares} hisse)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {stats.kesimAlaniDistribution.length > 0 && (
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs">Kesim Listesi Dağılımı</CardTitle></CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {stats.kesimAlaniDistribution.map(ka => (
                <div key={ka.id} className="text-xs p-2 border rounded bg-muted/30">
                  <span className="font-medium">{ka.name}</span>
                  <span className="text-muted-foreground ml-1">({ka.count} bağış, {ka.shares} hisse)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
