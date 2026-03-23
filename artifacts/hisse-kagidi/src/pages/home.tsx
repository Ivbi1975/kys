import { useState, useEffect } from "react";
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
import { Plus, Trash2, ChevronRight, Scissors } from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import {
  loadKesimAlanlari,
  updateKesimAlani,
  deleteKesimAlani,
} from "@/lib/storage";

export default function Home() {
  const [, setLocation] = useLocation();
  const [kesimAlanlari, setKesimAlanlari] = useState<KesimAlani[]>([]);
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setKesimAlanlari(loadKesimAlanlari());
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-8">
          <Scissors className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Kurban Hisse Kağıdı
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Kesim alanı oluşturun, bağışçıları ekleyin ve hisse kağıtlarını
              yazdırın
            </p>
          </div>
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
