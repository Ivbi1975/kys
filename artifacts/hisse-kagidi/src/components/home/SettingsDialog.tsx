import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Settings, ImagePlus, X, Sun, Moon, Monitor, Download, Upload, Tags, Pencil, Check, Bot, FolderPlus, Info } from "lucide-react";
import type { ThemeMode } from "@/lib/useTheme";
import { TAG_COLORS, MANAGED_SEED_TAG_IDS } from "@/lib/constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { IntegrityReport } from "@/lib/api";
import type { CustomTag, TagCategory } from "@/lib/types";
import { turkishTitleCase } from "@/lib/formatting";

interface SettingsDialogProps {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  logoPreview: string | null;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  backupInputRef: React.RefObject<HTMLInputElement | null>;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  globalTags: CustomTag[];
  tagCategories: TagCategory[];
  editingTagId: string | null;
  editTagName: string;
  setEditTagName: (name: string) => void;
  editTagColor: string;
  setEditTagColor: (color: string) => void;
  editTagVekaletId: string;
  setEditTagVekaletId: (v: string) => void;
  editTagNotes: string;
  setEditTagNotes: (v: string) => void;
  editTagAiNotes: string;
  setEditTagAiNotes: (v: string) => void;
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
  onAddTag: (extra?: { vekaletId?: string; notes?: string; aiNotes?: string }) => void;
  onDeleteTag: (id: string) => void;
  onStartEditTag: (tag: CustomTag) => void;
  onCommitEditTag: () => void;
  onCancelEditTag: () => void;
  onAssignTagCategory: (tagId: string, categoryId: string | null) => void;
  onAddCategory: (name: string) => Promise<TagCategory | null | undefined>;
  onRenameCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
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
  tagCategories,
  editingTagId,
  editTagName,
  setEditTagName,
  editTagColor,
  setEditTagColor,
  editTagVekaletId,
  setEditTagVekaletId,
  editTagNotes,
  setEditTagNotes,
  editTagAiNotes,
  setEditTagAiNotes,
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
  onCancelEditTag,
  onAssignTagCategory,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onIntegrityCheck,
  onIntegrityRepair,
  onNavigateAiSettings,
}: SettingsDialogProps) {
  const [newTagVekaletId, setNewTagVekaletId] = useState("");
  const [newTagNotes, setNewTagNotes] = useState("");
  const [newTagAiNotes, setNewTagAiNotes] = useState("");
  const [showNewTagExtra, setShowNewTagExtra] = useState(false);
  const [newTagCategoryId, setNewTagCategoryId] = useState<string>("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  function handleAddTagWithExtra() {
    onAddTag({ vekaletId: newTagVekaletId, notes: newTagNotes, aiNotes: newTagAiNotes });
    setNewTagVekaletId("");
    setNewTagNotes("");
    setNewTagAiNotes("");
    setShowNewTagExtra(false);
  }

  async function handleAddTagWithCategory() {
    if (!newTagName.trim()) return;
    onAddTag({ vekaletId: newTagVekaletId, notes: newTagNotes, aiNotes: newTagAiNotes });
    setNewTagVekaletId("");
    setNewTagNotes("");
    setNewTagAiNotes("");
    setShowNewTagExtra(false);
    setNewTagCategoryId("");
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    await onAddCategory(newCategoryName.trim());
    setNewCategoryName("");
    setShowAddCategory(false);
  }

  function handleStartRenameCategory(cat: TagCategory) {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
  }

  function handleCommitRenameCategory() {
    if (editingCategoryId && editingCategoryName.trim()) {
      onRenameCategory(editingCategoryId, editingCategoryName.trim());
    }
    setEditingCategoryId(null);
    setEditingCategoryName("");
  }

  const tagsByCategory: Record<string, CustomTag[]> = {};
  const uncategorizedTags: CustomTag[] = [];

  for (const tag of globalTags) {
    if (tag.categoryId) {
      if (!tagsByCategory[tag.categoryId]) tagsByCategory[tag.categoryId] = [];
      tagsByCategory[tag.categoryId].push(tag);
    } else {
      uncategorizedTags.push(tag);
    }
  }

  function renderTagRow(tag: CustomTag) {
    return (
      <div key={tag.id} className="rounded-lg border overflow-hidden">
        {editingTagId === tag.id ? (
          <div className="p-3 space-y-2 bg-muted/30">
            <div className="flex gap-1 flex-wrap">
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${editTagColor === c ? "ring-2 ring-offset-1 ring-primary scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setEditTagColor(c)}
                />
              ))}
            </div>
            <Input
              className="h-7 text-sm"
              placeholder="Etiket adı"
              value={editTagName}
              onChange={(e) => setEditTagName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onCommitEditTag()}
              autoFocus
            />
            <Input
              className="h-7 text-sm"
              placeholder="Vekalet ID (isteğe bağlı)"
              value={editTagVekaletId}
              onChange={(e) => setEditTagVekaletId(e.target.value)}
            />
            <Textarea
              className="text-sm min-h-[56px] resize-none"
              placeholder="Not (isteğe bağlı)"
              value={editTagNotes}
              onChange={(e) => setEditTagNotes(e.target.value)}
              rows={2}
            />
            <Textarea
              className="text-sm min-h-[56px] resize-none"
              placeholder="AI Not (isteğe bağlı)"
              value={editTagAiNotes}
              onChange={(e) => setEditTagAiNotes(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={onCommitEditTag}>
                <Check className="w-3.5 h-3.5 mr-1" />
                Kaydet
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancelEditTag}>İptal</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="flex-1 text-sm font-medium truncate">
              {turkishTitleCase(tag.name)}
            </span>
            {(tag.vekaletId || tag.notes || tag.aiNotes) && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                {tag.aiNotes && <Bot className="w-3 h-3" />}
                {(tag.notes || tag.vekaletId) && <span className="w-1 h-1 rounded-full bg-muted-foreground inline-block" />}
              </span>
            )}
            {MANAGED_SEED_TAG_IDS.has(tag.id) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex-shrink-0 text-muted-foreground cursor-default">
                      <Info className="w-3.5 h-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[220px] text-center">
                    Sistem etiketi — renk, sunucu yeniden başlatıldığında sıfırlanabilir.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {tagCategories.length > 0 && (
              <Select
                value={tag.categoryId || "__none__"}
                onValueChange={(v) => onAssignTagCategory(tag.id, v === "__none__" ? null : v)}
              >
                <SelectTrigger className="h-6 text-xs w-[90px] flex-shrink-0 px-1.5">
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {tagCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => onStartEditTag(tag)}>
              <Pencil className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => onDeleteTag(tag.id)}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
        )}
      </div>
    );
  }

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
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Tags className="w-4 h-4" />
                Etiket Kategorileri
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setShowAddCategory(v => !v)}
              >
                <FolderPlus className="w-3.5 h-3.5 mr-1" />
                Ekle
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Etiketleri gruplamak için kategoriler oluşturun.
            </p>

            {tagCategories.length > 0 && (
              <div className="space-y-1 mb-3">
                {tagCategories.map(cat => (
                  <div key={cat.id} className="rounded border overflow-hidden">
                    {editingCategoryId === cat.id ? (
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <Input
                          className="h-6 text-xs flex-1"
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleCommitRenameCategory(); if (e.key === "Escape") { setEditingCategoryId(null); } }}
                          autoFocus
                        />
                        <Button size="sm" className="h-6 px-2" onClick={handleCommitRenameCategory}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setEditingCategoryId(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1.5">
                        <span className="flex-1 text-xs font-medium truncate">{cat.name}</span>
                        <span className="text-xs text-muted-foreground">{(tagsByCategory[cat.id] || []).length} etiket</span>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleStartRenameCategory(cat)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onDeleteCategory(cat.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showAddCategory && (
              <div className="flex gap-2 mb-3">
                <Input
                  className="h-7 text-sm flex-1"
                  placeholder="Kategori adı"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory(); if (e.key === "Escape") setShowAddCategory(false); }}
                  autoFocus
                />
                <Button variant="outline" size="sm" onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddCategory(false)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <label className="text-sm font-medium mb-3 flex items-center gap-1.5">
              <Tags className="w-4 h-4" />
              Etiketler
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Bağışçılara atayabileceğiniz özel etiketler tanımlayın (VIP, Ödenmedi, Teslim Edildi vb.)
            </p>

            {globalTags.length > 0 && (
              <div className="space-y-3 mb-3">
                {tagCategories.map(cat => {
                  const cats = tagsByCategory[cat.id];
                  if (!cats || cats.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">{cat.name}</p>
                      <div className="space-y-1.5">
                        {cats.map(tag => renderTagRow(tag))}
                      </div>
                    </div>
                  );
                })}
                {uncategorizedTags.length > 0 && (
                  <div>
                    {tagCategories.length > 0 && (
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Kategorisiz</p>
                    )}
                    <div className="space-y-1.5">
                      {uncategorizedTags.map(tag => renderTagRow(tag))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
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
                  onKeyDown={(e) => e.key === "Enter" && handleAddTagWithCategory()}
                />
                <Button variant="outline" size="sm" onClick={handleAddTagWithCategory} disabled={!newTagName.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {newTagName.trim() && (
                <p className="text-xs text-muted-foreground">
                  Görünüm: <strong>{turkishTitleCase(newTagName.trim())}</strong>
                </p>
              )}
              {tagCategories.length > 0 && newTagName.trim() && (
                <Select value={newTagCategoryId} onValueChange={setNewTagCategoryId}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Kategori seç (isteğe bağlı)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Kategorisiz</SelectItem>
                    {tagCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <button
                className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
                onClick={() => setShowNewTagExtra(v => !v)}
                type="button"
              >
                {showNewTagExtra ? "Ek alanları gizle" : "Ek alanlar ekle (Vekalet ID, Not, AI Not)"}
              </button>
              {showNewTagExtra && (
                <div className="space-y-1.5 pt-1">
                  <Input
                    className="h-7 text-sm"
                    placeholder="Vekalet ID (isteğe bağlı)"
                    value={newTagVekaletId}
                    onChange={(e) => setNewTagVekaletId(e.target.value)}
                  />
                  <Textarea
                    className="text-sm min-h-[48px] resize-none"
                    placeholder="Not (isteğe bağlı)"
                    value={newTagNotes}
                    onChange={(e) => setNewTagNotes(e.target.value)}
                    rows={2}
                  />
                  <Textarea
                    className="text-sm min-h-[48px] resize-none"
                    placeholder="AI Not (isteğe bağlı)"
                    value={newTagAiNotes}
                    onChange={(e) => setNewTagAiNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
