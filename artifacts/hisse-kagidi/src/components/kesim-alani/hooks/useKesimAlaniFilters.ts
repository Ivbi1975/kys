import { useState, useMemo, useTransition } from "react";
import { turkishNormalize } from "@/lib/utils";
import type { Donation } from "@/lib/types";

type SortField = "name" | "description" | "donationType" | "shareCount";
type SortDir = "asc" | "desc";

interface UseKesimAlaniFiltersParams {
  donations: Donation[];
  groupedDonorIds: Set<string>;
  removedFromGroupIds: Set<string>;
}

export function useKesimAlaniFilters({ donations, groupedDonorIds, removedFromGroupIds }: UseKesimAlaniFiltersParams) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filterUngrouped, setFilterUngrouped] = useState(false);
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);
  const [highlightIncomplete, setHighlightIncomplete] = useState(true);
  const [filterCinsi, setFilterCinsi] = useState<string>("all");
  const [filterHisseMin, setFilterHisseMin] = useState<number>(0);
  const [filterHisseMax, setFilterHisseMax] = useState<number>(0);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterAiCategories, setFilterAiCategories] = useState<string[]>([]);
  const [filterAiWarnings, setFilterAiWarnings] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "excluded">("all");
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [showRemovedFilter, setShowRemovedFilter] = useState(false);
  const [, startFilterTransition] = useTransition();

  function handleSort(field: SortField) {
    if (sortField === field) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortField(null);
        setSortDir("asc");
      }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

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
      donations.flatMap(d => d.aiCategories || []).filter(Boolean)
    )).sort(),
    [donations]
  );

  return {
    sortField,
    setSortField,
    sortDir,
    setSortDir,
    personSearchQuery,
    setPersonSearchQuery,
    debouncedSearchQuery,
    setDebouncedSearchQuery,
    filterUngrouped,
    setFilterUngrouped,
    showOnlyIncomplete,
    setShowOnlyIncomplete,
    highlightIncomplete,
    setHighlightIncomplete,
    filterCinsi,
    setFilterCinsi,
    filterHisseMin,
    setFilterHisseMin,
    filterHisseMax,
    setFilterHisseMax,
    filterTags,
    setFilterTags,
    filterAiCategories,
    setFilterAiCategories,
    filterAiWarnings,
    setFilterAiWarnings,
    filterStatus,
    setFilterStatus,
    showAdvancedFilter,
    setShowAdvancedFilter,
    filterTeam,
    setFilterTeam,
    showRemovedFilter,
    setShowRemovedFilter,
    startFilterTransition,
    handleSort,
    activeFilterCount,
    clearAdvancedFilters,
    searchIndex,
    filteredDonations,
    uniqueDonationTypes,
    availableAiCategories,
  };
}
