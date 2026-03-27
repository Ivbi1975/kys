import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { asyncHandler } from "../middleware/error-handler";

const router: IRouter = Router();

const CURSOR_BATCH = 500;

function escapeCsvField(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

const CSV_HEADERS = [
  "Kesim Alanı",
  "Bağışçı Adı",
  "Açıklama",
  "Bağış Türü",
  "Hisse Sayısı",
  "Vekalet",
  "Notlar",
  "Telefon",
  "Hariç Tutulan",
  "Hayvan No",
  "Renk Etiketi",
  "Kesildi",
  "Kesildi Tarihi",
  "Ekip",
];

router.get("/export/csv", asyncHandler(async (req, res) => {
  const kaId = req.query.kaId as string | undefined;

  const client = await pool.connect();
  try {
    const countQuery = kaId
      ? `SELECT count(*)::int AS total FROM donations d JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id WHERE d.deleted_at IS NULL AND ka.id = $1`
      : `SELECT count(*)::int AS total FROM donations d JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id WHERE d.deleted_at IS NULL AND ka.deleted_at IS NULL`;
    const countParams = kaId ? [kaId] : [];
    const countResult = await client.query(countQuery, countParams);
    const totalRows = countResult.rows[0]?.total ?? 0;

    const filename = kaId
      ? `bagisci_listesi_${kaId}_${new Date().toISOString().split("T")[0]}.csv`
      : `tum_bagiscilar_${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Total-Rows", String(totalRows));
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Access-Control-Expose-Headers", "X-Total-Rows, X-Rows-Sent");

    const bom = "\uFEFF";
    res.write(bom + CSV_HEADERS.map(escapeCsvField).join(",") + "\n");

    const cursorName = "export_cursor_" + Date.now();
    const cursorQuery = kaId
      ? `DECLARE ${cursorName} CURSOR FOR
         SELECT
           ka.name AS ka_name,
           d.name, d.description, d.donation_type, d.share_count,
           d.vekalet, d.notes, d.phone, d.excluded,
           ag.animal_no, ag.color_tag, ag.kesildi, ag.kesildi_at,
           t.name AS team_name
         FROM donations d
         JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
         LEFT JOIN animal_group_donations agd ON agd.donation_id = d.id
         LEFT JOIN animal_groups ag ON ag.id = agd.group_id
         LEFT JOIN teams t ON t.id = ag.team_id
         WHERE d.deleted_at IS NULL AND ka.id = $1
         ORDER BY ka.name, d.sort_order`
      : `DECLARE ${cursorName} CURSOR FOR
         SELECT
           ka.name AS ka_name,
           d.name, d.description, d.donation_type, d.share_count,
           d.vekalet, d.notes, d.phone, d.excluded,
           ag.animal_no, ag.color_tag, ag.kesildi, ag.kesildi_at,
           t.name AS team_name
         FROM donations d
         JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
         LEFT JOIN animal_group_donations agd ON agd.donation_id = d.id
         LEFT JOIN animal_groups ag ON ag.id = agd.group_id
         LEFT JOIN teams t ON t.id = ag.team_id
         WHERE d.deleted_at IS NULL AND ka.deleted_at IS NULL
         ORDER BY ka.name, d.sort_order`;

    await client.query("BEGIN");
    await client.query(cursorQuery, kaId ? [kaId] : []);

    let rowsSent = 0;
    let hasMore = true;
    let clientDisconnected = false;

    res.on("close", () => { clientDisconnected = true; });

    while (hasMore && !clientDisconnected) {
      const batch = await client.query(`FETCH ${CURSOR_BATCH} FROM ${cursorName}`);
      if (batch.rows.length === 0) {
        hasMore = false;
        break;
      }

      let chunk = "";
      for (const row of batch.rows) {
        const fields = [
          row.ka_name || "",
          row.name || "",
          row.description || "",
          row.donation_type || "",
          String(row.share_count ?? 1),
          row.vekalet || "",
          row.notes || "",
          row.phone || "",
          row.excluded ? "Evet" : "Hayır",
          row.animal_no != null ? String(row.animal_no) : "",
          row.color_tag || "",
          row.kesildi ? "Evet" : "Hayır",
          row.kesildi_at ? new Date(row.kesildi_at).toLocaleDateString("tr-TR") : "",
          row.team_name || "",
        ];
        chunk += fields.map(escapeCsvField).join(",") + "\n";
        rowsSent++;
      }

      const canContinue = res.write(chunk);
      if (!canContinue) {
        await new Promise<void>((resolve) => res.once("drain", resolve));
      }

      if (batch.rows.length < CURSOR_BATCH) {
        hasMore = false;
      }
    }

    await client.query(`CLOSE ${cursorName}`);
    await client.query("COMMIT");

    res.end();
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    if (!res.headersSent) {
      throw err;
    } else {
      res.end();
    }
  } finally {
    client.release();
  }
}));

router.get("/export/count", asyncHandler(async (req, res) => {
  const kaId = req.query.kaId as string | undefined;
  const client = await pool.connect();
  try {
    const query = kaId
      ? `SELECT count(*)::int AS total FROM donations WHERE deleted_at IS NULL AND kesim_alani_id = $1`
      : `SELECT count(*)::int AS total FROM donations d JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id WHERE d.deleted_at IS NULL AND ka.deleted_at IS NULL`;
    const params = kaId ? [kaId] : [];
    const result = await client.query(query, params);
    res.json({ total: result.rows[0]?.total ?? 0 });
  } finally {
    client.release();
  }
}));

export default router;
