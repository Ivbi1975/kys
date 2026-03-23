import type { Donation, AnimalGroup } from "./types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 12);
}

export function autoGroupDonations(donations: Donation[]): AnimalGroup[] {
  if (donations.length === 0) return [];

  const expandedDonations: { donation: Donation; assignedShares: number }[] = [];
  for (const d of donations) {
    expandedDonations.push({ donation: d, assignedShares: d.shareCount });
  }

  expandedDonations.sort((a, b) => b.assignedShares - a.assignedShares);

  const groups: AnimalGroup[] = [];
  const used = new Set<number>();

  let animalNo = 1;

  while (used.size < expandedDonations.length) {
    const group: { donation: Donation; shares: number }[] = [];
    let remaining = 7;

    for (let i = 0; i < expandedDonations.length; i++) {
      if (used.has(i)) continue;
      const item = expandedDonations[i];
      if (item.assignedShares <= remaining) {
        group.push({ donation: item.donation, shares: item.assignedShares });
        remaining -= item.assignedShares;
        used.add(i);
      }
      if (remaining === 0) break;
    }

    const groupDonations: Donation[] = [];
    for (const g of group) {
      for (let s = 0; s < g.shares; s++) {
        groupDonations.push({
          ...g.donation,
          id: g.shares > 1 && s > 0 ? generateId() : g.donation.id,
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
  return donations.reduce((sum, d) => sum + d.shareCount, 0);
}

export function getRequiredAnimals(donations: Donation[]): number {
  return Math.ceil(getTotalShares(donations) / 7);
}
