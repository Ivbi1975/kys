import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Hayvan no, isim, vekalet ara..."
          value={localQuery}
          onChange={(e) => handleChange(e.target.value)}
          className="pl-9 h-11 min-h-[44px] text-sm"
          aria-label="Hayvan veya bağışçı ara"
        />
        {localQuery && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={handleClear}
            aria-label="Aramayı temizle"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
      <div className="flex gap-1.5" role="tablist" aria-label="Kesim durumu filtresi">
        {([["all", "Tümü"], ["pending", "Bekleyen"], ["done", "Kesildi"]] as const).map(([mode, label]) => (
          <button
            key={mode}
            className={`text-xs px-4 py-2 min-h-[44px] rounded-full border transition-colors ${
              filterMode === mode
                ? "bg-primary text-primary-foreground border-primary font-semibold"
                : "bg-background border-border hover:bg-muted"
            }`}
            onClick={() => onFilterChange(mode)}
            role="tab"
            aria-selected={filterMode === mode}
            aria-label={`${label} filtresi${filterMode === mode ? " (seçili)" : ""}`}
          >
            {label}
          </button>
        ))}
        {(localQuery || filterMode !== "all") && (
          <span className="text-xs text-muted-foreground self-center ml-auto" aria-live="polite">
            {filteredCount} / {totalCount}
          </span>
        )}
      </div>
    </div>
  );
}
