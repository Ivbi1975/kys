import { useCallback } from "react";
import { produce } from "immer";
import type { Donation, KesimAlani } from "@/lib/types";
import { computeEffectiveShares } from "@/lib/grouping";
import { generateId } from "./types";
import type { SaveFn } from "./types";

interface UseSmartPlacementDeps {
  kesim: KesimAlani | null;
  save: SaveFn;
  isGroupLocked: (groupIdx: number) => boolean;
  setSmartPlacePopover: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useSmartPlacement({ kesim, save, isGroupLocked, setSmartPlacePopover }: UseSmartPlacementDeps) {
  function getAvailableGroupsForDonor(donorId: string): { groupIdx: number; animalNo: number; emptySlots: number }[] {
    if (!kesim) return [];
    const donor = kesim.donations.find((d) => d.id === donorId);
    if (!donor) return [];
    const sharesMap = computeEffectiveShares(kesim.donations);
    const effectiveShares = sharesMap.get(donorId) || donor.shareCount;
    return kesim.animalGroups
      .map((g, i) => ({
        groupIdx: i,
        animalNo: g.animalNo,
        emptySlots: g.donations.filter((d) => !d.name.trim()).length,
      }))
      .filter((g) => g.emptySlots >= effectiveShares && !isGroupLocked(g.groupIdx));
  }

  function getSwapSuggestions(donorId: string) {
    if (!kesim) return [];
    const donor = kesim.donations.find((d) => d.id === donorId);
    if (!donor) return [];
    const sharesMap = computeEffectiveShares(kesim.donations);
    const effectiveShares = sharesMap.get(donorId) || donor.shareCount;
    if (effectiveShares <= 1) return [];
    const suggestions: { groupIdx: number; animalNo: number; swapOutIds: string[]; swapOutNames: string[]; description: string }[] = [];
    for (let gi = 0; gi < kesim.animalGroups.length; gi++) {
      const g = kesim.animalGroups[gi];
      if (isGroupLocked(gi)) continue;
      const emptySlots = g.donations.filter((d) => !d.name.trim()).length;
      if (emptySlots >= effectiveShares) continue;
      const slotsNeeded = effectiveShares - emptySlots;
      const singleShareDonors = g.donations.filter((d) => {
        if (!d.name.trim()) return false;
        const dShares = sharesMap.get(d.id) || d.shareCount;
        return dShares === 1;
      });
      if (singleShareDonors.length >= slotsNeeded) {
        const toSwap = singleShareDonors.slice(0, slotsNeeded);
        suggestions.push({
          groupIdx: gi,
          animalNo: g.animalNo,
          swapOutIds: toSwap.map((d) => d.id),
          swapOutNames: toSwap.map((d) => d.description || d.name),
          description: `${toSwap.length} tekli hisse çıkar → ${effectiveShares} hisseli yerleş`,
        });
      }
    }
    return suggestions;
  }

  function executeSwapSuggestion(donorId: string, groupIdx: number, swapOutIds: string[]) {
    if (!kesim) return;
    if (isGroupLocked(groupIdx)) return;
    const donor = kesim.donations.find((d) => d.id === donorId);
    if (!donor) return;
    const sharesMap = computeEffectiveShares(kesim.donations);
    const effectiveShares = sharesMap.get(donorId) || donor.shareCount;
    const groups = kesim.animalGroups.map((g) => ({ ...g, donations: g.donations.map((d) => ({ ...d })) }));
    const swapSet = new Set(swapOutIds);
    for (let di = 0; di < groups[groupIdx].donations.length; di++) {
      if (swapSet.has(groups[groupIdx].donations[di].id)) {
        groups[groupIdx].donations[di] = { id: generateId(), name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "" };
      }
    }
    let placed = 0;
    for (let di = 0; di < groups[groupIdx].donations.length && placed < effectiveShares; di++) {
      if (!groups[groupIdx].donations[di].name.trim()) {
        groups[groupIdx].donations[di] = { ...donor, id: placed === 0 ? donor.id : generateId() };
        placed++;
      }
    }
    const updated = produce(kesim, (draft) => { draft.animalGroups = groups; });
    save(updated, `${donor.description || donor.name}: Hayvan ${groups[groupIdx].animalNo}'e takas ile yerleştirildi`, false, "groups");
    setSmartPlacePopover(null);
  }

  function smartPlaceDonor(donorId: string, targetGroupIdx: number) {
    if (!kesim) return;
    if (isGroupLocked(targetGroupIdx) || targetGroupIdx < 0 || targetGroupIdx >= kesim.animalGroups.length) return;
    const donor = kesim.donations.find((d) => d.id === donorId);
    if (!donor) return;
    const sharesMap = computeEffectiveShares(kesim.donations);
    const effectiveShares = sharesMap.get(donorId) || donor.shareCount;
    const groups = kesim.animalGroups.map((g) => ({ ...g, donations: g.donations.map((d) => ({ ...d })) }));
    let placed = 0;
    for (let i = 0; i < groups[targetGroupIdx].donations.length && placed < effectiveShares; i++) {
      if (!groups[targetGroupIdx].donations[i].name.trim()) {
        groups[targetGroupIdx].donations[i] = { ...donor, id: placed === 0 ? donor.id : generateId() };
        placed++;
      }
    }
    if (placed === 0) return;
    const updated2 = produce(kesim, (draft) => { draft.animalGroups = groups; });
    save(updated2, `${donor.description || donor.name} (${placed} hisse) Hayvan ${groups[targetGroupIdx].animalNo}'e yerleştirildi`, false, "groups");
    setSmartPlacePopover(null);
  }

  return {
    getAvailableGroupsForDonor,
    getSwapSuggestions,
    executeSwapSuggestion,
    smartPlaceDonor,
  };
}
