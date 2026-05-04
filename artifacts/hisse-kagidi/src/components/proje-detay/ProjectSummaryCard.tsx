import { Card } from "@/components/ui/card";
import { PieChart } from "lucide-react";

interface ProjectSummaryCardProps {
  totals: {
    donors: number;
    shares: number;
    animals: number;
    grouped: number;
    kesildi: number;
  };
  occupancy: number;
}

export function ProjectSummaryCard({ totals, occupancy }: ProjectSummaryCardProps) {
  return (
    <Card className="p-4 mb-6 bg-primary/5 border-primary/20">
      <div className="flex items-center gap-2 mb-3">
        <PieChart className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Kesim Listeleri Özeti</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="text-center">
          <div className="text-xl font-bold text-primary">{totals.donors}</div>
          <div className="text-xs text-muted-foreground">Aktif Bağışçı</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-primary">{totals.shares}</div>
          <div className="text-xs text-muted-foreground">Toplam Hisse</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-primary">{totals.animals}</div>
          <div className="text-xs text-muted-foreground">Gereken Hayvan</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-primary">{totals.grouped}</div>
          <div className="text-xs text-muted-foreground">Gruplandırılmış</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-primary">%{occupancy}</div>
          <div className="text-xs text-muted-foreground">Doluluk Oranı</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-emerald-600">{totals.kesildi}/{totals.grouped}</div>
          <div className="text-xs text-muted-foreground">Kesildi</div>
        </div>
      </div>
    </Card>
  );
}
