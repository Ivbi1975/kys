import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Loader2, RefreshCw, Check, Square, CheckSquare, FolderOpen, FolderPlus } from "lucide-react";
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
  open, onOpenChange, selectedCount, siblingCount = 0, selectedIds, transferTarget, setTransferTarget,
  newListName, setNewListName, creatingNewList, setCreatingNewList,
  transferring, onTransfer, kesimAlanlari: propKesimAlanlari, projectId,
}: TransferDialogProps) {
  const [freshKA, setFreshKA] = useState<{ id: string; name: string }[]>([]);
  const [siblings, setSiblings] = useState<DonorSiblings[]>([]);
  const [loadingSiblings, setLoadingSiblings] = useState(false);
  const [selectedDonors, setSelectedDonors] = useState<Set<string>>(new Set());
  const fetchedForIds = useRef<string>("");

  const refetchKA = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await fetchPoolDonations(projectId, { limit: 1 });
      setFreshKA((result.kesimAlanlari || []).filter(ka => ka.name !== "__havuz__"));
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    refetchKA();
    const key = selectedIds.join(",");
    if (fetchedForIds.current === key) return;
    if (selectedIds.length === 0 || siblingCount === 0) {
      setSiblings([]);
      setSelectedDonors(new Set());
      fetchedForIds.current = key;
      return;
    }
    fetchedForIds.current = key;
    setLoadingSiblings(true);
    fetchDonationSiblings(projectId, selectedIds)
      .then(result => {
        setSiblings(result.siblings);
        setSelectedDonors(new Set(result.siblings.map(s => s.donorName)));
      })
      .catch(() => setSiblings([]))
      .finally(() => setLoadingSiblings(false));
  }, [open, selectedIds, siblingCount, projectId, refetchKA]);

  useEffect(() => {
    if (!open) {
      setSiblings([]);
      setSelectedDonors(new Set());
      fetchedForIds.current = "";
    }
  }, [open]);

  const kaList = freshKA.length > 0 ? freshKA : propKesimAlanlari.filter(ka => ka.name !== "__havuz__");

  const toggleDonor = useCallback((donorName: string) => {
    setSelectedDonors(prev => {
      const next = new Set(prev);
      if (next.has(donorName)) next.delete(donorName); else next.add(donorName);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedDonors.size === siblings.length) setSelectedDonors(new Set());
    else setSelectedDonors(new Set(siblings.map(s => s.donorName)));
  }, [selectedDonors.size, siblings]);

  const selectedExtraIds = siblings.filter(s => selectedDonors.has(s.donorName)).flatMap(s => s.extraIds);
  const selectedExtraCount = selectedExtraIds.length;
  const totalExtraCount = siblings.reduce((sum, s) => sum + s.extraCount, 0);
  const allSelected = siblings.length > 0 && selectedDonors.size === siblings.length;
  const totalToTransfer = selectedCount + selectedExtraCount;
  const canTransfer = (!!transferTarget || (creatingNewList && !!newListName.trim())) && !transferring && !loadingSiblings;

  const handleTransfer = useCallback(() => { onTransfer(selectedExtraIds); }, [selectedExtraIds, onTransfer]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setNewListName("");
    setCreatingNewList(false);
    setTransferTarget("");
  }, [onOpenChange, setNewListName, setCreatingNewList, setTransferTarget]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-md">

        {/* Header */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
            </span>
            Kesim Listesine Aktar
          </DialogTitle>
        </DialogHeader>

        {/* Summary line */}
        <div className="flex items-center gap-2 flex-wrap text-sm -mt-1">
          <span><strong>{selectedCount}</strong> <span className="text-muted-foreground">seçili bağış</span></span>
          {loadingSiblings && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />kontrol ediliyor…
            </span>
          )}
          {!loadingSiblings && selectedExtraCount > 0 && (
            <>
              <span className="text-muted-foreground">+</span>
              <span><strong className="text-amber-600 dark:text-amber-400">{selectedExtraCount}</strong> <span className="text-muted-foreground">ek bağış</span></span>
              <span className="text-muted-foreground">=</span>
              <span className="font-semibold text-primary">{totalToTransfer} toplam</span>
            </>
          )}
        </div>

        {/* Siblings panel */}
        {!loadingSiblings && siblings.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/50">
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-200 hover:opacity-75 transition-opacity"
              >
                {allSelected
                  ? <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
                  : selectedDonors.size === 0
                    ? <Square className="h-4 w-4 flex-shrink-0" />
                    : <CheckSquare className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />}
                {totalExtraCount} ek bağış — {allSelected ? "Tümünü kaldır" : "Tümünü seç"}
              </button>
              <span className="text-xs text-muted-foreground tabular-nums">{selectedDonors.size}/{siblings.length}</span>
            </div>
            <div className="max-h-40 overflow-y-auto divide-y">
              {siblings.map(s => {
                const checked = selectedDonors.has(s.donorName);
                return (
                  <button
                    key={s.donorName}
                    className={`flex items-start gap-3 w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/40 ${checked ? "bg-primary/5" : ""}`}
                    onClick={() => toggleDonor(s.donorName)}
                  >
                    <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${checked ? "bg-primary border-primary" : "border-input"}`}>
                      {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium block">{s.donorName}</span>
                      <div className="flex flex-wrap gap-x-2 mt-0.5">
                        {s.donations.map(d => (
                          <span key={d.id} className="text-[10px] text-muted-foreground font-mono">
                            {d.vekalet || "—"}
                            {d.donationType && <span className="font-sans ml-1">{d.donationType}</span>}
                            {d.shareCount > 1 && <span className="font-sans ml-0.5">{d.shareCount}h</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-xs text-muted-foreground mt-0.5 tabular-nums">+{s.extraCount}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Destination */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />Mevcut listeye aktar
            </p>
            <div className="flex gap-1.5">
              <Select value={transferTarget} onValueChange={(v) => { setTransferTarget(v); setCreatingNewList(false); }}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Kesim listesi seçin…" /></SelectTrigger>
                <SelectContent>
                  {kaList.map((ka) => <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0" onClick={refetchKA} title="Listeyi yenile">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">veya</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FolderPlus className="h-3.5 w-3.5" />Yeni liste oluştur
            </p>
            <Input
              placeholder="Liste adı girin…"
              value={newListName}
              onChange={(e) => {
                setNewListName(e.target.value);
                if (e.target.value) { setTransferTarget(""); setCreatingNewList(true); }
                else { setCreatingNewList(false); }
              }}
              className="h-9"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={handleClose}>İptal</Button>
          <Button className="flex-[2]" onClick={handleTransfer} disabled={!canTransfer}>
            {transferring
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Aktarılıyor…</>
              : <><ArrowRightLeft className="h-4 w-4 mr-2" />{totalToTransfer} Bağışı Aktar</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
