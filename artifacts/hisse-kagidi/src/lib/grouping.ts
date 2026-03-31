import type { Donation, AnimalGroup } from "./types";

export const trCollator = new Intl.Collator("tr");

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
  const filledKeys = filled.map(d => ({
    d,
    surname: getSurname(d.description || d.name),
    typePriority: getDonationTypePriority(d.donationType),
  }));
  filledKeys.sort((a, b) => {
    if (a.typePriority !== b.typePriority) return a.typePriority - b.typePriority;
    return trCollator.compare(a.surname, b.surname);
  });
  const sorted: Donation[] = [...filledKeys.map(k => k.d), ...empty];

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

function normalizeDonationType(t: string): string {
  return (t || "").trim().toUpperCase();
}

const DONATION_TYPE_ALIASES: Record<string, string> = {
  "VACİP": "VACIP", "VACİB": "VACIP", "VACIB": "VACIP",
  "AKİKA": "AKIKA",
  "MEVTA KURBANI": "MEVTA",
};

const DONATION_TYPE_PRIORITY_ORDER: string[] = ["VACIP", "ADAK", "AKIKA", "MEVTA"];

function canonicalizeDonationType(t: string): string {
  const normalized = normalizeDonationType(t);
  return DONATION_TYPE_ALIASES[normalized] ?? normalized;
}

function getDonationTypePriority(t: string): number {
  const canonical = canonicalizeDonationType(t);
  const idx = DONATION_TYPE_PRIORITY_ORDER.indexOf(canonical);
  return idx >= 0 ? idx : DONATION_TYPE_PRIORITY_ORDER.length;
}

function getDominantDonationType(unit: DonorUnit): string {
  if (unit.donations.length === 0) {
    return canonicalizeDonationType(unit.templateDonation.donationType);
  }
  const typeCounts = new Map<string, number>();
  for (const d of unit.donations) {
    const t = canonicalizeDonationType(d.donationType);
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  }
  let maxCount = 0;
  let dominant = "";
  for (const [t, c] of typeCounts) {
    if (c > maxCount || (c === maxCount && getDonationTypePriority(t) < getDonationTypePriority(dominant))) {
      maxCount = c;
      dominant = t;
    }
  }
  return dominant;
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

function tryFlexibleMatch(remainders: DonorUnit[]): { animals: GroupedSegment[][]; leftover: DonorUnit[] } {
  const pools: DonorUnit[][] = [[], [], [], [], [], []];
  for (const u of remainders) {
    if (u.totalShares >= 1 && u.totalShares <= 6) {
      pools[u.totalShares - 1].push({ ...u, donations: [...u.donations] });
    }
  }

  const animals: GroupedSegment[][] = [];

  function tryFillRemainder(needed: number, segments: GroupedSegment[]): boolean {
    if (needed === 0) return true;

    for (let s = Math.min(needed, 6); s >= 1; s--) {
      if (pools[s - 1].length > 0) {
        const unit = pools[s - 1].shift()!;
        segments.push({ templateDonation: unit.templateDonation, donations: unit.donations, shares: s });
        if (tryFillRemainder(needed - s, segments)) {
          return true;
        }
        segments.pop();
        pools[s - 1].unshift(unit);
      }
    }

    return false;
  }

  for (let anchorSize = 6; anchorSize >= 1; anchorSize--) {
    while (pools[anchorSize - 1].length > 0) {
      const anchor = pools[anchorSize - 1].shift()!;
      const segments: GroupedSegment[] = [
        { templateDonation: anchor.templateDonation, donations: anchor.donations, shares: anchorSize },
      ];
      const needed = 7 - anchorSize;

      if (needed === 0 || tryFillRemainder(needed, segments)) {
        animals.push(segments);
      } else {
        pools[anchorSize - 1].unshift(anchor);
        break;
      }
    }
  }

  const leftover: DonorUnit[] = [];
  for (let s = 1; s <= 6; s++) {
    leftover.push(...pools[s - 1]);
  }

  return { animals, leftover };
}

function getSegmentGroupDominantType(segments: GroupedSegment[]): string {
  const typeCounts = new Map<string, number>();
  for (const seg of segments) {
    for (const d of seg.donations) {
      const t = canonicalizeDonationType(d.donationType);
      typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    }
    const extraSlots = seg.shares - seg.donations.length;
    if (extraSlots > 0) {
      const t = canonicalizeDonationType(seg.templateDonation.donationType);
      typeCounts.set(t, (typeCounts.get(t) || 0) + extraSlots);
    }
  }
  let maxCount = 0;
  let dominant = "";
  for (const [t, c] of typeCounts) {
    if (c > maxCount || (c === maxCount && getDonationTypePriority(t) < getDonationTypePriority(dominant))) {
      maxCount = c;
      dominant = t;
    }
  }
  return dominant;
}

function sortAnimalsByDominantType(animals: GroupedSegment[][]): GroupedSegment[][] {
  return [...animals].sort((a, b) => {
    const typeA = getSegmentGroupDominantType(a);
    const typeB = getSegmentGroupDominantType(b);
    return getDonationTypePriority(typeA) - getDonationTypePriority(typeB);
  });
}

function packLeftoversByType(remainders: DonorUnit[]): GroupedSegment[][] {
  if (remainders.length === 0) return [];

  const typeGroups = new Map<string, DonorUnit[]>();
  for (const u of remainders) {
    const dtype = getDominantDonationType(u);
    if (!typeGroups.has(dtype)) typeGroups.set(dtype, []);
    typeGroups.get(dtype)!.push(u);
  }

  const typeShareCounts = new Map<string, number>();
  for (const [dtype, typeUnits] of typeGroups) {
    let total = 0;
    for (const u of typeUnits) total += u.totalShares;
    typeShareCounts.set(dtype, total);
  }

  const sortedTypes = Array.from(typeGroups.entries()).sort((a, b) => {
    const countDiff = (typeShareCounts.get(b[0]) || 0) - (typeShareCounts.get(a[0]) || 0);
    if (countDiff !== 0) return countDiff;
    return getDonationTypePriority(a[0]) - getDonationTypePriority(b[0]);
  });

  const allQueue: { unit: DonorUnit; type: string }[] = [];
  for (const [dtype, typeUnits] of sortedTypes) {
    for (const u of typeUnits) {
      allQueue.push({ unit: { ...u, donations: [...u.donations] }, type: dtype });
    }
  }

  const animals: GroupedSegment[][] = [];

  while (allQueue.length > 0) {
    const anchorType = allQueue[0].type;

    const segments: GroupedSegment[] = [];
    let remaining = 7;

    let i = 0;
    while (i < allQueue.length && remaining > 0) {
      if (allQueue[i].type === anchorType) {
        const entry = allQueue[i];
        if (entry.unit.totalShares <= remaining) {
          segments.push({ templateDonation: entry.unit.templateDonation, donations: entry.unit.donations, shares: entry.unit.totalShares });
          remaining -= entry.unit.totalShares;
          allQueue.splice(i, 1);
        } else {
          const splitShares = remaining;
          const splitDonationCount = Math.min(entry.unit.donations.length, splitShares);
          segments.push({ templateDonation: entry.unit.templateDonation, donations: entry.unit.donations.slice(0, splitDonationCount), shares: splitShares });
          entry.unit.donations = entry.unit.donations.slice(splitDonationCount);
          entry.unit.totalShares -= splitShares;
          remaining = 0;
        }
      } else {
        i++;
      }
    }

    if (remaining > 0) {
      let j = 0;
      while (j < allQueue.length && remaining > 0) {
        const entry = allQueue[j];
        if (entry.unit.totalShares <= remaining) {
          segments.push({ templateDonation: entry.unit.templateDonation, donations: entry.unit.donations, shares: entry.unit.totalShares });
          remaining -= entry.unit.totalShares;
          allQueue.splice(j, 1);
        } else {
          const splitShares = remaining;
          const splitDonationCount = Math.min(entry.unit.donations.length, splitShares);
          segments.push({ templateDonation: entry.unit.templateDonation, donations: entry.unit.donations.slice(0, splitDonationCount), shares: splitShares });
          entry.unit.donations = entry.unit.donations.slice(splitDonationCount);
          entry.unit.totalShares -= splitShares;
          remaining = 0;
        }
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

  const typeGroups = new Map<string, DonorUnit[]>();
  for (const u of remainders) {
    const dtype = getDominantDonationType(u);
    if (!typeGroups.has(dtype)) typeGroups.set(dtype, []);
    typeGroups.get(dtype)!.push(u);
  }

  const sameTypeAnimals: GroupedSegment[][] = [];
  const allTypeLeftovers: DonorUnit[] = [];

  const typeShareCounts = new Map<string, number>();
  for (const [dtype, typeUnits] of typeGroups) {
    let total = 0;
    for (const u of typeUnits) total += u.totalShares;
    typeShareCounts.set(dtype, total);
  }

  const sortedTypes = Array.from(typeGroups.entries()).sort((a, b) => {
    const countDiff = (typeShareCounts.get(b[0]) || 0) - (typeShareCounts.get(a[0]) || 0);
    if (countDiff !== 0) return countDiff;
    return getDonationTypePriority(a[0]) - getDonationTypePriority(b[0]);
  });
  for (const [, typeUnits] of sortedTypes) {
    const { animals, leftover } = tryFlexibleMatch(typeUnits);
    sameTypeAnimals.push(...animals);
    allTypeLeftovers.push(...leftover);
  }

  const leftoverAnimals = packLeftoversByType(allTypeLeftovers);

  const allAnimals = [...fullAnimals, ...sameTypeAnimals, ...leftoverAnimals];

  return sortAnimalsByDominantType(allAnimals);
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

export function performIncrementalGroup(
  donations: Donation[],
  existingGroups: AnimalGroup[],
  changedIds: Set<string>,
  lockedIndices: Set<number>
): AnimalGroup[] {
  if (changedIds.size === 0) {
    return existingGroups.map((g, i) => ({ ...g, animalNo: i + 1 }));
  }

  const donationsToRegroup: Donation[] = [];
  const donationById = new Map<string, Donation>();
  for (const d of donations) donationById.set(d.id, d);

  const affectedIndices: number[] = [];

  for (let i = 0; i < existingGroups.length; i++) {
    const group = existingGroups[i];
    const isLocked = lockedIndices.has(i);
    const hasChanged = group.donations.some(d => changedIds.has(d.id));

    if (!isLocked && hasChanged) {
      affectedIndices.push(i);
      for (const d of group.donations) {
        const current = donationById.get(d.id);
        if (current && (d.name.trim() || d.description.trim())) {
          donationsToRegroup.push(current);
        }
      }
    }
  }

  for (const id of changedIds) {
    const d = donationById.get(id);
    if (d && !d.excluded && !donationsToRegroup.some(x => x.id === id)) {
      const inExisting = existingGroups.some(g => g.donations.some(gd => gd.id === id));
      if (!inExisting) {
        donationsToRegroup.push(d);
      }
    }
  }

  const regroupedSegments = mod7GroupDonations(donationsToRegroup);
  const regrouped: AnimalGroup[] = regroupedSegments.map(segments => ({
    id: generateId(),
    animalNo: 0,
    donations: buildGroupDonations(segments),
  }));

  const finalGroups: AnimalGroup[] = [];
  let regroupIdx = 0;
  const affectedSet = new Set(affectedIndices);

  for (let i = 0; i < existingGroups.length; i++) {
    if (affectedSet.has(i)) {
      if (regroupIdx < regrouped.length) {
        finalGroups.push(regrouped[regroupIdx]);
        regroupIdx++;
      }
    } else {
      finalGroups.push({ ...existingGroups[i] });
    }
  }

  while (regroupIdx < regrouped.length) {
    finalGroups.push(regrouped[regroupIdx]);
    regroupIdx++;
  }

  for (let i = 0; i < finalGroups.length; i++) {
    finalGroups[i] = { ...finalGroups[i], animalNo: i + 1 };
  }
  return finalGroups;
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
    return trCollator.compare(a.description, b.description);
  });
  return conflicts;
}
