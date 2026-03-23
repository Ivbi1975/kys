import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import { getKesimAlani, loadLogo } from "@/lib/storage";

export default function PrintPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      const data = getKesimAlani(params.id);
      if (data) setKesim(data);
      else setLocation("/");
    }
    setLogo(loadLogo());
  }, [params.id, setLocation]);

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
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Yazdır
        </Button>
      </div>

      <div className="print-pages">
        {kesim.animalGroups.map((group) => (
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
                      <td className="vekaleti-veren-cell">{d.description || ""}</td>
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
