import type { KesimAlani, Donation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

interface DonorListReportProps {
  kesim: KesimAlani;
  donorListReportOpen: boolean;
  setDonorListReportOpen: (v: boolean) => void;
  sortedDonorList: Donation[];
}

export function DonorListReport({
  kesim, donorListReportOpen, setDonorListReportOpen, sortedDonorList,
}: DonorListReportProps) {
  if (!donorListReportOpen) return null;

  const sorted = sortedDonorList;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setDonorListReportOpen(false); }}>
      <div className="bg-background rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        <div className="no-print sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between rounded-t-xl shrink-0">
          <h2 className="font-semibold text-sm">Bağışçı Listesi</h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.print()}>
              <Printer className="w-3 h-3 mr-1" /> Yazdır / PDF
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDonorListReportOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-4 donor-list-print">
          <div className="text-center mb-4">
            <h3 className="font-bold text-lg">{kesim.name}</h3>
            <p className="text-xs text-muted-foreground">Bağışçı Listesi — {sortedDonorList.filter(d => !d.excluded).length} kişi</p>
            <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-foreground/20">
                <th className="text-left py-1.5 px-2 font-semibold">#</th>
                <th className="text-left py-1.5 px-2 font-semibold">Adına Kesilen</th>
                <th className="text-left py-1.5 px-2 font-semibold">Vekaleti Veren</th>
                <th className="text-left py-1.5 px-2 font-semibold">Cinsi</th>
                <th className="text-right py-1.5 px-2 font-semibold">Hisse</th>
                <th className="text-left py-1.5 px-2 font-semibold">Vekalet</th>
                <th className="text-left py-1.5 px-2 font-semibold">Notlar</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, idx) => (
                <tr key={d.id} className={idx % 2 === 0 ? "" : "bg-muted/30"}>
                  <td className="py-1 px-2 text-muted-foreground">{idx + 1}</td>
                  <td className="py-1 px-2 font-medium">{d.name}</td>
                  <td className="py-1 px-2">{d.description}</td>
                  <td className="py-1 px-2">{d.donationType}</td>
                  <td className="py-1 px-2 text-right">{d.shareCount}</td>
                  <td className="py-1 px-2">{d.vekalet}</td>
                  <td className="py-1 px-2 text-muted-foreground">{d.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 pt-2 border-t text-[10px] text-muted-foreground flex justify-between">
            <span>{kesim.name} — Bağışçı Listesi</span>
            <span>{new Date().toLocaleDateString("tr-TR")} {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
