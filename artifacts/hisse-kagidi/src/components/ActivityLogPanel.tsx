import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X, Loader2, RotateCcw, ArrowRightLeft, Truck, FileInput,
  Trash2, CheckSquare, Tag, Plus, SlidersHorizontal, History,
  AlertCircle,
} from "lucide-react";
import { fetchProjectAuditLogs, undoProjectAuditLog, isReversibleEntry } from "@/lib/api/audit-logs";
import type { AuditLogEntry, ProjectAuditLogFilters } from "@/lib/api/audit-logs";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface ActivityLogPanelProps {
  projectId: string;
  scope: "all" | "havuz" | "kesim";
  kesimAlaniId?: string;
  open: boolean;
  onClose: () => void;
  onUndoSuccess?: () => void;
  showUndoLastButton?: boolean;
  kesimAlanlariMap?: Record<string, string>;
  onFilterRestore?: (snapshot: Record<string, unknown>) => void;
}

type ScopeFilter = "all" | "havuz" | "kesim";
type ActionGroup = "all" | "transfer" | "import" | "delete" | "other";

const ACTION_GROUPS: { key: ActionGroup; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "transfer", label: "Aktarım" },
  { key: "import", label: "Yükleme" },
  { key: "delete", label: "Silme" },
  { key: "other", label: "Diğer" },
];

function actionToGroup(action: string): ActionGroup {
  if (["bulk_transfer", "move", "transfer"].includes(action)) return "transfer";
  if (["bulk_import", "import", "bulk_create", "create"].includes(action)) return "import";
  if (["delete", "bulk_action"].includes(action)) return "delete";
  return "other";
}

function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "az önce";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return new Date(isoDate).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function ActionIcon({ action }: { action: string }) {
  const cls = "w-3.5 h-3.5 shrink-0";
  if (action === "bulk_transfer") return <Truck className={cls} />;
  if (action === "move") return <ArrowRightLeft className={cls} />;
  if (action === "transfer") return <ArrowRightLeft className={cls} />;
  if (action === "bulk_import" || action === "import") return <FileInput className={cls} />;
  if (action === "delete" || action === "bulk_action") return <Trash2 className={cls} />;
  if (action === "toggle_kesildi") return <CheckSquare className={cls} />;
  if (action === "create" || action === "bulk_create") return <Plus className={cls} />;
  if (action === "filter_apply") return <SlidersHorizontal className={cls} />;
  if (action.includes("tag")) return <Tag className={cls} />;
  return <History className={cls} />;
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    bulk_transfer: "Toplu Aktarım",
    move: "Taşıma",
    transfer: "Transfer",
    bulk_import: "Toplu Yükleme",
    import: "Yükleme",
    delete: "Silme",
    bulk_action: "Toplu İşlem",
    toggle_kesildi: "Kesildi Güncelleme",
    create: "Oluşturma",
    bulk_create: "Toplu Oluşturma",
    filter_apply: "Filtre Uygulandı",
    update: "Güncelleme",
    archive: "Arşivleme",
    unarchive: "Arşivden Çıkarma",
    split: "Bölme",
    merge: "Birleştirme",
    lock: "Kilitleme",
    unlock: "Kilit Açma",
    repair: "Onarım",
    export: "Dışa Aktarım",
  };
  return labels[action] ?? action;
}

function FilterSnapshotChips({
  snapshot,
  onRestore,
}: {
  snapshot: Record<string, unknown>;
  onRestore?: () => void;
}) {
  const chips: string[] = [];
  if (snapshot.search) chips.push(`Ara: "${snapshot.search}"`);
  if (Array.isArray(snapshot.donationTypes) && snapshot.donationTypes.length > 0) {
    chips.push(`Tür: ${(snapshot.donationTypes as string[]).join(", ")}`);
  }
  if (Array.isArray(snapshot.tags) && snapshot.tags.length > 0) {
    chips.push(`Etiket: ${snapshot.tags.length} adet`);
  }
  if (snapshot.dateFrom || snapshot.dateTo) {
    chips.push(`Tarih: ${snapshot.dateFrom || "…"} – ${snapshot.dateTo || "…"}`);
  }
  if (snapshot.status) chips.push(`Durum: ${snapshot.status}`);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {chips.map(chip => (
        onRestore ? (
          <button
            key={chip}
            onClick={onRestore}
            title="Bu filtreyi uygula"
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground border border-border/50 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
          >
            {chip}
          </button>
        ) : (
          <span key={chip} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground border border-border/50">
            {chip}
          </span>
        )
      ))}
    </div>
  );
}

function EntrySummary({
  entry,
  kesimAlanlariMap,
  onKaClick,
  onFilterRestore,
}: {
  entry: AuditLogEntry;
  kesimAlanlariMap?: Record<string, string>;
  onKaClick: (kaId: string) => void;
  onFilterRestore?: (snapshot: Record<string, unknown>) => void;
}) {
  const meta = entry.metadata as Record<string, unknown> | null;
  const count = entry.affectedCount;
  const countBadge = count != null && count > 0
    ? <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">{count} bağış</Badge>
    : null;
  const undone = meta?.undone === true;
  const filterSnapshot = meta?.filterSnapshot as Record<string, unknown> | undefined;

  if (entry.action === "bulk_transfer") {
    const target = meta?.targetKesimAlaniName as string | undefined;
    const kaId = entry.targetKesimAlaniId;
    const kaName = target || (kaId && kesimAlanlariMap?.[kaId]) || kaId;
    return (
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center flex-wrap gap-1 text-xs">
          <span className="text-muted-foreground">Havuzdan aktarıldı</span>
          {kaName && (
            <button
              onClick={() => kaId && onKaClick(kaId)}
              className="font-medium text-foreground hover:text-primary hover:underline text-xs"
            >
              → {kaName}
            </button>
          )}
          {countBadge}
          {undone && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground/50">geri alındı</Badge>
          )}
        </span>
        {filterSnapshot && (
          <FilterSnapshotChips
            snapshot={filterSnapshot}
            onRestore={onFilterRestore ? () => onFilterRestore(filterSnapshot) : undefined}
          />
        )}
      </span>
    );
  }

  if (entry.action === "move") {
    const src = meta?.sourceKesimAlaniName as string | undefined;
    const tgt = meta?.targetKesimAlaniName as string | undefined;
    const kaId = entry.targetKesimAlaniId;
    return (
      <span className="flex items-center flex-wrap gap-1 text-xs">
        <span className="text-muted-foreground">Taşındı</span>
        {src && <span className="text-muted-foreground/70 text-[11px]">{src}</span>}
        {tgt && (
          <button
            onClick={() => kaId && onKaClick(kaId)}
            className="font-medium text-foreground hover:text-primary hover:underline text-xs"
          >
            → {tgt}
          </button>
        )}
        {countBadge}
      </span>
    );
  }

  if (entry.action === "bulk_import" || entry.action === "import") {
    return <span className="flex items-center gap-1 text-xs text-muted-foreground">Bağış yüklendi{countBadge}</span>;
  }

  if (entry.action === "bulk_action") {
    const act = meta?.action as string | undefined;
    const label = act === "delete" ? "Toplu silindi"
      : act === "exclude" ? "Hariç tutuldu"
      : act === "include" ? "Dahil edildi"
      : "İşlem yapıldı";
    return <span className="flex items-center gap-1 text-xs text-muted-foreground">{label}{countBadge}</span>;
  }

  if (entry.action === "filter_apply") {
    return <span className="flex items-center gap-1 text-xs text-muted-foreground">Filtre uygulandı{countBadge}</span>;
  }

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {actionLabel(entry.action)}
      {countBadge}
    </span>
  );
}

export function ActivityLogPanel({
  projectId,
  scope: initialScope,
  kesimAlaniId,
  open,
  onClose,
  onUndoSuccess,
  showUndoLastButton = false,
  kesimAlanlariMap,
  onFilterRestore,
}: ActivityLogPanelProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeScope, setActiveScope] = useState<ScopeFilter>(
    initialScope === "kesim" ? "kesim" : initialScope === "havuz" ? "havuz" : "all",
  );
  const [actionGroup, setActionGroup] = useState<ActionGroup>("all");
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [undoingId, setUndoingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUndoingLast, setIsUndoingLast] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildFilters = useCallback((scope: ScopeFilter, cursor?: number): ProjectAuditLogFilters => {
    const f: ProjectAuditLogFilters = { limit: 50, cursor };
    if (scope === "havuz") f.scope = "havuz";
    else if (scope === "kesim" && kesimAlaniId) { f.scope = "kesim"; f.kesimAlaniId = kesimAlaniId; }
    else f.scope = "all";
    return f;
  }, [kesimAlaniId]);

  const loadEntries = useCallback(async (scope: ScopeFilter, cursor?: number, append = false) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsLoading(true);
    setError(null);
    try {
      const filters = buildFilters(scope, cursor);
      const result = await fetchProjectAuditLogs(projectId, filters, ctrl.signal);
      if (append) {
        setEntries(prev => [...prev, ...result.items]);
      } else {
        setEntries(result.items);
      }
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Kayıtlar yüklenemedi");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, buildFilters]);

  useEffect(() => {
    if (!open) return;
    setEntries([]);
    setNextCursor(null);
    setHasMore(false);
    loadEntries(activeScope);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setEntries([]);
    setNextCursor(null);
    setHasMore(false);
    loadEntries(activeScope);
  }, [activeScope]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      setActiveScope(initialScope === "kesim" ? "kesim" : initialScope === "havuz" ? "havuz" : "all");
      setActionGroup("all");
    }
  }, [open, initialScope]);

  const handleLoadMore = useCallback(() => {
    if (nextCursor && !isLoading) {
      loadEntries(activeScope, nextCursor, true);
    }
  }, [activeScope, nextCursor, isLoading, loadEntries]);

  useEffect(() => {
    if (!hasMore || isLoading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) handleLoadMore(); },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.unobserve(sentinel);
  }, [hasMore, isLoading, handleLoadMore]);

  const handleUndo = useCallback(async (entry: AuditLogEntry) => {
    setUndoingId(entry.id);
    try {
      const result = await undoProjectAuditLog(projectId, entry.id);
      toast({ title: `${result.count} bağış havuza geri alındı` });
      setEntries(prev => prev.map(e =>
        e.id === entry.id
          ? { ...e, metadata: { ...(e.metadata as Record<string, unknown>), undone: true } }
          : e,
      ));
      onUndoSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Geri alma başarısız";
      toast({ title: "Geri alma hatası", description: msg, variant: "destructive" });
    } finally {
      setUndoingId(null);
    }
  }, [projectId, toast, onUndoSuccess]);

  const handleUndoLast = useCallback(async () => {
    const visibleReversible = filteredEntries.find(isReversibleEntry);
    const lastReversible = visibleReversible ?? entries.find(isReversibleEntry);
    if (!lastReversible) {
      toast({ title: "Geri alınacak işlem bulunamadı" });
      return;
    }
    setIsUndoingLast(true);
    try {
      await handleUndo(lastReversible);
    } finally {
      setIsUndoingLast(false);
    }
  }, [entries, handleUndo, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKaClick = useCallback((kaId: string) => {
    setLocation(`/kesim/${kaId}`);
    onClose();
  }, [setLocation, onClose]);

  if (!open) return null;

  const filteredEntries = actionGroup === "all"
    ? entries
    : entries.filter(e => actionToGroup(e.action) === actionGroup);

  const scopeTabs: { key: ScopeFilter; label: string }[] = initialScope === "all"
    ? [{ key: "all", label: "Tümü" }, { key: "havuz", label: "Havuz" }, { key: "kesim", label: "Kesim" }]
    : initialScope === "havuz"
      ? [{ key: "havuz", label: "Havuz" }, { key: "all", label: "Tümü" }]
      : [{ key: "kesim", label: "Bu Liste" }, { key: "all", label: "Tümü" }];

  const lastReversible = filteredEntries.find(isReversibleEntry) ?? entries.find(isReversibleEntry);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm flex flex-col bg-background border-l shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Aktivite Günlüğü"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Aktivite Günlüğü</h2>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Scope filter chips */}
        {scopeTabs.length > 1 && (
          <div className="flex items-center gap-1 px-3 py-2 border-b shrink-0">
            {scopeTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveScope(tab.key)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  activeScope === tab.key
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Action type filter chips */}
        <div className="flex items-center gap-1 px-3 py-2 border-b shrink-0 overflow-x-auto scrollbar-none">
          {ACTION_GROUPS.map(grp => (
            <button
              key={grp.key}
              onClick={() => setActionGroup(grp.key)}
              className={`shrink-0 px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
                actionGroup === grp.key
                  ? "bg-secondary text-secondary-foreground border-secondary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {grp.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 m-3 p-2.5 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {!error && !isLoading && filteredEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <History className="w-8 h-8 opacity-30" />
              <p className="text-sm">Kayıt bulunamadı</p>
            </div>
          )}

          <div className="divide-y">
            {filteredEntries.map(entry => {
              const reversible = isReversibleEntry(entry);
              const meta = entry.metadata as Record<string, unknown> | null;
              const undone = meta?.undone === true;
              const isUndoingThis = undoingId === entry.id;

              return (
                <div key={entry.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0 text-muted-foreground">
                      <ActionIcon action={entry.action} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <EntrySummary
                        entry={entry}
                        kesimAlanlariMap={kesimAlanlariMap}
                        onKaClick={handleKaClick}
                        onFilterRestore={onFilterRestore}
                      />
                      <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1.5">
                        <span>{relativeTime(entry.createdAt)}</span>
                        {entry.ipAddress && (
                          <span className="opacity-50" title={`IP: ${entry.ipAddress}`}>· {entry.ipAddress}</span>
                        )}
                      </p>
                    </div>
                    {reversible && !undone && (
                      <div className="shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => handleUndo(entry)}
                          disabled={isUndoingThis || !!undoingId}
                          title="Bu işlemi geri al"
                        >
                          {isUndoingThis
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <RotateCcw className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    )}
                    {!reversible && !undone && (
                      <span
                        className="shrink-0 text-[9px] text-muted-foreground/40 italic self-start mt-1 leading-tight text-right max-w-[48px]"
                        title="Bu işlem türü geri alınamaz"
                      >
                        geri alınamaz
                      </span>
                    )}
                    {undone && (
                      <span className="shrink-0 text-[10px] text-muted-foreground/50 italic self-start mt-0.5">geri alındı</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* IntersectionObserver sentinel — triggers auto-load when scrolled into view */}
          <div ref={sentinelRef} className="h-4" />
        </div>

        {/* Footer: undo last */}
        {showUndoLastButton && (
          <div className="border-t px-4 py-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 gap-1.5 text-xs"
              onClick={handleUndoLast}
              disabled={!lastReversible || isUndoingLast || !!undoingId || isLoading}
              title={lastReversible ? "Son tersine çevrilebilir işlemi geri al (Ctrl+Z)" : "Geri alınacak işlem yok"}
            >
              {isUndoingLast
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RotateCcw className="w-3.5 h-3.5" />}
              Son işlemi geri al
              {!lastReversible && !isLoading && (
                <span className="text-muted-foreground/50 ml-1">(yok)</span>
              )}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
