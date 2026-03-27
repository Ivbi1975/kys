import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, FolderOpen, Archive, RotateCcw } from "lucide-react";
import type { Project } from "@/lib/types";
import { formatDateTime } from "@/lib/formatting";

interface ArchiveSectionProps {
  archivedProjects: Project[];
  archiveOpen: boolean;
  setArchiveOpen: (open: boolean) => void;
  onUnarchiveProject: (id: string) => void;
}

export function ArchiveSection({ archivedProjects, archiveOpen, setArchiveOpen, onUnarchiveProject }: ArchiveSectionProps) {
  if (archivedProjects.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        type="button"
        className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3 hover:text-foreground transition-colors"
        onClick={() => setArchiveOpen(!archiveOpen)}
      >
        {archiveOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Archive className="w-4 h-4" />
        Arşiv ({archivedProjects.length})
      </button>
      {archiveOpen && (
        <div className="space-y-2">
          {archivedProjects.map(p => (
            <Card key={`arch-${p.id}`} className="p-3">
              <div className="flex items-center gap-3">
                <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name} <span className="text-xs text-muted-foreground">(Arşivlenmiş Proje)</span></p>
                  <p className="text-[10px] text-muted-foreground">
                    Arşivlenme: {p.archivedAt ? formatDateTime(p.archivedAt) : "—"}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onUnarchiveProject(p.id)}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Arşivden Çıkar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
