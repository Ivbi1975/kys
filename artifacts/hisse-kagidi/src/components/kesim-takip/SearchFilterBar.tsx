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
  return (
    <div className="mb-3 space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Hayvan no, isim, vekalet ara..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
        {searchQuery && (
          <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => onSearchChange("")}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
      <div className="flex gap-1">
        {([["all", "Tümü"], ["pending", "Bekleyen"], ["done", "Kesildi"]] as const).map(([mode, label]) => (
          <button
            key={mode}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filterMode === mode
                ? "bg-primary text-primary-foreground border-primary font-semibold"
                : "bg-background border-border hover:bg-muted"
            }`}
            onClick={() => onFilterChange(mode)}
          >
            {label}
          </button>
        ))}
        {(searchQuery || filterMode !== "all") && (
          <span className="text-xs text-muted-foreground self-center ml-auto">
            {filteredCount} / {totalCount}
          </span>
        )}
      </div>
    </div>
  );
}
