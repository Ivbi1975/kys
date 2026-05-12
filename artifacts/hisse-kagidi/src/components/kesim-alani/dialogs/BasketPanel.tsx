import { useState, useMemo, useEffect } from "react";
import type { KesimAlani } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ChevronUp, ChevronLeft, ChevronRight, CornerDownLeft, Filter, ListPlus, MoveRight, Package, Search, ShoppingBag, Wand2, X, ShoppingCart, Clock, AlertTriangle, GripVertical } from "lucide-react";
import { COLOR_MAP } from "@/lib/constants";
import type { BasketItem, ReturnToSourceResult, BasketSortKey, BasketSortDir } from "../hooks/types";
import {
  ITEMS_PER_PAGE,
  TIMEOUT_WARNING_MS,
  buildGroupedChips,
  formatTimeInBasket as formatTimeInBasketUtil,
  getGroupKey as getGroupKeyUtil,
  type BasketTab,
  type GroupByCriterion,
} from "./BasketPanel.utils";

interface BasketPanelProps {
  kesim: KesimAlani;
  basketItems: BasketItem[];
  localBasketItems: BasketItem[];
  foreignBasketItems: BasketItem[];
  basketOpen: boolean;
  setBasketOpen: (fn: (prev: boolean) => boolean) => void;
  removeFromBasket: (donationId: string) => void;
  clearBasket: () => void;
  autoDistributeBasket: () => void;
  returnSelectedToDonorList: (selectedIds: Set<string>) => boolean;
  returnSelectedToSource: (selectedIds: Set<string>) => ReturnToSourceResult;
  transferSelectedToGroup: (selectedIds: Set<string>, targetGroupIdx: number) => boolean;
  addEmptyGroup?: () => void;
}

export function BasketPanel({
  kesim, basketItems, localBasketItems, foreignBasketItems,
  basketOpen, setBasketOpen, removeFromBasket, clearBasket,
  autoDistributeBasket,
  returnSelectedToDonorList, returnSelectedToSource, transferSelectedToGroup,
  addEmptyGroup,
}: BasketPanelProps) {
  const [selectedBasketIds, setSelectedBasketIds] = useState<Set<string>>(new Set());
  const [retrieveTargetGroup, setRetrieveTargetGroup] = useState<number>(-1);
  const [activeTab, setActiveTab] = useState<BasketTab>("contents");
  const [basketSearch, setBasketSearch] = useState("");
  const [basketSortKey, setBasketSortKey] = useState<BasketSortKey>("name");
  const [basketSortDir, setBasketSortDir] = useState<BasketSortDir>("asc");
  const [lastReturnResult, setLastReturnResult] = useState<ReturnToSourceResult | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [shareMin, setShareMin] = useState("");
  const [shareMax, setShareMax] = useState("");
  const [cinsFilter, setCinsFilter] = useState("");
  const [groupByCriteria, setGroupByCriteria] = useState<Set<GroupByCriterion>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const localDonationItems = useMemo(() => localBasketItems.filter(b => b.type !== "animalGroup"), [localBasketItems]);
  const localAnimalGroupItems = useMemo(() => localBasketItems.filter(b => b.type === "animalGroup"), [localBasketItems]);

  const { basketTotalShares, basketAnimals } = useMemo(() => {
    let total = 0;
    for (const b of localDonationItems) {
      total += b.donorShareCount || 1;
    }
    for (const b of localAnimalGroupItems) {
      total += (b.filledCount || 0);
    }
    return { basketTotalShares: total, basketAnimals: Math.ceil(total / 7) };
  }, [localDonationItems, localAnimalGroupItems]);

  const allCinsValues = useMemo(() => {
    const set = new Set<string>();
    for (const b of localDonationItems) {
      if (b.donationType) set.add(b.donationType);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [localDonationItems]);

  const filteredLocalDonationItems = useMemo(() => {
    let items = localDonationItems;
    if (basketSearch.trim()) {
      const q = basketSearch.toLowerCase();
      items = items.filter(b =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        (b.vekalet && b.vekalet.toLowerCase().includes(q))
      );
    }
    if (shareMin) {
      const min = parseInt(shareMin);
      if (!isNaN(min)) items = items.filter(b => (b.donorShareCount || 1) >= min);
    }
    if (shareMax) {
      const max = parseInt(shareMax);
      if (!isNaN(max)) items = items.filter(b => (b.donorShareCount || 1) <= max);
    }
    if (cinsFilter) {
      items = items.filter(b => b.donationType === cinsFilter);
    }
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (basketSortKey === "name") cmp = (a.description || a.name).localeCompare(b.description || b.name, "tr");
      else if (basketSortKey === "type") cmp = (a.donationType || "").localeCompare(b.donationType || "", "tr");
      else if (basketSortKey === "source") cmp = (a.sourceGroupAnimalNo || 0) - (b.sourceGroupAnimalNo || 0);
      return basketSortDir === "desc" ? -cmp : cmp;
    });
  }, [localDonationItems, basketSearch, basketSortKey, basketSortDir, shareMin, shareMax, cinsFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLocalDonationItems.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredLocalDonationItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLocalDonationItems, safePage]);

  const timedOutIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of localBasketItems) {
      if (b.addedAt && (now - b.addedAt) >= TIMEOUT_WARNING_MS) {
        ids.add(b.donationId);
      }
    }
    return ids;
  }, [localBasketItems, now]);

  const timedOutCount = timedOutIds.size;

  const getGroupKey = (b: BasketItem): string => getGroupKeyUtil(b, groupByCriteria);

  const groupedSections = useMemo(() => {
    if (groupByCriteria.size === 0) return null;
    const sections = new Map<string, typeof paginatedItems>();
    for (const b of paginatedItems) {
      const key = getGroupKey(b);
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key)!.push(b);
    }
    return sections;
  }, [paginatedItems, groupByCriteria]);

  if (basketItems.length === 0) return null;
  const onlyForeignItems = localBasketItems.length === 0 && foreignBasketItems.length > 0;

  const toggleBasketSelect = (donationId: string) => {
    setSelectedBasketIds(prev => {
      const next = new Set(prev);
      if (next.has(donationId)) next.delete(donationId);
      else next.add(donationId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedBasketIds.size === localBasketItems.length) {
      setSelectedBasketIds(new Set());
    } else {
      setSelectedBasketIds(new Set(localBasketItems.map(b => b.donationId)));
    }
  };

  const handleReturnToDonorList = () => {
    if (selectedBasketIds.size === 0) return;
    const success = returnSelectedToDonorList(selectedBasketIds);
    if (success) {
      setSelectedBasketIds(new Set());
    }
  };

  const handleReturnToSource = () => {
    if (selectedBasketIds.size === 0) return;
    const result = returnSelectedToSource(selectedBasketIds);
    if (result.success) {
      setSelectedBasketIds(new Set());
      if (result.slotFullCount > 0 || result.groupDeletedCount > 0) {
        setLastReturnResult(result);
      }
    }
  };

  const handleReturnAll = () => {
    if (localBasketItems.length === 0) return;
    const allIds = new Set(localBasketItems.map(b => b.donationId));
    const result = returnSelectedToSource(allIds);
    if (result.success) {
      setSelectedBasketIds(new Set());
      if (result.slotFullCount > 0 || result.groupDeletedCount > 0) {
        setLastReturnResult(result);
      }
    }
  };

  const selectedHaveSource = [...selectedBasketIds].some(id => {
    const item = localBasketItems.find(b => b.donationId === id);
    return item?.sourceGroupId;
  });

  const handleTransferToGroup = () => {
    if (selectedBasketIds.size === 0 || retrieveTargetGroup < 0) return;
    const success = transferSelectedToGroup(selectedBasketIds, retrieveTargetGroup);
    if (success) {
      setSelectedBasketIds(new Set());
      setRetrieveTargetGroup(-1);
    }
  };

  const handleBasketDragStart = (e: React.DragEvent, item: BasketItem) => {
    e.dataTransfer.setData("application/basket-item", JSON.stringify({
      donationId: item.donationId,
      type: item.type,
      name: item.description || item.name,
    }));
    e.dataTransfer.effectAllowed = "move";
  };

  const isTimedOut = (item: BasketItem) => timedOutIds.has(item.donationId);

  const formatTimeInBasket = (addedAt?: number) => formatTimeInBasketUtil(addedAt, now);

  const tabs: { id: BasketTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "contents", label: "Sepet İçeriği", icon: <ShoppingCart className="w-3.5 h-3.5" />, badge: selectedBasketIds.size > 0 ? `${selectedBasketIds.size} seçili` : undefined },
    { id: "place", label: "Yerleştir", icon: <Package className="w-3.5 h-3.5" /> },
  ];

  const renderDonorChip = (b: BasketItem, groupKey?: string) => {
    const totalShares = b.donorShareCount || 1;
    const timed = isTimedOut(b);
    const timeStr = formatTimeInBasket(b.addedAt);
    return (
      <span
        key={groupKey || b.donationId}
        draggable={b.type === "donation"}
        onDragStart={b.type === "donation" ? (e) => handleBasketDragStart(e, b) : undefined}
        className={`px-2 py-1 bg-white dark:bg-zinc-900 rounded-md text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all border ${
          selectedBasketIds.has(b.donationId)
            ? "ring-2 ring-emerald-400 border-emerald-300"
            : timed
              ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40"
              : "border-emerald-200 dark:border-emerald-800 hover:border-emerald-300"
        }`}
        onClick={() => toggleBasketSelect(b.donationId)}
      >
        {b.type === "donation" && <GripVertical className="w-3 h-3 text-muted-foreground/50 cursor-grab" />}
        <input
          type="checkbox"
          className="rounded w-3 h-3"
          checked={selectedBasketIds.has(b.donationId)}
          onChange={() => toggleBasketSelect(b.donationId)}
          onClick={e => e.stopPropagation()}
        />
        <span className="font-medium">{b.description || b.name}</span>
        <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold bg-violet-100 dark:bg-violet-900/50 px-1 rounded">{totalShares}</span>
        {b.sourceGroupAnimalNo && <span className="text-[10px] text-amber-600 dark:text-amber-400">H{b.sourceGroupAnimalNo}</span>}
        {timed && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5" title={`Sepette ${timeStr}`}>
            <Clock className="w-2.5 h-2.5" />
            {timeStr}
          </span>
        )}
        <button onClick={(e) => { e.stopPropagation(); removeFromBasket(b.donationId); setSelectedBasketIds(prev => { const next = new Set(prev); next.delete(b.donationId); return next; }); }} className="ml-0.5 text-muted-foreground hover:text-red-500 transition-colors">
          <X className="w-3 h-3" />
        </button>
      </span>
    );
  };

  const renderGroupedChip = (g: { key: string; label: string; items: BasketItem[] }) => {
    const allSelected = g.items.every(item => selectedBasketIds.has(item.donationId));
    const anyTimedOut = g.items.some(item => isTimedOut(item));
    const toggleGroup = () => {
      setSelectedBasketIds(prev => {
        const next = new Set(prev);
        if (allSelected) {
          g.items.forEach(item => next.delete(item.donationId));
        } else {
          g.items.forEach(item => next.add(item.donationId));
        }
        return next;
      });
    };
    const totalShares = g.items.reduce((sum, item) => sum + (item.donorShareCount || 1), 0);
    const firstItem = g.items[0];

    return (
      <span
        key={g.key}
        draggable={g.items.length === 1 && g.items[0].type === "donation"}
        onDragStart={g.items.length === 1 && g.items[0].type === "donation" ? (e) => handleBasketDragStart(e, g.items[0]) : undefined}
        className={`px-2 py-1 bg-white dark:bg-zinc-900 rounded-md text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all border ${
          allSelected
            ? "ring-2 ring-emerald-400 border-emerald-300"
            : anyTimedOut
              ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40"
              : "border-emerald-200 dark:border-emerald-800 hover:border-emerald-300"
        }`}
        onClick={toggleGroup}
      >
        {g.items.length === 1 && g.items[0].type === "donation" && <GripVertical className="w-3 h-3 text-muted-foreground/50 cursor-grab" />}
        <input
          type="checkbox"
          className="rounded w-3 h-3"
          checked={allSelected}
          onChange={toggleGroup}
          onClick={e => e.stopPropagation()}
        />
        <span className="font-medium">{g.label}</span>
        <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold bg-violet-100 dark:bg-violet-900/50 px-1 rounded">{totalShares}</span>
        {g.items.length > 1 && <span className="text-emerald-500 font-semibold">&times;{g.items.length}</span>}
        {firstItem?.sourceGroupAnimalNo && <span className="text-[10px] text-amber-600 dark:text-amber-400">H{firstItem.sourceGroupAnimalNo}</span>}
        {anyTimedOut && <Clock className="w-2.5 h-2.5 text-amber-500" />}
        <button onClick={(e) => { e.stopPropagation(); g.items.forEach(item => { removeFromBasket(item.donationId); setSelectedBasketIds(prev => { const next = new Set(prev); next.delete(item.donationId); return next; }); }); }} className="ml-0.5 text-muted-foreground hover:text-red-500 transition-colors">
          <X className="w-3 h-3" />
        </button>
      </span>
    );
  };

  const renderDonorChips = () => {
    if (groupByCriteria.size > 0 && groupedSections) {
      return (
        <div className="space-y-2">
          {Array.from(groupedSections.entries()).map(([sectionKey, sectionItems]) => {
            const grouped = buildGroupedChips(sectionItems);
            const sectionTotalShares = sectionItems.reduce((sum, b) => sum + (b.donorShareCount || 1), 0);
            return (
              <div key={sectionKey} className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-2.5">
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                  {sectionKey} — {sectionItems.length} bağışçı · {sectionTotalShares} hisse
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {grouped.map(g => g.items.length === 1 ? renderDonorChip(g.items[0], g.key) : renderGroupedChip(g))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    const grouped = buildGroupedChips(paginatedItems);
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-2.5">
        <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mb-2">Bu Kesim Alanı</p>
        <div className="flex flex-wrap gap-1.5">
          {grouped.map(g => g.items.length === 1 ? renderDonorChip(g.items[0], g.key) : renderGroupedChip(g))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-zinc-950 shadow-2xl">
        <button
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors border-b border-border/50"
          onClick={() => setBasketOpen(prev => !prev)}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900">
            <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold text-foreground">
              Sepet
            </span>
            <span className="text-[11px] text-muted-foreground">
              {basketItems.filter(b => b.type !== "animalGroup").length} bağışçı
              {basketItems.filter(b => b.type === "animalGroup").length > 0 && ` · ${basketItems.filter(b => b.type === "animalGroup").length} hayvan`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto mr-2">
            {timedOutCount > 0 && (
              <span className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {timedOutCount} bekliyor
              </span>
            )}
            {localBasketItems.length > 0 && (
              <>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900 px-2.5 py-0.5 rounded-full">
                  {basketTotalShares} hisse
                </span>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900 px-2.5 py-0.5 rounded-full">
                  ~{basketAnimals} hayvan
                </span>
              </>
            )}
          </div>
          <ChevronUp className={`w-5 h-5 text-muted-foreground transition-transform ${basketOpen ? "" : "rotate-180"}`} />
        </button>

        {basketOpen && onlyForeignItems && (
          <div className="p-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Sepetteki {foreignBasketItems.length} öğe bu kesim alanına ait değil. Bu öğeler artık işlenemez.
            </p>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive shrink-0" onClick={clearBasket}>
              <X className="w-3 h-3 mr-1" /> Sepeti Temizle
            </Button>
          </div>
        )}

        {basketOpen && !onlyForeignItems && (
          <div className="max-h-[50vh] overflow-y-auto">
            <div className="flex border-b border-border">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? "border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.badge && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold leading-none">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-3">
              {activeTab === "contents" && (
                <div className="space-y-3">
                  {localBasketItems.length > 0 && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded w-3.5 h-3.5"
                            checked={selectedBasketIds.size === localBasketItems.length && localBasketItems.length > 0}
                            onChange={toggleSelectAll}
                          />
                          Tümünü Seç
                        </label>
                        {selectedBasketIds.size > 0 && (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {selectedBasketIds.size} seçili
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-600" onClick={handleReturnAll} title="Tümünü Eski Yerine Geri Al">
                            <CornerDownLeft className="w-3 h-3 mr-1" /> Tümünü Geri Al
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={clearBasket}>
                            <X className="w-3 h-3 mr-1" /> Sepeti Temizle
                          </Button>
                        </div>
                      </div>
                      {localDonationItems.length > 5 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <Input
                                className="h-7 text-xs pl-7 pr-2"
                                placeholder="Sepette ara..."
                                value={basketSearch}
                                onChange={(e) => { setBasketSearch(e.target.value); setCurrentPage(1); }}
                              />
                              {basketSearch && (
                                <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => { setBasketSearch(""); setCurrentPage(1); }}>
                                  <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                </button>
                              )}
                            </div>
                            <Button
                              variant={showFilters ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setShowFilters(f => !f)}
                            >
                              <Filter className="w-3 h-3 mr-1" />
                              Filtre
                            </Button>
                            <Select value={basketSortKey} onValueChange={(v) => setBasketSortKey(v as BasketSortKey)}>
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <ArrowUpDown className="w-3 h-3 mr-1" />
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent side="top">
                                <SelectItem value="name">Ad</SelectItem>
                                <SelectItem value="type">Tür</SelectItem>
                                <SelectItem value="source">Kaynak</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setBasketSortDir(d => d === "asc" ? "desc" : "asc")}
                              title={basketSortDir === "asc" ? "Artan" : "Azalan"}
                            >
                              <ArrowUpDown className={`w-3.5 h-3.5 ${basketSortDir === "desc" ? "rotate-180" : ""}`} />
                            </Button>
                          </div>
                          {showFilters && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted-foreground whitespace-nowrap">Hisse:</span>
                                <Input
                                  className="h-6 w-14 text-xs px-1.5"
                                  placeholder="Min"
                                  type="number"
                                  value={shareMin}
                                  onChange={(e) => { setShareMin(e.target.value); setCurrentPage(1); }}
                                />
                                <span className="text-[11px] text-muted-foreground">-</span>
                                <Input
                                  className="h-6 w-14 text-xs px-1.5"
                                  placeholder="Max"
                                  type="number"
                                  value={shareMax}
                                  onChange={(e) => { setShareMax(e.target.value); setCurrentPage(1); }}
                                />
                              </div>
                              {allCinsValues.length > 0 && (
                                <Select value={cinsFilter} onValueChange={(v) => { setCinsFilter(v === "__all__" ? "" : v); setCurrentPage(1); }}>
                                  <SelectTrigger className="h-6 w-28 text-xs">
                                    <SelectValue placeholder="Cins" />
                                  </SelectTrigger>
                                  <SelectContent side="top">
                                    <SelectItem value="__all__">Tümü</SelectItem>
                                    {allCinsValues.map(c => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <div className="flex items-center gap-1.5 border-l pl-1.5">
                                <span className="text-[11px] text-muted-foreground whitespace-nowrap">Grupla:</span>
                                {(["cins", "share", "source"] as GroupByCriterion[]).map(criterion => {
                                  const labels: Record<GroupByCriterion, string> = { cins: "Cins", share: "Hisse", source: "Kaynak" };
                                  const isActive = groupByCriteria.has(criterion);
                                  return (
                                    <button
                                      key={criterion}
                                      className={`px-1.5 py-0.5 rounded text-[11px] border transition-colors ${isActive ? "bg-emerald-100 dark:bg-emerald-900 border-emerald-400 text-emerald-700 dark:text-emerald-300 font-semibold" : "border-border text-muted-foreground hover:bg-muted"}`}
                                      onClick={() => {
                                        setGroupByCriteria(prev => {
                                          const next = new Set(prev);
                                          if (next.has(criterion)) next.delete(criterion);
                                          else next.add(criterion);
                                          return next;
                                        });
                                        setCurrentPage(1);
                                      }}
                                    >
                                      {labels[criterion]}
                                    </button>
                                  );
                                })}
                              </div>
                              {(shareMin || shareMax || cinsFilter || groupByCriteria.size > 0) && (
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-1.5" onClick={() => { setShareMin(""); setShareMax(""); setCinsFilter(""); setGroupByCriteria(new Set()); setCurrentPage(1); }}>
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {localAnimalGroupItems.length > 0 && (
                    <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/30 p-2.5">
                      <p className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 mb-2 flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        Komple Hayvanlar
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {localAnimalGroupItems.map(b => (
                          <span
                            key={b.animalGroupId}
                            className={`px-2 py-1 bg-white dark:bg-zinc-900 rounded-md text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all border ${
                              selectedBasketIds.has(b.donationId)
                                ? "ring-2 ring-orange-400 border-orange-300"
                                : isTimedOut(b)
                                  ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40"
                                  : "border-orange-200 dark:border-orange-800 hover:border-orange-300"
                            }`}
                            style={b.colorTag && b.colorTag in COLOR_MAP ? { borderLeft: `3px solid ${COLOR_MAP[b.colorTag as keyof typeof COLOR_MAP]}` } : {}}
                            onClick={() => toggleBasketSelect(b.donationId)}
                          >
                            <input
                              type="checkbox"
                              className="rounded w-3 h-3"
                              checked={selectedBasketIds.has(b.donationId)}
                              onChange={() => toggleBasketSelect(b.donationId)}
                              onClick={e => e.stopPropagation()}
                            />
                            <span className="font-medium">Hayvan {b.animalNo}</span>
                            <span className="text-muted-foreground">({b.filledCount} kişi)</span>
                            {isTimedOut(b) && (
                              <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {formatTimeInBasket(b.addedAt)}
                              </span>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); removeFromBasket(b.donationId); setSelectedBasketIds(prev => { const next = new Set(prev); next.delete(b.donationId); return next; }); }} className="ml-0.5 text-muted-foreground hover:text-red-500 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {paginatedItems.length > 0 && renderDonorChips()}

                  {filteredLocalDonationItems.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[11px] text-muted-foreground">
                        {filteredLocalDonationItems.length} sonuçtan {((safePage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(safePage * ITEMS_PER_PAGE, filteredLocalDonationItems.length)} arası
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled={safePage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                          <ChevronLeft className="w-3 h-3" />
                        </Button>
                        <span className="text-xs font-medium px-2">{safePage}/{totalPages}</span>
                        <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {basketSearch && filteredLocalDonationItems.length === 0 && localDonationItems.length > 0 && (
                    <div className="text-center py-3 text-xs text-muted-foreground">
                      &ldquo;{basketSearch}&rdquo; ile eşleşen sonuç bulunamadı
                    </div>
                  )}

                  {lastReturnResult && (lastReturnResult.slotFullCount > 0 || lastReturnResult.groupDeletedCount > 0) && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-2.5">
                      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-1.5">Bazı öğeler eski yerine yerleştirilemedi</p>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">
                        {lastReturnResult.slotFullCount > 0 && `${lastReturnResult.slotFullCount} slot dolu. `}
                        {lastReturnResult.groupDeletedCount > 0 && `${lastReturnResult.groupDeletedCount} grup silinmiş. `}
                        Bu bağışçılar bağışçı listesine eklendi.
                      </p>
                      <div className="flex items-center gap-2">
                        {addEmptyGroup && (
                          <Button variant="outline" size="sm" className="h-7 text-xs border-amber-300 text-amber-700 dark:text-amber-300" onClick={() => { addEmptyGroup(); setLastReturnResult(null); }}>
                            <Package className="w-3 h-3 mr-1" /> Yeni Hayvan Grubu Oluştur
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLastReturnResult(null)}>
                          Kapat
                        </Button>
                      </div>
                    </div>
                  )}

                  {foreignBasketItems.length > 0 && localBasketItems.length > 0 && (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-muted/40">
                      <p className="text-[11px] text-muted-foreground">
                        {foreignBasketItems.length} öğe başka bir kesim alanına ait — bu KA'da işlenemez.
                      </p>
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] text-destructive px-2 shrink-0" onClick={clearBasket}>
                        Temizle
                      </Button>
                    </div>
                  )}

                </div>
              )}

              {activeTab === "place" && (
                <div className="space-y-3">
                  {localDonationItems.length > 0 && (
                    <Button
                      size="sm"
                      className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md"
                      onClick={autoDistributeBasket}
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      Otomatik Dağıt ({basketTotalShares} hisse &rarr; ~{basketAnimals} hayvan)
                    </Button>
                  )}

                  {selectedBasketIds.size > 0 && (
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-3">
                      <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 mb-2.5">
                        Seçilen {selectedBasketIds.size} Öğeyi Yerleştir
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        <Select value={retrieveTargetGroup < 0 ? "" : String(retrieveTargetGroup)} onValueChange={(v) => setRetrieveTargetGroup(parseInt(v))}>
                          <SelectTrigger className="h-8 flex-1 text-xs">
                            <SelectValue placeholder="Hedef hayvan grubu seçin..." />
                          </SelectTrigger>
                          <SelectContent side="top">
                            {kesim.animalGroups.map((g, i) => {
                              const empty = g.donations.filter(d => !d.name.trim()).length;
                              return (
                                <SelectItem key={g.id} value={String(i)} disabled={g.locked || empty === 0}>
                                  Hayvan {g.animalNo} ({empty} boş yer)
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          onClick={handleTransferToGroup}
                          disabled={retrieveTargetGroup < 0}
                        >
                          <MoveRight className="w-3.5 h-3.5 mr-1" />
                          Gruba Yerleştir
                        </Button>
                      </div>
                      {selectedHaveSource && (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 text-xs w-full bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={handleReturnToSource}
                        >
                          <MoveRight className="w-3.5 h-3.5 mr-1 rotate-180" />
                          Eski Yerine Geri Al
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs w-full"
                        onClick={handleReturnToDonorList}
                      >
                        <ListPlus className="w-3.5 h-3.5 mr-1" />
                        Bağışçı Listesine Geri Gönder
                      </Button>
                    </div>
                  )}


                  {selectedBasketIds.size === 0 && localDonationItems.length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Yerleştirmek için önce &ldquo;Sepet İçeriği&rdquo; sekmesinden öğe seçin
                    </div>
                  )}
                  {selectedBasketIds.size === 0 && localDonationItems.length > 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                      <GripVertical className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-emerald-700 dark:text-emerald-300">
                        Sepetteki öğeleri sürükleyerek hayvan gruplarına bırakabilirsiniz
                      </span>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </>
  );
}
