import { useState, useMemo } from "react";
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
import { Plus, Trash2, Scissors, AlertCircle } from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import { getTotalShares, getRequiredAnimals } from "@/lib/grouping";

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

export function SplitModal({ open, onOpenChange, kesimAlani, onSplit }: SplitModalProps) {
  const defaultTargets = (): SplitTarget[] => [
    { name: "", kesimListeId: "", hayvanSayisi: "" },
    { name: "", kesimListeId: "", hayvanSayisi: "" },
  ];
  const [targets, setTargets] = useState<SplitTarget[]>(defaultTargets());
  const [submitting, setSubmitting] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTargets(defaultTargets());
      setSubmitting(false);
    }
    onOpenChange(nextOpen);
  };

  const totalShares = getTotalShares(kesimAlani.donations);
  const totalAnimals = getRequiredAnimals(kesimAlani.donations);
  const totalDonors = kesimAlani.donations.length;

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-amber-600" />
            Kesim Listesi Parçala
          </DialogTitle>
        </DialogHeader>

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? "Parçalanıyor..." : "Parçala"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
