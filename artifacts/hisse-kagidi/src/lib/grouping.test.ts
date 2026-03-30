import { describe, it, expect } from "vitest";
import {
  autoGroupDonations,
  computeEffectiveShares,
  getTotalShares,
  getRequiredAnimals,
  checkGroupConflicts,
} from "./grouping";
import type { Donation, AnimalGroup } from "./types";

function makeDonation(overrides: Partial<Donation> = {}): Donation {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: overrides.description ?? `Donor ${Math.random().toString(36).slice(2, 6)}`,
    donationType: "",
    shareCount: 1,
    vekalet: "",
    notes: "",
    ...overrides,
  };
}

function makeDonations(count: number, base: Partial<Donation> = {}): Donation[] {
  return Array.from({ length: count }, (_, i) =>
    makeDonation({ description: `Kişi ${i + 1}`, ...base })
  );
}

describe("autoGroupDonations", () => {
  it("returns empty array for empty donations", () => {
    const groups = autoGroupDonations([]);
    expect(groups).toEqual([]);
  });

  it("creates one group for a single donor with 1 share", () => {
    const donations = [makeDonation({ description: "Ahmet Yılmaz" })];
    const groups = autoGroupDonations(donations);
    expect(groups.length).toBe(1);
    expect(groups[0].donations.length).toBe(7);
    expect(groups[0].animalNo).toBe(1);
    const filled = groups[0].donations.filter(d => d.description.trim());
    expect(filled.length).toBe(1);
    expect(filled[0].description).toBe("Ahmet Yılmaz");
  });

  it("creates one group for exactly 7 donors with 1 share each", () => {
    const donations = makeDonations(7);
    const groups = autoGroupDonations(donations);
    expect(groups.length).toBe(1);
    expect(groups[0].donations.length).toBe(7);
    const filled = groups[0].donations.filter(d => d.description.trim());
    expect(filled.length).toBe(7);
  });

  it("creates two groups for 8 donors with 1 share each", () => {
    const donations = makeDonations(8);
    const groups = autoGroupDonations(donations);
    expect(groups.length).toBe(2);
    groups.forEach(g => expect(g.donations.length).toBe(7));
  });

  it("creates correct number of groups for 14 donors (exact multiple of 7)", () => {
    const donations = makeDonations(14);
    const groups = autoGroupDonations(donations);
    expect(groups.length).toBe(2);
    groups.forEach(g => expect(g.donations.length).toBe(7));
  });

  it("creates correct number of groups for 21 donors", () => {
    const donations = makeDonations(21);
    const groups = autoGroupDonations(donations);
    expect(groups.length).toBe(3);
  });

  it("handles a donor with shareCount > 1 correctly", () => {
    const donations = [makeDonation({ description: "Ali Veli", shareCount: 7 })];
    const groups = autoGroupDonations(donations);
    expect(groups.length).toBe(1);
    expect(groups[0].donations.length).toBe(7);
    const aliSlots = groups[0].donations.filter(d => d.description === "Ali Veli");
    expect(aliSlots.length).toBe(7);
  });

  it("handles donor with shareCount > 7 spanning multiple groups", () => {
    const donations = [makeDonation({ description: "Büyük Bağışçı", shareCount: 14 })];
    const groups = autoGroupDonations(donations);
    expect(groups.length).toBe(2);
  });

  it("excludes donations with excluded flag", () => {
    const donations = [
      makeDonation({ description: "Active1" }),
      makeDonation({ description: "Excluded1", excluded: true }),
      makeDonation({ description: "Active2" }),
    ];
    const groups = autoGroupDonations(donations);
    expect(groups.length).toBe(1);
    const allDescs = groups.flatMap(g => g.donations.map(d => d.description));
    expect(allDescs).not.toContain("Excluded1");
  });

  it("assigns sequential animalNo to groups", () => {
    const donations = makeDonations(15);
    const groups = autoGroupDonations(donations);
    groups.forEach((g, i) => {
      expect(g.animalNo).toBe(i + 1);
    });
  });

  it("merges donors with same description into effective shares", () => {
    const donations = [
      makeDonation({ id: "d1", description: "Aile Bağışı" }),
      makeDonation({ id: "d2", description: "Aile Bağışı" }),
      makeDonation({ id: "d3", description: "Aile Bağışı" }),
    ];
    const groups = autoGroupDonations(donations);
    expect(groups.length).toBe(1);
    const aileSlots = groups[0].donations.filter(d => d.description === "Aile Bağışı");
    expect(aileSlots.length).toBe(3);
  });

  it("handles mixed share counts correctly", () => {
    const donations = [
      makeDonation({ description: "A", shareCount: 3 }),
      makeDonation({ description: "B", shareCount: 4 }),
    ];
    const groups = autoGroupDonations(donations);
    expect(groups.length).toBe(1);
    expect(groups[0].donations.length).toBe(7);
  });

  it("each group has exactly 7 donation slots", () => {
    const donations = makeDonations(50);
    const groups = autoGroupDonations(donations);
    groups.forEach(g => {
      expect(g.donations.length).toBe(7);
    });
  });
});

describe("computeEffectiveShares", () => {
  it("returns shareCount for unique donors", () => {
    const donations = [
      makeDonation({ id: "x1", description: "Ali", shareCount: 3 }),
      makeDonation({ id: "x2", description: "Veli", shareCount: 2 }),
    ];
    const map = computeEffectiveShares(donations);
    expect(map.get("x1")).toBe(3);
    expect(map.get("x2")).toBe(2);
  });

  it("returns count for donors with same description", () => {
    const donations = [
      makeDonation({ id: "a1", description: "Ortak" }),
      makeDonation({ id: "a2", description: "Ortak" }),
      makeDonation({ id: "a3", description: "Ortak" }),
    ];
    const map = computeEffectiveShares(donations);
    expect(map.get("a1")).toBe(3);
    expect(map.get("a2")).toBe(3);
  });

  it("ignores excluded donations", () => {
    const donations = [
      makeDonation({ id: "b1", description: "X", excluded: false }),
      makeDonation({ id: "b2", description: "X", excluded: true }),
    ];
    const map = computeEffectiveShares(donations);
    expect(map.get("b1")).toBe(1);
    expect(map.has("b2")).toBe(false);
  });
});

describe("getTotalShares", () => {
  it("sums up effective shares", () => {
    const donations = [
      makeDonation({ description: "A", shareCount: 3 }),
      makeDonation({ description: "B", shareCount: 4 }),
    ];
    expect(getTotalShares(donations)).toBe(7);
  });

  it("counts same-description donors as group", () => {
    const donations = [
      makeDonation({ description: "Same" }),
      makeDonation({ description: "Same" }),
      makeDonation({ description: "Same" }),
    ];
    expect(getTotalShares(donations)).toBe(3);
  });

  it("returns 0 for empty list", () => {
    expect(getTotalShares([])).toBe(0);
  });
});

describe("getRequiredAnimals", () => {
  it("returns 0 for empty", () => {
    expect(getRequiredAnimals([])).toBe(0);
  });

  it("returns 1 for 7 or fewer shares", () => {
    const donations = makeDonations(5);
    expect(getRequiredAnimals(donations)).toBe(1);
  });

  it("rounds up to next animal", () => {
    const donations = makeDonations(8);
    expect(getRequiredAnimals(donations)).toBe(2);
  });
});

describe("checkGroupConflicts", () => {
  it("returns empty for no conflicts", () => {
    const groups: AnimalGroup[] = [
      {
        id: "g1",
        animalNo: 1,
        donations: [
          makeDonation({ description: "A" }),
          makeDonation({ description: "B" }),
        ],
      },
    ];
    expect(checkGroupConflicts(groups)).toEqual([]);
  });

  it("detects same person in multiple groups", () => {
    const groups: AnimalGroup[] = [
      { id: "g1", animalNo: 1, donations: [makeDonation({ description: "Ortak Kişi" })] },
      { id: "g2", animalNo: 2, donations: [makeDonation({ description: "Ortak Kişi" })] },
    ];
    const conflicts = checkGroupConflicts(groups);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].animalNos).toEqual([1, 2]);
  });

  it("marks expected conflicts when shares > 7", () => {
    const donations1 = Array.from({ length: 7 }, () => makeDonation({ description: "Büyük Bağışçı" }));
    const donations2 = [makeDonation({ description: "Büyük Bağışçı" })];
    const groups: AnimalGroup[] = [
      { id: "g1", animalNo: 1, donations: donations1 },
      { id: "g2", animalNo: 2, donations: donations2 },
    ];
    const conflicts = checkGroupConflicts(groups);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].isExpected).toBe(true);
    expect(conflicts[0].totalShares).toBe(8);
  });
});
