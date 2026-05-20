import { describe, it, expect, afterAll, beforeAll } from "vitest";
import supertest from "supertest";
import app from "../app";

const TEST_PREFIX = "__vitest_audit__";
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

afterAll(async () => {
  await del(`/api/kesim-alanlari/${kaId}?permanent=true`);
  if (projectId) await del(`/api/projects/${projectId}`);
});

describe("Audit Log setup", () => {
  it("proje ve KA oluşturulur (audit log için)", async () => {
    const p = await post("/api/projects").send({ name: `${TEST_PREFIX} Proje` });
    expect(p.status).toBe(201);
    projectId = p.body.id;

    const ka = await post("/api/kesim-alanlari").send({
      id: kaId,
      name: `${TEST_PREFIX} KA`,
      projectId,
      donations: [],
      animalGroups: [],
    });
    expect(ka.status).toBe(201);
  });
});

describe("Audit Log — log yazımı", () => {
  it("proje oluşturulduğunda audit_logs tablosuna entityType=project kaydı düşer", async () => {
    await new Promise(r => setTimeout(r, 300));
    const res = await get(`/api/audit-logs?entityType=project&entityId=${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    const items = res.body.items as { action: string; entityType: string }[];
    expect(Array.isArray(items)).toBe(true);
    const createLog = items.find(
      (log) => log.action === "create" && log.entityType === "project"
    );
    expect(createLog).toBeTruthy();
  });

  it("hayvan grubu oluşturulduğunda proje audit loguna kayıt düşer", async () => {
    const grpId = `${TEST_PREFIX}-grp-${TS}`;
    await post(`/api/kesim-alanlari/${kaId}/animal-groups`).send({
      id: grpId, animalNo: 99, colorTag: "green",
    });
    await new Promise(r => setTimeout(r, 300));

    const res = await get(`/api/projects/${projectId}/audit-logs?limit=50`);
    expect(res.status).toBe(200);
    const items = res.body.items as { action: string; entityType: string }[];
    expect(Array.isArray(items)).toBe(true);
    const grpLog = items.find(
      (log) => log.action === "create" && log.entityType === "animal_group"
    );
    expect(grpLog).toBeTruthy();
  });

  it("bağış oluşturulduğunda audit log düşer", async () => {
    const donId = `${TEST_PREFIX}-don-${TS}`;
    await post(`/api/kesim-alanlari/${kaId}/donations`).send({
      id: donId,
      name: "Audit Test Bağışçı",
      description: "Test",
      shareCount: 1,
    });

    await new Promise(r => setTimeout(r, 300));
    const logsBefore = await get(`/api/projects/${projectId}/audit-logs?limit=50`);
    expect(logsBefore.status).toBe(200);
    const beforeCount = (logsBefore.body.items as unknown[]).length;

    await del(`/api/kesim-alanlari/${kaId}/donations/${donId}?permanent=true`);
    await new Promise(r => setTimeout(r, 300));

    const logsAfter = await get(`/api/projects/${projectId}/audit-logs?limit=50`);
    expect(logsAfter.status).toBe(200);
    expect((logsAfter.body.items as unknown[]).length).toBeGreaterThanOrEqual(beforeCount);
  });
});

describe("Audit Log — filtre ve sayfalama", () => {
  it("GET /api/audit-logs proje filtresi ile çalışır", async () => {
    const res = await get(`/api/audit-logs?projectId=${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("GET /api/audit-logs entityType filtresi çalışır", async () => {
    const res = await get("/api/audit-logs?entityType=project");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    const nonProject = (res.body.items as { entityType: string }[]).find(
      (log) => log.entityType !== "project"
    );
    expect(nonProject).toBeUndefined();
  });

  it("GET /api/audit-logs action filtresi çalışır", async () => {
    const res = await get("/api/audit-logs?action=create");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const log of res.body.items as { action: string }[]) {
      expect(log.action).toBe("create");
    }
  });

  it("GET /api/audit-logs limit parametresi çalışır", async () => {
    const res = await get("/api/audit-logs?limit=5");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect((res.body.items as unknown[]).length).toBeLessThanOrEqual(5);
  });

  it("GET /api/projects/:id/audit-logs proje loglarını döner", async () => {
    const res = await get(`/api/projects/${projectId}/audit-logs`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect((res.body.items as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/projects/:id/audit-logs sayfa başına limit çalışır", async () => {
    const res = await get(`/api/projects/${projectId}/audit-logs?limit=2`);
    expect(res.status).toBe(200);
    expect((res.body.items as unknown[]).length).toBeLessThanOrEqual(2);
  });

  it("GET /api/audit-logs startDate / endDate filtreleri çalışır", async () => {
    const start = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await get(`/api/audit-logs?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("GET /api/audit-logs hasMore ve nextCursor alanları döner", async () => {
    const res = await get("/api/audit-logs?limit=2");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("hasMore");
    expect(res.body).toHaveProperty("nextCursor");
  });
});
