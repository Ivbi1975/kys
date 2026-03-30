import { describe, it, expect, afterAll } from "vitest";
import supertest from "supertest";
import app from "../app";

const TEST_PREFIX = "__vitest__";
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

let createdProjectId: string | null = null;
let createdKesimAlaniId: string | null = null;
let createdDonationId: string | null = null;

afterAll(async () => {
  if (createdDonationId && createdKesimAlaniId) {
    await del(`/api/kesim-alanlari/${createdKesimAlaniId}/donations/${createdDonationId}?permanent=true`);
  }
  if (createdKesimAlaniId) {
    await del(`/api/kesim-alanlari/${createdKesimAlaniId}?permanent=true`);
  }
  if (createdProjectId) {
    await del(`/api/projects/${createdProjectId}`);
  }
});

describe("Health endpoint", () => {
  it("GET /api/healthz returns 200", async () => {
    const res = await get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });
});

describe("Projects CRUD", () => {
  it("POST /api/projects creates a project", async () => {
    const res = await post("/api/projects").send({ name: `${TEST_PREFIX} Test Proje` });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.name).toBe(`${TEST_PREFIX} Test Proje`);
    createdProjectId = res.body.id;
  });

  it("GET /api/projects returns project list", async () => {
    const res = await get("/api/projects");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("PUT /api/projects/:id updates project name", async () => {
    expect(createdProjectId).toBeTruthy();
    const res = await put(`/api/projects/${createdProjectId}`).send({ name: `${TEST_PREFIX} Updated Proje` });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(`${TEST_PREFIX} Updated Proje`);
  });

  it("PUT /api/projects/:id with invalid data returns 400", async () => {
    expect(createdProjectId).toBeTruthy();
    const res = await put(`/api/projects/${createdProjectId}`).send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("PUT /api/projects/nonexistent returns 404", async () => {
    const res = await put("/api/projects/nonexistent_id_xyz").send({ name: "Test" });
    expect(res.status).toBe(404);
  });

  it("POST /api/projects with empty name returns 400", async () => {
    const res = await post("/api/projects").send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("DELETE /api/projects/:id soft-deletes project", async () => {
    const createRes = await post("/api/projects").send({ name: `${TEST_PREFIX} ToDelete` });
    expect(createRes.status).toBe(201);
    const tempId = createRes.body.id;

    const deleteRes = await del(`/api/projects/${tempId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toHaveProperty("success", true);

    const deletedRes = await get("/api/projects/deleted");
    expect(deletedRes.status).toBe(200);
    const found = deletedRes.body.find((p: { id: string }) => p.id === tempId);
    expect(found).toBeTruthy();
  });

  it("GET /api/projects without API key returns 401", async () => {
    const res = await agent.get("/api/projects");
    expect(res.status).toBe(401);
  });
});

describe("Kesim Alanları CRUD", () => {
  it("POST /api/kesim-alanlari creates a kesim alanı", async () => {
    const kaId = `${TEST_PREFIX}-ka-${Date.now()}`;
    const res = await post("/api/kesim-alanlari").send({
      id: kaId,
      name: `${TEST_PREFIX} Test KA`,
      projectId: createdProjectId,
      donations: [],
      animalGroups: [],
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id", kaId);
    createdKesimAlaniId = kaId;
  });

  it("GET /api/kesim-alanlari returns list", async () => {
    const res = await get("/api/kesim-alanlari");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/kesim-alanlari/:id returns single item", async () => {
    expect(createdKesimAlaniId).toBeTruthy();
    const res = await get(`/api/kesim-alanlari/${createdKesimAlaniId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", createdKesimAlaniId);
  });

  it("GET /api/kesim-alanlari/nonexistent returns 404", async () => {
    const res = await get("/api/kesim-alanlari/does_not_exist_xyz");
    expect(res.status).toBe(404);
  });

  it("PUT /api/kesim-alanlari/:id updates kesim alanı", async () => {
    expect(createdKesimAlaniId).toBeTruthy();
    const res = await put(`/api/kesim-alanlari/${createdKesimAlaniId}`).send({ name: `${TEST_PREFIX} Updated KA` });
    expect(res.status).toBe(200);
  });

  it("POST /api/kesim-alanlari with missing name returns 400", async () => {
    const res = await post("/api/kesim-alanlari").send({ id: "test-bad" });
    expect(res.status).toBe(400);
  });
});

describe("Donations CRUD", () => {
  it("POST creates a donation", async () => {
    expect(createdKesimAlaniId).toBeTruthy();
    const donationId = `${TEST_PREFIX}-don-${Date.now()}`;
    const res = await post(`/api/kesim-alanlari/${createdKesimAlaniId}/donations`).send({
      id: donationId,
      name: "Test Bağışçı",
      description: "Test Açıklama",
      donationType: "kurban",
      shareCount: 1,
    });
    expect(res.status).toBe(201);
    createdDonationId = donationId;
  });

  it("GET lists donations", async () => {
    expect(createdKesimAlaniId).toBeTruthy();
    const res = await get(`/api/kesim-alanlari/${createdKesimAlaniId}/donations`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("GET /count returns donation count", async () => {
    expect(createdKesimAlaniId).toBeTruthy();
    const res = await get(`/api/kesim-alanlari/${createdKesimAlaniId}/donations/count`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("count");
    expect(typeof res.body.count).toBe("number");
  });

  it("PUT updates a donation", async () => {
    expect(createdKesimAlaniId).toBeTruthy();
    expect(createdDonationId).toBeTruthy();
    const res = await put(`/api/kesim-alanlari/${createdKesimAlaniId}/donations/${createdDonationId}`).send({ name: "Updated Bağışçı" });
    expect(res.status).toBe(200);
  });

  it("PUT to nonexistent donation returns 404", async () => {
    expect(createdKesimAlaniId).toBeTruthy();
    const res = await put(`/api/kesim-alanlari/${createdKesimAlaniId}/donations/nonexistent_xyz`).send({ name: "Ghost" });
    expect(res.status).toBe(404);
  });

  it("DELETE soft-deletes a donation", async () => {
    expect(createdKesimAlaniId).toBeTruthy();
    const tempId = `${TEST_PREFIX}-don-del-${Date.now()}`;
    await post(`/api/kesim-alanlari/${createdKesimAlaniId}/donations`).send({ id: tempId, name: "ToDelete", description: "x" });

    const delRes = await del(`/api/kesim-alanlari/${createdKesimAlaniId}/donations/${tempId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body).toHaveProperty("success", true);
  });

  it("GET /deleted lists soft-deleted donations", async () => {
    expect(createdKesimAlaniId).toBeTruthy();
    const res = await get(`/api/kesim-alanlari/${createdKesimAlaniId}/donations/deleted`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /restore restores a soft-deleted donation", async () => {
    expect(createdKesimAlaniId).toBeTruthy();
    const tempId = `${TEST_PREFIX}-don-restore-${Date.now()}`;
    await post(`/api/kesim-alanlari/${createdKesimAlaniId}/donations`).send({ id: tempId, name: "ToRestore", description: "y" });
    await del(`/api/kesim-alanlari/${createdKesimAlaniId}/donations/${tempId}`);

    const restoreRes = await post(`/api/kesim-alanlari/${createdKesimAlaniId}/donations/${tempId}/restore`);
    expect(restoreRes.status).toBe(200);

    await del(`/api/kesim-alanlari/${createdKesimAlaniId}/donations/${tempId}?permanent=true`);
  });
});
