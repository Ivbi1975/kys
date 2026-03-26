import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Loader2, Users, Scissors } from "lucide-react";
import { globalSearch } from "@/lib/api";
import type { GlobalSearchResult } from "@/lib/api";

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
}

const SEARCH_COLUMNS = [
  { value: "all", label: "Tümü" },
  { value: "name", label: "Ad" },
  { value: "vekalet", label: "Vekalet" },
  { value: "description", label: "Vekaleti Veren" },
  { value: "donationType", label: "Cinsi" },
  { value: "notes", label: "Not" },
  { value: "phone", label: "Telefon" },
];

export default function GlobalSearchDialog({ open, onOpenChange, projectId }: GlobalSearchDialogProps) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [column, setColumn] = useState("all");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string, col: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await globalSearch(q.trim(), col, projectId);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleQueryChange = useCallback((val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(val, column);
    }, 400);
  }, [column, doSearch]);

  const handleColumnChange = useCallback((val: string) => {
    setColumn(val);
    if (query.trim().length >= 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        doSearch(query, val);
      }, 200);
    }
  }, [query, doSearch]);

  const handleGoTo = useCallback((result: GlobalSearchResult) => {
    const highlightParam = encodeURIComponent(result.donationId);
    setLocation(`/kesim/${result.kesimAlaniId}?highlight=${highlightParam}`);
    onOpenChange(false);
  }, [setLocation, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Global Arama
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 items-center">
          <Select value={column} onValueChange={handleColumnChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEARCH_COLUMNS.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Bağışçı ara... (en az 2 karakter)"
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 mt-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Sonuç bulunamadı
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground px-1">
                {results.length} sonuç bulundu
              </p>
              {results.map((r) => (
                <div
                  key={`${r.kesimAlaniId}-${r.donationId}`}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {r.name || "(İsimsiz)"}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                        {r.vekalet && (
                          <span>Vekalet: {r.vekalet}</span>
                        )}
                        {r.description && (
                          <span>Vekaleti Veren: {r.description}</span>
                        )}
                        {r.donationType && (
                          <span>Cinsi: {r.donationType}</span>
                        )}
                        {r.phone && (
                          <span>Tel: {r.phone}</span>
                        )}
                        {r.notes && (
                          <span className="truncate max-w-[200px]">Not: {r.notes}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-1.5">
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Scissors className="w-3 h-3" />
                          {r.kesimAlaniName}
                        </span>
                        {r.projectName && (
                          <span className="text-muted-foreground">
                            Proje: {r.projectName}
                          </span>
                        )}
                        {r.animalNo != null && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <Users className="w-3 h-3" />
                            Hayvan No: {r.animalNo}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {r.shareCount} hisse
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => handleGoTo(r)}
                    >
                      <MapPin className="w-3 h-3 mr-1" />
                      Oraya Git
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
