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
  const projectId = req.query.projectId as string | undefined;

  const scopeClause = kaId
    ? `ka.id = $1 AND ka.deleted_at IS NULL`
    : projectId
      ? `ka.project_id = $1 AND ka.deleted_at IS NULL`
      : `ka.deleted_at IS NULL`;
  const scopeParams: string[] = kaId ? [kaId] : projectId ? [projectId] : [];

  const client = await pool.connect();
  try {
    const countQuery = `SELECT count(*)::int AS total FROM donations d JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id WHERE d.deleted_at IS NULL AND ${scopeClause}`;
    const countResult = await client.query(countQuery, scopeParams);
    const totalRows = countResult.rows[0]?.total ?? 0;

    const today = new Date().toISOString().split("T")[0];
    const filename = kaId
      ? `bagisci_listesi_${kaId}_${today}.csv`
      : projectId
        ? `proje_bagiscilar_${projectId}_${today}.csv`
        : `tum_bagiscilar_${today}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Total-Rows", String(totalRows));
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Access-Control-Expose-Headers", "X-Total-Rows, X-Rows-Sent");

    const bom = "\uFEFF";
    res.write(bom + CSV_HEADERS.map(escapeCsvField).join(",") + "\n");

    const cursorName = "export_cursor_" + Date.now();
    const cursorQuery = `DECLARE ${cursorName} CURSOR FOR
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
         WHERE d.deleted_at IS NULL AND ${scopeClause}
         ORDER BY ka.name, d.sort_order`;

    await client.query("BEGIN");
    await client.query(cursorQuery, scopeParams);

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
const EXCEL_HEADER_FONT: Partial<ExcelJS.Font> = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const EXCEL_HAYVAN_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
const EXCEL_HAYVAN_FONT: Partial<ExcelJS.Font> = { name: "Calibri", bold: true, color: { argb: "FF1E3A5F" }, size: 28 };
const EXCEL_TITLE_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
const EXCEL_EVEN_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
const EXCEL_FOOTER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF5" } };
const THIN_BORDER: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF9CA3AF" } };
const CELL_BORDER: Partial<ExcelJS.Borders> = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
const HAYVAN_BORDER: Partial<ExcelJS.Borders> = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

const SLOTS_PER_GROUP = 7;

const EXCEL_COLUMNS: { key: string; header: string; width: number }[] = [
  { key: "hayvanNo",       header: "HAYVAN",         width: 12 },
  { key: "sira",           header: "SIRA",            width:  8 },
  { key: "vekalet",        header: "VEKALET",         width: 11 },
  { key: "vekaleti_veren", header: "VEKALETİ VEREN", width: 33 },
  { key: "adina_kesilen",  header: "ADINA KESİLEN",  width: 49 },
  { key: "cinsi",          header: "CİNSİ",           width: 15 },
  { key: "notlar",         header: "NOTLAR",          width: 45 },
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

function buildNotesValue(row: { notes: string | null; ai_categories: string[] | null | undefined; ai_warnings: string | null }): string {
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

type DbClient = { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

async function buildProjectFlatExcel(client: DbClient, projectId: string): Promise<{ buffer: Buffer; filename: string; totalRows: number }> {
  const projectResult = await client.query(
    `SELECT name FROM projects WHERE id = $1 AND deleted_at IS NULL`,
    [projectId],
  );
  if (projectResult.rows.length === 0) {
    throw Object.assign(new Error("Proje bulunamadı"), { statusCode: 404 });
  }
  const projectName = projectResult.rows[0].name as string;

  const dataResult = await client.query(
    `SELECT
       ka.id AS ka_id,
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
     WHERE d.deleted_at IS NULL AND ka.deleted_at IS NULL AND ka.project_id = $1
     ORDER BY ka.name, ka.id, d.sort_order`,
    [projectId],
  );

  const COL_MIN_WIDTH = 8;
  const COL_MAX_WIDTH = 55;
  // Track max content length per column index for auto-sizing
  const colMaxLen: number[] = CSV_HEADERS.map((h) => h.length);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Bağışçılar");
  // Set initial widths from headers; will be updated after scanning all rows
  ws.columns = CSV_HEADERS.map((h) => ({ header: h, width: Math.max(COL_MIN_WIDTH, h.length + 2) }));

  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:1",
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 1.0, header: 0.3, footer: 0.3 },
  };

  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = EXCEL_HEADER_FILL;
    cell.font = EXCEL_HEADER_FONT;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = CELL_BORDER;
  });
  headerRow.height = 22;

  let prevKaId: string | null = null;
  let dataRowIdx = 0;

  for (const row of dataResult.rows) {
    const kaName = (row.ka_name as string) || "";
    const kaId = (row.ka_id as string) || "";
    if (kaId !== prevKaId && prevKaId !== null) {
      const sepRow = ws.addRow(Array(CSV_HEADERS.length).fill(""));
      sepRow.height = 6;
      sepRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1D5DB" } };
        cell.border = CELL_BORDER;
      });
    }
    prevKaId = kaId;

    const cellValues: (string | number)[] = [
      kaName,
      (row.name as string) || "",
      (row.description as string) || "",
      (row.donation_type as string) || "",
      row.share_count != null ? Number(row.share_count) : 1,
      (row.vekalet as string) || "",
      (row.notes as string) || "",
      (row.phone as string) || "",
      row.excluded ? "Evet" : "Hayır",
      row.animal_no != null ? Number(row.animal_no) : "",
      (row.color_tag as string) || "",
      row.kesildi ? "Evet" : "Hayır",
      row.kesildi_at ? new Date(row.kesildi_at as string | number | Date).toLocaleDateString("tr-TR") : "",
      (row.team_name as string) || "",
    ];

    // Update column max lengths for auto-sizing
    cellValues.forEach((val, i) => {
      const len = String(val).length;
      if (len > colMaxLen[i]) colMaxLen[i] = len;
    });

    const newRow = ws.addRow(cellValues);
    newRow.height = 18;
    const isEven = dataRowIdx % 2 === 1;
    newRow.eachCell((cell, colNum) => {
      cell.border = CELL_BORDER;
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = { vertical: "middle", wrapText: colNum === 7 };
      if (isEven) cell.fill = EXCEL_EVEN_FILL;
    });
    dataRowIdx++;
  }

  // Apply content-based column widths (clamped to min/max)
  ws.columns.forEach((col, i) => {
    col.width = Math.min(COL_MAX_WIDTH, Math.max(COL_MIN_WIDTH, (colMaxLen[i] ?? 0) + 3));
  });

  const safeName = projectName.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ _-]/g, "").replace(/\s+/g, "_");
  const today = new Date().toISOString().split("T")[0];
  const filename = `${safeName || "proje"}_bagiscilar_${today}.xlsx`;
  const buf = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(buf), filename, totalRows: dataResult.rows.length };
}

router.get("/export/excel", asyncHandler(async (req, res) => {
  const kaId = req.query.kaId as string | undefined;
  const projectId = req.query.projectId as string | undefined;

  if (!kaId && !projectId) {
    res.status(400).json({ error: "kaId veya projectId parametresi gerekli" });
    return;
  }

  const client = await pool.connect();
  try {
    if (!kaId && projectId) {
      try {
        const { buffer, filename, totalRows } = await buildProjectFlatExcel(client, projectId);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader("X-Total-Rows", String(totalRows));
        res.setHeader("Access-Control-Expose-Headers", "X-Total-Rows");
        res.setHeader("Content-Length", String(buffer.byteLength));
        res.end(buffer);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404) {
          res.status(404).json({ error: (err as Error).message });
          return;
        }
        throw err;
      }
      return;
    }

    // kaId path: kesim kağıdı format
    const kaResult = await client.query(
      `SELECT name, display_name FROM kesim_alanlari WHERE id = $1 AND deleted_at IS NULL`,
      [kaId],
    );
    if (kaResult.rows.length === 0) {
      res.status(404).json({ error: "Kesim alanı bulunamadı" });
      return;
    }
    const kaName = kaResult.rows[0].name as string;
    const kaDisplayName = ((kaResult.rows[0].display_name as string | null) || kaName);

    const logoResult = await client.query(`SELECT value FROM app_settings WHERE key = 'logo'`);
    const logoDataUrl = (logoResult.rows[0]?.value as string | null) || null;

    const donationsResult = await client.query(
      `SELECT
         ag.id AS group_id,
         ag.animal_no,
         d.name, d.description, d.donation_type, d.vekalet, d.notes,
         d.ai_warnings,
         COALESCE((
           SELECT array_agg(ct.name)
           FROM donation_tags dt
           JOIN custom_tags ct ON ct.id = dt.tag_id
           WHERE dt.donation_id = d.id AND ct.category_id = '__ai_category__'
         ), '{}') AS ai_categories,
         agd.sort_order AS slot_order
       FROM animal_groups ag
       LEFT JOIN animal_group_donations agd ON agd.group_id = ag.id
       LEFT JOIN donations d ON d.id = agd.donation_id AND d.deleted_at IS NULL
       WHERE ag.kesim_alani_id = $1 AND ag.deleted_at IS NULL
       ORDER BY ag.sort_order, ag.animal_no, agd.sort_order`,
      [kaId],
    );

    const groupMap = new Map<string, AnimalGroupData>();
    const groupOrder: string[] = [];

    for (const row of donationsResult.rows) {
      const groupId = row.group_id as string;
      const animalNo = row.animal_no as number;
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, { animalNo, slots: [] });
        groupOrder.push(groupId);
      }
      if (row.name !== null || row.description !== null || row.donation_type !== null) {
        groupMap.get(groupId)!.slots.push({
          vekalet: row.vekalet || "",
          vekaleti_veren: trUpperCase((row.description as string | null) || (row.name as string | null)),
          adina_kesilen: trUpperCase(row.name),
          cinsi: trUpperCase(row.donation_type),
          notlar: trUpperCase(buildNotesValue(row)),
        });
      }
    }

    const groups: AnimalGroupData[] = groupOrder.map(id => groupMap.get(id)!);
    const totalGroups = groups.length;

    const safeName = kaName.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ _-]/g, "").replace(/\s+/g, "_");
    const filename = `${safeName}_kesim_kagidi.xlsx`;

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Kesim Kağıdı");

    // Register logo image once if available
    let logoImageId: number | null = null;
    if (logoDataUrl) {
      const logoMatch = logoDataUrl.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/i);
      if (logoMatch) {
        const rawExt = logoMatch[1].toLowerCase();
        const ext = (rawExt === "jpg" ? "jpeg" : rawExt) as "png" | "jpeg" | "gif";
        try {
          logoImageId = workbook.addImage({ base64: logoMatch[2], extension: ext });
        } catch { logoImageId = null; }
      }
    }

    ws.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      // Each group block already includes its own header row; no printTitlesRow
      // needed here — it would duplicate the header on every printed page.
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 1.0,
        header: 0.3,
        footer: 0.3,
      },
    };

    ws.columns = EXCEL_COLUMNS.map(c => ({ key: c.key, width: c.width }));

    let currentRow = 1;

    for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
      const group = groups[groupIdx];

      // Title row: left area = logo, right area = kesim name — matches PDF header layout
      const titleRowIdx = currentRow;
      const titleRow = ws.getRow(titleRowIdx);
      titleRow.height = 45;
      const LOGO_COLS = 3;
      // Left: logo area (blank cell base, image overlaid by addImage below)
      const logoCell = titleRow.getCell(1);
      logoCell.value = "";
      if (LOGO_COLS > 1) ws.mergeCells(titleRowIdx, 1, titleRowIdx, LOGO_COLS);
      // Right: kesim name, right-aligned dark blue bold — matches PDF top-right
      const nameCell = titleRow.getCell(LOGO_COLS + 1);
      nameCell.value = kaDisplayName;
      nameCell.font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF1E3A5F" } };
      nameCell.alignment = { horizontal: "right", vertical: "middle" };
      if (NUM_COLS > LOGO_COLS + 1) ws.mergeCells(titleRowIdx, LOGO_COLS + 1, titleRowIdx, NUM_COLS);
      currentRow++;

      // Embed logo image in the left section of the title row.
      // Use ImagePosition (tl + ext) to avoid the ExcelJS Anchor class entirely —
      // ImageRange (tl + br) requires full Anchor objects with native EMU fields.
      if (logoImageId !== null) {
        ws.addImage(logoImageId, {
          tl: { col: 0, row: titleRowIdx - 1 },
          ext: { width: 120, height: 40 },
          editAs: "oneCell",
        });
      }

      // Column header row — dark navy, white bold, matching PDF column headers
      const headerRow = ws.getRow(currentRow);
      headerRow.height = 27;
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
        dataRow.height = 60;
        const isEven = slotIdx % 2 === 1;

        // col1=hayvan, col2=sira, col3=vekalet, col4=vekaleti_veren, col5=adina_kesilen, col6=cinsi, col7=notlar
        const colValues: (string | number)[] = [
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
          // Default: Calibri 10pt, left-aligned, middle vertical
          cell.font = { name: "Calibri", size: 10 };
          cell.alignment = { vertical: "middle" };

          const colNum = colIdx + 1;
          if (colNum === 1) {
            // HAYVAN — fully styled by the merge block below
            if (slotIdx === 0) {
              cell.fill = EXCEL_HAYVAN_FILL;
              cell.font = EXCEL_HAYVAN_FONT;
              cell.alignment = { horizontal: "center", vertical: "middle" };
              cell.border = HAYVAN_BORDER;
            }
          } else if (colNum === 2) {
            // SIRA — bold, centered
            cell.font = { name: "Calibri", size: 10, bold: true };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          } else if (colNum === 3) {
            // VEKALET — smaller, slightly gray, left-indented
            cell.font = { name: "Calibri", size: 9, color: { argb: "FF6B7280" } };
            cell.alignment = { vertical: "middle", indent: 1 };
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          } else if (colNum === 4) {
            // VEKALETİ VEREN — normal, left-indented
            cell.alignment = { vertical: "middle", indent: 1 };
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          } else if (colNum === 5) {
            // ADINA KESİLEN — bold, left-indented
            cell.font = { name: "Calibri", size: 10, bold: true };
            cell.alignment = { vertical: "middle", indent: 1 };
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          } else if (colNum === 6) {
            // CİNSİ — centered, normal
            cell.alignment = { horizontal: "center", vertical: "middle" };
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          } else {
            // NOTLAR — left-indented, wrap long text
            cell.alignment = { vertical: "middle", wrapText: true, indent: 1 };
            if (isEven) cell.fill = EXCEL_EVEN_FILL;
          }
        });

        currentRow++;
      }

      // Merge HAYVAN column vertically across all 7 slots — col 1
      ws.mergeCells(dataStartRow, 1, dataStartRow + SLOTS_PER_GROUP - 1, 1);
      const hayvanMergedCell = ws.getRow(dataStartRow).getCell(1);
      hayvanMergedCell.value = group.animalNo;
      hayvanMergedCell.fill = EXCEL_HAYVAN_FILL;
      hayvanMergedCell.font = EXCEL_HAYVAN_FONT;
      hayvanMergedCell.alignment = { horizontal: "center", vertical: "middle" };
      hayvanMergedCell.border = HAYVAN_BORDER;

      // Footer row — kesim name only, left-aligned, small italic — matches PDF footer
      const footerRow = ws.getRow(currentRow);
      footerRow.height = 14;
      const footerCell = footerRow.getCell(1);
      footerCell.value = kaDisplayName;
      footerCell.font = { name: "Calibri", italic: true, size: 9, color: { argb: "FF374151" } };
      footerCell.fill = EXCEL_FOOTER_FILL;
      footerCell.border = CELL_BORDER;
      ws.mergeCells(currentRow, 1, currentRow, NUM_COLS);
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
  const projectId = req.query.projectId as string | undefined;
  const client = await pool.connect();
  try {
    const scopeClause = kaId
      ? `ka.id = $1 AND ka.deleted_at IS NULL`
      : projectId
        ? `ka.project_id = $1 AND ka.deleted_at IS NULL`
        : `ka.deleted_at IS NULL`;
    const params: string[] = kaId ? [kaId] : projectId ? [projectId] : [];
    const query = `SELECT count(*)::int AS total
      FROM donations d
      JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
      WHERE d.deleted_at IS NULL AND ${scopeClause}`;
    const result = await client.query(query, params);
    res.json({ total: result.rows[0]?.total ?? 0 });
  } finally {
    client.release();
  }
}));

export default router;
