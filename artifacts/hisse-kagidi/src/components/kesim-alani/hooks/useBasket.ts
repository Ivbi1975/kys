import { useState, useCallback, useMemo } from "react";
import { produce } from "immer";
import type { Donation, AnimalGroup, KesimAlani } from "@/lib/types";
import { computeEffectiveShares } from "@/lib/grouping";
import { moveDonationsToKesimAlani, moveAnimalGroupToKesimAlani, fetchKesimAlani, createDonationTransfers, apiDeleteAnimalGroup, apiUpdateBulkAnimalGroups } from "@/lib/api";
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
  const [emptyGroupsAfterTransfer, setEmptyGroupsAfterTransfer] = useState<Array<{ id: string; animalNo: number }>>([]);
  const [transferToDonorListConfirm, setTransferToDonorListConfirm] = useState(false);
  const [transferToDonorListRemoving, setTransferToDonorListRemoving] = useState(false);

  const basketItemIds = useMemo(() => new Set(basketItems.filter(b => b.type !== "animalGroup").map((b) => b.donationId)), [basketItems]);
  const basketAnimalGroupIds = useMemo(() => new Set(basketItems.filter(b => b.type === "animalGroup").map(b => b.animalGroupId!)), [basketItems]);
  const localBasketItems = useMemo(
    () => basketItems.filter((b) => b.kesimAlaniId === kesim?.id),
    [basketItems, kesim?.id]
  );
  const foreignBasketItems = useMemo(
    () => basketItems.filter((b) => b.kesimAlaniId !== kesim?.id),
    [basketItems, kesim?.id]
  );

  function makeEmptyDonation(): Donation {
    return {
      id: generateId(),
      name: "",
      description: "",
      donationType: "",
      shareCount: 1,
      vekalet: "",
      notes: "",
    };
  }

  function makeBasketItem(d: Donation): BasketItem {
    return {
      type: "donation",
      donationId: d.id,
      kesimAlaniId: kesim!.id,
      kesimAlaniName: kesim!.name,
      name: d.name,
      description: d.description || "",
      donationType: d.donationType || "",
      donorShareCount: d.shareCount || 1,
      vekalet: d.vekalet || "",
      donorNotes: d.notes || "",
    };
  }

  function addToBasket(groupIdx: number, donationIdx: number) {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    const d = group?.donations[donationIdx];
    if (!d || !d.name.trim()) return;
    if (isGroupLocked(groupIdx)) return;
    if (group?.kesildi) {
      toast({ title: "Kesilmiş grubun bağışçısı sepete eklenemez", variant: "destructive" });
      return;
    }
    if (basketItemIds.has(d.id)) return;
    if (group && basketAnimalGroupIds.has(group.id)) {
      toast({ title: "Bu hayvan komple olarak zaten sepette", variant: "destructive" });
      return;
    }
    const item = makeBasketItem(d);
    item.sourceGroupId = group.id;
    item.sourceGroupAnimalNo = group.animalNo;
    item.sourceSlotIndex = donationIdx;
    setBasketItems((prev) => [...prev, item]);
    const updated = produce(kesim, (draft) => {
      draft.animalGroups[groupIdx].donations[donationIdx] = makeEmptyDonation();
    });
    save(updated, `${d.description || d.name} sepete eklendi (gruptan çıkarıldı)`, false, "groups");
  }

  function addDonorToBasket(donationId: string) {
    if (!kesim || basketItemIds.has(donationId)) return;
    const ownerGroup = kesim.animalGroups.find(g => g.donations.some(d => d.id === donationId));
    if (ownerGroup?.locked) {
      toast({ title: "Kilitli grubun bağışçısı sepete eklenemez", variant: "destructive" });
      return;
    }
    if (ownerGroup?.kesildi) {
      toast({ title: "Kesilmiş grubun bağışçısı sepete eklenemez", variant: "destructive" });
      return;
    }
    if (ownerGroup && basketAnimalGroupIds.has(ownerGroup.id)) {
      toast({ title: "Bu hayvan komple olarak zaten sepette", variant: "destructive" });
      return;
    }
    const d =
      kesim.donations.find((dd) => dd.id === donationId) ||
      kesim.animalGroups.flatMap((g) => g.donations).find((dd) => dd.id === donationId);
    if (!d || !d.name.trim()) return;
    const item = makeBasketItem(d);
    if (ownerGroup) {
      const groupIdx = kesim.animalGroups.indexOf(ownerGroup);
      const donationIdx = ownerGroup.donations.findIndex(dd => dd.id === donationId);
      item.sourceGroupId = ownerGroup.id;
      item.sourceGroupAnimalNo = ownerGroup.animalNo;
      item.sourceSlotIndex = donationIdx;
      setBasketItems((prev) => [...prev, item]);
      if (groupIdx >= 0 && donationIdx >= 0) {
        const updated = produce(kesim, (draft) => {
          draft.animalGroups[groupIdx].donations[donationIdx] = makeEmptyDonation();
        });
        save(updated, `${d.description || d.name} sepete eklendi (gruptan çıkarıldı)`, false, "groups");
      }
    } else {
      setBasketItems((prev) => [...prev, item]);
    }
  }

  function addGroupToBasket(groupIdx: number) {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    if (!group || isGroupLocked(groupIdx)) return;
    if (group.kesildi) {
      toast({ title: "Kesilmiş grubun bağışçıları sepete eklenemez", variant: "destructive" });
      return;
    }
    if (basketAnimalGroupIds.has(group.id)) {
      toast({ title: "Bu hayvan komple olarak zaten sepette", variant: "destructive" });
      return;
    }
    const filled = group.donations.filter((d) => d.name.trim());
    if (filled.length === 0) return;
    const addedIds: string[] = [];
    setBasketItems((prev) => {
      const existingIds = new Set(prev.map((b) => b.donationId));
      const newItems = [...prev];
      for (let di = 0; di < group.donations.length; di++) {
        const d = group.donations[di];
        if (!d.name.trim()) continue;
        if (!existingIds.has(d.id)) {
          const item = makeBasketItem(d);
          item.sourceGroupId = group.id;
          item.sourceGroupAnimalNo = group.animalNo;
          item.sourceSlotIndex = di;
          newItems.push(item);
          existingIds.add(d.id);
          addedIds.push(d.id);
        }
      }
      return newItems;
    });
    const addedIdSet = new Set(addedIds.length > 0 ? addedIds : filled.map(d => d.id));
    const updated = produce(kesim, (draft) => {
      for (let di = 0; di < draft.animalGroups[groupIdx].donations.length; di++) {
        const d = draft.animalGroups[groupIdx].donations[di];
        if (d.name.trim() && addedIdSet.has(d.id)) {
          draft.animalGroups[groupIdx].donations[di] = makeEmptyDonation();
        }
      }
    });
    save(updated, `${filled.length} bağışçı sepete eklendi (Hayvan ${group.animalNo} slotları boşaltıldı)`, false, "groups");
    toast({ title: `${filled.length} bağışçı sepete eklendi`, description: `Hayvan ${group.animalNo}` });
  }

  function addWholeAnimalToBasket(groupIdx: number) {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    if (!group) return;
    if (group.locked) {
      toast({ title: "Kilitli hayvan grubu sepete eklenemez", variant: "destructive" });
      return;
    }
    if (group.kesildi) {
      toast({ title: "Kesilmiş hayvan grubu sepete eklenemez", variant: "destructive" });
      return;
    }
    if (basketAnimalGroupIds.has(group.id)) {
      toast({ title: "Bu hayvan grubu zaten sepette", variant: "destructive" });
      return;
    }
    const filled = group.donations.filter((d) => d.name.trim());
    if (filled.length === 0) {
      toast({ title: "Grupta bağışçı yok", variant: "destructive" });
      return;
    }
    const donorsAlreadyInBasket = filled.filter((d) => basketItemIds.has(d.id));
    if (donorsAlreadyInBasket.length > 0) {
      toast({
        title: "Çakışma",
        description: `Bu gruptaki ${donorsAlreadyInBasket.length} bağışçı zaten tekil olarak sepette. Önce onları sepetten çıkarın.`,
        variant: "destructive",
      });
      return;
    }
    const item: BasketItem = {
      type: "animalGroup",
      donationId: group.id,
      kesimAlaniId: kesim.id,
      kesimAlaniName: kesim.name,
      name: `Hayvan ${group.animalNo}`,
      description: `${filled.length} bağışçı`,
      animalGroupId: group.id,
      animalNo: group.animalNo,
      filledCount: filled.length,
      colorTag: group.colorTag || "",
      donationIds: filled.map((d) => d.id),
      groupUpdatedAt: group.updatedAt ? new Date(group.updatedAt).toISOString() : undefined,
      sourceGroupId: group.id,
      sourceGroupAnimalNo: group.animalNo,
      donationSnapshots: group.donations.map((d, di) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        donationType: d.donationType,
        shareCount: d.shareCount,
        vekalet: d.vekalet,
        notes: d.notes || "",
        slotIndex: d.name.trim() ? di : undefined,
      })).filter(s => s.name.trim()),
    };
    setBasketItems((prev) => [...prev, item]);
    const updated = produce(kesim, (draft) => {
      for (let di = 0; di < draft.animalGroups[groupIdx].donations.length; di++) {
        if (draft.animalGroups[groupIdx].donations[di].name.trim()) {
          draft.animalGroups[groupIdx].donations[di] = makeEmptyDonation();
        }
      }
    });
    save(updated, `Komple Hayvan ${group.animalNo} sepete eklendi (slotlar boşaltıldı)`, false, "groups");
    toast({ title: `Komple hayvan sepete eklendi`, description: `Hayvan ${group.animalNo} (${filled.length} bağışçı)` });
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
    const updated = produce(kesim, (draft) => {
      draft.animalGroups = groups;
    });
    save(
      updated,
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

    const updated = produce(kesim, (draft) => {
      draft.animalGroups = groups.map((g, i) => ({ ...g, animalNo: i + 1 }));
    });
    save(updated, `Sepet otomatik dağıtıldı: ${placed} bağışçı`, false, "groups");
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
      toast({ title: "Bu kesim alanından sepette öğe yok.", variant: "destructive" });
      return;
    }

    const preTransferNonEmptyGroupIds = new Set(
      kesim.animalGroups
        .filter(g => !g.locked && !g.kesildi && g.donations.filter(d => d.name.trim()).length > 0)
        .map(g => g.id)
    );

    const donationItems = itemsToTransfer.filter((b) => b.type !== "animalGroup");
    const animalGroupItems = itemsToTransfer.filter((b) => b.type === "animalGroup");

    setCrossKATransferring(true);
    try {
      const successfulDonationIds: string[] = [];
      const successfulAnimalGroupIds: string[] = [];

      if (donationItems.length > 0) {
        const moveResult = await moveDonationsToKesimAlani(
          donationItems.map((b) => b.donationId),
          kesim.id,
          targetKAId
        );
        if (moveResult.movedIds) {
          successfulDonationIds.push(...moveResult.movedIds);
        } else {
          successfulDonationIds.push(...donationItems.map((b) => b.donationId));
        }
        if (moveResult.skipped > 0) {
          toast({
            title: `${moveResult.skipped} bağışçı aktarılamadı`,
            description: "Kilitli veya kesilmiş gruba ait bağışçılar atlandı",
            variant: "destructive",
          });
        }
      }

      for (const agItem of animalGroupItems) {
        try {
          if (agItem.donationSnapshots && agItem.donationSnapshots.length > 0 && agItem.animalGroupId) {
            const groupIdx = kesim.animalGroups.findIndex(g => g.id === agItem.animalGroupId);
            if (groupIdx >= 0) {
              const restoredGroups = produce(kesim.animalGroups, (draft) => {
                const group = draft[groupIdx];
                let slotIdx = 0;
                for (const snap of agItem.donationSnapshots!) {
                  while (slotIdx < group.donations.length && group.donations[slotIdx].name.trim()) {
                    slotIdx++;
                  }
                  if (slotIdx < group.donations.length) {
                    group.donations[slotIdx] = {
                      id: snap.id,
                      name: snap.name,
                      description: snap.description,
                      donationType: snap.donationType,
                      shareCount: snap.shareCount,
                      vekalet: snap.vekalet,
                      notes: snap.notes || "",
                    };
                    slotIdx++;
                  }
                }
              });
              await apiUpdateBulkAnimalGroups(kesim.id, restoredGroups);
            }
          }

          await moveAnimalGroupToKesimAlani(
            agItem.animalGroupId!,
            kesim.id,
            targetKAId,
            agItem.groupUpdatedAt
          );
          successfulAnimalGroupIds.push(agItem.animalGroupId!);
        } catch (agErr) {
          toast({
            title: `Hayvan ${agItem.animalNo} aktarılamadı`,
            description: agErr instanceof Error ? agErr.message : "Bilinmeyen hata",
            variant: "destructive",
          });
        }
      }

      const targetName = siblingKesimAlanlari.find((ka) => ka.id === targetKAId)?.name || targetKAId;

      if (kesim.projectId && (successfulDonationIds.length > 0 || successfulAnimalGroupIds.length > 0)) {
        const transferEntries: DonationTransferEntry[] = [];

        for (const b of donationItems) {
          if (successfulDonationIds.includes(b.donationId)) {
            transferEntries.push({
              id: crypto.randomUUID(),
              projectId: kesim.projectId!,
              donationId: b.donationId,
              donorName: b.name,
              donorDescription: b.description,
              fromKesimAlaniId: kesim.id,
              fromKesimAlaniName: kesim.name,
              toKesimAlaniId: targetKAId,
              toKesimAlaniName: targetName,
              removedFromSource: true,
              shareCount: 1,
              transferType: "donation",
              createdAt: new Date().toISOString(),
            });
          }
        }

        for (const b of animalGroupItems) {
          if (successfulAnimalGroupIds.includes(b.animalGroupId!)) {
            transferEntries.push({
              id: crypto.randomUUID(),
              projectId: kesim.projectId!,
              donationId: b.animalGroupId || "",
              donorName: b.name,
              donorDescription: `Komple hayvan - ${b.filledCount} bağışçı`,
              fromKesimAlaniId: kesim.id,
              fromKesimAlaniName: kesim.name,
              toKesimAlaniId: targetKAId,
              toKesimAlaniName: targetName,
              removedFromSource: true,
              shareCount: b.filledCount || 1,
              transferType: "animalGroup",
              animalGroupId: b.animalGroupId,
              animalNo: b.animalNo,
              createdAt: new Date().toISOString(),
            });
          }
        }

        if (transferEntries.length > 0) {
          try {
            await createDonationTransfers(transferEntries);
          } catch {
            // non-critical
          }
        }
      }

      const transferredIds = new Set([
        ...successfulDonationIds,
        ...successfulAnimalGroupIds,
      ]);
      setBasketItems((prev) => prev.filter((b) =>
        b.kesimAlaniId !== kesim.id || !transferredIds.has(b.type === "animalGroup" ? b.animalGroupId! : b.donationId)
      ));

      const data = await fetchKesimAlani(kesim.id);
      if (data) {
        setKesim(data);
        history.initialize(data);

        const newlyEmptiedGroups = data.animalGroups.filter(g =>
          !g.locked && !g.kesildi &&
          g.donations.filter(d => d.name.trim()).length === 0 &&
          preTransferNonEmptyGroupIds.has(g.id)
        );
        if (newlyEmptiedGroups.length > 0) {
          setEmptyGroupsAfterTransfer(newlyEmptiedGroups.map(g => ({ id: g.id, animalNo: g.animalNo })));
        }
      }

      const parts: string[] = [];
      if (successfulDonationIds.length > 0) parts.push(`${successfulDonationIds.length} bağışçı`);
      if (successfulAnimalGroupIds.length > 0) parts.push(`${successfulAnimalGroupIds.length} komple hayvan`);

      const failedCount = animalGroupItems.length - successfulAnimalGroupIds.length;
      if (parts.length > 0) {
        toast({
          title: `${parts.join(" ve ")} ${targetName} kesim alanına aktarıldı`,
          description: failedCount > 0 ? `${failedCount} hayvan aktarılamadı, sepette kaldı.` : undefined,
        });
      }
      if (transferredIds.size === itemsToTransfer.length) {
        setBasketCrossKATarget("");
      }
    } catch (err) {
      toast({
        title: "Aktarım başarısız",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
      const data = await fetchKesimAlani(kesim.id);
      if (data) {
        setKesim(data);
        history.initialize(data);
      }
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
      const foreignDonationItems = foreignItems.filter(b => b.type !== "animalGroup");
      const foreignAnimalGroupItems = foreignItems.filter(b => b.type === "animalGroup");

      const sourceKAIds = [...new Set(foreignDonationItems.map((b) => b.kesimAlaniId))];
      for (const sourceKAId of sourceKAIds) {
        const itemsFromSource = foreignDonationItems.filter((b) => b.kesimAlaniId === sourceKAId);
        await moveDonationsToKesimAlani(
          itemsFromSource.map((b) => b.donationId),
          sourceKAId,
          kesim.id
        );
      }

      for (const agItem of foreignAnimalGroupItems) {
        await moveAnimalGroupToKesimAlani(
          agItem.animalGroupId!,
          agItem.kesimAlaniId,
          kesim.id,
          agItem.groupUpdatedAt
        );
      }

      if (kesim.projectId) {
        const transferEntries: DonationTransferEntry[] = [];
        for (const b of foreignDonationItems) {
          transferEntries.push({
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
            transferType: "donation",
            createdAt: new Date().toISOString(),
          });
        }
        for (const b of foreignAnimalGroupItems) {
          transferEntries.push({
            id: crypto.randomUUID(),
            projectId: kesim.projectId!,
            donationId: b.animalGroupId || "",
            donorName: b.name,
            donorDescription: `Komple hayvan - ${b.filledCount} bağışçı`,
            fromKesimAlaniId: b.kesimAlaniId,
            fromKesimAlaniName: b.kesimAlaniName,
            toKesimAlaniId: kesim.id,
            toKesimAlaniName: kesim.name,
            removedFromSource: removeFromSource,
            shareCount: b.filledCount || 1,
            transferType: "animalGroup",
            animalGroupId: b.animalGroupId,
            animalNo: b.animalNo,
            createdAt: new Date().toISOString(),
          });
        }
        try {
          if (transferEntries.length > 0) {
            await createDonationTransfers(transferEntries);
          }
        } catch {
          toast({
            title: "Uyarı",
            description: "Aktarım logu kaydedilemedi, ancak bağışçılar başarıyla aktarıldı.",
            variant: "destructive",
          });
        }
      }
      const foreignItemIds = new Set(foreignItems.map(b => b.donationId));
      setBasketItems((prev) => prev.filter((b) => !foreignItemIds.has(b.donationId)));
      const data = await fetchKesimAlani(kesim.id);
      if (data) {
        setKesim(data);
        history.initialize(data);
      }
      const parts: string[] = [];
      if (foreignDonationItems.length > 0) parts.push(`${foreignDonationItems.length} bağışçı`);
      if (foreignAnimalGroupItems.length > 0) parts.push(`${foreignAnimalGroupItems.length} komple hayvan`);
      toast({ title: `${parts.join(" ve ")} bu kesim alanının listesine eklendi` });
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

  async function cleanupEmptyGroups() {
    if (!kesim || emptyGroupsAfterTransfer.length === 0) {
      setEmptyGroupsAfterTransfer([]);
      return;
    }
    let deletedCount = 0;
    for (const g of emptyGroupsAfterTransfer) {
      try {
        await apiDeleteAnimalGroup(kesim.id, g.id);
        deletedCount++;
      } catch {
        toast({ title: `Hayvan ${g.animalNo} silinemedi`, variant: "destructive" });
      }
    }
    const data = await fetchKesimAlani(kesim.id);
    if (data) {
      setKesim(data);
      history.initialize(data);
    }
    setEmptyGroupsAfterTransfer([]);
    if (deletedCount > 0) {
      toast({ title: `${deletedCount} boş hayvan grubu temizlendi` });
    }
  }

  function dismissEmptyGroupsCleanup() {
    setEmptyGroupsAfterTransfer([]);
  }

  function returnSelectedToDonorList(selectedDonationIds: Set<string>): boolean {
    if (!kesim || selectedDonationIds.size === 0) return false;

    const itemsToReturn: BasketItem[] = [];

    for (const b of basketItems) {
      if (b.kesimAlaniId !== kesim.id) continue;
      if (b.type === "animalGroup" && selectedDonationIds.has(b.donationId)) {
        itemsToReturn.push(b);
      } else if (b.type !== "animalGroup" && selectedDonationIds.has(b.donationId)) {
        itemsToReturn.push(b);
      }
    }

    if (itemsToReturn.length === 0) return false;

    const existingDonorIds = new Set(kesim.donations.map(d => d.id));
    const newDonations: Donation[] = [];

    for (const item of itemsToReturn) {
      if (item.type === "animalGroup" && item.donationSnapshots) {
        for (const snap of item.donationSnapshots) {
          if (!existingDonorIds.has(snap.id)) {
            newDonations.push({
              id: snap.id,
              name: snap.name,
              description: snap.description,
              donationType: snap.donationType,
              shareCount: snap.shareCount,
              vekalet: snap.vekalet,
              notes: snap.notes,
            });
            existingDonorIds.add(snap.id);
          }
        }
      } else if (item.type !== "animalGroup") {
        if (!existingDonorIds.has(item.donationId)) {
          newDonations.push({
            id: item.donationId,
            name: item.name,
            description: item.description,
            donationType: item.donationType || "",
            shareCount: item.donorShareCount || 1,
            vekalet: item.vekalet || "",
            notes: item.donorNotes || "",
          });
          existingDonorIds.add(item.donationId);
        }
      }
    }

    if (newDonations.length > 0) {
      const updated = produce(kesim, (draft) => {
        draft.donations.push(...newDonations);
      });
      save(updated, `${itemsToReturn.length} öğe bağışçı listesine eklendi`, false, "donations");
    }

    setBasketItems(prev => prev.filter(b => !selectedDonationIds.has(b.donationId)));
    toast({ title: `${itemsToReturn.length} öğe bağışçı listesine eklendi` });
    return true;
  }

  function returnSelectedToSource(selectedDonationIds: Set<string>): boolean {
    if (!kesim || selectedDonationIds.size === 0) return false;

    const itemsToReturn = basketItems.filter(
      b => b.kesimAlaniId === kesim.id && selectedDonationIds.has(b.donationId)
    );
    if (itemsToReturn.length === 0) return false;

    const withSource = itemsToReturn.filter(b => b.sourceGroupId);
    const withoutSource = itemsToReturn.filter(b => !b.sourceGroupId);

    const updated = produce(kesim, (draft) => {
      const existingDonorIds = new Set(draft.donations.map(d => d.id));
      for (const item of withSource) {
        const groupIdx = draft.animalGroups.findIndex(g => g.id === item.sourceGroupId);
        if (groupIdx < 0) {
          if (item.type === "animalGroup" && item.donationSnapshots) {
            for (const snap of item.donationSnapshots) {
              if (!existingDonorIds.has(snap.id)) {
                draft.donations.push({
                  id: snap.id, name: snap.name, description: snap.description,
                  donationType: snap.donationType, shareCount: snap.shareCount,
                  vekalet: snap.vekalet, notes: snap.notes,
                });
                existingDonorIds.add(snap.id);
              }
            }
          } else if (!existingDonorIds.has(item.donationId)) {
            draft.donations.push({
              id: item.donationId, name: item.name, description: item.description,
              donationType: item.donationType || "", shareCount: item.donorShareCount || 1,
              vekalet: item.vekalet || "", notes: item.donorNotes || "",
            });
            existingDonorIds.add(item.donationId);
          }
          continue;
        }

        if (item.type === "animalGroup" && item.donationSnapshots) {
          for (const snap of item.donationSnapshots) {
            const slotIdx = snap.slotIndex;
            if (slotIdx !== undefined && slotIdx >= 0 && slotIdx < draft.animalGroups[groupIdx].donations.length) {
              const slot = draft.animalGroups[groupIdx].donations[slotIdx];
              if (!slot.name.trim()) {
                draft.animalGroups[groupIdx].donations[slotIdx] = {
                  id: snap.id, name: snap.name, description: snap.description,
                  donationType: snap.donationType, shareCount: snap.shareCount,
                  vekalet: snap.vekalet, notes: snap.notes,
                };
                continue;
              }
            }
            const emptyIdx = draft.animalGroups[groupIdx].donations.findIndex(d => !d.name.trim());
            if (emptyIdx >= 0) {
              draft.animalGroups[groupIdx].donations[emptyIdx] = {
                id: snap.id, name: snap.name, description: snap.description,
                donationType: snap.donationType, shareCount: snap.shareCount,
                vekalet: snap.vekalet, notes: snap.notes,
              };
            } else {
              draft.donations.push({
                id: snap.id, name: snap.name, description: snap.description,
                donationType: snap.donationType, shareCount: snap.shareCount,
                vekalet: snap.vekalet, notes: snap.notes,
              });
            }
          }
        } else {
          const slotIdx = item.sourceSlotIndex;
          if (slotIdx !== undefined && slotIdx >= 0 && slotIdx < draft.animalGroups[groupIdx].donations.length) {
            const slot = draft.animalGroups[groupIdx].donations[slotIdx];
            if (!slot.name.trim()) {
              draft.animalGroups[groupIdx].donations[slotIdx] = {
                id: item.donationId, name: item.name, description: item.description,
                donationType: item.donationType || "", shareCount: item.donorShareCount || 1,
                vekalet: item.vekalet || "", notes: item.donorNotes || "",
              };
              continue;
            }
          }
          const emptyIdx = draft.animalGroups[groupIdx].donations.findIndex(d => !d.name.trim());
          if (emptyIdx >= 0) {
            draft.animalGroups[groupIdx].donations[emptyIdx] = {
              id: item.donationId, name: item.name, description: item.description,
              donationType: item.donationType || "", shareCount: item.donorShareCount || 1,
              vekalet: item.vekalet || "", notes: item.donorNotes || "",
            };
          } else {
            draft.donations.push({
              id: item.donationId, name: item.name, description: item.description,
              donationType: item.donationType || "", shareCount: item.donorShareCount || 1,
              vekalet: item.vekalet || "", notes: item.donorNotes || "",
            });
          }
        }
      }

      for (const item of withoutSource) {
        if (item.type === "animalGroup" && item.donationSnapshots) {
          for (const snap of item.donationSnapshots) {
            if (!existingDonorIds.has(snap.id)) {
              draft.donations.push({
                id: snap.id, name: snap.name, description: snap.description,
                donationType: snap.donationType, shareCount: snap.shareCount,
                vekalet: snap.vekalet, notes: snap.notes,
              });
              existingDonorIds.add(snap.id);
            }
          }
        } else if (!existingDonorIds.has(item.donationId)) {
          draft.donations.push({
            id: item.donationId, name: item.name, description: item.description,
            donationType: item.donationType || "", shareCount: item.donorShareCount || 1,
            vekalet: item.vekalet || "", notes: item.donorNotes || "",
          });
          existingDonorIds.add(item.donationId);
        }
      }
    });

    const groupReturns = withSource.filter(b => {
      const g = kesim.animalGroups.find(ag => ag.id === b.sourceGroupId);
      return !!g;
    });
    const listReturns = itemsToReturn.length - groupReturns.length;
    const desc = groupReturns.length > 0
      ? `${groupReturns.length} öğe eski grubuna geri yerleştirildi${listReturns > 0 ? `, ${listReturns} öğe bağışçı listesine eklendi` : ""}`
      : `${listReturns} öğe bağışçı listesine eklendi`;

    save(updated, desc, false, groupReturns.length > 0 ? "full" : "donations");
    setBasketItems(prev => prev.filter(b => !selectedDonationIds.has(b.donationId)));
    toast({ title: desc });
    return true;
  }

  function transferSelectedToGroup(selectedDonationIds: Set<string>, targetGroupIdx: number): boolean {
    if (!kesim || selectedDonationIds.size === 0 || targetGroupIdx < 0 || targetGroupIdx >= kesim.animalGroups.length) return false;
    if (isGroupLocked(targetGroupIdx)) {
      toast({ title: "Hedef grup kilitli", variant: "destructive" });
      return false;
    }

    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: g.donations.map((d) => ({ ...d })),
    }));
    const emptySlots = groups[targetGroupIdx].donations.filter(d => !d.name.trim()).length;
    if (emptySlots === 0) {
      toast({ title: "Hedef grupta boş slot yok.", variant: "destructive" });
      return false;
    }

    const basketIdsToRemove = new Set<string>();
    const collectedDonors: Donation[] = [];

    for (const b of basketItems) {
      if (b.kesimAlaniId !== kesim.id) continue;
      if (!selectedDonationIds.has(b.donationId)) continue;

      basketIdsToRemove.add(b.donationId);

      if (b.type === "animalGroup" && b.donationSnapshots) {
        for (const snap of b.donationSnapshots) {
          collectedDonors.push({
            id: snap.id,
            name: snap.name,
            description: snap.description,
            donationType: snap.donationType,
            shareCount: snap.shareCount,
            vekalet: snap.vekalet,
            notes: snap.notes,
          });
        }
      } else if (b.type !== "animalGroup") {
        const fullDonor = kesim.donations.find(d => d.id === b.donationId);
        collectedDonors.push(fullDonor ? { ...fullDonor } : {
          id: b.donationId,
          name: b.name,
          description: b.description,
          donationType: b.donationType || "",
          shareCount: b.donorShareCount || 1,
          vekalet: b.vekalet || "",
          notes: b.donorNotes || "",
        });
      }
    }

    if (collectedDonors.length === 0) return false;

    const sharesMap = computeEffectiveShares(kesim.donations);
    const slotsToPlace: Donation[] = [];
    const snapshotDonorIds = new Set<string>();

    for (const b of basketItems) {
      if (b.kesimAlaniId !== kesim.id) continue;
      if (!selectedDonationIds.has(b.donationId)) continue;
      if (b.type === "animalGroup" && b.donationSnapshots) {
        b.donationSnapshots.forEach(s => snapshotDonorIds.add(s.id));
      }
    }

    for (const donor of collectedDonors) {
      if (snapshotDonorIds.has(donor.id)) {
        slotsToPlace.push(donor);
      } else {
        const effectiveShares = sharesMap.get(donor.id) || donor.shareCount;
        for (let s = 0; s < effectiveShares; s++) {
          slotsToPlace.push({ ...donor, id: s === 0 ? donor.id : generateId() });
        }
      }
    }

    if (slotsToPlace.length > emptySlots) {
      toast({
        title: "Yetersiz Alan",
        description: `${collectedDonors.length} bağışçı ${slotsToPlace.length} slot gerektiriyor, ancak hedef grupta sadece ${emptySlots} boş slot var.`,
        variant: "destructive",
      });
      return false;
    }

    const transferredIds = new Set<string>();
    for (const item of slotsToPlace) {
      const emptyIdx = groups[targetGroupIdx].donations.findIndex(d => !d.name.trim());
      if (emptyIdx >= 0) {
        groups[targetGroupIdx].donations[emptyIdx] = item;
        transferredIds.add(item.id);
      }
    }

    if (transferredIds.size === 0) {
      toast({ title: "Aktarım yapılamadı.", variant: "destructive" });
      return false;
    }

    const updated = produce(kesim, (draft) => {
      draft.animalGroups = groups;
    });

    save(updated, `${collectedDonors.length} bağışçı (${transferredIds.size} slot) Hayvan ${groups[targetGroupIdx].animalNo}'e aktarıldı`, false, "groups");
    setBasketItems(prev => prev.filter(b => !basketIdsToRemove.has(b.donationId)));
    toast({ title: `${collectedDonors.length} bağışçı Hayvan ${groups[targetGroupIdx].animalNo}'e aktarıldı` });
    return true;
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
    emptyGroupsAfterTransfer,
    cleanupEmptyGroups,
    dismissEmptyGroupsCleanup,
    transferToDonorListConfirm,
    setTransferToDonorListConfirm,
    transferToDonorListRemoving,
    setTransferToDonorListRemoving,
    basketItemIds,
    basketAnimalGroupIds,
    localBasketItems,
    foreignBasketItems,
    makeBasketItem,
    addToBasket,
    addDonorToBasket,
    addGroupToBasket,
    addWholeAnimalToBasket,
    removeFromBasket,
    clearBasket,
    addSelectedToBasket,
    transferBasketToGroup,
    autoDistributeBasket,
    transferBasketToOtherKA,
    transferForeignToCurrentDonorList,
    handleToggleBasketItem,
    returnSelectedToDonorList,
    returnSelectedToSource,
    transferSelectedToGroup,
  };
}
