import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, Trash2, FolderOpen, RotateCcw, Eye, Loader2 } from "lucide-react";
import type { KesimAlani, Project } from "@/lib/types";
import { formatDateTime } from "@/lib/formatting";

interface TrashSectionProps {
  deletedKesimAlanlari: KesimAlani[];
  deletedProjects: Project[];
  trashOpen: boolean;
  setTrashOpen: (open: boolean) => void;
  onRestoreProject: (id: string) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onPermanentDeleteProject: (id: string) => void;
  deletedKADetails: Record<string, KesimAlani>;
  deletedKALoadingIds: Set<string>;
  onFetchDetail: (id: string) => void;
}

export function TrashSection({
  deletedKesimAlanlari,
  deletedProjects,
  trashOpen,
  setTrashOpen,
  onRestoreProject,
  onRestore,
  onPermanentDelete,
  onPermanentDeleteProject,
  deletedKADetails,
  deletedKALoadingIds,
  onFetchDetail,
}: TrashSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (deletedKesimAlanlari.length === 0 && deletedProjects.length === 0) return null;

  const handleToggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      onFetchDetail(id);
    }
  };

  return (
    <div className="mt-6">
      <button
        type="button"
        className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3 hover:text-foreground transition-colors"
        onClick={() => setTrashOpen(!trashOpen)}
      >
        {trashOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Trash2 className="w-4 h-4" />
        Çöp Kutusu ({deletedKesimAlanlari.length + deletedProjects.length})
      </button>
      {trashOpen && (
        <div className="space-y-2">
          {deletedProjects.map(p => (
            <Card key={`proj-${p.id}`} className="p-3">
              <div className="flex items-center gap-3">
                <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name} <span className="text-xs text-muted-foreground">(Proje)</span></p>
                  <p className="text-[10px] text-muted-foreground">
                    Silinme: {p.deletedAt ? formatDateTime(p.deletedAt) : "—"}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onRestoreProject(p.id)}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Geri Al
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => onPermanentDeleteProject(p.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
          {deletedKesimAlanlari.map(k => {
            const isExpanded = expandedId === k.id;
            const isLoading = deletedKALoadingIds.has(k.id);
            const detail = deletedKADetails[k.id];

            return (
              <Card key={k.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{k.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {k.projectName && <span>Proje: {k.projectName} · </span>}
                      Silinme: {k.deletedAt ? formatDateTime(k.deletedAt) : "—"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => handleToggleExpand(k.id)}
                    title="İçeriği önizle"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onRestore(k.id)}>
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Geri Al
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => onPermanentDelete(k.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-border">
                    {isLoading && !detail ? (
                      <p className="text-[11px] text-muted-foreground">Yükleniyor...</p>
                    ) : detail ? (
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">{detail.donations.length}</span> bağışçı
                          {detail.animalGroups.length > 0 && (
                            <span> · <span className="font-medium text-foreground">{detail.animalGroups.length}</span> hayvan grubu</span>
                          )}
                          {detail.teams && detail.teams.length > 0 && (
                            <span> · <span className="font-medium text-foreground">{detail.teams.length}</span> ekip</span>
                          )}
                        </p>
                        {detail.donations.length > 0 && (
                          <div className="max-h-28 overflow-y-auto space-y-0.5">
                            {detail.donations.slice(0, 10).map(d => (
                              <p key={d.id} className="text-[11px] text-muted-foreground truncate">
                                {d.name || <span className="italic">İsimsiz</span>}
                                {d.shareCount > 1 && <span className="text-[10px] ml-1">×{d.shareCount}</span>}
                              </p>
                            ))}
                            {detail.donations.length > 10 && (
                              <p className="text-[10px] text-muted-foreground italic">
                                +{detail.donations.length - 10} daha...
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Detay yüklenemedi.</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
