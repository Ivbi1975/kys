import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, RefreshCw, Search,
  Users, ChevronDown, ChevronUp, MoveRight,
} from "lucide-react";
import type { Conflict, ConflictEntry } from "@/lib/api";

interface ConflictSectionProps {
  showConflicts: boolean;
  setShowConflicts: (show: boolean) => void;
  conflictLoading: boolean;
  totalConflicts: number;
  filteredConflicts: Conflict[];
  conflictSearchQuery: string;
  setConflictSearchQuery: (query: string) => void;
  expandedKeys: Set<string>;
  toggleExpand: (key: string) => void;
  openTransferDialog: (entry: ConflictEntry, conflict: Conflict) => void;
}

export function ConflictSection({
  showConflicts,
  setShowConflicts,
  conflictLoading,
  totalConflicts,
  filteredConflicts,
  conflictSearchQuery,
  setConflictSearchQuery,
  expandedKeys,
  toggleExpand,
  openTransferDialog,
}: ConflictSectionProps) {
  return (
    <div className="mb-6">
      <Button
        variant="outline"
        className="w-full justify-between mb-3"
        onClick={() => setShowConflicts(!showConflicts)}
      >
        <span className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Çatışma Tespiti
          {totalConflicts > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
              {totalConflicts}
            </span>
          )}
        </span>
        {showConflicts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </Button>

      {showConflicts && (
        <div className="space-y-3">
          {conflictLoading ? (
            <Card className="p-6 text-center">
              <RefreshCw className="w-6 h-6 text-muted-foreground mx-auto animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">Analiz ediliyor...</p>
            </Card>
          ) : filteredConflicts.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-muted-foreground">Çatışma bulunamadı</p>
            </Card>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Çatışma ara..."
                  value={conflictSearchQuery}
                  onChange={(e) => setConflictSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              {filteredConflicts.map((conflict, ci) => {
                const isExpanded = expandedKeys.has(`conflict-${ci}`);
                return (
                  <Card key={ci} className="p-3 border-amber-200 dark:border-amber-800">
                    <button
                      className="w-full flex items-center gap-2 text-left"
                      onClick={() => toggleExpand(`conflict-${ci}`)}
                    >
                      <Users className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold">{conflict.displayName}</span>
                        <span className="text-xs text-muted-foreground ml-2">{conflict.entries.length} yerde</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 pl-6">
                        {conflict.entries.map((entry, ei) => (
                          <div key={ei} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-xs">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{entry.kesimAlaniName}</p>
                              <p className="text-muted-foreground truncate">{entry.donationDescription}</p>
                              {entry.animalGroupId && (
                                <p className="text-muted-foreground">Hayvan #{entry.animalGroupNo}</p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs shrink-0"
                              onClick={() => openTransferDialog(entry, conflict)}
                            >
                              <MoveRight className="w-3 h-3 mr-1" />
                              Taşı
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
