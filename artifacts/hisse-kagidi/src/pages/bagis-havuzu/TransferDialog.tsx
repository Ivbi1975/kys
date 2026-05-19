import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Loader2, RefreshCw, Check, Square, CheckSquare, FolderOpen, FolderPlus } from "lucide-react";
import { fetchPoolDonations, fetchDonationSiblings } from "@/lib/api";
import type { DonorSiblings, SiblingDonation } from "@/lib/api/bagis-havuzu";

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

const COLS: { key: keyof SiblingDonation | "fiyatFmt"; label: string; cls: string }[] = [
  { key: "vekalet",      label: "Vekalet",       cls: "w-32 flex-shrink-0" },
  { key: "description",  label: "Adına Kesilen",  cls: "w-52 flex-shrink-0" },
  { key: "donationType", label: "Cins",           cls: "w-28 flex-shrink-0" },
  { key: "shareCount",   label: "Hisse",          cls: "w-16 flex-shrink-0 text-center" },
  { key: "birim",        label: "Birim",          cls: "w-28 flex-shrink-0" },
  { key: "temsilci",     label: "Temsilci",       cls: "w-32 flex-shrink-0" },
  { key: "ozellik",      label: "Özellik",        cls: "w-28 flex-shrink-0" },
  { key: "fiyatFmt",     label: "Fiyat",          cls: "w-24 flex-shrink-0 text-right" },
  { key: "notes",        label: "Not",            cls: "flex-1 min-w-[100px]" },
];

function empty(val: string | number | null | undefined) {
  return val === null || val === undefined || val === "" || val === 0;
}
function Cell({ val, mono, right }: { val: string | number | null | undefined; mono?: boolean; right?: boolean }) {
  if (empty(val)) return <span className="text-muted-foreground/35 select-none">—</span>;
  return <span className={`${mono ? "font-mono" : ""} ${right ? "tabular-nums" : ""}`}>{String(val)}</span>;
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

  function getColVal(d: SiblingDonation, key: string): string | number | null | undefined {
    if (key === "fiyatFmt") return d.fiyat ? `₺${d.fiyat}` : null;
    return (d as unknown as Record<string, unknown>)[key] as string | number | null | undefined;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent
        className="max-w-[95vw] w-full flex flex-col gap-3"
        style={{ maxHeight: "92vh", height: hasSiblings ? "92vh" : "auto" }}
      >

        {/* Header */}
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
            </span>
            Kesim Listesine Aktar
          </DialogTitle>
        </DialogHeader>

        {/* Summary line */}
        <div className="flex items-center gap-2 flex-wrap text-sm flex-shrink-0 -mt-1">
          <span className="font-bold text-base">{selectedCount}</span>
          <span className="text-muted-foreground">seçili bağış</span>
          {loadingSiblings && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <Loader2 className="h-3 w-3 animate-spin" />kontrol ediliyor…
            </span>
          )}
          {!loadingSiblings && selectedExtraCount > 0 && (
            <>
              <span className="text-muted-foreground font-bold">+</span>
              <span className="font-bold text-base text-amber-600 dark:text-amber-400">{selectedExtraCount}</span>
              <span className="text-muted-foreground">ek bağış</span>
              <span className="text-muted-foreground font-bold">=</span>
              <span className="font-bold text-base text-primary">{totalToTransfer} toplam</span>
            </>
          )}
        </div>

        {/* Siblings table — flex-1 to fill modal height */}
        {hasSiblings && (
          <div className="flex-1 min-h-0 flex flex-col rounded-lg border overflow-hidden">

            {/* Toolbar row */}
            <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/60 px-3 py-2 flex items-center justify-between gap-4">
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200 hover:opacity-75 transition-opacity"
              >
                {allSelected
                  ? <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
                  : selectedDonors.size === 0
                    ? <Square className="h-4 w-4 flex-shrink-0" />
                    : <CheckSquare className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />}
                {totalExtraCount} ek bağış — {allSelected ? "Tümünü kaldır" : "Tümünü seç"}
              </button>
              <span className="text-sm font-medium text-muted-foreground tabular-nums">{selectedDonors.size}/{siblings.length} kişi seçili</span>
            </div>

            {/* Column header */}
            <div className="flex-shrink-0 flex items-center gap-0 px-3 py-2 bg-muted/40 border-b text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span className="w-7 flex-shrink-0" />
              {COLS.map(c => (
                <span key={c.key} className={`${c.cls} pr-3 truncate`}>{c.label}</span>
              ))}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {siblings.map(s => {
                const checked = selectedDonors.has(s.donorName);
                return (
                  <div key={s.donorName} className={checked ? "bg-primary/[0.04]" : ""}>

                    {/* Group header row — full name, no truncate */}
                    <button
                      className="flex items-center gap-0 w-full px-3 py-2.5 text-left border-b transition-colors hover:bg-muted/30"
                      onClick={() => toggleDonor(s.donorName)}
                    >
                      <span className="w-7 flex-shrink-0 flex items-center justify-center">
                        <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors flex-shrink-0 ${checked ? "bg-primary border-primary" : "border-input"}`}>
                          {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </span>
                      </span>
                      <span className="font-bold text-sm pr-3 leading-snug">{s.donorName}</span>
                      <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">{s.extraCount} bağış</span>
                      <span className="ml-auto text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums pl-3 whitespace-nowrap">+{s.extraCount}</span>
                    </button>

                    {/* Per-donation rows */}
                    {s.donations.map((d, i) => (
                      <div
                        key={d.id}
                        className={`flex items-center gap-0 px-3 py-2 border-b border-dashed border-muted/50 text-sm ${i % 2 === 0 ? "bg-muted/[0.06]" : ""} ${checked ? "" : "opacity-40"}`}
                      >
                        <span className="w-7 flex-shrink-0" />
                        {COLS.map(c => {
                          const val = getColVal(d, c.key);
                          const isMono = c.key === "vekalet";
                          const isEmpty = !val && val !== 0;
                          return (
                            <span
                              key={c.key}
                              className={`${c.cls} pr-3 truncate font-medium ${isMono ? "font-mono text-xs" : ""}`}
                              title={isEmpty ? undefined : String(val)}
                            >
                              {isEmpty
                                ? <span className="text-muted-foreground/30 select-none">—</span>
                                : <span>{String(val)}</span>
                              }
                            </span>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Destination + Actions */}
        <div className="flex-shrink-0 space-y-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {/* Mevcut liste */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />Mevcut listeye aktar
              </p>
              <div className="flex gap-1.5">
                <Select value={transferTarget} onValueChange={(v) => { setTransferTarget(v); setCreatingNewList(false); }}>
                  <SelectTrigger className="flex-1 font-medium"><SelectValue placeholder="Kesim listesi seçin…" /></SelectTrigger>
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
              <span className="text-xs font-medium text-muted-foreground">veya</span>
              <div className="h-8 w-px bg-border" />
            </div>

            {/* Yeni liste */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
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
                className="h-10 font-medium"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 font-semibold" onClick={handleClose}>İptal</Button>
            <Button className="flex-[2] font-bold text-base" onClick={handleTransfer} disabled={!canTransfer}>
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
