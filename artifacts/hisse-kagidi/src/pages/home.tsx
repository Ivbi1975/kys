import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, LogOut } from "lucide-react";
import { HomeSkeleton } from "@/components/skeletons/HomeSkeleton";
import QrCodeModal from "@/components/QrCodeModal";
import GlobalSearchDialog from "@/components/GlobalSearchDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useHomeState } from "@/hooks/useHomeState";
import { KesimCard } from "@/components/home/KesimCard";
import { ProjectCard } from "@/components/home/ProjectCard";
import { SettingsDialog } from "@/components/home/SettingsDialog";
import { AuditLogViewer } from "@/components/home/AuditLogViewer";
import { HomeDialogs } from "@/components/home/HomeDialogs";
import { ArchiveSection } from "@/components/home/ArchiveSection";

export default function Home() {
  const state = useHomeState();

  if (state.showSkeleton) {
    return <HomeSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-3 sm:p-6">
        {state.migrationDone && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-sm text-green-800 dark:text-green-200">
            Mevcut verileriniz veritabanına başarıyla aktarıldı. Artık verileriniz kalıcı olarak saklanmaktadır.
          </div>
        )}

        <div className="flex items-start gap-3 mb-6 sm:mb-8">
          <img src="/kurban-logo.png" alt="Kurban Logo" className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 object-contain invert dark:invert-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-foreground">
              Kurban Hisse Kağıdı
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1 hidden sm:block">
              Kesim alanı oluşturun, bağışçıları ekleyin ve hisse kağıtlarını
              yazdırın
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => state.setGlobalSearchOpen(true)} title="Global Arama" className="h-8 px-2 sm:px-3">
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Ara</span>
            </Button>
            <ThemeToggle className="h-8 w-8 p-0" />
            <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" title="Çıkış Yap">
                <LogOut className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Çıkış Yap</AlertDialogTitle>
                <AlertDialogDescription>
                  Oturumunuz sonlandırılacak ve giriş ekranına yönlendirileceksiniz. Devam etmek istiyor musunuz?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    sessionStorage.removeItem("app_unlocked");
                    sessionStorage.removeItem("app_session_token");
                    window.location.reload();
                  }}
                >
                  Çıkış Yap
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AuditLogViewer />
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
            editTagVekaletId={state.editTagVekaletId}
            setEditTagVekaletId={state.setEditTagVekaletId}
            editTagNotes={state.editTagNotes}
            setEditTagNotes={state.setEditTagNotes}
            editTagAiNotes={state.editTagAiNotes}
            setEditTagAiNotes={state.setEditTagAiNotes}
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
            onCancelEditTag={state.cancelEditTag}
            onIntegrityCheck={state.handleIntegrityCheck}
            onIntegrityRepair={state.handleIntegrityRepair}
            onNavigateAiSettings={() => { state.setSettingsOpen(false); state.setLocation("/ai-prompt-ayarlari"); }}
          />
          </div>
        </div>

        <HomeDialogs
          onBulkSuccess={state.refreshData}
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
          renameKesimDialogOpen={state.renameKesimDialogOpen}
          setRenameKesimDialogOpen={state.setRenameKesimDialogOpen}
          editingKesim={state.editingKesim}
          setEditingKesim={state.setEditingKesim}
          handleRenameKesim={state.handleRenameKesim}
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
          permanentDeleteProjectConfirm={state.permanentDeleteProjectConfirm}
          setPermanentDeleteProjectConfirm={state.setPermanentDeleteProjectConfirm}
          executePermanentDeleteProject={state.executePermanentDeleteProject}
          deleteProjectConfirm={state.deleteProjectConfirm}
          setDeleteProjectConfirm={state.setDeleteProjectConfirm}
          handleDeleteProject={state.handleDeleteProject}
        />

        {state.kesimAlanlari.length === 0 && state.projects.length === 0 ? (
          <Card className="p-12 text-center">
            <img src="/kurban-logo.png" alt="logo" className="w-28 h-14 mx-auto mb-4 opacity-50 object-contain invert dark:invert-0" />
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
                onEdit={(p) => {
                  state.setEditingProject({ id: p.id, name: p.name });
                  state.setEditProjectDialogOpen(true);
                }}
              />
            ))}

            {state.unassignedKesimAlanlari.length > 0 && (
              <div className="mb-6">
                {state.projects.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <img src="/kurban-logo.png" alt="" className="w-4 h-4 object-contain opacity-60 invert dark:invert-0" />
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
                      onRename={(k) => {
                        state.setEditingKesim({
                          id: k.id,
                          name: k.name,
                          yetkili: k.yetkili ?? "",
                          displayName: k.displayName ?? "",
                          maxAnimal: k.maxAnimal != null ? String(k.maxAnimal) : "",
                        });
                        state.setRenameKesimDialogOpen(true);
                      }}
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
