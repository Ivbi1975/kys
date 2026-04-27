import { QRCodeSVG } from "qrcode.react";
import type { KesimAlani, AnimalGroup } from "@/lib/types";
import type { PrintPreferences } from "@/lib/storage";
import type { ColumnKey } from "./printHelpers";
import { COLUMNS, getAiLabel, getCellContent, trUpper } from "./printHelpers";

interface TemplateProps {
  kesim: KesimAlani;
  processedGroups: AnimalGroup[];
  logo: string | null;
  prefs: PrintPreferences;
  visibleColumns: readonly { key: string; label: string }[];
  isColumnHidden: (key: string) => boolean;
  shouldHideContent: (columnKey: string, cinsi: string) => boolean;
  getColumnFontSize: (key: string) => number;
  trackingUrl: string | null;
}

function renderAnimalTable({ group, visibleColumns, isColumnHidden, shouldHideContent, getColumnFontSize }: {
  group: AnimalGroup;
  visibleColumns: readonly { key: string; label: string }[];
  isColumnHidden: (key: string) => boolean;
  shouldHideContent: (columnKey: string, cinsi: string) => boolean;
  getColumnFontSize: (key: string) => number;
}) {
  return (
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
              <td className="hayvan-cell" rowSpan={group.donations.length} style={{ fontSize: `${getColumnFontSize("hayvan")}px` }}>
                <div className="hayvan-number" style={{ fontSize: `${getColumnFontSize("hayvan")}px` }}>{group.animalNo}</div>
              </td>
            )}
            {visibleColumns.filter((col) => col.key !== "hayvan").map((col) => {
              if (col.key === "sira") {
                return <td key={col.key} className="sira-cell" style={{ fontSize: `${getColumnFontSize("sira")}px` }}>{shouldHideContent("sira", d.donationType) ? "" : idx + 1}</td>;
              }
              const content = getCellContent(col.key as ColumnKey, d);
              const hidden = shouldHideContent(col.key, d.donationType);
              return <td key={col.key} className={`${col.key}-cell`} style={{ fontSize: `${getColumnFontSize(col.key)}px` }}>{hidden ? "" : content}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PageFooter({ kesim, trackingUrl, showQrCode }: { kesim: KesimAlani; pageLabel: string; trackingUrl: string | null; showQrCode: boolean }) {
  return (
    <>
      <div className="page-footer">
        <span>{kesim.displayName || kesim.name}</span>
      </div>
      {showQrCode && trackingUrl && (
        <div className="print-qr-code">
          <QRCodeSVG value={trackingUrl} size={60} level="M" />
        </div>
      )}
    </>
  );
}

export function StandardTemplate(props: TemplateProps) {
  const { kesim, processedGroups, logo, prefs, trackingUrl, ...rest } = props;
  return (
    <div className="print-pages">
      {processedGroups.map((group) => (
        <div key={group.id} className="print-page">
          <div className="page-header-row">
            {logo && <img src={logo} alt="Logo" className="page-logo-img" />}
            <div className="page-header-title">{kesim.displayName || kesim.name}</div>
          </div>
          <div className="page-content">
            {renderAnimalTable({ group, ...rest })}
          </div>
          <PageFooter kesim={kesim} pageLabel={`Sayfa ${group.animalNo} / ${kesim.animalGroups.length}`} trackingUrl={trackingUrl} showQrCode={prefs.showQrCode} />
        </div>
      ))}
    </div>
  );
}

export function PortraitTemplate(props: TemplateProps) {
  const { kesim, processedGroups, logo, prefs, trackingUrl, ...rest } = props;
  return (
    <div className="print-pages template-portrait">
      {processedGroups.map((group) => (
        <div key={group.id} className="print-page print-page-portrait">
          <div className="page-header-row">
            {logo && <img src={logo} alt="Logo" className="page-logo-img" />}
            <div className="page-header-title">{kesim.displayName || kesim.name}</div>
          </div>
          <div className="page-content">
            {renderAnimalTable({ group, ...rest })}
          </div>
          <PageFooter kesim={kesim} pageLabel={`Sayfa ${group.animalNo} / ${kesim.animalGroups.length}`} trackingUrl={trackingUrl} showQrCode={prefs.showQrCode} />
        </div>
      ))}
    </div>
  );
}

export function CompactTemplate(props: TemplateProps) {
  const { kesim, processedGroups, logo, prefs, isColumnHidden, shouldHideContent, trackingUrl } = props;
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
            <div className="page-header-title" style={{ fontSize: "14px" }}>{kesim.displayName || kesim.name}</div>
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
                  const donorNames = filledDonors.filter(d => !shouldHideContent("adina-kesilen", d.donationType)).map(d => trUpper(d.name)).join(", ");
                  const vekaletNames = filledDonors.filter(d => !shouldHideContent("vekaleti-veren", d.donationType)).map(d => trUpper(d.description || d.name)).filter(Boolean).join(", ");
                  const cinsTypes = [...new Set(filledDonors.filter(d => !shouldHideContent("cinsi", d.donationType)).map(d => trUpper(d.donationType)).filter(Boolean))].join(", ");
                  const groupNotes = [...new Set(filledDonors.filter(d => !shouldHideContent("notlar", d.donationType)).map(d => {
                    const note = d.notes ? trUpper(d.notes) : "";
                    const ai = getAiLabel(d);
                    if (note && ai) return `${note} [${ai}]`;
                    if (note) return note;
                    if (ai) return `[${ai}]`;
                    return "";
                  }).filter(Boolean))].join("; ");
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
          <PageFooter kesim={kesim} pageLabel={`Sayfa ${pageIdx + 1} / ${pages.length}`} trackingUrl={trackingUrl} showQrCode={prefs.showQrCode} />
        </div>
      ))}
    </div>
  );
}

export function NameListTemplate(props: TemplateProps) {
  const { kesim, processedGroups, logo, prefs, shouldHideContent, trackingUrl } = props;
  const allDonations: { animalNo: number; idx: number; name: string; description: string; shareCount: number; donationType: string; vekalet: string }[] = [];
  for (const group of processedGroups) {
    group.donations.forEach((d, idx) => {
      if (d.name.trim()) {
        allDonations.push({ animalNo: group.animalNo, idx: idx + 1, name: d.name, description: d.description || "", shareCount: d.shareCount, donationType: d.donationType || "", vekalet: d.vekalet || "" });
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
            <div className="page-header-title" style={{ fontSize: "14px" }}>{kesim.displayName || kesim.name} - Bağışçı Listesi</div>
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
                    <td>{trUpper(d.name)}</td>
                    <td>{trUpper(d.description || d.name)}</td>
                    <td style={{ textAlign: "center" }}>{trUpper(d.donationType)}</td>
                    <td style={{ textAlign: "center" }}>{d.shareCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PageFooter kesim={kesim} pageLabel={`Sayfa ${pageIdx + 1} / ${pages.length} — Toplam ${allDonations.length} bağışçı`} trackingUrl={trackingUrl} showQrCode={prefs.showQrCode} />
        </div>
      ))}
    </div>
  );
}

export function SummaryTemplate(props: TemplateProps) {
  const { kesim, processedGroups, logo, prefs, isColumnHidden, shouldHideContent, trackingUrl } = props;
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
            <div className="page-header-title" style={{ fontSize: "16px" }}>{kesim.displayName || kesim.name} - Özet Rapor</div>
          </div>
          <div className="page-content">
            {pageIdx === 0 && (
              <>
                <div className="summary-stats-grid">
                  <div className="summary-stat-card"><div className="summary-stat-value">{processedGroups.length}</div><div className="summary-stat-label">Toplam Hayvan</div></div>
                  <div className="summary-stat-card"><div className="summary-stat-value">{totalDonors}</div><div className="summary-stat-label">Toplam Bağışçı</div></div>
                  <div className="summary-stat-card"><div className="summary-stat-value">{totalShares}</div><div className="summary-stat-label">Toplam Hisse</div></div>
                  <div className="summary-stat-card"><div className="summary-stat-value">{filledSlots}/{totalSlots}</div><div className="summary-stat-label">Dolu/Toplam Slot</div></div>
                  <div className="summary-stat-card"><div className="summary-stat-value">{emptySlots}</div><div className="summary-stat-label">Boş Slot</div></div>
                  <div className="summary-stat-card"><div className="summary-stat-value">{totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0}%</div><div className="summary-stat-label">Doluluk Oranı</div></div>
                </div>
                {showCins && cinsBreakdown.size > 0 && (
                  <div className="summary-section">
                    <h3 className="summary-section-title">Cins Dağılımı</h3>
                    <div className="summary-cins-grid">
                      {[...cinsBreakdown.entries()].sort((a, b) => b[1] - a[1]).map(([cins, count]) => (
                        <div key={cins} className="summary-cins-item"><span className="summary-cins-name">{cins}</span><span className="summary-cins-count">{count}</span></div>
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
                    const names = filled.filter(d => !shouldHideContent("adina-kesilen", d.donationType)).map(d => trUpper(d.name)).join(", ");
                    const vekalets = filled.filter(d => !shouldHideContent("vekaleti-veren", d.donationType)).map(d => trUpper(d.description)).filter(Boolean).join(", ");
                    const types = [...new Set(filled.filter(d => !shouldHideContent("cinsi", d.donationType)).map(d => trUpper(d.donationType)).filter(Boolean))].join(", ");
                    const notes = [...new Set(filled.filter(d => !shouldHideContent("notlar", d.donationType)).map(d => {
                      const note = d.notes ? trUpper(d.notes) : "";
                      const ai = getAiLabel(d);
                      if (note && ai) return `${note} [${ai}]`;
                      if (note) return note;
                      if (ai) return `[${ai}]`;
                      return "";
                    }).filter(Boolean))].join("; ");
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
          <PageFooter kesim={kesim} pageLabel={`Sayfa ${pageIdx + 1} / ${totalPages}`} trackingUrl={trackingUrl} showQrCode={prefs.showQrCode} />
        </div>
      ))}
    </div>
  );
}
