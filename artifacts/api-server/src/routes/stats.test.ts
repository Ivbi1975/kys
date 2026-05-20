import { describe, it, expect, afterAll, beforeAll } from "vitest";
import supertest from "supertest";
import app from "../app";

const TEST_PREFIX = "__vitest_stats__";
const API_KEY = process.env.API_KEY!;
const ADMIN_KEY = process.env.ADMIN_KEY ?? "";
const agent = supertest(app);

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
function put(url: string) {
  const req = agent.put(url).set("X-API-Key", API_KEY);
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
const grp1Id = `${TEST_PREFIX}-g1-${TS}`;
const grp2Id = `${TEST_PREFIX}-g2-${TS}`;

afterAll(async () => {
  await del(`/api/kesim-alanlari/${kaId}?permanent=true`);
  if (projectId) await del(`/api/projects/${projectId}`);
});

describe("Stats setup", () => {
  it("proje, KA, 2 grup ve bağışlar oluşturulur", async () => {
    const p = await post("/api/projects").send({ name: `${TEST_PREFIX} Stats Proje` });
    expect(p.status).toBe(201);
    projectId = p.body.id;

    const ka = await post("/api/kesim-alanlari").send({
      id: kaId, name: `${TEST_PREFIX} Stats KA`, projectId, donations: [], animalGroups: [],
    });
    expect(ka.status).toBe(201);

    const g1 = await post(`/api/kesim-alanlari/${kaId}/animal-groups`).send({
      id: grp1Id, animalNo: 1, colorTag: "green",
    });
    expect(g1.status).toBe(201);

    const g2 = await post(`/api/kesim-alanlari/${kaId}/animal-groups`).send({
      id: grp2Id, animalNo: 2, colorTag: "blue",
    });
    expect(g2.status).toBe(201);

    for (let i = 0; i < 3; i++) {
      await post(`/api/kesim-alanlari/${kaId}/donations`).send({
        id: `${TEST_PREFIX}-sd${i}-${TS}`, name: `Stats Bağışçı ${i}`,
        description: "Test", donationType: "kurban", shareCount: 1,
      });
    }
  });
});

describe("Stats — KA dashboard", () => {
  it("GET /api/kesim-alanlari/:id/dashboard 200 döner", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/dashboard`);
    expect(res.status).toBe(200);
  });

  it("dashboard response nesne döner (boş olmayan)", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/dashboard`);
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe("object");
    expect(Object.keys(res.body).length).toBeGreaterThan(0);
  });

  it("var olmayan KA için dashboard 404 döner", async () => {
    const res = await get("/api/kesim-alanlari/nonexistent_ka_xyz/dashboard");
    expect(res.status).toBe(404);
  });
});

describe("Stats — proje dashboard beklenen alanlar", () => {
  it("GET /api/projects/:id/dashboard 200 döner", async () => {
    const res = await get(`/api/projects/${projectId}/dashboard`);
    expect(res.status).toBe(200);
  });

  it("proje dashboard beklenen alanları içerir", async () => {
    const res = await get(`/api/projects/${projectId}/dashboard`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalAnimals");
    expect(res.body).toHaveProperty("kesildiCount");
    expect(res.body).toHaveProperty("remainingCount");
    expect(res.body).toHaveProperty("kesildiPercent");
    expect(res.body).toHaveProperty("kesimAlanlari");
    expect(Array.isArray(res.body.kesimAlanlari)).toBe(true);
  });

  it("var olmayan proje için dashboard 404 döner", async () => {
    const res = await get("/api/projects/nonexistent_proj_xyz/dashboard");
    expect(res.status).toBe(404);
  });
});

describe("Stats — proje dashboard sayısal doğruluk", () => {
  it("totalAnimals tam olarak oluşturulan grup sayısına eşit", async () => {
    const res = await get(`/api/projects/${projectId}/dashboard`);
    expect(res.status).toBe(200);
    expect(res.body.totalAnimals).toBe(2);
  });

  it("kesildiCount başlangıçta 0", async () => {
    const res = await get(`/api/projects/${projectId}/dashboard`);
    expect(res.status).toBe(200);
    expect(res.body.kesildiCount).toBe(0);
  });

  it("remainingCount = totalAnimals - kesildiCount doğrulanır", async () => {
    const res = await get(`/api/projects/${projectId}/dashboard`);
    expect(res.status).toBe(200);
    expect(res.body.remainingCount).toBe(res.body.totalAnimals - res.body.kesildiCount);
  });

  it("kesimAlanlari listesinde oluşturulan KA yer alır, totalAnimals=2 ile", async () => {
    const res = await get(`/api/projects/${projectId}/dashboard`);
    expect(res.status).toBe(200);
    const ka = (res.body.kesimAlanlari as { id: string; totalAnimals: number; kesildiCount: number }[])
      .find(a => a.id === kaId);
    expect(ka).toBeTruthy();
    expect(ka!.totalAnimals).toBe(2);
    expect(ka!.kesildiCount).toBe(0);
  });

  it("KA içindeki totalAnimals KA toplamı ile uyumlu (sum == project total)", async () => {
    const res = await get(`/api/projects/${projectId}/dashboard`);
    expect(res.status).toBe(200);
    const sumFromKAs = (res.body.kesimAlanlari as { totalAnimals: number }[])
      .reduce((acc, ka) => acc + ka.totalAnimals, 0);
    expect(res.body.totalAnimals).toBe(sumFromKAs);
  });
});

describe("Stats — kesildi toggle → dashboard tutarlılığı", () => {
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

  it("grup kesildi=true yapılınca kesildiCount 1 artar", async () => {
    const beforeRes = await get(`/api/projects/${projectId}/dashboard`);
    const beforeCount = beforeRes.body.kesildiCount as number;

    const toggleRes = await put(`/api/kesim-alanlari/${kaId}/animal-groups/${grp1Id}`)
      .send({ kesildi: true });
    expect(toggleRes.status).toBe(200);

    await wait(150);

    const afterRes = await get(`/api/projects/${projectId}/dashboard`);
    expect(afterRes.status).toBe(200);
    expect(afterRes.body.kesildiCount).toBe(beforeCount + 1);
    expect(afterRes.body.remainingCount).toBe(afterRes.body.totalAnimals - afterRes.body.kesildiCount);
  });

  it("kesildi=false ile geri alınınca kesildiCount azalır", async () => {
    const beforeRes = await get(`/api/projects/${projectId}/dashboard`);
    const beforeCount = beforeRes.body.kesildiCount as number;
    expect(beforeCount).toBeGreaterThanOrEqual(1);

    const toggleRes = await put(`/api/kesim-alanlari/${kaId}/animal-groups/${grp1Id}`)
      .send({ kesildi: false });
    expect(toggleRes.status).toBe(200);

    await wait(150);

    const afterRes = await get(`/api/projects/${projectId}/dashboard`);
    expect(afterRes.status).toBe(200);
    expect(afterRes.body.kesildiCount).toBe(beforeCount - 1);
  });

  it("KA bazında kesildiCount da project toplamıyla uyumlu", async () => {
    const toggleRes = await put(`/api/kesim-alanlari/${kaId}/animal-groups/${grp2Id}`)
      .send({ kesildi: true });
    expect(toggleRes.status).toBe(200);

    await wait(150);

    const dashRes = await get(`/api/projects/${projectId}/dashboard`);
    expect(dashRes.status).toBe(200);

    const projectKesildi = dashRes.body.kesildiCount as number;
    const sumFromKAs = (dashRes.body.kesimAlanlari as { kesildiCount: number }[])
      .reduce((acc, ka) => acc + ka.kesildiCount, 0);
    expect(projectKesildi).toBe(sumFromKAs);
  });
});

describe("Stats — pool endpoint ↔ dashboard tutarlılığı", () => {
  it("pool toplam bağış sayısı, donations/count ile tutarlı", async () => {
    const poolRes = await get(`/api/projects/${projectId}/donations`);
    expect(poolRes.status).toBe(200);
    expect(poolRes.body.total).toBeGreaterThanOrEqual(3);

    const countRes = await get(`/api/kesim-alanlari/${kaId}/donations/count`);
    expect(countRes.status).toBe(200);
    expect(countRes.body.count).toBeGreaterThanOrEqual(3);
  });

  it("pool total alanı >= oluşturulan bağış sayısı", async () => {
    const poolRes = await get(`/api/projects/${projectId}/donations`);
    expect(poolRes.status).toBe(200);
    expect(poolRes.body.total).toBeGreaterThanOrEqual(3);
    expect(poolRes.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it("KA bağış sayısı pool total ile tutarsız değil", async () => {
    const poolRes = await get(`/api/projects/${projectId}/donations`);
    expect(poolRes.status).toBe(200);
    const poolTotal = poolRes.body.total as number;

    const countRes = await get(`/api/kesim-alanlari/${kaId}/donations/count`);
    expect(countRes.status).toBe(200);
    const kaCount = countRes.body.count as number;

    expect(kaCount).toBeLessThanOrEqual(poolTotal);
    expect(kaCount).toBe(3);
  });
});
