import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  FolderOpen,
  Search,
  Archive,
} from "lucide-react";
import QrCodeModal from "@/components/QrCodeModal";
import GlobalSearchDialog from "@/components/GlobalSearchDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProjeDetaySkeleton } from "@/components/skeletons/ProjeDetaySkeleton";
import { useProjeDetayState } from "@/hooks/useProjeDetayState";
import { ProjectSummaryCard } from "@/components/proje-detay/ProjectSummaryCard";
import { PendingEditRequestsCard } from "@/components/proje-detay/PendingEditRequestsCard";
import { KesimAlaniList } from "@/components/proje-detay/KesimAlaniList";
import { SplitModal } from "@/components/proje-detay/SplitModal";
import { ConflictSection } from "@/components/proje-detay/ConflictSection";
import { TransferLogSection } from "@/components/proje-detay/TransferLogSection";
import { ProjeDetayDialogs } from "@/components/proje-detay/ProjeDetayDialogs";

export default function ProjeDetayPage() {
  const state = useProjeDetayState();

  if (state.loading) {
    return <ProjeDetaySkeleton />;
  }

  if (!state.project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Proje Bulunamadı</h2>
          <p className="text-muted-foreground mb-4">Bu proje mevcut değil veya silinmiş olabilir.</p>
          <Button onClick={() => state.setLocation("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Ana Sayfaya Dön
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => state.setLocation("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-primary" />
              {state.project.name}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {state.kesimAlanlari.length} kesim alanı
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              title="Yeni Kesim Alanı Ekle"
              onClick={() => state.setDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Yeni Kesim Alanı
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Düzenle"
              onClick={() => {
                state.setEditProjectName(state.project!.name);
                state.setEditProjectDialogOpen(true);
              }}
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Arşivle"
              onClick={() => state.setArchiveConfirm(true)}
            >
              <Archive className="w-4 h-4 text-amber-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Sil"
              onClick={() => state.setDeleteProjectConfirm(true)}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => state.setGlobalSearchOpen(true)}
              title="Global Arama"
            >
              <Search className="w-4 h-4 mr-1" />
              Ara
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <ProjectSummaryCard totals={state.totals} occupancy={state.occupancy} />

        <PendingEditRequestsCard
          pendingEditCount={state.pendingEditCount}
          pendingEditRequests={state.pendingEditRequests}
          kesimAlanlari={state.kesimAlanlari}
          onNavigate={state.setLocation}
        />

        <KesimAlaniList
          kesimAlanlari={state.kesimAlanlari}
          onNavigate={state.setLocation}
          onCreateDialog={() => state.setDialogOpen(true)}
          onCopyTrackingLink={state.handleCopyTrackingLink}
          onOpenTrackingPage={state.handleOpenTrackingPage}
          onShowQrCode={state.handleShowQrCode}
          onDelete={state.requestDelete}
          onSplit={state.openSplitModal}
        />

        <ConflictSection
          showConflicts={state.showConflicts}
          setShowConflicts={state.setShowConflicts}
          conflictLoading={state.conflictLoading}
          totalConflicts={state.totalConflicts}
          filteredConflicts={state.filteredConflicts}
          conflictSearchQuery={state.conflictSearchQuery}
          setConflictSearchQuery={state.setConflictSearchQuery}
          expandedKeys={state.expandedKeys}
          toggleExpand={state.toggleExpand}
          openTransferDialog={state.openTransferDialog}
        />

        <TransferLogSection
          showTransferLog={state.showTransferLog}
          setShowTransferLog={state.setShowTransferLog}
          transferLogLoading={state.transferLogLoading}
          transferLog={state.transferLog}
        />
      </div>

      <ProjeDetayDialogs
        dialogOpen={state.dialogOpen}
        setDialogOpen={state.setDialogOpen}
        newKesimAdi={state.newKesimAdi}
        setNewKesimAdi={state.setNewKesimAdi}
        handleCreateKesimAlani={state.handleCreateKesimAlani}
        editProjectDialogOpen={state.editProjectDialogOpen}
        setEditProjectDialogOpen={state.setEditProjectDialogOpen}
        editProjectName={state.editProjectName}
        setEditProjectName={state.setEditProjectName}
        handleUpdateProject={state.handleUpdateProject}
        deleteConfirm={state.deleteConfirm}
        setDeleteConfirm={state.setDeleteConfirm}
        executeDelete={state.executeDelete}
        deleteProjectConfirm={state.deleteProjectConfirm}
        setDeleteProjectConfirm={state.setDeleteProjectConfirm}
        handleDeleteProject={state.handleDeleteProject}
        archiveConfirm={state.archiveConfirm}
        setArchiveConfirm={state.setArchiveConfirm}
        archiving={state.archiving}
        handleArchiveProject={state.handleArchiveProject}
        transferDialog={state.transferDialog}
        setTransferDialog={state.setTransferDialog}
        targetKesimAlaniId={state.targetKesimAlaniId}
        setTargetKesimAlaniId={state.setTargetKesimAlaniId}
        transferAnimal={state.transferAnimal}
        setTransferAnimal={state.setTransferAnimal}
        transferring={state.transferring}
        executeTransfer={state.executeTransfer}
        allKesimAlanlari={state.allKesimAlanlari}
        projectName={state.project.name}
      />

      {state.splitTarget && (
        <SplitModal
          open={state.splitModalOpen}
          onOpenChange={state.setSplitModalOpen}
          kesimAlani={state.splitTarget}
          onSplit={state.handleSplit}
        />
      )}

      <QrCodeModal
        open={state.qrModalOpen}
        onOpenChange={state.setQrModalOpen}
        url={state.qrUrl}
        title={state.qrTitle}
      />

      <GlobalSearchDialog
        open={state.globalSearchOpen}
        onOpenChange={state.setGlobalSearchOpen}
      />
    </div>
  );
}
