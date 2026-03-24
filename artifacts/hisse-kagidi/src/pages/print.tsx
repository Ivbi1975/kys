import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Printer, Settings2, ChevronDown, ChevronUp, RotateCcw, Eye, EyeOff, FileSpreadsheet, FileText, LayoutTemplate } from "lucide-react";
import type { KesimAlani, AnimalGroup } from "@/lib/types";
import { fetchKesimAlani, fetchLogo } from "@/lib/api";
import * as XLSX from "xlsx-js-style";
import {
  loadPrintPreferences,
  savePrintPreferences,
  resetPrintPreferences,
  DEFAULT_PRINT_PREFS,
  PRINT_TEMPLATES,
} from "@/lib/storage";
import type { PrintPreferences, PrintTemplate } from "@/lib/storage";

const COLUMNS = [
  { key: "hayvan", label: "HAYVAN" },
  { key: "sira", label: "SIRA" },
  { key: "vekalet", label: "VEKALET" },
  { key: "vekaleti-veren", label: "VEKALETİ VEREN" },
  { key: "adina-kesilen", label: "ADINA KESİLEN" },
  { key: "cinsi", label: "CİNSİ" },
  { key: "notlar", label: "NOTLAR" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

export default function PrintPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [contentRulesOpen, setContentRulesOpen] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<PrintPreferences>(() => loadPrintPreferences());

  useEffect(() => {
    async function loadData() {
      if (params.id) {
        const data = await fetchKesimAlani(params.id);
        if (data) setKesim(data);
        else setLocation("/");
      }
      const logoData = await fetchLogo();
      setLogo(logoData);
    }
    loadData();
  }, [params.id, setLocation]);

  const updatePrefs = useCallback((updater: (prev: PrintPreferences) => PrintPreferences) => {
    setPrefs((prev) => {
      const next = updater(prev);
      savePrintPreferences(next);
      return next;
    });
  }, []);

  const allCinsTypes = useMemo(() => {
    if (!kesim) return [];
    const types = new Set<string>();
    for (const group of kesim.animalGroups) {
      for (const d of group.donations) {
        if (d.donationType && d.donationType.trim()) {
          types.add(d.donationType.trim());
        }
      }
    }
    return Array.from(types).sort((a, b) => a.localeCompare(b, "tr"));
  }, [kesim]);

  const processedGroups = useMemo((): AnimalGroup[] => {
    if (!kesim) return [];
    return kesim.animalGroups;
  }, [kesim]);

  const isColumnHidden = useCallback(
    (key: string) => prefs.hiddenColumns.includes(key),
    [prefs.hiddenColumns]
  );

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => !isColumnHidden(c.key)),
    [isColumnHidden]
  );

  function toggleColumnVisibility(key: string) {
    updatePrefs((prev) => {
      if (!prev.hiddenColumns.includes(key)) {
        const wouldBeHidden = [...prev.hiddenColumns, key];
        if (wouldBeHidden.length >= COLUMNS.length) return prev;
        return { ...prev, hiddenColumns: wouldBeHidden };
      }
      return { ...prev, hiddenColumns: prev.hiddenColumns.filter((k) => k !== key) };
    });
  }

  const CONTENT_HIDE_ALLOWED_COLUMNS = ["vekaleti-veren", "notlar"];

  function shouldHideContent(columnKey: string, cinsi: string): boolean {
    if (!cinsi) return false;
    if (!CONTENT_HIDE_ALLOWED_COLUMNS.includes(columnKey)) return false;
    const rules = prefs.contentHideRules[columnKey];
    if (!rules || rules.length === 0) return false;
    const normalized = cinsi.trim().toLowerCase();
    return rules.some((r) => r.toLowerCase() === normalized);
  }

  function toggleContentHideRule(columnKey: string, cinsType: string) {
    updatePrefs((prev) => {
      const rules = { ...prev.contentHideRules };
      const existing = rules[columnKey] || [];
      const hasRule = existing.some((r) => r.toLowerCase() === cinsType.toLowerCase());
      if (hasRule) {
        rules[columnKey] = existing.filter((r) => r.toLowerCase() !== cinsType.toLowerCase());
        if (rules[columnKey].length === 0) delete rules[columnKey];
      } else {
        rules[columnKey] = [...existing, cinsType];
      }
      return { ...prev, contentHideRules: rules };
    });
  }

  function handleReset() {
    resetPrintPreferences();
    setPrefs({
      ...DEFAULT_PRINT_PREFS,
      contentHideRules: { ...DEFAULT_PRINT_PREFS.contentHideRules },
      columnFontSizes: {},
    });
  }

  const DEFAULT_FONT_SIZES: Record<string, number> = {
    hayvan: 32,
    sira: 14,
    vekalet: 11,
    "vekaleti-veren": 13,
    "adina-kesilen": 13,
    cinsi: 12,
    notlar: 11,
  };

  function getColumnFontSize(key: string): number {
    return prefs.columnFontSizes[key] || DEFAULT_FONT_SIZES[key] || 13;
  }

  function setColumnFontSize(key: string, size: number) {
    updatePrefs((prev) => ({
      ...prev,
      columnFontSizes: { ...prev.columnFontSizes, [key]: size },
    }));
  }

  function setTemplate(t: PrintTemplate) {
    updatePrefs((prev) => ({ ...prev, template: t }));
  }

  function getCellContent(columnKey: ColumnKey, d: AnimalGroup["donations"][0]): string {
    switch (columnKey) {
      case "vekalet": return d.vekalet || "";
      case "vekaleti-veren": return d.description || "";
      case "adina-kesilen": return d.name || "";
      case "cinsi": return d.donationType || "";
      case "notlar": return d.notes || "";
      default: return "";
    }
  }

  function handlePrint() {
    window.print();
  }

  function handlePdfDownload() {
    window.print();
  }

  function exportKesimKagidiExcel() {
    if (!kesim || kesim.animalGroups.length === 0) return;
    const wb = XLSX.utils.book_new();

    const titleRow = [kesim.name];
    const emptyRow: string[] = [];
    const headers = visibleColumns.map(c => c.label);
    const allRows: (string | number)[][] = [titleRow, emptyRow, headers];

    for (const group of processedGroups) {
      for (let idx = 0; idx < group.donations.length; idx++) {
        const d = group.donations[idx];
        const row: (string | number)[] = [];
        for (const col of visibleColumns) {
          if (col.key === "hayvan") {
            row.push(idx === 0 ? group.animalNo : "");
          } else if (col.key === "sira") {
            row.push(shouldHideContent("sira", d.donationType) ? "" : idx + 1);
          } else {
            const content = getCellContent(col.key, d);
            const hidden = shouldHideContent(col.key, d.donationType);
            row.push(hidden ? "" : content);
          }
        }
        allRows.push(row);
      }
    }

    const footerRow = [
      `${kesim.name}`,
      "",
      "",
      `Toplam ${processedGroups.length} hayvan`,
      "",
      "",
      new Date().toLocaleDateString("tr-TR"),
    ].slice(0, visibleColumns.length);
    allRows.push(emptyRow);
    allRows.push(footerRow);

    const ws = XLSX.utils.aoa_to_sheet(allRows);

    if (visibleColumns.length > 1) {
      if (!ws["!merges"]) ws["!merges"] = [];
      ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: visibleColumns.length - 1 } });
    }

    const hayvanColIdx = visibleColumns.findIndex(c => c.key === "hayvan");
    if (hayvanColIdx >= 0) {
      let rowIdx = 3;
      for (const group of processedGroups) {
        if (group.donations.length > 1) {
          const merge = { s: { r: rowIdx, c: hayvanColIdx }, e: { r: rowIdx + group.donations.length - 1, c: hayvanColIdx } };
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
    if (titleCell) {
      titleCell.s = titleStyle;
    }

    for (let c = 0; c < visibleColumns.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 2, c });
      if (ws[cellRef]) {
        ws[cellRef].s = headerStyle;
      }
    }

    let dataRowStart = 3;
    for (const group of processedGroups) {
      for (let idx = 0; idx < group.donations.length; idx++) {
        const r = dataRowStart + idx;
        const isEven = idx % 2 === 1;
        for (let c = 0; c < visibleColumns.length; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
          const col = visibleColumns[c];
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
      dataRowStart += group.donations.length;
    }

    const colWidths = visibleColumns.map(c => {
      if (c.key === "hayvan") return { wch: 10 };
      if (c.key === "sira") return { wch: 6 };
      if (c.key === "vekalet") return { wch: 14 };
      if (c.key === "cinsi") return { wch: 12 };
      if (c.key === "notlar") return { wch: 20 };
      return { wch: 25 };
    });
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

  function renderStandardTemplate() {
    if (!kesim) return null;
    return (
      <div className="print-pages">
        {processedGroups.map((group) => (
          <div key={group.id} className="print-page">
            <div className="page-header-row">
              {logo && <img src={logo} alt="Logo" className="page-logo-img" />}
              <div className="page-header-title">{kesim.name}</div>
            </div>
            <div className="page-content">
              <table className="kesim-table dynamic-columns">
                <thead>
                  <tr>
                    {visibleColumns.map((col) => (
                      <th key={col.key} className={`col-${col.key}`}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.donations.map((d, idx) => (
                    <tr key={d.id}>
                      {!isColumnHidden("hayvan") && idx === 0 && (
                        <td className="hayvan-cell" rowSpan={7} style={{ fontSize: `${getColumnFontSize("hayvan")}px` }}>
                          <div className="hayvan-number" style={{ fontSize: `${getColumnFontSize("hayvan")}px` }}>{group.animalNo}</div>
                        </td>
                      )}
                      {visibleColumns.filter((col) => col.key !== "hayvan").map((col) => {
                        if (col.key === "sira") {
                          return <td key={col.key} className="sira-cell" style={{ fontSize: `${getColumnFontSize("sira")}px` }}>{shouldHideContent("sira", d.donationType) ? "" : idx + 1}</td>;
                        }
                        const content = getCellContent(col.key, d);
                        const hidden = shouldHideContent(col.key, d.donationType);
                        return <td key={col.key} className={`${col.key}-cell`} style={{ fontSize: `${getColumnFontSize(col.key)}px` }}>{hidden ? "" : content}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="page-footer">
              <span>{kesim.name}</span>
              <span>Sayfa {group.animalNo} / {kesim.animalGroups.length}</span>
              <span>{new Date().toLocaleDateString("tr-TR")}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderPortraitTemplate() {
    if (!kesim) return null;
    return (
      <div className="print-pages template-portrait">
        {processedGroups.map((group) => (
          <div key={group.id} className="print-page print-page-portrait">
            <div className="page-header-row">
              {logo && <img src={logo} alt="Logo" className="page-logo-img" />}
              <div className="page-header-title">{kesim.name}</div>
            </div>
            <div className="page-content">
              <table className="kesim-table dynamic-columns">
                <thead>
                  <tr>
                    {visibleColumns.map((col) => (
                      <th key={col.key} className={`col-${col.key}`}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.donations.map((d, idx) => (
                    <tr key={d.id}>
                      {!isColumnHidden("hayvan") && idx === 0 && (
                        <td className="hayvan-cell" rowSpan={7} style={{ fontSize: `${getColumnFontSize("hayvan")}px` }}>
                          <div className="hayvan-number" style={{ fontSize: `${getColumnFontSize("hayvan")}px` }}>{group.animalNo}</div>
                        </td>
                      )}
                      {visibleColumns.filter((col) => col.key !== "hayvan").map((col) => {
                        if (col.key === "sira") {
                          return <td key={col.key} className="sira-cell" style={{ fontSize: `${getColumnFontSize("sira")}px` }}>{shouldHideContent("sira", d.donationType) ? "" : idx + 1}</td>;
                        }
                        const content = getCellContent(col.key, d);
                        const hidden = shouldHideContent(col.key, d.donationType);
                        return <td key={col.key} className={`${col.key}-cell`} style={{ fontSize: `${getColumnFontSize(col.key)}px` }}>{hidden ? "" : content}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="page-footer">
              <span>{kesim.name}</span>
              <span>Sayfa {group.animalNo} / {kesim.animalGroups.length}</span>
              <span>{new Date().toLocaleDateString("tr-TR")}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderCompactTemplate() {
    if (!kesim) return null;
    const rowsPerPage = 20;
    const pages: AnimalGroup[][] = [];
    for (let i = 0; i < processedGroups.length; i += rowsPerPage) {
      pages.push(processedGroups.slice(i, i + rowsPerPage));
    }

    return (
      <div className="print-pages template-compact">
        {pages.map((pageGroups, pageIdx) => (
          <div key={pageIdx} className="print-page print-page-compact">
            <div className="page-header-row">
              {logo && <img src={logo} alt="Logo" className="page-logo-img" style={{ maxHeight: "10mm" }} />}
              <div className="page-header-title" style={{ fontSize: "14px" }}>{kesim.name}</div>
            </div>
            <div className="page-content">
              <table className="compact-list-table">
                <thead>
                  <tr>
                    {!isColumnHidden("hayvan") && <th style={{ width: "45px" }}>Hayvan</th>}
                    <th style={{ width: "55px" }}>Dolu/Top</th>
                    {!isColumnHidden("adina-kesilen") && <th>Bağışçılar (Adına Kesilen)</th>}
                    {!isColumnHidden("vekaleti-veren") && <th>Vekaleti Veren</th>}
                    {!isColumnHidden("cinsi") && <th style={{ width: "80px" }}>Cinsler</th>}
                    {!isColumnHidden("notlar") && <th style={{ width: "120px" }}>Notlar</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageGroups.map((group) => {
                    const filledDonors = group.donations.filter(d => d.name.trim());
                    const donorNames = filledDonors
                      .filter(d => !shouldHideContent("adina-kesilen", d.donationType))
                      .map(d => d.name).join(", ");
                    const vekaletNames = filledDonors
                      .filter(d => !shouldHideContent("vekaleti-veren", d.donationType))
                      .map(d => d.description).filter(Boolean).join(", ");
                    const cinsTypes = [...new Set(
                      filledDonors
                        .filter(d => !shouldHideContent("cinsi", d.donationType))
                        .map(d => d.donationType).filter(Boolean)
                    )].join(", ");
                    const groupNotes = [...new Set(
                      filledDonors
                        .filter(d => !shouldHideContent("notlar", d.donationType))
                        .map(d => d.notes).filter(Boolean)
                    )].join("; ");
                    return (
                      <tr key={group.id}>
                        {!isColumnHidden("hayvan") && <td className="compact-list-animal">{group.animalNo}</td>}
                        <td className="compact-list-count">{filledDonors.length}/{group.donations.length}</td>
                        {!isColumnHidden("adina-kesilen") && <td className="compact-list-names">{donorNames || <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Boş</span>}</td>}
                        {!isColumnHidden("vekaleti-veren") && <td className="compact-list-names">{vekaletNames}</td>}
                        {!isColumnHidden("cinsi") && <td className="compact-list-types">{cinsTypes}</td>}
                        {!isColumnHidden("notlar") && <td className="compact-list-notes">{groupNotes}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="page-footer">
              <span>{kesim.name}</span>
              <span>Sayfa {pageIdx + 1} / {pages.length}</span>
              <span>{new Date().toLocaleDateString("tr-TR")}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderNameListTemplate() {
    if (!kesim) return null;
    const allDonations: { animalNo: number; idx: number; name: string; description: string; shareCount: number; donationType: string; vekalet: string }[] = [];
    for (const group of processedGroups) {
      group.donations.forEach((d, idx) => {
        if (d.name.trim()) {
          allDonations.push({
            animalNo: group.animalNo,
            idx: idx + 1,
            name: d.name,
            description: d.description || "",
            shareCount: d.shareCount,
            donationType: d.donationType || "",
            vekalet: d.vekalet || "",
          });
        }
      });
    }

    const rowsPerPage = 35;
    const pages: typeof allDonations[] = [];
    for (let i = 0; i < allDonations.length; i += rowsPerPage) {
      pages.push(allDonations.slice(i, i + rowsPerPage));
    }

    return (
      <div className="print-pages template-namelist">
        {pages.map((pageDonations, pageIdx) => (
          <div key={pageIdx} className="print-page print-page-portrait">
            <div className="page-header-row">
              {logo && <img src={logo} alt="Logo" className="page-logo-img" style={{ maxHeight: "10mm" }} />}
              <div className="page-header-title" style={{ fontSize: "14px" }}>{kesim.name} - Bağışçı Listesi</div>
            </div>
            <div className="page-content">
              <table className="namelist-table">
                <thead>
                  <tr>
                    <th style={{ width: "30px" }}>#</th>
                    <th style={{ width: "50px" }}>Hayvan</th>
                    <th>Adına Kesilen</th>
                    <th>Vekaleti Veren</th>
                    <th style={{ width: "60px" }}>Cinsi</th>
                    <th style={{ width: "50px" }}>Hisse</th>
                  </tr>
                </thead>
                <tbody>
                  {pageDonations.map((d, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: "center" }}>{pageIdx * rowsPerPage + i + 1}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{d.animalNo}</td>
                      <td>{d.name}</td>
                      <td>{d.description}</td>
                      <td style={{ textAlign: "center" }}>{d.donationType}</td>
                      <td style={{ textAlign: "center" }}>{d.shareCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="page-footer">
              <span>{kesim.name}</span>
              <span>Sayfa {pageIdx + 1} / {pages.length} — Toplam {allDonations.length} bağışçı</span>
              <span>{new Date().toLocaleDateString("tr-TR")}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderSummaryTemplate() {
    if (!kesim) return null;
    const totalGroups = processedGroups.length;
    const allDonors = processedGroups.flatMap(g => g.donations.filter(d => d.name.trim()));
    const totalDonors = allDonors.length;
    const totalShares = allDonors.reduce((sum, d) => sum + d.shareCount, 0);
    const totalSlots = processedGroups.reduce((sum, g) => sum + g.donations.length, 0);
    const filledSlots = allDonors.length;
    const emptySlots = totalSlots - filledSlots;
    const cinsBreakdown = new Map<string, number>();
    for (const d of allDonors) {
      if (!shouldHideContent("cinsi", d.donationType)) {
        const cins = d.donationType?.trim() || "Belirtilmemiş";
        cinsBreakdown.set(cins, (cinsBreakdown.get(cins) || 0) + 1);
      }
    }

    const showHayvan = !isColumnHidden("hayvan");
    const showNames = !isColumnHidden("adina-kesilen");
    const showCins = !isColumnHidden("cinsi");
    const showNotes = !isColumnHidden("notlar");
    const showVekalet = !isColumnHidden("vekaleti-veren");

    const groupsPerPage = 25;
    const pages: AnimalGroup[][] = [];
    for (let i = 0; i < processedGroups.length; i += groupsPerPage) {
      pages.push(processedGroups.slice(i, i + groupsPerPage));
    }
    const totalPages = Math.max(1, pages.length);

    return (
      <div className="print-pages template-summary">
        {pages.map((pageGroups, pageIdx) => (
          <div key={pageIdx} className="print-page print-page-compact">
            <div className="page-header-row">
              {logo && <img src={logo} alt="Logo" className="page-logo-img" style={{ maxHeight: "12mm" }} />}
              <div className="page-header-title" style={{ fontSize: "16px" }}>{kesim.name} - Özet Rapor</div>
            </div>
            <div className="page-content">
              {pageIdx === 0 && (
                <>
                  <div className="summary-stats-grid">
                    <div className="summary-stat-card">
                      <div className="summary-stat-value">{totalGroups}</div>
                      <div className="summary-stat-label">Toplam Hayvan</div>
                    </div>
                    <div className="summary-stat-card">
                      <div className="summary-stat-value">{totalDonors}</div>
                      <div className="summary-stat-label">Toplam Bağışçı</div>
                    </div>
                    <div className="summary-stat-card">
                      <div className="summary-stat-value">{totalShares}</div>
                      <div className="summary-stat-label">Toplam Hisse</div>
                    </div>
                    <div className="summary-stat-card">
                      <div className="summary-stat-value">{filledSlots}/{totalSlots}</div>
                      <div className="summary-stat-label">Dolu/Toplam Slot</div>
                    </div>
                    <div className="summary-stat-card">
                      <div className="summary-stat-value">{emptySlots}</div>
                      <div className="summary-stat-label">Boş Slot</div>
                    </div>
                    <div className="summary-stat-card">
                      <div className="summary-stat-value">{totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0}%</div>
                      <div className="summary-stat-label">Doluluk Oranı</div>
                    </div>
                  </div>

                  {showCins && cinsBreakdown.size > 0 && (
                    <div className="summary-section">
                      <h3 className="summary-section-title">Cins Dağılımı</h3>
                      <div className="summary-cins-grid">
                        {[...cinsBreakdown.entries()].sort((a, b) => b[1] - a[1]).map(([cins, count]) => (
                          <div key={cins} className="summary-cins-item">
                            <span className="summary-cins-name">{cins}</span>
                            <span className="summary-cins-count">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="summary-section">
                <h3 className="summary-section-title">Grup Detayları</h3>
                <table className="summary-groups-table">
                  <thead>
                    <tr>
                      {showHayvan && <th style={{ width: "50px" }}>Hayvan</th>}
                      <th style={{ width: "60px" }}>Dolu/Top</th>
                      {showNames && <th>Bağışçılar</th>}
                      {showVekalet && <th>Vekaleti Veren</th>}
                      {showCins && <th style={{ width: "80px" }}>Cinsler</th>}
                      {showNotes && <th style={{ width: "100px" }}>Notlar</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pageGroups.map((group) => {
                      const filled = group.donations.filter(d => d.name.trim());
                      const names = filled
                        .filter(d => !shouldHideContent("adina-kesilen", d.donationType))
                        .map(d => d.name).join(", ");
                      const vekalets = filled
                        .filter(d => !shouldHideContent("vekaleti-veren", d.donationType))
                        .map(d => d.description).filter(Boolean).join(", ");
                      const types = [...new Set(
                        filled
                          .filter(d => !shouldHideContent("cinsi", d.donationType))
                          .map(d => d.donationType).filter(Boolean)
                      )].join(", ");
                      const notes = [...new Set(
                        filled
                          .filter(d => !shouldHideContent("notlar", d.donationType))
                          .map(d => d.notes).filter(Boolean)
                      )].join("; ");
                      return (
                        <tr key={group.id}>
                          {showHayvan && <td style={{ textAlign: "center", fontWeight: 700, color: "#1e3a5f" }}>{group.animalNo}</td>}
                          <td style={{ textAlign: "center" }}>{filled.length}/{group.donations.length}</td>
                          {showNames && <td>{names || "—"}</td>}
                          {showVekalet && <td>{vekalets}</td>}
                          {showCins && <td style={{ textAlign: "center", fontSize: "10px" }}>{types}</td>}
                          {showNotes && <td style={{ fontSize: "10px", color: "#6b7280" }}>{notes}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="page-footer">
              <span>{kesim.name}</span>
              <span>Sayfa {pageIdx + 1} / {totalPages}</span>
              <span>{new Date().toLocaleDateString("tr-TR")}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const pageStyle = useMemo(() => {
    if (prefs.template === "portrait" || prefs.template === "namelist") {
      return `@page { size: A4 portrait; margin: 0; }`;
    }
    return `@page { size: A4 landscape; margin: 0; }`;
  }, [prefs.template]);

  if (!kesim) return null;

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: pageStyle }} />
      <div className="print:hidden p-4 flex items-center gap-3 bg-background border-b sticky top-0 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(`/kesim/${kesim.id}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Geri
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{kesim.name} - Yazdırma Önizleme</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOptionsOpen(!optionsOpen)}
        >
          <Settings2 className="w-4 h-4 mr-1" />
          Yazdırma Seçenekleri
          {optionsOpen ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
        </Button>
        <Button variant="outline" size="sm" onClick={exportKesimKagidiExcel} disabled={processedGroups.length === 0}>
          <FileSpreadsheet className="w-4 h-4 mr-1" />
          Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handlePdfDownload} disabled={processedGroups.length === 0} title="Tarayıcı yazdırma diyaloğunda PDF olarak kaydedin">
          <FileText className="w-4 h-4 mr-1" />
          PDF İndir
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Yazdır
        </Button>
      </div>

      {optionsOpen && (
        <div className="print:hidden border-b bg-muted/30 px-4 py-4">
          <div className="max-w-4xl mx-auto space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <LayoutTemplate className="w-4 h-4" />
                  Şablon Seçimi
                </h3>
                <select
                  value={prefs.template}
                  onChange={(e) => setTemplate(e.target.value as PrintTemplate)}
                  className="border rounded-md px-3 py-1.5 text-sm bg-background"
                >
                  {PRINT_TEMPLATES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {PRINT_TEMPLATES.find(t => t.value === prefs.template) && (
                <p className="text-xs text-muted-foreground mt-2">
                  {PRINT_TEMPLATES.find(t => t.value === prefs.template)!.description}
                </p>
              )}
            </Card>

            {prefs.template !== "namelist" && (
              <>
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Sütun Görünürlüğü</h3>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Ayarları Sıfırla
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Gizlenen sütunlar yazdırma çıktısından tamamen kaldırılır. Kalan sütunlar genişleyerek boş alanı doldurur.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COLUMNS.map((col) => {
                      const hidden = isColumnHidden(col.key);
                      const isLastVisible = !hidden && visibleColumns.length === 1;
                      return (
                        <button
                          key={col.key}
                          onClick={() => toggleColumnVisibility(col.key)}
                          disabled={isLastVisible}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                            isLastVisible
                              ? "bg-muted border-border text-muted-foreground cursor-not-allowed opacity-50"
                              : hidden
                                ? "bg-destructive/10 border-destructive/30 text-destructive cursor-pointer"
                                : "bg-primary/10 border-primary/30 text-primary cursor-pointer"
                          }`}
                        >
                          {hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                </Card>

                {(prefs.template === "standard" || prefs.template === "portrait") && (
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Sütun Yazı Boyutu</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Her sütunun yazı boyutunu ayrı ayrı ayarlayabilirsiniz.
                    </p>
                    <div className="space-y-2">
                      {visibleColumns.map((col) => (
                        <div key={col.key} className="flex items-center gap-3">
                          <span className="text-xs font-medium w-32 truncate">{col.label}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setColumnFontSize(col.key, Math.max(8, getColumnFontSize(col.key) - 1))}
                          >
                            −
                          </Button>
                          <span className="text-xs font-mono w-8 text-center">{getColumnFontSize(col.key)}px</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setColumnFontSize(col.key, Math.min(36, getColumnFontSize(col.key) + 1))}
                          >
                            +
                          </Button>
                          {prefs.columnFontSizes[col.key] && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() => updatePrefs((prev) => {
                                const next = { ...prev.columnFontSizes };
                                delete next[col.key];
                                return { ...prev, columnFontSizes: next };
                              })}
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Koşullu İçerik Gizleme</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Belirli cinslerde sütun içeriğini boş bırakmak için sütunu seçin ve cins türlerini işaretleyin.
                  </p>
                  {allCinsTypes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Henüz cinsi bilgisi olan bağışçı yok.</p>
                  ) : (
                    <div className="space-y-2">
                      {COLUMNS.filter((c) => !["hayvan", "cinsi", "sira", "vekalet", "adina-kesilen"].includes(c.key)).map((col) => {
                        const isOpen = contentRulesOpen === col.key;
                        const rules = prefs.contentHideRules[col.key] || [];
                        const activeCount = rules.length;
                        return (
                          <div key={col.key} className="border rounded-lg">
                            <button
                              onClick={() => setContentRulesOpen(isOpen ? null : col.key)}
                              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
                            >
                              <span className="flex items-center gap-2">
                                {col.label}
                                {activeCount > 0 && (
                                  <span className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                                    {activeCount} cins gizli
                                  </span>
                                )}
                              </span>
                              {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            {isOpen && (
                              <div className="px-3 pb-3 pt-1 border-t">
                                <div className="flex flex-wrap gap-2">
                                  {allCinsTypes.map((type) => {
                                    const isChecked = rules.some(
                                      (r) => r.toLowerCase() === type.toLowerCase()
                                    );
                                    return (
                                      <label
                                        key={type}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition-colors ${
                                          isChecked
                                            ? "bg-destructive/10 border-destructive/30 text-destructive"
                                            : "bg-background border-border text-foreground hover:bg-muted"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleContentHideRule(col.key, type)}
                                          className="rounded w-3 h-3"
                                        />
                                        {type}
                                        {isChecked && <span className="text-[10px]">(gizle)</span>}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      {prefs.template === "standard" && renderStandardTemplate()}
      {prefs.template === "portrait" && renderPortraitTemplate()}
      {prefs.template === "compact" && renderCompactTemplate()}
      {prefs.template === "namelist" && renderNameListTemplate()}
      {prefs.template === "summary" && renderSummaryTemplate()}
    </div>
  );
}
