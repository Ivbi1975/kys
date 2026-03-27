import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTrackingActions } from "@/hooks/useTrackingActions";
import { apiDeleteKesimAlani } from "@/lib/api";
import type { KesimAlani } from "@/lib/types";

interface UseKesimAlaniActionsOptions {
  onTokenGenerated: (kesimId: string, token: string) => void;
  onDeleted?: (id: string) => void;
  findKesimAlani: (id: string) => KesimAlani | undefined;
}

export function useKesimAlaniActions({
  onTokenGenerated,
  onDeleted,
  findKesimAlani,
}: UseKesimAlaniActionsOptions) {
  const { toast } = useToast();
  const { handleCopyTrackingLink, handleOpenTrackingPage, resolveToken, buildTrackingUrl } =
    useTrackingActions({ onTokenGenerated });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
    hasDonations: boolean;
  } | null>(null);

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [qrTitle, setQrTitle] = useState("");

  function requestDelete(id: string) {
    const target = findKesimAlani(id);
    if (!target) return;
    setDeleteConfirm({
      id,
      name: target.name,
      hasDonations: target.donations.length > 0,
    });
  }

  async function executeDelete() {
    if (!deleteConfirm) return;
    try {
      await apiDeleteKesimAlani(deleteConfirm.id);
      onDeleted?.(deleteConfirm.id);
      toast({
        title: "Kesim alanı silindi",
        description: `"${deleteConfirm.name}" çöp kutusuna taşındı.`,
      });
    } catch (err) {
      toast({
        title: "Silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setDeleteConfirm(null);
  }

  async function handleShowQrCode(e: React.MouseEvent, k: KesimAlani) {
    e.stopPropagation();
    try {
      const token = await resolveToken(k);
      const url = buildTrackingUrl(token);
      setQrUrl(url);
      setQrTitle(k.name);
      setQrModalOpen(true);
    } catch {
      toast({ title: "Hata", description: "QR kod oluşturulamadı.", variant: "destructive" });
    }
  }

  return {
    handleCopyTrackingLink,
    handleOpenTrackingPage,
    handleShowQrCode,
    requestDelete,
    executeDelete,
    deleteConfirm,
    setDeleteConfirm,
    qrModalOpen,
    setQrModalOpen,
    qrUrl,
    qrTitle,
  };
}
