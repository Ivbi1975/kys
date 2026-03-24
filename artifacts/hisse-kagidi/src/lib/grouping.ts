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

function splitDonorUnit(unit: DonorUnit, shares: number): [DonorUnit, DonorUnit | null] {
  const splitDonationCount = Math.min(unit.donations.length, shares);
  const splitDonations = unit.donations.slice(0, splitDonationCount);
  const remaining = unit.donations.slice(splitDonationCount);

  const first: DonorUnit = {
    templateDonation: unit.templateDonation,
    donations: splitDonations,
    totalShares: shares,
  };

  const rest = unit.totalShares - shares;
  if (rest <= 0) return [first, null];

  const second: DonorUnit = {
    templateDonation: unit.templateDonation,
    donations: remaining,
    totalShares: rest,
  };

  return [first, second];
}

interface Mod7Result {
  fullAnimals: GroupedSegment[][];
  remainders: DonorUnit[];
}

function applyMod7PreSplit(units: DonorUnit[]): Mod7Result {
  const fullAnimals: GroupedSegment[][] = [];
  const remainders: DonorUnit[] = [];

  for (const unit of units) {
    let remaining = { ...unit, donations: [...unit.donations] };

    while (remaining.totalShares >= 7) {
      const [chunk, rest] = splitDonorUnit(remaining, 7);
      fullAnimals.push([{
        templateDonation: chunk.templateDonation,
        donations: chunk.donations,
        shares: 7,
      }]);
      if (rest === null) break;
      remaining = rest;
    }

    if (remaining.totalShares > 0) {
      remainders.push(remaining);
    }
  }

  return { fullAnimals, remainders };
}

function tryMatchPairs(remainders: DonorUnit[]): { animals: GroupedSegment[][]; leftover: DonorUnit[] } {
  const pools: DonorUnit[][] = [[], [], [], [], [], []];
  for (const u of remainders) {
    if (u.totalShares >= 1 && u.totalShares <= 6) {
      pools[u.totalShares - 1].push({ ...u, donations: [...u.donations] });
    }
  }

  const animals: GroupedSegment[][] = [];

  const makePair = (sA: number, sB: number) => {
    while (pools[sA - 1].length > 0 && pools[sB - 1].length > 0) {
      const uA = pools[sA - 1].shift()!;
      const uB = pools[sB - 1].shift()!;
      animals.push([
        { templateDonation: uA.templateDonation, donations: uA.donations, shares: sA },
        { templateDonation: uB.templateDonation, donations: uB.donations, shares: sB },
      ]);
    }
  };

  makePair(6, 1);
  makePair(5, 2);
  makePair(4, 3);

  const leftover: DonorUnit[] = [];
  for (let s = 1; s <= 6; s++) {
    leftover.push(...pools[s - 1]);
  }

  return { animals, leftover };
}

function tryMatchTriples(remainders: DonorUnit[]): { animals: GroupedSegment[][]; leftover: DonorUnit[] } {
  const pools: DonorUnit[][] = [[], [], [], [], [], []];
  for (const u of remainders) {
    if (u.totalShares >= 1 && u.totalShares <= 6) {
      pools[u.totalShares - 1].push({ ...u, donations: [...u.donations] });
    }
  }

  const animals: GroupedSegment[][] = [];

  type Triple = [number, number, number];
  const allTriples: Triple[] = [
    [5, 1, 1],
    [4, 2, 1],
    [3, 3, 1],
    [3, 2, 2],
    [2, 2, 2],
  ];

  const tryTriple = (a: number, b: number, c: number) => {
    const poolA = pools[a - 1];
    const poolB = pools[b - 1];
    const poolC = pools[c - 1];

    if (a === b && b === c) {
      while (poolA.length >= 3) {
        const u1 = poolA.shift()!;
        const u2 = poolA.shift()!;
        const u3 = poolA.shift()!;
        animals.push([
          { templateDonation: u1.templateDonation, donations: u1.donations, shares: a },
          { templateDonation: u2.templateDonation, donations: u2.donations, shares: b },
          { templateDonation: u3.templateDonation, donations: u3.donations, shares: c },
        ]);
      }
    } else if (a === b) {
      while (poolA.length >= 2 && poolC.length >= 1) {
        const u1 = poolA.shift()!;
        const u2 = poolA.shift()!;
        const u3 = poolC.shift()!;
        animals.push([
          { templateDonation: u1.templateDonation, donations: u1.donations, shares: a },
          { templateDonation: u2.templateDonation, donations: u2.donations, shares: b },
          { templateDonation: u3.templateDonation, donations: u3.donations, shares: c },
        ]);
      }
    } else if (b === c) {
      while (poolA.length >= 1 && poolB.length >= 2) {
        const u1 = poolA.shift()!;
        const u2 = poolB.shift()!;
        const u3 = poolB.shift()!;
        animals.push([
          { templateDonation: u1.templateDonation, donations: u1.donations, shares: a },
          { templateDonation: u2.templateDonation, donations: u2.donations, shares: b },
          { templateDonation: u3.templateDonation, donations: u3.donations, shares: c },
        ]);
      }
    } else {
      while (poolA.length >= 1 && poolB.length >= 1 && poolC.length >= 1) {
        const u1 = poolA.shift()!;
        const u2 = poolB.shift()!;
        const u3 = poolC.shift()!;
        animals.push([
          { templateDonation: u1.templateDonation, donations: u1.donations, shares: a },
          { templateDonation: u2.templateDonation, donations: u2.donations, shares: b },
          { templateDonation: u3.templateDonation, donations: u3.donations, shares: c },
        ]);
      }
    }
  };

  for (const [a, b, c] of allTriples) {
    tryTriple(a, b, c);
  }

  const leftover: DonorUnit[] = [];
  for (let s = 1; s <= 6; s++) {
    leftover.push(...pools[s - 1]);
  }

  return { animals, leftover };
}

function packLeftovers(remainders: DonorUnit[]): GroupedSegment[][] {
  if (remainders.length === 0) return [];

  const animals: GroupedSegment[][] = [];
  const queue = remainders.map(u => ({ ...u, donations: [...u.donations] }));

  while (queue.length > 0) {
    const segments: GroupedSegment[] = [];
    let remaining = 7;
    let i = 0;

    while (i < queue.length && remaining > 0) {
      const unit = queue[i];
      if (unit.totalShares <= remaining) {
        segments.push({
          templateDonation: unit.templateDonation,
          donations: unit.donations,
          shares: unit.totalShares,
        });
        remaining -= unit.totalShares;
        queue.splice(i, 1);
      } else {
        i++;
      }
    }

    if (remaining > 0 && queue.length > 0) {
      const unit = queue[0];
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
        queue.splice(0, 1);
      }
    }

    if (segments.length > 0) {
      animals.push(segments);
    } else {
      break;
    }
  }

  return animals;
}

function mod7GroupDonations(donations: Donation[]): GroupedSegment[][] {
  const units = prepareDonorUnits(donations);
  if (units.length === 0) return [];

  const unitsDeep = units.map(u => ({ ...u, donations: [...u.donations] }));

  const { fullAnimals, remainders } = applyMod7PreSplit(unitsDeep);

  const { animals: pairedAnimals, leftover: afterPairs } = tryMatchPairs(remainders);

  const { animals: tripledAnimals, leftover: afterTriples } = tryMatchTriples(afterPairs);

  const leftoverAnimals = packLeftovers(afterTriples);

  return [...fullAnimals, ...pairedAnimals, ...tripledAnimals, ...leftoverAnimals];
}

export function autoGroupDonations(donations: Donation[]): AnimalGroup[] {
  const allSegmentGroups = mod7GroupDonations(donations);
  if (allSegmentGroups.length === 0) return [];

  const groups: AnimalGroup[] = [];
  let animalNo = 1;

  for (const segments of allSegmentGroups) {
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
  const allSegmentGroups = mod7GroupDonations(donations);
  if (allSegmentGroups.length === 0) return [];

  const estimatedTotal = allSegmentGroups.length;
  const groups: AnimalGroup[] = [];
  let animalNo = 1;

  for (const segments of allSegmentGroups) {
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
