import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

type FilterMode = "all" | "pending" | "done";

interface DashboardToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterMode: FilterMode;
  onFilterChange: (m: FilterMode) => void;
  filteredCount: number;
  totalCount: number;
}

const TABS: { mode: FilterMode; label: string }[] = [
  { mode: "all", label: "Tümü" },
  { mode: "pending", label: "Bekleyen" },
  { mode: "done", label: "Kesildi" },
];

export function DashboardToolbar({
  searchQuery, onSearchChange, filterMode, onFilterChange, filteredCount, totalCount,
}: DashboardToolbarProps) {
  const [local, setLocal] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLocal(searchQuery); }, [searchQuery]);

  const handleChange = (v: string) => {
    setLocal(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(v), 300);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl border mb-3"
      style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.14)" }}
      role="search"
      aria-label="Hayvan arama ve filtreleme"
    >
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#94a3b8" }} aria-hidden="true" />
        <input
          type="search"
          placeholder="Hayvan no, isim, vekalet arayın..."
          value={local}
          onChange={e => handleChange(e.target.value)}
          className="w-full h-9 pl-9 pr-8 text-sm rounded-xl border outline-none transition-all"
          style={{
            background: "#071827",
            borderColor: "rgba(148,163,184,0.20)",
            color: "#f8fafc",
          }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(0,201,134,0.50)"; }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(148,163,184,0.20)"; }}
          aria-label="Hayvan veya bağışçı ara"
        />
        {local && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center"
            onClick={() => { setLocal(""); onSearchChange(""); }}
            aria-label="Aramayı temizle"
          >
            <X className="w-3.5 h-3.5" style={{ color: "#94a3b8" }} />
          </button>
        )}
      </div>

      {/* Status tabs */}
      <div
        className="flex items-center gap-0.5 p-1 rounded-xl"
        style={{ background: "rgba(148,163,184,0.08)" }}
        role="tablist"
        aria-label="Durum filtresi"
      >
        {TABS.map(({ mode, label }) => (
          <button
            key={mode}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={
              filterMode === mode
                ? { background: "#0b1a2b", color: "#00c986", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }
                : { color: "#94a3b8" }
            }
            onClick={() => onFilterChange(mode)}
            role="tab"
            aria-selected={filterMode === mode}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Count */}
      {(local || filterMode !== "all") && (
        <span className="text-xs font-medium ml-auto" style={{ color: "#94a3b8" }} aria-live="polite">
          {filteredCount} / {totalCount}
        </span>
      )}
    </div>
  );
}
