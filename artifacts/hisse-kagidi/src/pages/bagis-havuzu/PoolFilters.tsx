import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, ChevronDown, Check } from "lucide-react";
import type { PoolStats } from "@/lib/types";

interface PoolFiltersProps {
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  kesimAlaniFilter: string;
  setKesimAlaniFilter: (v: string) => void;
  donationTypeFilter: string[];
  setDonationTypeFilter: (v: string[]) => void;
  birimFilter: string[];
  setBirimFilter: (v: string[]) => void;
  temsilciFilter: string[];
  setTemsilciFilter: (v: string[]) => void;
  aiCategoryFilter: string;
  setAiCategoryFilter: (v: string) => void;
  ozellikFilter: string[];
  setOzellikFilter: (v: string[]) => void;
  fiyatFilter: string[];
  setFiyatFilter: (v: string[]) => void;
  yerTalebiFilter: string[];
  setYerTalebiFilter: (v: string[]) => void;
  gunTalebiFilter: string[];
  setGunTalebiFilter: (v: string[]) => void;
  ilkHayvanFilter: string[];
  setIlkHayvanFilter: (v: string[]) => void;
  safiFilter: string[];
  setSafiFilter: (v: string[]) => void;
  notesFilter: string;
  setNotesFilter: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  sortDir: "asc" | "desc";
  setSortDir: (fn: (d: "asc" | "desc") => "asc" | "desc") => void;
  stats: PoolStats | undefined;
  kesimAlanlari: { id: string; name: string }[];
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; count?: number }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const toggle = useCallback((val: string) => {
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
  }, [selected, onChange]);

  const filtered = options.filter(o =>
    !filterText || o.value.toLocaleLowerCase("tr").includes(filterText.toLocaleLowerCase("tr"))
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full h-8 px-2.5 text-xs border rounded-md bg-background hover:bg-muted/50 transition-colors ${selected.length > 0 ? "border-primary/50 ring-1 ring-primary/20" : "border-input"}`}
      >
        <span className="truncate text-left">
          {selected.length === 0 ? label : `${label} (${selected.length})`}
        </span>
        <ChevronDown className="w-3.5 h-3.5 ml-1 text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-background border rounded-lg shadow-lg min-w-[200px] max-w-[280px]">
          {options.length > 5 && (
            <div className="p-1.5 border-b">
              <Input
                placeholder="Ara..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-48 overflow-auto p-1">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground p-2 text-center">Sonuç yok</p>
            )}
            {filtered.map(opt => {
              const isChecked = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggle(opt.value)}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-muted/50 text-left ${isChecked ? "bg-primary/5" : ""}`}
                >
                  <span className={`flex-shrink-0 w-4 h-4 border rounded flex items-center justify-center ${isChecked ? "bg-primary border-primary text-primary-foreground" : "border-input"}`}>
                    {isChecked && <Check className="w-3 h-3" />}
                  </span>
                  <span className="truncate flex-1">{opt.value}</span>
                  {opt.count !== undefined && (
                    <span className="text-muted-foreground ml-1 flex-shrink-0">{opt.count}</span>
                  )}
                </button>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="border-t p-1">
              <button
                onClick={() => { onChange([]); setOpen(false); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 text-left rounded hover:bg-muted/50"
              >
                Temizle ({selected.length})
              </button>
            </div>
          )}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-1">
          {selected.slice(0, 3).map(s => (
            <Badge key={s} variant="secondary" className="text-[10px] h-4 px-1 flex items-center gap-0.5">
              {s.length > 12 ? s.slice(0, 12) + "…" : s}
              <button onClick={() => toggle(s)} className="hover:text-destructive ml-0.5"><X className="w-2.5 h-2.5" /></button>
            </Badge>
          ))}
          {selected.length > 3 && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">+{selected.length - 3}</Badge>
          )}
        </div>
      )}
    </div>
  );
}

function NotesMultiFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const terms = value ? value.split(",").map(t => t.trim()).filter(Boolean) : [];
  const [inputVal, setInputVal] = useState("");

  function addTerm() {
    const t = inputVal.trim();
    if (!t) return;
    const next = [...terms, t].join(",");
    onChange(next);
    setInputVal("");
  }

  function removeTerm(idx: number) {
    const next = terms.filter((_, i) => i !== idx).join(",");
    onChange(next);
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">Notlar (çoklu şart)</label>
      <div className="flex gap-1">
        <Input
          placeholder="Not filtresi ekle..."
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTerm(); } }}
          className="h-8 text-xs flex-1"
        />
        <Button variant="outline" size="sm" className="h-8 px-2" onClick={addTerm} disabled={!inputVal.trim()}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      {terms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {terms.map((t, i) => (
            <Badge key={i} variant="secondary" className="text-xs flex items-center gap-0.5 pr-1">
              {t}
              <button onClick={() => removeTerm(i)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function PoolFilters({
  statusFilter, setStatusFilter,
  kesimAlaniFilter, setKesimAlaniFilter,
  donationTypeFilter, setDonationTypeFilter,
  birimFilter, setBirimFilter,
  temsilciFilter, setTemsilciFilter,
  aiCategoryFilter, setAiCategoryFilter,
  ozellikFilter, setOzellikFilter,
  fiyatFilter, setFiyatFilter,
  yerTalebiFilter, setYerTalebiFilter,
  gunTalebiFilter, setGunTalebiFilter,
  ilkHayvanFilter, setIlkHayvanFilter,
  safiFilter, setSafiFilter,
  notesFilter, setNotesFilter,
  sortBy, setSortBy,
  sortDir, setSortDir,
  stats,
  kesimAlanlari,
}: PoolFiltersProps) {
  return (
    <div className="mb-3 p-3 border rounded-lg bg-muted/30 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        <Select value={statusFilter || "all"} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Durum" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="excluded">Sepette</SelectItem>
          </SelectContent>
        </Select>

        <Select value={kesimAlaniFilter || "all"} onValueChange={v => setKesimAlaniFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Kesim Listesi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            {kesimAlanlari.map(ka => (
              <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {stats && stats.typeDistribution.length > 0 && (
          <MultiSelectDropdown
            label="Cinsi"
            options={stats.typeDistribution.map(t => ({ value: t.type, count: t.count }))}
            selected={donationTypeFilter}
            onChange={setDonationTypeFilter}
          />
        )}

        {stats && stats.birimDistribution.length > 0 && (
          <MultiSelectDropdown
            label="Birim"
            options={stats.birimDistribution.map(b => ({ value: b.birim, count: b.count }))}
            selected={birimFilter}
            onChange={setBirimFilter}
          />
        )}

        {stats && stats.temsilciDistribution.length > 0 && (
          <MultiSelectDropdown
            label="Temsilci"
            options={stats.temsilciDistribution.map(t => ({ value: t.temsilci, count: t.count }))}
            selected={temsilciFilter}
            onChange={setTemsilciFilter}
          />
        )}

        {stats && stats.ozellikDistribution && stats.ozellikDistribution.length > 0 && (
          <MultiSelectDropdown
            label="Özellik"
            options={stats.ozellikDistribution.map(o => ({ value: o.ozellik, count: o.count }))}
            selected={ozellikFilter}
            onChange={setOzellikFilter}
          />
        )}

        {stats && stats.fiyatDistribution && stats.fiyatDistribution.length > 0 && (
          <MultiSelectDropdown
            label="Fiyat"
            options={stats.fiyatDistribution.map(f => ({ value: f.fiyat, count: f.count }))}
            selected={fiyatFilter}
            onChange={setFiyatFilter}
          />
        )}

        {stats && stats.yerTalebiDistribution && stats.yerTalebiDistribution.length > 0 && (
          <MultiSelectDropdown
            label="Yer Talebi"
            options={stats.yerTalebiDistribution.map(y => ({ value: y.yerTalebi, count: y.count }))}
            selected={yerTalebiFilter}
            onChange={setYerTalebiFilter}
          />
        )}

        {stats && stats.gunTalebiDistribution && stats.gunTalebiDistribution.length > 0 && (
          <MultiSelectDropdown
            label="Gün Talebi"
            options={stats.gunTalebiDistribution.map(g => ({ value: g.gunTalebi, count: g.count }))}
            selected={gunTalebiFilter}
            onChange={setGunTalebiFilter}
          />
        )}

        {stats && stats.ilkHayvanDistribution && stats.ilkHayvanDistribution.length > 0 && (
          <MultiSelectDropdown
            label="İlk Hayvan"
            options={stats.ilkHayvanDistribution.map(i => ({ value: i.ilkHayvan, count: i.count }))}
            selected={ilkHayvanFilter}
            onChange={setIlkHayvanFilter}
          />
        )}

        {stats && stats.safiDistribution && stats.safiDistribution.length > 0 && (
          <MultiSelectDropdown
            label="Şafi"
            options={stats.safiDistribution.map(s => ({ value: s.safi, count: s.count }))}
            selected={safiFilter}
            onChange={setSafiFilter}
          />
        )}

        <Input
          placeholder="AI Etiketi..."
          value={aiCategoryFilter}
          onChange={e => setAiCategoryFilter(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <NotesMultiFilter value={notesFilter} onChange={setNotesFilter} />

      <div className="flex gap-2">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Sıralama" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sortOrder">Varsayılan</SelectItem>
            <SelectItem value="name">Adına Kesilen</SelectItem>
            <SelectItem value="description">Vekaleti Veren</SelectItem>
            <SelectItem value="donationType">Cinsi</SelectItem>
            <SelectItem value="birim">Birim</SelectItem>
            <SelectItem value="temsilci">Temsilci</SelectItem>
            <SelectItem value="kesimAlaniId">Kesim Listesi</SelectItem>
            <SelectItem value="vekalet">Vekalet</SelectItem>
            <SelectItem value="ozellik">Özellik</SelectItem>
            <SelectItem value="fiyat">Fiyat</SelectItem>
            <SelectItem value="yerTalebi">Yer Talebi</SelectItem>
            <SelectItem value="gunTalebi">Gün Talebi</SelectItem>
            <SelectItem value="ilkHayvan">İlk Hayvan</SelectItem>
            <SelectItem value="safi">Şafi</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs px-2"
          onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
        >
          {sortDir === "asc" ? "A→Z" : "Z→A"}
        </Button>
      </div>
    </div>
  );
}
