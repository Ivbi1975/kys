import { describe, it, expect, beforeAll } from "vitest";
import supertest from "supertest";
import app from "../app";

const API_KEY = process.env.API_KEY!;
const ADMIN_KEY = process.env.ADMIN_KEY ?? "";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "";
const APP_PASSWORD = process.env.APP_PASSWORD ?? "";
const agent = supertest(app);

function apiPost(url: string) {
  const req = agent.post(url).set("X-API-Key", API_KEY);
  if (ADMIN_KEY) req.set("X-Admin-Key", ADMIN_KEY);
  return req;
}
function apiGet(url: string) {
  const req = agent.get(url).set("X-API-Key", API_KEY);
  if (ADMIN_KEY) req.set("X-Admin-Key", ADMIN_KEY);
  return req;
}
function bearerGet(url: string, token: string) {
  const req = agent.get(url).set("Authorization", `Bearer ${token}`);
  if (ADMIN_KEY) req.set("X-Admin-Key", ADMIN_KEY);
  return req;
}

const hasAuthConfig = !!APP_PASSWORD && !!SESSION_SECRET;

describe("POST /api/auth/login", () => {
  it("şifre alanı yokken 400 döner", async () => {
    const res = await apiPost("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("boş şifre ile 400 döner", async () => {
    const res = await apiPost("/api/auth/login").send({ password: "" });
    expect(res.status).toBe(400);
  });

  it.skipIf(!hasAuthConfig)("doğru şifre ile 200 ve geçerli token döner", async () => {
    const res = await apiPost("/api/auth/login").send({ password: APP_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("token");
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(20);
    expect(res.body).toHaveProperty("expiresAt");
    expect(typeof res.body.expiresAt).toBe("number");
    expect(res.body.expiresAt).toBeGreaterThan(Date.now() / 1000);
  });

  it.skipIf(!hasAuthConfig)("dönen token s1.<exp>.<sig> formatındadır", async () => {
    const res = await apiPost("/api/auth/login").send({ password: APP_PASSWORD });
    expect(res.status).toBe(200);
    const parts = res.body.token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("s1");
    expect(Number.isFinite(parseInt(parts[1], 10))).toBe(true);
    expect(parts[2].length).toBeGreaterThan(10);
  });

  it.skipIf(!hasAuthConfig)("yanlış şifre ile 401 döner", async () => {
    const res = await apiPost("/api/auth/login").send({ password: "yanlis_sifre_xyz_XXXX" });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it.skipIf(hasAuthConfig)("şifre ayarlanmamışsa 503 döner", async () => {
    const res = await apiPost("/api/auth/login").send({ password: "herhangi_bir_sifre" });
    expect(res.status).toBe(503);
  });
});

describe("POST /api/auth/logout", () => {
  it("logout 200 ile success döner", async () => {
    const res = await apiPost("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });

  it("token olmadan da logout 200 döner (stateless)", async () => {
    const res = await apiPost("/api/auth/logout");
    expect(res.status).toBe(200);
  });
});

describe("Token doğrulama — session token ile korumalı endpoint erişimi", () => {
  it.skipIf(!hasAuthConfig)("login sonrası dönen token Authorization: Bearer ile korumalı endpoint'i geçer", async () => {
    const loginRes = await apiPost("/api/auth/login").send({ password: APP_PASSWORD });
    expect(loginRes.status).toBe(200);
    const { token } = loginRes.body;

    const protectedRes = await bearerGet("/api/projects", token);
    expect(protectedRes.status).toBe(200);
    expect(Array.isArray(protectedRes.body)).toBe(true);
  });

  it("rastgele sahte Bearer token ile 401 döner", async () => {
    const res = await bearerGet("/api/projects", "s1.9999999999.fakesignaturevalue1234567890abcdef");
    expect(res.status).toBe(401);
  });

  it("süresi dolmuş token ile 401 döner", async () => {
    const expiredToken = "s1.1000000000.fakesignatureexpired1234567890abc";
    const res = await bearerGet("/api/projects", expiredToken);
    expect(res.status).toBe(401);
  });

  it("format yanlış Bearer token ile 401 döner (çok fazla parça)", async () => {
    const res = await bearerGet("/api/projects", "not.a.valid.session.token.format");
    expect(res.status).toBe(401);
  });
});

describe("API Key auth koruması", () => {
  it("X-API-Key olmadan /api/projects 401 döner", async () => {
    const res = await agent.get("/api/projects");
    expect(res.status).toBe(401);
  });

  it("yanlış X-API-Key ile /api/projects 401 döner", async () => {
    const res = await agent.get("/api/projects").set("X-API-Key", "yanlis_key_abc");
    expect(res.status).toBe(401);
  });

  it("doğru X-API-Key ile /api/projects 200 döner", async () => {
    const res = await apiGet("/api/projects");
    expect(res.status).toBe(200);
  });

  it("/api/healthz API key gerektirmez — 200 döner", async () => {
    const res = await agent.get("/api/healthz");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/photo-token", () => {
  it("photo-token endpoint 200 veya 503 döner", async () => {
    const res = await apiGet("/api/photo-token");
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("expiresAt");
    }
  });
});
