import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, Settings2, ShoppingBag, Trash2, Undo2, Wand2 } from "lucide-react";
import { useSelectionContext, useDonationContext } from "../KesimAlaniContext";

export function DonorBulkActions() {
  const { selectedIds, setSelectedIds } = useSelectionContext();
  const {
    addSelectedToBasket, applyBulkEdit, bulkEditField, bulkEditOpen, bulkEditValue,
    deleteSelected, groupingInProgress, handleAutoGroupSelected,
    setBulkEditField, setBulkEditOpen, setBulkEditValue,
    sendDonationsToPool,
  } = useDonationContext();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [poolConfirmOpen, setPoolConfirmOpen] = useState(false);
  const [sendingToPool, setSendingToPool] = useState(false);

  if (selectedIds.size === 0) return null;

  const handleDeleteConfirm = () => {
    deleteSelected();
    setDeleteConfirmOpen(false);
  };

  const handleSendToPoolConfirm = async () => {
    setSendingToPool(true);
    try {
      await sendDonationsToPool([...selectedIds]);
    } finally {
      setSendingToPool(false);
      setPoolConfirmOpen(false);
    }
  };

  return (
    <div className="mb-3 flex items-center gap-3 p-2 bg-primary/10 rounded-lg flex-wrap" role="toolbar" aria-label="Toplu işlemler">
      <span className="text-sm font-medium">{selectedIds.size} satır seçildi</span>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm" aria-label={`${selectedIds.size} seçili bağışçıyı sil`}>
            <Trash2 className="w-3 h-3 mr-1" aria-hidden="true" />Sil
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" aria-hidden="true" />
              Silme Onayı
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-foreground">
              <strong>{selectedIds.size}</strong> bağışçı kaydı silinecek. Bu işlem geri alınamaz.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Silinen kayıtlar çöp kutusuna taşınacaktır.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} aria-label="Silme işlemini iptal et">
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} aria-label={`${selectedIds.size} bağışçıyı kalıcı olarak sil`}>
              <Trash2 className="w-4 h-4 mr-1" aria-hidden="true" />
              {selectedIds.size} Kaydı Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button variant="outline" size="sm" onClick={addSelectedToBasket} aria-label={`${selectedIds.size} seçili bağışçıyı sepete ekle`}>
        <ShoppingBag className="w-3 h-3 mr-1" aria-hidden="true" />Sepete Ekle
      </Button>
      <Button variant="outline" size="sm" onClick={handleAutoGroupSelected} disabled={groupingInProgress} aria-label={`${selectedIds.size} seçili bağışçıyı otomatik grupla`}>
        <Wand2 className="w-3 h-3 mr-1" aria-hidden="true" />Seçilenleri Grupla
      </Button>

      <Dialog open={poolConfirmOpen} onOpenChange={setPoolConfirmOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950" aria-label={`${selectedIds.size} seçili bağışçıyı havuza gönder`}>
            <Undo2 className="w-3 h-3 mr-1" aria-hidden="true" />Havuza Geri Gönder
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-blue-600" aria-hidden="true" />
              Havuza Geri Gönder
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-foreground">
              <strong>{selectedIds.size}</strong> bağışçı bağış havuzuna geri taşınacak.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Bu işlem geri alınabilir. Bağışçılar havuz sayfasında tekrar görünür hale gelecek.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPoolConfirmOpen(false)} disabled={sendingToPool}>
              İptal
            </Button>
            <Button
              onClick={handleSendToPoolConfirm}
              disabled={sendingToPool}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              aria-label={`${selectedIds.size} bağışçıyı havuza gönder`}
            >
              {sendingToPool
                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Gönderiliyor…</>
                : <><Undo2 className="w-4 h-4 mr-1" />{selectedIds.size} Bağışçıyı Havuza Gönder</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`${selectedIds.size} seçili bağışçıyı toplu düzenle`}>
            <Settings2 className="w-3 h-3 mr-1" aria-hidden="true" />Toplu Düzenle
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedIds.size} Bağışçıyı Toplu Düzenle</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <Select value={bulkEditField} onValueChange={(v: "donationType" | "shareCount" | "notes" | "vekalet") => setBulkEditField(v)}>
              <SelectTrigger aria-label="Düzenlenecek alan seçin"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="donationType">Cinsi</SelectItem>
                <SelectItem value="shareCount">Hisse Sayısı</SelectItem>
                <SelectItem value="vekalet">Vekalet No</SelectItem>
                <SelectItem value="notes">Notlar</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={bulkEditField === "shareCount" ? "1-7" : "Yeni değer"}
              value={bulkEditValue}
              onChange={(e) => setBulkEditValue(e.target.value)}
              type={bulkEditField === "shareCount" ? "number" : "text"}
              aria-label="Yeni değer girin"
            />
            <Button onClick={applyBulkEdit} className="w-full" aria-label="Toplu düzenlemeyi uygula">Uygula</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} aria-label="Seçimi kaldır">Seçimi Kaldır</Button>
    </div>
  );
}
