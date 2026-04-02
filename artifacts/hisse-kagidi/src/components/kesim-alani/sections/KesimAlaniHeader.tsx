import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchKesimAlaniTrackingNotes, fetchNotificationLogs } from "@/lib/api";
import {
  ChevronRight, FileSpreadsheet, History, Home, Keyboard, Link2, Loader2,
  Maximize, MessageSquarePlus, Minimize, Printer, QrCode,
  Redo2, Save, Search, Send, Undo2, UserCog, Download,
} from "lucide-react";
import { useKesimAlaniContext } from "../KesimAlaniContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTrackingActions } from "@/hooks/useTrackingActions";

export function KesimAlaniHeader() {
  const {
    kesim, setKesim, setLocation, projectName, save, saveToApi, saveStatus, saveProgress, lastSavedTime,
    toast, handleUndo, handleRedo, history, historyPanelOpen,
    setHistoryPanelOpen, setShortcutHelpOpen, toggleFullscreen, isFullscreen,
    exportDonorsExcel, exportGroupsExcel, handleExportKaCsv, csvExporting,
    setQrUrl, setQrModalOpen, setTrackingNotesOpen, setTrackingNotesLoading, setTrackingNotes,
    setNotificationLogsOpen, setNotificationLogsLoading, setNotificationLogs, setTeamDialogOpen,
    totalShares, requiredAnimals,
  } = useKesimAlaniContext();

  const { resolveToken, buildTrackingUrl } = useTrackingActions({
    onTokenGenerated: (_, token) => {
      setKesim(prev => prev ? { ...prev, trackingToken: token } : prev);
    },
  });

  if (!kesim) return null;

  return (
    <div className="mb-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground mb-2 flex-wrap">
        <button onClick={() => setLocation("/")} className="flex items-center gap-1 hover:text-foreground transition-colors" aria-label="Ana Sayfa">
          <Home className="w-3 h-3" aria-hidden="true" />
          <span>Ana Sayfa</span>
        </button>
        {kesim.projectId && projectName && (
          <>
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => setLocation(`/proje/${kesim.projectId}`)} className="hover:text-foreground transition-colors truncate max-w-[120px]">
              {projectName}
            </button>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{kesim.name}</span>
      </nav>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">{kesim.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs md:text-sm text-muted-foreground truncate">
              {kesim.donations.length} bağışçı • {totalShares} hisse • {requiredAnimals} hayvan
            </p>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">ID:</span>
              <Input
                className="h-6 text-xs w-28 px-1.5"
                placeholder="Liste ID"
                aria-label="Liste ID"
                value={kesim.kesimListeId || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const updated = { ...kesim, kesimListeId: val || null };
                  save(updated, undefined, false);
                }}
                onBlur={() => {
                  save(kesim, undefined, true);
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            aria-label="Takip Linki"
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
            <Link2 className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Takip Linki</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label="QR Kod"
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
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">QR Kod</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label="Saha Notları"
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
            <MessageSquarePlus className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Saha Notları</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label="Ekipler"
            onClick={() => setTeamDialogOpen(true)}
          >
            <UserCog className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Ekipler</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label="Bildirimler"
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
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Bildirimler</span>
          </Button>
          <ThemeToggle className="h-8 w-8 p-0 shrink-0" />
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => saveToApi(kesim)}
            disabled={saveStatus === "saving"}
            aria-label="Kaydet"
          >
            {saveStatus === "saving" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline ml-1">Kaydet</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              {saveProgress
                ? `Kaydediliyor... (${saveProgress.chunkIndex + 1}/${saveProgress.totalChunks})`
                : "Kaydediliyor..."}
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <Save className="w-3 h-3" />
              Kaydedildi
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-destructive">
              <span className="w-3 h-3">⚠</span>
              Kaydetme hatası
            </span>
          )}
          {(saveStatus === "idle" || saveStatus === "saved") && lastSavedTime && (
            <span className="flex items-center gap-1">
              <Save className="w-3 h-3" />
              Son kayıt: {lastSavedTime.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })} {lastSavedTime.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap justify-end">
          <div className="flex items-center gap-0.5 border rounded-md px-0.5">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleUndo} disabled={!history.canUndo} title="Geri Al (Ctrl+Z)" aria-label="Geri Al">
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleRedo} disabled={!history.canRedo} title="İleri Al (Ctrl+Y)" aria-label="İleri Al">
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setHistoryPanelOpen(!historyPanelOpen)} title="Geçmiş" aria-label="Geçmiş">
              <History className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hidden sm:flex" onClick={() => setShortcutHelpOpen(true)} title="Klavye Kısayolları (?)" aria-label="Klavye Kısayolları">
            <Keyboard className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hidden sm:flex" onClick={toggleFullscreen} title="Tam Ekran (F11)" aria-label={isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran"}>
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={exportDonorsExcel} title="Bağışçı Listesi Excel" aria-label="Bağışçı Listesi Excel">
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </Button>
          {kesim.animalGroups.length > 0 && (
            <>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={exportGroupsExcel} title="Kesim Kağıdı Excel" aria-label="Kesim Kağıdı Excel">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setLocation(`/not-duzenleme/${kesim.id}`)}>
                <Search className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">Notlar</span>
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setLocation(`/print/${kesim.id}`)}>
                <Printer className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">Yazdır</span>
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleExportKaCsv} disabled={csvExporting}>
                <Download className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">{csvExporting ? "..." : "CSV"}</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
