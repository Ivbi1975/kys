import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchKesimAlaniTrackingNotes, fetchNotificationLogs } from "@/lib/api";
import {
  ChevronRight, ChevronDown, FileSpreadsheet, History, Home, Keyboard, Link2, Loader2,
  MessageSquarePlus, Printer, QrCode,
  Redo2, Save, Search, Send, Settings2, ShoppingBag, Undo2, UserCog, Download,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { useKesimAlaniContext } from "../KesimAlaniContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTrackingActions } from "@/hooks/useTrackingActions";

export function KesimAlaniHeader() {
  const {
    kesim, setKesim, setLocation, projectName, save, saveToApi, saveStatus, saveProgress, lastSavedTime,
    toast, handleUndo, handleRedo, history, historyPanelOpen,
    setHistoryPanelOpen, setShortcutHelpOpen, toggleFullscreen, isFullscreen,
    exportDonorsExcel, exportGroupsExcel, handleExportKaCsv, csvExporting, excelExporting,
    setQrUrl, setQrModalOpen, setTrackingNotesOpen, setTrackingNotesLoading, setTrackingNotes,
    setNotificationLogsOpen, setNotificationLogsLoading, setNotificationLogs, setTeamDialogOpen,
    totalShares, requiredAnimals,
    basketItems, setBasketOpen,
  } = useKesimAlaniContext();

  const [panelOpen, setPanelOpen] = useState(false);

  const { resolveToken, buildTrackingUrl } = useTrackingActions({
    onTokenGenerated: (_, token) => {
      setKesim(prev => prev ? { ...prev, trackingToken: token } : prev);
    },
  });

  if (!kesim) return null;

  const hasGroups = kesim.animalGroups.length > 0;

  return (
    <div className="mb-4 space-y-2">

      {/* ── Breadcrumb ── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          aria-label="Ana Sayfa"
        >
          <Home className="w-3 h-3" />
          <span>Ana Sayfa</span>
        </button>
        {kesim.projectId && projectName && (
          <>
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <button
              onClick={() => setLocation(`/proje/${kesim.projectId}`)}
              className="hover:text-foreground transition-colors truncate max-w-[120px]"
            >
              {projectName}
            </button>
          </>
        )}
        <ChevronRight className="w-3 h-3 flex-shrink-0" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{kesim.name}</span>
      </nav>

      {/* ── Title row ── */}
      <div className="flex items-start justify-between gap-2">
        {/* Left: Title + stats */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground truncate leading-tight">{kesim.name}</h1>
            <button
              type="button"
              onClick={() => setPanelOpen(prev => !prev)}
              title={panelOpen ? "Ayarları Gizle" : "Çıktı Ayarları & Araçlar"}
              className={`shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md border transition-colors ${
                panelOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
              aria-expanded={panelOpen}
            >
              {panelOpen ? <ChevronDown className="w-3 h-3" /> : <Settings2 className="w-3 h-3" />}
            </button>
          </div>
          {/* Stats + save status */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{kesim.donations.length} bağışçı</span>
              <span className="text-border">·</span>
              <span className="tabular-nums">{totalShares} hisse</span>
              <span className="text-border">·</span>
              <span className="tabular-nums">{requiredAnimals} hayvan</span>
            </div>
            {/* Save status */}
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                {saveProgress
                  ? `Kaydediliyor… ${saveProgress.chunkIndex + 1}/${saveProgress.totalChunks}`
                  : "Kaydediliyor…"}
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                Kaydedildi
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="w-3 h-3" />
                Kaydetme hatası
              </span>
            )}
            {(saveStatus === "idle" || saveStatus === "saved") && lastSavedTime && (
              <span className="text-xs text-muted-foreground/60">
                {lastSavedTime.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })}{" "}
                {lastSavedTime.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        {/* Right: action toolbar */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">

          {/* Undo / Redo / History */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost" size="sm" className="h-8 w-8 p-0"
              onClick={handleUndo} disabled={!history.canUndo}
              title="Geri Al (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-8 w-8 p-0"
              onClick={handleRedo} disabled={!history.canRedo}
              title="İleri Al (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-8 w-8 p-0"
              onClick={() => setHistoryPanelOpen(!historyPanelOpen)}
              title="Geçmiş"
            >
              <History className="w-4 h-4" />
            </Button>
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-border mx-0.5" />

          {/* View utilities */}
          <div className="hidden sm:flex items-center gap-0.5">
            <Button
              variant="ghost" size="sm" className="h-8 w-8 p-0"
              onClick={() => setShortcutHelpOpen(true)}
              title="Klavye Kısayolları (?)"
            >
              <Keyboard className="w-4 h-4" />
            </Button>
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-border mx-0.5" />

          {/* Export actions */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost" size="sm" className="h-8 w-8 p-0"
              onClick={exportDonorsExcel}
              title="Bağışçı Listesi Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </Button>
            {hasGroups && (
              <>
                <Button
                  variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs"
                  onClick={exportGroupsExcel} disabled={excelExporting}
                  title="Kesim Kağıdı Excel"
                >
                  {excelExporting
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <FileSpreadsheet className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline font-medium">KK</span>
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-8 w-8 p-0"
                  onClick={() => setLocation(`/not-duzenleme/${kesim.id}`)}
                  title="Not Düzenleme"
                >
                  <Search className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-8 w-8 p-0"
                  onClick={() => setLocation(`/print/${kesim.id}`)}
                  title="Yazdır"
                >
                  <Printer className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs"
                  onClick={handleExportKaCsv} disabled={csvExporting}
                  title="CSV İndir"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline font-medium">{csvExporting ? "…" : "CSV"}</span>
                </Button>
              </>
            )}
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-border mx-0.5" />

          {/* Basket */}
          {basketItems.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="relative h-8 w-8 p-0 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
              aria-label="Sepet"
              onClick={() => setBasketOpen(prev => !prev)}
              title={`Sepet (${basketItems.length})`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-none px-1">
                {basketItems.length}
              </span>
            </Button>
          )}

          {/* Theme */}
          <ThemeToggle className="h-8 w-8 p-0 shrink-0" />

          {/* Save — primary CTA */}
          <Button
            size="sm"
            className="h-8 shrink-0 min-w-[80px]"
            onClick={() => saveToApi(kesim)}
            disabled={saveStatus === "saving"}
            aria-label="Kaydet"
          >
            {saveStatus === "saving"
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />}
            <span className="ml-1.5">Kaydet</span>
          </Button>
        </div>
      </div>

      {/* ── Collapsible settings panel ── */}
      {panelOpen && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          {/* Çıktı Ayarları */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              Çıktı Ayarları
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground whitespace-nowrap">ID:</label>
                <Input
                  className="h-8 text-sm w-28"
                  placeholder="Liste ID"
                  value={kesim.kesimListeId || ""}
                  onChange={(e) => save({ ...kesim, kesimListeId: e.target.value || null }, undefined, false)}
                  onBlur={() => save(kesim, undefined, true)}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Yetkili:</label>
                <Input
                  className="h-8 text-sm w-28"
                  placeholder="Yetkili"
                  value={kesim.yetkili || ""}
                  onChange={(e) => save({ ...kesim, yetkili: e.target.value || null }, undefined, false)}
                  onBlur={() => save(kesim, undefined, true)}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Çıktı İsmi:</label>
                <Input
                  className="h-8 text-sm w-40"
                  placeholder="Çıktıda görünecek isim"
                  value={kesim.displayName || ""}
                  onChange={(e) => save({ ...kesim, displayName: e.target.value || null }, undefined, false)}
                  onBlur={() => save(kesim, undefined, true)}
                />
              </div>
            </div>
          </div>

          {/* Araçlar */}
          <div className="border-t pt-3.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              Araçlar
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm" variant="outline"
                onClick={async () => {
                  try {
                    const token = await resolveToken(kesim);
                    const url = buildTrackingUrl(token);
                    await navigator.clipboard.writeText(url);
                    toast({ title: "Takip linki kopyalandı", description: "Link panoya kopyalandı" });
                  } catch {
                    toast({ title: "Hata", description: "Link oluşturulamadı", variant: "destructive" });
                  }
                }}
              >
                <Link2 className="w-4 h-4 mr-1.5" />Takip Linki
              </Button>
              <Button
                size="sm" variant="outline"
                onClick={async () => {
                  try {
                    const token = await resolveToken(kesim);
                    const url = buildTrackingUrl(token);
                    setQrUrl(url);
                    setQrModalOpen(true);
                  } catch {
                    toast({ title: "Hata", description: "QR kod oluşturulamadı", variant: "destructive" });
                  }
                }}
              >
                <QrCode className="w-4 h-4 mr-1.5" />QR Kod
              </Button>
              <Button
                size="sm" variant="outline"
                onClick={async () => {
                  setTrackingNotesOpen(true);
                  setTrackingNotesLoading(true);
                  try {
                    const notes = await fetchKesimAlaniTrackingNotes(kesim.id);
                    setTrackingNotes(notes);
                  } catch {} finally {
                    setTrackingNotesLoading(false);
                  }
                }}
              >
                <MessageSquarePlus className="w-4 h-4 mr-1.5" />Saha Notları
              </Button>
              <Button size="sm" variant="outline" onClick={() => setTeamDialogOpen(true)}>
                <UserCog className="w-4 h-4 mr-1.5" />Ekipler
              </Button>
              <Button
                size="sm" variant="outline"
                onClick={async () => {
                  setNotificationLogsOpen(true);
                  setNotificationLogsLoading(true);
                  try {
                    const logs = await fetchNotificationLogs(kesim.id);
                    setNotificationLogs(logs);
                  } catch {
                    toast({ title: "Hata", description: "Bildirim kayıtları yüklenemedi", variant: "destructive" });
                  } finally {
                    setNotificationLogsLoading(false);
                  }
                }}
              >
                <Send className="w-4 h-4 mr-1.5" />Bildirimler
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
