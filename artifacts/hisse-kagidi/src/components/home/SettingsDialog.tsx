import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Settings, ImagePlus, X, Sun, Moon, Monitor, Download, Upload, Tag, Pencil } from "lucide-react";
import type { ThemeMode } from "@/lib/useTheme";
import { TAG_COLORS } from "@/lib/constants";
import type { IntegrityReport } from "@/lib/api";
import type { CustomTag } from "@/lib/types";

interface SettingsDialogProps {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  logoPreview: string | null;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  backupInputRef: React.RefObject<HTMLInputElement | null>;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  globalTags: CustomTag[];
  editingTagId: string | null;
  editTagName: string;
  setEditTagName: (name: string) => void;
  editTagColor: string;
  setEditTagColor: (color: string) => void;
  newTagName: string;
  setNewTagName: (name: string) => void;
  newTagColor: string;
  setNewTagColor: (color: string) => void;
  csvExporting: boolean;
  csvProgress: { received: number; total: number };
  integrityReport: IntegrityReport | null;
  integrityChecking: boolean;
  integrityRepairing: boolean;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteLogo: () => void;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCsv: () => void;
  onAddTag: () => void;
  onDeleteTag: (id: string) => void;
  onStartEditTag: (tag: CustomTag) => void;
  onCommitEditTag: () => void;
  onIntegrityCheck: () => void;
  onIntegrityRepair: () => void;
  onNavigateAiSettings: () => void;
}

export function SettingsDialog({
  settingsOpen,
  setSettingsOpen,
  logoPreview,
  logoInputRef,
  backupInputRef,
  themeMode,
  setThemeMode,
  globalTags,
  editingTagId,
  editTagName,
  setEditTagName,
  editTagColor,
  setEditTagColor,
  newTagName,
  setNewTagName,
  newTagColor,
  setNewTagColor,
  csvExporting,
  csvProgress,
  integrityReport,
  integrityChecking,
  integrityRepairing,
  onLogoUpload,
  onDeleteLogo,
  onExportBackup,
  onImportBackup,
  onExportCsv,
  onAddTag,
  onDeleteTag,
  onStartEditTag,
  onCommitEditTag,
  onIntegrityCheck,
  onIntegrityRepair,
  onNavigateAiSettings,
}: SettingsDialogProps) {
  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-1" />
          Ayarlar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ayarlar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Kesim Kağıdı Logosu
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Yazdırma sayfasında tablonun üst kısmında görünecek logo.
            </p>

            {logoPreview ? (
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-muted/30 flex items-center justify-center">
                  <img
                    src={logoPreview}
                    alt="Logo"
                    className="max-h-24 max-w-full object-contain"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <ImagePlus className="w-4 h-4 mr-1" />
                    Değiştir
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onDeleteLogo}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Kaldır
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => logoInputRef.current?.click()}
              >
                <ImagePlus className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Logo yüklemek için tıklayın</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG desteklenir (Maks. 5MB)</p>
              </div>
            )}

            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onLogoUpload}
            />
          </div>

          <div className="border-t pt-4">
            <label className="text-sm font-medium mb-2 block">
              Veri Yedekleme
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Tüm kesim alanları ve logo dahil JSON olarak yedekleyin veya geri yükleyin.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={onExportBackup}>
                <Download className="w-4 h-4 mr-1" />
                Yedekle
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => backupInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" />
                Geri Yükle
              </Button>
            </div>
            <input
              ref={backupInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={onImportBackup}
            />
          </div>

          <div className="border-t pt-4">
            <label className="text-sm font-medium mb-2 block">
              CSV Dışa Aktarma
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Tüm bağışçıları CSV olarak indirin (Excel'de açılabilir).
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onExportCsv}
              disabled={csvExporting}
            >
              <Download className="w-4 h-4 mr-1" />
              {csvExporting
                ? csvProgress.total > 0
                  ? `İndiriliyor... ${csvProgress.received}/${csvProgress.total}`
                  : "Hazırlanıyor..."
                : "CSV İndir"}
            </Button>
            {csvExporting && csvProgress.total > 0 && (
              <div className="mt-2 w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (csvProgress.received / csvProgress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <label className="text-sm font-medium mb-2 block">
              Tema
            </label>
            <div className="flex gap-2">
              {([
                { value: "light" as ThemeMode, label: "Açık", icon: <Sun className="w-4 h-4" /> },
                { value: "dark" as ThemeMode, label: "Koyu", icon: <Moon className="w-4 h-4" /> },
                { value: "system" as ThemeMode, label: "Sistem", icon: <Monitor className="w-4 h-4" /> },
              ]).map(opt => (
                <Button
                  key={opt.value}
                  variant={themeMode === opt.value ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setThemeMode(opt.value)}
                >
                  {opt.icon}
                  <span className="ml-1">{opt.label}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <label className="text-sm font-medium mb-2 block">
              AI Not Analizi Ayarları
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              AI sınıflandırma prompt'unu ve kategorileri özelleştirin.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onNavigateAiSettings}
            >
              <Settings className="w-4 h-4 mr-1" />
              AI Prompt Ayarları
            </Button>
          </div>

          <div className="border-t pt-4">
            <label className="text-sm font-medium mb-2 block">
              Veri Tutarlılık Kontrolü
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Yetim kayıtları, kırık bağlantıları ve tutarsızlıkları tespit edin.
            </p>
            <div className="flex gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={integrityChecking}
                onClick={onIntegrityCheck}
              >
                {integrityChecking ? "Kontrol ediliyor..." : "Kontrol Et"}
              </Button>
              {integrityReport && integrityReport.issues.some(i => i.repairable && i.count > 0) && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={integrityRepairing}
                  onClick={onIntegrityRepair}
                >
                  {integrityRepairing ? "Onarılıyor..." : "Onar"}
                </Button>
              )}
            </div>
            {integrityReport && (
              <div className="text-xs space-y-1 mt-2">
                {integrityReport.totalIssues === 0 ? (
                  <p className="text-green-600 dark:text-green-400">Sorun bulunamadı.</p>
                ) : (
                  integrityReport.issues.map((issue, i) => (
                    <div key={i} className={`flex items-start gap-1.5 ${issue.severity === "error" ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"}`}>
                      <span className="font-medium">{issue.severity === "error" ? "!" : "⚠"}</span>
                      <span>{issue.description} ({issue.count})</span>
                    </div>
                  ))
                )}
                <p className="text-muted-foreground mt-1">Son kontrol: {new Date(integrityReport.checkedAt).toLocaleString("tr-TR")}</p>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <label className="text-sm font-medium mb-2 block">
              <Tag className="w-4 h-4 inline mr-1" />
              Etiketler
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Bağışçılara atayabileceğiniz özel etiketler tanımlayın (VIP, Ödenmedi, Teslim Edildi vb.)
            </p>

            {globalTags.length > 0 && (
              <div className="space-y-2 mb-3">
                {globalTags.map(tag => (
                  <div key={tag.id} className="flex items-center gap-2">
                    {editingTagId === tag.id ? (
                      <>
                        <div className="flex gap-1 flex-shrink-0">
                          {TAG_COLORS.map(c => (
                            <button
                              key={c}
                              className={`w-5 h-5 rounded-full border-2 ${editTagColor === c ? "ring-2 ring-offset-1 ring-primary" : "border-transparent"}`}
                              style={{ backgroundColor: c }}
                              onClick={() => setEditTagColor(c)}
                            />
                          ))}
                        </div>
                        <Input
                          className="h-7 text-sm flex-1"
                          value={editTagName}
                          onChange={(e) => setEditTagName(e.target.value)}
                          onBlur={onCommitEditTag}
                          onKeyDown={(e) => e.key === "Enter" && onCommitEditTag()}
                          autoFocus
                        />
                      </>
                    ) : (
                      <>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white flex-1"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onStartEditTag(tag)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onDeleteTag(tag.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 items-center">
              <div className="flex gap-1 flex-shrink-0">
                {TAG_COLORS.slice(0, 5).map(c => (
                  <button
                    key={c}
                    className={`w-5 h-5 rounded-full border-2 ${newTagColor === c ? "ring-2 ring-offset-1 ring-primary" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewTagColor(c)}
                  />
                ))}
              </div>
              <Input
                className="h-7 text-sm flex-1"
                placeholder="Yeni etiket adı"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddTag()}
              />
              <Button variant="outline" size="sm" onClick={onAddTag} disabled={!newTagName.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
