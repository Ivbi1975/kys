import type { Donation, AnimalGroup } from "./types";

function generateId(): string {
  return crypto.randomUUID();
}

function getSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 0 ? parts[parts.length - 1] : "";
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

interface DonorUnit {
  templateDonation: Donation;
  donations: Donation[];
  totalShares: number;
}

interface GroupedSegment {
  templateDonation: Donation;
  donations: Donation[];
  shares: number;
}

function createEmptyDonation(): Donation {
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

function buildGroupDonations(segments: GroupedSegment[]): Donation[] {
  const groupDonations: Donation[] = [];
  for (const g of segments) {
    for (const d of g.donations) {
      groupDonations.push({ ...d });
    }
    const extraSlots = g.shares - g.donations.length;
    for (let s = 0; s < extraSlots; s++) {
      groupDonations.push({
        ...g.templateDonation,
        id: generateId(),
      });
    }
  }

  const filled = groupDonations.filter(d => d.name.trim() || d.description.trim());
  const empty = groupDonations.filter(d => !d.name.trim() && !d.description.trim());
  filled.sort((a, b) => {
    const surnameA = getSurname(a.description || a.name);
    const surnameB = getSurname(b.description || b.name);
    return surnameA.localeCompare(surnameB, "tr");
  });
  const sorted = [...filled, ...empty];

  while (sorted.length < 7) {
    sorted.push(createEmptyDonation());
  }

  return sorted.slice(0, 7);
}

function prepareDonorUnits(donations: Donation[]): DonorUnit[] {
  const activeDonations = donations.filter(d => !d.excluded);
  if (activeDonations.length === 0) return [];

  const effectiveShares = computeEffectiveShares(activeDonations);

  const descGroups = new Map<string, Donation[]>();
  for (const d of activeDonations) {
    const key = d.description.trim().toLowerCase();
    if (!descGroups.has(key)) descGroups.set(key, []);
    descGroups.get(key)!.push(d);
  }

  const donorUnits: DonorUnit[] = [];
  const processedDescs = new Set<string>();

  for (const d of activeDonations) {
    const key = d.description.trim().toLowerCase();
    if (processedDescs.has(key)) continue;
    processedDescs.add(key);

    const group = descGroups.get(key) || [d];
    const shareCount = effectiveShares.get(d.id) || 1;
    donorUnits.push({
      templateDonation: group[0],
      donations: group,
      totalShares: shareCount,
    });
  }

  donorUnits.sort((a, b) => b.totalShares - a.totalShares);
  return donorUnits;
}

function fillAnimalGroup(
  remainingUnits: DonorUnit[]
): GroupedSegment[] | null {
  const segments: GroupedSegment[] = [];
  let remaining = 7;

  let i = 0;
  while (i < remainingUnits.length && remaining > 0) {
    const unit = remainingUnits[i];
    if (unit.totalShares <= remaining) {
      segments.push({
        templateDonation: unit.templateDonation,
        donations: unit.donations,
        shares: unit.totalShares,
      });
      remaining -= unit.totalShares;
      remainingUnits.splice(i, 1);
    } else {
      i++;
    }
  }

  if (remaining > 0 && remainingUnits.length > 0) {
    const unit = remainingUnits[0];
    const splitShares = remaining;
    const splitDonationCount = Math.min(unit.donations.length, splitShares);
    const splitDonations = unit.donations.slice(0, splitDonationCount);

    segments.push({
      templateDonation: unit.templateDonation,
      donations: splitDonations,
      shares: splitShares,
    });

    unit.donations = unit.donations.slice(splitDonationCount);
    unit.totalShares -= splitShares;

    if (unit.totalShares <= 0) {
      remainingUnits.splice(0, 1);
    }
  }

  return segments.length > 0 ? segments : null;
}

export function autoGroupDonations(donations: Donation[]): AnimalGroup[] {
  const units = prepareDonorUnits(donations);
  if (units.length === 0) return [];

  const remainingUnits: DonorUnit[] = units.map(u => ({
    ...u,
    donations: [...u.donations],
  }));

  const groups: AnimalGroup[] = [];
  let animalNo = 1;

  while (remainingUnits.length > 0) {
    const segments = fillAnimalGroup(remainingUnits);
    if (!segments) break;

    groups.push({
      id: generateId(),
      animalNo,
      donations: buildGroupDonations(segments),
    });
    animalNo++;
  }

  return groups;
}

export interface GroupingProgress {
  current: number;
  total: number;
}

export async function autoGroupDonationsAsync(
  donations: Donation[],
  onProgress?: (progress: GroupingProgress) => void
): Promise<AnimalGroup[]> {
  const units = prepareDonorUnits(donations);
  if (units.length === 0) return [];

  let totalSharesSum = 0;
  for (const u of units) totalSharesSum += u.totalShares;
  const estimatedTotal = Math.ceil(totalSharesSum / 7);

  const remainingUnits: DonorUnit[] = units.map(u => ({
    ...u,
    donations: [...u.donations],
  }));

  const groups: AnimalGroup[] = [];
  let animalNo = 1;

  while (remainingUnits.length > 0) {
    const segments = fillAnimalGroup(remainingUnits);
    if (!segments) break;

    groups.push({
      id: generateId(),
      animalNo,
      donations: buildGroupDonations(segments),
    });

    if (onProgress) {
      onProgress({ current: animalNo, total: estimatedTotal });
    }

    if (animalNo % 2 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

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

export interface ConflictInfo {
  description: string;
  animalNos: number[];
  totalShares: number;
  isExpected: boolean;
}

export function checkGroupConflicts(groups: AnimalGroup[]): ConflictInfo[] {
  const descToAnimals = new Map<string, Set<number>>();
  const descToCount = new Map<string, number>();
  for (const group of groups) {
    for (const d of group.donations) {
      const key = d.description.trim().toLowerCase();
      if (!key) continue;
      if (!descToAnimals.has(key)) descToAnimals.set(key, new Set());
      descToAnimals.get(key)!.add(group.animalNo);
      descToCount.set(key, (descToCount.get(key) || 0) + 1);
    }
  }
  const conflicts: ConflictInfo[] = [];
  for (const [desc, animals] of descToAnimals) {
    if (animals.size > 1) {
      const totalShares = descToCount.get(desc) || 0;
      const originalDesc = groups
        .flatMap(g => g.donations)
        .find(d => d.description.trim().toLowerCase() === desc)?.description || desc;
      conflicts.push({
        description: originalDesc,
        animalNos: Array.from(animals).sort((a, b) => a - b),
        totalShares,
        isExpected: totalShares > 7,
      });
    }
  }
  conflicts.sort((a, b) => {
    if (a.isExpected !== b.isExpected) return a.isExpected ? 1 : -1;
    return a.description.localeCompare(b.description, "tr");
  });
  return conflicts;
}
