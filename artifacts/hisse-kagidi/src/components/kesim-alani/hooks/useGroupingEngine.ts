import { useState, useCallback } from "react";
import { produce } from "immer";
import type { Donation, AnimalGroup, KesimAlani } from "@/lib/types";
import { checkGroupConflicts, computeEffectiveShares } from "@/lib/grouping";
import type { GroupingProgress, ConflictInfo } from "@/lib/grouping";
import { generateId } from "./types";
import type { SaveFn, KesimDeps } from "./types";

interface UseGroupingEngineDeps extends KesimDeps {
  runGrouping: (donations: Donation[], onProgress: (p: GroupingProgress) => void) => Promise<AnimalGroup[]>;
  runIncrementalGrouping: (
    donations: Donation[],
    groups: AnimalGroup[],
    changedIds: string[],
    lockedIndices: number[]
  ) => Promise<AnimalGroup[]>;
  cancelGrouping: () => void;
  runCheckConflicts: (groups: AnimalGroup[]) => Promise<ConflictInfo[]>;
  isGroupLocked: (groupIdx: number) => boolean;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useGroupingEngine({
  kesim,
  setKesim,
  save,
  history,
  toast,
  runGrouping,
  runIncrementalGrouping,
  cancelGrouping,
  runCheckConflicts,
  isGroupLocked,
  selectedIds,
  setSelectedIds,
}: UseGroupingEngineDeps) {
  const [groupingInProgress, setGroupingInProgress] = useState(false);
  const [groupingProgress, setGroupingProgress] = useState<GroupingProgress | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [autoResolveOpen, setAutoResolveOpen] = useState(false);
  const [resolveResults, setResolveResults] = useState<
    Array<{
      desc: string;
      swaps: Array<{
        fromGroup: number;
        fromIdx: number;
        toGroup: number;
        toIdx: number;
        fromName: string;
        toName: string;
      }>;
    }>
  >([]);

  const [swapSelection, setSwapSelection] = useState<{ groupIdx: number; donationIdx: number } | null>(null);
  const [swapPreviewOpen, setSwapPreviewOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{ groupIdx: number; donationIdx: number } | null>(null);

  async function handleAutoGroup(forceFullRegroup = false) {
    if (!kesim || groupingInProgress) return;
    setGroupingInProgress(true);
    setGroupingProgress(null);
    try {
      const lockedIndices: number[] = [];
      const lockedDonationIds = new Set<string>();
      for (let i = 0; i < kesim.animalGroups.length; i++) {
        const g = kesim.animalGroups[i];
        if (g.locked) {
          lockedIndices.push(i);
          for (const d of g.donations) {
            if (d.name.trim() || d.description.trim()) {
              lockedDonationIds.add(d.id);
            }
          }
        }
      }

      const hasExistingGroups = kesim.animalGroups.length > 0;
      const activeDonationMap = new Map<string, Donation>();
      for (const d of kesim.donations) {
        if (!d.excluded && (d.name.trim() || d.description.trim())) {
          activeDonationMap.set(d.id, d);
        }
      }

      const changedIdSet = new Set<string>();
      const groupedDonationMap = new Map<string, Donation>();
      for (const g of kesim.animalGroups) {
        for (const d of g.donations) {
          if (d.name.trim() || d.description.trim()) groupedDonationMap.set(d.id, d);
        }
      }

      for (const [id] of activeDonationMap) {
        if (!groupedDonationMap.has(id)) changedIdSet.add(id);
      }

      for (const g of kesim.animalGroups) {
        if (g.locked) continue;
        for (const d of g.donations) {
          if (!(d.name.trim() || d.description.trim())) continue;
          if (!activeDonationMap.has(d.id)) {
            changedIdSet.add(d.id);
            continue;
          }
          const current = activeDonationMap.get(d.id)!;
          if (
            current.name !== d.name ||
            current.description !== d.description ||
            current.shareCount !== d.shareCount ||
            current.excluded !== d.excluded ||
            current.donationType !== d.donationType
          ) {
            changedIdSet.add(d.id);
          }
        }
      }

      const changedDescs = new Set<string>();
      for (const id of changedIdSet) {
        const d = activeDonationMap.get(id) || groupedDonationMap.get(id);
        if (d) {
          const key = d.description.trim().toLocaleLowerCase("tr");
          if (key) changedDescs.add(key);
        }
      }
      if (changedDescs.size > 0) {
        for (const g of kesim.animalGroups) {
          if (g.locked) continue;
          for (const d of g.donations) {
            const key = d.description.trim().toLocaleLowerCase("tr");
            if (key && changedDescs.has(key) && !changedIdSet.has(d.id)) {
              changedIdSet.add(d.id);
            }
          }
        }
        for (const [id, d] of activeDonationMap) {
          const key = d.description.trim().toLocaleLowerCase("tr");
          if (key && changedDescs.has(key) && !changedIdSet.has(id)) {
            changedIdSet.add(id);
          }
        }
      }

      const changedIds = Array.from(changedIdSet);
      const useIncremental = !forceFullRegroup && hasExistingGroups && changedIds.length <= 20;

      let finalGroups: AnimalGroup[];

      if (useIncremental) {
        finalGroups = await runIncrementalGrouping(kesim.donations, kesim.animalGroups, changedIds, lockedIndices);
        // Remove empty non-locked groups left behind after incremental regrouping
        finalGroups = finalGroups.filter(
          (g) => g.locked || g.donations.some((d) => d.name.trim() || d.description.trim())
        );
        finalGroups.forEach((g, i) => { g.animalNo = i + 1; });
      } else {
        const donationsToGroup = kesim.donations.filter((d) => !lockedDonationIds.has(d.id));
        const newGroups = await runGrouping(donationsToGroup, (progress) => {
          setGroupingProgress({ ...progress });
        });
        const lockedGroups = kesim.animalGroups.filter((g) => g.locked);
        finalGroups = [...lockedGroups, ...newGroups];
        finalGroups.forEach((g, i) => {
          g.animalNo = i + 1;
        });
      }

      const existingDonationIds = new Set(kesim.donations.map((d) => d.id));
      const newDonations: Donation[] = [];
      for (const g of finalGroups) {
        for (const d of g.donations) {
          if (!existingDonationIds.has(d.id)) {
            existingDonationIds.add(d.id);
            newDonations.push(d);
          }
        }
      }
      const lockedCount = lockedIndices.length;
      const updated = produce(kesim, (draft) => {
        draft.donations.push(...newDonations);
        draft.animalGroups = finalGroups;
      });
      const modeLabel = useIncremental ? "Artımlı gruplama" : "Otomatik gruplama";
      if (newDonations.length > 0) {
        save(updated, `${modeLabel} yapıldı: ${finalGroups.length} hayvan (${lockedCount} kilitli korundu)`, true);
      } else {
        save(
          updated,
          `${modeLabel} yapıldı: ${finalGroups.length} hayvan (${lockedCount} kilitli korundu)`,
          true,
          "groups"
        );
      }
      runCheckConflicts(finalGroups).then(found => {
        setConflicts(found);
        if (found.length > 0) setShowConflicts(true);
      }).catch(() => {});
    } catch (err) {
      if (err instanceof Error && err.name === "CancelledError") return;
      throw err;
    } finally {
      setGroupingInProgress(false);
      setGroupingProgress(null);
    }
  }

  async function handleAutoGroupSelected() {
    if (!kesim || groupingInProgress || selectedIds.size === 0) return;
    setGroupingInProgress(true);
    setGroupingProgress(null);
    try {
      const selectedDonations = kesim.donations.filter((d) => selectedIds.has(d.id));
      const newGroups = await runGrouping(selectedDonations, (progress) => {
        setGroupingProgress({ ...progress });
      });
      const cleanedExistingGroups = kesim.animalGroups.map((g) => ({
        ...g,
        donations: g.donations.map((d) =>
          selectedIds.has(d.id)
            ? {
                ...d,
                name: "",
                description: "",
                donationType: "",
                shareCount: 1,
                notes: "",
                vekalet: "",
                excluded: false,
              }
            : d
        ),
      }));
      const allGroups = [...cleanedExistingGroups, ...newGroups];
      allGroups.forEach((g, i) => {
        g.animalNo = i + 1;
      });
      const existingDonationIds = new Set(kesim.donations.map((d) => d.id));
      const newDonations: Donation[] = [];
      for (const g of newGroups) {
        for (const d of g.donations) {
          if (!existingDonationIds.has(d.id)) {
            existingDonationIds.add(d.id);
            newDonations.push(d);
          }
        }
      }
      const updated = produce(kesim, (draft) => {
        draft.donations.push(...newDonations);
        draft.animalGroups = allGroups;
      });
      if (newDonations.length > 0) {
        save(
          updated,
          `Seçilen ${selectedDonations.length} bağışçı gruplandı: ${newGroups.length} yeni hayvan`,
          true
        );
      } else {
        save(
          updated,
          `Seçilen ${selectedDonations.length} bağışçı gruplandı: ${newGroups.length} yeni hayvan`,
          true,
          "groups"
        );
      }
      runCheckConflicts(allGroups).then(found => {
        setConflicts(found);
        if (found.length > 0) setShowConflicts(true);
      }).catch(() => {});
      setSelectedIds(new Set());
    } catch (err) {
      if (err instanceof Error && err.name === "CancelledError") return;
      throw err;
    } finally {
      setGroupingInProgress(false);
      setGroupingProgress(null);
    }
  }

  function handleSwapSelect(groupIdx: number, donationIdx: number) {
    if (!kesim) return;
    const d = kesim.animalGroups[groupIdx]?.donations[donationIdx];
    if (!d || !d.name.trim()) return;
    if (isGroupLocked(groupIdx)) return;

    if (!swapSelection) {
      setSwapSelection({ groupIdx, donationIdx });
    } else {
      if (swapSelection.groupIdx === groupIdx) {
        setSwapSelection({ groupIdx, donationIdx });
        return;
      }
      if (isGroupLocked(swapSelection.groupIdx)) {
        setSwapSelection(null);
        return;
      }
      setSwapTarget({ groupIdx, donationIdx });
      setSwapPreviewOpen(true);
    }
  }

  function executeSwap() {
    if (!kesim || !swapSelection || !swapTarget) return;
    if (isGroupLocked(swapSelection.groupIdx) || isGroupLocked(swapTarget.groupIdx)) {
      cancelSwap();
      return;
    }
    const sg = kesim.animalGroups[swapSelection.groupIdx];
    const tg = kesim.animalGroups[swapTarget.groupIdx];
    if (!sg?.donations[swapSelection.donationIdx] || !tg?.donations[swapTarget.donationIdx]) {
      cancelSwap();
      return;
    }
    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: g.donations.map((d) => ({ ...d })),
    }));

    const temp = { ...groups[swapSelection.groupIdx].donations[swapSelection.donationIdx] };
    groups[swapSelection.groupIdx].donations[swapSelection.donationIdx] = {
      ...groups[swapTarget.groupIdx].donations[swapTarget.donationIdx],
    };
    groups[swapTarget.groupIdx].donations[swapTarget.donationIdx] = temp;

    const swapUpdated = produce(kesim, (draft) => { draft.animalGroups = groups; });
    save(
      swapUpdated,
      `Takas yapıldı: Hayvan ${groups[swapSelection.groupIdx].animalNo} ↔ Hayvan ${groups[swapTarget.groupIdx].animalNo}`,
      false,
      "groups"
    );
    setSwapSelection(null);
    setSwapTarget(null);
    setSwapPreviewOpen(false);
  }

  function cancelSwap() {
    setSwapSelection(null);
    setSwapTarget(null);
    setSwapPreviewOpen(false);
  }

  function computeAutoResolve(): typeof resolveResults {
    if (!kesim) return [];
    const groups = kesim.animalGroups;
    const unexpectedConflicts = checkGroupConflicts(groups).filter((c) => !c.isExpected);
    if (unexpectedConflicts.length === 0) return [];

    const workingCopy = groups.map((g) => ({
      ...g,
      donations: g.donations.map((d) => ({ ...d })),
    }));

    const globalUsedSlots = new Set<string>();
    const results: typeof resolveResults = [];

    for (const conflict of unexpectedConflicts) {
      const key = conflict.description.trim().toLocaleLowerCase("tr");
      const entriesByGroup: Map<number, Array<{ groupIdx: number; dIdx: number }>> = new Map();

      workingCopy.forEach((group, groupIdx) => {
        group.donations.forEach((d, dIdx) => {
          if (d.description.trim().toLocaleLowerCase("tr") === key) {
            if (!entriesByGroup.has(groupIdx)) entriesByGroup.set(groupIdx, []);
            entriesByGroup.get(groupIdx)!.push({ groupIdx, dIdx });
          }
        });
      });

      const groupIndices = Array.from(entriesByGroup.keys());
      if (groupIndices.length <= 1) continue;

      let targetGroupIdx = -1;
      let maxExisting = -1;
      for (const gi of groupIndices) {
        if (workingCopy[gi].locked) continue;
        const count = entriesByGroup.get(gi)!.length;
        const emptySlots = workingCopy[gi].donations.filter((d) => d.name.trim() === "").length;
        const score = count * 1000 + emptySlots;
        if (score > maxExisting) {
          maxExisting = score;
          targetGroupIdx = gi;
        }
      }
      if (targetGroupIdx < 0) continue;

      const swaps: (typeof resolveResults)[0]["swaps"] = [];

      for (const sourceGroupIdx of groupIndices) {
        if (sourceGroupIdx === targetGroupIdx) continue;
        if (workingCopy[sourceGroupIdx].locked) continue;

        const sourceEntries = entriesByGroup.get(sourceGroupIdx)!;
        for (const srcEntry of sourceEntries) {
          const slotKey = (g: number, i: number) => `${g}:${i}`;
          if (globalUsedSlots.has(slotKey(srcEntry.groupIdx, srcEntry.dIdx))) continue;

          const emptySlotIdx = workingCopy[targetGroupIdx].donations.findIndex(
            (d, idx) => d.name.trim() === "" && !globalUsedSlots.has(slotKey(targetGroupIdx, idx))
          );

          if (emptySlotIdx >= 0) {
            swaps.push({
              fromGroup: sourceGroupIdx,
              fromIdx: srcEntry.dIdx,
              toGroup: targetGroupIdx,
              toIdx: emptySlotIdx,
              fromName: workingCopy[sourceGroupIdx].donations[srcEntry.dIdx].description,
              toName: "(boş slot)",
            });
            globalUsedSlots.add(slotKey(sourceGroupIdx, srcEntry.dIdx));
            globalUsedSlots.add(slotKey(targetGroupIdx, emptySlotIdx));

            const tempD = { ...workingCopy[sourceGroupIdx].donations[srcEntry.dIdx] };
            workingCopy[sourceGroupIdx].donations[srcEntry.dIdx] = {
              ...workingCopy[targetGroupIdx].donations[emptySlotIdx],
            };
            workingCopy[targetGroupIdx].donations[emptySlotIdx] = tempD;
          } else {
            const swappableIdx = workingCopy[targetGroupIdx].donations.findIndex((d, idx) => {
              if (!d.name.trim()) return false;
              if (d.description.trim().toLocaleLowerCase("tr") === key) return false;
              return !globalUsedSlots.has(slotKey(targetGroupIdx, idx));
            });

            if (swappableIdx >= 0) {
              swaps.push({
                fromGroup: sourceGroupIdx,
                fromIdx: srcEntry.dIdx,
                toGroup: targetGroupIdx,
                toIdx: swappableIdx,
                fromName: workingCopy[sourceGroupIdx].donations[srcEntry.dIdx].description,
                toName: workingCopy[targetGroupIdx].donations[swappableIdx].description,
              });
              globalUsedSlots.add(slotKey(sourceGroupIdx, srcEntry.dIdx));
              globalUsedSlots.add(slotKey(targetGroupIdx, swappableIdx));

              const tempD = { ...workingCopy[sourceGroupIdx].donations[srcEntry.dIdx] };
              workingCopy[sourceGroupIdx].donations[srcEntry.dIdx] = {
                ...workingCopy[targetGroupIdx].donations[swappableIdx],
              };
              workingCopy[targetGroupIdx].donations[swappableIdx] = tempD;
            }
          }
        }
      }

      if (swaps.length > 0) {
        results.push({ desc: conflict.description, swaps });
      }
    }

    return results;
  }

  function openAutoResolve() {
    const results = computeAutoResolve();
    setResolveResults(results);
    setAutoResolveOpen(true);
  }

  function applyAutoResolve() {
    if (!kesim || resolveResults.length === 0) return;
    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: g.donations.map((d) => ({ ...d })),
    }));

    let appliedCount = 0;
    for (const result of resolveResults) {
      for (const swap of result.swaps) {
        if (swap.fromGroup >= groups.length || swap.toGroup >= groups.length) continue;
        if (groups[swap.fromGroup].locked || groups[swap.toGroup].locked) continue;
        if (!groups[swap.fromGroup].donations[swap.fromIdx] || !groups[swap.toGroup].donations[swap.toIdx])
          continue;
        const temp = { ...groups[swap.fromGroup].donations[swap.fromIdx] };
        groups[swap.fromGroup].donations[swap.fromIdx] = { ...groups[swap.toGroup].donations[swap.toIdx] };
        groups[swap.toGroup].donations[swap.toIdx] = temp;
        appliedCount++;
      }
    }

    if (appliedCount === 0) {
      setAutoResolveOpen(false);
      setResolveResults([]);
      return;
    }

    const resolveUpdated = produce(kesim, (draft) => { draft.animalGroups = groups; });
    save(
      resolveUpdated,
      `Otomatik çakışma çözümü: ${appliedCount} takas uygulandı (${resolveResults.length} kişi)`,
      false,
      "groups"
    );
    setAutoResolveOpen(false);
    setResolveResults([]);

    runCheckConflicts(groups).then(newConflicts => {
      setConflicts(newConflicts);
      if (newConflicts.length > 0) setShowConflicts(true);
    }).catch(() => {});
  }

  return {
    groupingInProgress,
    setGroupingInProgress,
    groupingProgress,
    setGroupingProgress,
    conflicts,
    setConflicts,
    showConflicts,
    setShowConflicts,
    autoResolveOpen,
    setAutoResolveOpen,
    resolveResults,
    setResolveResults,
    swapSelection,
    setSwapSelection,
    swapPreviewOpen,
    setSwapPreviewOpen,
    swapTarget,
    setSwapTarget,
    cancelGrouping,
    handleAutoGroup,
    handleAutoGroupSelected,
    handleSwapSelect,
    executeSwap,
    cancelSwap,
    computeAutoResolve,
    openAutoResolve,
    applyAutoResolve,
  };
}
