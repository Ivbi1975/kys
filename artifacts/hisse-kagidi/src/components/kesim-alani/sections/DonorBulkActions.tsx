import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, ShoppingBag, Trash2, Wand2 } from "lucide-react";
import { useKesimAlaniContext } from "../KesimAlaniContext";

export function DonorBulkActions() {
  const {
    addSelectedToBasket, applyBulkEdit, bulkEditField, bulkEditOpen, bulkEditValue,
    deleteSelected, groupingInProgress, handleAutoGroupSelected, selectedIds,
    setBulkEditField, setBulkEditOpen, setBulkEditValue, setSelectedIds,
  } = useKesimAlaniContext();

  if (selectedIds.size === 0) return null;

  return (
    <div className="mb-3 flex items-center gap-3 p-2 bg-primary/10 rounded-lg flex-wrap">
      <span className="text-sm font-medium">{selectedIds.size} satır seçildi</span>
      <Button variant="destructive" size="sm" onClick={deleteSelected}><Trash2 className="w-3 h-3 mr-1" />Sil</Button>
      <Button variant="outline" size="sm" onClick={addSelectedToBasket}><ShoppingBag className="w-3 h-3 mr-1" />Sepete Ekle</Button>
      <Button variant="outline" size="sm" onClick={handleAutoGroupSelected} disabled={groupingInProgress}><Wand2 className="w-3 h-3 mr-1" />Seçilenleri Grupla</Button>
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm"><Settings2 className="w-3 h-3 mr-1" />Toplu Düzenle</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedIds.size} Bağışçıyı Toplu Düzenle</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <Select value={bulkEditField} onValueChange={(v: "donationType" | "shareCount" | "notes" | "vekalet") => setBulkEditField(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="donationType">Cinsi</SelectItem>
                <SelectItem value="shareCount">Hisse Sayısı</SelectItem>
                <SelectItem value="vekalet">Vekalet No</SelectItem>
                <SelectItem value="notes">Notlar</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder={bulkEditField === "shareCount" ? "1-7" : "Yeni değer"} value={bulkEditValue} onChange={(e) => setBulkEditValue(e.target.value)} type={bulkEditField === "shareCount" ? "number" : "text"} />
            <Button onClick={applyBulkEdit} className="w-full">Uygula</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Seçimi Kaldır</Button>
    </div>
  );
}
