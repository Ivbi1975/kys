import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RotateCcw, Wand2, X } from "lucide-react";
import type { useKesimAlaniState } from "./useKesimAlaniState";
import { KesimAlaniProvider } from "./KesimAlaniContext";
import { KesimAlaniHeader, StatsCards, DonorListPanel, GroupListPanel } from "./sections";

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
      <div className={`mx-auto p-4 uppercase ${fullscreenMode ? "max-w-full" : "max-w-7xl"} ${basketItems.length > 0 ? "pb-24" : ""}`}>
        {!fullscreenMode && <KesimAlaniHeader />}

        {!fullscreenMode && <StatsCards />}

        {!fullscreenMode && kesim.donations.length > 0 && (
          <div className="mb-4 flex gap-2">
            <Button onClick={() => handleAutoGroup()} className="flex-1" disabled={groupingInProgress}>
              {groupingInProgress ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {groupingProgress
                    ? `Gruplama: ${groupingProgress.current}/${groupingProgress.total} hayvan`
                    : "Gruplama başlıyor..."}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  {kesim.animalGroups.length > 0 ? "Artımlı Grupla" : "Otomatik Grupla"} ({requiredAnimals} Hayvan)
                </>
              )}
            </Button>
            {!groupingInProgress && kesim.animalGroups.length > 0 && (
              <Button variant="outline" onClick={() => handleAutoGroup(true)} disabled={groupingInProgress} title="Tüm grupları sıfırdan yeniden oluştur">
                <RotateCcw className="w-4 h-4 mr-1" />
                Tam Grupla
              </Button>
            )}
            {groupingInProgress && (
              <Button variant="destructive" size="icon" onClick={cancelGrouping} title="İptal">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {historyPanelOpen && !fullscreenMode && (
          <Card className="mb-4 p-3 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">İşlem Geçmişi</h3>
              <Button variant="ghost" size="sm" onClick={() => setHistoryPanelOpen(false)}>✕</Button>
            </div>
            <div className="space-y-1">
              {history.historyList.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleGoToStep(i)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                    item.isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="font-medium">{item.description}</span>
                  <span className="ml-2 opacity-60">
                    {new Date(item.timestamp).toLocaleTimeString("tr-TR")}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {!fullscreenMode && (
          <div className="flex md:hidden border-b mb-4">
            <button
              className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${mobileTab === "donors" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => startFilterTransition(() => setMobileTab("donors"))}
            >
              Bağışçı Listesi ({kesim.donations.filter(d => !d.excluded).length})
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${mobileTab === "groups" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => startFilterTransition(() => setMobileTab("groups"))}
            >
              Hayvan Grupları ({kesim.animalGroups.length})
            </button>
          </div>
        )}

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
      </div>
    </KesimAlaniProvider>
  );
}
