import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClipboardList, ChevronDown, ChevronRight, RefreshCw, Filter } from "lucide-react";
import { fetchAuditLogs, type AuditLogEntry, type AuditLogFilters } from "@/lib/api/audit-logs";
import { isBulkDelete, formatFiltersText } from "@/lib/audit-log-formatter";

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
};

const ENTITY_LABELS: Record<string, string> = {
  donation: "Bağışçı",
  animal_group: "Hayvan Grubu",
  project: "Proje",
  kesim_alani: "Kesim Alanı",
  settings: "Ayarlar",
  backup: "Yedek",
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
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function JsonPreview({ data }: { data: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (data === null || data === undefined) return null;

  const text = JSON.stringify(data, null, 2);
  if (text.length < 80) {
    return <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{text}</code>;
  }

  return (
    <div>
      <button
        className="text-xs text-primary hover:underline flex items-center gap-0.5"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {expanded ? "Gizle" : "Detay göster"}
      </button>
      {expanded && (
        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
          {text}
        </pre>
      )}
    </div>
  );
}

function BulkDeleteFiltersInline({ filters }: { filters: unknown }) {
  const parts = formatFiltersText(filters);
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      <Filter className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      {parts.map((p, i) => (
        <span key={i} className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
          {p}
        </span>
      ))}
    </div>
  );
}

function LogRow({ entry }: { entry: AuditLogEntry }) {
  const bulkDel = isBulkDelete(entry);
  const badgeColor = bulkDel
    ? "bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100 font-semibold"
    : (ACTION_COLORS[entry.action] || "");
  const badgeLabel = bulkDel
    ? "Toplu Silme"
    : (ACTION_LABELS[entry.action] || entry.action);

  return (
    <div className={`border-b last:border-b-0 py-2.5 px-1${bulkDel ? " bg-red-50/40 dark:bg-red-950/20" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badgeColor}`}>
            {badgeLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {ENTITY_LABELS[entry.entityType] || entry.entityType}
          </span>
          {entry.entityName && (
            <span className="text-xs font-medium truncate max-w-[180px]" title={entry.entityName}>
              {entry.entityName}
            </span>
          )}
          {bulkDel && entry.affectedCount != null && entry.affectedCount > 0 && (
            <span className="text-[10px] font-semibold text-red-700 dark:text-red-400">
              {entry.affectedCount} bağış
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
          {formatDate(entry.createdAt)}
        </span>
      </div>
      {bulkDel && <BulkDeleteFiltersInline filters={entry.filters} />}
      {entry.entityId && !bulkDel && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          ID: {entry.entityId}
        </div>
      )}
      {(entry.newValue != null || entry.oldValue != null) && (
        <div className="mt-1 space-y-0.5">
          {entry.oldValue != null && (
            <div className="flex items-start gap-1">
              <span className="text-[10px] text-muted-foreground flex-shrink-0">Eski:</span>
              <JsonPreview data={entry.oldValue} />
            </div>
          )}
          {entry.newValue != null && (
            <div className="flex items-start gap-1">
              <span className="text-[10px] text-muted-foreground flex-shrink-0">Yeni:</span>
              <JsonPreview data={entry.newValue} />
            </div>
          )}
        </div>
      )}
      <div className="text-[10px] text-muted-foreground mt-0.5">
        Kaynak: {entry.sourceType}{entry.sourceIdentifier ? ` (${entry.sourceIdentifier})` : ""}
      </div>
    </div>
  );
}

export function AuditLogViewer() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({ limit: 30 });

  const loadLogs = useCallback(async (append = false) => {
    setLoading(true);
    try {
      const cursor = append ? nextCursor ?? undefined : undefined;
      const result = await fetchAuditLogs({ ...filters, cursor });
      if (append) {
        setLogs(prev => [...prev, ...result.items]);
      } else {
        setLogs(result.items);
      }
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filters, nextCursor]);

  useEffect(() => {
    if (open) {
      loadLogs(false);
    }
  }, [open, filters]);

  const handleFilterChange = (key: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "_all" ? undefined : value,
    }));
    setNextCursor(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardList className="w-4 h-4 mr-1" />
          Audit Log
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            İşlem Geçmişi
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          <Select
            value={filters.entityType || "_all"}
            onValueChange={(v) => handleFilterChange("entityType", v)}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Tür" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tüm Türler</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.action || "_all"}
            onValueChange={(v) => handleFilterChange("action", v)}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="İşlem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tüm İşlemler</SelectItem>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-8 ml-auto"
            onClick={() => loadLogs(false)}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 border rounded-md mt-2">
          <div className="p-2">
            {loading && logs.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Yükleniyor...
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Kayıt bulunamadı.
              </div>
            ) : (
              <>
                {logs.map(entry => (
                  <LogRow key={entry.id} entry={entry} />
                ))}
                {hasMore && (
                  <div className="text-center pt-3 pb-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadLogs(true)}
                      disabled={loading}
                    >
                      {loading ? "Yükleniyor..." : "Daha Fazla"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
