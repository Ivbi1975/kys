import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import type { LocalDonation, AiResult } from "./types";

interface DonationsTableProps {
  donations: LocalDonation[];
  filteredDonations: LocalDonation[];
  searchQuery: string;
  hideEmptyNotes: boolean;
  setHideEmptyNotes: (fn: (prev: boolean) => boolean) => void;
  aiRunning: boolean;
  aiResults: Map<string, AiResult>;
  handleNoteChange: (id: string, value: string) => void;
  commitNoteChange: (id: string) => void;
  updateDonationsWithHistory: (updater: (prev: LocalDonation[]) => LocalDonation[]) => void;
}

export function DonationsTable({
  donations, filteredDonations, searchQuery, hideEmptyNotes, setHideEmptyNotes,
  aiRunning, aiResults, handleNoteChange, commitNoteChange, updateDonationsWithHistory,
}: DonationsTableProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {filteredDonations.length}/{donations.length} bağışçı gösteriliyor
          {searchQuery && ` ("${searchQuery}" araması)`}
          {hideEmptyNotes && " (notu olmayanlar gizli)"}
        </div>
        <Button variant={hideEmptyNotes ? "default" : "outline"} size="sm" onClick={() => setHideEmptyNotes(prev => !prev)} className="text-xs h-7">
          {hideEmptyNotes ? "Tümünü Göster" : "Notu Olmayanları Gizle"}
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-xs">#</TableHead>
              <TableHead className="text-xs min-w-[150px]">Ad / Açıklama</TableHead>
              <TableHead className="text-xs w-24">Bağış Türü</TableHead>
              <TableHead className="text-xs w-24">Vekalet No</TableHead>
              <TableHead className="text-xs min-w-[200px]">Not</TableHead>
              <TableHead className="text-xs w-[180px]">AI Sonucu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDonations.map((d) => {
              const aiResult = aiResults.get(d.id);
              const hasWarning = aiResult?.warnings && aiResult.warnings.trim() !== "";
              const globalIdx = donations.indexOf(d);

              return (
                <TableRow key={d.id} data-donation-id={d.id} className={`transition-all ${hasWarning ? "bg-destructive/5" : ""}`}>
                  <TableCell className="text-xs text-muted-foreground">{globalIdx + 1}</TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{d.description || d.name || "(İsimsiz)"}</span>
                  </TableCell>
                  <TableCell>
                    {d.donationType && <Badge variant="outline" className="text-xs">{d.donationType}</Badge>}
                  </TableCell>
                  <TableCell>
                    {d.vekalet && <span className="text-xs text-muted-foreground">{d.vekalet}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Textarea
                        value={d.notes || ""}
                        onChange={e => handleNoteChange(d.id, e.target.value)}
                        onBlur={() => commitNoteChange(d.id)}
                        placeholder="Not yok..."
                        className="text-xs min-h-[36px] resize-none py-1 px-2"
                        rows={1}
                      />
                      {(d.notes || "").trim() !== "" && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0 h-6 w-6 p-0" onClick={() => { updateDonationsWithHistory(prev => prev.map(x => x.id === d.id ? { ...x, notes: "" } : x)); }}>
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {aiRunning && !aiResult && (d.notes || "").trim() !== "" && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    )}
                    {aiResult && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-1 text-left hover:bg-muted/50 rounded p-1 -m-1 transition-colors w-full">
                            {hasWarning ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            )}
                            <div className="flex flex-wrap gap-0.5 min-w-0">
                              {aiResult.categories && aiResult.categories.length > 0 ? (
                                aiResult.categories.slice(0, 2).map(cat => (
                                  <Badge key={cat} variant="secondary" className="text-[10px] px-1 py-0">{cat.replace(/_/g, " ")}</Badge>
                                ))
                              ) : (
                                <span className="text-[10px] text-muted-foreground">sonuç var</span>
                              )}
                              {aiResult.categories && aiResult.categories.length > 2 && (
                                <span className="text-[10px] text-muted-foreground">+{aiResult.categories.length - 2}</span>
                              )}
                            </div>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 space-y-2" side="left">
                          <div className="text-sm font-medium">{d.description || d.name}</div>
                          {aiResult.summary && <p className="text-xs text-muted-foreground">{aiResult.summary}</p>}
                          {aiResult.categories && aiResult.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {aiResult.categories.map(cat => (
                                <Badge key={cat} variant="secondary" className="text-xs">{cat.replace(/_/g, " ")}</Badge>
                              ))}
                            </div>
                          )}
                          {aiResult.requests && aiResult.requests.trim() !== "" && (
                            <div>
                              <span className="text-xs font-semibold text-blue-600">İstekler:</span>
                              <p className="text-xs mt-0.5">{aiResult.requests}</p>
                            </div>
                          )}
                          {hasWarning && (
                            <div className="bg-destructive/10 rounded p-2 border border-destructive/20">
                              <span className="text-xs font-semibold text-destructive flex items-center gap-1 mb-0.5">
                                <AlertTriangle className="w-3 h-3" />Uyarı:
                              </span>
                              <p className="text-xs text-destructive">{aiResult.warnings}</p>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {filteredDonations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-sm">
                  {searchQuery ? "Arama sonucu bulunamadı" : "Bağışçı yok"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
