import { useCallback } from "react";
import { generateTrackingToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { KesimAlani } from "@/lib/types";

interface UseTrackingActionsOptions {
  onTokenGenerated?: (kesimId: string, token: string) => void;
}

export function useTrackingActions(options?: UseTrackingActionsOptions) {
  const { toast } = useToast();

  const resolveToken = useCallback(async (k: KesimAlani): Promise<string> => {
    if (k.trackingToken) return k.trackingToken;
    const token = await generateTrackingToken(k.id);
    options?.onTokenGenerated?.(k.id, token);
    return token;
  }, [options]);

  const buildTrackingUrl = useCallback((token: string): string => {
    return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/takip/${token}`;
  }, []);

  const handleCopyTrackingLink = useCallback(async (e: React.MouseEvent, k: KesimAlani) => {
    e.stopPropagation();
    try {
      const token = await resolveToken(k);
      const url = buildTrackingUrl(token);
      await navigator.clipboard.writeText(url);
      toast({ title: "Link kopyalandı", description: "Takip linki panoya kopyalandı." });
    } catch {
      toast({ title: "Hata", description: "Link kopyalanamadı.", variant: "destructive" });
    }
  }, [resolveToken, buildTrackingUrl, toast]);

  const handleOpenTrackingPage = useCallback(async (e: React.MouseEvent, k: KesimAlani) => {
    e.stopPropagation();
    try {
      const token = await resolveToken(k);
      window.open(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/takip/${token}`, "_blank");
    } catch {
      toast({ title: "Hata", description: "Takip sayfası açılamadı.", variant: "destructive" });
    }
  }, [resolveToken, toast]);

  return { handleCopyTrackingLink, handleOpenTrackingPage, buildTrackingUrl, resolveToken };
}
