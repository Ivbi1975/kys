import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Loader2, RefreshCw, Users } from "lucide-react";
import { fetchPoolDonations, fetchDonationSiblings } from "@/lib/api";
import type { DonorSiblings } from "@/lib/api/bagis-havuzu";

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  selectedIds: string[];
  transferTarget: string;
  setTransferTarget: (v: string) => void;
  newListName: string;
  setNewListName: (v: string) => void;
  creatingNewList: boolean;
  setCreatingNewList: (v: boolean) => void;
  transferring: boolean;
  onTransfer: (extraIds: string[]) => void;
  kesimAlanlari: { id: string; name: string }[];
  projectId: string;
}

export function TransferDialog({
  open, onOpenChange, selectedCount, selectedIds, transferTarget, setTransferTarget,
  newListName, setNewListName, creatingNewList, setCreatingNewList,
  transferring, onTransfer, kesimAlanlari: propKesimAlanlari, projectId,
}: TransferDialogProps) {
  const [freshKA, setFreshKA] = useState<{ id: string; name: string }[]>([]);
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [siblings, setSiblings] = useState<DonorSiblings[]>([]);
  const [checkingSiblings, setCheckingSiblings] = useState(false);

  const refetch = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await fetchPoolDonations(projectId, { limit: 1 });
      setFreshKA((result.kesimAlanlari || []).filter(ka => ka.name !== "__havuz__"));
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      refetch();
      setStep("select");
      setSiblings([]);
    }
  }, [open, refetch]);

  const kaList = freshKA.length > 0 ? freshKA : propKesimAlanlari.filter(ka => ka.name !== "__havuz__");

  const handleActarClick = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setCheckingSiblings(true);
    try {
      const result = await fetchDonationSiblings(projectId, selectedIds);
      if (result.siblings.length > 0) {
        setSiblings(result.siblings);
        setStep("confirm");
      } else {
        onTransfer([]);
      }
    } catch {
      onTransfer([]);
    } finally {
      setCheckingSiblings(false);
    }
  }, [selectedIds, projectId, onTransfer]);

  const handleConfirmWithExtra = useCallback(() => {
    const extraIds = siblings.flatMap(s => s.extraIds);
    onTransfer(extraIds);
  }, [siblings, onTransfer]);

  const handleConfirmWithoutExtra = useCallback(() => {
    onTransfer([]);
  }, [onTransfer]);

  const totalExtraCount = siblings.reduce((sum, s) => sum + s.extraCount, 0);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setNewListName("");
    setCreatingNewList(false);
    setTransferTarget("");
    setStep("select");
    setSiblings([]);
  }, [onOpenChange, setNewListName, setCreatingNewList, setTransferTarget]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        {step === "select" ? (
          <>
            <DialogHeader><DialogTitle>Kesim Listesine Aktar</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">{selectedCount} bağış aktarılacak.</p>
            <div className="space-y-3">
              <div className="flex gap-1">
                <Select value={transferTarget} onValueChange={(v) => { setTransferTarget(v); setCreatingNewList(false); }}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Mevcut kesim listesi seçin..." /></SelectTrigger>
                  <SelectContent>
                    {kaList.map((ka: { id: string; name: string }) => (
                      <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => refetch()} title="Listeyi yenile">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 h-px bg-border" />
                <span>veya</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Yeni kesim listesi adı..."
                  value={newListName}
                  onChange={(e) => { setNewListName(e.target.value); if (e.target.value) { setTransferTarget(""); setCreatingNewList(true); } else { setCreatingNewList(false); } }}
                  className="h-9 flex-1"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={handleClose}>İptal</Button>
              <Button
                className="flex-1"
                onClick={handleActarClick}
                disabled={(!transferTarget && !creatingNewList) || transferring || checkingSiblings || (creatingNewList && !newListName.trim())}
              >
                {(transferring || checkingSiblings) ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-1" />}
                Aktar
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-amber-500" />Ek Bağışlar Bulundu</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">
              Seçili bağışçıların aynı isimle kayıtlı <strong>{totalExtraCount}</strong> ek bağışı mevcut.
              Bu bağışları da aktarmak ister misiniz?
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-md p-2 bg-muted/30">
              {siblings.map(s => (
                <div key={s.donorName} className="flex items-center justify-between text-sm px-1">
                  <span className="font-medium truncate">{s.donorName}</span>
                  <span className="text-muted-foreground flex-shrink-0 ml-2">{s.extraCount} bağış daha</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Toplam: <strong>{selectedCount}</strong> seçili + <strong>{totalExtraCount}</strong> ek = <strong>{selectedCount + totalExtraCount}</strong> bağış
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={handleConfirmWithoutExtra} disabled={transferring}>
                Hayır, sadece seçilenleri aktar
              </Button>
              <Button className="flex-1" onClick={handleConfirmWithExtra} disabled={transferring}>
                {transferring ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-1" />}
                Evet, ekle ({selectedCount + totalExtraCount})
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
