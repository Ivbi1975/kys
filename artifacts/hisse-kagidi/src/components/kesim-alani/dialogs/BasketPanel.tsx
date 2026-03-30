import type { KesimAlani, Donation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronUp, Loader2, Package, Send, ShoppingBag, UserPlus, Wand2, X } from "lucide-react";
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
}

export function BasketPanel({
  kesim, basketItems, localBasketItems, foreignBasketItems,
  basketOpen, setBasketOpen, removeFromBasket, clearBasket,
  basketTransferTarget, setBasketTransferTarget, transferBasketToGroup, autoDistributeBasket,
  basketCrossKATarget, setBasketCrossKATarget, crossKATransferring, transferBasketToOtherKA,
  siblingKesimAlanlari,
  transferToDonorListConfirm, setTransferToDonorListConfirm,
  transferToDonorListRemoving, transferForeignToCurrentDonorList,
}: BasketPanelProps) {
  if (basketItems.length === 0) return null;

  const sharesMap = computeEffectiveShares(kesim.donations);
  let basketTotalShares = 0;
  for (const b of localBasketItems) {
    const grouped = kesim.animalGroups.flatMap(g => g.donations).find(d => d.id === b.donationId);
    if (grouped) {
      basketTotalShares += 1;
    } else {
      basketTotalShares += sharesMap.get(b.donationId) || 1;
    }
  }
  const basketAnimals = Math.ceil(basketTotalShares / 7);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 shadow-lg">
        <button
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
          onClick={() => setBasketOpen(prev => !prev)}
        >
          <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            Sepet: {basketItems.length} bağışçı
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
            {localBasketItems.length > 0 && (() => {
              const grouped: { key: string; label: string; items: typeof localBasketItems }[] = [];
              const seen = new Map<string, number>();
              for (const b of localBasketItems) {
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
                  {grouped.slice(0, 6).map(g => (
                    <span key={g.key} className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900 rounded text-[10px] inline-flex items-center gap-0.5">
                      {g.label}
                      {g.items.length > 1 && <span className="text-emerald-500">×{g.items.length}</span>}
                      <button onClick={(e) => { e.stopPropagation(); g.items.forEach(item => removeFromBasket(item.donationId)); }} className="hover:text-red-500">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
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
            <div className="flex items-center gap-1 flex-wrap">
              {localBasketItems.length > 0 && (
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
                    onClick={() => transferBasketToOtherKA(basketCrossKATarget)}
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
              Sepetteki <strong>{basketItems.filter(b => b.kesimAlaniId !== kesim.id).length}</strong> bağışçıyı bu kesim alanının bağışçı listesine eklemek istiyorsunuz.
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
    </>
  );
}
