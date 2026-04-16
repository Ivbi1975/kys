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
const EXCEL_HAYVAN_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF1E3A5F" }, size: 28 };
const EXCEL_TITLE_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
const EXCEL_EVEN_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
const EXCEL_FOOTER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF5" } };
const THIN_BORDER: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF9CA3AF" } };
const CELL_BORDER: Partial<ExcelJS.Borders> = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
const MEDIUM_BORDER: Partial<ExcelJS.Border> = { style: "medium" };
const HAYVAN_BORDER: Partial<ExcelJS.Borders> = { top: MEDIUM_BORDER, bottom: MEDIUM_BORDER, left: MEDIUM_BORDER, right: MEDIUM_BORDER };

const SLOTS_PER_GROUP = 7;

const EXCEL_COLUMNS: { key: string; header: string; width: number }[] = [
  { key: "kesimListeId", header: "Kesim Listesi ID", width: 18 },
  { key: "hayvanNo", header: "HAYVAN", width: 14 },
  { key: "sira", header: "SIRA", width: 8 },
  { key: "vekalet", header: "VEKALET", width: 16 },
  { key: "vekaleti_veren", header: "VEKALETİ VEREN", width: 28 },
  { key: "adina_kesilen", header: "ADINA KESİLEN", width: 28 },
  { key: "cinsi", header: "CİNSİ", width: 14 },
  { key: "notlar", header: "NOTLAR", width: 22 },
];

const NUM_COLS = EXCEL_COLUMNS.length;

interface DonationSlot {
  vekalet: string;
  vekaleti_veren: string;
  adina_kesilen: string;
  cinsi: string;
  notlar: string;
}

interface AnimalGroupData {
  animalNo: number;
  slots: DonationSlot[];
}

function buildNotesValue(row: { notes: string | null; ai_categories: string[] | null; ai_warnings: string | null }): string {
  const aiParts: string[] = [];
  if (row.ai_categories && Array.isArray(row.ai_categories) && row.ai_categories.length > 0) {
    aiParts.push(row.ai_categories.join(", "));
  }
  if (row.ai_warnings && String(row.ai_warnings).trim()) {
    aiParts.push(`⚠ ${String(row.ai_warnings).trim()}`);
  }
  const notesVal = row.notes || "";
  const aiLabel = aiParts.length > 0 ? aiParts.join(" | ") : "";
  return aiLabel ? (notesVal ? `${notesVal} [${aiLabel}]` : `[${aiLabel}]`) : notesVal;
}

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

    const donationsResult = await client.query(
      `SELECT
         ag.animal_no,
         d.name, d.description, d.donation_type, d.vekalet, d.notes,
         d.ai_categories, d.ai_warnings,
         agd.sort_order AS slot_order
       FROM animal_groups ag
       LEFT JOIN animal_group_donations agd ON agd.group_id = ag.id
       LEFT JOIN donations d ON d.id = agd.donation_id AND d.deleted_at IS NULL
       WHERE ag.kesim_alani_id = $1 AND ag.deleted_at IS NULL
       ORDER BY ag.sort_order, ag.animal_no, agd.sort_order`,
      [kaId],
    );

    const groupMap = new Map<number, AnimalGroupData>();
    const groupOrder: number[] = [];

    for (const row of donationsResult.rows) {
      const animalNo = row.animal_no as number;
      if (!groupMap.has(animalNo)) {
        groupMap.set(animalNo, { animalNo, slots: [] });
        groupOrder.push(animalNo);
      }
      if (row.name !== null || row.description !== null || row.donation_type !== null) {
        groupMap.get(animalNo)!.slots.push({
          vekalet: row.vekalet || "",
          vekaleti_veren: trUpperCase(row.description),
          adina_kesilen: trUpperCase(row.name),
          cinsi: trUpperCase(row.donation_type),
          notlar: trUpperCase(buildNotesValue(row)),
        });
      }
    }

    const groups: AnimalGroupData[] = groupOrder.map(no => groupMap.get(no)!);
    const totalGroups = groups.length;

    const safeName = kaName.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ _-]/g, "").replace(/\s+/g, "_");
    const filename = `${safeName}_kesim_kagidi.xlsx`;

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Kesim Kağıdı");

    ws.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      },
    };

    ws.columns = EXCEL_COLUMNS.map(c => ({ key: c.key, width: c.width }));

    const today = new Date().toLocaleDateString("tr-TR");
    let currentRow = 1;

    for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
      const group = groups[groupIdx];
      const pageNum = groupIdx + 1;

      const titleRow = ws.getRow(currentRow);
      titleRow.height = 28;
      const titleCell = titleRow.getCell(1);
      titleCell.value = `${kaName} — ${today}`;
      titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
      titleCell.fill = EXCEL_TITLE_FILL;
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      titleCell.border = CELL_BORDER;
      ws.mergeCells(currentRow, 1, currentRow, NUM_COLS);
      currentRow++;

      const headerRow = ws.getRow(currentRow);
      headerRow.height = 22;
      EXCEL_COLUMNS.forEach((col, colIdx) => {
        const cell = headerRow.getCell(colIdx + 1);
        cell.value = col.header;
        cell.fill = EXCEL_HEADER_FILL;
        cell.font = EXCEL_HEADER_FONT;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = CELL_BORDER;
      });
      currentRow++;

      const dataStartRow = currentRow;

      for (let slotIdx = 0; slotIdx < SLOTS_PER_GROUP; slotIdx++) {
        const slot = group.slots[slotIdx] ?? null;
        const dataRow = ws.getRow(currentRow);
        dataRow.height = 26;
        const isEven = slotIdx % 2 === 1;

        const colValues: (string | number)[] = [
          kesimListeId,
          slotIdx === 0 ? group.animalNo : "",
          slotIdx + 1,
          slot?.vekalet ?? "",
          slot?.vekaleti_veren ?? "",
          slot?.adina_kesilen ?? "",
          slot?.cinsi ?? "",
          slot?.notlar ?? "",
        ];

        colValues.forEach((val, colIdx) => {
          const cell = dataRow.getCell(colIdx + 1);
          cell.value = val;
          cell.border = CELL_BORDER;
          cell.alignment = { vertical: "middle" };

          const colNum = colIdx + 1;
          if (colNum === 2) {
            if (slotIdx === 0) {
              cell.fill = EXCEL_HAYVAN_FILL;
              cell.font = EXCEL_HAYVAN_FONT;
              cell.alignment = { horizontal: "center", vertical: "middle" };
              cell.border = HAYVAN_BORDER;
            }
          } else if (colNum === 3) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.font = { bold: true };
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          } else if (colNum === 6) {
            cell.font = { bold: true };
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          } else if (colNum === 7) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          } else {
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          }
        });

        currentRow++;
      }

      ws.mergeCells(dataStartRow, 2, dataStartRow + SLOTS_PER_GROUP - 1, 2);
      const hayvanMergedCell = ws.getRow(dataStartRow).getCell(2);
      hayvanMergedCell.value = group.animalNo;
      hayvanMergedCell.fill = EXCEL_HAYVAN_FILL;
      hayvanMergedCell.font = EXCEL_HAYVAN_FONT;
      hayvanMergedCell.alignment = { horizontal: "center", vertical: "middle" };
      hayvanMergedCell.border = HAYVAN_BORDER;

      const footerRow = ws.getRow(currentRow);
      footerRow.height = 18;
      const footerLeft = footerRow.getCell(1);
      footerLeft.value = kaName;
      footerLeft.font = { italic: true, size: 9, color: { argb: "FF374151" } };
      footerLeft.fill = EXCEL_FOOTER_FILL;
      footerLeft.border = CELL_BORDER;
      ws.mergeCells(currentRow, 1, currentRow, NUM_COLS - 1);
      const footerRight = footerRow.getCell(NUM_COLS);
      footerRight.value = `Sayfa ${pageNum} / ${totalGroups}`;
      footerRight.font = { italic: true, size: 9, color: { argb: "FF374151" } };
      footerRight.fill = EXCEL_FOOTER_FILL;
      footerRight.alignment = { horizontal: "right", vertical: "middle" };
      footerRight.border = CELL_BORDER;
      currentRow++;

      if (groupIdx < groups.length - 1) {
        ws.getRow(currentRow - 1).addPageBreak();
      }
    }

    const lastDataRow = currentRow - 1;
    const lastColLetter = String.fromCharCode(64 + NUM_COLS);
    ws.pageSetup.printArea = `A1:${lastColLetter}${lastDataRow}`;

    const buf = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("X-Total-Groups", String(totalGroups));
    res.setHeader("Access-Control-Expose-Headers", "X-Total-Groups");
    res.setHeader("Content-Length", String(buf.byteLength));
    res.end(buf);
  } catch (err) {
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
