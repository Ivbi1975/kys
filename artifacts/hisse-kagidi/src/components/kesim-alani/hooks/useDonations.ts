import { useState, useCallback } from "react";
import { produce } from "immer";
import type { Donation, KesimAlani } from "@/lib/types";
import { turkishNormalize } from "@/lib/utils";
import { apiSoftDeleteDonation, apiUpdateSingleDonation, flagDonation as apiFlagDonation, unflagDonation as apiUnflagDonation, transferDonationsToKA, fetchKesimAlanlari } from "@/lib/api";
import { trCollator } from "@/lib/grouping";
import { MAX_SHARES_PER_ANIMAL } from "@/lib/constants";
import type { ColumnKey } from "@/lib/useWorkspacePreferences";
import { generateId, FIND_DELETE_COLUMN_LABELS } from "./types";
import type { SaveFn, SortField, KesimDeps } from "./types";

interface UseDonationsDeps extends KesimDeps {
  searchIndex: { search: (q: string) => Set<string> | null };
  debouncedSearchQuery: string;
  sortKeyMap: Map<string, { nameSurname: string; descSurname: string; name: string; description: string; donationType: string; shareCount: number }>;
  editableVisibleColumns: ColumnKey[];
  sortField: SortField | null;
  setSortField: (f: SortField | null) => void;
  sortDir: "asc" | "desc";
  setSortDir: (d: "asc" | "desc") => void;
}

export function useDonations({
  kesim,
  setKesim,
  save,
  history,
  toast,
  searchIndex,
  debouncedSearchQuery,
  sortKeyMap,
  editableVisibleColumns,
  sortField,
  setSortField,
  sortDir,
  setSortDir,
}: UseDonationsDeps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ donationId: string; field: string } | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [personEditDesc, setPersonEditDesc] = useState<string | null>(null);
  const [highlightDonationId, setHighlightDonationId] = useState<string | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<"donationType" | "shareCount" | "notes" | "vekalet">("donationType");
  const [bulkEditValue, setBulkEditValue] = useState("");
  const [personBulkDeleteConfirm, setPersonBulkDeleteConfirm] = useState<string | null>(null);

  const [findDeleteOpen, setFindDeleteOpen] = useState(false);
  const [findDeleteColumn, setFindDeleteColumn] = useState<"name" | "description" | "donationType" | "vekalet" | "notes">("description");
  const [findDeleteValue, setFindDeleteValue] = useState("");
  const [findDeleteConfirm, setFindDeleteConfirm] = useState(false);

  const findDeleteColumnLabel = FIND_DELETE_COLUMN_LABELS;

  const saveSingleDonationField = useCallback(
    (donationId: string, updates: Record<string, string | number | boolean | string[]>) => {
      if (!kesim) return;
      apiUpdateSingleDonation(kesim.id, donationId, updates).catch((err) => {
        const errMsg = err instanceof Error ? err.message : "Bağışçı kaydedilemedi";
        toast({ title: "Kaydetme hatası", description: errMsg, variant: "destructive" });
      });
    },
    [kesim?.id, toast]
  );

  function addDonation(donationData?: {
    name: string;
    description: string;
    donationType: string;
    shareCount: number;
    vekalet: string;
    notes: string;
    phone: string;
  }) {
    if (!kesim || !donationData || !donationData.name.trim()) return;
    const donation: Donation = {
      id: generateId(),
      name: donationData.name.trim(),
      description: donationData.description.trim(),
      donationType: donationData.donationType.trim(),
      shareCount: Math.max(1, Math.min(MAX_SHARES_PER_ANIMAL, donationData.shareCount)),
      vekalet: donationData.vekalet.trim(),
      notes: donationData.notes.trim(),
      phone: donationData.phone?.trim() || "",
    };
    const updated = produce(kesim, (draft) => {
      draft.donations.push(donation);
    });
    save(updated, `Bağışçı eklendi: ${donation.description || donation.name}`);
    setAddDialogOpen(false);
  }

  async function deleteDonation(id: string) {
    if (!kesim) return;
    const target = kesim.donations.find((d) => d.id === id);
    try {
      await apiSoftDeleteDonation(kesim.id, id);
      const updated = produce(kesim, (draft) => {
        draft.donations = draft.donations.filter((d) => d.id !== id);
        for (const g of draft.animalGroups) {
          g.donations = g.donations.filter((d) => d.id !== id);
        }
      });
      setKesim(updated);
      history.push(updated, `Bağışçı silindi: ${target?.description || target?.name || ""}`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast({
        title: "Çöp kutusuna taşındı",
        description: `"${target?.description || target?.name || id}" çöp kutusuna taşındı.`,
      });
    } catch (err) {
      toast({
        title: "Silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  async function sendDonationsToPool(ids: string[]): Promise<void> {
    if (!kesim || !kesim.projectId || ids.length === 0) return;
    try {
      const allKAs = await fetchKesimAlanlari(kesim.projectId);
      const havuzKA = allKAs.find((ka) => ka.name === "__havuz__");
      if (!havuzKA) {
        toast({ title: "Havuz bulunamadı", description: "Bu proje için bağış havuzu tanımlanmamış.", variant: "destructive" });
        return;
      }
      const result = await transferDonationsToKA(kesim.projectId, ids, havuzKA.id);
      if ("conflict" in result && result.conflict) {
        toast({ title: "Çakışma", description: "Bazı bağışçılar havuzda zaten mevcut.", variant: "destructive" });
        return;
      }
      const idSet = new Set(ids);
      const updated = produce(kesim, (draft) => {
        draft.donations = draft.donations.filter((d) => !idSet.has(d.id));
        for (const g of draft.animalGroups) {
          g.donations = g.donations.filter((d) => !idSet.has(d.id));
        }
      });
      setKesim(updated);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast({ title: "Havuza gönderildi", description: `${ids.length} bağışçı bağış havuzuna geri gönderildi.` });
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }

  async function handleFlagDonation(id: string, reason: string) {
    if (!kesim) return;
    try {
      await apiFlagDonation(kesim.projectId || "", id, reason);
      const updated = produce(kesim, (draft) => {
        const d = draft.donations.find((d) => d.id === id);
        if (d) { d.isFlagged = true; d.flagReason = reason; }
        for (const g of draft.animalGroups) {
          const gd = g.donations.find((d) => d.id === id);
          if (gd) { gd.isFlagged = true; gd.flagReason = reason; }
        }
      });
      setKesim(updated);
      toast({ title: "Bağış işaretlendi", description: reason });
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }

  async function handleUnflagDonation(id: string) {
    if (!kesim) return;
    try {
      await apiUnflagDonation(kesim.projectId || "", id);
      const updated = produce(kesim, (draft) => {
        const d = draft.donations.find((d) => d.id === id);
        if (d) { d.isFlagged = false; d.flagReason = ""; }
        for (const g of draft.animalGroups) {
          const gd = g.donations.find((d) => d.id === id);
          if (gd) { gd.isFlagged = false; gd.flagReason = ""; }
        }
      });
      setKesim(updated);
      toast({ title: "İşaret kaldırıldı" });
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }

  async function deleteSelected() {
    if (!kesim || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => apiSoftDeleteDonation(kesim.id, id)));
      const updated = produce(kesim, (draft) => {
        draft.donations = draft.donations.filter((d) => !selectedIds.has(d.id));
        for (const g of draft.animalGroups) {
          g.donations = g.donations.filter((d) => !selectedIds.has(d.id));
        }
      });
      setKesim(updated);
      history.push(updated, `${ids.length} bağışçı silindi`);
      setSelectedIds(new Set());
      toast({
        title: "Çöp kutusuna taşındı",
        description: `${ids.length} bağışçı çöp kutusuna taşındı.`,
      });
    } catch (err) {
      toast({
        title: "Silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!kesim) return;
    if (selectedIds.size === kesim.donations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(kesim.donations.map((d) => d.id)));
    }
  }

  type WritableField = "name" | "description" | "donationType" | "vekalet" | "notes" | "phone";

  function updateDonationField(id: string, field: keyof Donation, value: string | number | boolean) {
    if (!kesim) return;
    if (field === "excluded" && typeof value === "boolean") {
      const target = kesim.donations.find((d) => d.id === id);
      if (target && target.description.trim()) {
        const key = target.description.trim().toLocaleLowerCase("tr");
        const updated = produce(kesim, (draft) => {
          for (const d of draft.donations) {
            if (d.description.trim().toLocaleLowerCase("tr") === key) d.excluded = value;
          }
        });
        save(updated, value ? `Hariç tutuldu: ${target.description}` : `Dahil edildi: ${target.description}`);
        return;
      }
    }
    const updated = produce(kesim, (draft) => {
      const d = draft.donations.find((d) => d.id === id);
      if (!d) return;
      if (field === "excluded" && typeof value === "boolean") d.excluded = value;
      else if (field === "shareCount" && typeof value === "number") d.shareCount = value;
      else if (typeof value === "string") d[field as WritableField] = value;
    });
    setKesim(updated);
    history.push(updated, `Bağışçı güncellendi`);
    saveSingleDonationField(id, { [field]: value });
  }

  function toggleDonationAiCategory(donationId: string, category: string) {
    if (!kesim) return;
    const updated = produce(kesim, (draft) => {
      const toggle = (d: { id: string; aiCategories?: string[] }) => {
        if (d.id !== donationId) return;
        const existing = d.aiCategories || [];
        const has = existing.includes(category);
        d.aiCategories = has ? existing.filter((c) => c !== category) : [...existing, category];
      };
      draft.donations.forEach(toggle);
      for (const g of draft.animalGroups) {
        g.donations.forEach(toggle);
      }
    });
    setKesim(updated);
    history.push(updated, `AI Kategori güncellendi`);
  }

  function toggleDonationTag(donationId: string, tagId: string) {
    if (!kesim) return;
    const updated = produce(kesim, (draft) => {
      const toggle = (d: { id: string; tags?: string[] }) => {
        if (d.id !== donationId) return;
        const existing = d.tags || [];
        const has = existing.includes(tagId);
        d.tags = has ? existing.filter((t) => t !== tagId) : [...existing, tagId];
      };
      draft.donations.forEach(toggle);
      for (const g of draft.animalGroups) {
        g.donations.forEach(toggle);
      }
    });
    save(updated, `Etiket güncellendi`);
  }

  function bulkExcludeByDesc(description: string, excluded: boolean) {
    if (!kesim) return;
    const key = description.trim().toLocaleLowerCase("tr");
    const updated = produce(kesim, (draft) => {
      for (const d of draft.donations) {
        if (d.description.trim().toLocaleLowerCase("tr") === key) d.excluded = excluded;
      }
    });
    save(updated, excluded ? `Toplu hariç tutuldu: ${description}` : `Toplu dahil edildi: ${description}`);
  }

  async function bulkDeleteByDesc(description: string) {
    if (!kesim) return;
    const key = description.trim().toLocaleLowerCase("tr");
    const toDelete = kesim.donations.filter((d) => d.description.trim().toLocaleLowerCase("tr") === key);
    if (toDelete.length === 0) return;
    try {
      await Promise.all(toDelete.map((d) => apiSoftDeleteDonation(kesim.id, d.id)));
      const deleteIds = new Set(toDelete.map((d) => d.id));
      const updated = produce(kesim, (draft) => {
        draft.donations = draft.donations.filter((d) => !deleteIds.has(d.id));
        for (const g of draft.animalGroups) {
          g.donations = g.donations.filter((d) => !deleteIds.has(d.id));
        }
      });
      setKesim(updated);
      history.push(updated, `Toplu silindi: ${description}`);
      setPersonEditDesc(null);
      toast({
        title: "Çöp kutusuna taşındı",
        description: `${toDelete.length} bağışçı çöp kutusuna taşındı.`,
      });
    } catch (err) {
      toast({
        title: "Silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  function applyBulkEdit() {
    if (!kesim || selectedIds.size === 0) return;
    const updated = produce(kesim, (draft) => {
      for (const d of draft.donations) {
        if (!selectedIds.has(d.id)) continue;
        if (bulkEditField === "shareCount") {
          d.shareCount = Math.max(1, Math.min(MAX_SHARES_PER_ANIMAL, parseInt(bulkEditValue) || 1));
        } else {
          d[bulkEditField as WritableField] = bulkEditValue;
        }
      }
    });
    save(updated, `${selectedIds.size} bağışçı toplu düzenlendi`);
    setBulkEditOpen(false);
    setBulkEditValue("");
  }

  function startEditing(donationId: string, field: string) {
    if (!kesim) return;
    const donation = kesim.donations.find((d) => d.id === donationId);
    if (!donation) return;
    const currentVal = String(donation[field as keyof Donation] ?? "");
    setEditDraft(currentVal);
    setEditingCell({ donationId, field });
  }

  function commitEdit() {
    if (!editingCell || !kesim) {
      setEditingCell(null);
      return;
    }
    const donation = kesim.donations.find((d) => d.id === editingCell.donationId);
    if (!donation) {
      setEditingCell(null);
      return;
    }
    const currentVal = String(donation[editingCell.field as keyof Donation] ?? "");
    if (editDraft !== currentVal) {
      updateDonationField(editingCell.donationId, editingCell.field as keyof Donation, editDraft);
    }
    setEditingCell(null);
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditDraft("");
  }

  const DONOR_EDITABLE_FIELDS = ["vekalet", "description", "name", "donationType", "notes"] as const;

  function handleDonorCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>, donationId: string, field: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      commitEdit();
      const currentFieldIdx = DONOR_EDITABLE_FIELDS.indexOf(field as typeof DONOR_EDITABLE_FIELDS[number]);
      if (currentFieldIdx < 0) return;
      const matchedTabIds = debouncedSearchQuery.trim() ? searchIndex.search(debouncedSearchQuery) : null;
      const donations = matchedTabIds ? kesim!.donations.filter((d) => matchedTabIds.has(d.id)) : kesim!.donations;
      const donationIdx = donations.findIndex((d) => d.id === donationId);
      if (donationIdx < 0) return;

      if (e.shiftKey) {
        if (currentFieldIdx > 0) {
          setTimeout(() => startEditing(donationId, DONOR_EDITABLE_FIELDS[currentFieldIdx - 1]), 0);
        } else if (donationIdx > 0) {
          setTimeout(
            () =>
              startEditing(
                donations[donationIdx - 1].id,
                DONOR_EDITABLE_FIELDS[DONOR_EDITABLE_FIELDS.length - 1]
              ),
            0
          );
        }
      } else {
        if (currentFieldIdx < DONOR_EDITABLE_FIELDS.length - 1) {
          setTimeout(() => startEditing(donationId, DONOR_EDITABLE_FIELDS[currentFieldIdx + 1]), 0);
        } else if (donationIdx < donations.length - 1) {
          setTimeout(() => startEditing(donations[donationIdx + 1].id, DONOR_EDITABLE_FIELDS[0]), 0);
        }
      }
    }
  }

  function handleSort(field: SortField) {
    if (!kesim) return;
    const newDir = sortField === field && sortDir === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortDir(newDir);
    const dir = newDir === "asc" ? 1 : -1;
    const sorted = [...kesim.donations].sort((a, b) => {
      const ka = sortKeyMap.get(a.id);
      const kb = sortKeyMap.get(b.id);
      if (!ka || !kb) return 0;
      if (field === "shareCount") {
        return dir * (ka.shareCount - kb.shareCount);
      }
      if (field === "description") {
        const surnameCmp = trCollator.compare(ka.descSurname, kb.descSurname);
        if (surnameCmp !== 0) return dir * surnameCmp;
        return dir * trCollator.compare(ka.description, kb.description);
      }
      if (field === "name") {
        const surnameCmp = trCollator.compare(ka.nameSurname, kb.nameSurname);
        if (surnameCmp !== 0) return dir * surnameCmp;
        return dir * trCollator.compare(ka.name, kb.name);
      }
      return dir * trCollator.compare(ka[field], kb[field]);
    });
    const updated = produce(kesim, (draft) => {
      draft.donations = sorted;
    });
    save(updated, `Sıralama değiştirildi`, true);
  }

  function getFindDeleteMatches() {
    if (!kesim || !findDeleteValue.trim()) return [];
    const q = turkishNormalize(findDeleteValue.trim());
    return kesim.donations.filter((d) => {
      const val = turkishNormalize((d[findDeleteColumn] || "").toString());
      return val.includes(q);
    });
  }

  async function executeFindDelete() {
    if (!kesim) return;
    const matches = getFindDeleteMatches();
    if (matches.length === 0) return;
    const matchIds = new Set(matches.map((d) => d.id));
    try {
      await Promise.all(matches.map((d) => apiSoftDeleteDonation(kesim.id, d.id)));
      const updated = produce(kesim, (draft) => {
        draft.donations = draft.donations.filter((d) => !matchIds.has(d.id));
        for (const g of draft.animalGroups) {
          g.donations = g.donations.filter((d) => !matchIds.has(d.id));
        }
      });
      setKesim(updated);
      history.push(
        updated,
        `Toplu silindi: ${matches.length} bağışçı (${findDeleteColumnLabel[findDeleteColumn]}: "${findDeleteValue}")`
      );
      setFindDeleteOpen(false);
      setFindDeleteValue("");
      setFindDeleteConfirm(false);
      toast({
        title: "Çöp kutusuna taşındı",
        description: `${matches.length} bağışçı çöp kutusuna taşındı.`,
      });
    } catch (err) {
      toast({
        title: "Silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  function applySplitShare(donationId: string, splitA: number, splitB: number) {
    if (!kesim) return;
    const donor = kesim.donations.find((d) => d.id === donationId);
    if (!donor) return;
    const baseName = donor.description || donor.name;
    const newDonor: Donation = {
      ...donor,
      id: generateId(),
      shareCount: splitB,
      description: `${baseName} (2/${splitA + splitB})`,
    };
    const updated = produce(kesim, (draft) => {
      const idx = draft.donations.findIndex((d) => d.id === donationId);
      if (idx >= 0) {
        draft.donations[idx].shareCount = splitA;
        draft.donations[idx].description = `${baseName} (1/${splitA + splitB})`;
      }
      draft.donations.push(newDonor);
    });
    save(updated, `${baseName}: ${splitA + splitB} hisse → ${splitA}+${splitB} olarak bölündü`);
  }

  function getSplitOptions(totalShares: number): Array<[number, number]> {
    const options: Array<[number, number]> = [];
    const maxFirst = Math.min(totalShares - 1, MAX_SHARES_PER_ANIMAL);
    for (let first = maxFirst; first >= Math.ceil(totalShares / 2); first--) {
      const second = totalShares - first;
      if (second >= 1 && second <= MAX_SHARES_PER_ANIMAL) {
        options.push([first, second]);
      }
    }
    return options;
  }

  return {
    addDialogOpen,
    setAddDialogOpen,
    editingCell,
    setEditingCell,
    editDraft,
    setEditDraft,
    selectedIds,
    setSelectedIds,
    personEditDesc,
    setPersonEditDesc,
    highlightDonationId,
    setHighlightDonationId,
    bulkEditOpen,
    setBulkEditOpen,
    bulkEditField,
    setBulkEditField,
    bulkEditValue,
    setBulkEditValue,
    personBulkDeleteConfirm,
    setPersonBulkDeleteConfirm,
    findDeleteOpen,
    setFindDeleteOpen,
    findDeleteColumn,
    setFindDeleteColumn,
    findDeleteValue,
    setFindDeleteValue,
    findDeleteConfirm,
    setFindDeleteConfirm,
    findDeleteColumnLabel,
    saveSingleDonationField,
    addDonation,
    deleteDonation,
    sendDonationsToPool,
    handleFlagDonation,
    handleUnflagDonation,
    deleteSelected,
    toggleSelect,
    toggleSelectAll,
    updateDonationField,
    toggleDonationTag,
    toggleDonationAiCategory,
    bulkExcludeByDesc,
    bulkDeleteByDesc,
    applyBulkEdit,
    startEditing,
    commitEdit,
    cancelEdit,
    handleDonorCellKeyDown,
    handleSort,
    getFindDeleteMatches,
    executeFindDelete,
    applySplitShare,
    getSplitOptions,
  };
}
