import { useState, useEffect, useCallback } from "react";

const THEME_KEY = "hisse-kagidi-theme";

export type ThemeMode = "light" | "dark" | "system";

function getSystemPreference(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "system") return getSystemPreference();
  return mode === "dark";
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    return "system";
  });

  const isDark = resolveIsDark(mode);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(THEME_KEY, mode);
  }, [isDark, mode]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const root = document.documentElement;
      if (mq.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((m) => (m === "light" ? "dark" : m === "dark" ? "system" : "light"));
  }, []);

  const setThemeMode = useCallback((m: ThemeMode) => setMode(m), []);

  return { isDark, mode, toggle, setThemeMode };
}
