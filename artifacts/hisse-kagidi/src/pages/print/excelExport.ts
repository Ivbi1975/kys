import * as XLSX from "xlsx-js-style";
import type { KesimAlani, AnimalGroup } from "@/lib/types";
import type { ColumnKey } from "./printHelpers";
import { getCellContent } from "./printHelpers";

interface ExcelExportParams {
  kesim: KesimAlani;
  processedGroups: AnimalGroup[];
  visibleColumns: readonly { key: string; label: string }[];
  shouldHideContent: (columnKey: string, cinsi: string) => boolean;
}

export function exportKesimKagidiExcel({ kesim, processedGroups, visibleColumns, shouldHideContent }: ExcelExportParams) {
  if (processedGroups.length === 0) return;
  const wb = XLSX.utils.book_new();

  const titleRow = [kesim.name];
  const emptyRow: string[] = [];
  const excelHeaders = ["Kesim Listesi ID", ...visibleColumns.map(c => c.label)];
  const totalCols = excelHeaders.length;
  const allRows: (string | number)[][] = [titleRow, emptyRow, excelHeaders];

  for (const group of processedGroups) {
    for (let idx = 0; idx < group.donations.length; idx++) {
      const d = group.donations[idx];
      const row: (string | number)[] = [kesim.kesimListeId || ""];
      for (const col of visibleColumns) {
        if (col.key === "hayvan") {
          row.push(idx === 0 ? group.animalNo : "");
        } else if (col.key === "sira") {
          row.push(shouldHideContent("sira", d.donationType) ? "" : idx + 1);
        } else {
          const content = getCellContent(col.key as ColumnKey, d);
          const hidden = shouldHideContent(col.key, d.donationType);
          row.push(hidden ? "" : content);
        }
      }
      allRows.push(row);
    }
  }

  const footerRow = [
    "",
    `${kesim.name}`,
    "",
    "",
    `Toplam ${processedGroups.length} hayvan`,
    "",
    "",
    new Date().toLocaleDateString("tr-TR"),
  ].slice(0, totalCols);
  allRows.push(emptyRow);
  allRows.push(footerRow);

  const ws = XLSX.utils.aoa_to_sheet(allRows);

  if (totalCols > 1) {
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });
  }

  const hayvanColIdx = visibleColumns.findIndex(c => c.key === "hayvan");
  const hayvanExcelIdx = hayvanColIdx >= 0 ? hayvanColIdx + 1 : -1;
  if (hayvanExcelIdx >= 0) {
    let rowIdx = 3;
    for (const group of processedGroups) {
      if (group.donations.length > 1) {
        const merge = { s: { r: rowIdx, c: hayvanExcelIdx }, e: { r: rowIdx + group.donations.length - 1, c: hayvanExcelIdx } };
        if (!ws["!merges"]) ws["!merges"] = [];
        ws["!merges"].push(merge);
      }
      rowIdx += group.donations.length;
    }
  }

  const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E3A5F" } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
  const titleStyle = { font: { bold: true, sz: 16, color: { rgb: "1E3A5F" } }, alignment: { horizontal: "center", vertical: "center" } };
  const hayvanStyle = { font: { bold: true, sz: 24, color: { rgb: "1E3A5F" } }, fill: { fgColor: { rgb: "DBEAFE" } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "medium" }, right: { style: "medium" } } };
  const cellBorder = { top: { style: "thin", color: { rgb: "9CA3AF" } }, bottom: { style: "thin", color: { rgb: "9CA3AF" } }, left: { style: "thin", color: { rgb: "9CA3AF" } }, right: { style: "thin", color: { rgb: "9CA3AF" } } };
  const evenRowFill = { fgColor: { rgb: "F8FAFC" } };

  const titleCell = ws["A1"];
  if (titleCell) titleCell.s = titleStyle;

  for (let c = 0; c < totalCols; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 2, c });
    if (ws[cellRef]) ws[cellRef].s = headerStyle;
  }

  let dataRowStart = 3;
  for (const group of processedGroups) {
    for (let idx = 0; idx < group.donations.length; idx++) {
      const r = dataRowStart + idx;
      const isEven = idx % 2 === 1;
      for (let c = 0; c < totalCols; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
        if (c === 0) {
          const style: Record<string, unknown> = { border: cellBorder, alignment: { vertical: "center" } };
          if (isEven) style.fill = evenRowFill;
          ws[cellRef].s = style;
        } else {
          const col = visibleColumns[c - 1];
          if (col.key === "hayvan" && idx === 0) {
            ws[cellRef].s = hayvanStyle;
          } else {
            const style: Record<string, unknown> = { border: cellBorder, alignment: { vertical: "center" } };
            if (isEven) style.fill = evenRowFill;
            if (col.key === "sira") {
              style.alignment = { horizontal: "center", vertical: "center" };
              style.font = { bold: true };
            } else if (col.key === "adina-kesilen") {
              style.font = { bold: true };
            } else if (col.key === "cinsi") {
              style.alignment = { horizontal: "center", vertical: "center" };
            }
            ws[cellRef].s = style;
          }
        }
      }
    }
    dataRowStart += group.donations.length;
  }

  const colWidths = [{ wch: 16 }, ...visibleColumns.map(c => {
    if (c.key === "hayvan") return { wch: 10 };
    if (c.key === "sira") return { wch: 6 };
    if (c.key === "vekalet") return { wch: 14 };
    if (c.key === "cinsi") return { wch: 12 };
    if (c.key === "notlar") return { wch: 20 };
    return { wch: 25 };
  })];
  ws["!cols"] = colWidths;

  const rowHeights: Record<number, { hpt: number }> = {};
  rowHeights[0] = { hpt: 30 };
  rowHeights[2] = { hpt: 22 };
  ws["!rows"] = [];
  for (let i = 0; i <= dataRowStart + 2; i++) {
    ws["!rows"].push(rowHeights[i] || { hpt: 20 });
  }

  XLSX.utils.book_append_sheet(wb, ws, "Kesim Kağıdı");
  XLSX.writeFile(wb, `${kesim.name}_kesim_kagidi.xlsx`);
}
