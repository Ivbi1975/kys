import { useState, useCallback } from "react";
import type { KesimAlani } from "@/lib/types";
import { fetchDeletedDonations, apiRestoreDonation, apiPermanentDeleteDonation } from "@/lib/api";
import type { DeletedDonation } from "@/lib/api";

interface UseTrashDeps {
  kesim: KesimAlani | null;
  setKesim: React.Dispatch<React.SetStateAction<KesimAlani | null>>;
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  history: { initialize: (data: KesimAlani) => void };
}

export function useTrash({ kesim, setKesim, toast, history }: UseTrashDeps) {
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashItems, setTrashItems] = useState<DeletedDonation[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashPermanentConfirm, setTrashPermanentConfirm] = useState<string | null>(null);

  const openTrash = useCallback(async () => {
    if (!kesim) return;
    setTrashOpen(true);
    setTrashLoading(true);
    try {
      const items = await fetchDeletedDonations(kesim.id);
      setTrashItems(items);
    } catch (err) {
      toast({
        title: "Çöp kutusu yüklenemedi",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setTrashLoading(false);
    }
  }, [kesim, toast]);

  const restoreDonation = useCallback(
    async (donationId: string) => {
      if (!kesim) return;
      try {
        const updated = await apiRestoreDonation(kesim.id, donationId);
        setKesim(updated);
        setTrashItems((prev) => prev.filter((d) => d.id !== donationId));
        toast({ title: "Geri yüklendi", description: "Bağışçı başarıyla geri yüklendi." });
      } catch (err) {
        toast({
          title: "Geri yükleme hatası",
          description: err instanceof Error ? err.message : "Bilinmeyen hata",
          variant: "destructive",
        });
      }
    },
    [kesim, setKesim, toast]
  );

  const permanentDeleteDonation = useCallback(
    async (donationId: string) => {
      if (!kesim) return;
      try {
        await apiPermanentDeleteDonation(kesim.id, donationId);
        setTrashItems((prev) => prev.filter((d) => d.id !== donationId));
        setTrashPermanentConfirm(null);
        toast({ title: "Kalıcı olarak silindi" });
      } catch (err) {
        toast({
          title: "Kalıcı silme hatası",
          description: err instanceof Error ? err.message : "Bilinmeyen hata",
          variant: "destructive",
        });
      }
    },
    [kesim, toast]
  );

  return {
    trashOpen,
    setTrashOpen,
    trashItems,
    setTrashItems,
    trashLoading,
    setTrashLoading,
    trashPermanentConfirm,
    setTrashPermanentConfirm,
    openTrash,
    restoreDonation,
    permanentDeleteDonation,
  };
}
