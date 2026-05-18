import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ClipboardList, ChevronDown, ChevronUp, RefreshCw, ExternalLink, Filter } from "lucide-react";
import { fetchAuditLogs, type AuditLogEntry } from "@/lib/api/audit-logs";
import { formatDateTime } from "@/lib/formatting";

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

const ENTITY_LABELS: Record<string, string> = {
  donation: "Bağışçı",
  animal_group: "Hayvan Grubu",
  project: "Proje",
  kesim_alani: "Kesim Alanı",
  settings: "Ayarlar",
  backup: "Yedek",
  pool: "Havuz",
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

interface ProjectAuditLogSectionProps {
  projectId: string;
  kesimAlanlari: Array<{ id: string; name: string }>;
  onNavigate: (path: string) => void;
}

function toMultiParam(val: unknown): string | null {
  if (!val) return null;
  if (Array.isArray(val)) {
    const joined = (val as unknown[]).map(String).filter(Boolean).join(",");
    return joined || null;
  }
  if (typeof val === "string" && val.trim()) return val.trim();
  return null;
}

function toStringParam(val: unknown): string | null {
  if (typeof val === "string" && val.trim()) return val.trim();
  if (typeof val === "number") return String(val);
  return null;
}

function buildFilterUrl(projectId: string, filters: unknown): string {
  if (!filters || typeof filters !== "object") return `/bagis-havuzu/${projectId}`;
  const qs = new URLSearchParams();
  const f = filters as Record<string, unknown>;

  const set = (param: string, val: string | null) => { if (val) qs.set(param, val); };

  set("q",        toStringParam(f.search));
  set("status",   toStringParam(f.status));
  set("type",     toMultiParam(f.donationType));
  set("birim",    toMultiParam(f.birim));
  set("temsilci", toMultiParam(f.temsilci));
  set("ozellik",  toMultiParam(f.ozellik));
  set("fiyat",    toMultiParam(f.fiyat));
  set("yer",      toMultiParam(f.yerTalebi));
  set("gun",      toMultiParam(f.gunTalebi));
  set("hayvan",   toMultiParam(f.ilkHayvan));
  set("safi",     toMultiParam(f.safi));
  set("tags",     toMultiParam(f.tagIds));
  set("notes",    toStringParam(f.notesFilter));
  set("flag",     toStringParam(f.flagFilter));
  set("ai",       toMultiParam(f.aiCategory));
  set("dateField",toStringParam(f.dateField));
  set("dateFrom", toStringParam(f.dateFrom));
  set("dateTo",   toStringParam(f.dateTo));
  set("scMin",    toStringParam(f.shareCountMin));
  set("scMax",    toStringParam(f.shareCountMax));

  if (f.kesimAlaniId && typeof f.kesimAlaniId === "string") {
    qs.set("ka", f.kesimAlaniId === "" ? "all" : f.kesimAlaniId);
  }

  const qs2 = qs.toString();
  return `/bagis-havuzu/${projectId}${qs2 ? `?${qs2}` : ""}`;
}

function FiltersDisplay({
  filters,
  projectId,
  onNavigate,
}: {
  filters: unknown;
  projectId: string;
  onNavigate: (path: string) => void;
}) {
  if (!filters || typeof filters !== "object") return null;
  const f = filters as Record<string, unknown>;
  const parts: string[] = [];
  const label = (val: unknown): string => Array.isArray(val) ? (val as unknown[]).join(", ") : String(val);
  if (f.search) parts.push(`Arama: "${f.search}"`);
  if (f.status) parts.push(`Durum: ${f.status}`);
  if (f.donationType && (!Array.isArray(f.donationType) || (f.donationType as unknown[]).length > 0)) parts.push(`Tür: ${label(f.donationType)}`);
  if (f.birim && (!Array.isArray(f.birim) || (f.birim as unknown[]).length > 0)) parts.push(`Birim: ${label(f.birim)}`);
  if (f.temsilci && (!Array.isArray(f.temsilci) || (f.temsilci as unknown[]).length > 0)) parts.push(`Temsilci: ${label(f.temsilci)}`);
  if (f.kesimAlaniId) parts.push(`KA: ${f.kesimAlaniId}`);
  if (f.flagFilter) parts.push(`Bayrak: ${f.flagFilter}`);
  if (f.notesFilter) parts.push(`Not: ${f.notesFilter}`);
  if (f.aiCategory) parts.push(`AI: ${label(f.aiCategory)}`);
  if (f.tagIds && (!Array.isArray(f.tagIds) || (f.tagIds as unknown[]).length > 0)) parts.push(`Etiket: ${label(f.tagIds)}`);
  if (parts.length === 0) return null;

  const url = buildFilterUrl(projectId, filters);
  return (
    <button
      className="flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5"
      onClick={() => onNavigate(url)}
      title="Bu filtreyi havuzda aç"
    >
      <Filter className="w-2.5 h-2.5" />
      {parts.slice(0, 3).join(" · ")}
      {parts.length > 3 && ` +${parts.length - 3} daha`}
    </button>
  );
}

function KALink({
  kaId,
  kaName,
  kesimAlanlari,
  onNavigate,
}: {
  kaId: string | null;
  kaName?: string | null;
  kesimAlanlari: Array<{ id: string; name: string }>;
  onNavigate: (path: string) => void;
}) {
  if (!kaId) return null;
  const ka = kesimAlanlari.find(k => k.id === kaId);
  const name = kaName || ka?.name || kaId;

  return (
    <button
      className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
      onClick={() => onNavigate(`/kesim/${kaId}`)}
      title={`${name} kesim listesine git`}
    >
      <ExternalLink className="w-2.5 h-2.5" />
      {name}
    </button>
  );
}


function LogEntryRow({
  entry,
  projectId,
  kesimAlanlari,
  onNavigate,
}: {
  entry: AuditLogEntry;
  projectId: string;
  kesimAlanlari: Array<{ id: string; name: string }>;
  onNavigate: (path: string) => void;
}) {
  const meta = entry.metadata as Record<string, unknown> | null;

  return (
    <div className="border-b last:border-b-0 py-2 px-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${ACTION_COLORS[entry.action] || ""}`}
          >
            {ACTION_LABELS[entry.action] || entry.action}
          </Badge>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {ENTITY_LABELS[entry.entityType] || entry.entityType}
          </span>
          {entry.affectedCount != null && entry.affectedCount > 0 && (
            <span className="text-[10px] font-medium text-foreground">
              ({entry.affectedCount} kayıt)
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
          {formatDateTime(entry.createdAt)}
        </span>
      </div>

      {entry.entityName && (
        <div className="text-[10px] text-foreground mt-0.5 truncate" title={entry.entityName}>
          {entry.entityName}
        </div>
      )}

      {entry.targetKesimAlaniId && (
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px] text-muted-foreground">Hedef:</span>
          <KALink
            kaId={entry.targetKesimAlaniId}
            kaName={meta?.targetKesimAlaniName as string | null}
            kesimAlanlari={kesimAlanlari}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {meta?.sourceKesimAlaniId && (
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px] text-muted-foreground">Kaynak:</span>
          <KALink
            kaId={meta.sourceKesimAlaniId as string}
            kaName={meta.sourceKesimAlaniName as string | null}
            kesimAlanlari={kesimAlanlari}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {entry.filters && (
        <FiltersDisplay
          filters={entry.filters}
          projectId={projectId}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

export function ProjectAuditLogSection({
  projectId,
  kesimAlanlari,
  onNavigate,
}: ProjectAuditLogSectionProps) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);

  const loadLogs = useCallback(async (append = false) => {
    setLoading(true);
    try {
      const cursor = append ? nextCursor ?? undefined : undefined;
      const result = await fetchAuditLogs({ projectId, limit: 30, cursor });
      if (append) {
        setLogs(prev => [...prev, ...result.items]);
      } else {
        setLogs(result.items);
      }
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch (err) {
      console.error("[ProjectAuditLogSection] Log yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, nextCursor]);

  useEffect(() => {
    if (open && logs.length === 0) {
      loadLogs(false);
    }
  }, [open]);

  return (
    <div className="mb-6">
      <Button
        variant="outline"
        className="w-full justify-between mb-3"
        onClick={() => setOpen(v => !v)}
      >
        <span className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-500" />
          İşlem Geçmişi
          {logs.length > 0 && (
            <span className="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 text-xs px-1.5 py-0.5 rounded-full font-semibold">
              {logs.length}{hasMore ? "+" : ""}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {open && (
            <span
              role="button"
              tabIndex={0}
              className="text-xs text-muted-foreground hover:text-foreground px-1"
              onClick={(e) => { e.stopPropagation(); loadLogs(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); loadLogs(false); } }}
              title="Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </Button>

      {open && (
        <Card className="p-0 overflow-hidden">
          {loading && logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
              Yükleniyor...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Henüz işlem geçmişi yok.
            </div>
          ) : (
            <div className="divide-y">
              <div className="max-h-[400px] overflow-y-auto">
                <div className="p-2">
                  {logs.map(entry => (
                    <LogEntryRow
                      key={entry.id}
                      entry={entry}
                      projectId={projectId}
                      kesimAlanlari={kesimAlanlari}
                      onNavigate={onNavigate}
                    />
                  ))}
                  {hasMore && (
                    <div className="text-center pt-3 pb-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadLogs(true)}
                        disabled={loading}
                      >
                        {loading ? "Yükleniyor..." : "Daha Fazla Göster"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
