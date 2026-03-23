import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
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
  MoveRight,
  X,
  HelpCircle,
  Keyboard,
  Map as MapIcon,
  Maximize,
  Minimize,
  Save,
} from "lucide-react";
import type { Donation, AnimalGroup, KesimAlani, ColorTag, CustomTag } from "@/lib/types";
import { Tag } from "lucide-react";
import { getKesimAlani, updateKesimAlani, loadGlobalTags } from "@/lib/storage";
import { autoGroupDonationsAsync, getTotalShares, getRequiredAnimals, checkGroupConflicts, computeEffectiveShares } from "@/lib/grouping";
import type { GroupingProgress, ConflictInfo } from "@/lib/grouping";
import { useHistory } from "@/lib/useHistory";
import { useWorkspacePreferences, ALL_GROUP_COLUMNS, type ColumnKey } from "@/lib/useWorkspacePreferences";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import * as XLSX from "xlsx";

type SortField = "name" | "description" | "donationType" | "shareCount";
type SortDir = "asc" | "desc";
type ColumnMapping = "name" | "description" | "donationType" | "shareCount" | "vekalet" | "notes" | "skip";

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
  return Math.random().toString(36).substring(2, 12);
}

export default function KesimAlaniPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
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
  const [bulkStep, setBulkStep] = useState<"input" | "mapping">("input");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDonation, setNewDonation] = useState({
    name: "",
    description: "",
    donationType: "",
    shareCount: 1,
    vekalet: "",
    notes: "",
  });
  const [editingCell, setEditingCell] = useState<{
    donationId: string;
    field: string;
  } | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupingInProgress, setGroupingInProgress] = useState(false);
  const [groupingProgress, setGroupingProgress] = useState<GroupingProgress | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [personEditDesc, setPersonEditDesc] = useState<string | null>(null);
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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
  const [bulkEditField, setBulkEditField] = useState<"donationType" | "shareCount" | "notes">("donationType");
  const [bulkEditValue, setBulkEditValue] = useState("");
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
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "excluded">("all");
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [tagPopoverDonorId, setTagPopoverDonorId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const groupsHeaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (params.id) {
      const data = getKesimAlani(params.id);
      if (data) {
        setKesim(data);
        history.initialize(data);
      } else {
        setLocation("/");
      }
    }
    setGlobalTags(loadGlobalTags());
  }, [params.id, setLocation]);

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
          updateKesimAlani(kesim);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        jumpInputRef.current?.focus();
        jumpInputRef.current?.select();
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
  }, [kesim, editingCell, shortcutHelpOpen, minimapOpen, fullscreenMode]);

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

  const save = useCallback(
    (updated: KesimAlani, desc?: string) => {
      setKesim(updated);
      updateKesimAlani(updated);
      if (desc) {
        history.push(updated, desc);
      }
    },
    []
  );

  const handleUndo = useCallback(() => {
    const prev = history.undo();
    if (prev) {
      setKesim(prev);
      updateKesimAlani(prev);
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    const next = history.redo();
    if (next) {
      setKesim(next);
      updateKesimAlani(next);
    }
  }, [history]);

  const handleGoToStep = useCallback((index: number) => {
    const target = history.goToStep(index);
    if (target) {
      setKesim(target);
      updateKesimAlani(target);
    }
  }, [history]);

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
    };
    save({ ...kesim, donations: [...kesim.donations, donation] }, `Bağışçı eklendi: ${donation.description || donation.name}`);
    setNewDonation({ name: "", description: "", donationType: "", shareCount: 1, vekalet: "", notes: "" });
    setAddDialogOpen(false);
  }

  function deleteDonation(id: string) {
    if (!kesim) return;
    const target = kesim.donations.find(d => d.id === id);
    save({
      ...kesim,
      donations: kesim.donations.filter((d) => d.id !== id),
    }, `Bağışçı silindi: ${target?.description || target?.name || ""}`);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function deleteSelected() {
    if (!kesim || selectedIds.size === 0) return;
    save({
      ...kesim,
      donations: kesim.donations.filter((d) => !selectedIds.has(d.id)),
    }, `${selectedIds.size} bağışçı silindi`);
    setSelectedIds(new Set());
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
    save({
      ...kesim,
      donations: kesim.donations.map((d) =>
        d.id === id ? { ...d, [field]: value } : d
      ),
    }, `Bağışçı güncellendi`);
  }

  function toggleDonationTag(donationId: string, tagId: string) {
    if (!kesim) return;
    save({
      ...kesim,
      donations: kesim.donations.map((d) => {
        if (d.id !== donationId) return d;
        const existing = d.tags || [];
        const has = existing.includes(tagId);
        return { ...d, tags: has ? existing.filter(t => t !== tagId) : [...existing, tagId] };
      }),
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

  function bulkDeleteByDesc(description: string) {
    if (!kesim) return;
    const key = description.trim().toLowerCase();
    save({
      ...kesim,
      donations: kesim.donations.filter((d) =>
        d.description.trim().toLowerCase() !== key
      ),
    }, `Toplu silindi: ${description}`);
    setPersonEditDesc(null);
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
        alert("Excel dosyası okunamadı. Lütfen geçerli bir dosya seçin.");
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
    const newDonations: Donation[] = [];

    for (let r = startRow; r < previewData.length; r++) {
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

    save({ ...kesim, donations: [...kesim.donations, ...newDonations] }, `${newDonations.length} bağışçı toplu eklendi`);
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
  }

  async function handleAutoGroup() {
    if (!kesim || groupingInProgress) return;
    setGroupingInProgress(true);
    setGroupingProgress(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const groups = await autoGroupDonationsAsync(kesim.donations, (progress) => {
        setGroupingProgress({ ...progress });
      });
      save({ ...kesim, animalGroups: groups }, `Otomatik gruplama yapıldı: ${groups.length} hayvan`);
      const found = checkGroupConflicts(groups);
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
    save({ ...kesim, donations: sorted }, `Sıralama değiştirildi`);
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

    save({ ...kesim, animalGroups: groups }, `Grup içi taşıma yapıldı`);
  }

  const [dragOverGroup, setDragOverGroup] = useState<number | null>(null);

  function handleDragStart(groupIdx: number, donationIdx: number, e?: React.DragEvent) {
    setDragItem({ groupIdx, donationIdx });
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      const target = e.currentTarget as HTMLElement;
      target.style.opacity = "0.5";
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
    if (dragItem) {
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
    save({ ...kesim, animalGroups: groups }, `Gruptan çıkarıldı`);
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
    save({ ...kesim, animalGroups: groups }, `Grup bağışçısı güncellendi`);
  }

  function setGroupColorTag(groupIdx: number, tag: ColorTag) {
    if (!kesim) return;
    const groups = kesim.animalGroups.map((g, i) =>
      i === groupIdx ? { ...g, colorTag: tag } : g
    );
    save({ ...kesim, animalGroups: groups }, `Grup rengi değiştirildi: Hayvan ${groups[groupIdx].animalNo}`);
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
    const groups = kesim.animalGroups.map((g, i) =>
      i === groupIdx ? { ...g, notes } : g
    );
    save({ ...kesim, animalGroups: groups }, `Grup notu güncellendi: Hayvan ${groups[groupIdx].animalNo}`);
  }

  function toggleGroupLock(groupIdx: number) {
    if (!kesim) return;
    const groups = kesim.animalGroups.map((g, i) =>
      i === groupIdx ? { ...g, locked: !g.locked } : g
    );
    const target = groups[groupIdx];
    save({ ...kesim, animalGroups: groups }, `Grup ${target.locked ? "kilidi açıldı" : "kilitlendi"}: Hayvan ${target.animalNo}`);
  }

  function splitGroup(groupIdx: number) {
    if (!kesim) return;
    if (isGroupLocked(groupIdx)) return;
    const group = kesim.animalGroups[groupIdx];
    const filled = group.donations.filter(d => d.name.trim() !== "");
    if (filled.length <= 1) return;

    const midpoint = Math.ceil(filled.length / 2);
    const firstHalf = filled.slice(0, midpoint);
    const secondHalf = filled.slice(midpoint);

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
    save({ ...kesim, animalGroups: renumbered }, `Grup bölündü: Hayvan ${group.animalNo}`);
  }

  function toggleGroupSelect(groupId: string) {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

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

    save({ ...kesim, animalGroups: renumbered }, `${groupsToMerge.length} grup birleştirildi`);
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

    save({ ...kesim, animalGroups: groups }, `Takas yapıldı: Hayvan ${groups[swapSelection.groupIdx].animalNo} ↔ Hayvan ${groups[swapTarget.groupIdx].animalNo}`);
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

    save({ ...kesim, animalGroups: groups }, `Otomatik çakışma çözümü: ${appliedCount} takas uygulandı (${resolveResults.length} kişi)`);
    setAutoResolveOpen(false);
    setResolveResults([]);

    const newConflicts = checkGroupConflicts(groups);
    setConflicts(newConflicts);
    if (newConflicts.length > 0) setShowConflicts(true);
  }

  function exportDonorsExcel() {
    if (!kesim) return;
    const data = kesim.donations.map((d, i) => ({
      "Sıra": i + 1,
      "Adına Kesilen": d.name,
      "Vekaleti Veren": d.description,
      "Cinsi": d.donationType,
      "Hisse": d.shareCount,
      "Vekalet": d.vekalet,
      "Notlar": d.notes,
      "Durum": d.excluded ? "Hariç" : "Dahil",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bağışçılar");
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
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kesim Kağıdı");
    XLSX.writeFile(wb, `${kesim.name}_kesim_kagidi.xlsx`);
  }

  function toggleGroupCollapse(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

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

  const currentGroupMatches = groupSearchMatches();

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

  function toggleGroupDonationSelect(donationId: string) {
    setSelectedGroupDonations(prev => {
      const next = new Set(prev);
      if (next.has(donationId)) next.delete(donationId);
      else next.add(donationId);
      return next;
    });
  }

  function bulkRemoveFromGroups() {
    if (!kesim || selectedGroupDonations.size === 0) return;
    const groups = kesim.animalGroups.map(g => ({
      ...g,
      donations: g.donations.map(d => {
        if (selectedGroupDonations.has(d.id) && d.name.trim()) {
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
    save({ ...kesim, animalGroups: groups }, `${selectedGroupDonations.size} bağışçı gruplardan çıkarıldı`);
    setSelectedGroupDonations(new Set());
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
      alert("Hedef grupta boş slot yok. Taşıma yapılamadı.");
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
    save({ ...kesim, animalGroups: groups }, `${itemsToMove.length} bağışçı Hayvan ${groups[targetGroupIdx].animalNo}'e taşındı`);
    setSelectedGroupDonations(new Set());
    setBulkMoveTargetGroup(-1);
    if (moveCount < candidateIds.length) {
      alert(`Hedef grupta yeterli boş slot olmadığı için ${moveCount}/${candidateIds.length} bağışçı taşındı.`);
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
    save({ ...kesim, animalGroups: groups }, `${selectedGroupDonations.size} bağışçı toplu düzenlendi`);
    setSelectedGroupDonations(new Set());
    setBulkGroupEditOpen(false);
    setBulkGroupEditValue("");
  }

  if (!kesim) return null;

  const totalShares = getTotalShares(kesim.donations);
  const requiredAnimals = getRequiredAnimals(kesim.donations);

  const descCountMap = new Map<string, number>();
  for (const d of kesim.donations) {
    if (d.excluded) continue;
    const normalizedDesc = d.description.trim().toLowerCase();
    if (normalizedDesc) {
      descCountMap.set(normalizedDesc, (descCountMap.get(normalizedDesc) || 0) + 1);
    }
  }

  const groupedDonorIds = new Set<string>();
  for (const g of kesim.animalGroups) {
    for (const d of g.donations) {
      if (d.name.trim()) groupedDonorIds.add(d.id);
    }
  }
  const ungroupedDonors = kesim.donations.filter(d => !d.excluded && !groupedDonorIds.has(d.id));

  const ungroupedEffective = computeEffectiveShares(ungroupedDonors);
  const ungroupedDescProcessed = new Set<string>();
  let ungroupedShareCount = 0;
  for (const d of ungroupedDonors) {
    const key = d.description.trim().toLowerCase();
    if (key && ungroupedDescProcessed.has(key)) continue;
    ungroupedDescProcessed.add(key);
    ungroupedShareCount += ungroupedEffective.get(d.id) || d.shareCount;
  }

  const effectiveShareMap = computeEffectiveShares(kesim.donations);
  const shareDistribution: Record<number, number> = {};
  for (let i = 1; i <= 7; i++) shareDistribution[i] = 0;
  const distDescProcessed = new Set<string>();
  for (const d of kesim.donations) {
    if (d.excluded) continue;
    const key = d.description.trim().toLowerCase();
    if (key && distDescProcessed.has(key)) continue;
    distDescProcessed.add(key);
    const eff = effectiveShareMap.get(d.id) || d.shareCount;
    const sc = Math.max(1, Math.min(7, eff));
    shareDistribution[sc] = (shareDistribution[sc] || 0) + 1;
  }

  const groupCompositions = new Map<string, number>();
  for (const g of kesim.animalGroups) {
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
    groupCompositions.set(label, (groupCompositions.get(label) || 0) + 1);
  }

  const preFilteredDonations = filterUngrouped
    ? kesim.donations.filter(d => !d.excluded && !groupedDonorIds.has(d.id))
    : kesim.donations;

  const advancedFilteredDonations = preFilteredDonations.filter(d => {
    if (filterStatus === "active" && d.excluded) return false;
    if (filterStatus === "excluded" && !d.excluded) return false;
    if (filterCinsi !== "all" && d.donationType.toLowerCase() !== filterCinsi.toLowerCase()) return false;
    if (filterHisseMin > 0 && d.shareCount < filterHisseMin) return false;
    if (filterHisseMax > 0 && d.shareCount > filterHisseMax) return false;
    if (filterTags.length > 0) {
      const donorTags = d.tags || [];
      if (!filterTags.some(ft => donorTags.includes(ft))) return false;
    }
    return true;
  });

  const filteredDonations = searchQuery.trim()
    ? advancedFilteredDonations.filter(d => {
        const q = searchQuery.trim().toLowerCase();
        return d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.vekalet.toLowerCase().includes(q) ||
          d.donationType.toLowerCase().includes(q) ||
          (d.notes || "").toLowerCase().includes(q);
      })
    : advancedFilteredDonations;

  const uniqueDonationTypes = Array.from(new Set(
    kesim.donations.map(d => d.donationType.trim()).filter(Boolean)
  )).sort();

  const activeFilterCount =
    (filterCinsi !== "all" ? 1 : 0) +
    (filterHisseMin > 0 || filterHisseMax > 0 ? 1 : 0) +
    (filterTags.length > 0 ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0);

  function clearAdvancedFilters() {
    setFilterCinsi("all");
    setFilterHisseMin(0);
    setFilterHisseMax(0);
    setFilterTags([]);
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
            <Input
              className={`${inputH} border-0 bg-transparent p-0 focus:bg-primary/5 focus:ring-1 focus:ring-primary/30 rounded transition-colors`}
              value={d.notes || ""}
              onChange={(e) => updateGroupDonation(groupIdx, dIdx, "notes", e.target.value)}
              onKeyDown={(e) => handleGroupCellTab(e, groupIdx, dIdx, "notes")}
              placeholder="—"
            />
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
                    onClick={() => removeFromGroup(groupIdx, dIdx)}
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
    <div className={`min-h-screen bg-background ${fullscreenMode ? "fixed inset-0 z-50 overflow-auto" : ""}`}>
      <div className={`mx-auto p-4 ${fullscreenMode ? "max-w-full" : "max-w-7xl"}`}>
        {!fullscreenMode && (
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{kesim.name}</h1>
            <p className="text-sm text-muted-foreground">
              {kesim.donations.length} bağışçı • {totalShares} hisse •{" "}
              {requiredAnimals} hayvan gerekli
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1 border rounded-md px-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                disabled={!history.canUndo}
                title="Geri Al (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRedo}
                disabled={!history.canRedo}
                title="İleri Al (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHistoryPanelOpen(!historyPanelOpen)}
                title="Geçmiş"
              >
                <History className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShortcutHelpOpen(true)}
              title="Klavye Kısayolları (?)"
            >
              <Keyboard className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              title="Tam Ekran (F11)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={exportDonorsExcel} title="Bağışçı Listesi Excel">
              <FileSpreadsheet className="w-4 h-4" />
            </Button>
            {kesim.animalGroups.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={exportGroupsExcel} title="Kesim Kağıdı Excel">
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/print/${kesim.id}`)}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Yazdır
                </Button>
              </>
            )}
          </div>
        </div>
        )}

        {!fullscreenMode && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{kesim.donations.filter(d => !d.excluded).length}</div>
            <div className="text-xs text-muted-foreground">Aktif Bağışçı</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{totalShares}</div>
            <div className="text-xs text-muted-foreground">Toplam Hisse</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{requiredAnimals}</div>
            <div className="text-xs text-muted-foreground">Gereken Hayvan</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">
              {kesim.animalGroups.length > 0
                ? kesim.animalGroups.reduce((sum, g) => sum + g.donations.filter(d => d.name.trim() === "").length, 0)
                : 0}
            </div>
            <div className="text-xs text-muted-foreground">Boş Slot</div>
          </Card>
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

        <div
          ref={splitContainerRef}
          className={`flex gap-0 ${donorListVisible ? "" : ""}`}
          style={{ position: "relative" }}
        >
          {donorListVisible && !fullscreenMode && <div style={{ width: donorListVisible ? `${workspace.prefs.splitRatio}%` : "0%", minWidth: 0, flexShrink: 0, paddingRight: "12px" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Bağışçı Listesi</h2>
                {filterUngrouped && (
                  <button
                    onClick={() => setFilterUngrouped(false)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
                  >
                    Gruplanmamış
                    <span className="text-[10px]">✕</span>
                  </button>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    className="h-8 text-sm pl-8 w-48"
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
                  <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {bulkStep === "input" ? "Toplu Bağışçı Ekle" : "Sütun Eşleştirme"}
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

                    {bulkStep === "mapping" && (
                      <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Settings2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">
                            Her sütunun hangi bilgiye karşılık geldiğini aşağıdan seçin. Kullanmak istemediğiniz sütunları "Atla" olarak ayarlayın.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
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

                        <div className="border rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
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

                        <div className="flex gap-2">
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
                </div>
                {activeFilterCount > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {filteredDonations.length} / {kesim.donations.length} bağışçı gösteriliyor
                  </div>
                )}
              </Card>
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
                      <Select value={bulkEditField} onValueChange={(v: any) => setBulkEditField(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="donationType">Cinsi</SelectItem>
                          <SelectItem value="shareCount">Hisse Sayısı</SelectItem>
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
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
                  </thead>
                  <tbody>
                    {filteredDonations.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-muted-foreground">
                          {searchQuery.trim() ? `"${searchQuery}" için sonuç bulunamadı` : filterUngrouped ? "Tüm bağışçılar gruplara atanmış" : 'Henüz bağışçı eklenmedi. "Toplu Ekle" ile Excel yükleyin veya yapıştırın.'}
                        </td>
                      </tr>
                    ) : (
                      filteredDonations.map((d, idx) => {
                        const descCount = d.excluded ? 0 : (descCountMap.get(d.description.trim().toLowerCase()) || 1);
                        const effectiveShare = descCount > 1 ? descCount : d.shareCount;
                        return (
                        <tr
                          key={d.id}
                          className={`border-b hover:bg-muted/30 transition-colors ${selectedIds.has(d.id) ? "bg-primary/5" : ""} ${d.excluded ? "opacity-40 line-through" : ""}`}
                        >
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
                              <span
                                className="cursor-text block px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
                                onClick={() => startEditing(d.id, "notes")}
                              >
                                {d.notes || "—"}
                              </span>
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
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {kesim.donations.length > 0 && (
              <div className="mt-4 flex gap-2">
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
          </div>}

          {donorListVisible && !fullscreenMode && (
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

          <div style={{ flex: 1, minWidth: 0 }}>
            <div ref={groupsHeaderRef} className="flex items-center justify-between mb-4 flex-wrap gap-2 sticky top-0 z-20 bg-background py-2 -mt-2 border-b border-transparent" style={{ backdropFilter: "blur(8px)" }}>
              <div className="flex items-center gap-2 flex-wrap">
                {!fullscreenMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setDonorListVisible(!donorListVisible)}
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
                      className="h-8 w-20 text-sm text-center"
                      placeholder="No (Ctrl+G)"
                      value={jumpToAnimal}
                      onChange={(e) => setJumpToAnimal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const el = document.getElementById(`animal-group-${jumpToAnimal}`);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        const el = document.getElementById(`animal-group-${jumpToAnimal}`);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    >
                      Git
                    </Button>
                  </div>
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
                    onClick={() => setColorTagFilter("all")}
                    className={`text-xs px-2 py-0.5 rounded border ${colorTagFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >Tümü</button>
                  <button
                    onClick={() => setColorTagFilter("green")}
                    className={`w-5 h-5 rounded-full border-2 ${colorTagFilter === "green" ? "ring-2 ring-offset-1 ring-green-500" : ""}`}
                    style={{ backgroundColor: "#22c55e" }}
                    title="Yeşil"
                  />
                  <button
                    onClick={() => setColorTagFilter("orange")}
                    className={`w-5 h-5 rounded-full border-2 ${colorTagFilter === "orange" ? "ring-2 ring-offset-1 ring-orange-500" : ""}`}
                    style={{ backgroundColor: "#f97316" }}
                    title="Turuncu"
                  />
                  <button
                    onClick={() => setColorTagFilter("red")}
                    className={`w-5 h-5 rounded-full border-2 ${colorTagFilter === "red" ? "ring-2 ring-offset-1 ring-red-500" : ""}`}
                    style={{ backgroundColor: "#ef4444" }}
                    title="Kırmızı"
                  />
                  <button
                    onClick={() => setColorTagFilter("")}
                    className={`w-5 h-5 rounded-full border-2 border-dashed ${colorTagFilter === "" ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                    title="Renksiz"
                  />
                </div>

                <div className="flex items-center gap-1 border-l pl-2 ml-1">
                  <Button
                    variant={showOnlyIncomplete ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowOnlyIncomplete(!showOnlyIncomplete)}
                    title="Sadece eksik grupları göster"
                  >
                    <Filter className="w-3 h-3 mr-1" />
                    Eksik
                  </Button>
                  <Button
                    variant={highlightIncomplete ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setHighlightIncomplete(!highlightIncomplete)}
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

            {swapSelection && (
              <div className="flex items-center gap-3 p-2 mb-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
                <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-purple-800 dark:text-purple-200">
                  <strong>Takas modu:</strong> Hayvan {kesim.animalGroups[swapSelection.groupIdx]?.animalNo}, Sıra {swapSelection.donationIdx + 1} seçildi.
                  Başka bir gruptaki bağışçıya tıklayın.
                </span>
                <Button variant="ghost" size="sm" onClick={cancelSwap}>
                  İptal
                </Button>
              </div>
            )}

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
                                <span className="text-xs">({c.totalShares} hisse) → Hayvan No: {c.animalNos.join(", ")}</span>
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
                                    <span>({c.totalShares} hisse) → Hayvan No: {c.animalNos.join(", ")}</span>
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
                      className={`overflow-hidden transition-all ${swapSelection?.groupIdx === groupIdx ? "ring-2 ring-purple-400" : ""} ${highlightIncomplete && isIncomplete ? "ring-2 ring-orange-400" : ""} ${dragItem && dragItem.groupIdx !== groupIdx && dragOverGroup === groupIdx ? "ring-2 ring-primary shadow-lg scale-[1.01]" : ""} ${dragItem && dragItem.groupIdx !== groupIdx && !isGroupLocked(groupIdx) ? "border-dashed border-2 border-primary/30" : ""}`}
                      style={group.colorTag ? { borderLeft: `4px solid ${colorMap[group.colorTag]}` } : (highlightIncomplete && isIncomplete ? { borderLeft: "4px solid #f97316" } : {})}
                      onDragOver={(e) => { e.preventDefault(); setDragOverGroup(groupIdx); }}
                      onDragLeave={(e) => handleDragLeave(e, groupIdx)}
                    >
                      <div
                        className={`flex items-center justify-between ${compact ? "p-2" : "p-3"} bg-primary/10 cursor-pointer`}
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
                            onClick={(e) => { e.stopPropagation(); splitGroup(groupIdx); }}
                            className={`p-0.5 rounded transition-colors ${group.locked || filledCount <= 1 ? "opacity-30 cursor-not-allowed" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
                            title={group.locked ? "Kilitli grup bölünemez" : filledCount <= 1 ? "Bölmek için en az 2 bağışçı gerekli" : "Grubu Böl"}
                            disabled={group.locked || filledCount <= 1}
                          >
                            <Scissors className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleGroupLock(groupIdx); }}
                            className={`p-0.5 rounded transition-colors ${group.locked ? "text-amber-500" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                            title={group.locked ? "Kilidi Aç" : "Kilitle"}
                          >
                            {group.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
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
                          onClick={() => {
                            if (confirm(`"${personEditDesc}" adlı kişinin tüm ${matchingDonations.length} kaydı silinecek. Emin misiniz?`)) {
                              bulkDeleteByDesc(personEditDesc);
                            }
                          }}
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
                          <th className="p-2 w-10"></th>
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
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteDonation(d.id)}>
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
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
          {swapSelection && swapTarget && kesim && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-950">
                  <p className="text-xs text-muted-foreground mb-1">
                    Hayvan {kesim.animalGroups[swapSelection.groupIdx]?.animalNo}, Sıra {swapSelection.donationIdx + 1}
                  </p>
                  <p className="font-semibold text-sm">
                    {kesim.animalGroups[swapSelection.groupIdx]?.donations[swapSelection.donationIdx]?.description || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {kesim.animalGroups[swapSelection.groupIdx]?.donations[swapSelection.donationIdx]?.name || "—"}
                  </p>
                </div>
                <div className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-950">
                  <p className="text-xs text-muted-foreground mb-1">
                    Hayvan {kesim.animalGroups[swapTarget.groupIdx]?.animalNo}, Sıra {swapTarget.donationIdx + 1}
                  </p>
                  <p className="font-semibold text-sm">
                    {kesim.animalGroups[swapTarget.groupIdx]?.donations[swapTarget.donationIdx]?.description || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {kesim.animalGroups[swapTarget.groupIdx]?.donations[swapTarget.donationIdx]?.name || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <ArrowLeftRight className="w-6 h-6 text-purple-400" />
              </div>
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
          )}
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
    </div>
  );
}
