import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, ChevronDown, Check, Ban } from "lucide-react";
import type { PoolStats, CustomTag } from "@/lib/types";

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
  tagFilter: string[];
  setTagFilter: (v: string[]) => void;
  notesFilter: string;
  setNotesFilter: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  sortDir: "asc" | "desc";
  setSortDir: (fn: (d: "asc" | "desc") => "asc" | "desc") => void;
  sortBy2: string;
  setSortBy2: (v: string) => void;
  sortDir2: "asc" | "desc";
  setSortDir2: (fn: (d: "asc" | "desc") => "asc" | "desc") => void;
  sortBy3: string;
  setSortBy3: (v: string) => void;
  sortDir3: "asc" | "desc";
  setSortDir3: (fn: (d: "asc" | "desc") => "asc" | "desc") => void;
  shareCountMin: string;
  setShareCountMin: (v: string) => void;
  shareCountMax: string;
  setShareCountMax: (v: string) => void;
  excludeFields: Set<string>;
  toggleExcludeField: (field: string) => void;
  dateField: string;
  setDateField: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  stats: PoolStats | undefined;
  kesimAlanlari: { id: string; name: string }[];
  globalTags: CustomTag[];
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  excluded,
  onToggleExclude,
}: {
  label: string;
  options: { value: string; count?: number; label?: string; color?: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  excluded?: boolean;
  onToggleExclude?: () => void;
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

  const mergedOptions = useMemo(() => {
    const optSet = new Set(options.map(o => o.value));
    const missing: typeof options = selected
      .filter(s => !optSet.has(s))
      .map(s => ({ value: s, count: 0, label: s === "__empty__" ? "(Boş)" : undefined, color: undefined }));
    return [...options, ...missing];
  }, [options, selected]);

  const optMap = new Map(mergedOptions.map(o => [o.value, o]));
  const getDisplay = (val: string) => optMap.get(val)?.label || val;

  const filtered = mergedOptions.filter(o => {
    if (!filterText) return true;
    const text = (o.label || o.value).toLocaleLowerCase("tr");
    return text.includes(filterText.toLocaleLowerCase("tr"));
  });

  return (
    <div className="relative" ref={ref}>
      <div className="flex gap-0.5">
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center justify-between flex-1 h-8 px-2.5 text-xs border rounded-md bg-background hover:bg-muted/50 transition-colors ${selected.length > 0 ? (excluded ? "border-destructive/50 ring-1 ring-destructive/20" : "border-primary/50 ring-1 ring-primary/20") : "border-input"}`}
        >
          <span className="truncate text-left">
            {selected.length === 0 ? label : `${excluded ? "⊘ " : ""}${label} (${selected.length})`}
          </span>
          <ChevronDown className="w-3.5 h-3.5 ml-1 text-muted-foreground flex-shrink-0" />
        </button>
        {selected.length > 0 && onToggleExclude && (
          <button
            onClick={onToggleExclude}
            title={excluded ? "Dahil et moduna geç" : "Hariç tut moduna geç"}
            className={`h-8 w-7 flex items-center justify-center rounded-md border text-xs transition-colors ${excluded ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20" : "bg-muted/30 border-input text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
          >
            <Ban className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
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
              const displayText = opt.label || opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => toggle(opt.value)}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-muted/50 text-left ${isChecked ? "bg-primary/5" : ""}`}
                >
                  <span className={`flex-shrink-0 w-4 h-4 border rounded flex items-center justify-center ${isChecked ? "bg-primary border-primary text-primary-foreground" : "border-input"}`}>
                    {isChecked && <Check className="w-3 h-3" />}
                  </span>
                  {opt.color && (
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
                  )}
                  <span className="truncate flex-1">{displayText}</span>
                  {opt.count !== undefined && (
                    <span className="text-muted-foreground ml-1 flex-shrink-0">({opt.count})</span>
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
          {selected.slice(0, 3).map(s => {
            const disp = getDisplay(s);
            const col = optMap.get(s)?.color;
            return (
              <Badge key={s} variant={excluded ? "destructive" : "secondary"} className="text-[10px] h-4 px-1 flex items-center gap-0.5">
                {col && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col }} />}
                {excluded && "⊘ "}
                {disp.length > 12 ? disp.slice(0, 12) + "…" : disp}
                <button onClick={() => toggle(s)} className="hover:text-destructive ml-0.5"><X className="w-2.5 h-2.5" /></button>
              </Badge>
            );
          })}
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

const SORT_OPTIONS = [
  { value: "sortOrder", label: "Varsayılan" },
  { value: "name", label: "Adına Kesilen" },
  { value: "description", label: "Vekaleti Veren" },
  { value: "donationType", label: "Cinsi" },
  { value: "birim", label: "Birim" },
  { value: "temsilci", label: "Temsilci" },
  { value: "kesimAlaniId", label: "Kesim Listesi" },
  { value: "vekalet", label: "Vekalet" },
  { value: "ozellik", label: "Özellik" },
  { value: "fiyat", label: "Fiyat" },
  { value: "yerTalebi", label: "Yer Talebi" },
  { value: "gunTalebi", label: "Gün Talebi" },
  { value: "ilkHayvan", label: "İlk Hayvan" },
  { value: "safi", label: "Şafi" },
  { value: "shareCount", label: "Hisse Sayısı" },
  { value: "updatedAt", label: "Güncelleme Tarihi" },
];

function CompactSortLevel({
  label,
  value,
  dir,
  onChange,
  onDirChange,
}: {
  label: string;
  value: string;
  dir: "asc" | "desc";
  onChange: (v: string) => void;
  onDirChange: () => void;
}) {
  return (
    <div className="flex gap-1 items-center flex-1 min-w-0">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
      <Select value={value || "sortOrder"} onValueChange={v => onChange(v === "sortOrder" ? "" : v)}>
        <SelectTrigger className="h-7 text-xs flex-1 min-w-0"><SelectValue /></SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && value !== "sortOrder" && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px] px-1.5"
          onClick={onDirChange}
        >
          {dir === "asc" ? "↑" : "↓"}
        </Button>
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
  tagFilter, setTagFilter,
  notesFilter, setNotesFilter,
  sortBy, setSortBy,
  sortDir, setSortDir,
  sortBy2, setSortBy2,
  sortDir2, setSortDir2,
  sortBy3, setSortBy3,
  sortDir3, setSortDir3,
  shareCountMin, setShareCountMin,
  shareCountMax, setShareCountMax,
  excludeFields, toggleExcludeField,
  dateField, setDateField,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  stats,
  kesimAlanlari,
  globalTags,
}: PoolFiltersProps) {
  const tagCountMap = new Map<string, number>();
  if (stats?.tagDistribution) {
    for (const t of stats.tagDistribution) {
      tagCountMap.set(t.id, t.count);
    }
  }

  const kesimAlaniCountMap = new Map<string, number>();
  if (stats?.kesimAlaniDistribution) {
    for (const k of stats.kesimAlaniDistribution) {
      kesimAlaniCountMap.set(k.id, k.count);
    }
  }

  return (
    <div className="mb-3 p-3 border rounded-lg bg-muted/30 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        <div>
          <span className="block text-xs text-muted-foreground mb-0.5">Durum</span>
          <Select value={statusFilter || "all"} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="excluded">Sepette</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <span className="block text-xs text-muted-foreground mb-0.5">Kesim Listesi</span>
          <Select value={kesimAlaniFilter || "all"} onValueChange={v => setKesimAlaniFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Kesim Listesi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {kesimAlanlari.map(ka => {
                const cnt = kesimAlaniCountMap.get(ka.id);
                return (
                  <SelectItem key={ka.id} value={ka.id}>
                    {ka.name}{cnt !== undefined ? ` (${cnt})` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {stats && (stats.typeDistribution.length > 0 || (stats.empty_type_count ?? 0) > 0 || donationTypeFilter.length > 0) && (
          <div>
            <span className="block text-xs text-muted-foreground mb-0.5">Cinsi</span>
            <MultiSelectDropdown
              label="Cinsi"
              options={[
                ...stats.typeDistribution.map(t => ({ value: t.type, count: t.count })),
                ...((stats.empty_type_count ?? 0) > 0 ? [{ value: "__empty__", count: stats.empty_type_count, label: "(Boş)" }] : []),
              ]}
              selected={donationTypeFilter}
              onChange={setDonationTypeFilter}
              excluded={excludeFields.has("donationType")}
              onToggleExclude={() => toggleExcludeField("donationType")}
            />
          </div>
        )}

        {stats && (stats.birimDistribution.length > 0 || (stats.empty_birim_count ?? 0) > 0 || birimFilter.length > 0) && (
          <div>
            <span className="block text-xs text-muted-foreground mb-0.5">Birim</span>
            <MultiSelectDropdown
              label="Birim"
              options={[
                ...stats.birimDistribution.map(b => ({ value: b.birim, count: b.count })),
                ...((stats.empty_birim_count ?? 0) > 0 ? [{ value: "__empty__", count: stats.empty_birim_count, label: "(Boş)" }] : []),
              ]}
              selected={birimFilter}
              onChange={setBirimFilter}
              excluded={excludeFields.has("birim")}
              onToggleExclude={() => toggleExcludeField("birim")}
            />
          </div>
        )}

        {stats && (stats.temsilciDistribution.length > 0 || (stats.empty_temsilci_count ?? 0) > 0 || temsilciFilter.length > 0) && (
          <div>
            <span className="block text-xs text-muted-foreground mb-0.5">Temsilci</span>
            <MultiSelectDropdown
              label="Temsilci"
              options={[
                ...stats.temsilciDistribution.map(t => ({ value: t.temsilci, count: t.count })),
                ...((stats.empty_temsilci_count ?? 0) > 0 ? [{ value: "__empty__", count: stats.empty_temsilci_count, label: "(Boş)" }] : []),
              ]}
              selected={temsilciFilter}
              onChange={setTemsilciFilter}
              excluded={excludeFields.has("temsilci")}
              onToggleExclude={() => toggleExcludeField("temsilci")}
            />
          </div>
        )}

        {stats && ((stats.ozellikDistribution && stats.ozellikDistribution.length > 0) || (stats.empty_ozellik_count ?? 0) > 0 || ozellikFilter.length > 0) && (
          <div>
            <span className="block text-xs text-muted-foreground mb-0.5">Özellik</span>
            <MultiSelectDropdown
              label="Özellik"
              options={[
                ...(stats.ozellikDistribution || []).map(o => ({ value: o.ozellik, count: o.count })),
                ...((stats.empty_ozellik_count ?? 0) > 0 ? [{ value: "__empty__", count: stats.empty_ozellik_count, label: "(Boş)" }] : []),
              ]}
              selected={ozellikFilter}
              onChange={setOzellikFilter}
              excluded={excludeFields.has("ozellik")}
              onToggleExclude={() => toggleExcludeField("ozellik")}
            />
          </div>
        )}

        {stats && ((stats.fiyatDistribution && stats.fiyatDistribution.length > 0) || (stats.empty_fiyat_count ?? 0) > 0 || fiyatFilter.length > 0) && (
          <div>
            <span className="block text-xs text-muted-foreground mb-0.5">Fiyat</span>
            <MultiSelectDropdown
              label="Fiyat"
              options={[
                ...(stats.fiyatDistribution || []).map(f => ({ value: f.fiyat, count: f.count })),
                ...((stats.empty_fiyat_count ?? 0) > 0 ? [{ value: "__empty__", count: stats.empty_fiyat_count, label: "(Boş)" }] : []),
              ]}
              selected={fiyatFilter}
              onChange={setFiyatFilter}
              excluded={excludeFields.has("fiyat")}
              onToggleExclude={() => toggleExcludeField("fiyat")}
            />
          </div>
        )}

        {stats && ((stats.yerTalebiDistribution && stats.yerTalebiDistribution.length > 0) || (stats.empty_yer_talebi_count ?? 0) > 0 || yerTalebiFilter.length > 0) && (
          <div>
            <span className="block text-xs text-muted-foreground mb-0.5">Yer Talebi</span>
            <MultiSelectDropdown
              label="Yer Talebi"
              options={[
                ...(stats.yerTalebiDistribution || []).map(y => ({ value: y.yerTalebi, count: y.count })),
                ...((stats.empty_yer_talebi_count ?? 0) > 0 ? [{ value: "__empty__", count: stats.empty_yer_talebi_count, label: "(Boş)" }] : []),
              ]}
              selected={yerTalebiFilter}
              onChange={setYerTalebiFilter}
              excluded={excludeFields.has("yerTalebi")}
              onToggleExclude={() => toggleExcludeField("yerTalebi")}
            />
          </div>
        )}

        {stats && ((stats.gunTalebiDistribution && stats.gunTalebiDistribution.length > 0) || (stats.empty_gun_talebi_count ?? 0) > 0 || gunTalebiFilter.length > 0) && (
          <div>
            <span className="block text-xs text-muted-foreground mb-0.5">Gün Talebi</span>
            <MultiSelectDropdown
              label="Gün Talebi"
              options={[
                ...(stats.gunTalebiDistribution || []).map(g => ({ value: g.gunTalebi, count: g.count })),
                ...((stats.empty_gun_talebi_count ?? 0) > 0 ? [{ value: "__empty__", count: stats.empty_gun_talebi_count, label: "(Boş)" }] : []),
              ]}
              selected={gunTalebiFilter}
              onChange={setGunTalebiFilter}
              excluded={excludeFields.has("gunTalebi")}
              onToggleExclude={() => toggleExcludeField("gunTalebi")}
            />
          </div>
        )}

        {stats && ((stats.ilkHayvanDistribution && stats.ilkHayvanDistribution.length > 0) || (stats.empty_ilk_hayvan_count ?? 0) > 0 || ilkHayvanFilter.length > 0) && (
          <div>
            <span className="block text-xs text-muted-foreground mb-0.5">İlk Hayvan</span>
            <MultiSelectDropdown
              label="İlk Hayvan"
              options={[
                ...(stats.ilkHayvanDistribution || []).map(i => ({ value: i.ilkHayvan, count: i.count })),
                ...((stats.empty_ilk_hayvan_count ?? 0) > 0 ? [{ value: "__empty__", count: stats.empty_ilk_hayvan_count, label: "(Boş)" }] : []),
              ]}
              selected={ilkHayvanFilter}
              onChange={setIlkHayvanFilter}
              excluded={excludeFields.has("ilkHayvan")}
              onToggleExclude={() => toggleExcludeField("ilkHayvan")}
            />
          </div>
        )}

        {stats && ((stats.safiDistribution && stats.safiDistribution.length > 0) || (stats.empty_safi_count ?? 0) > 0 || safiFilter.length > 0) && (
          <div>
            <span className="block text-xs text-muted-foreground mb-0.5">Şafi</span>
            <MultiSelectDropdown
              label="Şafi"
              options={[
                ...(stats.safiDistribution || []).map(s => ({ value: s.safi, count: s.count })),
                ...((stats.empty_safi_count ?? 0) > 0 ? [{ value: "__empty__", count: stats.empty_safi_count, label: "(Boş)" }] : []),
              ]}
              selected={safiFilter}
              onChange={setSafiFilter}
              excluded={excludeFields.has("safi")}
              onToggleExclude={() => toggleExcludeField("safi")}
            />
          </div>
        )}

        {globalTags.length > 0 && (
          <div>
            <span className="block text-xs text-muted-foreground mb-0.5">Etiket</span>
            <MultiSelectDropdown
              label="Etiket"
              options={globalTags.map(t => ({
                value: t.id,
                count: tagCountMap.get(t.id) ?? undefined,
                label: t.name,
                color: t.color,
              }))}
              selected={tagFilter}
              onChange={setTagFilter}
              excluded={excludeFields.has("tags")}
              onToggleExclude={() => toggleExcludeField("tags")}
            />
          </div>
        )}

        <div>
          <span className="block text-xs text-muted-foreground mb-0.5">AI Etiketi</span>
          <div className="flex gap-0.5">
            <Input
              placeholder="AI Etiketi..."
              value={aiCategoryFilter}
              onChange={e => setAiCategoryFilter(e.target.value)}
              className={`h-8 text-xs flex-1 ${aiCategoryFilter && excludeFields.has("aiCategory") ? "border-destructive/50 ring-1 ring-destructive/20" : ""}`}
            />
            {aiCategoryFilter && (
              <button
                onClick={() => toggleExcludeField("aiCategory")}
                title={excludeFields.has("aiCategory") ? "Dahil et moduna geç" : "Hariç tut moduna geç"}
                className={`h-8 w-7 flex items-center justify-center rounded-md border text-xs transition-colors ${excludeFields.has("aiCategory") ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20" : "bg-muted/30 border-input text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
              >
                <Ban className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Hisse:</span>
        <Input
          type="number"
          min={1}
          placeholder="Min"
          value={shareCountMin}
          onChange={e => setShareCountMin(e.target.value)}
          className="h-7 text-xs w-16"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="number"
          min={1}
          placeholder="Max"
          value={shareCountMax}
          onChange={e => setShareCountMax(e.target.value)}
          className="h-7 text-xs w-16"
        />
        <Select value={dateField || "updatedAt"} onValueChange={v => setDateField(v)}>
          <SelectTrigger className="h-7 text-[10px] w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt">Güncelleme Tarihi</SelectItem>
            <SelectItem value="transfer">Aktarım Tarihi</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="h-7 text-xs w-32"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="h-7 text-xs w-32"
        />
      </div>

      <div className="flex flex-wrap gap-2 items-start">
        <div className="flex-1 min-w-[200px]">
          <NotesMultiFilter value={notesFilter} onChange={setNotesFilter} />
        </div>
        <div className="flex gap-2 items-center flex-wrap flex-1 min-w-[320px]">
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Sıralama:</span>
          <CompactSortLevel
            label="1."
            value={sortBy}
            dir={sortDir}
            onChange={setSortBy}
            onDirChange={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
          />
          <CompactSortLevel
            label="2."
            value={sortBy2}
            dir={sortDir2}
            onChange={setSortBy2}
            onDirChange={() => setSortDir2(d => d === "asc" ? "desc" : "asc")}
          />
          <CompactSortLevel
            label="3."
            value={sortBy3}
            dir={sortDir3}
            onChange={setSortBy3}
            onDirChange={() => setSortDir3(d => d === "asc" ? "desc" : "asc")}
          />
        </div>
      </div>
    </div>
  );
}
