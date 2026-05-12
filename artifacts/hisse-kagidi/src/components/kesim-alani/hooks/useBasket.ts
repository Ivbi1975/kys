import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { produce } from "immer";
import type { Donation, AnimalGroup, KesimAlani } from "@/lib/types";
import { MAX_SHARES_PER_ANIMAL } from "@/lib/constants";
import { generateId, loadBasketFromStorage, saveBasketToStorage } from "./types";
import type { BasketItem, SaveFn, KesimDeps, ReturnToSourceResult } from "./types";

interface UseBasketDeps extends KesimDeps {
  isGroupLocked: (groupIdx: number) => boolean;
}

export function useBasket({ kesim, setKesim, save, history, toast, isGroupLocked }: UseBasketDeps) {
  const [basketItems, setBasketItems] = useState<BasketItem[]>(() => {
    return loadBasketFromStorage(kesim?.projectId);
  });
  const [basketOpen, setBasketOpen] = useState(true);

  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const isReceivingBroadcast = useRef(false);

  useEffect(() => {
    if (!kesim?.projectId) return;
    const channel = new BroadcastChannel(`basket-${kesim.projectId}`);
    broadcastRef.current = channel;
    channel.onmessage = (e) => {
      if (e.data?.type === "basket-update") {
        isReceivingBroadcast.current = true;
        setBasketItems(e.data.items);
        requestAnimationFrame(() => { isReceivingBroadcast.current = false; });
      }
    };
    return () => { channel.close(); broadcastRef.current = null; };
  }, [kesim?.projectId]);

  useEffect(() => {
    saveBasketToStorage(basketItems, kesim?.projectId);
    if (!isReceivingBroadcast.current && broadcastRef.current) {
      try {
        broadcastRef.current.postMessage({ type: "basket-update", items: basketItems });
      } catch {}
    }
  }, [basketItems, kesim?.projectId]);

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
      addedAt: Date.now(),
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
    const filled = group.donations.filter((d) => d.name.trim() && !d.excluded);
    if (filled.length === 0) return;
    const addedIds: string[] = [];
    setBasketItems((prev) => {
      const existingIds = new Set(prev.map((b) => b.donationId));
      const newItems = [...prev];
      for (let di = 0; di < group.donations.length; di++) {
        const d = group.donations[di];
        if (!d.name.trim() || d.excluded) continue;
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
      addedAt: Date.now(),
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

  function autoDistributeBasket() {
    if (!kesim || localBasketItems.length === 0) return;

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

    const basketShareMap = new Map(localBasketItems.map(b => [b.donationId, b.donorShareCount || 1]));

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
      totalShares += inGroup ? 1 : (basketShareMap.get(d.id) || d.shareCount || 1);
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
        const eff = basketShareMap.get(donor.id) || donor.shareCount || 1;
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

  function returnSelectedToSource(selectedDonationIds: Set<string>): ReturnToSourceResult {
    if (!kesim || selectedDonationIds.size === 0) return { success: false, restoredToOriginalSlot: 0, restoredToAlternativeSlot: 0, sentToDonorList: 0, groupDeletedCount: 0, slotFullCount: 0 };

    const itemsToReturn = basketItems.filter(
      b => b.kesimAlaniId === kesim.id && selectedDonationIds.has(b.donationId)
    );
    if (itemsToReturn.length === 0) return { success: false, restoredToOriginalSlot: 0, restoredToAlternativeSlot: 0, sentToDonorList: 0, groupDeletedCount: 0, slotFullCount: 0 };

    const withSource = itemsToReturn.filter(b => b.sourceGroupId);
    const withoutSource = itemsToReturn.filter(b => !b.sourceGroupId);

    let restoredToOriginalSlot = 0;
    let restoredToAlternativeSlot = 0;
    let sentToDonorList = 0;
    let groupDeletedCount = 0;
    let slotFullCount = 0;

    const updated = produce(kesim, (draft) => {
      const existingDonorIds = new Set(draft.donations.map(d => d.id));
      for (const item of withSource) {
        const groupIdx = draft.animalGroups.findIndex(g => g.id === item.sourceGroupId);
        if (groupIdx < 0) {
          groupDeletedCount++;
          if (item.type === "animalGroup" && item.donationSnapshots) {
            for (const snap of item.donationSnapshots) {
              if (!existingDonorIds.has(snap.id)) {
                draft.donations.push({
                  id: snap.id, name: snap.name, description: snap.description,
                  donationType: snap.donationType, shareCount: snap.shareCount,
                  vekalet: snap.vekalet, notes: snap.notes,
                });
                existingDonorIds.add(snap.id);
                sentToDonorList++;
              }
            }
          } else if (!existingDonorIds.has(item.donationId)) {
            draft.donations.push({
              id: item.donationId, name: item.name, description: item.description,
              donationType: item.donationType || "", shareCount: item.donorShareCount || 1,
              vekalet: item.vekalet || "", notes: item.donorNotes || "",
            });
            existingDonorIds.add(item.donationId);
            sentToDonorList++;
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
                restoredToOriginalSlot++;
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
              restoredToAlternativeSlot++;
            } else {
              draft.donations.push({
                id: snap.id, name: snap.name, description: snap.description,
                donationType: snap.donationType, shareCount: snap.shareCount,
                vekalet: snap.vekalet, notes: snap.notes,
              });
              sentToDonorList++;
              slotFullCount++;
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
              restoredToOriginalSlot++;
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
            restoredToAlternativeSlot++;
          } else {
            draft.donations.push({
              id: item.donationId, name: item.name, description: item.description,
              donationType: item.donationType || "", shareCount: item.donorShareCount || 1,
              vekalet: item.vekalet || "", notes: item.donorNotes || "",
            });
            sentToDonorList++;
            slotFullCount++;
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
              sentToDonorList++;
            }
          }
        } else if (!existingDonorIds.has(item.donationId)) {
          draft.donations.push({
            id: item.donationId, name: item.name, description: item.description,
            donationType: item.donationType || "", shareCount: item.donorShareCount || 1,
            vekalet: item.vekalet || "", notes: item.donorNotes || "",
          });
          existingDonorIds.add(item.donationId);
          sentToDonorList++;
        }
      }
    });

    const parts: string[] = [];
    if (restoredToOriginalSlot > 0) parts.push(`${restoredToOriginalSlot} eski yerine yerleştirildi`);
    if (restoredToAlternativeSlot > 0) parts.push(`${restoredToAlternativeSlot} aynı gruptaki başka slota yerleştirildi`);
    if (sentToDonorList > 0) {
      const reasons: string[] = [];
      if (groupDeletedCount > 0) reasons.push(`${groupDeletedCount} grubun silinmiş olması`);
      if (slotFullCount > 0) reasons.push(`${slotFullCount} slotun dolu olması`);
      parts.push(`${sentToDonorList} bağışçı listesine eklendi${reasons.length > 0 ? ` (${reasons.join(", ")})` : ""}`);
    }
    const desc = parts.join("; ");

    const hasGroupChanges = restoredToOriginalSlot > 0 || restoredToAlternativeSlot > 0;
    save(updated, desc, false, hasGroupChanges ? "full" : "donations");
    setBasketItems(prev => prev.filter(b => !selectedDonationIds.has(b.donationId)));

    if (slotFullCount > 0 || groupDeletedCount > 0) {
      toast({
        title: "Kısmi Geri Yükleme",
        description: desc + ". Yeni hayvan grubu oluşturup yerleştirebilirsiniz.",
        variant: "destructive",
      });
    } else {
      toast({ title: desc });
    }

    return { success: true, restoredToOriginalSlot, restoredToAlternativeSlot, sentToDonorList, groupDeletedCount, slotFullCount };
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
        const slots = donor.shareCount || 1;
        for (let s = 0; s < slots; s++) {
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

  function placeBasketItemInGroup(donationId: string, targetGroupIdx: number, _targetSlotIdx: number): boolean {
    if (!kesim) return false;
    const item = basketItems.find(b => b.donationId === donationId && b.type === "donation");
    if (!item) return false;
    if (item.kesimAlaniId !== kesim.id) return false;
    const group = kesim.animalGroups[targetGroupIdx];
    if (!group) return false;
    if (group.locked) {
      toast({ title: "Kilitli gruba yerleştirilemez", variant: "destructive" });
      return false;
    }
    if (group.kesildi) {
      toast({ title: "Kesilmiş gruba yerleştirilemez", variant: "destructive" });
      return false;
    }

    const donor = kesim.donations.find(d => d.id === donationId) ||
      kesim.animalGroups.flatMap(g => g.donations).find(d => d.id === donationId);
    if (!donor) return false;

    const effectiveShares = item.donorShareCount || donor.shareCount || 1;
    const emptySlots = group.donations.filter(d => !d.name.trim()).length;

    if (effectiveShares > emptySlots) {
      toast({
        title: "Yetersiz Alan",
        description: `Bu bağışçı ${effectiveShares} slot gerektiriyor, ancak grupta sadece ${emptySlots} boş slot var.`,
        variant: "destructive",
      });
      return false;
    }

    const slotsToPlace: Donation[] = [];
    for (let s = 0; s < effectiveShares; s++) {
      slotsToPlace.push({ ...donor, id: s === 0 ? donor.id : generateId() });
    }

    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: g.donations.map((d) => ({ ...d })),
    }));

    for (const slotDonor of slotsToPlace) {
      const emptyIdx = groups[targetGroupIdx].donations.findIndex(d => !d.name.trim());
      if (emptyIdx >= 0) {
        groups[targetGroupIdx].donations[emptyIdx] = slotDonor;
      }
    }

    const updated = produce(kesim, (draft) => {
      draft.animalGroups = groups;
    });
    save(updated, `${donor.description || donor.name} sepetten Hayvan ${group.animalNo}'e yerleştirildi (${effectiveShares} slot)`, false, "groups");
    setBasketItems(prev => prev.filter(b => b.donationId !== donationId));
    return true;
  }

  return {
    basketItems,
    setBasketItems,
    basketOpen,
    setBasketOpen,
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
    autoDistributeBasket,
    handleToggleBasketItem,
    returnSelectedToDonorList,
    returnSelectedToSource,
    transferSelectedToGroup,
    placeBasketItemInGroup,
  };
}
