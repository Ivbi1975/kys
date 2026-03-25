import { useState, useEffect, useCallback, useRef, createElement, useMemo, forwardRef, useTransition } from "react";
import { TableVirtuoso } from "react-virtuoso";
import QrCodeModal from "@/components/QrCodeModal";
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
} from "lucide-react";
import type { Donation, AnimalGroup, KesimAlani, ColorTag, CustomTag, Team } from "@/lib/types";
import { fetchKesimAlani, fetchKesimAlanlari, fetchProjects, apiUpdateKesimAlani, apiUpdateBulkAnimalGroups, apiUpdateSingleDonation, apiUpdateSingleGroup, fetchTags, fetchDeletedDonations, apiSoftDeleteDonation, apiRestoreDonation, apiPermanentDeleteDonation, moveDonationsToKesimAlani, generateTrackingToken, fetchKesimAlaniTrackingNotes, updateTrackingNoteStatus, fetchGroupPhotosAdmin, getGroupPhotoUrlAdmin, fetchPhotoCountsAdmin, createTeam, updateTeam, deleteTeam, assignTeamAdmin, fetchNotificationLogs, fetchNotificationTemplate, updateNotificationTemplate } from "@/lib/api";
import type { DeletedDonation, TrackingNote, GroupPhoto, NotificationLog } from "@/lib/api";
import PhotoGallery from "@/components/PhotoGallery";
import { autoGroupDonationsAsync, getTotalShares, getRequiredAnimals, checkGroupConflicts, computeEffectiveShares } from "@/lib/grouping";
import type { GroupingProgress, ConflictInfo } from "@/lib/grouping";
import { useHistory } from "@/lib/useHistory";
import { useWorkspacePreferences, ALL_GROUP_COLUMNS, type ColumnKey } from "@/lib/useWorkspacePreferences";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import * as XLSX from "xlsx-js-style";

type SortField = "name" | "description" | "donationType" | "shareCount";
type SortDir = "asc" | "desc";
type ColumnMapping = "name" | "description" | "donationType" | "shareCount" | "vekalet" | "notes" | "skip";

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

export default function KesimAlaniPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [colorTagFilter, setColorTagFilter] = useState<ColorTag | "all">("all");
  const history = useHistory();

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
  const [jumpDialogValue, setJumpDialogValue] = useState("");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDonation, setNewDonation] = useState({
    name: "",
    description: "",
    donationType: "",
    shareCount: 1,
    vekalet: "",
    notes: "",
    phone: "",
  });
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
  const [searchQuery, setSearchQuery] = useState("");
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
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
          setJumpDialogValue("");
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
                  const el = document.getElementById(`animal-group-${animalNo}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
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

  function addDonation() {
    if (!kesim || !newDonation.name.trim()) return;
    const donation: Donation = {
      id: generateId(),
      name: newDonation.name.trim(),
      description: newDonation.description.trim(),
      donationType: newDonation.donationType.trim(),
      shareCount: Math.max(1, Math.min(7, newDonation.shareCount)),
      vekalet: newDonation.vekalet.trim(),
      notes: newDonation.notes.trim(),
      phone: newDonation.phone?.trim() || "",
    };
    save({ ...kesim, donations: [...kesim.donations, donation] }, `Bağışçı eklendi: ${donation.description || donation.name}`);
    setNewDonation({ name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "", phone: "" });
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
        const key = target.description.trim().toLowerCase();
        save({
          ...kesim,
          donations: kesim.donations.map((d) =>
            d.description.trim().toLowerCase() === key ? { ...d, excluded: true } : d
          ),
        }, `Hariç tutuldu: ${target.description}`);
        return;
      }
    }
    if (field === "excluded" && value === false) {
      const target = kesim.donations.find(d => d.id === id);
      if (target && target.description.trim()) {
        const key = target.description.trim().toLowerCase();
        save({
          ...kesim,
          donations: kesim.donations.map((d) =>
            d.description.trim().toLowerCase() === key ? { ...d, excluded: false } : d
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
    const key = description.trim().toLowerCase();
    save({
      ...kesim,
      donations: kesim.donations.map((d) =>
        d.description.trim().toLowerCase() === key ? { ...d, excluded } : d
      ),
    }, excluded ? `Toplu hariç tutuldu: ${description}` : `Toplu dahil edildi: ${description}`);
  }

  async function bulkDeleteByDesc(description: string) {
    if (!kesim) return;
    const key = description.trim().toLowerCase();
    const toDelete = kesim.donations.filter(d => d.description.trim().toLowerCase() === key);
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
    const q = findDeleteValue.trim().toLowerCase();
    return kesim.donations.filter((d) => {
      const val = (d[findDeleteColumn] || "").toString().toLowerCase();
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
    const q = groupFindDeleteValue.trim().toLowerCase();
    const matchIds = new Set<string>();
    for (const group of kesim.animalGroups) {
      for (const d of group.donations) {
        if (!d.id) continue;
        const val = (d[groupFindDeleteColumn] || "").toString().toLowerCase();
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
    reader.onload = (evt) => {
      try {
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
        const desc = descColIdx >= 0 ? String(row[descColIdx] ?? "").trim().toLowerCase() : "";
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

  async function handleAutoGroup() {
    if (!kesim || groupingInProgress) return;
    setGroupingInProgress(true);
    setGroupingProgress(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const lockedDonationIds = new Set<string>();
      for (const g of kesim.animalGroups) {
        if (g.locked) {
          for (const d of g.donations) {
            if (d.name.trim() || d.description.trim()) {
              lockedDonationIds.add(d.id);
            }
          }
        }
      }
      const donationsToGroup = kesim.donations.filter(d => !lockedDonationIds.has(d.id));
      const newGroups = await autoGroupDonationsAsync(donationsToGroup, (progress) => {
        setGroupingProgress({ ...progress });
      });
      const lockedGroups = kesim.animalGroups.filter(g => g.locked);
      const finalGroups: AnimalGroup[] = [...lockedGroups, ...newGroups];
      finalGroups.forEach((g, i) => { g.animalNo = i + 1; });
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
      const mergedDonations = [...kesim.donations, ...newDonations];
      const updated = { ...kesim, donations: mergedDonations, animalGroups: finalGroups };
      if (newDonations.length > 0) {
        save(updated, `Otomatik gruplama yapıldı: ${finalGroups.length} hayvan (${lockedGroups.length} kilitli korundu)`, true);
      } else {
        save(updated, `Otomatik gruplama yapıldı: ${finalGroups.length} hayvan (${lockedGroups.length} kilitli korundu)`, true, 'groups');
      }
      const found = checkGroupConflicts(finalGroups);
      setConflicts(found);
      if (found.length > 0) setShowConflicts(true);
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
    const sorted = [...kesim.donations].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return newDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (field === "description") {
        const aStr = String(aVal).trim();
        const bStr = String(bVal).trim();
        const aSurname = aStr.split(/\s+/).pop() || aStr;
        const bSurname = bStr.split(/\s+/).pop() || bStr;
        const surnameCmp = aSurname.localeCompare(bSurname, "tr");
        if (surnameCmp !== 0) {
          return newDir === "asc" ? surnameCmp : -surnameCmp;
        }
        const fullCmp = aStr.localeCompare(bStr, "tr");
        return newDir === "asc" ? fullCmp : -fullCmp;
      }
      return newDir === "asc"
        ? String(aVal).localeCompare(String(bVal), "tr")
        : String(bVal).localeCompare(String(aVal), "tr");
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

  function handleDragStart(groupIdx: number, donationIdx: number, e?: React.DragEvent) {
    setDragItem({ groupIdx, donationIdx });
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      const target = e.currentTarget as HTMLElement;
      target.style.opacity = "0.5";
      if (kesim) {
        const donation = kesim.animalGroups[groupIdx]?.donations[donationIdx];
        if (donation?.name.trim()) {
          const shares = effectiveShareMap.get(donation.id) || donation.shareCount;
          e.dataTransfer.setData("text/plain", `${donation.name} (${shares} hisse)`);
        }
      }
    }
  }

  function handleDragOver(
    e: React.DragEvent,
    groupIdx: number,
    donationIdx: number
  ) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverItem({ groupIdx, donationIdx });
    setDragOverGroup(groupIdx);
  }

  function handleDragLeave(e: React.DragEvent, groupIdx: number) {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      if (dragOverGroup === groupIdx) setDragOverGroup(null);
    }
  }

  function handleDrop(groupIdx: number, donationIdx: number) {
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
  }

  function handleDragEnd(e: React.DragEvent) {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDragItem(null);
    setDragOverItem(null);
    setDragOverGroup(null);
  }

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
      const donations = searchQuery.trim()
        ? kesim!.donations.filter(d => {
            const q = searchQuery.trim().toLowerCase();
            return d.name.toLowerCase().includes(q) ||
              d.description.toLowerCase().includes(q) ||
              d.vekalet.toLowerCase().includes(q) ||
              d.donationType.toLowerCase().includes(q) ||
              (d.notes || "").toLowerCase().includes(q);
          })
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

  function updateGroupDonation(
    groupIdx: number,
    donationIdx: number,
    field: keyof Donation,
    value: string | number
  ) {
    if (!kesim) return;
    if (isGroupLocked(groupIdx)) return;
    const groups = kesim.animalGroups.map((g) => ({
      ...g,
      donations: g.donations.map((d) => ({ ...d })),
    }));
    (groups[groupIdx].donations[donationIdx] as any)[field] = value;
    save({ ...kesim, animalGroups: groups }, `Grup bağışçısı güncellendi`, false, 'groups');
  }

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

  function updateGroupNotes(groupIdx: number, notes: string) {
    if (!kesim) return;
    const group = kesim.animalGroups[groupIdx];
    const groups = kesim.animalGroups.map((g, i) =>
      i === groupIdx ? { ...g, notes } : g
    );
    const updated = { ...kesim, animalGroups: groups };
    setKesim(updated);
    history.push(updated, `Grup notu güncellendi: Hayvan ${groups[groupIdx].animalNo}`);
    saveSingleGroupField(group.id, { notes });
  }

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
      await new Promise(resolve => setTimeout(resolve, 0));
      const selectedDonations = kesim.donations.filter(d => selectedIds.has(d.id));
      const newGroups = await autoGroupDonationsAsync(selectedDonations, (progress) => {
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
      const key = conflict.description.trim().toLowerCase();
      const entriesByGroup: Map<number, Array<{ groupIdx: number; dIdx: number }>> = new Map();

      workingCopy.forEach((group, groupIdx) => {
        group.donations.forEach((d, dIdx) => {
          if (d.description.trim().toLowerCase() === key) {
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
                if (d.description.trim().toLowerCase() === key) return false;
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

  function exportDonorsExcel() {
    if (!kesim) return;
    const wb = XLSX.utils.book_new();

    const donorData = kesim.donations.map((d, i) => ({
      "Sıra": i + 1,
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
      { wch: 6 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 8 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDonors, "Bağışçılar");

    if (kesim.animalGroups.length > 0) {
      const groupData: Record<string, string | number>[] = [];
      for (const group of kesim.animalGroups) {
        for (let i = 0; i < group.donations.length; i++) {
          const d = group.donations[i];
          groupData.push({
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
        { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsGroups, "Hayvan Grupları");
    }

    XLSX.writeFile(wb, `${kesim.name}_bagiscilar.xlsx`);
  }

  function exportGroupsExcel() {
    if (!kesim || kesim.animalGroups.length === 0) return;
    const data: Record<string, string | number>[] = [];
    for (const group of kesim.animalGroups) {
      for (let i = 0; i < group.donations.length; i++) {
        const d = group.donations[i];
        data.push({
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
      { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 18 },
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
    const q = groupSearchQuery.trim().toLowerCase();
    const matches: { groupIdx: number; dIdx: number; groupId: string; animalNo: number }[] = [];
    kesim.animalGroups.forEach((group, groupIdx) => {
      group.donations.forEach((d, dIdx) => {
        if (
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.vekalet.toLowerCase().includes(q) ||
          d.donationType.toLowerCase().includes(q) ||
          (d.notes || "").toLowerCase().includes(q)
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
          const el = document.getElementById(`animal-group-${match.animalNo}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  }, [groupSearchMatchIdx, groupSearchQuery]);

  function isGroupSearchMatch(groupIdx: number, dIdx: number): boolean {
    if (!groupSearchQuery.trim()) return false;
    const q = groupSearchQuery.trim().toLowerCase();
    const d = kesim?.animalGroups[groupIdx]?.donations[dIdx];
    if (!d) return false;
    return (
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.vekalet.toLowerCase().includes(q) ||
      d.donationType.toLowerCase().includes(q) ||
      (d.notes || "").toLowerCase().includes(q)
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
      const normalizedDesc = d.description.trim().toLowerCase();
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
      const key = d.description.trim().toLowerCase();
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
      const key = d.description.trim().toLowerCase();
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
        const key = d.description.trim().toLowerCase() || d.id;
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

  const filteredDonations = useMemo(() => {
    const preFiltered = showRemovedFilter
      ? donations.filter(d => removedFromGroupIds.has(d.id))
      : filterUngrouped
      ? donations.filter(d => !d.excluded && !groupedDonorIds.has(d.id))
      : donations;

    const advFiltered = preFiltered.filter(d => {
      if (filterStatus === "active" && d.excluded) return false;
      if (filterStatus === "excluded" && !d.excluded) return false;
      if (filterCinsi !== "all" && d.donationType.toLowerCase() !== filterCinsi.toLowerCase()) return false;
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
    const q = debouncedSearchQuery.trim().toLowerCase();
    return advFiltered.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.vekalet.toLowerCase().includes(q) ||
      d.donationType.toLowerCase().includes(q) ||
      (d.notes || "").toLowerCase().includes(q)
    );
  }, [donations, showRemovedFilter, removedFromGroupIds, filterUngrouped, groupedDonorIds, filterStatus, filterCinsi, filterHisseMin, filterHisseMax, filterTags, filterAiCategories, filterAiWarnings, debouncedSearchQuery]);

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
        className={`border-b hover:bg-muted/30 transition-colors ${d && selectedIds.has(d.id) ? "bg-primary/5" : ""} ${d?.excluded ? "opacity-40 line-through" : ""}`}
      />
    ),
  }), [selectedIds]);

  if (!kesim) return null;

  const totalShares = getTotalShares(kesim.donations);
  const requiredAnimals = getRequiredAnimals(kesim.donations);
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

  const renderGroupTableCell = (
    colKey: ColumnKey,
    d: Donation,
    dIdx: number,
    groupIdx: number,
    group: AnimalGroup,
  ) => {
    const compact = workspace.prefs.compactMode;
    const cellPad = compact ? "p-0.5" : "p-1.5";
    const inputH = compact ? "h-5 text-[10px]" : "h-6 text-xs";
    switch (colKey) {
      case "drag":
        return (
          <td key={colKey} className={`${cellPad} cursor-grab`}>
            <GripVertical className={compact ? "w-2.5 h-2.5 text-muted-foreground" : "w-3 h-3 text-muted-foreground"} />
          </td>
        );
      case "index":
        return (
          <td key={colKey} className={`${cellPad} text-muted-foreground`}>
            {dIdx + 1}
          </td>
        );
      case "vekalet":
        return (
          <td key={colKey} className={cellPad} data-group-cell={`${groupIdx}-${dIdx}-vekalet`}>
            <Input
              className={`${inputH} border-0 bg-transparent p-0 focus:bg-primary/5 focus:ring-1 focus:ring-primary/30 rounded transition-colors`}
              value={d.vekalet || ""}
              onChange={(e) => updateGroupDonation(groupIdx, dIdx, "vekalet", e.target.value)}
              onKeyDown={(e) => handleGroupCellTab(e, groupIdx, dIdx, "vekalet")}
              placeholder="—"
            />
          </td>
        );
      case "description":
        return (
          <td key={colKey} className={cellPad} data-group-cell={`${groupIdx}-${dIdx}-description`}>
            <Input
              className={`${inputH} border-0 bg-transparent p-0 focus:bg-primary/5 focus:ring-1 focus:ring-primary/30 rounded transition-colors`}
              value={d.description}
              onChange={(e) => updateGroupDonation(groupIdx, dIdx, "description", e.target.value)}
              onKeyDown={(e) => handleGroupCellTab(e, groupIdx, dIdx, "description")}
              placeholder="—"
            />
          </td>
        );
      case "name":
        return (
          <td key={colKey} className={cellPad} data-group-cell={`${groupIdx}-${dIdx}-name`}>
            <Input
              className={`${inputH} border-0 bg-transparent p-0 focus:bg-primary/5 focus:ring-1 focus:ring-primary/30 rounded transition-colors`}
              value={d.name}
              onChange={(e) => updateGroupDonation(groupIdx, dIdx, "name", e.target.value)}
              onKeyDown={(e) => handleGroupCellTab(e, groupIdx, dIdx, "name")}
              placeholder="—"
            />
          </td>
        );
      case "donationType":
        return (
          <td key={colKey} className={cellPad} data-group-cell={`${groupIdx}-${dIdx}-donationType`}>
            <Input
              className={`${inputH} border-0 bg-transparent p-0 focus:bg-primary/5 focus:ring-1 focus:ring-primary/30 rounded transition-colors`}
              value={d.donationType}
              onChange={(e) => updateGroupDonation(groupIdx, dIdx, "donationType", e.target.value)}
              onKeyDown={(e) => handleGroupCellTab(e, groupIdx, dIdx, "donationType")}
              placeholder="—"
            />
          </td>
        );
      case "notes":
        return (
          <td key={colKey} className={cellPad} data-group-cell={`${groupIdx}-${dIdx}-notes`}>
            <div className="flex flex-col gap-0.5">
              <Input
                className={`${inputH} border-0 bg-transparent p-0 focus:bg-primary/5 focus:ring-1 focus:ring-primary/30 rounded transition-colors`}
                value={d.notes || ""}
                onChange={(e) => updateGroupDonation(groupIdx, dIdx, "notes", e.target.value)}
                onKeyDown={(e) => handleGroupCellTab(e, groupIdx, dIdx, "notes")}
                placeholder="—"
              />
              {((d.aiCategories && d.aiCategories.length > 0) || (d.aiWarnings && d.aiWarnings.trim())) && (
                <div className="flex gap-0.5 flex-wrap">
                  {(d.aiCategories || []).map(cat => (
                    <span key={cat} className="px-1 py-0 rounded-full text-[8px] font-medium bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400 border border-violet-200/50 dark:border-violet-800/50 opacity-70">
                      {cat}
                    </span>
                  ))}
                  {d.aiWarnings && d.aiWarnings.trim() && (
                    <span className="px-1 py-0 rounded-full text-[8px] font-medium bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-800/50 opacity-70 flex items-center gap-0.5" title={d.aiWarnings}>
                      ⚠
                    </span>
                  )}
                </div>
              )}
            </div>
          </td>
        );
      case "actions":
        return (
          <td key={colKey} className={cellPad}>
            <div className="flex gap-0.5">
              {d.name.trim() && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${compact ? "h-4 w-4" : "h-5 w-5"} p-0 ${
                      basketItemIds.has(d.id) ? "bg-emerald-200 dark:bg-emerald-800" : ""
                    }`}
                    onClick={() => basketItemIds.has(d.id) ? removeFromBasket(d.id) : addToBasket(groupIdx, dIdx)}
                    title={basketItemIds.has(d.id) ? "Sepetten Çıkar" : "Keseye Koy"}
                  >
                    <ShoppingBag className={compact ? "w-2.5 h-2.5 text-emerald-600" : "w-3 h-3 text-emerald-600"} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${compact ? "h-4 w-4" : "h-5 w-5"} p-0 ${
                      swapSelection?.groupIdx === groupIdx && swapSelection?.donationIdx === dIdx
                        ? "bg-purple-200 dark:bg-purple-800"
                        : ""
                    }`}
                    onClick={() => handleSwapSelect(groupIdx, dIdx)}
                    title="Takas için seç"
                  >
                    <ArrowLeftRight className={compact ? "w-2.5 h-2.5 text-purple-500" : "w-3 h-3 text-purple-500"} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${compact ? "h-4 w-4" : "h-5 w-5"} p-0`}
                    onClick={() => enhancedRemoveFromGroup(groupIdx, dIdx)}
                  >
                    <Trash2 className={compact ? "w-2.5 h-2.5 text-destructive" : "w-3 h-3 text-destructive"} />
                  </Button>
                </>
              )}
            </div>
          </td>
        );
      default:
        return null;
    }
  };

  const columnHeaderLabel = (key: ColumnKey): string => {
    const col = ALL_GROUP_COLUMNS.find(c => c.key === key);
    return col?.label || "";
  };

  const columnHeaderWidth = (key: ColumnKey): string => {
    switch (key) {
      case "drag": return "w-6";
      case "index": return "w-6";
      case "vekalet": return "w-16";
      case "donationType": return "w-16";
      case "notes": return "w-20";
      case "actions": return "w-8";
      default: return "";
    }
  };

  return (
    <div ref={scrollContainerRef} className={`min-h-screen bg-background ${fullscreenMode ? "fixed inset-0 z-50 overflow-auto" : ""}`}>
      <div className={`mx-auto p-4 ${fullscreenMode ? "max-w-full" : "max-w-7xl"} ${basketItems.length > 0 ? "pb-24" : ""}`}>
        {!fullscreenMode && (
        <div className="mb-4">
          <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-2 flex-wrap">
            <button onClick={() => setLocation("/")} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Home className="w-3 h-3" />
              <span>Ana Sayfa</span>
            </button>
            {kesim.projectId && projectName && (
              <>
                <ChevronRight className="w-3 h-3" />
                <button onClick={() => setLocation(`/proje/${kesim.projectId}`)} className="hover:text-foreground transition-colors truncate max-w-[120px]">
                  {projectName}
                </button>
              </>
            )}
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium truncate max-w-[200px]">{kesim.name}</span>
          </nav>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">{kesim.name}</h1>
              <p className="text-xs md:text-sm text-muted-foreground truncate">
                {kesim.donations.length} bağışçı • {totalShares} hisse • {requiredAnimals} hayvan
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    let token = kesim.trackingToken;
                    if (!token) {
                      token = await generateTrackingToken(kesim.id);
                      setKesim(prev => prev ? { ...prev, trackingToken: token } : prev);
                    }
                    const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/takip/${token}`;
                    await navigator.clipboard.writeText(url);
                    toast({ title: "Takip linki kopyalandı", description: "Link panoya kopyalandı" });
                  } catch {
                    toast({ title: "Hata", description: "Link oluşturulamadı", variant: "destructive" });
                  }
                }}
              >
                <Link2 className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Takip Linki</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    let token = kesim.trackingToken;
                    if (!token) {
                      token = await generateTrackingToken(kesim.id);
                      setKesim(prev => prev ? { ...prev, trackingToken: token } : prev);
                    }
                    const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/takip/${token}`;
                    setQrUrl(url);
                    setQrModalOpen(true);
                  } catch {
                    toast({ title: "Hata", description: "QR kod oluşturulamadı", variant: "destructive" });
                  }
                }}
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">QR Kod</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  setTrackingNotesOpen(true);
                  setTrackingNotesLoading(true);
                  try {
                    const notes = await fetchKesimAlaniTrackingNotes(kesim.id);
                    setTrackingNotes(notes);
                  } catch {} finally {
                    setTrackingNotesLoading(false);
                  }
                }}
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Saha Notları</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTeamDialogOpen(true)}
              >
                <UserCog className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Ekipler</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  setNotificationLogsOpen(true);
                  setNotificationLogsLoading(true);
                  try {
                    const logs = await fetchNotificationLogs(kesim.id);
                    setNotificationLogs(logs);
                  } catch {
                    toast({ title: "Hata", description: "Bildirim kayıtları yüklenemedi", variant: "destructive" });
                  } finally {
                    setNotificationLogsLoading(false);
                  }
                }}
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Bildirimler</span>
              </Button>
              <Button
                size="sm"
                className="shrink-0"
                onClick={() => saveToApi(kesim)}
                disabled={saveStatus === "saving"}
              >
                {saveStatus === "saving" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="hidden sm:inline ml-1">Kaydet</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Kaydediliyor...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Save className="w-3 h-3" />
                  Kaydedildi
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="w-3 h-3" />
                  Kaydetme hatası
                </span>
              )}
              {saveStatus === "idle" && lastSavedTime && (
                <span className="flex items-center gap-1">
                  <Save className="w-3 h-3" />
                  Son kayıt: {lastSavedTime.toLocaleTimeString("tr-TR")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 flex-wrap justify-end">
              <div className="flex items-center gap-0.5 border rounded-md px-0.5">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleUndo} disabled={!history.canUndo} title="Geri Al (Ctrl+Z)">
                  <Undo2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleRedo} disabled={!history.canRedo} title="İleri Al (Ctrl+Y)">
                  <Redo2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setHistoryPanelOpen(!historyPanelOpen)} title="Geçmiş">
                  <History className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hidden sm:flex" onClick={() => setShortcutHelpOpen(true)} title="Klavye Kısayolları (?)">
                <Keyboard className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hidden sm:flex" onClick={toggleFullscreen} title="Tam Ekran (F11)">
                {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={exportDonorsExcel} title="Bağışçı Listesi Excel">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </Button>
              {kesim.animalGroups.length > 0 && (
                <>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={exportGroupsExcel} title="Kesim Kağıdı Excel">
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                    <span className="hidden sm:inline">Excel</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setLocation(`/not-duzenleme/${kesim.id}`)}>
                    <Search className="w-3.5 h-3.5 mr-1" />
                    <span className="hidden sm:inline">Notlar</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setLocation(`/print/${kesim.id}`)}>
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    <span className="hidden sm:inline">Yazdır</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        )}

        {!fullscreenMode && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3 mb-4">
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{kesim.donations.filter(d => !d.excluded).length}</div>
            <div className="text-xs text-muted-foreground">Aktif Bağışçı</div>
          </Card>
          {kesim.donations.filter(d => d.excluded).length > 0 && (
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-destructive">{kesim.donations.filter(d => d.excluded).length}</div>
              <div className="text-xs text-muted-foreground">Hariç Tutulan</div>
            </Card>
          )}
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{totalShares}</div>
            <div className="text-xs text-muted-foreground">Toplam Hisse</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{requiredAnimals}</div>
            <div className="text-xs text-muted-foreground">Gereken Hayvan</div>
            {remainingSlots > 0 && (
              <div className="text-[10px] text-orange-500 mt-0.5">({remainingSlots} boş slot)</div>
            )}
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">
              {kesim.animalGroups.length > 0
                ? kesim.animalGroups.reduce((sum, g) => sum + g.donations.filter(d => d.name.trim() === "").length, 0)
                : 0}
            </div>
            <div className="text-xs text-muted-foreground">Boş Slot</div>
          </Card>
          {kesim.animalGroups.length > 0 && (
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-primary">
                %{Math.round((kesim.animalGroups.reduce((s, g) => s + g.donations.filter(d => d.name.trim() !== "").length, 0) / (kesim.animalGroups.length * 7)) * 100)}
              </div>
              <div className="text-xs text-muted-foreground">Doluluk</div>
            </Card>
          )}
          {kesim.animalGroups.length > 0 && (() => {
            const kesildiCount = kesim.animalGroups.filter(g => g.kesildi).length;
            const lastAt = kesim.animalGroups
              .filter(g => g.kesildiAt)
              .map(g => g.kesildiAt!)
              .sort()
              .pop();
            return (
              <Card className="p-3 text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {kesildiCount}/{kesim.animalGroups.length}
                </div>
                <div className="text-xs text-muted-foreground">Kesildi</div>
                {lastAt && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Son: {new Date(lastAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </Card>
            );
          })()}
          {Object.values(photoCounts).reduce((a, b) => a + b, 0) > 0 && (
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Object.values(photoCounts).reduce((a, b) => a + b, 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                Fotoğraf ({Object.keys(photoCounts).length} grup)
              </div>
            </Card>
          )}
          {ungroupedDonors.length > 0 && (
            <Card
              className={`p-3 text-center cursor-pointer transition-colors ${filterUngrouped ? "ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950" : "hover:bg-muted"}`}
              onClick={() => {
                setFilterUngrouped(!filterUngrouped);
                if (!donorListVisible) setDonorListVisible(true);
              }}
            >
              <div className="text-2xl font-bold text-orange-600">{ungroupedDonors.length}</div>
              <div className="text-xs text-muted-foreground">{ungroupedShareCount} hisse gruplanmamış</div>
            </Card>
          )}
        </div>
        )}

        {!fullscreenMode && (kesim.donations.filter(d => !d.excluded).length > 0 || kesim.animalGroups.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {kesim.donations.filter(d => !d.excluded).length > 0 && (
          <Card className="p-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Hisse Dağılımı</h4>
            <div className="space-y-1">
              {[1, 2, 3, 4, 5, 6, 7].map(sc => {
                const count = shareDistribution[sc] || 0;
                if (count === 0) return null;
                const totalUnique = Object.values(shareDistribution).reduce((s, c) => s + c, 0);
                const pct = totalUnique > 0 ? (count / totalUnique) * 100 : 0;
                return (
                  <div key={sc} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-right text-muted-foreground">{sc} hisse:</span>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-full transition-all"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
          )}

          {kesim.animalGroups.length > 0 && (
          <Card className="p-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Grup Kompozisyonları</h4>
            <div className="space-y-1">
              {Array.from(groupCompositions.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between text-xs px-1 py-0.5 rounded hover:bg-muted">
                    <span className="font-mono text-muted-foreground">{label}</span>
                    <span className="font-medium">{count} grup</span>
                  </div>
                ))}
            </div>
          </Card>
          )}
        </div>
        )}

        {!fullscreenMode && kesim.donations.length > 0 && (
          <div className="mb-4 flex gap-2">
            <Button onClick={handleAutoGroup} className="flex-1" disabled={groupingInProgress}>
              {groupingInProgress ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {groupingProgress
                    ? `Gruplama: ${groupingProgress.current}/${groupingProgress.total} hayvan`
                    : "Gruplama başlıyor..."}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Otomatik Grupla ({requiredAnimals} Hayvan)
                </>
              )}
            </Button>
          </div>
        )}

        {historyPanelOpen && !fullscreenMode && (
          <Card className="mb-4 p-3 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">İşlem Geçmişi</h3>
              <Button variant="ghost" size="sm" onClick={() => setHistoryPanelOpen(false)}>✕</Button>
            </div>
            <div className="space-y-1">
              {history.historyList.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleGoToStep(i)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                    item.isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="font-medium">{item.description}</span>
                  <span className="ml-2 opacity-60">
                    {new Date(item.timestamp).toLocaleTimeString("tr-TR")}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {!fullscreenMode && (
          <div className="flex md:hidden border-b mb-4">
            <button
              className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${mobileTab === "donors" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => startFilterTransition(() => setMobileTab("donors"))}
            >
              Bağışçı Listesi ({kesim.donations.filter(d => !d.excluded).length})
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${mobileTab === "groups" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => startFilterTransition(() => setMobileTab("groups"))}
            >
              Hayvan Grupları ({kesim.animalGroups.length})
            </button>
          </div>
        )}

        <div
          ref={splitContainerRef}
          className="flex gap-0"
          style={{ position: "relative" }}
        >
          {(isMobile || donorListVisible) && !fullscreenMode && <div className={`${isMobile && mobileTab !== "donors" ? "hidden" : ""}`} style={isMobile ? { width: "100%", minWidth: 0 } : { width: `${workspace.prefs.splitRatio}%`, minWidth: 0, flexShrink: 0, paddingRight: "12px" }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold whitespace-nowrap">Bağışçı Listesi</h2>
                {filterUngrouped && (
                  <button
                    onClick={() => setFilterUngrouped(false)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
                  >
                    Gruplanmamış
                    <span className="text-[10px]">✕</span>
                  </button>
                )}
                {removedFromGroupIds.size > 0 && (
                  <button
                    onClick={() => {
                      setShowRemovedFilter(!showRemovedFilter);
                      if (!donorListVisible) setDonorListVisible(true);
                    }}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                      showRemovedFilter
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 ring-1 ring-red-500"
                        : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900"
                    }`}
                  >
                    Gruptan Çıkarılanlar ({removedFromGroupIds.size})
                    {showRemovedFilter && <span className="text-[10px]">✕</span>}
                  </button>
                )}
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    className="h-8 text-sm pl-8 w-32 sm:w-48"
                    placeholder="Ara... (Ctrl+F)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  variant={showAdvancedFilter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                  title="Gelişmiş Filtre"
                >
                  <Filter className="w-4 h-4" />
                  {activeFilterCount > 0 && (
                    <span className="ml-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
                <Dialog open={bulkDialogOpen} onOpenChange={(open) => { if (!open) resetBulkDialog(); else setBulkDialogOpen(true); }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Upload className="w-4 h-4 mr-1" />
                      Toplu Ekle
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                    <DialogHeader>
                      <DialogTitle>
                        {bulkStep === "input" ? "Toplu Bağışçı Ekle" : bulkStep === "review" ? "Yüksek Hisse Sayılı Satırlar" : "Sütun Eşleştirme"}
                      </DialogTitle>
                    </DialogHeader>

                    {bulkStep === "input" && (
                      <div className="space-y-4 pt-4">
                        <div className="flex gap-2">
                          <Button
                            variant={bulkMode === "upload" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBulkMode("upload")}
                            className="flex-1"
                          >
                            <FileSpreadsheet className="w-4 h-4 mr-1" />
                            Excel Yükle
                          </Button>
                          <Button
                            variant={bulkMode === "paste" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBulkMode("paste")}
                            className="flex-1"
                          >
                            <ClipboardPaste className="w-4 h-4 mr-1" />
                            Kopyala Yapıştır
                          </Button>
                        </div>

                        {bulkMode === "upload" && (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Excel dosyanızı (.xlsx, .xls) seçin. İlk sayfa okunacaktır.
                            </p>
                            <div
                              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                              <p className="text-sm font-medium">Excel dosyası seçmek için tıklayın</p>
                              <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv desteklenir</p>
                            </div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              className="hidden"
                              onChange={handleFileUpload}
                            />
                          </div>
                        )}

                        {bulkMode === "paste" && (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Excel'den kopyaladığınız verileri aşağıya yapıştırın. Bir sonraki adımda hangi sütunun ne olduğunu belirleyeceksiniz.
                            </p>
                            <textarea
                              className="w-full h-48 p-3 border rounded-md bg-background text-foreground font-mono text-sm resize-none"
                              placeholder={"Ali Yılmaz\tAnkara\tAdak\t1\nMehmet Kaya\tİstanbul\tKurban\t3\nAyşe Demir\tBursa\tAkika\t2"}
                              value={pasteText}
                              onChange={(e) => setPasteText(e.target.value)}
                            />
                            <Button onClick={handlePasteData} className="w-full" disabled={!pasteText.trim()}>
                              Devam Et
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {bulkStep === "review" && (() => {
                      const groupKeys = [...new Set(bulkReviewRows.map(r => r.groupKey))];
                      const selectedGroupCount = groupKeys.filter(gk => bulkReviewRows.filter(r => r.groupKey === gk).every(r => r.selected)).length;
                      return (
                      <div className="flex flex-col min-h-0 flex-1 pt-4">
                        <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg mb-4 flex-shrink-0">
                          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                          <p className="text-sm">
                            Aşağıdaki vekaleti verenlerin toplam hisse sayısı 50'den fazla. Dahil etmek istemediklerinizi işaretli bırakın.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBulkReviewRows(prev => prev.map(r => ({ ...r, selected: true })))}
                          >
                            Tümünü Seç
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBulkReviewRows(prev => prev.map(r => ({ ...r, selected: false })))}
                          >
                            Tümünü Kaldır
                          </Button>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {selectedGroupCount} / {groupKeys.length} grup dahil edilmeyecek
                          </span>
                        </div>

                        <div className="border rounded-lg overflow-hidden min-h-0 flex-1">
                          <div className="overflow-auto max-h-full divide-y">
                            {groupKeys.map((gk) => {
                              const groupRows = bulkReviewRows.filter(r => r.groupKey === gk);
                              const groupTotal = groupRows[0]?.groupTotal ?? 0;
                              const descColIdx = columnMappings.indexOf("description");
                              const displayName = descColIdx >= 0 ? String(groupRows[0]?.row[descColIdx] ?? "").trim() : gk;
                              const allSelected = groupRows.every(r => r.selected);
                              const isExpanded = bulkReviewExpanded.has(gk);
                              return (
                                <div key={gk}>
                                  <div className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${allSelected ? "bg-red-500/5" : ""}`}>
                                    <input
                                      type="checkbox"
                                      checked={allSelected}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        const newVal = !allSelected;
                                        setBulkReviewRows(prev => prev.map(r => r.groupKey === gk ? { ...r, selected: newVal } : r));
                                      }}
                                      className="rounded flex-shrink-0"
                                    />
                                    <button
                                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                      onClick={() => {
                                        setBulkReviewExpanded(prev => {
                                          const next = new Set(prev);
                                          if (next.has(gk)) next.delete(gk); else next.add(gk);
                                          return next;
                                        });
                                      }}
                                    >
                                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                                      <span className="text-sm font-medium truncate flex-1">{displayName}</span>
                                    </button>
                                    <span className={`text-xs font-mono font-bold flex-shrink-0 ${allSelected ? "text-red-600" : "text-muted-foreground"}`}>
                                      {groupTotal} hisse
                                    </span>
                                    <span className="text-xs text-muted-foreground flex-shrink-0">
                                      ({groupRows.length} satır)
                                    </span>
                                  </div>
                                  {isExpanded && (
                                    <div className="bg-muted/20 border-t">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b bg-muted/30">
                                            <th className="p-1.5 pl-10 w-10 text-center text-xs font-medium text-muted-foreground">Dahil</th>
                                            <th className="p-1.5 text-left text-xs font-medium text-muted-foreground">Adına Kesilen</th>
                                            <th className="p-1.5 text-left text-xs font-medium text-muted-foreground">Cinsi</th>
                                            <th className="p-1.5 text-right text-xs font-medium text-muted-foreground">Hisse</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {groupRows.map((item) => {
                                            const globalIdx = bulkReviewRows.indexOf(item);
                                            const nameColIdx = columnMappings.indexOf("name");
                                            const typeColIdx = columnMappings.indexOf("donationType");
                                            const name = nameColIdx >= 0 ? String(item.row[nameColIdx] ?? "").trim() : "";
                                            const dtype = typeColIdx >= 0 ? String(item.row[typeColIdx] ?? "").trim() : "";
                                            return (
                                              <tr key={item.idx} className={`border-b last:border-0 ${item.selected ? "bg-red-500/5 text-muted-foreground line-through" : ""}`}>
                                                <td className="p-1.5 pl-10 text-center">
                                                  <input
                                                    type="checkbox"
                                                    checked={!item.selected}
                                                    onChange={() => {
                                                      setBulkReviewRows(prev => prev.map((r, ri) => ri === globalIdx ? { ...r, selected: !r.selected } : r));
                                                    }}
                                                    className="rounded"
                                                  />
                                                </td>
                                                <td className="p-1.5 text-sm">{name || "—"}</td>
                                                <td className="p-1.5 text-sm">{dtype || "—"}</td>
                                                <td className="p-1.5 text-sm text-right font-mono">{item.rawShareCount}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-4 flex-shrink-0">
                          <Button variant="outline" onClick={() => setBulkStep("mapping")} className="flex-1">
                            Geri
                          </Button>
                          <Button onClick={applyBulkImport} className="flex-1">
                            {bulkReviewRows.filter(r => r.selected).length > 0
                              ? `${bulkReviewRows.filter(r => r.selected).length} Satırı Çıkar ve Devam Et`
                              : "Tümünü Dahil Et ve Devam Et"}
                          </Button>
                        </div>
                      </div>
                      );
                    })()}

                    {bulkStep === "mapping" && (
                      <div className="flex flex-col min-h-0 flex-1 pt-4">
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4 flex-shrink-0">
                          <Settings2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">
                            Her sütunun hangi bilgiye karşılık geldiğini aşağıdan seçin. Kullanmak istemediğiniz sütunları "Atla" olarak ayarlayın.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                          <input
                            type="checkbox"
                            id="hasHeader"
                            checked={hasHeaderRow}
                            onChange={(e) => setHasHeaderRow(e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor="hasHeader" className="text-sm font-medium">
                            İlk satır başlık satırıdır (veri olarak eklenmez)
                          </label>
                        </div>

                        <div className="border rounded-lg overflow-hidden min-h-0 flex-1">
                          <div className="overflow-auto max-h-full">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 z-10">
                                <tr className="bg-primary/10 border-b">
                                  {columnMappings.map((mapping, colIdx) => (
                                    <th key={colIdx} className="p-2 min-w-[140px]">
                                      <Select
                                        value={mapping}
                                        onValueChange={(v) => {
                                          const newMappings = [...columnMappings];
                                          newMappings[colIdx] = v as ColumnMapping;
                                          setColumnMappings(newMappings);
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {COLUMN_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                              {opt.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </th>
                                  ))}
                                </tr>
                                {headerRow && (
                                  <tr className="bg-muted/30 border-b">
                                    {headerRow.map((cell, idx) => (
                                      <td key={idx} className="p-2 text-xs text-muted-foreground font-medium">
                                        {cell || "—"}
                                      </td>
                                    ))}
                                  </tr>
                                )}
                              </thead>
                              <tbody>
                                {displayPreviewRows.slice(0, 5).map((row, rIdx) => (
                                  <tr key={rIdx} className="border-b">
                                    {columnMappings.map((mapping, cIdx) => (
                                      <td
                                        key={cIdx}
                                        className={`p-2 text-xs ${mapping === "skip" ? "text-muted-foreground/40 line-through" : ""}`}
                                      >
                                        {row[cIdx] || "—"}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {displayPreviewRows.length > 5 && (
                            <div className="p-2 text-xs text-muted-foreground text-center bg-muted/20">
                              ... ve {displayPreviewRows.length - 5} satır daha (toplam {displayPreviewRows.length} satır)
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 pt-4 flex-shrink-0">
                          <Button variant="outline" onClick={() => setBulkStep("input")} className="flex-1">
                            Geri
                          </Button>
                          <Button onClick={applyBulkImport} className="flex-1">
                            {displayPreviewRows.length} Bağışçı Ekle
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog open={findDeleteOpen} onOpenChange={(open) => { setFindDeleteOpen(open); if (!open) { setFindDeleteValue(""); setFindDeleteConfirm(false); } }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" title="Sütuna Göre Bul ve Sil">
                      <SearchX className="w-4 h-4 mr-1" />
                      Bul ve Sil
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Sütuna Göre Bul ve Sil</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Sütun Seç</label>
                        <Select value={findDeleteColumn} onValueChange={(v: "name" | "description" | "donationType" | "vekalet" | "notes") => { setFindDeleteColumn(v); setFindDeleteValue(""); setFindDeleteConfirm(false); }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="description">Vekaleti Veren</SelectItem>
                            <SelectItem value="name">Adına Kesilen</SelectItem>
                            <SelectItem value="donationType">Cinsi</SelectItem>
                            <SelectItem value="vekalet">Vekalet No</SelectItem>
                            <SelectItem value="notes">Notlar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Aranacak Değer</label>
                        <Input
                          placeholder={`${findDeleteColumnLabel[findDeleteColumn]} içinde ara...`}
                          value={findDeleteValue}
                          onChange={(e) => { setFindDeleteValue(e.target.value); setFindDeleteConfirm(false); }}
                        />
                      </div>
                      {findDeleteValue.trim() && (() => {
                        const matches = getFindDeleteMatches();
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {matches.length > 0
                                  ? `${matches.length} kayıt bulundu`
                                  : "Eşleşen kayıt bulunamadı"}
                              </span>
                            </div>
                            {matches.length > 0 && (
                              <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-muted/50 border-b">
                                      <th className="p-2 text-left font-medium">Vekaleti Veren</th>
                                      <th className="p-2 text-left font-medium">Adına Kesilen</th>
                                      <th className="p-2 text-left font-medium">Cinsi</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {matches.slice(0, 50).map((d) => (
                                      <tr key={d.id} className="border-b last:border-0">
                                        <td className="p-2">{d.description || "—"}</td>
                                        <td className="p-2">{d.name || "—"}</td>
                                        <td className="p-2">{d.donationType || "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {matches.length > 50 && (
                                  <div className="p-2 text-xs text-muted-foreground text-center bg-muted/20">
                                    ... ve {matches.length - 50} kayıt daha
                                  </div>
                                )}
                              </div>
                            )}
                            {matches.length > 0 && !findDeleteConfirm && (
                              <Button
                                variant="destructive"
                                className="w-full"
                                onClick={() => setFindDeleteConfirm(true)}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                {matches.length} Kaydı Sil
                              </Button>
                            )}
                            {matches.length > 0 && findDeleteConfirm && (
                              <div className="space-y-2 border border-destructive/50 rounded-lg p-3 bg-destructive/5">
                                <p className="text-sm font-medium text-destructive">
                                  {matches.length} bağışçı kalıcı olarak silinecek. Emin misiniz?
                                </p>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setFindDeleteConfirm(false)}>
                                    İptal
                                  </Button>
                                  <Button variant="destructive" size="sm" className="flex-1" onClick={executeFindDelete}>
                                    Evet, Sil
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" size="sm" onClick={openTrash} title="Bağış Çöp Kutusu">
                  <Trash2 className="w-4 h-4 mr-1" />
                  Çöp Kutusu
                </Button>

                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Tekli Ekle
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Yeni Bağışçı Ekle</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-4">
                      <Input
                        placeholder="Vekalet No"
                        value={newDonation.vekalet}
                        onChange={(e) =>
                          setNewDonation({ ...newDonation, vekalet: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Vekaleti Veren"
                        value={newDonation.description}
                        onChange={(e) =>
                          setNewDonation({
                            ...newDonation,
                            description: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Adına Kesilen"
                        value={newDonation.name}
                        onChange={(e) =>
                          setNewDonation({ ...newDonation, name: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Cinsi (Vacip, Akika, Adak...)"
                        value={newDonation.donationType}
                        onChange={(e) =>
                          setNewDonation({
                            ...newDonation,
                            donationType: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Notlar"
                        value={newDonation.notes}
                        onChange={(e) =>
                          setNewDonation({
                            ...newDonation,
                            notes: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Telefon (opsiyonel)"
                        value={newDonation.phone}
                        onChange={(e) =>
                          setNewDonation({
                            ...newDonation,
                            phone: e.target.value,
                          })
                        }
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Hisse:</label>
                        <Select
                          value={String(newDonation.shareCount)}
                          onValueChange={(v) =>
                            setNewDonation({
                              ...newDonation,
                              shareCount: parseInt(v),
                            })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={addDonation} className="w-full">
                        Ekle
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {showAdvancedFilter && (
              <Card className="mb-3 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-1">
                    <SlidersHorizontal className="w-4 h-4" />
                    Gelişmiş Filtre
                  </span>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAdvancedFilters}>
                      <X className="w-3 h-3 mr-1" />
                      Temizle
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Cinsi</label>
                    <Select value={filterCinsi} onValueChange={setFilterCinsi}>
                      <SelectTrigger className="h-7 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tümü</SelectItem>
                        {uniqueDonationTypes.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Hisse (min)</label>
                    <Select value={String(filterHisseMin)} onValueChange={v => setFilterHisseMin(parseInt(v))}>
                      <SelectTrigger className="h-7 text-xs w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">-</SelectItem>
                        {[1,2,3,4,5,6,7].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Hisse (max)</label>
                    <Select value={String(filterHisseMax)} onValueChange={v => setFilterHisseMax(parseInt(v))}>
                      <SelectTrigger className="h-7 text-xs w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">-</SelectItem>
                        {[1,2,3,4,5,6,7].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Durum</label>
                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "active" | "excluded")}>
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tümü</SelectItem>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="excluded">Hariç</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {globalTags.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Etiketler</label>
                      <div className="flex gap-1 flex-wrap">
                        {globalTags.map(tag => {
                          const isActive = filterTags.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${isActive ? "ring-2 ring-offset-1 ring-primary text-white" : "opacity-60 hover:opacity-100 text-white"}`}
                              style={{ backgroundColor: tag.color }}
                              onClick={() => setFilterTags(
                                isActive ? filterTags.filter(t => t !== tag.id) : [...filterTags, tag.id]
                              )}
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {availableAiCategories.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Brain className="w-3 h-3" /> AI Kategorileri
                      </label>
                      <div className="flex gap-1 flex-wrap">
                        {availableAiCategories.map(cat => {
                          const isActive = filterAiCategories.includes(cat);
                          return (
                            <button
                              key={cat}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${isActive ? "bg-violet-600 text-white border-violet-600 ring-2 ring-offset-1 ring-violet-400" : "bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 opacity-70 hover:opacity-100"}`}
                              onClick={() => setFilterAiCategories(
                                isActive ? filterAiCategories.filter(c => c !== cat) : [...filterAiCategories, cat]
                              )}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer mt-1">
                        <input
                          type="checkbox"
                          checked={filterAiWarnings}
                          onChange={(e) => setFilterAiWarnings(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> Uyarılı bağışçılar
                        </span>
                      </label>
                    </div>
                  )}
                </div>
                {(activeFilterCount > 0 || searchQuery.trim() || filterUngrouped || showRemovedFilter) && (
                  <div className="text-xs text-muted-foreground">
                    {filteredDonations.length} / {kesim.donations.length} bağışçı gösteriliyor
                  </div>
                )}
              </Card>
            )}

            {!showAdvancedFilter && (searchQuery.trim() || filterUngrouped || showRemovedFilter) && (
              <div className="text-xs text-muted-foreground mb-2 px-1">
                {filteredDonations.length} / {kesim.donations.length} bağışçı gösteriliyor
              </div>
            )}

            {selectedIds.size > 0 && (
              <div className="mb-3 flex items-center gap-3 p-2 bg-primary/10 rounded-lg flex-wrap">
                <span className="text-sm font-medium">
                  {selectedIds.size} satır seçildi
                </span>
                <Button variant="destructive" size="sm" onClick={deleteSelected}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  Sil
                </Button>
                <Button variant="outline" size="sm" onClick={addSelectedToBasket}>
                  <ShoppingBag className="w-3 h-3 mr-1" />
                  Sepete Ekle
                </Button>
                <Button variant="outline" size="sm" onClick={handleAutoGroupSelected} disabled={groupingInProgress}>
                  <Wand2 className="w-3 h-3 mr-1" />
                  Seçilenleri Grupla
                </Button>
                <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings2 className="w-3 h-3 mr-1" />
                      Toplu Düzenle
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{selectedIds.size} Bağışçıyı Toplu Düzenle</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <Select value={bulkEditField} onValueChange={(v: "donationType" | "shareCount" | "notes" | "vekalet") => setBulkEditField(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="donationType">Cinsi</SelectItem>
                          <SelectItem value="shareCount">Hisse Sayısı</SelectItem>
                          <SelectItem value="vekalet">Vekalet No</SelectItem>
                          <SelectItem value="notes">Notlar</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder={bulkEditField === "shareCount" ? "1-7" : "Yeni değer"}
                        value={bulkEditValue}
                        onChange={(e) => setBulkEditValue(e.target.value)}
                        type={bulkEditField === "shareCount" ? "number" : "text"}
                      />
                      <Button onClick={applyBulkEdit} className="w-full">
                        Uygula
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Seçimi Kaldır
                </Button>
              </div>
            )}

            <Card className="overflow-hidden">
              {filteredDonations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  {searchQuery.trim() ? `"${searchQuery}" için sonuç bulunamadı` : filterUngrouped ? "Tüm bağışçılar gruplara atanmış" : 'Henüz bağışçı eklenmedi. "Toplu Ekle" ile Excel yükleyin veya yapıştırın.'}
                </div>
              ) : (
                <TableVirtuoso
                  style={{ height: `min(calc(100vh - 150px), ${filteredDonations.length * 45 + 50}px)`, minHeight: 200 }}
                  data={filteredDonations}
                  overscan={30}
                  itemKey={(_idx, d) => d.id}
                  components={virtuosoTableComponents}
                  fixedHeaderContent={() => (
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 w-8">
                        <input
                          type="checkbox"
                          checked={kesim.donations.length > 0 && selectedIds.size === kesim.donations.length}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </th>
                      <th className="p-2 text-left w-8">#</th>
                      <th className="p-2 text-left w-20">Vekalet</th>
                      <th
                        className="p-2 text-left cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("description")}
                      >
                        <span className="flex items-center gap-1">
                          Vekaleti Veren
                          {sortField === "description" && (
                            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortField !== "description" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                      <th
                        className="p-2 text-left cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("name")}
                      >
                        <span className="flex items-center gap-1">
                          Adına Kesilen
                          {sortField === "name" && (
                            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortField !== "name" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                      <th
                        className="p-2 text-left cursor-pointer hover:bg-muted w-20"
                        onClick={() => handleSort("donationType")}
                      >
                        <span className="flex items-center gap-1">
                          Cinsi
                          {sortField === "donationType" && (
                            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortField !== "donationType" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                      <th className="p-2 text-left w-24">Notlar</th>
                      <th
                        className="p-2 text-center cursor-pointer hover:bg-muted w-16"
                        onClick={() => handleSort("shareCount")}
                      >
                        <span className="flex items-center gap-1 justify-center">
                          Hisse
                          {sortField === "shareCount" && (
                            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortField !== "shareCount" && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  )}
                  itemContent={(idx, d) => {
                    const descCount = d.excluded ? 0 : (descCountMap.get(d.description.trim().toLowerCase()) || 1);
                    const effectiveShare = descCount > 1 ? descCount : d.shareCount;
                    return (<>
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(d.id)}
                              onChange={() => toggleSelect(d.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="p-2 text-muted-foreground">{idx + 1}</td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "vekalet" ? (
                              <Input
                                className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5"
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                onBlur={() => commitEdit()}
                                onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "vekalet")}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                                onClick={() => startEditing(d.id, "vekalet")}
                              >
                                {d.vekalet || "—"}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "description" ? (
                              <Input
                                className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5"
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                onBlur={() => commitEdit()}
                                onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "description")}
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-center gap-1">
                                <span
                                  className="cursor-text flex-1 block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                                  onClick={() => startEditing(d.id, "description")}
                                >
                                  {d.description || "—"}
                                </span>
                                {d.description && descCount > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 shrink-0"
                                    title="Bu kişinin tüm kayıtlarını düzenle"
                                    onClick={() => setPersonEditDesc(d.description)}
                                  >
                                    <UserCog className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "name" ? (
                              <Input
                                className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5"
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                onBlur={() => commitEdit()}
                                onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "name")}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                                onClick={() => startEditing(d.id, "name")}
                              >
                                {d.name || "—"}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "donationType" ? (
                              <Input
                                className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5"
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                onBlur={() => commitEdit()}
                                onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "donationType")}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                                onClick={() => startEditing(d.id, "donationType")}
                              >
                                {d.donationType || "—"}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "notes" ? (
                              <Input
                                className="h-7 text-sm ring-2 ring-primary/40 bg-primary/5"
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                onBlur={() => commitEdit()}
                                onKeyDown={(e) => handleDonorCellKeyDown(e, d.id, "notes")}
                                autoFocus
                              />
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <span
                                  className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                                  onClick={() => startEditing(d.id, "notes")}
                                >
                                  {d.notes || "—"}
                                </span>
                                {((d.aiCategories && d.aiCategories.length > 0) || (d.aiWarnings && d.aiWarnings.trim())) && (
                                  <div className="flex gap-0.5 flex-wrap px-1">
                                    {(d.aiCategories || []).map(cat => (
                                      <span key={cat} className="px-1.5 py-0 rounded-full text-[9px] font-medium bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                                        {cat}
                                      </span>
                                    ))}
                                    {d.aiWarnings && d.aiWarnings.trim() && (
                                      <span className="px-1.5 py-0 rounded-full text-[9px] font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-0.5" title={d.aiWarnings}>
                                        <AlertTriangle className="w-2.5 h-2.5" /> uyarı
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {descCount > 1 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                                {effectiveShare}
                              </span>
                            ) : (
                              <Select
                                value={String(d.shareCount)}
                                onValueChange={(v) =>
                                  updateDonationField(
                                    d.id,
                                    "shareCount",
                                    parseInt(v)
                                  )
                                }
                              >
                                <SelectTrigger className="h-7 w-16 text-sm mx-auto">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                      {n}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1 flex-wrap">
                              {(d.tags || []).length > 0 && globalTags.length > 0 && (
                                <div className="flex gap-0.5 flex-wrap mr-1">
                                  {(d.tags || []).map(tagId => {
                                    const tag = globalTags.find(t => t.id === tagId);
                                    if (!tag) return null;
                                    return (
                                      <span
                                        key={tagId}
                                        className="px-1.5 py-0 rounded-full text-[9px] font-medium text-white leading-4"
                                        style={{ backgroundColor: tag.color }}
                                      >
                                        {tag.name}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              {globalTags.length > 0 && (
                                <Popover open={tagPopoverDonorId === d.id} onOpenChange={(open) => setTagPopoverDonorId(open ? d.id : null)}>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Etiket ata">
                                      <Tag className="w-3 h-3 text-muted-foreground" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-48 p-2" align="end">
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground mb-2">Etiket Ata</p>
                                      {globalTags.map(tag => {
                                        const isActive = (d.tags || []).includes(tag.id);
                                        return (
                                          <button
                                            key={tag.id}
                                            className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted transition-colors ${isActive ? "bg-muted" : ""}`}
                                            onClick={() => toggleDonationTag(d.id, tag.id)}
                                          >
                                            <span
                                              className="w-3 h-3 rounded-full flex-shrink-0"
                                              style={{ backgroundColor: tag.color }}
                                            />
                                            <span className="flex-1 text-left">{tag.name}</span>
                                            {isActive && <span className="text-primary">✓</span>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                              {!d.excluded && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-7 w-7 p-0 ${basketItemIds.has(d.id) ? "bg-emerald-100 dark:bg-emerald-900" : ""}`}
                                  title={basketItemIds.has(d.id) ? "Sepetten Çıkar" : "Sepete Ekle"}
                                  onClick={() => basketItemIds.has(d.id) ? removeFromBasket(d.id) : addDonorToBasket(d.id)}
                                >
                                  <ShoppingBag className={`w-3 h-3 ${basketItemIds.has(d.id) ? "text-emerald-600" : "text-muted-foreground"}`} />
                                </Button>
                              )}
                              {!d.excluded && !groupedDonorIds.has(d.id) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  title="Akıllı Yerleştir"
                                  onClick={() => setSmartPlacePopover(d.id)}
                                >
                                  <Wand2 className="w-3 h-3 text-primary" />
                                </Button>
                              )}
                              {(effectiveShareMap.get(d.id) || d.shareCount) > 7 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  title="Hisse Böl"
                                  onClick={() => setSplitShareDialog({ donationId: d.id, totalShares: effectiveShareMap.get(d.id) || d.shareCount })}
                                >
                                  <Scissors className="w-3 h-3 text-amber-600" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title={d.excluded ? "Dahil et" : "Hariç tut"}
                                onClick={() => updateDonationField(d.id, "excluded", !d.excluded)}
                              >
                                {d.excluded ? <Eye className="w-3 h-3 text-green-600" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => deleteDonation(d.id)}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </td>
                    </>);
                  }}
                />
              )}
            </Card>

          </div>}

          {donorListVisible && !fullscreenMode && !isMobile && (
            <div
              className="w-2 cursor-col-resize flex-shrink-0 group relative"
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingSplit(true);
              }}
            >
              <div className={`absolute inset-y-0 left-0 right-0 rounded transition-colors ${isDraggingSplit ? "bg-primary" : "bg-border group-hover:bg-primary/50"}`} />
            </div>
          )}

          <div className={`${isMobile && mobileTab !== "groups" ? "hidden" : ""}`} style={{ flex: 1, minWidth: 0 }}>
            <div ref={groupsHeaderRef} className="flex items-center justify-between mb-4 flex-wrap gap-2 sticky top-0 z-20 bg-background py-2 -mt-2 border-b border-transparent" style={{ backdropFilter: "blur(8px)" }}>
              <div className="flex items-center gap-2 flex-wrap">
                {!fullscreenMode && !isMobile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => startFilterTransition(() => setDonorListVisible(!donorListVisible))}
                    title={donorListVisible ? "Bağışçı Listesini Gizle" : "Bağışçı Listesini Göster"}
                  >
                    {donorListVisible ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                  </Button>
                )}
                {kesim.animalGroups.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setMinimapOpen(!minimapOpen)}
                    title="Mini Harita"
                  >
                    <MapIcon className="w-4 h-4" />
                  </Button>
                )}
                <h2 className="text-lg font-semibold">
                  Hayvan Grupları
                  {kesim.animalGroups.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({colorTagFilter === "all" && !showOnlyIncomplete
                        ? kesim.animalGroups.length
                        : kesim.animalGroups.filter(g => {
                            if (colorTagFilter !== "all" && (g.colorTag || "") !== colorTagFilter) return false;
                            if (showOnlyIncomplete && g.donations.filter(d => d.name.trim() !== "").length >= 7) return false;
                            return true;
                          }).length
                      }/{kesim.animalGroups.length} hayvan)
                    </span>
                  )}
                </h2>
                <Button variant="outline" size="sm" onClick={addEmptyGroup} title="Boş Hayvan Ekle">
                  <Plus className="w-4 h-4 mr-1" />
                  Boş Hayvan
                </Button>
                {kesim.animalGroups.length > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 border rounded-md px-1">
                      {([1, 2, 3] as const).map(n => (
                        <Button
                          key={n}
                          variant={workspace.prefs.columnCount === n ? "default" : "ghost"}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => workspace.setColumnCount(n)}
                          title={`${n} Sütun`}
                        >
                          {n === 1 ? <Columns className="w-3.5 h-3.5" /> : n === 2 ? <Columns3 className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                        </Button>
                      ))}
                    </div>

                    <Button
                      variant={workspace.prefs.compactMode ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => workspace.setCompactMode(!workspace.prefs.compactMode)}
                      title="Kompakt Mod"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant={fullscreenMode ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setFullscreenMode(!fullscreenMode)}
                      title={fullscreenMode ? "Tam Ekrandan Çık (ESC)" : "Tam Ekran"}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </Button>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2" title="Sütun Ayarları">
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-3" align="start">
                        <p className="text-xs font-semibold mb-2">Görünür Sütunlar</p>
                        <div className="space-y-1">
                          {workspace.prefs.columnOrder.map(key => {
                            const col = ALL_GROUP_COLUMNS.find(c => c.key === key);
                            if (!col) return null;
                            const visible = !workspace.prefs.hiddenColumns.includes(key);
                            return (
                              <div
                                key={key}
                                className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted cursor-grab text-sm"
                                draggable
                                onDragStart={() => handleColumnDragStart(key)}
                                onDragOver={(e) => handleColumnDragOver(e, key)}
                                onDrop={() => handleColumnDrop(key)}
                                onDragEnd={handleColumnDragEnd}
                              >
                                <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                <button
                                  className="flex items-center gap-2 flex-1 text-left"
                                  onClick={() => workspace.toggleColumn(key)}
                                  disabled={col.alwaysVisible}
                                >
                                  {col.alwaysVisible ? (
                                    <Lock className="w-3 h-3 text-muted-foreground" />
                                  ) : visible ? (
                                    <Eye className="w-3 h-3 text-primary" />
                                  ) : (
                                    <EyeOff className="w-3 h-3 text-muted-foreground" />
                                  )}
                                  <span className={!visible && !col.alwaysVisible ? "text-muted-foreground" : ""}>
                                    {col.label}
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <div className="flex items-center gap-1 ml-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={collapseAll}
                        title="Tümünü Daralt"
                      >
                        <ChevronsDownUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={expandAll}
                        title="Tümünü Genişlet"
                      >
                        <ChevronsUpDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {kesim.animalGroups.length > 0 && (
                <div className="flex gap-2 items-center">
                  <div className="flex items-center gap-1">
                    <Input
                      ref={jumpInputRef}
                      className="h-8 w-20 text-sm text-center cursor-pointer"
                      placeholder="No (Ctrl+G)"
                      readOnly
                      onClick={() => { setJumpDialogOpen(true); setJumpDialogValue(""); }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => { setJumpDialogOpen(true); setJumpDialogValue(""); }}
                    >
                      Git
                    </Button>
                  </div>
                  {kesim.animalGroups.some(g => !g.donations.some(d => d.name.trim())) && (
                    <Button variant="outline" size="sm" onClick={cleanEmptyGroups} title="Boş Grupları Temizle">
                      <Trash2 className="w-4 h-4 mr-1" />
                      Boşları Temizle
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const found = checkGroupConflicts(kesim.animalGroups);
                      setConflicts(found);
                      setShowConflicts(true);
                    }}
                  >
                    <Search className="w-4 h-4 mr-1" />
                    Çakışma Kontrol
                  </Button>
                  <Dialog open={groupFindDeleteOpen} onOpenChange={(open) => { setGroupFindDeleteOpen(open); if (!open) { setGroupFindDeleteValue(""); setGroupFindDeleteConfirm(false); } }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" title="Gruplarda Bul ve Sil">
                        <SearchX className="w-4 h-4 mr-1" />
                        Bul ve Sil
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Gruplarda Bul ve Sil</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Sütun Seç</label>
                          <Select value={groupFindDeleteColumn} onValueChange={(v: "name" | "description" | "donationType" | "vekalet" | "notes") => { setGroupFindDeleteColumn(v); setGroupFindDeleteValue(""); setGroupFindDeleteConfirm(false); }}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="description">Vekaleti Veren</SelectItem>
                              <SelectItem value="name">Adına Kesilen</SelectItem>
                              <SelectItem value="donationType">Cinsi</SelectItem>
                              <SelectItem value="vekalet">Vekalet No</SelectItem>
                              <SelectItem value="notes">Notlar</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Aranacak Değer</label>
                          <Input
                            placeholder={`${findDeleteColumnLabel[groupFindDeleteColumn]} içinde ara...`}
                            value={groupFindDeleteValue}
                            onChange={(e) => { setGroupFindDeleteValue(e.target.value); setGroupFindDeleteConfirm(false); }}
                          />
                        </div>
                        {groupFindDeleteValue.trim() && (() => {
                          const matches = getGroupFindDeleteMatches();
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  {matches.length > 0
                                    ? `${matches.length} kayıt bulundu (gruplarda)`
                                    : "Gruplarda eşleşen kayıt bulunamadı"}
                                </span>
                              </div>
                              {matches.length > 0 && (
                                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-muted/50 border-b">
                                        <th className="p-2 text-left font-medium">Vekaleti Veren</th>
                                        <th className="p-2 text-left font-medium">Adına Kesilen</th>
                                        <th className="p-2 text-left font-medium">Cinsi</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {matches.slice(0, 50).map((d) => (
                                        <tr key={d.id} className="border-b last:border-0">
                                          <td className="p-2">{d.description || "—"}</td>
                                          <td className="p-2">{d.name || "—"}</td>
                                          <td className="p-2">{d.donationType || "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {matches.length > 50 && (
                                    <div className="p-2 text-xs text-muted-foreground text-center bg-muted/20">
                                      ... ve {matches.length - 50} kayıt daha
                                    </div>
                                  )}
                                </div>
                              )}
                              {matches.length > 0 && !groupFindDeleteConfirm && (
                                <Button
                                  variant="destructive"
                                  className="w-full"
                                  onClick={() => setGroupFindDeleteConfirm(true)}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  {matches.length} Kaydı Sil
                                </Button>
                              )}
                              {matches.length > 0 && groupFindDeleteConfirm && (
                                <div className="space-y-2 border border-destructive/50 rounded-lg p-3 bg-destructive/5">
                                  <p className="text-sm font-medium text-destructive">
                                    {matches.length} bağışçı gruplardan ve listeden kalıcı olarak silinecek. Emin misiniz?
                                  </p>
                                  <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setGroupFindDeleteConfirm(false)}>
                                      İptal
                                    </Button>
                                    <Button variant="destructive" size="sm" className="flex-1" onClick={executeGroupFindDelete}>
                                      Evet, Sil
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" title="Toplu Kilitleme">
                        <Lock className="w-4 h-4 mr-1" />
                        Kilit
                        {kesim.animalGroups.filter(g => g.locked).length > 0 && (
                          <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                            {kesim.animalGroups.filter(g => g.locked).length}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3" align="end">
                      <p className="text-xs font-semibold mb-2">Toplu Kilitleme</p>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={lockAllGroups}>
                            <Lock className="w-3 h-3 mr-1" />
                            Tümünü Kilitle
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1" onClick={unlockAllGroups}>
                            <Unlock className="w-3 h-3 mr-1" />
                            Tümünü Aç
                          </Button>
                        </div>
                        <div className="border-t pt-2">
                          <p className="text-xs text-muted-foreground mb-2">
                            Hayvan numarası aralığı veya çoklu seçim girin (örn: 1-5 veya 3, 7, 12)
                          </p>
                          <div className="flex gap-2">
                            <Input
                              className="h-8 text-sm flex-1"
                              placeholder="1-5 veya 3, 7, 12"
                              value={rangeLockInput}
                              onChange={(e) => setRangeLockInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") applyRangeLock(true);
                              }}
                            />
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button variant="default" size="sm" className="flex-1" onClick={() => applyRangeLock(true)} disabled={!rangeLockInput.trim()}>
                              <Lock className="w-3 h-3 mr-1" />
                              Kilitle
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => applyRangeLock(false)} disabled={!rangeLockInput.trim()}>
                              <Unlock className="w-3 h-3 mr-1" />
                              Kilidi Aç
                            </Button>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {kesim.animalGroups.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-muted/30 rounded-lg">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 text-sm pl-8 pr-16"
                    placeholder="Gruplarda ara..."
                    value={groupSearchQuery}
                    onChange={(e) => { setGroupSearchQuery(e.target.value); setGroupSearchMatchIdx(0); }}
                  />
                  {groupSearchQuery.trim() && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      <span className="text-xs text-muted-foreground mr-1">
                        {currentGroupMatches.length > 0
                          ? `${(groupSearchMatchIdx % currentGroupMatches.length) + 1}/${currentGroupMatches.length}`
                          : "0"}
                      </span>
                      <button
                        className="p-0.5 hover:bg-muted rounded"
                        onClick={() => setGroupSearchMatchIdx(prev => Math.max(0, prev - 1))}
                        disabled={currentGroupMatches.length === 0}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        className="p-0.5 hover:bg-muted rounded"
                        onClick={() => setGroupSearchMatchIdx(prev => prev + 1)}
                        disabled={currentGroupMatches.length === 0}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        className="p-0.5 hover:bg-muted rounded"
                        onClick={() => { setGroupSearchQuery(""); setGroupSearchMatchIdx(0); }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startFilterTransition(() => setColorTagFilter("all"))}
                    className={`text-xs px-2 py-0.5 rounded border ${colorTagFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >Tümü</button>
                  <button
                    onClick={() => startFilterTransition(() => setColorTagFilter("green"))}
                    className={`w-5 h-5 rounded-full border-2 ${colorTagFilter === "green" ? "ring-2 ring-offset-1 ring-green-500" : ""}`}
                    style={{ backgroundColor: "#22c55e" }}
                    title="Yeşil"
                  />
                  <button
                    onClick={() => startFilterTransition(() => setColorTagFilter("orange"))}
                    className={`w-5 h-5 rounded-full border-2 ${colorTagFilter === "orange" ? "ring-2 ring-offset-1 ring-orange-500" : ""}`}
                    style={{ backgroundColor: "#f97316" }}
                    title="Turuncu"
                  />
                  <button
                    onClick={() => startFilterTransition(() => setColorTagFilter("red"))}
                    className={`w-5 h-5 rounded-full border-2 ${colorTagFilter === "red" ? "ring-2 ring-offset-1 ring-red-500" : ""}`}
                    style={{ backgroundColor: "#ef4444" }}
                    title="Kırmızı"
                  />
                  <button
                    onClick={() => startFilterTransition(() => setColorTagFilter(""))}
                    className={`w-5 h-5 rounded-full border-2 border-dashed ${colorTagFilter === "" ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                    title="Renksiz"
                  />
                </div>

                <div className="flex items-center gap-1 border-l pl-2 ml-1">
                  <Button
                    variant={showOnlyIncomplete ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => startFilterTransition(() => setShowOnlyIncomplete(!showOnlyIncomplete))}
                    title="Sadece eksik grupları göster"
                  >
                    <Filter className="w-3 h-3 mr-1" />
                    Eksik
                  </Button>
                  <Button
                    variant={highlightIncomplete ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => startFilterTransition(() => setHighlightIncomplete(!highlightIncomplete))}
                    title="Eksik grupları vurgula"
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Vurgula
                  </Button>
                </div>
              </div>
            )}

            {minimapOpen && kesim.animalGroups.length > 0 && (
              <Card className="p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <MapIcon className="w-4 h-4" />
                    Genel Bakış
                  </h3>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setMinimapOpen(false)}>✕</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {kesim.animalGroups.map((group) => {
                    const filled = group.donations.filter(d => d.name.trim() !== "").length;
                    const ratio = filled / 7;
                    let bg = "#ef4444";
                    if (ratio >= 1) bg = "#22c55e";
                    else if (ratio >= 0.5) bg = "#eab308";
                    else if (ratio > 0) bg = "#f97316";
                    return (
                      <button
                        key={group.id}
                        className="w-7 h-7 rounded text-[10px] font-bold text-white flex items-center justify-center transition-transform hover:scale-110 hover:shadow-md"
                        style={{ backgroundColor: bg }}
                        title={`Hayvan ${group.animalNo}: ${filled}/7 dolu`}
                        onClick={() => {
                          const el = document.getElementById(`animal-group-${group.animalNo}`);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                      >
                        {group.animalNo}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor:"#22c55e"}} /> Dolu (7/7)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor:"#eab308"}} /> Yarı dolu</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor:"#f97316"}} /> Az dolu</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{backgroundColor:"#ef4444"}} /> Boş</span>
                </div>
              </Card>
            )}

            {selectedGroupIds.size > 0 && (
              <div className="flex items-center gap-3 p-2 mb-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg flex-wrap">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {selectedGroupIds.size} grup seçildi
                </span>
                {selectedGroupIds.size >= 2 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={mergeSelectedGroups}
                    disabled={kesim.animalGroups.filter(g => selectedGroupIds.has(g.id)).some(g => g.locked)}
                  >
                    <Merge className="w-3 h-3 mr-1" />
                    Birleştir
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelectedGroupIds(new Set())}>
                  Seçimi Kaldır
                </Button>
              </div>
            )}

            {selectedGroupDonations.size > 0 && (
              <div className="flex items-center gap-3 p-2 mb-3 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-lg flex-wrap">
                <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                  {selectedGroupDonations.size} bağışçı seçildi
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={bulkRemoveFromGroups}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Gruptan Çıkar
                </Button>
                <div className="flex items-center gap-1">
                  <Select
                    value={String(bulkMoveTargetGroup)}
                    onValueChange={(v) => setBulkMoveTargetGroup(parseInt(v))}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue placeholder="Hedef grup..." />
                    </SelectTrigger>
                    <SelectContent>
                      {kesim.animalGroups.map((g, i) => (
                        <SelectItem key={g.id} value={String(i)}>
                          Hayvan {g.animalNo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => bulkMoveToGroup(bulkMoveTargetGroup)}
                    disabled={bulkMoveTargetGroup < 0}
                  >
                    <MoveRight className="w-3 h-3 mr-1" />
                    Taşı
                  </Button>
                </div>
                <Dialog open={bulkGroupEditOpen} onOpenChange={setBulkGroupEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <Settings2 className="w-3 h-3 mr-1" />
                      Toplu Düzenle
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{selectedGroupDonations.size} Bağışçıyı Toplu Düzenle</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <Select value={bulkGroupEditField} onValueChange={(v: any) => setBulkGroupEditField(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="donationType">Cinsi</SelectItem>
                          <SelectItem value="notes">Notlar</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Yeni değer"
                        value={bulkGroupEditValue}
                        onChange={(e) => setBulkGroupEditValue(e.target.value)}
                      />
                      <Button onClick={bulkChangeGroupDonationType} className="w-full">
                        Uygula
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedGroupDonations(new Set())}>
                  Seçimi Kaldır
                </Button>
              </div>
            )}

            {swapSelection && (() => {
              const selDonor = kesim.animalGroups[swapSelection.groupIdx]?.donations[swapSelection.donationIdx];
              return (
                <div className="flex items-center gap-3 p-2 mb-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-purple-800 dark:text-purple-200">
                    <strong>Takas modu:</strong> Hayvan {kesim.animalGroups[swapSelection.groupIdx]?.animalNo}, Sıra {swapSelection.donationIdx + 1}
                    {selDonor ? ` — ${selDonor.description || selDonor.name} (${selDonor.shareCount || 1} hisse)` : ""} seçildi.
                    Başka bir gruptaki bağışçıya tıklayın.
                  </span>
                  <Button variant="ghost" size="sm" onClick={cancelSwap}>
                    İptal
                  </Button>
                </div>
              );
            })()}

            {showConflicts && (
              <Card className={`p-4 mb-4 ${conflicts.length > 0 ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`w-5 h-5 mt-0.5 ${conflicts.length > 0 ? "text-amber-600" : "text-green-600"}`} />
                    <div>
                      {conflicts.length === 0 ? (
                        <p className="text-sm text-green-800 font-medium">Çakışma bulunamadı. Tüm vekaleti veren kişiler aynı hayvanda.</p>
                      ) : (
                        <>
                          <p className="text-sm text-amber-800 font-medium mb-2">
                            {conflicts.filter(c => !c.isExpected).length} kişi beklenmeyen şekilde farklı hayvanlara dağılmış:
                          </p>
                          <ul className="space-y-1">
                            {conflicts.filter(c => !c.isExpected).map((c, i) => (
                              <li key={i} className="text-sm text-amber-700 flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{c.description}</span>
                                <span className="text-xs">({c.totalShares} hisse) → Hayvan No: {c.animalNos.map((no, idx) => (
                                  <span key={no}>
                                    {idx > 0 && ", "}
                                    <button
                                      className="underline font-semibold hover:text-amber-900 cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const el = document.getElementById(`animal-group-${no}`);
                                        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                                      }}
                                    >
                                      {no}
                                    </button>
                                  </span>
                                ))}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => setPersonEditDesc(c.description)}
                                >
                                  <UserCog className="w-3 h-3 mr-1" />
                                  Düzenle
                                </Button>
                              </li>
                            ))}
                          </ul>
                          {conflicts.some(c => c.isExpected) && (
                            <div className="mt-3 pt-2 border-t border-amber-200">
                              <p className="text-xs text-amber-600 mb-1">7+ hisseli (normal dağılım):</p>
                              <ul className="space-y-0.5">
                                {conflicts.filter(c => c.isExpected).map((c, i) => (
                                  <li key={i} className="text-xs text-amber-500 flex items-center gap-2">
                                    <span>{c.description}</span>
                                    <span>({c.totalShares} hisse) → Hayvan No: {c.animalNos.map((no, idx) => (
                                      <span key={no}>
                                        {idx > 0 && ", "}
                                        <button
                                          className="underline font-semibold hover:text-amber-700 cursor-pointer"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const el = document.getElementById(`animal-group-${no}`);
                                            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                                          }}
                                        >
                                          {no}
                                        </button>
                                      </span>
                                    ))}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {conflicts.filter(c => !c.isExpected).length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100"
                        onClick={openAutoResolve}
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        Otomatik Çöz
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowConflicts(false)}>×</Button>
                  </div>
                </div>
              </Card>
            )}

            {kesim.animalGroups.length === 0 ? (
              <Card className="p-8 text-center">
                <Wand2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Bağışçı listesini doldurup "Otomatik Grupla" butonuna tıklayın
                </p>
              </Card>
            ) : (
              <div className={`grid gap-4 ${
                workspace.prefs.columnCount === 3 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" :
                workspace.prefs.columnCount === 2 ? "grid-cols-1 md:grid-cols-2" :
                "grid-cols-1"
              }`}>
                {kesim.animalGroups
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
                  })
                  .map(({ group, groupIdx }) => {
                  const isCollapsed = collapsedGroups.has(group.id);
                  const filledCount = group.donations.filter(
                    (d) => d.name.trim() !== ""
                  ).length;
                  const colorMap: Record<string, string> = {
                    green: "#22c55e",
                    orange: "#f97316",
                    red: "#ef4444",
                  };
                  const compact = workspace.prefs.compactMode;
                  const isIncomplete = filledCount < 7;
                  return (
                    <Card
                      key={group.id}
                      id={`animal-group-${group.animalNo}`}
                      className={`overflow-hidden transition-all ${swapSelection?.groupIdx === groupIdx ? "ring-2 ring-purple-400" : ""} ${highlightIncomplete && isIncomplete ? "ring-2 ring-orange-400" : ""} ${dragItem && dragItem.groupIdx !== groupIdx && dragOverGroup === groupIdx ? (filledCount >= 7 ? "ring-2 ring-red-500 shadow-lg scale-[1.01] bg-red-50/50 dark:bg-red-950/30" : "ring-2 ring-primary shadow-lg scale-[1.01]") : ""} ${dragItem && dragItem.groupIdx !== groupIdx && !isGroupLocked(groupIdx) ? "border-dashed border-2 border-primary/30" : ""}`}
                      style={group.colorTag ? { borderLeft: `4px solid ${colorMap[group.colorTag]}` } : (highlightIncomplete && isIncomplete ? { borderLeft: "4px solid #f97316" } : {})}
                      onDragOver={(e) => { e.preventDefault(); setDragOverGroup(groupIdx); }}
                      onDragLeave={(e) => handleDragLeave(e, groupIdx)}
                    >
                      <div
                        className={`flex items-center justify-between ${compact ? "p-2" : "p-3"} ${group.locked ? "bg-amber-500/10" : "bg-primary/10"} cursor-pointer`}
                        onClick={() => toggleGroupCollapse(group.id)}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!group.locked) toggleGroupSelect(group.id); }}
                            className={`flex-shrink-0 ${group.locked ? "opacity-30 cursor-not-allowed" : ""}`}
                            title={group.locked ? "Kilitli grup seçilemez" : "Seç"}
                          >
                            {selectedGroupIds.has(group.id)
                              ? <CheckSquare className={`${compact ? "w-3.5 h-3.5" : "w-4 h-4"} text-primary`} />
                              : <Square className={`${compact ? "w-3.5 h-3.5" : "w-4 h-4"} text-muted-foreground`} />
                            }
                          </button>
                          {isCollapsed ? (
                            <ChevronDown className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
                          ) : (
                            <ChevronUp className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
                          )}
                          <h3 className={`font-semibold ${compact ? "text-xs" : "text-sm"}`}>
                            {kesim.name} - HAYVAN NO: {group.animalNo}
                          </h3>
                          {group.locked && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-semibold border border-amber-500/30">
                              <Lock className="w-2.5 h-2.5" />
                              Kilitli
                            </span>
                          )}
                          {group.kesildi && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                              ✓ Kesildi
                              {group.kesildiAt && (
                                <span className="ml-0.5 opacity-75">
                                  {new Date(group.kesildiAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </span>
                          )}
                          {group.teamId && (kesim.teams || []).find(t => t.id === group.teamId) && (() => {
                            const team = (kesim.teams || []).find(t => t.id === group.teamId)!;
                            return (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{ backgroundColor: team.color + "20", color: team.color }}
                              >
                                {team.name}
                              </span>
                            );
                          })()}
                          <div className="flex items-center gap-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
                            {(["green", "orange", "red", ""] as ColorTag[]).map((c) => (
                              <button
                                key={c || "none"}
                                onClick={() => setGroupColorTag(groupIdx, c)}
                                className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} rounded-full border transition-transform ${
                                  (group.colorTag || "") === c ? "scale-125 ring-1 ring-offset-1" : "opacity-50 hover:opacity-100"
                                } ${c === "" ? "border-dashed" : ""}`}
                                style={c ? { backgroundColor: colorMap[c] } : {}}
                                title={c === "green" ? "Yeşil" : c === "orange" ? "Turuncu" : c === "red" ? "Kırmızı" : "Renksiz"}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`${compact ? "text-[10px]" : "text-xs"} text-muted-foreground`}>
                            {filledCount}/7 dolu
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveGroupUp(groupIdx); }}
                            className={`p-0.5 rounded transition-colors ${groupIdx <= 0 ? "opacity-30 cursor-not-allowed" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
                            title="Yukarı Taşı"
                            disabled={groupIdx <= 0}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveGroupDown(groupIdx); }}
                            className={`p-0.5 rounded transition-colors ${groupIdx >= kesim.animalGroups.length - 1 ? "opacity-30 cursor-not-allowed" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
                            title="Aşağı Taşı"
                            disabled={groupIdx >= kesim.animalGroups.length - 1}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openSplitGroupDialog(groupIdx); }}
                            className={`p-0.5 rounded transition-colors ${group.locked || filledCount <= 1 ? "opacity-30 cursor-not-allowed" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
                            title={group.locked ? "Kilitli grup bölünemez" : filledCount <= 1 ? "Bölmek için en az 2 bağışçı gerekli" : "Grubu Böl"}
                            disabled={group.locked || filledCount <= 1}
                          >
                            <Scissors className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addGroupToBasket(groupIdx);
                            }}
                            className={`p-0.5 rounded transition-colors ${group.locked || filledCount === 0 ? "opacity-30 cursor-not-allowed" : "text-emerald-500/60 hover:text-emerald-600"}`}
                            title={group.locked ? "Kilitli grup sepete eklenemez" : filledCount === 0 ? "Grupta bağışçı yok" : `Tümünü Sepete Ekle (${filledCount})`}
                            disabled={group.locked || filledCount === 0}
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                          </button>
                          {(photoCounts[group.id] ?? 0) > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPhotoViewGroup({ id: group.id, animalNo: group.animalNo });
                                setPhotoViewLoading(true);
                                fetchGroupPhotosAdmin(kesim.id, group.id)
                                  .then(setPhotoViewPhotos)
                                  .catch(() => setPhotoViewPhotos([]))
                                  .finally(() => setPhotoViewLoading(false));
                              }}
                              className="p-0.5 rounded transition-colors text-blue-500 hover:text-blue-600 relative"
                              title={`${photoCounts[group.id]} fotoğraf`}
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none font-bold">
                                {photoCounts[group.id]}
                              </span>
                            </button>
                          )}
                          {(kesim.teams || []).length > 0 && (
                            <select
                              value={group.teamId || ""}
                              onChange={(e) => { e.stopPropagation(); handleAssignTeam(group.id, e.target.value || null); }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-5 text-[10px] rounded border bg-background px-1 max-w-[80px]"
                              title="Ekip Ata"
                            >
                              <option value="">Ekip yok</option>
                              {(kesim.teams || []).map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleGroupLock(groupIdx); }}
                            className={`p-0.5 rounded transition-colors ${group.locked ? "text-amber-500" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                            title={group.locked ? "Kilidi Aç" : "Kilitle"}
                          >
                            {group.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (group.locked) return;
                              if (!confirm(`Hayvan ${group.animalNo} grubunu silmek istediğinize emin misiniz? İçindeki bağışçılar grupsuz kalacaktır.`)) return;
                              deleteAnimalGroup(groupIdx);
                            }}
                            className={`p-0.5 rounded transition-colors ${group.locked ? "opacity-30 cursor-not-allowed" : "text-red-400/60 hover:text-red-500"}`}
                            title={group.locked ? "Kilitli grup silinemez" : "Grubu Sil"}
                            disabled={group.locked}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {!isCollapsed && (
                        <>
                        <table className={`w-full ${compact ? "text-[10px]" : "text-xs"}`}>
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className={`${compact ? "p-0.5" : "p-1.5"} w-6`}>
                                <input
                                  type="checkbox"
                                  className="rounded"
                                  checked={group.donations.filter(d => d.name.trim()).every(d => selectedGroupDonations.has(d.id)) && group.donations.some(d => d.name.trim())}
                                  onChange={() => {
                                    const filled = group.donations.filter(d => d.name.trim());
                                    const allSelected = filled.every(d => selectedGroupDonations.has(d.id));
                                    setSelectedGroupDonations(prev => {
                                      const next = new Set(prev);
                                      filled.forEach(d => allSelected ? next.delete(d.id) : next.add(d.id));
                                      return next;
                                    });
                                  }}
                                />
                              </th>
                              {workspace.visibleColumns.map(key => (
                                <th key={key} className={`${compact ? "p-0.5" : "p-1.5"} text-left ${columnHeaderWidth(key)}`}>
                                  {key === "drag" ? "" : key === "actions" ? "" : columnHeaderLabel(key)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.donations.map((d, dIdx) => (
                              <tr
                                key={d.id}
                                className={`border-b transition-all duration-150 ${
                                  dragOverItem?.groupIdx === groupIdx &&
                                  dragOverItem?.donationIdx === dIdx
                                    ? "bg-primary/20 shadow-inner"
                                    : isGroupSearchMatch(groupIdx, dIdx)
                                    ? "bg-yellow-100 dark:bg-yellow-900/40"
                                    : selectedGroupDonations.has(d.id)
                                    ? "bg-blue-50 dark:bg-blue-950/40"
                                    : "hover:bg-muted/20"
                                } ${dragItem?.groupIdx === groupIdx && dragItem?.donationIdx === dIdx ? "opacity-50 scale-95" : ""}`}
                                draggable
                                onDragStart={(e) =>
                                  handleDragStart(groupIdx, dIdx, e)
                                }
                                onDragOver={(e) =>
                                  handleDragOver(e, groupIdx, dIdx)
                                }
                                onDrop={() => handleDrop(groupIdx, dIdx)}
                                onDragEnd={handleDragEnd}
                              >
                                <td className={compact ? "p-0.5" : "p-1.5"}>
                                  {d.name.trim() && (
                                    <input
                                      type="checkbox"
                                      className="rounded"
                                      checked={selectedGroupDonations.has(d.id)}
                                      onChange={() => toggleGroupDonationSelect(d.id)}
                                    />
                                  )}
                                </td>
                                {workspace.visibleColumns.map(key =>
                                  renderGroupTableCell(key, d, dIdx, groupIdx, group)
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className={`${compact ? "p-1" : "p-2"} border-t`}>
                          <input
                            type="text"
                            placeholder="Grup notu..."
                            value={group.notes || ""}
                            onChange={(e) => updateGroupNotes(groupIdx, e.target.value)}
                            className={`w-full ${compact ? "text-[10px]" : "text-xs"} bg-transparent border-0 outline-none placeholder:text-muted-foreground/50 text-muted-foreground`}
                          />
                        </div>
                        </>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={personEditDesc !== null} onOpenChange={(open) => { if (!open) setPersonEditDesc(null); }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Kişi Düzenleme: {personEditDesc}
            </DialogTitle>
          </DialogHeader>
          {personEditDesc && kesim && (() => {
            const key = personEditDesc.trim().toLowerCase();
            const matchingDonations = kesim.donations.filter(
              d => d.description.trim().toLowerCase() === key
            );
            const allExcluded = matchingDonations.length > 0 && matchingDonations.every(d => d.excluded);
            const matchingGroupEntries: { groupIdx: number; dIdx: number; donation: Donation; animalNo: number }[] = [];
            kesim.animalGroups.forEach((group, groupIdx) => {
              group.donations.forEach((d, dIdx) => {
                if (d.description.trim().toLowerCase() === key) {
                  matchingGroupEntries.push({ groupIdx, dIdx, donation: d, animalNo: group.animalNo });
                }
              });
            });
            return (
              <div className="space-y-4">
                {matchingDonations.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">Bağışçı Listesindeki Kayıtlar ({matchingDonations.length})</h3>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => bulkExcludeByDesc(personEditDesc, !allExcluded)}
                        >
                          {allExcluded ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
                          {allExcluded ? "Tümünü Dahil Et" : "Tümünü Hariç Tut"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setPersonBulkDeleteConfirm(personEditDesc)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Tümünü Sil
                        </Button>
                      </div>
                    </div>
                    <table className="w-full text-sm border">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="p-2 text-left">Vekalet</th>
                          <th className="p-2 text-left">Vekaleti Veren</th>
                          <th className="p-2 text-left">Adına Kesilen</th>
                          <th className="p-2 text-left">Cinsi</th>
                          <th className="p-2 text-left">Notlar</th>
                          <th className="p-2 text-center">Durum</th>
                          <th className="p-2 w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchingDonations.map((d) => (
                          <tr key={d.id} className={`border-b ${d.excluded ? "opacity-40" : ""}`}>
                            <td className="p-2">
                              <Input className="h-7 text-sm" value={d.vekalet || ""} onChange={(e) => updateDonationField(d.id, "vekalet", e.target.value)} />
                            </td>
                            <td className="p-2">
                              <Input className="h-7 text-sm" value={d.description} onChange={(e) => updateDonationField(d.id, "description", e.target.value)} />
                            </td>
                            <td className="p-2">
                              <Input className="h-7 text-sm" value={d.name} onChange={(e) => updateDonationField(d.id, "name", e.target.value)} />
                            </td>
                            <td className="p-2">
                              <Input className="h-7 text-sm" value={d.donationType} onChange={(e) => updateDonationField(d.id, "donationType", e.target.value)} />
                            </td>
                            <td className="p-2">
                              <Input className="h-7 text-sm" value={d.notes || ""} onChange={(e) => updateDonationField(d.id, "notes", e.target.value)} />
                            </td>
                            <td className="p-2 text-center">
                              <Button variant="ghost" size="sm" className="h-7" onClick={() => updateDonationField(d.id, "excluded", !d.excluded)}>
                                {d.excluded ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                              </Button>
                            </td>
                            <td className="p-2">
                              <div className="flex gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-7 w-7 p-0 ${basketItemIds.has(d.id) ? "bg-emerald-100 dark:bg-emerald-900" : ""}`}
                                  title={basketItemIds.has(d.id) ? "Sepetten Çıkar" : "Keseye Ekle"}
                                  onClick={() => basketItemIds.has(d.id) ? removeFromBasket(d.id) : addDonorToBasket(d.id)}
                                  disabled={d.excluded}
                                >
                                  <ShoppingBag className={`w-3 h-3 ${basketItemIds.has(d.id) ? "text-emerald-600" : "text-muted-foreground"}`} />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteDonation(d.id)}>
                                  <Trash2 className="w-3 h-3 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {matchingGroupEntries.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Hayvan Gruplarındaki Konumu ({matchingGroupEntries.length} satır)</h3>
                    <table className="w-full text-sm border">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="p-2 text-left">Hayvan No</th>
                          <th className="p-2 text-left">Sıra</th>
                          <th className="p-2 text-left">Vekalet</th>
                          <th className="p-2 text-left">Vekaleti Veren</th>
                          <th className="p-2 text-left">Adına Kesilen</th>
                          <th className="p-2 text-left">Cinsi</th>
                          <th className="p-2 text-left">Notlar</th>
                          <th className="p-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchingGroupEntries.map((entry, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2 font-semibold text-primary">{entry.animalNo}</td>
                            <td className="p-2">{entry.dIdx + 1}</td>
                            <td className="p-2">
                              <Input className="h-7 text-sm" value={entry.donation.vekalet || ""} onChange={(e) => updateGroupDonation(entry.groupIdx, entry.dIdx, "vekalet", e.target.value)} />
                            </td>
                            <td className="p-2">
                              <Input className="h-7 text-sm" value={entry.donation.description} onChange={(e) => updateGroupDonation(entry.groupIdx, entry.dIdx, "description", e.target.value)} />
                            </td>
                            <td className="p-2">
                              <Input className="h-7 text-sm" value={entry.donation.name} onChange={(e) => updateGroupDonation(entry.groupIdx, entry.dIdx, "name", e.target.value)} />
                            </td>
                            <td className="p-2">
                              <Input className="h-7 text-sm" value={entry.donation.donationType} onChange={(e) => updateGroupDonation(entry.groupIdx, entry.dIdx, "donationType", e.target.value)} />
                            </td>
                            <td className="p-2">
                              <Input className="h-7 text-sm" value={entry.donation.notes || ""} onChange={(e) => updateGroupDonation(entry.groupIdx, entry.dIdx, "notes", e.target.value)} />
                            </td>
                            <td className="p-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 w-7 p-0 ${basketItemIds.has(entry.donation.id) ? "bg-emerald-100 dark:bg-emerald-900" : ""}`}
                                title={basketItemIds.has(entry.donation.id) ? "Sepetten Çıkar" : "Keseye Ekle"}
                                onClick={() => basketItemIds.has(entry.donation.id) ? removeFromBasket(entry.donation.id) : addToBasket(entry.groupIdx, entry.dIdx)}
                              >
                                <ShoppingBag className={`w-3 h-3 ${basketItemIds.has(entry.donation.id) ? "text-emerald-600" : "text-muted-foreground"}`} />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {matchingDonations.length === 0 && matchingGroupEntries.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">Bu kişiye ait kayıt bulunamadı.</p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={swapPreviewOpen} onOpenChange={(open) => { if (!open) cancelSwap(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-purple-600" />
              Takas Önizleme
            </DialogTitle>
          </DialogHeader>
          {swapSelection && swapTarget && kesim && (() => {
            const srcDonor = kesim.animalGroups[swapSelection.groupIdx]?.donations[swapSelection.donationIdx];
            const tgtDonor = kesim.animalGroups[swapTarget.groupIdx]?.donations[swapTarget.donationIdx];
            const srcShare = srcDonor?.shareCount || 1;
            const tgtShare = tgtDonor?.shareCount || 1;
            const shareMismatch = srcShare !== tgtShare;
            return (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-950">
                    <p className="text-xs text-muted-foreground mb-1">
                      Hayvan {kesim.animalGroups[swapSelection.groupIdx]?.animalNo}, Sıra {swapSelection.donationIdx + 1}
                    </p>
                    <p className="font-semibold text-sm">
                      {srcDonor?.description || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {srcDonor?.name || "—"}
                    </p>
                    <p className="text-xs mt-1 font-medium">{srcShare} hisse</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-950">
                    <p className="text-xs text-muted-foreground mb-1">
                      Hayvan {kesim.animalGroups[swapTarget.groupIdx]?.animalNo}, Sıra {swapTarget.donationIdx + 1}
                    </p>
                    <p className="font-semibold text-sm">
                      {tgtDonor?.description || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tgtDonor?.name || "—"}
                    </p>
                    <p className="text-xs mt-1 font-medium">{tgtShare} hisse</p>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowLeftRight className="w-6 h-6 text-purple-400" />
                </div>
                {shareMismatch && (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Hisse sayıları farklı ({srcShare} ↔ {tgtShare}). Takas sonrası grup toplamları değişecek.</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={cancelSwap} className="flex-1">
                    İptal
                  </Button>
                  <Button onClick={executeSwap} className="flex-1">
                    <ArrowLeftRight className="w-4 h-4 mr-1" />
                    Takas Et
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={autoResolveOpen} onOpenChange={setAutoResolveOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              Otomatik Çakışma Çözümü
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {resolveResults.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Otomatik çözülebilecek çakışma bulunamadı. Bazı gruplar kilitli olabilir veya uygun takas bulunamadı.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {resolveResults.length} kişi için toplam {resolveResults.reduce((sum, r) => sum + r.swaps.length, 0)} takas öneriliyor:
                </p>
                <div className="space-y-3">
                  {resolveResults.map((result, i) => (
                    <Card key={i} className="p-3">
                      <p className="font-semibold text-sm mb-2">{result.desc}</p>
                      <div className="space-y-1">
                        {result.swaps.map((swap, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Hayvan {kesim!.animalGroups[swap.fromGroup]?.animalNo} #{swap.fromIdx + 1}</span>
                            <ArrowLeftRight className="w-3 h-3" />
                            <span>Hayvan {kesim!.animalGroups[swap.toGroup]?.animalNo} #{swap.toIdx + 1}</span>
                            <span className="text-xs opacity-60">
                              ({swap.fromName} ↔ {swap.toName})
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setAutoResolveOpen(false)} className="flex-1">
                    İptal
                  </Button>
                  <Button onClick={applyAutoResolve} className="flex-1">
                    <Sparkles className="w-4 h-4 mr-1" />
                    Tümünü Uygula
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shortcutHelpOpen} onOpenChange={setShortcutHelpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="w-5 h-5" />
              Klavye Kısayolları
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {[
              { keys: "Ctrl + Z", desc: "Geri Al" },
              { keys: "Ctrl + Y", desc: "İleri Al" },
              { keys: "Ctrl + S", desc: "Kaydet" },
              { keys: "Ctrl + F", desc: "Bağışçı Ara" },
              { keys: "Ctrl + G", desc: "Gruba Atla" },
              { keys: "F11", desc: "Tam Ekran" },
              { keys: "?", desc: "Bu yardım panelini aç/kapat" },
              { keys: "Escape", desc: "Düzenlemeyi iptal et / paneli kapat" },
              { keys: "Tab", desc: "Sonraki hücreye geç" },
              { keys: "Shift + Tab", desc: "Önceki hücreye geç" },
              { keys: "Enter", desc: "Düzenlemeyi onayla" },
            ].map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{shortcut.desc}</span>
                <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border border-border">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={splitShareDialog !== null} onOpenChange={(open) => { if (!open) setSplitShareDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primary" />
              Hisse Bölme
            </DialogTitle>
          </DialogHeader>
          {splitShareDialog && kesim && (() => {
            const donor = kesim.donations.find(d => d.id === splitShareDialog.donationId);
            if (!donor) return null;
            const options = getSplitOptions(splitShareDialog.totalShares);
            return (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  <strong>{donor.description || donor.name}</strong> — {splitShareDialog.totalShares} hisse nasıl bölünsün?
                </p>
                <div className="space-y-2">
                  {options.map(([a, b], i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="w-full justify-between h-auto py-3"
                      onClick={() => applySplitShare(splitShareDialog.donationId, a, b)}
                    >
                      <span className="font-semibold">{a} + {b}</span>
                      <span className="text-xs text-muted-foreground">
                        {a === b ? "Eşit bölme" : a === 7 ? "Maksimum + kalan" : `Dengeli bölme`}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={splitGroupDialog !== null} onOpenChange={(open) => { if (!open) setSplitGroupDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primary" />
              Grubu Böl
            </DialogTitle>
          </DialogHeader>
          {splitGroupDialog && kesim && (() => {
            const group = kesim.animalGroups[splitGroupDialog.groupIdx];
            if (!group) return null;
            const filled = group.donations.filter(d => d.name.trim() !== "");
            return (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Hayvan {group.animalNo}</strong> — {filled.length} bağışçıyı nerede bölmek istiyorsunuz?
                </p>
                <div className="space-y-1">
                  {filled.map((d, i) => {
                    if (i === 0) return null;
                    const isCurrent = splitGroupDialog.splitAt === i;
                    return (
                      <button
                        key={d.id}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors border ${
                          isCurrent
                            ? "border-primary bg-primary/10 font-medium"
                            : "border-transparent hover:bg-muted"
                        }`}
                        onClick={() => setSplitGroupDialog({ ...splitGroupDialog, splitAt: i })}
                      >
                        <span className="text-muted-foreground mr-2">{i}/{filled.length - i}</span>
                        İlk {i}: {filled.slice(0, i).map(dd => dd.description || dd.name).join(", ")}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setSplitGroupDialog(null)}>İptal</Button>
                  <Button onClick={executeSplitGroup}>
                    <Scissors className="w-3 h-3 mr-1" />
                    {splitGroupDialog.splitAt}/{filled.length - splitGroupDialog.splitAt} Olarak Böl
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={smartPlacePopover !== null} onOpenChange={(open) => { if (!open) setSmartPlacePopover(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              Akıllı Yerleştirme
            </DialogTitle>
          </DialogHeader>
          {smartPlacePopover && kesim && (() => {
            const donor = kesim.donations.find(d => d.id === smartPlacePopover);
            if (!donor) return null;
            const available = getAvailableGroupsForDonor(smartPlacePopover);
            const swapSuggestions = getSwapSuggestions(smartPlacePopover);
            const effectiveShares = computeEffectiveShares(kesim.donations).get(donor.id) || donor.shareCount;
            return (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  <strong>{donor.description || donor.name}</strong> ({effectiveShares} hisse) nereye yerleştirilsin?
                </p>
                {available.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-primary">Doğrudan Yerleştirme</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {available.map(g => (
                        <Button
                          key={g.groupIdx}
                          variant="outline"
                          className="w-full justify-between h-auto py-2"
                          onClick={() => smartPlaceDonor(smartPlacePopover, g.groupIdx)}
                        >
                          <span className="font-semibold">Hayvan {g.animalNo}</span>
                          <span className="text-xs text-muted-foreground">{g.emptySlots} boş slot</span>
                        </Button>
                      ))}
                    </div>
                  </>
                )}
                {swapSuggestions.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-amber-600">Takas Önerileri</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {swapSuggestions.map((s, i) => (
                        <Button
                          key={`swap-${i}`}
                          variant="outline"
                          className="w-full justify-between h-auto py-2 border-amber-300"
                          onClick={() => executeSwapSuggestion(smartPlacePopover, s.groupIdx, s.swapOutIds)}
                        >
                          <div className="text-left">
                            <span className="font-semibold block">Hayvan {s.animalNo}</span>
                            <span className="text-[10px] text-muted-foreground">{s.description}</span>
                          </div>
                          <span className="text-[10px] text-amber-600">{s.swapOutNames.join(", ")}</span>
                        </Button>
                      ))}
                    </div>
                  </>
                )}
                {available.length === 0 && swapSuggestions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Uygun boşluğu olan veya takas yapılabilecek hayvan grubu bulunamadı.
                  </p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!personBulkDeleteConfirm} onOpenChange={(open) => { if (!open) setPersonBulkDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Toplu Silme Onayı</AlertDialogTitle>
            <AlertDialogDescription>
              "{personBulkDeleteConfirm}" adlı kişinin tüm kayıtları çöp kutusuna taşınacak. Çöp kutusundan geri yükleyebilirsiniz. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (personBulkDeleteConfirm) {
                  bulkDeleteByDesc(personBulkDeleteConfirm);
                }
                setPersonBulkDeleteConfirm(null);
              }}
            >
              Tümünü Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sticky bottom basket panel */}
      {basketItems.length > 0 && (() => {
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
                        {g.items.length > 1 && <span className="bg-emerald-200 dark:bg-emerald-800 px-1 rounded-full text-[9px] font-bold">×{g.items.length}</span>}
                        <button className="ml-0.5 hover:text-destructive" onClick={() => g.items.forEach(b => removeFromBasket(b.donationId))}>×</button>
                      </span>
                    ))}
                    {grouped.length > 6 && <span className="text-[10px]">+{grouped.length - 6}</span>}
                  </div>
                  );
                })()}
                {foreignBasketItems.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300 flex-wrap">
                    <span className="text-[10px] font-semibold mr-1">Diğer KA:</span>
                    {foreignBasketItems.slice(0, 4).map(b => (
                      <span key={b.donationId} className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-[10px]">
                        {b.description || b.name}
                        <span className="text-[9px] opacity-70 ml-0.5">({b.kesimAlaniName})</span>
                        <button className="ml-1 hover:text-destructive" onClick={() => removeFromBasket(b.donationId)}>×</button>
                      </span>
                    ))}
                    {foreignBasketItems.length > 4 && <span className="text-[10px]">+{foreignBasketItems.length - 4}</span>}
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
        );
      })()}

      {jumpDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={() => setJumpDialogOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-background rounded-2xl shadow-2xl border p-6 w-[340px] flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium text-muted-foreground">Hayvan Numarasına Git</div>
            <input
              autoFocus
              type="number"
              min={1}
              className="w-full text-center text-4xl font-bold border-2 border-primary/30 focus:border-primary rounded-xl px-4 py-3 bg-background outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="No"
              value={jumpDialogValue}
              onChange={(e) => setJumpDialogValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && jumpDialogValue.trim()) {
                  const el = document.getElementById(`animal-group-${jumpDialogValue.trim()}`);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    setJumpDialogOpen(false);
                  } else {
                    toast({ title: `Hayvan No ${jumpDialogValue} bulunamadı`, variant: "destructive" });
                  }
                }
                if (e.key === "Escape") {
                  setJumpDialogOpen(false);
                }
              }}
            />
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setJumpDialogOpen(false)} className="flex-1">
                İptal
              </Button>
              <Button
                onClick={() => {
                  if (!jumpDialogValue.trim()) return;
                  const el = document.getElementById(`animal-group-${jumpDialogValue.trim()}`);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    setJumpDialogOpen(false);
                  } else {
                    toast({ title: `Hayvan No ${jumpDialogValue} bulunamadı`, variant: "destructive" });
                  }
                }}
                className="flex-1"
              >
                Git
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Ctrl+G ile açılır</p>
          </div>
        </div>
      )}

      {showScrollTop && (
        <button
          className={`fixed right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all ${basketItems.length > 0 ? (basketOpen ? "bottom-36" : "bottom-16") : "bottom-6"}`}
          onClick={() => {
            const container = scrollContainerRef.current;
            if (container && fullscreenMode) {
              container.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          title="En yukarı kaydır"
        >
          <ArrowUp className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      )}

      {/* Trash Bin Dialog */}
      <Dialog open={trashOpen} onOpenChange={setTrashOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Çöp Kutusu — Silinen Bağışçılar
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-2">
            {trashLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : trashItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Çöp kutusu boş</p>
              </div>
            ) : (
              <div className="space-y-1">
                {trashItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{item.description || item.name || "—"}</span>
                        {item.name && item.name !== item.description && (
                          <span className="text-xs text-muted-foreground truncate">({item.name})</span>
                        )}
                        {item.donationType && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.donationType}</span>
                        )}
                        {item.shareCount > 1 && (
                          <span className="text-xs text-muted-foreground">{item.shareCount} hisse</span>
                        )}
                      </div>
                      {item.deletedAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Silindi: {new Date(item.deletedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => restoreDonation(item.id)}
                        title="Geri Yükle"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Geri Yükle
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setTrashPermanentConfirm(item.id)}
                        title="Kalıcı Sil"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation */}
      <AlertDialog open={!!trashPermanentConfirm} onOpenChange={(open) => { if (!open) setTrashPermanentConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kalıcı olarak sil?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu bağışçı kalıcı olarak silinecek ve geri alınamaz. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => trashPermanentConfirm && permanentDeleteDonation(trashPermanentConfirm)}
            >
              Kalıcı Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={trackingNotesOpen} onOpenChange={setTrackingNotesOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5" />
              Saha Notları ve Düzenleme Talepleri
            </DialogTitle>
          </DialogHeader>
          {trackingNotesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : trackingNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Henüz saha notu veya düzenleme talebi yok.
            </div>
          ) : (
            <div className="space-y-2">
              {trackingNotes.map(note => {
                const groupNo = note.animalGroupId && kesim
                  ? kesim.animalGroups.find(g => g.id === note.animalGroupId)?.animalNo
                  : null;
                return (
                  <div
                    key={note.id}
                    className={`rounded-lg p-3 text-sm border ${
                      note.type === "edit_request"
                        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                        : "bg-muted/30 border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        {note.type === "edit_request" ? (
                          <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <MessageSquarePlus className="w-3.5 h-3.5 text-blue-500" />
                        )}
                        <span className="text-xs font-semibold">
                          {note.type === "edit_request" ? "Düzenleme Talebi" : "Not"}
                          {groupNo != null && ` — Hayvan ${groupNo}`}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(note.createdAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {note.type === "edit_request" ? (
                      <>
                        <div className="text-xs mb-1">
                          <span className="font-medium">{
                            note.fieldName === "name" ? "Adına Kesilen" :
                            note.fieldName === "description" ? "Vekaleti Veren" :
                            note.fieldName === "donationType" ? "Cinsi" :
                            note.fieldName === "vekalet" ? "Vekalet" :
                            note.fieldName === "notes" ? "Notlar" : note.fieldName
                          }</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs flex-wrap">
                          <span className="line-through text-red-400">{note.oldValue || "—"}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium text-emerald-600">{note.newValue}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          {note.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                onClick={async () => {
                                  try {
                                    await updateTrackingNoteStatus(kesim!.id, note.id, "approved");
                                    setTrackingNotes(prev => prev.map(n => n.id === note.id ? { ...n, status: "approved" as const } : n));
                                    toast({ title: "Talep onaylandı" });
                                  } catch {
                                    toast({ title: "Hata", variant: "destructive" });
                                  }
                                }}
                              >
                                <Check className="w-2.5 h-2.5 mr-0.5" /> Onayla
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] text-red-600 border-red-300 hover:bg-red-50"
                                onClick={async () => {
                                  try {
                                    await updateTrackingNoteStatus(kesim!.id, note.id, "rejected");
                                    setTrackingNotes(prev => prev.map(n => n.id === note.id ? { ...n, status: "rejected" as const } : n));
                                    toast({ title: "Talep reddedildi" });
                                  } catch {
                                    toast({ title: "Hata", variant: "destructive" });
                                  }
                                }}
                              >
                                <X className="w-2.5 h-2.5 mr-0.5" /> Reddet
                              </Button>
                            </>
                          ) : (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              note.status === "approved"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            }`}>
                              {note.status === "approved" ? "Onaylandı" : "Reddedildi"}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs whitespace-pre-wrap">{note.content}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={notificationLogsOpen} onOpenChange={setNotificationLogsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Kesim Bildirimleri
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end mb-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                setNotificationTemplateOpen(true);
                try {
                  const tmpl = await fetchNotificationTemplate();
                  setNotificationTemplate(tmpl);
                } catch {
                  toast({ title: "Hata", description: "Şablon yüklenemedi", variant: "destructive" });
                }
              }}
            >
              <Settings2 className="w-3.5 h-3.5 mr-1" />
              Şablon Düzenle
            </Button>
          </div>
          {notificationLogsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : notificationLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Henüz bildirim kaydı yok. Hayvan kesildi olarak işaretlendiğinde burada görünecek.
            </div>
          ) : (
            <div className="space-y-2">
              {notificationLogs.map(log => (
                <div key={log.id} className="rounded-lg p-3 text-sm border bg-muted/30 border-border">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs font-semibold">
                        Hayvan {log.animalNo || "?"} — {log.donorName}
                      </span>
                      {log.phone && (
                        <span className="text-[10px] text-muted-foreground">({log.phone})</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(log.createdAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground">{log.message}</p>
                  <div className="mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
                      {log.channel === "browser" ? "Tarayıcı" : log.channel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={notificationTemplateOpen} onOpenChange={setNotificationTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Bildirim Şablonu
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="text-xs text-muted-foreground">
              Kullanılabilir değişkenler: <code className="bg-muted px-1 rounded">{"{animalNo}"}</code> (hayvan numarası), <code className="bg-muted px-1 rounded">{"{donorName}"}</code> (bağışçı adı)
            </div>
            <Input
              value={notificationTemplate}
              onChange={(e) => setNotificationTemplate(e.target.value)}
              placeholder="Bildirim mesaj şablonu..."
            />
            <div className="text-xs text-muted-foreground">
              Önizleme: <span className="italic">{notificationTemplate.replace("{animalNo}", "5").replace("{donorName}", "Ahmet Yılmaz")}</span>
            </div>
            <Button
              className="w-full"
              onClick={async () => {
                setNotificationTemplateSaving(true);
                try {
                  await updateNotificationTemplate(notificationTemplate);
                  toast({ title: "Şablon kaydedildi" });
                  setNotificationTemplateOpen(false);
                } catch {
                  toast({ title: "Hata", variant: "destructive" });
                } finally {
                  setNotificationTemplateSaving(false);
                }
              }}
              disabled={notificationTemplateSaving || !notificationTemplate.trim()}
            >
              {notificationTemplateSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Kaydet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <QrCodeModal
        open={qrModalOpen}
        onOpenChange={setQrModalOpen}
        url={qrUrl}
        title={kesim?.name}
      />

      <Dialog open={!!photoViewGroup} onOpenChange={(open) => { if (!open) setPhotoViewGroup(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Hayvan {photoViewGroup?.animalNo} — Fotoğraflar
            </DialogTitle>
          </DialogHeader>
          {photoViewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : photoViewPhotos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Bu hayvan grubunda fotoğraf yok.
            </div>
          ) : (
            <PhotoGallery
              photos={photoViewPhotos}
              getPhotoUrl={(photoId) => kesim ? getGroupPhotoUrlAdmin(kesim.id, photoViewGroup!.id, photoId) : ""}
              readOnly
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Ekip Yönetimi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ekip adı"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="flex-1"
              />
              <input
                type="color"
                value={teamColor}
                onChange={(e) => setTeamColor(e.target.value)}
                className="w-10 h-10 rounded border cursor-pointer"
              />
              <Button
                size="sm"
                onClick={handleSaveTeam}
                disabled={!teamName.trim() || teamSaving}
                className="shrink-0"
              >
                {teamSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : teamEditId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </Button>
              {teamEditId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setTeamEditId(null); setTeamName(""); setTeamColor("#3b82f6"); }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {(kesim?.teams || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Henüz ekip oluşturulmamış
                </p>
              ) : (
                (kesim?.teams || []).map(t => {
                  const assignedCount = kesim!.animalGroups.filter(g => g.teamId === t.id).length;
                  return (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border">
                      <div
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="flex-1 text-sm font-medium">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground">{assignedCount} grup</span>
                      <button
                        onClick={() => { setTeamEditId(t.id); setTeamName(t.name); setTeamColor(t.color); }}
                        className="p-1 hover:bg-muted rounded"
                        title="Düzenle"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm(`"${t.name}" ekibini silmek istediğinize emin misiniz?`)) return;
                          handleDeleteTeam(t.id);
                        }}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-950 rounded text-red-500"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            {(kesim?.teams || []).length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Ekip Filtresi:</p>
                <div className="flex gap-1 flex-wrap">
                  <button
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                      filterTeam === "all" ? "bg-primary/10 border-primary font-semibold" : "hover:bg-muted"
                    }`}
                    onClick={() => setFilterTeam("all")}
                  >
                    Tümü
                  </button>
                  <button
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                      filterTeam === "none" ? "bg-primary/10 border-primary font-semibold" : "hover:bg-muted"
                    }`}
                    onClick={() => setFilterTeam("none")}
                  >
                    Ekipsiz
                  </button>
                  {(kesim?.teams || []).map(t => (
                    <button
                      key={t.id}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                        filterTeam === t.id ? "font-semibold" : "hover:opacity-80"
                      }`}
                      style={{
                        backgroundColor: filterTeam === t.id ? t.color + "20" : undefined,
                        borderColor: filterTeam === t.id ? t.color : undefined,
                        color: t.color,
                      }}
                      onClick={() => setFilterTeam(t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
