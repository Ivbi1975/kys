import { useState, useMemo, useEffect } from "react";
import type { KesimAlani } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ChevronUp, ChevronLeft, ChevronRight, CornerDownLeft, Filter, ListPlus, Loader2, MoveRight, Package, Search, Send, ShoppingBag, UserPlus, Wand2, X, ShoppingCart, ArrowRightLeft, Clock, AlertTriangle, GripVertical } from "lucide-react";
import { COLOR_MAP } from "@/lib/constants";
import { computeEffectiveShares } from "@/lib/grouping";
import type { BasketItem, ReturnToSourceResult, BasketSortKey, BasketSortDir } from "../hooks/types";

type BasketTab = "contents" | "place" | "transfer";
type GroupByMode = "none" | "cins" | "share" | "source";

const ITEMS_PER_PAGE = 50;
const TIMEOUT_WARNING_MS = 2 * 60 * 60 * 1000;

interface BasketPanelProps {
  kesim: KesimAlani;
  basketItems: BasketItem[];
  localBasketItems: BasketItem[];
  foreignBasketItems: BasketItem[];
  basketOpen: boolean;
  setBasketOpen: (fn: (prev: boolean) => boolean) => void;
  removeFromBasket: (donationId: string) => void;
  clearBasket: () => void;
  basketTransferTarget: number;
  setBasketTransferTarget: (v: number) => void;
  transferBasketToGroup: (groupIdx: number) => void;
  autoDistributeBasket: () => void;
  basketCrossKATarget: string;
  setBasketCrossKATarget: (v: string) => void;
  crossKATransferring: boolean;
  transferBasketToOtherKA: (targetId: string) => void;
  siblingKesimAlanlari: Array<{ id: string; name: string }>;
  transferToDonorListConfirm: boolean;
  setTransferToDonorListConfirm: (v: boolean) => void;
  transferToDonorListRemoving: boolean;
  transferForeignToCurrentDonorList: (removeFromSource: boolean) => void;
  emptyGroupsAfterTransfer: Array<{ id: string; animalNo: number }>;
  cleanupEmptyGroups: () => void;
  dismissEmptyGroupsCleanup: () => void;
  returnSelectedToDonorList: (selectedIds: Set<string>) => boolean;
  returnSelectedToSource: (selectedIds: Set<string>) => ReturnToSourceResult;
  transferSelectedToGroup: (selectedIds: Set<string>, targetGroupIdx: number) => boolean;
  sendSelectedToPool?: (selectedIds: Set<string>) => boolean;
  addEmptyGroup?: () => void;
}

export function BasketPanel({
  kesim, basketItems, localBasketItems, foreignBasketItems,
  basketOpen, setBasketOpen, removeFromBasket, clearBasket,
  basketTransferTarget, setBasketTransferTarget, transferBasketToGroup, autoDistributeBasket,
  basketCrossKATarget, setBasketCrossKATarget, crossKATransferring, transferBasketToOtherKA,
  siblingKesimAlanlari,
  transferToDonorListConfirm, setTransferToDonorListConfirm,
  transferToDonorListRemoving, transferForeignToCurrentDonorList,
  emptyGroupsAfterTransfer, cleanupEmptyGroups, dismissEmptyGroupsCleanup,
  returnSelectedToDonorList, returnSelectedToSource, transferSelectedToGroup,
  sendSelectedToPool, addEmptyGroup,
}: BasketPanelProps) {
  const [crossKAConfirmOpen, setCrossKAConfirmOpen] = useState(false);
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
  const [groupByMode, setGroupByMode] = useState<GroupByMode>("none");
  const [showFilters, setShowFilters] = useState(false);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const localDonationItems = useMemo(() => localBasketItems.filter(b => b.type !== "animalGroup"), [localBasketItems]);
  const localAnimalGroupItems = useMemo(() => localBasketItems.filter(b => b.type === "animalGroup"), [localBasketItems]);

  const { basketTotalShares, basketAnimals } = useMemo(() => {
    const sharesMap = computeEffectiveShares(kesim.donations);
    let total = 0;
    for (const b of localDonationItems) {
      const grouped = kesim.animalGroups.flatMap(g => g.donations).find(d => d.id === b.donationId);
      total += grouped ? 1 : (sharesMap.get(b.donationId) || 1);
    }
    for (const b of localAnimalGroupItems) {
      total += (b.filledCount || 0);
    }
    return { basketTotalShares: total, basketAnimals: Math.ceil(total / 7) };
  }, [localDonationItems, localAnimalGroupItems, kesim.donations, kesim.animalGroups]);

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

  if (basketItems.length === 0 && emptyGroupsAfterTransfer.length === 0) return null;

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

  const formatTimeInBasket = (addedAt?: number) => {
    if (!addedAt) return null;
    const elapsed = now - addedAt;
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 60) return `${minutes}dk`;
    const hours = Math.floor(minutes / 60);
    const remainMins = minutes % 60;
    return `${hours}s ${remainMins}dk`;
  };

  const buildGroupedItems = (items: typeof filteredLocalDonationItems) => {
    if (groupByMode === "none") {
      const grouped: { key: string; label: string; items: typeof items }[] = [];
      const seen = new Map<string, number>();
      for (const b of items) {
        const label = (b.description || b.name).trim();
        const existing = seen.get(label);
        if (existing !== undefined) {
          grouped[existing].items.push(b);
        } else {
          seen.set(label, grouped.length);
          grouped.push({ key: label, label, items: [b] });
        }
      }
      return grouped;
    }

    const sections = new Map<string, typeof items>();
    for (const b of items) {
      let key: string;
      if (groupByMode === "cins") key = b.donationType || "Belirtilmemiş";
      else if (groupByMode === "share") key = `${b.donorShareCount || 1} Hisse`;
      else key = b.sourceGroupAnimalNo ? `Hayvan ${b.sourceGroupAnimalNo}` : "Listeden";
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key)!.push(b);
    }

    const grouped: { key: string; label: string; items: typeof items }[] = [];
    for (const [sectionKey, sectionItems] of sections) {
      const seen = new Map<string, number>();
      for (const b of sectionItems) {
        const label = (b.description || b.name).trim();
        const existing = seen.get(`${sectionKey}::${label}`);
        if (existing !== undefined) {
          grouped[existing].items.push(b);
        } else {
          seen.set(`${sectionKey}::${label}`, grouped.length);
          grouped.push({ key: `${sectionKey}::${label}`, label, items: [b] });
        }
      }
    }
    return grouped;
  };

  const groupedSections = useMemo(() => {
    if (groupByMode === "none") return null;
    const sections = new Map<string, typeof paginatedItems>();
    for (const b of paginatedItems) {
      let key: string;
      if (groupByMode === "cins") key = b.donationType || "Belirtilmemiş";
      else if (groupByMode === "share") key = `${b.donorShareCount || 1} Hisse`;
      else key = b.sourceGroupAnimalNo ? `Hayvan ${b.sourceGroupAnimalNo}` : "Listeden";
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key)!.push(b);
    }
    return sections;
  }, [paginatedItems, groupByMode]);

  const tabs: { id: BasketTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "contents", label: "Sepet İçeriği", icon: <ShoppingCart className="w-3.5 h-3.5" />, badge: selectedBasketIds.size > 0 ? `${selectedBasketIds.size} seçili` : undefined },
    { id: "place", label: "Yerleştir", icon: <Package className="w-3.5 h-3.5" /> },
    { id: "transfer", label: "Aktar", icon: <ArrowRightLeft className="w-3.5 h-3.5" /> },
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
        {totalShares > 1 && (
          <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold bg-violet-100 dark:bg-violet-900/50 px-1 rounded">{totalShares}</span>
        )}
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
        {totalShares > 1 && (
          <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold bg-violet-100 dark:bg-violet-900/50 px-1 rounded">{totalShares}</span>
        )}
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
    if (groupByMode !== "none" && groupedSections) {
      return (
        <div className="space-y-2">
          {Array.from(groupedSections.entries()).map(([sectionKey, sectionItems]) => {
            const grouped = buildGroupedItems(sectionItems);
            return (
              <div key={sectionKey} className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-2.5">
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mb-2">{sectionKey} ({sectionItems.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {grouped.map(g => g.items.length === 1 ? renderDonorChip(g.items[0], g.key) : renderGroupedChip(g))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    const grouped = buildGroupedItems(paginatedItems);
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
            {foreignBasketItems.length > 0 && (
              <span className="text-[11px] text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full font-semibold">
                {foreignBasketItems.length} diğer KA
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

        {basketOpen && (
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
                              <Select value={groupByMode} onValueChange={(v) => setGroupByMode(v as GroupByMode)}>
                                <SelectTrigger className="h-6 w-28 text-xs">
                                  <SelectValue placeholder="Grupla" />
                                </SelectTrigger>
                                <SelectContent side="top">
                                  <SelectItem value="none">Grupsuz</SelectItem>
                                  <SelectItem value="cins">Cins</SelectItem>
                                  <SelectItem value="share">Hisse</SelectItem>
                                  <SelectItem value="source">Kaynak</SelectItem>
                                </SelectContent>
                              </Select>
                              {(shareMin || shareMax || cinsFilter || groupByMode !== "none") && (
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-1.5" onClick={() => { setShareMin(""); setShareMax(""); setCinsFilter(""); setGroupByMode("none"); setCurrentPage(1); }}>
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

                  {foreignBasketItems.length > 0 && (
                    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-2.5">
                      <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 mb-2">Diğer Kesim Alanlarından</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {foreignBasketItems.map(b => (
                          <span key={b.donationId} className="px-2 py-1 bg-white dark:bg-zinc-900 rounded-md text-xs inline-flex items-center gap-1.5 border border-blue-200 dark:border-blue-800">
                            <span className="font-medium">{b.description || b.name}</span>
                            {(b.donorShareCount || 1) > 1 && (
                              <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold bg-violet-100 dark:bg-violet-900/50 px-1 rounded">{b.donorShareCount || 1}</span>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); removeFromBasket(b.donationId); }} className="text-muted-foreground hover:text-red-500 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-blue-300 text-blue-700 dark:text-blue-300"
                        onClick={() => setTransferToDonorListConfirm(true)}
                        disabled={transferToDonorListRemoving}
                      >
                        {transferToDonorListRemoving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
                        Bu Listeye Ekle ({foreignBasketItems.length})
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

                  {localDonationItems.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs font-semibold mb-2.5">Tüm Sepeti Yerleştir</p>
                      <div className="flex items-center gap-2">
                        <Select value={String(basketTransferTarget)} onValueChange={(v) => setBasketTransferTarget(parseInt(v))}>
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
                        <Button size="sm" className="h-8 text-xs" onClick={() => transferBasketToGroup(basketTransferTarget)} disabled={basketTransferTarget < 0}>
                          <Package className="w-3.5 h-3.5 mr-1" />
                          Yerleştir
                        </Button>
                      </div>
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

              {activeTab === "transfer" && (
                <div className="space-y-3">
                  {localBasketItems.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs font-semibold mb-2.5">Başka Kesim Alanına Aktar</p>
                      {siblingKesimAlanlari.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <Select value={basketCrossKATarget} onValueChange={setBasketCrossKATarget}>
                            <SelectTrigger className="h-8 flex-1 text-xs">
                              <SelectValue placeholder="Hedef kesim alanı seçin..." />
                            </SelectTrigger>
                            <SelectContent side="top">
                              {siblingKesimAlanlari.map(ka => (
                                <SelectItem key={ka.id} value={ka.id}>
                                  {ka.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setCrossKAConfirmOpen(true)}
                            disabled={!basketCrossKATarget || crossKATransferring}
                          >
                            {crossKATransferring ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                            Aktar
                          </Button>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground space-y-2">
                          <p>Henüz başka kesim alanı bulunmuyor.</p>
                          <p className="text-[11px]">Başka bir sekmede yeni bir kesim alanı oluşturun, ardından buradan aktarım yapabilirsiniz.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {sendSelectedToPool && (() => {
                    const eligibleCount = localBasketItems.filter(
                      b => selectedBasketIds.has(b.donationId) && b.type !== "animalGroup"
                    ).length;
                    return selectedBasketIds.size > 0 ? (
                      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3">
                        <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2">Bağış Havuzuna Gönder</p>
                        <p className="text-[11px] text-blue-600 dark:text-blue-400 mb-2">
                          {eligibleCount > 0
                            ? `Seçili ${eligibleCount} bağışçıyı bu kesim alanından çıkarıp bağış havuzuna gönderir.`
                            : "Seçili öğeler arasında havuza gönderilebilecek bağışçı yok (hayvan grupları havuza gönderilemez)."}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs w-full border-blue-300 text-blue-700 dark:text-blue-300"
                          disabled={eligibleCount === 0}
                          onClick={() => {
                            const ok = sendSelectedToPool(selectedBasketIds);
                            if (ok) setSelectedBasketIds(new Set());
                          }}
                        >
                          <MoveRight className="w-3.5 h-3.5 mr-1" />
                          Havuza Gönder ({eligibleCount})
                        </Button>
                      </div>
                    ) : null;
                  })()}

                  {sendSelectedToPool && selectedBasketIds.size === 0 && localBasketItems.length > 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <span className="text-xs text-blue-700 dark:text-blue-300">
                        Havuza göndermek için &ldquo;Sepet İçeriği&rdquo; sekmesinden seçim yapın
                      </span>
                      <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => setActiveTab("contents")}>
                        Sepete Git
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {transferToDonorListConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setTransferToDonorListConfirm(false); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-background rounded-xl shadow-2xl border p-6 w-[400px] max-w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-3">Bağışçı Listesine Ekle</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sepetteki <strong>{basketItems.filter(b => b.kesimAlaniId !== kesim.id && b.type !== "animalGroup").length}</strong> bağışçıyı
              {basketItems.filter(b => b.kesimAlaniId !== kesim.id && b.type === "animalGroup").length > 0 && (
                <> ve <strong>{basketItems.filter(b => b.kesimAlaniId !== kesim.id && b.type === "animalGroup").length}</strong> komple hayvanı</>
              )}
              {" "}bu kesim alanının bağışçı listesine eklemek istiyorsunuz.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Bu bağışçılar eski kesim alanlarından <strong>otomatik olarak kaldırılacaktır</strong>.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setTransferToDonorListConfirm(false)} disabled={transferToDonorListRemoving}>
                İptal
              </Button>
              <Button
                size="sm"
                onClick={() => transferForeignToCurrentDonorList(true)}
                disabled={transferToDonorListRemoving}
              >
                {transferToDonorListRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <UserPlus className="w-3.5 h-3.5 mr-1" />}
                Ekle ve Kaynaktan Kaldır
              </Button>
            </div>
          </div>
        </div>
      )}

      {crossKAConfirmOpen && (() => {
        const targetKAName = siblingKesimAlanlari.find(ka => ka.id === basketCrossKATarget)?.name || basketCrossKATarget;
        const donationCount = localBasketItems.filter(b => b.type !== "animalGroup").length;
        const animalGroupCount = localBasketItems.filter(b => b.type === "animalGroup").length;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setCrossKAConfirmOpen(false); }}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative bg-background rounded-xl shadow-2xl border p-6 w-[440px] max-w-full" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold text-base mb-3">Başka KA&apos;ya Aktar</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Aşağıdaki öğeleri <strong>{targetKAName}</strong> kesim alanına aktarmak istediğinize emin misiniz?
              </p>
              <div className="text-sm space-y-1 mb-4 pl-2 border-l-2 border-emerald-300">
                {donationCount > 0 && (
                  <p><strong>{donationCount}</strong> bireysel bağışçı</p>
                )}
                {animalGroupCount > 0 && (
                  <p><strong>{animalGroupCount}</strong> komple hayvan (tüm bağışçıları, notları ve fotoğraflarıyla birlikte)</p>
                )}
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded p-2 mb-4">
                Bu işlem geri alınamaz. Aktarılan öğeler bu kesim alanından kaldırılacaktır.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setCrossKAConfirmOpen(false)} disabled={crossKATransferring}>
                  İptal
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setCrossKAConfirmOpen(false);
                    transferBasketToOtherKA(basketCrossKATarget);
                  }}
                  disabled={crossKATransferring}
                >
                  {crossKATransferring ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                  Onayla ve Aktar
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {emptyGroupsAfterTransfer.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) dismissEmptyGroupsCleanup(); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-background rounded-xl shadow-2xl border p-6 w-[420px] max-w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-3">Boş Grupları Temizle</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Aktarım sonrası <strong>{emptyGroupsAfterTransfer.length}</strong> hayvan grubu boş kaldı:
            </p>
            <div className="text-sm space-y-1 mb-4 pl-2 border-l-2 border-amber-300">
              {emptyGroupsAfterTransfer.map(g => (
                <p key={g.id}>Hayvan {g.animalNo}</p>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Bu boş grupları temizlemek ister misiniz?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={dismissEmptyGroupsCleanup}>
                Hayır, Kalsın
              </Button>
              <Button size="sm" variant="destructive" onClick={cleanupEmptyGroups}>
                Temizle
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
