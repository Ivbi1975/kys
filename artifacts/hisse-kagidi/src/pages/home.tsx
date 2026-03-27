import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scissors, Search } from "lucide-react";
import { HomeSkeleton } from "@/components/skeletons/HomeSkeleton";
import QrCodeModal from "@/components/QrCodeModal";
import GlobalSearchDialog from "@/components/GlobalSearchDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useHomeState } from "@/hooks/useHomeState";
import { KesimCard } from "@/components/home/KesimCard";
import { ProjectCard } from "@/components/home/ProjectCard";
import { SettingsDialog } from "@/components/home/SettingsDialog";
import { HomeDialogs } from "@/components/home/HomeDialogs";
import { ArchiveSection } from "@/components/home/ArchiveSection";
import { TrashSection } from "@/components/home/TrashSection";

export default function Home() {
  const state = useHomeState();

  if (state.showSkeleton) {
    return <HomeSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        {state.migrationDone && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-sm text-green-800 dark:text-green-200">
            Mevcut verileriniz veritabanına başarıyla aktarıldı. Artık verileriniz kalıcı olarak saklanmaktadır.
          </div>
        )}

        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <Scissors className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Kurban Hisse Kağıdı
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Kesim alanı oluşturun, bağışçıları ekleyin ve hisse kağıtlarını
              yazdırın
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => state.setGlobalSearchOpen(true)} title="Global Arama">
            <Search className="w-4 h-4 mr-1" />
            Ara
          </Button>
          <ThemeToggle className="h-8 w-8 p-0" />
          <SettingsDialog
            settingsOpen={state.settingsOpen}
            setSettingsOpen={state.setSettingsOpen}
            logoPreview={state.logoPreview}
            logoInputRef={state.logoInputRef}
            backupInputRef={state.backupInputRef}
            themeMode={state.themeMode}
            setThemeMode={state.setThemeMode}
            globalTags={state.globalTags}
            editingTagId={state.editingTagId}
            editTagName={state.editTagName}
            setEditTagName={state.setEditTagName}
            editTagColor={state.editTagColor}
            setEditTagColor={state.setEditTagColor}
            newTagName={state.newTagName}
            setNewTagName={state.setNewTagName}
            newTagColor={state.newTagColor}
            setNewTagColor={state.setNewTagColor}
            csvExporting={state.csvExporting}
            csvProgress={state.csvProgress}
            integrityReport={state.integrityReport}
            integrityChecking={state.integrityChecking}
            integrityRepairing={state.integrityRepairing}
            onLogoUpload={state.handleLogoUpload}
            onDeleteLogo={state.handleDeleteLogo}
            onExportBackup={state.handleExportBackup}
            onImportBackup={state.handleImportBackup}
            onExportCsv={state.handleExportCsv}
            onAddTag={state.handleAddTag}
            onDeleteTag={state.handleDeleteTag}
            onStartEditTag={state.startEditTag}
            onCommitEditTag={state.commitEditTag}
            onIntegrityCheck={state.handleIntegrityCheck}
            onIntegrityRepair={state.handleIntegrityRepair}
            onNavigateAiSettings={() => { state.setSettingsOpen(false); state.setLocation("/ai-prompt-ayarlari"); }}
          />
        </div>

        <HomeDialogs
          importModeOpen={state.importModeOpen}
          setImportModeOpen={state.setImportModeOpen}
          pendingImportJson={state.pendingImportJson}
          setPendingImportJson={state.setPendingImportJson}
          kesimAlanlari={state.kesimAlanlari}
          executeImport={state.executeImport}
          projectDialogOpen={state.projectDialogOpen}
          setProjectDialogOpen={state.setProjectDialogOpen}
          newProjectName={state.newProjectName}
          setNewProjectName={state.setNewProjectName}
          handleCreateProject={state.handleCreateProject}
          dialogOpen={state.dialogOpen}
          setDialogOpen={state.setDialogOpen}
          newName={state.newName}
          setNewName={state.setNewName}
          createProjectId={state.createProjectId}
          setCreateProjectId={state.setCreateProjectId}
          handleCreate={state.handleCreate}
          projects={state.projects}
          editProjectDialogOpen={state.editProjectDialogOpen}
          setEditProjectDialogOpen={state.setEditProjectDialogOpen}
          editingProject={state.editingProject}
          setEditingProject={state.setEditingProject}
          handleUpdateProject={state.handleUpdateProject}
          moveDialogOpen={state.moveDialogOpen}
          setMoveDialogOpen={state.setMoveDialogOpen}
          movingKesim={state.movingKesim}
          setMovingKesim={state.setMovingKesim}
          moveTargetProjectId={state.moveTargetProjectId}
          setMoveTargetProjectId={state.setMoveTargetProjectId}
          handleMoveKesimAlani={state.handleMoveKesimAlani}
          deleteConfirm={state.deleteConfirm}
          setDeleteConfirm={state.setDeleteConfirm}
          executeDelete={state.executeDelete}
          permanentDeleteConfirm={state.permanentDeleteConfirm}
          setPermanentDeleteConfirm={state.setPermanentDeleteConfirm}
          executePermanentDelete={state.executePermanentDelete}
          deleteProjectConfirm={state.deleteProjectConfirm}
          setDeleteProjectConfirm={state.setDeleteProjectConfirm}
          handleDeleteProject={state.handleDeleteProject}
        />

        {state.kesimAlanlari.length === 0 && state.projects.length === 0 ? (
          <Card className="p-12 text-center">
            <Scissors className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Henüz proje veya kesim alanı yok
            </h3>
            <p className="text-muted-foreground mb-4">
              Bir proje veya kesim alanı oluşturarak başlayın
            </p>
            <div className="text-sm text-muted-foreground space-y-2 max-w-md mx-auto text-left">
              <p className="font-medium text-foreground">Nasıl çalışır?</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Bir proje oluşturun (örn: "2025 Kurban")</li>
                <li>Projenin içine kesim alanları ekleyin</li>
                <li>Bağışçıları tek tek veya Excel'den toplu ekleyin</li>
                <li>Otomatik gruplama ile hayvan gruplarını oluşturun</li>
                <li>Kesim kağıtlarını yazdırın veya Excel'e aktarın</li>
              </ol>
            </div>
          </Card>
        ) : (
          <>
            {state.projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                kesimAlanlari={state.kesimAlanlari}
                onNavigate={(projectId) => state.setLocation(`/proje/${projectId}`)}
              />
            ))}

            {state.unassignedKesimAlanlari.length > 0 && (
              <div className="mb-6">
                {state.projects.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <Scissors className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Projesiz Kesim Alanları</h3>
                  </div>
                )}
                <div className="space-y-3">
                  {state.unassignedKesimAlanlari.map(k => (
                    <KesimCard
                      key={k.id}
                      kesimAlani={k}
                      onNavigate={(id) => state.setLocation(`/kesim/${id}`)}
                      onCopyTrackingLink={state.handleCopyTrackingLink}
                      onOpenTrackingPage={state.handleOpenTrackingPage}
                      onShowQrCode={state.handleShowQrCode}
                      onMove={state.openMoveDialog}
                      onDelete={state.requestDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <ArchiveSection
          archivedProjects={state.archivedProjects}
          archiveOpen={state.archiveOpen}
          setArchiveOpen={state.setArchiveOpen}
          onUnarchiveProject={state.handleUnarchiveProject}
        />

        <TrashSection
          deletedKesimAlanlari={state.deletedKesimAlanlari}
          deletedProjects={state.deletedProjects}
          trashOpen={state.trashOpen}
          setTrashOpen={state.setTrashOpen}
          onRestoreProject={state.handleRestoreProject}
          onRestore={state.handleRestore}
          onPermanentDelete={state.requestPermanentDelete}
        />
      </div>

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
