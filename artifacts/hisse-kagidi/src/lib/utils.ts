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
