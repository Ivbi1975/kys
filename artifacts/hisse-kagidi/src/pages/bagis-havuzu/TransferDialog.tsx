import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Loader2, RefreshCw, Check, Square, CheckSquare } from "lucide-react";
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

  // Fetch siblings eagerly when dialog opens
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

  // Reset when closed
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
  const totalExtraCount = siblings.reduce((sum, s) => sum + s.extraCount, 0);
  const allSelected = siblings.length > 0 && selectedDonors.size === siblings.length;

  const handleTransfer = useCallback(() => {
    onTransfer(selectedExtraIds);
  }, [selectedExtraIds, onTransfer]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setNewListName("");
    setCreatingNewList(false);
    setTransferTarget("");
  }, [onOpenChange, setNewListName, setCreatingNewList, setTransferTarget]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kesim Listesine Aktar</DialogTitle>
        </DialogHeader>

        {/* Summary line */}
        <p className="text-sm text-muted-foreground -mt-1">
          <strong className="text-foreground">{selectedCount}</strong> seçili bağış
          {selectedExtraCount > 0 && (
            <> + <strong className="text-foreground">{selectedExtraCount}</strong> ek bağış</>
          )}
          {" "}<span className="text-muted-foreground">aktarılacak.</span>
        </p>

        {/* Siblings section */}
        {loadingSiblings && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Ek bağışlar kontrol ediliyor...
          </div>
        )}

        {!loadingSiblings && siblings.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            {/* Header row with toggle-all */}
            <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                  {allSelected
                    ? <CheckSquare className="w-4 h-4 text-primary" />
                    : selectedDonors.size === 0
                      ? <Square className="w-4 h-4" />
                      : <CheckSquare className="w-4 h-4 text-muted-foreground/50" />}
                </button>
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  {totalExtraCount} ek bağış — eklemek istediklerinizi seçin
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{selectedDonors.size}/{siblings.length}</span>
            </div>

            {/* Donor rows */}
            <div className="max-h-40 overflow-y-auto divide-y">
              {siblings.map(s => {
                const checked = selectedDonors.has(s.donorName);
                return (
                  <button
                    key={s.donorName}
                    className={`flex items-start gap-2.5 w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40 ${checked ? "bg-primary/5" : ""}`}
                    onClick={() => toggleDonor(s.donorName)}
                  >
                    <span className={`mt-0.5 flex-shrink-0 w-4 h-4 border rounded flex items-center justify-center ${checked ? "bg-primary border-primary text-primary-foreground" : "border-input"}`}>
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm truncate block">{s.donorName}</span>
                      <div className="flex flex-wrap gap-x-2 mt-0.5">
                        {s.donations.map(d => (
                          <span key={d.id} className="text-[10px] text-muted-foreground">
                            <span className="font-mono">{d.vekalet || "—"}</span>
                            {d.donationType && <span className="ml-1">{d.donationType}</span>}
                            {d.shareCount > 1 && <span className="ml-1">{d.shareCount}h</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-1 mt-0.5">{s.extraCount}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* List selection */}
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
            <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0" onClick={refetchKA} title="Listeyi yenile">
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
            onChange={(e) => {
              setNewListName(e.target.value);
              if (e.target.value) { setTransferTarget(""); setCreatingNewList(true); }
              else { setCreatingNewList(false); }
            }}
            className="h-9"
          />
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={handleClose}>İptal</Button>
          <Button
            className="flex-1"
            onClick={handleTransfer}
            disabled={(!transferTarget && !creatingNewList) || transferring || loadingSiblings || (creatingNewList && !newListName.trim())}
          >
            {transferring ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-1" />}
            Aktar ({selectedCount + selectedExtraCount})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
