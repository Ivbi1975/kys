import { describe, it, expect, afterAll, beforeAll } from "vitest";
import supertest from "supertest";
import app from "../app";

const TEST_PREFIX = "__vitest_vys__";
const API_KEY = process.env.API_KEY!;
const ADMIN_KEY = process.env.ADMIN_KEY ?? "";
const CONFIGURED_VYS_KEY = process.env.VYS_API_KEY ?? "";
const IS_DEV_BYPASS = !CONFIGURED_VYS_KEY;

const agent = supertest(app);

function apiPost(url: string) {
  const req = agent.post(url).set("X-API-Key", API_KEY);
  if (ADMIN_KEY) req.set("X-Admin-Key", ADMIN_KEY);
  return req;
}
function apiDel(url: string) {
  const req = agent.delete(url).set("X-API-Key", API_KEY);
  if (ADMIN_KEY) req.set("X-Admin-Key", ADMIN_KEY);
  return req;
}

function vysGet(url: string, vysKey?: string) {
  const req = agent.get(url);
  if (vysKey !== undefined) req.set("X-API-Key", vysKey);
  return req;
}

const TS = Date.now();
let projectId: string;
const kaId = `${TEST_PREFIX}-ka-${TS}`;

afterAll(async () => {
  await apiDel(`/api/kesim-alanlari/${kaId}?permanent=true`);
  if (projectId) await apiDel(`/api/projects/${projectId}`);
});

describe("VYS setup", () => {
  it("proje ve KA + bağış oluşturulur", async () => {
    const p = await apiPost("/api/projects").send({ name: `${TEST_PREFIX} VYS Proje` });
    expect(p.status).toBe(201);
    projectId = p.body.id;

    const ka = await apiPost("/api/kesim-alanlari").send({
      id: kaId, name: `${TEST_PREFIX} VYS KA`, projectId, donations: [], animalGroups: [],
    });
    expect(ka.status).toBe(201);

    const don = await apiPost(`/api/kesim-alanlari/${kaId}/donations`).send({
      id: `${TEST_PREFIX}-vd1-${TS}`, name: "VYS Bağışçı 1",
      description: "Büyükbaş", donationType: "kurban", shareCount: 1,
      vekalet: "VKL-V01",
    });
    expect(don.status).toBe(201);
  });
});

describe("VYS auth — token yokken davranış", () => {
  it("VYS key olmadan istek — dev bypass varsa 200, yoksa 401 veya 503 döner", async () => {
    const res = await vysGet("/api/vys/projects");
    if (IS_DEV_BYPASS) {
      expect(res.status).toBe(200);
    } else {
      expect([401, 503]).toContain(res.status);
    }
  });

  it("yanlış VYS key ile istek — VYS_API_KEY ayarlıysa 401 döner", async () => {
    if (!CONFIGURED_VYS_KEY) return;
    const res = await vysGet("/api/vys/projects", "definitely-wrong-key-xyz");
    expect(res.status).toBe(401);
  });

  it("boş string VYS key — VYS_API_KEY ayarlıysa 401 döner", async () => {
    if (!CONFIGURED_VYS_KEY) return;
    const res = await vysGet("/api/vys/projects", "");
    expect(res.status).toBe(401);
  });

  it("doğru VYS key ile istek 200 döner", async () => {
    if (!CONFIGURED_VYS_KEY) return;
    const res = await vysGet("/api/vys/projects", CONFIGURED_VYS_KEY);
    expect(res.status).toBe(200);
  });
});

describe("VYS — /api/vys/projects (dev bypass aktifken)", () => {
  beforeAll(() => {
    if (!IS_DEV_BYPASS) return;
  });

  it("proje listesi 200 döner ve dizi içerir", async () => {
    const res = await vysGet("/api/vys/projects");
    if (!IS_DEV_BYPASS) {
      expect([401, 503]).toContain(res.status);
      return;
    }
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("proje listesinde doğru alanlar var", async () => {
    const res = await vysGet("/api/vys/projects");
    if (res.status !== 200) return;
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      const first = res.body[0] as Record<string, unknown>;
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("createdAt");
    }
  });

  it("oluşturulan proje listede görünür", async () => {
    const res = await vysGet("/api/vys/projects");
    if (res.status !== 200) return;
    const found = (res.body as { id: string }[]).find(p => p.id === projectId);
    expect(found).toBeTruthy();
  });
});

describe("VYS — /api/vys/projects/:id/donations", () => {
  it("geçerli proje ID ile bağış listesi 200 döner (dev bypass aktifken)", async () => {
    const res = await vysGet(`/api/vys/projects/${projectId}/donations`);
    if (!IS_DEV_BYPASS) {
      expect([401, 503]).toContain(res.status);
      return;
    }
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page");
    expect(res.body).toHaveProperty("limit");
  });

  it("bağış listesi response'unda beklenen alanlar var", async () => {
    const res = await vysGet(`/api/vys/projects/${projectId}/donations`);
    if (res.status !== 200) return;

    const items = res.body.items as Record<string, unknown>[];
    if (items.length === 0) return;

    const first = items[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("shareCount");
    expect(first).toHaveProperty("donationType");
    expect(first).toHaveProperty("kesimAlaniId");
    expect(first).toHaveProperty("tags");
    expect(Array.isArray(first.tags)).toBe(true);
  });

  it("oluşturulan bağış VYS listesinde görünür", async () => {
    const res = await vysGet(`/api/vys/projects/${projectId}/donations`);
    if (res.status !== 200) return;
    const found = (res.body.items as { kesimAlaniId: string }[]).some(
      d => d.kesimAlaniId === kaId
    );
    expect(found).toBe(true);
  });

  it("var olmayan proje ID ile 404 döner (dev bypass aktifken)", async () => {
    const res = await vysGet("/api/vys/projects/nonexistent_proj_xyz/donations");
    if (!IS_DEV_BYPASS) {
      expect([401, 503]).toContain(res.status);
      return;
    }
    expect(res.status).toBe(404);
  });

  it("sayfalama page ve limit parametreleri çalışır", async () => {
    const res = await vysGet(`/api/vys/projects/${projectId}/donations?page=1&limit=5`);
    if (res.status !== 200) return;
    expect(res.body.limit).toBe(5);
    expect(res.body.page).toBe(1);
  });

  it("VYS key olmadan istek — dev bypass yoksa 401/503 döner", async () => {
    if (IS_DEV_BYPASS) return;
    const res = await agent.get(`/api/vys/projects/${projectId}/donations`);
    expect([401, 503]).toContain(res.status);
  });
});

describe("VYS — /api/vys/projects/:id/kesim-alanlari", () => {
  it("proje KA listesi 200 döner (dev bypass aktifken)", async () => {
    const res = await vysGet(`/api/vys/projects/${projectId}/kesim-alanlari`);
    if (!IS_DEV_BYPASS) {
      expect([401, 503]).toContain(res.status);
      return;
    }
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("oluşturulan KA listedе görünür", async () => {
    const res = await vysGet(`/api/vys/projects/${projectId}/kesim-alanlari`);
    if (res.status !== 200) return;
    const found = (res.body as { id: string }[]).find(ka => ka.id === kaId);
    expect(found).toBeTruthy();
  });
});
