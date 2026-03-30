import { useState, useCallback, useMemo } from "react";
import type { Donation, AnimalGroup, KesimAlani } from "@/lib/types";
import { computeEffectiveShares } from "@/lib/grouping";
import { moveDonationsToKesimAlani, fetchKesimAlani, createDonationTransfers } from "@/lib/api";
import type { DonationTransferEntry } from "@/lib/api";
import { MAX_SHARES_PER_ANIMAL } from "@/lib/constants";
import { generateId, loadBasketFromStorage, saveBasketToStorage } from "./types";
import type { BasketItem, SaveFn, KesimDeps } from "./types";

interface UseBasketDeps extends KesimDeps {
  isGroupLocked: (groupIdx: number) => boolean;
  siblingKesimAlanlari: { id: string; name: string }[];
}

export function useBasket({ kesim, setKesim, save, history, toast, isGroupLocked, siblingKesimAlanlari }: UseBasketDeps) {
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
  const [basketTransferTarget, setBasketTransferTarget] = useState<number>(-1);
  const [basketCrossKATarget, setBasketCrossKATarget] = useState<string>("");
  const [basketOpen, setBasketOpen] = useState(true);
  const [crossKATransferring, setCrossKATransferring] = useState(false);
  const [transferToDonorListConfirm, setTransferToDonorListConfirm] = useState(false);
  const [transferToDonorListRemoving, setTransferToDonorListRemoving] = useState(false);

  const basketItemIds = useMemo(() => new Set(basketItems.map((b) => b.donationId)), [basketItems]);
  const localBasketItems = useMemo(
    () => basketItems.filter((b) => b.kesimAlaniId === kesim?.id),
    [basketItems, kesim?.id]
  );
  const foreignBasketItems = useMemo(
    () => basketItems.filter((b) => b.kesimAlaniId !== kesim?.id),
    [basketItems, kesim?.id]
  );

  function makeBasketItem(d: Donation): BasketItem {
    return {
      donationId: d.id,
      kesimAlaniId: kesim!.id,
      kesimAlaniName: kesim!.name,
      name: d.name,
      description: d.description || "",
    };
  }

  function addToBasket(groupIdx: number, donationIdx: number) {
    if (!kesim) return;
    const d = kesim.animalGroups[groupIdx]?.donations[donationIdx];
    if (!d || !d.name.trim()) return;
    if (isGroupLocked(groupIdx)) return;
    if (basketItemIds.has(d.id)) return;
    setBasketItems((prev) => [...prev, makeBasketItem(d)]);
  }

  function addDonorToBasket(donationId: string) {
    if (!kesim || basketItemIds.has(donationId)) return;
    const d =
      kesim.donations.find((dd) => dd.id === donationId) ||
      kesim.animalGroups.flatMap((g) => g.donations).find((dd) => dd.id === donationId);
    if (!d || !d.name.trim()) return;
    setBasketItems((prev) => [...prev, makeBasketItem(d)]);
  }

  function addGroupToBasket(groupIdx: number) {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    if (!group || isGroupLocked(groupIdx)) return;
    const filled = group.donations.filter((d) => d.name.trim());
    if (filled.length === 0) return;
    setBasketItems((prev) => {
      const existingIds = new Set(prev.map((b) => b.donationId));
      const newItems = [...prev];
      for (const d of filled) {
        if (!existingIds.has(d.id)) {
          newItems.push(makeBasketItem(d));
          existingIds.add(d.id);
        }
      }
      return newItems;
    });
    toast({ title: `${filled.length} bağışçı sepete eklendi`, description: `Hayvan ${group.animalNo}` });
  }

  function removeFromBasket(donationId: string) {
    setBasketItems((prev) => prev.filter((b) => b.donationId !== donationId));
  }

  function clearBasket() {
    setBasketItems([]);
  }

  function addSelectedToBasket(selectedIds: Set<string>) {
    if (!kesim || selectedIds.size === 0) return;
    setBasketItems((prev) => {
      const existingIds = new Set(prev.map((b) => b.donationId));
      const newItems = [...prev];
      for (const id of selectedIds) {
        if (!existingIds.has(id)) {
          const d = kesim.donations.find((dd) => dd.id === id);
          if (d && !d.excluded) {
            newItems.push(makeBasketItem(d));
            existingIds.add(id);
          }
        }
      }
      return newItems;
    });
    toast({
      title: "Sepete Eklendi",
      description: `${selectedIds.size} bağışçı sepete eklendi.`,
    });
  }

  function transferBasketToGroup(targetGroupIdx: number) {
    if (!kesim || localBasketItems.length === 0 || targetGroupIdx < 0 || targetGroupIdx >= kesim.animalGroups.length)
      return;
    if (isGroupLocked(targetGroupIdx)) return;
    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: g.donations.map((d) => ({ ...d })),
    }));
    const emptySlots = groups[targetGroupIdx].donations.filter((d) => !d.name.trim()).length;
    if (emptySlots === 0) {
      toast({ title: "Hedef grupta boş slot yok.", variant: "destructive" });
      return;
    }
    const localIds = new Set(localBasketItems.map((b) => b.donationId));
    const groupedBasketIds = new Set<string>();
    const lockedBasketIds = new Set<string>();
    const ungroupedBasketDonors: Donation[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      for (const d of groups[gi].donations) {
        if (!localIds.has(d.id) || !d.name.trim()) continue;
        if (isGroupLocked(gi)) {
          lockedBasketIds.add(d.id);
        } else if (gi !== targetGroupIdx) {
          groupedBasketIds.add(d.id);
        }
      }
    }
    const sharesMap = computeEffectiveShares(kesim.donations);
    let ungroupedSlots = 0;
    for (const b of localBasketItems) {
      if (groupedBasketIds.has(b.donationId) || lockedBasketIds.has(b.donationId)) continue;
      const donor = kesim.donations.find((d) => d.id === b.donationId);
      if (donor && !donor.excluded) {
        const effectiveShares = sharesMap.get(b.donationId) || donor.shareCount;
        ungroupedBasketDonors.push(donor);
        ungroupedSlots += effectiveShares;
      }
    }
    const totalSlotsNeeded = groupedBasketIds.size + ungroupedSlots;
    if (totalSlotsNeeded > emptySlots) {
      toast({
        title: "Yetersiz Alan",
        description: `Sepetteki bağışçılar ${totalSlotsNeeded} slot gerektiriyor, ancak hedef grupta sadece ${emptySlots} boş slot var.`,
        variant: "destructive",
      });
      return;
    }
    const itemsToMove: Donation[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      if (isGroupLocked(gi) || gi === targetGroupIdx) continue;
      for (let di = groups[gi].donations.length - 1; di >= 0; di--) {
        const d = groups[gi].donations[di];
        if (localIds.has(d.id)) {
          itemsToMove.push(d);
          groups[gi].donations[di] = {
            id: generateId(),
            name: "",
            description: "",
            donationType: "",
            shareCount: 1,
            vekalet: "",
            notes: "",
          };
        }
      }
    }
    for (const donor of ungroupedBasketDonors) {
      const effectiveShares = sharesMap.get(donor.id) || donor.shareCount;
      for (let s = 0; s < effectiveShares; s++) {
        itemsToMove.push({ ...donor, id: s === 0 ? donor.id : generateId() });
      }
    }
    const transferredIds = new Set<string>();
    for (const item of itemsToMove) {
      const emptyIdx = groups[targetGroupIdx].donations.findIndex((d) => !d.name.trim());
      if (emptyIdx >= 0) {
        groups[targetGroupIdx].donations[emptyIdx] = item;
        transferredIds.add(item.id);
      }
    }
    if (transferredIds.size === 0) {
      toast({ title: "Aktarım yapılamadı.", variant: "destructive" });
      return;
    }
    const movedDonorCount = groupedBasketIds.size + ungroupedBasketDonors.length;
    save(
      { ...kesim, animalGroups: groups },
      `Sepetten ${movedDonorCount} bağışçı (${transferredIds.size} slot) Hayvan ${groups[targetGroupIdx].animalNo}'e aktarıldı`,
      false,
      "groups"
    );
    setBasketItems((prev) =>
      prev.filter((b) => !transferredIds.has(b.donationId) && !groupedBasketIds.has(b.donationId))
    );
    setBasketTransferTarget(-1);
    const skipped = lockedBasketIds.size;
    if (skipped > 0) {
      toast({
        title: "Kısmi Aktarım",
        description: `${movedDonorCount} bağışçı aktarıldı. ${skipped} tanesi kilitli grupta, sepette kaldı.`,
      });
    }
  }

  function autoDistributeBasket() {
    if (!kesim || localBasketItems.length === 0) return;
    const sharesMap = computeEffectiveShares(kesim.donations);

    const lockedGroupDonorIds = new Set<string>();
    for (const g of kesim.animalGroups) {
      if (g.locked) {
        for (const d of g.donations) {
          if (d.name.trim()) lockedGroupDonorIds.add(d.id);
        }
      }
    }

    const localIds = localBasketItems.map((b) => b.donationId);
    const movableIds = localIds.filter((id) => !lockedGroupDonorIds.has(id));
    const skippedCount = localIds.length - movableIds.length;

    if (movableIds.length === 0) {
      toast({
        title: "Dağıtım Yapılamadı",
        description: "Sepetteki tüm bağışçılar kilitli gruplarda. Önce kilidi açın.",
        variant: "destructive",
      });
      return;
    }

    const basketDonors: Donation[] = [];
    for (const id of movableIds) {
      const fromGroup = kesim.animalGroups.flatMap((g) => g.donations).find((d) => d.id === id);
      const fromList = kesim.donations.find((d) => d.id === id);
      const donor = fromGroup || fromList;
      if (donor && !donor.excluded) basketDonors.push(donor);
    }
    if (basketDonors.length === 0) return;

    let totalShares = 0;
    for (const d of basketDonors) {
      const inGroup = kesim.animalGroups.some((g) => g.donations.some((dd) => dd.id === d.id));
      if (inGroup) {
        totalShares += 1;
      } else {
        totalShares += sharesMap.get(d.id) || d.shareCount;
      }
    }
    const animalsNeeded = Math.ceil(totalShares / MAX_SHARES_PER_ANIMAL);

    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: g.donations.map((d) => ({ ...d })),
    }));

    const movableIdSet = new Set(movableIds);
    const itemsToPlace: Donation[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      if (groups[gi].locked) continue;
      for (let di = groups[gi].donations.length - 1; di >= 0; di--) {
        const d = groups[gi].donations[di];
        if (movableIdSet.has(d.id)) {
          itemsToPlace.push(d);
          groups[gi].donations[di] = {
            id: generateId(),
            name: "",
            description: "",
            donationType: "",
            shareCount: 1,
            vekalet: "",
            notes: "",
          };
        }
      }
    }
    for (const donor of basketDonors) {
      if (!itemsToPlace.find((d) => d.id === donor.id)) {
        const eff = sharesMap.get(donor.id) || donor.shareCount;
        for (let s = 0; s < eff; s++) {
          itemsToPlace.push({ ...donor, id: s === 0 ? donor.id : generateId() });
        }
      }
    }

    const emptyDonation = (): Donation => ({
      id: generateId(),
      name: "",
      description: "",
      donationType: "",
      shareCount: 1,
      vekalet: "",
      notes: "",
    });
    for (let i = 0; i < animalsNeeded; i++) {
      const hasEmptyGroup = groups.some((g) => !g.locked && g.donations.every((d) => !d.name.trim()));
      if (!hasEmptyGroup) {
        groups.push({
          id: generateId(),
          animalNo: groups.length + 1,
          donations: Array.from({ length: MAX_SHARES_PER_ANIMAL }, emptyDonation),
        });
      }
    }

    let placed = 0;
    for (const item of itemsToPlace) {
      let foundSlot = false;
      for (const g of groups) {
        if (g.locked) continue;
        const emptyIdx = g.donations.findIndex((d) => !d.name.trim());
        if (emptyIdx >= 0) {
          g.donations[emptyIdx] = item;
          placed++;
          foundSlot = true;
          break;
        }
      }
      if (!foundSlot) {
        const newGroup: AnimalGroup = {
          id: generateId(),
          animalNo: groups.length + 1,
          donations: Array.from({ length: MAX_SHARES_PER_ANIMAL }, emptyDonation),
        };
        newGroup.donations[0] = item;
        groups.push(newGroup);
        placed++;
      }
    }

    const renumbered = groups.map((g, i) => ({ ...g, animalNo: i + 1 }));
    save({ ...kesim, animalGroups: renumbered }, `Sepet otomatik dağıtıldı: ${placed} bağışçı`, false, "groups");
    const remaining = basketItems.filter(
      (b) => lockedGroupDonorIds.has(b.donationId) || b.kesimAlaniId !== kesim.id
    );
    setBasketItems(remaining);
    const desc =
      skippedCount > 0
        ? `${placed} slot dağıtıldı. ${skippedCount} tanesi kilitli grupta, sepette kaldı.`
        : `${placed} slot gruplara dağıtıldı.`;
    toast({ title: "Otomatik Dağıtım", description: desc });
  }

  async function transferBasketToOtherKA(targetKAId: string) {
    if (!kesim || basketItems.length === 0 || !targetKAId) return;
    const itemsToTransfer = basketItems.filter((b) => b.kesimAlaniId === kesim.id);
    if (itemsToTransfer.length === 0) {
      toast({ title: "Bu kesim alanından sepette bağışçı yok.", variant: "destructive" });
      return;
    }
    setCrossKATransferring(true);
    try {
      await moveDonationsToKesimAlani(
        itemsToTransfer.map((b) => b.donationId),
        kesim.id,
        targetKAId
      );
      setBasketItems((prev) => prev.filter((b) => b.kesimAlaniId !== kesim.id));
      const data = await fetchKesimAlani(kesim.id);
      if (data) {
        setKesim(data);
        history.initialize(data);
      }
      const targetName = siblingKesimAlanlari.find((ka) => ka.id === targetKAId)?.name || targetKAId;
      toast({ title: `${itemsToTransfer.length} bağışçı ${targetName} kesim alanına aktarıldı` });
      setBasketCrossKATarget("");
    } catch (err) {
      toast({
        title: "Aktarım başarısız",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setCrossKATransferring(false);
    }
  }

  async function transferForeignToCurrentDonorList(removeFromSource: boolean) {
    if (!kesim) return;
    const foreignItems = basketItems.filter((b) => b.kesimAlaniId !== kesim.id);
    if (foreignItems.length === 0) return;
    setTransferToDonorListRemoving(true);
    try {
      const donationIds = foreignItems.map((b) => b.donationId);
      const sourceKAIds = [...new Set(foreignItems.map((b) => b.kesimAlaniId))];
      for (const sourceKAId of sourceKAIds) {
        const itemsFromSource = foreignItems.filter((b) => b.kesimAlaniId === sourceKAId);
        await moveDonationsToKesimAlani(
          itemsFromSource.map((b) => b.donationId),
          sourceKAId,
          kesim.id
        );
      }
      if (kesim.projectId) {
        const transferEntries: DonationTransferEntry[] = foreignItems.map((b) => ({
          id: crypto.randomUUID(),
          projectId: kesim.projectId!,
          donationId: b.donationId,
          donorName: b.name,
          donorDescription: b.description,
          fromKesimAlaniId: b.kesimAlaniId,
          fromKesimAlaniName: b.kesimAlaniName,
          toKesimAlaniId: kesim.id,
          toKesimAlaniName: kesim.name,
          removedFromSource: removeFromSource,
          shareCount: 1,
          createdAt: new Date().toISOString(),
        }));
        try {
          await createDonationTransfers(transferEntries);
        } catch {
          toast({
            title: "Uyarı",
            description: "Aktarım logu kaydedilemedi, ancak bağışçılar başarıyla aktarıldı.",
            variant: "destructive",
          });
        }
      }
      setBasketItems((prev) => prev.filter((b) => !donationIds.includes(b.donationId)));
      const data = await fetchKesimAlani(kesim.id);
      if (data) {
        setKesim(data);
        history.initialize(data);
      }
      toast({ title: `${foreignItems.length} bağışçı bu kesim alanının listesine eklendi` });
    } catch (err) {
      toast({
        title: "Aktarım başarısız",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setTransferToDonorListRemoving(false);
      setTransferToDonorListConfirm(false);
    }
  }

  const handleToggleBasketItem = useCallback(
    (groupIdx: number, dIdx: number, donationId: string, isInBasket: boolean) => {
      if (isInBasket) {
        removeFromBasket(donationId);
      } else {
        addToBasket(groupIdx, dIdx);
      }
    },
    [kesim, basketItemIds]
  );

  return {
    basketItems,
    setBasketItems,
    basketTransferTarget,
    setBasketTransferTarget,
    basketCrossKATarget,
    setBasketCrossKATarget,
    basketOpen,
    setBasketOpen,
    crossKATransferring,
    setCrossKATransferring,
    transferToDonorListConfirm,
    setTransferToDonorListConfirm,
    transferToDonorListRemoving,
    setTransferToDonorListRemoving,
    basketItemIds,
    localBasketItems,
    foreignBasketItems,
    makeBasketItem,
    addToBasket,
    addDonorToBasket,
    addGroupToBasket,
    removeFromBasket,
    clearBasket,
    addSelectedToBasket,
    transferBasketToGroup,
    autoDistributeBasket,
    transferBasketToOtherKA,
    transferForeignToCurrentDonorList,
    handleToggleBasketItem,
  };
}
