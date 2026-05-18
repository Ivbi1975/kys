import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, X } from "lucide-react";
import { turkishTitleCase } from "@/lib/formatting";
import { useFilterContext } from "../KesimAlaniContext";

export function DonorAdvancedFilter() {
  const {
    activeFilterCount, availableAiCategories, clearAdvancedFilters, filterAiCategories,
    filterAiWarnings, filterCinsi, filterHisseMax, filterHisseMin, filterStatus,
    filterTags, globalTags, setFilterAiCategories, setFilterAiWarnings, setFilterCinsi,
    setFilterHisseMax, setFilterHisseMin, setFilterStatus, setFilterTags, uniqueDonationTypes,
  } = useFilterContext();

  return (
    <Card className="mb-3 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-1">
          <SlidersHorizontal className="w-4 h-4" />Gelişmiş Filtre
        </span>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAdvancedFilters}><X className="w-3 h-3 mr-1" />Temizle</Button>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Cinsi</label>
          <Select value={filterCinsi} onValueChange={setFilterCinsi}>
            <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {uniqueDonationTypes.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Hisse (min)</label>
          <Select value={String(filterHisseMin)} onValueChange={v => setFilterHisseMin(parseInt(v))}>
            <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">-</SelectItem>
              {[1,2,3,4,5,6,7].map(n => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Hisse (max)</label>
          <Select value={String(filterHisseMax)} onValueChange={v => setFilterHisseMax(parseInt(v))}>
            <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">-</SelectItem>
              {[1,2,3,4,5,6,7].map(n => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Durum</label>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "active" | "excluded")}>
            <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="excluded">Hariç</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {globalTags.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Etiketler</label>
            <div className="flex gap-1 flex-wrap">
              {globalTags.map(tag => {
                const isActive = filterTags.includes(tag.id);
                return (
                  <button key={tag.id} className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${isActive ? "ring-2 ring-offset-1 ring-primary text-white" : "opacity-60 hover:opacity-100 text-white"}`} style={{ backgroundColor: tag.color }} onClick={() => setFilterTags(isActive ? filterTags.filter(t => t !== tag.id) : [...filterTags, tag.id])}>
                    {turkishTitleCase(tag.name)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {availableAiCategories.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">AI Kategori</label>
            <div className="flex gap-1 flex-wrap">
              {availableAiCategories.map(cat => {
                const isActive = filterAiCategories.includes(cat);
                return (
                  <button key={cat} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${isActive ? "bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500" : "bg-muted hover:bg-violet-50 dark:hover:bg-violet-950"}`} onClick={() => setFilterAiCategories(isActive ? filterAiCategories.filter(c => c !== cat) : [...filterAiCategories, cat])}>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">AI Uyarılar</label>
          <button className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${filterAiWarnings ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 ring-2 ring-red-500" : "bg-muted hover:bg-red-50 dark:hover:bg-red-950"}`} onClick={() => setFilterAiWarnings(!filterAiWarnings)}>
            Uyarılı
          </button>
        </div>
      </div>
    </Card>
  );
}
