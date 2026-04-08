import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ChevronDown, ChevronUp, Eye, EyeOff, FileSpreadsheet, FileText, LayoutTemplate, Loader2, Printer, QrCode, RotateCcw, Settings2 } from "lucide-react";
import type { KesimAlani, AnimalGroup } from "@/lib/types";
import { fetchKesimAlani, fetchLogo, downloadExcelExport } from "@/lib/api";
import {
  loadPrintPreferences,
  savePrintPreferences,
  resetPrintPreferences,
  DEFAULT_PRINT_PREFS,
  PRINT_TEMPLATES,
} from "@/lib/storage";
import type { PrintPreferences, PrintTemplate } from "@/lib/storage";
import { COLUMNS, CONTENT_HIDE_ALLOWED_COLUMNS, DEFAULT_FONT_SIZES } from "./printHelpers";
import { StandardTemplate, PortraitTemplate, CompactTemplate, NameListTemplate, SummaryTemplate } from "./templates";

export default function PrintPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [contentRulesOpen, setContentRulesOpen] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<PrintPreferences>(() => loadPrintPreferences());
  const [excelExporting, setExcelExporting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        if (!params.id) { setLocation("/"); return; }
        const data = await fetchKesimAlani(params.id);
        if (!data) { setLocation("/"); return; }
        setKesim(data);
        try { const logoData = await fetchLogo(); setLogo(logoData); } catch { setLogo(null); }
      } catch { setLocation("/"); } finally { setIsLoading(false); }
    }
    loadData();
  }, [params.id, setLocation]);

  const updatePrefs = useCallback((updater: (prev: PrintPreferences) => PrintPreferences) => {
    setPrefs((prev) => { const next = updater(prev); savePrintPreferences(next); return next; });
  }, []);

  const allCinsTypes = useMemo(() => {
    if (!kesim) return [];
    const types = new Set<string>();
    for (const group of kesim.animalGroups) {
      for (const d of group.donations) {
        if (d.donationType && d.donationType.trim()) types.add(d.donationType.trim());
      }
    }
    return Array.from(types).sort((a, b) => a.localeCompare(b, "tr"));
  }, [kesim]);

  const processedGroups = useMemo((): AnimalGroup[] => kesim ? kesim.animalGroups : [], [kesim]);

  const isColumnHidden = useCallback((key: string) => prefs.hiddenColumns.includes(key), [prefs.hiddenColumns]);
  const visibleColumns = useMemo(() => COLUMNS.filter((c) => !isColumnHidden(c.key)), [isColumnHidden]);

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
    if (!CONTENT_HIDE_ALLOWED_COLUMNS.includes(columnKey)) return false;
    const rules = prefs.contentHideRules[columnKey];
    if (!rules || rules.length === 0) return false;
    return rules.some((r) => r.toLowerCase() === cinsi.trim().toLowerCase());
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
    setPrefs({ ...DEFAULT_PRINT_PREFS, contentHideRules: { ...DEFAULT_PRINT_PREFS.contentHideRules }, columnFontSizes: {} });
  }

  function getColumnFontSize(key: string): number { return prefs.columnFontSizes[key] || DEFAULT_FONT_SIZES[key] || 13; }
  function setColumnFontSize(key: string, size: number) { updatePrefs((prev) => ({ ...prev, columnFontSizes: { ...prev.columnFontSizes, [key]: size } })); }
  function setTemplate(t: PrintTemplate) { updatePrefs((prev) => ({ ...prev, template: t })); }

  const trackingUrl = useMemo(() => {
    if (!kesim?.trackingToken) return null;
    return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/takip/${kesim.trackingToken}`;
  }, [kesim?.trackingToken]);

  const pageStyle = useMemo(() => {
    if (prefs.template === "portrait" || prefs.template === "namelist") return `@page { size: A4 portrait; margin: 0; }`;
    return `@page { size: A4 landscape; margin: 0; }`;
  }, [prefs.template]);

  if (isLoading || !kesim) {
    return (<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>);
  }

  const templateProps = { kesim, processedGroups, logo, prefs, visibleColumns, isColumnHidden, shouldHideContent, getColumnFontSize, trackingUrl };

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: pageStyle }} />
      <div className="print:hidden p-4 flex items-center gap-3 bg-background border-b sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/kesim/${kesim.id}`)} aria-label="Kesim alanına geri dön">
          <ArrowLeft className="w-4 h-4 mr-1" aria-hidden="true" />Geri
        </Button>
        <div className="flex-1"><h1 className="text-lg font-semibold">{kesim.name} - Yazdırma Önizleme</h1></div>
        <Button variant="outline" size="sm" onClick={() => setOptionsOpen(!optionsOpen)} aria-expanded={optionsOpen} aria-label="Yazdırma seçenekleri">
          <Settings2 className="w-4 h-4 mr-1" aria-hidden="true" />Yazdırma Seçenekleri
          {optionsOpen ? <ChevronUp className="w-4 h-4 ml-1" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />}
        </Button>
        <Button variant="outline" size="sm" disabled={processedGroups.length === 0 || excelExporting} onClick={async () => {
          setExcelExporting(true);
          try {
            const blob = await downloadExcelExport(kesim.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${kesim.name.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ ]/g, "").replace(/\s+/g, "_")}_kesim_kagidi.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
          } catch { /* ignore */ } finally { setExcelExporting(false); }
        }}>
          {excelExporting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" />Excel...</> : <><FileSpreadsheet className="w-4 h-4 mr-1" aria-hidden="true" />Excel</>}
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} disabled={processedGroups.length === 0} title="Tarayıcı yazdırma diyaloğunda PDF olarak kaydedin" aria-label="PDF olarak indir">
          <FileText className="w-4 h-4 mr-1" aria-hidden="true" />PDF İndir
        </Button>
        <Button onClick={() => window.print()} aria-label="Sayfayı yazdır"><Printer className="w-4 h-4 mr-2" aria-hidden="true" />Yazdır</Button>
      </div>

      {optionsOpen && (
        <div className="print:hidden border-b bg-muted/30 px-4 py-4">
          <div className="max-w-4xl mx-auto space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><LayoutTemplate className="w-4 h-4" />Şablon Seçimi</h3>
                <select value={prefs.template} onChange={(e) => setTemplate(e.target.value as PrintTemplate)} className="border rounded-md px-3 py-1.5 text-sm bg-background">
                  {PRINT_TEMPLATES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
              </div>
              {PRINT_TEMPLATES.find(t => t.value === prefs.template) && (
                <p className="text-xs text-muted-foreground mt-2">{PRINT_TEMPLATES.find(t => t.value === prefs.template)!.description}</p>
              )}
            </Card>

            {trackingUrl && (
              <Card className="p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={prefs.showQrCode} onChange={(e) => updatePrefs((prev) => ({ ...prev, showQrCode: e.target.checked }))} className="rounded w-4 h-4" />
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-1.5"><QrCode className="w-4 h-4" />QR Kod Göster</div>
                    <p className="text-xs text-muted-foreground">Her sayfanın köşesinde takip linki QR kodu basılsın.</p>
                  </div>
                </label>
              </Card>
            )}

            {prefs.template !== "namelist" && (
              <>
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Sütun Görünürlüğü</h3>
                    <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw className="w-3.5 h-3.5 mr-1" />Ayarları Sıfırla</Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Gizlenen sütunlar yazdırma çıktısından tamamen kaldırılır. Kalan sütunlar genişleyerek boş alanı doldurur.</p>
                  <div className="flex flex-wrap gap-2">
                    {COLUMNS.map((col) => {
                      const hidden = isColumnHidden(col.key);
                      const isLastVisible = !hidden && visibleColumns.length === 1;
                      return (
                        <button key={col.key} onClick={() => toggleColumnVisibility(col.key)} disabled={isLastVisible}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${isLastVisible ? "bg-muted border-border text-muted-foreground cursor-not-allowed opacity-50" : hidden ? "bg-destructive/10 border-destructive/30 text-destructive cursor-pointer" : "bg-primary/10 border-primary/30 text-primary cursor-pointer"}`}>
                          {hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}{col.label}
                        </button>
                      );
                    })}
                  </div>
                </Card>

                {(prefs.template === "standard" || prefs.template === "portrait") && (
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Sütun Yazı Boyutu</h3>
                    <p className="text-xs text-muted-foreground mb-3">Her sütunun yazı boyutunu ayrı ayrı ayarlayabilirsiniz.</p>
                    <div className="space-y-2">
                      {visibleColumns.map((col) => (
                        <div key={col.key} className="flex items-center gap-3">
                          <span className="text-xs font-medium w-32 truncate">{col.label}</span>
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setColumnFontSize(col.key, Math.max(8, getColumnFontSize(col.key) - 1))}>−</Button>
                          <span className="text-xs font-mono w-8 text-center">{getColumnFontSize(col.key)}px</span>
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setColumnFontSize(col.key, Math.min(36, getColumnFontSize(col.key) + 1))}>+</Button>
                          {prefs.columnFontSizes[col.key] && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => updatePrefs((prev) => { const next = { ...prev.columnFontSizes }; delete next[col.key]; return { ...prev, columnFontSizes: next }; })}>
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
                  <p className="text-xs text-muted-foreground mb-3">Belirli cinslerde sütun içeriğini boş bırakmak için sütunu seçin ve cins türlerini işaretleyin.</p>
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
                            <button onClick={() => setContentRulesOpen(isOpen ? null : col.key)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors">
                              <span className="flex items-center gap-2">
                                {col.label}
                                {activeCount > 0 && (<span className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full text-[10px] font-semibold">{activeCount} cins gizli</span>)}
                              </span>
                              {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            {isOpen && (
                              <div className="px-3 pb-3 pt-1 border-t">
                                <div className="flex flex-wrap gap-2">
                                  {allCinsTypes.map((type) => {
                                    const isChecked = rules.some((r) => r.toLowerCase() === type.toLowerCase());
                                    return (
                                      <label key={type} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition-colors ${isChecked ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-background border-border text-foreground hover:bg-muted"}`}>
                                        <input type="checkbox" checked={isChecked} onChange={() => toggleContentHideRule(col.key, type)} className="rounded w-3 h-3" />
                                        {type}{isChecked && <span className="text-[10px]">(gizle)</span>}
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

      {prefs.template === "standard" && <StandardTemplate {...templateProps} />}
      {prefs.template === "portrait" && <PortraitTemplate {...templateProps} />}
      {prefs.template === "compact" && <CompactTemplate {...templateProps} />}
      {prefs.template === "namelist" && <NameListTemplate {...templateProps} />}
      {prefs.template === "summary" && <SummaryTemplate {...templateProps} />}
    </div>
  );
}
