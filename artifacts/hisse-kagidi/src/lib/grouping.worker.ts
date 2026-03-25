import type { Donation, AnimalGroup } from "./types";

function generateId(): string {
  return crypto.randomUUID();
}

function getSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

function computeEffectiveShares(donations: Donation[]): Map<string, number> {
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

function applyMod7PreSplit(units: DonorUnit[]): { fullAnimals: GroupedSegment[][]; remainders: DonorUnit[] } {
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

  const { animals: matchedAnimals, leftover: afterMatch } = tryFlexibleMatch(remainders);

  const leftoverAnimals = packLeftovers(afterMatch);

  return [...fullAnimals, ...matchedAnimals, ...leftoverAnimals];
}

export type WorkerRequest =
  | { type: "group"; id: string; donations: Donation[] }
  | { type: "incrementalGroup"; id: string; donations: Donation[]; existingGroups: AnimalGroup[]; changedDonationIds: string[]; lockedGroupIndices: number[] };

export type WorkerResponse =
  | { type: "progress"; id: string; current: number; total: number }
  | { type: "result"; id: string; groups: AnimalGroup[]; cancelled?: boolean }
  | { type: "error"; id: string; message: string };

let cancelledId: string | null = null;

function performIncrementalGroup(
  donations: Donation[],
  existingGroups: AnimalGroup[],
  changedIds: Set<string>,
  lockedIndices: Set<number>
): AnimalGroup[] {
  const donationsToRegroup: Donation[] = [];
  const preservedGroups: AnimalGroup[] = [];
  const donationById = new Map<string, Donation>();
  for (const d of donations) donationById.set(d.id, d);

  for (let i = 0; i < existingGroups.length; i++) {
    const group = existingGroups[i];
    const isLocked = lockedIndices.has(i);
    const hasChanged = group.donations.some(d => changedIds.has(d.id));

    if (isLocked || !hasChanged) {
      preservedGroups.push({ ...group });
    } else {
      for (const d of group.donations) {
        const current = donationById.get(d.id);
        if (current && d.name.trim()) {
          donationsToRegroup.push(current);
        }
      }
    }
  }

  for (const id of changedIds) {
    const d = donationById.get(id);
    if (d && !d.excluded && !donationsToRegroup.some(x => x.id === id)) {
      const inPreserved = preservedGroups.some(g => g.donations.some(gd => gd.id === id));
      if (!inPreserved) {
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

  const finalGroups = [...preservedGroups, ...regrouped];
  for (let i = 0; i < finalGroups.length; i++) {
    finalGroups[i] = { ...finalGroups[i], animalNo: i + 1 };
  }
  return finalGroups;
}

self.onmessage = (e: MessageEvent<WorkerRequest | { type: "cancel"; id: string }>) => {
  const msg = e.data;

  if (msg.type === "cancel") {
    cancelledId = msg.id;
    return;
  }

  if (msg.type === "incrementalGroup") {
    cancelledId = null;
    try {
      const changedIds = new Set(msg.changedDonationIds);
      const lockedIndices = new Set(msg.lockedGroupIndices);
      const groups = performIncrementalGroup(msg.donations, msg.existingGroups, changedIds, lockedIndices);
      self.postMessage({ type: "result", id: msg.id, groups } satisfies WorkerResponse);
    } catch (err) {
      self.postMessage({
        type: "error",
        id: msg.id,
        message: err instanceof Error ? err.message : "Bilinmeyen hata",
      } satisfies WorkerResponse);
    }
    return;
  }

  if (msg.type === "group") {
    cancelledId = null;
    try {
      const allSegmentGroups = mod7GroupDonations(msg.donations);
      if (allSegmentGroups.length === 0) {
        self.postMessage({ type: "result", id: msg.id, groups: [] } satisfies WorkerResponse);
        return;
      }

      const groups: AnimalGroup[] = [];
      let animalNo = 1;
      const total = allSegmentGroups.length;

      for (const segments of allSegmentGroups) {
        if (cancelledId === msg.id) {
          self.postMessage({ type: "result", id: msg.id, groups: [], cancelled: true } satisfies WorkerResponse);
          return;
        }

        groups.push({
          id: generateId(),
          animalNo,
          donations: buildGroupDonations(segments),
        });

        if (animalNo % 5 === 0 || animalNo === total) {
          self.postMessage({ type: "progress", id: msg.id, current: animalNo, total } satisfies WorkerResponse);
        }

        animalNo++;
      }

      self.postMessage({ type: "result", id: msg.id, groups } satisfies WorkerResponse);
    } catch (err) {
      self.postMessage({
        type: "error",
        id: msg.id,
        message: err instanceof Error ? err.message : "Bilinmeyen hata",
      } satisfies WorkerResponse);
    }
  }
};
