import { lazy } from "react";
import { LazyLoadBoundary } from "@/components/LazyLoadBoundary";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Camera, Keyboard, Loader2 } from "lucide-react";
import { getGroupPhotoUrlAdmin } from "@/lib/api";
import type { useKesimAlaniState } from "./useKesimAlaniState";
import { SwapDialogs } from "./dialogs/SwapDialogs";
import { SplitDialogs } from "./dialogs/SplitDialogs";
import { SmartPlaceDialog } from "./dialogs/SmartPlaceDialog";
import { TeamDialog } from "./dialogs/TeamDialog";
import { BasketPanel } from "./dialogs/BasketPanel";
import { DonorListReport } from "./dialogs/DonorListReport";
import { JumpDialog } from "./dialogs/JumpDialog";

const LazyPersonEditDialog = lazy(() => import("./dialogs/PersonEditDialog"));
const LazyTrashDialog = lazy(() => import("./dialogs/TrashDialog"));
const LazyNotificationDialogs = lazy(() => import("./dialogs/NotificationDialogs"));
const PhotoGallery = lazy(() => import("@/components/PhotoGallery"));
const QrCodeModal = lazy(() => import("@/components/QrCodeModal"));

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

      <SwapDialogs
        kesim={kesim}
        swapPreviewOpen={swapPreviewOpen}
        cancelSwap={cancelSwap}
        swapSelection={swapSelection}
        swapTarget={swapTarget}
        executeSwap={executeSwap}
        autoResolveOpen={autoResolveOpen}
        setAutoResolveOpen={setAutoResolveOpen}
        resolveResults={resolveResults}
        applyAutoResolve={applyAutoResolve}
      />

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
                <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border border-border">{shortcut.keys}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>}

      <SplitDialogs
        kesim={kesim}
        splitShareDialog={splitShareDialog}
        setSplitShareDialog={setSplitShareDialog}
        getSplitOptions={getSplitOptions}
        applySplitShare={applySplitShare}
        splitGroupDialog={splitGroupDialog}
        setSplitGroupDialog={setSplitGroupDialog}
        executeSplitGroup={executeSplitGroup}
      />

      <SmartPlaceDialog
        kesim={kesim}
        smartPlacePopover={smartPlacePopover}
        setSmartPlacePopover={setSmartPlacePopover}
        smartPlaceDonor={smartPlaceDonor}
        getAvailableGroupsForDonor={getAvailableGroupsForDonor}
        getSwapSuggestions={getSwapSuggestions}
        executeSwapSuggestion={executeSwapSuggestion}
      />

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
                if (personBulkDeleteConfirm) bulkDeleteByDesc(personBulkDeleteConfirm);
                setPersonBulkDeleteConfirm(null);
              }}
            >
              Tümünü Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}

      <BasketPanel
        kesim={kesim}
        basketItems={basketItems}
        localBasketItems={localBasketItems}
        foreignBasketItems={foreignBasketItems}
        basketOpen={basketOpen}
        setBasketOpen={setBasketOpen}
        removeFromBasket={removeFromBasket}
        clearBasket={clearBasket}
        basketTransferTarget={basketTransferTarget}
        setBasketTransferTarget={setBasketTransferTarget}
        transferBasketToGroup={transferBasketToGroup}
        autoDistributeBasket={autoDistributeBasket}
        basketCrossKATarget={basketCrossKATarget}
        setBasketCrossKATarget={setBasketCrossKATarget}
        crossKATransferring={crossKATransferring}
        transferBasketToOtherKA={transferBasketToOtherKA}
        siblingKesimAlanlari={siblingKesimAlanlari}
        transferToDonorListConfirm={transferToDonorListConfirm}
        setTransferToDonorListConfirm={setTransferToDonorListConfirm}
        transferToDonorListRemoving={transferToDonorListRemoving}
        transferForeignToCurrentDonorList={transferForeignToCurrentDonorList}
      />

      <JumpDialog
        kesim={kesim}
        jumpDialogOpen={jumpDialogOpen}
        setJumpDialogOpen={setJumpDialogOpen}
        scrollToAnimalGroup={scrollToAnimalGroup}
        toast={toast}
        showScrollTop={showScrollTop}
        scrollContainerRef={scrollContainerRef}
        fullscreenMode={fullscreenMode}
        basketItems={basketItems}
        basketOpen={basketOpen}
      />

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
          <QrCodeModal open={qrModalOpen} onOpenChange={setQrModalOpen} url={qrUrl} title={kesim?.name} />
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
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : photoViewPhotos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Bu hayvan grubunda fotoğraf yok.</div>
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

      <TeamDialog
        kesim={kesim}
        teamDialogOpen={teamDialogOpen}
        setTeamDialogOpen={setTeamDialogOpen}
        teamName={teamName}
        setTeamName={setTeamName}
        teamEditId={teamEditId}
        setTeamEditId={setTeamEditId}
        teamColor={teamColor}
        setTeamColor={setTeamColor}
        teamSaving={teamSaving}
        handleSaveTeam={handleSaveTeam}
        handleDeleteTeam={handleDeleteTeam}
        filterTeam={filterTeam}
        setFilterTeam={setFilterTeam}
      />

      <DonorListReport
        kesim={kesim}
        donorListReportOpen={donorListReportOpen}
        setDonorListReportOpen={setDonorListReportOpen}
        sortedDonorList={sortedDonorList}
      />
    </>
  );
}
