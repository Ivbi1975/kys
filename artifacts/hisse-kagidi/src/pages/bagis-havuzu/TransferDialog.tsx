import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Loader2, RefreshCw, Check, Square, CheckSquare, ListPlus, FolderPlus } from "lucide-react";
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

  const handleTransfer = useCallback(() => { onTransfer(selectedExtraIds); }, [selectedExtraIds, onTransfer]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setNewListName("");
    setCreatingNewList(false);
    setTransferTarget("");
  }, [onOpenChange, setNewListName, setCreatingNewList, setTransferTarget]);

  const canTransfer = (!!transferTarget || (creatingNewList && !!newListName.trim())) && !transferring && !loadingSiblings;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-[440px] p-0 gap-0 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-muted/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
              </span>
              Kesim Listesine Aktar
            </DialogTitle>
          </DialogHeader>
          {/* Summary chips */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {selectedCount} seçili bağış
            </span>
            {loadingSiblings && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                kontrol ediliyor…
              </span>
            )}
            {!loadingSiblings && selectedExtraCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                +{selectedExtraCount} ek bağış
              </span>
            )}
            {(selectedExtraCount > 0 || selectedCount > 0) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold ml-auto">
                = {totalToTransfer} toplam
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Siblings panel */}
          {!loadingSiblings && siblings.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
                >
                  {allSelected
                    ? <CheckSquare className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    : selectedDonors.size === 0
                      ? <Square className="w-3.5 h-3.5 flex-shrink-0" />
                      : <CheckSquare className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />}
                  {totalExtraCount} ek bağış — {allSelected ? "Tümünü kaldır" : "Tümünü seç"}
                </button>
                <span className="text-xs tabular-nums text-amber-700/70 dark:text-amber-400/70">
                  {selectedDonors.size}/{siblings.length} seçili
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-border/60">
                {siblings.map(s => {
                  const checked = selectedDonors.has(s.donorName);
                  return (
                    <button
                      key={s.donorName}
                      onClick={() => toggleDonor(s.donorName)}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${checked ? "bg-primary/5" : "bg-background"}`}
                    >
                      <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? "bg-primary border-primary" : "border-input bg-background"}`}>
                        {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-tight">{s.donorName}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5">
                          {s.donations.map(d => (
                            <span key={d.id} className="text-[10px] text-muted-foreground font-mono">
                              {d.vekalet || "—"}
                              {d.donationType && <span className="font-sans ml-0.5 not-italic">{d.donationType}</span>}
                              {d.shareCount > 1 && <span className="font-sans ml-0.5">{d.shareCount}h</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="flex-shrink-0 text-xs font-semibold tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {s.extraCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Destination: existing list */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ListPlus className="w-3.5 h-3.5" />
              Mevcut listeye aktar
            </label>
            <div className="flex gap-1.5">
              <Select value={transferTarget} onValueChange={(v) => { setTransferTarget(v); setCreatingNewList(false); }}>
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="Kesim listesi seçin…" />
                </SelectTrigger>
                <SelectContent>
                  {kaList.map((ka) => (
                    <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground" onClick={refetchKA} title="Listeyi yenile">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">veya</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Destination: new list */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FolderPlus className="w-3.5 h-3.5" />
              Yeni liste oluştur
            </label>
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

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex gap-2.5">
          <Button variant="outline" className="flex-1 h-10" onClick={handleClose}>
            İptal
          </Button>
          <Button
            className="flex-[2] h-10 font-semibold"
            onClick={handleTransfer}
            disabled={!canTransfer}
          >
            {transferring
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Aktarılıyor…</>
              : <><ArrowRightLeft className="w-4 h-4 mr-2" />{totalToTransfer} Bağışı Aktar</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
