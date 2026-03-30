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

const TS = Date.now();
let projectId: string | null = null;
const kaId = `${TEST_PREFIX}-grp-ka-${TS}`;
const groupId = `${TEST_PREFIX}-grp-${TS}`;

afterAll(async () => {
  if (projectId) {
    await del(`/api/kesim-alanlari/${kaId}?permanent=true`);
    await del(`/api/projects/${projectId}`);
  }
});

describe("Groups CRUD", () => {
  it("setup: create project and kesim alanı", async () => {
    const projRes = await post("/api/projects").send({ name: `${TEST_PREFIX} Grp Test Proje` });
    expect(projRes.status).toBe(201);
    projectId = projRes.body.id;

    const kaRes = await post("/api/kesim-alanlari").send({
      id: kaId,
      name: `${TEST_PREFIX} Grp Test KA`,
      projectId,
      donations: [],
      animalGroups: [],
    });
    expect(kaRes.status).toBe(201);
  });

  it("POST /animal-groups creates a group", async () => {
    const res = await post(`/api/kesim-alanlari/${kaId}/animal-groups`).send({
      id: groupId,
      animalNo: 42,
      colorTag: "red",
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
  });

  it("GET /groups returns group list", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/groups`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    const found = res.body.items.find((g: { id: string }) => g.id === groupId);
    expect(found).toBeTruthy();
  });

  it("GET /groups/count returns count", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/groups/count`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("count");
    expect(res.body.count).toBeGreaterThanOrEqual(1);
  });

  it("GET /groups/:groupId returns group detail", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/groups/${groupId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", groupId);
  });

  it("GET /groups/nonexistent returns 404", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/groups/nonexistent_xyz`);
    expect(res.status).toBe(404);
  });

  it("PUT /animal-groups/:groupId updates a group", async () => {
    const res = await put(`/api/kesim-alanlari/${kaId}/animal-groups/${groupId}`).send({
      animalNo: 99,
      colorTag: "blue",
    });
    expect(res.status).toBe(200);
  });

  it("PUT /animal-groups/nonexistent returns 404", async () => {
    const res = await put(`/api/kesim-alanlari/${kaId}/animal-groups/nonexistent_xyz`).send({
      animalNo: 1,
    });
    expect(res.status).toBe(404);
  });

  it("POST /groups/bulk-lock locks groups", async () => {
    const res = await post(`/api/kesim-alanlari/${kaId}/groups/bulk-lock`).send({
      groupIds: [groupId],
      locked: true,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("updated");
    expect(res.body.locked).toBe(true);
  });

  it("POST /groups/bulk-lock with invalid data returns 400", async () => {
    const res = await post(`/api/kesim-alanlari/${kaId}/groups/bulk-lock`).send({});
    expect(res.status).toBe(400);
  });

  it("PUT /animal-groups/bulk does bulk update", async () => {
    const res = await put(`/api/kesim-alanlari/${kaId}/animal-groups/bulk`).send({
      animalGroups: [{ id: groupId, animalNo: 55, colorTag: "green" }],
    });
    expect(res.status).toBe(200);
  });

  it("DELETE /animal-groups/:groupId deletes a group", async () => {
    const tempGroupId = `${TEST_PREFIX}-grp-del-${TS}`;
    await post(`/api/kesim-alanlari/${kaId}/animal-groups`).send({
      id: tempGroupId,
      animalNo: 1,
    });

    const res = await del(`/api/kesim-alanlari/${kaId}/animal-groups/${tempGroupId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });

  it("DELETE /animal-groups/nonexistent returns 404", async () => {
    const res = await del(`/api/kesim-alanlari/${kaId}/animal-groups/nonexistent_xyz`);
    expect(res.status).toBe(404);
  });

  it("GET /groups for nonexistent KA returns 404", async () => {
    const res = await get("/api/kesim-alanlari/nonexistent_ka_xyz/groups");
    expect(res.status).toBe(404);
  });
});
