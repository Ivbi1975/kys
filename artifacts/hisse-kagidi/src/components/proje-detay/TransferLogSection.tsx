import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RefreshCw, MoveRight } from "lucide-react";
import { formatDateTime } from "@/lib/formatting";
import type { DonationTransferEntry } from "@/lib/api";

interface TransferLogSectionProps {
  showTransferLog: boolean;
  setShowTransferLog: (show: boolean) => void;
  transferLogLoading: boolean;
  transferLog: DonationTransferEntry[];
}

export function TransferLogSection({
  showTransferLog,
  setShowTransferLog,
  transferLogLoading,
  transferLog,
}: TransferLogSectionProps) {
  return (
    <div className="mb-6">
      <Button
        variant="outline"
        className="w-full justify-between mb-3"
        onClick={() => setShowTransferLog(!showTransferLog)}
      >
        <span className="flex items-center gap-2">
          <MoveRight className="w-4 h-4 text-blue-500" />
          Taşıma Geçmişi
          {transferLog.length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
              {transferLog.length}
            </span>
          )}
        </span>
        {showTransferLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </Button>

      {showTransferLog && (
        <div className="space-y-2">
          {transferLogLoading ? (
            <Card className="p-6 text-center">
              <RefreshCw className="w-6 h-6 text-muted-foreground mx-auto animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">Yükleniyor...</p>
            </Card>
          ) : transferLog.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-muted-foreground">Henüz taşıma yapılmamış</p>
            </Card>
          ) : (
            transferLog.map((entry, i) => (
              <Card key={i} className="p-3 text-xs">
                <div className="flex items-start gap-2">
                  <MoveRight className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{entry.donorName}</p>
                    {entry.donorDescription && (
                      <p className="text-muted-foreground">{entry.donorDescription}</p>
                    )}
                    <p className="text-muted-foreground">
                      {entry.fromKesimAlaniName} → {entry.toKesimAlaniName}
                    </p>
                    {entry.removedFromSource && (
                      <p className="text-blue-600">Hayvan ile birlikte taşındı</p>
                    )}
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      {formatDateTime(entry.createdAt)}
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
