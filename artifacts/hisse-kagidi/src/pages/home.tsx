import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, ChevronRight, Scissors, Settings, ImagePlus, X, Sun, Moon, Monitor, Download, Upload, Tag, Pencil, Users, PieChart } from "lucide-react";
import type { KesimAlani, CustomTag } from "@/lib/types";
import {
  fetchKesimAlanlari,
  createKesimAlani,
  apiDeleteKesimAlani,
  fetchTags,
  createTag,
  updateTag,
  deleteTagApi,
  fetchLogo,
  saveLogoApi,
  deleteLogoApi,
  exportBackupApi,
  importBackupApi,
  migrateLocalStorageToApi,
} from "@/lib/api";
import { useTheme } from "@/lib/useTheme";
import type { ThemeMode } from "@/lib/useTheme";
import { getTotalShares, getRequiredAnimals } from "@/lib/grouping";

export default function Home() {
  const [, setLocation] = useLocation();
  const [kesimAlanlari, setKesimAlanlari] = useState<KesimAlani[]>([]);
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const { isDark, mode: themeMode, toggle: toggleTheme, setThemeMode } = useTheme();
  const [globalTags, setGlobalTags] = useState<CustomTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");
  const [loading, setLoading] = useState(true);
  const [migrationDone, setMigrationDone] = useState(false);

  const TAG_COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  ];

  useEffect(() => {
    async function init() {
      try {
        const migrated = await migrateLocalStorageToApi();
        if (migrated) setMigrationDone(true);
        const [ka, tags, logo] = await Promise.all([
          fetchKesimAlanlari(),
          fetchTags(),
          fetchLogo(),
        ]);
        setKesimAlanlari(ka);
        setGlobalTags(tags);
        setLogoPreview(logo);
      } catch (err) {
        console.error("Veri yüklenemedi:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleAddTag() {
    if (!newTagName.trim()) return;
    const tag: CustomTag = {
      id: Math.random().toString(36).substring(2, 10),
      name: newTagName.trim(),
      color: newTagColor,
    };
    try {
      await createTag(tag);
      setGlobalTags([...globalTags, tag]);
      setNewTagName("");
      setNewTagColor("#3b82f6");
    } catch (err) {
      console.error("Etiket oluşturma hatası:", err);
    }
  }

  async function handleDeleteTag(id: string) {
    try {
      await deleteTagApi(id);
      setGlobalTags(globalTags.filter(t => t.id !== id));
    } catch (err) {
      console.error("Etiket silme hatası:", err);
    }
  }

  function startEditTag(tag: CustomTag) {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  }

  async function commitEditTag() {
    if (!editingTagId || !editTagName.trim()) {
      setEditingTagId(null);
      return;
    }
    const updated = { id: editingTagId, name: editTagName.trim(), color: editTagColor };
    try {
      await updateTag(updated);
      setGlobalTags(globalTags.map(t =>
        t.id === editingTagId ? updated : t
      ));
    } catch (err) {
      console.error("Etiket güncelleme hatası:", err);
    }
    setEditingTagId(null);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const newKesim: KesimAlani = {
      id: Math.random().toString(36).substring(2, 12),
      name: newName.trim(),
      donations: [],
      animalGroups: [],
      createdAt: new Date().toISOString(),
    };
    try {
      await createKesimAlani(newKesim);
      setNewName("");
      setDialogOpen(false);
      setLocation(`/kesim/${newKesim.id}`);
    } catch (err) {
      console.error("Oluşturma hatası:", err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiDeleteKesimAlani(id);
      setKesimAlanlari(kesimAlanlari.filter(k => k.id !== id));
    } catch (err) {
      console.error("Silme hatası:", err);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Lütfen bir resim dosyası seçin.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      try {
        await saveLogoApi(base64);
        setLogoPreview(base64);
      } catch (err) {
        console.error("Logo yükleme hatası:", err);
      }
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  async function handleDeleteLogo() {
    try {
      await deleteLogoApi();
      setLogoPreview(null);
    } catch (err) {
      console.error("Logo silme hatası:", err);
    }
  }

  async function handleExportBackup() {
    try {
      const json = await exportBackupApi();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kurban_yedek_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Yedekleme hatası:", err);
    }
  }

  async function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const json = evt.target?.result as string;
      const result = await importBackupApi(json);
      if (result.success) {
        const ka = await fetchKesimAlanlari();
        setKesimAlanlari(ka);
        const logo = await fetchLogo();
        setLogoPreview(logo);
        const tags = await fetchTags();
        setGlobalTags(tags);
        alert(`Yedek başarıyla yüklendi: ${result.count} kesim alanı`);
      } else {
        alert(`Hata: ${result.error}`);
      }
    };
    reader.readAsText(file);
    if (backupInputRef.current) backupInputRef.current.value = "";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Scissors className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        {migrationDone && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-sm text-green-800 dark:text-green-200">
            Mevcut verileriniz veritabanına başarıyla aktarıldı. Artık verileriniz kalıcı olarak saklanmaktadır.
          </div>
        )}
        <div className="flex items-center gap-3 mb-8">
          <Scissors className="w-8 h-8 text-primary" />
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">
              Kurban Hisse Kağıdı
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Kesim alanı oluşturun, bağışçıları ekleyin ve hisse kağıtlarını
              yazdırın
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleTheme} title={themeMode === "light" ? "Açık" : themeMode === "dark" ? "Koyu" : "Sistem"}>
            {themeMode === "light" ? <Sun className="w-5 h-5" /> : themeMode === "dark" ? <Moon className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </Button>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-1" />
                Ayarlar
              </Button>
            </DialogTrigger>
            <DialogContent>
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
                          onClick={handleDeleteLogo}
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
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG desteklenir</p>
                    </div>
                  )}

                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
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
                    <Button variant="outline" size="sm" className="flex-1" onClick={handleExportBackup}>
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
                    onChange={handleImportBackup}
                  />
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
                                onBlur={commitEditTag}
                                onKeyDown={(e) => e.key === "Enter" && commitEditTag()}
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
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEditTag(tag)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleDeleteTag(tag.id)}>
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
                      onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    />
                    <Button variant="outline" size="sm" onClick={handleAddTag} disabled={!newTagName.trim()}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="mb-6">
              <Plus className="w-5 h-5 mr-2" />
              Yeni Kesim Alanı Oluştur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Kesim Alanı</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="Kesim alanı adı (örn: Ankara Merkez)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <Button onClick={handleCreate} className="w-full">
                Oluştur
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {kesimAlanlari.length === 0 ? (
          <Card className="p-12 text-center">
            <Scissors className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Henüz kesim alanı yok
            </h3>
            <p className="text-muted-foreground">
              Yukarıdaki butona tıklayarak ilk kesim alanınızı oluşturun
            </p>
          </Card>
        ) : (
          <>
            {kesimAlanlari.length > 1 && (() => {
              const totals = kesimAlanlari.reduce((acc, k) => {
                const shares = getTotalShares(k.donations);
                const animals = getRequiredAnimals(k.donations);
                const activeDonors = k.donations.filter(d => !d.excluded).length;
                const totalSlots = k.animalGroups.length * 7;
                const filledSlots = k.animalGroups.reduce(
                  (s, g) => s + g.donations.filter(d => d.name.trim() !== "").length, 0
                );
                return {
                  donors: acc.donors + activeDonors,
                  shares: acc.shares + shares,
                  animals: acc.animals + animals,
                  grouped: acc.grouped + k.animalGroups.length,
                  totalSlots: acc.totalSlots + totalSlots,
                  filledSlots: acc.filledSlots + filledSlots,
                };
              }, { donors: 0, shares: 0, animals: 0, grouped: 0, totalSlots: 0, filledSlots: 0 });
              const occupancy = totals.totalSlots > 0 ? Math.round((totals.filledSlots / totals.totalSlots) * 100) : 0;
              return (
                <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <PieChart className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Genel Özet</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="text-center">
                      <div className="text-xl font-bold text-primary">{totals.donors}</div>
                      <div className="text-xs text-muted-foreground">Aktif Bağışçı</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-primary">{totals.shares}</div>
                      <div className="text-xs text-muted-foreground">Toplam Hisse</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-primary">{totals.animals}</div>
                      <div className="text-xs text-muted-foreground">Gereken Hayvan</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-primary">{totals.grouped}</div>
                      <div className="text-xs text-muted-foreground">Gruplandırılmış</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-primary">%{occupancy}</div>
                      <div className="text-xs text-muted-foreground">Doluluk Oranı</div>
                    </div>
                  </div>
                </Card>
              );
            })()}
            <div className="space-y-3">
              {kesimAlanlari.map((k) => {
                const shares = getTotalShares(k.donations);
                const animals = getRequiredAnimals(k.donations);
                const activeDonors = k.donations.filter(d => !d.excluded).length;
                const totalSlots = k.animalGroups.length * 7;
                const filledSlots = k.animalGroups.reduce(
                  (s, g) => s + g.donations.filter(d => d.name.trim() !== "").length, 0
                );
                const occupancy = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
                return (
                  <Card
                    key={k.id}
                    className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/kesim/${k.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-foreground">{k.name}</h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(k.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                      <div>
                        <div className="text-sm font-bold text-primary">{activeDonors}</div>
                        <div className="text-[10px] text-muted-foreground">Bağışçı</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-primary">{shares}</div>
                        <div className="text-[10px] text-muted-foreground">Hisse</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-primary">{animals}</div>
                        <div className="text-[10px] text-muted-foreground">Hayvan</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-primary">{k.animalGroups.length}</div>
                        <div className="text-[10px] text-muted-foreground">Grup</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-primary">%{occupancy}</div>
                        <div className="text-[10px] text-muted-foreground">Doluluk</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(k.createdAt).toLocaleDateString("tr-TR")}
                    </p>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
