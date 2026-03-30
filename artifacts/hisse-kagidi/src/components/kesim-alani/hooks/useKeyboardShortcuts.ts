import { useEffect } from "react";
import type { KesimAlani } from "@/lib/types";
import type { SaveFn } from "./types";

interface UseKeyboardShortcutsDeps {
  kesim: KesimAlani | null;
  saveToApi: (data: KesimAlani, saveType?: "full" | "donations" | "groups") => void;
  handleUndo: () => void;
  handleRedo: () => void;
  editingCell: { donationId: string; field: string } | null;
  cancelEdit: () => void;
  shortcutHelpOpen: boolean;
  setShortcutHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  minimapOpen: boolean;
  setMinimapOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fullscreenMode: boolean;
  setFullscreenMode: React.Dispatch<React.SetStateAction<boolean>>;
  jumpDialogOpen: boolean;
  setJumpDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  toggleFullscreen: () => void;
}

export function useKeyboardShortcuts({
  kesim,
  saveToApi,
  handleUndo,
  handleRedo,
  editingCell,
  cancelEdit,
  shortcutHelpOpen,
  setShortcutHelpOpen,
  minimapOpen,
  setMinimapOpen,
  fullscreenMode,
  setFullscreenMode,
  jumpDialogOpen,
  setJumpDialogOpen,
  searchInputRef,
  toggleFullscreen,
}: UseKeyboardShortcutsDeps) {
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
        setShortcutHelpOpen((prev) => !prev);
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
  }, [
    kesim,
    editingCell,
    shortcutHelpOpen,
    minimapOpen,
    fullscreenMode,
    jumpDialogOpen,
    saveToApi,
    handleUndo,
    handleRedo,
    cancelEdit,
    setShortcutHelpOpen,
    setMinimapOpen,
    setFullscreenMode,
    setJumpDialogOpen,
    searchInputRef,
    toggleFullscreen,
  ]);
}
