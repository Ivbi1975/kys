import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ListPlus, CheckCircle2, AlertCircle } from "lucide-react";
import { bulkCreateKesimAlanlari } from "@/lib/api";

interface BulkCreateListeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

export function BulkCreateListeDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: BulkCreateListeDialogProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: { name: string; error: string }[] } | null>(null);

  const names = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const handleCreate = async () => {
    if (names.length === 0) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await bulkCreateKesimAlanlari(names, projectId);
      setResult(res);
      if (res.created > 0) {
        onSuccess();
      }
    } catch (err) {
      setResult({ created: 0, failed: names.map(n => ({ name: n, error: err instanceof Error ? err.message : "Hata" })) });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setText("");
      setResult(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="w-5 h-5 text-primary" />
            Toplu Kesim Listesi Oluştur
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Her satıra bir kesim listesi adı girin. Her satır ayrı bir liste olarak oluşturulacak.
            </p>
            <Textarea
              placeholder={"Liste 1\nListe 2\nListe 3"}
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              className="resize-none font-mono text-sm"
              autoFocus
            />
            {names.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{names.length}</span> liste oluşturulacak
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)}>İptal</Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={names.length === 0 || loading}
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Oluşturuluyor...</>
                  : <><ListPlus className="w-4 h-4 mr-1" />Oluştur</>
                }
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                {result.created} kesim listesi başarıyla oluşturuldu
              </p>
            </div>
            {result.failed.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <p className="text-sm font-medium text-destructive">{result.failed.length} liste oluşturulamadı</p>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto pl-1">
                  {result.failed.map((f, i) => (
                    <li key={i} className="flex gap-1">
                      <span className="font-medium text-foreground">{f.name}:</span>
                      <span>{f.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)}>Kapat</Button>
              <Button
                className="flex-1"
                onClick={() => { setText(""); setResult(null); }}
              >
                Yeni Oluştur
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
