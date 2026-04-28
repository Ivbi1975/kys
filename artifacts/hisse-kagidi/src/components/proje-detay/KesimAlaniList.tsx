import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, ChevronRight, Calendar,
  Link2, ExternalLink, QrCode, GitBranch, CornerDownRight,
} from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import { getTotalShares, getRequiredAnimals } from "@/lib/grouping";
import { formatDate, timeSince } from "@/lib/formatting";

interface KesimAlaniListProps {
  kesimAlanlari: KesimAlani[];
  onNavigate: (path: string) => void;
  onCreateDialog: () => void;
  onCopyTrackingLink: (e: React.MouseEvent, k: KesimAlani) => void;
  onOpenTrackingPage: (e: React.MouseEvent, k: KesimAlani) => void;
  onShowQrCode: (e: React.MouseEvent, k: KesimAlani) => void;
  onDelete: (id: string) => void;
  onSplit?: (k: KesimAlani) => void;
}

function KesimAlaniCard({
  k,
  isChild,
  onNavigate,
  onCopyTrackingLink,
  onOpenTrackingPage,
  onShowQrCode,
  onDelete,
  onSplit,
  parentName,
}: {
  k: KesimAlani;
  isChild?: boolean;
  onNavigate: (path: string) => void;
  onCopyTrackingLink: (e: React.MouseEvent, k: KesimAlani) => void;
  onOpenTrackingPage: (e: React.MouseEvent, k: KesimAlani) => void;
  onShowQrCode: (e: React.MouseEvent, k: KesimAlani) => void;
  onDelete: (id: string) => void;
  onSplit?: (k: KesimAlani) => void;
  parentName?: string;
}) {
  const shares = getTotalShares(k.donations);
  const animals = getRequiredAnimals(k.donations);
  const activeDonors = k.donations.filter(d => !d.excluded).length;
  const totalSlots = k.animalGroups.length * 7;
  const filledSlots = k.animalGroups.reduce(
    (s, g) => s + g.donations.filter(d => d.name.trim() !== "").length,
    0
  );
  const occ = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
  const kesildiCount = k.animalGroups.filter(g => g.kesildi).length;
  const totalGroups = k.animalGroups.length;
  const kesildiPercent = totalGroups > 0 ? Math.round((kesildiCount / totalGroups) * 100) : 0;
  const lastKesildiAt = k.animalGroups
    .filter(g => g.kesildiAt)
    .map(g => g.kesildiAt!)
    .sort()
    .pop();

  const isSplit = k.splitStatus === "split";

  return (
    <Card
      className={`p-4 hover:bg-accent/50 transition-colors cursor-pointer ${
        isSplit ? "border-amber-400 dark:border-amber-600 border-2" : ""
      } ${isChild ? "border-blue-300 dark:border-blue-700 border-l-4" : ""}`}
      onClick={() => onNavigate(`/kesim/${k.id}`)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isChild && <CornerDownRight className="w-4 h-4 text-blue-500 flex-shrink-0" />}
            <h3 className="font-semibold text-foreground">{k.name}{k.yetkili ? <span className="ml-2 font-normal text-muted-foreground">{k.yetkili}</span> : null}</h3>
            {isSplit && (
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-[10px]">
                <GitBranch className="w-3 h-3 mr-0.5" />
                Parçalandı
              </Badge>
            )}
            {isChild && (
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 text-[10px]">
                Alt Liste
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(k.createdAt)}
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              ({timeSince(k.createdAt)})
            </span>
            {isChild && parentName && (
              <span className="text-[10px] text-blue-500">
                ← {parentName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isSplit && !isChild && onSplit && k.donations.length >= 2 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="Parçala"
              onClick={(e) => {
                e.stopPropagation();
                onSplit(k);
              }}
            >
              <img src="/kurban-logo.png" alt="" className="w-4 h-4 object-contain" />
            </Button>
          )}
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
      {!isSplit && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
            <div>
              <div className="text-sm font-bold text-primary">
                {activeDonors}{k.maxVekalet ? <span className="text-muted-foreground font-normal">/{k.maxVekalet}</span> : null}
              </div>
              <div className="text-[10px] text-muted-foreground">Bağışçı</div>
            </div>
            <div>
              <div className="text-sm font-bold text-primary">{shares}</div>
              <div className="text-[10px] text-muted-foreground">Hisse</div>
            </div>
            <div>
              <div className="text-sm font-bold text-primary">
                {animals}{k.maxAnimal ? <span className="text-muted-foreground font-normal">/{k.maxAnimal}</span> : null}
              </div>
              <div className="text-[10px] text-muted-foreground">Hayvan</div>
            </div>
            <div>
              <div className="text-sm font-bold text-primary">{k.animalGroups.length}</div>
              <div className="text-[10px] text-muted-foreground">Grup</div>
            </div>
            <div>
              <div className="text-sm font-bold text-primary">%{occ}</div>
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
        </>
      )}
      {isSplit && (
        <div className="text-xs text-muted-foreground mt-1">
          Bu liste parçalanmıştır. Bağışçılar alt listelere dağıtılmıştır.
        </div>
      )}
    </Card>
  );
}

export function KesimAlaniList({
  kesimAlanlari,
  onNavigate,
  onCreateDialog,
  onCopyTrackingLink,
  onOpenTrackingPage,
  onShowQrCode,
  onDelete,
  onSplit,
}: KesimAlaniListProps) {
  const { parentItems, childrenMap, standaloneItems, parentNameMap } = useMemo(() => {
    const parents: KesimAlani[] = [];
    const standalone: KesimAlani[] = [];
    const childMap = new Map<string, KesimAlani[]>();
    const nameMap = new Map<string, string>();

    for (const ka of kesimAlanlari) {
      nameMap.set(ka.id, ka.name);
    }

    const parentIds = new Set(kesimAlanlari.filter(ka => ka.splitStatus === "split").map(ka => ka.id));

    for (const ka of kesimAlanlari) {
      if (ka.splitStatus === "split") {
        parents.push(ka);
      } else if (ka.parentKesimAlaniId && parentIds.has(ka.parentKesimAlaniId)) {
        const existing = childMap.get(ka.parentKesimAlaniId) || [];
        existing.push(ka);
        childMap.set(ka.parentKesimAlaniId, existing);
      } else {
        standalone.push(ka);
      }
    }

    return {
      parentItems: parents,
      childrenMap: childMap,
      standaloneItems: standalone,
      parentNameMap: nameMap,
    };
  }, [kesimAlanlari]);

  if (kesimAlanlari.length === 0) {
    return (
      <Card className="p-12 text-center">
        <img src="/kurban-logo.png" alt="logo" className="w-28 h-14 mx-auto mb-4 opacity-50 object-contain" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Henüz kesim alanı yok</h2>
        <p className="text-muted-foreground mb-4">Bu projeye yeni bir kesim alanı ekleyin.</p>
        <Button onClick={onCreateDialog}>
          <Plus className="w-4 h-4 mr-1" />
          Yeni Kesim Alanı
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3 mb-6">
      {standaloneItems.map(k => (
        <KesimAlaniCard
          key={k.id}
          k={k}
          onNavigate={onNavigate}
          onCopyTrackingLink={onCopyTrackingLink}
          onOpenTrackingPage={onOpenTrackingPage}
          onShowQrCode={onShowQrCode}
          onDelete={onDelete}
          onSplit={onSplit}
        />
      ))}
      {parentItems.map(parent => {
        const children = childrenMap.get(parent.id) || [];
        return (
          <div key={parent.id} className="space-y-1">
            <KesimAlaniCard
              k={parent}
              onNavigate={onNavigate}
              onCopyTrackingLink={onCopyTrackingLink}
              onOpenTrackingPage={onOpenTrackingPage}
              onShowQrCode={onShowQrCode}
              onDelete={onDelete}
            />
            {children.length > 0 && (
              <div className="ml-6 space-y-1">
                {children.map(child => (
                  <KesimAlaniCard
                    key={child.id}
                    k={child}
                    isChild
                    parentName={parent.name}
                    onNavigate={onNavigate}
                    onCopyTrackingLink={onCopyTrackingLink}
                    onOpenTrackingPage={onOpenTrackingPage}
                    onShowQrCode={onShowQrCode}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
