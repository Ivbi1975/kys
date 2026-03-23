import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Printer, Settings2, ChevronDown, ChevronUp, RotateCcw, Eye, EyeOff, FileSpreadsheet, FileText, LayoutTemplate } from "lucide-react";
import type { KesimAlani, AnimalGroup } from "@/lib/types";
import { fetchKesimAlani, fetchLogo } from "@/lib/api";
import * as XLSX from "xlsx";
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

  function shouldHideContent(columnKey: string, cinsi: string): boolean {
    if (!cinsi) return false;
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
    });
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
    const headers = visibleColumns.map(c => c.label);
    const rows: (string | number)[][] = [];

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
        rows.push(row);
      }
    }

    const sheetData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    const hayvanColIdx = visibleColumns.findIndex(c => c.key === "hayvan");
    if (hayvanColIdx >= 0) {
      let rowIdx = 1;
      for (const group of processedGroups) {
        if (group.donations.length > 1) {
          const merge = { s: { r: rowIdx, c: hayvanColIdx }, e: { r: rowIdx + group.donations.length - 1, c: hayvanColIdx } };
          if (!ws["!merges"]) ws["!merges"] = [];
          ws["!merges"].push(merge);
        }
        rowIdx += group.donations.length;
      }
    }

    const colWidths = visibleColumns.map(c => {
      if (c.key === "hayvan" || c.key === "sira") return { wch: 8 };
      if (c.key === "vekalet") return { wch: 12 };
      if (c.key === "cinsi") return { wch: 10 };
      return { wch: 22 };
    });
    ws["!cols"] = colWidths;

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
                        <td className="hayvan-cell" rowSpan={7}>
                          <div className="hayvan-number">{group.animalNo}</div>
                        </td>
                      )}
                      {visibleColumns.filter((col) => col.key !== "hayvan").map((col) => {
                        if (col.key === "sira") {
                          return <td key={col.key} className="sira-cell">{shouldHideContent("sira", d.donationType) ? "" : idx + 1}</td>;
                        }
                        const content = getCellContent(col.key, d);
                        const hidden = shouldHideContent(col.key, d.donationType);
                        return <td key={col.key} className={`${col.key}-cell`}>{hidden ? "" : content}</td>;
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
                        <td className="hayvan-cell" rowSpan={7}>
                          <div className="hayvan-number">{group.animalNo}</div>
                        </td>
                      )}
                      {visibleColumns.filter((col) => col.key !== "hayvan").map((col) => {
                        if (col.key === "sira") {
                          return <td key={col.key} className="sira-cell">{shouldHideContent("sira", d.donationType) ? "" : idx + 1}</td>;
                        }
                        const content = getCellContent(col.key, d);
                        const hidden = shouldHideContent(col.key, d.donationType);
                        return <td key={col.key} className={`${col.key}-cell`}>{hidden ? "" : content}</td>;
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
    const groupsPerPage = 3;
    const pages: AnimalGroup[][] = [];
    for (let i = 0; i < processedGroups.length; i += groupsPerPage) {
      pages.push(processedGroups.slice(i, i + groupsPerPage));
    }

    return (
      <div className="print-pages template-compact">
        {pages.map((pageGroups, pageIdx) => (
          <div key={pageIdx} className="print-page print-page-compact">
            <div className="page-header-row">
              {logo && <img src={logo} alt="Logo" className="page-logo-img" style={{ maxHeight: "10mm" }} />}
              <div className="page-header-title" style={{ fontSize: "14px" }}>{kesim.name}</div>
            </div>
            <div className="page-content compact-content">
              {pageGroups.map((group) => (
                <div key={group.id} className="compact-group">
                  <table className="kesim-table compact-table dynamic-columns">
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
                            <td className="hayvan-cell" rowSpan={7}>
                              <div className="hayvan-number">{group.animalNo}</div>
                            </td>
                          )}
                          {visibleColumns.filter((col) => col.key !== "hayvan").map((col) => {
                            if (col.key === "sira") {
                              return <td key={col.key} className="sira-cell">{shouldHideContent("sira", d.donationType) ? "" : idx + 1}</td>;
                            }
                            const content = getCellContent(col.key, d);
                            const hidden = shouldHideContent(col.key, d.donationType);
                            return <td key={col.key} className={`${col.key}-cell`}>{hidden ? "" : content}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <LayoutTemplate className="w-4 h-4" />
                  Şablon Seçimi
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {PRINT_TEMPLATES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTemplate(t.value)}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      prefs.template === t.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-6 h-8 rounded border flex items-center justify-center text-[8px] font-bold ${
                        t.value === "standard" ? "border-primary" :
                        t.value === "portrait" ? "border-primary w-5 h-7" :
                        t.value === "compact" ? "border-primary" :
                        "border-primary"
                      }`}>
                        {t.value === "standard" && <span className="rotate-90">A4</span>}
                        {t.value === "portrait" && "A4"}
                        {t.value === "compact" && <span className="text-[6px]">3x</span>}
                        {t.value === "namelist" && <span className="text-[6px]">☰</span>}
                      </div>
                      <span className="text-xs font-semibold">{t.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{t.description}</p>
                  </button>
                ))}
              </div>
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

                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Koşullu İçerik Gizleme</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Belirli cinslerde sütun içeriğini boş bırakmak için sütunu seçin ve cins türlerini işaretleyin.
                  </p>
                  {allCinsTypes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Henüz cinsi bilgisi olan bağışçı yok.</p>
                  ) : (
                    <div className="space-y-2">
                      {COLUMNS.filter((c) => c.key !== "hayvan").map((col) => {
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
    </div>
  );
}
