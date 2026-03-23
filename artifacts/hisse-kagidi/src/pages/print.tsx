import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Printer, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import type { KesimAlani, AnimalGroup } from "@/lib/types";
import { getKesimAlani, loadLogo } from "@/lib/storage";

function getSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

export default function PrintPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [hideVekaletTypes, setHideVekaletTypes] = useState<Set<string>>(new Set(["Vacip", "VACİB", "vacib", "Vacib"]));
  const [sortBySurname, setSortBySurname] = useState(false);

  useEffect(() => {
    if (params.id) {
      const data = getKesimAlani(params.id);
      if (data) setKesim(data);
      else setLocation("/");
    }
    setLogo(loadLogo());
  }, [params.id, setLocation]);

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

    return kesim.animalGroups.map((group) => {
      let donations = [...group.donations];

      if (sortBySurname) {
        const filled = donations.filter((d) => d.name.trim() || d.description.trim());
        const empty = donations.filter((d) => !d.name.trim() && !d.description.trim());

        filled.sort((a, b) => {
          const surnameA = getSurname(a.description || a.name);
          const surnameB = getSurname(b.description || b.name);
          return surnameA.localeCompare(surnameB, "tr");
        });

        donations = [...filled, ...empty].slice(0, 7);
        while (donations.length < 7) {
          donations.push(group.donations[donations.length] || {
            id: Math.random().toString(36).substring(2, 12),
            name: "",
            description: "",
            donationType: "",
            shareCount: 1,
            vekalet: "",
            notes: "",
          });
        }
      }

      return { ...group, donations };
    });
  }, [kesim, sortBySurname]);

  function toggleHideType(type: string) {
    setHideVekaletTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function shouldHideVekaleti(cinsi: string): boolean {
    if (!cinsi) return false;
    const normalized = cinsi.trim();
    for (const type of hideVekaletTypes) {
      if (normalized.toLowerCase() === type.toLowerCase()) return true;
    }
    return false;
  }

  function handlePrint() {
    window.print();
  }

  if (!kesim) return null;

  return (
    <div>
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
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Yazdır
        </Button>
      </div>

      {optionsOpen && (
        <div className="print:hidden border-b bg-muted/30 px-4 py-4">
          <div className="max-w-4xl mx-auto space-y-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Vekaleti Veren Gizleme</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Seçili cinslerde "Vekaleti Veren" sütunu yazdırmada boş bırakılır.
              </p>
              {allCinsTypes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Henüz cinsi bilgisi olan bağışçı yok.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allCinsTypes.map((type) => {
                    const isChecked = shouldHideVekaleti(type);
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
                          onChange={() => toggleHideType(type)}
                          className="rounded w-3 h-3"
                        />
                        {type}
                        {isChecked && <span className="text-[10px]">(gizle)</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Sıralama</h3>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sortBySurname}
                  onChange={(e) => setSortBySurname(e.target.checked)}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm">Soyadına göre alfabetik sırala</span>
                <span className="text-xs text-muted-foreground">(her gruptaki satırları vekaleti veren/adına kesilen soyadına göre sıralar)</span>
              </label>
            </Card>
          </div>
        </div>
      )}

      <div className="print-pages">
        {processedGroups.map((group) => (
          <div key={group.id} className="print-page">
            {logo && (
              <div className="page-logo-header">
                <img src={logo} alt="Logo" className="page-logo-img" />
              </div>
            )}

            <div className="page-content">
              <table className="kesim-table">
                <thead>
                  <tr>
                    <th className="col-hayvan">HAYVAN</th>
                    <th className="col-sira">SIRA</th>
                    <th className="col-vekalet">VEKALET</th>
                    <th className="col-vekaleti-veren">VEKALETİ VEREN</th>
                    <th className="col-adina-kesilen">ADINA KESİLEN</th>
                    <th className="col-cinsi">CİNSİ</th>
                    <th className="col-notlar">NOTLAR</th>
                  </tr>
                </thead>
                <tbody>
                  {group.donations.map((d, idx) => (
                    <tr key={d.id}>
                      {idx === 0 && (
                        <td className="hayvan-cell" rowSpan={7}>
                          <div className="hayvan-number">{group.animalNo}</div>
                        </td>
                      )}
                      <td className="sira-cell">{idx + 1}</td>
                      <td className="vekalet-cell">{d.vekalet || ""}</td>
                      <td className="vekaleti-veren-cell">
                        {shouldHideVekaleti(d.donationType) ? "" : (d.description || "")}
                      </td>
                      <td className="adina-kesilen-cell">{d.name || ""}</td>
                      <td className="cinsi-cell">{d.donationType || ""}</td>
                      <td className="notlar-cell">{d.notes || ""}</td>
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
    </div>
  );
}
