import { describe, it, expect, afterAll, beforeAll } from "vitest";
import supertest from "supertest";
import app from "../app";

const TEST_PREFIX = "__vitest_pool__";
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
function del(url: string) {
  const req = agent.delete(url).set("X-API-Key", API_KEY);
  if (ADMIN_KEY) req.set("X-Admin-Key", ADMIN_KEY);
  return req;
}

const TS = Date.now();
let projectId: string;
const kaId = `${TEST_PREFIX}-ka-${TS}`;

type Donation = { id: string; name: string; donationType: string; excluded?: boolean };
const donations: Donation[] = [
  { id: `${TEST_PREFIX}-d1-${TS}`, name: "Ahmet Yılmaz", donationType: "kurban" },
  { id: `${TEST_PREFIX}-d2-${TS}`, name: "Mehmet Kaya", donationType: "sadaka", excluded: true },
  { id: `${TEST_PREFIX}-d3-${TS}`, name: "Ayşe Demir", donationType: "kurban" },
  { id: `${TEST_PREFIX}-d4-${TS}`, name: "Zeynep Çelik", donationType: "adak" },
  { id: `${TEST_PREFIX}-d5-${TS}`, name: "İbrahim Şahin", donationType: "kurban" },
  { id: `${TEST_PREFIX}-d6-${TS}`, name: "Fatma Güneş", donationType: "akika", excluded: true },
  { id: `${TEST_PREFIX}-d7-${TS}`, name: "Ali Öztürk", donationType: "sadaka" },
];
let tagId: string;

afterAll(async () => {
  await del(`/api/kesim-alanlari/${kaId}?permanent=true`);
  if (projectId) await del(`/api/projects/${projectId}`);
  if (tagId) await del(`/api/tags/${tagId}`);
});

describe("Pool Filters setup", () => {
  it("proje, KA, tag ve bağışlar oluşturulur", async () => {
    const p = await post("/api/projects").send({ name: `${TEST_PREFIX} Pool Proje` });
    expect(p.status).toBe(201);
    projectId = p.body.id;

    const ka = await post("/api/kesim-alanlari").send({
      id: kaId, name: `${TEST_PREFIX} Pool KA`, projectId, donations: [], animalGroups: [],
    });
    expect(ka.status).toBe(201);

    const tagRes = await post("/api/tags").send({
      id: `${TEST_PREFIX}-tag-${TS}`, name: "Pool Test Tag", color: "#ff0000",
    });
    expect([200, 201]).toContain(tagRes.status);
    tagId = tagRes.body.id ?? `${TEST_PREFIX}-tag-${TS}`;

    for (const d of donations) {
      const tags = d.id === donations[0].id ? [tagId] : [];
      const r = await post(`/api/kesim-alanlari/${kaId}/donations`).send({
        id: d.id, name: d.name, description: "Pool test",
        donationType: d.donationType, shareCount: 1,
        excluded: d.excluded ?? false, tags,
      });
      expect(r.status).toBe(201);
    }
  });
});

describe("Pool — temel arama filtresi", () => {
  it("isim araması doğru sonuç döner (ASCII)", async () => {
    const res = await get(`/api/projects/${projectId}/donations?search=Ahmet`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    const found = (res.body.items as { name: string }[]).some(d => d.name.includes("Ahmet"));
    expect(found).toBe(true);
  });

  it("Türkçe karakter İbrahim ile arama çalışır", async () => {
    const res = await get(`/api/projects/${projectId}/donations?search=${encodeURIComponent("İbrahim")}`);
    expect(res.status).toBe(200);
    const found = (res.body.items as { name: string }[]).some(d => d.name.includes("İbrahim"));
    expect(found).toBe(true);
  });

  it("Türkçe karakter Şahin ile arama çalışır", async () => {
    const res = await get(`/api/projects/${projectId}/donations?search=${encodeURIComponent("Şahin")}`);
    expect(res.status).toBe(200);
    const found = (res.body.items as { name: string }[]).some(d => d.name.includes("İbrahim"));
    expect(found).toBe(true);
  });

  it("Türkçe karakter Zeynep Çelik ile arama çalışır", async () => {
    const res = await get(`/api/projects/${projectId}/donations?search=${encodeURIComponent("Zeynep")}`);
    expect(res.status).toBe(200);
    const found = (res.body.items as { name: string }[]).some(d => d.name.includes("Zeynep"));
    expect(found).toBe(true);
  });

  it("sonuç dönmeyen arama boş items ile 200 döner", async () => {
    const res = await get(`/api/projects/${projectId}/donations?search=XXXXXXXXNONEXISTENT`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
    expect(res.body.total).toBe(0);
  });

  it("arama sonuçları total alanıyla uyumlu", async () => {
    const res = await get(`/api/projects/${projectId}/donations?search=${encodeURIComponent("Ahmet")}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(res.body.total);
  });
});

describe("Pool — donationType filtresi", () => {
  it("donationType=kurban sadece kurban bağışları döner", async () => {
    const res = await get(`/api/projects/${projectId}/donations?donationType=kurban`);
    expect(res.status).toBe(200);
    const items = res.body.items as { donationType: string }[];
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(item.donationType).toBe("kurban");
    }
  });

  it("donationType=sadaka sadece sadaka bağışları döner", async () => {
    const res = await get(`/api/projects/${projectId}/donations?donationType=sadaka`);
    expect(res.status).toBe(200);
    const items = res.body.items as { donationType: string }[];
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(item.donationType).toBe("sadaka");
    }
  });

  it("donationType=adak sadece adak bağışları döner", async () => {
    const res = await get(`/api/projects/${projectId}/donations?donationType=adak`);
    expect(res.status).toBe(200);
    const items = res.body.items as { donationType: string }[];
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(item.donationType).toBe("adak");
    }
  });

  it("donationType=kurban ile toplam beklenen sayı tutarlı", async () => {
    const kurbanDonations = donations.filter(d => d.donationType === "kurban");
    const res = await get(`/api/projects/${projectId}/donations?donationType=kurban`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(kurbanDonations.length);
  });
});

describe("Pool — excluded/status filtresi", () => {
  it("status=excluded sadece excluded bağışları döner (excluded=true)", async () => {
    const res = await get(`/api/projects/${projectId}/donations?status=excluded`);
    expect(res.status).toBe(200);
    const items = res.body.items as { excluded: boolean }[];
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(item.excluded).toBe(true);
    }
  });

  it("status=active sadece aktif bağışları döner (excluded=false)", async () => {
    const res = await get(`/api/projects/${projectId}/donations?status=active`);
    expect(res.status).toBe(200);
    const items = res.body.items as { excluded: boolean }[];
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(item.excluded).toBe(false);
    }
  });

  it("status=excluded sayısı beklenen excluded count ile uyumlu", async () => {
    const excludedDonations = donations.filter(d => d.excluded);
    const res = await get(`/api/projects/${projectId}/donations?status=excluded`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(excludedDonations.length);
  });

  it("status=excluded ve status=active toplam = filtresiz toplam", async () => {
    const allRes = await get(`/api/projects/${projectId}/donations`);
    const excRes = await get(`/api/projects/${projectId}/donations?status=excluded`);
    const actRes = await get(`/api/projects/${projectId}/donations?status=active`);
    expect(allRes.status).toBe(200);
    expect(excRes.status).toBe(200);
    expect(actRes.status).toBe(200);
    expect(allRes.body.total).toBe((excRes.body.total as number) + (actRes.body.total as number));
  });

  it("excluded bağış status=active filtresinde görünmez, aktif bağış status=excluded filtresinde görünmez", async () => {
    const excludedId = donations.find(d => d.excluded)!.id;
    const activeId = donations.find(d => !d.excluded)!.id;

    const excRes = await get(`/api/projects/${projectId}/donations?status=excluded`);
    expect(excRes.status).toBe(200);
    const excIds = (excRes.body.items as { id: string }[]).map(d => d.id);
    expect(excIds).toContain(excludedId);
    expect(excIds).not.toContain(activeId);

    const actRes = await get(`/api/projects/${projectId}/donations?status=active`);
    expect(actRes.status).toBe(200);
    const actIds = (actRes.body.items as { id: string }[]).map(d => d.id);
    expect(actIds).toContain(activeId);
    expect(actIds).not.toContain(excludedId);
  });
});

describe("Pool — tag filtresi", () => {
  it("tagIds filtresi ile sadece o tag'a sahip bağışlar döner", async () => {
    const res = await get(`/api/projects/${projectId}/donations?tagIds=${tagId}`);
    expect(res.status).toBe(200);
    const items = res.body.items as { id: string }[];
    expect(items.length).toBeGreaterThanOrEqual(1);
    const found = items.find(d => d.id === donations[0].id);
    expect(found).toBeTruthy();
  });

  it("tagIds filtresi ile tag'sız bağış görünmez", async () => {
    const res = await get(`/api/projects/${projectId}/donations?tagIds=${tagId}`);
    expect(res.status).toBe(200);
    const items = res.body.items as { id: string }[];
    const untaggedIds = donations.slice(1).map(d => d.id);
    for (const id of untaggedIds) {
      expect(items.find(i => i.id === id)).toBeUndefined();
    }
  });
});

describe("Pool — filtre kombinasyonları", () => {
  it("donationType=kurban + status=active = sadece aktif kurban bağışlar", async () => {
    const res = await get(`/api/projects/${projectId}/donations?donationType=kurban&status=active`);
    expect(res.status).toBe(200);
    const items = res.body.items as { donationType: string; excluded: boolean }[];
    for (const item of items) {
      expect(item.donationType).toBe("kurban");
      expect(item.excluded).toBe(false);
    }
  });

  it("search + donationType kombine filtreleme çalışır", async () => {
    const res = await get(`/api/projects/${projectId}/donations?search=${encodeURIComponent("Ahmet")}&donationType=kurban`);
    expect(res.status).toBe(200);
    const items = res.body.items as { name: string; donationType: string }[];
    for (const item of items) {
      expect(item.donationType).toBe("kurban");
    }
    const foundAhmet = items.some(i => i.name.includes("Ahmet"));
    expect(foundAhmet).toBe(true);
  });
});

describe("Pool — offset pagination", () => {
  it("limit=2 ile sonuç döner, total ve items alanları var", async () => {
    const res = await get(`/api/projects/${projectId}/donations?limit=2`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total");
    expect(res.body.items.length).toBeLessThanOrEqual(2);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.total).toBeGreaterThanOrEqual(donations.length);
  });

  it("offset=0 ve offset=3 sayfaları arasında çakışan kayıt yok", async () => {
    const first = await get(`/api/projects/${projectId}/donations?limit=3&offset=0`);
    expect(first.status).toBe(200);

    if (first.body.total <= 3) return;

    const second = await get(`/api/projects/${projectId}/donations?limit=3&offset=3`);
    expect(second.status).toBe(200);

    const firstIds = (first.body.items as { id: string }[]).map(d => d.id);
    const secondIds = (second.body.items as { id: string }[]).map(d => d.id);
    const overlap = firstIds.filter(id => secondIds.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("tüm sayfalar toplandığında total ile eşleşen sayıda kayıt elde edilir", async () => {
    const pageSize = 2;
    const firstPage = await get(`/api/projects/${projectId}/donations?limit=${pageSize}&offset=0`);
    expect(firstPage.status).toBe(200);

    const total = firstPage.body.total as number;
    expect(total).toBeGreaterThanOrEqual(donations.length);

    const allIds = new Set<string>();
    let offset = 0;
    let iterations = 0;

    while (offset < total && iterations < 20) {
      const res = await get(`/api/projects/${projectId}/donations?limit=${pageSize}&offset=${offset}`);
      expect(res.status).toBe(200);
      const items = res.body.items as { id: string }[];
      for (const item of items) allIds.add(item.id);
      if (items.length === 0) break;
      offset += pageSize;
      iterations++;
    }

    expect(allIds.size).toBe(total);
  });

  it("offset > total ile boş items ve total=0 değil döner", async () => {
    const first = await get(`/api/projects/${projectId}/donations?limit=10&offset=0`);
    const total = first.body.total as number;

    const res = await get(`/api/projects/${projectId}/donations?limit=10&offset=${total + 1000}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
    expect(res.body.total).toBe(total);
  });
});

describe("KA Donations — cursor pagination (nextCursor/hasMore)", () => {
  it("limit=2 ile hasMore=true ve nextCursor döner", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/donations?limit=2`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("hasMore");
    expect(res.body).toHaveProperty("nextCursor");
    expect(Array.isArray(res.body.items)).toBe(true);
    if (res.body.total > 2 || res.body.items.length === 2) {
      expect(res.body.hasMore).toBe(true);
      expect(typeof res.body.nextCursor).toBe("string");
      expect(res.body.nextCursor!.length).toBeGreaterThan(0);
    }
  });

  it("cursor ile sonraki sayfa getirildğinde önceki sayfayla çakışma yok", async () => {
    const first = await get(`/api/kesim-alanlari/${kaId}/donations?limit=2`);
    expect(first.status).toBe(200);

    if (!first.body.hasMore || !first.body.nextCursor) return;

    const second = await get(`/api/kesim-alanlari/${kaId}/donations?limit=2&cursor=${first.body.nextCursor}`);
    expect(second.status).toBe(200);

    const firstIds = (first.body.items as { id: string }[]).map(d => d.id);
    const secondIds = (second.body.items as { id: string }[]).map(d => d.id);

    const overlap = firstIds.filter(id => secondIds.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("cursor ile tüm sayfalar toplandığında tam listeye ulaşılır", async () => {
    const allIds = new Set<string>();
    let cursor: string | null = null;
    let iterations = 0;

    do {
      const url = cursor
        ? `/api/kesim-alanlari/${kaId}/donations?limit=2&cursor=${cursor}`
        : `/api/kesim-alanlari/${kaId}/donations?limit=2`;
      const res = await get(url);
      expect(res.status).toBe(200);
      (res.body.items as { id: string }[]).forEach(d => allIds.add(d.id));
      cursor = res.body.hasMore ? res.body.nextCursor : null;
      iterations++;
    } while (cursor && iterations < 20);

    expect(allIds.size).toBe(donations.length);
    expect(iterations).toBeGreaterThanOrEqual(Math.ceil(donations.length / 2));
  });

  it("geçersiz cursor ile 400 döner", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/donations?cursor=geçersiz_base64_xyz`);
    expect(res.status).toBe(400);
  });
});
