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
import { Plus, Trash2, ChevronRight, Scissors, Settings, ImagePlus, X, Sun, Moon, Download, Upload } from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import {
  loadKesimAlanlari,
  updateKesimAlani,
  deleteKesimAlani,
  saveLogo,
  loadLogo,
  deleteLogo,
  exportBackup,
  importBackup,
} from "@/lib/storage";
import { useTheme } from "@/lib/useTheme";

export default function Home() {
  const [, setLocation] = useLocation();
  const [kesimAlanlari, setKesimAlanlari] = useState<KesimAlani[]>([]);
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const { isDark, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    setKesimAlanlari(loadKesimAlanlari());
    setLogoPreview(loadLogo());
  }, []);

  function handleCreate() {
    if (!newName.trim()) return;
    const newKesim: KesimAlani = {
      id: Math.random().toString(36).substring(2, 12),
      name: newName.trim(),
      donations: [],
      animalGroups: [],
      createdAt: new Date().toISOString(),
    };
    updateKesimAlani(newKesim);
    setKesimAlanlari(loadKesimAlanlari());
    setNewName("");
    setDialogOpen(false);
    setLocation(`/kesim/${newKesim.id}`);
  }

  function handleDelete(id: string) {
    deleteKesimAlani(id);
    setKesimAlanlari(loadKesimAlanlari());
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Lütfen bir resim dosyası seçin.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      saveLogo(base64);
      setLogoPreview(base64);
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  function handleDeleteLogo() {
    deleteLogo();
    setLogoPreview(null);
  }

  function handleExportBackup() {
    const json = exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kurban_yedek_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const json = evt.target?.result as string;
      const result = importBackup(json);
      if (result.success) {
        setKesimAlanlari(loadKesimAlanlari());
        setLogoPreview(loadLogo());
        alert(`Yedek başarıyla yüklendi: ${result.count} kesim alanı`);
      } else {
        alert(`Hata: ${result.error}`);
      }
    };
    reader.readAsText(file);
    if (backupInputRef.current) backupInputRef.current.value = "";
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
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
          <Button variant="ghost" size="sm" onClick={toggleTheme} title={isDark ? "Açık Tema" : "Koyu Tema"}>
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
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
          <div className="space-y-3">
            {kesimAlanlari.map((k) => (
              <Card
                key={k.id}
                className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => setLocation(`/kesim/${k.id}`)}
              >
                <div>
                  <h3 className="font-semibold text-foreground">{k.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {k.donations.length} bağışçı •{" "}
                    {k.animalGroups.length} hayvan grubu •{" "}
                    {new Date(k.createdAt).toLocaleDateString("tr-TR")}
                  </p>
                </div>
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
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
