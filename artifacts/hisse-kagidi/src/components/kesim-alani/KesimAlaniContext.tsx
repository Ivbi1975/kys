import { createContext, useContext, useMemo } from "react";
import type { useKesimAlaniState } from "./useKesimAlaniState";

export type KesimAlaniContextValue = ReturnType<typeof useKesimAlaniState>;

export type FilterContextValue = Pick<KesimAlaniContextValue,
  "sortField" | "setSortField" | "sortDir" | "setSortDir" |
  "personSearchQuery" | "setPersonSearchQuery" | "debouncedSearchQuery" | "setDebouncedSearchQuery" |
  "showOnlyIncomplete" | "setShowOnlyIncomplete" |
  "highlightIncomplete" | "setHighlightIncomplete" |
  "filterCinsi" | "setFilterCinsi" | "filterHisseMin" | "setFilterHisseMin" | "filterHisseMax" | "setFilterHisseMax" |
  "filterTags" | "setFilterTags" | "filterAiCategories" | "setFilterAiCategories" | "filterAiWarnings" | "setFilterAiWarnings" |
  "filterStatus" | "setFilterStatus" | "showAdvancedFilter" | "setShowAdvancedFilter" |
  "filterTeam" | "setFilterTeam" | "showRemovedFilter" | "setShowRemovedFilter" |
  "startFilterTransition" | "activeFilterCount" | "clearAdvancedFilters" |
  "filteredDonations" | "uniqueDonationTypes" | "availableAiCategories" |
  "colorTagFilter" | "setColorTagFilter" | "groupCinsFilter" | "setGroupCinsFilter" |
  "filteredGroupItems" | "searchIndex" |
  "globalTags" | "tagCategories"
>;

export type SelectionContextValue = Pick<KesimAlaniContextValue,
  "selectedIds" | "setSelectedIds" |
  "selectedGroupIds" | "setSelectedGroupIds" |
  "selectedGroupDonations" | "setSelectedGroupDonations"
>;

export type DragDropContextValue = Pick<KesimAlaniContextValue,
  "dragItem" | "setDragItem" | "dragOverItem" | "setDragOverItem" |
  "dragOverGroup" | "setDragOverGroup" | "moveGroupDonation" |
  "handleDragStart" | "handleDragOver" | "handleDragLeave" |
  "handleDrop" | "handleDragEnd" | "handleDragOverCard"
>;

export type DonationContextValue = Pick<KesimAlaniContextValue,
  "addDonation" | "deleteDonation" | "handleFlagDonation" | "handleUnflagDonation" | "updateDonationField" | "toggleDonationTag" | "toggleDonationAiCategory" |
  "addDonorToBasket" | "removeFromBasket" | "updateBasketItemShareCount" | "toggleSelect" | "toggleSelectAll" |
  "startEditing" | "commitEdit" | "cancelEdit" | "editingCell" | "editDraft" | "setEditDraft" |
  "handleDonorCellKeyDown" | "handleSort" | "saveSingleDonationField" |
  "applyBulkEdit" | "bulkEditField" | "bulkEditOpen" | "bulkEditValue" |
  "setBulkEditField" | "setBulkEditOpen" | "setBulkEditValue" |
  "deleteSelected" | "groupedDonorIds" | "removedFromGroupIds" |
  "descCountMap" | "effectiveShareMap" | "highlightDonationId" | "setHighlightDonationId" |
  "addDialogOpen" | "setAddDialogOpen" | "setPersonEditDesc" |
  "findDeleteOpen" | "setFindDeleteOpen" | "findDeleteColumn" | "setFindDeleteColumn" |
  "findDeleteValue" | "setFindDeleteValue" | "findDeleteConfirm" | "setFindDeleteConfirm" |
  "findDeleteColumnLabel" | "getFindDeleteMatches" | "executeFindDelete" |
  "basketItemIds" |
  "addSelectedToBasket" | "groupingInProgress" | "handleAutoGroupSelected"
>;

export type GroupContextValue = Pick<KesimAlaniContextValue,
  "addEmptyGroup" | "deleteAnimalGroup" | "cleanEmptyGroups" |
  "toggleGroupCollapse" | "toggleGroupSelect" | "toggleGroupLock" |
  "collapsedGroups" | "collapseAll" | "expandAll" |
  "handleSetGroupColorTag" | "moveGroupUp" | "moveGroupDown" |
  "openSplitGroupDialog" | "mergeSelectedGroups" |
  "updateGroupDonation" | "updateGroupNotes" | "updateGroupFiyat" | "handleGroupCellTab" |
  "enhancedRemoveFromGroup" | "bulkRemoveFromGroups" |
  "handleAssignTeam" | "toggleGroupDonationSelect" | "handleSelectAllGroupDonations" |
  "bulkMoveTargetGroup" | "setBulkMoveTargetGroup" | "bulkMoveToGroup" |
  "bulkGroupEditOpen" | "setBulkGroupEditOpen" | "bulkGroupEditField" | "setBulkGroupEditField" |
  "bulkGroupEditValue" | "setBulkGroupEditValue" | "bulkChangeGroupDonationType" |
  "handleToggleBasketItem" | "handleSwapSelect" | "swapSelection" | "cancelSwap" |
  "groupSearchQuery" | "setGroupSearchQuery" | "groupSearchMatchIdx" | "setGroupSearchMatchIdx" |
  "groupSearchMatches" | "currentGroupMatches" |
  "isGroupLocked" | "saveSingleGroupField" | "swapLabels" |
  "groupFindDeleteOpen" | "setGroupFindDeleteOpen" | "groupFindDeleteColumn" | "setGroupFindDeleteColumn" |
  "groupFindDeleteValue" | "setGroupFindDeleteValue" | "groupFindDeleteConfirm" | "setGroupFindDeleteConfirm" |
  "getGroupFindDeleteMatches" | "executeGroupFindDelete" |
  "addGroupToBasket" | "addWholeAnimalToBasket" | "basketAnimalGroupIds" |
  "conflicts" | "setConflicts" | "showConflicts" | "setShowConflicts" | "openAutoResolve" |
  "scrollToAnimalGroup" | "photoCounts" | "handleViewPhotos" |
  "handleColumnDragStart" | "handleColumnDragOver" | "handleColumnDrop" | "handleColumnDragEnd" |
  "rangeLockInput" | "setRangeLockInput" | "lockAllGroups" | "unlockAllGroups" | "applyRangeLock" |
  "editableVisibleColumns" |
  "kesim" | "minimapOpen" | "setMinimapOpen"
>;

const KesimAlaniContext = createContext<KesimAlaniContextValue | null>(null);
const FilterContext = createContext<FilterContextValue | null>(null);
const SelectionContext = createContext<SelectionContextValue | null>(null);
const DragDropContext = createContext<DragDropContextValue | null>(null);
const DonationContext = createContext<DonationContextValue | null>(null);
const GroupContext = createContext<GroupContextValue | null>(null);

export function KesimAlaniProvider({
  value,
  children,
}: {
  value: KesimAlaniContextValue;
  children: React.ReactNode;
}) {
  const filterValue = useMemo<FilterContextValue>(() => ({
    sortField: value.sortField, setSortField: value.setSortField,
    sortDir: value.sortDir, setSortDir: value.setSortDir,
    personSearchQuery: value.personSearchQuery, setPersonSearchQuery: value.setPersonSearchQuery,
    debouncedSearchQuery: value.debouncedSearchQuery, setDebouncedSearchQuery: value.setDebouncedSearchQuery,
    showOnlyIncomplete: value.showOnlyIncomplete, setShowOnlyIncomplete: value.setShowOnlyIncomplete,
    highlightIncomplete: value.highlightIncomplete, setHighlightIncomplete: value.setHighlightIncomplete,
    filterCinsi: value.filterCinsi, setFilterCinsi: value.setFilterCinsi,
    filterHisseMin: value.filterHisseMin, setFilterHisseMin: value.setFilterHisseMin,
    filterHisseMax: value.filterHisseMax, setFilterHisseMax: value.setFilterHisseMax,
    filterTags: value.filterTags, setFilterTags: value.setFilterTags,
    filterAiCategories: value.filterAiCategories, setFilterAiCategories: value.setFilterAiCategories,
    filterAiWarnings: value.filterAiWarnings, setFilterAiWarnings: value.setFilterAiWarnings,
    filterStatus: value.filterStatus, setFilterStatus: value.setFilterStatus,
    showAdvancedFilter: value.showAdvancedFilter, setShowAdvancedFilter: value.setShowAdvancedFilter,
    filterTeam: value.filterTeam, setFilterTeam: value.setFilterTeam,
    showRemovedFilter: value.showRemovedFilter, setShowRemovedFilter: value.setShowRemovedFilter,
    startFilterTransition: value.startFilterTransition, activeFilterCount: value.activeFilterCount,
    clearAdvancedFilters: value.clearAdvancedFilters,
    filteredDonations: value.filteredDonations, uniqueDonationTypes: value.uniqueDonationTypes,
    availableAiCategories: value.availableAiCategories,
    colorTagFilter: value.colorTagFilter, setColorTagFilter: value.setColorTagFilter,
    groupCinsFilter: value.groupCinsFilter, setGroupCinsFilter: value.setGroupCinsFilter,
    filteredGroupItems: value.filteredGroupItems, searchIndex: value.searchIndex,
    globalTags: value.globalTags,
    tagCategories: value.tagCategories,
  }), [
    value.sortField, value.setSortField, value.sortDir, value.setSortDir,
    value.personSearchQuery, value.setPersonSearchQuery, value.debouncedSearchQuery, value.setDebouncedSearchQuery,
    value.showOnlyIncomplete, value.setShowOnlyIncomplete,
    value.highlightIncomplete, value.setHighlightIncomplete,
    value.filterCinsi, value.setFilterCinsi, value.filterHisseMin, value.setFilterHisseMin,
    value.filterHisseMax, value.setFilterHisseMax,
    value.filterTags, value.setFilterTags, value.filterAiCategories, value.setFilterAiCategories,
    value.filterAiWarnings, value.setFilterAiWarnings,
    value.filterStatus, value.setFilterStatus, value.showAdvancedFilter, value.setShowAdvancedFilter,
    value.filterTeam, value.setFilterTeam, value.showRemovedFilter, value.setShowRemovedFilter,
    value.startFilterTransition, value.activeFilterCount, value.clearAdvancedFilters,
    value.filteredDonations, value.uniqueDonationTypes, value.availableAiCategories,
    value.colorTagFilter, value.setColorTagFilter, value.groupCinsFilter, value.setGroupCinsFilter,
    value.filteredGroupItems, value.searchIndex,
    value.globalTags,
    value.tagCategories,
  ]);

  const selectionValue = useMemo<SelectionContextValue>(() => ({
    selectedIds: value.selectedIds, setSelectedIds: value.setSelectedIds,
    selectedGroupIds: value.selectedGroupIds, setSelectedGroupIds: value.setSelectedGroupIds,
    selectedGroupDonations: value.selectedGroupDonations, setSelectedGroupDonations: value.setSelectedGroupDonations,
  }), [
    value.selectedIds, value.setSelectedIds,
    value.selectedGroupIds, value.setSelectedGroupIds,
    value.selectedGroupDonations, value.setSelectedGroupDonations,
  ]);

  const dragDropValue = useMemo<DragDropContextValue>(() => ({
    dragItem: value.dragItem, setDragItem: value.setDragItem,
    dragOverItem: value.dragOverItem, setDragOverItem: value.setDragOverItem,
    dragOverGroup: value.dragOverGroup, setDragOverGroup: value.setDragOverGroup,
    moveGroupDonation: value.moveGroupDonation,
    handleDragStart: value.handleDragStart, handleDragOver: value.handleDragOver,
    handleDragLeave: value.handleDragLeave, handleDrop: value.handleDrop,
    handleDragEnd: value.handleDragEnd, handleDragOverCard: value.handleDragOverCard,
  }), [
    value.dragItem, value.setDragItem, value.dragOverItem, value.setDragOverItem,
    value.dragOverGroup, value.setDragOverGroup, value.moveGroupDonation,
    value.handleDragStart, value.handleDragOver, value.handleDragLeave,
    value.handleDrop, value.handleDragEnd, value.handleDragOverCard,
  ]);

  const donationValue = useMemo<DonationContextValue>(() => ({
    addDonation: value.addDonation, deleteDonation: value.deleteDonation,
    handleFlagDonation: value.handleFlagDonation, handleUnflagDonation: value.handleUnflagDonation,
    updateDonationField: value.updateDonationField, toggleDonationTag: value.toggleDonationTag,
    toggleDonationAiCategory: value.toggleDonationAiCategory,
    addDonorToBasket: value.addDonorToBasket, removeFromBasket: value.removeFromBasket,
    updateBasketItemShareCount: value.updateBasketItemShareCount,
    toggleSelect: value.toggleSelect, toggleSelectAll: value.toggleSelectAll,
    startEditing: value.startEditing, commitEdit: value.commitEdit,
    cancelEdit: value.cancelEdit, editingCell: value.editingCell,
    editDraft: value.editDraft, setEditDraft: value.setEditDraft,
    handleDonorCellKeyDown: value.handleDonorCellKeyDown, handleSort: value.handleSort,
    saveSingleDonationField: value.saveSingleDonationField,
    applyBulkEdit: value.applyBulkEdit, bulkEditField: value.bulkEditField,
    bulkEditOpen: value.bulkEditOpen, bulkEditValue: value.bulkEditValue,
    setBulkEditField: value.setBulkEditField, setBulkEditOpen: value.setBulkEditOpen,
    setBulkEditValue: value.setBulkEditValue,
    deleteSelected: value.deleteSelected, groupedDonorIds: value.groupedDonorIds,
    removedFromGroupIds: value.removedFromGroupIds,
    descCountMap: value.descCountMap, effectiveShareMap: value.effectiveShareMap,
    highlightDonationId: value.highlightDonationId, setHighlightDonationId: value.setHighlightDonationId,
    addDialogOpen: value.addDialogOpen, setAddDialogOpen: value.setAddDialogOpen,
    setPersonEditDesc: value.setPersonEditDesc,
    findDeleteOpen: value.findDeleteOpen, setFindDeleteOpen: value.setFindDeleteOpen,
    findDeleteColumn: value.findDeleteColumn, setFindDeleteColumn: value.setFindDeleteColumn,
    findDeleteValue: value.findDeleteValue, setFindDeleteValue: value.setFindDeleteValue,
    findDeleteConfirm: value.findDeleteConfirm, setFindDeleteConfirm: value.setFindDeleteConfirm,
    findDeleteColumnLabel: value.findDeleteColumnLabel,
    getFindDeleteMatches: value.getFindDeleteMatches, executeFindDelete: value.executeFindDelete,
    basketItemIds: value.basketItemIds,
    addSelectedToBasket: value.addSelectedToBasket,
    groupingInProgress: value.groupingInProgress,
    handleAutoGroupSelected: value.handleAutoGroupSelected,
  }), [
    value.addDonation, value.deleteDonation, value.handleFlagDonation, value.handleUnflagDonation,
    value.updateDonationField, value.toggleDonationTag, value.toggleDonationAiCategory,
    value.addDonorToBasket, value.removeFromBasket,
    value.updateBasketItemShareCount,
    value.toggleSelect, value.toggleSelectAll,
    value.startEditing, value.commitEdit, value.cancelEdit, value.editingCell,
    value.editDraft, value.setEditDraft, value.handleDonorCellKeyDown, value.handleSort,
    value.saveSingleDonationField,
    value.applyBulkEdit, value.bulkEditField, value.bulkEditOpen, value.bulkEditValue,
    value.setBulkEditField, value.setBulkEditOpen, value.setBulkEditValue,
    value.deleteSelected, value.groupedDonorIds, value.removedFromGroupIds,
    value.descCountMap, value.effectiveShareMap,
    value.highlightDonationId, value.setHighlightDonationId,
    value.addDialogOpen, value.setAddDialogOpen, value.setPersonEditDesc,
    value.findDeleteOpen, value.setFindDeleteOpen, value.findDeleteColumn, value.setFindDeleteColumn,
    value.findDeleteValue, value.setFindDeleteValue, value.findDeleteConfirm, value.setFindDeleteConfirm,
    value.findDeleteColumnLabel, value.getFindDeleteMatches, value.executeFindDelete,
    value.basketItemIds,
    value.addSelectedToBasket, value.groupingInProgress, value.handleAutoGroupSelected,
  ]);

  const groupValue = useMemo<GroupContextValue>(() => ({
    addEmptyGroup: value.addEmptyGroup, deleteAnimalGroup: value.deleteAnimalGroup,
    cleanEmptyGroups: value.cleanEmptyGroups,
    toggleGroupCollapse: value.toggleGroupCollapse, toggleGroupSelect: value.toggleGroupSelect,
    toggleGroupLock: value.toggleGroupLock,
    collapsedGroups: value.collapsedGroups, collapseAll: value.collapseAll, expandAll: value.expandAll,
    handleSetGroupColorTag: value.handleSetGroupColorTag,
    moveGroupUp: value.moveGroupUp, moveGroupDown: value.moveGroupDown,
    openSplitGroupDialog: value.openSplitGroupDialog, mergeSelectedGroups: value.mergeSelectedGroups,
    updateGroupDonation: value.updateGroupDonation, updateGroupNotes: value.updateGroupNotes,
    updateGroupFiyat: value.updateGroupFiyat,
    handleGroupCellTab: value.handleGroupCellTab,
    enhancedRemoveFromGroup: value.enhancedRemoveFromGroup, bulkRemoveFromGroups: value.bulkRemoveFromGroups,
    handleAssignTeam: value.handleAssignTeam,
    toggleGroupDonationSelect: value.toggleGroupDonationSelect,
    handleSelectAllGroupDonations: value.handleSelectAllGroupDonations,
    bulkMoveTargetGroup: value.bulkMoveTargetGroup, setBulkMoveTargetGroup: value.setBulkMoveTargetGroup,
    bulkMoveToGroup: value.bulkMoveToGroup,
    bulkGroupEditOpen: value.bulkGroupEditOpen, setBulkGroupEditOpen: value.setBulkGroupEditOpen,
    bulkGroupEditField: value.bulkGroupEditField, setBulkGroupEditField: value.setBulkGroupEditField,
    bulkGroupEditValue: value.bulkGroupEditValue, setBulkGroupEditValue: value.setBulkGroupEditValue,
    bulkChangeGroupDonationType: value.bulkChangeGroupDonationType,
    handleToggleBasketItem: value.handleToggleBasketItem,
    handleSwapSelect: value.handleSwapSelect, swapSelection: value.swapSelection, cancelSwap: value.cancelSwap,
    groupSearchQuery: value.groupSearchQuery, setGroupSearchQuery: value.setGroupSearchQuery,
    groupSearchMatchIdx: value.groupSearchMatchIdx, setGroupSearchMatchIdx: value.setGroupSearchMatchIdx,
    groupSearchMatches: value.groupSearchMatches, currentGroupMatches: value.currentGroupMatches,
    isGroupLocked: value.isGroupLocked, saveSingleGroupField: value.saveSingleGroupField, swapLabels: value.swapLabels,
    groupFindDeleteOpen: value.groupFindDeleteOpen, setGroupFindDeleteOpen: value.setGroupFindDeleteOpen,
    groupFindDeleteColumn: value.groupFindDeleteColumn, setGroupFindDeleteColumn: value.setGroupFindDeleteColumn,
    groupFindDeleteValue: value.groupFindDeleteValue, setGroupFindDeleteValue: value.setGroupFindDeleteValue,
    groupFindDeleteConfirm: value.groupFindDeleteConfirm, setGroupFindDeleteConfirm: value.setGroupFindDeleteConfirm,
    getGroupFindDeleteMatches: value.getGroupFindDeleteMatches,
    executeGroupFindDelete: value.executeGroupFindDelete,
    addGroupToBasket: value.addGroupToBasket, addWholeAnimalToBasket: value.addWholeAnimalToBasket,
    basketAnimalGroupIds: value.basketAnimalGroupIds,
    conflicts: value.conflicts, setConflicts: value.setConflicts,
    showConflicts: value.showConflicts, setShowConflicts: value.setShowConflicts,
    openAutoResolve: value.openAutoResolve,
    scrollToAnimalGroup: value.scrollToAnimalGroup, photoCounts: value.photoCounts,
    handleViewPhotos: value.handleViewPhotos,
    handleColumnDragStart: value.handleColumnDragStart, handleColumnDragOver: value.handleColumnDragOver,
    handleColumnDrop: value.handleColumnDrop, handleColumnDragEnd: value.handleColumnDragEnd,
    rangeLockInput: value.rangeLockInput, setRangeLockInput: value.setRangeLockInput,
    lockAllGroups: value.lockAllGroups, unlockAllGroups: value.unlockAllGroups,
    applyRangeLock: value.applyRangeLock,
    editableVisibleColumns: value.editableVisibleColumns,
    kesim: value.kesim, minimapOpen: value.minimapOpen, setMinimapOpen: value.setMinimapOpen,
  }), [
    value.addEmptyGroup, value.deleteAnimalGroup, value.cleanEmptyGroups,
    value.toggleGroupCollapse, value.toggleGroupSelect, value.toggleGroupLock,
    value.collapsedGroups, value.collapseAll, value.expandAll,
    value.handleSetGroupColorTag, value.moveGroupUp, value.moveGroupDown,
    value.openSplitGroupDialog, value.mergeSelectedGroups,
    value.updateGroupDonation, value.updateGroupNotes, value.handleGroupCellTab,
    value.enhancedRemoveFromGroup, value.bulkRemoveFromGroups,
    value.handleAssignTeam, value.toggleGroupDonationSelect, value.handleSelectAllGroupDonations,
    value.bulkMoveTargetGroup, value.setBulkMoveTargetGroup, value.bulkMoveToGroup,
    value.bulkGroupEditOpen, value.setBulkGroupEditOpen, value.bulkGroupEditField, value.setBulkGroupEditField,
    value.bulkGroupEditValue, value.setBulkGroupEditValue, value.bulkChangeGroupDonationType,
    value.handleToggleBasketItem, value.handleSwapSelect, value.swapSelection, value.cancelSwap,
    value.groupSearchQuery, value.setGroupSearchQuery, value.groupSearchMatchIdx, value.setGroupSearchMatchIdx,
    value.groupSearchMatches, value.currentGroupMatches,
    value.isGroupLocked, value.saveSingleGroupField, value.swapLabels,
    value.groupFindDeleteOpen, value.setGroupFindDeleteOpen,
    value.groupFindDeleteColumn, value.setGroupFindDeleteColumn,
    value.groupFindDeleteValue, value.setGroupFindDeleteValue,
    value.groupFindDeleteConfirm, value.setGroupFindDeleteConfirm,
    value.getGroupFindDeleteMatches, value.executeGroupFindDelete,
    value.addGroupToBasket, value.addWholeAnimalToBasket, value.basketAnimalGroupIds,
    value.conflicts, value.setConflicts, value.showConflicts, value.setShowConflicts,
    value.openAutoResolve, value.scrollToAnimalGroup, value.photoCounts, value.handleViewPhotos,
    value.handleColumnDragStart, value.handleColumnDragOver, value.handleColumnDrop, value.handleColumnDragEnd,
    value.rangeLockInput, value.setRangeLockInput, value.lockAllGroups, value.unlockAllGroups, value.applyRangeLock,
    value.editableVisibleColumns,
    value.kesim, value.minimapOpen, value.setMinimapOpen,
  ]);

  return (
    <KesimAlaniContext.Provider value={value}>
      <FilterContext.Provider value={filterValue}>
        <SelectionContext.Provider value={selectionValue}>
          <DragDropContext.Provider value={dragDropValue}>
            <DonationContext.Provider value={donationValue}>
              <GroupContext.Provider value={groupValue}>
                {children}
              </GroupContext.Provider>
            </DonationContext.Provider>
          </DragDropContext.Provider>
        </SelectionContext.Provider>
      </FilterContext.Provider>
    </KesimAlaniContext.Provider>
  );
}

export function useKesimAlaniContext(): KesimAlaniContextValue {
  const ctx = useContext(KesimAlaniContext);
  if (!ctx) throw new Error("useKesimAlaniContext must be used within KesimAlaniProvider");
  return ctx;
}

export function useFilterContext(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilterContext must be used within KesimAlaniProvider");
  return ctx;
}

export function useSelectionContext(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelectionContext must be used within KesimAlaniProvider");
  return ctx;
}

export function useDragDropContext(): DragDropContextValue {
  const ctx = useContext(DragDropContext);
  if (!ctx) throw new Error("useDragDropContext must be used within KesimAlaniProvider");
  return ctx;
}

export function useDonationContext(): DonationContextValue {
  const ctx = useContext(DonationContext);
  if (!ctx) throw new Error("useDonationContext must be used within KesimAlaniProvider");
  return ctx;
}

export function useGroupContext(): GroupContextValue {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error("useGroupContext must be used within KesimAlaniProvider");
  return ctx;
}
