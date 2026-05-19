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

const COLS = [
  { key: "vekalet",     label: "Vekalet",     width: "w-24"  },
  { key: "description", label: "Adına Kesilen", width: "w-40" },
  { key: "donationType",label: "Cins",         width: "w-24"  },
  { key: "shareCount",  label: "Hisse",        width: "w-14"  },
  { key: "birim",       label: "Birim",        width: "w-24"  },
  { key: "temsilci",    label: "Temsilci",     width: "w-28"  },
  { key: "ozellik",     label: "Özellik",      width: "w-24"  },
  { key: "fiyat",       label: "Fiyat",        width: "w-20"  },
  { key: "notes",       label: "Not",          width: "flex-1 min-w-[80px]" },
] as const;

function cell(val: string | number | null | undefined) {
  return val ? String(val) : <span className="text-muted-foreground/40">—</span>;
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

  const hasSiblings = !loadingSiblings && siblings.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-[95vw] w-full flex flex-col" style={{ maxHeight: "92vh", height: hasSiblings ? "92vh" : "auto" }}>

        {/* Header */}
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
            </span>
            Kesim Listesine Aktar
          </DialogTitle>
        </DialogHeader>

        {/* Summary line */}
        <div className="flex items-center gap-2 flex-wrap text-sm flex-shrink-0 -mt-1">
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

        {/* Siblings table — takes all available height */}
        {hasSiblings && (
          <div className="flex-1 min-h-0 flex flex-col rounded-lg border overflow-hidden">
            {/* Table header */}
            <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/50">
              {/* Select-all row */}
              <div className="flex items-center justify-between px-3 py-2">
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
                <span className="text-xs text-muted-foreground tabular-nums">{selectedDonors.size}/{siblings.length} kişi seçili</span>
              </div>
              {/* Column headers */}
              <div className="flex items-center gap-0 px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-t border-amber-100/60 dark:border-amber-900/30 pt-1.5">
                <span className="w-7 flex-shrink-0" />
                <span className="w-36 flex-shrink-0 pr-2">Vekalet Veren</span>
                {COLS.map(c => (
                  <span key={c.key} className={`${c.width} flex-shrink-0 pr-2 truncate`}>{c.label}</span>
                ))}
              </div>
            </div>

            {/* Scrollable rows */}
            <div className="flex-1 overflow-y-auto divide-y">
              {siblings.map(s => {
                const checked = selectedDonors.has(s.donorName);
                return (
                  <div key={s.donorName} className={`${checked ? "bg-primary/5" : ""}`}>
                    {/* Group toggle row */}
                    <button
                      className={`flex items-center gap-0 w-full px-3 py-2 text-left transition-colors hover:bg-muted/40 border-b border-dashed border-muted/40`}
                      onClick={() => toggleDonor(s.donorName)}
                    >
                      <span className={`w-7 flex-shrink-0 flex items-center justify-center`}>
                        <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? "bg-primary border-primary" : "border-input"}`}>
                          {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </span>
                      </span>
                      <span className="w-36 flex-shrink-0 pr-2 font-semibold text-sm truncate">{s.donorName}</span>
                      <span className="text-xs text-muted-foreground">{s.extraCount} bağış</span>
                      <span className="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400 tabular-nums pr-1">+{s.extraCount}</span>
                    </button>

                    {/* Per-donation rows */}
                    {s.donations.map((d, i) => (
                      <div
                        key={d.id}
                        className={`flex items-center gap-0 px-3 py-1.5 text-xs ${i % 2 === 0 ? "bg-muted/10" : ""} ${checked ? "opacity-100" : "opacity-50"}`}
                      >
                        <span className="w-7 flex-shrink-0" />
                        {/* Vekalet Veren (name) */}
                        <span className="w-36 flex-shrink-0 pr-2 font-mono text-[11px] text-muted-foreground truncate">{d.name || "—"}</span>
                        {/* Vekalet */}
                        <span className="w-24 flex-shrink-0 pr-2 font-mono text-[11px] truncate">{cell(d.vekalet)}</span>
                        {/* Adına Kesilen */}
                        <span className="w-40 flex-shrink-0 pr-2 truncate">{cell(d.description)}</span>
                        {/* Cins */}
                        <span className="w-24 flex-shrink-0 pr-2 truncate">{cell(d.donationType)}</span>
                        {/* Hisse */}
                        <span className="w-14 flex-shrink-0 pr-2 tabular-nums">{d.shareCount > 1 ? <strong>{d.shareCount}</strong> : cell(d.shareCount)}</span>
                        {/* Birim */}
                        <span className="w-24 flex-shrink-0 pr-2 truncate">{cell(d.birim)}</span>
                        {/* Temsilci */}
                        <span className="w-28 flex-shrink-0 pr-2 truncate">{cell(d.temsilci)}</span>
                        {/* Özellik */}
                        <span className="w-24 flex-shrink-0 pr-2 truncate">{cell(d.ozellik)}</span>
                        {/* Fiyat */}
                        <span className="w-20 flex-shrink-0 pr-2 tabular-nums">{d.fiyat ? `₺${d.fiyat}` : <span className="text-muted-foreground/40">—</span>}</span>
                        {/* Not */}
                        <span className="flex-1 min-w-[80px] truncate text-muted-foreground">{cell(d.notes)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Destination + Actions */}
        <div className="flex-shrink-0 space-y-3 pt-1">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {/* Mevcut liste */}
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

            {/* veya */}
            <div className="flex flex-col items-center gap-1 pt-5">
              <div className="h-8 w-px bg-border" />
              <span className="text-xs text-muted-foreground">veya</span>
              <div className="h-8 w-px bg-border" />
            </div>

            {/* Yeni liste */}
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
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>İptal</Button>
            <Button className="flex-[2]" onClick={handleTransfer} disabled={!canTransfer}>
              {transferring
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Aktarılıyor…</>
                : <><ArrowRightLeft className="h-4 w-4 mr-2" />{totalToTransfer} Bağışı Aktar</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
