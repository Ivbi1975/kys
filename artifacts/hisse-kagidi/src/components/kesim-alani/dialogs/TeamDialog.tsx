import type { KesimAlani } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Edit3, Loader2, Plus, Trash2, UserCog, X } from "lucide-react";

interface TeamDialogProps {
  kesim: KesimAlani;
  teamDialogOpen: boolean;
  setTeamDialogOpen: (open: boolean) => void;
  teamName: string;
  setTeamName: (v: string) => void;
  teamEditId: string | null;
  setTeamEditId: (v: string | null) => void;
  teamColor: string;
  setTeamColor: (v: string) => void;
  teamSaving: boolean;
  handleSaveTeam: () => void;
  handleDeleteTeam: (id: string) => void;
  filterTeam: string;
  setFilterTeam: (v: string) => void;
}

export function TeamDialog({
  kesim, teamDialogOpen, setTeamDialogOpen,
  teamName, setTeamName, teamEditId, setTeamEditId, teamColor, setTeamColor,
  teamSaving, handleSaveTeam, handleDeleteTeam, filterTeam, setFilterTeam,
}: TeamDialogProps) {
  if (!teamDialogOpen) return null;

  return (
    <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            Ekip Yönetimi
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ekip adı"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="flex-1"
            />
            <input
              type="color"
              value={teamColor}
              onChange={(e) => setTeamColor(e.target.value)}
              className="w-10 h-10 rounded border cursor-pointer"
            />
            <Button
              size="sm"
              onClick={handleSaveTeam}
              disabled={!teamName.trim() || teamSaving}
              className="shrink-0"
            >
              {teamSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : teamEditId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </Button>
            {teamEditId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setTeamEditId(null); setTeamName(""); setTeamColor("#3b82f6"); }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {(kesim.teams || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Henüz ekip oluşturulmamış
              </p>
            ) : (
              (kesim.teams || []).map(t => {
                const assignedCount = kesim.animalGroups.filter(g => g.teamId === t.id).length;
                return (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border">
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="flex-1 text-sm font-medium">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground">{assignedCount} grup</span>
                    <button
                      onClick={() => { setTeamEditId(t.id); setTeamName(t.name); setTeamColor(t.color); }}
                      className="p-1 hover:bg-muted rounded"
                      title="Düzenle"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`"${t.name}" ekibini silmek istediğinize emin misiniz?`)) return;
                        handleDeleteTeam(t.id);
                      }}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950 rounded text-red-500"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          {(kesim.teams || []).length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">Ekip Filtresi:</p>
              <div className="flex gap-1 flex-wrap">
                <button
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                    filterTeam === "all" ? "bg-primary/10 border-primary font-semibold" : "hover:bg-muted"
                  }`}
                  onClick={() => setFilterTeam("all")}
                >
                  Tümü
                </button>
                <button
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                    filterTeam === "none" ? "bg-primary/10 border-primary font-semibold" : "hover:bg-muted"
                  }`}
                  onClick={() => setFilterTeam("none")}
                >
                  Ekipsiz
                </button>
                {(kesim.teams || []).map(t => (
                  <button
                    key={t.id}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                      filterTeam === t.id ? "font-semibold" : "hover:opacity-80"
                    }`}
                    style={{
                      backgroundColor: filterTeam === t.id ? t.color + "20" : undefined,
                      borderColor: filterTeam === t.id ? t.color : undefined,
                      color: t.color,
                    }}
                    onClick={() => setFilterTeam(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
