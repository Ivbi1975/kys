import { useState, useCallback } from "react";
import type { KesimAlani } from "@/lib/types";
import { createTeam, updateTeam, deleteTeam, assignTeamAdmin } from "@/lib/api";

interface UseTeamsDeps {
  kesim: KesimAlani | null;
  setKesim: React.Dispatch<React.SetStateAction<KesimAlani | null>>;
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  setFilterTeam: (value: string) => void;
}

export function useTeams({ kesim, setKesim, toast, setFilterTeam }: UseTeamsDeps) {
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamEditId, setTeamEditId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#3b82f6");
  const [teamSaving, setTeamSaving] = useState(false);

  const handleSaveTeam = useCallback(async () => {
    if (!kesim || !teamName.trim()) return;
    setTeamSaving(true);
    try {
      if (teamEditId) {
        const updated = await updateTeam(kesim.id, teamEditId, { name: teamName.trim(), color: teamColor });
        setKesim((prev) =>
          prev ? { ...prev, teams: (prev.teams || []).map((t) => (t.id === teamEditId ? updated : t)) } : prev
        );
        toast({ title: "Ekip güncellendi" });
      } else {
        const created = await createTeam(kesim.id, teamName.trim(), teamColor);
        setKesim((prev) => (prev ? { ...prev, teams: [...(prev.teams || []), created] } : prev));
        toast({ title: "Ekip oluşturuldu" });
      }
      setTeamEditId(null);
      setTeamName("");
      setTeamColor("#3b82f6");
    } catch {
      toast({ title: "Hata", variant: "destructive" });
    } finally {
      setTeamSaving(false);
    }
  }, [kesim, teamEditId, teamName, teamColor, setKesim, toast]);

  const handleDeleteTeam = useCallback(
    async (teamId: string) => {
      if (!kesim) return;
      try {
        await deleteTeam(kesim.id, teamId);
        setKesim((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            teams: (prev.teams || []).filter((t) => t.id !== teamId),
            animalGroups: prev.animalGroups.map((g) => (g.teamId === teamId ? { ...g, teamId: undefined } : g)),
          };
        });
        setFilterTeam("all");
        toast({ title: "Ekip silindi" });
      } catch {
        toast({ title: "Hata", variant: "destructive" });
      }
    },
    [kesim, setKesim, setFilterTeam, toast]
  );

  const handleAssignTeam = useCallback(
    async (groupId: string, teamId: string | null) => {
      if (!kesim) return;
      try {
        await assignTeamAdmin(kesim.id, groupId, teamId);
        setKesim((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            animalGroups: prev.animalGroups.map((g) =>
              g.id === groupId ? { ...g, teamId: teamId || undefined } : g
            ),
          };
        });
      } catch {
        toast({ title: "Hata", variant: "destructive" });
      }
    },
    [kesim, setKesim, toast]
  );

  return {
    teamDialogOpen,
    setTeamDialogOpen,
    teamEditId,
    setTeamEditId,
    teamName,
    setTeamName,
    teamColor,
    setTeamColor,
    teamSaving,
    setTeamSaving,
    handleSaveTeam,
    handleDeleteTeam,
    handleAssignTeam,
  };
}
