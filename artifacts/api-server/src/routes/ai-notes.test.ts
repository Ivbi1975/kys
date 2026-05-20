import { describe, it, expect, afterAll, beforeAll } from "vitest";
import supertest from "supertest";
import app from "../app";

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

describe("AI Notes — Settings", () => {
  it("GET /api/ai-notes/settings prompt ve categories döner", async () => {
    const res = await get("/api/ai-notes/settings");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("prompt");
    expect(typeof res.body.prompt).toBe("string");
    expect(res.body.prompt.length).toBeGreaterThan(10);
    expect(res.body).toHaveProperty("categories");
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(res.body.categories.length).toBeGreaterThan(0);
  });

  it("PUT /api/ai-notes/settings kategorileri günceller", async () => {
    const current = await get("/api/ai-notes/settings");
    const originalCategories = current.body.categories as string[];

    const newCats = [...originalCategories, "__test_cat__"];
    const res = await put("/api/ai-notes/settings").send({ categories: newCats });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const verify = await get("/api/ai-notes/settings");
    expect(verify.body.categories).toContain("__test_cat__");

    await put("/api/ai-notes/settings").send({ categories: originalCategories });
  });

  it("PUT /api/ai-notes/settings kategoriler geri alınır", async () => {
    const before = await get("/api/ai-notes/settings");
    const cats = before.body.categories as string[];

    await put("/api/ai-notes/settings").send({ categories: [...cats, "__temp__"] });
    await put("/api/ai-notes/settings").send({ categories: cats });

    const after = await get("/api/ai-notes/settings");
    expect(after.body.categories).not.toContain("__temp__");
  });

  it("PUT /api/ai-notes/settings geçersiz payload ile 400 döner", async () => {
    const res = await put("/api/ai-notes/settings").send({ categories: "not-an-array" });
    expect(res.status).toBe(400);
  });
});

describe("AI Notes — /classify (deprecated)", () => {
  it("POST /api/ai-notes/classify 410 Gone döner", async () => {
    const res = await post("/api/ai-notes/classify").send({
      donations: [{ id: "test", name: "Test", donationType: "kurban", notes: "Test notu" }],
    });
    expect(res.status).toBe(410);
    expect(res.body).toHaveProperty("asyncEndpoint");
  });
});

describe("AI Notes — classify-async payload validation", () => {
  it("boş donations dizisi ile 400 döner", async () => {
    const res = await post("/api/ai-notes/classify-async").send({ donations: [] });
    expect(res.status).toBe(400);
  });

  it("donations alanı yok ise 400 döner", async () => {
    const res = await post("/api/ai-notes/classify-async").send({});
    expect(res.status).toBe(400);
  });

  it("donations number ise 400 döner", async () => {
    const res = await post("/api/ai-notes/classify-async").send({ donations: 42 });
    expect(res.status).toBe(400);
  });
});

describe("AI Notes — classify-async job oluşturma", () => {
  it("OpenAI entegrasyonu varsa 202 ve jobId döner; yoksa 503 döner", async () => {
    const res = await post("/api/ai-notes/classify-async").send({
      donations: [
        { id: "test-don-1", name: "Test Bağışçı", donationType: "kurban", notes: "Test notu", vekalet: "" },
      ],
    });

    expect([202, 503]).toContain(res.status);

    if (res.status === 202) {
      expect(res.body).toHaveProperty("jobId");
      expect(typeof res.body.jobId).toBe("string");
      expect(res.body).toHaveProperty("status");
      expect(res.body).toHaveProperty("totalDonations", 1);
    } else {
      expect(res.body).toHaveProperty("error");
    }
  });
});

describe("AI Notes — job durum sorgulama", () => {
  let createdJobId: string | null = null;

  beforeAll(async () => {
    const res = await post("/api/ai-notes/classify-async").send({
      donations: [{ id: "j-test-1", name: "Job Test Bağışçı", donationType: "kurban", notes: "Notu var" }],
    });
    if (res.status === 202) {
      createdJobId = res.body.jobId;
    }
  });

  it("geçersiz jobId ile 404 döner", async () => {
    const res = await get("/api/ai-notes/jobs/nonexistent-job-xyz");
    expect(res.status).toBe(404);
  });

  it("oluşturulan job ID ile status sorgulanabilir (OpenAI varsa)", async () => {
    if (!createdJobId) return;

    const res = await get(`/api/ai-notes/jobs/${createdJobId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("jobId", createdJobId);
    expect(res.body).toHaveProperty("status");
    const validStatuses = ["pending", "running", "queued", "processing", "done", "completed", "failed", "cancelled"];
    expect(validStatuses).toContain(res.body.status);
    expect(res.body).toHaveProperty("totalDonations");
    expect(typeof res.body.totalDonations).toBe("number");
  });

  it("oluşturulan job iptal edilebilir (OpenAI varsa)", async () => {
    if (!createdJobId) return;

    const res = await post(`/api/ai-notes/jobs/${createdJobId}/cancel`);
    expect([200, 409]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty("success", true);
    }
  });

  it("iptal sonrası job durumu cancelled veya done olur (OpenAI varsa)", async () => {
    if (!createdJobId) return;

    const res = await get(`/api/ai-notes/jobs/${createdJobId}`);
    expect(res.status).toBe(200);
    expect(["cancelled", "done", "completed", "failed"]).toContain(res.body.status);
  });
});

afterAll(async () => {
  const current = await get("/api/ai-notes/settings");
  if (current.status !== 200) return;
  const cats = (current.body.categories as string[]).filter((c: string) => c !== "__test_cat__" && c !== "__temp__");
  await put("/api/ai-notes/settings").send({ categories: cats }).catch(() => {});
});
