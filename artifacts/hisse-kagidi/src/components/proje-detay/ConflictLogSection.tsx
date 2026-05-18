import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RefreshCw, ShieldAlert, CheckCircle, XCircle } from "lucide-react";
import { formatDateTime } from "@/lib/formatting";
import type { ConflictLogEntry } from "@/lib/api";

interface ConflictLogSectionProps {
  showConflictLog: boolean;
  setShowConflictLog: (show: boolean) => void;
  conflictLogLoading: boolean;
  conflictLog: ConflictLogEntry[];
}

export function ConflictLogSection({
  showConflictLog,
  setShowConflictLog,
  conflictLogLoading,
  conflictLog,
}: ConflictLogSectionProps) {
  return (
    <div className="mb-6">
      <Button
        variant="outline"
        className="w-full justify-between mb-3"
        onClick={() => setShowConflictLog(!showConflictLog)}
      >
        <span className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          Çakışma Geçmişi
          {conflictLog.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
              {conflictLog.length}
            </span>
          )}
        </span>
        {showConflictLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </Button>

      {showConflictLog && (
        <div className="space-y-2">
          {conflictLogLoading ? (
            <Card className="p-6 text-center">
              <RefreshCw className="w-6 h-6 text-muted-foreground mx-auto animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">Yükleniyor...</p>
            </Card>
          ) : conflictLog.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-muted-foreground">Çakışma kaydı bulunamadı</p>
            </Card>
          ) : (
            conflictLog.map((entry) => (
              <Card key={entry.id} className="p-3 text-xs border-amber-100 dark:border-amber-900">
                <div className="flex items-start gap-2">
                  {entry.resolution === "forced" ? (
                    <XCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold">{entry.donationName || "—"}</p>
                      {entry.vekalet && (
                        <span className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
                          {entry.vekalet}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        entry.resolution === "forced"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                          : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                      }`}>
                        {entry.resolution === "forced" ? "Zorla devam edildi" : "Engellendi"}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      {entry.sourceKesimAlaniName} → {entry.targetKesimAlaniName}
                    </p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      {formatDateTime(entry.detectedAt)}
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
