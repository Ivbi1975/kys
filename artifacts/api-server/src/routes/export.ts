import { Router, type IRouter } from "express";
import ExcelJS from "exceljs";
import { pool } from "@workspace/db";
import { asyncHandler } from "../middleware/error-handler";
import { CURSOR_BATCH_SIZE } from "../lib/constants";

const router: IRouter = Router();

function escapeCsvField(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function trUpperCase(text: string | null | undefined): string {
  if (!text) return "";
  return text.toLocaleUpperCase("tr-TR");
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
      const batch = await client.query(`FETCH ${CURSOR_BATCH_SIZE} FROM ${cursorName}`);
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

      if (batch.rows.length < CURSOR_BATCH_SIZE) {
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

const EXCEL_HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
const EXCEL_HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const EXCEL_HAYVAN_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
const EXCEL_HAYVAN_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF1E3A5F" }, size: 18 };
const EXCEL_EVEN_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
const THIN_BORDER: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF9CA3AF" } };
const CELL_BORDER: Partial<ExcelJS.Borders> = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
const MEDIUM_BORDER: Partial<ExcelJS.Border> = { style: "medium" };
const HAYVAN_BORDER: Partial<ExcelJS.Borders> = { top: MEDIUM_BORDER, bottom: MEDIUM_BORDER, left: MEDIUM_BORDER, right: MEDIUM_BORDER };

const EXCEL_COLUMNS: { key: string; header: string; width: number }[] = [
  { key: "kesimListeId", header: "Kesim Listesi ID", width: 18 },
  { key: "hayvanNo", header: "HAYVAN", width: 12 },
  { key: "sira", header: "SIRA", width: 8 },
  { key: "vekalet", header: "VEKALET", width: 16 },
  { key: "vekaleti_veren", header: "VEKALETİ VEREN", width: 28 },
  { key: "adina_kesilen", header: "ADINA KESİLEN", width: 28 },
  { key: "cinsi", header: "CİNSİ", width: 14 },
  { key: "notlar", header: "NOTLAR", width: 22 },
];

router.get("/export/excel", asyncHandler(async (req, res) => {
  const kaId = req.query.kaId as string | undefined;
  if (!kaId) {
    res.status(400).json({ error: "kaId parametresi gerekli" });
    return;
  }

  const client = await pool.connect();
  try {
    const kaResult = await client.query(
      `SELECT name, kesim_liste_id FROM kesim_alanlari WHERE id = $1 AND deleted_at IS NULL`,
      [kaId],
    );
    if (kaResult.rows.length === 0) {
      res.status(404).json({ error: "Kesim alanı bulunamadı" });
      return;
    }
    const kaName = kaResult.rows[0].name as string;
    const kesimListeId = (kaResult.rows[0].kesim_liste_id || "") as string;

    const countResult = await client.query(
      `SELECT count(*)::int AS total
       FROM animal_groups ag
       WHERE ag.kesim_alani_id = $1 AND ag.deleted_at IS NULL`,
      [kaId],
    );
    const totalGroups = countResult.rows[0]?.total ?? 0;

    const safeName = kaName.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ _-]/g, "").replace(/\s+/g, "_");
    const filename = `${safeName}_kesim_kagidi.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("X-Total-Groups", String(totalGroups));
    res.setHeader("Access-Control-Expose-Headers", "X-Total-Groups");

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
    const ws = workbook.addWorksheet("Kesim Kağıdı");

    ws.columns = EXCEL_COLUMNS.map(c => ({ key: c.key, width: c.width }));

    const titleRow = ws.addRow([kaName]);
    titleRow.font = { bold: true, size: 16, color: { argb: "FF1E3A5F" } };
    titleRow.alignment = { horizontal: "center", vertical: "middle" };
    titleRow.height = 30;
    ws.mergeCells(1, 1, 1, EXCEL_COLUMNS.length);

    ws.addRow([]);

    const headerRow = ws.addRow(EXCEL_COLUMNS.map(c => c.header));
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.fill = EXCEL_HEADER_FILL;
      cell.font = EXCEL_HEADER_FONT;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = CELL_BORDER;
    });

    await client.query("BEGIN");

    const cursorName = "excel_cursor_" + Date.now();
    await client.query(
      `DECLARE ${cursorName} CURSOR FOR
       SELECT
         ag.animal_no,
         d.name, d.description, d.donation_type, d.vekalet, d.notes,
         d.ai_categories, d.ai_warnings,
         agd.sort_order AS slot_order
       FROM animal_groups ag
       JOIN animal_group_donations agd ON agd.group_id = ag.id
       JOIN donations d ON d.id = agd.donation_id AND d.deleted_at IS NULL
       WHERE ag.kesim_alani_id = $1 AND ag.deleted_at IS NULL
       ORDER BY ag.sort_order, ag.animal_no, agd.sort_order`,
      [kaId],
    );

    let clientDisconnected = false;
    res.on("close", () => { clientDisconnected = true; });

    let hasMore = true;
    let currentAnimalNo: number | null = null;
    let animalStartRow = 4;
    let donationIdx = 0;
    let dataRowNum = 4;

    while (hasMore && !clientDisconnected) {
      const batch = await client.query(`FETCH ${CURSOR_BATCH_SIZE} FROM ${cursorName}`);
      if (batch.rows.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of batch.rows) {
        const animalNo = row.animal_no as number;

        if (currentAnimalNo !== null && animalNo !== currentAnimalNo) {
          if (donationIdx > 1 && animalStartRow < dataRowNum) {
            ws.mergeCells(animalStartRow, 2, dataRowNum - 1, 2);
          }
          animalStartRow = dataRowNum;
          donationIdx = 0;
        }

        currentAnimalNo = animalNo;

        const aiParts: string[] = [];
        if (row.ai_categories && Array.isArray(row.ai_categories) && row.ai_categories.length > 0) {
          aiParts.push(row.ai_categories.join(", "));
        }
        if (row.ai_warnings && String(row.ai_warnings).trim()) {
          aiParts.push(`⚠ ${String(row.ai_warnings).trim()}`);
        }
        const notesVal = row.notes || "";
        const aiLabel = aiParts.length > 0 ? aiParts.join(" | ") : "";
        const fullNotes = aiLabel ? (notesVal ? `${notesVal} [${aiLabel}]` : `[${aiLabel}]`) : notesVal;

        const dataRow = ws.addRow({
          kesimListeId,
          hayvanNo: donationIdx === 0 ? animalNo : "",
          sira: donationIdx + 1,
          vekalet: row.vekalet || "",
          vekaleti_veren: trUpperCase(row.description),
          adina_kesilen: trUpperCase(row.name),
          cinsi: trUpperCase(row.donation_type),
          notlar: trUpperCase(fullNotes),
        });

        dataRow.height = 20;
        const isEven = donationIdx % 2 === 1;

        dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = CELL_BORDER;
          cell.alignment = { vertical: "middle" };

          if (colNumber === 2 && donationIdx === 0) {
            cell.fill = EXCEL_HAYVAN_FILL;
            cell.font = EXCEL_HAYVAN_FONT;
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = HAYVAN_BORDER;
          } else if (colNumber === 3) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.font = { bold: true };
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          } else if (colNumber === 6) {
            cell.font = { bold: true };
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          } else if (colNumber === 7) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          } else {
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          }
        });

        donationIdx++;
        dataRowNum++;
      }

      if (batch.rows.length < CURSOR_BATCH_SIZE) {
        hasMore = false;
      }
    }

    if (currentAnimalNo !== null && donationIdx > 1 && animalStartRow < dataRowNum) {
      ws.mergeCells(animalStartRow, 2, dataRowNum - 1, 2);
    }

    ws.addRow([]);
    const footerRow = ws.addRow([
      "",
      kaName,
      "",
      "",
      `Toplam ${totalGroups} hayvan`,
      "",
      "",
      new Date().toLocaleDateString("tr-TR"),
    ]);
    footerRow.font = { italic: true, color: { argb: "FF6B7280" } };

    await client.query(`CLOSE ${cursorName}`);
    await client.query("COMMIT");

    await workbook.commit();
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
