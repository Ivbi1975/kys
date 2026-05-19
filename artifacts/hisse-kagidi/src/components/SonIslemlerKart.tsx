import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ClipboardList,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { fetchAuditLogs, type AuditLogEntry } from "@/lib/api/audit-logs";
import { formatDateTime } from "@/lib/formatting";
import { formatAuditLogDescription } from "@/lib/audit-log-formatter";

const ACTION_LABELS: Record<string, string> = {
  create: "Oluşturma",
  update: "Güncelleme",
  delete: "Silme",
  restore: "Geri Yükleme",
  archive: "Arşivleme",
  unarchive: "Arşivden Çıkarma",
  toggle_kesildi: "Kesildi",
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
  filter_apply: "Filtre",
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

interface SonIslemlerKartProps {
  projectId: string;
  kesimAlaniId?: string;
  poolScope?: boolean;
  defaultOpen?: boolean;
  limit?: number;
  className?: string;
}

export function SonIslemlerKart({
  projectId,
  kesimAlaniId,
  poolScope,
  defaultOpen = false,
  limit = 8,
  className = "",
}: SonIslemlerKartProps) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(defaultOpen);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const loadedRef = useRef(false);

  const loadLogs = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const result = await fetchAuditLogs({
        projectId,
        kesimAlaniId,
        poolScope,
        limit,
      }, abortRef.current.signal);
      setLogs(result.items);
      loadedRef.current = true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[SonIslemlerKart] Yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, kesimAlaniId, poolScope, limit]);

  useEffect(() => {
    if (open && !loadedRef.current) {
      loadLogs();
    }
  }, [open, loadLogs]);

  const viewAllUrl = kesimAlaniId
    ? `/proje/${projectId}/islem-gecmisi?ka=${kesimAlaniId}`
    : poolScope
      ? `/proje/${projectId}/islem-gecmisi?pool=1`
      : `/proje/${projectId}/islem-gecmisi`;

  return (
    <div className={className}>
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 border rounded-xl transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ClipboardList className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          Son İşlemler
          {logs.length > 0 && open && (
            <span className="text-xs text-muted-foreground font-normal">
              (son {logs.length})
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {open && (
            <span
              role="button"
              tabIndex={0}
              className="p-1 rounded text-muted-foreground hover:text-foreground"
              onClick={e => { e.stopPropagation(); loadedRef.current = false; loadLogs(); }}
              onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); loadedRef.current = false; loadLogs(); } }}
              title="Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <Card className="mt-1 p-0 overflow-hidden border rounded-xl">
          {loading && logs.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1.5" />
              Yükleniyor...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Henüz işlem geçmişi yok.
            </div>
          ) : (
            <>
              <div className="divide-y">
                {logs.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/20 transition-colors">
                    <Badge
                      variant="outline"
                      className={`flex-shrink-0 text-[10px] px-1.5 py-0 mt-0.5 ${ACTION_COLORS[entry.action] || ""}`}
                    >
                      {ACTION_LABELS[entry.action] || entry.action}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">
                        {formatAuditLogDescription(entry)}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-[10px] text-muted-foreground whitespace-nowrap pt-0.5">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 border-t bg-muted/10">
                <button
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => setLocation(viewAllUrl)}
                >
                  Tümünü Gör
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
