import { describe, it, expect, afterAll, beforeAll } from "vitest";
import supertest from "supertest";
import app from "../app";

const TEST_PREFIX = "__vitest_backup__";
const API_KEY = process.env.API_KEY!;
const ADMIN_KEY = process.env.ADMIN_KEY ?? "";
const agent = supertest(app);
const hasAdminKey = !!ADMIN_KEY;

function get(url: string) {
  const req = agent.get(url).set("X-API-Key", API_KEY);
  if (ADMIN_KEY) req.set("X-Admin-Key", ADMIN_KEY);
  return req;
}
function post(url: string) {
  const req = agent.post(url).set("X-API-Key", API_KEY);
  if (ADMIN_KEY) req.set("X-Admin-Key", ADMIN_KEY);
  return req;
}
function del(url: string) {
  const req = agent.delete(url).set("X-API-Key", API_KEY);
  if (ADMIN_KEY) req.set("X-Admin-Key", ADMIN_KEY);
  return req;
}

const TS = Date.now();
let projectId: string;
const kaId = `${TEST_PREFIX}-ka-${TS}`;
const don1 = `${TEST_PREFIX}-don1-${TS}`;
const don2 = `${TEST_PREFIX}-don2-${TS}`;

afterAll(async () => {
  await del(`/api/kesim-alanlari/${kaId}?permanent=true`);
  if (projectId) await del(`/api/projects/${projectId}`);
});

describe("Backup setup", () => {
  it("proje + KA + bağışlar oluşturulur", async () => {
    const p = await post("/api/projects").send({ name: `${TEST_PREFIX} Proje` });
    expect(p.status).toBe(201);
    projectId = p.body.id;

    const ka = await post("/api/kesim-alanlari").send({
      id: kaId, name: `${TEST_PREFIX} KA`, projectId, donations: [], animalGroups: [],
    });
    expect(ka.status).toBe(201);

    for (const [id, name, vekalet] of [
      [don1, "Backup Bağışçı 1", "VKL-B01"],
      [don2, "Backup Bağışçı 2", "VKL-B02"],
    ] as [string, string, string][]) {
      const r = await post(`/api/kesim-alanlari/${kaId}/donations`).send({
        id, name, description: "Test bağışı", donationType: "kurban", shareCount: 1, vekalet,
      });
      expect(r.status).toBe(201);
    }
  });
});

describe("Backup Export — temel testler", () => {
  it("GET /api/backup/export 200 ve geçerli format döner", async () => {
    const res = await post("/api/backup/export").send({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("kesimAlanlari");
    expect(Array.isArray(res.body.kesimAlanlari)).toBe(true);
  });

  it("export response gerekli üst düzey alanları içerir", async () => {
    const res = await post("/api/backup/export").send({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("version");
    expect(res.body).toHaveProperty("timestamp");
    expect(typeof res.body.timestamp).toBe("string");
    expect(typeof res.body.version).toBe("number");
  });

  it("oluşturulan KA export verisinde yer alır", async () => {
    const res = await post("/api/backup/export").send({});
    expect(res.status).toBe(200);
    const exported = res.body.kesimAlanlari as { id: string }[];
    expect(exported.find(k => k.id === kaId)).toBeTruthy();
  });

  it("oluşturulan bağışlar export KA içinde yer alır", async () => {
    const res = await post("/api/backup/export").send({});
    expect(res.status).toBe(200);
    const exported = res.body.kesimAlanlari as { id: string; donations: { id: string }[] }[];
    const exportedKA = exported.find(k => k.id === kaId);
    expect(exportedKA).toBeTruthy();
    expect(exportedKA!.donations.some(d => d.id === don1)).toBe(true);
    expect(exportedKA!.donations.some(d => d.id === don2)).toBe(true);
  });
});

describe("Backup Import — dryRun ve validasyon testleri", () => {
  let exportedData: unknown;

  beforeAll(async () => {
    const res = await post("/api/backup/export").send({});
    expect(res.status).toBe(200);
    exportedData = res.body;
  });

  it.skipIf(!hasAdminKey)("POST /api/backup/import dryRun=true özet (summary) döner", async () => {
    const res = await post("/api/backup/import").send({
      mode: "merge",
      dryRun: true,
      data: exportedData,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("dryRun", true);
    expect(res.body).toHaveProperty("summary");
  });

  it("dryRun import admin key olmadan 403 döner", async () => {
    if (hasAdminKey) return;
    const res = await post("/api/backup/import").send({
      mode: "merge",
      dryRun: true,
      data: exportedData,
    });
    expect(res.status).toBe(403);
  });

  it("replace modu confirmReplace olmadan 403 veya 409 döner", async () => {
    const res = await post("/api/backup/import").send({
      mode: "replace",
      dryRun: false,
      confirmReplace: false,
      data: exportedData,
    });
    expect([403, 409]).toContain(res.status);
  });

  it("geçersiz payload ile import 400 veya 403 döner", async () => {
    const res = await post("/api/backup/import").send({ mode: "replace", data: { invalid: true } });
    expect([400, 403]).toContain(res.status);
  });
});

describe("Backup Round-trip — Export → Delete → Import → Verify", () => {
  let roundtripProjectId: string;
  const rtKaId = `${TEST_PREFIX}-rt-ka-${TS}`;
  const rtDon1 = `${TEST_PREFIX}-rt-don1-${TS}`;
  const rtDon2 = `${TEST_PREFIX}-rt-don2-${TS}`;
  let exportedData: {
    kesimAlanlari: { id: string; name: string; donations: { id: string; name: string; shareCount: number }[] }[];
  };

  it("round-trip için proje ve veri oluşturulur", async () => {
    const p = await post("/api/projects").send({ name: `${TEST_PREFIX} RT Proje` });
    expect(p.status).toBe(201);
    roundtripProjectId = p.body.id;

    const ka = await post("/api/kesim-alanlari").send({
      id: rtKaId, name: `${TEST_PREFIX} RT KA`, projectId: roundtripProjectId,
      donations: [], animalGroups: [],
    });
    expect(ka.status).toBe(201);

    for (const [id, name, shares] of [
      [rtDon1, "RT Bağışçı Alpha", 2],
      [rtDon2, "RT Bağışçı Beta", 1],
    ] as [string, string, number][]) {
      const r = await post(`/api/kesim-alanlari/${rtKaId}/donations`).send({
        id, name, description: "Round-trip test", donationType: "kurban", shareCount: shares,
      });
      expect(r.status).toBe(201);
    }
  });

  it("export verisi doğru bağışları ve shareCount değerlerini içerir", async () => {
    const res = await post("/api/backup/export").send({});
    expect(res.status).toBe(200);
    exportedData = res.body;

    const exportedKA = exportedData.kesimAlanlari.find(ka => ka.id === rtKaId);
    expect(exportedKA).toBeTruthy();
    expect(exportedKA!.name).toBe(`${TEST_PREFIX} RT KA`);
    expect(exportedKA!.donations.some(d => d.id === rtDon1)).toBe(true);
    expect(exportedKA!.donations.some(d => d.id === rtDon2)).toBe(true);

    const d1 = exportedKA!.donations.find(d => d.id === rtDon1);
    expect(d1!.shareCount).toBe(2);
    const d2 = exportedKA!.donations.find(d => d.id === rtDon2);
    expect(d2!.shareCount).toBe(1);
  });

  it("KA kalıcı silme başarılı döner ve 404 ile doğrulanır", async () => {
    const delRes = await del(`/api/kesim-alanlari/${rtKaId}?permanent=true`);
    expect(delRes.status).toBe(200);
    expect(delRes.body).toHaveProperty("success", true);

    const check = await get(`/api/kesim-alanlari/${rtKaId}`);
    expect(check.status).toBe(404);
  });

  it.skipIf(!hasAdminKey)("import merge modu veriyi geri yükler ve shareCount doğrulanır", async () => {
    const importRes = await post("/api/backup/import").send({
      mode: "merge",
      dryRun: false,
      data: exportedData,
    });
    expect(importRes.status).toBe(200);

    const kaCheck = await get(`/api/kesim-alanlari/${rtKaId}`);
    expect(kaCheck.status).toBe(200);
    expect(kaCheck.body.id).toBe(rtKaId);
    expect(kaCheck.body.name).toBe(`${TEST_PREFIX} RT KA`);

    const dons = await get(`/api/kesim-alanlari/${rtKaId}/donations`);
    expect(dons.status).toBe(200);
    const donItems = (dons.body.items ?? dons.body) as { id: string; shareCount: number }[];
    const ids = donItems.map(d => d.id);
    expect(ids).toContain(rtDon1);
    expect(ids).toContain(rtDon2);

    const d1 = donItems.find(d => d.id === rtDon1);
    expect(d1!.shareCount).toBe(2);
  });

  it("cleanup: round-trip projesi kalıcı silme", async () => {
    await del(`/api/kesim-alanlari/${rtKaId}?permanent=true`);
    const delRes = await del(`/api/projects/${roundtripProjectId}`);
    expect(delRes.status).toBe(200);
  });
});
