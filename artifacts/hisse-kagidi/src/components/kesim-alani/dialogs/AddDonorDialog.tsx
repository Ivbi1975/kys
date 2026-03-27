import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useKesimAlaniContext } from "../KesimAlaniContext";

export function AddDonorDialog() {
  const { addDialogOpen, addDonation, setAddDialogOpen } = useKesimAlaniContext();

  const [newDonation, setNewDonation] = useState({
    name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "", phone: "",
  });

  const handleAddDonation = useCallback(() => {
    addDonation(newDonation);
    setNewDonation({ name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "", phone: "" });
  }, [addDonation, newDonation]);

  return (
    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-1" />Tekli Ekle</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Yeni Bağışçı Ekle</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-4">
          <Input placeholder="Vekalet No" value={newDonation.vekalet} onChange={(e) => setNewDonation({ ...newDonation, vekalet: e.target.value })} />
          <Input placeholder="Vekaleti Veren" value={newDonation.description} onChange={(e) => setNewDonation({ ...newDonation, description: e.target.value })} />
          <Input placeholder="Adına Kesilen" value={newDonation.name} onChange={(e) => setNewDonation({ ...newDonation, name: e.target.value })} />
          <Input placeholder="Cinsi (Vacip, Akika, Adak...)" value={newDonation.donationType} onChange={(e) => setNewDonation({ ...newDonation, donationType: e.target.value })} />
          <Input placeholder="Notlar" value={newDonation.notes} onChange={(e) => setNewDonation({ ...newDonation, notes: e.target.value })} />
          <Input placeholder="Telefon (opsiyonel)" value={newDonation.phone} onChange={(e) => setNewDonation({ ...newDonation, phone: e.target.value })} />
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Hisse:</label>
            <Select value={String(newDonation.shareCount)} onValueChange={(v) => setNewDonation({ ...newDonation, shareCount: parseInt(v) })}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4, 5, 6, 7].map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddDonation} className="w-full">Ekle</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
