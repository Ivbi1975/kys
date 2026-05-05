import { FileText, Sun } from "lucide-react";

interface DashboardTopbarProps {
  kesimAlaniName: string;
  projectName?: string;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  onShowReport: () => void;
}

export function DashboardTopbar({
  kesimAlaniName,
  projectName,
  highContrast,
  onToggleHighContrast,
  onShowReport,
}: DashboardTopbarProps) {
  return (
    <header
      className="shrink-0 flex items-center gap-4 px-5 py-3 border-b"
      style={{
        background: "#06111f",
        borderColor: "rgba(148,163,184,0.10)",
        minHeight: 60,
      }}
    >

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-bold truncate" style={{ color: "#f8fafc" }}>
          {kesimAlaniName}
        </h1>
        <p className="text-xs truncate" style={{ color: "#94a3b8" }}>
          {projectName || "Kesim Takip Paneli"}
        </p>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleHighContrast}
          className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border font-semibold transition-all min-h-[36px] ${
            highContrast
              ? "bg-yellow-400 border-yellow-400 text-black"
              : "border-white/10 hover:border-white/20 hover:bg-white/5"
          }`}
          style={!highContrast ? { color: "#94a3b8" } : {}}
          aria-label={highContrast ? "Yüksek kontrast kapat" : "Yüksek kontrast aç"}
          aria-pressed={highContrast}
        >
          <Sun className="w-3.5 h-3.5" aria-hidden="true" />
          HC
        </button>

        <button
          onClick={onShowReport}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border font-medium transition-all min-h-[36px] hover:bg-white/5"
          style={{ color: "#94a3b8", borderColor: "rgba(148,163,184,0.20)" }}
          aria-label="Durum raporunu görüntüle"
        >
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Durum Raporu</span>
        </button>
      </div>
    </header>
  );
}
