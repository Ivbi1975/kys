import type { Donation, AnimalGroup } from "./types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 12);
}

export function computeEffectiveShares(donations: Donation[]): Map<string, number> {
  const activeDonations = donations.filter(d => !d.excluded);
  const descCount = new Map<string, number>();
  for (const d of activeDonations) {
    const key = d.description.trim().toLowerCase();
    if (key) {
      descCount.set(key, (descCount.get(key) || 0) + 1);
    }
  }
  const result = new Map<string, number>();
  for (const d of activeDonations) {
    const key = d.description.trim().toLowerCase();
    const count = descCount.get(key) || 1;
    result.set(d.id, count > 1 ? count : d.shareCount);
  }
  return result;
}

export function autoGroupDonations(donations: Donation[]): AnimalGroup[] {
  const activeDonations = donations.filter(d => !d.excluded);
  if (activeDonations.length === 0) return [];

  const effectiveShares = computeEffectiveShares(activeDonations);

  const descGroups = new Map<string, Donation[]>();
  for (const d of activeDonations) {
    const key = d.description.trim().toLowerCase();
    if (!descGroups.has(key)) descGroups.set(key, []);
    descGroups.get(key)!.push(d);
  }

  const donorUnits: { donations: Donation[]; totalShares: number }[] = [];
  const processedDescs = new Set<string>();

  for (const d of activeDonations) {
    const key = d.description.trim().toLowerCase();
    if (processedDescs.has(key)) continue;
    processedDescs.add(key);

    const group = descGroups.get(key) || [d];
    const shareCount = effectiveShares.get(d.id) || 1;
    donorUnits.push({ donations: group, totalShares: shareCount });
  }

  donorUnits.sort((a, b) => b.totalShares - a.totalShares);

  const groups: AnimalGroup[] = [];
  const used = new Set<number>();
  let animalNo = 1;

  while (used.size < donorUnits.length) {
    const group: { donations: Donation[]; shares: number }[] = [];
    let remaining = 7;

    for (let i = 0; i < donorUnits.length; i++) {
      if (used.has(i)) continue;
      const unit = donorUnits[i];
      if (unit.totalShares <= remaining) {
        group.push({ donations: unit.donations, shares: unit.totalShares });
        remaining -= unit.totalShares;
        used.add(i);
      }
      if (remaining === 0) break;
    }

    const groupDonations: Donation[] = [];
    for (const g of group) {
      for (const d of g.donations) {
        groupDonations.push({ ...d });
      }
      const extraSlots = g.shares - g.donations.length;
      for (let s = 0; s < extraSlots; s++) {
        groupDonations.push({
          ...g.donations[0],
          id: generateId(),
        });
      }
    }

    while (groupDonations.length < 7) {
      groupDonations.push({
        id: generateId(),
        name: "",
        description: "",
        donationType: "",
        shareCount: 1,
        vekalet: "",
        notes: "",
      });
    }

    groups.push({
      id: generateId(),
      animalNo,
      donations: groupDonations.slice(0, 7),
    });
    animalNo++;
  }

  return groups;
}

export function getTotalShares(donations: Donation[]): number {
  const activeDonations = donations.filter(d => !d.excluded);
  const effectiveShares = computeEffectiveShares(activeDonations);
  const descProcessed = new Set<string>();
  let total = 0;
  for (const d of activeDonations) {
    const key = d.description.trim().toLowerCase();
    if (key && descProcessed.has(key)) continue;
    descProcessed.add(key);
    total += effectiveShares.get(d.id) || 1;
  }
  return total;
}

export function getRequiredAnimals(donations: Donation[]): number {
  return Math.ceil(getTotalShares(donations) / 7);
}
