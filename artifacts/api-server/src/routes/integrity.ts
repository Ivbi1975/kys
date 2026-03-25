import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

export interface IntegrityIssue {
  type: string;
  severity: "error" | "warning";
  description: string;
  count: number;
  repairable: boolean;
}

export interface IntegrityReport {
  checkedAt: string;
  totalIssues: number;
  issues: IntegrityIssue[];
}

interface CheckResult {
  issue: IntegrityIssue;
  ids: string[];
}

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const orphanDonations = await db.execute(sql`
    SELECT d.id FROM donations d
    LEFT JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ka.id IS NULL AND d.deleted_at IS NULL
  `);
  if (orphanDonations.rows.length > 0) {
    results.push({
      issue: { type: "orphan_donations", severity: "error", description: "Kesim alanı silinmiş veya mevcut olmayan bağışçılar", count: orphanDonations.rows.length, repairable: true },
      ids: orphanDonations.rows.map((r: any) => r.id),
    });
  }

  const orphanGroups = await db.execute(sql`
    SELECT ag.id FROM animal_groups ag
    LEFT JOIN kesim_alanlari ka ON ka.id = ag.kesim_alani_id
    WHERE ka.id IS NULL AND ag.deleted_at IS NULL
  `);
  if (orphanGroups.rows.length > 0) {
    results.push({
      issue: { type: "orphan_groups", severity: "error", description: "Kesim alanı mevcut olmayan hayvan grupları", count: orphanGroups.rows.length, repairable: true },
      ids: orphanGroups.rows.map((r: any) => r.id),
    });
  }

  const brokenLinks = await db.execute(sql`
    SELECT agd.id::text FROM animal_group_donations agd
    LEFT JOIN animal_groups ag ON ag.id = agd.group_id
    LEFT JOIN donations d ON d.id = agd.donation_id
    WHERE ag.id IS NULL OR d.id IS NULL
  `);
  if (brokenLinks.rows.length > 0) {
    results.push({
      issue: { type: "broken_group_donation_links", severity: "error", description: "Grup veya bağışçısı eksik olan grup-bağışçı bağlantıları", count: brokenLinks.rows.length, repairable: true },
      ids: brokenLinks.rows.map((r: any) => String(r.id)),
    });
  }

  const orphanPhotos = await db.execute(sql`
    SELECT p.id FROM animal_group_photos p
    LEFT JOIN animal_groups ag ON ag.id = p.animal_group_id
    WHERE ag.id IS NULL
  `);
  if (orphanPhotos.rows.length > 0) {
    results.push({
      issue: { type: "orphan_photos", severity: "warning", description: "Hayvan grubu mevcut olmayan fotoğraflar", count: orphanPhotos.rows.length, repairable: true },
      ids: orphanPhotos.rows.map((r: any) => r.id),
    });
  }

  const orphanTrackingNotes = await db.execute(sql`
    SELECT tn.id FROM tracking_notes tn
    LEFT JOIN kesim_alanlari ka ON ka.id = tn.kesim_alani_id
    WHERE ka.id IS NULL AND tn.deleted_at IS NULL
  `);
  if (orphanTrackingNotes.rows.length > 0) {
    results.push({
      issue: { type: "orphan_tracking_notes", severity: "warning", description: "Kesim alanı mevcut olmayan takip notları", count: orphanTrackingNotes.rows.length, repairable: true },
      ids: orphanTrackingNotes.rows.map((r: any) => r.id),
    });
  }

  const orphanTeams = await db.execute(sql`
    SELECT t.id FROM teams t
    LEFT JOIN kesim_alanlari ka ON ka.id = t.kesim_alani_id
    WHERE ka.id IS NULL
  `);
  if (orphanTeams.rows.length > 0) {
    results.push({
      issue: { type: "orphan_teams", severity: "warning", description: "Kesim alanı mevcut olmayan ekipler", count: orphanTeams.rows.length, repairable: true },
      ids: orphanTeams.rows.map((r: any) => r.id),
    });
  }

  const brokenTags = await db.execute(sql`
    SELECT dt.id::text FROM donation_tags dt
    LEFT JOIN donations d ON d.id = dt.donation_id
    LEFT JOIN custom_tags ct ON ct.id = dt.tag_id
    WHERE d.id IS NULL OR ct.id IS NULL
  `);
  if (brokenTags.rows.length > 0) {
    results.push({
      issue: { type: "broken_donation_tags", severity: "warning", description: "Bağışçı veya etiketi eksik olan etiket bağlantıları", count: brokenTags.rows.length, repairable: true },
      ids: brokenTags.rows.map((r: any) => String(r.id)),
    });
  }

  const activeDonInDeletedKa = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM donations d
    JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
    WHERE ka.deleted_at IS NOT NULL AND d.deleted_at IS NULL
  `);
  const cnt = (activeDonInDeletedKa.rows[0] as any)?.cnt || 0;
  if (cnt > 0) {
    results.push({
      issue: { type: "active_donations_in_deleted_ka", severity: "warning", description: "Silinmiş kesim alanındaki aktif bağışçılar (KA kalıcı silinince temizlenir)", count: cnt, repairable: false },
      ids: [],
    });
  }

  const duplicates = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM (
      SELECT group_id, donation_id FROM animal_group_donations
      GROUP BY group_id, donation_id HAVING COUNT(*) > 1
    ) sub
  `);
  const dupCnt = (duplicates.rows[0] as any)?.cnt || 0;
  if (dupCnt > 0) {
    results.push({
      issue: { type: "duplicate_group_donations", severity: "error", description: "Aynı bağışçı birden fazla kez aynı gruba atanmış", count: dupCnt, repairable: true },
      ids: [],
    });
  }

  const kaWithDeletedProject = await db.execute(sql`
    SELECT ka.id FROM kesim_alanlari ka
    WHERE ka.project_id IS NOT NULL AND ka.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = ka.project_id AND p.deleted_at IS NULL)
  `);
  if (kaWithDeletedProject.rows.length > 0) {
    results.push({
      issue: { type: "ka_with_deleted_project", severity: "warning", description: "Silinmiş projeye bağlı kesim alanları", count: kaWithDeletedProject.rows.length, repairable: true },
      ids: kaWithDeletedProject.rows.map((r: any) => r.id),
    });
  }

  return results;
}

router.get("/integrity/check", async (_req, res) => {
  try {
    const results = await runChecks();
    const report: IntegrityReport = {
      checkedAt: new Date().toISOString(),
      totalIssues: results.reduce((sum, r) => sum + r.issue.count, 0),
      issues: results.map(r => r.issue),
    };
    res.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("GET /integrity/check error:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/integrity/repair", async (_req, res) => {
  try {
    const results = await runChecks();
    const repairs: { type: string; action: string; count: number }[] = [];

    await db.transaction(async (tx) => {
      for (const r of results) {
        if (!r.issue.repairable) continue;

        switch (r.issue.type) {
          case "orphan_donations":
            if (r.ids.length > 0) {
              await tx.execute(sql`UPDATE donations SET deleted_at = NOW(), updated_at = NOW() WHERE id IN (${sql.join(r.ids.map(id => sql`${id}`), sql`, `)})`);
              repairs.push({ type: r.issue.type, action: "Yetim bağışçılar soft-delete edildi", count: r.issue.count });
            }
            break;
          case "orphan_groups":
            if (r.ids.length > 0) {
              await tx.execute(sql`UPDATE animal_groups SET deleted_at = NOW(), updated_at = NOW() WHERE id IN (${sql.join(r.ids.map(id => sql`${id}`), sql`, `)})`);
              repairs.push({ type: r.issue.type, action: "Yetim hayvan grupları soft-delete edildi", count: r.issue.count });
            }
            break;
          case "broken_group_donation_links":
            if (r.ids.length > 0) {
              await tx.execute(sql`DELETE FROM animal_group_donations WHERE id IN (${sql.join(r.ids.map(id => sql`${parseInt(id)}`), sql`, `)})`);
              repairs.push({ type: r.issue.type, action: "Kırık grup-bağışçı bağlantıları silindi", count: r.issue.count });
            }
            break;
          case "orphan_photos":
            if (r.ids.length > 0) {
              await tx.execute(sql`DELETE FROM animal_group_photos WHERE id IN (${sql.join(r.ids.map(id => sql`${id}`), sql`, `)})`);
              repairs.push({ type: r.issue.type, action: "Yetim fotoğraflar silindi", count: r.issue.count });
            }
            break;
          case "orphan_tracking_notes":
            if (r.ids.length > 0) {
              await tx.execute(sql`DELETE FROM tracking_notes WHERE id IN (${sql.join(r.ids.map(id => sql`${id}`), sql`, `)})`);
              repairs.push({ type: r.issue.type, action: "Yetim takip notları silindi", count: r.issue.count });
            }
            break;
          case "orphan_teams":
            if (r.ids.length > 0) {
              await tx.execute(sql`DELETE FROM teams WHERE id IN (${sql.join(r.ids.map(id => sql`${id}`), sql`, `)})`);
              repairs.push({ type: r.issue.type, action: "Yetim ekipler silindi", count: r.issue.count });
            }
            break;
          case "broken_donation_tags":
            if (r.ids.length > 0) {
              await tx.execute(sql`DELETE FROM donation_tags WHERE id IN (${sql.join(r.ids.map(id => sql`${parseInt(id)}`), sql`, `)})`);
              repairs.push({ type: r.issue.type, action: "Kırık etiket bağlantıları silindi", count: r.issue.count });
            }
            break;
          case "duplicate_group_donations":
            await tx.execute(sql`
              DELETE FROM animal_group_donations WHERE id NOT IN (
                SELECT MIN(id) FROM animal_group_donations GROUP BY group_id, donation_id
              )
            `);
            repairs.push({ type: r.issue.type, action: "Tekrarlanan grup-bağışçı atamaları kaldırıldı", count: r.issue.count });
            break;
          case "ka_with_deleted_project":
            if (r.ids.length > 0) {
              await tx.execute(sql`UPDATE kesim_alanlari SET project_id = NULL, updated_at = NOW() WHERE id IN (${sql.join(r.ids.map(id => sql`${id}`), sql`, `)})`);
              repairs.push({ type: r.issue.type, action: "Silinmiş proje bağlantısı kaldırıldı", count: r.issue.count });
            }
            break;
        }
      }
    });

    const afterResults = await runChecks();

    res.json({
      repairedAt: new Date().toISOString(),
      repairs,
      remainingIssues: afterResults.reduce((sum, r) => sum + r.issue.count, 0),
      remainingDetails: afterResults.map(r => r.issue),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("POST /integrity/repair error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
