import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { asyncHandler } from "../middleware/error-handler";
import { timingSafeCompare } from "../lib/signed-url";

const router = Router();

const ADMIN_KEY = process.env.ADMIN_KEY || "";

router.post("/admin/reset-db", asyncHandler(async (req, res) => {
  const provided = req.headers["x-admin-key"] as string | undefined;
  if (!ADMIN_KEY || !provided || !timingSafeCompare(provided, ADMIN_KEY)) {
    res.status(403).json({ error: "Yetkisiz." });
    return;
  }

  const confirm = req.headers["x-confirm-reset"] as string | undefined;
  if (confirm !== "EVET_SIL") {
    res.status(400).json({ error: "x-confirm-reset: EVET_SIL header eksik." });
    return;
  }

  await db.execute(sql`TRUNCATE TABLE animal_group_donations, animal_groups, donation_tags, donations, teams, kesim_alanlari RESTART IDENTITY CASCADE`);

  res.json({ success: true, message: "Tüm veriler silindi." });
}));

export default router;
