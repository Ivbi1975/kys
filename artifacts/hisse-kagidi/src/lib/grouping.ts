import type { Donation, AnimalGroup } from "./types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 12);
}

export function computeEffectiveShares(donations: Donation[]): Map<string, number> {
  const nameCount = new Map<string, number>();
  for (const d of donations) {
    const key = d.name.trim().toLowerCase();
    if (key) {
      nameCount.set(key, (nameCount.get(key) || 0) + 1);
    }
  }
  const result = new Map<string, number>();
  for (const d of donations) {
    const key = d.name.trim().toLowerCase();
    const count = nameCount.get(key) || 1;
    result.set(d.id, count > 1 ? count : d.shareCount);
  }
  return result;
}

export function autoGroupDonations(donations: Donation[]): AnimalGroup[] {
  if (donations.length === 0) return [];

  const effectiveShares = computeEffectiveShares(donations);

  const nameGroups = new Map<string, Donation[]>();
  for (const d of donations) {
    const key = d.name.trim().toLowerCase();
    if (!nameGroups.has(key)) nameGroups.set(key, []);
    nameGroups.get(key)!.push(d);
  }

  const donorUnits: { donations: Donation[]; totalShares: number }[] = [];
  const processedNames = new Set<string>();

  for (const d of donations) {
    const key = d.name.trim().toLowerCase();
    if (processedNames.has(key)) continue;
    processedNames.add(key);

    const group = nameGroups.get(key) || [d];
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
  const effectiveShares = computeEffectiveShares(donations);
  const nameProcessed = new Set<string>();
  let total = 0;
  for (const d of donations) {
    const key = d.name.trim().toLowerCase();
    if (key && nameProcessed.has(key)) continue;
    nameProcessed.add(key);
    total += effectiveShares.get(d.id) || 1;
  }
  return total;
}

export function getRequiredAnimals(donations: Donation[]): number {
  return Math.ceil(getTotalShares(donations) / 7);
}
