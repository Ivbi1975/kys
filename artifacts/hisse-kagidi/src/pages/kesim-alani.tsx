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
} from "lucide-react";
import type { Donation, AnimalGroup, KesimAlani, ColorTag } from "@/lib/types";
import { getKesimAlani, updateKesimAlani } from "@/lib/storage";
import { autoGroupDonationsAsync, getTotalShares, getRequiredAnimals, checkGroupConflicts } from "@/lib/grouping";
import type { GroupingProgress, ConflictInfo } from "@/lib/grouping";
import { useHistory } from "@/lib/useHistory";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupingInProgress, setGroupingInProgress] = useState(false);
  const [groupingProgress, setGroupingProgress] = useState<GroupingProgress | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [personEditDesc, setPersonEditDesc] = useState<string | null>(null);
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  function handleDragStart(groupIdx: number, donationIdx: number) {
    setDragItem({ groupIdx, donationIdx });
  }

  function handleDragOver(
    e: React.DragEvent,
    groupIdx: number,
    donationIdx: number
  ) {
    e.preventDefault();
    setDragOverItem({ groupIdx, donationIdx });
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

    save({ ...kesim, animalGroups: groups }, `Otomatik çakışma çözümü: ${resolveResults.length} kişi düzeltildi`);
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

  const filteredDonations = searchQuery.trim()
    ? kesim.donations.filter(d => {
        const q = searchQuery.trim().toLowerCase();
        return d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.vekalet.toLowerCase().includes(q) ||
          d.donationType.toLowerCase().includes(q) ||
          (d.notes || "").toLowerCase().includes(q);
      })
    : kesim.donations;

  const displayPreviewRows = hasHeaderRow ? previewData.slice(1) : previewData;
  const headerRow = hasHeaderRow && previewData.length > 0 ? previewData[0] : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4">
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
        </div>

        {historyPanelOpen && (
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

        <div className={`grid gap-6 ${donorListVisible ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          {donorListVisible && <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Bağışçı Listesi</h2>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 text-sm pl-8 w-48"
                    placeholder="Ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
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
                          {searchQuery.trim() ? `"${searchQuery}" için sonuç bulunamadı` : 'Henüz bağışçı eklenmedi. "Toplu Ekle" ile Excel yükleyin veya yapıştırın.'}
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
                                className="h-7 text-sm"
                                value={d.vekalet || ""}
                                onChange={(e) =>
                                  updateDonationField(d.id, "vekalet", e.target.value)
                                }
                                onBlur={() => setEditingCell(null)}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text"
                                onClick={() =>
                                  setEditingCell({ donationId: d.id, field: "vekalet" })
                                }
                              >
                                {d.vekalet || "—"}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "description" ? (
                              <Input
                                className="h-7 text-sm"
                                value={d.description}
                                onChange={(e) =>
                                  updateDonationField(
                                    d.id,
                                    "description",
                                    e.target.value
                                  )
                                }
                                onBlur={() => setEditingCell(null)}
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-center gap-1">
                                <span
                                  className="cursor-text flex-1"
                                  onClick={() =>
                                    setEditingCell({
                                      donationId: d.id,
                                      field: "description",
                                    })
                                  }
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
                                className="h-7 text-sm"
                                value={d.name}
                                onChange={(e) =>
                                  updateDonationField(d.id, "name", e.target.value)
                                }
                                onBlur={() => setEditingCell(null)}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text"
                                onClick={() =>
                                  setEditingCell({ donationId: d.id, field: "name" })
                                }
                              >
                                {d.name || "—"}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "donationType" ? (
                              <Input
                                className="h-7 text-sm"
                                value={d.donationType}
                                onChange={(e) =>
                                  updateDonationField(
                                    d.id,
                                    "donationType",
                                    e.target.value
                                  )
                                }
                                onBlur={() => setEditingCell(null)}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text"
                                onClick={() =>
                                  setEditingCell({
                                    donationId: d.id,
                                    field: "donationType",
                                  })
                                }
                              >
                                {d.donationType || "—"}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {editingCell?.donationId === d.id &&
                            editingCell?.field === "notes" ? (
                              <Input
                                className="h-7 text-sm"
                                value={d.notes || ""}
                                onChange={(e) =>
                                  updateDonationField(d.id, "notes", e.target.value)
                                }
                                onBlur={() => setEditingCell(null)}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-text"
                                onClick={() =>
                                  setEditingCell({ donationId: d.id, field: "notes" })
                                }
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
                          <td className="p-2 flex gap-1">
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

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setDonorListVisible(!donorListVisible)}
                  title={donorListVisible ? "Bağışçı Listesini Gizle" : "Bağışçı Listesini Göster"}
                >
                  {donorListVisible ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                </Button>
                <h2 className="text-lg font-semibold">
                  Hayvan Grupları
                  {kesim.animalGroups.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({colorTagFilter === "all"
                        ? kesim.animalGroups.length
                        : kesim.animalGroups.filter(g => (g.colorTag || "") === colorTagFilter).length
                      }/{kesim.animalGroups.length} hayvan)
                    </span>
                  )}
                </h2>
                {kesim.animalGroups.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
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
                )}
              </div>
              {kesim.animalGroups.length > 0 && (
                <div className="flex gap-2 items-center">
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-8 w-20 text-sm text-center"
                      placeholder="No"
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
              <div className="space-y-4">
                {kesim.animalGroups
                  .map((group, groupIdx) => ({ group, groupIdx }))
                  .filter(({ group }) =>
                    colorTagFilter === "all" ? true : (group.colorTag || "") === colorTagFilter
                  )
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
                  return (
                    <Card key={group.id} id={`animal-group-${group.animalNo}`} className={`overflow-hidden ${swapSelection?.groupIdx === groupIdx ? "ring-2 ring-purple-400" : ""}`} style={group.colorTag ? { borderLeft: `4px solid ${colorMap[group.colorTag]}` } : {}}>
                      <div
                        className="flex items-center justify-between p-3 bg-primary/10 cursor-pointer"
                        onClick={() => toggleGroupCollapse(group.id)}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!group.locked) toggleGroupSelect(group.id); }}
                            className={`flex-shrink-0 ${group.locked ? "opacity-30 cursor-not-allowed" : ""}`}
                            title={group.locked ? "Kilitli grup seçilemez" : "Seç"}
                          >
                            {selectedGroupIds.has(group.id)
                              ? <CheckSquare className="w-4 h-4 text-primary" />
                              : <Square className="w-4 h-4 text-muted-foreground" />
                            }
                          </button>
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                          <h3 className="font-semibold text-sm">
                            {kesim.name} - HAYVAN NO: {group.animalNo}
                          </h3>
                          <div className="flex items-center gap-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
                            {(["green", "orange", "red", ""] as ColorTag[]).map((c) => (
                              <button
                                key={c || "none"}
                                onClick={() => setGroupColorTag(groupIdx, c)}
                                className={`w-3.5 h-3.5 rounded-full border transition-transform ${
                                  (group.colorTag || "") === c ? "scale-125 ring-1 ring-offset-1" : "opacity-50 hover:opacity-100"
                                } ${c === "" ? "border-dashed" : ""}`}
                                style={c ? { backgroundColor: colorMap[c] } : {}}
                                title={c === "green" ? "Yeşil" : c === "orange" ? "Turuncu" : c === "red" ? "Kırmızı" : "Renksiz"}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
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
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="p-1.5 w-6"></th>
                              <th className="p-1.5 text-left w-6">#</th>
                              <th className="p-1.5 text-left w-16">Vekalet</th>
                              <th className="p-1.5 text-left">Vekaleti Veren</th>
                              <th className="p-1.5 text-left">Adına Kesilen</th>
                              <th className="p-1.5 text-left w-16">Cinsi</th>
                              <th className="p-1.5 text-left w-20">Notlar</th>
                              <th className="p-1.5 w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.donations.map((d, dIdx) => (
                              <tr
                                key={d.id}
                                className={`border-b transition-colors ${
                                  dragOverItem?.groupIdx === groupIdx &&
                                  dragOverItem?.donationIdx === dIdx
                                    ? "bg-primary/20"
                                    : "hover:bg-muted/20"
                                }`}
                                draggable
                                onDragStart={() =>
                                  handleDragStart(groupIdx, dIdx)
                                }
                                onDragOver={(e) =>
                                  handleDragOver(e, groupIdx, dIdx)
                                }
                                onDrop={() => handleDrop(groupIdx, dIdx)}
                                onDragEnd={() => {
                                  setDragItem(null);
                                  setDragOverItem(null);
                                }}
                              >
                                <td className="p-1.5 cursor-grab">
                                  <GripVertical className="w-3 h-3 text-muted-foreground" />
                                </td>
                                <td className="p-1.5 text-muted-foreground">
                                  {dIdx + 1}
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    className="h-6 text-xs border-0 bg-transparent p-0"
                                    value={d.vekalet || ""}
                                    onChange={(e) =>
                                      updateGroupDonation(
                                        groupIdx,
                                        dIdx,
                                        "vekalet",
                                        e.target.value
                                      )
                                    }
                                    placeholder="—"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    className="h-6 text-xs border-0 bg-transparent p-0"
                                    value={d.description}
                                    onChange={(e) =>
                                      updateGroupDonation(
                                        groupIdx,
                                        dIdx,
                                        "description",
                                        e.target.value
                                      )
                                    }
                                    placeholder="—"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    className="h-6 text-xs border-0 bg-transparent p-0"
                                    value={d.name}
                                    onChange={(e) =>
                                      updateGroupDonation(
                                        groupIdx,
                                        dIdx,
                                        "name",
                                        e.target.value
                                      )
                                    }
                                    placeholder="—"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    className="h-6 text-xs border-0 bg-transparent p-0"
                                    value={d.donationType}
                                    onChange={(e) =>
                                      updateGroupDonation(
                                        groupIdx,
                                        dIdx,
                                        "donationType",
                                        e.target.value
                                      )
                                    }
                                    placeholder="—"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <Input
                                    className="h-6 text-xs border-0 bg-transparent p-0"
                                    value={d.notes || ""}
                                    onChange={(e) =>
                                      updateGroupDonation(
                                        groupIdx,
                                        dIdx,
                                        "notes",
                                        e.target.value
                                      )
                                    }
                                    placeholder="—"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <div className="flex gap-0.5">
                                    {d.name.trim() && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className={`h-5 w-5 p-0 ${
                                            swapSelection?.groupIdx === groupIdx && swapSelection?.donationIdx === dIdx
                                              ? "bg-purple-200 dark:bg-purple-800"
                                              : ""
                                          }`}
                                          onClick={() => handleSwapSelect(groupIdx, dIdx)}
                                          title="Takas için seç"
                                        >
                                          <ArrowLeftRight className="w-3 h-3 text-purple-500" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0"
                                          onClick={() =>
                                            removeFromGroup(groupIdx, dIdx)
                                          }
                                        >
                                          <Trash2 className="w-3 h-3 text-destructive" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="p-2 border-t">
                          <input
                            type="text"
                            placeholder="Grup notu..."
                            value={group.notes || ""}
                            onChange={(e) => updateGroupNotes(groupIdx, e.target.value)}
                            className="w-full text-xs bg-transparent border-0 outline-none placeholder:text-muted-foreground/50 text-muted-foreground"
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
    </div>
  );
}
