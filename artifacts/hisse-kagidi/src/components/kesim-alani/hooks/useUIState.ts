import { useState, useRef, useCallback, useEffect } from "react";
import type { VirtuosoHandle } from "react-virtuoso";
import type { CustomTag, TagCategory, ColorTag } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/lib/useTheme";

export function useUIState() {
  const isMobile = useIsMobile();
  const { toggle: toggleTheme, mode: themeMode } = useTheme();

  const [colorTagFilter, setColorTagFilter] = useState<ColorTag | "all">("all");
  const [groupCinsFilter, setGroupCinsFilter] = useState<Set<string>>(new Set());
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false);
  const [jumpToAnimal, setJumpToAnimal] = useState("");
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [donorListVisible, setDonorListVisible] = useState(true);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileTab, setMobileTab] = useState<"donors" | "groups">("donors");
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [globalTags, setGlobalTags] = useState<CustomTag[]>([]);
  const [tagCategories, setTagCategories] = useState<TagCategory[]>([]);
  const [tagPopoverDonorId, setTagPopoverDonorId] = useState<string | null>(null);
  const [smartPlacePopover, setSmartPlacePopover] = useState<string | null>(null);
  const [splitShareDialog, setSplitShareDialog] = useState<{ donationId: string; totalShares: number } | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const groupsScrollTopRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const groupsHeaderRef = useRef<HTMLDivElement>(null);
  const groupsVirtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollToAnimalGroupRef = useRef<((animalNo: number) => void) | undefined>(undefined);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return {
    isMobile,
    toggleTheme,
    themeMode,
    colorTagFilter, setColorTagFilter,
    groupCinsFilter, setGroupCinsFilter,
    jumpDialogOpen, setJumpDialogOpen,
    jumpToAnimal, setJumpToAnimal,
    shortcutHelpOpen, setShortcutHelpOpen,
    minimapOpen, setMinimapOpen,
    isFullscreen, setIsFullscreen,
    donorListVisible, setDonorListVisible,
    fullscreenMode, setFullscreenMode,
    showScrollTop, setShowScrollTop,
    mobileTab, setMobileTab,
    isDraggingSplit, setIsDraggingSplit,
    globalTags, setGlobalTags,
    tagCategories, setTagCategories,
    tagPopoverDonorId, setTagPopoverDonorId,
    smartPlacePopover, setSmartPlacePopover,
    splitShareDialog, setSplitShareDialog,
    qrModalOpen, setQrModalOpen,
    qrUrl, setQrUrl,
    splitContainerRef,
    scrollContainerRef,
    groupsScrollTopRef,
    searchInputRef,
    jumpInputRef,
    groupsHeaderRef,
    groupsVirtuosoRef,
    scrollToAnimalGroupRef,
    toggleFullscreen,
  };
}
