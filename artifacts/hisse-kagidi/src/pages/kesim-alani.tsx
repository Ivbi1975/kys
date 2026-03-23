import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Printer,
  ArrowUpDown,
  Wand2,
  Upload,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { Donation, AnimalGroup, KesimAlani } from "@/lib/types";
import { getKesimAlani, updateKesimAlani } from "@/lib/storage";
import { autoGroupDonations, getTotalShares, getRequiredAnimals } from "@/lib/grouping";

type SortField = "name" | "description" | "donationType" | "shareCount";
type SortDir = "asc" | "desc";

function generateId(): string {
  return Math.random().toString(36).substring(2, 12);
}

export default function KesimAlaniPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDonation, setNewDonation] = useState({
    name: "",
    description: "",
    donationType: "",
    shareCount: 1,
  });
  const [editingCell, setEditingCell] = useState<{
    donationId: string;
    field: string;
  } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [dragItem, setDragItem] = useState<{
    groupIdx: number;
    donationIdx: number;
  } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{
    groupIdx: number;
    donationIdx: number;
  } | null>(null);

  useEffect(() => {
    if (params.id) {
      const data = getKesimAlani(params.id);
      if (data) setKesim(data);
      else setLocation("/");
    }
  }, [params.id, setLocation]);

  const save = useCallback(
    (updated: KesimAlani) => {
      setKesim(updated);
      updateKesimAlani(updated);
    },
    []
  );

  function addDonation() {
    if (!kesim || !newDonation.name.trim()) return;
    const donation: Donation = {
      id: generateId(),
      name: newDonation.name.trim(),
      description: newDonation.description.trim(),
      donationType: newDonation.donationType.trim(),
      shareCount: Math.max(1, Math.min(7, newDonation.shareCount)),
    };
    save({ ...kesim, donations: [...kesim.donations, donation] });
    setNewDonation({ name: "", description: "", donationType: "", shareCount: 1 });
    setAddDialogOpen(false);
  }

  function deleteDonation(id: string) {
    if (!kesim) return;
    save({
      ...kesim,
      donations: kesim.donations.filter((d) => d.id !== id),
    });
  }

  function updateDonationField(id: string, field: keyof Donation, value: string | number) {
    if (!kesim) return;
    save({
      ...kesim,
      donations: kesim.donations.map((d) =>
        d.id === id ? { ...d, [field]: value } : d
      ),
    });
  }

  function handlePaste() {
    if (!kesim || !pasteText.trim()) return;
    const lines = pasteText.trim().split("\n");
    const newDonations: Donation[] = [];
    for (const line of lines) {
      const parts = line.split("\t");
      if (parts.length === 0) continue;
      const name = (parts[0] || "").trim();
      const description = (parts[1] || "").trim();
      const donationType = (parts[2] || "").trim();
      const shareCount = Math.max(1, Math.min(7, parseInt(parts[3] || "1", 10) || 1));
      if (name) {
        newDonations.push({
          id: generateId(),
          name,
          description,
          donationType,
          shareCount,
        });
      }
    }
    save({ ...kesim, donations: [...kesim.donations, ...newDonations] });
    setPasteText("");
    setPasteDialogOpen(false);
  }

  function handleAutoGroup() {
    if (!kesim) return;
    const groups = autoGroupDonations(kesim.donations);
    save({ ...kesim, animalGroups: groups });
  }

  function handleSort(field: SortField) {
    if (!kesim) return;
    const newDir = sortField === field && sortDir === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortDir(newDir);
    const sorted = [...kesim.donations].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return newDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return newDir === "asc"
        ? String(aVal).localeCompare(String(bVal), "tr")
        : String(bVal).localeCompare(String(aVal), "tr");
    });
    save({ ...kesim, donations: sorted });
  }

  function moveGroupDonation(
    groupIdx: number,
    fromIdx: number,
    toGroupIdx: number,
    toIdx: number
  ) {
    if (!kesim) return;
    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: [...g.donations],
    }));
    const [item] = groups[groupIdx].donations.splice(fromIdx, 1);
    groups[toGroupIdx].donations.splice(toIdx, 0, item);

    if (groups[groupIdx].donations.length > 7) {
      groups[groupIdx].donations = groups[groupIdx].donations.slice(0, 7);
    }
    if (groups[toGroupIdx].donations.length > 7) {
      const overflow = groups[toGroupIdx].donations.splice(7);
      groups[groupIdx].donations.push(...overflow);
    }

    save({ ...kesim, animalGroups: groups });
  }

  function handleDragStart(groupIdx: number, donationIdx: number) {
    setDragItem({ groupIdx, donationIdx });
  }

  function handleDragOver(
    e: React.DragEvent,
    groupIdx: number,
    donationIdx: number
  ) {
    e.preventDefault();
    setDragOverItem({ groupIdx, donationIdx });
  }

  function handleDrop(groupIdx: number, donationIdx: number) {
    if (dragItem) {
      moveGroupDonation(
        dragItem.groupIdx,
        dragItem.donationIdx,
        groupIdx,
        donationIdx
      );
    }
    setDragItem(null);
    setDragOverItem(null);
  }

  function removeFromGroup(groupIdx: number, donationIdx: number) {
    if (!kesim) return;
    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: [...g.donations],
    }));
    groups[groupIdx].donations.splice(donationIdx, 1);
    groups[groupIdx].donations.push({
      id: generateId(),
      name: "",
      description: "",
      donationType: "",
      shareCount: 1,
    });
    save({ ...kesim, animalGroups: groups });
  }

  function updateGroupDonation(
    groupIdx: number,
    donationIdx: number,
    field: keyof Donation,
    value: string | number
  ) {
    if (!kesim) return;
    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: g.donations.map((d, i) => ({ ...d })),
    }));
    (groups[groupIdx].donations[donationIdx] as any)[field] = value;
    save({ ...kesim, animalGroups: groups });
  }

  function toggleGroupCollapse(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  if (!kesim) return null;

  const totalShares = getTotalShares(kesim.donations);
  const requiredAnimals = getRequiredAnimals(kesim.donations);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{kesim.name}</h1>
            <p className="text-sm text-muted-foreground">
              {kesim.donations.length} bağışçı • {totalShares} hisse •{" "}
              {requiredAnimals} hayvan gerekli
            </p>
          </div>
          <div className="flex gap-2">
            {kesim.animalGroups.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setLocation(`/print/${kesim.id}`)}
              >
                <Printer className="w-4 h-4 mr-2" />
                Yazdır
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Bağışçı Listesi</h2>
              <div className="flex gap-2">
                <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Upload className="w-4 h-4 mr-1" />
                      Excel'den Yapıştır
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Excel'den Veri Yapıştır</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <p className="text-sm text-muted-foreground">
                        Excel'den kopyaladığınız verileri aşağıya yapıştırın.
                        Sütun sırası: <strong>İsim, Açıklama, Bağış Türü, Hisse Sayısı</strong>
                      </p>
                      <textarea
                        className="w-full h-48 p-3 border rounded-md bg-background text-foreground font-mono text-sm resize-none"
                        placeholder="Ali Yılmaz&#9;Ankara&#9;Adak&#9;1&#10;Mehmet Kaya&#9;İstanbul&#9;Kurban&#9;3"
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                      />
                      <Button onClick={handlePaste} className="w-full">
                        Ekle
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Ekle
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Yeni Bağışçı Ekle</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-4">
                      <Input
                        placeholder="İsim"
                        value={newDonation.name}
                        onChange={(e) =>
                          setNewDonation({ ...newDonation, name: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Açıklama"
                        value={newDonation.description}
                        onChange={(e) =>
                          setNewDonation({
                            ...newDonation,
                            description: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Bağış Türü"
                        value={newDonation.donationType}
                        onChange={(e) =>
                          setNewDonation({
                            ...newDonation,
                            donationType: e.target.value,
                          })
                        }
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Hisse:</label>
                        <Select
                          value={String(newDonation.shareCount)}
                          onValueChange={(v) =>
                            setNewDonation({
                              ...newDonation,
                              shareCount: parseInt(v),
                            })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={addDonation} className="w-full">
                        Ekle
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left w-8">#</th>
                      <th
                        className="p-2 text-left cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("name")}
                      >
                        <span className="flex items-center gap-1">
                          İsim
                          {sortField === "name" && (
                            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortField !== "name" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                      <th
                        className="p-2 text-left cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("description")}
                      >
                        <span className="flex items-center gap-1">
                          Açıklama
                          {sortField === "description" && (
                            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortField !== "description" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                      <th
                        className="p-2 text-left cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("donationType")}
                      >
                        <span className="flex items-center gap-1">
                          Bağış Türü
                          {sortField === "donationType" && (
                            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortField !== "donationType" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                      <th
                        className="p-2 text-center cursor-pointer hover:bg-muted w-16"
                        onClick={() => handleSort("shareCount")}
                      >
                        <span className="flex items-center gap-1 justify-center">
                          Hisse
                          {sortField === "shareCount" && (
                            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortField !== "shareCount" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {kesim.donations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          Henüz bağışçı eklenmedi. Yukarıdan ekleyin veya Excel'den yapıştırın.
                        </td>
                      </tr>
                    ) : (
                      kesim.donations.map((d, idx) => (
                        <tr
                          key={d.id}
                          className="border-b hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-2 text-muted-foreground">{idx + 1}</td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "name" ? (
                              <Input
                                className="h-7 text-sm"
                                value={d.name}
                                onChange={(e) =>
                                  updateDonationField(d.id, "name", e.target.value)
                                }
                                onBlur={() => setEditingCell(null)}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text"
                                onClick={() =>
                                  setEditingCell({ donationId: d.id, field: "name" })
                                }
                              >
                                {d.name || "—"}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "description" ? (
                              <Input
                                className="h-7 text-sm"
                                value={d.description}
                                onChange={(e) =>
                                  updateDonationField(
                                    d.id,
                                    "description",
                                    e.target.value
                                  )
                                }
                                onBlur={() => setEditingCell(null)}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text"
                                onClick={() =>
                                  setEditingCell({
                                    donationId: d.id,
                                    field: "description",
                                  })
                                }
                              >
                                {d.description || "—"}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "donationType" ? (
                              <Input
                                className="h-7 text-sm"
                                value={d.donationType}
                                onChange={(e) =>
                                  updateDonationField(
                                    d.id,
                                    "donationType",
                                    e.target.value
                                  )
                                }
                                onBlur={() => setEditingCell(null)}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text"
                                onClick={() =>
                                  setEditingCell({
                                    donationId: d.id,
                                    field: "donationType",
                                  })
                                }
                              >
                                {d.donationType || "—"}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <Select
                              value={String(d.shareCount)}
                              onValueChange={(v) =>
                                updateDonationField(
                                  d.id,
                                  "shareCount",
                                  parseInt(v)
                                )
                              }
                            >
                              <SelectTrigger className="h-7 w-16 text-sm mx-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                                  <SelectItem key={n} value={String(n)}>
                                    {n}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => deleteDonation(d.id)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {kesim.donations.length > 0 && (
              <div className="mt-4 flex gap-2">
                <Button onClick={handleAutoGroup} className="flex-1">
                  <Wand2 className="w-4 h-4 mr-2" />
                  Otomatik Grupla ({requiredAnimals} Hayvan)
                </Button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Hayvan Grupları
                {kesim.animalGroups.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({kesim.animalGroups.length} hayvan)
                  </span>
                )}
              </h2>
            </div>

            {kesim.animalGroups.length === 0 ? (
              <Card className="p-8 text-center">
                <Wand2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Bağışçı listesini doldurup "Otomatik Grupla" butonuna tıklayın
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {kesim.animalGroups.map((group, groupIdx) => {
                  const isCollapsed = collapsedGroups.has(group.id);
                  const filledCount = group.donations.filter(
                    (d) => d.name.trim() !== ""
                  ).length;
                  return (
                    <Card key={group.id} className="overflow-hidden">
                      <div
                        className="flex items-center justify-between p-3 bg-primary/10 cursor-pointer"
                        onClick={() => toggleGroupCollapse(group.id)}
                      >
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                          <h3 className="font-semibold text-sm">
                            {kesim.name} - HAYVAN NO: {group.animalNo}
                          </h3>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {filledCount}/7 dolu
                        </span>
                      </div>
                      {!isCollapsed && (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="p-1.5 w-6"></th>
                              <th className="p-1.5 text-left w-6">#</th>
                              <th className="p-1.5 text-left">İsim</th>
                              <th className="p-1.5 text-left">Açıklama</th>
                              <th className="p-1.5 text-left">Bağış Türü</th>
                              <th className="p-1.5 w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.donations.map((d, dIdx) => (
                              <tr
                                key={d.id}
                                className={`border-b transition-colors ${
                                  dragOverItem?.groupIdx === groupIdx &&
                                  dragOverItem?.donationIdx === dIdx
                                    ? "bg-primary/20"
                                    : "hover:bg-muted/20"
                                }`}
                                draggable
                                onDragStart={() =>
                                  handleDragStart(groupIdx, dIdx)
                                }
                                onDragOver={(e) =>
                                  handleDragOver(e, groupIdx, dIdx)
                                }
                                onDrop={() => handleDrop(groupIdx, dIdx)}
                                onDragEnd={() => {
                                  setDragItem(null);
                                  setDragOverItem(null);
                                }}
                              >
                                <td className="p-1.5 cursor-grab">
                                  <GripVertical className="w-3 h-3 text-muted-foreground" />
                                </td>
                                <td className="p-1.5 text-muted-foreground">
                                  {dIdx + 1}
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    className="h-6 text-xs border-0 bg-transparent p-0"
                                    value={d.name}
                                    onChange={(e) =>
                                      updateGroupDonation(
                                        groupIdx,
                                        dIdx,
                                        "name",
                                        e.target.value
                                      )
                                    }
                                    placeholder="—"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    className="h-6 text-xs border-0 bg-transparent p-0"
                                    value={d.description}
                                    onChange={(e) =>
                                      updateGroupDonation(
                                        groupIdx,
                                        dIdx,
                                        "description",
                                        e.target.value
                                      )
                                    }
                                    placeholder="—"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    className="h-6 text-xs border-0 bg-transparent p-0"
                                    value={d.donationType}
                                    onChange={(e) =>
                                      updateGroupDonation(
                                        groupIdx,
                                        dIdx,
                                        "donationType",
                                        e.target.value
                                      )
                                    }
                                    placeholder="—"
                                  />
                                </td>
                                <td className="p-1.5">
                                  {d.name.trim() && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0"
                                      onClick={() =>
                                        removeFromGroup(groupIdx, dIdx)
                                      }
                                    >
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
