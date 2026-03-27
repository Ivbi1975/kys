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
        <span className="text-sm font-bold text-emerald-600">
          {kesildiCount} / {totalGroups}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(progressPercent, 1)}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-muted-foreground">%{progressPercent} tamamlandı</p>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onShowReport}>
          <FileText className="w-3.5 h-3.5 mr-1" /> Durum Raporu
        </Button>
      </div>
    </Card>
  );
}
