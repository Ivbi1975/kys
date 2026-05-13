import { Router } from "express";
import { z } from "zod";
import { ERROR_MESSAGES } from "../lib/constants";
import { timingSafeCompare, generatePhotoToken } from "../lib/signed-url";
import { issueSessionToken } from "../lib/session-token";

const router = Router();

const loginSchema = z.object({
  password: z.string().min(1, "Şifre gerekli"),
});

router.post("/auth/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA, details: parsed.error.issues });
    return;
  }

  const appPassword = process.env.APP_PASSWORD || "";
  const sessionSecret = process.env.SESSION_SECRET || "";

  if (!appPassword || !sessionSecret) {
    res.status(503).json({ error: ERROR_MESSAGES.SERVER_CONFIG_ERROR });
    return;
  }

  if (!timingSafeCompare(parsed.data.password, appPassword)) {
    res.status(401).json({ error: ERROR_MESSAGES.WRONG_PASSWORD });
    return;
  }

  const { token, expiresAt } = issueSessionToken(sessionSecret);
  res.json({ success: true, token, expiresAt });
});

// Stateless logout — session tokens are signed and self-contained, so logout is
// enforced by the client discarding the token. We acknowledge the request so
// generated clients can call this endpoint safely.
router.post("/auth/logout", (_req, res) => {
  res.json({ success: true });
});

router.get("/photo-token", (req, res) => {
  const apiKey = process.env.API_KEY || "";
  if (!apiKey) {
    res.status(503).json({ error: ERROR_MESSAGES.SERVER_CONFIG_ERROR });
    return;
  }

  const { token, expiresAt } = generatePhotoToken(apiKey);
  res.json({ token, expiresAt });
});

export default router;
