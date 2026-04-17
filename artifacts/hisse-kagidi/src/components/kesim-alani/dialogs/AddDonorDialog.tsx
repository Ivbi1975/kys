import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, ShieldAlert } from "lucide-react";
import { useDonationContext, useKesimAlaniContext } from "../KesimAlaniContext";
import { checkVekaletConflicts } from "@/lib/api";

export function AddDonorDialog() {
  const { addDialogOpen, addDonation, setAddDialogOpen } = useDonationContext();
  const { kesim } = useKesimAlaniContext();

  const [newDonation, setNewDonation] = useState({
    name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "", phone: "",
  });

  const [vekaletError, setVekaletError] = useState<string | null>(null);
  const [checkingVekalet, setCheckingVekalet] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const val = newDonation.vekalet.trim();
    if (!val) {
      setVekaletError(null);
      setCheckingVekalet(false);
      return;
    }

    setCheckingVekalet(true);
    setVekaletError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!kesim?.projectId) {
        setCheckingVekalet(false);
        return;
      }
      try {
        const { conflicts } = await checkVekaletConflicts(kesim.projectId, [val]);
        if (conflicts.length > 0) {
          const where = conflicts[0].kesimAlaniName || "başka bir liste";
          setVekaletError(`Bu vekalet numarası "${where}" listesinde zaten kayıtlı.`);
        } else {
          setVekaletError(null);
        }
      } catch {
        setVekaletError(null);
      } finally {
        setCheckingVekalet(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [newDonation.vekalet, kesim?.projectId, kesim?.id]);

  const handleAddDonation = useCallback(() => {
    if (vekaletError || checkingVekalet) return;
    addDonation(newDonation);
    setNewDonation({ name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "", phone: "" });
    setVekaletError(null);
  }, [addDonation, newDonation, vekaletError, checkingVekalet]);

  const canSubmit = newDonation.name.trim() && !vekaletError && !checkingVekalet;

  return (
    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-1" />Tekli Ekle</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Yeni Bağışçı Ekle</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-4">
          <div className="space-y-1">
            <div className="relative">
              <Input
                placeholder="Vekalet No"
                value={newDonation.vekalet}
                onChange={(e) => setNewDonation({ ...newDonation, vekalet: e.target.value })}
                className={vekaletError ? "border-red-500 focus-visible:ring-red-500 pr-8" : ""}
              />
              {checkingVekalet && (
                <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {vekaletError && (
              <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{vekaletError}</span>
              </div>
            )}
          </div>
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
          <Button onClick={handleAddDonation} className="w-full" disabled={!canSubmit}>
            {checkingVekalet ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Kontrol ediliyor...</>
            ) : vekaletError ? (
              <><ShieldAlert className="w-4 h-4 mr-1" />Aynı Vekalet No Kayıtlı</>
            ) : "Ekle"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
