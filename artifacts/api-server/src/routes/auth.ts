import { Router } from "express";
import { z } from "zod";
import { ERROR_MESSAGES } from "../lib/constants";
import { timingSafeCompare, generatePhotoToken } from "../lib/signed-url";

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

  const apiKey = process.env.API_KEY || "";

  if (!apiKey) {
    res.status(503).json({ error: ERROR_MESSAGES.SERVER_CONFIG_ERROR });
    return;
  }

  if (!timingSafeCompare(parsed.data.password, apiKey)) {
    res.status(401).json({ error: ERROR_MESSAGES.WRONG_PASSWORD });
    return;
  }

  res.json({ success: true, apiKey });
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
