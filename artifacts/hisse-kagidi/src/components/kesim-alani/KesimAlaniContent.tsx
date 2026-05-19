import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RotateCcw, Wand2, X } from "lucide-react";
import type { useKesimAlaniState } from "./useKesimAlaniState";
import { KesimAlaniProvider } from "./KesimAlaniContext";
import { KesimAlaniHeader, StatsCards, DonorListPanel, GroupListPanel } from "./sections";
import { SonIslemlerKart } from "@/components/SonIslemlerKart";

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

        {/* ── İşlem Geçmişi Paneli ── */}
        {historyPanelOpen && !fullscreenMode && (
          <Card className="mb-4 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <h3 className="text-xs font-semibold text-foreground">İşlem Geçmişi</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setHistoryPanelOpen(false)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
              {history.historyList.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">Henüz işlem yok</p>
              )}
              {history.historyList.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleGoToStep(i)}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                    item.isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span>{item.description}</span>
                  <span className={`ml-2 text-[10px] ${item.isActive ? "opacity-70" : "text-muted-foreground"}`}>
                    {new Date(item.timestamp).toLocaleTimeString("tr-TR")}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

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
