import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Trash2, Calendar, Link2, ExternalLink, QrCode, MoveRight } from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import { getTotalShares, getRequiredAnimals } from "@/lib/grouping";
import { formatDate, timeSince } from "@/lib/formatting";

interface KesimCardProps {
  kesimAlani: KesimAlani;
  onNavigate: (id: string) => void;
  onCopyTrackingLink: (e: React.MouseEvent, k: KesimAlani) => void;
  onOpenTrackingPage: (e: React.MouseEvent, k: KesimAlani) => void;
  onShowQrCode: (e: React.MouseEvent, k: KesimAlani) => void;
  onMove: (k: KesimAlani) => void;
  onDelete: (id: string) => void;
}

export function KesimCard({
  kesimAlani: k,
  onNavigate,
  onCopyTrackingLink,
  onOpenTrackingPage,
  onShowQrCode,
  onMove,
  onDelete,
}: KesimCardProps) {
  const shares = getTotalShares(k.donations);
  const animals = getRequiredAnimals(k.donations);
  const activeDonors = k.donations.filter(d => !d.excluded).length;
  const totalSlots = k.animalGroups.length * 7;
  const filledSlots = k.animalGroups.reduce(
    (s, g) => s + g.donations.filter(d => d.name.trim() !== "").length, 0
  );
  const occupancy = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
  const kesildiCount = k.animalGroups.filter(g => g.kesildi).length;
  const totalGroups = k.animalGroups.length;
  const kesildiPercent = totalGroups > 0 ? Math.round((kesildiCount / totalGroups) * 100) : 0;
  const lastKesildiAt = k.animalGroups
    .filter(g => g.kesildiAt)
    .map(g => g.kesildiAt!)
    .sort()
    .pop();

  return (
    <Card
      key={k.id}
      className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => onNavigate(k.id)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">{k.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(k.createdAt)}
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              ({timeSince(k.createdAt)})
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Takip linkini kopyala"
            onClick={(e) => onCopyTrackingLink(e, k)}
          >
            <Link2 className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Takip sayfasını aç"
            onClick={(e) => onOpenTrackingPage(e, k)}
          >
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="QR Kod"
            onClick={(e) => onShowQrCode(e, k)}
          >
            <QrCode className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Taşı"
            onClick={(e) => {
              e.stopPropagation();
              onMove(k);
            }}
          >
            <MoveRight className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(k.id);
            }}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
        <div>
          <div className="text-sm font-bold text-primary">{activeDonors}</div>
          <div className="text-[10px] text-muted-foreground">Bağışçı</div>
        </div>
        <div>
          <div className="text-sm font-bold text-primary">{shares}</div>
          <div className="text-[10px] text-muted-foreground">Hisse</div>
        </div>
        <div>
          <div className="text-sm font-bold text-primary">{animals}</div>
          <div className="text-[10px] text-muted-foreground">Hayvan</div>
        </div>
        <div>
          <div className="text-sm font-bold text-primary">{k.animalGroups.length}</div>
          <div className="text-[10px] text-muted-foreground">Grup</div>
        </div>
        <div>
          <div className="text-sm font-bold text-primary">%{occupancy}</div>
          <div className="text-[10px] text-muted-foreground">Doluluk</div>
        </div>
      </div>
      {totalGroups > 0 && (
        <div className="mt-3 pt-2 border-t">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground font-medium">Kesim Durumu</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-emerald-600">{kesildiCount}/{totalGroups}</span>
              {lastKesildiAt && (
                <span className="text-[9px] text-muted-foreground">
                  (son: {new Date(lastKesildiAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })})
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${kesildiPercent}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
