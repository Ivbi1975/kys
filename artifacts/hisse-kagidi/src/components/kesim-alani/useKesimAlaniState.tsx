import React, { useState, useEffect, useCallback, useRef, createElement, useMemo, forwardRef, useTransition, Suspense } from "react";
import { turkishNormalize } from "@/lib/utils";
import { TableVirtuoso, Virtuoso, type VirtuosoHandle } from "react-virtuoso";
const QrCodeModal = React.lazy(() => import("@/components/QrCodeModal"));
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Printer,
  ArrowUpDown,
  Wand2,
  Upload,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  FileSpreadsheet,
  ClipboardPaste,
  Settings2,
  EyeOff,
  Eye,
  Loader2,
  AlertTriangle,
  Search,
  UserCog,
  Undo2,
  Redo2,
  History,
  Lock,
  Unlock,
  Sun,
  Moon,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Scissors,
  Merge,
  ArrowLeftRight,
  Sparkles,
  CheckSquare,
  Square,
  Columns,
  Minimize2,
  Maximize2,
  ChevronsUpDown,
  ChevronsDownUp,
  Columns3,
  LayoutGrid,
  SlidersHorizontal,
  Filter,
  Brain,
  MoveRight,
  X,
  HelpCircle,
  Keyboard,
  Map as MapIcon,
  Maximize,
  Minimize,
  Save,
  ShoppingBag,
  Package,
  SearchX,
  RotateCcw,
  Send,
  Home,
  ChevronRight,
  Link2,
  Copy,
  MessageSquarePlus,
  Edit3,
  Check,
  QrCode,
  Tag,
  Camera,
  FileText,
  Monitor,
  UserPlus,
} from "lucide-react";
import type { Donation, AnimalGroup, KesimAlani, ColorTag, CustomTag, Team } from "@/lib/types";
import { fetchKesimAlani, fetchKesimAlanlari, fetchProjects, apiUpdateKesimAlani, apiUpdateBulkAnimalGroups, apiUpdateSingleDonation, apiUpdateSingleGroup, fetchTags, fetchDeletedDonations, apiSoftDeleteDonation, apiRestoreDonation, apiPermanentDeleteDonation, moveDonationsToKesimAlani, generateTrackingToken, fetchKesimAlaniTrackingNotes, updateTrackingNoteStatus, fetchGroupPhotosAdmin, getGroupPhotoUrlAdmin, fetchPhotoCountsAdmin, createTeam, updateTeam, deleteTeam, assignTeamAdmin, fetchNotificationLogs, fetchNotificationTemplate, updateNotificationTemplate, createDonationTransfers, downloadCsvExport } from "@/lib/api";
import type { DeletedDonation, TrackingNote, GroupPhoto, NotificationLog, DonationTransferEntry } from "@/lib/api";
import PhotoGallery from "@/components/PhotoGallery";
import { AnimalGroupCard } from "@/components/AnimalGroupCard";
import { getTotalShares, getRequiredAnimals, checkGroupConflicts, computeEffectiveShares, trCollator } from "@/lib/grouping";
import type { GroupingProgress, ConflictInfo } from "@/lib/grouping";
import { useGroupingWorker } from "@/lib/useGroupingWorker";
import { useHistory } from "@/lib/useHistory";
import { useWorkspacePreferences, ALL_GROUP_COLUMNS, type ColumnKey } from "@/lib/useWorkspacePreferences";
import { useTheme } from "@/lib/useTheme";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
const getXLSX = () => import("xlsx-js-style");


  type SortField = "name" | "description" | "donationType" | "shareCount";
type SortDir = "asc" | "desc";
export type ColumnMapping = "name" | "description" | "donationType" | "shareCount" | "vekalet" | "notes" | "skip";

interface BasketItem {
  donationId: string;
  kesimAlaniId: string;
  kesimAlaniName: string;
  name: string;
  description: string;
}

const BASKET_STORAGE_KEY = "kurban-basket";

function loadBasketFromStorage(projectId: string | null | undefined): BasketItem[] {
  try {
    const key = projectId ? `${BASKET_STORAGE_KEY}-${projectId}` : BASKET_STORAGE_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveBasketToStorage(items: BasketItem[], projectId: string | null | undefined) {
  try {
    const key = projectId ? `${BASKET_STORAGE_KEY}-${projectId}` : BASKET_STORAGE_KEY;
    if (items.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(items));
    }
  } catch {}
}

const COLUMN_OPTIONS: { value: ColumnMapping; label: string }[] = [
  { value: "name", label: "Adına Kesilen" },
  { value: "description", label: "Vekaleti Veren" },
  { value: "donationType", label: "Cinsi" },
  { value: "shareCount", label: "Hisse Sayısı" },
  { value: "vekalet", label: "Vekalet No" },
  { value: "notes", label: "Notlar" },
  { value: "skip", label: "Atla (kullanma)" },
];

function generateId(): string {
  return crypto.randomUUID();
}

const emptyDonations: Donation[] = [];
const emptyGroups: AnimalGroup[] = [];

const VirtuosoTable = forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>((props, ref) => (
  <table {...props} ref={ref} className="w-full text-sm" />
));
const VirtuosoTableHead = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>((props, ref) => (
  <thead {...props} ref={ref} className="bg-background sticky top-0 z-10" />
));


  export function useKesimAlaniState() {
    const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [colorTagFilter, setColorTagFilter] = useState<ColorTag | "all">("all");
  const history = useHistory();
  const { toggle: toggleTheme, mode: themeMode } = useTheme();

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [bulkStep, setBulkStep] = useState<"input" | "mapping" | "review">("input");
  const [bulkReviewRows, setBulkReviewRows] = useState<{ idx: number; row: string[]; rawShareCount: number; selected: boolean; groupKey: string; groupTotal: number }[]>([]);
  const [bulkReviewExpanded, setBulkReviewExpanded] = useState<Set<string>>(new Set());
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    donationId: string;
    field: string;
  } | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const isMobile = useIsMobile();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupingInProgress, setGroupingInProgress] = useState(false);
  const [groupingProgress, setGroupingProgress] = useState<GroupingProgress | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [personEditDesc, setPersonEditDesc] = useState<string | null>(null);
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filterUngrouped, setFilterUngrouped] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [groupSearchMatchIdx, setGroupSearchMatchIdx] = useState(0);
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);
  const [highlightIncomplete, setHighlightIncomplete] = useState(true);
  const [selectedGroupDonations, setSelectedGroupDonations] = useState<Set<string>>(new Set());
  const [bulkMoveTargetGroup, setBulkMoveTargetGroup] = useState<number>(-1);
  const [bulkGroupEditOpen, setBulkGroupEditOpen] = useState(false);
  const [bulkGroupEditField, setBulkGroupEditField] = useState<"donationType" | "notes">("donationType");
  const [bulkGroupEditValue, setBulkGroupEditValue] = useState("");
  const [jumpToAnimal, setJumpToAnimal] = useState("");
  const [highlightDonationId, setHighlightDonationId] = useState<string | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<"donationType" | "shareCount" | "notes" | "vekalet">("donationType");
  const [bulkEditValue, setBulkEditValue] = useState("");
  const [rangeLockInput, setRangeLockInput] = useState("");
  const [dragItem, setDragItem] = useState<{
    groupIdx: number;
    donationIdx: number;
  } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{
    groupIdx: number;
    donationIdx: number;
  } | null>(null);
  const [donorListVisible, setDonorListVisible] = useState(true);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const workspace = useWorkspacePreferences();
  const { runGrouping, runIncrementalGrouping, cancelGrouping } = useGroupingWorker();
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const groupsScrollTopRef = useRef<number>(0);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [columnDragItem, setColumnDragItem] = useState<ColumnKey | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [swapSelection, setSwapSelection] = useState<{
    groupIdx: number;
    donationIdx: number;
  } | null>(null);
  const [swapPreviewOpen, setSwapPreviewOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{
    groupIdx: number;
    donationIdx: number;
  } | null>(null);
  const [autoResolveOpen, setAutoResolveOpen] = useState(false);
  const [resolveResults, setResolveResults] = useState<Array<{
    desc: string;
    swaps: Array<{
      fromGroup: number;
      fromIdx: number;
      toGroup: number;
      toIdx: number;
      fromName: string;
      toName: string;
    }>;
  }>>([]);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [globalTags, setGlobalTags] = useState<CustomTag[]>([]);
  const [filterCinsi, setFilterCinsi] = useState<string>("all");
  const [filterHisseMin, setFilterHisseMin] = useState<number>(0);
  const [filterHisseMax, setFilterHisseMax] = useState<number>(0);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterAiCategories, setFilterAiCategories] = useState<string[]>([]);
  const [filterAiWarnings, setFilterAiWarnings] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "excluded">("all");
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [tagPopoverDonorId, setTagPopoverDonorId] = useState<string | null>(null);
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
  const [basketTransferTarget, setBasketTransferTarget] = useState<number>(-1);
  const [basketCrossKATarget, setBasketCrossKATarget] = useState<string>("");
  const [siblingKesimAlanlari, setSiblingKesimAlanlari] = useState<{ id: string; name: string }[]>([]);
  const [crossKATransferring, setCrossKATransferring] = useState(false);
  const [basketOpen, setBasketOpen] = useState(true);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [, startFilterTransition] = useTransition();
  const [removedFromGroupIds, setRemovedFromGroupIds] = useState<Set<string>>(new Set());
  const [showRemovedFilter, setShowRemovedFilter] = useState(false);
  const [smartPlacePopover, setSmartPlacePopover] = useState<string | null>(null);
  const [splitShareDialog, setSplitShareDialog] = useState<{ donationId: string; totalShares: number } | null>(null);
  const [splitGroupDialog, setSplitGroupDialog] = useState<{ groupIdx: number; splitAt: number } | null>(null);
  const [personBulkDeleteConfirm, setPersonBulkDeleteConfirm] = useState<string | null>(null);

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

  const [trackingNotesOpen, setTrackingNotesOpen] = useState(false);
  const [trackingNotes, setTrackingNotes] = useState<TrackingNote[]>([]);
  const [trackingNotesLoading, setTrackingNotesLoading] = useState(false);

  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [photoViewGroup, setPhotoViewGroup] = useState<{ id: string; animalNo: number } | null>(null);
  const [photoViewPhotos, setPhotoViewPhotos] = useState<GroupPhoto[]>([]);
  const [photoViewLoading, setPhotoViewLoading] = useState(false);

  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamEditId, setTeamEditId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#3b82f6");
  const [teamSaving, setTeamSaving] = useState(false);
  const [filterTeam, setFilterTeam] = useState<string>("all");

  const [notificationLogsOpen, setNotificationLogsOpen] = useState(false);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [notificationLogsLoading, setNotificationLogsLoading] = useState(false);
  const [notificationTemplateOpen, setNotificationTemplateOpen] = useState(false);
  const [notificationTemplate, setNotificationTemplate] = useState("Hayvan {animalNo} kesildi. Hayırlı olsun!");
  const [notificationTemplateSaving, setNotificationTemplateSaving] = useState(false);

  const [donorListReportOpen, setDonorListReportOpen] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);

  async function handleExportKaCsv() {
    if (!kesim) return;
    setCsvExporting(true);
    try {
      const blob = await downloadCsvExport(kesim.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kesim.name.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ ]/g, "").replace(/\s+/g, "_")}_bagiscilar.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV indirildi" });
    } catch (err) {
      toast({
        title: "CSV export hatası",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setCsvExporting(false);
    }
  }
  const [transferToDonorListConfirm, setTransferToDonorListConfirm] = useState(false);
  const [transferToDonorListRemoving, setTransferToDonorListRemoving] = useState(false);
  const [findDeleteOpen, setFindDeleteOpen] = useState(false);
  const [findDeleteColumn, setFindDeleteColumn] = useState<"name" | "description" | "donationType" | "vekalet" | "notes">("description");
  const [findDeleteValue, setFindDeleteValue] = useState("");
  const [findDeleteConfirm, setFindDeleteConfirm] = useState(false);

  const [groupFindDeleteOpen, setGroupFindDeleteOpen] = useState(false);
  const [groupFindDeleteColumn, setGroupFindDeleteColumn] = useState<"name" | "description" | "donationType" | "vekalet" | "notes">("description");
  const [groupFindDeleteValue, setGroupFindDeleteValue] = useState("");
  const [groupFindDeleteConfirm, setGroupFindDeleteConfirm] = useState(false);

  const [trashOpen, setTrashOpen] = useState(false);
  const [trashItems, setTrashItems] = useState<DeletedDonation[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashPermanentConfirm, setTrashPermanentConfirm] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const groupsHeaderRef = useRef<HTMLDivElement>(null);
  const groupsVirtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    async function loadData() {
      if (params.id) {
        const data = await fetchKesimAlani(params.id);
        if (data) {
          setKesim(data);
          history.initialize(data);
          const stored = loadBasketFromStorage(data.projectId);
          setBasketItems(stored);
          fetchPhotoCountsAdmin(data.id).then(setPhotoCounts).catch(() => {});
          if (data.projectId) {
            try {
              const [allKA, projects] = await Promise.all([
                fetchKesimAlanlari(),
                fetchProjects(),
              ]);
              const siblings = allKA
                .filter(ka => ka.projectId === data.projectId && ka.id !== data.id && !ka.deletedAt)
                .map(ka => ({ id: ka.id, name: ka.name }));
              setSiblingKesimAlanlari(siblings);
              const proj = projects.find(p => p.id === data.projectId);
              if (proj) setProjectName(proj.name);
            } catch {}
          }
        } else {
          setLocation("/");
        }
      }
      try {
        const tags = await fetchTags();
        setGlobalTags(tags);
      } catch {}
    }
    loadData();
  }, [params.id, setLocation]);

  useEffect(() => {
    if (!kesim) return;
    const urlParams = new URLSearchParams(window.location.search);
    const highlightId = urlParams.get("highlight");
    if (highlightId) {
      setHighlightDonationId(highlightId);
      const url = new URL(window.location.href);
      url.searchParams.delete("highlight");
      window.history.replaceState({}, "", url.toString());
      setTimeout(() => {
        const el = document.querySelector(`[data-donation-id="${highlightId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        setTimeout(() => setHighlightDonationId(null), 4000);
      }, 500);
    }
  }, [kesim?.id]);

  useEffect(() => {
    if (kesim) {
      saveBasketToStorage(basketItems, kesim.projectId);
    }
  }, [basketItems, kesim?.projectId]);

  useEffect(() => {
    const handleScroll = () => {
      const container = scrollContainerRef.current;
      const scrollY = container ? container.scrollTop : window.scrollY;
      setShowScrollTop(scrollY > 150);
    };
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => container.removeEventListener("scroll", handleScroll);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [fullscreenMode]);

  useEffect(() => {
    setSwapSelection(null);
    setSwapTarget(null);
    setSwapPreviewOpen(false);
    setSelectedGroupIds(prev => {
      if (!kesim || prev.size === 0) return prev;
      const validIds = new Set(kesim.animalGroups.map(g => g.id));
      const filtered = new Set([...prev].filter(id => validIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [kesim?.animalGroups]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreenMode) {
        setFullscreenMode(false);
      }
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (kesim) {
          saveToApi(kesim);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        if (!jumpDialogOpen) {
          setJumpDialogOpen(true);
        }
      }
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShortcutHelpOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        if (editingCell) {
          cancelEdit();
        }
        if (shortcutHelpOpen) {
          setShortcutHelpOpen(false);
        }
        if (minimapOpen) {
          setMinimapOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [kesim, editingCell, shortcutHelpOpen, minimapOpen, fullscreenMode, jumpDialogOpen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplit || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const ratio = ((e.clientX - rect.left) / rect.width) * 100;
      workspace.setSplitRatio(ratio);
    };
    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };
    if (isDraggingSplit) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSplit]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [mobileTab, setMobileTab] = useState<"donors" | "groups">("donors");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<KesimAlani | null>(null);


  const buildErrorDescription = useCallback((errMsg: string) => {
    const animalNoMatches = errMsg.match(/[Hh]ayvan\s*(?:No|no|#)?\s*[:.]?\s*(\d+(?:\s*[,\/]\s*\d+)*)/g);
    if (animalNoMatches) {
      const parts: (string | ReturnType<typeof createElement>)[] = [];
      let lastIndex = 0;
      for (const match of animalNoMatches) {
        const matchIndex = errMsg.indexOf(match, lastIndex);
        if (matchIndex > lastIndex) {
          parts.push(errMsg.substring(lastIndex, matchIndex));
        }
        const numbers = match.match(/\d+/g) || [];
        const prefix = match.replace(/\d+(?:\s*[,\/]\s*\d+)*/g, "").trim();
        parts.push(prefix + " ");
        numbers.forEach((num, idx) => {
          if (idx > 0) parts.push(", ");
          const animalNo = parseInt(num, 10);
          parts.push(
            createElement(
              "button",
              {
                key: `animal-${animalNo}-${idx}`,
                className: "underline font-semibold hover:text-red-300 cursor-pointer",
                onClick: () => {
                  scrollToAnimalGroup(animalNo);
                },
              },
              String(animalNo)
            )
          );
        });
        lastIndex = matchIndex + match.length;
      }
      if (lastIndex < errMsg.length) {
        parts.push(errMsg.substring(lastIndex));
      }
      return createElement("span", null, ...parts);
    }
    return errMsg;
  }, []);

  const saveToApi = useCallback((data: KesimAlani, saveType: 'full' | 'donations' | 'groups' = 'full') => {
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const apiCall = saveType === 'groups'
      ? apiUpdateBulkAnimalGroups(data.id, data.animalGroups)
      : apiUpdateKesimAlani(data);
    apiCall
      .then(() => {
        setSaveStatus("saved");
        setLastSavedTime(new Date());
        saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      })
      .catch(err => {
        setSaveStatus("error");
        const errMsg = err instanceof Error ? err.message : "Veriler kaydedilemedi";
        toast({
          title: "Kaydetme hatası",
          description: buildErrorDescription(errMsg),
          variant: "destructive",
        });
        saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 5000);
      });
  }, [toast, buildErrorDescription]);

  const pendingSaveTypeRef = useRef<'full' | 'donations' | 'groups'>('full');

  const debouncedSaveToApi = useCallback((data: KesimAlani, saveType: 'full' | 'donations' | 'groups' = 'full') => {
    if (pendingSaveRef.current && pendingSaveTypeRef.current !== saveType) {
      saveType = 'full';
    }
    pendingSaveRef.current = data;
    pendingSaveTypeRef.current = saveType;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (pendingSaveRef.current) {
        saveToApi(pendingSaveRef.current, pendingSaveTypeRef.current);
        pendingSaveRef.current = null;
      }
    }, 600);
  }, [saveToApi]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (pendingSaveRef.current) {
        saveToApi(pendingSaveRef.current, pendingSaveTypeRef.current);
      }
    };
  }, [saveToApi]);

  const discardPendingSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingSaveRef.current = null;
  }, []);

  const save = useCallback(
    (updated: KesimAlani, desc?: string, immediate?: boolean, saveType: 'full' | 'donations' | 'groups' = 'full') => {
      setKesim(updated);
      if (immediate) {
        discardPendingSave();
        saveToApi(updated, saveType);
      } else {
        debouncedSaveToApi(updated, saveType);
      }
      if (desc) {
        history.push(updated, desc);
      }
    },
    [saveToApi, debouncedSaveToApi, discardPendingSave]
  );

  const handleUndo = useCallback(() => {
    const prev = history.undo();
    if (prev) {
      setKesim(prev);
      discardPendingSave();
      saveToApi(prev);
    }
  }, [history, saveToApi, discardPendingSave]);

  const handleRedo = useCallback(() => {
    const next = history.redo();
    if (next) {
      setKesim(next);
      discardPendingSave();
      saveToApi(next);
    }
  }, [history, saveToApi, discardPendingSave]);

  const handleGoToStep = useCallback((index: number) => {
    const target = history.goToStep(index);
    if (target) {
      setKesim(target);
      saveToApi(target);
    }
  }, [history, saveToApi]);

  const saveSingleDonationField = useCallback((
    donationId: string,
    updates: Record<string, string | number | boolean | string[]>
  ) => {
    if (!kesim) return;
    apiUpdateSingleDonation(kesim.id, donationId, updates).catch(err => {
      const errMsg = err instanceof Error ? err.message : "Bağışçı kaydedilemedi";
      toast({ title: "Kaydetme hatası", description: errMsg, variant: "destructive" });
    });
  }, [kesim?.id, toast]);

  const saveSingleGroupField = useCallback((
    groupId: string,
    updates: Record<string, unknown>
  ) => {
    if (!kesim) return;
    apiUpdateSingleGroup(kesim.id, groupId, updates).catch(err => {
      const errMsg = err instanceof Error ? err.message : "Grup kaydedilemedi";
      toast({ title: "Kaydetme hatası", description: errMsg, variant: "destructive" });
    });
  }, [kesim?.id, toast]);

  function addDonation(donationData?: { name: string; description: string; donationType: string; shareCount: number; vekalet: string; notes: string; phone: string }) {
    if (!kesim || !donationData || !donationData.name.trim()) return;
    const donation: Donation = {
      id: generateId(),
      name: donationData.name.trim(),
      description: donationData.description.trim(),
      donationType: donationData.donationType.trim(),
      shareCount: Math.max(1, Math.min(7, donationData.shareCount)),
      vekalet: donationData.vekalet.trim(),
      notes: donationData.notes.trim(),
      phone: donationData.phone?.trim() || "",
    };
    save({ ...kesim, donations: [...kesim.donations, donation] }, `Bağışçı eklendi: ${donation.description || donation.name}`);
    setAddDialogOpen(false);
  }

  async function deleteDonation(id: string) {
    if (!kesim) return;
    const target = kesim.donations.find(d => d.id === id);
    try {
      await apiSoftDeleteDonation(kesim.id, id);
      const updated = {
        ...kesim,
        donations: kesim.donations.filter((d) => d.id !== id),
        animalGroups: kesim.animalGroups.map(g => ({
          ...g,
          donations: g.donations.filter(d => d.id !== id),
        })),
      };
      setKesim(updated);
      history.push(updated, `Bağışçı silindi: ${target?.description || target?.name || ""}`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast({ title: "Çöp kutusuna taşındı", description: `"${target?.description || target?.name || id}" çöp kutusuna taşındı.` });
    } catch (err) {
      toast({ title: "Silme hatası", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }

  async function deleteSelected() {
    if (!kesim || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map(id => apiSoftDeleteDonation(kesim.id, id)));
      const updated = {
        ...kesim,
        donations: kesim.donations.filter((d) => !selectedIds.has(d.id)),
        animalGroups: kesim.animalGroups.map(g => ({
          ...g,
          donations: g.donations.filter(d => !selectedIds.has(d.id)),
        })),
      };
      setKesim(updated);
      history.push(updated, `${ids.length} bağışçı silindi`);
      setSelectedIds(new Set());
      toast({ title: "Çöp kutusuna taşındı", description: `${ids.length} bağışçı çöp kutusuna taşındı.` });
    } catch (err) {
      toast({ title: "Silme hatası", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!kesim) return;
    if (selectedIds.size === kesim.donations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(kesim.donations.map((d) => d.id)));
    }
  }

  function updateDonationField(id: string, field: keyof Donation, value: string | number | boolean) {
    if (!kesim) return;
    if (field === "excluded" && value === true) {
      const target = kesim.donations.find(d => d.id === id);
      if (target && target.description.trim()) {
        const key = target.description.trim().toLocaleLowerCase("tr");
        save({
          ...kesim,
          donations: kesim.donations.map((d) =>
            d.description.trim().toLocaleLowerCase("tr") === key ? { ...d, excluded: true } : d
          ),
        }, `Hariç tutuldu: ${target.description}`);
        return;
      }
    }
    if (field === "excluded" && value === false) {
      const target = kesim.donations.find(d => d.id === id);
      if (target && target.description.trim()) {
        const key = target.description.trim().toLocaleLowerCase("tr");
        save({
          ...kesim,
          donations: kesim.donations.map((d) =>
            d.description.trim().toLocaleLowerCase("tr") === key ? { ...d, excluded: false } : d
          ),
        }, `Dahil edildi: ${target.description}`);
        return;
      }
    }
    const updated = {
      ...kesim,
      donations: kesim.donations.map((d) =>
        d.id === id ? { ...d, [field]: value } : d
      ),
    };
    setKesim(updated);
    history.push(updated, `Bağışçı güncellendi`);
    saveSingleDonationField(id, { [field]: value });
  }

  function toggleDonationTag(donationId: string, tagId: string) {
    if (!kesim) return;
    const updateTags = (d: Donation) => {
      if (d.id !== donationId) return d;
      const existing = d.tags || [];
      const has = existing.includes(tagId);
      return { ...d, tags: has ? existing.filter(t => t !== tagId) : [...existing, tagId] };
    };
    save({
      ...kesim,
      donations: kesim.donations.map(updateTags),
      animalGroups: kesim.animalGroups.map(g => ({
        ...g,
        donations: g.donations.map(updateTags),
      })),
    }, `Etiket güncellendi`);
  }

  function bulkExcludeByDesc(description: string, excluded: boolean) {
    if (!kesim) return;
    const key = description.trim().toLocaleLowerCase("tr");
    save({
      ...kesim,
      donations: kesim.donations.map((d) =>
        d.description.trim().toLocaleLowerCase("tr") === key ? { ...d, excluded } : d
      ),
    }, excluded ? `Toplu hariç tutuldu: ${description}` : `Toplu dahil edildi: ${description}`);
  }

  async function bulkDeleteByDesc(description: string) {
    if (!kesim) return;
    const key = description.trim().toLocaleLowerCase("tr");
    const toDelete = kesim.donations.filter(d => d.description.trim().toLocaleLowerCase("tr") === key);
    if (toDelete.length === 0) return;
    try {
      await Promise.all(toDelete.map(d => apiSoftDeleteDonation(kesim.id, d.id)));
      const deleteIds = new Set(toDelete.map(d => d.id));
      const updated = {
        ...kesim,
        donations: kesim.donations.filter(d => !deleteIds.has(d.id)),
        animalGroups: kesim.animalGroups.map(g => ({
          ...g,
          donations: g.donations.filter(d => !deleteIds.has(d.id)),
        })),
      };
      setKesim(updated);
      history.push(updated, `Toplu silindi: ${description}`);
      setPersonEditDesc(null);
      toast({ title: "Çöp kutusuna taşındı", description: `${toDelete.length} bağışçı çöp kutusuna taşındı.` });
    } catch (err) {
      toast({ title: "Silme hatası", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }

  const findDeleteColumnLabel: Record<string, string> = {
    name: "Adına Kesilen",
    description: "Vekaleti Veren",
    donationType: "Cinsi",
    vekalet: "Vekalet No",
    notes: "Notlar",
  };

  function getFindDeleteMatches() {
    if (!kesim || !findDeleteValue.trim()) return [];
    const q = turkishNormalize(findDeleteValue.trim());
    return kesim.donations.filter((d) => {
      const val = turkishNormalize((d[findDeleteColumn] || "").toString());
      return val.includes(q);
    });
  }

  async function executeFindDelete() {
    if (!kesim) return;
    const matches = getFindDeleteMatches();
    if (matches.length === 0) return;
    const matchIds = new Set(matches.map((d) => d.id));
    try {
      await Promise.all(matches.map(d => apiSoftDeleteDonation(kesim.id, d.id)));
      const updated = {
        ...kesim,
        donations: kesim.donations.filter((d) => !matchIds.has(d.id)),
        animalGroups: kesim.animalGroups.map(g => ({
          ...g,
          donations: g.donations.filter(d => !matchIds.has(d.id)),
        })),
      };
      setKesim(updated);
      history.push(updated, `Toplu silindi: ${matches.length} bağışçı (${findDeleteColumnLabel[findDeleteColumn]}: "${findDeleteValue}")`);
      setFindDeleteOpen(false);
      setFindDeleteValue("");
      setFindDeleteConfirm(false);
      toast({ title: "Çöp kutusuna taşındı", description: `${matches.length} bağışçı çöp kutusuna taşındı.` });
    } catch (err) {
      toast({ title: "Silme hatası", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }

  function getGroupFindDeleteMatches() {
    if (!kesim || !groupFindDeleteValue.trim()) return [];
    const q = turkishNormalize(groupFindDeleteValue.trim());
    const matchIds = new Set<string>();
    for (const group of kesim.animalGroups) {
      for (const d of group.donations) {
        if (!d.id) continue;
        const val = turkishNormalize((d[groupFindDeleteColumn] || "").toString());
        if (val.includes(q)) {
          matchIds.add(d.id);
        }
      }
    }
    return kesim.donations.filter(d => matchIds.has(d.id));
  }

  async function executeGroupFindDelete() {
    if (!kesim) return;
    const matches = getGroupFindDeleteMatches();
    if (matches.length === 0) return;
    const matchIds = new Set(matches.map((d) => d.id));
    try {
      await Promise.all(matches.map(d => apiSoftDeleteDonation(kesim.id, d.id)));
      const updated = {
        ...kesim,
        donations: kesim.donations.filter((d) => !matchIds.has(d.id)),
        animalGroups: kesim.animalGroups.map(g => ({
          ...g,
          donations: g.donations.filter(d => !matchIds.has(d.id)),
        })),
      };
      setKesim(updated);
      history.push(updated, `Gruplardan toplu silindi: ${matches.length} bağışçı (${findDeleteColumnLabel[groupFindDeleteColumn]}: "${groupFindDeleteValue}")`);
      setGroupFindDeleteOpen(false);
      setGroupFindDeleteValue("");
      setGroupFindDeleteConfirm(false);
      toast({ title: "Çöp kutusuna taşındı", description: `${matches.length} bağışçı gruplardan silinip çöp kutusuna taşındı.` });
    } catch (err) {
      toast({ title: "Silme hatası", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }

  async function openTrash() {
    if (!kesim) return;
    setTrashOpen(true);
    setTrashLoading(true);
    try {
      const items = await fetchDeletedDonations(kesim.id);
      setTrashItems(items);
    } catch (err) {
      toast({ title: "Çöp kutusu yüklenemedi", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    } finally {
      setTrashLoading(false);
    }
  }

  async function restoreDonation(donationId: string) {
    if (!kesim) return;
    try {
      const updated = await apiRestoreDonation(kesim.id, donationId);
      setKesim(updated);
      setTrashItems(prev => prev.filter(d => d.id !== donationId));
      toast({ title: "Geri yüklendi", description: "Bağışçı başarıyla geri yüklendi." });
    } catch (err) {
      toast({ title: "Geri yükleme hatası", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }

  async function permanentDeleteDonation(donationId: string) {
    if (!kesim) return;
    try {
      await apiPermanentDeleteDonation(kesim.id, donationId);
      setTrashItems(prev => prev.filter(d => d.id !== donationId));
      setTrashPermanentConfirm(null);
      toast({ title: "Kalıcı olarak silindi" });
    } catch (err) {
      toast({ title: "Kalıcı silme hatası", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await getXLSX();
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (rows.length > 0) {
          processRawData(rows);
        }
      } catch {
        toast({ title: "Excel dosyası okunamadı", description: "Lütfen geçerli bir dosya seçin.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handlePasteData() {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split("\n");
    const rows = lines.map((line) => line.split("\t").map((c) => c.trim()));
    processRawData(rows);
  }

  function processRawData(rows: string[][]) {
    setPreviewData(rows);
    const colCount = Math.max(...rows.map((r) => r.length));
    const defaultMappings: ColumnMapping[] = [];
    const defaults: ColumnMapping[] = ["skip", "skip", "vekalet", "description", "name", "donationType", "notes"];
    for (let i = 0; i < colCount; i++) {
      defaultMappings.push(i < defaults.length ? defaults[i] : "skip");
    }
    setColumnMappings(defaultMappings);
    setBulkStep("mapping");
  }

  function applyBulkImport() {
    if (!kesim || previewData.length === 0) return;
    const startRow = hasHeaderRow ? 1 : 0;
    const shareCountColIdx = columnMappings.indexOf("shareCount");
    const descColIdx = columnMappings.indexOf("description");

    if (bulkStep !== "review") {
      const groupTotals = new Map<string, { total: number; rows: { idx: number; row: string[]; shareCount: number }[] }>();

      for (let r = startRow; r < previewData.length; r++) {
        const row = previewData[r];
        const desc = descColIdx >= 0 ? String(row[descColIdx] ?? "").trim().toLocaleLowerCase("tr") : "";
        const shareCount = shareCountColIdx >= 0
          ? (parseInt(String(row[shareCountColIdx] ?? "1").trim(), 10) || 1)
          : 1;

        if (!desc) continue;

        if (!groupTotals.has(desc)) {
          groupTotals.set(desc, { total: 0, rows: [] });
        }
        const group = groupTotals.get(desc)!;
        group.total += shareCount;
        group.rows.push({ idx: r, row, shareCount });
      }

      const highShareRows: typeof bulkReviewRows = [];
      for (const [groupKey, group] of groupTotals) {
        if (group.total > 50) {
          for (const item of group.rows) {
            highShareRows.push({
              idx: item.idx,
              row: item.row,
              rawShareCount: item.shareCount,
              selected: true,
              groupKey,
              groupTotal: group.total,
            });
          }
        }
      }

      if (highShareRows.length > 0) {
        highShareRows.sort((a, b) => a.groupKey.localeCompare(b.groupKey) || a.idx - b.idx);
        setBulkReviewRows(highShareRows);
        setBulkStep("review");
        return;
      }
    }

    const excludedIdxs = new Set(bulkReviewRows.filter(r => r.selected).map(r => r.idx));

    const newDonations: Donation[] = [];
    for (let r = startRow; r < previewData.length; r++) {
      if (excludedIdxs.has(r)) continue;
      const row = previewData[r];
      const donation: Partial<Donation> = {
        id: generateId(),
        name: "",
        description: "",
        donationType: "",
        shareCount: 1,
        vekalet: "",
        notes: "",
      };

      for (let c = 0; c < columnMappings.length; c++) {
        const mapping = columnMappings[c];
        const cellValue = String(row[c] ?? "").trim();
        if (mapping === "skip" || !cellValue) continue;
        if (mapping === "shareCount") {
          donation.shareCount = Math.max(1, Math.min(7, parseInt(cellValue, 10) || 1));
        } else {
          (donation as any)[mapping] = cellValue;
        }
      }

      if (donation.name) {
        newDonations.push(donation as Donation);
      }
    }

    save({ ...kesim, donations: [...kesim.donations, ...newDonations] }, `${newDonations.length} bağışçı toplu eklendi`, true);
    resetBulkDialog();
  }

  function resetBulkDialog() {
    setBulkDialogOpen(false);
    setBulkStep("input");
    setBulkMode("upload");
    setPasteText("");
    setPreviewData([]);
    setColumnMappings([]);
    setHasHeaderRow(true);
    setBulkReviewRows([]);
    setBulkReviewExpanded(new Set());
  }

  async function handleAutoGroup(forceFullRegroup = false) {
    if (!kesim || groupingInProgress) return;
    setGroupingInProgress(true);
    setGroupingProgress(null);
    try {
      const lockedIndices: number[] = [];
      const lockedDonationIds = new Set<string>();
      for (let i = 0; i < kesim.animalGroups.length; i++) {
        const g = kesim.animalGroups[i];
        if (g.locked) {
          lockedIndices.push(i);
          for (const d of g.donations) {
            if (d.name.trim() || d.description.trim()) {
              lockedDonationIds.add(d.id);
            }
          }
        }
      }

      const hasExistingGroups = kesim.animalGroups.length > 0;
      const activeDonationMap = new Map<string, Donation>();
      for (const d of kesim.donations) {
        if (!d.excluded && (d.name.trim() || d.description.trim())) {
          activeDonationMap.set(d.id, d);
        }
      }

      const changedIdSet = new Set<string>();

      const groupedDonationMap = new Map<string, Donation>();
      for (const g of kesim.animalGroups) {
        for (const d of g.donations) {
          if (d.name.trim() || d.description.trim()) groupedDonationMap.set(d.id, d);
        }
      }

      for (const [id] of activeDonationMap) {
        if (!groupedDonationMap.has(id)) changedIdSet.add(id);
      }

      for (const g of kesim.animalGroups) {
        if (g.locked) continue;
        for (const d of g.donations) {
          if (!(d.name.trim() || d.description.trim())) continue;
          if (!activeDonationMap.has(d.id)) {
            changedIdSet.add(d.id);
            continue;
          }
          const current = activeDonationMap.get(d.id)!;
          if (current.name !== d.name || current.description !== d.description || current.shareCount !== d.shareCount || current.excluded !== d.excluded) {
            changedIdSet.add(d.id);
          }
        }
      }

      const changedDescs = new Set<string>();
      for (const id of changedIdSet) {
        const d = activeDonationMap.get(id) || groupedDonationMap.get(id);
        if (d) {
          const key = d.description.trim().toLocaleLowerCase("tr");
          if (key) changedDescs.add(key);
        }
      }
      if (changedDescs.size > 0) {
        for (const g of kesim.animalGroups) {
          if (g.locked) continue;
          for (const d of g.donations) {
            const key = d.description.trim().toLocaleLowerCase("tr");
            if (key && changedDescs.has(key) && !changedIdSet.has(d.id)) {
              changedIdSet.add(d.id);
            }
          }
        }
        for (const [id, d] of activeDonationMap) {
          const key = d.description.trim().toLocaleLowerCase("tr");
          if (key && changedDescs.has(key) && !changedIdSet.has(id)) {
            changedIdSet.add(id);
          }
        }
      }

      const changedIds = Array.from(changedIdSet);

      const useIncremental = !forceFullRegroup && hasExistingGroups && changedIds.length <= 20;

      let finalGroups: AnimalGroup[];

      if (useIncremental) {
        finalGroups = await runIncrementalGrouping(
          kesim.donations,
          kesim.animalGroups,
          changedIds,
          lockedIndices
        );
      } else {
        const donationsToGroup = kesim.donations.filter(d => !lockedDonationIds.has(d.id));
        const newGroups = await runGrouping(donationsToGroup, (progress) => {
          setGroupingProgress({ ...progress });
        });
        const lockedGroups = kesim.animalGroups.filter(g => g.locked);
        finalGroups = [...lockedGroups, ...newGroups];
        finalGroups.forEach((g, i) => { g.animalNo = i + 1; });
      }

      const existingDonationIds = new Set(kesim.donations.map(d => d.id));
      const newDonations: Donation[] = [];
      for (const g of finalGroups) {
        for (const d of g.donations) {
          if (!existingDonationIds.has(d.id)) {
            existingDonationIds.add(d.id);
            newDonations.push(d);
          }
        }
      }
      const lockedCount = lockedIndices.length;
      const mergedDonations = [...kesim.donations, ...newDonations];
      const updated = { ...kesim, donations: mergedDonations, animalGroups: finalGroups };
      const modeLabel = useIncremental ? "Artımlı gruplama" : "Otomatik gruplama";
      if (newDonations.length > 0) {
        save(updated, `${modeLabel} yapıldı: ${finalGroups.length} hayvan (${lockedCount} kilitli korundu)`, true);
      } else {
        save(updated, `${modeLabel} yapıldı: ${finalGroups.length} hayvan (${lockedCount} kilitli korundu)`, true, 'groups');
      }
      const found = checkGroupConflicts(finalGroups);
      setConflicts(found);
      if (found.length > 0) setShowConflicts(true);
    } catch (err) {
      if (err instanceof Error && err.name === "CancelledError") return;
      throw err;
    } finally {
      setGroupingInProgress(false);
      setGroupingProgress(null);
    }
  }

  function handleSort(field: SortField) {
    if (!kesim) return;
    const newDir = sortField === field && sortDir === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortDir(newDir);
    const dir = newDir === "asc" ? 1 : -1;
    const sorted = [...kesim.donations].sort((a, b) => {
      const ka = sortKeyMap.get(a.id);
      const kb = sortKeyMap.get(b.id);
      if (!ka || !kb) return 0;
      if (field === "shareCount") {
        return dir * (ka.shareCount - kb.shareCount);
      }
      if (field === "description") {
        const surnameCmp = trCollator.compare(ka.descSurname, kb.descSurname);
        if (surnameCmp !== 0) return dir * surnameCmp;
        return dir * trCollator.compare(ka.description, kb.description);
      }
      if (field === "name") {
        const surnameCmp = trCollator.compare(ka.nameSurname, kb.nameSurname);
        if (surnameCmp !== 0) return dir * surnameCmp;
        return dir * trCollator.compare(ka.name, kb.name);
      }
      return dir * trCollator.compare(ka[field], kb[field]);
    });
    save({ ...kesim, donations: sorted }, `Sıralama değiştirildi`, true);
  }

  function isGroupLocked(groupIdx: number): boolean {
    return !!kesim?.animalGroups[groupIdx]?.locked;
  }

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
  }, []);

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

  function startEditing(donationId: string, field: string) {
    if (!kesim) return;
    const donation = kesim.donations.find(d => d.id === donationId);
    if (!donation) return;
    const currentVal = String((donation as any)[field] || "");
    setEditDraft(currentVal);
    setEditingCell({ donationId, field });
  }

  function commitEdit() {
    if (!editingCell || !kesim) { setEditingCell(null); return; }
    const donation = kesim.donations.find(d => d.id === editingCell.donationId);
    if (!donation) { setEditingCell(null); return; }
    const currentVal = String((donation as any)[editingCell.field] || "");
    if (editDraft !== currentVal) {
      updateDonationField(editingCell.donationId, editingCell.field as keyof Donation, editDraft);
    }
    setEditingCell(null);
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditDraft("");
  }

  const DONOR_EDITABLE_FIELDS = ["vekalet", "description", "name", "donationType", "notes"] as const;

  function handleDonorCellKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    donationId: string,
    field: string
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      commitEdit();
      const currentFieldIdx = DONOR_EDITABLE_FIELDS.indexOf(field as any);
      if (currentFieldIdx < 0) return;
      const matchedTabIds = debouncedSearchQuery.trim() ? searchIndex.search(debouncedSearchQuery) : null;
      const donations = matchedTabIds
        ? kesim!.donations.filter(d => matchedTabIds.has(d.id))
        : kesim!.donations;
      const donationIdx = donations.findIndex(d => d.id === donationId);
      if (donationIdx < 0) return;

      if (e.shiftKey) {
        if (currentFieldIdx > 0) {
          setTimeout(() => startEditing(donationId, DONOR_EDITABLE_FIELDS[currentFieldIdx - 1]), 0);
        } else if (donationIdx > 0) {
          setTimeout(() => startEditing(donations[donationIdx - 1].id, DONOR_EDITABLE_FIELDS[DONOR_EDITABLE_FIELDS.length - 1]), 0);
        }
      } else {
        if (currentFieldIdx < DONOR_EDITABLE_FIELDS.length - 1) {
          setTimeout(() => startEditing(donationId, DONOR_EDITABLE_FIELDS[currentFieldIdx + 1]), 0);
        } else if (donationIdx < donations.length - 1) {
          setTimeout(() => startEditing(donations[donationIdx + 1].id, DONOR_EDITABLE_FIELDS[0]), 0);
        }
      }
    }
  }

  const EDITABLE_COLUMN_KEYS: ColumnKey[] = ["vekalet", "description", "name", "donationType", "notes"];
  const editableVisibleColumns = workspace.visibleColumns.filter(k => EDITABLE_COLUMN_KEYS.includes(k));

  function handleGroupCellTab(
    e: React.KeyboardEvent<HTMLInputElement>,
    groupIdx: number,
    dIdx: number,
    colKey: ColumnKey
  ) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    if (!group) return;

    const fieldIdx = editableVisibleColumns.indexOf(colKey);
    if (fieldIdx === -1) return;

    if (e.shiftKey) {
      if (fieldIdx > 0) {
        const prevField = editableVisibleColumns[fieldIdx - 1];
        const target = document.querySelector(`[data-group-cell="${groupIdx}-${dIdx}-${prevField}"] input`) as HTMLInputElement;
        target?.focus();
      } else if (dIdx > 0) {
        const prevField = editableVisibleColumns[editableVisibleColumns.length - 1];
        const target = document.querySelector(`[data-group-cell="${groupIdx}-${dIdx - 1}-${prevField}"] input`) as HTMLInputElement;
        target?.focus();
      }
    } else {
      if (fieldIdx < editableVisibleColumns.length - 1) {
        const nextField = editableVisibleColumns[fieldIdx + 1];
        const target = document.querySelector(`[data-group-cell="${groupIdx}-${dIdx}-${nextField}"] input`) as HTMLInputElement;
        target?.focus();
      } else if (dIdx < group.donations.length - 1) {
        const nextField = editableVisibleColumns[0];
        const target = document.querySelector(`[data-group-cell="${groupIdx}-${dIdx + 1}-${nextField}"] input`) as HTMLInputElement;
        target?.focus();
      }
    }
  }

  function removeFromGroup(groupIdx: number, donationIdx: number) {
    if (!kesim) return;
    if (isGroupLocked(groupIdx)) return;
    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: [...g.donations],
    }));
    groups[groupIdx].donations.splice(donationIdx, 1);
    groups[groupIdx].donations.push({
      id: generateId(),
      name: "",
      description: "",
      donationType: "",
      shareCount: 1,
      vekalet: "",
      notes: "",
    });
    save({ ...kesim, animalGroups: groups }, `Gruptan çıkarıldı`, false, 'groups');
  }

  const updateGroupDonation = useCallback((
    groupIdx: number,
    donationIdx: number,
    field: keyof Donation,
    value: string | number
  ) => {
    if (!kesim) return;
    if (isGroupLocked(groupIdx)) return;
    const donation = kesim.animalGroups[groupIdx]?.donations[donationIdx];
    if (!donation) return;
    if ((donation as any)[field] === value) return;

    const updated = {
      ...kesim,
      donations: kesim.donations.map((d) =>
        d.id === donation.id ? { ...d, [field]: value } : d
      ),
      animalGroups: kesim.animalGroups.map((g, gi) =>
        gi === groupIdx
          ? {
              ...g,
              donations: g.donations.map((d, di) =>
                di === donationIdx ? { ...d, [field]: value } : d
              ),
            }
          : g
      ),
    };
    setKesim(updated);
    history.push(updated, `Grup bağışçısı güncellendi`);

    saveSingleDonationField(donation.id, { [field]: value });
  }, [kesim, saveSingleDonationField, history]);

  function setGroupColorTag(groupIdx: number, tag: ColorTag) {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    const groups = kesim.animalGroups.map((g, i) =>
      i === groupIdx ? { ...g, colorTag: tag } : g
    );
    const updated = { ...kesim, animalGroups: groups };
    setKesim(updated);
    history.push(updated, `Grup rengi değiştirildi: Hayvan ${groups[groupIdx].animalNo}`);
    saveSingleGroupField(group.id, { colorTag: tag });
  }

  function applyBulkEdit() {
    if (!kesim || selectedIds.size === 0) return;
    const updated = {
      ...kesim,
      donations: kesim.donations.map((d) => {
        if (!selectedIds.has(d.id)) return d;
        if (bulkEditField === "shareCount") {
          const val = Math.max(1, Math.min(7, parseInt(bulkEditValue) || 1));
          return { ...d, shareCount: val };
        }
        return { ...d, [bulkEditField]: bulkEditValue };
      }),
    };
    save(updated, `${selectedIds.size} bağışçı toplu düzenlendi`);
    setBulkEditOpen(false);
    setBulkEditValue("");
  }

  const updateGroupNotes = useCallback((groupIdx: number, notes: string) => {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    if (!group) return;
    const updated = {
      ...kesim,
      animalGroups: kesim.animalGroups.map((g, i) =>
        i === groupIdx ? { ...g, notes } : g
      ),
    };
    setKesim(updated);
    history.push(updated, `Grup notu güncellendi: Hayvan ${group.animalNo}`);
    saveSingleGroupField(group.id, { notes });
  }, [kesim, saveSingleGroupField, history]);

  function toggleGroupLock(groupIdx: number) {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    const newLocked = !group.locked;
    const groups = kesim.animalGroups.map((g, i) =>
      i === groupIdx ? { ...g, locked: newLocked } : g
    );
    const updated = { ...kesim, animalGroups: groups };
    setKesim(updated);
    history.push(updated, `Grup ${newLocked ? "kilitlendi" : "kilidi açıldı"}: Hayvan ${group.animalNo}`);
    saveSingleGroupField(group.id, { locked: newLocked });
  }

  function parseRangeLockInput(input: string): number[] {
    const results = new Set<number>();
    const parts = input.split(",").map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          results.add(i);
        }
      } else if (/^\d+$/.test(part)) {
        results.add(parseInt(part));
      }
    }
    return Array.from(results).sort((a, b) => a - b);
  }

  function deleteAnimalGroup(groupIdx: number) {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    if (!group || group.locked) return;
    const newGroups = kesim.animalGroups.filter((_, i) => i !== groupIdx);
    const renumbered = newGroups.map((g, i) => ({ ...g, animalNo: i + 1 }));
    save({ ...kesim, animalGroups: renumbered }, `Grup silindi: Hayvan ${group.animalNo} (${group.donations.filter(d => d.name.trim()).length} bağışçı grupsuz kaldı)`, true, 'groups');
    const found = checkGroupConflicts(renumbered);
    setConflicts(found);
  }

  async function handleAutoGroupSelected() {
    if (!kesim || groupingInProgress || selectedIds.size === 0) return;
    setGroupingInProgress(true);
    setGroupingProgress(null);
    try {
      const selectedDonations = kesim.donations.filter(d => selectedIds.has(d.id));
      const newGroups = await runGrouping(selectedDonations, (progress) => {
        setGroupingProgress({ ...progress });
      });
      const cleanedExistingGroups = kesim.animalGroups.map(g => ({
        ...g,
        donations: g.donations.map(d =>
          selectedIds.has(d.id) ? { ...d, name: "", description: "", donationType: "", shareCount: 1, notes: "", vekalet: "", excluded: false } : d
        ),
      }));
      const allGroups = [...cleanedExistingGroups, ...newGroups];
      allGroups.forEach((g, i) => { g.animalNo = i + 1; });
      const existingDonationIds = new Set(kesim.donations.map(d => d.id));
      const newDonations: Donation[] = [];
      for (const g of newGroups) {
        for (const d of g.donations) {
          if (!existingDonationIds.has(d.id)) {
            existingDonationIds.add(d.id);
            newDonations.push(d);
          }
        }
      }
      const mergedDonations = [...kesim.donations, ...newDonations];
      const updated = { ...kesim, donations: mergedDonations, animalGroups: allGroups };
      if (newDonations.length > 0) {
        save(updated, `Seçilen ${selectedDonations.length} bağışçı gruplandı: ${newGroups.length} yeni hayvan`, true);
      } else {
        save(updated, `Seçilen ${selectedDonations.length} bağışçı gruplandı: ${newGroups.length} yeni hayvan`, true, 'groups');
      }
      const found = checkGroupConflicts(allGroups);
      setConflicts(found);
      if (found.length > 0) setShowConflicts(true);
      setSelectedIds(new Set());
    } catch (err) {
      if (err instanceof Error && err.name === "CancelledError") return;
      throw err;
    } finally {
      setGroupingInProgress(false);
      setGroupingProgress(null);
    }
  }

  function applyRangeLock(lock: boolean) {
    if (!kesim) return;
    const targetNos = parseRangeLockInput(rangeLockInput);
    if (targetNos.length === 0) return;
    const existingNos = new Set(kesim.animalGroups.map(g => g.animalNo));
    const validNos = targetNos.filter(n => existingNos.has(n));
    if (validNos.length === 0) return;
    const targetSet = new Set(validNos);
    const groups = kesim.animalGroups.map(g =>
      targetSet.has(g.animalNo) ? { ...g, locked: lock } : g
    );
    save({ ...kesim, animalGroups: groups }, `${validNos.length} grup ${lock ? "kilitlendi" : "kilidi açıldı"}: ${rangeLockInput}`, false, 'groups');
    setRangeLockInput("");
  }

  function lockAllGroups() {
    if (!kesim) return;
    const groups = kesim.animalGroups.map(g => ({ ...g, locked: true }));
    save({ ...kesim, animalGroups: groups }, `Tüm gruplar kilitlendi`, false, 'groups');
  }

  function unlockAllGroups() {
    if (!kesim) return;
    const groups = kesim.animalGroups.map(g => ({ ...g, locked: false }));
    save({ ...kesim, animalGroups: groups }, `Tüm grupların kilidi açıldı`, false, 'groups');
  }

  function openSplitGroupDialog(groupIdx: number) {
    if (!kesim) return;
    if (isGroupLocked(groupIdx)) return;
    const group = kesim.animalGroups[groupIdx];
    const filled = group.donations.filter(d => d.name.trim() !== "");
    if (filled.length <= 1) return;
    const midpoint = Math.ceil(filled.length / 2);
    setSplitGroupDialog({ groupIdx, splitAt: midpoint });
  }

  function executeSplitGroup() {
    if (!kesim || !splitGroupDialog) return;
    const { groupIdx, splitAt } = splitGroupDialog;
    if (isGroupLocked(groupIdx)) return;
    const group = kesim.animalGroups[groupIdx];
    const filled = group.donations.filter(d => d.name.trim() !== "");
    if (filled.length <= 1 || splitAt <= 0 || splitAt >= filled.length) return;

    const firstHalf = [...filled.slice(0, splitAt)];
    const secondHalf = [...filled.slice(splitAt)];

    const emptyDonation = (): Donation => ({
      id: generateId(),
      name: "",
      description: "",
      donationType: "",
      shareCount: 1,
      vekalet: "",
      notes: "",
    });

    while (firstHalf.length < 7) firstHalf.push(emptyDonation());
    while (secondHalf.length < 7) secondHalf.push(emptyDonation());

    const newGroups = [...kesim.animalGroups];
    newGroups[groupIdx] = {
      ...group,
      donations: firstHalf.slice(0, 7),
    };

    const newGroup: AnimalGroup = {
      id: generateId(),
      animalNo: kesim.animalGroups.length + 1,
      donations: secondHalf.slice(0, 7),
    };

    newGroups.splice(groupIdx + 1, 0, newGroup);

    const renumbered = newGroups.map((g, i) => ({ ...g, animalNo: i + 1 }));
    save({ ...kesim, animalGroups: renumbered }, `Grup bölündü: Hayvan ${group.animalNo} → ${splitAt}/${filled.length - splitAt}`, false, 'groups');
    setSplitGroupDialog(null);
  }

  const toggleGroupSelect = useCallback((groupId: string) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  function mergeSelectedGroups() {
    if (!kesim || selectedGroupIds.size < 2) return;
    const groupsToMerge = kesim.animalGroups.filter(g => selectedGroupIds.has(g.id));
    if (groupsToMerge.some(g => g.locked)) return;

    const allDonations = groupsToMerge.flatMap(g => g.donations).filter(d => d.name.trim() !== "");
    const remainingGroups = kesim.animalGroups.filter(g => !selectedGroupIds.has(g.id));

    const emptyDonation = (): Donation => ({
      id: generateId(),
      name: "",
      description: "",
      donationType: "",
      shareCount: 1,
      vekalet: "",
      notes: "",
    });

    const newGroups: AnimalGroup[] = [];
    let currentBatch: Donation[] = [];

    for (const d of allDonations) {
      currentBatch.push(d);
      if (currentBatch.length === 7) {
        newGroups.push({
          id: generateId(),
          animalNo: 0,
          donations: [...currentBatch],
        });
        currentBatch = [];
      }
    }

    if (currentBatch.length > 0) {
      while (currentBatch.length < 7) currentBatch.push(emptyDonation());
      newGroups.push({
        id: generateId(),
        animalNo: 0,
        donations: currentBatch,
      });
    }

    const firstMergedIdx = kesim.animalGroups.findIndex(g => selectedGroupIds.has(g.id));
    const finalGroups = [...remainingGroups];
    finalGroups.splice(firstMergedIdx, 0, ...newGroups);
    const renumbered = finalGroups.map((g, i) => ({ ...g, animalNo: i + 1 }));

    save({ ...kesim, animalGroups: renumbered }, `${groupsToMerge.length} grup birleştirildi`, false, 'groups');
    setSelectedGroupIds(new Set());
  }

  function handleSwapSelect(groupIdx: number, donationIdx: number) {
    if (!kesim) return;
    const d = kesim.animalGroups[groupIdx]?.donations[donationIdx];
    if (!d || !d.name.trim()) return;
    if (isGroupLocked(groupIdx)) return;

    if (!swapSelection) {
      setSwapSelection({ groupIdx, donationIdx });
    } else {
      if (swapSelection.groupIdx === groupIdx) {
        setSwapSelection({ groupIdx, donationIdx });
        return;
      }
      if (isGroupLocked(swapSelection.groupIdx)) {
        setSwapSelection(null);
        return;
      }
      setSwapTarget({ groupIdx, donationIdx });
      setSwapPreviewOpen(true);
    }
  }

  function executeSwap() {
    if (!kesim || !swapSelection || !swapTarget) return;
    if (isGroupLocked(swapSelection.groupIdx) || isGroupLocked(swapTarget.groupIdx)) {
      cancelSwap();
      return;
    }
    const sg = kesim.animalGroups[swapSelection.groupIdx];
    const tg = kesim.animalGroups[swapTarget.groupIdx];
    if (!sg?.donations[swapSelection.donationIdx] || !tg?.donations[swapTarget.donationIdx]) {
      cancelSwap();
      return;
    }
    const groups = kesim.animalGroups.map(g => ({
      ...g,
      donations: g.donations.map(d => ({ ...d })),
    }));

    const temp = { ...groups[swapSelection.groupIdx].donations[swapSelection.donationIdx] };
    groups[swapSelection.groupIdx].donations[swapSelection.donationIdx] = {
      ...groups[swapTarget.groupIdx].donations[swapTarget.donationIdx],
    };
    groups[swapTarget.groupIdx].donations[swapTarget.donationIdx] = temp;

    save({ ...kesim, animalGroups: groups }, `Takas yapıldı: Hayvan ${groups[swapSelection.groupIdx].animalNo} ↔ Hayvan ${groups[swapTarget.groupIdx].animalNo}`, false, 'groups');
    setSwapSelection(null);
    setSwapTarget(null);
    setSwapPreviewOpen(false);
  }

  function cancelSwap() {
    setSwapSelection(null);
    setSwapTarget(null);
    setSwapPreviewOpen(false);
  }

  function computeAutoResolve(): typeof resolveResults {
    if (!kesim) return [];
    const groups = kesim.animalGroups;
    const unexpectedConflicts = checkGroupConflicts(groups).filter(c => !c.isExpected);
    if (unexpectedConflicts.length === 0) return [];

    const workingCopy = groups.map(g => ({
      ...g,
      donations: g.donations.map(d => ({ ...d })),
    }));

    const globalUsedSlots = new Set<string>();
    const results: typeof resolveResults = [];

    for (const conflict of unexpectedConflicts) {
      const key = conflict.description.trim().toLocaleLowerCase("tr");
      const entriesByGroup: Map<number, Array<{ groupIdx: number; dIdx: number }>> = new Map();

      workingCopy.forEach((group, groupIdx) => {
        group.donations.forEach((d, dIdx) => {
          if (d.description.trim().toLocaleLowerCase("tr") === key) {
            if (!entriesByGroup.has(groupIdx)) entriesByGroup.set(groupIdx, []);
            entriesByGroup.get(groupIdx)!.push({ groupIdx, dIdx });
          }
        });
      });

      const groupIndices = Array.from(entriesByGroup.keys());
      if (groupIndices.length <= 1) continue;

      let targetGroupIdx = -1;
      let maxExisting = -1;
      for (const gi of groupIndices) {
        if (workingCopy[gi].locked) continue;
        const count = entriesByGroup.get(gi)!.length;
        const emptySlots = workingCopy[gi].donations.filter(d => d.name.trim() === "").length;
        const score = count * 1000 + emptySlots;
        if (score > maxExisting) {
          maxExisting = score;
          targetGroupIdx = gi;
        }
      }
      if (targetGroupIdx < 0) continue;

      const swaps: typeof resolveResults[0]["swaps"] = [];

      for (const sourceGroupIdx of groupIndices) {
        if (sourceGroupIdx === targetGroupIdx) continue;
        if (workingCopy[sourceGroupIdx].locked) continue;

        const sourceEntries = entriesByGroup.get(sourceGroupIdx)!;
        for (const srcEntry of sourceEntries) {
          const slotKey = (g: number, i: number) => `${g}:${i}`;
          if (globalUsedSlots.has(slotKey(srcEntry.groupIdx, srcEntry.dIdx))) continue;

          const emptySlotIdx = workingCopy[targetGroupIdx].donations.findIndex(
            (d, idx) => d.name.trim() === "" && !globalUsedSlots.has(slotKey(targetGroupIdx, idx))
          );

          if (emptySlotIdx >= 0) {
            swaps.push({
              fromGroup: sourceGroupIdx,
              fromIdx: srcEntry.dIdx,
              toGroup: targetGroupIdx,
              toIdx: emptySlotIdx,
              fromName: workingCopy[sourceGroupIdx].donations[srcEntry.dIdx].description,
              toName: "(boş slot)",
            });
            globalUsedSlots.add(slotKey(sourceGroupIdx, srcEntry.dIdx));
            globalUsedSlots.add(slotKey(targetGroupIdx, emptySlotIdx));

            const tempD = { ...workingCopy[sourceGroupIdx].donations[srcEntry.dIdx] };
            workingCopy[sourceGroupIdx].donations[srcEntry.dIdx] = { ...workingCopy[targetGroupIdx].donations[emptySlotIdx] };
            workingCopy[targetGroupIdx].donations[emptySlotIdx] = tempD;
          } else {
            const swappableIdx = workingCopy[targetGroupIdx].donations.findIndex(
              (d, idx) => {
                if (!d.name.trim()) return false;
                if (d.description.trim().toLocaleLowerCase("tr") === key) return false;
                return !globalUsedSlots.has(slotKey(targetGroupIdx, idx));
              }
            );

            if (swappableIdx >= 0) {
              swaps.push({
                fromGroup: sourceGroupIdx,
                fromIdx: srcEntry.dIdx,
                toGroup: targetGroupIdx,
                toIdx: swappableIdx,
                fromName: workingCopy[sourceGroupIdx].donations[srcEntry.dIdx].description,
                toName: workingCopy[targetGroupIdx].donations[swappableIdx].description,
              });
              globalUsedSlots.add(slotKey(sourceGroupIdx, srcEntry.dIdx));
              globalUsedSlots.add(slotKey(targetGroupIdx, swappableIdx));

              const tempD = { ...workingCopy[sourceGroupIdx].donations[srcEntry.dIdx] };
              workingCopy[sourceGroupIdx].donations[srcEntry.dIdx] = { ...workingCopy[targetGroupIdx].donations[swappableIdx] };
              workingCopy[targetGroupIdx].donations[swappableIdx] = tempD;
            }
          }
        }
      }

      if (swaps.length > 0) {
        results.push({ desc: conflict.description, swaps });
      }
    }

    return results;
  }

  function openAutoResolve() {
    const results = computeAutoResolve();
    setResolveResults(results);
    setAutoResolveOpen(true);
  }

  function applyAutoResolve() {
    if (!kesim || resolveResults.length === 0) return;
    const groups = kesim.animalGroups.map(g => ({
      ...g,
      donations: g.donations.map(d => ({ ...d })),
    }));

    let appliedCount = 0;
    for (const result of resolveResults) {
      for (const swap of result.swaps) {
        if (swap.fromGroup >= groups.length || swap.toGroup >= groups.length) continue;
        if (groups[swap.fromGroup].locked || groups[swap.toGroup].locked) continue;
        if (!groups[swap.fromGroup].donations[swap.fromIdx] || !groups[swap.toGroup].donations[swap.toIdx]) continue;
        const temp = { ...groups[swap.fromGroup].donations[swap.fromIdx] };
        groups[swap.fromGroup].donations[swap.fromIdx] = { ...groups[swap.toGroup].donations[swap.toIdx] };
        groups[swap.toGroup].donations[swap.toIdx] = temp;
        appliedCount++;
      }
    }

    if (appliedCount === 0) {
      setAutoResolveOpen(false);
      setResolveResults([]);
      return;
    }

    save({ ...kesim, animalGroups: groups }, `Otomatik çakışma çözümü: ${appliedCount} takas uygulandı (${resolveResults.length} kişi)`, false, 'groups');
    setAutoResolveOpen(false);
    setResolveResults([]);

    const newConflicts = checkGroupConflicts(groups);
    setConflicts(newConflicts);
    if (newConflicts.length > 0) setShowConflicts(true);
  }

  async function exportDonorsExcel() {
    if (!kesim) return;
    const XLSX = await getXLSX();
    const wb = XLSX.utils.book_new();

    const donorData = kesim.donations.map((d, i) => ({
      "Sıra": i + 1,
      "Kesim Listesi ID": kesim.kesimListeId || "",
      "Adına Kesilen": d.name,
      "Vekaleti Veren": d.description,
      "Cinsi": d.donationType,
      "Hisse": d.shareCount,
      "Vekalet": d.vekalet,
      "Notlar": d.notes,
      "Durum": d.excluded ? "Hariç" : "Dahil",
    }));
    const wsDonors = XLSX.utils.json_to_sheet(donorData);
    wsDonors["!cols"] = [
      { wch: 6 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 8 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDonors, "Bağışçılar");

    if (kesim.animalGroups.length > 0) {
      const groupData: Record<string, string | number>[] = [];
      for (const group of kesim.animalGroups) {
        for (let i = 0; i < group.donations.length; i++) {
          const d = group.donations[i];
          groupData.push({
            "Kesim Listesi ID": kesim.kesimListeId || "",
            "Hayvan No": group.animalNo,
            "Sıra": i + 1,
            "Vekalet": d.vekalet,
            "Vekaleti Veren": d.description,
            "Adına Kesilen": d.name,
            "Cinsi": d.donationType,
            "Notlar": d.notes,
          });
        }
      }
      const wsGroups = XLSX.utils.json_to_sheet(groupData);
      wsGroups["!cols"] = [
        { wch: 16 }, { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsGroups, "Hayvan Grupları");
    }

    XLSX.writeFile(wb, `${kesim.name}_bagiscilar.xlsx`);
  }

  async function exportGroupsExcel() {
    if (!kesim || kesim.animalGroups.length === 0) return;
    const XLSX = await getXLSX();
    const data: Record<string, string | number>[] = [];
    for (const group of kesim.animalGroups) {
      for (let i = 0; i < group.donations.length; i++) {
        const d = group.donations[i];
        data.push({
          "Kesim Listesi ID": kesim.kesimListeId || "",
          "Hayvan No": group.animalNo,
          "Sıra": i + 1,
          "Vekalet": d.vekalet,
          "Vekaleti Veren": d.description,
          "Adına Kesilen": d.name,
          "Cinsi": d.donationType,
          "Notlar": d.notes,
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 16 }, { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kesim Kağıdı");
    XLSX.writeFile(wb, `${kesim.name}_kesim_kagidi.xlsx`);
  }

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const groupSearchMatches = useCallback(() => {
    if (!kesim || !groupSearchQuery.trim()) return [];
    const q = turkishNormalize(groupSearchQuery.trim());
    const matches: { groupIdx: number; dIdx: number; groupId: string; animalNo: number }[] = [];
    kesim.animalGroups.forEach((group, groupIdx) => {
      group.donations.forEach((d, dIdx) => {
        if (
          turkishNormalize(d.name).includes(q) ||
          turkishNormalize(d.description).includes(q) ||
          turkishNormalize(d.vekalet).includes(q) ||
          turkishNormalize(d.donationType).includes(q) ||
          turkishNormalize(d.notes || "").includes(q)
        ) {
          matches.push({ groupIdx, dIdx, groupId: group.id, animalNo: group.animalNo });
        }
      });
    });
    return matches;
  }, [kesim, groupSearchQuery]);

  const currentGroupMatches = useMemo(() => groupSearchMatches(), [groupSearchMatches]);

  useEffect(() => {
    if (currentGroupMatches.length > 0 && groupSearchMatchIdx >= 0) {
      const match = currentGroupMatches[groupSearchMatchIdx % currentGroupMatches.length];
      if (match) {
        setCollapsedGroups(prev => {
          const next = new Set(prev);
          next.delete(match.groupId);
          return next;
        });
        setTimeout(() => {
          scrollToAnimalGroup(match.animalNo);
        }, 100);
      }
    }
  }, [groupSearchMatchIdx, groupSearchQuery]);

  function isGroupSearchMatch(groupIdx: number, dIdx: number): boolean {
    if (!groupSearchQuery.trim()) return false;
    const q = turkishNormalize(groupSearchQuery.trim());
    const d = kesim?.animalGroups[groupIdx]?.donations[dIdx];
    if (!d) return false;
    return (
      turkishNormalize(d.name).includes(q) ||
      turkishNormalize(d.description).includes(q) ||
      turkishNormalize(d.vekalet).includes(q) ||
      turkishNormalize(d.donationType).includes(q) ||
      turkishNormalize(d.notes || "").includes(q)
    );
  }

  const toggleGroupDonationSelect = useCallback((donationId: string) => {
    setSelectedGroupDonations(prev => {
      const next = new Set(prev);
      if (next.has(donationId)) next.delete(donationId);
      else next.add(donationId);
      return next;
    });
  }, []);

  function bulkRemoveFromGroups() {
    if (!kesim || selectedGroupDonations.size === 0) return;
    const removedIds = new Set<string>();
    const groups = kesim.animalGroups.map(g => ({
      ...g,
      donations: g.donations.map(d => {
        if (selectedGroupDonations.has(d.id) && d.name.trim()) {
          removedIds.add(d.id);
          return {
            id: generateId(),
            name: "",
            description: "",
            donationType: "",
            shareCount: 1,
            vekalet: "",
            notes: "",
          };
        }
        return { ...d };
      }),
    }));
    setRemovedFromGroupIds(prev => {
      const next = new Set(prev);
      removedIds.forEach(id => next.add(id));
      return next;
    });
    save({ ...kesim, animalGroups: groups }, `${selectedGroupDonations.size} bağışçı gruplardan çıkarıldı`, false, 'groups');
    setSelectedGroupDonations(new Set());
    toast({
      title: "Gruptan Çıkarıldı",
      description: `${removedIds.size} bağışçı gruplardan çıkarıldı. "Gruptan Çıkarılanlar" filtresinden erişebilirsiniz.`,
    });
  }

  function bulkMoveToGroup(targetGroupIdx: number) {
    if (!kesim || selectedGroupDonations.size === 0 || targetGroupIdx < 0) return;
    if (isGroupLocked(targetGroupIdx)) return;
    const groups = kesim.animalGroups.map(g => ({
      ...g,
      donations: g.donations.map(d => ({ ...d })),
    }));
    const emptySlotCount = groups[targetGroupIdx].donations.filter(d => !d.name.trim()).length;
    const candidateIds: string[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      if (isGroupLocked(gi) || gi === targetGroupIdx) continue;
      for (let di = 0; di < groups[gi].donations.length; di++) {
        const d = groups[gi].donations[di];
        if (selectedGroupDonations.has(d.id) && d.name.trim()) {
          candidateIds.push(d.id);
        }
      }
    }
    const moveCount = Math.min(candidateIds.length, emptySlotCount);
    if (moveCount === 0) {
      toast({ title: "Taşıma yapılamadı", description: "Hedef grupta boş slot yok.", variant: "destructive" });
      return;
    }
    const idsToMove = new Set(candidateIds.slice(0, moveCount));
    const itemsToMove: Donation[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      if (isGroupLocked(gi) || gi === targetGroupIdx) continue;
      for (let di = groups[gi].donations.length - 1; di >= 0; di--) {
        const d = groups[gi].donations[di];
        if (idsToMove.has(d.id)) {
          itemsToMove.push(d);
          groups[gi].donations[di] = {
            id: generateId(),
            name: "",
            description: "",
            donationType: "",
            shareCount: 1,
            vekalet: "",
            notes: "",
          };
        }
      }
    }
    for (const item of itemsToMove) {
      const emptyIdx = groups[targetGroupIdx].donations.findIndex(d => !d.name.trim());
      if (emptyIdx >= 0) {
        groups[targetGroupIdx].donations[emptyIdx] = item;
      }
    }
    save({ ...kesim, animalGroups: groups }, `${itemsToMove.length} bağışçı Hayvan ${groups[targetGroupIdx].animalNo}'e taşındı`, false, 'groups');
    setSelectedGroupDonations(new Set());
    setBulkMoveTargetGroup(-1);
    if (moveCount < candidateIds.length) {
      toast({ title: "Kısmi taşıma", description: `Hedef grupta yeterli boş slot olmadığı için ${moveCount}/${candidateIds.length} bağışçı taşındı.`, variant: "destructive" });
    }
  }

  function bulkChangeGroupDonationType() {
    if (!kesim || selectedGroupDonations.size === 0) return;
    const groups = kesim.animalGroups.map(g => ({
      ...g,
      donations: g.donations.map(d => {
        if (selectedGroupDonations.has(d.id)) {
          if (bulkGroupEditField === "donationType") return { ...d, donationType: bulkGroupEditValue };
          if (bulkGroupEditField === "notes") return { ...d, notes: bulkGroupEditValue };
        }
        return { ...d };
      }),
    }));
    save({ ...kesim, animalGroups: groups }, `${selectedGroupDonations.size} bağışçı toplu düzenlendi`, false, 'groups');
    setSelectedGroupDonations(new Set());
    setBulkGroupEditOpen(false);
    setBulkGroupEditValue("");
  }

  const basketItemIds = useMemo(() => new Set(basketItems.map(b => b.donationId)), [basketItems]);
  const localBasketItems = useMemo(() => basketItems.filter(b => b.kesimAlaniId === kesim?.id), [basketItems, kesim?.id]);
  const foreignBasketItems = useMemo(() => basketItems.filter(b => b.kesimAlaniId !== kesim?.id), [basketItems, kesim?.id]);

  function makeBasketItem(d: Donation): BasketItem {
    return {
      donationId: d.id,
      kesimAlaniId: kesim!.id,
      kesimAlaniName: kesim!.name,
      name: d.name,
      description: d.description || "",
    };
  }

  function addToBasket(groupIdx: number, donationIdx: number) {
    if (!kesim) return;
    const d = kesim.animalGroups[groupIdx]?.donations[donationIdx];
    if (!d || !d.name.trim()) return;
    if (isGroupLocked(groupIdx)) return;
    if (basketItemIds.has(d.id)) return;
    setBasketItems(prev => [...prev, makeBasketItem(d)]);
  }

  function addDonorToBasket(donationId: string) {
    if (!kesim || basketItemIds.has(donationId)) return;
    const d = kesim.donations.find(dd => dd.id === donationId) || kesim.animalGroups.flatMap(g => g.donations).find(dd => dd.id === donationId);
    if (!d || !d.name.trim()) return;
    setBasketItems(prev => [...prev, makeBasketItem(d)]);
  }

  function addGroupToBasket(groupIdx: number) {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    if (!group || isGroupLocked(groupIdx)) return;
    const filled = group.donations.filter(d => d.name.trim());
    if (filled.length === 0) return;
    setBasketItems(prev => {
      const existingIds = new Set(prev.map(b => b.donationId));
      const newItems = [...prev];
      for (const d of filled) {
        if (!existingIds.has(d.id)) {
          newItems.push(makeBasketItem(d));
          existingIds.add(d.id);
        }
      }
      return newItems;
    });
    toast({ title: `${filled.length} bağışçı sepete eklendi`, description: `Hayvan ${group.animalNo}` });
  }

  function removeFromBasket(donationId: string) {
    setBasketItems(prev => prev.filter(b => b.donationId !== donationId));
  }

  function clearBasket() {
    setBasketItems([]);
  }

  function transferBasketToGroup(targetGroupIdx: number) {
    if (!kesim || localBasketItems.length === 0 || targetGroupIdx < 0 || targetGroupIdx >= kesim.animalGroups.length) return;
    if (isGroupLocked(targetGroupIdx)) return;
    const groups = kesim.animalGroups.map(g => ({
      ...g,
      donations: g.donations.map(d => ({ ...d })),
    }));
    const emptySlots = groups[targetGroupIdx].donations.filter(d => !d.name.trim()).length;
    if (emptySlots === 0) {
      toast({ title: "Hedef grupta boş slot yok.", variant: "destructive" });
      return;
    }
    const localIds = new Set(localBasketItems.map(b => b.donationId));
    const groupedBasketIds = new Set<string>();
    const lockedBasketIds = new Set<string>();
    const ungroupedBasketDonors: Donation[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      for (const d of groups[gi].donations) {
        if (!localIds.has(d.id) || !d.name.trim()) continue;
        if (isGroupLocked(gi)) {
          lockedBasketIds.add(d.id);
        } else if (gi !== targetGroupIdx) {
          groupedBasketIds.add(d.id);
        }
      }
    }
    const sharesMap = computeEffectiveShares(kesim.donations);
    let ungroupedSlots = 0;
    for (const b of localBasketItems) {
      if (groupedBasketIds.has(b.donationId) || lockedBasketIds.has(b.donationId)) continue;
      const donor = kesim.donations.find(d => d.id === b.donationId);
      if (donor && !donor.excluded) {
        const effectiveShares = sharesMap.get(b.donationId) || donor.shareCount;
        ungroupedBasketDonors.push(donor);
        ungroupedSlots += effectiveShares;
      }
    }
    const totalSlotsNeeded = groupedBasketIds.size + ungroupedSlots;
    if (totalSlotsNeeded > emptySlots) {
      toast({
        title: "Yetersiz Alan",
        description: `Sepetteki bağışçılar ${totalSlotsNeeded} slot gerektiriyor, ancak hedef grupta sadece ${emptySlots} boş slot var.`,
        variant: "destructive",
      });
      return;
    }
    const itemsToMove: Donation[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      if (isGroupLocked(gi) || gi === targetGroupIdx) continue;
      for (let di = groups[gi].donations.length - 1; di >= 0; di--) {
        const d = groups[gi].donations[di];
        if (localIds.has(d.id)) {
          itemsToMove.push(d);
          groups[gi].donations[di] = {
            id: generateId(), name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "",
          };
        }
      }
    }
    for (const donor of ungroupedBasketDonors) {
      const effectiveShares = sharesMap.get(donor.id) || donor.shareCount;
      for (let s = 0; s < effectiveShares; s++) {
        itemsToMove.push({ ...donor, id: s === 0 ? donor.id : generateId() });
      }
    }
    const transferredIds = new Set<string>();
    for (const item of itemsToMove) {
      const emptyIdx = groups[targetGroupIdx].donations.findIndex(d => !d.name.trim());
      if (emptyIdx >= 0) {
        groups[targetGroupIdx].donations[emptyIdx] = item;
        transferredIds.add(item.id);
      }
    }
    if (transferredIds.size === 0) {
      toast({ title: "Aktarım yapılamadı.", variant: "destructive" });
      return;
    }
    const movedDonorCount = groupedBasketIds.size + ungroupedBasketDonors.length;
    save({ ...kesim, animalGroups: groups }, `Sepetten ${movedDonorCount} bağışçı (${transferredIds.size} slot) Hayvan ${groups[targetGroupIdx].animalNo}'e aktarıldı`, false, 'groups');
    setBasketItems(prev => prev.filter(b => !transferredIds.has(b.donationId) && !groupedBasketIds.has(b.donationId)));
    setBasketTransferTarget(-1);
    const skipped = lockedBasketIds.size;
    if (skipped > 0) {
      toast({
        title: "Kısmi Aktarım",
        description: `${movedDonorCount} bağışçı aktarıldı. ${skipped} tanesi kilitli grupta, sepette kaldı.`,
      });
    }
  }

  function autoDistributeBasket() {
    if (!kesim || localBasketItems.length === 0) return;
    const sharesMap = computeEffectiveShares(kesim.donations);

    const lockedGroupDonorIds = new Set<string>();
    for (const g of kesim.animalGroups) {
      if (g.locked) {
        for (const d of g.donations) {
          if (d.name.trim()) lockedGroupDonorIds.add(d.id);
        }
      }
    }

    const localIds = localBasketItems.map(b => b.donationId);
    const movableIds = localIds.filter(id => !lockedGroupDonorIds.has(id));
    const skippedCount = localIds.length - movableIds.length;

    if (movableIds.length === 0) {
      toast({
        title: "Dağıtım Yapılamadı",
        description: "Sepetteki tüm bağışçılar kilitli gruplarda. Önce kilidi açın.",
        variant: "destructive",
      });
      return;
    }

    const basketDonors: Donation[] = [];
    for (const id of movableIds) {
      const fromGroup = kesim.animalGroups.flatMap(g => g.donations).find(d => d.id === id);
      const fromList = kesim.donations.find(d => d.id === id);
      const donor = fromGroup || fromList;
      if (donor && !donor.excluded) basketDonors.push(donor);
    }
    if (basketDonors.length === 0) return;

    let totalShares = 0;
    for (const d of basketDonors) {
      const inGroup = kesim.animalGroups.some(g => g.donations.some(dd => dd.id === d.id));
      if (inGroup) {
        totalShares += 1;
      } else {
        totalShares += sharesMap.get(d.id) || d.shareCount;
      }
    }
    const animalsNeeded = Math.ceil(totalShares / 7);

    const groups = kesim.animalGroups.map(g => ({
      ...g,
      donations: g.donations.map(d => ({ ...d })),
    }));

    const movableIdSet = new Set(movableIds);
    const itemsToPlace: Donation[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      if (groups[gi].locked) continue;
      for (let di = groups[gi].donations.length - 1; di >= 0; di--) {
        const d = groups[gi].donations[di];
        if (movableIdSet.has(d.id)) {
          itemsToPlace.push(d);
          groups[gi].donations[di] = {
            id: generateId(), name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "",
          };
        }
      }
    }
    for (const donor of basketDonors) {
      if (!itemsToPlace.find(d => d.id === donor.id)) {
        const eff = sharesMap.get(donor.id) || donor.shareCount;
        for (let s = 0; s < eff; s++) {
          itemsToPlace.push({ ...donor, id: s === 0 ? donor.id : generateId() });
        }
      }
    }

    const emptyDonation = (): Donation => ({
      id: generateId(), name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "",
    });
    for (let i = 0; i < animalsNeeded; i++) {
      const hasEmptyGroup = groups.some(g => !g.locked && g.donations.every(d => !d.name.trim()));
      if (!hasEmptyGroup) {
        groups.push({
          id: generateId(),
          animalNo: groups.length + 1,
          donations: Array.from({ length: 7 }, emptyDonation),
        });
      }
    }

    let placed = 0;
    for (const item of itemsToPlace) {
      let foundSlot = false;
      for (const g of groups) {
        if (g.locked) continue;
        const emptyIdx = g.donations.findIndex(d => !d.name.trim());
        if (emptyIdx >= 0) {
          g.donations[emptyIdx] = item;
          placed++;
          foundSlot = true;
          break;
        }
      }
      if (!foundSlot) {
        const newGroup: AnimalGroup = {
          id: generateId(),
          animalNo: groups.length + 1,
          donations: Array.from({ length: 7 }, emptyDonation),
        };
        newGroup.donations[0] = item;
        groups.push(newGroup);
        placed++;
      }
    }

    const renumbered = groups.map((g, i) => ({ ...g, animalNo: i + 1 }));
    save({ ...kesim, animalGroups: renumbered }, `Sepet otomatik dağıtıldı: ${placed} bağışçı`, false, 'groups');
    const remaining = basketItems.filter(b => lockedGroupDonorIds.has(b.donationId) || b.kesimAlaniId !== kesim.id);
    setBasketItems(remaining);
    const desc = skippedCount > 0
      ? `${placed} slot dağıtıldı. ${skippedCount} tanesi kilitli grupta, sepette kaldı.`
      : `${placed} slot gruplara dağıtıldı.`;
    toast({ title: "Otomatik Dağıtım", description: desc });
  }

  async function transferBasketToOtherKA(targetKAId: string) {
    if (!kesim || basketItems.length === 0 || !targetKAId) return;
    const itemsToTransfer = basketItems.filter(b => b.kesimAlaniId === kesim.id);
    if (itemsToTransfer.length === 0) {
      toast({ title: "Bu kesim alanından sepette bağışçı yok.", variant: "destructive" });
      return;
    }
    setCrossKATransferring(true);
    try {
      await moveDonationsToKesimAlani(
        itemsToTransfer.map(b => b.donationId),
        kesim.id,
        targetKAId,
      );
      setBasketItems(prev => prev.filter(b => b.kesimAlaniId !== kesim.id));
      const data = await fetchKesimAlani(kesim.id);
      if (data) {
        setKesim(data);
        history.initialize(data);
      }
      const targetName = siblingKesimAlanlari.find(ka => ka.id === targetKAId)?.name || targetKAId;
      toast({ title: `${itemsToTransfer.length} bağışçı ${targetName} kesim alanına aktarıldı` });
      setBasketCrossKATarget("");
    } catch (err) {
      toast({
        title: "Aktarım başarısız",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setCrossKATransferring(false);
    }
  }

  async function transferForeignToCurrentDonorList(removeFromSource: boolean) {
    if (!kesim) return;
    const foreignItems = basketItems.filter(b => b.kesimAlaniId !== kesim.id);
    if (foreignItems.length === 0) return;
    setTransferToDonorListRemoving(true);
    try {
      const donationIds = foreignItems.map(b => b.donationId);
      const sourceKAIds = [...new Set(foreignItems.map(b => b.kesimAlaniId))];
      for (const sourceKAId of sourceKAIds) {
        const itemsFromSource = foreignItems.filter(b => b.kesimAlaniId === sourceKAId);
        await moveDonationsToKesimAlani(
          itemsFromSource.map(b => b.donationId),
          sourceKAId,
          kesim.id,
        );
      }
      if (kesim.projectId) {
        const transferEntries: DonationTransferEntry[] = foreignItems.map(b => ({
          id: crypto.randomUUID(),
          projectId: kesim.projectId!,
          donationId: b.donationId,
          donorName: b.name,
          donorDescription: b.description,
          fromKesimAlaniId: b.kesimAlaniId,
          fromKesimAlaniName: b.kesimAlaniName,
          toKesimAlaniId: kesim.id,
          toKesimAlaniName: kesim.name,
          removedFromSource: removeFromSource,
          shareCount: 1,
          createdAt: new Date().toISOString(),
        }));
        try {
          await createDonationTransfers(transferEntries);
        } catch {
          toast({ title: "Uyarı", description: "Aktarım logu kaydedilemedi, ancak bağışçılar başarıyla aktarıldı.", variant: "destructive" });
        }
      }
      setBasketItems(prev => prev.filter(b => !donationIds.includes(b.donationId)));
      const data = await fetchKesimAlani(kesim.id);
      if (data) {
        setKesim(data);
        history.initialize(data);
      }
      toast({ title: `${foreignItems.length} bağışçı bu kesim alanının listesine eklendi` });
    } catch (err) {
      toast({
        title: "Aktarım başarısız",
        description: err instanceof Error ? err.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setTransferToDonorListRemoving(false);
      setTransferToDonorListConfirm(false);
    }
  }

  function addSelectedToBasket() {
    if (!kesim || selectedIds.size === 0) return;
    setBasketItems(prev => {
      const existingIds = new Set(prev.map(b => b.donationId));
      const newItems = [...prev];
      for (const id of selectedIds) {
        if (!existingIds.has(id)) {
          const d = kesim.donations.find(dd => dd.id === id);
          if (d && !d.excluded) {
            newItems.push(makeBasketItem(d));
            existingIds.add(id);
          }
        }
      }
      return newItems;
    });
    toast({
      title: "Sepete Eklendi",
      description: `${selectedIds.size} bağışçı sepete eklendi.`,
    });
  }

  function addEmptyGroup() {
    if (!kesim) return;
    const emptyDonation = (): Donation => ({
      id: generateId(), name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "",
    });
    const newGroup: AnimalGroup = {
      id: generateId(),
      animalNo: kesim.animalGroups.length + 1,
      donations: Array.from({ length: 7 }, emptyDonation),
    };
    save({ ...kesim, animalGroups: [...kesim.animalGroups, newGroup] }, `Boş hayvan grubu eklendi: #${newGroup.animalNo}`, false, 'groups');
  }

  function cleanEmptyGroups() {
    if (!kesim) return;
    const nonEmpty = kesim.animalGroups.filter(g => g.donations.some(d => d.name.trim()));
    if (nonEmpty.length === kesim.animalGroups.length) return;
    const removed = kesim.animalGroups.length - nonEmpty.length;
    const renumbered = nonEmpty.map((g, i) => ({ ...g, animalNo: i + 1 }));
    save({ ...kesim, animalGroups: renumbered }, `${removed} boş grup temizlendi`, false, 'groups');
  }

  function moveGroupUp(groupIdx: number) {
    if (!kesim || groupIdx <= 0) return;
    const groups = [...kesim.animalGroups];
    [groups[groupIdx - 1], groups[groupIdx]] = [groups[groupIdx], groups[groupIdx - 1]];
    const renumbered = groups.map((g, i) => ({ ...g, animalNo: i + 1 }));
    save({ ...kesim, animalGroups: renumbered }, `Hayvan ${kesim.animalGroups[groupIdx].animalNo} yukarı taşındı`, false, 'groups');
  }

  function moveGroupDown(groupIdx: number) {
    if (!kesim || groupIdx >= kesim.animalGroups.length - 1) return;
    const groups = [...kesim.animalGroups];
    [groups[groupIdx], groups[groupIdx + 1]] = [groups[groupIdx + 1], groups[groupIdx]];
    const renumbered = groups.map((g, i) => ({ ...g, animalNo: i + 1 }));
    save({ ...kesim, animalGroups: renumbered }, `Hayvan ${kesim.animalGroups[groupIdx].animalNo} aşağı taşındı`, false, 'groups');
  }

  function getAvailableGroupsForDonor(donorId: string): { groupIdx: number; animalNo: number; emptySlots: number }[] {
    if (!kesim) return [];
    const donor = kesim.donations.find(d => d.id === donorId);
    if (!donor) return [];
    const sharesMap = computeEffectiveShares(kesim.donations);
    const effectiveShares = sharesMap.get(donorId) || donor.shareCount;
    return kesim.animalGroups
      .map((g, i) => ({
        groupIdx: i,
        animalNo: g.animalNo,
        emptySlots: g.donations.filter(d => !d.name.trim()).length,
      }))
      .filter(g => g.emptySlots >= effectiveShares && !isGroupLocked(g.groupIdx));
  }

  function getSwapSuggestions(donorId: string): { groupIdx: number; animalNo: number; swapOutIds: string[]; swapOutNames: string[]; description: string }[] {
    if (!kesim) return [];
    const donor = kesim.donations.find(d => d.id === donorId);
    if (!donor) return [];
    const sharesMap = computeEffectiveShares(kesim.donations);
    const effectiveShares = sharesMap.get(donorId) || donor.shareCount;
    if (effectiveShares <= 1) return [];
    const suggestions: { groupIdx: number; animalNo: number; swapOutIds: string[]; swapOutNames: string[]; description: string }[] = [];
    for (let gi = 0; gi < kesim.animalGroups.length; gi++) {
      const g = kesim.animalGroups[gi];
      if (isGroupLocked(gi)) continue;
      const emptySlots = g.donations.filter(d => !d.name.trim()).length;
      if (emptySlots >= effectiveShares) continue;
      const slotsNeeded = effectiveShares - emptySlots;
      const singleShareDonors = g.donations.filter(d => {
        if (!d.name.trim()) return false;
        const dShares = sharesMap.get(d.id) || d.shareCount;
        return dShares === 1;
      });
      if (singleShareDonors.length >= slotsNeeded) {
        const toSwap = singleShareDonors.slice(0, slotsNeeded);
        suggestions.push({
          groupIdx: gi,
          animalNo: g.animalNo,
          swapOutIds: toSwap.map(d => d.id),
          swapOutNames: toSwap.map(d => d.description || d.name),
          description: `${toSwap.length} tekli hisse çıkar → ${effectiveShares} hisseli yerleş`,
        });
      }
    }
    return suggestions;
  }

  function executeSwapSuggestion(donorId: string, groupIdx: number, swapOutIds: string[]) {
    if (!kesim) return;
    if (isGroupLocked(groupIdx)) return;
    const donor = kesim.donations.find(d => d.id === donorId);
    if (!donor) return;
    const sharesMap = computeEffectiveShares(kesim.donations);
    const effectiveShares = sharesMap.get(donorId) || donor.shareCount;
    const groups = kesim.animalGroups.map(g => ({
      ...g,
      donations: g.donations.map(d => ({ ...d })),
    }));
    const swapSet = new Set(swapOutIds);
    for (let di = 0; di < groups[groupIdx].donations.length; di++) {
      if (swapSet.has(groups[groupIdx].donations[di].id)) {
        groups[groupIdx].donations[di] = {
          id: generateId(), name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "",
        };
      }
    }
    let placed = 0;
    for (let di = 0; di < groups[groupIdx].donations.length && placed < effectiveShares; di++) {
      if (!groups[groupIdx].donations[di].name.trim()) {
        groups[groupIdx].donations[di] = { ...donor, id: placed === 0 ? donor.id : generateId() };
        placed++;
      }
    }
    save({ ...kesim, animalGroups: groups }, `${donor.description || donor.name}: Hayvan ${groups[groupIdx].animalNo}'e takas ile yerleştirildi`, false, 'groups');
    setSmartPlacePopover(null);
  }

  function smartPlaceDonor(donorId: string, targetGroupIdx: number) {
    if (!kesim) return;
    if (isGroupLocked(targetGroupIdx) || targetGroupIdx < 0 || targetGroupIdx >= kesim.animalGroups.length) return;
    const donor = kesim.donations.find(d => d.id === donorId);
    if (!donor) return;
    const sharesMap = computeEffectiveShares(kesim.donations);
    const effectiveShares = sharesMap.get(donorId) || donor.shareCount;
    const groups = kesim.animalGroups.map(g => ({
      ...g,
      donations: g.donations.map(d => ({ ...d })),
    }));
    let placed = 0;
    for (let i = 0; i < groups[targetGroupIdx].donations.length && placed < effectiveShares; i++) {
      if (!groups[targetGroupIdx].donations[i].name.trim()) {
        groups[targetGroupIdx].donations[i] = { ...donor, id: placed === 0 ? donor.id : generateId() };
        placed++;
      }
    }
    if (placed === 0) return;
    save({ ...kesim, animalGroups: groups }, `${donor.description || donor.name} (${placed} hisse) Hayvan ${groups[targetGroupIdx].animalNo}'e yerleştirildi`, false, 'groups');
    setSmartPlacePopover(null);
  }

  function getSplitOptions(totalShares: number): Array<[number, number]> {
    const options: Array<[number, number]> = [];
    const maxFirst = Math.min(totalShares - 1, 7);
    for (let first = maxFirst; first >= Math.ceil(totalShares / 2); first--) {
      const second = totalShares - first;
      if (second >= 1 && second <= 7) {
        options.push([first, second]);
      }
    }
    return options;
  }

  function applySplitShare(donationId: string, splitA: number, splitB: number) {
    if (!kesim) return;
    const donor = kesim.donations.find(d => d.id === donationId);
    if (!donor) return;
    const baseName = donor.description || donor.name;
    const updatedDonations = kesim.donations.map(d => {
      if (d.id === donationId) return { ...d, shareCount: splitA, description: `${baseName} (1/${splitA + splitB})` };
      return d;
    });
    const newDonor: Donation = {
      ...donor,
      id: generateId(),
      shareCount: splitB,
      description: `${baseName} (2/${splitA + splitB})`,
    };
    updatedDonations.push(newDonor);
    save({ ...kesim, donations: updatedDonations }, `${baseName}: ${splitA + splitB} hisse → ${splitA}+${splitB} olarak bölündü`);
    setSplitShareDialog(null);
  }

  async function handleSaveTeam() {
    if (!kesim || !teamName.trim()) return;
    setTeamSaving(true);
    try {
      if (teamEditId) {
        const updated = await updateTeam(kesim.id, teamEditId, { name: teamName.trim(), color: teamColor });
        setKesim(prev => prev ? { ...prev, teams: (prev.teams || []).map(t => t.id === teamEditId ? updated : t) } : prev);
        toast({ title: "Ekip güncellendi" });
      } else {
        const created = await createTeam(kesim.id, teamName.trim(), teamColor);
        setKesim(prev => prev ? { ...prev, teams: [...(prev.teams || []), created] } : prev);
        toast({ title: "Ekip oluşturuldu" });
      }
      setTeamEditId(null);
      setTeamName("");
      setTeamColor("#3b82f6");
    } catch {
      toast({ title: "Hata", variant: "destructive" });
    } finally {
      setTeamSaving(false);
    }
  }

  async function handleDeleteTeam(teamId: string) {
    if (!kesim) return;
    try {
      await deleteTeam(kesim.id, teamId);
      setKesim(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          teams: (prev.teams || []).filter(t => t.id !== teamId),
          animalGroups: prev.animalGroups.map(g => g.teamId === teamId ? { ...g, teamId: undefined } : g),
        };
      });
      if (filterTeam === teamId) setFilterTeam("all");
      toast({ title: "Ekip silindi" });
    } catch {
      toast({ title: "Hata", variant: "destructive" });
    }
  }

  async function handleAssignTeam(groupId: string, teamId: string | null) {
    if (!kesim) return;
    try {
      await assignTeamAdmin(kesim.id, groupId, teamId);
      setKesim(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          animalGroups: prev.animalGroups.map(g => g.id === groupId ? { ...g, teamId: teamId || undefined } : g),
        };
      });
    } catch {
      toast({ title: "Hata", variant: "destructive" });
    }
  }

  function enhancedRemoveFromGroup(groupIdx: number, donationIdx: number) {
    if (!kesim) return;
    if (isGroupLocked(groupIdx)) return;
    const d = kesim.animalGroups[groupIdx]?.donations[donationIdx];
    if (!d || !d.name.trim()) return;
    const donorName = d.description || d.name;
    const groupNo = kesim.animalGroups[groupIdx]?.animalNo;
    setRemovedFromGroupIds(prev => {
      const next = new Set(prev);
      next.add(d.id);
      return next;
    });
    removeFromGroup(groupIdx, donationIdx);
    toast({
      title: "Gruptan Çıkarıldı",
      description: `${donorName} Hayvan ${groupNo}'den çıkarıldı. "Gruptan Çıkarılanlar" filtresinden erişebilirsiniz.`,
    });
  }

  const donations = kesim ? kesim.donations : emptyDonations;
  const animalGroups = kesim ? kesim.animalGroups : emptyGroups;

  const descCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of donations) {
      if (d.excluded) continue;
      const normalizedDesc = d.description.trim().toLocaleLowerCase("tr");
      if (normalizedDesc) {
        map.set(normalizedDesc, (map.get(normalizedDesc) || 0) + 1);
      }
    }
    return map;
  }, [donations]);

  const groupedDonorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of animalGroups) {
      for (const d of g.donations) {
        if (d.name.trim()) ids.add(d.id);
      }
    }
    return ids;
  }, [animalGroups]);

  const ungroupedDonors = useMemo(() =>
    donations.filter(d => !d.excluded && !groupedDonorIds.has(d.id)),
    [donations, groupedDonorIds]
  );

  const ungroupedShareCount = useMemo(() => {
    const ungroupedEffective = computeEffectiveShares(ungroupedDonors);
    const processed = new Set<string>();
    let count = 0;
    for (const d of ungroupedDonors) {
      const key = d.description.trim().toLocaleLowerCase("tr");
      if (key && processed.has(key)) continue;
      processed.add(key);
      count += ungroupedEffective.get(d.id) || d.shareCount;
    }
    return count;
  }, [ungroupedDonors]);

  const effectiveShareMap = useMemo(() =>
    computeEffectiveShares(donations),
    [donations]
  );

  const shareDistribution = useMemo(() => {
    const dist: Record<number, number> = {};
    for (let i = 1; i <= 7; i++) dist[i] = 0;
    const processed = new Set<string>();
    for (const d of donations) {
      if (d.excluded) continue;
      const key = d.description.trim().toLocaleLowerCase("tr");
      if (key && processed.has(key)) continue;
      processed.add(key);
      const eff = effectiveShareMap.get(d.id) || d.shareCount;
      const sc = Math.max(1, Math.min(7, eff));
      dist[sc] = (dist[sc] || 0) + 1;
    }
    return dist;
  }, [donations, effectiveShareMap]);

  const groupCompositions = useMemo(() => {
    const compositions = new Map<string, number>();
    for (const g of animalGroups) {
      const filled = g.donations.filter(d => d.name.trim());
      const shareMap = new Map<string, number>();
      for (const d of filled) {
        const key = d.description.trim().toLocaleLowerCase("tr") || d.id;
        shareMap.set(key, (shareMap.get(key) || 0) + 1);
      }
      const parts = Array.from(shareMap.values()).sort((a, b) => a - b);
      const emptySlots = 7 - filled.length;
      const label = parts.length > 0
        ? (emptySlots > 0 ? [...parts, `${emptySlots}boş`].join("+") : parts.join("+"))
        : "Boş";
      compositions.set(label, (compositions.get(label) || 0) + 1);
    }
    return compositions;
  }, [animalGroups]);

  const sortKeyMap = useMemo(() => {
    const map = new Map<string, { nameSurname: string; descSurname: string; name: string; description: string; donationType: string; shareCount: number }>();
    for (const d of donations) {
      const nameStr = (d.name || "").trim();
      const descStr = (d.description || "").trim();
      map.set(d.id, {
        nameSurname: nameStr.split(/\s+/).pop() || nameStr,
        descSurname: descStr.split(/\s+/).pop() || descStr,
        name: nameStr,
        description: descStr,
        donationType: (d.donationType || "").trim(),
        shareCount: d.shareCount,
      });
    }
    return map;
  }, [donations]);

  const sortedDonorList = useMemo(() => {
    const active = donations.filter(d => !d.excluded);
    return [...active].sort((a, b) => {
      const ka = sortKeyMap.get(a.id);
      const kb = sortKeyMap.get(b.id);
      if (!ka || !kb) return 0;
      return trCollator.compare(ka.descSurname, kb.descSurname);
    });
  }, [donations, sortKeyMap]);

  const searchIndex = useMemo(() => {
    const trigramIndex = new Map<string, Set<string>>();
    const contentMap = new Map<string, string>();

    function addTrigrams(text: string, id: string) {
      const padded = `  ${text}  `;
      for (let i = 0; i <= padded.length - 3; i++) {
        const tri = padded.substring(i, i + 3);
        let set = trigramIndex.get(tri);
        if (!set) {
          set = new Set();
          trigramIndex.set(tri, set);
        }
        set.add(id);
      }
    }

    for (const d of donations) {
      const text = turkishNormalize([d.name, d.description, d.vekalet, d.donationType, d.notes || ""].join("\t"));
      contentMap.set(d.id, text);
      addTrigrams(text, d.id);
    }

    return {
      search(query: string): Set<string> | null {
        if (!query) return null;
        const q = turkishNormalize(query.trim());
        if (q.length === 0) return null;

        if (q.length < 3) {
          const results = new Set<string>();
          for (const [id, text] of contentMap) {
            if (text.includes(q)) results.add(id);
          }
          return results;
        }

        const padded = `  ${q}  `;
        let result: Set<string> | null = null;
        for (let i = 0; i <= padded.length - 3; i++) {
          const tri = padded.substring(i, i + 3);
          const matches = trigramIndex.get(tri);
          if (!matches || matches.size === 0) return new Set();
          if (result === null) {
            result = new Set(matches);
          } else {
            for (const id of result) {
              if (!matches.has(id)) result.delete(id);
            }
            if (result.size === 0) return result;
          }
        }

        if (result) {
          for (const id of result) {
            const text = contentMap.get(id);
            if (!text || !text.includes(q)) result.delete(id);
          }
        }

        return result ?? new Set();
      }
    };
  }, [donations]);

  const filteredDonations = useMemo(() => {
    const preFiltered = showRemovedFilter
      ? donations.filter(d => removedFromGroupIds.has(d.id))
      : filterUngrouped
      ? donations.filter(d => !d.excluded && !groupedDonorIds.has(d.id))
      : donations;

    const advFiltered = preFiltered.filter(d => {
      if (filterStatus === "active" && d.excluded) return false;
      if (filterStatus === "excluded" && !d.excluded) return false;
      if (filterCinsi !== "all" && turkishNormalize(d.donationType) !== turkishNormalize(filterCinsi)) return false;
      if (filterHisseMin > 0 && d.shareCount < filterHisseMin) return false;
      if (filterHisseMax > 0 && d.shareCount > filterHisseMax) return false;
      if (filterTags.length > 0) {
        const donorTags = d.tags || [];
        if (!filterTags.some(ft => donorTags.includes(ft))) return false;
      }
      if (filterAiCategories.length > 0) {
        const cats = d.aiCategories || [];
        if (!filterAiCategories.some(fc => cats.includes(fc))) return false;
      }
      if (filterAiWarnings) {
        if (!d.aiWarnings || !d.aiWarnings.trim()) return false;
      }
      return true;
    });

    if (!debouncedSearchQuery.trim()) return advFiltered;
    const matchedIds = searchIndex.search(debouncedSearchQuery);
    if (!matchedIds) return advFiltered;
    return advFiltered.filter(d => matchedIds.has(d.id));
  }, [donations, showRemovedFilter, removedFromGroupIds, filterUngrouped, groupedDonorIds, filterStatus, filterCinsi, filterHisseMin, filterHisseMax, filterTags, filterAiCategories, filterAiWarnings, debouncedSearchQuery, searchIndex]);

  const uniqueDonationTypes = useMemo(() =>
    Array.from(new Set(
      donations.map(d => d.donationType.trim()).filter(Boolean)
    )).sort(),
    [donations]
  );

  const availableAiCategories = useMemo(() =>
    Array.from(new Set(
      donations.flatMap(d => d.aiCategories || [])
    )).sort(),
    [donations]
  );

  const virtuosoTableComponents = useMemo(() => ({
    Table: VirtuosoTable,
    TableHead: VirtuosoTableHead,
    TableRow: ({ item: d, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { item?: Donation }) => (
      <tr
        {...props}
        data-donation-id={d?.id}
        className={`border-b hover:bg-muted/30 transition-colors ${d && selectedIds.has(d.id) ? "bg-primary/5" : ""} ${d?.excluded ? "opacity-40 line-through" : ""} ${d && highlightDonationId === d.id ? "ring-2 ring-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 animate-pulse" : ""}`}
      />
    ),
  }), [selectedIds, highlightDonationId]);

  const filteredGroupItems = useMemo(() => {
    if (!kesim) return [];
    return kesim.animalGroups
      .map((group, groupIdx) => ({ group, groupIdx }))
      .filter(({ group }) => {
        if (colorTagFilter !== "all" && (group.colorTag || "") !== colorTagFilter) return false;
        if (filterTeam !== "all") {
          if (filterTeam === "none" && group.teamId) return false;
          if (filterTeam !== "none" && group.teamId !== filterTeam) return false;
        }
        if (showOnlyIncomplete) {
          const filled = group.donations.filter(d => d.name.trim() !== "").length;
          if (filled >= 7) return false;
        }
        return true;
      });
  }, [kesim?.animalGroups, colorTagFilter, filterTeam, showOnlyIncomplete]);

  const effectiveColumnCount = workspace?.prefs?.columnCount ?? 1;

  const groupRows = useMemo(() => {
    const rows: (typeof filteredGroupItems)[] = [];
    const cols = effectiveColumnCount;
    for (let i = 0; i < filteredGroupItems.length; i += cols) {
      rows.push(filteredGroupItems.slice(i, i + cols));
    }
    return rows;
  }, [filteredGroupItems, effectiveColumnCount]);

  const scrollToAnimalGroup = useCallback((animalNo: number) => {
    const idx = filteredGroupItems.findIndex(item => item.group.animalNo === animalNo);
    if (idx >= 0 && groupsVirtuosoRef.current && filteredGroupItems.length > 20) {
      const rowIdx = Math.floor(idx / effectiveColumnCount);
      groupsVirtuosoRef.current.scrollToIndex({ index: rowIdx, align: "center", behavior: "smooth" });
    } else {
      const el = document.getElementById(`animal-group-${animalNo}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [filteredGroupItems, effectiveColumnCount]);

  const handleSetGroupColorTag = useCallback((groupIdx: number, tag: ColorTag) => {
    setGroupColorTag(groupIdx, tag);
  }, [kesim, saveSingleGroupField]);

  const handleViewPhotos = useCallback((groupId: string, animalNo: number) => {
    if (!kesim) return;
    setPhotoViewGroup({ id: groupId, animalNo });
    setPhotoViewLoading(true);
    fetchGroupPhotosAdmin(kesim.id, groupId)
      .then(setPhotoViewPhotos)
      .catch(() => setPhotoViewPhotos([]))
      .finally(() => setPhotoViewLoading(false));
  }, [kesim?.id]);

  const handleToggleBasketItem = useCallback((groupIdx: number, dIdx: number, donationId: string, isInBasket: boolean) => {
    if (isInBasket) {
      removeFromBasket(donationId);
    } else {
      addToBasket(groupIdx, dIdx);
    }
  }, [kesim, basketItemIds]);

  const handleDragOverCard = useCallback((e: React.DragEvent, groupIdx: number) => {
    e.preventDefault();
    if (dragOverGroupRef.current === groupIdx) return;
    dragOverGroupRef.current = groupIdx;
    setDragOverGroup(groupIdx);
  }, []);

  const handleSelectAllGroupDonations = useCallback((filledDonations: Donation[], allSelected: boolean) => {
    setSelectedGroupDonations(prev => {
      const next = new Set(prev);
      filledDonations.forEach(d => allSelected ? next.delete(d.id) : next.add(d.id));
      return next;
    });
  }, []);


  const totalShares = kesim ? getTotalShares(kesim.donations) : 0;
  const requiredAnimals = kesim ? getRequiredAnimals(kesim.donations) : 0;
  const remainingSlots = requiredAnimals * 7 - totalShares;

  const activeFilterCount =
    (filterCinsi !== "all" ? 1 : 0) +
    (filterHisseMin > 0 || filterHisseMax > 0 ? 1 : 0) +
    (filterTags.length > 0 ? 1 : 0) +
    (filterAiCategories.length > 0 ? 1 : 0) +
    (filterAiWarnings ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0);

  function clearAdvancedFilters() {
    setFilterCinsi("all");
    setFilterHisseMin(0);
    setFilterHisseMax(0);
    setFilterTags([]);
    setFilterAiCategories([]);
    setFilterAiWarnings(false);
    setFilterStatus("all");
  }

  const displayPreviewRows = hasHeaderRow ? previewData.slice(1) : previewData;
  const headerRow = hasHeaderRow && previewData.length > 0 ? previewData[0] : null;

  const collapseAll = () => {
    if (!kesim) return;
    setCollapsedGroups(new Set(kesim.animalGroups.map(g => g.id)));
  };
  const expandAll = () => {
    setCollapsedGroups(new Set());
  };

  const handleColumnDragStart = (key: ColumnKey) => {
    setColumnDragItem(key);
  };
  const handleColumnDragOver = (e: React.DragEvent, targetKey: ColumnKey) => {
    e.preventDefault();
  };
  const handleColumnDrop = (targetKey: ColumnKey) => {
    if (!columnDragItem || columnDragItem === targetKey) {
      setColumnDragItem(null);
      return;
    }
    const order = [...workspace.prefs.columnOrder];
    const fromIdx = order.indexOf(columnDragItem);
    const toIdx = order.indexOf(targetKey);
    if (fromIdx < 0 || toIdx < 0) {
      setColumnDragItem(null);
      return;
    }
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, columnDragItem);
    workspace.setColumnOrder(order);
    setColumnDragItem(null);
  };
  const handleColumnDragEnd = () => {
    setColumnDragItem(null);
  };

  const columnHeaderLabel = useCallback((key: ColumnKey): string => {
    const col = ALL_GROUP_COLUMNS.find(c => c.key === key);
    return col?.label || "";
  }, []);

  const columnHeaderWidth = useCallback((key: ColumnKey): string => {
    switch (key) {
      case "drag": return "w-6";
      case "index": return "w-6";
      case "vekalet": return "w-16";
      case "donationType": return "w-16";
      case "notes": return "w-20";
      case "actions": return "w-8";
      default: return "";
    }
  }, []);


    return {
      activeFilterCount,
    addDialogOpen,
    addDonation,
    addDonorToBasket,
    addEmptyGroup,
    addGroupToBasket,
    addSelectedToBasket,
    addToBasket,
    applyAutoResolve,
    applyBulkEdit,
    applyBulkImport,
    applyRangeLock,
    applySplitShare,
    autoDistributeBasket,
    autoResolveOpen,
    availableAiCategories,
    basketCrossKATarget,
    basketItemIds,
    basketItems,
    basketOpen,
    basketTransferTarget,
    buildErrorDescription,
    bulkChangeGroupDonationType,
    bulkDeleteByDesc,
    bulkDialogOpen,
    bulkEditField,
    bulkEditOpen,
    bulkEditValue,
    bulkExcludeByDesc,
    bulkGroupEditField,
    bulkGroupEditOpen,
    bulkGroupEditValue,
    bulkMode,
    bulkMoveTargetGroup,
    bulkMoveToGroup,
    bulkRemoveFromGroups,
    bulkReviewExpanded,
    bulkReviewRows,
    bulkStep,
    cancelEdit,
    cancelGrouping,
    cancelSwap,
    cleanEmptyGroups,
    clearAdvancedFilters,
    clearBasket,
    collapseAll,
    collapsedGroups,
    colorTagFilter,
    columnDragItem,
    columnHeaderLabel,
    columnHeaderWidth,
    columnMappings,
    commitEdit,
    computeAutoResolve,
    conflicts,
    crossKATransferring,
    csvExporting,
    currentGroupMatches,
    debounceTimerRef,
    debouncedSaveToApi,
    debouncedSearchQuery,
    deleteAnimalGroup,
    deleteDonation,
    deleteSelected,
    descCountMap,
    discardPendingSave,
    displayPreviewRows,
    donorListReportOpen,
    donorListVisible,
    dragItem,
    dragOverGroup,
    dragOverItem,
    editDraft,
    editingCell,
    effectiveShareMap,
    enhancedRemoveFromGroup,
    executeFindDelete,
    executeGroupFindDelete,
    executeSplitGroup,
    executeSwap,
    executeSwapSuggestion,
    expandAll,
    exportDonorsExcel,
    exportGroupsExcel,
    fileInputRef,
    filterAiCategories,
    filterAiWarnings,
    filterCinsi,
    filterHisseMax,
    filterHisseMin,
    filterStatus,
    filterTags,
    filterTeam,
    filterUngrouped,
    filteredDonations,
    filteredGroupItems,
    findDeleteColumn,
    findDeleteConfirm,
    findDeleteOpen,
    findDeleteValue,
    foreignBasketItems,
    fullscreenMode,
    getAvailableGroupsForDonor,
    getFindDeleteMatches,
    getGroupFindDeleteMatches,
    getSplitOptions,
    getSwapSuggestions,
    globalTags,
    groupCompositions,
    groupFindDeleteColumn,
    groupFindDeleteConfirm,
    groupFindDeleteOpen,
    groupFindDeleteValue,
    groupRows,
    groupSearchMatchIdx,
    groupSearchMatches,
    groupSearchQuery,
    groupedDonorIds,
    groupingInProgress,
    groupingProgress,
    groupsHeaderRef,
    groupsScrollTopRef,
    groupsVirtuosoRef,
    handleAssignTeam,
    handleAutoGroup,
    handleAutoGroupSelected,
    handleColumnDragEnd,
    handleColumnDragOver,
    handleColumnDragStart,
    handleColumnDrop,
    handleDeleteTeam,
    handleDonorCellKeyDown,
    handleDragEnd,
    handleDragLeave,
    handleDragOver,
    handleDragOverCard,
    handleDragStart,
    handleDrop,
    handleExportKaCsv,
    handleFileUpload,
    handleGoToStep,
    handleGroupCellTab,
    handlePasteData,
    handleRedo,
    handleSaveTeam,
    handleSelectAllGroupDonations,
    handleSetGroupColorTag,
    handleSort,
    handleSwapSelect,
    handleToggleBasketItem,
    handleUndo,
    handleViewPhotos,
    hasHeaderRow,
    headerRow,
    highlightIncomplete,
    history,
    historyPanelOpen,
    isDraggingSplit,
    isFullscreen,
    isGroupLocked,
    isGroupSearchMatch,
    isMobile,
    jumpDialogOpen,
    jumpInputRef,
    jumpToAnimal,
    kesim,
    lastSavedTime,
    localBasketItems,
    lockAllGroups,
    makeBasketItem,
    mergeSelectedGroups,
    minimapOpen,
    mobileTab,
    moveGroupDonation,
    moveGroupDown,
    moveGroupUp,
    notificationLogs,
    notificationLogsLoading,
    notificationLogsOpen,
    notificationTemplate,
    notificationTemplateOpen,
    notificationTemplateSaving,
    openAutoResolve,
    openSplitGroupDialog,
    openTrash,
    parseRangeLockInput,
    pasteText,
    pendingSaveRef,
    pendingSaveTypeRef,
    permanentDeleteDonation,
    personBulkDeleteConfirm,
    personEditDesc,
    personSearchQuery,
    photoCounts,
    photoViewGroup,
    photoViewLoading,
    photoViewPhotos,
    previewData,
    processRawData,
    projectName,
    qrModalOpen,
    qrUrl,
    rangeLockInput,
    remainingSlots,
    removeFromBasket,
    removeFromGroup,
    removedFromGroupIds,
    requiredAnimals,
    resetBulkDialog,
    resolveResults,
    restoreDonation,
    runGrouping,
    runIncrementalGrouping,
    save,
    saveSingleDonationField,
    saveSingleGroupField,
    saveStatus,
    saveTimeoutRef,
    saveToApi,
    scrollContainerRef,
    scrollToAnimalGroup,
    searchIndex,
    searchInputRef,
    selectedGroupDonations,
    selectedGroupIds,
    selectedIds,
    setAddDialogOpen,
    setAutoResolveOpen,
    setBasketCrossKATarget,
    setBasketItems,
    setBasketOpen,
    setBasketTransferTarget,
    setBulkDialogOpen,
    setBulkEditField,
    setBulkEditOpen,
    setBulkEditValue,
    setBulkGroupEditField,
    setBulkGroupEditOpen,
    setBulkGroupEditValue,
    setBulkMode,
    setBulkMoveTargetGroup,
    setBulkReviewExpanded,
    setBulkReviewRows,
    setBulkStep,
    setCollapsedGroups,
    setColorTagFilter,
    setColumnDragItem,
    setColumnMappings,
    setConflicts,
    setCrossKATransferring,
    setCsvExporting,
    setDebouncedSearchQuery,
    setDonorListReportOpen,
    setDonorListVisible,
    setDragItem,
    setDragOverGroup,
    setDragOverItem,
    setEditDraft,
    setEditingCell,
    setFilterAiCategories,
    setFilterAiWarnings,
    setFilterCinsi,
    setFilterHisseMax,
    setFilterHisseMin,
    setFilterStatus,
    setFilterTags,
    setFilterTeam,
    setFilterUngrouped,
    setFindDeleteColumn,
    setFindDeleteConfirm,
    setFindDeleteOpen,
    setFindDeleteValue,
    setFullscreenMode,
    setGlobalTags,
    setGroupColorTag,
    setGroupFindDeleteColumn,
    setGroupFindDeleteConfirm,
    setGroupFindDeleteOpen,
    setGroupFindDeleteValue,
    setGroupSearchMatchIdx,
    setGroupSearchQuery,
    setGroupingInProgress,
    setGroupingProgress,
    setHasHeaderRow,
    setHighlightIncomplete,
    setHistoryPanelOpen,
    setIsDraggingSplit,
    setIsFullscreen,
    setJumpDialogOpen,
    setJumpToAnimal,
    setKesim,
    setLastSavedTime,
    setLocation,
    setMinimapOpen,
    setMobileTab,
    setNotificationLogs,
    setNotificationLogsLoading,
    setNotificationLogsOpen,
    setNotificationTemplate,
    setNotificationTemplateOpen,
    setNotificationTemplateSaving,
    setPasteText,
    setPersonBulkDeleteConfirm,
    setPersonEditDesc,
    setPersonSearchQuery,
    setPhotoCounts,
    setPhotoViewGroup,
    setPhotoViewLoading,
    setPhotoViewPhotos,
    setPreviewData,
    setProjectName,
    setQrModalOpen,
    setQrUrl,
    setRangeLockInput,
    setRemovedFromGroupIds,
    setResolveResults,
    setSaveStatus,
    setSelectedGroupDonations,
    setSelectedGroupIds,
    setSelectedIds,
    setShortcutHelpOpen,
    setShowAdvancedFilter,
    setShowConflicts,
    setShowOnlyIncomplete,
    setShowRemovedFilter,
    setShowScrollTop,
    setSiblingKesimAlanlari,
    setSmartPlacePopover,
    setSortDir,
    setSortField,
    setSplitGroupDialog,
    setSplitShareDialog,
    setSwapPreviewOpen,
    setSwapSelection,
    setSwapTarget,
    setTagPopoverDonorId,
    setTeamColor,
    setTeamDialogOpen,
    setTeamEditId,
    setTeamName,
    setTeamSaving,
    setTrackingNotes,
    setTrackingNotesLoading,
    setTrackingNotesOpen,
    setTransferToDonorListConfirm,
    setTransferToDonorListRemoving,
    setTrashItems,
    setTrashLoading,
    setTrashOpen,
    setTrashPermanentConfirm,
    shareDistribution,
    shortcutHelpOpen,
    showAdvancedFilter,
    showConflicts,
    showOnlyIncomplete,
    showRemovedFilter,
    showScrollTop,
    siblingKesimAlanlari,
    smartPlaceDonor,
    smartPlacePopover,
    sortDir,
    sortField,
    sortKeyMap,
    sortedDonorList,
    splitContainerRef,
    splitGroupDialog,
    splitShareDialog,
    startEditing,
    startFilterTransition,
    swapPreviewOpen,
    swapSelection,
    swapTarget,
    tagPopoverDonorId,
    teamColor,
    teamDialogOpen,
    teamEditId,
    teamName,
    teamSaving,
    themeMode,
    toast,
    toggleDonationTag,
    toggleFullscreen,
    toggleGroupCollapse,
    toggleGroupDonationSelect,
    toggleGroupLock,
    toggleGroupSelect,
    toggleSelect,
    toggleSelectAll,
    toggleTheme,
    totalShares,
    trackingNotes,
    trackingNotesLoading,
    trackingNotesOpen,
    transferBasketToGroup,
    transferBasketToOtherKA,
    transferForeignToCurrentDonorList,
    transferToDonorListConfirm,
    transferToDonorListRemoving,
    trashItems,
    trashLoading,
    trashOpen,
    trashPermanentConfirm,
    ungroupedDonors,
    ungroupedShareCount,
    uniqueDonationTypes,
    unlockAllGroups,
    updateDonationField,
    updateGroupDonation,
    updateGroupNotes,
    virtuosoTableComponents,
    workspace,
    COLUMN_OPTIONS,
    findDeleteColumnLabel,
    effectiveColumnCount,
    };
  }
  