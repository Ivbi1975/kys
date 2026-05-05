import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

type FilterMode = "all" | "pending" | "done";

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
  filteredCount: number;
  totalCount: number;
}

const FILTERS: { mode: FilterMode; label: string; activeClass: string }[] = [
  { mode: "all", label: "Tümü", activeClass: "bg-stone-800 text-white border-stone-800" },
  { mode: "pending", label: "Bekleyen", activeClass: "bg-amber-500 text-white border-amber-500" },
  { mode: "done", label: "Kesildi", activeClass: "bg-teal-600 text-white border-teal-600" },
];

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  filterMode,
  onFilterChange,
  filteredCount,
  totalCount,
}: SearchFilterBarProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleChange = (value: string) => {
    setLocalQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  };

  const handleClear = () => {
    setLocalQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearchChange("");
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="mb-3 space-y-2" role="search" aria-label="Hayvan arama ve filtreleme">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          placeholder="Hayvan no, isim, vekalet ara..."
          value={localQuery}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full pl-10 pr-10 h-11 min-h-[44px] text-sm bg-white border border-stone-200 rounded-xl outline-none transition-all placeholder:text-stone-400 text-stone-800 focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          aria-label="Hayvan veya bağışçı ara"
        />
        {localQuery && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors"
            onClick={handleClear}
            aria-label="Aramayı temizle"
          >
            <X className="w-3.5 h-3.5 text-stone-400" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5" role="tablist" aria-label="Kesim durumu filtresi">
        {FILTERS.map(({ mode, label, activeClass }) => (
          <button
            key={mode}
            className={`text-xs px-4 py-2 min-h-[36px] rounded-full border font-medium transition-all ${
              filterMode === mode
                ? activeClass
                : "bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50"
            }`}
            onClick={() => onFilterChange(mode)}
            role="tab"
            aria-selected={filterMode === mode}
          >
            {label}
          </button>
        ))}
        {(localQuery || filterMode !== "all") && (
          <span className="text-xs text-stone-400 ml-auto font-medium" aria-live="polite">
            {filteredCount} / {totalCount}
          </span>
        )}
      </div>
    </div>
  );
}
