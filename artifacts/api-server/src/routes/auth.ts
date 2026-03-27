import { Router } from "express";
import { z } from "zod";

const router = Router();

const loginSchema = z.object({
  password: z.string().min(1, "Şifre gerekli"),
});

router.post("/auth/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Geçersiz veri", details: parsed.error.issues });
    return;
  }

  const apiKey = process.env.API_KEY || "";

  if (!apiKey) {
    res.status(503).json({ error: "Sunucu yapılandırma hatası." });
    return;
  }

  if (parsed.data.password !== apiKey) {
    res.status(401).json({ error: "Şifre hatalı." });
    return;
  }

  res.json({ success: true, apiKey });
});

export default router;
