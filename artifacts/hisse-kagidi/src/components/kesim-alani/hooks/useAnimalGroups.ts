import { useState, useCallback } from "react";
import { produce } from "immer";
import type { Donation, AnimalGroup, KesimAlani, ColorTag } from "@/lib/types";
import { turkishNormalize } from "@/lib/utils";
import { apiSoftDeleteDonation, apiUpdateSingleGroup, apiUpdateSingleDonation } from "@/lib/api";
import { checkGroupConflicts } from "@/lib/grouping";
import { MAX_SHARES_PER_ANIMAL } from "@/lib/constants";
import type { ColumnKey } from "@/lib/useWorkspacePreferences";
import { generateId } from "./types";
import type { SaveFn, KesimDeps } from "./types";

interface UseAnimalGroupsDeps extends KesimDeps {
  workspace: {
    visibleColumns: ColumnKey[];
    prefs: { columnOrder: ColumnKey[] };
    setColumnOrder: (order: ColumnKey[]) => void;
  };
  setConflicts: React.Dispatch<React.SetStateAction<import("@/lib/grouping").ConflictInfo[]>>;
}

export function useAnimalGroups({ kesim, setKesim, save, history, toast, workspace, setConflicts }: UseAnimalGroupsDeps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [selectedGroupDonations, setSelectedGroupDonations] = useState<Set<string>>(new Set());
  const [bulkMoveTargetGroup, setBulkMoveTargetGroup] = useState<number>(-1);
  const [bulkGroupEditOpen, setBulkGroupEditOpen] = useState(false);
  const [bulkGroupEditField, setBulkGroupEditField] = useState<"donationType" | "notes">("donationType");
  const [bulkGroupEditValue, setBulkGroupEditValue] = useState("");
  const [splitGroupDialog, setSplitGroupDialog] = useState<{ groupIdx: number; splitAt: number } | null>(null);
  const [columnDragItem, setColumnDragItem] = useState<ColumnKey | null>(null);
  const [removedFromGroupIds, setRemovedFromGroupIds] = useState<Set<string>>(new Set());
  const [rangeLockInput, setRangeLockInput] = useState("");

  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [groupSearchMatchIdx, setGroupSearchMatchIdx] = useState(0);

  const [groupFindDeleteOpen, setGroupFindDeleteOpen] = useState(false);
  const [groupFindDeleteColumn, setGroupFindDeleteColumn] = useState<"name" | "description" | "donationType" | "vekalet" | "notes">("description");
  const [groupFindDeleteValue, setGroupFindDeleteValue] = useState("");
  const [groupFindDeleteConfirm, setGroupFindDeleteConfirm] = useState(false);

  const saveSingleGroupField = useCallback(
    (groupId: string, updates: Record<string, unknown>) => {
      if (!kesim) return;
      apiUpdateSingleGroup(kesim.id, groupId, updates).catch((err) => {
        const errMsg = err instanceof Error ? err.message : "Grup kaydedilemedi";
        toast({ title: "Kaydetme hatası", description: errMsg, variant: "destructive" });
      });
    },
    [kesim?.id, toast]
  );

  function isGroupLocked(groupIdx: number): boolean {
    return !!kesim?.animalGroups[groupIdx]?.locked;
  }

  function removeFromGroup(groupIdx: number, donationIdx: number) {
    if (!kesim) return;
    if (isGroupLocked(groupIdx)) return;
    const updated = produce(kesim, (draft) => {
      draft.animalGroups[groupIdx].donations.splice(donationIdx, 1);
      draft.animalGroups[groupIdx].donations.push({
        id: generateId(),
        name: "",
        description: "",
        donationType: "",
        shareCount: 1,
        vekalet: "",
        notes: "",
      });
    });
    save(updated, `Gruptan çıkarıldı`, false, "groups");
  }

  const updateGroupDonation = useCallback(
    (groupIdx: number, donationIdx: number, field: keyof Donation, value: string | number) => {
      if (!kesim) return;
      if (isGroupLocked(groupIdx)) return;
      const donation = kesim.animalGroups[groupIdx]?.donations[donationIdx];
      if (!donation) return;
      if (donation[field] === value) return;

      const updated = produce(kesim, (draft) => {
        const donorIdx = draft.donations.findIndex((d) => d.id === donation.id);
        if (donorIdx >= 0) (draft.donations[donorIdx] as any)[field] = value;
        (draft.animalGroups[groupIdx].donations[donationIdx] as any)[field] = value;
      });
      setKesim(updated);
      history.push(updated, `Grup bağışçısı güncellendi`);

      apiUpdateSingleDonation(kesim.id, donation.id, { [field]: value }).catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : "Bağışçı kaydedilemedi";
        toast({ title: "Kaydetme hatası", description: errMsg, variant: "destructive" });
      });
    },
    [kesim, history, setKesim, toast]
  );

  function setGroupColorTag(groupIdx: number, tag: ColorTag) {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    const updated = produce(kesim, (draft) => {
      draft.animalGroups[groupIdx].colorTag = tag;
    });
    setKesim(updated);
    history.push(updated, `Grup rengi değiştirildi: Hayvan ${group.animalNo}`);
    saveSingleGroupField(group.id, { colorTag: tag });
  }

  const updateGroupNotes = useCallback(
    (groupIdx: number, notes: string) => {
      if (!kesim) return;
      const group = kesim.animalGroups[groupIdx];
      if (!group) return;
      const updated = produce(kesim, (draft) => {
        draft.animalGroups[groupIdx].notes = notes;
      });
      setKesim(updated);
      history.push(updated, `Grup notu güncellendi: Hayvan ${group.animalNo}`);
      saveSingleGroupField(group.id, { notes });
    },
    [kesim, saveSingleGroupField, history, setKesim]
  );

  function toggleGroupLock(groupIdx: number) {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    const newLocked = !group.locked;
    const updated = produce(kesim, (draft) => {
      draft.animalGroups[groupIdx].locked = newLocked;
    });
    setKesim(updated);
    history.push(updated, `Grup ${newLocked ? "kilitlendi" : "kilidi açıldı"}: Hayvan ${group.animalNo}`);
    saveSingleGroupField(group.id, { locked: newLocked });
  }

  function parseRangeLockInput(input: string): number[] {
    const results = new Set<number>();
    const parts = input
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          results.add(i);
        }
      } else if (/^\d+$/.test(part)) {
        results.add(parseInt(part));
      }
    }
    return Array.from(results).sort((a, b) => a - b);
  }

  function applyRangeLock(lock: boolean) {
    if (!kesim) return;
    const targetNos = parseRangeLockInput(rangeLockInput);
    if (targetNos.length === 0) return;
    const existingNos = new Set(kesim.animalGroups.map((g) => g.animalNo));
    const validNos = targetNos.filter((n) => existingNos.has(n));
    if (validNos.length === 0) return;
    const targetSet = new Set(validNos);
    const updated = produce(kesim, (draft) => {
      for (const g of draft.animalGroups) {
        if (targetSet.has(g.animalNo)) g.locked = lock;
      }
    });
    save(
      updated,
      `${validNos.length} grup ${lock ? "kilitlendi" : "kilidi açıldı"}: ${rangeLockInput}`,
      false,
      "groups"
    );
    setRangeLockInput("");
  }

  function lockAllGroups() {
    if (!kesim) return;
    const updated = produce(kesim, (draft) => {
      for (const g of draft.animalGroups) g.locked = true;
    });
    save(updated, `Tüm gruplar kilitlendi`, false, "groups");
  }

  function unlockAllGroups() {
    if (!kesim) return;
    const updated = produce(kesim, (draft) => {
      for (const g of draft.animalGroups) g.locked = false;
    });
    save(updated, `Tüm grupların kilidi açıldı`, false, "groups");
  }

  function deleteAnimalGroup(groupIdx: number) {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    if (!group || group.locked) return;
    const filledCount = group.donations.filter((d) => d.name.trim()).length;
    const updated = produce(kesim, (draft) => {
      draft.animalGroups.splice(groupIdx, 1);
      for (let i = 0; i < draft.animalGroups.length; i++) {
        draft.animalGroups[i].animalNo = i + 1;
      }
    });
    save(
      updated,
      `Grup silindi: Hayvan ${group.animalNo} (${filledCount} bağışçı grupsuz kaldı)`,
      true,
      "groups"
    );
    const found = checkGroupConflicts(updated.animalGroups);
    setConflicts(found);
  }

  function openSplitGroupDialog(groupIdx: number) {
    if (!kesim) return;
    if (isGroupLocked(groupIdx)) return;
    const group = kesim.animalGroups[groupIdx];
    const filled = group.donations.filter((d) => d.name.trim() !== "");
    if (filled.length <= 1) return;
    const midpoint = Math.ceil(filled.length / 2);
    setSplitGroupDialog({ groupIdx, splitAt: midpoint });
  }

  function executeSplitGroup() {
    if (!kesim || !splitGroupDialog) return;
    const { groupIdx, splitAt } = splitGroupDialog;
    if (isGroupLocked(groupIdx)) return;
    const group = kesim.animalGroups[groupIdx];
    const filled = group.donations.filter((d) => d.name.trim() !== "");
    if (filled.length <= 1 || splitAt <= 0 || splitAt >= filled.length) return;

    const firstHalf = [...filled.slice(0, splitAt)];
    const secondHalf = [...filled.slice(splitAt)];

    const emptyDonation = (): Donation => ({
      id: generateId(),
      name: "",
      description: "",
      donationType: "",
      shareCount: 1,
      vekalet: "",
      notes: "",
    });

    while (firstHalf.length < MAX_SHARES_PER_ANIMAL) firstHalf.push(emptyDonation());
    while (secondHalf.length < MAX_SHARES_PER_ANIMAL) secondHalf.push(emptyDonation());

    const updated = produce(kesim, (draft) => {
      draft.animalGroups[groupIdx].donations = firstHalf.slice(0, MAX_SHARES_PER_ANIMAL);
      const newGroup: AnimalGroup = {
        id: generateId(),
        animalNo: draft.animalGroups.length + 1,
        donations: secondHalf.slice(0, MAX_SHARES_PER_ANIMAL),
      };
      draft.animalGroups.splice(groupIdx + 1, 0, newGroup);
      for (let i = 0; i < draft.animalGroups.length; i++) {
        draft.animalGroups[i].animalNo = i + 1;
      }
    });
    save(
      updated,
      `Grup bölündü: Hayvan ${group.animalNo} → ${splitAt}/${filled.length - splitAt}`,
      false,
      "groups"
    );
    setSplitGroupDialog(null);
  }

  const toggleGroupSelect = useCallback((groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  function mergeSelectedGroups() {
    if (!kesim || selectedGroupIds.size < 2) return;
    const groupsToMerge = kesim.animalGroups.filter((g) => selectedGroupIds.has(g.id));
    if (groupsToMerge.some((g) => g.locked)) return;

    const allDonations = groupsToMerge.flatMap((g) => g.donations).filter((d) => d.name.trim() !== "");
    const remainingGroups = kesim.animalGroups.filter((g) => !selectedGroupIds.has(g.id));

    const emptyDonation = (): Donation => ({
      id: generateId(),
      name: "",
      description: "",
      donationType: "",
      shareCount: 1,
      vekalet: "",
      notes: "",
    });

    const newGroups: AnimalGroup[] = [];
    let currentBatch: Donation[] = [];

    for (const d of allDonations) {
      currentBatch.push(d);
      if (currentBatch.length === MAX_SHARES_PER_ANIMAL) {
        newGroups.push({
          id: generateId(),
          animalNo: 0,
          donations: [...currentBatch],
        });
        currentBatch = [];
      }
    }

    if (currentBatch.length > 0) {
      while (currentBatch.length < MAX_SHARES_PER_ANIMAL) currentBatch.push(emptyDonation());
      newGroups.push({
        id: generateId(),
        animalNo: 0,
        donations: currentBatch,
      });
    }

    const firstMergedIdx = kesim.animalGroups.findIndex((g) => selectedGroupIds.has(g.id));
    const updated = produce(kesim, (draft) => {
      draft.animalGroups = draft.animalGroups.filter((g) => !selectedGroupIds.has(g.id));
      draft.animalGroups.splice(firstMergedIdx, 0, ...newGroups);
      for (let i = 0; i < draft.animalGroups.length; i++) {
        draft.animalGroups[i].animalNo = i + 1;
      }
    });

    save(updated, `${groupsToMerge.length} grup birleştirildi`, false, "groups");
    setSelectedGroupIds(new Set());
  }

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const toggleGroupDonationSelect = useCallback((donationId: string) => {
    setSelectedGroupDonations((prev) => {
      const next = new Set(prev);
      if (next.has(donationId)) next.delete(donationId);
      else next.add(donationId);
      return next;
    });
  }, []);

  function bulkRemoveFromGroups() {
    if (!kesim || selectedGroupDonations.size === 0) return;
    const removedIds = new Set<string>();
    const updated = produce(kesim, (draft) => {
      for (const g of draft.animalGroups) {
        for (let di = 0; di < g.donations.length; di++) {
          const d = g.donations[di];
          if (selectedGroupDonations.has(d.id) && d.name.trim()) {
            removedIds.add(d.id);
            g.donations[di] = {
              id: generateId(), name: "", description: "",
              donationType: "", shareCount: 1, vekalet: "", notes: "",
            };
          }
        }
      }
    });
    setRemovedFromGroupIds((prev) => {
      const next = new Set(prev);
      removedIds.forEach((id) => next.add(id));
      return next;
    });
    save(updated, `${selectedGroupDonations.size} bağışçı gruplardan çıkarıldı`, false, "groups");
    setSelectedGroupDonations(new Set());
    toast({
      title: "Gruptan Çıkarıldı",
      description: `${removedIds.size} bağışçı gruplardan çıkarıldı. "Gruptan Çıkarılanlar" filtresinden erişebilirsiniz.`,
    });
  }

  function bulkMoveToGroup(targetGroupIdx: number) {
    if (!kesim || selectedGroupDonations.size === 0 || targetGroupIdx < 0) return;
    if (isGroupLocked(targetGroupIdx)) return;
    const emptySlotCount = kesim.animalGroups[targetGroupIdx].donations.filter((d) => !d.name.trim()).length;
    const candidateIds: string[] = [];
    for (let gi = 0; gi < kesim.animalGroups.length; gi++) {
      if (isGroupLocked(gi) || gi === targetGroupIdx) continue;
      for (const d of kesim.animalGroups[gi].donations) {
        if (selectedGroupDonations.has(d.id) && d.name.trim()) {
          candidateIds.push(d.id);
        }
      }
    }
    const moveCount = Math.min(candidateIds.length, emptySlotCount);
    if (moveCount === 0) {
      toast({ title: "Taşıma yapılamadı", description: "Hedef grupta boş slot yok.", variant: "destructive" });
      return;
    }
    const idsToMove = new Set(candidateIds.slice(0, moveCount));
    const itemsToMove: Donation[] = [];
    const updated = produce(kesim, (draft) => {
      for (let gi = 0; gi < draft.animalGroups.length; gi++) {
        if (isGroupLocked(gi) || gi === targetGroupIdx) continue;
        for (let di = draft.animalGroups[gi].donations.length - 1; di >= 0; di--) {
          const d = draft.animalGroups[gi].donations[di];
          if (idsToMove.has(d.id)) {
            itemsToMove.push({ ...d });
            draft.animalGroups[gi].donations[di] = {
              id: generateId(), name: "", description: "",
              donationType: "", shareCount: 1, vekalet: "", notes: "",
            };
          }
        }
      }
      for (const item of itemsToMove) {
        const emptyIdx = draft.animalGroups[targetGroupIdx].donations.findIndex((d) => !d.name.trim());
        if (emptyIdx >= 0) {
          draft.animalGroups[targetGroupIdx].donations[emptyIdx] = item;
        }
      }
    });
    save(
      updated,
      `${itemsToMove.length} bağışçı Hayvan ${updated.animalGroups[targetGroupIdx].animalNo}'e taşındı`,
      false,
      "groups"
    );
    setSelectedGroupDonations(new Set());
    setBulkMoveTargetGroup(-1);
    if (moveCount < candidateIds.length) {
      toast({
        title: "Kısmi taşıma",
        description: `Hedef grupta yeterli boş slot olmadığı için ${moveCount}/${candidateIds.length} bağışçı taşındı.`,
        variant: "destructive",
      });
    }
  }

  function bulkChangeGroupDonationType() {
    if (!kesim || selectedGroupDonations.size === 0) return;
    const updated = produce(kesim, (draft) => {
      for (const g of draft.animalGroups) {
        for (const d of g.donations) {
          if (selectedGroupDonations.has(d.id)) {
            if (bulkGroupEditField === "donationType") d.donationType = bulkGroupEditValue;
            if (bulkGroupEditField === "notes") d.notes = bulkGroupEditValue;
          }
        }
      }
    });
    save(updated, `${selectedGroupDonations.size} bağışçı toplu düzenlendi`, false, "groups");
    setSelectedGroupDonations(new Set());
    setBulkGroupEditOpen(false);
    setBulkGroupEditValue("");
  }

  function enhancedRemoveFromGroup(groupIdx: number, donationIdx: number) {
    if (!kesim) return;
    if (isGroupLocked(groupIdx)) return;
    const d = kesim.animalGroups[groupIdx]?.donations[donationIdx];
    if (!d || !d.name.trim()) return;
    const donorName = d.description || d.name;
    const groupNo = kesim.animalGroups[groupIdx]?.animalNo;
    setRemovedFromGroupIds((prev) => {
      const next = new Set(prev);
      next.add(d.id);
      return next;
    });
    removeFromGroup(groupIdx, donationIdx);
    toast({
      title: "Gruptan Çıkarıldı",
      description: `${donorName} Hayvan ${groupNo}'den çıkarıldı. "Gruptan Çıkarılanlar" filtresinden erişebilirsiniz.`,
    });
  }

  function addEmptyGroup() {
    if (!kesim) return;
    const emptyDonation = (): Donation => ({
      id: generateId(), name: "", description: "",
      donationType: "", shareCount: 1, vekalet: "", notes: "",
    });
    const newGroup: AnimalGroup = {
      id: generateId(),
      animalNo: kesim.animalGroups.length + 1,
      donations: Array.from({ length: MAX_SHARES_PER_ANIMAL }, emptyDonation),
    };
    const updated = produce(kesim, (draft) => {
      draft.animalGroups.push(newGroup);
    });
    save(updated, `Boş hayvan grubu eklendi: #${newGroup.animalNo}`, false, "groups");
  }

  function cleanEmptyGroups() {
    if (!kesim) return;
    const emptyCount = kesim.animalGroups.filter((g) => !g.donations.some((d) => d.name.trim())).length;
    if (emptyCount === 0) return;
    const updated = produce(kesim, (draft) => {
      draft.animalGroups = draft.animalGroups.filter((g) => g.donations.some((d) => d.name.trim()));
      for (let i = 0; i < draft.animalGroups.length; i++) {
        draft.animalGroups[i].animalNo = i + 1;
      }
    });
    save(updated, `${emptyCount} boş grup temizlendi`, false, "groups");
  }

  function moveGroupUp(groupIdx: number) {
    if (!kesim || groupIdx <= 0) return;
    const animalNo = kesim.animalGroups[groupIdx].animalNo;
    const updated = produce(kesim, (draft) => {
      const temp = draft.animalGroups[groupIdx - 1];
      draft.animalGroups[groupIdx - 1] = draft.animalGroups[groupIdx];
      draft.animalGroups[groupIdx] = temp;
      for (let i = 0; i < draft.animalGroups.length; i++) {
        draft.animalGroups[i].animalNo = i + 1;
      }
    });
    save(updated, `Hayvan ${animalNo} yukarı taşındı`, false, "groups");
  }

  function moveGroupDown(groupIdx: number) {
    if (!kesim || groupIdx >= kesim.animalGroups.length - 1) return;
    const animalNo = kesim.animalGroups[groupIdx].animalNo;
    const updated = produce(kesim, (draft) => {
      const temp = draft.animalGroups[groupIdx];
      draft.animalGroups[groupIdx] = draft.animalGroups[groupIdx + 1];
      draft.animalGroups[groupIdx + 1] = temp;
      for (let i = 0; i < draft.animalGroups.length; i++) {
        draft.animalGroups[i].animalNo = i + 1;
      }
    });
    save(updated, `Hayvan ${animalNo} aşağı taşındı`, false, "groups");
  }

  const EDITABLE_COLUMN_KEYS: ColumnKey[] = ["vekalet", "description", "name", "donationType", "notes"];
  const editableVisibleColumns = workspace.visibleColumns.filter((k) => EDITABLE_COLUMN_KEYS.includes(k));

  function handleGroupCellTab(e: React.KeyboardEvent<HTMLInputElement>, groupIdx: number, dIdx: number, colKey: ColumnKey) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    if (!group) return;

    const fieldIdx = editableVisibleColumns.indexOf(colKey);
    if (fieldIdx === -1) return;

    if (e.shiftKey) {
      if (fieldIdx > 0) {
        const prevField = editableVisibleColumns[fieldIdx - 1];
        const target = document.querySelector(
          `[data-group-cell="${groupIdx}-${dIdx}-${prevField}"] input`
        ) as HTMLInputElement;
        target?.focus();
      } else if (dIdx > 0) {
        const prevField = editableVisibleColumns[editableVisibleColumns.length - 1];
        const target = document.querySelector(
          `[data-group-cell="${groupIdx}-${dIdx - 1}-${prevField}"] input`
        ) as HTMLInputElement;
        target?.focus();
      }
    } else {
      if (fieldIdx < editableVisibleColumns.length - 1) {
        const nextField = editableVisibleColumns[fieldIdx + 1];
        const target = document.querySelector(
          `[data-group-cell="${groupIdx}-${dIdx}-${nextField}"] input`
        ) as HTMLInputElement;
        target?.focus();
      } else if (dIdx < group.donations.length - 1) {
        const nextField = editableVisibleColumns[0];
        const target = document.querySelector(
          `[data-group-cell="${groupIdx}-${dIdx + 1}-${nextField}"] input`
        ) as HTMLInputElement;
        target?.focus();
      }
    }
  }

  const collapseAll = () => {
    if (!kesim) return;
    setCollapsedGroups(new Set(kesim.animalGroups.map((g) => g.id)));
  };

  const expandAll = () => {
    setCollapsedGroups(new Set());
  };

  const handleColumnDragStart = (key: ColumnKey) => {
    setColumnDragItem(key);
  };
  const handleColumnDragOver = (e: React.DragEvent, _targetKey: ColumnKey) => {
    e.preventDefault();
  };
  const handleColumnDrop = (targetKey: ColumnKey) => {
    if (!columnDragItem || columnDragItem === targetKey) {
      setColumnDragItem(null);
      return;
    }
    const order = [...workspace.prefs.columnOrder];
    const fromIdx = order.indexOf(columnDragItem);
    const toIdx = order.indexOf(targetKey);
    if (fromIdx < 0 || toIdx < 0) {
      setColumnDragItem(null);
      return;
    }
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, columnDragItem);
    workspace.setColumnOrder(order);
    setColumnDragItem(null);
  };
  const handleColumnDragEnd = () => {
    setColumnDragItem(null);
  };

  const handleSetGroupColorTag = useCallback(
    (groupIdx: number, tag: ColorTag) => {
      setGroupColorTag(groupIdx, tag);
    },
    [kesim, saveSingleGroupField]
  );

  const handleSelectAllGroupDonations = useCallback(
    (filledDonations: Donation[], allSelected: boolean) => {
      setSelectedGroupDonations((prev) => {
        const next = new Set(prev);
        filledDonations.forEach((d) => (allSelected ? next.delete(d.id) : next.add(d.id)));
        return next;
      });
    },
    []
  );

  const groupSearchMatches = useCallback(() => {
    if (!kesim || !groupSearchQuery.trim()) return [];
    const q = turkishNormalize(groupSearchQuery.trim());
    const matches: { groupIdx: number; dIdx: number; groupId: string; animalNo: number }[] = [];
    kesim.animalGroups.forEach((group, groupIdx) => {
      group.donations.forEach((d, dIdx) => {
        if (
          turkishNormalize(d.name).includes(q) ||
          turkishNormalize(d.description).includes(q) ||
          turkishNormalize(d.vekalet).includes(q) ||
          turkishNormalize(d.donationType).includes(q) ||
          turkishNormalize(d.notes || "").includes(q)
        ) {
          matches.push({ groupIdx, dIdx, groupId: group.id, animalNo: group.animalNo });
        }
      });
    });
    return matches;
  }, [kesim, groupSearchQuery]);

  function isGroupSearchMatch(groupIdx: number, dIdx: number): boolean {
    if (!groupSearchQuery.trim()) return false;
    const q = turkishNormalize(groupSearchQuery.trim());
    const d = kesim?.animalGroups[groupIdx]?.donations[dIdx];
    if (!d) return false;
    return (
      turkishNormalize(d.name).includes(q) ||
      turkishNormalize(d.description).includes(q) ||
      turkishNormalize(d.vekalet).includes(q) ||
      turkishNormalize(d.donationType).includes(q) ||
      turkishNormalize(d.notes || "").includes(q)
    );
  }

  function getGroupFindDeleteMatches() {
    if (!kesim || !groupFindDeleteValue.trim()) return [];
    const q = turkishNormalize(groupFindDeleteValue.trim());
    const matchIds = new Set<string>();
    for (const group of kesim.animalGroups) {
      for (const d of group.donations) {
        if (!d.id) continue;
        const val = turkishNormalize((d[groupFindDeleteColumn] || "").toString());
        if (val.includes(q)) {
          matchIds.add(d.id);
        }
      }
    }
    return kesim.donations.filter((d) => matchIds.has(d.id));
  }

  async function executeGroupFindDelete() {
    if (!kesim) return;
    const matches = getGroupFindDeleteMatches();
    if (matches.length === 0) return;
    const matchIds = new Set(matches.map((d) => d.id));
    const findDeleteColumnLabel: Record<string, string> = {
      name: "Adına Kesilen",
      description: "Vekaleti Veren",
      donationType: "Cinsi",
      vekalet: "Vekalet No",
      notes: "Notlar",
    };
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
        `Gruplardan toplu silindi: ${matches.length} bağışçı (${findDeleteColumnLabel[groupFindDeleteColumn]}: "${groupFindDeleteValue}")`
      );
      setGroupFindDeleteOpen(false);
      setGroupFindDeleteValue("");
      setGroupFindDeleteConfirm(false);
      toast({
        title: "Çöp kutusuna taşındı",
        description: `${matches.length} bağışçı gruplardan silinip çöp kutusuna taşındı.`,
      });
    } catch (err) {
      toast({
        title: "Silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  }

  return {
    collapsedGroups,
    setCollapsedGroups,
    selectedGroupIds,
    setSelectedGroupIds,
    selectedGroupDonations,
    setSelectedGroupDonations,
    bulkMoveTargetGroup,
    setBulkMoveTargetGroup,
    bulkGroupEditOpen,
    setBulkGroupEditOpen,
    bulkGroupEditField,
    setBulkGroupEditField,
    bulkGroupEditValue,
    setBulkGroupEditValue,
    splitGroupDialog,
    setSplitGroupDialog,
    columnDragItem,
    setColumnDragItem,
    removedFromGroupIds,
    setRemovedFromGroupIds,
    rangeLockInput,
    setRangeLockInput,
    groupSearchQuery,
    setGroupSearchQuery,
    groupSearchMatchIdx,
    setGroupSearchMatchIdx,
    groupFindDeleteOpen,
    setGroupFindDeleteOpen,
    groupFindDeleteColumn,
    setGroupFindDeleteColumn,
    groupFindDeleteValue,
    setGroupFindDeleteValue,
    groupFindDeleteConfirm,
    setGroupFindDeleteConfirm,
    saveSingleGroupField,
    isGroupLocked,
    removeFromGroup,
    updateGroupDonation,
    setGroupColorTag,
    updateGroupNotes,
    toggleGroupLock,
    parseRangeLockInput,
    applyRangeLock,
    lockAllGroups,
    unlockAllGroups,
    deleteAnimalGroup,
    openSplitGroupDialog,
    executeSplitGroup,
    toggleGroupSelect,
    mergeSelectedGroups,
    toggleGroupCollapse,
    toggleGroupDonationSelect,
    bulkRemoveFromGroups,
    bulkMoveToGroup,
    bulkChangeGroupDonationType,
    enhancedRemoveFromGroup,
    addEmptyGroup,
    cleanEmptyGroups,
    moveGroupUp,
    moveGroupDown,
    handleGroupCellTab,
    collapseAll,
    expandAll,
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDrop,
    handleColumnDragEnd,
    handleSetGroupColorTag,
    handleSelectAllGroupDonations,
    groupSearchMatches,
    isGroupSearchMatch,
    getGroupFindDeleteMatches,
    executeGroupFindDelete,
    editableVisibleColumns,
  };
}
