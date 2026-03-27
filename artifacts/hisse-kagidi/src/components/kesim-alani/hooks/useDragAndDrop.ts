import { useState, useCallback, useRef, useEffect } from "react";
import type { KesimAlani, Donation } from "@/lib/types";

interface UseDragAndDropParams {
  kesim: KesimAlani | null;
  save: (data: KesimAlani, label?: string, forceImmediate?: boolean, saveType?: "full" | "donations" | "groups") => void;
  toast: (opts: { title: string; description?: string; variant?: "destructive" }) => void;
  isGroupLocked: (groupIdx: number) => boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useDragAndDrop({ kesim, save, toast, isGroupLocked, scrollContainerRef }: UseDragAndDropParams) {
  const [dragItem, setDragItem] = useState<{
    groupIdx: number;
    donationIdx: number;
  } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{
    groupIdx: number;
    donationIdx: number;
  } | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<number | null>(null);

  const dragOverRef = useRef<{ groupIdx: number; donationIdx: number } | null>(null);
  const dragOverGroupRef = useRef<number | null>(null);
  const dragRafRef = useRef<number>(0);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRafRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
      if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
      if (dragGhostRef.current) {
        document.body.removeChild(dragGhostRef.current);
        dragGhostRef.current = null;
      }
    };
  }, []);

  function moveGroupDonation(
    groupIdx: number,
    fromIdx: number,
    toGroupIdx: number,
    toIdx: number
  ) {
    if (!kesim) return;
    if (isGroupLocked(groupIdx) || isGroupLocked(toGroupIdx)) return;
    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: [...g.donations],
    }));
    const [item] = groups[groupIdx].donations.splice(fromIdx, 1);
    groups[toGroupIdx].donations.splice(toIdx, 0, item);

    if (groups[groupIdx].donations.length > 7) {
      groups[groupIdx].donations = groups[groupIdx].donations.slice(0, 7);
    }
    if (groups[toGroupIdx].donations.length > 7) {
      const overflow = groups[toGroupIdx].donations.splice(7);
      groups[groupIdx].donations.push(...overflow);
    }

    save({ ...kesim, animalGroups: groups }, `Grup içi taşıma yapıldı`, false, 'groups');
  }

  const handleDragStart = useCallback((groupIdx: number, donationIdx: number, e?: React.DragEvent) => {
    setDragItem({ groupIdx, donationIdx });
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      const target = e.currentTarget as HTMLElement;
      target.style.opacity = "0.5";

      const ghost = document.createElement("div");
      ghost.style.cssText = "position:fixed;top:-1000px;left:-1000px;padding:6px 12px;background:#6366f1;color:#fff;border-radius:6px;font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.2);";
      if (kesim) {
        const donation = kesim.animalGroups[groupIdx]?.donations[donationIdx];
        if (donation?.name.trim()) {
          ghost.textContent = `${donation.name} (${donation.shareCount} hisse)`;
          e.dataTransfer.setData("text/plain", `${donation.name} (${donation.shareCount} hisse)`);
        } else {
          ghost.textContent = `Sıra ${donationIdx + 1}`;
        }
      }
      document.body.appendChild(ghost);
      dragGhostRef.current = ghost;
      e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
    }
  }, [kesim]);

  const handleDragOver = useCallback((
    e: React.DragEvent,
    groupIdx: number,
    donationIdx: number
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const prev = dragOverRef.current;
    if (prev && prev.groupIdx === groupIdx && prev.donationIdx === donationIdx) return;
    dragOverRef.current = { groupIdx, donationIdx };
    dragOverGroupRef.current = groupIdx;

    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = requestAnimationFrame(() => {
      setDragOverItem({ groupIdx, donationIdx });
      setDragOverGroup(groupIdx);
    });

    const container = scrollContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const y = e.clientY;
      const edgeZone = 60;
      if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);

      const doAutoScroll = () => {
        if (!scrollContainerRef.current) return;
        const r = scrollContainerRef.current.getBoundingClientRect();
        const curY = dragOverRef.current ? y : 0;
        if (curY < r.top + edgeZone) {
          scrollContainerRef.current.scrollTop -= 8;
          autoScrollRafRef.current = requestAnimationFrame(doAutoScroll);
        } else if (curY > r.bottom - edgeZone) {
          scrollContainerRef.current.scrollTop += 8;
          autoScrollRafRef.current = requestAnimationFrame(doAutoScroll);
        }
      };

      if (y < rect.top + edgeZone || y > rect.bottom - edgeZone) {
        autoScrollRafRef.current = requestAnimationFrame(doAutoScroll);
      }
    }
  }, [scrollContainerRef]);

  const handleDragLeave = useCallback((e: React.DragEvent, groupIdx: number) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      if (dragOverGroupRef.current === groupIdx) {
        dragOverGroupRef.current = null;
        dragOverRef.current = null;
        setDragOverGroup(null);
      }
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = 0;
      }
    }
  }, []);

  const handleDrop = useCallback((groupIdx: number, donationIdx: number) => {
    if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
    dragOverRef.current = null;
    dragOverGroupRef.current = null;

    if (dragItem && kesim) {
      const srcGroup = kesim.animalGroups[dragItem.groupIdx];
      const tgtGroup = kesim.animalGroups[groupIdx];
      if (srcGroup && tgtGroup && dragItem.groupIdx !== groupIdx) {
        const dragDonation = srcGroup.donations[dragItem.donationIdx];
        const tgtDonation = tgtGroup.donations[donationIdx];
        if (dragDonation?.name.trim() && !tgtDonation?.name.trim()) {
          const tgtFilledCount = tgtGroup.donations.filter(d => d.name.trim()).length;
          if (tgtFilledCount + 1 > 7) {
            toast({
              title: "Kapasite Aşımı",
              description: `Hedef grupta boş slot kalmadı.`,
              variant: "destructive",
            });
            setDragItem(null);
            setDragOverItem(null);
            setDragOverGroup(null);
            return;
          }
        }
      }
      moveGroupDonation(
        dragItem.groupIdx,
        dragItem.donationIdx,
        groupIdx,
        donationIdx
      );
    }
    setDragItem(null);
    setDragOverItem(null);
    setDragOverGroup(null);
  }, [dragItem, kesim]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    dragOverRef.current = null;
    dragOverGroupRef.current = null;
    setDragItem(null);
    setDragOverItem(null);
    setDragOverGroup(null);

    if (dragGhostRef.current) {
      document.body.removeChild(dragGhostRef.current);
      dragGhostRef.current = null;
    }
  }, []);

  const handleDragOverCard = useCallback((e: React.DragEvent, groupIdx: number) => {
    e.preventDefault();
    if (dragOverGroupRef.current === groupIdx) return;
    dragOverGroupRef.current = groupIdx;
    setDragOverGroup(groupIdx);
  }, []);

  return {
    dragItem,
    setDragItem,
    dragOverItem,
    setDragOverItem,
    dragOverGroup,
    setDragOverGroup,
    moveGroupDonation,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleDragOverCard,
  };
}
