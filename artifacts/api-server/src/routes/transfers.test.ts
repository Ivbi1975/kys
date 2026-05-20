import { describe, it, expect, afterAll, beforeAll } from "vitest";
import supertest from "supertest";
import app from "../app";

const TEST_PREFIX = "__vitest_transfer__";
const API_KEY = process.env.API_KEY!;
const agent = supertest(app);

function get(url: string) {
  return agent.get(url).set("X-API-Key", API_KEY);
}
function post(url: string) {
  return agent.post(url).set("X-API-Key", API_KEY);
}
function put(url: string) {
  return agent.put(url).set("X-API-Key", API_KEY);
}
function del(url: string) {
  return agent.delete(url).set("X-API-Key", API_KEY);
}

const TS = Date.now();
let projectId: string;
let project2Id: string;
const kaA = `${TEST_PREFIX}-ka-a-${TS}`;
const kaB = `${TEST_PREFIX}-ka-b-${TS}`;
const kaC = `${TEST_PREFIX}-ka-c-${TS}`;
const kaOtherProject = `${TEST_PREFIX}-ka-other-${TS}`;
const groupId = `${TEST_PREFIX}-grp-${TS}`;
const lockedGroupId = `${TEST_PREFIX}-grp-locked-${TS}`;
const kesildiGroupId = `${TEST_PREFIX}-grp-kesildi-${TS}`;
const don1 = `${TEST_PREFIX}-don1-${TS}`;
const don2 = `${TEST_PREFIX}-don2-${TS}`;
const don3 = `${TEST_PREFIX}-don3-${TS}`;
const don4 = `${TEST_PREFIX}-don4-locked-${TS}`;
const don5 = `${TEST_PREFIX}-don5-${TS}`;

afterAll(async () => {
  await del(`/api/kesim-alanlari/${kaA}?permanent=true`);
  await del(`/api/kesim-alanlari/${kaB}?permanent=true`);
  await del(`/api/kesim-alanlari/${kaC}?permanent=true`);
  await del(`/api/kesim-alanlari/${kaOtherProject}?permanent=true`);
  if (projectId) await del(`/api/projects/${projectId}`);
  if (project2Id) await del(`/api/projects/${project2Id}`);
});

describe("Transfer test setup", () => {
  it("creates two projects and kesim alanları", async () => {
    const p1 = await post("/api/projects").send({ name: `${TEST_PREFIX} Proje1` });
    expect(p1.status).toBe(201);
    projectId = p1.body.id;

    const p2 = await post("/api/projects").send({ name: `${TEST_PREFIX} Proje2` });
    expect(p2.status).toBe(201);
    project2Id = p2.body.id;

    for (const [id, name, pid] of [
      [kaA, "KA-A", projectId],
      [kaB, "KA-B", projectId],
      [kaC, "KA-C (bos)", projectId],
      [kaOtherProject, "KA-Other", project2Id],
    ]) {
      const res = await post("/api/kesim-alanlari").send({
        id, name, projectId: pid, donations: [], animalGroups: [],
      });
      expect(res.status).toBe(201);
    }
  });

  it("creates donations in KA-A", async () => {
    for (const [id, name, vekalet] of [
      [don1, "Ahmet Yılmaz", "VKL-001"],
      [don2, "Mehmet Kaya", "VKL-002"],
      [don3, "Ayşe Demir", "VKL-003"],
    ]) {
      const res = await post(`/api/kesim-alanlari/${kaA}/donations`).send({
        id, name, description: "Büyükbaş", donationType: "kurban", shareCount: 1,
        vekalet,
      });
      expect(res.status).toBe(201);
    }
  });

  it("creates animal groups (normal, locked, kesildi) in KA-A", async () => {
    const g1 = await post(`/api/kesim-alanlari/${kaA}/animal-groups`).send({
      id: groupId, animalNo: 1, colorTag: "red",
    });
    expect(g1.status).toBe(201);

    const g2 = await post(`/api/kesim-alanlari/${kaA}/animal-groups`).send({
      id: lockedGroupId, animalNo: 2, colorTag: "blue",
    });
    expect(g2.status).toBe(201);

    const g3 = await post(`/api/kesim-alanlari/${kaA}/animal-groups`).send({
      id: kesildiGroupId, animalNo: 3, colorTag: "green",
    });
    expect(g3.status).toBe(201);
  });

  it("creates donation for locked group and assigns it", async () => {
    const donRes = await post(`/api/kesim-alanlari/${kaA}/donations`).send({
      id: don4, name: "Locked Bağışçı", description: "Kilitli grupta",
      donationType: "kurban", shareCount: 1, vekalet: "VKL-004",
    });
    expect(donRes.status).toBe(201);

    await post(`/api/kesim-alanlari/${kaA}/groups/bulk-lock`).send({
      groupIds: [lockedGroupId], locked: true,
    });
  });
});

describe("T01 — move-donations: validasyon hataları", () => {
  it("kaynak = hedef KA ise 400 döner", async () => {
    const res = await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don1],
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaA,
    });
    expect(res.status).toBe(400);
  });

  it("body eksikse 400 döner", async () => {
    const res = await post("/api/kesim-alanlari/move-donations").send({
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaB,
    });
    expect(res.status).toBe(400);
  });

  it("boş donationIds dizisi ise 400 döner", async () => {
    const res = await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [],
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaB,
    });
    expect(res.status).toBe(400);
  });

  it("kaynak KA bulunamazsa 404 döner", async () => {
    const res = await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don1],
      sourceKesimAlaniId: "nonexistent_ka_xyz",
      targetKesimAlaniId: kaB,
    });
    expect(res.status).toBe(404);
  });

  it("hedef KA bulunamazsa 404 döner", async () => {
    const res = await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don1],
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: "nonexistent_ka_xyz",
    });
    expect(res.status).toBe(404);
  });

  it("farklı proje KA'ları arasında transfer 400 döner", async () => {
    const res = await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don1],
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaOtherProject,
    });
    expect(res.status).toBe(400);
  });

  it("bağış kaynak KA'da değilse (yanlış KA) no_valid_donors 400 döner", async () => {
    const res = await post("/api/kesim-alanlari/move-donations").send({
      donationIds: ["nonexistent_donation_xyz"],
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaB,
    });
    expect(res.status).toBe(400);
  });
});

describe("T02 — move-donations: temel TAŞIMA ve sayı değişmezliği", () => {
  it("KA-A başlangıç bağış sayısını kaydet", async () => {
    const res = await get(`/api/kesim-alanlari/${kaA}/donations/count`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(3);
  });

  it("don1'i KA-A'dan KA-B'ye taşır (MOVE)", async () => {
    const before = {
      a: (await get(`/api/kesim-alanlari/${kaA}/donations/count`)).body.count as number,
      b: (await get(`/api/kesim-alanlari/${kaB}/donations/count`)).body.count as number,
    };

    const res = await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don1],
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaB,
    });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.skipped).toBe(0);

    const after = {
      a: (await get(`/api/kesim-alanlari/${kaA}/donations/count`)).body.count as number,
      b: (await get(`/api/kesim-alanlari/${kaB}/donations/count`)).body.count as number,
    };

    expect(after.a).toBe(before.a - 1);
    expect(after.b).toBe(before.b + 1);
    expect(after.a + after.b).toBe(before.a + before.b);
  });

  it("don1 artık KA-B'de listeleniyor, KA-A'da yok", async () => {
    const bRes = await get(`/api/kesim-alanlari/${kaB}/donations`);
    expect(bRes.status).toBe(200);
    const inB = bRes.body.items.some((d: { id: string }) => d.id === don1);
    expect(inB).toBe(true);

    const aRes = await get(`/api/kesim-alanlari/${kaA}/donations`);
    expect(aRes.status).toBe(200);
    const inA = aRes.body.items.some((d: { id: string }) => d.id === don1);
    expect(inA).toBe(false);
  });

  it("aynı bağışı KA-B'den tekrar KA-A'ya taşır (geri dönüş)", async () => {
    const before = {
      a: (await get(`/api/kesim-alanlari/${kaA}/donations/count`)).body.count as number,
      b: (await get(`/api/kesim-alanlari/${kaB}/donations/count`)).body.count as number,
    };

    const res = await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don1],
      sourceKesimAlaniId: kaB,
      targetKesimAlaniId: kaA,
    });
    expect(res.status).toBe(200);

    const after = {
      a: (await get(`/api/kesim-alanlari/${kaA}/donations/count`)).body.count as number,
      b: (await get(`/api/kesim-alanlari/${kaB}/donations/count`)).body.count as number,
    };
    expect(after.a).toBe(before.a + 1);
    expect(after.b).toBe(before.b - 1);
    expect(after.a + after.b).toBe(before.a + before.b);
  });

  it("Havuz→KA→Havuz döngüsünde toplam kayıt sayısı değişmez", async () => {
    const beforeTotal =
      (await get(`/api/kesim-alanlari/${kaA}/donations/count`)).body.count +
      (await get(`/api/kesim-alanlari/${kaB}/donations/count`)).body.count +
      (await get(`/api/kesim-alanlari/${kaC}/donations/count`)).body.count;

    await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don2],
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaC,
    });
    await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don2],
      sourceKesimAlaniId: kaC,
      targetKesimAlaniId: kaB,
    });
    await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don2],
      sourceKesimAlaniId: kaB,
      targetKesimAlaniId: kaA,
    });

    const afterTotal =
      (await get(`/api/kesim-alanlari/${kaA}/donations/count`)).body.count +
      (await get(`/api/kesim-alanlari/${kaB}/donations/count`)).body.count +
      (await get(`/api/kesim-alanlari/${kaC}/donations/count`)).body.count;

    expect(afterTotal).toBe(beforeTotal);
  });

  it("taşınan bağış zaten o KA'daysa (eski KA'ya ait değil) hata döner (400 veya 409)", async () => {
    const res = await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don1],
      sourceKesimAlaniId: kaB,
      targetKesimAlaniId: kaA,
    });
    expect([400, 409]).toContain(res.status);
  });

  it("çoklu bağış taşıma: tüm ID'ler geçerliyse hepsini taşır", async () => {
    const before = {
      a: (await get(`/api/kesim-alanlari/${kaA}/donations/count`)).body.count as number,
      c: (await get(`/api/kesim-alanlari/${kaC}/donations/count`)).body.count as number,
    };

    const res = await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don2, don3],
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaC,
    });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);

    const after = {
      a: (await get(`/api/kesim-alanlari/${kaA}/donations/count`)).body.count as number,
      c: (await get(`/api/kesim-alanlari/${kaC}/donations/count`)).body.count as number,
    };
    expect(after.a).toBe(before.a - 2);
    expect(after.c).toBe(before.c + 2);

    await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don2, don3],
      sourceKesimAlaniId: kaC,
      targetKesimAlaniId: kaA,
    });
  });
});

describe("T03 — move-donations: kilitli grup koruması", () => {
  it("don4 KA-A'ya eklendi ve lockedGroupId'e atandı — kilitli bağış taşınamaz", async () => {
    const assignRes = await put(`/api/kesim-alanlari/${kaA}/animal-groups/${lockedGroupId}`).send({
      donations: [{ id: don4, name: "Locked Bağışçı", shareCount: 1 }],
    });
    expect(assignRes.status).toBe(200);

    const res = await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don4],
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaB,
    });
    expect(res.status).toBe(400);
  });

  it("karışık liste: kilitli + normal bağış — normal taşınır, kilitli atlanır", async () => {
    const before = {
      a: (await get(`/api/kesim-alanlari/${kaA}/donations/count`)).body.count as number,
      b: (await get(`/api/kesim-alanlari/${kaB}/donations/count`)).body.count as number,
    };

    const res = await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don1, don4],
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaB,
    });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.skipped).toBe(1);

    const after = {
      a: (await get(`/api/kesim-alanlari/${kaA}/donations/count`)).body.count as number,
      b: (await get(`/api/kesim-alanlari/${kaB}/donations/count`)).body.count as number,
    };
    expect(after.a + after.b).toBe(before.a + before.b);

    await post("/api/kesim-alanlari/move-donations").send({
      donationIds: [don1],
      sourceKesimAlaniId: kaB,
      targetKesimAlaniId: kaA,
    });
  });
});

describe("T04 — move-animal-group: temel ve veri doğruluğu", () => {
  it("hayvan grubunu KA-A'dan KA-B'ye taşır", async () => {
    const beforeA = await get(`/api/kesim-alanlari/${kaA}/groups/count`);
    const beforeB = await get(`/api/kesim-alanlari/${kaB}/groups/count`);
    const countA = beforeA.body.count as number;
    const countB = beforeB.body.count as number;

    const res = await post("/api/kesim-alanlari/move-animal-group").send({
      animalGroupId: groupId,
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaB,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.animalGroupId).toBe(groupId);
    expect(typeof res.body.newAnimalNo).toBe("number");

    const afterA = await get(`/api/kesim-alanlari/${kaA}/groups/count`);
    const afterB = await get(`/api/kesim-alanlari/${kaB}/groups/count`);
    expect(afterA.body.count).toBe(countA - 1);
    expect(afterB.body.count).toBe(countB + 1);

    await post("/api/kesim-alanlari/move-animal-group").send({
      animalGroupId: groupId,
      sourceKesimAlaniId: kaB,
      targetKesimAlaniId: kaA,
    });
  });

  it("kaynak = hedef ise 400 döner", async () => {
    const res = await post("/api/kesim-alanlari/move-animal-group").send({
      animalGroupId: groupId,
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaA,
    });
    expect(res.status).toBe(400);
  });

  it("kilitli grubu taşımaya çalışmak 400 döner", async () => {
    const res = await post("/api/kesim-alanlari/move-animal-group").send({
      animalGroupId: lockedGroupId,
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaB,
    });
    expect(res.status).toBe(400);
  });

  it("farklı projeler arası grup taşıma 400 döner", async () => {
    const res = await post("/api/kesim-alanlari/move-animal-group").send({
      animalGroupId: groupId,
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaOtherProject,
    });
    expect(res.status).toBe(400);
  });

  it("var olmayan grup 404 döner", async () => {
    const res = await post("/api/kesim-alanlari/move-animal-group").send({
      animalGroupId: "nonexistent_group_xyz",
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaB,
    });
    expect(res.status).toBe(404);
  });

  it("yanlış kaynak KA ile grup taşıma 404 döner", async () => {
    const res = await post("/api/kesim-alanlari/move-animal-group").send({
      animalGroupId: groupId,
      sourceKesimAlaniId: kaB,
      targetKesimAlaniId: kaA,
    });
    expect(res.status).toBe(404);
  });

  it("animalNo hedef KA'da düzgün sıralanır", async () => {
    const grpA = await get(`/api/kesim-alanlari/${kaB}/groups`);
    const initialCount = grpA.body.items?.length ?? 0;

    const tempGrpId = `${TEST_PREFIX}-tmp-grp-${TS}`;
    await post(`/api/kesim-alanlari/${kaA}/animal-groups`).send({
      id: tempGrpId, animalNo: 99,
    });

    const moveRes = await post("/api/kesim-alanlari/move-animal-group").send({
      animalGroupId: tempGrpId,
      sourceKesimAlaniId: kaA,
      targetKesimAlaniId: kaB,
    });
    expect(moveRes.status).toBe(200);

    const afterRes = await get(`/api/kesim-alanlari/${kaB}/groups`);
    const targetGroups = afterRes.body.items ?? [];
    const movedGroup = targetGroups.find((g: { id: string }) => g.id === tempGrpId);
    expect(movedGroup).toBeTruthy();
    expect(movedGroup.animalNo).toBe(initialCount + 1);

    const animNos = targetGroups.map((g: { animalNo: number }) => g.animalNo).sort((a: number, b: number) => a - b);
    const unique = new Set(animNos);
    expect(unique.size).toBe(targetGroups.length);

    await del(`/api/kesim-alanlari/${kaB}/animal-groups/${tempGrpId}`);
  });
});

describe("T05 — transfer-log kayıt doğruluğu", () => {
  it("transfer-log kaydı oluşturulabilir", async () => {
    const res = await post("/api/donation-transfers").send({
      entries: [{
        id: `${TEST_PREFIX}-log-${TS}`,
        projectId,
        donationId: don1,
        donorName: "Ahmet Yılmaz",
        donorDescription: "Büyükbaş",
        fromKesimAlaniId: kaA,
        fromKesimAlaniName: "KA-A",
        toKesimAlaniId: kaB,
        toKesimAlaniName: "KA-B",
        removedFromSource: true,
        shareCount: 1,
        transferType: "donation",
        createdAt: new Date().toISOString(),
      }],
    });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });

  it("transfer-log proje için sorgulanabilir", async () => {
    const res = await get(`/api/projects/${projectId}/transfer-log`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("geçersiz entries ile transfer-log 400 döner", async () => {
    const res = await post("/api/donation-transfers").send({ entries: [] });
    expect(res.status).toBe(400);
  });
});
