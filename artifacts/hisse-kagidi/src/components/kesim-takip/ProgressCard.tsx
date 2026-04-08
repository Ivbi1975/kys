import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface ProgressCardProps {
  kesildiCount: number;
  totalGroups: number;
  onShowReport: () => void;
}

export function ProgressCard({ kesildiCount, totalGroups, onShowReport }: ProgressCardProps) {
  const progressPercent = totalGroups > 0 ? Math.round((kesildiCount / totalGroups) * 100) : 0;

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Kesim Durumu</span>
        <span className="text-sm font-bold text-emerald-600" aria-live="polite">
          {kesildiCount} / {totalGroups}
        </span>
      </div>
      <div
        className="w-full bg-muted rounded-full h-3 overflow-hidden"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Kesim ilerlemesi: %${progressPercent}`}
      >
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(progressPercent, 1)}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-muted-foreground">%{progressPercent} tamamlandı</p>
        <Button variant="outline" size="sm" className="h-9 min-h-[44px] text-xs px-3" onClick={onShowReport} aria-label="Durum raporunu görüntüle">
          <FileText className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Durum Raporu
        </Button>
      </div>
    </Card>
  );
}
