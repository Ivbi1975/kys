import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  ClipboardList,
  RefreshCw,
  Filter,
  X,
  ChevronDown,
} from "lucide-react";
import { fetchAuditLogs, type AuditLogEntry } from "@/lib/api/audit-logs";
import { fetchKesimAlanlari } from "@/lib/api";
import { formatDateTime } from "@/lib/formatting";
import { formatAuditLogDescription } from "@/lib/audit-log-formatter";
import { useQuery } from "@tanstack/react-query";

const ACTION_LABELS: Record<string, string> = {
  create: "Oluşturma",
  update: "Güncelleme",
  delete: "Silme",
  restore: "Geri Yükleme",
  archive: "Arşivleme",
  unarchive: "Arşivden Çıkarma",
  toggle_kesildi: "Kesildi Değişikliği",
  split: "Parçalama",
  merge: "Birleştirme",
  lock: "Kilitleme",
  unlock: "Kilit Açma",
  import: "İçe Aktarma",
  export: "Dışa Aktarma",
  repair: "Onarım",
  move: "Taşıma",
  bulk_create: "Toplu Oluşturma",
  transfer: "Aktarım",
  bulk_transfer: "Toplu Aktarım",
  bulk_action: "Toplu İşlem",
  bulk_import: "Toplu İçe Aktarma",
  filter_apply: "Filtre Uygulandı",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  restore: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  toggle_kesildi: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  lock: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  unlock: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  import: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  export: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  repair: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  split: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  move: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  archive: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  unarchive: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  transfer: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  bulk_transfer: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  bulk_action: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  bulk_import: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  filter_apply: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
};

interface Filters {
  action: string;
  kesimAlaniId: string;
  datePreset: "all" | "today" | "thisWeek" | "custom";
  customStart: string;
  customEnd: string;
  poolScope: boolean;
}

const DEFAULT_FILTERS: Filters = {
  action: "",
  kesimAlaniId: "",
  datePreset: "all",
  customStart: "",
  customEnd: "",
  poolScope: false,
};

function getStartOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function getStartOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function resolveDates(f: Filters): { startDate?: string; endDate?: string } {
  const now = new Date();
  if (f.datePreset === "today") return { startDate: getStartOfDay(now).toISOString() };
  if (f.datePreset === "thisWeek") return { startDate: getStartOfWeek(now).toISOString() };
  if (f.datePreset === "custom") {
    return {
      startDate: f.customStart ? new Date(f.customStart).toISOString() : undefined,
      endDate: f.customEnd ? new Date(f.customEnd + "T23:59:59").toISOString() : undefined,
    };
  }
  return {};
}

function hasActiveFilters(f: Filters): boolean {
  return !!(f.action || f.kesimAlaniId || f.datePreset !== "all" || f.poolScope);
}

function LogRow({ entry }: { entry: AuditLogEntry }) {
  const description = formatAuditLogDescription(entry);
  return (
    <div className="flex items-start gap-3 py-3 px-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <div className="flex-shrink-0 mt-0.5">
        <Badge
          variant="outline"
          className={`text-[11px] px-1.5 py-0 whitespace-nowrap ${ACTION_COLORS[entry.action] || "bg-gray-100 text-gray-700"}`}
        >
          {ACTION_LABELS[entry.action] || entry.action}
        </Badge>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">{description}</p>
        {entry.affectedCount != null && entry.affectedCount > 1 && (
          <p className="text-xs text-muted-foreground mt-0.5">{entry.affectedCount} kayıt etkilendi</p>
        )}
      </div>
      <span className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap">
        {formatDateTime(entry.createdAt)}
      </span>
    </div>
  );
}

export default function IslemGecmisiPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id || "";
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  const initFilters = (): Filters => {
    const sp = new URLSearchParams(searchString);
    return {
      ...DEFAULT_FILTERS,
      kesimAlaniId: sp.get("ka") || "",
      poolScope: sp.get("pool") === "1",
    };
  };

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>(initFilters);
  const abortRef = useRef<AbortController | null>(null);

  const { data: kesimAlanlari = [] } = useQuery({
    queryKey: ["kesim-alanlari", projectId],
    queryFn: () => fetchKesimAlanlari(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const loadLogs = useCallback(async (append = false, filtersOverride?: Filters) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const f = filtersOverride ?? filters;
      const cursor = append ? nextCursor ?? undefined : undefined;
      const { startDate, endDate } = resolveDates(f);
      const result = await fetchAuditLogs({
        projectId,
        limit: 50,
        cursor,
        action: f.action || undefined,
        startDate,
        endDate,
        kesimAlaniId: f.kesimAlaniId || undefined,
        poolScope: f.poolScope || undefined,
      }, abortRef.current.signal);
      if (append) {
        setLogs(prev => [...prev, ...result.items]);
      } else {
        setLogs(result.items);
      }
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[IslemGecmisiPage] Log yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, nextCursor, filters]);

  useEffect(() => {
    const initial = initFilters();
    setFilters(initial);
    setLogs([]);
    setNextCursor(null);
    loadLogs(false, initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, searchString]);

  const handleFilterChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    setNextCursor(null);
    setLogs([]);
    setHasMore(false);
    loadLogs(false, newFilters);
  }, [loadLogs]);

  const activeFilterCount = [
    filters.action,
    filters.kesimAlaniId,
    filters.datePreset !== "all" ? "date" : "",
    filters.poolScope ? "pool" : "",
  ].filter(Boolean).length;

  const selectClass = "text-sm border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring h-9";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">

        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation(`/proje/${projectId}`)}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Projeye Dön
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadLogs(false)}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Yenile
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary flex-shrink-0" />
            <h1 className="text-xl font-bold text-foreground">İşlem Geçmişi</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Bu projede gerçekleştirilen tüm işlemler kronolojik sırayla listeleniyor.
          </p>
        </div>

        <Card className="mb-4 p-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-muted/30 border-b">
            <span className="text-sm text-muted-foreground font-medium flex items-center gap-1.5 flex-shrink-0">
              <Filter className="w-3.5 h-3.5" />
              Filtrele:
            </span>

            <select
              className={selectClass}
              value={filters.action}
              onChange={e => handleFilterChange({ ...filters, action: e.target.value })}
            >
              <option value="">Tüm İşlemler</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            {kesimAlanlari.length > 0 && (
              <select
                className={selectClass}
                value={filters.kesimAlaniId}
                onChange={e => handleFilterChange({ ...filters, kesimAlaniId: e.target.value })}
              >
                <option value="">Tüm Kesim Alanları</option>
                {(kesimAlanlari as Array<{ id: string; name: string }>).map(ka => (
                  <option key={ka.id} value={ka.id}>{ka.name}</option>
                ))}
              </select>
            )}

            <select
              className={selectClass}
              value={filters.datePreset}
              onChange={e => {
                const v = e.target.value as Filters["datePreset"];
                handleFilterChange({ ...filters, datePreset: v, customStart: "", customEnd: "" });
              }}
            >
              <option value="all">Tüm Tarihler</option>
              <option value="today">Bugün</option>
              <option value="thisWeek">Bu Hafta</option>
              <option value="custom">Özel Aralık</option>
            </select>

            {filters.datePreset === "custom" && (
              <>
                <input
                  type="date"
                  className={selectClass}
                  value={filters.customStart}
                  onChange={e => handleFilterChange({ ...filters, customStart: e.target.value })}
                />
                <span className="text-sm text-muted-foreground">–</span>
                <input
                  type="date"
                  className={selectClass}
                  value={filters.customEnd}
                  onChange={e => handleFilterChange({ ...filters, customEnd: e.target.value })}
                />
              </>
            )}

            {filters.poolScope && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Bağış Havuzu
                <button
                  className="ml-0.5 hover:opacity-70"
                  onClick={() => handleFilterChange({ ...filters, poolScope: false })}
                  aria-label="Havuz filtresini kaldır"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {activeFilterCount > 0 && (
              <button
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground ml-auto"
                onClick={() => handleFilterChange(DEFAULT_FILTERS)}
              >
                <X className="w-3.5 h-3.5" />
                Temizle ({activeFilterCount})
              </button>
            )}
          </div>

          {loading && logs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
              Yükleniyor...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {hasActiveFilters(filters)
                ? "Bu filtrelere uyan işlem bulunamadı."
                : "Henüz işlem geçmişi yok."}
            </div>
          ) : (
            <div>
              {logs.map(entry => (
                <LogRow key={entry.id} entry={entry} />
              ))}

              {hasMore && (
                <div className="py-4 text-center border-t">
                  <Button
                    variant="outline"
                    onClick={() => loadLogs(true)}
                    disabled={loading}
                    className="gap-2"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    Daha Fazla Yükle
                  </Button>
                </div>
              )}

              {!hasMore && logs.length > 0 && (
                <div className="py-3 text-center text-xs text-muted-foreground border-t">
                  {logs.length} işlem listelendi · tümü gösteriliyor
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
