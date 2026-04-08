import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  sortBy: string;
  setSortBy: (v: string) => void;
  sortDir: "asc" | "desc";
  setSortDir: (fn: (d: "asc" | "desc") => "asc" | "desc") => void;
  setPage: (p: number) => void;
  stats: PoolStats | undefined;
  kesimAlanlari: { id: string; name: string }[];
}

export function PoolFilters({
  statusFilter, setStatusFilter,
  kesimAlaniFilter, setKesimAlaniFilter,
  donationTypeFilter, setDonationTypeFilter,
  birimFilter, setBirimFilter,
  temsilciFilter, setTemsilciFilter,
  aiCategoryFilter, setAiCategoryFilter,
  sortBy, setSortBy,
  sortDir, setSortDir,
  setPage,
  stats,
  kesimAlanlari,
}: PoolFiltersProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-3 p-3 border rounded-lg bg-muted/30">
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

      <Input
        placeholder="AI Etiketi..."
        value={aiCategoryFilter}
        onChange={e => { setAiCategoryFilter(e.target.value); setPage(0); }}
        className="h-8 text-xs"
      />

      <Select value={sortBy} onValueChange={v => { setSortBy(v); setPage(0); }}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sıralama" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="sortOrder">Varsayılan</SelectItem>
          <SelectItem value="name">İsim</SelectItem>
          <SelectItem value="shareCount">Hisse</SelectItem>
          <SelectItem value="donationType">Cinsi</SelectItem>
          <SelectItem value="birim">Birim</SelectItem>
          <SelectItem value="temsilci">Temsilci</SelectItem>
          <SelectItem value="kesimAlaniId">Kesim Listesi</SelectItem>
          <SelectItem value="vekalet">Vekalet</SelectItem>
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
  );
}
