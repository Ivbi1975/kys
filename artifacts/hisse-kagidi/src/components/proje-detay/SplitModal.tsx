import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  AlertCircle,
  Filter,
  ShoppingBag,
  Brain,
  ChevronDown,
  ChevronUp,
  X,
  ListFilter,
  Check,
} from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import { getTotalShares, getRequiredAnimals } from "@/lib/grouping";
import {
  loadBasketFromStorage,
  saveBasketToStorage,
  type BasketItem,
} from "@/components/kesim-alani/hooks/types";
import { useToast } from "@/hooks/use-toast";

interface SplitTarget {
  name: string;
  kesimListeId: string;
  hayvanSayisi: number | "";
}

interface SplitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kesimAlani: KesimAlani;
  onSplit: (targets: { name: string; kesimListeId: string; hayvanSayisi: number }[]) => Promise<void>;
}

type SplitTab = "split" | "filter";

export function SplitModal({ open, onOpenChange, kesimAlani, onSplit }: SplitModalProps) {
  const { toast } = useToast();
  const defaultTargets = (): SplitTarget[] => [
    { name: "", kesimListeId: "", hayvanSayisi: "" },
    { name: "", kesimListeId: "", hayvanSayisi: "" },
  ];
  const [targets, setTargets] = useState<SplitTarget[]>(defaultTargets());
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<SplitTab>("filter");

  const [filterAnimalMin, setFilterAnimalMin] = useState<number | "">("");
  const [filterAnimalMax, setFilterAnimalMax] = useState<number | "">("");
  const [filterCinsi, setFilterCinsi] = useState<string>("all");
  const [filterHisseMin, setFilterHisseMin] = useState<number | "">("");
  const [filterHisseMax, setFilterHisseMax] = useState<number | "">("");
  const [filterAiCategories, setFilterAiCategories] = useState<Set<string>>(new Set());
  const [filterShowPanel, setFilterShowPanel] = useState(true);
  const [selectedDonorIds, setSelectedDonorIds] = useState<Set<string>>(new Set());

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTargets(defaultTargets());
      setSubmitting(false);
      setActiveTab("filter");
      resetFilters();
    }
    onOpenChange(nextOpen);
  };

  const resetFilters = () => {
    setFilterAnimalMin("");
    setFilterAnimalMax("");
    setFilterCinsi("all");
    setFilterHisseMin("");
    setFilterHisseMax("");
    setFilterAiCategories(new Set());
    setSelectedDonorIds(new Set());
  };

  const allDonors = kesimAlani.donations;
  const totalShares = getTotalShares(allDonors);
  const totalAnimals = getRequiredAnimals(allDonors);
  const totalDonors = allDonors.length;

  const allCinsiValues = useMemo(() => {
    const set = new Set<string>();
    allDonors.forEach(d => { if (d.donationType?.trim()) set.add(d.donationType.trim()); });
    return [...set].sort();
  }, [allDonors]);

  const allAiCategories = useMemo(() => {
    const map = new Map<string, number>();
    allDonors.forEach(d => {
      if (d.aiCategories) {
        d.aiCategories.forEach(cat => {
          map.set(cat, (map.get(cat) || 0) + 1);
        });
      }
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [allDonors]);

  const donorAnimalMap = useMemo(() => {
    const map = new Map<string, number>();
    kesimAlani.animalGroups.forEach(g => {
      g.donations.forEach(d => {
        if (d.id) {
          map.set(d.id, g.animalNo);
        }
      });
    });
    return map;
  }, [kesimAlani.animalGroups]);

  const filteredDonors = useMemo(() => {
    let donors = allDonors.filter(d => !d.excluded);

    if (filterAnimalMin !== "" || filterAnimalMax !== "") {
      const min = filterAnimalMin === "" ? 0 : filterAnimalMin;
      const max = filterAnimalMax === "" ? Infinity : filterAnimalMax;
      donors = donors.filter(d => {
        const animalNo = donorAnimalMap.get(d.id);
        if (animalNo === undefined) return false;
        return animalNo >= min && animalNo <= max;
      });
    }

    if (filterCinsi !== "all") {
      donors = donors.filter(d => d.donationType?.trim() === filterCinsi);
    }

    if (filterHisseMin !== "" || filterHisseMax !== "") {
      const min = filterHisseMin === "" ? 0 : filterHisseMin;
      const max = filterHisseMax === "" ? Infinity : filterHisseMax;
      donors = donors.filter(d => d.shareCount >= min && d.shareCount <= max);
    }

    if (filterAiCategories.size > 0) {
      donors = donors.filter(d => {
        if (!d.aiCategories || d.aiCategories.length === 0) return false;
        return d.aiCategories.some(cat => filterAiCategories.has(cat));
      });
    }

    return donors;
  }, [allDonors, filterAnimalMin, filterAnimalMax, filterCinsi, filterHisseMin, filterHisseMax, filterAiCategories, donorAnimalMap]);

  const hasActiveFilters = filterAnimalMin !== "" || filterAnimalMax !== "" || filterCinsi !== "all" || filterHisseMin !== "" || filterHisseMax !== "" || filterAiCategories.size > 0;

  const toggleAiCategory = useCallback((cat: string) => {
    setFilterAiCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const toggleSelectDonor = useCallback((id: string) => {
    setSelectedDonorIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allFilteredSelected = useMemo(() => {
    if (filteredDonors.length === 0) return false;
    return filteredDonors.every(d => selectedDonorIds.has(d.id));
  }, [filteredDonors, selectedDonorIds]);

  const selectAllFiltered = useCallback(() => {
    setSelectedDonorIds(prev => {
      const next = new Set(prev);
      filteredDonors.forEach(d => next.add(d.id));
      return next;
    });
  }, [filteredDonors]);

  const deselectAll = useCallback(() => {
    setSelectedDonorIds(prev => {
      const next = new Set(prev);
      filteredDonors.forEach(d => next.delete(d.id));
      return next;
    });
  }, [filteredDonors]);

  const addSelectedToBasket = useCallback(() => {
    if (selectedDonorIds.size === 0) return;
    const existing = loadBasketFromStorage(kesimAlani.projectId);
    const existingIds = new Set(existing.map(b => b.donationId));
    const newItems: BasketItem[] = [];
    selectedDonorIds.forEach(id => {
      if (existingIds.has(id)) return;
      const donor = allDonors.find(d => d.id === id);
      if (!donor) return;
      newItems.push({
        type: "donation",
        donationId: donor.id,
        kesimAlaniId: kesimAlani.id,
        kesimAlaniName: kesimAlani.name,
        name: donor.name,
        description: donor.description,
        donationType: donor.donationType,
        donorShareCount: donor.shareCount,
        vekalet: donor.vekalet,
        donorNotes: donor.notes,
      });
    });
    if (newItems.length > 0) {
      saveBasketToStorage([...existing, ...newItems], kesimAlani.projectId);
      toast({
        title: "Sepete eklendi",
        description: `${newItems.length} bağışçı sepete eklendi.`,
      });
    } else {
      toast({
        title: "Zaten sepette",
        description: "Seçili bağışçılar zaten sepette.",
      });
    }
  }, [selectedDonorIds, allDonors, kesimAlani, toast]);

  const totalAssigned = useMemo(() => {
    return targets.reduce((sum, t) => sum + (typeof t.hayvanSayisi === "number" ? t.hayvanSayisi : 0), 0);
  }, [targets]);

  const remaining = totalAnimals - totalAssigned;
  const isValid = useMemo(() => {
    if (targets.length < 2) return false;
    if (remaining !== 0) return false;
    return targets.every(t => t.name.trim() !== "" && typeof t.hayvanSayisi === "number" && t.hayvanSayisi > 0);
  }, [targets, remaining]);

  function updateTarget(index: number, field: keyof SplitTarget, value: string | number) {
    setTargets(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  }

  function addTarget() {
    setTargets(prev => [...prev, { name: "", kesimListeId: "", hayvanSayisi: "" }]);
  }

  function removeTarget(index: number) {
    if (targets.length <= 2) return;
    setTargets(prev => prev.filter((_, i) => i !== index));
  }

  function distributeEvenly() {
    const count = targets.length;
    const base = Math.floor(totalAnimals / count);
    const extra = totalAnimals % count;
    setTargets(prev => prev.map((t, i) => ({
      ...t,
      hayvanSayisi: base + (i < extra ? 1 : 0),
    })));
  }

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    try {
      await onSplit(targets.map(t => ({
        name: t.name.trim(),
        kesimListeId: t.kesimListeId.trim(),
        hayvanSayisi: t.hayvanSayisi as number,
      })));
      handleOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src="/kurban-logo.png" alt="" className="w-5 h-5 object-contain" />
            Kesim Listesi Parçala
          </DialogTitle>
        </DialogHeader>

        <div className="flex border-b mb-4">
          <button
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "filter" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("filter")}
          >
            <ListFilter className="w-4 h-4" />
            Filtrele & Sepete Ekle
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "split" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("split")}
          >
            <img src="/kurban-logo.png" alt="" className="w-4 h-4 object-contain" />
            Listeye Parçala
          </button>
        </div>

        {activeTab === "filter" && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">{kesimAlani.name}</p>
              <div className="flex gap-4 mt-1">
                <span className="text-xs text-muted-foreground">{totalDonors} bağışçı</span>
                <span className="text-xs text-muted-foreground">{totalShares} hisse</span>
                <span className="text-xs text-muted-foreground font-medium">{totalAnimals} hayvan</span>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                onClick={() => setFilterShowPanel(!filterShowPanel)}
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Filtreler</span>
                  {hasActiveFilters && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">Aktif</Badge>
                  )}
                </div>
                {filterShowPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {filterShowPanel && (
                <div className="p-3 space-y-3 border-t">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Hayvan No Aralığı</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          placeholder="Min"
                          value={filterAnimalMin}
                          onChange={e => setFilterAnimalMin(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">-</span>
                        <Input
                          type="number"
                          min={1}
                          placeholder="Max"
                          value={filterAnimalMax}
                          onChange={e => setFilterAnimalMax(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Hisse Aralığı</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          max={7}
                          placeholder="Min"
                          value={filterHisseMin}
                          onChange={e => setFilterHisseMin(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">-</span>
                        <Input
                          type="number"
                          min={1}
                          max={7}
                          placeholder="Max"
                          value={filterHisseMax}
                          onChange={e => setFilterHisseMax(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {allCinsiValues.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Cinsi</Label>
                      <Select value={filterCinsi} onValueChange={setFilterCinsi}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tümü</SelectItem>
                          {allCinsiValues.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {allAiCategories.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-primary" />
                        AI Sınıflandırma Etiketleri
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {allAiCategories.map(([cat, count]) => (
                          <Badge
                            key={cat}
                            variant={filterAiCategories.has(cat) ? "default" : "secondary"}
                            className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => toggleAiCategory(cat)}
                          >
                            {filterAiCategories.has(cat) && <Check className="w-3 h-3 mr-0.5" />}
                            {cat.replace(/_/g, " ")} <span className="ml-1 font-bold opacity-70">{count}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">
                      <X className="w-3 h-3 mr-1" />
                      Filtreleri Temizle
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {hasActiveFilters ? (
                  <>Filtrelenmiş: <span className="text-primary font-bold">{filteredDonors.length}</span> / {allDonors.filter(d => !d.excluded).length} bağışçı</>
                ) : (
                  <>{allDonors.filter(d => !d.excluded).length} aktif bağışçı</>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                {selectedDonorIds.size > 0 && (
                  <Badge variant="outline" className="text-xs">{selectedDonorIds.size} seçili</Badge>
                )}
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={selectAllFiltered}>Tümünü Seç</Button>
                {selectedDonorIds.size > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={deselectAll}>Seçimi Kaldır</Button>
                )}
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto thick-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr className="border-b">
                    <th className="p-2 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={() => {
                          if (allFilteredSelected) deselectAll();
                          else selectAllFiltered();
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground">Hayvan</th>
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground">Adına Kesilen</th>
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground">Vekaleti Veren</th>
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground">Cinsi</th>
                    <th className="p-2 text-center text-xs font-medium text-muted-foreground">Hisse</th>
                    {allAiCategories.length > 0 && (
                      <th className="p-2 text-left text-xs font-medium text-muted-foreground">AI Etiket</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredDonors.length === 0 ? (
                    <tr>
                      <td colSpan={allAiCategories.length > 0 ? 7 : 6} className="p-6 text-center text-sm text-muted-foreground">
                        Filtre kriterlerine uyan bağışçı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredDonors.map(d => {
                      const animalNo = donorAnimalMap.get(d.id);
                      return (
                        <tr
                          key={d.id}
                          className={`border-b last:border-0 cursor-pointer transition-colors ${selectedDonorIds.has(d.id) ? "bg-primary/5" : "hover:bg-muted/30"}`}
                          onClick={() => toggleSelectDonor(d.id)}
                        >
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedDonorIds.has(d.id)}
                              onChange={() => toggleSelectDonor(d.id)}
                              className="rounded"
                              onClick={e => e.stopPropagation()}
                            />
                          </td>
                          <td className="p-2 text-xs">
                            {animalNo !== undefined ? (
                              <Badge variant="outline" className="text-[10px] font-mono">{animalNo}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2 text-xs font-medium truncate max-w-[120px]">{d.name || "—"}</td>
                          <td className="p-2 text-xs truncate max-w-[120px]">{d.description || "—"}</td>
                          <td className="p-2 text-xs">{d.donationType || "—"}</td>
                          <td className="p-2 text-xs text-center font-mono">{d.shareCount}</td>
                          {allAiCategories.length > 0 && (
                            <td className="p-2">
                              <div className="flex flex-wrap gap-0.5">
                                {d.aiCategories?.map(cat => (
                                  <Badge key={cat} variant="secondary" className="text-[9px] px-1 py-0">
                                    {cat.replace(/_/g, " ")}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {selectedDonorIds.size > 0 && (
              <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <span className="text-sm font-medium flex-1">
                  {selectedDonorIds.size} bağışçı seçildi
                </span>
                <Button size="sm" onClick={addSelectedToBasket}>
                  <ShoppingBag className="w-4 h-4 mr-1" />
                  Sepete Ekle
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "split" && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">{kesimAlani.name}</p>
              <div className="flex gap-4 mt-1">
                <span className="text-xs text-muted-foreground">{totalDonors} bağışçı</span>
                <span className="text-xs text-muted-foreground">{totalShares} hisse</span>
                <span className="text-xs text-muted-foreground font-medium">{totalAnimals} hayvan</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Alt Listeler</Label>
              <Button variant="outline" size="sm" onClick={distributeEvenly} type="button">
                Eşit Dağıt
              </Button>
            </div>

            <div className="space-y-3">
              {targets.map((target, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Alt Liste {index + 1}</span>
                    {targets.length > 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeTarget(index)}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <Label className="text-[10px] text-muted-foreground">Ad</Label>
                      <Input
                        placeholder="Liste adı"
                        value={target.name}
                        onChange={(e) => updateTarget(index, "name", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-[10px] text-muted-foreground">Kesim Liste ID</Label>
                      <Input
                        placeholder="Opsiyonel"
                        value={target.kesimListeId}
                        onChange={(e) => updateTarget(index, "kesimListeId", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-[10px] text-muted-foreground">Hayvan Sayısı</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="0"
                        value={target.hayvanSayisi}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseInt(e.target.value);
                          updateTarget(index, "hayvanSayisi", val);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addTarget} className="w-full" type="button">
              <Plus className="w-4 h-4 mr-1" />
              Alt Liste Ekle
            </Button>

            <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${remaining === 0 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"}`}>
              {remaining !== 0 && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <div>
                <span className="font-medium">Atanan: {totalAssigned} / {totalAnimals} hayvan</span>
                {remaining !== 0 && (
                  <span className="ml-2">({remaining > 0 ? `${remaining} kalan` : `${Math.abs(remaining)} fazla`})</span>
                )}
                {remaining === 0 && <span className="ml-2">Tüm hayvanlar dağıtıldı</span>}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
                İptal
              </Button>
              <Button onClick={handleSubmit} disabled={!isValid || submitting}>
                {submitting ? "Parçalanıyor..." : "Parçala"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
