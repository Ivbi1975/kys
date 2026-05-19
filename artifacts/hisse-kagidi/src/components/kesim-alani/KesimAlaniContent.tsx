import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Clock, Loader2, RotateCcw, Wand2, X } from "lucide-react";
import type { useKesimAlaniState } from "./useKesimAlaniState";
import { KesimAlaniProvider, useKesimAlaniContext } from "./KesimAlaniContext";
import { KesimAlaniHeader, StatsCards, DonorListPanel, GroupListPanel } from "./sections";
import { SonIslemlerKart } from "@/components/SonIslemlerKart";

const MAX_LOG_VISIBLE = 10;

function HistoryLogPanel() {
  const { history, handleUndo, handleRedo, handleGoToStep, setHistoryPanelOpen } = useKesimAlaniContext();

  const list = history.historyList;
  const total = list.length;
  const activeIdx = list.findIndex(e => e.isActive);
  const currentStep = activeIdx + 1;

  const windowStart = Math.max(0, Math.min(activeIdx - 4, total - MAX_LOG_VISIBLE));
  const windowEnd = Math.min(total, windowStart + MAX_LOG_VISIBLE);
  const displayList = list.slice(windowStart, windowEnd).map((e, i) => ({
    ...e,
    absoluteIdx: windowStart + i,
  }));

  const hiddenBefore = windowStart;
  const hiddenAfter = total - windowEnd;

  return (
    <Card className="mb-4 overflow-hidden border-primary/20 shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary/70" />
          <h3 className="text-xs font-semibold text-foreground">İşlem Geçmişi</h3>
          {total > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              ({currentStep}/{total})
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost" size="sm" className="h-6 w-6 p-0"
            onClick={handleUndo} disabled={!history.canUndo}
            title={`Geri Al${history.canUndo ? ` — ${list[activeIdx - 1]?.description}` : ""}`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm" className="h-6 w-6 p-0"
            onClick={handleRedo} disabled={!history.canRedo}
            title={`İleri Al${history.canRedo ? ` — ${list[activeIdx + 1]?.description}` : ""}`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setHistoryPanelOpen(false)}
            title="Kapat"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-1.5 space-y-0.5">
        {displayList.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Henüz işlem yok</p>
        )}

        {hiddenBefore > 0 && (
          <p className="text-[10px] text-muted-foreground/50 text-center py-0.5 italic">
            ↑ {hiddenBefore} önceki kayıt
          </p>
        )}

        {displayList.map(({ description, timestamp, isActive, absoluteIdx }) => {
          const isFuture = absoluteIdx > activeIdx;
          return (
            <button
              key={absoluteIdx}
              onClick={() => handleGoToStep(absoluteIdx)}
              className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 transition-colors group ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : isFuture
                    ? "text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground"
                    : "text-foreground hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[9px] tabular-nums w-4 text-right shrink-0 ${isActive ? "opacity-70" : "text-muted-foreground/40"}`}>
                  {absoluteIdx + 1}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-primary-foreground" : isFuture ? "bg-border" : "bg-muted-foreground/30 group-hover:bg-muted-foreground/60"}`} />
                <span className="truncate">{description}</span>
              </div>
              <span className={`text-[10px] shrink-0 ${isActive ? "opacity-70" : "text-muted-foreground/40"}`}>
                {new Date(timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </button>
          );
        })}

        {hiddenAfter > 0 && (
          <p className="text-[10px] text-muted-foreground/50 text-center py-0.5 italic">
            ↓ {hiddenAfter} sonraki kayıt
          </p>
        )}
      </div>

      {total > 1 && (
        <div className="px-3 py-2 border-t bg-muted/10 flex items-center justify-between">
          <Button
            variant="ghost" size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground gap-1 disabled:opacity-30"
            onClick={handleUndo} disabled={!history.canUndo}
          >
            <ChevronLeft className="w-3 h-3" />
            Geri Al
          </Button>
          <div className="flex items-center gap-1">
            {list.slice(Math.max(0, total - MAX_LOG_VISIBLE)).map((_, i) => {
              const absIdx = Math.max(0, total - MAX_LOG_VISIBLE) + i;
              return (
                <button
                  key={absIdx}
                  onClick={() => handleGoToStep(absIdx)}
                  className={`transition-all rounded-full ${absIdx === activeIdx ? "bg-primary w-2.5 h-2.5" : "bg-muted-foreground/30 hover:bg-muted-foreground/60 w-1.5 h-1.5"}`}
                  title={list[absIdx]?.description}
                />
              );
            })}
          </div>
          <Button
            variant="ghost" size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground gap-1 disabled:opacity-30"
            onClick={handleRedo} disabled={!history.canRedo}
          >
            İleri Al
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      )}
    </Card>
  );
}

type KesimAlaniStateReturn = ReturnType<typeof useKesimAlaniState>;

export function KesimAlaniContent(props: KesimAlaniStateReturn) {
  const {
    basketItems, cancelGrouping, donorListVisible, fullscreenMode, groupingInProgress,
    groupingProgress, handleAutoGroup, handleGoToStep, history, historyPanelOpen,
    isDraggingSplit, isMobile, kesim, mobileTab, requiredAnimals,
    scrollContainerRef, setHistoryPanelOpen, setIsDraggingSplit, setMobileTab,
    splitContainerRef, startFilterTransition, workspace,
  } = props;

  if (!kesim) return null;

  return (
    <KesimAlaniProvider value={props}>
      <div
        className={`mx-auto px-3 py-3 sm:px-4 sm:py-4 ${fullscreenMode ? "max-w-full" : "max-w-7xl"} ${basketItems.length > 0 ? "pb-24" : ""}`}
      >
        {!fullscreenMode && <KesimAlaniHeader />}

        {!fullscreenMode && <StatsCards />}

        {/* ── Auto-group / Group button bar ── */}
        {!fullscreenMode && kesim.donations.length > 0 && (
          <div className="mb-4 rounded-lg border bg-muted/30 p-2.5 flex gap-2 items-center">
            <Button
              onClick={() => handleAutoGroup()}
              className="flex-1 h-9 text-sm gap-2"
              disabled={groupingInProgress}
            >
              {groupingInProgress ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="truncate">
                    {groupingProgress
                      ? `Gruplama: ${groupingProgress.current}/${groupingProgress.total} hayvan`
                      : "Gruplama başlıyor..."}
                  </span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>
                    {kesim.animalGroups.length > 0 ? "Artımlı Grupla" : "Otomatik Grupla"}
                    <span className="hidden sm:inline ml-1 opacity-75">({requiredAnimals} hayvan)</span>
                  </span>
                </>
              )}
            </Button>
            {!groupingInProgress && kesim.animalGroups.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 flex-shrink-0"
                onClick={() => handleAutoGroup(true)}
                disabled={groupingInProgress}
                title="Tüm grupları sıfırdan yeniden oluştur"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tam Grupla</span>
              </Button>
            )}
            {groupingInProgress && (
              <Button
                variant="destructive"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={cancelGrouping}
                title="İptal"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* ── İşlem Geçmişi Log Paneli ── */}
        {historyPanelOpen && !fullscreenMode && <HistoryLogPanel />}

        {/* ── Mobil sekme seçici ── */}
        {!fullscreenMode && (
          <div className="flex md:hidden mb-3 rounded-lg border overflow-hidden">
            <button
              className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                mobileTab === "donors"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              onClick={() => startFilterTransition(() => setMobileTab("donors"))}
            >
              Bağışçılar
              <span className="ml-1.5 text-xs opacity-75 tabular-nums">
                ({kesim.donations.filter(d => !d.excluded).length})
              </span>
            </button>
            <button
              className={`flex-1 py-2.5 text-sm font-medium text-center border-l transition-colors ${
                mobileTab === "groups"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              onClick={() => startFilterTransition(() => setMobileTab("groups"))}
            >
              Gruplar
              <span className="ml-1.5 text-xs opacity-75 tabular-nums">
                ({kesim.animalGroups.length})
              </span>
            </button>
          </div>
        )}

        {/* ── Ana içerik: Bağışçı listesi + Grup listesi ── */}
        <div
          ref={splitContainerRef}
          className="flex gap-0"
          style={{ position: "relative" }}
        >
          {(isMobile || donorListVisible) && !fullscreenMode && (
            <div
              className={`${isMobile && mobileTab !== "donors" ? "hidden" : ""}`}
              style={isMobile ? { width: "100%", minWidth: 0 } : { width: `${workspace.prefs.splitRatio}%`, minWidth: 0, flexShrink: 0, paddingRight: "12px" }}
            >
              <DonorListPanel />
            </div>
          )}

          {donorListVisible && !fullscreenMode && !isMobile && (
            <div
              className="w-2 cursor-col-resize flex-shrink-0 group relative"
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingSplit(true);
              }}
            >
              <div className={`absolute inset-y-0 left-0 right-0 rounded transition-colors ${isDraggingSplit ? "bg-primary" : "bg-border group-hover:bg-primary/50"}`} />
            </div>
          )}

          <div
            className={`${isMobile && mobileTab !== "groups" ? "hidden" : ""}`}
            style={{ flex: 1, minWidth: 0 }}
            ref={fullscreenMode ? scrollContainerRef : undefined}
          >
            <GroupListPanel />
          </div>
        </div>

        {!fullscreenMode && kesim.projectId && (
          <div className="mt-6">
            <SonIslemlerKart
              projectId={kesim.projectId}
              kesimAlaniId={kesim.id}
              defaultOpen={false}
            />
          </div>
        )}
      </div>
    </KesimAlaniProvider>
  );
}
