import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Loader2, RefreshCw, Users, Check, Square, CheckSquare } from "lucide-react";
import { fetchPoolDonations, fetchDonationSiblings } from "@/lib/api";
import type { DonorSiblings } from "@/lib/api/bagis-havuzu";

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  siblingCount?: number;
  siblingsData?: DonorSiblings[];
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
  skipSiblings?: boolean;
}

export function TransferDialog({
  open, onOpenChange, selectedCount, siblingCount = 0, siblingsData = [], selectedIds, transferTarget, setTransferTarget,
  newListName, setNewListName, creatingNewList, setCreatingNewList,
  transferring, onTransfer, kesimAlanlari: propKesimAlanlari, projectId,
  skipSiblings = false,
}: TransferDialogProps) {
  const [freshKA, setFreshKA] = useState<{ id: string; name: string }[]>([]);
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [siblings, setSiblings] = useState<DonorSiblings[]>([]);
  const [checkingSiblings, setCheckingSiblings] = useState(false);
  const [selectedDonors, setSelectedDonors] = useState<Set<string>>(new Set());

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
      setSelectedDonors(new Set());
    }
  }, [open, refetch]);

  const kaList = freshKA.length > 0 ? freshKA : propKesimAlanlari.filter(ka => ka.name !== "__havuz__");

  const handleActarClick = useCallback(async () => {
    if (selectedIds.length === 0) return;
    if (skipSiblings) {
      const extraIds = siblingsData.flatMap(s => s.extraIds);
      onTransfer(extraIds);
      return;
    }
    setCheckingSiblings(true);
    try {
      const result = await fetchDonationSiblings(projectId, selectedIds);
      if (result.siblings.length > 0) {
        setSiblings(result.siblings);
        setSelectedDonors(new Set(result.siblings.map(s => s.donorName)));
        setStep("confirm");
      } else {
        onTransfer([]);
      }
    } catch {
      onTransfer([]);
    } finally {
      setCheckingSiblings(false);
    }
  }, [selectedIds, projectId, onTransfer, skipSiblings, siblingsData]);

  const toggleDonor = useCallback((donorName: string) => {
    setSelectedDonors(prev => {
      const next = new Set(prev);
      if (next.has(donorName)) next.delete(donorName); else next.add(donorName);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedDonors.size === siblings.length) {
      setSelectedDonors(new Set());
    } else {
      setSelectedDonors(new Set(siblings.map(s => s.donorName)));
    }
  }, [selectedDonors.size, siblings]);

  const selectedExtraIds = siblings
    .filter(s => selectedDonors.has(s.donorName))
    .flatMap(s => s.extraIds);

  const selectedExtraCount = selectedExtraIds.length;

  const handleConfirm = useCallback(() => {
    onTransfer(selectedExtraIds);
  }, [selectedExtraIds, onTransfer]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setNewListName("");
    setCreatingNewList(false);
    setTransferTarget("");
    setStep("select");
    setSiblings([]);
    setSelectedDonors(new Set());
  }, [onOpenChange, setNewListName, setCreatingNewList, setTransferTarget]);

  const totalExtraCount = siblings.reduce((sum, s) => sum + s.extraCount, 0);
  const allSelected = selectedDonors.size === siblings.length && siblings.length > 0;
  const noneSelected = selectedDonors.size === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        {step === "select" ? (
          <>
            <DialogHeader><DialogTitle>Kesim Listesine Aktar</DialogTitle></DialogHeader>
            {siblingCount > 0 ? (
              <div className="mb-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md space-y-1">
                <p className="text-sm">
                  <strong className="text-foreground">{selectedCount}</strong>
                  <span className="text-muted-foreground"> seçili bağış aktarılacak.</span>
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Ayrıca bu bağışçılara ait <strong>{siblingCount}</strong> ek bağış bulundu — sonraki adımda bunları ekleyip eklemeyeceğinizi seçebilirsiniz.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">
                <strong className="text-foreground">{selectedCount}</strong> bağış aktarılacak.
              </p>
            )}
            <div className="space-y-3">
              <div className="flex gap-1">
                <Select value={transferTarget} onValueChange={(v) => { setTransferTarget(v); setCreatingNewList(false); }}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Mevcut kesim listesi seçin..." /></SelectTrigger>
                  <SelectContent>
                    {kaList.map((ka) => (
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
              <Input
                placeholder="Yeni kesim listesi adı..."
                value={newListName}
                onChange={(e) => { setNewListName(e.target.value); if (e.target.value) { setTransferTarget(""); setCreatingNewList(true); } else { setCreatingNewList(false); } }}
                className="h-9"
              />
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
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                Ek Bağışları Seçin
              </DialogTitle>
            </DialogHeader>

            <p className="text-sm text-muted-foreground">
              Seçili bağışçıların aynı isimle kayıtlı <strong className="text-foreground">{totalExtraCount}</strong> ek bağışı mevcut. Hangilerini dahil etmek istediğinizi seçin:
            </p>

            {/* Select all toggle */}
            <button
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1"
              onClick={toggleAll}
            >
              {allSelected
                ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                : noneSelected
                  ? <Square className="w-3.5 h-3.5" />
                  : <CheckSquare className="w-3.5 h-3.5 text-muted-foreground/60" />}
              {allSelected ? "Tümünü kaldır" : "Tümünü seç"}
            </button>

            {/* Sibling list with checkboxes */}
            <div className="space-y-1 max-h-52 overflow-y-auto border rounded-md p-1.5 bg-muted/20">
              {siblings.map(s => {
                const checked = selectedDonors.has(s.donorName);
                return (
                  <button
                    key={s.donorName}
                    className={`flex items-start gap-2.5 w-full px-2 py-1.5 rounded text-left text-sm transition-colors hover:bg-muted/50 ${checked ? "bg-primary/5" : ""}`}
                    onClick={() => toggleDonor(s.donorName)}
                  >
                    <span className={`mt-0.5 flex-shrink-0 w-4 h-4 border rounded flex items-center justify-center ${checked ? "bg-primary border-primary text-primary-foreground" : "border-input"}`}>
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{s.donorName}</span>
                      <div className="text-xs text-muted-foreground space-y-0.5 mt-0.5">
                        {s.donations.map(d => (
                          <div key={d.id} className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-muted-foreground/60">{d.vekalet || "—"}</span>
                            {d.donationType && <span className="text-[10px]">{d.donationType}</span>}
                            {d.shareCount > 1 && <span className="text-[10px]">{d.shareCount} hisse</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-1 mt-0.5">{s.extraCount} bağış</span>
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{selectedCount}</strong> seçili
              {selectedExtraCount > 0 && (
                <> + <strong className="text-foreground">{selectedExtraCount}</strong> ek</>
              )}
              {" = "}
              <strong className="text-foreground">{selectedCount + selectedExtraCount}</strong> toplam aktarılacak
            </p>

            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStep("select"); setSiblings([]); setSelectedDonors(new Set()); }} disabled={transferring}>
                Geri
              </Button>
              <Button className="flex-1" onClick={handleConfirm} disabled={transferring}>
                {transferring ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-1" />}
                Aktar ({selectedCount + selectedExtraCount})
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
