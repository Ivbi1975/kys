import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function turkishNormalize(text: string): string {
  return text.toLocaleLowerCase("tr");
}

export function trUpperCase(text: string | null | undefined): string {
  if (!text) return "";
  return text.toLocaleUpperCase("tr-TR");
}

const DONATION_TYPE_ALIASES: Record<string, string> = {
  "mevta kurbani": "Mevta",
  "mevta kurbanı": "Mevta",
  "mevta kurbânı": "Mevta",
};

export function normalizeDonationType(type: string): string {
  const t = type.trim();
  const lower = t.toLocaleLowerCase("tr");
  return DONATION_TYPE_ALIASES[lower] ?? t;
}
