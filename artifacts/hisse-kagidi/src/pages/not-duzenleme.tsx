import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Search,
  Replace,
  Trash2,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  Square,
  Settings2,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import type { AiClassificationResult } from "@/lib/api";
import {
  fetchKesimAlani,
  bulkUpdateNotes,
  classifyNotes,
  saveAiClassifications,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LocalDonation {
  id: string;
  name: string;
  description: string;
  donationType: string;
  vekalet: string;
  notes: string;
}

interface AiResult extends AiClassificationResult {
  donationType?: string;
}

export default function NotDuzenlemePage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const [donations, setDonations] = useState<LocalDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplaceBar, setShowReplaceBar] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [aiRunning, setAiRunning] = useState(false);
  const [aiStopped, setAiStopped] = useState(false);
  const aiStopRef = useRef(false);
  const [aiResults, setAiResults] = useState<Map<string, AiResult>>(new Map());
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [batchSize, setBatchSize] = useState(25);
  const [maxCount, setMaxCount] = useState<"all" | number>("all");
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!params.id) return;
    fetchKesimAlani(params.id).then((data) => {
      if (!data) {
        toast({ title: "Hata", description: "Kesim alanı bulunamadı", variant: "destructive" });
        setLocation("/");
        return;
      }
      setKesim(data);
      const allDonations: LocalDonation[] = [];
      for (const d of data.donations) {
        if (!allDonations.find(x => x.id === d.id)) {
          allDonations.push({ id: d.id, name: d.name, description: d.description, donationType: d.donationType, vekalet: d.vekalet, notes: d.notes });
        }
      }
      for (const g of data.animalGroups) {
        for (const d of g.donations) {
          if (!allDonations.find(x => x.id === d.id)) {
            allDonations.push({ id: d.id, name: d.name, description: d.description, donationType: d.donationType, vekalet: d.vekalet, notes: d.notes });
          }
        }
      }
      setDonations(allDonations);
      setLoading(false);
    });
  }, [params.id]);

  const filteredDonations = donations.filter(d => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.notes.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );
  });

  const handleNoteChange = (id: string, value: string) => {
    setDonations(prev => prev.map(d => d.id === id ? { ...d, notes: value } : d));
    setDirty(true);
  };

  const handleBulkReplace = () => {
    if (!findText.trim()) return;
    let count = 0;
    setDonations(prev => prev.map(d => {
      if (d.notes.includes(findText)) {
        count++;
        return { ...d, notes: d.notes.replaceAll(findText, replaceText) };
      }
      return d;
    }));
    if (count > 0) {
      setDirty(true);
      toast({ title: "Değiştirildi", description: `${count} bağışçıda "${findText}" → "${replaceText}" değiştirildi` });
    } else {
      toast({ title: "Bulunamadı", description: `"${findText}" metni hiçbir notta bulunamadı` });
    }
  };

  const handleBulkDeleteNotes = () => {
    const targets = filteredDonations.filter(d => d.notes.trim() !== "");
    if (targets.length === 0) {
      toast({ title: "Silinecek not yok" });
      return;
    }
    setDeleteConfirmOpen(true);
  };

  const confirmBulkDeleteNotes = () => {
    const targetIds = new Set(filteredDonations.map(d => d.id));
    setDonations(prev => prev.map(d => targetIds.has(d.id) ? { ...d, notes: "" } : d));
    setDirty(true);
    toast({ title: "Notlar silindi", description: `${targetIds.size} bağışçının notu temizlendi` });
  };

  const handleSave = async () => {
    if (!kesim) return;
    setSaving(true);
    try {
      const updates = donations
        .filter(d => {
          const orig = kesim.donations.find(x => x.id === d.id) ||
            kesim.animalGroups.flatMap(g => g.donations).find(x => x.id === d.id);
          return orig && orig.notes !== d.notes;
        })
        .map(d => ({ donationId: d.id, notes: d.notes }));

      if (updates.length === 0) {
        toast({ title: "Değişiklik yok" });
        setSaving(false);
        setDirty(false);
        return;
      }

      await bulkUpdateNotes(kesim.id, updates);
      setDirty(false);
      toast({ title: "Kaydedildi", description: `${updates.length} bağışçının notu güncellendi` });
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Kaydetme hatası", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startAiClassification = async () => {
    if (!kesim) return;
    aiStopRef.current = false;
    setAiRunning(true);
    setAiStopped(false);
    setAiResults(new Map());

    const toProcess = maxCount === "all" ? donations : donations.slice(0, maxCount);
    const withNotes = toProcess.filter(d => d.notes.trim() !== "");

    if (withNotes.length === 0) {
      toast({ title: "İşlenecek not yok", description: "Notu olan bağışçı bulunamadı" });
      setAiRunning(false);
      return;
    }

    setAiProgress({ done: 0, total: withNotes.length });

    const batches: LocalDonation[][] = [];
    for (let i = 0; i < withNotes.length; i += batchSize) {
      batches.push(withNotes.slice(i, i + batchSize));
    }

    let done = 0;
    for (const batch of batches) {
      if (aiStopRef.current) {
        setAiStopped(true);
        break;
      }

      try {
        const { results } = await classifyNotes(batch.map(d => ({
          id: d.id,
          name: d.name || d.description,
          donationType: d.donationType,
          vekalet: d.vekalet,
          notes: d.notes,
        })));

        setAiResults(prev => {
          const next = new Map(prev);
          for (const r of results) {
            next.set(r.donationId, { ...r, donationType: batch.find(d => d.id === r.donationId)?.donationType });
          }
          return next;
        });

        try {
          await saveAiClassifications(results.map(r => ({
            donationId: r.donationId,
            categories: r.categories || [],
            warnings: r.warnings || "",
          })));
        } catch {
        }

        done += batch.length;
        setAiProgress({ done, total: withNotes.length });

        if (batch !== batches[batches.length - 1] && !aiStopRef.current) {
          await new Promise(res => setTimeout(res, 1000));
        }
      } catch (err) {
        toast({ title: "AI Hatası", description: err instanceof Error ? err.message : "Sınıflandırma hatası", variant: "destructive" });
        break;
      }
    }

    setAiRunning(false);
  };

  const stopAiClassification = () => {
    aiStopRef.current = true;
    setAiStopped(true);
  };

  const toggleExpandResult = (id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const notesWithContent = donations.filter(d => d.notes.trim() !== "");
  const resultsCount = aiResults.size;
  const warningsCount = Array.from(aiResults.values()).filter(r => r.warnings && r.warnings.trim() !== "").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center gap-3 p-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation(`/kesim/${params.id}`)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">Not Düzenleme</h1>
            <p className="text-xs text-muted-foreground truncate">{kesim?.name} — {donations.length} bağışçı, {notesWithContent.length} notu olan</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/ai-prompt-ayarlari`)}
            >
              <Settings2 className="w-4 h-4 mr-1" />
              AI Ayarları
            </Button>
            {dirty && (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Kaydet
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto">
        <Tabs defaultValue="notes">
          <TabsList className="mb-4">
            <TabsTrigger value="notes">
              Not Düzenleme
              {notesWithContent.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">{notesWithContent.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ai">
              AI Sınıflandırma
              {resultsCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">{resultsCount}</Badge>
              )}
              {warningsCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">{warningsCount} uyarı</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="space-y-4">
            <Card className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Notlarda ara..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReplaceBar(!showReplaceBar)}
                >
                  <Replace className="w-4 h-4 mr-1" />
                  Değiştir
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDeleteNotes}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Notları Sil
                </Button>
              </div>

              {showReplaceBar && (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    placeholder="Bul..."
                    value={findText}
                    onChange={e => setFindText(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Değiştir..."
                    value={replaceText}
                    onChange={e => setReplaceText(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleBulkReplace}>
                    Tümünü Değiştir
                  </Button>
                </div>
              )}
            </Card>

            <div className="text-xs text-muted-foreground">
              {filteredDonations.length} bağışçı gösteriliyor
              {searchQuery && ` ("${searchQuery}" araması)`}
            </div>

            <div className="space-y-2">
              {filteredDonations.map(d => (
                <Card key={d.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium truncate">{d.description || d.name || "(İsimsiz)"}</span>
                        {d.donationType && (
                          <Badge variant="outline" className="text-xs shrink-0">{d.donationType}</Badge>
                        )}
                        {d.vekalet && (
                          <span className="text-xs text-muted-foreground shrink-0">No: {d.vekalet}</span>
                        )}
                      </div>
                      <Textarea
                        value={d.notes}
                        onChange={e => handleNoteChange(d.id, e.target.value)}
                        placeholder="Not yok..."
                        className="text-sm min-h-[60px] resize-none"
                        rows={2}
                      />
                    </div>
                    {d.notes.trim() !== "" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive shrink-0 mt-6"
                        onClick={() => handleNoteChange(d.id, "")}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}

              {filteredDonations.length === 0 && (
                <div className="text-center text-muted-foreground py-12 text-sm">
                  {searchQuery ? "Arama sonucu bulunamadı" : "Bağışçı yok"}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <Card className="p-4 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                AI Sınıflandırma Ayarları
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Kaç not işlensin?</label>
                  <Select
                    value={maxCount === "all" ? "all" : String(maxCount)}
                    onValueChange={v => setMaxCount(v === "all" ? "all" : parseInt(v))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tümü ({notesWithContent.length} not)</SelectItem>
                      <SelectItem value="10">İlk 10</SelectItem>
                      <SelectItem value="25">İlk 25</SelectItem>
                      <SelectItem value="50">İlk 50</SelectItem>
                      <SelectItem value="100">İlk 100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Her istekte kaç not?</label>
                  <Select
                    value={String(batchSize)}
                    onValueChange={v => setBatchSize(parseInt(v))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 not/istek</SelectItem>
                      <SelectItem value="10">10 not/istek</SelectItem>
                      <SelectItem value="25">25 not/istek (varsayılan)</SelectItem>
                      <SelectItem value="50">50 not/istek</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!aiRunning ? (
                  <Button onClick={startAiClassification} disabled={notesWithContent.length === 0}>
                    <Play className="w-4 h-4 mr-2" />
                    Başlat
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={stopAiClassification}>
                    <Square className="w-4 h-4 mr-2" />
                    Durdur
                  </Button>
                )}

                {(aiRunning || aiProgress.total > 0) && (
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        {aiRunning ? "İşleniyor..." : aiStopped ? "Durduruldu" : "Tamamlandı"}
                      </span>
                      <span className="text-xs font-medium">{aiProgress.done} / {aiProgress.total}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: aiProgress.total > 0 ? `${(aiProgress.done / aiProgress.total) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {notesWithContent.length === 0 && (
                <p className="text-sm text-muted-foreground">Notu olan bağışçı bulunamadı.</p>
              )}
            </Card>

            {aiResults.size > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Sınıflandırma Sonuçları</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{resultsCount} bağışçı analiz edildi</span>
                    {warningsCount > 0 && (
                      <Badge variant="destructive" className="text-xs">{warningsCount} uyarı</Badge>
                    )}
                  </div>
                </div>

                {donations.filter(d => aiResults.has(d.id)).map(d => {
                  const result = aiResults.get(d.id)!;
                  const hasWarning = result.warnings && result.warnings.trim() !== "";
                  const isExpanded = expandedResults.has(d.id);

                  return (
                    <Card
                      key={d.id}
                      className={`overflow-hidden transition-colors ${hasWarning ? "border-destructive/40 bg-destructive/5" : ""}`}
                    >
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpandResult(d.id)}
                      >
                        <div className="shrink-0">
                          {hasWarning ? (
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{d.description || d.name || "(İsimsiz)"}</span>
                            {d.donationType && (
                              <Badge variant="outline" className="text-xs shrink-0">{d.donationType}</Badge>
                            )}
                          </div>
                          {result.summary && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{result.summary}</p>
                          )}
                          {result.categories && result.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {result.categories.map(cat => (
                                <Badge key={cat} variant="secondary" className="text-xs">{cat.replace(/_/g, " ")}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-muted-foreground">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t px-3 pb-3 space-y-2 pt-2">
                          <div>
                            <span className="text-xs font-semibold text-muted-foreground">Orijinal Not:</span>
                            <p className="text-sm mt-1 bg-muted rounded p-2">{d.notes || "(Boş)"}</p>
                          </div>
                          {result.requests && result.requests.trim() !== "" && (
                            <div>
                              <span className="text-xs font-semibold text-blue-600">Tespit Edilen İstekler:</span>
                              <p className="text-sm mt-1">{result.requests}</p>
                            </div>
                          )}
                          {hasWarning && (
                            <div className="bg-destructive/10 rounded p-2 border border-destructive/20">
                              <span className="text-xs font-semibold text-destructive flex items-center gap-1 mb-1">
                                <AlertTriangle className="w-3 h-3" />
                                Uyarı:
                              </span>
                              <p className="text-sm text-destructive">{result.warnings}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notları Sil</AlertDialogTitle>
            <AlertDialogDescription>
              {searchQuery
                ? `Filtrelenmiş ${filteredDonations.filter(d => d.notes.trim() !== "").length} bağışçının notu silinecek.`
                : `${notesWithContent.length} bağışçının tüm notları silinecek.`}
              Bu işlem geri alınabilir (Kaydet'e basmadan geri alabilirsiniz).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmBulkDeleteNotes}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
