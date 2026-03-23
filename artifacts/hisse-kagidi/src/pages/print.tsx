import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import { getKesimAlani } from "@/lib/storage";

export default function PrintPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [kesim, setKesim] = useState<KesimAlani | null>(null);

  useEffect(() => {
    if (params.id) {
      const data = getKesimAlani(params.id);
      if (data) setKesim(data);
      else setLocation("/");
    }
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
            <div className="page-header">
              <div className="page-header-left">
                <h1 className="page-main-title">{kesim.name}</h1>
              </div>
              <div className="page-header-right">
                <div className="page-logo">
                  <svg viewBox="0 0 80 80" width="60" height="60">
                    <circle cx="40" cy="40" r="38" fill="none" stroke="#2563eb" strokeWidth="2" />
                    <text x="40" y="35" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#2563eb">KURBAN</text>
                    <text x="40" y="50" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#2563eb">HİSSE</text>
                  </svg>
                </div>
              </div>
            </div>

            <div className="animal-title">
              {kesim.name} - HAYVAN NO: {group.animalNo}
            </div>

            <table className="hisse-table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>Sıra</th>
                  <th>Bağışçı Adı Soyadı</th>
                  <th>Açıklama</th>
                  <th>Bağış Türü</th>
                </tr>
              </thead>
              <tbody>
                {group.donations.map((d, idx) => (
                  <tr key={d.id}>
                    <td className="text-center font-bold">{idx + 1}</td>
                    <td>{d.name}</td>
                    <td>{d.description}</td>
                    <td>{d.donationType}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="page-footer">
              <span>Sayfa {group.animalNo} / {kesim.animalGroups.length}</span>
              <span>{new Date().toLocaleDateString("tr-TR")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
