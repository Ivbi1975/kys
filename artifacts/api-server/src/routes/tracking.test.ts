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
function del(url: string) {
  return agent.delete(url).set("X-API-Key", API_KEY);
}

const TS = Date.now();
let projectId: string | null = null;
const kaId = `${TEST_PREFIX}-trk-ka-${TS}`;
const groupId = `${TEST_PREFIX}-trk-grp-${TS}`;
let trackingToken: string | null = null;

afterAll(async () => {
  if (projectId) {
    await del(`/api/kesim-alanlari/${kaId}?permanent=true`);
    await del(`/api/projects/${projectId}`);
  }
});

describe("Tracking endpoints", () => {
  it("setup: create project, KA, and group", async () => {
    const projRes = await post("/api/projects").send({ name: `${TEST_PREFIX} Trk Test Proje` });
    expect(projRes.status).toBe(201);
    projectId = projRes.body.id;

    const kaRes = await post("/api/kesim-alanlari").send({
      id: kaId,
      name: `${TEST_PREFIX} Trk Test KA`,
      projectId,
      donations: [],
      animalGroups: [],
    });
    expect(kaRes.status).toBe(201);

    const grpRes = await post(`/api/kesim-alanlari/${kaId}/animal-groups`).send({
      id: groupId,
      animalNo: 10,
    });
    expect(grpRes.status).toBe(201);
  });

  it("POST /generate-tracking-token creates a token", async () => {
    const res = await post(`/api/kesim-alanlari/${kaId}/generate-tracking-token`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("trackingToken");
    expect(typeof res.body.trackingToken).toBe("string");
    trackingToken = res.body.trackingToken;
  });

  it("GET /tracking/:token returns tracking page data", async () => {
    expect(trackingToken).toBeTruthy();
    const res = await get(`/api/tracking/${trackingToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe("object");
    expect(Object.keys(res.body).length).toBeGreaterThan(0);
  });

  it("GET /tracking/invalid-token returns 404", async () => {
    const res = await get("/api/tracking/nonexistent_token_xyz");
    expect(res.status).toBe(404);
  });

  it("GET /tracking/:token/delta without since returns 400", async () => {
    expect(trackingToken).toBeTruthy();
    const res = await get(`/api/tracking/${trackingToken}/delta`);
    expect(res.status).toBe(400);
  });

  it("GET /tracking/:token/delta with invalid since returns 400", async () => {
    expect(trackingToken).toBeTruthy();
    const res = await get(`/api/tracking/${trackingToken}/delta?since=not-a-date`);
    expect(res.status).toBe(400);
  });

  it("GET /tracking/:token/delta with valid since returns data", async () => {
    expect(trackingToken).toBeTruthy();
    const since = new Date(Date.now() - 60000).toISOString();
    const res = await get(`/api/tracking/${trackingToken}/delta?since=${since}`);
    expect(res.status).toBe(200);
  });

  it("GET /tracking/:token/notes returns notes array", async () => {
    expect(trackingToken).toBeTruthy();
    const res = await get(`/api/tracking/${trackingToken}/notes`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /tracking/:token/notes creates a note", async () => {
    expect(trackingToken).toBeTruthy();
    const res = await post(`/api/tracking/${trackingToken}/notes`).send({
      type: "note",
      content: "Test tracking note",
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
  });

  it("POST /tracking/:token/notes with invalid type returns 400", async () => {
    expect(trackingToken).toBeTruthy();
    const res = await post(`/api/tracking/${trackingToken}/notes`).send({
      type: "invalid_type",
      content: "Test",
    });
    expect(res.status).toBe(400);
  });

  it("GET /kesim-alanlari/:id/tracking-notes returns notes", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/tracking-notes`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /kesim-alanlari/:id/dashboard returns dashboard data", async () => {
    const res = await get(`/api/kesim-alanlari/${kaId}/dashboard`);
    expect(res.status).toBe(200);
  });

  it("GET /dashboard for nonexistent KA returns 404", async () => {
    const res = await get("/api/kesim-alanlari/nonexistent_ka_xyz/dashboard");
    expect(res.status).toBe(404);
  });
});
