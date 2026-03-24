import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Search,
  Users,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
  Scissors,
  MoveRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchCatismaTespiti,
  transferDonation,
  fetchKesimAlanlari,
} from "@/lib/api";
import type { Conflict, ConflictEntry } from "@/lib/api";
import type { KesimAlani } from "@/lib/types";

export default function CatismaTespitiPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [totalConflicts, setTotalConflicts] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [kesimAlanlari, setKesimAlanlari] = useState<KesimAlani[]>([]);

  const [transferDialog, setTransferDialog] = useState<{
    entry: ConflictEntry;
    conflict: Conflict;
  } | null>(null);
  const [targetKesimAlaniId, setTargetKesimAlaniId] = useState("");
  const [transferAnimal, setTransferAnimal] = useState(false);
  const [transferring, setTransferring] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [result, kaList] = await Promise.all([
        fetchCatismaTespiti(),
        fetchKesimAlanlari(),
      ]);
      setConflicts(result.conflicts);
      setTotalConflicts(result.totalConflicts);
      setKesimAlanlari(kaList);
    } catch (err) {
      toast({
        title: "Veri yüklenemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleExpand(key: string) {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const filteredConflicts = conflicts.filter(c => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.entries.some(e =>
        e.kesimAlaniName.toLowerCase().includes(q) ||
        e.donationDescription.toLowerCase().includes(q)
      )
    );
  });

  function openTransferDialog(entry: ConflictEntry, conflict: Conflict) {
    setTransferDialog({ entry, conflict });
    setTargetKesimAlaniId("");
    setTransferAnimal(false);
  }

  async function executeTransfer() {
    if (!transferDialog || !targetKesimAlaniId) return;
    setTransferring(true);
    try {
      const { entry } = transferDialog;
      await transferDonation({
        donationId: entry.donationId,
        sourceKesimAlaniId: entry.kesimAlaniId,
        targetKesimAlaniId,
        transferAnimal: transferAnimal && !!entry.animalGroupId,
        animalGroupId: entry.animalGroupId ?? undefined,
      });
      toast({ title: "Taşıma başarılı", description: `${entry.donationName} başarıyla taşındı.` });
      setTransferDialog(null);
      await loadData();
    } catch (err) {
      toast({
        title: "Taşıma hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setTransferring(false);
    }
  }

  const getConflictSeverity = (c: Conflict) => {
    if (c.kesimAlanCount > 1 && c.hasNoteWarnings) return "critical";
    if (c.kesimAlanCount > 1) return "high";
    if (c.hasNoteWarnings) return "warning";
    if (c.totalEntries > 2) return "medium";
    return "low";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Scissors className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Çatışmalar taranıyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              Çatışma Tespiti
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Tüm kesim alanları taranarak aynı isimli bağışçılar listelendi
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Yenile
          </Button>
        </div>

        {totalConflicts === 0 ? (
          <Card className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Çatışma Bulunamadı</h2>
            <p className="text-muted-foreground">
              Tüm kesim alanlarındaki bağışçılar incelendi. Tekrarlanan isim tespit edilmedi.
            </p>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Bağışçı adı veya kesim alanı ara..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{filteredConflicts.length} çatışma</span>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1 px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                Farklı kesim alanlarında + not sorunu
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Farklı kesim alanlarında
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                Notlarda sorun işareti
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                Aynı alanda birden fazla
              </span>
            </div>

            <div className="space-y-3">
              {filteredConflicts.map(conflict => {
                const severity = getConflictSeverity(conflict);
                const isExpanded = expandedKeys.has(conflict.key);
                return (
                  <Card key={conflict.key} className={`overflow-hidden border-l-4 ${
                    severity === "critical"
                      ? "border-l-red-600"
                      : severity === "high"
                      ? "border-l-red-500"
                      : severity === "warning"
                      ? "border-l-orange-500"
                      : severity === "medium"
                      ? "border-l-amber-500"
                      : "border-l-blue-400"
                  }`}>
                    <div
                      className="p-4 cursor-pointer flex items-center gap-3"
                      onClick={() => toggleExpand(conflict.key)}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        severity === "critical"
                          ? "bg-red-600"
                          : severity === "high"
                          ? "bg-red-500"
                          : severity === "warning"
                          ? "bg-orange-500"
                          : severity === "medium"
                          ? "bg-amber-500"
                          : "bg-blue-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          {conflict.displayName}
                          {conflict.matchField === "description" && (
                            <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                              Açıklama eşleşmesi
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          {conflict.kesimAlanCount > 1 ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              {conflict.kesimAlanCount} farklı kesim alanında
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Aynı kesim alanında
                            </span>
                          )}
                          · {conflict.totalEntries} kayıt
                          {conflict.hasNoteWarnings && (
                            <span className="text-orange-600 dark:text-orange-400 font-medium flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              Not uyarısı
                            </span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/20">
                        {conflict.entries.map((entry, idx) => (
                          <div
                            key={`${entry.donationId}-${entry.animalGroupId ?? "nogroup"}-${idx}`}
                            className="p-4 border-b last:border-b-0"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                                    {entry.kesimAlaniName}
                                  </span>
                                  {entry.animalGroupId && entry.animalGroupNo != null && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                      Hayvan #{entry.animalGroupNo}
                                    </span>
                                  )}
                                </div>
                                {entry.donationDescription && (
                                  <p className="text-sm text-foreground mt-1">
                                    <span className="text-muted-foreground">Vekaleti veren:</span> {entry.donationDescription}
                                  </p>
                                )}
                                {entry.donationNotes && (
                                  <p className={`text-xs mt-1 italic ${entry.hasNoteWarning ? "text-orange-600 dark:text-orange-400 font-medium" : "text-muted-foreground"}`}>
                                    {entry.hasNoteWarning && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                                    Not: {entry.donationNotes}
                                  </p>
                                )}

                                {entry.siblingsInGroup.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                      {entry.animalGroupId ? "Aynı hayvandaki diğer kişiler:" : "Diğer bağışçılar:"}
                                    </p>
                                    <div className="space-y-1">
                                      {entry.siblingsInGroup.slice(0, 5).map(sib => (
                                        <div key={sib.donationId} className="text-xs bg-background rounded px-2 py-1 border">
                                          <span className="font-medium">{sib.donationName || "—"}</span>
                                          {sib.donationDescription && (
                                            <span className="text-muted-foreground"> · {sib.donationDescription}</span>
                                          )}
                                          {sib.donationNotes && (
                                            <span className="text-amber-600 dark:text-amber-400"> · {sib.donationNotes}</span>
                                          )}
                                        </div>
                                      ))}
                                      {entry.siblingsInGroup.length > 5 && (
                                        <p className="text-xs text-muted-foreground">
                                          +{entry.siblingsInGroup.length - 5} kişi daha...
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-shrink-0"
                                onClick={() => openTransferDialog(entry, conflict)}
                              >
                                <MoveRight className="w-3.5 h-3.5 mr-1" />
                                Taşı
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Dialog open={transferDialog !== null} onOpenChange={open => { if (!open) setTransferDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bağışçı Taşı</DialogTitle>
          </DialogHeader>
          {transferDialog && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-semibold">{transferDialog.entry.donationName}</p>
                {transferDialog.entry.donationDescription && (
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {transferDialog.entry.donationDescription}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">
                    {transferDialog.entry.kesimAlaniName}
                  </span>
                  {transferDialog.entry.animalGroupId && transferDialog.entry.animalGroupNo != null && (
                    <span className="text-muted-foreground">Hayvan #{transferDialog.entry.animalGroupNo}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Hedef Kesim Alanı</label>
                <Select value={targetKesimAlaniId} onValueChange={setTargetKesimAlaniId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kesim alanı seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {kesimAlanlari
                      .filter(k => k.id !== transferDialog.entry.kesimAlaniId)
                      .map(k => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {transferDialog.entry.animalGroupId && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Taşıma Kapsamı</label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="transferScope"
                        checked={!transferAnimal}
                        onChange={() => setTransferAnimal(false)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">Sadece bu bağışçıyı taşı</p>
                        <p className="text-xs text-muted-foreground">
                          Bağışçı hayvan grubundan çıkarılır ve hedef kesim alanına eklenir.
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="transferScope"
                        checked={transferAnimal}
                        onChange={() => setTransferAnimal(true)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">Tüm hayvanı taşı</p>
                        <p className="text-xs text-muted-foreground">
                          Hayvan #{transferDialog.entry.animalGroupNo} ve içindeki{" "}
                          {(transferDialog.entry.siblingsInGroup.length + 1)} kişi birlikte taşınır.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {targetKesimAlaniId && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-blue-700 dark:text-blue-300 mb-1">
                    <ArrowRight className="w-4 h-4" />
                    Taşıma Özeti
                  </div>
                  {transferAnimal && transferDialog.entry.animalGroupId ? (
                    <p className="text-muted-foreground text-xs">
                      Hayvan #{transferDialog.entry.animalGroupNo} ({transferDialog.entry.siblingsInGroup.length + 1} kişi){" "}
                      <strong>{transferDialog.entry.kesimAlaniName}</strong>&apos;dan{" "}
                      <strong>{kesimAlanlari.find(k => k.id === targetKesimAlaniId)?.name}</strong>&apos;a taşınacak.
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      <strong>{transferDialog.entry.donationName}</strong>{" "}
                      <strong>{transferDialog.entry.kesimAlaniName}</strong>&apos;dan{" "}
                      <strong>{kesimAlanlari.find(k => k.id === targetKesimAlaniId)?.name}</strong>&apos;a taşınacak.
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setTransferDialog(null)}
                  disabled={transferring}
                >
                  İptal
                </Button>
                <Button
                  className="flex-1"
                  disabled={!targetKesimAlaniId || transferring}
                  onClick={executeTransfer}
                >
                  {transferring ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Taşınıyor...
                    </>
                  ) : (
                    <>
                      <MoveRight className="w-4 h-4 mr-1" />
                      Taşı
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
