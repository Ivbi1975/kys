import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import type { PoolStats } from "@/lib/types";

interface PoolFiltersProps {
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  kesimAlaniFilter: string;
  setKesimAlaniFilter: (v: string) => void;
  donationTypeFilter: string;
  setDonationTypeFilter: (v: string) => void;
  birimFilter: string;
  setBirimFilter: (v: string) => void;
  temsilciFilter: string;
  setTemsilciFilter: (v: string) => void;
  aiCategoryFilter: string;
  setAiCategoryFilter: (v: string) => void;
  ozellikFilter: string;
  setOzellikFilter: (v: string) => void;
  fiyatFilter: string;
  setFiyatFilter: (v: string) => void;
  yerTalebiFilter: string;
  setYerTalebiFilter: (v: string) => void;
  gunTalebiFilter: string;
  setGunTalebiFilter: (v: string) => void;
  ilkHayvanFilter: string;
  setIlkHayvanFilter: (v: string) => void;
  safiFilter: string;
  setSafiFilter: (v: string) => void;
  notesFilter: string;
  setNotesFilter: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  sortDir: "asc" | "desc";
  setSortDir: (fn: (d: "asc" | "desc") => "asc" | "desc") => void;
  setPage: (p: number) => void;
  stats: PoolStats | undefined;
  kesimAlanlari: { id: string; name: string }[];
}

function NotesMultiFilter({ value, onChange, setPage }: { value: string; onChange: (v: string) => void; setPage: (p: number) => void }) {
  const terms = value ? value.split(",").map(t => t.trim()).filter(Boolean) : [];
  const [inputVal, setInputVal] = useState("");

  function addTerm() {
    const t = inputVal.trim();
    if (!t) return;
    const next = [...terms, t].join(",");
    onChange(next);
    setInputVal("");
    setPage(0);
  }

  function removeTerm(idx: number) {
    const next = terms.filter((_, i) => i !== idx).join(",");
    onChange(next);
    setPage(0);
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
  setPage,
  stats,
  kesimAlanlari,
}: PoolFiltersProps) {
  return (
    <div className="mb-3 p-3 border rounded-lg bg-muted/30 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === "all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Durum" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="excluded">Sepette</SelectItem>
          </SelectContent>
        </Select>

        <Select value={kesimAlaniFilter} onValueChange={v => { setKesimAlaniFilter(v === "all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Kesim Listesi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            {kesimAlanlari.map(ka => (
              <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {stats && stats.typeDistribution.length > 0 && (
          <Select value={donationTypeFilter} onValueChange={v => { setDonationTypeFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cinsi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {stats.typeDistribution.map(t => (
                <SelectItem key={t.type} value={t.type}>{t.type} ({t.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {stats && stats.birimDistribution.length > 0 && (
          <Select value={birimFilter} onValueChange={v => { setBirimFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Birim" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {stats.birimDistribution.map(b => (
                <SelectItem key={b.birim} value={b.birim}>{b.birim} ({b.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {stats && stats.temsilciDistribution.length > 0 && (
          <Select value={temsilciFilter} onValueChange={v => { setTemsilciFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Temsilci" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {stats.temsilciDistribution.map(t => (
                <SelectItem key={t.temsilci} value={t.temsilci}>{t.temsilci} ({t.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {stats && stats.ozellikDistribution && stats.ozellikDistribution.length > 0 && (
          <Select value={ozellikFilter} onValueChange={v => { setOzellikFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Özellik" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {stats.ozellikDistribution.map(o => (
                <SelectItem key={o.ozellik} value={o.ozellik}>{o.ozellik} ({o.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {stats && stats.fiyatDistribution && stats.fiyatDistribution.length > 0 && (
          <Select value={fiyatFilter} onValueChange={v => { setFiyatFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Fiyat" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {stats.fiyatDistribution.map(f => (
                <SelectItem key={f.fiyat} value={f.fiyat}>{f.fiyat} ({f.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {stats && stats.yerTalebiDistribution && stats.yerTalebiDistribution.length > 0 && (
          <Select value={yerTalebiFilter} onValueChange={v => { setYerTalebiFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Yer Talebi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {stats.yerTalebiDistribution.map(y => (
                <SelectItem key={y.yerTalebi} value={y.yerTalebi}>{y.yerTalebi} ({y.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {stats && stats.gunTalebiDistribution && stats.gunTalebiDistribution.length > 0 && (
          <Select value={gunTalebiFilter} onValueChange={v => { setGunTalebiFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Gün Talebi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {stats.gunTalebiDistribution.map(g => (
                <SelectItem key={g.gunTalebi} value={g.gunTalebi}>{g.gunTalebi} ({g.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {stats && stats.ilkHayvanDistribution && stats.ilkHayvanDistribution.length > 0 && (
          <Select value={ilkHayvanFilter} onValueChange={v => { setIlkHayvanFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="İlk Hayvan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {stats.ilkHayvanDistribution.map(i => (
                <SelectItem key={i.ilkHayvan} value={i.ilkHayvan}>{i.ilkHayvan} ({i.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {stats && stats.safiDistribution && stats.safiDistribution.length > 0 && (
          <Select value={safiFilter} onValueChange={v => { setSafiFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Şafi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {stats.safiDistribution.map(s => (
                <SelectItem key={s.safi} value={s.safi}>{s.safi} ({s.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Input
          placeholder="AI Etiketi..."
          value={aiCategoryFilter}
          onChange={e => { setAiCategoryFilter(e.target.value); setPage(0); }}
          className="h-8 text-xs"
        />
      </div>

      <NotesMultiFilter value={notesFilter} onChange={setNotesFilter} setPage={setPage} />

      <div className="flex gap-2">
        <Select value={sortBy} onValueChange={v => { setSortBy(v); setPage(0); }}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Sıralama" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sortOrder">Varsayılan</SelectItem>
            <SelectItem value="name">İsim</SelectItem>
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
