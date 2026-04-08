import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchX, Trash2 } from "lucide-react";
import { useGroupContext } from "../KesimAlaniContext";
import { FIND_DELETE_COLUMN_LABELS } from "../hooks/types";

export function GroupFindDeleteDialog() {
  const {
    executeGroupFindDelete, getGroupFindDeleteMatches,
    groupFindDeleteColumn, groupFindDeleteConfirm, groupFindDeleteOpen,
    groupFindDeleteValue, setGroupFindDeleteColumn, setGroupFindDeleteConfirm,
    setGroupFindDeleteOpen, setGroupFindDeleteValue,
  } = useGroupContext();

  return (
    <Dialog open={groupFindDeleteOpen} onOpenChange={(open) => { setGroupFindDeleteOpen(open); if (!open) { setGroupFindDeleteValue(""); setGroupFindDeleteConfirm(false); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Gruplarda Bul ve Sil"><SearchX className="w-4 h-4 mr-1" />Bul ve Sil</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Gruplarda Bul ve Sil</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Sütun Seç</label>
            <Select value={groupFindDeleteColumn} onValueChange={(v: "name" | "description" | "donationType" | "vekalet" | "notes") => { setGroupFindDeleteColumn(v); setGroupFindDeleteValue(""); setGroupFindDeleteConfirm(false); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="description">Vekaleti Veren</SelectItem>
                <SelectItem value="name">Adına Kesilen</SelectItem>
                <SelectItem value="donationType">Cinsi</SelectItem>
                <SelectItem value="vekalet">Vekalet No</SelectItem>
                <SelectItem value="notes">Notlar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Aranacak Değer</label>
            <Input placeholder={`${FIND_DELETE_COLUMN_LABELS[groupFindDeleteColumn]} içinde ara...`} value={groupFindDeleteValue} onChange={(e) => { setGroupFindDeleteValue(e.target.value); setGroupFindDeleteConfirm(false); }} />
          </div>
          {groupFindDeleteValue.trim() && (() => {
            const matches = getGroupFindDeleteMatches();
            return (
              <div className="space-y-2">
                <span className="text-sm font-medium">{matches.length > 0 ? `${matches.length} kayıt bulundu (gruplarda)` : "Gruplarda eşleşen kayıt bulunamadı"}</span>
                {matches.length > 0 && (
                  <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-muted/50 border-b"><th className="p-2 text-left font-medium">Vekaleti Veren</th><th className="p-2 text-left font-medium">Adına Kesilen</th><th className="p-2 text-left font-medium">Cinsi</th></tr></thead>
                      <tbody>
                        {matches.slice(0, 50).map((d) => (<tr key={d.id} className="border-b last:border-0"><td className="p-2">{d.description || "—"}</td><td className="p-2">{d.name || "—"}</td><td className="p-2">{d.donationType || "—"}</td></tr>))}
                      </tbody>
                    </table>
                    {matches.length > 50 && (<div className="p-2 text-xs text-muted-foreground text-center bg-muted/20">... ve {matches.length - 50} kayıt daha</div>)}
                  </div>
                )}
                {matches.length > 0 && !groupFindDeleteConfirm && (
                  <Button variant="destructive" className="w-full" onClick={() => setGroupFindDeleteConfirm(true)}><Trash2 className="w-4 h-4 mr-1" />{matches.length} Kaydı Sil</Button>
                )}
                {matches.length > 0 && groupFindDeleteConfirm && (
                  <div className="space-y-2 border border-destructive/50 rounded-lg p-3 bg-destructive/5">
                    <p className="text-sm font-medium text-destructive">{matches.length} bağışçı gruplardan ve listeden kalıcı olarak silinecek. Emin misiniz?</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setGroupFindDeleteConfirm(false)}>İptal</Button>
                      <Button variant="destructive" size="sm" className="flex-1" onClick={executeGroupFindDelete}>Evet, Sil</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
