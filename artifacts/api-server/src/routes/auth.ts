import { Router } from "express";

const router = Router();

router.post("/auth/login", (req, res) => {
  const { password } = req.body || {};
  const apiKey = process.env.API_KEY || "";

  if (!apiKey) {
    res.status(503).json({ error: "Sunucu yapılandırma hatası." });
    return;
  }

  if (!password || password !== apiKey) {
    res.status(401).json({ error: "Şifre hatalı." });
    return;
  }

  res.json({ success: true, apiKey });
});

export default router;
