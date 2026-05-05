import { useState } from "react";
import { Search, LogOut, Plus, FolderPlus } from "lucide-react";
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

const BG = "#07111f";
const CARD = "#0d1c2e";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT = "#f8fafc";
const MUTED = "#6f8097";
const BLUE = "#3b82f6";

export default function Home() {
  const state = useHomeState();

  if (state.showSkeleton) {
    return <HomeSkeleton />;
  }

  const hasContent = state.kesimAlanlari.length > 0 || state.projects.length > 0;

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>

      {/* Topbar */}
      <header style={{ background: "#07111f", borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px" }}>
          <div className="flex items-center gap-4 py-3.5">
            {/* Brand */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{ width: 36, height: 36, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)" }}
              >
                <img src="/kurban-logo.png" alt="" className="object-contain" style={{ width: 18, height: 18 }} />
              </div>
              <div className="min-w-0 hidden sm:block">
                <h1 className="text-sm font-bold leading-none truncate" style={{ color: TEXT }}>Kurban Hisse Kağıdı</h1>
                <p className="text-xs mt-0.5 truncate" style={{ color: MUTED }}>Kesim alanı yönetim sistemi</p>
              </div>
            </div>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => state.setGlobalSearchOpen(true)}
                className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-all hover:bg-white/5"
                style={{ color: MUTED, border: `1px solid ${BORDER}` }}
                title="Ara"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ara</span>
              </button>

              <ThemeToggle className="h-8 w-8 p-0 hover:bg-white/5 border" style={{ borderColor: BORDER, color: MUTED }} />

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

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="flex items-center justify-center rounded-lg transition-all hover:bg-red-500/10"
                    style={{ width: 32, height: 32, color: "#ef4444", border: `1px solid ${BORDER}` }}
                    title="Çıkış Yap"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Çıkış Yap</AlertDialogTitle>
                    <AlertDialogDescription>
                      Oturumunuz sonlandırılacak ve giriş ekranına yönlendirileceksiniz.
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
            </div>
          </div>
        </div>
      </header>

      {/* Dialogs */}
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

      {/* Main content */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 24px 48px" }}>

        {/* Migration alert */}
        {state.migrationDone && (
          <div
            className="mb-5 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
            style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.20)", color: "#4ade80" }}
          >
            Mevcut verileriniz veritabanına başarıyla aktarıldı. Artık verileriniz kalıcı olarak saklanmaktadır.
          </div>
        )}

        {/* Page title + actions row */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: TEXT }}>Ana Sayfa</h2>
            <p className="text-sm mt-0.5" style={{ color: MUTED }}>Projeler ve kesim alanları</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => state.setProjectDialogOpen(true)}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-all hover:bg-white/5"
              style={{ color: MUTED, border: `1px solid ${BORDER}` }}
            >
              <FolderPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Yeni Proje</span>
            </button>
            <button
              onClick={() => state.setDialogOpen(true)}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: BLUE, color: "#fff" }}
            >
              <Plus className="w-4 h-4" />
              Yeni Kesim Alanı
            </button>
          </div>
        </div>

        {/* Empty state */}
        {!hasContent ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.20)" }}
            >
              <img src="/kurban-logo.png" alt="" className="object-contain" style={{ width: 32, height: 32 }} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: TEXT }}>Henüz proje veya kesim alanı yok</h3>
            <p className="text-sm mb-6" style={{ color: MUTED }}>Bir proje veya kesim alanı oluşturarak başlayın</p>
            <div
              className="text-sm space-y-2 max-w-sm mx-auto text-left rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>Nasıl çalışır?</p>
              {[
                "Bir proje oluşturun (örn: \"2025 Kurban\")",
                "Projenin içine kesim alanları ekleyin",
                "Bağışçıları tek tek veya Excel'den toplu ekleyin",
                "Otomatik gruplama ile hayvan gruplarını oluşturun",
                "Kesim kağıtlarını yazdırın veya Excel'e aktarın",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-xs" style={{ color: MUTED }}>
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                    style={{ background: "rgba(59,130,246,0.15)", color: BLUE }}
                  >
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
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
              <div>
                {state.projects.length > 0 && (
                  <div className="flex items-center gap-2 mt-6 mb-3">
                    <div className="h-px flex-1" style={{ background: BORDER }} />
                    <span className="text-xs font-semibold uppercase tracking-wider px-2" style={{ color: MUTED }}>
                      Projesiz Kesim Alanları
                    </span>
                    <div className="h-px flex-1" style={{ background: BORDER }} />
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
          </div>
        )}

        <ArchiveSection
          archivedProjects={state.archivedProjects}
          archiveOpen={state.archiveOpen}
          setArchiveOpen={state.setArchiveOpen}
          onUnarchiveProject={state.handleUnarchiveProject}
        />
      </main>

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
