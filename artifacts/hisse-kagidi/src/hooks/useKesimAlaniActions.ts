import { useState, useCallback, useRef } from "react";
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

  const findKesimAlaniRef = useRef(findKesimAlani);
  findKesimAlaniRef.current = findKesimAlani;

  const onDeletedRef = useRef(onDeleted);
  onDeletedRef.current = onDeleted;

  const deleteConfirmRef = useRef(deleteConfirm);
  deleteConfirmRef.current = deleteConfirm;

  const requestDelete = useCallback((id: string) => {
    const target = findKesimAlaniRef.current(id);
    if (!target) return;
    setDeleteConfirm({
      id,
      name: target.name,
      hasDonations: target.donations.length > 0,
    });
  }, []);

  const executeDelete = useCallback(async () => {
    const current = deleteConfirmRef.current;
    if (!current) return;
    try {
      await apiDeleteKesimAlani(current.id);
      await onDeletedRef.current?.(current.id);
      toast({
        title: "Kesim alanı silindi",
        description: `"${current.name}" çöp kutusuna taşındı.`,
      });
    } catch (err) {
      toast({
        title: "Silme hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
    setDeleteConfirm(null);
  }, [toast]);

  const handleShowQrCode = useCallback(async (e: React.MouseEvent, k: KesimAlani) => {
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
  }, [resolveToken, buildTrackingUrl, toast]);

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
