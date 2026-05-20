/**
 * Kesim Alanı — Bağış Veri Bütünlüğü Testleri
 *
 * Kapsanan senaryolar:
 * D01 — Soft-delete: silinmiş bağış listede görünmez
 * D02 — Silinmiş bağış deleted-listede görünür
 * D03 — Restore: silinen bağış geri getirilir, listede görünür
 * D04 — Restore zaten aktif bağış 400 döner
 * D05 — Permanent delete: bağış tamamen silinir, deleted-listede bile yok
 * D06 — Yanlış KA ile güncelleme 404 döner (KA izolasyonu)
 * D07 — Yanlış KA ile silme 404 döner (KA izolasyonu)
 * D08 — Soft-deleted bağışı güncelleme (bug: şu an 200 dönüyor olabilir)
 * D09 — Tags: oluşturma, güncelleme, silme
 * D10 — Arama filtresi doğruluğu
 * D11 — excluded filtresi doğruluğu
 * D12 — donationType filtresi doğruluğu
 * D13 — Cursor tabanlı sayfalama tutarlılığı
 * D14 — KA soft-delete sonrası bağış işlemleri engellenir
 * D15 — Aynı ID ile çift bağış oluşturma (çakışma)
 * D16 — shareCount min-1 kısıtı
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import supertest from "supertest";
import app from "../app";

const TEST_PREFIX = "__vitest_don_int__";
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
const kaId = `${TEST_PREFIX}-ka-${TS}`;
const kaOtherId = `${TEST_PREFIX}-ka-other-${TS}`;
const kaDeletedId = `${TEST_PREFIX}-ka-del-${TS}`;

afterAll(async () => {
  await del(`/api/kesim-alanlari/${kaId}?permanent=true`);
  await del(`/api/kesim-alanlari/${kaOtherId}?permanent=true`);
  await del(`/api/kesim-alanlari/${kaDeletedId}?permanent=true`);
  if (projectId) await del(`/api/projects/${projectId}`);
});

describe("Integrity setup", () => {
  it("proje ve KA'lar oluşturulur", async () => {
    const p = await post("/api/projects").send({ name: `${TEST_PREFIX} Proje` });
    expect(p.status).toBe(201);
    projectId = p.body.id;

    for (const [id, name] of [
      [kaId, "Ana KA"],
      [kaOtherId, "Diğer KA"],
      [kaDeletedId, "Silinecek KA"],
    ]) {
      const r = await post("/api/kesim-alanlari").send({
        id, name, projectId, donations: [], animalGroups: [],
      });
      expect(r.status).toBe(201);
    }
  });
});

describe("D01–D05 — Soft-delete ve kalıcı silme", () => {
  it("D01 — soft-delete: bağış aktif listede görünmez", async () => {
    const id = `${TEST_PREFIX}-d01-${TS}`;
    await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id, name: "D01 Bağışçı", description: "Test", shareCount: 1,
    });

    const beforeCount = (await get(`/api/kesim-alanlari/${kaId}/donations/count`)).body.count as number;
    const delRes = await del(`/api/kesim-alanlari/${kaId}/donations/${id}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const afterCount = (await get(`/api/kesim-alanlari/${kaId}/donations/count`)).body.count as number;
    expect(afterCount).toBe(beforeCount - 1);

    const listRes = await get(`/api/kesim-alanlari/${kaId}/donations`);
    const found = listRes.body.items.find((d: { id: string }) => d.id === id);
    expect(found).toBeUndefined();

    await del(`/api/kesim-alanlari/${kaId}/donations/${id}?permanent=true`);
  });

  it("D02 — soft-delete: deleted listede görünür", async () => {
    const id = `${TEST_PREFIX}-d02-${TS}`;
    await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id, name: "D02 Bağışçı", description: "Test", shareCount: 1,
    });
    await del(`/api/kesim-alanlari/${kaId}/donations/${id}`);

    const deletedRes = await get(`/api/kesim-alanlari/${kaId}/donations/deleted`);
    expect(deletedRes.status).toBe(200);
    const found = deletedRes.body.find((d: { id: string }) => d.id === id);
    expect(found).toBeTruthy();
    expect(found.deletedAt).toBeTruthy();

    await del(`/api/kesim-alanlari/${kaId}/donations/${id}?permanent=true`);
  });

  it("D03 — restore: silinen bağış geri gelir, listede görünür", async () => {
    const id = `${TEST_PREFIX}-d03-${TS}`;
    await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id, name: "D03 Bağışçı", description: "Test", shareCount: 1,
    });
    await del(`/api/kesim-alanlari/${kaId}/donations/${id}`);

    const countBefore = (await get(`/api/kesim-alanlari/${kaId}/donations/count`)).body.count as number;
    const restoreRes = await post(`/api/kesim-alanlari/${kaId}/donations/${id}/restore`);
    expect(restoreRes.status).toBe(200);

    const countAfter = (await get(`/api/kesim-alanlari/${kaId}/donations/count`)).body.count as number;
    expect(countAfter).toBe(countBefore + 1);

    const listRes = await get(`/api/kesim-alanlari/${kaId}/donations`);
    const found = listRes.body.items.find((d: { id: string }) => d.id === id);
    expect(found).toBeTruthy();

    const deletedRes = await get(`/api/kesim-alanlari/${kaId}/donations/deleted`);
    const inDeleted = deletedRes.body.find((d: { id: string }) => d.id === id);
    expect(inDeleted).toBeUndefined();

    await del(`/api/kesim-alanlari/${kaId}/donations/${id}?permanent=true`);
  });

  it("D04 — restore: zaten aktif bağışa restore 400 döner", async () => {
    const id = `${TEST_PREFIX}-d04-${TS}`;
    await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id, name: "D04 Bağışçı", description: "Test", shareCount: 1,
    });

    const res = await post(`/api/kesim-alanlari/${kaId}/donations/${id}/restore`);
    expect(res.status).toBe(400);

    await del(`/api/kesim-alanlari/${kaId}/donations/${id}?permanent=true`);
  });

  it("D05 — permanent delete: bağış deleted listede de görünmez", async () => {
    const id = `${TEST_PREFIX}-d05-${TS}`;
    await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id, name: "D05 Bağışçı", description: "Test", shareCount: 1,
    });

    await del(`/api/kesim-alanlari/${kaId}/donations/${id}?permanent=true`);

    const deletedRes = await get(`/api/kesim-alanlari/${kaId}/donations/deleted`);
    const found = deletedRes.body.find((d: { id: string }) => d.id === id);
    expect(found).toBeUndefined();

    const listRes = await get(`/api/kesim-alanlari/${kaId}/donations`);
    const foundInList = listRes.body.items?.find((d: { id: string }) => d.id === id);
    expect(foundInList).toBeUndefined();
  });
});

describe("D06–D08 — KA izolasyonu ve silinmiş bağış güncelleme", () => {
  let donId: string;

  beforeAll(async () => {
    donId = `${TEST_PREFIX}-iso-${TS}`;
    await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id: donId, name: "İzolasyon Bağışçı", description: "Test", shareCount: 1,
    });
  });

  afterAll(async () => {
    await del(`/api/kesim-alanlari/${kaId}/donations/${donId}?permanent=true`);
  });

  it("D06 — yanlış KA ID ile güncelleme 404 döner", async () => {
    const res = await put(`/api/kesim-alanlari/${kaOtherId}/donations/${donId}`).send({
      name: "Hacked Name",
    });
    expect(res.status).toBe(404);

    const check = await get(`/api/kesim-alanlari/${kaId}/donations`);
    const orig = check.body.items.find((d: { id: string; name: string }) => d.id === donId);
    expect(orig?.name).toBe("İzolasyon Bağışçı");
  });

  it("D07 — yanlış KA ID ile silme 404 döner", async () => {
    const res = await del(`/api/kesim-alanlari/${kaOtherId}/donations/${donId}`);
    expect(res.status).toBe(404);

    const check = await get(`/api/kesim-alanlari/${kaId}/donations/count`);
    expect(check.body.count).toBeGreaterThanOrEqual(1);
  });

  it("D08 — soft-deleted bağış güncelleme girişimi 404 döner", async () => {
    const softId = `${TEST_PREFIX}-d08-${TS}`;
    await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id: softId, name: "D08 Orijinal", description: "Test", shareCount: 1,
    });
    await del(`/api/kesim-alanlari/${kaId}/donations/${softId}`);

    const updateRes = await put(`/api/kesim-alanlari/${kaId}/donations/${softId}`).send({
      name: "D08 Güncellendi",
    });

    expect(updateRes.status).toBe(404);

    await del(`/api/kesim-alanlari/${kaId}/donations/${softId}?permanent=true`);
  });
});

describe("D09 — Tags bağış yaşam döngüsü", () => {
  it("tag ile oluşturma ve doğrulama", async () => {
    const tagId = `${TEST_PREFIX}-tag-${TS}`;
    const tagRes = await post("/api/tags").send({ id: tagId, name: "Test Tag", color: "#ff0000" });

    if (tagRes.status !== 201 && tagRes.status !== 200) {
      return;
    }

    const id = `${TEST_PREFIX}-d09-${TS}`;
    await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id, name: "Tag Bağışçı", description: "Test", shareCount: 1, tags: [tagId],
    });

    const listRes = await get(`/api/kesim-alanlari/${kaId}/donations`);
    const found = listRes.body.items.find((d: { id: string }) => d.id === id);
    expect(found).toBeTruthy();
    expect(found.tags).toContain(tagId);

    await put(`/api/kesim-alanlari/${kaId}/donations/${id}`).send({ tags: [] });
    const updated = await get(`/api/kesim-alanlari/${kaId}/donations`);
    const upFound = updated.body.items.find((d: { id: string }) => d.id === id);
    expect(upFound?.tags ?? []).toHaveLength(0);

    await del(`/api/kesim-alanlari/${kaId}/donations/${id}?permanent=true`);
    await del(`/api/tags/${tagId}`);
  });
});

describe("D10–D12 — Liste filtreleri", () => {
  let filterId1: string;
  let filterId2: string;
  let filterId3: string;

  beforeAll(async () => {
    filterId1 = `${TEST_PREFIX}-flt1-${TS}`;
    filterId2 = `${TEST_PREFIX}-flt2-${TS}`;
    filterId3 = `${TEST_PREFIX}-flt3-${TS}`;

    await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id: filterId1, name: "ZZZ_Arama Adı", description: "büyükbaş",
      donationType: "kurban", shareCount: 1, excluded: false,
    });
    await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id: filterId2, name: "ZZZ_Diğer Adı", description: "küçükbaş",
      donationType: "sadaka", shareCount: 2, excluded: true,
    });
    await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id: filterId3, name: "ZZZ_Üçüncü Adı", description: "büyükbaş",
      donationType: "kurban", shareCount: 1, excluded: false,
    });
  });

  afterAll(async () => {
    for (const id of [filterId1, filterId2, filterId3]) {
      await del(`/api/kesim-alanlari/${kaId}/donations/${id}?permanent=true`);
    }
  });

  it("D10 — arama filtresi: isimle arama doğru sonuç döner", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/donations?search=ZZZ_Arama`);
    expect(res.status).toBe(200);
    const items = res.body.items;
    expect(items.some((d: { id: string }) => d.id === filterId1)).toBe(true);
    expect(items.every((d: { name: string }) => d.name.includes("ZZZ_Arama"))).toBe(true);
  });

  it("D11 — excluded filtresi: sadece excluded=true döner", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/donations?excluded=true`);
    expect(res.status).toBe(200);
    const items = res.body.items;
    expect(items.some((d: { id: string }) => d.id === filterId2)).toBe(true);
    expect(items.every((d: { excluded: boolean }) => d.excluded === true)).toBe(true);
  });

  it("D11b — excluded=false filtresi: sadece excluded=false döner", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/donations?excluded=false`);
    expect(res.status).toBe(200);
    const items = res.body.items;
    expect(items.every((d: { excluded: boolean }) => d.excluded === false)).toBe(true);
    expect(items.some((d: { id: string }) => d.id === filterId2)).toBe(false);
  });

  it("D12 — donationType filtresi: sadece kurban tipi döner", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/donations?donationType=kurban`);
    expect(res.status).toBe(200);
    const items = res.body.items;
    expect(items.some((d: { id: string }) => d.id === filterId1)).toBe(true);
    expect(items.some((d: { id: string }) => d.id === filterId2)).toBe(false);
    expect(items.every((d: { donationType: string }) => d.donationType === "kurban")).toBe(true);
  });
});

describe("D13 — Cursor tabanlı sayfalama", () => {
  const paginationIds: string[] = [];

  beforeAll(async () => {
    for (let i = 0; i < 5; i++) {
      const id = `${TEST_PREFIX}-page-${i}-${TS}`;
      paginationIds.push(id);
      await post(`/api/kesim-alanlari/${kaId}/donations`).send({
        id, name: `ZZZ_Page Bağışçı ${i}`, description: `Sayfa ${i}`, shareCount: 1,
      });
    }
  });

  afterAll(async () => {
    for (const id of paginationIds) {
      await del(`/api/kesim-alanlari/${kaId}/donations/${id}?permanent=true`);
    }
  });

  it("limit=2 ile ilk sayfa, hasMore=true ve nextCursor döner", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/donations?limit=2&search=ZZZ_Page`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextCursor).toBeTruthy();
  });

  it("nextCursor ile ikinci sayfa gelir, çakışma yok", async () => {
    const first = await get(`/api/kesim-alanlari/${kaId}/donations?limit=2&search=ZZZ_Page`);
    const cursor = first.body.nextCursor;
    const second = await get(`/api/kesim-alanlari/${kaId}/donations?limit=2&search=ZZZ_Page&cursor=${cursor}`);
    expect(second.status).toBe(200);

    const firstIds = first.body.items.map((d: { id: string }) => d.id);
    const secondIds = second.body.items.map((d: { id: string }) => d.id);
    const overlap = firstIds.filter((id: string) => secondIds.includes(id));
    expect(overlap.length).toBe(0);
  });

  it("geçersiz cursor 400 döner", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/donations?cursor=GECERSIZ_CURSOR`);
    expect(res.status).toBe(400);
  });
});

describe("D14 — Silinmiş KA'da bağış işlemleri engellenir", () => {
  it("KA soft-delete sonrası yeni bağış oluşturulamaz", async () => {
    const delKaId = `${TEST_PREFIX}-del-ka2-${TS}`;
    await post("/api/kesim-alanlari").send({
      id: delKaId, name: "Silinecek KA 2", projectId, donations: [], animalGroups: [],
    });
    await del(`/api/kesim-alanlari/${delKaId}`);

    const res = await post(`/api/kesim-alanlari/${delKaId}/donations`).send({
      id: `${TEST_PREFIX}-ghostdon-${TS}`,
      name: "Hayalet Bağışçı", description: "Test", shareCount: 1,
    });
    expect(res.status).toBeGreaterThanOrEqual(400);

    await del(`/api/kesim-alanlari/${delKaId}?permanent=true`);
  });
});

describe("D15–D16 — ID çakışması ve alan kısıtları", () => {
  it("D15 — aynı ID ile ikinci bağış oluşturma hata verir", async () => {
    const dupId = `${TEST_PREFIX}-dup-${TS}`;
    const first = await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id: dupId, name: "İlk Bağışçı", description: "Test", shareCount: 1,
    });
    expect(first.status).toBe(201);

    const second = await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id: dupId, name: "Çift Bağışçı", description: "Test", shareCount: 1,
    });
    expect(second.status).toBeGreaterThanOrEqual(400);

    await del(`/api/kesim-alanlari/${kaId}/donations/${dupId}?permanent=true`);
  });

  it("D16 — shareCount < 1 ile bağış oluşturma 400 döner", async () => {
    const res = await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id: `${TEST_PREFIX}-badshare-${TS}`,
      name: "Geçersiz Hisse", description: "Test", shareCount: 0,
    });
    expect(res.status).toBe(400);
  });
});
