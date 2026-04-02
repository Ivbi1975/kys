import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, Trash2, FolderOpen, RotateCcw } from "lucide-react";
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
}: TrashSectionProps) {
  if (deletedKesimAlanlari.length === 0 && deletedProjects.length === 0) return null;

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
          {deletedKesimAlanlari.map(k => (
            <Card key={k.id} className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{k.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {k.projectName && <span>Proje: {k.projectName} · </span>}
                    Silinme: {k.deletedAt ? formatDateTime(k.deletedAt) : "—"}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onRestore(k.id)}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Geri Al
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => onPermanentDelete(k.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
