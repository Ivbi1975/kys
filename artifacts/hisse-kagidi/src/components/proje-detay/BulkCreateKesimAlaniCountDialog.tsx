import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Layers, Plus, Minus, CheckCircle2 } from "lucide-react";
import { bulkCreateKesimAlanlari } from "@/lib/api";

interface BulkCreateKesimAlaniCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

export function BulkCreateKesimAlaniCountDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: BulkCreateKesimAlaniCountDialogProps) {
  const [baseName, setBaseName] = useState("Kesim Alanı");
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<number | null>(null);

  const names = Array.from({ length: count }, (_, i) => `${baseName.trim()} ${i + 1}`);

  const handleCreate = async () => {
    if (!baseName.trim() || count < 1) return;
    setLoading(true);
    setCreated(null);
    try {
      const res = await bulkCreateKesimAlanlari(names, projectId);
      setCreated(res.created);
      if (res.created > 0) {
        onSuccess();
        setTimeout(() => {
          handleReset();
          onOpenChange(false);
        }, 1200);
      }
    } catch {
      setCreated(0);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setBaseName("Kesim Alanı");
    setCount(1);
    setCreated(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) handleReset();
    onOpenChange(next);
  };

  const increment = () => setCount(c => Math.min(c + 1, 50));
  const decrement = () => setCount(c => Math.max(1, c - 1));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Toplu Kesim Alanı Ekle
          </DialogTitle>
        </DialogHeader>

        {created !== null ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <p className="text-sm font-medium text-center">
              {created} kesim alanı başarıyla oluşturuldu.
            </p>
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Temel Ad
              </label>
              <Input
                placeholder="Kesim Alanı"
                value={baseName}
                onChange={e => setBaseName(e.target.value)}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Sonuna numara otomatik eklenir: &ldquo;{baseName.trim() || "Kesim Alanı"} 1&rdquo;, &ldquo;… 2&rdquo;…
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Adet
              </label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 flex-shrink-0"
                  onClick={decrement}
                  disabled={count <= 1}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-2xl font-bold text-foreground w-10 text-center tabular-nums">
                  {count}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 flex-shrink-0"
                  onClick={increment}
                  disabled={count >= 50}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground ml-1">kesim alanı</span>
              </div>
            </div>

            {baseName.trim() && count > 0 && (
              <div className="rounded-lg border bg-muted/40 px-3 py-2 max-h-32 overflow-y-auto">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Oluşturulacaklar
                </p>
                <div className="space-y-0.5">
                  {names.slice(0, 8).map(n => (
                    <p key={n} className="text-xs text-foreground">{n}</p>
                  ))}
                  {count > 8 && (
                    <p className="text-xs text-muted-foreground italic">… ve {count - 8} tane daha</p>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleCreate}
              className="w-full"
              disabled={!baseName.trim() || count < 1 || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Oluşturuluyor…
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 mr-2" />
                  {count} Kesim Alanı Oluştur
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
