import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  AlertTriangle,
  Search,
  RefreshCw,
  Flag,
  Brain,
  Filter,
  X,
} from "lucide-react";
import {
  fetchFlaggedDonations,
  unflagDonation,
  fetchCatismaTespiti,
} from "@/lib/api";
import type { FlaggedDonation, Conflict } from "@/lib/api";

type ProblemRow = Omit<FlaggedDonation, "problemType"> & {
  conflictInfo?: string;
  problemType: "manual" | "ai_warning" | "conflict" | "resolved";
};

export default function SorunluBagislarPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FlaggedDonation[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [kaFilter, setKaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [flaggedRes, conflictRes] = await Promise.all([
        fetchFlaggedDonations(projectId),
        fetchCatismaTespiti(projectId),
      ]);
      setItems(flaggedRes.items);
      setConflicts(conflictRes.conflicts);
    } catch (err) {
      toast({
        title: "Veri yüklenemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUnflag = useCallback(async (donationId: string) => {
    try {
      await unflagDonation(donationId);
      setItems(prev => prev.map(d => {
        if (d.id !== donationId) return d;
        return {
          ...d,
          isFlagged: false,
          flagReason: "",
          flagResolvedAt: new Date().toISOString(),
          problemType: d.aiWarnings ? ("ai_warning" as const) : ("resolved" as const),
        };
      }));
      toast({ title: "Sorun kaldırıldı" });
    } catch (err) {
      toast({
        title: "Hata",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }, [toast]);

  const conflictDonationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of conflicts) {
      for (const e of c.entries) {
        ids.add(e.donationId);
      }
    }
    return ids;
  }, [conflicts]);

  const allProblems = useMemo(() => {
    const result: ProblemRow[] = [];

    for (const item of items) {
      const hasConflict = conflictDonationIds.has(item.id);
      result.push({
        ...item,
        conflictInfo: hasConflict ? "Vekalet çatışması" : undefined,
      });
    }

    for (const c of conflicts) {
      for (const e of c.entries) {
        if (!items.some(i => i.id === e.donationId)) {
          result.push({
            id: e.donationId,
            name: e.donationName,
            description: e.donationDescription,
            donationType: "",
            shareCount: 0,
            vekalet: "",
            notes: e.donationNotes,
            phone: "",
            excluded: false,
            isFlagged: false,
            flagReason: "",
            aiWarnings: "",
            aiCategories: [],
            kesimAlaniId: e.kesimAlaniId,
            kesimAlaniName: e.kesimAlaniName,
            groups: e.animalGroupId ? [{ groupId: e.animalGroupId, animalNo: e.animalGroupNo ?? 0, slotIndex: 0 }] : [],
            flagResolvedAt: null,
            problemType: "conflict",
            conflictInfo: `Çatışma: ${c.displayName}`,
          });
        }
      }
    }

    return result;
  }, [items, conflicts, conflictDonationIds]);

  const uniqueKAs = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of allProblems) {
      if (p.kesimAlaniId && p.kesimAlaniName) {
        map.set(p.kesimAlaniId, p.kesimAlaniName);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allProblems]);

  const filtered = useMemo(() => {
    let result = allProblems;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.vekalet.toLowerCase().includes(q) ||
        (d.flagReason || "").toLowerCase().includes(q) ||
        (d.notes || "").toLowerCase().includes(q)
      );
    }

    if (typeFilter !== "all") {
      if (typeFilter === "manual") {
        result = result.filter(d => d.isFlagged);
      } else if (typeFilter === "ai_warning") {
        result = result.filter(d => d.aiWarnings && !d.isFlagged);
      } else if (typeFilter === "conflict") {
        result = result.filter(d => d.conflictInfo);
      }
    }

    if (kaFilter !== "all") {
      result = result.filter(d => d.kesimAlaniId === kaFilter);
    }

    if (statusFilter !== "all") {
      if (statusFilter === "unresolved") {
        result = result.filter(d => d.isFlagged || d.problemType === "conflict" || d.problemType === "ai_warning");
      } else if (statusFilter === "resolved") {
        result = result.filter(d => d.problemType === "resolved" || (!!d.flagResolvedAt && !d.isFlagged));
      }
    }

    return result;
  }, [allProblems, searchQuery, typeFilter, kaFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: allProblems.length,
    manual: allProblems.filter(d => d.isFlagged).length,
    aiWarning: allProblems.filter(d => d.aiWarnings && !d.isFlagged).length,
    conflict: allProblems.filter(d => d.conflictInfo && !d.isFlagged && !d.aiWarnings).length,
  }), [allProblems]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/proje/${projectId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              Sorunlu Bağışlar
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {stats.total} sorunlu bağış tespit edildi
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="p-3 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats.manual}</p>
                <p className="text-xs text-muted-foreground">Manuel İşaretli</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 border-violet-200 dark:border-violet-800">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-600" />
              <div>
                <p className="text-2xl font-bold text-violet-700">{stats.aiWarning}</p>
                <p className="text-xs text-muted-foreground">AI Uyarısı</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-orange-700">{stats.conflict}</p>
                <p className="text-xs text-muted-foreground">Vekalet Çatışması</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Bağışçı ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Sorun Türü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Sorunlar</SelectItem>
              <SelectItem value="manual">Manuel İşaretli</SelectItem>
              <SelectItem value="ai_warning">AI Uyarısı</SelectItem>
              <SelectItem value="conflict">Vekalet Çatışması</SelectItem>
            </SelectContent>
          </Select>
          <Select value={kaFilter} onValueChange={setKaFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Kesim Alanı" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Alanlar</SelectItem>
              {uniqueKAs.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="unresolved">Çözülmemiş</SelectItem>
              <SelectItem value="resolved">Çözülmüş</SelectItem>
            </SelectContent>
          </Select>
          {(searchQuery || typeFilter !== "all" || kaFilter !== "all" || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => { setSearchQuery(""); setTypeFilter("all"); setKaFilter("all"); setStatusFilter("all"); }}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Temizle
            </Button>
          )}
        </div>

        {loading ? (
          <Card className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {allProblems.length === 0 ? "Sorunlu bağış bulunamadı" : "Filtreye uygun sonuç yok"}
            </p>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground w-[60px]">Tür</th>
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground">Vekalet</th>
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground">Açıklama</th>
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground">İsim</th>
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground">Cins</th>
                    <th className="p-2 text-center text-xs font-medium text-muted-foreground w-[60px]">Hisse</th>
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground">Sorun</th>
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground">Konum</th>
                    <th className="p-2 text-center text-xs font-medium text-muted-foreground w-[80px]">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const conflictInfo = d.conflictInfo;
                    const problemBadges: { label: string; color: string }[] = [];
                    if (d.isFlagged) problemBadges.push({ label: "Manuel", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" });
                    if (d.aiWarnings) problemBadges.push({ label: "AI", color: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200" });
                    if (conflictInfo) problemBadges.push({ label: "Çatışma", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" });

                    const problemText = [
                      d.flagReason,
                      d.aiWarnings,
                      conflictInfo,
                    ].filter(Boolean).join(" · ");

                    const locationParts = [d.kesimAlaniName];
                    if (d.groups.length > 0) {
                      const g = d.groups[0];
                      locationParts.push(`Hayvan #${g.animalNo} (Sıra ${g.slotIndex + 1})`);
                    } else {
                      locationParts.push("Grupsuz");
                    }

                    return (
                      <tr key={d.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-2">
                          <div className="flex gap-0.5 flex-wrap">
                            {problemBadges.map((b) => (
                              <span key={b.label} className={`px-1.5 py-0 rounded-full text-[9px] font-medium ${b.color}`}>{b.label}</span>
                            ))}
                          </div>
                        </td>
                        <td className="p-2 font-mono text-xs">{d.vekalet || "—"}</td>
                        <td className="p-2 truncate max-w-[150px]" title={d.description}>{d.description || "—"}</td>
                        <td className="p-2 font-medium truncate max-w-[120px]">{d.name || "—"}</td>
                        <td className="p-2 text-xs">{d.donationType || "—"}</td>
                        <td className="p-2 text-center font-bold">{d.shareCount || "—"}</td>
                        <td className="p-2 text-xs max-w-[200px]">
                          <span className="truncate block" title={problemText}>{problemText || "—"}</span>
                        </td>
                        <td className="p-2 text-xs">
                          <span className="truncate block max-w-[120px]" title={locationParts.join(" · ")}>
                            {locationParts.join(" · ")}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          {d.isFlagged && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-amber-700 hover:text-amber-900"
                              onClick={() => handleUnflag(d.id)}
                            >
                              Kaldır
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
