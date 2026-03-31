import { useState } from "react";
import type { KesimAlani, Donation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronUp, ListPlus, Loader2, MoveRight, Package, Send, ShoppingBag, UserPlus, Wand2, X } from "lucide-react";
import { COLOR_MAP } from "@/lib/constants";
import { computeEffectiveShares } from "@/lib/grouping";
import type { BasketItem } from "../hooks/types";

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
  transferSelectedToGroup: (selectedIds: Set<string>, targetGroupIdx: number) => boolean;
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
  returnSelectedToDonorList, transferSelectedToGroup,
}: BasketPanelProps) {
  const [crossKAConfirmOpen, setCrossKAConfirmOpen] = useState(false);
  const [selectedBasketIds, setSelectedBasketIds] = useState<Set<string>>(new Set());
  const [retrieveTargetGroup, setRetrieveTargetGroup] = useState<number>(-1);

  if (basketItems.length === 0 && emptyGroupsAfterTransfer.length === 0) return null;

  const localDonationItems = localBasketItems.filter(b => b.type !== "animalGroup");
  const localAnimalGroupItems = localBasketItems.filter(b => b.type === "animalGroup");

  const sharesMap = computeEffectiveShares(kesim.donations);
  let basketTotalShares = 0;
  for (const b of localDonationItems) {
    const grouped = kesim.animalGroups.flatMap(g => g.donations).find(d => d.id === b.donationId);
    if (grouped) {
      basketTotalShares += 1;
    } else {
      basketTotalShares += sharesMap.get(b.donationId) || 1;
    }
  }
  for (const b of localAnimalGroupItems) {
    basketTotalShares += (b.filledCount || 0);
  }
  const basketAnimals = Math.ceil(basketTotalShares / 7);

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

  const handleTransferToGroup = () => {
    if (selectedBasketIds.size === 0 || retrieveTargetGroup < 0) return;
    const success = transferSelectedToGroup(selectedBasketIds, retrieveTargetGroup);
    if (success) {
      setSelectedBasketIds(new Set());
      setRetrieveTargetGroup(-1);
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 shadow-lg">
        <button
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
          onClick={() => setBasketOpen(prev => !prev)}
        >
          <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            Sepet: {basketItems.filter(b => b.type !== "animalGroup").length} bağışçı
            {basketItems.filter(b => b.type === "animalGroup").length > 0 && `, ${basketItems.filter(b => b.type === "animalGroup").length} hayvan`}
          </span>
          {foreignBasketItems.length > 0 && (
            <span className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full font-semibold">
              {foreignBasketItems.length} diğer KA
            </span>
          )}
          {localBasketItems.length > 0 && (
            <>
              <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-full font-semibold">
                {basketTotalShares} hisse
              </span>
              <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-full font-semibold">
                ~{basketAnimals} hayvan
              </span>
            </>
          )}
          <ChevronUp className={`w-4 h-4 text-emerald-600 ml-auto transition-transform ${basketOpen ? "" : "rotate-180"}`} />
        </button>
        {basketOpen && (
          <div className="px-4 pb-3 space-y-2">
            {localBasketItems.length > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <label className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded w-3 h-3"
                    checked={selectedBasketIds.size === localBasketItems.length && localBasketItems.length > 0}
                    onChange={toggleSelectAll}
                  />
                  Tümünü Seç
                </label>
                {selectedBasketIds.size > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {selectedBasketIds.size} seçili
                  </span>
                )}
              </div>
            )}
            {localAnimalGroupItems.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-orange-700 dark:text-orange-300 flex-wrap">
                <span className="text-[10px] font-semibold mr-1">
                  <Package className="w-3 h-3 inline mr-0.5" />
                  Komple Hayvan:
                </span>
                {localAnimalGroupItems.map(b => (
                  <span
                    key={b.animalGroupId}
                    className={`px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900 rounded text-[10px] inline-flex items-center gap-0.5 cursor-pointer transition-colors ${selectedBasketIds.has(b.donationId) ? "ring-2 ring-orange-500 bg-orange-200 dark:bg-orange-800" : ""}`}
                    style={b.colorTag && b.colorTag in COLOR_MAP ? { borderLeft: `3px solid ${COLOR_MAP[b.colorTag as keyof typeof COLOR_MAP]}` } : {}}
                    onClick={() => toggleBasketSelect(b.donationId)}
                  >
                    <input
                      type="checkbox"
                      className="rounded w-2.5 h-2.5"
                      checked={selectedBasketIds.has(b.donationId)}
                      onChange={() => toggleBasketSelect(b.donationId)}
                      onClick={e => e.stopPropagation()}
                    />
                    Hayvan {b.animalNo} ({b.filledCount} bağışçı)
                    <button onClick={(e) => { e.stopPropagation(); removeFromBasket(b.donationId); setSelectedBasketIds(prev => { const next = new Set(prev); next.delete(b.donationId); return next; }); }} className="hover:text-red-500">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {localDonationItems.length > 0 && (() => {
              const grouped: { key: string; label: string; items: typeof localDonationItems }[] = [];
              const seen = new Map<string, number>();
              for (const b of localDonationItems) {
                const label = (b.description || b.name).trim();
                const existing = seen.get(label);
                if (existing !== undefined) {
                  grouped[existing].items.push(b);
                } else {
                  seen.set(label, grouped.length);
                  grouped.push({ key: label, label, items: [b] });
                }
              }
              return (
                <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 flex-wrap">
                  <span className="text-[10px] font-semibold mr-1">Bu KA:</span>
                  {grouped.slice(0, 6).map(g => {
                    const allSelected = g.items.every(item => selectedBasketIds.has(item.donationId));
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
                    return (
                      <span
                        key={g.key}
                        className={`px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900 rounded text-[10px] inline-flex items-center gap-0.5 cursor-pointer transition-colors ${allSelected ? "ring-2 ring-emerald-500 bg-emerald-200 dark:bg-emerald-800" : ""}`}
                        onClick={toggleGroup}
                      >
                        <input
                          type="checkbox"
                          className="rounded w-2.5 h-2.5"
                          checked={allSelected}
                          onChange={toggleGroup}
                          onClick={e => e.stopPropagation()}
                        />
                        {g.label}
                        {g.items.length > 1 && <span className="text-emerald-500">×{g.items.length}</span>}
                        <button onClick={(e) => { e.stopPropagation(); g.items.forEach(item => { removeFromBasket(item.donationId); setSelectedBasketIds(prev => { const next = new Set(prev); next.delete(item.donationId); return next; }); }); }} className="hover:text-red-500">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    );
                  })}
                  {grouped.length > 6 && (
                    <span className="text-[10px] text-emerald-500">+{grouped.length - 6} daha</span>
                  )}
                </div>
              );
            })()}
            {foreignBasketItems.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300 flex-wrap flex-1">
                  <span className="text-[10px] font-semibold mr-1">Diğer KA:</span>
                  {foreignBasketItems.slice(0, 4).map(b => (
                    <span key={b.donationId} className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-[10px] inline-flex items-center gap-0.5">
                      {b.description || b.name}
                      <button onClick={(e) => { e.stopPropagation(); removeFromBasket(b.donationId); }} className="hover:text-red-500">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  {foreignBasketItems.length > 4 && <span className="text-[10px] text-blue-500">+{foreignBasketItems.length - 4}</span>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-blue-300 text-blue-700 dark:text-blue-300"
                  onClick={() => setTransferToDonorListConfirm(true)}
                  disabled={transferToDonorListRemoving}
                >
                  {transferToDonorListRemoving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
                  Bağışçı Listesine Ekle ({foreignBasketItems.length})
                </Button>
              </div>
            )}

            {selectedBasketIds.size > 0 && (
              <div className="flex items-center gap-1 flex-wrap p-1.5 bg-emerald-100 dark:bg-emerald-900 rounded-lg border border-emerald-300 dark:border-emerald-700">
                <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-200 mr-1">
                  Sepetten Al ({selectedBasketIds.size} seçili):
                </span>
                <Select value={retrieveTargetGroup < 0 ? "" : String(retrieveTargetGroup)} onValueChange={(v) => setRetrieveTargetGroup(parseInt(v))}>
                  <SelectTrigger className="h-6 w-32 text-[10px]">
                    <SelectValue placeholder="Hedef grup..." />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {kesim.animalGroups.map((g, i) => {
                      const empty = g.donations.filter(d => !d.name.trim()).length;
                      return (
                        <SelectItem key={g.id} value={String(i)} disabled={g.locked || empty === 0}>
                          Hayvan {g.animalNo} ({empty} boş)
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  variant="default"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={handleTransferToGroup}
                  disabled={retrieveTargetGroup < 0}
                >
                  <MoveRight className="w-3 h-3 mr-0.5" />
                  Gruba Aktar
                </Button>
                <div className="w-px h-4 bg-emerald-300 dark:bg-emerald-700 mx-0.5" />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2 border-emerald-400 text-emerald-700 dark:text-emerald-300"
                  onClick={handleReturnToDonorList}
                >
                  <ListPlus className="w-3 h-3 mr-0.5" />
                  Bağışçı Listesine Ekle
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-1 text-emerald-600"
                  onClick={() => setSelectedBasketIds(new Set())}
                >
                  Seçimi Kaldır
                </Button>
              </div>
            )}

            <div className="flex items-center gap-1 flex-wrap">
              {localDonationItems.length > 0 && (
                <>
                  <Select value={String(basketTransferTarget)} onValueChange={(v) => setBasketTransferTarget(parseInt(v))}>
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue placeholder="Hedef grup..." />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {kesim.animalGroups.map((g, i) => {
                        const empty = g.donations.filter(d => !d.name.trim()).length;
                        return (
                          <SelectItem key={g.id} value={String(i)} disabled={g.locked || empty === 0}>
                            Hayvan {g.animalNo} ({empty} boş)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button variant="default" size="sm" className="h-7 text-xs" onClick={() => transferBasketToGroup(basketTransferTarget)} disabled={basketTransferTarget < 0}>
                    <Package className="w-3 h-3 mr-1" />
                    Yerleştir
                  </Button>
                  <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={autoDistributeBasket}>
                    <Wand2 className="w-3 h-3 mr-1" />
                    Otomatik Dağıt
                  </Button>
                </>
              )}
              {siblingKesimAlanlari.length > 0 && localBasketItems.length > 0 && (
                <>
                  <div className="w-px h-5 bg-emerald-300 dark:bg-emerald-700 mx-1" />
                  <Select value={basketCrossKATarget} onValueChange={setBasketCrossKATarget}>
                    <SelectTrigger className="h-7 w-40 text-xs">
                      <SelectValue placeholder="Başka KA'ya taşı..." />
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
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setCrossKAConfirmOpen(true)}
                    disabled={!basketCrossKATarget || crossKATransferring}
                  >
                    {crossKATransferring ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                    Aktar
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearBasket}>
                Temizle
              </Button>
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
              <h3 className="font-semibold text-base mb-3">Başka KA'ya Aktar</h3>
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
