import { lazy, useState } from "react";
  import { LazyLoadBoundary } from "@/components/LazyLoadBoundary";
  import type { KesimAlani, Donation, AnimalGroup, ColorTag } from "@/lib/types";
  const LazyPersonEditDialog = lazy(() => import("./dialogs/PersonEditDialog"));
  const LazyTrashDialog = lazy(() => import("./dialogs/TrashDialog"));
  const LazyNotificationDialogs = lazy(() => import("./dialogs/NotificationDialogs"));
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
  import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Card } from "@/components/ui/card";
  import { Textarea } from "@/components/ui/textarea";
  import { Label } from "@/components/ui/label";
  import { Badge } from "@/components/ui/badge";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import { AlertTriangle, ArrowLeftRight, ArrowUp, Camera, Check, ChevronUp, Edit3, Keyboard, Loader2, Package, Plus, Printer, Scissors, Send, ShoppingBag, Sparkles, Trash2, UserCog, UserPlus, Wand2, X } from "lucide-react";
  const PhotoGallery = lazy(() => import("@/components/PhotoGallery"));
  const QrCodeModal = lazy(() => import("@/components/QrCodeModal"));
  import { computeEffectiveShares } from "@/lib/grouping";
    import { getGroupPhotoUrlAdmin } from "@/lib/api";
    import type { useKesimAlaniState } from "./useKesimAlaniState";

  type KesimAlaniStateReturn = ReturnType<typeof useKesimAlaniState>;

  export function KesimAlaniDialogs(props: KesimAlaniStateReturn) {
    const {
      kesim, toast, scrollToAnimalGroup, scrollContainerRef,
      personEditDesc, setPersonEditDesc, updateDonationField,
      swapPreviewOpen, cancelSwap, swapSelection, swapTarget, executeSwap, executeSwapSuggestion, getSwapSuggestions,
      autoResolveOpen, setAutoResolveOpen, resolveResults, applyAutoResolve,
      shortcutHelpOpen, setShortcutHelpOpen,
      splitShareDialog, setSplitShareDialog, getSplitOptions, applySplitShare,
      splitGroupDialog, setSplitGroupDialog, executeSplitGroup,
      smartPlacePopover, setSmartPlacePopover, smartPlaceDonor, getAvailableGroupsForDonor,
      personBulkDeleteConfirm, setPersonBulkDeleteConfirm, deleteDonation, bulkDeleteByDesc, bulkExcludeByDesc,
      trashOpen, setTrashOpen, trashItems, trashLoading, trashPermanentConfirm, setTrashPermanentConfirm, restoreDonation, permanentDeleteDonation,
      trackingNotesOpen, setTrackingNotesOpen, trackingNotes, setTrackingNotes, trackingNotesLoading,
      notificationLogsOpen, setNotificationLogsOpen, notificationLogs, notificationLogsLoading,
      notificationTemplateOpen, setNotificationTemplateOpen, notificationTemplate, setNotificationTemplate, notificationTemplateSaving, setNotificationTemplateSaving,
      photoViewGroup, setPhotoViewGroup, photoViewPhotos, photoViewLoading,
      teamDialogOpen, setTeamDialogOpen, teamName, setTeamName, teamEditId, setTeamEditId, teamColor, setTeamColor, teamSaving, handleSaveTeam, handleDeleteTeam,
      basketOpen, setBasketOpen, basketItems, localBasketItems, foreignBasketItems, basketItemIds,
      basketCrossKATarget, setBasketCrossKATarget, basketTransferTarget, setBasketTransferTarget,
      addToBasket, removeFromBasket, clearBasket, addDonorToBasket, transferBasketToGroup, autoDistributeBasket,
      crossKATransferring, transferBasketToOtherKA, transferForeignToCurrentDonorList,
      siblingKesimAlanlari, sortedDonorList, totalShares, filterTeam, setFilterTeam,
      jumpDialogOpen, setJumpDialogOpen,
      donorListReportOpen, setDonorListReportOpen, fullscreenMode, showScrollTop,
      qrModalOpen, setQrModalOpen, qrUrl,
      transferToDonorListConfirm, setTransferToDonorListConfirm, transferToDonorListRemoving,
      updateGroupDonation, addEmptyGroup,
      handleAssignTeam,
    } = props;

    const [jumpDialogValue, setJumpDialogValue] = useState("");

    if (!kesim) return null;

    return (
      <>
      {personEditDesc !== null && (
        <LazyLoadBoundary>
          <LazyPersonEditDialog
            kesim={kesim}
            personEditDesc={personEditDesc}
            setPersonEditDesc={setPersonEditDesc}
            updateDonationField={updateDonationField}
            updateGroupDonation={updateGroupDonation}
            bulkExcludeByDesc={bulkExcludeByDesc}
            setPersonBulkDeleteConfirm={setPersonBulkDeleteConfirm}
            deleteDonation={deleteDonation}
            basketItemIds={basketItemIds}
            removeFromBasket={removeFromBasket}
            addDonorToBasket={addDonorToBasket}
            addToBasket={addToBasket}
          />
        </LazyLoadBoundary>
      )}

    {swapPreviewOpen && <Dialog open={swapPreviewOpen} onOpenChange={(open) => { if (!open) cancelSwap(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-purple-600" />
            Takas Önizleme
          </DialogTitle>
        </DialogHeader>
        {swapSelection && swapTarget && kesim && (() => {
          const srcDonor = kesim.animalGroups[swapSelection.groupIdx]?.donations[swapSelection.donationIdx];
          const tgtDonor = kesim.animalGroups[swapTarget.groupIdx]?.donations[swapTarget.donationIdx];
          const srcShare = srcDonor?.shareCount || 1;
          const tgtShare = tgtDonor?.shareCount || 1;
          const shareMismatch = srcShare !== tgtShare;
          return (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-950">
                  <p className="text-xs text-muted-foreground mb-1">
                    Hayvan {kesim.animalGroups[swapSelection.groupIdx]?.animalNo}, Sıra {swapSelection.donationIdx + 1}
                  </p>
                  <p className="font-semibold text-sm">
                    {srcDonor?.description || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {srcDonor?.name || "—"}
                  </p>
                  <p className="text-xs mt-1 font-medium">{srcShare} hisse</p>
                </div>
                <div className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-950">
                  <p className="text-xs text-muted-foreground mb-1">
                    Hayvan {kesim.animalGroups[swapTarget.groupIdx]?.animalNo}, Sıra {swapTarget.donationIdx + 1}
                  </p>
                  <p className="font-semibold text-sm">
                    {tgtDonor?.description || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tgtDonor?.name || "—"}
                  </p>
                  <p className="text-xs mt-1 font-medium">{tgtShare} hisse</p>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <ArrowLeftRight className="w-6 h-6 text-purple-400" />
              </div>
              {shareMismatch && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Hisse sayıları farklı ({srcShare} ↔ {tgtShare}). Takas sonrası grup toplamları değişecek.</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={cancelSwap} className="flex-1">
                  İptal
                </Button>
                <Button onClick={executeSwap} className="flex-1">
                  <ArrowLeftRight className="w-4 h-4 mr-1" />
                  Takas Et
                </Button>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>}

    {autoResolveOpen && <Dialog open={autoResolveOpen} onOpenChange={setAutoResolveOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            Otomatik Çakışma Çözümü
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {resolveResults.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Otomatik çözülebilecek çakışma bulunamadı. Bazı gruplar kilitli olabilir veya uygun takas bulunamadı.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {resolveResults.length} kişi için toplam {resolveResults.reduce((sum, r) => sum + r.swaps.length, 0)} takas öneriliyor:
              </p>
              <div className="space-y-3">
                {resolveResults.map((result, i) => (
                  <Card key={i} className="p-3">
                    <p className="font-semibold text-sm mb-2">{result.desc}</p>
                    <div className="space-y-1">
                      {result.swaps.map((swap, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Hayvan {kesim!.animalGroups[swap.fromGroup]?.animalNo} #{swap.fromIdx + 1}</span>
                          <ArrowLeftRight className="w-3 h-3" />
                          <span>Hayvan {kesim!.animalGroups[swap.toGroup]?.animalNo} #{swap.toIdx + 1}</span>
                          <span className="text-xs opacity-60">
                            ({swap.fromName} ↔ {swap.toName})
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAutoResolveOpen(false)} className="flex-1">
                  İptal
                </Button>
                <Button onClick={applyAutoResolve} className="flex-1">
                  <Sparkles className="w-4 h-4 mr-1" />
                  Tümünü Uygula
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>}

    {shortcutHelpOpen && <Dialog open={shortcutHelpOpen} onOpenChange={setShortcutHelpOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Klavye Kısayolları
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {[
            { keys: "Ctrl + Z", desc: "Geri Al" },
            { keys: "Ctrl + Y", desc: "İleri Al" },
            { keys: "Ctrl + S", desc: "Kaydet" },
            { keys: "Ctrl + F", desc: "Bağışçı Ara" },
            { keys: "Ctrl + G", desc: "Gruba Atla" },
            { keys: "F11", desc: "Tam Ekran" },
            { keys: "?", desc: "Bu yardım panelini aç/kapat" },
            { keys: "Escape", desc: "Düzenlemeyi iptal et / paneli kapat" },
            { keys: "Tab", desc: "Sonraki hücreye geç" },
            { keys: "Shift + Tab", desc: "Önceki hücreye geç" },
            { keys: "Enter", desc: "Düzenlemeyi onayla" },
          ].map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <span className="text-sm text-muted-foreground">{shortcut.desc}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border border-border">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>}
    {splitShareDialog !== null && <Dialog open={splitShareDialog !== null} onOpenChange={(open) => { if (!open) setSplitShareDialog(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            Hisse Bölme
          </DialogTitle>
        </DialogHeader>
        {splitShareDialog && kesim && (() => {
          const donor = kesim.donations.find(d => d.id === splitShareDialog.donationId);
          if (!donor) return null;
          const options = getSplitOptions(splitShareDialog.totalShares);
          return (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                <strong>{donor.description || donor.name}</strong> — {splitShareDialog.totalShares} hisse nasıl bölünsün?
              </p>
              <div className="space-y-2">
                {options.map(([a, b], i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="w-full justify-between h-auto py-3"
                    onClick={() => applySplitShare(splitShareDialog.donationId, a, b)}
                  >
                    <span className="font-semibold">{a} + {b}</span>
                    <span className="text-xs text-muted-foreground">
                      {a === b ? "Eşit bölme" : a === 7 ? "Maksimum + kalan" : `Dengeli bölme`}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>}

    {splitGroupDialog !== null && <Dialog open={splitGroupDialog !== null} onOpenChange={(open) => { if (!open) setSplitGroupDialog(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            Grubu Böl
          </DialogTitle>
        </DialogHeader>
        {splitGroupDialog && kesim && (() => {
          const group = kesim.animalGroups[splitGroupDialog.groupIdx];
          if (!group) return null;
          const filled = group.donations.filter(d => d.name.trim() !== "");
          return (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                <strong>Hayvan {group.animalNo}</strong> — {filled.length} bağışçıyı nerede bölmek istiyorsunuz?
              </p>
              <div className="space-y-1">
                {filled.map((d, i) => {
                  if (i === 0) return null;
                  const isCurrent = splitGroupDialog.splitAt === i;
                  return (
                    <button
                      key={d.id}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors border ${
                        isCurrent
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-transparent hover:bg-muted"
                      }`}
                      onClick={() => setSplitGroupDialog({ ...splitGroupDialog, splitAt: i })}
                    >
                      <span className="text-muted-foreground mr-2">{i}/{filled.length - i}</span>
                      İlk {i}: {filled.slice(0, i).map(dd => dd.description || dd.name).join(", ")}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSplitGroupDialog(null)}>İptal</Button>
                <Button onClick={executeSplitGroup}>
                  <Scissors className="w-3 h-3 mr-1" />
                  {splitGroupDialog.splitAt}/{filled.length - splitGroupDialog.splitAt} Olarak Böl
                </Button>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>}

    {smartPlacePopover !== null && <Dialog open={smartPlacePopover !== null} onOpenChange={(open) => { if (!open) setSmartPlacePopover(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            Akıllı Yerleştirme
          </DialogTitle>
        </DialogHeader>
        {smartPlacePopover && kesim && (() => {
          const donor = kesim.donations.find(d => d.id === smartPlacePopover);
          if (!donor) return null;
          const available = getAvailableGroupsForDonor(smartPlacePopover);
          const swapSuggestions = getSwapSuggestions(smartPlacePopover);
          const effectiveShares = computeEffectiveShares(kesim.donations).get(donor.id) || donor.shareCount;
          return (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                <strong>{donor.description || donor.name}</strong> ({effectiveShares} hisse) nereye yerleştirilsin?
              </p>
              {available.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-primary">Doğrudan Yerleştirme</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {available.map(g => (
                      <Button
                        key={g.groupIdx}
                        variant="outline"
                        className="w-full justify-between h-auto py-2"
                        onClick={() => smartPlaceDonor(smartPlacePopover, g.groupIdx)}
                      >
                        <span className="font-semibold">Hayvan {g.animalNo}</span>
                        <span className="text-xs text-muted-foreground">{g.emptySlots} boş slot</span>
                      </Button>
                    ))}
                  </div>
                </>
              )}
              {swapSuggestions.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-amber-600">Takas Önerileri</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {swapSuggestions.map((s, i) => (
                      <Button
                        key={`swap-${i}`}
                        variant="outline"
                        className="w-full justify-between h-auto py-2 border-amber-300"
                        onClick={() => executeSwapSuggestion(smartPlacePopover, s.groupIdx, s.swapOutIds)}
                      >
                        <div className="text-left">
                          <span className="font-semibold block">Hayvan {s.animalNo}</span>
                          <span className="text-[10px] text-muted-foreground">{s.description}</span>
                        </div>
                        <span className="text-[10px] text-amber-600">{s.swapOutNames.join(", ")}</span>
                      </Button>
                    ))}
                  </div>
                </>
              )}
              {available.length === 0 && swapSuggestions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Uygun boşluğu olan veya takas yapılabilecek hayvan grubu bulunamadı.
                </p>
              )}
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>}

    {!!personBulkDeleteConfirm && <AlertDialog open={!!personBulkDeleteConfirm} onOpenChange={(open) => { if (!open) setPersonBulkDeleteConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Toplu Silme Onayı</AlertDialogTitle>
          <AlertDialogDescription>
            "{personBulkDeleteConfirm}" adlı kişinin tüm kayıtları çöp kutusuna taşınacak. Çöp kutusundan geri yükleyebilirsiniz. Devam etmek istiyor musunuz?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>İptal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => {
              if (personBulkDeleteConfirm) {
                bulkDeleteByDesc(personBulkDeleteConfirm);
              }
              setPersonBulkDeleteConfirm(null);
            }}
          >
            Tümünü Sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}

    {/* Sticky bottom basket panel */}
    {basketItems.length > 0 && (() => {
      const sharesMap = computeEffectiveShares(kesim.donations);
      let basketTotalShares = 0;
      for (const b of localBasketItems) {
        const grouped = kesim.animalGroups.flatMap(g => g.donations).find(d => d.id === b.donationId);
        if (grouped) {
          basketTotalShares += 1;
        } else {
          basketTotalShares += sharesMap.get(b.donationId) || 1;
        }
      }
      const basketAnimals = Math.ceil(basketTotalShares / 7);
      return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 shadow-lg">
          <button
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
            onClick={() => setBasketOpen(prev => !prev)}
          >
            <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Sepet: {basketItems.length} bağışçı
            </span>
            {foreignBasketItems.length > 0 && (
              <span className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full font-semibold">
                {foreignBasketItems.length} diğer KA
              </span>
            )}
            {localBasketItems.length > 0 && (
              <>
                <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-full font-semibold">
                  {basketTotalShares} hisse
                </span>
                <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-full font-semibold">
                  ~{basketAnimals} hayvan
                </span>
              </>
            )}
            <ChevronUp className={`w-4 h-4 text-emerald-600 ml-auto transition-transform ${basketOpen ? "" : "rotate-180"}`} />
          </button>
          {basketOpen && (
            <div className="px-4 pb-3 space-y-2">
              {localBasketItems.length > 0 && (() => {
                const grouped: { key: string; label: string; items: typeof localBasketItems }[] = [];
                const seen = new Map<string, number>();
                for (const b of localBasketItems) {
                  const label = (b.description || b.name).trim();
                  const existing = seen.get(label);
                  if (existing !== undefined) {
                    grouped[existing].items.push(b);
                  } else {
                    seen.set(label, grouped.length);
                    grouped.push({ key: label, label, items: [b] });
                  }
                }
                return (
                <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 flex-wrap">
                  <span className="text-[10px] font-semibold mr-1">Bu KA:</span>
                  {grouped.slice(0, 6).map(g => (
                    <span key={g.key} className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900 rounded text-[10px] inline-flex items-center gap-0.5">
                      {g.label}
                      {g.items.length > 1 && <span className="bg-emerald-200 dark:bg-emerald-800 px-1 rounded-full text-[9px] font-bold">×{g.items.length}</span>}
                      <button className="ml-0.5 hover:text-destructive" onClick={() => g.items.forEach(b => removeFromBasket(b.donationId))}>×</button>
                    </span>
                  ))}
                  {grouped.length > 6 && <span className="text-[10px]">+{grouped.length - 6}</span>}
                </div>
                );
              })()}
              {foreignBasketItems.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300 flex-wrap">
                  <span className="text-[10px] font-semibold mr-1">Diğer KA:</span>
                  {foreignBasketItems.slice(0, 4).map(b => (
                    <span key={b.donationId} className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-[10px]">
                      {b.description || b.name}
                      <span className="text-[9px] opacity-70 ml-0.5">({b.kesimAlaniName})</span>
                      <button className="ml-1 hover:text-destructive" onClick={() => removeFromBasket(b.donationId)}>×</button>
                    </span>
                  ))}
                  {foreignBasketItems.length > 4 && <span className="text-[10px]">+{foreignBasketItems.length - 4}</span>}
                  <Button
                    variant="default"
                    size="sm"
                    className="h-6 text-[10px] ml-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => setTransferToDonorListConfirm(true)}
                    disabled={transferToDonorListRemoving}
                  >
                    {transferToDonorListRemoving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
                    Bağışçı Listesine Ekle ({foreignBasketItems.length})
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-1 flex-wrap">
                {localBasketItems.length > 0 && (
                  <>
                    <Select value={String(basketTransferTarget)} onValueChange={(v) => setBasketTransferTarget(parseInt(v))}>
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue placeholder="Hedef grup..." />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {kesim.animalGroups.map((g, i) => {
                          const empty = g.donations.filter(d => !d.name.trim()).length;
                          return (
                            <SelectItem key={g.id} value={String(i)} disabled={g.locked || empty === 0}>
                              Hayvan {g.animalNo} ({empty} boş)
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Button variant="default" size="sm" className="h-7 text-xs" onClick={() => transferBasketToGroup(basketTransferTarget)} disabled={basketTransferTarget < 0}>
                      <Package className="w-3 h-3 mr-1" />
                      Yerleştir
                    </Button>
                    <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={autoDistributeBasket}>
                      <Wand2 className="w-3 h-3 mr-1" />
                      Otomatik Dağıt
                    </Button>
                  </>
                )}
                {siblingKesimAlanlari.length > 0 && localBasketItems.length > 0 && (
                  <>
                    <div className="w-px h-5 bg-emerald-300 dark:bg-emerald-700 mx-1" />
                    <Select value={basketCrossKATarget} onValueChange={setBasketCrossKATarget}>
                      <SelectTrigger className="h-7 w-40 text-xs">
                        <SelectValue placeholder="Başka KA'ya taşı..." />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {siblingKesimAlanlari.map(ka => (
                          <SelectItem key={ka.id} value={ka.id}>
                            {ka.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => transferBasketToOtherKA(basketCrossKATarget)}
                      disabled={!basketCrossKATarget || crossKATransferring}
                    >
                      {crossKATransferring ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                      Aktar
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearBasket}>
                  Temizle
                </Button>
              </div>
            </div>
          )}
        </div>
      );
    })()}

    {jumpDialogOpen && (
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={() => { setJumpDialogOpen(false); setJumpDialogValue(""); }}>
        <div className="absolute inset-0 bg-black/40" />
        <div
          className="relative bg-background rounded-2xl shadow-2xl border p-6 w-[340px] flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-sm font-medium text-muted-foreground">Hayvan Numarasına Git</div>
          <input
            autoFocus
            type="number"
            min={1}
            className="w-full text-center text-4xl font-bold border-2 border-primary/30 focus:border-primary rounded-xl px-4 py-3 bg-background outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="No"
            value={jumpDialogValue}
            onChange={(e) => setJumpDialogValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && jumpDialogValue.trim()) {
                const targetNo = parseInt(jumpDialogValue.trim(), 10);
                const exists = kesim && kesim.animalGroups.some(g => g.animalNo === targetNo);
                if (exists) {
                  scrollToAnimalGroup(targetNo);
                  setJumpDialogOpen(false);
                  setJumpDialogValue("");
                } else {
                  toast({ title: `Hayvan No ${jumpDialogValue} bulunamadı`, variant: "destructive" });
                }
              }
              if (e.key === "Escape") {
                setJumpDialogOpen(false);
                setJumpDialogValue("");
              }
            }}
          />
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={() => { setJumpDialogOpen(false); setJumpDialogValue(""); }} className="flex-1">
              İptal
            </Button>
            <Button
              onClick={() => {
                if (!jumpDialogValue.trim()) return;
                const targetNo = parseInt(jumpDialogValue.trim(), 10);
                const exists = kesim && kesim.animalGroups.some(g => g.animalNo === targetNo);
                if (exists) {
                  scrollToAnimalGroup(targetNo);
                  setJumpDialogOpen(false);
                  setJumpDialogValue("");
                } else {
                  toast({ title: `Hayvan No ${jumpDialogValue} bulunamadı`, variant: "destructive" });
                }
              }}
              className="flex-1"
            >
              Git
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Ctrl+G ile açılır</p>
        </div>
      </div>
    )}

    {showScrollTop && (
      <button
        className={`fixed right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all ${basketItems.length > 0 ? (basketOpen ? "bottom-36" : "bottom-16") : "bottom-6"}`}
        onClick={() => {
          const container = scrollContainerRef.current;
          if (container && fullscreenMode) {
            container.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
        title="En yukarı kaydır"
      >
        <ArrowUp className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </button>
    )}

    {(trashOpen || trashPermanentConfirm) && (
      <LazyLoadBoundary>
        <LazyTrashDialog
          trashOpen={trashOpen}
          setTrashOpen={setTrashOpen}
          trashItems={trashItems}
          trashLoading={trashLoading}
          trashPermanentConfirm={trashPermanentConfirm}
          setTrashPermanentConfirm={setTrashPermanentConfirm}
          restoreDonation={restoreDonation}
          permanentDeleteDonation={permanentDeleteDonation}
        />
      </LazyLoadBoundary>
    )}

    {(trackingNotesOpen || notificationLogsOpen || notificationTemplateOpen) && (
      <LazyLoadBoundary>
        <LazyNotificationDialogs
          kesim={kesim}
          toast={toast}
          trackingNotesOpen={trackingNotesOpen}
          setTrackingNotesOpen={setTrackingNotesOpen}
          trackingNotes={trackingNotes}
          setTrackingNotes={setTrackingNotes}
          trackingNotesLoading={trackingNotesLoading}
          notificationLogsOpen={notificationLogsOpen}
          setNotificationLogsOpen={setNotificationLogsOpen}
          notificationLogs={notificationLogs}
          notificationLogsLoading={notificationLogsLoading}
          notificationTemplateOpen={notificationTemplateOpen}
          setNotificationTemplateOpen={setNotificationTemplateOpen}
          notificationTemplate={notificationTemplate}
          setNotificationTemplate={setNotificationTemplate}
          notificationTemplateSaving={notificationTemplateSaving}
          setNotificationTemplateSaving={setNotificationTemplateSaving}
        />
      </LazyLoadBoundary>
    )}

    {qrModalOpen && (
      <LazyLoadBoundary>
        <QrCodeModal
          open={qrModalOpen}
          onOpenChange={setQrModalOpen}
          url={qrUrl}
          title={kesim?.name}
        />
      </LazyLoadBoundary>
    )}

    {!!photoViewGroup && <Dialog open={!!photoViewGroup} onOpenChange={(open) => { if (!open) setPhotoViewGroup(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Hayvan {photoViewGroup?.animalNo} — Fotoğraflar
          </DialogTitle>
        </DialogHeader>
        {photoViewLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : photoViewPhotos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Bu hayvan grubunda fotoğraf yok.
          </div>
        ) : (
          <LazyLoadBoundary fallback={<div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
            <PhotoGallery
              photos={photoViewPhotos}
              getPhotoUrl={(photoId: string, size?: "thumb") => kesim ? getGroupPhotoUrlAdmin(kesim.id, photoViewGroup!.id, photoId, size) : ""}
              readOnly
            />
          </LazyLoadBoundary>
        )}
      </DialogContent>
    </Dialog>}

    {teamDialogOpen && <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            Ekip Yönetimi
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ekip adı"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="flex-1"
            />
            <input
              type="color"
              value={teamColor}
              onChange={(e) => setTeamColor(e.target.value)}
              className="w-10 h-10 rounded border cursor-pointer"
            />
            <Button
              size="sm"
              onClick={handleSaveTeam}
              disabled={!teamName.trim() || teamSaving}
              className="shrink-0"
            >
              {teamSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : teamEditId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </Button>
            {teamEditId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setTeamEditId(null); setTeamName(""); setTeamColor("#3b82f6"); }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {(kesim?.teams || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Henüz ekip oluşturulmamış
              </p>
            ) : (
              (kesim?.teams || []).map(t => {
                const assignedCount = kesim!.animalGroups.filter(g => g.teamId === t.id).length;
                return (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="flex-1 text-sm font-medium">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground">{assignedCount} grup</span>
                    <button
                      onClick={() => { setTeamEditId(t.id); setTeamName(t.name); setTeamColor(t.color); }}
                      className="p-1 hover:bg-muted rounded"
                      title="Düzenle"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`"${t.name}" ekibini silmek istediğinize emin misiniz?`)) return;
                        handleDeleteTeam(t.id);
                      }}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950 rounded text-red-500"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          {(kesim?.teams || []).length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">Ekip Filtresi:</p>
              <div className="flex gap-1 flex-wrap">
                <button
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                    filterTeam === "all" ? "bg-primary/10 border-primary font-semibold" : "hover:bg-muted"
                  }`}
                  onClick={() => setFilterTeam("all")}
                >
                  Tümü
                </button>
                <button
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                    filterTeam === "none" ? "bg-primary/10 border-primary font-semibold" : "hover:bg-muted"
                  }`}
                  onClick={() => setFilterTeam("none")}
                >
                  Ekipsiz
                </button>
                {(kesim?.teams || []).map(t => (
                  <button
                    key={t.id}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                      filterTeam === t.id ? "font-semibold" : "hover:opacity-80"
                    }`}
                    style={{
                      backgroundColor: filterTeam === t.id ? t.color + "20" : undefined,
                      borderColor: filterTeam === t.id ? t.color : undefined,
                      color: t.color,
                    }}
                    onClick={() => setFilterTeam(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>}

    {transferToDonorListConfirm && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setTransferToDonorListConfirm(false); }}>
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative bg-background rounded-xl shadow-2xl border p-6 w-[400px] max-w-full" onClick={e => e.stopPropagation()}>
          <h3 className="font-semibold text-base mb-3">Bağışçı Listesine Ekle</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Sepetteki <strong>{basketItems.filter(b => b.kesimAlaniId !== kesim?.id).length}</strong> bağışçıyı bu kesim alanının bağışçı listesine eklemek istiyorsunuz.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Bu bağışçılar eski kesim alanlarından <strong>otomatik olarak kaldırılacaktır</strong>.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setTransferToDonorListConfirm(false)} disabled={transferToDonorListRemoving}>
              İptal
            </Button>
            <Button
              size="sm"
              onClick={() => transferForeignToCurrentDonorList(true)}
              disabled={transferToDonorListRemoving}
            >
              {transferToDonorListRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <UserPlus className="w-3.5 h-3.5 mr-1" />}
              Ekle ve Kaynaktan Kaldır
            </Button>
          </div>
        </div>
      </div>
    )}

    {donorListReportOpen && kesim && (() => {
      const sorted = sortedDonorList;
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setDonorListReportOpen(false); }}>
          <div className="bg-background rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="no-print sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between rounded-t-xl shrink-0">
              <h2 className="font-semibold text-sm">Bağışçı Listesi</h2>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.print()}>
                  <Printer className="w-3 h-3 mr-1" /> Yazdır / PDF
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDonorListReportOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-4 donor-list-print">
              <div className="text-center mb-4">
                <h3 className="font-bold text-lg">{kesim.name}</h3>
                <p className="text-xs text-muted-foreground">Bağışçı Listesi — {sortedDonorList.filter(d => !d.excluded).length} kişi</p>
                <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-foreground/20">
                    <th className="text-left py-1.5 px-2 font-semibold">#</th>
                    <th className="text-left py-1.5 px-2 font-semibold">Adına Kesilen</th>
                    <th className="text-left py-1.5 px-2 font-semibold">Vekaleti Veren</th>
                    <th className="text-left py-1.5 px-2 font-semibold">Cinsi</th>
                    <th className="text-right py-1.5 px-2 font-semibold">Hisse</th>
                    <th className="text-left py-1.5 px-2 font-semibold">Vekalet</th>
                    <th className="text-left py-1.5 px-2 font-semibold">Notlar</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((d, idx) => (
                    <tr key={d.id} className={idx % 2 === 0 ? "" : "bg-muted/30"}>
                      <td className="py-1 px-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-1 px-2 font-medium">{d.name}</td>
                      <td className="py-1 px-2">{d.description}</td>
                      <td className="py-1 px-2">{d.donationType}</td>
                      <td className="py-1 px-2 text-right">{d.shareCount}</td>
                      <td className="py-1 px-2">{d.vekalet}</td>
                      <td className="py-1 px-2 text-muted-foreground">{d.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-2 border-t text-[10px] text-muted-foreground flex justify-between">
                <span>{kesim.name} — Bağışçı Listesi</span>
                <span>{new Date().toLocaleDateString("tr-TR")} {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}
